import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { LEVELS, ORDER } from '../levels'
import type { LevelId } from '../levels'
import { Tex } from './Tex'
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

// Story order for the guided tour: down to the junction, then back to the device that reads the qubit out
const TOUR: LevelId[] = ['fridge', 'mxc', 'chip', 'transmon', 'junction', 'amp']
const TOUR_WHY: Record<LevelId, string> = {
  fridge: 'Next, the coldest plate, where the qubit and its amplifier are mounted.',
  mxc: 'Next, open the qubit package to see the chip.',
  chip: 'Next, zoom into one qubit.',
  transmon: 'Next, the junction that makes this circuit a qubit.',
  junction: 'The same junction is the active element in a quantum amplifier. Next, see one at work.',
  amp: '',
}

function Intro({ onClose }: { onClose: () => void }) {
  const goTo = useStore((s) => s.goTo)
  return (
    <div className="intro-wrap">
      <div className="intro">
        <h1>Down the readout line</h1>
        <p><Tex>{'A superconducting quantum computer stores information in small electrical circuits cooled to about 10 mK. Each circuit is a qubit: it can be in $|0\\rangle$, $|1\\rangle$, or a superposition of both.'}</Tex></p>
        <p><Tex>{'Running a calculation means steering those states with microwave pulses and then measuring them. Measuring is the hard part. The signal from one qubit is a few microwave photons, and it has to be amplified about $10^{10}$ times on its way out of the fridge without disturbing the qubit.'}</Tex></p>
        <p>This app follows that signal. You start at the full refrigerator and zoom down to a single Josephson junction, the part that makes both qubits and quantum amplifiers work. Then you get to run a directional amplifier, the device that lets the signal out while keeping noise from getting back in.</p>
        <p className="how">Drag to orbit, scroll to zoom, and click a yellow ring to go deeper. The ruler on the left shows the real size of each level.</p>
        <div className="keys">
          <button className="primary" onClick={() => { onClose(); goTo('fridge') }}>Start the tour</button>
          <button onClick={onClose}>Explore on my own</button>
        </div>
      </div>
    </div>
  )
}

export function Overlay() {
  const [intro, setIntro] = useState(true)
  const { level, phase, history, goTo, back, scaleLabel, scalePx } = useStore()
  const L = LEVELS[level]
  return (
    <>
      <div className={'fade ' + (phase === 'out' ? 'on' : '')} />

      <header className="masthead">
        <h1>Down the readout line</h1>
        <p>How a superconducting qubit gets measured, from the refrigerator down to a single junction. Each level is drawn to scale.</p>
      </header>

      <Ruler />

      <aside className="panel">
        <AnimatePresence mode="wait">
          <motion.div key={level} className="panel-inner"
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}>
            <div className="lcd-strip">
              <span>{L.size}</span>
              {history.length > 0 && (
                <button className="back" onClick={back} disabled={phase !== 'idle'}>Zoom out to {LEVELS[history[history.length - 1]].short.toLowerCase()}</button>
              )}
            </div>
            <h2>{L.name}</h2>
            <div className="temp">{L.temp}</div>
            <p className="lede"><Tex>{L.intro}</Tex></p>
            {level === 'amp' && <AmpControls />}
            {(level === 'fridge' || level === 'mxc' || level === 'amp') && <ReadoutConsequences compact={level !== 'mxc'} />}
            {level === 'chip' && <ChipReadout />}
            {level === 'transmon' && <TransmonLevels />}
            <div className="prose">{L.body.map((p, i) => <p key={i}><Tex>{p}</Tex></p>)}</div>
            <table className="facts"><tbody>{L.facts.map(([k, v]) => <tr key={k}><th><Tex>{k}</Tex></th><td><Tex>{v}</Tex></td></tr>)}</tbody></table>
            {L.note && <p className="note"><Tex>{L.note}</Tex></p>}
            {TOUR.indexOf(level) < TOUR.length - 1 && (
              <div className="tour-next">
                <div className="step">Tour stop {TOUR.indexOf(level) + 1} of {TOUR.length}. {TOUR_WHY[level]}</div>
                <button onClick={() => goTo(TOUR[TOUR.indexOf(level) + 1])} disabled={phase !== 'idle'}>Next: {LEVELS[TOUR[TOUR.indexOf(level) + 1]].name}</button>
              </div>
            )}
            {L.children.length > 0 && (
              <div className="keys big">
                {L.children.map((c) => (
                  <button key={c.to + c.label} onClick={() => goTo(c.to, c.pos)} disabled={phase !== 'idle'}>Go to: {c.label}</button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </aside>

      {intro && <Intro onClose={() => setIntro(false)} />}
      {!intro && <button className="help" onClick={() => setIntro(true)}>About this app</button>}

      <footer className="status">
        <div className="scale"><div className="bar" style={{ width: scalePx }} /><span>{scaleLabel}</span></div>
        <span className="hint">Drag to orbit. Scroll to zoom. Click a ring to go deeper.</span>
      </footer>
    </>
  )
}
