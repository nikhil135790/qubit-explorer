import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Html, Line, RoundedBox } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import type { Line2 } from 'three-stdlib'
import * as THREE from 'three'
import { useBench, X_QUBIT, SLOT_X, X_HEMT, X_SCREEN, PULSE_SPEED } from './state'
import { PARTS, evaluate } from './parts'
import type { PartId } from './parts'
import { READOUT_PHASE, READOUT_AMP } from '../journey/state'
import { Monitor } from './Monitor'

const Y = 0.9 // cable height above the bench

function PartModel({ id, x, index }: { id: PartId; x: number; index: number }) {
  const [hover, setHover] = useState(false)
  const removeAt = useBench((s) => s.removeAt)
  const p = PARTS[id]
  const mat = <meshStandardMaterial color={p.color} metalness={0.85} roughness={0.35} emissive={hover ? '#ff5544' : '#000'} emissiveIntensity={hover ? 0.25 : 0} />
  const body = {
    dir: <RoundedBox args={[1.7, 1.1, 1.3]} radius={0.06}>{mat}</RoundedBox>,
    jpa: <RoundedBox args={[1.2, 1.0, 1.2]} radius={0.06}>{mat}</RoundedBox>,
    twpa: <RoundedBox args={[2.4, 0.55, 0.9]} radius={0.05}>{mat}</RoundedBox>,
    circ: <mesh rotation={[0, 0, 0]}><cylinderGeometry args={[0.75, 0.75, 0.5, 40]} />{mat}</mesh>,
    iso: <mesh><cylinderGeometry args={[0.6, 0.6, 0.45, 40]} />{mat}</mesh>,
  }[id]
  return (
    <group position={[x, Y, 0]}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}
      onClick={(e) => { e.stopPropagation(); removeAt(index); document.body.style.cursor = '' }}>
      {body}
      {id === 'dir' && <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.07, 0.07, 1.4, 12]} /><meshStandardMaterial color="#c7ccd4" metalness={1} roughness={0.3} /></mesh>}
      <Html position={[0, -1.25, 0]} center className="b-tag">{hover ? 'Click to remove' : p.name}</Html>
    </group>
  )
}

/** The readout pulse as a corkscrew (I and Q around the cable), growing at each amplifier and getting fuzzier with noise. */
function Pulse() {
  const chain = useBench((s) => s.chain)
  const res = useMemo(() => evaluate(chain), [chain])
  const N = 900, X0 = X_QUBIT, X1 = X_SCREEN - 2.2
  const ref = useRef<Line2>(null)
  const buf = useMemo(() => new Float32Array(N * 3), [])
  const init = useMemo(() => Array.from({ length: N }, (_, i) => [X0 + ((X1 - X0) * i) / (N - 1), Y, 0] as [number, number, number]), [])
  // boundaries where the pulse changes: after each placed part, then after the HEMT
  const marks = useMemo(() => [...chain.map((_, i) => SLOT_X[i]), X_HEMT], [chain])
  useFrame(() => {
    const { firedAt, qubit } = useBench.getState()
    const center = X0 + (performance.now() / 1000 - firedAt) * PULSE_SPEED
    for (let i = 0; i < N; i++) {
      const x = X0 + ((X1 - X0) * i) / (N - 1)
      const env = Math.exp(-(((x - center) / 1.4) ** 2))
      let k = -1
      for (let m = 0; m < marks.length; m++) if (x > marks[m]) k = m
      const g = k < 0 ? 0 : res.stages[k].gainDb // cumulative gain in dB
      const nz = k < 0 ? 0 : res.stages[k].noise
      const after = x > X_QUBIT + 1.2
      const r = (0.3 + Math.min(1.1, (g / 60) * 1.1)) * env * (after ? READOUT_AMP : 1)
      const fuzz = k < 0 ? 0 : Math.min(0.55, 0.06 * Math.sqrt(nz)) * r
      const ph = 5 * x + (after ? READOUT_PHASE[qubit] : 0)
      buf[i * 3] = x
      buf[i * 3 + 1] = Y + r * Math.cos(ph) + (Math.random() - 0.5) * fuzz
      buf[i * 3 + 2] = r * Math.sin(ph) + (Math.random() - 0.5) * fuzz
    }
    ref.current?.geometry.setPositions(buf)
  })
  return <Line ref={ref} points={init} color="#ffcf6e" lineWidth={3.2} toneMapped={false} />
}

