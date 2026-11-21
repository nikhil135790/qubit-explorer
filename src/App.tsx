import { World } from './scene/World'
import { Overlay } from './ui/Overlay'
import { useStore } from './store'

export default function App() {
  const labelsOn = useStore((s) => s.labelsOn)
  return (
    <div className={'app' + (labelsOn ? ' labels-on' : '')}>
      <div className="rail" />
      <div className="stage"><World /></div>
      <Overlay />
    </div>
  )
}
