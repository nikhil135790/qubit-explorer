import { MAT, Std, Flat, Meander, Flow, Label } from './common'

// 1 unit = 0.5 mm; a 5 mm x 5 mm sapphire die with four transmons and four readout resonators
const XS = [-3.3, -1.1, 1.1, 3.3]

function Xmon({ x, z }: { x: number; z: number }) {
  return (
    <group>
      <Flat x={x} z={z} w={0.9} d={0.1} h={0.03} />
      <Flat x={x} z={z} w={0.1} d={0.9} h={0.03} />
      <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.65, 40]} />
        <meshBasicMaterial color="#7cc4ff" transparent opacity={0.12} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function QubitChip() {
  return (
    <group>
      <mesh position={[0, -0.25, 0]}><boxGeometry args={[10, 0.5, 10]} /><Std {...MAT.sapphire} /></mesh>
      {/* ground frame */}
      <Flat x={0} z={-4.8} w={10} d={0.4} /><Flat x={0} z={4.8} w={10} d={0.4} />
      <Flat x={-4.8} z={0} w={0.4} d={10} /><Flat x={4.8} z={0} w={0.4} d={10} />
      {/* feedline with launch pads */}
      <Flat x={0} z={0} w={8.6} d={0.1} h={0.03} />
      <Flat x={-4.4} z={0} w={0.6} d={0.6} h={0.04} /><Flat x={4.4} z={0} w={0.6} d={0.6} h={0.04} />
      {XS.map((x, i) => (
        <group key={i}>
          {/* coupling elbow near the feedline */}
          <Flat x={x} z={-0.25} w={0.9} d={0.06} />
          {/* quarter-wave readout resonator, meandered */}
          <group>
            <Meander start={[x - 0.45, -0.45]} turns={7 + (i % 2)} length={0.9} pitch={0.22} width={0.05} dir={-1} />
          </group>
          <Flat x={x} z={-2.35} w={0.06} d={0.25} />
          <Xmon x={x} z={-2.9} />
          {/* flux bias line from the top edge */}
          <Flat x={x + 0.25} z={-3.95} w={0.05} d={1.5} />
          <Flat x={x + 0.25} z={-4.55} w={0.35} d={0.35} h={0.04} />
          <Label pos={[x, 0.35, -3.75]} small>Q{i + 1}</Label>
          {/* charge drive line from the bottom */}
          <Flat x={x - 0.3} z={2.6} w={0.05} d={4.0} />
          <Flat x={x - 0.3} z={4.5} w={0.35} d={0.35} h={0.04} />
        </group>
      ))}
      <Label pos={[0, 0.35, 0.5]} small color="#56a8ff">shared feedline (one probe tone per resonator)</Label>
      <Label pos={[-4.2, 0.35, -1.4]} small>λ/4 readout resonator</Label>
      <Flow points={[[-4.6, 0.08, 0], [0, 0.08, 0], [4.6, 0.08, 0]]} color="#56a8ff" count={16} speed={0.12} size={0.06} />
    </group>
  )
}
