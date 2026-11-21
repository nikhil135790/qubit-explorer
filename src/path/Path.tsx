import { useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import type { OrbitControls as OC } from 'three-stdlib'
import * as THREE from 'three'
import { usePath, STATIONS } from './state'
import { StationQubit, captionQubit } from './StationQubit'
import { Tex } from '../ui/Tex'
import './path.css'

/** Advances the timeline while playing. */
function Clock() {
  useFrame((_, dt) => {
    const st = usePath.getState()
    if (!st.playing) return
    const u = st.u + Math.min(dt, 0.1) / STATIONS[st.station].length
    if (u < 1) st.set({ u })
    else if (st.station < BUILT - 1) st.goStation(st.station + 1)
    else st.set({ u: 1, playing: false })
  })
  return null
}

/** When paused, hand the camera to the viewer: drag to look around, scroll to zoom. */
function LookAround() {
  const playing = usePath((s) => s.playing)
  const { camera } = useThree()
  const controls = useThree((s) => s.controls) as unknown as OC | null
  useEffect(() => {
    if (!controls) return
    controls.enabled = !playing
    if (!playing) {
      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)
      controls.target.copy(camera.position).add(dir.multiplyScalar(camera.position.length() > 60 ? 60 : 18))
      controls.update()
    }
  }, [playing, controls, camera])
  return <OrbitControls makeDefault enableDamping enabled={false} minDistance={0.5} maxDistance={600} />
}

const BUILT = 1 // stations finished so far

// test hook: jump the timeline (used by screenshot scripts)
;(window as unknown as { __setU: (u: number) => void }).__setU = (u: number) => usePath.getState().set({ u })

export function Path() {
  const { station, u, playing, qubit, set, goStation } = usePath()
  const caption = station === 0 ? captionQubit(u, qubit) : ''
  return (
    <div className="path">
      <Canvas flat dpr={[1, 1.75]} camera={{ position: [55, 90, 105], fov: 34, near: 0.05, far: 3000 }} gl={{ antialias: true, logarithmicDepthBuffer: true }}>
        <color attach="background" args={['#141519']} />
        <hemisphereLight args={['#fff4e2', '#141519', 0.2]} />
        <spotLight position={[-60, 160, 60]} angle={0.8} penumbra={1} intensity={3200} decay={2} color="#ffe8c6" />
        <directionalLight position={[120, 40, -120]} intensity={0.5} color="#9db7ff" />
        <Environment files="/hdri/studio.hdr" environmentIntensity={0.25} />
        {station === 0 && <StationQubit />}
        <Clock />
        <LookAround />
        <EffectComposer multisampling={4}>
          <Bloom luminanceThreshold={1.1} intensity={0.55} radius={0.4} mipmapBlur />
          <ToneMapping mode={ToneMappingMode.AGX} />
          <Vignette offset={0.3} darkness={0.6} />
        </EffectComposer>
      </Canvas>

      <div className="p-title">
        <span className="p-num">{station + 1}</span>
        <h1>{STATIONS[station].name}</h1>
      </div>
      <p className="p-caption" key={caption}><Tex>{caption}</Tex></p>
      {!playing && u < 1 && <p className="p-hint">Paused. Drag to look around, scroll to zoom.</p>}

      <footer className="p-bar">
        <button className="p-play" onClick={() => set({ playing: !playing })} aria-label={playing ? 'Pause' : 'Play'}>{playing ? 'Pause' : u >= 1 ? 'Replay' : 'Play'}</button>
        <div className="p-stations">
          {STATIONS.map((s, i) => (
            <button key={s.id} className={'p-st' + (i === station ? ' on' : '') + (i >= BUILT ? ' soon' : '')} disabled={i >= BUILT}
              onClick={() => goStation(i)}>
              <span className="fill" style={{ width: i < station ? '100%' : i === station ? `${u * 100}%` : '0%' }} />
              <span className="lbl">{s.name}</span>
            </button>
          ))}
        </div>
        <div className="p-q">
          <span>Qubit</span>
          <button className={qubit === 0 ? 'on' : ''} onClick={() => set({ qubit: 0 })}>|0⟩</button>
          <button className={qubit === 1 ? 'on' : ''} onClick={() => set({ qubit: 1 })}>|1⟩</button>
        </div>
      </footer>
      {u >= 1 && station === BUILT - 1 && <button className="p-replay" onClick={() => goStation(0)}>Watch again</button>}
    </div>
  )
}
