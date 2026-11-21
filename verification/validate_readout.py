import numpy as np, qutip as qt, time
from readout_physics import *

rng = np.random.default_rng(1)
kappa, chi, nbar, T1 = TWO_PI*4, TWO_PI*2, 4.0, 50.0

# ---- Check 1: time-stepped Monte Carlo of the cavity + noisy homodyne record vs analytic fidelity
def mc_fidelity(eta, tau, N=4000, dt=0.002):
    steps = int(round(tau/dt))
    eps = drive_for_nbar(kappa, chi, nbar)
    out = {}
    for state in (0, 1):
        td = rng.exponential(T1, N) if state == 1 else np.full(N, np.inf)
        a = np.zeros(N, complex); S = np.zeros(N, complex)
        for k in range(steps):
            t = k*dt
            st = np.where((state == 1) & (t < td), 1, 0)
            L = kappa/2 + 1j*np.where(st == 1, chi, -chi)
            a = a + (-L*a + eps)*dt
            S += 2*np.sqrt(eta)*np.sqrt(kappa)*a*dt + (rng.normal(size=N)+1j*rng.normal(size=N))*np.sqrt(dt)
        out[state] = S
    m0, m1 = out[0].mean(), out[1][np.isinf(td) | True].mean()
    # threshold from the no-decay analytic means (same rule as analytic model)
    a0 = 2*np.sqrt(eta)*integrated_field(kappa, chi, nbar, 0, tau)
    a1 = 2*np.sqrt(eta)*integrated_field(kappa, chi, nbar, 1, tau)
    ax = (a1-a0)/abs(a1-a0); thr = 0.5*np.real(np.conj(ax)*(a0+a1))
    P10 = np.mean(np.real(np.conj(ax)*out[0]) > thr)
    P01 = np.mean(np.real(np.conj(ax)*out[1]) < thr)
    return 1-0.5*(P10+P01)

print("Check 1: Monte Carlo vs analytic readout fidelity")
for eta, tau in [(0.03, 0.4), (0.03, 1.0), (0.3, 0.2), (0.3, 0.6)]:
    Fa = readout_fidelity(kappa, chi, nbar, eta, tau, T1)[0]
    Fm = mc_fidelity(eta, tau)
    print(f"  eta={eta:4.2f} tau={tau:3.1f}us  analytic F={Fa:.4f}  MC F={Fm:.4f}")

# ---- Check 2: QuTiP master equation for thermal-photon dephasing vs Clerk-Utami formula
print("\nCheck 2: QuTiP dephasing vs analytic formula")
N = 20
a = qt.tensor(qt.destroy(N), qt.qeye(2)); sz = qt.tensor(qt.qeye(N), qt.sigmaz())
sm = qt.tensor(qt.qeye(N), qt.sigmam())
H = chi*a.dag()*a*sz
for n_th in [0.01, 0.05, 0.2]:
    c_ops = [np.sqrt(kappa*(1+n_th))*a, np.sqrt(kappa*n_th)*a.dag()]
    rho0 = qt.tensor(qt.thermal_dm(N, n_th), qt.ket2dm((qt.basis(2,0)+qt.basis(2,1)).unit()))
    tl = np.linspace(0, 40/ (kappa*n_th+1e-9) if n_th>0 else 5, 400)
    tl = np.linspace(0, min(tl[-1], 30.0), 600)
    r = qt.mesolve(H, rho0, tl, c_ops, e_ops=[sm])
    c = np.abs(r.expect[0])
    i0 = len(tl)//3
    g_num = -np.polyfit(tl[i0:], np.log(c[i0:]), 1)[0]
    g_an = thermal_dephasing(kappa, chi, n_th)
    print(f"  n_th={n_th:5.2f}  QuTiP Gamma_phi={g_num:.4f}/us  formula={g_an:.4f}/us  ratio={g_num/g_an:.3f}")
