# QH Interactive

A guided, to-scale 3D journey that follows one qubit readout pulse through a superconducting quantum computer: from the microwave generator at room temperature, down a dilution refrigerator, through the qubit chip, the Josephson directional amplifier, an isolator and a HEMT amplifier, and back up to the scientist's screen.

Built for the QuBlitz 2026 Quantum Create challenge, as a visual introduction for people entering superconducting qubit hardware, where the hardest part is often seeing how parts at wildly different scales (a 200 nm junction, a 9 mm chip, a 1.5 m fridge) fit together and why each one exists.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in Chrome. Use **Next** and **Back** to step through, **Pause** to freeze everything, drag to look around between steps, and the **|0⟩ / |1⟩** toggle to change the qubit's state.

## The journey

| Stage | What you see |
|---|---|
| The trip down | The dilution refrigerator, the rack where the pulse is generated and split (half kept as the phase reference), and the pulse travelling down the input line through an attenuator at each plate. |
| The qubit | A zoom from the 10 mK plate onto a tantalum transmon, into its Al/AlOx/Al Josephson junction with Cooper pairs tunnelling, and back out to a 4-qubit chip with frequency-multiplexed readout resonators. The pulse picks up a ±45° phase shift depending on the qubit state. |
| Directional amplifier | A three-mode Josephson amplifier: the pulse reaches the output by two routes that add in step (20 dB gain), while backward noise from the HEMT takes the same two routes, cancels, and drains into a resistor. |
| Isolator | A ferrite circulator with one port terminated: the pulse goes 1 → 2, HEMT noise goes 2 → 3 and is absorbed. |
| HEMT at 4 K | A three-stage transistor amplifier adding ~40 dB, and why it must come after the near-quantum-limited amplifier. |
| The screen | Mixer, digitizer and FPGA turn the pulse's phase into I and Q; single shots, then thousands of shots build two clouds. A toggle removes the directional amplifier: readout fidelity drops from 99.7% to 86.6% at the same 0.4 µs. |

Side panels on selected steps explain the key ideas with diagrams: reading the phase, why amplify, two-path interference, backward noise, the one-way circulator, inside a transistor, amplifier ordering, and what I and Q are.

## The physics

### Directional amplifier (`src/physics/dirAmp.ts`)
Three modes: a (input, faces the qubit), b (output), and c (an auxiliary mode that is heavily damped and acts as an engineered reservoir). Pumped Josephson couplings produce:

- a–b two-mode squeezing (gain), with pump phase φ
- a–c frequency conversion
- b–c two-mode squeezing (gain)

A signal can go a → b directly or a → c → b. The pump phase sets the relative phase of the two paths, so they add going forward and cancel going backward. The scattering matrix comes from linear input-output theory: S(ω) = I + √K (M + iω)⁻¹ √K, written in the Nambu basis (a, b, c, a†, b†, c†).

The design point was found numerically (`verification/design_directional_amp.py`):
**20.0 dB forward gain, −40.9 dB reverse transmission, matched input port, 0.505 photons added noise** (the quantum limit is 0.5). Setting φ = +π/2 flips the direction. Pumping past about 105% of the design strength makes the amplifier unstable.

References: A. Metelmann & A. A. Clerk, *Nonreciprocal photon transmission and amplification via reservoir engineering*, PRX 5, 021025 (2015); K. M. Sliwa et al., *Reconfigurable Josephson circulator/directional amplifier*, PRX 5, 041020 (2015).

### Readout chain (`src/physics/readout.ts`)
- Dispersive readout: the resonator field rings up to α± = ε/(κ/2 ± iχ) depending on the qubit state.
- Chain efficiency (Friis): η = η_line / (1 + 2 n_tot), with n_tot = n_amp + n_HEMT / G.
- Assignment fidelity, including T₁ decay during the measurement.
- Back-action: photons leaking back through imperfect isolation dephase the qubit at Γ_φ = (κ/2) Re[√((1 + 2iχ/κ)² + 8iχ n_th/κ) − 1] (Clerk & Utami 2007; Sears et al. 2012).

## How it was made

Physics models, verification scripts and the 3D scene were built with substantial help from an AI assistant (Claude, by Anthropic). All physics numbers shown in the app come from the models in `src/physics/`, checked against the independent calculations listed below.

## Verification

Everything the app computes was checked against independent calculations:

| Check | Result |
|---|---|
| Analytic readout fidelity vs. 4000 time-stepped Monte Carlo traces | agree within statistical error (e.g. 0.9966 vs 0.9971) |
| Back-action dephasing formula vs. full QuTiP master equation | agree to 4 decimal places |
| In-app TypeScript amplifier model vs. Python reference | identical (20.00 dB / −40.9 dB / 0.505) |
| In-app TypeScript readout model vs. Python reference | identical to 5 decimal places |

Run them yourself:

```bash
pip install numpy scipy qutip
python verification/validate_readout.py
python verification/design_directional_amp.py
npx tsx verification/check_ts.ts
```

Built with React, Three.js (React Three Fiber + drei), Zustand, and TypeScript.

## Simplifications

- The amplifier is a three-mode coupled-mode model. Real devices (Josephson ring modulators, or QAH-based nonreciprocal elements) differ in layout and in second-order effects such as pump depletion and saturation.
- The readout model ignores measurement-induced state transitions and the resonator transient right after a T₁ decay.
- Geometry is to scale (1 scene unit = 0.1 mm); the junction's oxide barrier is drawn about 5× thicker than real so it stays visible.
- The pulse is drawn as a spiral showing the rotating electric field. Its size is chosen for visibility, and amplification is drawn compressed (20 dB is 10× in amplitude, drawn about 1.7×).
- The mixer is shown as a direct IQ mixer with digital demodulation on the FPGA; real setups often add a room-temperature amplifier and heterodyne detection.
