import { World } from './scene/World'
import { Overlay } from './ui/Overlay'

export default function App() {
  return (
    <div className="app">
      <div className="rail" />
      <div className="stage"><World /></div>
      <Overlay />
    </div>
  )
}
