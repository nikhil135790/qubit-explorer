import type { ReactNode } from 'react'
import { usePath, seg, STATIONS } from './state'
import { Tex } from '../ui/Tex'

/**
 * Side boxes that explain one step each. A box belongs to exactly one (station, beat) and is
 * gone the moment Next is pressed. Drawings are plain SVG so they stay crisp and quiet.
 */
const GOLD = '#f0c46e', BLUE = '#86b5e0', RED = '#ff6b72', PURPLE = '#c39bff', DIM = '#6b7280', INK = '#dfe5ea'

function Box({ title, children, note }: { title: string; children?: ReactNode; note: string }) {
  return (
    <aside className="p-dial">
      <h2>{title}</h2>
      {children}
      <p><Tex>{note}</Tex></p>
    </aside>
  )
}

/** Animation clock for the drawings, frozen while paused. */
const useT = () => usePath((s) => Math.floor(s.time * 30) / 30)

// ---------- reading the twist ----------
const R = 70
const tip = (d: number) => [R * Math.cos((d * Math.PI) / 180), -R * Math.sin((d * Math.PI) / 180)]
const hash = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const gauss = (i: number) => { const m = Math.sqrt(-2 * Math.log(Math.max(1e-6, hash(i)))), v = hash(i + 9173); return [m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)] }

function Dial({ k = 1, sig = 0, size = 200, tq = 0, legend = true }: { k?: number; sig?: number; size?: number; tq?: number; legend?: boolean }) {
  const qubit = usePath((s) => s.qubit)
  const me = (qubit === 1 ? 45 : -45) * k, other = -me
  const cMe = qubit === 1 ? GOLD : BLUE, cOther = qubit === 1 ? BLUE : GOLD
  const cloud = (deg: number, color: string, faint: boolean) => {
    const [cx, cy] = tip(deg)
    return Array.from({ length: 60 }, (_, i) => {
      const [gx, gy] = gauss(i * 31 + tq * 977 + (faint ? 5003 : 0))
      return <circle key={i} cx={cx + gx * sig * R} cy={cy + gy * sig * R} r={1.7} fill={color} opacity={faint ? 0.45 : 0.8} />
    })
  }
  const [mx, my] = tip(me), [ox, oy] = tip(other)
  return (
    <svg viewBox="-95 -100 230 200" width={size} height={size * 0.87} aria-hidden>
      <circle r={R} fill="none" stroke="#3a3d45" />
      <line x1={0} y1={0} x2={R + 16} y2={0} stroke={DIM} strokeDasharray="3 4" />
      {legend && <text x={R - 2} y={14} className="d-ref">untwisted copy</text>}
      {sig > 0 && cloud(other, cOther, true)}
      {sig > 0 && cloud(me, cMe, false)}
      <line x1={0} y1={0} x2={ox} y2={oy} stroke={cOther} strokeOpacity={0.35} strokeWidth={1.5} />
      <line x1={0} y1={0} x2={mx} y2={my} stroke={cMe} strokeWidth={2.5} />
      <circle r={3} fill={INK} />
      {legend && <>
        <text x={tip(45)[0] + 6} y={tip(45)[1] - 4} className="d-lbl" fill={GOLD}>1</text>
        <text x={tip(-45)[0] + 6} y={tip(-45)[1] + 14} className="d-lbl" fill={BLUE}>0</text>
      </>}
    </svg>
  )
}

function TwistBox() {
  // the arrow swings while the pulse passes the resonator
  const k = usePath((s) => seg(s.u, STATIONS[0].beats[5].u, STATIONS[0].beats[6].u - 0.04))
  return (
    <Box title="Reading the twist" note="We compare the returning pulse with an untwisted copy of the wave we sent in. Twisted up means the qubit is 1, twisted down means it is 0.">
      <Dial k={k} />
    </Box>
  )
}

function WhyAmplify() {
  const tq = usePath((s) => Math.floor(s.time * 6))
  return (
    <Box title="Why we need an amplifier" note="Each dot is one try at reading the twist. Our pulse is only a few photons, and the HEMT amplifier further up adds random jitter worth about a dozen photons, so the dots for 0 and 1 overlap and we would often guess wrong.">
      <Dial sig={0.72} tq={tq} />
    </Box>
  )
}

