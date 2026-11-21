import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { LEVELS, ORDER } from '../levels'
import type { LevelId } from '../levels'
import { AmpControls, ReadoutConsequences, ChipReadout, TransmonLevels } from './Panels'

// Real characteristic size of each level, in meters, for the log-scale ruler
const SIZE_M: Record<LevelId, number> = { fridge: 1.5, mxc: 0.1, amp: 5e-3, chip: 5e-3, transmon: 5e-4, junction: 2e-7 }
const DECADES = [
  [1, '1 m'], [1e-1, '10 cm'], [1e-2, '1 cm'], [1e-3, '1 mm'], [1e-4, '100 µm'], [1e-5, '10 µm'], [1e-6, '1 µm'], [1e-7, '100 nm'],
] as const
const TOP = Math.log10(3), BOT = Math.log10(5e-8)
const yPct = (m: number) => ((TOP - Math.log10(m)) / (TOP - BOT)) * 100

function Ruler() {
  const { level, phase, goTo } = useStore()
  // levels sharing a size (amp and chip are both ~5 mm) sit side by side
  const groups = new Map<number, LevelId[]>()
  ORDER.forEach((id) => groups.set(SIZE_M[id], [...(groups.get(SIZE_M[id]) ?? []), id]))
  return (
    <nav className="ruler" aria-label="Zoom level, on a logarithmic size scale">
      <div className="spine" />
      {DECADES.map(([m, t]) => (
        <div key={t} className="tick" style={{ top: yPct(m) + '%' }}><span>{t}</span></div>
      ))}
      {[...groups.entries()].map(([m, ids]) => (
        <div key={m} className="stops" style={{ top: yPct(m) + '%' }}>
          {ids.map((id) => (
            <button key={id} className={id === level ? 'on' : ''} onClick={() => goTo(id)} disabled={phase !== 'idle'}>
              {LEVELS[id].short}
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}

export function Overlay() {
  const { level, phase, history, goTo, back, scaleLabel, scalePx } = useStore()
  const L = LEVELS[level]
  return (
    <>
      <div className={'fade ' + (phase === 'out' ? 'on' : '')} />

      <header className="masthead">
        <h1>Down the readout line</h1>
        <p>How a superconducting qubit gets measured, from a 1.5 m refrigerator to a 200 nm junction. Every level is drawn to scale.</p>
      </header>

      <Ruler />

      <aside className="panel">
        <AnimatePresence mode="wait">
          <motion.div key={level} className="panel-inner"
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}>
            <div className="lcd-strip">
              <span>{L.size}</span><span>{L.temp}</span>
              {history.length > 0 && (
                <button className="back" onClick={back} disabled={phase !== 'idle'}>Zoom out to {LEVELS[history[history.length - 1]].short.toLowerCase()}</button>
              )}
            </div>
            <h2>{L.name}</h2>
            <p className="lede">{L.intro}</p>
            {level === 'amp' && <AmpControls />}
            {(level === 'fridge' || level === 'mxc' || level === 'amp') && <ReadoutConsequences compact={level !== 'mxc'} />}
            {level === 'chip' && <ChipReadout />}
            {level === 'transmon' && <TransmonLevels />}
            <div className="prose">{L.body.map((p, i) => <p key={i}>{p}</p>)}</div>
            <table className="facts"><tbody>{L.facts.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
            {L.note && <p className="note">{L.note}</p>}
            {L.children.length > 0 && (
              <div className="keys big">
                {L.children.map((c) => (
                  <button key={c.to + c.label} onClick={() => goTo(c.to, c.pos)} disabled={phase !== 'idle'}>Zoom into the {c.label.toLowerCase()}</button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </aside>

      <footer className="status">
        <div className="scale"><div className="bar" style={{ width: scalePx }} /><span>{scaleLabel}</span></div>
        <span className="hint">Drag to orbit. Scroll to zoom. Click a ring to go deeper.</span>
      </footer>
    </>
  )
}
