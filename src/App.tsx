import { Bench } from './bench/Bench'
import { BenchUI } from './bench/BenchUI'
import './bench/bench.css'

// Earlier versions (six-level explorer, captioned journey) live in src/scene, src/ui and src/journey.
export default function App() {
  return (
    <div className="bench">
      <Bench />
      <BenchUI />
    </div>
  )
}