// ---------- the three-mode amplifier ----------
function TwoRoutes() {
  return (
    <Box title="Why the pulse splits" note="The Josephson ring couples the three modes to each other, with the pump supplying the energy. So from $a$ there are two ways to reach $b$, and the pulse takes both.">
      <svg viewBox="0 0 230 150" width="220" height="143" aria-hidden>
        <defs>
          <marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill={GOLD} /></marker>
        </defs>
        {[[30, 50, 'a'], [200, 50, 'b'], [115, 130, 'c']].map(([x, y, n]) => (
          <g key={n as string}><circle cx={x} cy={y} r={15} fill="#1b1d23" stroke={INK} /><text x={x as number} y={(y as number) + 5} textAnchor="middle" className="d-node">{n}</text></g>
        ))}
        <line x1={47} y1={50} x2={180} y2={50} stroke={GOLD} strokeWidth={2} markerEnd="url(#ah)" />
        <text x={115} y={40} textAnchor="middle" className="d-ref">straight across</text>
        <path d="M42,62 L100,118" stroke={GOLD} strokeWidth={2} strokeDasharray="5 4" fill="none" markerEnd="url(#ah)" />
        <path d="M130,118 L188,64" stroke={GOLD} strokeWidth={2} strokeDasharray="5 4" fill="none" markerEnd="url(#ah)" />
        <text x={50} y={110} className="d-ref">detour</text>
        <path d="M115,8 L115,30" stroke={PURPLE} strokeWidth={2} />
        <text x={122} y={20} className="d-ref" fill={PURPLE}>pump</text>
      </svg>
    </Box>
  )
}

const wave = (y0: number, amp: number, ph: number, w = 200) => {
  let d = ''
  for (let i = 0; i <= 60; i++) { const x = 10 + (w * i) / 60; d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + (y0 - amp * Math.sin((i / 60) * 4 * Math.PI - ph)).toFixed(1) }
  return d
}

function Waves({ inStep }: { inStep: boolean }) {
  const t = useT()
  const ph = t * 3
  const c = inStep ? GOLD : RED
  return (
    <svg viewBox="0 0 230 150" width="220" height="143" aria-hidden>
      <path d={wave(22, 9, ph)} stroke={c} strokeWidth={1.6} fill="none" opacity={0.8} />
      <text x={150} y={10} className="d-ref">straight</text>
      <path d={wave(56, 9, ph + (inStep ? 0 : Math.PI))} stroke={c} strokeWidth={1.6} fill="none" opacity={0.8} />
      <text x={150} y={44} className="d-ref">detour</text>
      <line x1={10} y1={80} x2={210} y2={80} stroke="#3a3d45" />
      <path d={wave(115, inStep ? 18 : 0, ph)} stroke={inStep ? GOLD : DIM} strokeWidth={2.4} fill="none" />
      <text x={10} y={146} className="d-ref">{inStep ? 'together, crest on crest' : 'together, crest on trough'}</text>
    </svg>
  )
}

function AddBox() {
  const tq = usePath((s) => Math.floor(s.time * 6))
  return (
    <Box title="Two routes, in step" note="The pump's phase is set so both copies reach $b$ in step, which makes one much bigger pulse. Now the HEMT's jitter is small next to it, and 0 and 1 are easy to tell apart.">
      <Waves inStep />
      <div className="d-pair">
        <figure><Dial sig={0.72} tq={tq} size={104} legend={false} /><figcaption>before</figcaption></figure>
        <figure><Dial sig={0.22} tq={tq} size={104} legend={false} /><figcaption>after</figcaption></figure>
      </div>
    </Box>
  )
}

function BackwardBox() {
  const t = useT()
  const y = (k: number) => 18 + ((t * 30 + k * 28) % 120)
  return (
    <Box title="What backward noise is" note="The HEMT boosts our pulse again, but its warm electronics also give off random microwaves in both directions. The part heading down is bad news, because random photons reaching the qubit's resonator scramble the qubit itself.">
      <svg viewBox="0 0 230 160" width="220" height="153" aria-hidden>
        {[['HEMT at 4 K', 14], ['Isolator', 54], ['Directional amp', 94], ['Qubit', 134]].map(([n, yy]) => (
          <g key={n as string}><rect x={70} y={yy as number} width={110} height={22} rx={3} fill="#1b1d23" stroke={n === 'HEMT at 4 K' ? RED : '#4a4e58'} /><text x={125} y={(yy as number) + 15} textAnchor="middle" className="d-ref" fill={INK}>{n}</text></g>
        ))}
        <line x1={40} y1={150} x2={40} y2={14} stroke={GOLD} strokeWidth={2} />
        <path d="M34,22 L40,10 L46,22 z" fill={GOLD} />
        <text x={8} y={88} className="d-ref" fill={GOLD} transform="rotate(-90 14 88)">our pulse</text>
        <line x1={205} y1={36} x2={205} y2={150} stroke={RED} strokeWidth={1.4} strokeDasharray="3 3" />
        {[0, 1, 2, 3].map((k) => <circle key={k} cx={205} cy={Math.min(150, y(k) + 20)} r={2.5} fill={RED} />)}
        <text x={212} y={100} className="d-ref" fill={RED} transform="rotate(90 212 100)">noise</text>
      </svg>
    </Box>
  )
}

