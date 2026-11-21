import { useMemo } from 'react'
import { useStore } from '../store'
import { summarize } from './dirAmp'
import { TWO_PI, chainEfficiency, bestFidelity, T2 } from './readout'

// Readout settings shared by every level (same values as the validated Python model)
export const READOUT = { kappa: TWO_PI * 4, chi: TWO_PI * 2, nbar: 4, T1: 50, nHemt: 11.9 }
const ETA_LINE_DIRAMP = 0.85 // no circulators between qubit and amp
const ETA_LINE_CIRC = 0.6 // JPA + 3 circulators baseline

export function useChain() {
  const phi = useStore((s) => s.phi)
  const sp = useStore((s) => s.s)
  const iso = useStore((s) => s.outputIsolator)
  const nsrc = useStore((s) => s.nsrc)
  return useMemo(() => {
    const amp = summarize({ phi, s: sp })
    const nIn = nsrc * (iso ? 0.01 : 1) // an extra isolator on the output side gives another 20 dB
    const nBack = amp.backPhotons(nIn)
    const { eta, nTot } = chainEfficiency(amp.nAdd, amp.fwdDb, READOUT.nHemt, ETA_LINE_DIRAMP)
    const ok = amp.stable && amp.fwdDb > 0
    const best = ok ? bestFidelity({ ...READOUT, eta }) : { F: 0.5, tau: 0 }
    const t2 = T2(READOUT.kappa, READOUT.chi, nBack, READOUT.T1)
    const isoDb = -amp.revDb + (iso ? 20 : 0)
    // baseline: JPA (0.6 photons, 20 dB) behind three circulators (60 dB isolation)
    const base = chainEfficiency(0.6, 20, READOUT.nHemt, ETA_LINE_CIRC)
    const baseBest = bestFidelity({ ...READOUT, eta: base.eta })
    const baseT2 = T2(READOUT.kappa, READOUT.chi, nsrc * 1e-6, READOUT.T1)
    return { amp, nBack, eta, nTot, best, t2, isoDb, ok, base: { eta: base.eta, best: baseBest, t2: baseT2 } }
  }, [phi, sp, iso, nsrc])
}
