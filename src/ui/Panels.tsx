import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { summarize, KAPPA_MHZ } from '../physics/dirAmp'
import { useChain, READOUT } from '../physics/useChain'
import { TWO_PI } from '../physics/readout'
import { Plot } from './Plot'

const pct = (x: number) => (x * 100).toFixed(x > 0.999 ? 2 : 1) + '%'
const fmtUs = (t: number) => (t >= 10 ? t.toFixed(0) : t >= 1 ? t.toFixed(1) : t.toFixed(2)) + ' µs'

function Stat({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className={'stat ' + (tone ?? '')}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {sub && <div className="d">{sub}</div>}
    </div>
  )
}

export function AmpControls() {
  const { phi, s, set } = useStore()
  const amp = useMemo(() => summarize({ phi, s }), [phi, s])
  const curve = useMemo(() => {
    const x: number[] = [], f: number[] = [], r: number[] = []
    for (let i = 0; i <= 80; i++) {
      const w = -3 + (6 * i) / 80
      const sm = summarize({ phi, s }, w)
      x.push(w * KAPPA_MHZ); f.push(sm.fwdDb); r.push(sm.revDb)
    }
    return { x, f, r }
  }, [phi, s])
  const presets: [string, number, number][] = [
    ['Design point', -Math.PI / 2, 1],
    ['Break interference (φ = 0)', 0, 0.9],
    ['Flip direction (φ = +π/2)', Math.PI / 2, 1],
    ['Overdrive the pump', -Math.PI / 2, 1.2],
  ]
  return (
    <div className="block">
      <h3>Run the amplifier</h3>
      <div className="presets">
        {presets.map(([n, p, ss]) => (
          <button key={n} className={Math.abs(phi - p) < 1e-3 && Math.abs(s - ss) < 1e-3 ? 'on' : ''} onClick={() => set({ phi: p, s: ss })}>{n}</button>
        ))}
      </div>
      <label className="ctl">
        <span>Pump phase φ <b>{(phi / Math.PI).toFixed(2)}π</b></span>
        <input type="range" min={-Math.PI} max={Math.PI} step={0.01} value={phi} onChange={(e) => set({ phi: +e.target.value })} />
      </label>
      <label className="ctl">
        <span>Gain pump strength <b>{(s * 100).toFixed(0)}%</b></span>
        <input type="range" min={0} max={1.25} step={0.005} value={s} onChange={(e) => set({ s: +e.target.value })} />
      </label>
      {!amp.stable ? (
        <div className="warn">Unstable: the pump is strong enough that the amplifier oscillates on its own. Its output is no longer an amplified copy of the input.</div>
      ) : null}
      <div className="stats">
        <Stat k="Forward gain a → b" v={amp.stable ? amp.fwdDb.toFixed(1) + ' dB' : '—'} tone={amp.stable && amp.fwdDb > 15 ? 'good' : undefined} />
        <Stat k="Reverse b → a" v={amp.stable ? amp.revDb.toFixed(1) + ' dB' : '—'} tone={amp.stable && amp.revDb < -30 ? 'good' : amp.revDb > -10 ? 'bad' : 'warn'} sub={amp.revDb < 0 ? 'isolation' : 'amplifying backward!'} />
        <Stat k="Added noise" v={amp.stable && amp.fwdDb > 3 ? amp.nAdd.toFixed(3) : '—'} sub="photons (limit 0.5)" />
      </div>
      {amp.stable && (
        <Plot xLabel="detuning from mode center (MHz)" yLabel="gain (dB)" yMin={-60} yMax={30} yTicks={3}
          series={[{ x: curve.x, y: curve.f, color: '#f2d32b', label: 'forward a → b' }, { x: curve.x, y: curve.r, color: '#e35bd0', label: 'reverse b → a' }]}
          hLines={[{ y: 0, label: '0 dB', color: '#4b5d6c' }]} />
      )}
    </div>
  )
}

export function ReadoutConsequences({ compact }: { compact?: boolean }) {
  const ch = useChain()
  const { outputIsolator, set } = useStore()
  const t2tone = ch.t2 > 0.9 * 2 * READOUT.T1 ? 'good' : ch.t2 > 0.5 * 2 * READOUT.T1 ? 'warn' : 'bad'
  return (
    <div className="block">
      <h3>What this does to the qubit</h3>
      {!compact && <p className="muted">The amplifier settings feed a validated readout model: a transmon read out through a 7 GHz resonator (κ/2π = 4 MHz, χ/2π = 2 MHz, T₁ = 50 µs), then the HEMT at 4 K. Backward noise from the HEMT is 10 photons before isolation.</p>}
      <div className="stats">
        <Stat k="Best readout fidelity" v={ch.ok ? pct(ch.best.F) : 'fails'} sub={ch.ok ? `in ${ch.best.tau.toFixed(2)} µs` : 'amp unstable'} tone={ch.ok && ch.best.F > 0.99 ? 'good' : 'bad'} />
        <Stat k="Qubit T₂" v={fmtUs(ch.t2)} sub={`limit 2T₁ = ${2 * READOUT.T1} µs`} tone={t2tone} />
        <Stat k="Total isolation" v={ch.isoDb.toFixed(0) + ' dB'} sub={`${ch.nBack.toExponential(1)} photons leak back`} />
      </div>
      <label className="check"><input type="checkbox" checked={outputIsolator} onChange={(e) => set({ outputIsolator: e.target.checked })} /> Add one ferrite isolator on the output (+20 dB, costs space and a magnet)</label>
      {!compact && (
        <p className="muted small">For comparison, a JPA behind three circulators gives {pct(ch.base.best.F)} fidelity, T₂ ≈ {fmtUs(ch.base.t2)}, efficiency η = {ch.base.eta.toFixed(2)} (vs {ch.eta.toFixed(2)} here, because no circulators sit between the qubit and the first amplifier).</p>
      )}
    </div>
  )
}

