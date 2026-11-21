import { usePath, seg, STATIONS } from './state'

/**
 * What the pulse is for. The readout is the pulse's twist relative to an untwisted reference:
 * up (+45°) means |1⟩, down (−45°) means |0⟩. Each dot is one simulated measurement, so the cloud
 * shows how much noise the rest of the chain adds compared with the pulse at this point.
 * Numbers: HEMT adds about 12 photons of noise; with the directional amplifier's 20 dB of gain in
 * front, that becomes 0.12, on top of the unavoidable 0.5 + 0.5. Spread ratio sqrt(12.5 / 1.12) ≈ 3.3.
 */
const R = 74
const N = 70
const SIG_BEFORE = 0.72, SIG_AFTER = 0.22

// deterministic gaussian pairs (Box-Muller on a hash), so the cloud freezes when paused
const h = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const gauss = (i: number) => {
  const u = Math.max(1e-6, h(i)), v = h(i + 9173)
  const m = Math.sqrt(-2 * Math.log(u))
  return [m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)]
}

function Cloud({ deg, sig, tq, color, faint }: { deg: number; sig: number; tq: number; color: string; faint?: boolean }) {
  const cx = R * Math.cos((deg * Math.PI) / 180), cy = -R * Math.sin((deg * Math.PI) / 180)
  return (
    <g>
      {Array.from({ length: N }, (_, i) => {
        const [gx, gy] = gauss(i * 31 + tq * 977 + (faint ? 5003 : 0))
        return <circle key={i} cx={cx + gx * sig * R} cy={cy + gy * sig * R} r={1.7} fill={color} opacity={faint ? 0.28 : 0.75} />
      })}
    </g>
  )
}

export function TwistDial() {
  const { station, beat, u, qubit, time } = usePath()
  // shown from the moment the pulse passes the resonator onward
  const twistBeat = 6
  if (station === 0 && beat < twistBeat) return null
  if (station > 2) return null
  const tq = Math.floor(time * 6)

  // how far the twist has happened (it grows while the pulse passes the resonator)
  const k = station === 0 && beat === twistBeat ? seg(u, STATIONS[0].beats[twistBeat - 1].u, STATIONS[0].beats[twistBeat].u - 0.04) : 1
  // noise relative to the pulse: large until the amplifier's two routes add up, small afterwards
  const sig = station === 0 ? SIG_BEFORE : station === 1 ? SIG_BEFORE - (SIG_BEFORE - SIG_AFTER) * seg(u, 0.5, 0.62) : SIG_AFTER
  const me = qubit === 1 ? 45 * k : -45 * k
  const other = -me

  const note = station === 2
    ? 'The isolator leaves the twist as it is and keeps backward noise away from the qubit.'
    : sig > 0.5
      ? 'Each dot is one measurement, and with only a few photons in the pulse, the noise added later in the fridge blurs the two twists together.'
      : 'With 100 times more power, that later noise is small by comparison, so the two twists are easy to tell apart.'

  const tip = (d: number) => [R * Math.cos((d * Math.PI) / 180), -R * Math.sin((d * Math.PI) / 180)]
  const [mx, my] = tip(me)
  const [ox, oy] = tip(other)
  const gold = '#f0c46e', blue = '#86b5e0'
  return (
    <aside className="p-dial">
      <h2>Reading the twist</h2>
      <svg viewBox="-100 -110 240 220" width="220" height="200" aria-label="Pulse twist and measurement noise">
        <circle r={R} fill="none" stroke="#3a3d45" strokeWidth={1} />
        <line x1={0} y1={0} x2={R + 18} y2={0} stroke="#6b7280" strokeDasharray="3 4" />
        <text x={R + 4} y={14} className="d-ref">no twist</text>
        <Cloud deg={other} sig={sig} tq={tq} color={qubit === 1 ? blue : gold} faint />
        <Cloud deg={me} sig={sig} tq={tq} color={qubit === 1 ? gold : blue} />
        <line x1={0} y1={0} x2={ox} y2={oy} stroke={qubit === 1 ? blue : gold} strokeOpacity={0.35} strokeWidth={1.5} />
        <line x1={0} y1={0} x2={mx} y2={my} stroke={qubit === 1 ? gold : blue} strokeWidth={2.5} />
        <circle r={3} fill="#dfe5ea" />
        <text x={tip(45)[0] - 8} y={tip(45)[1] - 12} className="d-lbl" fill={gold}>|1⟩ +45°</text>
        <text x={tip(-45)[0] - 8} y={tip(-45)[1] + 22} className="d-lbl" fill={blue}>|0⟩ −45°</text>
      </svg>
      <p>{note}</p>
    </aside>
  )
}
