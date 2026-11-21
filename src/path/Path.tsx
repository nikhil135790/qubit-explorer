import { useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import type { OrbitControls as OC } from 'three-stdlib'
import * as THREE from 'three'
import { usePath, STATIONS, BUILT, beatRunning } from './state'
import { StationQubit } from './StationQubit'
import { StationAmp } from './StationAmp'
import { Tex } from '../ui/Tex'
import './path.css'

/** Advances the shared clock and the current beat. Nothing moves while paused. */
function Clock() {
  useFrame((_, dt) => {
    const st = usePath.getState()
    if (st.paused) return
    const d = Math.min(dt, 0.1)
    const beat = STATIONS[st.station].beats[st.beat]
    const patch: { time: number; u?: number } = { time: st.time + d }
    if (st.u < beat.u) patch.u = Math.min(beat.u, st.u + ((beat.u - st.from) / beat.dur) * d)
    st.set(patch)
  })
  return null
}

/** Between steps (or while paused) the viewer can drag to look around and scroll to zoom. */
function LookAround() {
  const { camera } = useThree()
  const controls = useThree((s) => s.controls) as unknown as OC | null
  useEffect(() => {
    if (!controls) return
    const onStart = () => usePath.getState().set({ orbiting: true })
    controls.addEventListener('start', onStart)
    return () => controls.removeEventListener('start', onStart)
  }, [controls])
  useFrame(() => {
    if (!controls) return
    const st = usePath.getState()
    const free = st.paused || !beatRunning()
    if (free && !controls.enabled) {
      // put the orbit pivot where the camera is looking, so dragging feels natural
      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)
      const d = Math.min(60, Math.max(4, camera.position.y * 1.2))
      controls.target.copy(camera.position).add(dir.multiplyScalar(d))
      controls.update()
    }
    controls.enabled = free
  })
  return <OrbitControls makeDefault enableDamping={false} enabled={false} minDistance={0.5} maxDistance={600} />
}

// test hook for screenshot scripts: jump to a station and beat, already finished
;(window as unknown as { __goto: (s: number, b: number) => void }).__goto = (s: number, b: number) => {
  const u = STATIONS[s].beats[b].u
  usePath.getState().set({ station: s, beat: b, u, from: u, orbiting: false, paused: false })
}

export function Path() {
  const { station, beat, u, paused, qubit, set, next, back, replay, goStation } = usePath()
  const S = STATIONS[station]
  const B = S.beats[beat]
  const running = u < B.u - 1e-4
  const atEnd = station === BUILT - 1 && beat === S.beats.length - 1
  return (
    <div className="path">
      <Canvas flat dpr={[1, 1.75]} camera={{ position: [13.2, 11.5, -7.6], fov: 34, near: 0.02, far: 3000 }} gl={{ antialias: true, logarithmicDepthBuffer: true }}>
        <color attach="background" args={['#141519']} />
        <hemisphereLight args={['#fff4e2', '#141519', 0.42]} />
        <spotLight position={[10, 220, -20]} angle={0.9} penumbra={1} intensity={550} decay={2} color="#ffe8c6" />
        <directionalLight position={[120, 40, -120]} intensity={0.5} color="#9db7ff" />
        <Environment files="/hdri/studio.hdr" environmentIntensity={0.2} environmentRotation={[0, Math.PI * 0.75, 0]} />
        {station === 0 && <StationQubit />}
        {station === 1 && <StationAmp />}
        <Clock />
        <LookAround />
        <EffectComposer multisampling={4}>
          <Bloom luminanceThreshold={1.0} intensity={0.6} radius={0.45} mipmapBlur />
          <ToneMapping mode={ToneMappingMode.AGX} />
          <Vignette offset={0.3} darkness={0.6} />
        </EffectComposer>
      </Canvas>

      <div className="p-fade" key={'f' + station} />
      <div className="p-title">
        <span className="p-num">{station + 1}</span>
        <h1>{S.name}</h1>
      </div>
      <p className="p-caption" key={station + '-' + beat}><Tex>{B.caption}</Tex></p>
      <p className="p-hint">{paused ? 'Paused. Drag to look around, scroll to zoom.' : running ? '' : 'Drag to look around. Press Next when you’re ready.'}</p>

      <footer className="p-bar">
        <div className="p-steps">
          <button onClick={back} disabled={station === 0 && beat === 0}>Back</button>
          <button className="p-next" onClick={atEnd ? () => goStation(0) : next}>{atEnd ? 'Start over' : 'Next'}</button>
          <button onClick={() => set({ paused: !paused })}>{paused ? 'Resume' : 'Pause'}</button>
          <button onClick={replay}>Replay step</button>
        </div>
        <div className="p-stations">
          {STATIONS.map((s, i) => (
            <button key={s.id} className={'p-st' + (i === station ? ' on' : '') + (i >= BUILT ? ' soon' : '')} disabled={i >= BUILT} onClick={() => goStation(i)}>
              <span className="lbl">{s.name}</span>
              {i === station && <span className="dots">{s.beats.map((_, k) => <i key={k} className={k < beat ? 'done' : k === beat ? 'cur' : ''} />)}</span>}
            </button>
          ))}
        </div>
        <div className="p-q">
          <span>Qubit</span>
          <button className={qubit === 0 ? 'on' : ''} onClick={() => set({ qubit: 0 })}>|0⟩</button>
          <button className={qubit === 1 ? 'on' : ''} onClick={() => set({ qubit: 1 })}>|1⟩</button>
        </div>
      </footer>
    </div>
  )
}
