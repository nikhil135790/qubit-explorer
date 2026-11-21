import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useJourney } from './state'

// 1 unit = 0.1 mm. Aluminum film on silicon, coplanar-waveguide layout:
// a dark gap (bare silicon) on each side of every center conductor.
export const FILM = { color: '#8e887c', metalness: 0.85, roughness: 0.4 }
export const GAP = { color: '#1a1b23', metalness: 0.2, roughness: 0.5 }
export const Y_GROUND = 0.05, Y_GAP = 0.066, Y_TRACE = 0.078

export function Rect({ x, z, w, d, y, mat, h = 0.01 }: { x: number; z: number; w: number; d: number; y: number; mat: typeof FILM; h?: number }) {
  return (
    <mesh position={[x, y, z]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  )
}

/** Axis-aligned CPW trace along a polyline: gap strip underneath, conductor on top. */
export function Cpw({ pts, wc, wg }: { pts: [number, number][]; wc: number; wg: number }) {
  const segs = pts.slice(1).map((p, i) => {
    const [x1, z1] = pts[i], [x2, z2] = p
    const horiz = z1 === z2
    return { x: (x1 + x2) / 2, z: (z1 + z2) / 2, len: Math.abs(horiz ? x2 - x1 : z2 - z1), horiz }
  })
  return (
    <>
      {segs.map((s, i) => (
        <group key={i}>
          <Rect x={s.x} z={s.z} w={s.horiz ? s.len + wg : wg} d={s.horiz ? wg : s.len + wg} y={Y_GAP} mat={GAP} />
          <mesh position={[s.x, Y_TRACE, s.z]}>
            <boxGeometry args={[s.horiz ? s.len + wc : wc, 0.012, s.horiz ? wc : s.len + wc]} />
            <meshStandardMaterial {...FILM} emissive="#ffb35c" emissiveIntensity={0} />
          </mesh>
        </group>
      ))}
    </>
  )
}

// readout resonator: coupling elbow next to the feedline, a meander, then a run up to the qubit
export const RESONATOR: [number, number][] = [
  [-4, -2.6], [4, -2.6], [4, -4.2], [-4, -4.2], [-4, -5.8], [4, -5.8], [4, -7.4], [-4, -7.4],
  [-4, -9], [4, -9], [4, -10.6], [0, -10.6], [0, -13.1],
]
export const QUBIT_POS: [number, number, number] = [0, 0, -16]

/** pulseX: optional function giving the current pulse position along the feedline (for the resonator glow). */
export function Chip({ pulseX }: { pulseX?: () => number } = {}) {
  // the resonator lights up (warm glow) while a pulse is passing the coupling point
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    const { firedAt } = useJourney.getState()
    const center = pulseX ? pulseX() : -38 + (performance.now() / 1000 - firedAt) * 16
    const ring = Math.exp(-(((center - 0) / 6) ** 2)) + (center > 0 ? 0.6 * Math.exp(-(center - 0) / 14) : 0)
    if (!group.current) return
    group.current.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m && m.emissive) m.emissiveIntensity = 0.9 * ring
    })
  })
  return (
    <group>
      {/* silicon die and aluminum ground plane */}
      <mesh position={[0, -0.6, -6]}><boxGeometry args={[90, 1.2, 60]} /><meshStandardMaterial {...GAP} /></mesh>
      <Rect x={0} z={-6} w={90} d={60} y={Y_GROUND} mat={FILM} h={0.02} />
      {/* feedline along x */}
      <Cpw pts={[[-45, 0], [45, 0]]} wc={1.0} wg={2.2} />
      {/* readout resonator (tagged so it can glow) */}
      <group ref={group}>
        <Cpw pts={RESONATOR} wc={0.5} wg={1.1} />
      </group>
      {/* Xmon transmon: cross-shaped gap in the ground plane with a cross-shaped island inside */}
      <group position={QUBIT_POS}>
        <Rect x={0} z={0} w={7.0} d={1.8} y={Y_GAP} mat={GAP} />
        <Rect x={0} z={0} w={1.8} d={7.0} y={Y_GAP} mat={GAP} />
        <Rect x={0} z={0} w={5.4} d={0.6} y={Y_TRACE} mat={FILM} h={0.012} />
        <Rect x={0} z={0} w={0.6} d={5.4} y={Y_TRACE} mat={FILM} h={0.012} />
        {/* Josephson junction: a thin aluminum bridge across the gap from the far arm's tip to ground.
            Real junctions are ~0.2 µm; this is drawn ~10x wider so it's barely visible at this scale. */}
        <mesh position={[0, 0.088, -3.1]}><boxGeometry args={[0.1, 0.02, 0.85]} /><meshStandardMaterial color="#e9e3d4" metalness={1} roughness={0.2} /></mesh>
        <mesh position={[0, 0.095, -3.1]}><boxGeometry args={[0.28, 0.012, 0.1]} /><meshStandardMaterial color="#7fd6ff" metalness={0.3} roughness={0.3} emissive="#2a7fa8" emissiveIntensity={0.5} /></mesh>
      </group>
    </group>
  )
}
