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

// ---------- reading the phase ----------
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
      {legend && <text x={R - 2} y={14} className="d-ref">reference</text>}
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
    <Box title="Reading the phase" note="We compare the returning pulse with a reference wave split off from the one we sent in. A phase $45^\circ$ ahead of the reference means the qubit is 1, and $45^\circ$ behind means it is 0.">
      <Dial k={k} />
    </Box>
  )
}

function WhyAmplify() {
  const tq = usePath((s) => Math.floor(s.time * 6))
  return (
    <Box title="Why we need an amplifier" note="Each dot is one try at measuring the phase. Our pulse is only a few photons, and the HEMT amplifier further up adds random jitter worth about a dozen photons, so the dots for 0 and 1 overlap and we would often guess wrong.">
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
    <Box title="A one-way roundabout" note="The magnet's field $B$ makes the ferrite steer microwaves around one way only. Anything entering a port leaves by the next one, so 1 goes to 2 and 2 goes to 3.">
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

// ---------- the HEMT ----------
/** One transistor, cut open: electrons stream from source to drain, and the gate squeezes the stream. */
function WhatHemt() {
  const t = useT()
  const g = (x: number) => Math.sin(x * 0.09 - t * 5) // the signal, travelling with the electrons
  // electrons in the sheet: denser where the gate let more through
  const dots = Array.from({ length: 46 }, (_, i) => {
    const x = 30 + ((i * 37 + t * 60) % 170)
    const keep = hash(i) < 0.55 + 0.4 * g(x)
    return keep ? <circle key={i} cx={x} cy={96 + (hash(i + 77) - 0.5) * 3} r={1.8} fill="#9fd3ff" /> : null
  })
  const wave = (x0: number, y0: number, amp: number, w: number) => { let d = ''; for (let i = 0; i <= 30; i++) { const x = x0 + (w * i) / 30; d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + (y0 - amp * Math.sin(i * 0.6 - t * 6)).toFixed(1) } return d }
  return (
    <Box title="Inside one transistor" note="Each of the three chips is one transistor with three contacts. Electrons stream from source to drain through a sheet only a few nanometers thick, and a tiny wave on the gate squeezes and opens that stream, so the current coming out carries a much bigger copy of the wave.">
      <svg viewBox="0 0 230 150" width="220" height="143" aria-hidden>
        <text x={4} y={78} className="d-ref">top layer</text>
        <rect x={10} y={82} width={210} height={12} fill="#2f323a" />
        <rect x={10} y={99} width={210} height={30} fill="#1d1f25" />
        <text x={4} y={142} className="d-ref">bottom layer</text>
        <line x1={10} y1={96.5} x2={220} y2={96.5} stroke="#9fd3ff" strokeOpacity={0.25} strokeWidth={5} />
        {dots}
        {([[12, 'source'], [96, 'gate'], [180, 'drain']] as const).map(([x, n]) => (
          <g key={n}><rect x={x} y={n === 'gate' ? 66 : 70} width={38} height={n === 'gate' ? 16 : 12} fill={GOLD} opacity={0.9} /><text x={x + 19} y={62} textAnchor="middle" className="d-ref">{n}</text></g>
        ))}
        <path d={wave(98, 40, 2.5, 34)} stroke={GOLD} strokeWidth={1.4} fill="none" />
        <text x={96} y={28} className="d-ref">small wave in</text>
        <path d={wave(180, 36, 10, 40)} stroke={GOLD} strokeWidth={2} fill="none" />
        <text x={168} y={16} className="d-ref">big copy out</text>
        <text x={60} y={118} className="d-ref" fill="#9fd3ff">electron sheet</text>
      </svg>
    </Box>
  )
}

/**
 * The order of amplifiers, shown as what comes out: our wave plus noise. Each amplifier adds its own
 * fixed amount of noise. Numbers from our model: pulse 4, quantum noise 0.5, directional amp gain 100
 * adding 0.5, HEMT adding 12, so the wave is 0.57x the noise (amplitude) with the HEMT alone and 1.9x
 * with the directional amplifier first.
 */
function QuietFirst() {
  const tq = usePath((s) => Math.floor(s.time * 12))
  const trace = (y0: number, sig: number, noise: number) => {
    let d = ''
    for (let i = 0; i <= 90; i++) {
      const x = 10 + i * 2.3
      const n = (hash(i * 13 + tq * 101) - 0.5) * 2 + (hash(i * 7 + tq * 37 + 5) - 0.5)
      d += (i ? 'L' : 'M') + x.toFixed(1) + ',' + (y0 - sig * Math.sin(i * 0.28) - noise * n).toFixed(1)
    }
    return d
  }
  const stage = (x: number, y: number, w: number, label: string, c: string) => (
    <g><rect x={x} y={y} width={w} height={18} rx={3} fill="#1b1d23" stroke={c} /><text x={x + w / 2} y={y + 12.5} textAnchor="middle" className="d-ref" fill={INK}>{label}</text></g>
  )
  return (
    <Box title="Why the order matters" note="Every amplifier adds its own noise. The HEMT adds a lot, so if our faint pulse reaches it first, the noise swamps it. The directional amplifier adds almost none, so putting it first makes the pulse 100 times stronger before the HEMT's noise joins in.">
      <svg viewBox="0 0 230 200" width="220" height="191" aria-hidden>
        <text x={10} y={10} className="d-ref" fill={INK}>HEMT alone</text>
        {stage(10, 16, 46, 'pulse', '#4a4e58')}
        <text x={60} y={29} className="d-ref">to</text>
        {stage(72, 16, 50, 'HEMT', RED)}
        <path d={trace(62, 6, 10)} stroke="#cfc8ba" strokeWidth={1.2} fill="none" />
        <text x={10} y={92} className="d-ref">our wave is lost in the noise</text>

        <text x={10} y={112} className="d-ref" fill={INK}>Directional amplifier first</text>
        {stage(10, 118, 46, 'pulse', '#4a4e58')}
        <text x={60} y={131} className="d-ref">to</text>
        {stage(72, 118, 84, 'directional amp', GOLD)}
        <text x={160} y={131} className="d-ref">to</text>
        {stage(172, 118, 50, 'HEMT', RED)}
        <path d={trace(168, 19, 6)} stroke={GOLD} strokeWidth={1.2} fill="none" />
        <text x={10} y={198} className="d-ref">our wave stands clear of it</text>
      </svg>
    </Box>
  )
}

// ---------- the screen ----------
function MixerBox() {
  const box = (x: number, y: number, w: number, label: string, c = '#4a4e58') => (
    <g><rect x={x} y={y} width={w} height={22} rx={3} fill="#1b1d23" stroke={c} /><text x={x + w / 2} y={y + 15} textAnchor="middle" className="d-ref" fill={INK}>{label}</text></g>
  )
  return (
    <Box title="What I and Q are" note="The returning wave is $A\cos(\omega t + \phi)$. The mixer multiplies it by the reference and by the reference delayed a quarter cycle, giving $I = A\cos\phi$, the part in step with the reference, and $Q = A\sin\phi$, the part a quarter cycle off. The phase $\phi$ is then the angle of the point $(I, Q)$.">
      <svg viewBox="0 0 230 150" width="220" height="143" aria-hidden>
        {box(8, 8, 100, 'generator')}
        {box(130, 8, 92, 'down to qubit', '#6b7280')}
        <line x1={108} y1={19} x2={130} y2={19} stroke={GOLD} strokeWidth={1.6} />
        <line x1={58} y1={30} x2={58} y2={74} stroke={GOLD} strokeWidth={1.6} strokeDasharray="4 3" />
        <text x={62} y={56} className="d-ref">reference</text>
        {box(130, 48, 92, 'back, phase shifted', '#6b7280')}
        <line x1={176} y1={70} x2={176} y2={78} stroke={GOLD} strokeWidth={1.6} />
        <path d="M58,74 L58,90 L110,90" stroke={GOLD} strokeWidth={1.6} fill="none" strokeDasharray="4 3" />
        <path d="M176,78 L176,90 L150,90" stroke={GOLD} strokeWidth={1.6} fill="none" />
        {box(110, 80, 40, 'mixer', GOLD)}
        <line x1={130} y1={102} x2={130} y2={116} stroke={INK} />
        {box(80, 116, 100, 'I and Q')}
      </svg>
      <svg viewBox="0 0 230 120" width="220" height="115" aria-hidden>
        <line x1={20} y1={100} x2={210} y2={100} stroke={DIM} />
        <line x1={40} y1={115} x2={40} y2={8} stroke={DIM} />
        <text x={200} y={114} className="d-ref">I</text>
        <text x={46} y={14} className="d-ref">Q</text>
        <line x1={40} y1={100} x2={140} y2={34} stroke={GOLD} strokeWidth={2} />
        <circle cx={140} cy={34} r={4} fill={GOLD} />
        <line x1={140} y1={34} x2={140} y2={100} stroke={GOLD} strokeDasharray="3 3" strokeOpacity={0.6} />
        <line x1={140} y1={34} x2={40} y2={34} stroke={GOLD} strokeDasharray="3 3" strokeOpacity={0.6} />
        <text x={132} y={114} className="d-ref" fill={GOLD}>I</text>
        <text x={26} y={38} className="d-ref" fill={GOLD}>Q</text>
        <path d="M70,100 A30,30 0 0 0 65,84" stroke={INK} fill="none" />
        <text x={74} y={92} className="d-ref" fill={INK}>phase</text>
        <text x={146} y={30} className="d-ref" fill={INK}>(I, Q)</text>
      </svg>
    </Box>
  )
}

function WithWithout() {
  const withAmp = usePath((s) => s.withAmp)
  const set = usePath((s) => s.set)
  return (
    <Box title="Try it without the amplifier" note={withAmp
      ? 'With the directional amplifier first in line, the clouds sit far apart and 99.7% of 0.4 microsecond readings are right.'
      : 'Without it, the HEMT\'s noise blurs the clouds into each other, and the same measurement is right only 86.6% of the time.'}>
      <div className="d-toggle">
        <button className={withAmp ? 'on' : ''} onClick={() => set({ withAmp: true })}>With directional amplifier</button>
        <button className={!withAmp ? 'on' : ''} onClick={() => set({ withAmp: false })}>Without</button>
      </div>
    </Box>
  )
}

const ASIDES: Record<string, () => ReactNode> = {
  '4-1': () => <MixerBox />,
  '4-3': () => <WithWithout />,
  '3-1': () => <WhatHemt />,
  '3-3': () => <QuietFirst />,
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
