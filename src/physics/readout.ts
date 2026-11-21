/**
 * Dispersive readout + amplifier chain + back-action dephasing.
 * Port of verification/physics.py (checked against Monte Carlo traces and QuTiP).
 * Units: time in microseconds, rates in rad/us.
 */
import { c, add, sub, mul, div, scale, abs, cexp, csqrt } from './complex'
import type { C } from './complex'

export const TWO_PI = 2 * Math.PI

function erfc(x: number): number {
  const z = Math.abs(x)
  const t = 1 / (1 + 0.5 * z)
  const r =
    t *
    Math.exp(
      -z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 +
        t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    )
  return x >= 0 ? r : 2 - r
}
const Phi = (x: number) => 0.5 * erfc(-x / Math.SQRT2)

export type ReadoutParams = {
  kappa: number // resonator linewidth, rad/us
  chi: number // dispersive shift (resonator moves by +/- chi), rad/us
  nbar: number // photons in the resonator during readout
  eta: number // measurement efficiency of the whole chain
  T1: number // qubit T1, us
}

// resonator field relaxes at kappa/2 and is detuned by -chi (|0>) or +chi (|1>) from the drive
const lam = (p: ReadoutParams, s: 0 | 1): C => c(p.kappa / 2, (s === 0 ? -1 : 1) * p.chi)
const eps = (p: ReadoutParams) => Math.sqrt(p.nbar * (p.kappa ** 2 / 4 + p.chi ** 2))
export const alphaSS = (p: ReadoutParams, s: 0 | 1): C => div(c(eps(p)), lam(p, s))

/** integral_0^t sqrt(kappa) alpha(t') dt', with ring-up alpha(t) = alpha_ss (1 - e^{-lam t}) */
export function intField(p: ReadoutParams, s: 0 | 1, t: number): C {
  const L = lam(p, s)
  const frac = div(sub(c(1), cexp(scale(L, -t))), L)
  return scale(mul(alphaSS(p, s), sub(c(t), frac)), Math.sqrt(p.kappa))
}

export function chainEfficiency(nAddFirst: number, gainFirstDb: number, nHemt: number, etaLine: number) {
  const G = Math.pow(10, gainFirstDb / 10)
  const nTot = nAddFirst + nHemt / Math.max(G, 1)
  return { eta: etaLine / (1 + 2 * nTot), nTot }
}

/** Assignment fidelity including T1 decay during the measurement. */
export function fidelity(p: ReadoutParams, tau: number, nq = 120) {
  const f = 2 * Math.sqrt(p.eta)
  const m0 = scale(intField(p, 0, tau), f)
  const m1 = scale(intField(p, 1, tau), f)
  const sig = Math.sqrt(tau)
  const d = sub(m1, m0)
  const dn = abs(d)
  const ax = scale(d, 1 / dn)
  const proj = (m: C) => m.re * ax.re + m.im * ax.im
  const p0 = proj(m0), p1 = proj(m1), thr = (p0 + p1) / 2
  const P10 = 1 - Phi((thr - p0) / sig)
  const beta0 = scale(alphaSS(p, 0), Math.sqrt(p.kappa))
  let acc = 0
  const h = tau / (nq - 1)
  for (let i = 0; i < nq; i++) {
    const td = i * h
    const m = scale(add(intField(p, 1, td), scale(beta0, tau - td)), f)
    const v = (Math.exp(-td / p.T1) / p.T1) * Phi((thr - proj(m)) / sig)
    acc += i === 0 || i === nq - 1 ? v / 2 : v
  }
  const P01 = acc * h + Math.exp(-tau / p.T1) * Phi((thr - p1) / sig)
  return { F: 1 - 0.5 * (P10 + P01), snr: dn / sig }
}

export function bestFidelity(p: ReadoutParams) {
  let best = { F: 0, tau: 0 }
  for (let i = 1; i <= 60; i++) {
    const tau = i * 0.05
    const F = fidelity(p, tau, 60).F
    if (F > best.F) best = { F, tau }
  }
  return best
}

/** Photon shot-noise dephasing from nth thermal photons (Clerk & Utami 2007; Sears et al. 2012). */
export function dephasingRate(kappa: number, chi: number, nth: number): number {
  const a = c(1, (2 * chi) / kappa)
  const z = add(mul(a, a), c(0, (8 * chi * nth) / kappa))
  return (kappa / 2) * (csqrt(z).re - 1)
}

export function T2(kappa: number, chi: number, nth: number, T1: number): number {
  return 1 / (1 / (2 * T1) + dephasingRate(kappa, chi, nth))
}
