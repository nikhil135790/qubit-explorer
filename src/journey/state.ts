import { create } from 'zustand'

export type Qubit = 0 | 1

type JourneyState = {
  stage: number
  qubit: Qubit
  firedAt: number // performance.now() / 1000 when the last pulse was sent
  set: (p: Partial<JourneyState>) => void
  fire: () => void
}

export const useJourney = create<JourneyState>((set) => ({
  stage: 0,
  qubit: 1,
  firedAt: -100,
  set: (p) => set(p),
  fire: () => set({ firedAt: performance.now() / 1000 }),
}))

// Dispersive readout with 2*chi = kappa: probing halfway between the two resonator frequencies,
// the transmitted field for each qubit state is S21 = (2i D/k)/(1 + 2i D/k) with D = -/+ chi.
// That gives |S21| = 1/sqrt(2) and a phase of -45 deg (|0>) or +45 deg (|1>): 90 deg apart.
export const READOUT_PHASE = { 0: -Math.PI / 4, 1: Math.PI / 4 } as const
export const READOUT_AMP = Math.SQRT1_2