function CancelBox() {
  return (
    <Box title="Two routes, out of step" note="For noise going backward, the two copies arrive at $a$ crest on trough and wipe each other out. The energy has to go somewhere, so it ends up in mode $c$ and its resistor.">
      <Waves inStep={false} />
    </Box>
  )
}

// ---------- the isolator ----------
function Roundabout() {
  const t = useT()
  // a dot circling the way the ferrite steers waves: 1 (left) to 2 (lower right) to 3 (upper right)
  const a = Math.PI - ((t * 1.2) % (2 * Math.PI))
  const ports: [number, string, string][] = [[180, '1', 'from the amplifier'], [60, '2', 'up to the HEMT'], [-60, '3', 'resistor']]
  return (
    <Box title="A one-way roundabout" note="The magnet makes the ferrite steer microwaves around one way only. Anything entering a port leaves by the next one, so 1 goes to 2 and 2 goes to 3.">
      <svg viewBox="-115 -85 230 170" width="220" height="163" aria-hidden>
        <circle r={42} fill="#1b1d23" stroke="#4a4e58" />
        {ports.map(([d, n, lbl]) => {
          const c = Math.cos((d * Math.PI) / 180), s = Math.sin((d * Math.PI) / 180)
          return (
            <g key={n}>
              <line x1={42 * c} y1={42 * s} x2={66 * c} y2={66 * s} stroke={INK} strokeWidth={2} />
              <circle cx={74 * c} cy={74 * s} r={9} fill="#1b1d23" stroke={INK} />
              <text x={74 * c} y={74 * s + 4} textAnchor="middle" className="d-node" style={{ fontSize: 11 }}>{n}</text>
              <text x={74 * c + (c < 0 ? -2 : -40)} y={74 * s + (s > 0 ? 22 : -14)} className="d-ref">{lbl}</text>
            </g>
          )
        })}
        <circle r={31} fill="none" stroke={GOLD} strokeOpacity={0.5} strokeWidth={1.4} strokeDasharray="4 4" />
        <circle cx={31 * Math.cos(a)} cy={-31 * Math.sin(a) * -1} r={4} fill={GOLD} />
      </svg>
    </Box>
  )
}

function ResistorBox() {
  return (
    <Box title="Where the noise goes" note="This is the same HEMT noise we saw at the amplifier, and it meets the isolator first because port 2 faces the HEMT. The resistor matches the line exactly, so the noise flows in without bouncing back and turns into a trace of heat on the coldest plate.">
      <svg viewBox="0 0 230 70" width="220" height="67" aria-hidden>
        <path d={(() => { let d = ''; for (let i = 0; i <= 80; i++) { const x = 8 + i * 1.6, A = 14 * Math.exp(-Math.max(0, x - 100) / 14); d += (i ? 'L' : 'M') + x + ',' + (35 - A * Math.sin(i * 0.55)) } return d })()} stroke={RED} strokeWidth={1.6} fill="none" />
        <rect x={140} y={22} width={60} height={26} rx={3} fill="#3b2a25" stroke="#7a5a50" />
        <text x={170} y={39} textAnchor="middle" className="d-ref" fill={INK}>50 Ω</text>
        <text x={140} y={64} className="d-ref">a little heat</text>
      </svg>
    </Box>
  )
}

const ASIDES: Record<string, () => ReactNode> = {
  '0-6': () => <TwistBox />,
  '1-1': () => <WhyAmplify />,
  '1-3': () => <TwoRoutes />,
  '1-4': () => <AddBox />,
  '1-5': () => <BackwardBox />,
  '1-6': () => <CancelBox />,
  '2-1': () => <Roundabout />,
  '2-3': () => <ResistorBox />,
}

export function Aside({ station, beat }: { station: number; beat: number }) {
  const make = ASIDES[`${station}-${beat}`]
  return make ? <>{make()}</> : null
}