export function ChipReadout() {
  const [state, setState] = useState<0 | 1>(0)
  const kappa = 4, chi = 2 // MHz
  const data = useMemo(() => {
    const x: number[] = [], y0: number[] = [], y1: number[] = []
    for (let i = 0; i <= 200; i++) {
      const d = -12 + (24 * i) / 200
      const s21 = (det: number) => { const a = 2 * det / kappa; return Math.sqrt(a * a / (1 + a * a)) } // hanger, overcoupled
      x.push(d); y0.push(s21(d + chi)); y1.push(s21(d - chi))
    }
    return { x, y0, y1 }
  }, [])
  return (
    <div className="block">
      <h3>Dispersive readout</h3>
      <p className="muted">Transmission past one readout resonator. The qubit state shifts the resonator dip by ±χ. A probe tone at the midpoint picks up a different phase and amplitude depending on the state.</p>
      <div className="presets">
        <button className={state === 0 ? 'on' : ''} onClick={() => setState(0)}>qubit in |0⟩</button>
        <button className={state === 1 ? 'on' : ''} onClick={() => setState(1)}>qubit in |1⟩</button>
      </div>
      <Plot xLabel="probe frequency − 7 GHz (MHz)" yLabel="|S21|" yMin={0} yMax={1} yTicks={4}
        series={[
          { x: data.x, y: data.y0, color: state === 0 ? '#35cfe0' : '#1d4f57', label: '|0⟩ (ω_r − χ)' },
          { x: data.x, y: data.y1, color: state === 1 ? '#f2d32b' : '#5a5120', label: '|1⟩ (ω_r + χ)' },
        ]}
        marks={[{ x: 0, label: 'probe' }]} />
      <p className="muted small">κ/2π = {kappa} MHz, χ/2π = {chi} MHz. Setting 2χ = κ maximizes the signal per photon. These are the same numbers the readout model on the amplifier levels uses ({(READOUT.kappa / TWO_PI).toFixed(0)} MHz, {(READOUT.chi / TWO_PI).toFixed(0)} MHz).</p>
    </div>
  )
}

export function TransmonLevels() {
  const [ratio, setRatio] = useState(50)
  const Ec = 0.25 // GHz
  const Ej = ratio * Ec
  // perturbative transmon levels (Koch et al. 2007): E_n = -Ej + sqrt(8 Ej Ec)(n + 1/2) - Ec/12 (6n^2 + 6n + 3)
  const E = (n: number) => -Ej + Math.sqrt(8 * Ej * Ec) * (n + 0.5) - (Ec / 12) * (6 * n * n + 6 * n + 3)
  const f01 = E(1) - E(0), f12 = E(2) - E(1)
  const wp = Math.sqrt(8 * Ej * Ec)
  const levels = [0, 1, 2, 3].map((n) => E(n) - E(0))
  const harm = [0, 1, 2, 3].map((n) => n * wp)
  const top = Math.max(...harm) * 1.05
  return (
    <div className="block">
      <h3>Why it is a qubit</h3>
      <label className="ctl">
        <span>E_J / E_C <b>{ratio}</b></span>
        <input type="range" min={20} max={120} step={1} value={ratio} onChange={(e) => setRatio(+e.target.value)} />
      </label>
      <svg viewBox="0 0 300 170" className="levels">
        <text x="70" y="166" textAnchor="middle">harmonic LC</text>
        <text x="220" y="166" textAnchor="middle">transmon</text>
        {harm.map((h, i) => <line key={'h' + i} x1="30" x2="110" y1={150 - (h / top) * 140} y2={150 - (h / top) * 140} stroke="#4b5d6c" strokeWidth="2" />)}
        {levels.map((h, i) => (
          <g key={'t' + i}>
            <line x1="180" x2="260" y1={150 - (h / top) * 140} y2={150 - (h / top) * 140} stroke={i < 2 ? '#35cfe0' : '#7f8e9a'} strokeWidth="2" />
            <text x="266" y={154 - (h / top) * 140} fill="#7f8e9a" fontSize="10">|{i}⟩</text>
          </g>
        ))}
      </svg>
      <div className="stats">
        <Stat k="f₀₁" v={f01.toFixed(2) + ' GHz'} />
        <Stat k="Anharmonicity f₁₂ − f₀₁" v={((f12 - f01) * 1000).toFixed(0) + ' MHz'} />
        <Stat k="Charge dispersion" v={'∝ e^(−√(8E_J/E_C))'} sub={`≈ ${Math.exp(-Math.sqrt(8 * ratio)).toExponential(1)}`} />
      </div>
      <p className="muted small">E_C/h = 250 MHz. Raising E_J/E_C makes the qubit exponentially less sensitive to charge noise, while the anharmonicity stays near −E_C.</p>
    </div>
  )
}
