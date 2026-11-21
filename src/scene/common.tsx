import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import type { LevelId } from '../levels'

export const MAT = {
  gold: { color: '#d9a94e', metalness: 1, roughness: 0.28 },
  copper: { color: '#c27a4a', metalness: 1, roughness: 0.35 },
  steel: { color: '#a7adb7', metalness: 1, roughness: 0.4 },
  alum: { color: '#d8dde4', metalness: 1, roughness: 0.22 },
  film: { color: '#cfd6df', metalness: 0.9, roughness: 0.18 },
  silicon: { color: '#2a3140', metalness: 0.3, roughness: 0.55 },
  sapphire: { color: '#8fb3d9', metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.55 },
  oxide: { color: '#6fd3ff', metalness: 0.2, roughness: 0.3, transparent: true, opacity: 0.75, emissive: '#1f6f99' },
  coax: { color: '#b7bcc4', metalness: 0.9, roughness: 0.3 },
  dark: { color: '#1a1d24', metalness: 0.4, roughness: 0.6 },
} as const

export function Std(p: (typeof MAT)[keyof typeof MAT] & { side?: THREE.Side }) {
  return <meshStandardMaterial {...p} />
}

/** A tube following a path of points. */
export function Tube({ points, radius = 0.05, mat = MAT.coax, segments = 120 }: {
  points: [number, number, number][]; radius?: number; mat?: (typeof MAT)[keyof typeof MAT]; segments?: number
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.05), [points])
  return (
    <mesh>
      <tubeGeometry args={[curve, segments, radius, 12, false]} />
      <Std {...mat} />
    </mesh>
  )
}

/**
 * Glowing particles flowing along a path. `sizeAt(u)` and `alphaAt(u)` (u in 0..1 along the path)
 * let a pulse grow when it passes an amplifier or fade when it is absorbed.
 */
export function Flow({ points, color, count = 24, speed = 0.12, size = 0.08, sizeAt, alphaAt, offset = 0, jitter = 0 }: {
  points: [number, number, number][]; color: string; count?: number; speed?: number; size?: number
  sizeAt?: (u: number) => number; alphaAt?: (u: number) => number; offset?: number; jitter?: number
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.05), [points])
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => [(i / count + offset) % 1, Math.random() - 0.5, Math.random() - 0.5]), [count, offset])
  const sizeRef = useRef(sizeAt), alphaRef = useRef(alphaAt)
  sizeRef.current = sizeAt
  alphaRef.current = alphaAt
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.getElapsedTime()
    for (let i = 0; i < count; i++) {
      const u = (seeds[i][0] + t * speed) % 1
      const p = curve.getPointAt(u)
      const a = alphaRef.current ? alphaRef.current(u) : 1
      const s = size * (sizeRef.current ? sizeRef.current(u) : 1) * (a > 0.02 ? 1 : 0)
      dummy.position.set(p.x + seeds[i][1] * jitter, p.y, p.z + seeds[i][2] * jitter)
      dummy.scale.setScalar(Math.max(s * Math.min(1, a * 1.5), 1e-4))
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.95} />
    </instancedMesh>
  )
}

/** A floating text label anchored in 3D. */
export function Label({ pos, children, small, color }: { pos: [number, number, number]; children: React.ReactNode; small?: boolean; color?: string }) {
  return (
    <Html position={pos} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div className={small ? 'lbl lbl-s' : 'lbl'} style={color ? { borderColor: color, color } : undefined}>{children}</div>
    </Html>
  )
}

/** Clickable pulsing marker that zooms into another level. */
export function Hotspot({ pos, to, label }: { pos: [number, number, number]; to: LevelId; label: string }) {
  const goTo = useStore((s) => s.goTo)
  const ring = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  useFrame(({ clock, camera }) => {
    if (!ring.current) return
    const k = 1 + 0.25 * Math.sin(clock.getElapsedTime() * 3)
    const d = camera.position.distanceTo(new THREE.Vector3(...pos))
    ring.current.scale.setScalar(k * d * 0.022)
    ring.current.lookAt(camera.position)
  })
  return (
    <group position={pos}>
      <mesh ref={ring} onClick={(e) => { e.stopPropagation(); goTo(to, pos) }}
        onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}>
        <ringGeometry args={[0.7, 1, 40]} />
        <meshBasicMaterial color={hover ? '#ffffff' : '#9d7bff'} toneMapped={false} side={THREE.DoubleSide} transparent opacity={0.9} />
      </mesh>
      <Html center position={[0, 0, 0]} zIndexRange={[20, 10]}>
        <button className="hot" onClick={() => goTo(to, pos)}>⤢ {label}</button>
      </Html>
    </group>
  )
}

/** Thin flat rectangle lying on the XZ plane (for films and traces). */
export function Flat({ x, z, w, d, y = 0, h = 0.02, mat = MAT.film }: { x: number; z: number; w: number; d: number; y?: number; h?: number; mat?: (typeof MAT)[keyof typeof MAT] }) {
  return (
    <mesh position={[x, y + h / 2, z]}>
      <boxGeometry args={[w, h, d]} />
      <Std {...mat} />
    </mesh>
  )
}

/** A meandering trace on the XZ plane, built from flat segments. */
export function Meander({ start, turns, length, pitch, width = 0.08, y = 0.02, dir = 1 }: {
  start: [number, number]; turns: number; length: number; pitch: number; width?: number; y?: number; dir?: 1 | -1
}) {
  const segs: { x: number; z: number; w: number; d: number }[] = []
  let [x, z] = start
  for (let i = 0; i < turns; i++) {
    const sgn = i % 2 === 0 ? 1 : -1
    segs.push({ x: x + (sgn * length) / 2, z, w: length + width, d: width })
    x += sgn * length
    if (i < turns - 1) {
      segs.push({ x, z: z + (dir * pitch) / 2, w: width, d: pitch })
      z += dir * pitch
    }
  }
  return <>{segs.map((s, i) => <Flat key={i} {...s} y={y} />)}</>
}
