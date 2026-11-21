import { useEffect, useMemo, useRef } from 'react'
import { Html, RoundedBox } from '@react-three/drei'
import { useBench } from './state'
import { evaluate } from './parts'

/** The scientist's screen: IQ scatter of every shot so far, plus the verdict for the latest one. */
export function Monitor({ x }: { x: number }) {
  const { chain, shots, last } = useBench()
  const res = useMemo(() => evaluate(chain), [chain])
  const cv = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = cv.current
    if (!c) return
    const g = c.getContext('2d')!
    const W = c.width, H = c.height
    g.fillStyle = '#0b1310'; g.fillRect(0, 0, W, H)
    g.strokeStyle = '#173126'; g.lineWidth = 1
    for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo((i * W) / 8, 0); g.lineTo((i * W) / 8, H); g.stroke() }
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, (i * H) / 6); g.lineTo(W, (i * H) / 6); g.stroke() }
    g.strokeStyle = '#2f5a45'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); g.setLineDash([])
    const span = Math.max(4, ...shots.map((s) => Math.abs(s.x) + 3))
    const X = (v: number) => W / 2 + (v / span) * (W / 2), Y = (v: number) => H / 2 - (v / span) * (W / 2)
    for (const s of shots) {
      g.fillStyle = s.prepared === 0 ? 'rgba(110, 200, 255, 0.7)' : 'rgba(255, 196, 92, 0.7)'
      g.beginPath(); g.arc(X(s.x), Y(s.y), 2.4, 0, 7); g.fill()
    }
    if (last) { g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.arc(X(last.x), Y(last.y), 7, 0, 7); g.stroke() }
    g.fillStyle = '#4f8f6f'; g.font = '13px "IBM Plex Mono", monospace'
    g.fillText('reads as 0', 10, H - 10); g.textAlign = 'right'; g.fillText('reads as 1', W - 10, H - 10)
  }, [shots, last])
  const right = last ? last.read === last.prepared : null
  return (
    <group position={[x, 2.6, -0.4]}>
      <RoundedBox args={[7.4, 4.9, 0.3]} radius={0.12}><meshStandardMaterial color="#1c1d21" metalness={0.4} roughness={0.5} /></RoundedBox>
      <mesh position={[0, -2.6, 0]}><boxGeometry args={[0.5, 1.2, 0.4]} /><meshStandardMaterial color="#1c1d21" /></mesh>
      <mesh position={[0, -3.2, 0.3]}><boxGeometry args={[2.2, 0.1, 1.4]} /><meshStandardMaterial color="#1c1d21" /></mesh>
      <Html transform position={[0, 0, 0.16]} distanceFactor={5.2} className="screen">
        <div className="scr">
          <div className="scr-top">
            <span>IQ plane · {shots.length} shots</span>
            <span className={right === null ? '' : right ? 'ok' : 'bad'}>
              {last ? `read |${last.read}⟩ ${right ? '✓' : '✗ wrong'}` : 'press Measure'}
            </span>
          </div>
          <canvas ref={cv} width={560} height={300} />
          <div className="scr-stats">
            <span>fidelity <b>{(res.fidelity * 100).toFixed(1)}%</b></span>
            <span>readout <b>{res.tau.toFixed(2)} µs</b></span>
            <span>T₂ <b className={res.t2 < 50 ? 'bad' : res.t2 < 90 ? 'warn' : 'ok'}>{res.t2 < 1 ? res.t2.toFixed(2) : res.t2.toFixed(0)} µs</b></span>
          </div>
        </div>
      </Html>
    </group>
  )
}
