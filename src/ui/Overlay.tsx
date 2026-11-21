import { useState } from 'react'
import { useStore } from '../store'
import { LEVELS, ORDER } from '../levels'
import { AmpControls, ReadoutConsequences, ChipReadout, TransmonLevels } from './Panels'

export function Overlay() {
  const { level, phase, history, goTo, back, scaleLabel, scalePx } = useStore()
  const L = LEVELS[level]
  const [open, setOpen] = useState(true)
  return (
    <>
      <div className={'fade ' + (phase === 'out' ? 'on' : '')} />

      <header className="top">
        <div className="title">Down the Readout Line</div>
        <div className="subtitle">A to-scale journey through a superconducting quantum computer, from the fridge to a single Josephson junction</div>
      </header>

      <nav className="ladder">
        {ORDER.map((id) => {
          const l = LEVELS[id]
          return (
            <button key={id} className={id === level ? 'on' : ''} onClick={() => goTo(id)} disabled={phase !== 'idle'}>
              <span className="sz">{l.size}</span>
              <span className="nm">{l.short}</span>
            </button>
          )
        })}
      </nav>

      <aside className={'card ' + (open ? '' : 'closed')}>
        <button className="toggle" onClick={() => setOpen(!open)}>{open ? '›' : '‹'}</button>
        {open && (
          <div className="inner">
            <div className="crumbs">
              {history.length > 0 && <button onClick={back} disabled={phase !== 'idle'}>← zoom out to {LEVELS[history[history.length - 1]].short}</button>}
            </div>
            <div className="meta"><span>{L.size}</span><span>{L.temp}</span></div>
            <h2>{L.name}</h2>
            <p className="intro">{L.intro}</p>
            {(level === 'amp') && <AmpControls />}
            {(level === 'fridge' || level === 'mxc' || level === 'amp') && <ReadoutConsequences compact={level !== 'mxc'} />}
            {level === 'chip' && <ChipReadout />}
            {level === 'transmon' && <TransmonLevels />}
            {L.body.map((p, i) => <p key={i}>{p}</p>)}
            <table className="facts"><tbody>{L.facts.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
            {L.note && <p className="muted small">{L.note}</p>}
            {L.children.length > 0 && (
              <div className="next">
                {L.children.map((c) => <button key={c.to + c.label} onClick={() => goTo(c.to, c.pos)} disabled={phase !== 'idle'}>Zoom into: {c.label} →</button>)}
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="scalebar">
        <div className="bar" style={{ width: scalePx }} />
        <div className="lab">{scaleLabel}</div>
      </div>
      <div className="hint">drag to orbit · scroll to zoom · click a glowing ring to dive in</div>
    </>
  )
}
