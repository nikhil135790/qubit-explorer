import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Rect, Cpw, GAP, FILM, Y_GROUND, Y_GAP, Y_TRACE } from '../journey/Chip'

/**
 * A 4-qubit chip in the style of Princeton (Houck / de Leon) tantalum devices:
 * double-pad transmons with a single Al/AlOx junction, each capacitively coupled to its own
 * quarter-wave readout resonator, all hanging off one shared feedline. Scene units: 1 = 0.1 mm.
 * The resonators share one pattern; only the coupling elbow length differs slightly, which is
 * what gives each one its own readout frequency.
 */
export const QX = [-30, -10, 10, 30] // qubit positions along the feedline
/** The two coupling capacitors that fence the feedline into a shared Purcell filter (a band-pass section). */
export const PURCELL_X = 40

/** An interdigitated capacitor cut into the feedline: the trace breaks and its two ends interleave fingers. */
function FingerCap({ x }: { x: number }) {
  const y = Y_TRACE + 0.0065
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, y, 0]}><boxGeometry args={[3, 0.002, 1.02]} /><meshStandardMaterial {...GAP} /></mesh>
      {[-0.39, -0.13, 0.13, 0.39].map((z, i) => (
        <mesh key={z} position={[i % 2 ? 0.3 : -0.3, y + 0.002, z]}><boxGeometry args={[2.4, 0.002, 0.14]} /><meshStandardMaterial {...FILM} /></mesh>
      ))}
    </group>
  )
}
export const MAIN = 2 // the qubit we follow
export const MAIN_X = QX[MAIN]
export const QZ = -16.1 // qubit center (pads straddle this line)
const ELBOW = [3.8, 3.93, 4.07, 4.2]
const TA = { color: '#9c968a', metalness: 0.85, roughness: 0.38 } // tantalum film

function resonator(x0: number, e: number): [number, number][] {
  return [
    [x0 - e, -2.6], [x0 + e, -2.6], [x0 + e, -4.2], [x0 - 4, -4.2], [x0 - 4, -5.8], [x0 + 4, -5.8], [x0 + 4, -7.4],
    [x0 - 4, -7.4], [x0 - 4, -9], [x0 + 4, -9], [x0 + 4, -10.6], [x0, -10.6], [x0, -13.1],
  ]
}

/** Two 0.4 x 0.25 mm pads 20 µm apart, joined by a junction drawn a few µm wide (real: ~0.2 µm). */
function Transmon({ x0, detailed }: { x0: number; detailed?: boolean }) {
  return (
    <group position={[x0, 0, QZ]}>
      <Rect x={0} z={0} w={6} d={7.4} y={Y_GAP} mat={GAP} />
      <Rect x={0} z={1.35} w={4} d={2.5} y={Y_TRACE} mat={TA} h={0.012} />
      <Rect x={0} z={-1.35} w={4} d={2.5} y={Y_TRACE} mat={TA} h={0.012} />
      {/* aluminum contact patches where the junction leads land on the tantalum pads */}
      <mesh position={[0, Y_TRACE + 0.0068, 0.16]}><boxGeometry args={[0.1, 0.0012, 0.12]} /><meshStandardMaterial color="#c6c9ce" metalness={0.9} roughness={0.35} /></mesh>
      <mesh position={[0.03, Y_TRACE + 0.0068, -0.16]}><boxGeometry args={[0.1, 0.0012, 0.12]} /><meshStandardMaterial color="#c6c9ce" metalness={0.9} roughness={0.35} /></mesh>
      {/* junction leads, ~1 µm wide: hair-thin at chip scale. The followed qubit gets a detailed junction instead. */}
      {!detailed && <>
        <mesh position={[0, Y_GAP + 0.0052, 0.05]}><boxGeometry args={[0.01, 0.0003, 0.1]} /><meshStandardMaterial color="#c9ccd1" metalness={0.9} roughness={0.45} /></mesh>
        <mesh position={[0.03, Y_GAP + 0.0053, -0.05]}><boxGeometry args={[0.01, 0.0006, 0.1]} /><meshStandardMaterial color="#c9ccd1" metalness={0.9} roughness={0.45} /></mesh>
        <mesh position={[0.015, Y_GAP + 0.0053, 0]}><boxGeometry args={[0.03, 0.0006, 0.004]} /><meshStandardMaterial color="#c9ccd1" metalness={0.9} roughness={0.45} /></mesh>
      </>}
    </group>
  )
}

export function ProcessorChip({ pulseX }: { pulseX: () => number }) {
  // the followed qubit's resonator glows while the pulse is passing its coupling point
  const glow = useRef<THREE.Group>(null)
  useFrame(() => {
    const c = pulseX()
    const ring = Math.exp(-((c / 6) ** 2)) + (c > 0 ? 0.6 * Math.exp(-c / 14) : 0)
    glow.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m && m.emissive) m.emissiveIntensity = 0.9 * ring
    })
  })
  return (
    <group>
      <mesh position={[0, -0.6, -6]}><boxGeometry args={[90, 1.2, 60]} /><meshStandardMaterial {...GAP} /></mesh>
      <Rect x={0} z={-6} w={90} d={60} y={Y_GROUND} mat={TA} h={0.02} />
      <Cpw pts={[[-45, 0], [45, 0]]} wc={1.0} wg={2.2} />
      <FingerCap x={-PURCELL_X} />
      <FingerCap x={PURCELL_X} />
      {QX.map((x0, i) => (
        <group key={x0}>
          {i === MAIN ? <group ref={glow}><Cpw pts={resonator(x0, ELBOW[i])} wc={0.5} wg={1.1} /></group> : <Cpw pts={resonator(x0, ELBOW[i])} wc={0.5} wg={1.1} />}
          <Transmon x0={x0} detailed={i === MAIN} />
        </group>
      ))}
    </group>
  )
}
