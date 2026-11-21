export type LevelId = 'fridge' | 'mxc' | 'amp' | 'chip' | 'transmon' | 'junction'

export type Child = { to: LevelId; label: string; pos: [number, number, number] }

export type Level = {
  id: LevelId
  name: string
  short: string
  size: string // characteristic real size shown on the ladder
  metersPerUnit: number // scene units -> meters (used by the scale bar)
  temp: string
  camera: [number, number, number] // default camera position
  target: [number, number, number]
  minDist: number
  maxDist: number
  parent?: LevelId
  children: Child[]
  intro: string
  body: string[]
  facts: [string, string][]
  note?: string
}

export const LEVELS: Record<LevelId, Level> = {
  fridge: {
    id: 'fridge',
    name: 'Dilution refrigerator',
    short: 'Fridge',
    size: '~1.5 m',
    metersPerUnit: 0.1,
    temp: '300 K → 10 mK',
    camera: [13, 1, 23],
    target: [0, -0.6, 0],
    minDist: 6,
    maxDist: 60,
    children: [{ to: 'mxc', label: 'Mixing chamber plate', pos: [0, -6.9, 0] }],
    intro:
      'A superconducting quantum computer lives at the bottom of this chandelier, colder than outer space by a factor of 270.',
    body: [
      'Each gold plate is a temperature stage. A pulse-tube cryocooler gets the top plates to 50 K and 4 K. Below that, a mixture of helium-3 and helium-4 does the rest: pumping helium-3 across a phase boundary in the mixing chamber pulls the bottom plate down to about 10 mK.',
      'Cold matters because a 5 GHz qubit has an energy of only about 0.24 K × k_B. At 10 mK the chance of a stray thermal excitation is around e^(-24). At 300 K the qubit would be scrambled instantly.',
      'Follow the blue line down: a readout pulse leaves room temperature and passes through attenuators at each stage that soak up thermal noise. It bounces off the qubit, then climbs the orange line back up through the directional amplifier, the HEMT amplifier at 4 K, and out to the electronics. Red dots are noise from the HEMT trying to travel the wrong way, toward the qubit.',
    ],
    facts: [
      ['Mixing chamber', '≈ 10 mK'],
      ['Input attenuation', '≈ 60 dB total'],
      ['HEMT noise temperature', '≈ 2–4 K'],
      ['Thermal photons at 10 mK, 7 GHz', '≈ 10⁻¹⁵'],
    ],
  },
  mxc: {
    id: 'mxc',
    name: 'Mixing chamber plate',
    short: 'MXC plate',
    size: '~10 cm',
    metersPerUnit: 0.01,
    temp: '≈ 10 mK',
    camera: [0, 15, 21],
    target: [0, 0.5, 0],
    minDist: 4,
    maxDist: 50,
    parent: 'fridge',
    children: [
      { to: 'chip', label: 'Qubit package', pos: [-4, 2.2, 0] },
      { to: 'amp', label: 'Directional amplifier', pos: [3.5, 2.0, 0] },
    ],
    intro: 'The coldest place in the building. The qubit chip and the first amplifier sit side by side here.',
    body: [
      'The qubit chip lives in a sealed copper package that blocks stray light and infrared photons, which would otherwise break Cooper pairs and create quasiparticles. Magnetic shields around it keep vortices out of the superconducting films.',
      'The signal coming off the qubit is a few microwave photons. The first amplifier has to boost it without adding more than the quantum-mechanical minimum of noise (half a photon), and it has to keep noise from the warmer stages from flowing back into the qubit.',
      'Traditionally that takes a quantum-limited amplifier plus two or three ferrite circulators, which are bulky, magnetic, and lose signal. A directional amplifier does both jobs in one superconducting chip. Toggle "Readout consequences" on the right to see what the amplifier settings do to the actual qubit measurement.',
    ],
    facts: [
      ['Signal power at the qubit', '≈ −130 dBm'],
      ['Photons per readout', '≈ 1–100'],
      ['Gain needed before digitizing', '≈ 100 dB'],
      ['Typical circulator loss', '≈ 0.5–1 dB each'],
    ],
  },
  amp: {
    id: 'amp',
    name: 'Josephson directional amplifier',
    short: 'Dir. amp',
    size: '~5 mm',
    metersPerUnit: 0.0005,
    temp: '≈ 10 mK',
    camera: [0, 12.5, 10.5],
    target: [0, 0, 0],
    minDist: 4,
    maxDist: 30,
    parent: 'mxc',
    children: [{ to: 'junction', label: 'One of its Josephson junctions', pos: [0, 0.3, 0] }],
    intro: 'Two paths, one interference. This is how a chip with no magnets makes signals go one way.',
    body: [
      'Three superconducting resonators (modes a, b, c) are coupled through Josephson junctions that are driven by pump tones. A pump at the sum of two mode frequencies creates gain (two-mode squeezing). A pump at their difference swaps photons between them (frequency conversion).',
      'A signal entering at a can reach b directly, or take the detour a → c → b. The pump phase φ sets the relative phase between the two routes. At φ = −π/2 they interfere constructively going forward and destructively going backward. Going backward the loop is traversed in the opposite sense, so the phase flips sign. This is the same idea as an Aharonov–Bohm ring, with the pump phase playing the role of the magnetic flux.',
      'Mode c is heavily damped on purpose. It acts as an engineered reservoir (Metelmann & Clerk, 2015) that soaks up the backward-traveling signal instead of letting it reach the qubit. Use the controls to break the interference, flip the direction, or push the pump past the point where the amplifier starts to self-oscillate.',
    ],
    facts: [
      ['Design forward gain', '20 dB'],
      ['Design reverse isolation', '≈ 41 dB'],
      ['Added noise', '0.505 photons (limit: 0.5)'],
      ['Port linewidth κ/2π (model)', '50 MHz'],
    ],
    note: 'Coupled-mode model: three modes, linear input-output theory, matched to a 20 dB / 41 dB design point found numerically. Real devices (e.g. Sliwa et al., PRX 2015) differ in layout.',
  },
  chip: {
    id: 'chip',
    name: 'Qubit chip',
    short: 'Chip',
    size: '~5 mm',
    metersPerUnit: 0.0005,
    temp: '≈ 10 mK',
    camera: [0, 14, 10.5],
    target: [0, 0, 0],
    minDist: 3,
    maxDist: 30,
    parent: 'mxc',
    children: [{ to: 'transmon', label: 'Transmon qubit', pos: [-1.1, 0.25, -2.9] }],
    intro: 'A piece of sapphire with a thin superconducting film patterned on top. Everything on it is a circuit.',
    body: [
      'The silver film is a superconductor (aluminum, niobium, or tantalum), patterned like a printed circuit board but with nanometer-scale features. The cross-shaped islands are transmon qubits. The meandering lines are quarter-wave readout resonators, each about 5 mm long when unrolled, tuned near 7 GHz.',
      'Each resonator couples to one qubit on one end and to the shared feedline on the other. Because the qubit and resonator are detuned, they do not exchange energy. Instead the resonator frequency shifts by ±χ depending on the qubit state. That shift is the dispersive readout.',
      'All qubits share one feedline, so their readout resonators sit at different frequencies and are measured at once (frequency multiplexing). This is the same scheme used to read out charge-sensitive transmons in phonon and particle detectors.',
    ],
    facts: [
      ['Readout resonators', '≈ 7 GHz, λ/4'],
      ['Dispersive shift χ/2π', '≈ 0.5–3 MHz'],
      ['Resonator linewidth κ/2π', '≈ 1–10 MHz'],
      ['Film thickness', '≈ 100–200 nm'],
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
    parent: 'chip',
    children: [{ to: 'junction', label: 'Josephson junction (SQUID)', pos: [0, 0.2, 0] }],
    intro: 'An LC oscillator where the inductor is a Josephson junction, which makes the levels unevenly spaced.',
    body: [
      'The two large pads form a capacitor. Its charging energy E_C = e²/2C is kept small so the qubit is insensitive to stray charge. Between the pads, a SQUID (two Josephson junctions in a loop) acts as a nonlinear inductor with energy E_J. Threading magnetic flux through the loop tunes E_J and therefore the qubit frequency.',
      'In a regular LC circuit every energy level is spaced equally, so you could never drive only the 0→1 transition. The junction’s cosine potential makes the spacing shrink: ω₀₁ ≈ √(8E_J E_C) − E_C, and the 1→2 transition sits about E_C lower. That difference (the anharmonicity) is what lets |0⟩ and |1⟩ act as a qubit.',
      'Transmons run with E_J/E_C ≈ 50, which suppresses charge noise exponentially while keeping enough anharmonicity, roughly −200 to −300 MHz.',
    ],
    facts: [
      ['Qubit frequency', '≈ 4–6 GHz'],
      ['E_J / E_C', '≈ 50'],
      ['Anharmonicity', '≈ −E_C ≈ −250 MHz'],
      ['Best T₁ (Ta films)', '≈ 0.3–1 ms'],
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
    parent: 'transmon',
    children: [],
    intro: 'Two strips of aluminum separated by about 1–2 nm of aluminum oxide. Every qubit and every Josephson amplifier depends on this.',
    body: [
      'Cooper pairs tunnel coherently through the oxide barrier. The supercurrent depends on the phase difference across the junction, I = I_c sin φ, which gives the junction an inductance that changes with current. A lossless, nonlinear inductor is something no ordinary circuit element provides.',
      'The junction is made by shadow evaporation: aluminum is deposited at one angle, oxidized in a controlled amount of oxygen, then deposited again at another angle so the two layers overlap. The overlap area (here about 200 × 200 nm) and the oxide thickness set I_c, and through it E_J = ħI_c/2e.',
      'The same element appears in the directional amplifier, where pumping it modulates the inductance at microwave frequencies. That parametric modulation is what produces gain and frequency conversion. A tiny defect in this oxide, a two-level system, is one of the main sources of qubit decoherence today.',
    ],
    facts: [
      ['Oxide thickness', '≈ 1–2 nm'],
      ['Critical current I_c', '≈ 10–50 nA'],
      ['Superconducting gap (Al)', '≈ 180 µeV'],
      ['Junction area', '≈ 0.01–0.1 µm²'],
    ],
    note: 'Electrodes and overlap are drawn to scale. The oxide is drawn about 5× thicker than real so it stays visible.',
  },
}

export const ORDER: LevelId[] = ['fridge', 'mxc', 'amp', 'chip', 'transmon', 'junction']
