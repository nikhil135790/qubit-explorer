import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import type { Line2 } from 'three-stdlib'
import * as THREE from 'three'

/**
 * A readout pulse drawn as its complex amplitude around a path: the corkscrew's radius is the
 * amplitude and its rotation angle is the phase. Only the part of the path near the pulse is drawn.
 * Everything is a function of arc position a (in scene units) so stations can describe gain,
 * phase twists and added noise wherever they happen along the path.
 */
export type TrailSpec = {
  center: () => number // arc position of the pulse center, scene units (negative = not launched)
  width: number // envelope width, scene units
  radius: (a: number) => number // drawn radius at arc position a
  twist: (a: number) => number // extra phase (radians) acquired before a
  fuzz?: (a: number) => number // random jitter, as a fraction of the radius
  pitch: number // scene units per turn (visual)
}

const N = 520

export function PulseTrail({ curve, spec, color = '#ffcf6e', width = 3 }: { curve: THREE.Curve<THREE.Vector3>; spec: TrailSpec; color?: string; width?: number }) {
  const ref = useRef<Line2>(null)
  const buf = useMemo(() => new Float32Array(N * 3), [])
  const len = useMemo(() => curve.getLength(), [curve])
  const init = useMemo(() => Array.from({ length: N }, () => [0, 0, 0] as [number, number, number]), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), b: new THREE.Vector3(), n: new THREE.Vector3() }), [])
  useFrame(() => {
    const c = spec.center()
    const line = ref.current
    if (!line) return
    line.visible = c > -spec.width * 3 && c < len + spec.width * 3
    if (!line.visible) return
    const span = spec.width * 3.2
    for (let i = 0; i < N; i++) {
      const a = Math.min(len, Math.max(0, c - span + (2 * span * i) / (N - 1)))
      const f = a / len
      curve.getPointAt(f, tmp.p)
      curve.getTangentAt(f, tmp.t)
      tmp.b.crossVectors(tmp.t, up)
      if (tmp.b.lengthSq() < 1e-6) tmp.b.set(0, 0, 1)
      tmp.b.normalize()
      tmp.n.crossVectors(tmp.b, tmp.t).normalize()
      const env = Math.exp(-(((a - c) / spec.width) ** 2))
      const r = spec.radius(a) * env
      const ph = (2 * Math.PI * a) / spec.pitch + spec.twist(a)
      const jz = spec.fuzz ? spec.fuzz(a) * r : 0
      const x = r * Math.cos(ph) + (Math.random() - 0.5) * jz
      const y = r * Math.sin(ph) + (Math.random() - 0.5) * jz
      buf[i * 3] = tmp.p.x + tmp.n.x * x + tmp.b.x * y
      buf[i * 3 + 1] = tmp.p.y + tmp.n.y * x + tmp.b.y * y
      buf[i * 3 + 2] = tmp.p.z + tmp.n.z * x + tmp.b.z * y
    }
    line.geometry.setPositions(buf)
  })
  return <Line ref={ref} points={init} color={color} lineWidth={width} toneMapped={false} />
}
