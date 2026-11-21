import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import type { Line2 } from 'three-stdlib'
import * as THREE from 'three'
import { usePath } from './state'

/**
 * A readout pulse drawn the way textbooks draw an electromagnetic wave: the tip of the field
 * vector traces a helix around the line it travels on (radius = amplitude, angle = phase), with
 * faint field arrows from the center line out to the helix. Brightness follows the pulse envelope,
 * so the packet fades in at its head and out at its tail.
 * All random jitter (noise) is tied to the shared clock, so it freezes when the journey is paused.
 */
export type TrailSpec = {
  center: () => number // arc position of the pulse center, scene units (negative = not launched)
  width: number // envelope width, scene units
  radius: (a: number) => number // drawn radius at arc position a
  twist: (a: number) => number // extra phase (radians) acquired before a
  fuzz?: (a: number) => number // random jitter, as a fraction of the radius
  pitch: number // scene units per turn (visual)
  /** how far the helix axis sits above the path (default: one radius, so the helix rests on the wire instead of sinking into it) */
  lift?: (a: number) => number
}

const N = 600
const SPOKE_EVERY = 8

// cheap deterministic noise in [-0.5, 0.5]
const hash = (i: number, t: number) => { const x = Math.sin(i * 12.9898 + t * 78.233) * 43758.5453; return x - Math.floor(x) - 0.5 }

export function PulseTrail({ curve, spec, color = '#ffcf6e', width = 1.8 }: { curve: THREE.Curve<THREE.Vector3>; spec: TrailSpec; color?: string; width?: number }) {
  const ref = useRef<Line2>(null)
  const spokes = useRef<THREE.LineSegments>(null)
  const base = useMemo(() => new THREE.Color(color), [color])
  const pos = useMemo(() => new Float32Array(N * 3), [])
  const col = useMemo(() => new Float32Array(N * 3), [])
  const NS = Math.floor(N / SPOKE_EVERY)
  const spokeGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 6), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NS * 6), 3))
    return g
  }, [NS])
  const len = useMemo(() => curve.getLength(), [curve])
  const init = useMemo(() => Array.from({ length: N }, () => [0, 0, 0] as [number, number, number]), [])
  const initCol = useMemo(() => Array.from({ length: N }, () => [0, 0, 0] as [number, number, number]), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const v = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), b: new THREE.Vector3(), n: new THREE.Vector3() }), [])

  useFrame(() => {
    const line = ref.current, sp = spokes.current
    if (!line || !sp) return
    const c = spec.center()
    const show = c > -spec.width * 3 && c < len + spec.width * 3
    line.visible = sp.visible = show
    if (!show) return
    const tq = Math.floor(usePath.getState().time * 24) // jitter changes 24 times a second, and stops when paused
    const span = spec.width * 3
    const sPos = spokeGeo.attributes.position.array as Float32Array
    const sCol = spokeGeo.attributes.color.array as Float32Array
    for (let i = 0; i < N; i++) {
      const a = Math.min(len, Math.max(0, c - span + (2 * span * i) / (N - 1)))
      const f = a / len
      curve.getPointAt(f, v.p)
      curve.getTangentAt(f, v.t)
      v.b.crossVectors(v.t, up)
      if (v.b.lengthSq() < 1e-6) v.b.set(0, 0, 1)
      v.b.normalize()
      v.n.crossVectors(v.b, v.t).normalize()
      const lf = spec.lift ? spec.lift(a) : spec.radius(a) * 1.05
      v.p.addScaledVector(v.n, lf)
      const env = Math.exp(-(((a - c) / spec.width) ** 2))
      const r = spec.radius(a) * env
      const ph = (2 * Math.PI * a) / spec.pitch + spec.twist(a)
      const jz = spec.fuzz ? spec.fuzz(a) * r : 0
      const x = r * Math.cos(ph) + hash(i, tq) * jz
      const y = r * Math.sin(ph) + hash(i + 977, tq) * jz
      const px = v.p.x + v.n.x * x + v.b.x * y, py = v.p.y + v.n.y * x + v.b.y * y, pz = v.p.z + v.n.z * x + v.b.z * y
      pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz
      const k = 1.7 * Math.pow(env, 0.7) // bright core (blooms), dark tails
      col[i * 3] = base.r * k; col[i * 3 + 1] = base.g * k; col[i * 3 + 2] = base.b * k
      if (i % SPOKE_EVERY === 0) {
        const s = i / SPOKE_EVERY
        if (s < NS) {
          sPos.set([v.p.x, v.p.y, v.p.z, px, py, pz], s * 6)
          const ks = 0.55 * env
          sCol.set([base.r * ks * 0.3, base.g * ks * 0.3, base.b * ks * 0.3, base.r * ks, base.g * ks, base.b * ks], s * 6)
        }
      }
    }
    line.geometry.setPositions(pos)
    line.geometry.setColors(col)
    spokeGeo.attributes.position.needsUpdate = true
    spokeGeo.attributes.color.needsUpdate = true
    spokeGeo.computeBoundingSphere()
  })
  return (
    <group>
      <Line ref={ref} points={init} vertexColors={initCol} color="#ffffff" lineWidth={width} toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      <lineSegments ref={spokes} geometry={spokeGeo} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </lineSegments>
    </group>
  )
}
