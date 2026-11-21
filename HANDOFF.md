# Handoff

Context for continuing this project in a new chat. Attach the repo and read this file first.

## Project
Qublitz 2026 hackathon, Quantum Create track. A to-scale 3D web app that follows a qubit's readout signal from a dilution refrigerator down to a Josephson junction, with an interactive Josephson directional amplifier as the centerpiece. Owner: Nikhil (Princeton ECE first-year, new to coding, Windows + VS Code).

Judging: connection to QC 25%, technical understanding 25%, creativity 25%, functionality 15%, UX 5%, GitHub 5%. Judged by live demo and questions, so Nikhil has to be able to explain the physics.

## Stack
Vite + React + TypeScript, Three.js via React Three Fiber and drei, @react-three/postprocessing, zustand, KaTeX, framer-motion, IBM Plex fonts. Run: `npm run build && npm run preview` (port 4173).

## Layout
- `src/levels.ts`: text, camera, and hotspots for the six levels (text supports `$...$` math).
- `src/scene/*`: one 3D scene per level, plus `common.tsx` (materials, particle flows, labels, hotspots) and `World.tsx` (canvas, lighting, post-processing, camera transitions, scale bar).
- `src/physics/dirAmp.ts`: three-mode directional amplifier (input-output theory). Design point 20 dB / -40.9 dB / 0.505 photons.
- `src/physics/readout.ts`, `useChain.ts`: dispersive readout fidelity, chain efficiency, back-action T2.
- `src/ui/*`: instrument-panel UI (Overlay with intro and guided tour, Panels, Plot, Tex).
- `verification/`: Python + QuTiP checks and the amplifier design script. All pass.

## Current app (src/path, as of Nov 21 afternoon)
"Follow the pulse": a timeline of 5 stations, camera on rails, pause to orbit/zoom.
- Station 1 (StationQubit.tsx): opens on a transmon close-up (pad + junction), pulls back to a 4-qubit chip in its gold board, pulse rides the feedline, twists at the resonator, leaves over wire bonds into the SMA.
- Station 2 (StationAmp.tsx): amp package, 3-resonator chip with Josephson ring, pump wave; pulse splits (direct + detour via c), recombines bigger; backward noise cancels and drains into c's resistor.
- Stations 3 to 5 (isolator, HEMT, screen) still to build. `BUILT` in Path.tsx controls which are unlocked.
- Pitch is Sunday Nov 22, 11 am.
Earlier attempts kept for reference: src/scene + src/ui (6-level explorer), src/journey (captions), src/bench (chain builder).

## Done
- Six levels with animated signals, guided tour, intro screen, LaTeX.
- Pass 1 visuals: Poly Haven studio HDRI, bloom/AO/AgX tone mapping, instrument UI, larger type, adaptive quality.

## Next
1. Pass 2: rebuild fridge and mixing-plate geometry with real detail (lathed plates, bent semi-rigid coax, SMA connectors, thermal links).
2. Pass 3: chip layouts with ground plane and CPW gaps; transmon and junction detail.
3. Physics walkthrough with Nikhil, one step at a time (dispersive readout, chain efficiency, directional amp interference, back-action), then mock judge Q&A.
4. Deploy on Vercel for a public link.

Writing rules for any copy: no em dashes, no "it's not X, it's Y", plain varied sentences, LaTeX for math.
