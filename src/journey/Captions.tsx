import { AnimatePresence, motion } from 'framer-motion'
import { useJourney } from './state'
import { Tex } from '../ui/Tex'

export const STAGES = [
  {
    title: 'This is the qubit.',
    body: [
      'A transmon: a cross of aluminum about half a millimeter wide, sitting in a cross-shaped gap in the metal around it. One arm connects to ground through a Josephson junction, which is far too small to see from here.',
      'Right now it’s in $|{q}\\rangle$ (you can change that below). Our job is to find out which state it’s in... without wrecking it in the process.',
    ],
  },
  {
    title: 'You can’t look at it. You listen to its neighbor.',
    body: [
      'The zigzag is a readout resonator, a wire that rings near 7 GHz. The qubit tugs that pitch up or down by $\\chi$ depending on its state, but never trades energy with it.',
      'The gold corkscrew is the microwave pulse we send down the feedline. Its radius is the amplitude and its twist is the phase. Watch it pass the resonator: it comes out weaker and twisted by $45^\\circ$, one way for $|0\\rangle$ and the other way for $|1\\rangle$. The dashed line shows what the other state would have done.',
      'That twist is the entire measurement. Everything after this point is about not losing it.',
    ],
    fine: 'Twist rate exaggerated: the real wavelength on the chip is about 17 mm. With $2\\chi = \\kappa$, the two states come out $90^\\circ$ apart at $1/\\sqrt{2}$ of the input amplitude.',
  },
]

export function Captions({ total }: { total: number }) {
  const { stage, qubit, set, fire } = useJourney()
  const S = STAGES[stage]
  return (
    <>
      <div className="j-count">{stage + 1} <span>of</span> 6</div>
      <AnimatePresence mode="wait">
        <motion.section key={stage} className="j-caption"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1], delay: 0.15 }}>
          <h1>{S.title}</h1>
          {S.body.map((p, i) => <p key={i}><Tex>{p.replace('{q}', String(qubit))}</Tex></p>)}
          {S.fine && <p className="fine"><Tex>{S.fine}</Tex></p>}
        </motion.section>
      </AnimatePresence>
      <nav className="j-controls">
        <div className="j-state">
          <span>Qubit state</span>
          <button className={qubit === 0 ? 'on' : ''} onClick={() => { set({ qubit: 0 }); if (stage >= 1) fire() }}>|0⟩</button>
          <button className={qubit === 1 ? 'on' : ''} onClick={() => { set({ qubit: 1 }); if (stage >= 1) fire() }}>|1⟩</button>
        </div>
        {stage >= 1 && <button className="j-fire" onClick={fire}>Send a pulse</button>}
        <div className="j-nav">
          <button onClick={() => set({ stage: Math.max(0, stage - 1) })} disabled={stage === 0}>Back</button>
          <button className="next" onClick={() => set({ stage: Math.min(total - 1, stage + 1) })} disabled={stage === total - 1}>Next</button>
        </div>
      </nav>
    </>
  )
}
