import { MAT, Std, Tube, Flow, Label } from './common'
import { useChain } from '../physics/useChain'
import { useStore } from '../store'

// 1 unit = 1 cm
const inPath: [number, number, number][] = [[-8, 9, -1.5], [-8, 3, -1.5], [-7.5, 1.2, -0.5], [-6.6, 0.9, 0], [-6.1, 0.9, 0]]
const linkPath: [number, number, number][] = [[-1.9, 0.9, 0], [-0.8, 1.0, 0.8], [0.8, 1.0, 0.8], [1.9, 0.8, 0]]
const outPath: [number, number, number][] = [[5.1, 0.8, 0], [6.4, 0.9, 0], [7.6, 1.6, 0], [8.2, 4, 0], [8.2, 9, 0]]
const pumpPath: [number, number, number][] = [[3.5, 9, 2.5], [3.5, 4, 2.0], [3.5, 2.2, 0.6], [3.5, 1.45, 0.3]]
const noisePath: [number, number, number][] = [[8.35, 9, 0.15], [8.35, 4, 0.15], [7.75, 1.7, 0.15], [6.4, 1.0, 0.15], [5.1, 0.9, 0.15], [3.5, 0.9, 0.15], [1.9, 0.9, 0.15], [0.8, 1.1, 0.95], [-0.8, 1.1, 0.95], [-1.9, 1.0, 0.15]]

export function Mxc() {
  const ch = useChain()
  const iso = useStore((s) => s.outputIsolator)
  const leak = Math.max(0, Math.min(1, (40 - ch.isoDb) / 40))
  return (
    <group>
      {/* gold-plated copper plate */}
      <mesh position={[0, -0.4, 0]}><boxGeometry args={[26, 0.8, 16]} /><Std {...MAT.gold} /></mesh>
      {/* bolt holes */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[-11 + (i % 5) * 5.5, 0.01, i < 5 ? -6.5 : 6.5]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.05, 20]} /><Std {...MAT.dark} />
        </mesh>
      ))}

      {/* qubit package: copper base + lifted, see-through lid */}
      <mesh position={[-4, 0.8, 0]}><boxGeometry args={[4.2, 1.6, 4.2]} /><Std {...MAT.copper} /></mesh>
      <mesh position={[-4, 1.62, 0]}><boxGeometry args={[1.0, 0.04, 1.0]} /><Std {...MAT.film} /></mesh>
      <mesh position={[-4, 3.1, 0]}><boxGeometry args={[4.2, 0.4, 4.2]} /><meshStandardMaterial color="#c27a4a" metalness={1} roughness={0.35} transparent opacity={0.22} /></mesh>
      {[[-6.15, 0.9, 0], [-1.85, 0.9, 0]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.28, 0.28, 0.5, 16]} /><Std {...MAT.gold} /></mesh>
      ))}
      {/* magnetic shield (cryoperm can), drawn see-through */}
      <mesh position={[-4, 2.2, 0]}><cylinderGeometry args={[3.4, 3.4, 4.6, 48, 1, true]} /><meshStandardMaterial color="#9aa7b8" metalness={0.8} roughness={0.4} transparent opacity={0.12} side={2} /></mesh>
      <Label pos={[-4, 5.1, 0]} small color="#7cc4ff">Qubit package inside magnetic shield</Label>

      {/* directional amplifier package */}
      <mesh position={[3.5, 0.7, 0]}><boxGeometry args={[3.0, 1.4, 2.4]} /><Std {...MAT.copper} /></mesh>
      {[[1.95, 0.8, 0], [5.05, 0.8, 0]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.25, 0.25, 0.4, 16]} /><Std {...MAT.gold} /></mesh>
      ))}
      <mesh position={[3.5, 1.55, 0.3]}><cylinderGeometry args={[0.22, 0.22, 0.4, 16]} /><Std {...MAT.gold} /></mesh>
      <Label pos={[3.5, 3.0, -1.4]} small color="#b893ff">Directional amplifier</Label>
      <Label pos={[3.5, 4.6, 2.2]} small>pump tones</Label>

      {/* optional extra isolator on the output */}
      {iso && (
        <group position={[6.6, 1.0, 0]}>
          <mesh><cylinderGeometry args={[0.8, 0.8, 0.7, 32]} /><Std {...MAT.steel} /></mesh>
          <Label pos={[0, 1.2, 0]} small>isolator (+20 dB)</Label>
        </group>
      )}

      <Tube points={inPath} radius={0.12} />
      <Tube points={linkPath} radius={0.12} />
      <Tube points={outPath} radius={0.12} />
      <Tube points={pumpPath} radius={0.08} />
      <Label pos={[-9.6, 6, -1.5]} small color="#56a8ff">readout drive in</Label>
      <Label pos={[9.8, 6, 0]} small color="#ffa94d">to HEMT (4 K)</Label>

      <Flow points={inPath} color="#56a8ff" count={10} speed={0.18} size={0.12} />
      <Flow points={linkPath} color="#ffa94d" count={8} speed={0.3} size={0.07} />
      <Flow points={outPath} color="#ffa94d" count={14} speed={0.18} size={ch.ok ? 0.17 : 0.07} />
      <Flow points={pumpPath} color="#c9a6ff" count={8} speed={0.25} size={0.08} />
      <Flow points={noisePath} color="#ff4d5e" count={26} speed={0.08} size={0.1} jitter={0.15}
        alphaAt={(u) => {
          const pIso = 0.2 // where the optional isolator sits along the path
          const pAmp = 0.48 // where the amplifier sits
          if (u < pIso) return 1
          if (u < pAmp) return iso ? 0.25 : 1
          return leak
        }}
        sizeAt={(u) => (u > 0.48 ? 1 + Math.max(0, ch.amp.revDb) / 8 : 1)} />
    </group>
  )
}
