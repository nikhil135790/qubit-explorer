import { create } from 'zustand'
import type { PartId } from './parts'
import { MAX_SLOTS } from './parts'

export type Shot = { x: number; y: number; prepared: 0 | 1; read: 0 | 1 }

type BenchState = {
  chain: PartId[]
  qubit: 0 | 1
  firedAt: number
  shots: Shot[]
  last: Shot | null
  add: (p: PartId) => void
  removeAt: (i: number) => void
  setChain: (c: PartId[]) => void
  set: (p: Partial<BenchState>) => void
}

export const useBench = create<BenchState>((set, get) => ({
  chain: [],
  qubit: 1,
  firedAt: -100,
  shots: [],
  last: null,
  add: (p) => { const c = get().chain; if (c.length < MAX_SLOTS) set({ chain: [...c, p], shots: [], last: null }) },
  removeAt: (i) => set({ chain: get().chain.filter((_, k) => k !== i), shots: [], last: null }),
  setChain: (c) => set({ chain: c, shots: [], last: null }),
  set: (p) => set(p),
}))

// layout along the cable (scene units)
export const X_QUBIT = -13
export const SLOT_X = [-8.5, -5, -1.5, 2]
export const X_HEMT = 6.5
export const X_SCREEN = 12.5
export const PULSE_SPEED = 10 // units per second
