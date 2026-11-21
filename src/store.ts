import { create } from 'zustand'
import type { LevelId } from './levels'

type Phase = 'idle' | 'out' | 'in'

type State = {
  level: LevelId
  history: LevelId[]
  phase: Phase
  pending: LevelId | null
  zoomPoint: [number, number, number] | null // where the camera dives during 'out'
  // directional amplifier controls
  phi: number
  s: number
  outputIsolator: boolean
  // readout chain controls
  nsrc: number
  // scale bar
  scaleLabel: string
  scalePx: number
  goTo: (to: LevelId, via?: [number, number, number]) => void
  back: () => void
  finishOut: () => void
  finishIn: () => void
  set: (p: Partial<State>) => void
}

export const useStore = create<State>((set, get) => ({
  level: 'fridge',
  history: [],
  phase: 'idle',
  pending: null,
  zoomPoint: null,
  phi: -Math.PI / 2,
  s: 1,
  outputIsolator: false,
  nsrc: 10,
  scaleLabel: '',
  scalePx: 100,
  goTo: (to, via) => {
    const st = get()
    if (st.phase !== 'idle' || to === st.level) return
    set({ phase: 'out', pending: to, zoomPoint: via ?? null, history: [...st.history, st.level] })
  },
  back: () => {
    const st = get()
    if (st.phase !== 'idle' || st.history.length === 0) return
    const prev = st.history[st.history.length - 1]
    set({ phase: 'out', pending: prev, zoomPoint: null, history: st.history.slice(0, -1) })
  },
  finishOut: () => {
    const st = get()
    if (st.pending) set({ level: st.pending, pending: null, phase: 'in' })
  },
  finishIn: () => set({ phase: 'idle', zoomPoint: null }),
  set: (p) => set(p),
}))
