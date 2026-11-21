import { MAT, Std, Tube, Flow, Label } from './common'
import { useChain } from '../physics/useChain'

// 1 unit = 10 cm. Plate heights and radii roughly follow a commercial dilution refrigerator.
const PLATES = [
  { y: 6.5, r: 2.7, h: 0.18, name: '300 K flange', mat: MAT.steel },
  { y: 4.6, r: 2.5, h: 0.12, name: '50 K', mat: MAT.gold },
  { y: 2.6, r: 2.3, h: 0.12, name: '4 K', mat: MAT.gold },
  { y: 0.6, r: 2.0, h: 0.1, name: 'Still  ≈ 0.8 K', mat: MAT.gold },
  { y: -2.2, r: 1.9, h: 0.1, name: 'Cold plate  ≈ 100 mK', mat: MAT.gold },
  { y: -5.6, r: 1.9, h: 0.14, name: 'Mixing chamber  ≈ 10 mK', mat: MAT.gold },
]
const IN_X = 0.9, OUT_X = -0.9
const inputPath: [number, number, number][] = [
  [IN_X, 8, 0.5], [IN_X, 6.5, 0.5], [IN_X, 2.6, 0.5], [IN_X, -2.2, 0.5], [IN_X, -5.6, 0.5], [0.6, -6.6, 0.5], [0.2, -7.1, 0.3],
]
const outputPath: [number, number, number][] = [
  [-0.2, -7.1, 0.3], [-0.7, -6.9, 0.5], [OUT_X, -6.3, 0.5], [OUT_X, -5.6, 0.5], [OUT_X, -2.2, 0.5], [OUT_X, 0.6, 0.5], [OUT_X, 2.6, 0.5], [OUT_X, 6.5, 0.5], [OUT_X, 8, 0.5],
]
// noise from the HEMT (4 K) heading down the output line toward the amplifier and qubit
const noisePath: [number, number, number][] = [
  [OUT_X - 0.12, 2.5, 0.62], [OUT_X - 0.12, 0.6, 0.62], [OUT_X - 0.12, -2.2, 0.62], [OUT_X - 0.12, -5.6, 0.62], [OUT_X - 0.12, -6.3, 0.62], [-0.75, -6.95, 0.62], [-0.2, -7.15, 0.4],
]
const AMP_Y = -6.3

export function Fridge() {
  const ch = useChain()
  // visual only: how much of the backward noise makes it past the amplifier (0 at >= 40 dB isolation)
  const leak = Math.max(0, Math.min(1, (40 - ch.isoDb) / 40))
  return (
    <group>
      {PLATES.map((p, i) => (
        <group key={i}>
          <mesh position={[0, p.y, 0]}>
            <cylinderGeometry args={[p.r, p.r, p.h, 64]} />
            <Std {...p.mat} />
          </mesh>
          <Label pos={[p.r + 0.3, p.y, 0]} small>{p.name}</Label>
          {/* support rods to next plate */}
          {i < PLATES.length - 1 && [0, 1, 2, 3, 4, 5].map((k) => {
            const a = (k / 6) * Math.PI * 2 + 0.3
            const r = PLATES[i + 1].r - 0.25
            const y0 = p.y, y1 = PLATES[i + 1].y
            return (
              <mesh key={k} position={[Math.cos(a) * r, (y0 + y1) / 2, Math.sin(a) * r]}>
                <cylinderGeometry args={[0.05, 0.05, y0 - y1, 8]} />
                <Std {...(i < 2 ? MAT.steel : MAT.gold)} />
              </mesh>
            )
          })}
        </group>
      ))}
      {/* still and mixing chamber cans */}
      <mesh position={[0, 0.0, -0.9]}><cylinderGeometry args={[0.45, 0.45, 1.0, 32]} /><Std {...MAT.steel} /></mesh>
      <mesh position={[0, -5.95, -0.9]}><cylinderGeometry args={[0.35, 0.35, 0.6, 32]} /><Std {...MAT.steel} /></mesh>
      <mesh position={[0, -2.9, -0.9]}><cylinderGeometry args={[0.08, 0.08, 5.6, 12]} /><Std {...MAT.steel} /></mesh>
      {/* pulse tube */}
      <mesh position={[1.3, 4.6, -1.0]}><cylinderGeometry args={[0.22, 0.22, 3.8, 24]} /><Std {...MAT.steel} /></mesh>

      {/* lines */}
      <Tube points={inputPath} radius={0.045} />
      <Tube points={outputPath} radius={0.045} />
      {/* attenuators on the input line */}
      {[{ y: 2.6, t: '−20 dB' }, { y: -2.2, t: '−10 dB' }, { y: -5.6, t: '−30 dB' }].map((a, i) => (
        <group key={i}>
          <mesh position={[IN_X, a.y - 0.25, 0.5]}><cylinderGeometry args={[0.1, 0.1, 0.3, 16]} /><Std {...MAT.steel} /></mesh>
          <Label pos={[IN_X + 0.75, a.y - 0.25, 0.5]} small>{a.t}</Label>
        </group>
      ))}
      {/* HEMT at 4 K */}
      <mesh position={[OUT_X, 2.95, 0.5]}><boxGeometry args={[0.5, 0.35, 0.35]} /><Std {...MAT.gold} /></mesh>
      <Label pos={[OUT_X - 1.0, 3.0, 0.5]} small color="#ffb15c">HEMT amp (4 K)</Label>
      {/* directional amp + qubit package hanging below the MXC */}
      <mesh position={[OUT_X, AMP_Y, 0.5]}><boxGeometry args={[0.35, 0.28, 0.28]} /><Std {...MAT.copper} /></mesh>
      <Label pos={[OUT_X - 1.1, AMP_Y, 0.5]} small color="#b893ff">Directional amp</Label>
      <mesh position={[0, -7.15, 0.3]}><boxGeometry args={[0.55, 0.3, 0.45]} /><Std {...MAT.copper} /></mesh>
      <Label pos={[0, -7.75, 0.3]} small color="#7cc4ff">Qubit package</Label>

      {/* signals */}
      <Flow points={inputPath} color="#56a8ff" count={14} speed={0.09} size={0.07}
        sizeAt={(u) => 1.6 - 1.1 * u} />
      <Flow points={outputPath} color="#ffa94d" count={20} speed={0.09} size={0.035}
        sizeAt={(u) => (u < 0.12 ? 0.6 : u < 0.62 ? (ch.ok ? 1.6 : 0.6) : (ch.ok ? 2.6 : 1.2))} offset={0.03} />
      <Flow points={noisePath} color="#ff4d5e" count={18} speed={0.07} size={0.05} jitter={0.05}
        alphaAt={(u) => (u < 0.78 ? 1 : leak)} sizeAt={(u) => (u < 0.78 ? 1 : 1 + Math.max(0, ch.amp.revDb) / 10)} />
    </group>
  )
}
