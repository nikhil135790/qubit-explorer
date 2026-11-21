import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MAT, Std, Flat, Label } from './common'

// 1 unit = 50 um. Double-pad transmon: two 400 x 150 um pads, 40 um gap, SQUID loop in the gap.
export function Transmon() {
  const left = useRef<THREE.MeshStandardMaterial>(null)
  const right = useRef<THREE.MeshStandardMaterial>(null)
  const field = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    // charge sloshing between the pads (slowed down ~10^9 times)
    const q = Math.sin(clock.getElapsedTime() * 2.2)
    if (left.current) left.current.emissive.setRGB(0.12 * Math.max(0, q), 0.05 * Math.max(0, q), 0.16 * Math.max(0, -q))
    if (right.current) right.current.emissive.setRGB(0.12 * Math.max(0, -q), 0.05 * Math.max(0, -q), 0.16 * Math.max(0, q))
    if (field.current) field.current.children.forEach((c) => {
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial
      m.opacity = 0.15 + 0.6 * Math.abs(q)
      m.color.set(q > 0 ? '#ff9f43' : '#5aa9ff')
    })
  })
  const padW = 8, padD = 3, gap = 0.8
  return (
    <group>
      <mesh position={[0, -0.25, 0]}><boxGeometry args={[24, 0.5, 14]} /><Std {...MAT.sapphire} /></mesh>
      {/* ground plane with a rectangular cutout around the qubit */}
      <Flat x={0} z={-5.75} w={24} d={2.5} /><Flat x={0} z={5.75} w={24} d={2.5} />
      <Flat x={-10.5} z={0} w={3} d={9} /><Flat x={10.5} z={0} w={3} d={9} />
      {/* pads */}
      <mesh position={[0, 0.04, -(padD + gap) / 2]}><boxGeometry args={[padW, 0.06, padD]} /><meshStandardMaterial ref={left} {...MAT.film} /></mesh>
      <mesh position={[0, 0.04, (padD + gap) / 2]}><boxGeometry args={[padW, 0.06, padD]} /><meshStandardMaterial ref={right} {...MAT.film} /></mesh>
      {/* SQUID: small loop with two junctions bridging the gap */}
      <Flat x={-0.25} z={0} w={0.06} d={gap} h={0.04} />
      <Flat x={0.25} z={0} w={0.06} d={gap} h={0.04} />
      <mesh position={[-0.25, 0.06, 0]}><boxGeometry args={[0.12, 0.08, 0.12]} /><Std {...MAT.oxide} /></mesh>
      <mesh position={[0.25, 0.06, 0]}><boxGeometry args={[0.12, 0.08, 0.12]} /><Std {...MAT.oxide} /></mesh>
      {/* coupling arm toward the readout resonator */}
      <Flat x={-6.2} z={-(padD + gap) / 2} w={4.4} d={0.3} />
      {/* electric field lines across the gap */}
      <group ref={field}>
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={i} position={[-3.75 + i * 0.75, 0.12, 0]}>
            <boxGeometry args={[0.04, 0.02, gap]} />
            <meshBasicMaterial transparent opacity={0.4} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <Label pos={[0, 0.5, -3.6]} small>capacitor pad (charge +q / −q)</Label>
      <Label pos={[2.4, 0.5, 0.9]} small color="#6fd3ff">SQUID (2 junctions)</Label>
      <Label pos={[-7.5, 0.5, -3.2]} small>to readout resonator</Label>
    </group>
  )
}