/** Red dots: noise from the HEMT drifting back toward the qubit, dimmed by each part's reverse transmission. */
function BackNoise() {
  const chain = useBench((s) => s.chain)
  const N = 40
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => [i / N, Math.random() - 0.5, Math.random() - 0.5]), [])
  // photon number along the line, walking back from the HEMT
  const level = useMemo(() => {
    const pts: { x: number; n: number }[] = [{ x: X_HEMT, n: 10 }]
    let n = 10
    for (let i = chain.length - 1; i >= 0; i--) {
      let rev = PARTS[chain[i]].revDb
      if (chain[i] === 'jpa' && chain[i - 1] === 'circ') rev = 0
      const r = Math.pow(10, rev / 10)
      n = r * n + Math.max(0, r - 1) * 0.5
      pts.push({ x: SLOT_X[i], n })
    }
    return pts
  }, [chain])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    for (let i = 0; i < N; i++) {
      const u = (seeds[i][0] + clock.getElapsedTime() * 0.08) % 1
      const x = X_HEMT - u * (X_HEMT - X_QUBIT - 1)
      let n = 10
      for (const p of level) if (x < p.x) n = p.n
      const a = Math.max(0, Math.min(1, 1 + Math.log10(n / 10) / 3))
      dummy.position.set(x, Y + seeds[i][1] * 0.5, seeds[i][2] * 0.5)
      dummy.scale.setScalar(0.06 * a * (n > 10 ? 1.6 : 1) + 1e-4)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshBasicMaterial color={new THREE.Color('#ff4d5e').multiplyScalar(2.2)} toneMapped={false} />
    </instancedMesh>
  )
}

function Rig() {
  const { camera, pointer } = useThree()
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 2)
    camera.position.lerp(new THREE.Vector3(0.5 + pointer.x * 1.2, 6.5 + pointer.y * 0.6, 23), k)
    camera.lookAt(0.3, 1.9, 0)
  })
  return null
}

export function Bench() {
  const chain = useBench((s) => s.chain)
  return (
    <Canvas flat dpr={[1, 1.75]} camera={{ position: [0.5, 6.5, 23], fov: 40 }} gl={{ antialias: true }}>
      <color attach="background" args={['#16171b']} />
      <hemisphereLight args={['#fff4e2', '#15161a', 0.35]} />
      <spotLight position={[-6, 18, 10]} angle={0.8} penumbra={1} intensity={260} decay={2} color="#ffe6c4" />
      <directionalLight position={[10, 6, -10]} intensity={0.5} color="#9db7ff" />
      <Environment files="/hdri/studio.hdr" environmentIntensity={0.3} />

      {/* the bench */}
      <mesh position={[0, -0.25, 0]} receiveShadow><boxGeometry args={[34, 0.5, 9]} /><meshStandardMaterial color="#2a2621" roughness={0.85} /></mesh>
      {/* cable from the qubit to the screen */}
      <mesh position={[(X_QUBIT + X_SCREEN - 2.2) / 2, Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, X_SCREEN - 2.2 - X_QUBIT, 12]} />
        <meshStandardMaterial color="#9aa0a8" metalness={0.9} roughness={0.35} />
      </mesh>

      {/* qubit package */}
      <group position={[X_QUBIT, Y, 0]}>
        <RoundedBox args={[2, 1.2, 2]} radius={0.08}><meshStandardMaterial color="#b8753f" metalness={0.9} roughness={0.35} /></RoundedBox>
        <mesh position={[0, 0.62, 0]}><boxGeometry args={[0.8, 0.03, 0.8]} /><meshStandardMaterial color="#c9c3b6" metalness={0.9} roughness={0.25} /></mesh>
        <Html position={[0, -1.3, 0]} center className="b-tag strong">Qubit</Html>
      </group>

      {/* empty slots */}
      {SLOT_X.map((x, i) => i >= chain.length && (
        <mesh key={i} position={[x, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 0.86, 48]} />
          <meshBasicMaterial color="#5d5a52" transparent opacity={0.6} />
        </mesh>
      ))}
      {chain.map((id, i) => <PartModel key={i + id} id={id} x={SLOT_X[i]} index={i} />)}

      {/* HEMT at 4 K */}
      <group position={[X_HEMT, Y, 0]}>
        <RoundedBox args={[1.6, 1.2, 1.4]} radius={0.06}><meshStandardMaterial color="#c9a24c" metalness={0.9} roughness={0.3} /></RoundedBox>
        <Html position={[0, -1.3, 0]} center className="b-tag strong">HEMT, 4 K</Html>
      </group>

      <Pulse />
      <BackNoise />
      <Monitor x={X_SCREEN} />
      <Rig />
      <EffectComposer multisampling={4}>
        <Bloom luminanceThreshold={1.1} intensity={0.6} radius={0.4} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <Vignette offset={0.3} darkness={0.6} />
      </EffectComposer>
    </Canvas>
  )
}
