import { MAT, Std, Flat, Meander, Flow, Label } from './common'
import { useStore } from '../store'
import { summarize } from '../physics/dirAmp'
import { useMemo } from 'react'

// 1 unit = 0.5 mm; the chip is 5 mm x 5 mm
const A: [number, number] = [-3, 1.3], B: [number, number] = [3, 1.3], Cc: [number, number] = [0, -2.6]
const Y = 0.06

function Resonator({ at, glow, color }: { at: [number, number]; glow: number; color: string }) {
  return (
    <group>
      <Meander start={[at[0] - 0.8, at[1] - 0.6]} turns={7} length={1.6} pitch={0.2} width={0.07} />
      <mesh position={[at[0], 0.03, at[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.4, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.08 + 0.5 * glow} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function AmpChip() {
  const phi = useStore((s) => s.phi)
  const sp = useStore((s) => s.s)
  const amp = useMemo(() => summarize({ phi, s: sp }), [phi, sp])
  const ok = amp.stable
  const g = Math.max(0, Math.min(1, amp.fwdDb / 25))
  const back = Math.max(0, Math.min(1, (amp.revDb + 40) / 40))
  const P = (x: number, z: number): [number, number, number] => [x, Y + 0.05, z]
  const direct = [P(-4.7, 1.3), P(-3.9, 1.3), P(-3, 1.3), P(-1.4, 0.6), P(0, 0), P(1.4, 0.6), P(3, 1.3), P(3.9, 1.3), P(4.7, 1.3)]
  const detour = [P(-3, 1.3), P(-1.4, 0.6), P(-0.2, -0.3), P(-0.4, -1.6), P(0, -2.6), P(0.4, -1.6), P(0.2, -0.3), P(1.4, 0.6), P(3, 1.3)]
  const backward = [P(4.7, 1.45), P(3, 1.45), P(1.4, 0.75), P(0, 0.15), P(-1.4, 0.75), P(-3, 1.45), P(-4.7, 1.45)]
  const dump = [P(0, -2.6), P(0, -3.6), P(0, -4.7)]
  return (
    <group>
      <mesh position={[0, -0.2, 0]}><boxGeometry args={[10, 0.4, 10]} /><Std {...MAT.silicon} /></mesh>
      {/* ground ring */}
      <Flat x={0} z={-4.85} w={10} d={0.3} /><Flat x={0} z={4.85} w={10} d={0.3} />
      <Flat x={-4.85} z={0} w={0.3} d={10} /><Flat x={4.85} z={0} w={0.3} d={10} />
      {/* bond pads */}
      {[[-4.5, 1.3], [4.5, 1.3], [0, -4.5], [0, 4.5]].map(([x, z], i) => <Flat key={i} x={x} z={z} w={0.7} d={0.7} h={0.04} />)}
      {/* feed traces */}
      <Flat x={-4.0} z={1.3} w={0.7} d={0.08} /><Flat x={4.0} z={1.3} w={0.7} d={0.08} />
      <Flat x={0} z={-3.6} w={0.08} d={1.4} /><Flat x={0} z={2.3} w={0.08} d={4.0} />
      {/* couplers from resonators to the ring */}
      <mesh position={[-1.5, Y, 0.65]} rotation={[0, Math.atan2(0.65, 1.5) , 0]}><boxGeometry args={[1.9, 0.02, 0.06]} /><Std {...MAT.film} /></mesh>
      <mesh position={[1.5, Y, 0.65]} rotation={[0, -Math.atan2(0.65, 1.5), 0]}><boxGeometry args={[1.9, 0.02, 0.06]} /><Std {...MAT.film} /></mesh>
      <Flat x={0} z={-1.1} w={0.06} d={1.6} />

      <Resonator at={A} glow={0.5} color="#56a8ff" />
      <Resonator at={B} glow={ok ? 0.3 + 0.7 * g : 1} color="#ffa94d" />
      <Resonator at={Cc} glow={0.2 + 0.5 * back} color="#c9a6ff" />

      {/* Josephson ring modulator: four junctions on a small superconducting loop */}
      <group position={[0, Y, 0]}>
        <Flat x={0} z={-0.3} w={0.6} d={0.05} /><Flat x={0} z={0.3} w={0.6} d={0.05} />
        <Flat x={-0.3} z={0} w={0.05} d={0.6} /><Flat x={0.3} z={0} w={0.05} d={0.6} />
        {[[0, -0.3], [0, 0.3], [-0.3, 0], [0.3, 0]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.04, z]}><boxGeometry args={[0.1, 0.06, 0.1]} /><Std {...MAT.oxide} /></mesh>
        ))}
      </group>

      <Label pos={[A[0], 0.4, A[1] + 1.8]} small color="#56a8ff">mode a · input (faces qubit)</Label>
      <Label pos={[B[0], 0.4, B[1] + 1.8]} small color="#ffa94d">mode b · output (to HEMT)</Label>
      <Label pos={[Cc[0] + 2.4, 0.4, Cc[1]]} small color="#c9a6ff">mode c · damped reservoir</Label>
      <Label pos={[0, 0.4, 4.0]} small>pump in</Label>
      <Label pos={[1.1, 0.4, -4.4]} small>50 Ω load</Label>

      {/* signal flowing forward along both routes */}
      <Flow points={direct} color="#ffa94d" count={22} speed={0.12} size={0.07}
        sizeAt={(u) => (u < 0.5 ? 1 : ok ? 1 + 1.6 * g : 2.4)} />
      <Flow points={detour} color="#ffd29e" count={16} speed={0.1} size={0.05} offset={0.4} />
      {/* noise entering from the output, trying to reach the qubit side */}
      <Flow points={backward} color="#ff4d5e" count={20} speed={0.1} size={0.07}
        alphaAt={(u) => (u < 0.5 ? 1 : back)} sizeAt={(u) => (u < 0.5 ? 1 : 1 + Math.max(0, amp.revDb) / 8)} />
      <Flow points={dump} color="#ff4d5e" count={6} speed={0.25} size={0.06} alphaAt={() => 1 - back} />
    </group>
  )
}
