import { COPY } from './copy'

export type LevelId = 'fridge' | 'mxc' | 'amp' | 'chip' | 'transmon' | 'junction'

export type Child = { to: LevelId; label: string; pos: [number, number, number] }

export type Level = {
  id: LevelId
  name: string
  short: string
  size: string
  metersPerUnit: number
  temp: string
  camera: [number, number, number]
  target: [number, number, number]
  minDist: number
  maxDist: number
  children: Child[]
  intro: string
  body: string[]
  facts: [string, string][]
  note?: string
}

// Text supports inline math between $...$ (rendered with KaTeX).
export const LEVELS: Record<LevelId, Level> = {
  fridge: {
    id: 'fridge',
    name: 'Dilution refrigerator',
    short: 'Fridge',
    size: '~1.5 m',
    metersPerUnit: 0.1,
    temp: '300 K to 10 mK',
    camera: [13, 1, 23],
    target: [0, -0.6, 0],
    minDist: 6,
    maxDist: 60,
    children: [{ to: 'mxc', label: 'Mixing chamber plate', pos: [0, -6.9, 0] }],
    ...COPY.fridge,
    facts: [
      ['Mixing chamber', '$\\approx 10$ mK'],
      ['Input line attenuation', '$\\approx 60$ dB'],
      ['HEMT noise temperature', '2 to 4 K'],
      ['Thermal photons at 7 GHz, 10 mK', '$\\sim 10^{-15}$'],
    ],
  },
  mxc: {
    id: 'mxc',
    name: 'Mixing chamber plate',
    short: 'Mixing plate',
    size: '~10 cm',
    metersPerUnit: 0.01,
    temp: '≈ 10 mK',
    camera: [0, 15, 21],
    target: [0, 0.5, 0],
    minDist: 4,
    maxDist: 50,
    children: [
      { to: 'chip', label: 'Qubit package', pos: [-4, 2.2, 0] },
      { to: 'amp', label: 'Directional amplifier', pos: [3.5, 2.0, 0] },
    ],
    ...COPY.mxc,
    facts: [
      ['Signal power at the qubit', '$\\approx -130$ dBm'],
      ['Photons per measurement', '1 to 100'],
      ['Gain needed before digitizing', '$\\approx 100$ dB'],
      ['Loss per circulator', '0.5 to 1 dB'],
    ],
  },
  amp: {
    id: 'amp',
    name: 'Directional amplifier',
    short: 'Amplifier',
    size: '~5 mm',
    metersPerUnit: 0.0005,
    temp: '≈ 10 mK',
    camera: [0, 12.5, 10.5],
    target: [0, 0, 0],
    minDist: 4,
    maxDist: 30,
    children: [{ to: 'junction', label: 'One of its junctions', pos: [0, 0.3, 0] }],
    ...COPY.amp,
    facts: [
      ['Forward gain', '20.0 dB'],
      ['Reverse isolation', '40.9 dB'],
      ['Added noise', '0.505 photons'],
      ['Quantum limit', '0.5 photons'],
      ['Port linewidth $\\kappa/2\\pi$', '50 MHz'],
    ],
    note: 'Model: three modes, linear input-output theory. Couplings were chosen numerically to hit 20 dB of gain with a matched input port. Real devices such as Sliwa et al. (PRX, 2015) use different layouts.',
  },
  chip: {
    id: 'chip',
    name: 'Qubit chip',
    short: 'Qubit chip',
    size: '~5 mm',
    metersPerUnit: 0.0005,
    temp: '≈ 10 mK',
    camera: [0, 14, 10.5],
    target: [0, 0, 0],
    minDist: 3,
    maxDist: 30,
    children: [{ to: 'transmon', label: 'Transmon qubit', pos: [-1.1, 0.25, -2.9] }],
    ...COPY.chip,
    facts: [
      ['Readout resonator', '$\\approx 7$ GHz'],
      ['Dispersive shift $\\chi/2\\pi$', '0.5 to 3 MHz'],
      ['Resonator linewidth $\\kappa/2\\pi$', '1 to 10 MHz'],
      ['Film thickness', '100 to 200 nm'],
    ],
  },
  transmon: {
    id: 'transmon',
    name: 'Transmon qubit',
    short: 'Transmon',
    size: '~500 µm',
    metersPerUnit: 0.00005,
    temp: '≈ 10 mK',
    camera: [0, 17, 13],
    target: [0, 0, 0],
    minDist: 2,
    maxDist: 25,
    children: [{ to: 'junction', label: 'SQUID junction', pos: [0, 0.2, 0] }],
    ...COPY.transmon,
    facts: [
      ['Qubit frequency', '4 to 6 GHz'],
      ['$E_J/E_C$', '$\\approx 50$'],
      ['Anharmonicity', '$\\approx -E_C \\approx -250$ MHz'],
      ['Best $T_1$ (tantalum films)', '0.3 to 1 ms'],
    ],
  },
  junction: {
    id: 'junction',
    name: 'Josephson junction',
    short: 'Junction',
    size: '~200 nm',
    metersPerUnit: 0.00000005,
    temp: '≈ 10 mK',
    camera: [11, 9, 13],
    target: [0, 0, 0],
    minDist: 2,
    maxDist: 25,
    children: [],
    ...COPY.junction,
    facts: [
      ['Oxide thickness', '1 to 2 nm'],
      ['Critical current $I_c$', '10 to 50 nA'],
      ['Aluminum gap $\\Delta$', '$\\approx 180$ µeV'],
      ['Junction area', '0.01 to 0.1 µm²'],
    ],
    note: 'The electrodes and overlap are to scale. The oxide is drawn about 5 times thicker than real so you can see it.',
  },
}

export const ORDER: LevelId[] = ['fridge', 'mxc', 'amp', 'chip', 'transmon', 'junction']
