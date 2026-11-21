"""
Readout chain model: transmon -> readout resonator -> amplifier chain -> digitizer.
Units: time in microseconds, rates in rad/us (so kappa = 2*pi*kappa_MHz).

Conventions
-----------
Dispersive shift: resonator frequency is w_r + chi (qubit |1>) or w_r - chi (qubit |0>),
so the two states are separated by 2*chi. Drive sits at w_r (halfway between).
Hamiltonian in the drive frame: H = chi * sigma_z * a^dag a  (+ drive).
"""
import numpy as np
from scipy.special import erfc

TWO_PI = 2 * np.pi
K_OVER_H_GHZ = 20.837  # k_B / h in GHz per kelvin


# ---------- 1. Resonator response ----------
def lam(kappa, chi, state):
    """Complex relaxation rate of the field for qubit state (0 -> -chi, 1 -> +chi)."""
    s = -1 if state == 0 else +1
    return kappa / 2 + 1j * s * chi


def drive_for_nbar(kappa, chi, nbar):
    """Drive amplitude eps that gives nbar photons in steady state (same for both states)."""
    return np.sqrt(nbar * (kappa**2 / 4 + chi**2))


def alpha_ss(kappa, chi, nbar, state):
    """Steady-state intracavity field: d(alpha)/dt = -lam*alpha + eps."""
    return drive_for_nbar(kappa, chi, nbar) / lam(kappa, chi, state)


def integrated_field(kappa, chi, nbar, state, t):
    """Integral of the output field beta(t)=sqrt(kappa)*alpha(t) from 0 to t, with ring-up.
    alpha(t) = alpha_ss (1 - exp(-lam t))."""
    L = lam(kappa, chi, state)
    a = alpha_ss(kappa, chi, nbar, state)
    return np.sqrt(kappa) * a * (t - (1 - np.exp(-L * t)) / L)


# ---------- 2. Amplifier chain ----------
def noise_photons_from_temp(T_K, f_GHz):
    return K_OVER_H_GHZ * T_K / f_GHz


def chain_efficiency(G1_dB, n1, n_hemt, eta_line):
    """Measurement efficiency of the chain.
    Friis: input-referred added noise n_tot = n1 + n_hemt/G1.
    A phase-preserving chain with added noise n_tot gives eta = 1/(1+2 n_tot)
    (quantum limit n_tot=1/2 -> eta=1/2). Loss before the first amp multiplies in."""
    G1 = 10 ** (G1_dB / 10)
    n_tot = n1 + n_hemt / G1
    return eta_line / (1 + 2 * n_tot), n_tot


# ---------- 3. Readout fidelity (with T1 decay during readout) ----------
def _Phi(x):
    return 0.5 * erfc(-x / np.sqrt(2))


def readout_fidelity(kappa, chi, nbar, eta, tau, T1, n_quad=400):
    """Assignment fidelity F = 1 - [P(1|0)+P(0|1)]/2 for a homodyne-style integrated signal.
    Signal: S = int 2 sqrt(eta) beta dt + noise, noise variance per quadrature = tau.
    |1> can decay at t_d ~ Exp(T1); after decay the field follows the |0> response
    (resonator transient after the jump is neglected)."""
    m0 = 2 * np.sqrt(eta) * integrated_field(kappa, chi, nbar, 0, tau)
    m1 = 2 * np.sqrt(eta) * integrated_field(kappa, chi, nbar, 1, tau)
    sigma = np.sqrt(tau)
    axis = (m1 - m0) / abs(m1 - m0)
    proj = lambda m: np.real(np.conj(axis) * m)
    p0, p1 = proj(m0), proj(m1)
    thr = 0.5 * (p0 + p1)
    P10 = 1 - _Phi((thr - p0) / sigma)          # |0> read as 1
    # |1> with decay at td: mean = (|1> integral up to td) + (|0> steady field)*(tau - td)
    td = np.linspace(0, tau, n_quad)
    m1_td = 2 * np.sqrt(eta) * (integrated_field(kappa, chi, nbar, 1, td)
                                + np.sqrt(kappa) * alpha_ss(kappa, chi, nbar, 0) * (tau - td))
    pdf = np.exp(-td / T1) / T1
    P01_decay = np.trapezoid(pdf * _Phi((thr - proj(m1_td)) / sigma), td)
    P01_nodecay = np.exp(-tau / T1) * _Phi((thr - p1) / sigma)
    P01 = P01_decay + P01_nodecay
    F = 1 - 0.5 * (P10 + P01)
    snr = abs(m1 - m0) / sigma
    return F, snr, P10, P01


# ---------- 4. Back-action: noise leaking backward through imperfect isolation ----------
def thermal_dephasing(kappa, chi, n_th):
    """Photon-shot-noise dephasing of the qubit from n_th thermal photons in the readout
    resonator (Clerk & Utami 2007; Sears et al. PRB 2012), resonator shifts +/-chi."""
    return (kappa / 2) * np.real(np.sqrt((1 + 2j * chi / kappa) ** 2 + 8j * chi * n_th / kappa) - 1)


def backaction(kappa, chi, n_src, isolation_dB, T1):
    n_th = n_src * 10 ** (-isolation_dB / 10)
    g_phi = thermal_dephasing(kappa, chi, n_th)
    T2 = 1 / (1 / (2 * T1) + g_phi)
    return n_th, g_phi, T2
