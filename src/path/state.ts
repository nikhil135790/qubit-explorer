import { create } from 'zustand'

/**
 * The journey is a list of stations, each split into beats (steps). A beat moves the station's
 * progress u from where it is to the beat's end value over `dur` seconds, then waits for Next.
 * `time` is the shared animation clock: it only advances when not paused, so Pause freezes everything.
 */
export type Beat = { u: number; dur: number; caption: string }

export const STATIONS: { id: string; name: string; beats: Beat[] }[] = [
  {
    id: 'qubit', name: 'The qubit', beats: [
      { u: 0.06, dur: 4, caption: 'This is a transmon qubit: two tantalum capacitor pads on silicon. The hair-thin bridge between them is the Josephson junction.' },
      { u: 0.14, dur: 7, caption: 'This is the Josephson junction, where two aluminum wires cross with a layer of oxide only a couple of nanometers thick between them. Pairs of electrons, called Cooper pairs, tunnel through that layer without any resistance, and that is what turns this circuit into a qubit. (The glowing pairs are a cartoon, since real Cooper pairs are spread out rather than little balls.)' },
      { u: 0.3, dur: 7, caption: 'Zooming out: four qubits share this chip. Each one has its own readout resonator (the zigzags), and all four hang off one shared feedline.' },
      { u: 0.5, dur: 5.5, caption: 'To measure the qubit, we send a short microwave pulse down the feedline. The spiral is its electric field: the radius is the amplitude, the rotation is the phase.' },
      { u: 0.66, dur: 6, caption: 'As it passes the readout resonator, the pulse picks up a twist of $\\pm 45^\\circ$ that depends on the qubit’s state. The faint blue spiral shows what the other state would have done.' },
      { u: 0.85, dur: 5, caption: 'The pulse leaves the chip through thin aluminum wire bonds and continues onto the circuit board that holds it.' },
      { u: 1, dur: 4, caption: 'Into the connector. Next stop: the directional amplifier.' },
    ],
  },
  {
    id: 'amp', name: 'Directional amplifier', beats: [
      { u: 0.1, dur: 7, caption: 'A coax cable carries the pulse a few centimeters across the coldest plate of the fridge to the directional amplifier.' },
      { u: 0.172, dur: 4, caption: 'The directional amplifier is a 5 mm chip in its own copper box, and the purple wave is the pump tone that powers it.' },
      { u: 0.37, dur: 6, caption: 'The pulse enters mode $a$, the side of the amplifier that faces the qubit.' },
      { u: 0.478, dur: 5, caption: 'At the Josephson ring it splits: one part goes straight to $b$, the other takes a detour through $c$.' },
      { u: 0.622, dur: 5, caption: 'The two routes arrive in step and add up. The pulse leaves $b$ with about 100 times the power (drawn smaller so it fits).' },
      { u: 0.73, dur: 5, caption: 'Now noise from the 4 K amplifier arrives at $b$, heading back toward the qubit.' },
      { u: 0.874, dur: 6, caption: 'Going backward, the two routes arrive out of step and cancel. What’s left drains into $c$’s on-chip resistor.' },
      { u: 1, dur: 4, caption: 'Out through the output connector, toward the isolator.' },
    ],
  },
  { id: 'iso', name: 'Isolator', beats: [{ u: 1, dur: 4, caption: '' }] },
  { id: 'hemt', name: 'HEMT at 4 K', beats: [{ u: 1, dur: 4, caption: '' }] },
  { id: 'screen', name: 'The screen', beats: [{ u: 1, dur: 4, caption: '' }] },
]

export const BUILT = 2 // stations finished so far

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
    const { station, beat } = get()
    if (beat < STATIONS[station].beats.length - 1) set({ beat: beat + 1, from: get().u, paused: false, orbiting: false })
    else if (station < BUILT - 1) set({ station: station + 1, beat: 0, u: 0, from: 0, paused: false, orbiting: false })
  },
  back: () => {
    const { station, beat } = get()
    if (beat > 0) { const u = beatStart(station, beat - 1); set({ beat: beat - 1, u, from: u, paused: false, orbiting: false }) }
    else if (station > 0) { const s = station - 1, b = STATIONS[s].beats.length - 1, u = beatStart(s, b); set({ station: s, beat: b, u, from: u, paused: false, orbiting: false }) }
  },
  replay: () => { const { station, beat } = get(); const u = beatStart(station, beat); set({ u, from: u, paused: false, orbiting: false }) },
  goStation: (i) => set({ station: i, beat: 0, u: 0, from: 0, paused: false, orbiting: false }),
}))

/** Is the current beat still playing? */
export const beatRunning = () => { const s = usePath.getState(); return s.u < STATIONS[s.station].beats[s.beat].u - 1e-4 }

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t) }
export const seg = (u: number, a: number, b: number) => smooth((u - a) / (b - a))
