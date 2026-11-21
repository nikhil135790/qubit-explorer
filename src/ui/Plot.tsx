import { useEffect, useRef } from 'react'

export type Series = { x: number[]; y: number[]; color: string; label: string; dash?: boolean }

/** Small dependency-free line plot on a canvas. */
export function Plot({ series, xLabel, yLabel, yMin, yMax, height = 170, marks = [], hLines = [], yTicks = 4 }: {
  series: Series[]; xLabel: string; yLabel: string; yMin: number; yMax: number; height?: number
  marks?: { x: number; label: string }[]; hLines?: { y: number; label: string; color: string }[]; yTicks?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth, h = height
    cv.width = w * dpr; cv.height = h * dpr
    const g = cv.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    const L = 40, R = 8, T = 8, B = 30
    const xs = series.flatMap((s) => s.x)
    const x0 = Math.min(...xs), x1 = Math.max(...xs)
    const X = (x: number) => L + ((x - x0) / (x1 - x0)) * (w - L - R)
    const Y = (y: number) => T + (1 - (Math.min(yMax, Math.max(yMin, y)) - yMin) / (yMax - yMin)) * (h - T - B)
    g.font = '10px system-ui'; g.strokeStyle = '#2b3242'; g.fillStyle = '#8b93a7'; g.lineWidth = 1
    const ny = yTicks
    for (let i = 0; i <= ny; i++) {
      const v = yMin + (i * (yMax - yMin)) / ny
      g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(w - R, Y(v)); g.stroke()
      g.textAlign = 'right'; g.fillText(String(+v.toFixed(1)), L - 4, Y(v) + 3)
    }
    for (let i = 0; i <= 4; i++) {
      const v = x0 + (i * (x1 - x0)) / 4
      g.textAlign = 'center'; g.fillText(String(+v.toFixed(0)), X(v), h - B + 13)
    }
    g.fillText(xLabel, (L + w - R) / 2, h - 4)
    g.save(); g.translate(10, (T + h - B) / 2); g.rotate(-Math.PI / 2); g.fillText(yLabel, 0, 0); g.restore()
    for (const hl of hLines) {
      g.strokeStyle = hl.color; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(L, Y(hl.y)); g.lineTo(w - R, Y(hl.y)); g.stroke(); g.setLineDash([])
      g.fillStyle = hl.color; g.textAlign = 'right'; g.fillText(hl.label, w - R - 2, Y(hl.y) - 3)
    }
    for (const m of marks) {
      g.strokeStyle = '#5b6478'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(X(m.x), T); g.lineTo(X(m.x), h - B); g.stroke(); g.setLineDash([])
      g.fillStyle = '#8b93a7'; g.textAlign = 'left'; g.fillText(m.label, X(m.x) + 3, T + 10)
    }
    for (const s of series) {
      g.strokeStyle = s.color; g.lineWidth = 2; g.setLineDash(s.dash ? [5, 4] : [])
      g.beginPath()
      s.x.forEach((x, i) => (i ? g.lineTo(X(x), Y(s.y[i])) : g.moveTo(X(x), Y(s.y[i]))))
      g.stroke()
    }
    g.setLineDash([])
  })
  return (
    <div>
      <div className="legend">{series.map((s) => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}</div>
      <canvas ref={ref} style={{ width: '100%', height }} />
    </div>
  )
}
