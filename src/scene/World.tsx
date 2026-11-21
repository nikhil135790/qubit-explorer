import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Lightformer } from '@react-three/drei'
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
  return (
    <Canvas camera={{ position: L.camera, fov: 42, near: 0.01, far: 2000 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#07090d']} />
      <fog attach="fog" args={['#07090d', 30, 90]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[8, 14, 6]} intensity={1.6} />
      <directionalLight position={[-10, 4, -8]} intensity={0.5} color="#8fb3ff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[20, 6, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[-8, 2, 4]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} color="#9fc3ff" />
        <Lightformer form="rect" intensity={1.2} position={[8, 1, -4]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} color="#ffd2a1" />
        <Lightformer form="ring" intensity={2} position={[0, 3, 8]} scale={4} />
      </Environment>
      <LevelScene />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={L.target} minDistance={L.minDist} maxDistance={L.maxDist} />
      <Rig />
    </Canvas>
  )
}
