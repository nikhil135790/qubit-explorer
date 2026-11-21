# Down the Readout Line

An interactive, to-scale 3D journey through a superconducting quantum computer, from a 1.5 m dilution refrigerator down to a 200 nm Josephson junction, built around the device that reads qubits out: the **Josephson directional amplifier**.

Built for the Qublitz 2026 Quantum Create challenge.

## What it does

Six zoom levels, each drawn to scale in its own units, with a live scale bar:

| Level | Real size | What you can do |
|---|---|---|
| Dilution refrigerator | ~1.5 m | Follow a readout pulse down through attenuators and back up through the amplifiers. Watch noise from the 4 K HEMT try to travel back toward the qubit. |
| Mixing chamber plate | ~10 cm | See the qubit package and the directional amplifier side by side. Add or remove an output isolator and see the effect on the qubit. |
| **Directional amplifier** | ~5 mm | Change the pump phase and strength. Watch the forward gain, reverse isolation, and added noise update live from a coupled-mode model, and push the amplifier into self-oscillation. |
| Qubit chip | ~5 mm | Four transmons and their λ/4 readout resonators on a shared feedline. See the dispersive shift of the resonator for qubit states \|0⟩ and \|1⟩. |
| Transmon | ~500 µm | Capacitor pads and SQUID. Change E_J/E_C and see the energy levels, anharmonicity, and charge sensitivity. |
| Josephson junction | ~200 nm | Al/AlOx/Al overlap junction with Cooper pairs tunneling through the barrier. |

Every amplifier setting feeds through to a **readout consequence** panel: readout fidelity and qubit T₂, computed from a dispersive readout model plus back-action dephasing.

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

## Run the app

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

Built with React, Three.js (React Three Fiber + drei), Zustand, and TypeScript.

## Simplifications

- The amplifier is a three-mode coupled-mode model. Real devices (Josephson ring modulators, or QAH-based nonreciprocal elements) differ in layout and in second-order effects such as pump depletion and saturation.
- The readout model ignores measurement-induced state transitions and the resonator transient right after a T₁ decay.
- Geometry is to scale within each level. The junction's oxide barrier is drawn about 5× thicker than real so it stays visible.
