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
    intro: 'The qubit sits at the bottom of this stack of plates, at about 10 mK.',
    body: [
      'Each plate is colder than the one above it. A pulse-tube cooler brings the top two stages to 50 K and 4 K. Below that, a mixture of helium-3 and helium-4 cools the bottom plate to around 10 mK.',
      'The temperature has to be this low because a 5 GHz qubit has very little energy: $hf \\approx k_B \\times 0.24\\,\\mathrm{K}$. At 10 mK the chance of a thermal excitation is about $e^{-hf/k_BT} \\approx e^{-24}$, so the qubit stays in its ground state until you drive it.',
      'The blue line carries the readout pulse down. Attenuators on each plate absorb thermal noise from the warmer stages above. After the pulse reflects off the qubit, it travels up the orange line through the directional amplifier and then the HEMT amplifier at 4 K. The red dots are noise from the HEMT traveling back down toward the qubit.',
    ],
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
    intro: 'The qubit package and the first amplifier are mounted here, a few centimeters apart.',
    body: [
      'The qubit chip sits in a sealed copper box inside a magnetic shield. The box blocks stray infrared light, which can break Cooper pairs in the superconductor and cause errors.',
      'The signal leaving the qubit is only a few photons. The first amplifier has to boost it while adding as little noise as quantum mechanics allows, which is half a photon. It also has to stop noise from the 4 K stage from flowing back into the qubit.',
      'Labs usually do this with a Josephson parametric amplifier and two or three ferrite circulators. Circulators are bulky, need permanent magnets, and lose some of the signal before it gets amplified. A directional amplifier does both jobs on one chip. The readout panel above shows what that tradeoff does to a real measurement.',
    ],
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
    intro: 'Three coupled resonators that amplify a signal going forward and block it going backward.',
    body: [
      'The modes $a$, $b$ and $c$ are coupled through Josephson junctions that are driven by pump tones. A pump at $\\omega_a + \\omega_b$ creates gain between two modes. A pump at $|\\omega_a - \\omega_c|$ converts photons from one mode into the other.',
      'A signal entering $a$ can reach $b$ directly, or by going through $c$ first. The pump phase $\\varphi$ sets the phase difference between those two routes. At $\\varphi = -\\pi/2$ they add up going forward and cancel going backward, because going around the loop in reverse flips the sign of the phase. This is the same idea as the Aharonov–Bohm effect, with the pump phase playing the role of magnetic flux.',
      'Mode $c$ is damped much more strongly than the others, with $\\kappa_c \\approx 200\\,\\kappa$. It soaks up the backward signal so it never reaches the qubit (Metelmann and Clerk, 2015). Use the buttons above to break the interference, flip the direction, or pump hard enough that the amplifier oscillates on its own.',
    ],
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
    intro: 'A 5 mm piece of sapphire with a patterned superconducting film. The crosses are qubits and the zigzags are readout resonators.',
    body: [
      'The film is about 100 nm of aluminum, niobium or tantalum. Each zigzag is a quarter-wave resonator near 7 GHz, folded up so it fits on the chip. One end couples to a qubit and the other end couples to the shared feedline.',
      'The qubit and resonator are detuned, so they don’t exchange energy. Instead, the resonator frequency shifts by $\\pm\\chi$ depending on whether the qubit is in $|0\\rangle$ or $|1\\rangle$. Sending a tone down the feedline and measuring its phase tells you the qubit state. This is called dispersive readout.',
      'Each resonator has a different frequency, so one feedline can read out all four qubits at once.',
    ],
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
    intro: 'Two metal pads joined by a SQUID. It’s an LC circuit where the inductor is a Josephson junction.',
    body: [
      'The pads form a capacitor with charging energy $E_C = e^2/2C$. The SQUID, which is two junctions in a small loop, acts as an inductor with energy $E_J$. Changing the magnetic flux through the loop changes $E_J$, which tunes the qubit frequency.',
      'In an ordinary LC circuit the energy levels are evenly spaced, so a pulse that drives $|0\\rangle \\to |1\\rangle$ would also drive $|1\\rangle \\to |2\\rangle$. The junction makes the spacing uneven: $\\omega_{01} \\approx \\sqrt{8E_JE_C} - E_C$, and the next transition is lower by about $E_C$. That difference is the anharmonicity, and it’s what lets the lowest two levels act as a qubit.',
      'Transmons run at $E_J/E_C \\approx 50$. Sensitivity to charge noise falls off like $e^{-\\sqrt{8E_J/E_C}}$, while the anharmonicity stays near $-E_C$.',
    ],
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
    intro: 'Two aluminum strips separated by about 1.5 nm of aluminum oxide.',
    body: [
      'Cooper pairs tunnel through the oxide without resistance. The current depends on the phase difference across the junction, $I = I_c \\sin\\varphi$. That gives the junction an inductance $L_J = \\hbar / (2eI_c\\cos\\varphi)$ that changes with current. Every superconducting qubit relies on this nonlinearity.',
      'It’s made by shadow evaporation. Aluminum is deposited at one angle, oxidized in a controlled amount of oxygen, then deposited again at a second angle so the two layers overlap. The overlap area and oxide thickness set $I_c$, and $E_J = \\hbar I_c/2e$.',
      'The same element drives the directional amplifier, where pumping modulates $L_J$ at microwave frequencies. Defects in the oxide, called two-level systems, are one of the main causes of qubit decoherence.',
    ],
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
