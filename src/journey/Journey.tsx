import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { EffectComposer, DepthOfField, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { Chip, QUBIT_POS } from './Chip'
import { Pulse } from './Pulse'
import { useJourney } from './state'
import { Captions, STAGES } from './Captions'
import './journey.css'

type Shot = { pos: [number, number, number]; look: [number, number, number]; focus: [number, number, number] }
const SHOTS: Shot[] = [
  { pos: [7, 6.5, -7.5], look: [0, 0, -15.5], focus: QUBIT_POS },
  { pos: [-4, 5.5, 15], look: [3, 0.5, -4], focus: [0, 1.3, 0] },
]

/** Camera on rails: glides to the current stage's shot, with a little mouse parallax. */
function Rig() {
  const { camera, pointer, size } = useThree()
  // shift the frame so the subject sits right of center, clear of the captions
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    if (size.width > 900) cam.setViewOffset(size.width, size.height, -size.width * 0.17, 0, size.width, size.height)
    else cam.clearViewOffset()
    cam.updateProjectionMatrix()
  }, [camera, size])
  const look = useRef(new THREE.Vector3(...SHOTS[0].look))
  useFrame((_, dt) => {
    const s = SHOTS[Math.min(useJourney.getState().stage, SHOTS.length - 1)]
    const k = 1 - Math.exp(-dt * 1.6)
    const target = new THREE.Vector3(...s.pos).add(new THREE.Vector3(pointer.x * 0.8, pointer.y * 0.5, 0))
    camera.position.lerp(target, k)
    look.current.lerp(new THREE.Vector3(...s.look), k)
    camera.lookAt(look.current)
  })
  return null
}

function Focus() {
  const stage = useJourney((s) => s.stage)
  const f = SHOTS[Math.min(stage, SHOTS.length - 1)].focus
  return (
    <EffectComposer multisampling={4}>
      <DepthOfField target={f} focalLength={0.03} bokehScale={stage === 0 ? 2.5 : 1.5} height={700} />
      <Bloom luminanceThreshold={1.2} intensity={0.5} radius={0.4} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.3} darkness={0.65} />
    </EffectComposer>
  )
}

/** Re-fires the pulse every few seconds while the reader is on a pulse stage. */
function AutoFire() {
  const { stage, fire } = useJourney()
  useEffect(() => {
    if (stage < 1) return
    fire()
    const id = setInterval(() => fire(), 6500)
    return () => clearInterval(id)
  }, [stage, fire])
  return null
}

export function Journey() {
  const stage = useJourney((s) => s.stage)
  return (
    <div className="journey">
      <Canvas flat dpr={[1, 1.75]} camera={{ position: SHOTS[0].pos, fov: 32, near: 0.05, far: 400 }} gl={{ antialias: true }}>
        <color attach="background" args={['#17181d']} />
        <fog attach="fog" args={['#17181d', 40, 120]} />
        {/* microscope-style lighting: soft overhead ring light, warm key, cool fill */}
        <hemisphereLight args={['#fff6e8', '#1a1c24', 0.12]} />
        <spotLight position={[-22, 30, -6]} angle={0.7} penumbra={1} intensity={70} decay={2} color="#ffe9c9" />
        <directionalLight position={[20, 8, -20]} intensity={0.6} color="#9db7ff" />
        <Environment files="/hdri/studio.hdr" environmentIntensity={0.22} />
        <Chip />
        {stage >= 1 && <Pulse />}
        <Rig />
        <Focus />
        <AutoFire />
      </Canvas>
      <Captions total={STAGES.length} />
    </div>
  )
}
