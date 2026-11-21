import { create } from 'zustand'

export const STATIONS = [
  { id: 'qubit', name: 'The qubit', length: 22 },
  { id: 'amp', name: 'Directional amplifier', length: 20 },
  { id: 'iso', name: 'Isolator', length: 12 },
  { id: 'hemt', name: 'HEMT at 4 K', length: 12 },
  { id: 'screen', name: 'The screen', length: 12 },
] as const

type PathState = {
  station: number
  u: number // progress through the current station, 0..1
  playing: boolean
  qubit: 0 | 1
  set: (p: Partial<PathState>) => void
  goStation: (i: number) => void
}

export const usePath = create<PathState>((set) => ({
  station: 0,
  u: 0,
  playing: true,
  qubit: 1,
  set: (p) => set(p),
  goStation: (i) => set({ station: Math.max(0, Math.min(STATIONS.length - 1, i)), u: 0, playing: true }),
}))

/** Linear interpolation helpers for keyframed values over u. */
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t) }
export const seg = (u: number, a: number, b: number) => smooth((u - a) / (b - a))
