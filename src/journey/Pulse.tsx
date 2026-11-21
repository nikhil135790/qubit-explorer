import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import type { Line2 } from 'three-stdlib'
import { useJourney, READOUT_PHASE, READOUT_AMP } from './state'

/**
 * The readout pulse drawn as its complex amplitude: position along the feedline on x,
 * in-phase (I) and quadrature (Q) components on y and z. A carrier at the probe frequency
 * traces a corkscrew; the radius is the amplitude, the rotation angle is the phase.
 * After the coupling point (x = 0) the pulse carries the resonator's response for the
 * current qubit state: amplitude x 1/sqrt(2) and a phase twist of -45 or +45 degrees.
 * The corkscrew pitch is shortened for visibility (the real wavelength on chip is ~17 mm).
 */
const N = 700
const X0 = -45, X1 = 45
const SPEED = 16 // units per second (visual)
const WIDTH = 6 // pulse envelope width
const K = (2 * Math.PI) / 3.2 // visual pitch
const R = 1.2 // drawn radius for amplitude 1
const AXIS_Y = 1.3

function helix(out: Float32Array, center: number, qubit: 0 | 1, ghost: boolean) {
  for (let i = 0; i < N; i++) {
    const x = X0 + ((X1 - X0) * i) / (N - 1)
    const env = Math.exp(-(((x - center) / WIDTH) ** 2))
    const after = x > 0
    if (ghost && !after) { out.set([x, AXIS_Y, 0], i * 3); continue }
    const amp = R * env * (after ? READOUT_AMP : 1)
    const ph = K * x + (after ? READOUT_PHASE[qubit] : 0)
    out[i * 3] = x
    out[i * 3 + 1] = AXIS_Y + amp * Math.cos(ph)
    out[i * 3 + 2] = amp * Math.sin(ph)
  }
}

export function Pulse() {
  const main = useRef<Line2>(null)
  const ghost = useRef<Line2>(null)
  const buf = useMemo(() => new Float32Array(N * 3), [])
  const buf2 = useMemo(() => new Float32Array(N * 3), [])
  const init = useMemo(() => Array.from({ length: N }, (_, i) => [X0 + ((X1 - X0) * i) / (N - 1), AXIS_Y, 0] as [number, number, number]), [])
  useFrame(() => {
    const { firedAt, qubit } = useJourney.getState()
    const center = X0 + 7 + (performance.now() / 1000 - firedAt) * SPEED
    helix(buf, center, qubit, false)
    helix(buf2, center, qubit === 1 ? 0 : 1, true)
    main.current?.geometry.setPositions(buf)
    ghost.current?.geometry.setPositions(buf2)
  })
  return (
    <group>
      <Line ref={ghost} points={init} color="#7fa6c9" lineWidth={1.6} transparent opacity={0.45} dashed dashSize={0.4} gapSize={0.3} />
      <Line ref={main} points={init} color="#ffd27a" lineWidth={3.4} toneMapped={false} />
      {/* the feedline axis, faint, so the corkscrew has something to wrap around */}
      <Line points={[[X0, AXIS_Y, 0], [X1, AXIS_Y, 0]]} color="#ffffff" lineWidth={0.6} transparent opacity={0.12} />
    </group>
  )
}
