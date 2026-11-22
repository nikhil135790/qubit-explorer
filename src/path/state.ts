import { create } from 'zustand'
import { rig } from './rig'

/**
 * The journey is a list of stations, each split into beats (steps). A beat moves the station's
 * progress u from where it is to the beat's end value over `dur` seconds, then waits for Next.
 * `time` is the shared animation clock: it only advances when not paused, so Pause freezes everything.
 */
export type Beat = { u: number; dur: number; caption: string; title?: string; auto?: boolean } // auto: roll straight into the next step

export const STATIONS: { id: string; name: string; beats: Beat[]; u0?: number }[] = [
  {
    id: 'down', name: 'The trip down', beats: [
      { u: 0.05, dur: 5, title: 'The dilution fridge', caption: 'This is a dilution refrigerator with its outer shields removed, and its bottom plate sits at 10 millikelvin, nearly 300 times colder than deep space.' },
      { u: 0.2, dur: 7, title: 'Where the pulse is made', caption: 'Every measurement starts at a rack beside the fridge, where a microwave generator makes the readout pulse and a splitter keeps half of it here as a reference.' },
      { u: 0.4, dur: 9, title: 'The trip down', caption: 'The other half travels along a cable to the top of the fridge and in through a sealed connector.' },
      { u: 0.8, dur: 13, caption: 'On the way down it passes an attenuator at every plate, which soaks up most of the pulse along with the warm noise riding on it, so only a faint, clean pulse reaches the bottom.' },
      { u: 1, dur: 7, title: 'The coldest plate', caption: 'The bottom plate holds several experiments side by side, and our pulse arrives at one of them, a qubit chip box wired to a directional amplifier and an isolator.' },
    ],
  },
  {
    id: 'qubit', name: 'The qubit', u0: 0.2, beats: [
      { u: 0.248, dur: 7, title: 'The qubit', caption: 'This transmon qubit is two tantalum pads on silicon, joined by a Josephson junction.' },
      { u: 0.312, dur: 7, caption: 'Up close, the junction is two crossed aluminum wires with a thin oxide layer between them that Cooper pairs tunnel through.' },
      { u: 0.44, dur: 7, caption: 'The chip holds four qubits, each with its own zigzag readout resonator, and since each resonator rings at a slightly different frequency, one pulse carrying four tones can read all four at once.' },
      { u: 0.5, dur: 5, caption: 'Two small capacitors fence off the feedline into a Purcell filter, which passes the readout tones but blocks the qubits’ own frequency so they can’t leak their energy out this way.' },
      { u: 0.6, dur: 5.5, caption: 'We measure the qubit by sending a microwave pulse down the feedline, drawn here as a spiral showing its electric field.' },
      { u: 0.728, dur: 6, caption: 'Passing the resonator shifts the phase of the pulse by $+45^\\circ$ if the qubit is 1 and $-45^\\circ$ if it is 0, so measuring that phase shift reads out the qubit.' },
      { u: 1, dur: 9, auto: true, caption: 'The pulse leaves the chip over thin aluminum wire bonds, runs along the circuit board, and exits through the connector on the side of the box.' },
    ],
  },
  {
    id: 'amp', name: 'Directional amplifier', beats: [
      { u: 0.1, dur: 7, caption: 'A coax cable carries the pulse a few centimeters across the fridge’s coldest plate to the amplifier.' },
      { u: 0.172, dur: 4, caption: 'The directional amplifier is a 5 mm chip in a copper box, powered by the purple microwave signal.' },
      { u: 0.37, dur: 6, caption: 'The pulse enters through mode $a$, the side of the amplifier facing the qubit.' },
      { u: 0.478, dur: 5, caption: 'At the Josephson ring the pump feeds energy into the pulse, which then reaches mode $b$ by two routes at once, straight across and by a detour through $c$.' },
      { u: 0.622, dur: 5, caption: 'The two copies meet at $b$ in step, crest on crest, so they add up and the pulse leaves with about 100 times more power.' },
      { u: 0.73, dur: 5, caption: 'Now follow the faint noise that leaks back down from the HEMT, a transistor amplifier at 4 K, past the isolator we will meet next.' },
      { u: 0.874, dur: 6, caption: 'Going backward, the two copies of the noise meet out of step and cancel at $a$, so the noise drains into the resistor on $c$ instead of reaching the qubit.' },
    ],
  },
  {
    id: 'iso', name: 'Isolator', beats: [
      { u: 0.15, dur: 8, caption: 'The amplified pulse leaves the amplifier and takes a short coax cable to the isolator, a small block that lets microwaves pass in only one direction.' },
      { u: 0.3, dur: 6, caption: 'Inside, a disk of ferrite, a magnetic ceramic, sits under a strong magnet that we have lifted off so you can see in.' },
      { u: 0.6, dur: 7, caption: 'Our pulse enters at port 1, and the magnetized ferrite steers it around to port 2, losing almost nothing on the way.' },
      { u: 0.85, dur: 6, caption: 'The same HEMT noise arrives at port 2, since that port faces the HEMT, and gets steered on to port 3, where a resistor absorbs it.' },
      { u: 1, dur: 6, caption: 'Now amplified and shielded from backward noise, the pulse climbs the fridge toward the HEMT amplifier on the 4 K plate.' },
    ],
  },
  {
    id: 'hemt', name: 'HEMT at 4 K', beats: [
      { u: 0.2, dur: 8, title: 'Up to 4 K', caption: 'The pulse climbs past the cold plate and the still plate on a superconducting cable, which wastes almost none of it, up to the 4 K plate.' },
      { u: 0.35, dur: 6, title: 'The HEMT', caption: 'Here sits the HEMT, short for high electron mobility transistor, an amplifier that works best when cooled to 4 K.' },
      { u: 0.6, dur: 8, caption: 'Inside, three transistors in a row boost the pulse about 10,000 times in power, so nothing further up can add noise that matters.' },
      { u: 0.8, dur: 6, caption: 'The catch is that the transistors add noise worth about a dozen photons, and the part heading back down is the backward noise we blocked earlier.' },
      { u: 1, dur: 7, title: 'To room temperature', caption: 'Now strong enough to survive the trip, the pulse heads up to room temperature, where the electronics measure its phase.' },
    ],
  },
  {
    id: 'screen', name: 'The screen', beats: [
      { u: 0.25, dur: 9, title: 'Out of the fridge', caption: 'At the top, the pulse leaves the fridge through a sealed connector and runs along an ordinary cable to a rack of room-temperature electronics.' },
      { u: 0.4, dur: 6, title: 'Measuring the phase', caption: 'There, a mixer combines the pulse with the reference kept at the start, shifting it down to a frequency slow enough for a digitizer to record.' },
      { u: 0.5, dur: 6, caption: 'An FPGA, a chip whose circuits can be rewired for one job, pulls the phase out of that recording as two numbers, $I$ and $Q$, and decides 0 or 1 in well under a microsecond.' },
      { u: 0.6, dur: 6, title: 'The screen', caption: 'Each pulse becomes one dot on the scientist’s screen, and the side of the dividing line it lands on tells us whether the qubit was 0 or 1.' },
      { u: 1, dur: 12, caption: 'Repeating this thousands of times builds two clouds, and with the directional amplifier in the chain they separate so cleanly that about 99.7% of readings come out right.' },
    ],
  },
]

