import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MAT, Std, Label } from './common'

// 1 unit = 50 nm. Bottom Al electrode 200 nm wide x 30 nm thick, top electrode 200 nm wide x 60 nm,
// overlap 200 x 200 nm. AlOx barrier is ~1.5 nm thick; drawn at ~7.5 nm so it is visible.
const W = 4, T1 = 0.6, T2 = 1.2, OX = 0.15

export function Junction() {
  const N = 14
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => Array.from({ length: N }, () => [Math.random() * 3.2 - 1.6, Math.random() * 3.2 - 1.6, Math.random()]), [])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.getElapsedTime()
    for (let i = 0; i < N; i++) {
      const [x, z, ph] = seeds[i]
      // Cooper pairs drift through the barrier (supercurrent), shown as paired dots
      const u = (t * 0.25 + ph) % 1
      const y = -0.2 + u * (T1 + OX + T2 + 0.4) - 0.1
      for (let k = 0; k < 2; k++) {
        dummy.position.set(x + (k ? 0.09 : -0.09), y, z)
        dummy.scale.setScalar(0.07)
        dummy.updateMatrix()
        m.setMatrixAt(i * 2 + k, dummy.matrix)
      }
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <mesh position={[0, -0.6, 0]}><boxGeometry args={[16, 1.2, 16]} /><Std {...MAT.silicon} /></mesh>
      {/* bottom electrode along x */}
      <mesh position={[0, T1 / 2, 0]}><boxGeometry args={[14, T1, W]} /><Std {...MAT.alum} /></mesh>
      {/* oxide barrier on top of the overlap */}
      <mesh position={[0, T1 + OX / 2, 0]}><boxGeometry args={[W, OX, W]} /><Std {...MAT.oxide} /></mesh>
      {/* top electrode along z, climbing over the bottom one */}
      <mesh position={[0, T1 + OX + T2 / 2, 0]}><boxGeometry args={[W, T2, W]} /><meshStandardMaterial color="#e8edf3" metalness={1} roughness={0.2} transparent opacity={0.55} /></mesh>
      <mesh position={[0, T2 / 2, 4.5]}><boxGeometry args={[W, T2, 5]} /><Std {...MAT.alum} /></mesh>
      <mesh position={[0, T2 / 2, -4.5]}><boxGeometry args={[W, T2, 5]} /><Std {...MAT.alum} /></mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, N * 2]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial color="#ffd166" toneMapped={false} />
      </instancedMesh>
      <Label pos={[6, 1.0, 0]} small>bottom Al electrode (30 nm)</Label>
      <Label pos={[0, 2.6, -5.5]} small>top Al electrode (60 nm)</Label>
      <Label pos={[3.2, T1 + 0.1, 2.6]} small color="#6fd3ff">AlOx barrier ≈ 1.5 nm</Label>
      <Label pos={[-3.5, 3.0, 2.5]} small color="#ffd166">Cooper pairs tunneling</Label>
    </group>
  )
}
