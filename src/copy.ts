import type { LevelId } from './levels'

// All the explanatory text, kept in one place. Inline math goes between $...$.
export const COPY: Record<LevelId, { intro: string; body: string[] }> = {
  fridge: {
    intro: 'Welcome to the coldest object in the building. The qubit lives at the very bottom.',
    body: [
      'Every plate going down is colder than the one above it. A pulse-tube cooler (think: a very serious refrigerator compressor) gets the top stages to 50 K and 4 K. Then a mix of helium-3 and helium-4 takes over and drags the bottom plate down to about 10 mK. Outer space sits at 2.7 K, so down here it’s roughly 270 times colder than space.',
      'Why go to all this trouble? A 5 GHz qubit carries almost no energy: $hf \\approx k_B \\times 0.24\\,\\mathrm{K}$. At room temperature, random thermal jiggling would flip it constantly. At 10 mK the odds of a thermal kick drop to about $e^{-24}$... roughly 1 in 26 billion.',
      'Now follow the dots. Blue is the readout pulse heading down, getting quieter at each plate as attenuators soak up heat noise. Orange is the same pulse coming back up after bouncing off the qubit, getting amplified on the way. Red is noise from the 4 K amplifier trying to sneak back down to the qubit (it really shouldn’t be allowed to).',
    ],
  },
  mxc: {
    intro: 'Bottom plate, ten millikelvin. The qubit and its first amplifier are neighbors here, a few centimeters apart.',
    body: [
      'The qubit chip hides in a sealed copper box inside a magnetic shield. A single stray infrared photon can break a Cooper pair and cause an error, so the box is basically a blackout curtain.',
      'Here’s the problem this whole app is about. The signal leaving the qubit is a handful of microwave photons. It needs to be amplified by about $10^{10}$ before a computer can read it, and quantum mechanics says any amplifier that keeps phase information adds at least half a photon of noise. On top of that, the amplifier can’t let noise from upstairs leak back into the qubit.',
      'The usual fix: a Josephson parametric amplifier plus two or three ferrite circulators. Circulators work, but they’re bulky, they need permanent magnets (right next to a superconducting chip, which is awkward), and they lose some signal before it ever gets amplified. A directional amplifier tries to do both jobs on one chip. The panel above shows what that tradeoff actually costs.',
    ],
  },
  amp: {
    intro: 'Three tiny resonators, a few pump tones, and a trick that lets signals through in one direction only.',
    body: [
      'Modes $a$, $b$ and $c$ are coupled through Josephson junctions that you drive with pump tones. Pump at $\\omega_a + \\omega_b$ and you get gain: each pump photon splits into one photon in each mode. Pump at $|\\omega_a - \\omega_c|$ and photons just hop from one mode to the other.',
      'So a signal entering $a$ has two ways to reach $b$: straight there, or with a detour through $c$. The pump phase $\\varphi$ sets the phase difference between the two routes. At $\\varphi = -\\pi/2$ they add up going forward and cancel going backward, because running the loop in reverse flips the sign of the phase. (If that sounds like the Aharonov–Bohm effect, it’s the same trick, with the pump phase standing in for magnetic flux.)',
      'Where does the backward signal go? Into mode $c$, which is damped about 200 times harder than the others ($\\kappa_c \\approx 200\\,\\kappa$) and dumps it into a load. That’s the reservoir engineering idea from Metelmann and Clerk (2015). Go ahead and break it: remove the interference, flip the direction, or pump too hard and watch it start oscillating on its own.',
    ],
  },
  chip: {
    intro: 'A 5 mm square of sapphire with about 100 nm of superconductor on top. The crosses are qubits. The squiggles are how you talk to them.',
    body: [
      'Each squiggle is a quarter-wave resonator near 7 GHz, folded up so it fits on the chip (unrolled, it’s about 4 to 5 mm long). One end touches a qubit. The other end touches the feedline running across the middle.',
      'The qubit and resonator are deliberately mistuned, so they never actually trade energy. Instead, the resonator’s frequency shifts by $\\pm\\chi$ depending on whether the qubit is in $|0\\rangle$ or $|1\\rangle$. Send a tone down the feedline, check its phase on the way out, and you know the state without poking the qubit directly. That’s dispersive readout.',
      'Every resonator sits at a slightly different frequency, so one feedline reads all four qubits at once. Picture a room where everyone talks at the same time, but each person has their own pitch.',
    ],
  },
  transmon: {
    intro: 'Two metal pads and a tiny loop. Technically just an LC circuit... with one very important upgrade.',
    body: [
      'The pads form a capacitor with charging energy $E_C = e^2/2C$. The little loop in the middle is a SQUID: two Josephson junctions acting as an inductor with energy $E_J$. Push magnetic flux through the loop and $E_J$ changes, which is how you tune the qubit’s frequency.',
      'Here’s why the junction matters. In a normal LC circuit the energy levels are evenly spaced, like rungs on a ladder. Drive $|0\\rangle \\to |1\\rangle$ and you also drive $|1\\rangle \\to |2\\rangle$, and so on up the ladder. Useless as a qubit. The junction squeezes the upper rungs together: $\\omega_{01} \\approx \\sqrt{8E_JE_C} - E_C$, and the next step up is smaller by about $E_C$. Now you can talk to just the bottom two levels.',
      'Transmons are built with $E_J/E_C \\approx 50$. That makes them nearly deaf to stray charge (sensitivity falls like $e^{-\\sqrt{8E_J/E_C}}$) while keeping enough uneven spacing to work. Slide the ratio in the panel and watch it happen.',
    ],
  },
  junction: {
    intro: 'Two strips of aluminum with about 1.5 nm of oxide in between. Everything you just zoomed through depends on this.',
    body: [
      'Cooper pairs tunnel straight through the oxide with zero resistance. The current depends on the phase difference across the junction, $I = I_c \\sin\\varphi$, so the junction behaves like an inductor $L_J = \\hbar/(2eI_c\\cos\\varphi)$ whose value changes with current. A lossless, nonlinear inductor: you can’t buy one of those at an electronics store.',
      'To make one, you evaporate aluminum from one angle, let it oxidize in a carefully measured puff of oxygen, then evaporate more aluminum from a second angle so the layers overlap. The overlap area and oxide thickness set $I_c$, and $E_J = \\hbar I_c/2e$. Get the oxygen slightly wrong and your qubit lands at the wrong frequency.',
      'This is also the active ingredient in the directional amplifier, where the pumps wiggle $L_J$ at microwave frequencies. It’s a weak spot too: tiny defects in the oxide, called two-level systems, are one of the biggest sources of qubit decoherence today.',
    ],
  },
}