export const BUILT = 6 // stations finished so far

/** Station indices by name, so code never depends on the order. */
export const ST = { down: 0, qubit: 1, amp: 2, iso: 3, hemt: 4, screen: 5 } as const

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
  withAmp: boolean // the final screen can show the readout without the directional amplifier
  set: (p: Partial<PathState>) => void
  next: () => void
  back: () => void
  replay: () => void
  goStation: (i: number) => void
}

const beatStart = (s: number, b: number) => (b === 0 ? STATIONS[s].u0 ?? 0 : STATIONS[s].beats[b - 1].u)

export const usePath = create<PathState>((set, get) => ({
  station: 0,
  beat: 0,
  u: 0,
  from: 0,
  paused: false,
  orbiting: false,
  time: 0,
  qubit: 1,
  withAmp: true,
  set: (p) => set(p),
  next: () => {
    const { station, beat, orbiting } = get()
    if (orbiting) rig.catchup = 1.2
    if (beat < STATIONS[station].beats.length - 1) set({ beat: beat + 1, from: get().u, paused: false, orbiting: false })
    else if (station < BUILT - 1) { rig.catchup = 1.2; { const u0 = STATIONS[station + 1].u0 ?? 0; set({ station: station + 1, beat: 0, u: u0, from: u0, paused: false, orbiting: false }) } }
  },
  back: () => {
    rig.catchup = 1.2
    const { station, beat } = get()
    if (beat > 0) { const u = beatStart(station, beat - 1); set({ beat: beat - 1, u, from: u, paused: false, orbiting: false }) }
    else if (station > 0) { const s = station - 1, b = STATIONS[s].beats.length - 1, u = beatStart(s, b); set({ station: s, beat: b, u, from: u, paused: false, orbiting: false }) }
  },
  replay: () => { rig.catchup = 1.2; const { station, beat } = get(); const u = beatStart(station, beat); set({ u, from: u, paused: false, orbiting: false }) },
  goStation: (i) => { rig.catchup = 1.2; const u0 = STATIONS[i].u0 ?? 0; set({ station: i, beat: 0, u: u0, from: u0, paused: false, orbiting: false }) },
}))

/** Is the current beat still playing? */
export const beatRunning = () => { const s = usePath.getState(); return s.u < STATIONS[s.station].beats[s.beat].u - 1e-4 }

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
export const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t) }
export const seg = (u: number, a: number, b: number) => smooth((u - a) / (b - a))

/** True once the current beat has finished moving, so labels only appear on a still frame. */
export const useSettled = () => usePath((s) => s.u >= STATIONS[s.station].beats[s.beat].u - 1e-4)
