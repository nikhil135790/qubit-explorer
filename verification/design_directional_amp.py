"""
Design + verification of the three-mode directional amplifier used in the app (src/physics/dirAmp.ts).

Modes a (input, qubit side), b (output), c (auxiliary, strongly damped). Couplings:
  a-b two-mode squeezing (gain) with pump phase phi
  a-c frequency conversion (beam splitter)
  b-c two-mode squeezing (gain)
Linear input-output theory in the Nambu basis; S(w) = I + sqrt(K) (M + i w)^-1 sqrt(K).

Run:  python verification/design_directional_amp.py
"""
import numpy as np, json
from scipy.optimize import minimize

def build(g, phi, k):
    M = np.zeros((6, 6), complex)
    for i in range(3):
        M[i, i] = -k[i] / 2; M[i + 3, i + 3] = -k[i] / 2
    def sq(i, j, gg, ph):
        e = np.exp(-1j * ph)
        M[i, j + 3] += -1j * gg * e; M[j, i + 3] += -1j * gg * e
        M[i + 3, j] += 1j * gg * np.conj(e); M[j + 3, i] += 1j * gg * np.conj(e)
    def bs(i, j, gg):
        M[i, j] += -1j * gg; M[j, i] += -1j * gg
        M[i + 3, j + 3] += 1j * gg; M[j + 3, i + 3] += 1j * gg
    sq(0, 1, g[0], phi); bs(0, 2, g[1]); sq(1, 2, g[2], 0.0)
    return M, np.sqrt(np.diag(np.concatenate([k, k])))

def summary(g, phi, kc, w=0.0):
    M, K = build(g, phi, [1, 1, kc])
    S = np.eye(6) + K @ np.linalg.solve(M + 1j * w * np.eye(6), K)
    P = np.abs(S) ** 2
    fwd = P[1, 0] + P[1, 3]; rev = P[0, 1] + P[0, 4]; refl_a = P[0, 0] + P[0, 3]
    nadd = 0.5 * P[1, :].sum() / fwd - 0.5
    stable = np.all(np.linalg.eigvals(M).real < 0)
    return dict(fwd_dB=10 * np.log10(fwd), rev_dB=10 * np.log10(rev + 1e-15), refl_a=refl_a, nadd=nadd, stable=bool(stable))

def design(G=20, seed=7, tries=200):
    """Find couplings giving G dB forward gain, a matched input port, and >= 40 dB isolation at phi = -pi/2."""
    rng = np.random.default_rng(seed)
    def cost(x):
        g, kc = x[:3], x[3]
        if kc <= 0.01 or min(g) < 0: return 1e4
        s = summary(g, -np.pi / 2, kc)
        if not s['stable']: return 1e4
        return (s['fwd_dB'] - G) ** 2 + 100 * s['refl_a'] + 5 * max(0, s['rev_dB'] + 40)
    best = None
    for _ in range(tries):
        x0 = [*rng.uniform(0, 2, 3), rng.uniform(0.2, 20)]
        r = minimize(cost, x0, method='Nelder-Mead', options={'maxiter': 6000, 'xatol': 1e-11, 'fatol': 1e-11})
        if best is None or r.fun < best.fun: best = r
    return best.x

if __name__ == '__main__':
    g0 = np.array([0.45661, 7.37111, 6.61056]); kc = 213.81494   # values used in the app
    print('Design point used in the app:')
    for name, phi, s in [('design (phi=-pi/2)', -np.pi / 2, 1), ('phi = 0, 90% pump', 0, 0.9),
                         ('phi = +pi/2', np.pi / 2, 1), ('90% pump', -np.pi / 2, 0.9), ('120% pump', -np.pi / 2, 1.2)]:
        r = summary(g0 * np.array([s, 1, s]), phi, kc)
        print(f"  {name:20s} stable={r['stable']!s:5s} fwd={r['fwd_dB']:7.2f} dB  rev={r['rev_dB']:7.1f} dB  nadd={r['nadd']:.3f}")
    # regenerate the stability map shipped with the app
    phis = np.linspace(-np.pi, np.pi, 181); ss = np.linspace(0, 1.25, 126)
    rows = [''.join('1' if np.all(np.linalg.eigvals(build(g0 * np.array([s, 1, s]), ph, [1, 1, kc])[0]).real < 0) else '0' for ph in phis) for s in ss]
    json.dump({'phis': [-np.pi, np.pi, 181], 's': [0, 1.25, 126], 'rows': rows}, open('src/physics/stability.json', 'w'))
    print('wrote src/physics/stability.json')
