// Cross-check the in-app TypeScript physics against the Python reference values.
import { summarize } from '../src/physics/dirAmp'
import { fidelity, dephasingRate, TWO_PI } from '../src/physics/readout'
const show = (n: string, p: { phi: number; s: number }) => {
  const a = summarize(p)
  console.log(n, `stable=${a.stable} fwd=${a.fwdDb.toFixed(2)} dB rev=${a.revDb.toFixed(1)} dB reflA=${a.reflA.toExponential(1)} nadd=${a.nAdd.toFixed(3)}`)
}
show('design  ', { phi: -Math.PI / 2, s: 1 })
show('phi=0   ', { phi: 0, s: 1 })
show('phi=+pi/2', { phi: Math.PI / 2, s: 1 })
show('s=0.9   ', { phi: -Math.PI / 2, s: 0.9 })
show('s=1.2   ', { phi: -Math.PI / 2, s: 1.2 })
const p = { kappa: TWO_PI * 4, chi: TWO_PI * 2, nbar: 4, T1: 50 }
console.log('F(eta=0.03,0.4us)', fidelity({ ...p, eta: 0.03 }, 0.4, 400).F.toFixed(5), ' python 0.89151')
console.log('F(eta=0.30,0.6us)', fidelity({ ...p, eta: 0.3 }, 0.6, 400).F.toFixed(5), ' python 0.99661')
console.log('Gamma(nth=0.05)', dephasingRate(p.kappa, p.chi, 0.05).toFixed(5), ' python 0.61335')
