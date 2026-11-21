import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { usePath } from './state'

/**
 * The Josephson junction of the followed qubit, at true scale (scene unit = 0.1 mm, so 1 µm = 0.01).
 * Two evaporated aluminum leads cross at a right angle ("Manhattan" style, as in SEM images):
 * the bottom lead comes down from one pad, the top lead comes up from the other pad and turns to
 * cross it. Where they overlap (~0.2 x 0.2 µm) they are separated by ~2 nm of aluminum oxide.
 * Film thicknesses: bottom 30 nm, top 60 nm. The oxide is drawn ~5x thicker so it is visible.
 * Cooper pairs are drawn as glowing pairs of dots: a cartoon of the supercurrent tunneling through.
 */
export const J = { gap: 0.1, wide: 0.01, thin: 0.002, tBot: 0.0003, tTop: 0.0006, tOx: 0.0001, ySi: 0.071 }

const AL = { color: '#c9ccd1', metalness: 0.9, roughness: 0.45 }

function Box({ x, y, z, w, h, d, mat = AL }: { x: number; y: number; z: number; w: number; h: number; d: number; mat?: typeof AL }) {
  return <mesh position={[x, y, z]}><boxGeometry args={[w, h, d]} /><meshStandardMaterial {...mat} /></mesh>
}

/** Small aluminum grains scattered over the leads, the lumpy texture evaporated films have. */
function Grains() {
  const N = 9000
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    {
      const m = ref.current
      if (!m) return
      const o = new THREE.Object3D()
      let rnd = 7
      const r = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647 }
      for (let i = 0; i < N; i++) {
        // pick a spot on one of the lead tops near the junction
        let x = 0, z = 0, y = 0
        const which = r()
        if (which < 0.45) { // bottom lead, along z
          z = -0.004 + r() * 0.04; const w = z < 0.02 ? J.thin : J.wide; x = (r() - 0.5) * w; y = J.ySi + J.tBot
        } else if (which < 0.8) { // top lead finger, along x
          x = -0.004 + r() * 0.034; z = (r() - 0.5) * J.thin; y = J.ySi + (Math.abs(x) < J.thin / 2 ? J.tBot + J.tOx : 0) + J.tTop
        } else { // top lead riser, along z
          z = -0.04 + r() * 0.04; x = 0.03 + (r() - 0.5) * J.wide; y = J.ySi + J.tTop
        }
        const g = 0.00005 + r() * 0.00009 // grains ~10-30 nm across, packed into the film surface
        o.position.set(x, y - g * 0.15, z)
        o.scale.set(g, g * 0.35, g)
        o.updateMatrix()
        m.setMatrixAt(i, o.matrix)
      }
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    }
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial {...AL} roughness={0.55} />
    </instancedMesh>
  )
}

/** Cooper pairs drifting down the bottom lead, through the oxide at the overlap, and out the top lead. */
function CooperPairs() {
  const P = 12
  const ref = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  const path = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, J.ySi + J.tBot * 0.6, 0.035),
    new THREE.Vector3(0, J.ySi + J.tBot * 0.6, 0.006),
    new THREE.Vector3(0, J.ySi + J.tBot * 0.6, 0.0004),
    new THREE.Vector3(0, J.ySi + J.tBot + J.tOx + J.tTop * 0.5, -0.0002), // through the barrier
    new THREE.Vector3(0.006, J.ySi + J.tTop * 0.6, 0),
    new THREE.Vector3(0.03, J.ySi + J.tTop * 0.6, 0),
  ], false, 'centripetal'), [])
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const t = usePath.getState().time
    for (let i = 0; i < P; i++) {
      const s = (t * 0.07 + i / P) % 1
      const c = path.getPointAt(s)
      const spin = t * 3 + i
      for (let k = 0; k < 2; k++) {
        const sgn = k === 0 ? 1 : -1
        o.position.set(c.x + sgn * 0.00022 * Math.cos(spin), c.y + 0.0004, c.z + sgn * 0.00022 * Math.sin(spin))
        o.scale.setScalar(0.00011)
        o.updateMatrix()
        m.setMatrixAt(i * 2 + k, o.matrix)
      }
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, P * 2]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 10]} />
      <meshBasicMaterial color={new THREE.Color('#ffcf6e').multiplyScalar(2.4)} toneMapped={false} />
    </instancedMesh>
  )
}

export function JunctionDetail({ at, showPairs }: { at: [number, number, number]; showPairs: boolean }) {
  const { ySi, tBot, tTop, tOx, thin, wide, gap } = J
  return (
    <group position={at}>
      {/* bottom lead: down from the upper pad, wide then tapering to 0.2 µm */}
      <Box x={0} y={ySi + tBot / 2} z={(gap + 0.02) / 2} w={wide} h={tBot} d={gap - 0.02} />
      <Box x={0} y={ySi + tBot / 2} z={0.008} w={thin} h={tBot} d={0.024} />
      {/* oxide barrier on top of the bottom lead where the leads overlap */}
      <mesh position={[0, ySi + tBot + tOx / 2, 0]}>
        <boxGeometry args={[thin * 1.02, tOx, thin * 1.02]} />
        <meshStandardMaterial color="#7fd6ff" metalness={0.1} roughness={0.3} transparent opacity={0.8} emissive="#2a7fa8" emissiveIntensity={0.5} />
      </mesh>
      {/* top lead: up from the lower pad, then a thin finger crossing over the bottom lead */}
      <Box x={0.03} y={ySi + tTop / 2} z={-(gap + 0.0) / 2} w={wide} h={tTop} d={gap} />
      <Box x={0.0156} y={ySi + tTop / 2} z={0} w={0.0288} h={tTop} d={thin} />
      <Box x={0} y={ySi + tBot + tOx + tTop / 2} z={0} w={thin * 1.2} h={tTop} d={thin} />
      <Box x={-0.0031} y={ySi + tTop / 2} z={0} w={0.0038} h={tTop} d={thin} />
      <Grains />
      {showPairs && <CooperPairs />}
    </group>
  )
}
