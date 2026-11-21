import { create } from 'zustand'
import { rig } from './rig'

/**
 * The journey is a list of stations, each split into beats (steps). A beat moves the station's
 * progress u from where it is to the beat's end value over `dur` seconds, then waits for Next.
 * `time` is the shared animation clock: it only advances when not paused, so Pause freezes everything.
 */
export type Beat = { u: number; dur: number; caption: string }

export const STATIONS: { id: string; name: string; beats: Beat[] }[] = [
  {
    id: 'qubit', name: 'The qubit', beats: [
      { u: 0.04, dur: 5, caption: 'This is a dilution refrigerator with its outer shields removed, and its bottom plate sits at 10 millikelvin, nearly 300 times colder than deep space.' },
      { u: 0.2, dur: 7, caption: 'On the bottom plate sit two copper boxes, one holding our qubit chip and one holding the directional amplifier, joined by a short coax cable.' },
      { u: 0.248, dur: 7, caption: 'This transmon qubit is two tantalum pads on silicon, joined by a Josephson junction.' },
      { u: 0.312, dur: 7, caption: 'Up close, the junction is two crossed aluminum wires with a thin oxide layer between them that Cooper pairs tunnel through.' },
      { u: 0.44, dur: 7, caption: 'The whole chip holds four qubits, each with its own zigzag readout resonator on a shared feedline.' },
      { u: 0.6, dur: 5.5, caption: 'We measure the qubit by sending a microwave pulse down the feedline, drawn here as a spiral showing its electric field.' },
      { u: 0.728, dur: 6, caption: 'Passing the resonator twists the pulse by $\\pm 45^\\circ$ depending on the qubit’s state, and the blue spiral shows the other case.' },
      { u: 0.88, dur: 5, caption: 'The pulse leaves the chip through thin aluminum wire bonds and travels onto the circuit board.' },
      { u: 1, dur: 4, caption: 'It then passes through the connector on the side of the box, toward the directional amplifier.' },
    ],
  },
  {
    id: 'amp', name: 'Directional amplifier', beats: [
      { u: 0.1, dur: 7, caption: 'A coax cable carries the pulse a few centimeters across the fridge’s coldest plate to the amplifier.' },
      { u: 0.172, dur: 4, caption: 'The directional amplifier is a 5 mm chip in a copper box, powered by the purple microwave signal.' },
      { u: 0.37, dur: 6, caption: 'The pulse enters through mode $a$, the side of the amplifier facing the qubit.' },
      { u: 0.478, dur: 5, caption: 'At the Josephson ring the pulse splits, going straight to $b$ and also taking a detour through $c$.' },
      { u: 0.622, dur: 5, caption: 'The two routes add together, so the pulse leaves $b$ with about 100 times more power.' },
      { u: 0.73, dur: 5, caption: 'Noise from the HEMT, a transistor amplifier higher up in the fridge at 4 K, now travels back toward the qubit.' },
      { u: 0.874, dur: 6, caption: 'Going backward, the two routes cancel, and the leftover noise drains into the resistor on $c$.' },
      { u: 1, dur: 4, caption: 'The amplified pulse leaves through the output connector and heads to the isolator.' },
    ],
  },
  { id: 'iso', name: 'Isolator', beats: [{ u: 1, dur: 4, caption: '' }] },
  { id: 'hemt', name: 'HEMT at 4 K', beats: [{ u: 1, dur: 4, caption: '' }] },
  { id: 'screen', name: 'The screen', beats: [{ u: 1, dur: 4, caption: '' }] },
]

export const BUILT = 2 // stations finished so far

/** Station 1 opens on the fridge and the plate; from u = INTRO on, v runs 0..1 over the chip part. */
export const INTRO = 0.2
export const chipV = (u: number) => (u - INTRO) / (1 - INTRO)

/** In station 2, u from 0 to 0.1 is the cable ride; the amplifier itself runs from 0.1 to 1. */
export const AMP_START = 0.1
export const ampU = (u: number) => Math.max(0, (u - AMP_START) / (1 - AMP_START))

type PathState = {
  station: number
  beat: number
  u: number // progress through the current station, 0..1
  from: number // u at the start of the current beat
  paused: boolean
  orbiting: boolean // the viewer has taken over the camera
  time: number // shared animation clock (s), frozen while paused
  qubit: 0 | 1
  set: (p: Partial<PathState>) => void
  next: () => void
  back: () => void
  replay: () => void
  goStation: (i: number) => void
}

const beatStart = (s: number, b: number) => (b === 0 ? 0 : STATIONS[s].beats[b - 1].u)

export const usePath = create<PathState>((set, get) => ({
  station: 0,
  beat: 0,
  u: 0,
  from: 0,
  paused: false,
  orbiting: false,
  time: 0,
  qubit: 1,
  set: (p) => set(p),
  next: () => {
    const { station, beat, orbiting } = get()
    if (orbiting) rig.catchup = 1.2
    if (beat < STATIONS[station].beats.length - 1) set({ beat: beat + 1, from: get().u, paused: false, orbiting: false })
    else if (station < BUILT - 1) { rig.catchup = 1.2; set({ station: station + 1, beat: 0, u: 0, from: 0, paused: false, orbiting: false }) }
  },
  back: () => {
    rig.catchup = 1.2
    const { station, beat } = get()
    if (beat > 0) { const u = beatStart(station, beat - 1); set({ beat: beat - 1, u, from: u, paused: false, orbiting: false }) }
    else if (station > 0) { const s = station - 1, b = STATIONS[s].beats.length - 1, u = beatStart(s, b); set({ station: s, beat: b, u, from: u, paused: false, orbiting: false }) }
  },
  replay: () => { rig.catchup = 1.2; const { station, beat } = get(); const u = beatStart(station, beat); set({ u, from: u, paused: false, orbiting: false }) },
  goStation: (i) => { rig.catchup = 1.2; set({ station: i, beat: 0, u: 0, from: 0, paused: false, orbiting: false }) },
}))

/** Is the current beat still playing? */
export const beatRunning = () => { const s = usePath.getState(); return s.u < STATIONS[s.station].beats[s.beat].u - 1e-4 }

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t) }
export const seg = (u: number, a: number, b: number) => smooth((u - a) / (b - a))

/** True once the current beat has finished moving, so labels only appear on a still frame. */
export const useSettled = () => usePath((s) => s.u >= STATIONS[s.station].beats[s.beat].u - 1e-4)
