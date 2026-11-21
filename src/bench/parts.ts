import { summarize } from '../physics/dirAmp'
import { TWO_PI, bestFidelity, T2 } from '../physics/readout'

export type PartId = 'dir' | 'jpa' | 'twpa' | 'circ' | 'iso'

export type Part = {
  id: PartId
  name: string
  line: string // one-line description
  gainDb: number // forward power gain
  nAdd: number // added noise, photons referred to its input
  lossDb: number // insertion loss before the gain (forward)
  revDb: number // backward transmission, toward the qubit (negative = blocks)
  color: string
}

const dir = summarize({ phi: -Math.PI / 2, s: 1 }) // our three-mode design: 20 dB / -40.9 dB / 0.505

export const PARTS: Record<PartId, Part> = {
  dir: { id: 'dir', name: 'Directional amp', line: 'Gain forward, blocks backward. No magnets.', gainDb: dir.fwdDb, nAdd: dir.nAdd, lossDb: 0.1, revDb: dir.revDb, color: '#d9884a' },
  jpa: { id: 'jpa', name: 'JPA', line: 'Quantum-limited, but it reflects its output. Needs a circulator in front.', gainDb: 20, nAdd: 0.55, lossDb: 0, revDb: 20, color: '#e3c15a' },
  twpa: { id: 'twpa', name: 'TWPA', line: 'Wide bandwidth, high gain. Lets backward noise straight through.', gainDb: 20, nAdd: 0.9, lossDb: 0.5, revDb: 0, color: '#8fb35a' },
  circ: { id: 'circ', name: 'Circulator', line: 'Ferrite one-way valve. ~20 dB isolation, a little loss.', gainDb: 0, nAdd: 0, lossDb: 0.4, revDb: -20, color: '#8a97a8' },
  iso: { id: 'iso', name: 'Isolator', line: 'Same idea as a circulator, with the third port terminated.', gainDb: 0, nAdd: 0, lossDb: 0.4, revDb: -20, color: '#6f7d8f' },
}

export const HEMT = { gainDb: 40, nAdd: 11.9, backNoise: 10 } // 4 K amplifier; it also radiates ~10 photons back down the line
export const QUBIT = { kappa: TWO_PI * 4, chi: TWO_PI * 2, nbar: 1.5, T1: 50 }
export const MAX_SLOTS = 4

const lin = (db: number) => Math.pow(10, db / 10)

export type ChainResult = {
  eta: number
  nTot: number
  fidelity: number
  tau: number
  nBack: number
  t2: number
  warnings: string[]
  stages: { gainDb: number; noise: number }[] // cumulative after each placed part, then after HEMT
}

/**
 * Cascade the chain from the qubit outward.
 * Forward: losses before the first real gain stage reduce efficiency directly; noise is Friis-referred
 *   to the input, eta = eta_loss / (1 + 2 n_tot) (phase-preserving chain).
 * Backward: start with the HEMT's ~10 photons and walk back toward the qubit through each part's
 *   reverse transmission. A JPA with no circulator directly in front of it reflects with full gain.
 * The photons that reach the readout resonator dephase the qubit (same formula as the validated model).
 */
export function evaluate(chain: PartId[]): ChainResult {
  const warnings: string[] = []
  let gCum = 1, etaLoss = 1, nTot = 0
  let gained = false
  const stages: { gainDb: number; noise: number }[] = []
  chain.forEach((id, i) => {
    const p = PARTS[id]
    const t = lin(-p.lossDb)
    if (!gained) etaLoss *= t
    gCum *= t
    if (p.gainDb > 0) {
      nTot += p.nAdd / gCum
      gCum *= lin(p.gainDb)
      if (p.gainDb >= 10) gained = true
    }
    if (id === 'jpa' && chain[i - 1] !== 'circ') warnings.push('The JPA has no circulator in front of it, so it reflects its amplified output straight back at the qubit.')
    stages.push({ gainDb: 10 * Math.log10(gCum), noise: nTot })
  })
  nTot += HEMT.nAdd / gCum
  gCum *= lin(HEMT.gainDb)
  stages.push({ gainDb: 10 * Math.log10(gCum), noise: nTot })

  // backward walk from the HEMT to the qubit
  let n = HEMT.backNoise
  for (let i = chain.length - 1; i >= 0; i--) {
    const id = chain[i]
    let rev = PARTS[id].revDb
    if (id === 'jpa' && chain[i - 1] === 'circ') rev = 0 // the circulator routes the reflected output forward
    const r = lin(rev)
    n = r * n + Math.max(0, r - 1) * 0.5 // gain going backward also amplifies vacuum noise
  }
  if (chain.length === 0) warnings.push('Nothing between the qubit and the HEMT: the signal is buried in its noise, and its noise pours straight into the qubit.')
  if (n > 0.01 && !warnings.length) warnings.push('Noise leaking back down the line is dephasing the qubit. Try adding isolation after your amplifier.')

  // photons flooding back into the readout resonator also leak out with the signal, adding noise at the input
  const etaEff = etaLoss / (1 + 2 * (nTot + n))
  const best = bestFidelity({ ...QUBIT, eta: etaEff })
  const t2 = T2(QUBIT.kappa, QUBIT.chi, n, QUBIT.T1)
  return { eta: etaEff, nTot, fidelity: best.F, tau: best.tau, nBack: n, t2, warnings, stages }
}
