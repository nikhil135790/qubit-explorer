/**
 * Three-mode Josephson directional amplifier (coupled-mode / input-output theory).
 *
 * Modes: a (input port, faces the qubit), b (output port, faces the HEMT), c (auxiliary,
 * very strongly damped: an "engineered reservoir", Metelmann & Clerk, PRX 5, 021025 (2015)).
 *
 * Pumped interactions in the rotating frame (all modes on resonance):
 *   H = g_ab (e^{i phi} a b + h.c.)    two-mode squeezing (gain), pump phase phi
 *     + g_ac (a^dag c + h.c.)          frequency conversion (beam splitter)
 *     + g_bc (b c + h.c.)              two-mode squeezing (gain)
 * Signals can go a -> b directly, or a -> c -> b. The pump phase phi sets the phase
 * between the two paths. At phi = -pi/2 they add going forward and cancel going backward.
 *
 * Linear quantum Langevin equations in the Nambu basis v = (a, b, c, a^dag, b^dag, c^dag):
 *   dv/dt = M v + sqrt(K) v_in,  v_out = v_in + sqrt(K) v   (sign convention as in verification/)
 * so S(w) = I + sqrt(K) (M + i w I)^{-1} sqrt(K).
 * Units: rates and frequencies in units of the port linewidth kappa.
 */
import { c, add, mul, scale, expi, abs2, zeros, solve } from './complex'
import type { C } from './complex'
import stab from './stability.json'

export const KAPPA_MHZ = 50 // kappa/2pi of ports a and b, for converting plot axes to MHz
export const G0 = { ab: 0.45661, ac: 7.37111, bc: 6.61056 } // design point: 20 dB, -41 dB reverse
export const KC = 213.81494 // auxiliary mode damping (in units of kappa)

export type AmpParams = { phi: number; s: number } // pump phase, gain-pump strength (1 = design)

function buildM(p: AmpParams): C[][] {
  const M = zeros(6, 6)
  const k = [1, 1, KC]
  for (let i = 0; i < 3; i++) {
    M[i][i] = c(-k[i] / 2)
    M[i + 3][i + 3] = c(-k[i] / 2)
  }
  const I = c(0, 1)
  const sq = (i: number, j: number, g: number, ph: number) => {
    const e = expi(-ph)
    const t = scale(mul(I, e), -g) // -i g e^{-i ph}
    const tc = c(t.re, -t.im) //       +i g e^{+i ph}  (= conj(t))
    M[i][j + 3] = add(M[i][j + 3], t)
    M[j][i + 3] = add(M[j][i + 3], t)
    M[i + 3][j] = add(M[i + 3][j], tc)
    M[j + 3][i] = add(M[j + 3][i], tc)
  }
  const bs = (i: number, j: number, g: number) => {
    M[i][j] = add(M[i][j], c(0, -g))
    M[j][i] = add(M[j][i], c(0, -g))
    M[i + 3][j + 3] = add(M[i + 3][j + 3], c(0, g))
    M[j + 3][i + 3] = add(M[j + 3][i + 3], c(0, g))
  }
  sq(0, 1, G0.ab * p.s, p.phi)
  bs(0, 2, G0.ac)
  sq(1, 2, G0.bc * p.s, 0)
  return M
}

export function sMatrix(p: AmpParams, w = 0): C[][] {
  const M = buildM(p)
  const k = [1, 1, KC, 1, 1, KC].map(Math.sqrt)
  const A = M.map((row, i) => row.map((x, j) => (i === j ? add(x, c(0, w)) : x)))
  const B = zeros(6, 6)
  for (let i = 0; i < 6; i++) B[i][i] = c(k[i])
  const X = solve(A, B) // A^{-1} sqrt(K)
  return X.map((row, i) => row.map((x, j) => add(scale(x, k[i]), c(i === j ? 1 : 0))))
}

/** Is the amplifier stable (all eigenvalues of M in the left half plane)? Precomputed map. */
export function isStable(p: AmpParams): boolean {
  const data = stab as { phis: number[]; s: number[]; rows: string[] }
  let ph = ((p.phi + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
  const pi = Math.round(((ph + Math.PI) / (2 * Math.PI)) * (data.phis[2] - 1))
  const si = Math.round((p.s / data.s[1]) * (data.s[2] - 1))
  if (si >= data.rows.length) return false
  return data.rows[Math.max(0, si)][pi] === '1'
}

export type AmpSummary = {
  stable: boolean
  fwdDb: number // power gain a -> b (dB)
  revDb: number // power transmission b -> a (dB). Negative = isolation.
  reflA: number // power reflected back out of port a (toward the qubit)
  nAdd: number // added noise referred to input, photons (quantum limit 0.5)
  /** photons sent back out of port a toward the qubit when port b sees nIn photons of noise */
  backPhotons: (nIn: number) => number
}

export function summarize(p: AmpParams, w = 0): AmpSummary {
  const S = sMatrix(p, w)
  const P = S.map((r) => r.map(abs2))
  const fwd = P[1][0] + P[1][3]
  const rev = P[0][1] + P[0][4]
  const nAdd = (0.5 * P[1].reduce((x, y) => x + y, 0)) / fwd - 0.5
  return {
    stable: isStable(p),
    fwdDb: 10 * Math.log10(fwd),
    revDb: 10 * Math.log10(rev + 1e-15),
    reflA: P[0][0] + P[0][3],
    nAdd,
    // <a_out^dag a_out> = sum_j |S_aj|^2 n_j + |S_a,j+3|^2 (n_j + 1); only port b is noisy
    backPhotons: (nIn: number) =>
      P[0][1] * nIn + P[0][4] * (nIn + 1) + P[0][3] + P[0][5] /* amplified vacuum from a, c */,
  }
}
