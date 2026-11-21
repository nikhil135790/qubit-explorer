import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Bloom, N8AO, ToneMapping, Vignette, SMAA } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import type { OrbitControls as OC } from 'three-stdlib'
import { useStore } from '../store'
import { LEVELS } from '../levels'
import { Hotspot } from './common'
import { Fridge } from './Fridge'
import { Mxc } from './Mxc'
import { AmpChip } from './AmpChip'
import { QubitChip } from './QubitChip'
import { Transmon } from './Transmon'
import { Junction } from './Junction'

const SCENES = { fridge: Fridge, mxc: Mxc, amp: AmpChip, chip: QubitChip, transmon: Transmon, junction: Junction }
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const OUT_T = 0.9, IN_T = 1.3

/** Drives the zoom-out / zoom-in transitions between levels and keeps the scale bar updated. */
function Rig() {
  const { camera, size } = useThree()
  const controls = useThree((s) => s.controls) as unknown as OC | null
  const level = useStore((s) => s.level)
  const phase = useStore((s) => s.phase)
  const t = useRef(0)
  const from = useRef({ pos: new THREE.Vector3(), tgt: new THREE.Vector3() })
  const to = useRef({ pos: new THREE.Vector3(), tgt: new THREE.Vector3() })
  const frame = useRef(0)

  // set up each transition when the phase changes
  useEffect(() => {
    if (!controls) return
    t.current = 0
    const L = LEVELS[level]
    const st = useStore.getState()
    if (phase === 'out') {
      from.current.pos.copy(camera.position)
      from.current.tgt.copy(controls.target)
      if (st.zoomPoint) {
        const zp = new THREE.Vector3(...st.zoomPoint)
        const dir = camera.position.clone().sub(zp).normalize()
        to.current.tgt.copy(zp)
        to.current.pos.copy(zp).add(dir.multiplyScalar(L.minDist * 0.15))
      } else {
        to.current.tgt.copy(controls.target)
        to.current.pos.copy(controls.target).add(camera.position.clone().sub(controls.target).multiplyScalar(4))
      }
    } else if (phase === 'in') {
      const tgt = new THREE.Vector3(...L.target)
      const cam = new THREE.Vector3(...L.camera)
      to.current.tgt.copy(tgt)
      to.current.pos.copy(cam)
      from.current.tgt.copy(tgt)
      from.current.pos.copy(tgt).add(cam.clone().sub(tgt).multiplyScalar(0.08))
      camera.position.copy(from.current.pos)
      controls.target.copy(tgt)
      controls.minDistance = 0.01
      controls.maxDistance = 1e4
    } else {
      controls.minDistance = L.minDist
      controls.maxDistance = L.maxDist
    }
  }, [phase, level, controls, camera])

  useFrame((_, dt) => {
    const st = useStore.getState()
    if (controls && (st.phase === 'out' || st.phase === 'in')) {
      const T = st.phase === 'out' ? OUT_T : IN_T
      t.current = Math.min(1, t.current + dt / T)
      const k = ease(t.current)
      camera.position.lerpVectors(from.current.pos, to.current.pos, k)
      controls.target.lerpVectors(from.current.tgt, to.current.tgt, k)
      controls.update()
      if (t.current >= 1) (st.phase === 'out' ? st.finishOut : st.finishIn)()
    }
    // scale bar: how many meters one screen pixel spans at the orbit target
    if (controls && ++frame.current % 6 === 0) {
      const L = LEVELS[st.level]
      const dist = camera.position.distanceTo(controls.target)
      const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
      const mpp = (2 * dist * Math.tan(fov / 2) * L.metersPerUnit) / size.height
      const raw = mpp * 120
      const p = Math.pow(10, Math.floor(Math.log10(raw)))
      const nice = [1, 2, 5, 10].map((m) => m * p).filter((v) => v <= raw).pop() ?? p
      const px = nice / mpp
      const fmt = (m: number) => {
        const u: [number, string][] = [[1, 'm'], [1e-2, 'cm'], [1e-3, 'mm'], [1e-6, 'µm'], [1e-9, 'nm']]
        for (const [f, n] of u) if (m >= f * 0.999) return `${+(m / f).toPrecision(3)} ${n}`
        return `${+(m / 1e-9).toPrecision(3)} nm`
      }
      const label = fmt(nice)
      if (label !== st.scaleLabel || Math.abs(px - st.scalePx) > 1) st.set({ scaleLabel: label, scalePx: px })
    }
  })
  return null
}

// light levels tuned per scene: the fridge is metres across, the chips are millimetres of bright film
const LIGHT = { fridge: [420, 1.4, 0.9], mxc: [90, 0.8, 0.3], amp: [10, 0.35, 0.16], chip: [10, 0.35, 0.16], transmon: [4, 0.25, 0.08], junction: [30, 0.6, 0.3] } as const
function Lights() {
  const level = useStore((s) => s.level)
  const [spot, rim] = LIGHT[level]
  return (
    <>
      <spotLight position={[6, 22, 10]} angle={0.5} penumbra={0.8} intensity={spot} decay={2} color="#fff3e0" />
      <directionalLight position={[-12, 6, -14]} intensity={rim} color="#8fb6ff" />
    </>
  )
}
function EnvForLevel({ children }: { children: React.ReactNode }) {
  const level = useStore((s) => s.level)
  return <Environment files="/hdri/studio.hdr" environmentIntensity={LIGHT[level][2]}>{children}</Environment>
}

function LevelScene() {
  const level = useStore((s) => s.level)
  const phase = useStore((s) => s.phase)
  const S = SCENES[level]
  return (
    <group>
      <S />
      {phase === 'idle' && LEVELS[level].children.map((c) => <Hotspot key={c.to + c.label} pos={c.pos} to={c.to} label={c.label} />)}
    </group>
  )
}

export function World() {
  const L = LEVELS.fridge
  // adaptive quality: drop resolution and ambient occlusion if the frame rate falls
  const [dpr, setDpr] = useState(1.5)
  const [hq, setHq] = useState(true)
  return (
    <Canvas flat camera={{ position: L.camera, fov: 38, near: 0.01, far: 2000 }} dpr={dpr} gl={{ antialias: false, powerPreference: 'high-performance' }}>
      <PerformanceMonitor bounds={() => [45, 58]} onDecline={() => { setHq(false); setDpr(1) }} onIncline={() => setDpr(1.5)} />
      <color attach="background" args={['#05080c']} />
      <fog attach="fog" args={['#05080c', 35, 110]} />
      <ambientLight intensity={0.15} />
      {/* key light from above, cool rim from behind: the classic dilution-fridge photo setup */}
      <Lights />
      <EnvForLevel>
        <Lightformer form="rect" intensity={1.3} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[24, 6, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-10, 2, 6]} rotation-y={Math.PI / 2} scale={[12, 4, 1]} color="#a9c8ff" />
      </EnvForLevel>
      <LevelScene />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={L.target} minDistance={L.minDist} maxDistance={L.maxDist} />
      <Rig />
      <EffectComposer multisampling={0}>
        <>{hq && <N8AO aoRadius={0.6} intensity={2.2} distanceFalloff={0.6} quality="performance" halfRes />}</>
        <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.15} intensity={0.7} radius={0.45} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <Vignette offset={0.25} darkness={0.75} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  )
}
