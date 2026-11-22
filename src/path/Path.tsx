import { memo, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import type { OrbitControls as OC } from 'three-stdlib'
import * as THREE from 'three'
import { usePath, STATIONS, BUILT, beatRunning } from './state'
import { StationQubit } from './StationQubit'
import { StationAmp } from './StationAmp'
import { StationIso } from './StationIso'
import { StationHemt } from './StationHemt'
import { StationScreen } from './StationScreen'
import { Aside } from './Asides'
import { OtherChains } from './OtherChains'
import { Fridge, OurLines } from './Fridge'
import { rig } from './rig'
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
    if (beat.auto && (patch.u ?? st.u) >= beat.u) st.next()
  })
  return null
}

/**
 * Between steps (or while paused) the viewer can drag to look around and scroll to zoom.
 * The pivot is exactly where the scripted camera is aiming, and the zoom limits scale with the
 * current distance, so dragging at the junction orbits the junction instead of a point inside the chip.
 */
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
      const d = camera.position.distanceTo(rig.look)
      controls.target.copy(rig.look)
      controls.minDistance = d * 0.12
      controls.maxDistance = d * 6
      // stay above the surface being looked at, except for the fridge overview
      controls.maxPolarAngle = d > 5000 ? Math.PI * 0.62 : Math.PI * 0.48
      controls.update()
    }
    controls.enabled = free
  })
  return <OrbitControls makeDefault enableDamping={false} enablePan={false} enabled={false} />
}

/**
 * Keeps depth precision and lighting right across nine orders of magnitude: the near plane follows
 * the camera distance, and the overall light comes up for the wide fridge shots, where the small
 * overhead lamp over the chip would leave everything else dark.
 */
function ScaleRig() {
  const { camera, scene } = useThree()
  const key = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    const d = Math.max(1e-6, camera.position.distanceTo(rig.look))
    const cam = camera as THREE.PerspectiveCamera
    cam.near = Math.min(20, Math.max(1e-6, d * 0.004))
    cam.far = 400000
    cam.updateProjectionMatrix()
    // wide fridge shots: shift the picture so the fridge sits right of the caption, without moving
    // the point the camera turns around (that stays on the fridge's axis)
    const wide = THREE.MathUtils.smoothstep(Math.log10(d), 3.8, 4.3)
    cam.filmOffset = -0.13 * 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect * cam.getFilmWidth() * wide
    const f = THREE.MathUtils.smoothstep(Math.log10(d), 2.2, 3.6)
    scene.environmentIntensity = 0.2 + 0.55 * f
    if (key.current) key.current.intensity = 2.6 * f
  })
  return <directionalLight ref={key} position={[30000, 26000, 42000]} intensity={0} color="#fff1dc" />
}

// test hook for screenshot scripts: jump to a station and beat, already finished
;(window as unknown as { __goto: (s: number, b: number) => void }).__goto = (s: number, b: number) => {
  const u = STATIONS[s].beats[b].u
  usePath.getState().set({ station: s, beat: b, u, from: u, orbiting: false, paused: false })
}

// test hook: freeze the story at station s, progress u (camera follows exactly, no easing)
;(window as unknown as { __at: (s: number, u: number) => void }).__at = (s: number, u: number) => {
  rig.catchup = 0
  usePath.getState().set({ station: s, beat: 0, u, from: u, orbiting: false, paused: false })
}

// test hook: set progress within the current station and hold there
;(window as unknown as { __setU2: (u: number) => void }).__setU2 = (u: number) => usePath.getState().set({ u, from: u })

/** The 3D world. Memoised so it never re-renders when the UI around it changes. */
const World = memo(function World() {
  return (
    <Canvas flat dpr={[1, 1.75]} camera={{ position: [13950, 8500, 26300], fov: 34, near: 1, far: 400000 }} gl={{ antialias: true, logarithmicDepthBuffer: true }}>
      <color attach="background" args={['#141519']} />
      <hemisphereLight args={['#fff4e2', '#141519', 0.42]} />
      <spotLight position={[10, 220, -20]} angle={0.9} penumbra={1} intensity={550} decay={2} color="#ffe8c6" />
      <directionalLight position={[120, 40, -120]} intensity={0.5} color="#9db7ff" />
      <Environment files="/hdri/studio.hdr" environmentIntensity={0.2} environmentRotation={[0, Math.PI * 0.75, 0]} />
      {/* one continuous world: the fridge, with our readout chain and two others on its coldest plate */}
      <Fridge />
      <OurLines />
      <OtherChains />
      <StationQubit />
      <StationAmp />
      <StationIso />
      <StationHemt />
      <StationScreen />
      <Clock />
      <LookAround />
      <ScaleRig />
      <EffectComposer multisampling={4}>
        <Bloom luminanceThreshold={1.0} intensity={0.6} radius={0.45} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <Vignette offset={0.3} darkness={0.6} />
      </EffectComposer>
    </Canvas>
  )
})

export function Path() {
  // subscribe only to what the UI shows, never to the per-frame clock
  const station = usePath((s) => s.station)
  const beat = usePath((s) => s.beat)
  const paused = usePath((s) => s.paused)
  const qubit = usePath((s) => s.qubit)
  const running = usePath((s) => s.u < STATIONS[s.station].beats[s.beat].u - 1e-4)
  const { set, next, back, goStation } = usePath.getState()
  const S = STATIONS[station]
  const B = S.beats[beat]
  const atEnd = station === BUILT - 1 && beat === S.beats.length - 1
  return (
    <div className="path">
      <World />

      <div className="p-title">
        <span className="p-num">{station + 1}</span>
        <h1>{S.beats.slice(0, beat + 1).reduce<string | undefined>((t, b) => b.title ?? t, undefined) ?? S.name}</h1>
      </div>
      <p className="p-caption" key={'cap-' + station + '-' + beat}><Tex>{B.caption}</Tex></p>
      <p className="p-hint">{paused ? 'Paused. Drag to look around, scroll to zoom.' : running || atEnd ? '' : 'Drag to look around. Press Next when you’re ready.'}</p>

      <Aside key={'aside-' + station + '-' + beat} station={station} beat={beat} />

      <footer className="p-bar">
        <div className="p-steps">
          <button onClick={back} disabled={station === 0 && beat === 0}>Back</button>
          <button className="p-next" onClick={next} disabled={atEnd}>Next</button>
          <button onClick={() => { if (paused && usePath.getState().orbiting) rig.catchup = 1.2; set(paused ? { paused: false, orbiting: false } : { paused: true }) }}>{paused ? 'Resume' : 'Pause'}</button>
          <button onClick={() => goStation(0)}>Start over</button>
        </div>
        <div className="p-stations">
          {STATIONS.map((s, i) => (
            <button key={s.id} className={'p-st' + (i === station ? ' on' : '') + (i < station ? ' past' : '') + (i >= BUILT ? ' soon' : '')} disabled={i >= BUILT} onClick={() => goStation(i)}>
              <span className="p-st-line">
                {i === station
                  ? s.beats.map((_, k) => <i key={k} className={k < beat ? 'done' : k === beat ? 'cur' : ''} />)
                  : <i className={i < station ? 'done full' : 'full'} />}
              </span>
              <span className="p-st-name">{s.name}</span>
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
