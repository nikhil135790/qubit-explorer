import { useMemo } from 'react'
import { useBench, X_QUBIT, X_SCREEN, PULSE_SPEED } from './state'
import type { Shot } from './state'
import { PARTS, MAX_SLOTS, QUBIT, evaluate } from './parts'
import type { PartId } from './parts'
import { fidelity } from '../physics/readout'

const SETUPS: [string, PartId[]][] = [
  ['Nothing', []],
  ['Standard lab', ['circ', 'jpa', 'circ', 'iso']],
  ['TWPA', ['twpa', 'iso', 'iso']],
  ['Directional amp', ['dir', 'iso']],
]

function gauss() { let u = 0; while (u === 0) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()) }

/** Draw one measurement outcome in units of the noise width, including T1 decay during the readout. */
function sample(chain: PartId[], prepared: 0 | 1): Shot {
  const r = evaluate(chain)
  const snr = fidelity({ ...QUBIT, eta: r.eta }, r.tau, 60).snr
  let mean = prepared === 0 ? -snr / 2 : snr / 2
  if (prepared === 1 && Math.random() < 1 - Math.exp(-r.tau / QUBIT.T1)) mean = -snr / 2 + Math.random() * snr // decayed mid-readout
  const x = mean + gauss(), y = gauss()
  return { x, y, prepared, read: x > 0 ? 1 : 0 }
}

export function BenchUI() {
  const { chain, qubit, set, add, setChain } = useBench()
  const res = useMemo(() => evaluate(chain), [chain])
  const travel = ((X_SCREEN - 2.2 - X_QUBIT) / PULSE_SPEED) * 1000
  const measure = (n: number) => {
    set({ firedAt: performance.now() / 1000 })
    setTimeout(() => {
      const st = useBench.getState()
      const extra = Array.from({ length: n - 1 }, () => sample(st.chain, Math.random() < 0.5 ? 0 : 1))
      const one = sample(st.chain, st.qubit)
      st.set({ shots: [...st.shots, ...extra, one].slice(-600), last: one })
    }, travel)
  }
  return (
    <div className="bench-ui">
      <header className="b-head">
        <h1>Readout bench</h1>
        <p>Build the line between a qubit and your screen. Then measure it.</p>
      </header>

      <div className="b-setups">
        <span>Try</span>
        {SETUPS.map(([n, c]) => <button key={n} onClick={() => setChain(c)}>{n}</button>)}
      </div>

      {res.warnings[0] && <div className="b-warn">{res.warnings[0]}</div>}

      <div className="b-bottom">
        <div className="b-tray">
          {(Object.keys(PARTS) as PartId[]).map((id) => (
            <button key={id} onClick={() => add(id)} disabled={chain.length >= MAX_SLOTS} title={PARTS[id].line}>
              <i style={{ background: PARTS[id].color }} />
              <b>{PARTS[id].name}</b>
              <small>{PARTS[id].line}</small>
            </button>
          ))}
        </div>
        <div className="b-run">
          <div className="b-state">
            <span>Prepare</span>
            <button className={qubit === 0 ? 'on' : ''} onClick={() => set({ qubit: 0 })}>|0⟩</button>
            <button className={qubit === 1 ? 'on' : ''} onClick={() => set({ qubit: 1 })}>|1⟩</button>
          </div>
          <button className="b-go" onClick={() => measure(1)}>Measure</button>
          <button className="b-go alt" onClick={() => measure(100)}>Measure ×100</button>
        </div>
      </div>
    </div>
  )
}
