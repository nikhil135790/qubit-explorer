import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import type { Line2 } from 'three-stdlib'
import * as THREE from 'three'
import { Rect, Cpw, FILM, GAP, Y_GROUND } from '../journey/Chip'
import { READOUT_PHASE, READOUT_AMP } from '../journey/state'
import { Label } from '../scene/common'
import { PulseTrail } from './PulseTrail'
import type { TrailSpec } from './PulseTrail'
import { Bond, GOLD, PCB } from './StationQubit'
import { usePath, seg } from './state'

// Scene units: 1 = 0.1 mm. A 5 mm amplifier chip: three resonators (a, b, c) meeting at a
// Josephson ring modulator, a pump line, and an on-chip resistor that drains mode c.
const RESISTOR = { color: '#5c3b30', metalness: 0.3, roughness: 0.6 }
const OXIDE = { color: '#7fd6ff', metalness: 0.2, roughness: 0.3 }

const RES_A: [number, number][] = [[-24, 4], [-19, 4], [-19, 8.5], [-16.5, 8.5], [-16.5, -0.5], [-14, -0.5], [-14, 8.5], [-11.5, 8.5], [-11.5, -0.5], [-9, -0.5], [-9, 8.5], [-6.5, 8.5], [-6.5, 4], [-4, 4], [-4, 2], [-1.6, 2]]
const RES_B: [number, number][] = RES_A.map(([x, z]) => [-x, z])
const RES_C: [number, number][] = [[0, 0.4], [0, -3], [4.5, -3], [4.5, -5.5], [-4.5, -5.5], [-4.5, -8], [4.5, -8], [4.5, -10.5], [-4.5, -10.5], [-4.5, -13], [0, -13], [0, -15.5]]
const PUMP: [number, number][] = [[0, 24], [0, 4.6]]

function AmpChip() {
  return (
    <group>
      <mesh position={[0, -0.6, 0]}><boxGeometry args={[50, 1.2, 50]} /><meshStandardMaterial {...GAP} /></mesh>
      <Rect x={0} z={0} w={50} d={50} y={Y_GROUND} mat={FILM} h={0.02} />
      <Cpw pts={RES_A} wc={0.5} wg={1.1} />
      <Cpw pts={RES_B} wc={0.5} wg={1.1} />
      <Cpw pts={RES_C} wc={0.5} wg={1.1} />
      <Cpw pts={PUMP} wc={0.7} wg={1.6} />
      {/* thin-film resistor terminating mode c: a dark meander to ground */}
      <mesh position={[0, 0.07, -18.2]}><boxGeometry args={[5.5, 0.02, 5.8]} /><meshStandardMaterial {...GAP} /></mesh>
      {[-17, -18.2, -19.4].map((z) => <mesh key={z} position={[0, 0.085, z]}><boxGeometry args={[4, 0.02, 0.45]} /><meshStandardMaterial {...RESISTOR} /></mesh>)}
      {[[-2, -17.6], [2, -18.8]].map(([x, z]) => <mesh key={x} position={[x, 0.085, z]}><boxGeometry args={[0.45, 0.02, 1.65]} /><meshStandardMaterial {...RESISTOR} /></mesh>)}
      {/* Josephson ring modulator: a small superconducting loop with a junction on each side */}
      <group position={[0, 0.09, 2]}>
        <mesh position={[0, 0, 1.4]}><boxGeometry args={[3, 0.03, 0.25]} /><meshStandardMaterial {...FILM} /></mesh>
        <mesh position={[0, 0, -1.4]}><boxGeometry args={[3, 0.03, 0.25]} /><meshStandardMaterial {...FILM} /></mesh>
        <mesh position={[1.4, 0, 0]}><boxGeometry args={[0.25, 0.03, 3]} /><meshStandardMaterial {...FILM} /></mesh>
        <mesh position={[-1.4, 0, 0]}><boxGeometry args={[0.25, 0.03, 3]} /><meshStandardMaterial {...FILM} /></mesh>
        {[[0, 1.4], [0, -1.4], [1.4, 0], [-1.4, 0]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x, 0.03, z]}><boxGeometry args={[0.4, 0.05, 0.4]} /><meshStandardMaterial {...OXIDE} emissive="#2a7fa8" emissiveIntensity={0.6} /></mesh>)}
      </group>
      {/* bond pads */}
      {[[-23.6, 4], [23.6, 4], [0, 23.6]].map(([x, z]) => <Rect key={`${x}${z}`} x={x} z={z} w={3} d={3} y={0.085} mat={FILM} h={0.02} />)}
    </group>
  )
}

function AmpPackage() {
  const bonds: [[number, number, number], [number, number, number]][] = []
  for (const dz of [-1, 0, 1]) {
    bonds.push([[-23.6, 0.1, 4 + dz], [-30, 0.1, 4 + dz]])
    bonds.push([[23.6, 0.1, 4 + dz], [30, 0.1, 4 + dz]])
    bonds.push([[dz, 0.1, 23.6], [dz, 0.1, 30]])
  }
  for (const z of [-20, -10, 14]) { bonds.push([[-24.5, 0.1, z], [-30, 0.1, z]]); bonds.push([[24.5, 0.1, z], [30, 0.1, z]]) }
  return (
    <group>
      {[[-54, 0, 56, 170], [54, 0, 56, 170], [0, -55, 52, 56], [0, 55, 52, 56]].map(([x, z, w, d], i) => (
        <group key={i}>
          <mesh position={[x, -7.4, z]}><boxGeometry args={[w, 15, d]} /><meshStandardMaterial {...PCB} /></mesh>
          <mesh position={[x, 0.09, z]}><boxGeometry args={[w, 0.2, d]} /><meshStandardMaterial {...GOLD} /></mesh>
        </group>
      ))}
      {/* board traces to the connectors */}
      {[[-55, 4, 50, 5], [55, 4, 50, 5]].map(([x, z, w], i) => (
        <group key={i}>
          <mesh position={[x, 0.2, z]}><boxGeometry args={[w, 0.05, 6]} /><meshStandardMaterial color="#2a241b" /></mesh>
          <mesh position={[x, 0.28, z]}><boxGeometry args={[w, 0.08, 2.6]} /><meshStandardMaterial {...GOLD} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.2, 55]}><boxGeometry args={[6, 0.05, 50]} /><meshStandardMaterial color="#2a241b" /></mesh>
      <mesh position={[0, 0.28, 55]}><boxGeometry args={[2.6, 0.08, 50]} /><meshStandardMaterial {...GOLD} /></mesh>
      {bonds.map(([a, b], i) => <Bond key={i} from={a} to={b} h={3} />)}
      <mesh position={[0, -20, 0]}><boxGeometry args={[190, 10, 190]} /><meshStandardMaterial color="#9c5f35" metalness={1} roughness={0.4} /></mesh>
      {[[0, 92, 190, 8], [0, -92, 190, 8], [92, 0, 8, 176], [-92, 0, 8, 176]].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, -4, z]}><boxGeometry args={[w, 22, d]} /><meshStandardMaterial color="#9c5f35" metalness={1} roughness={0.4} /></mesh>
      ))}
      {([[-92, 4, Math.PI / 2], [92, 4, -Math.PI / 2]] as const).map(([x, z, r]) => (
        <group key={x} position={[x, 0.5, z]} rotation={[0, 0, r]}>
          <mesh><cylinderGeometry args={[6, 6, 22, 32]} /><meshStandardMaterial {...GOLD} /></mesh>
          <mesh position={[0, 14, 0]}><cylinderGeometry args={[4.5, 4.5, 9, 6]} /><meshStandardMaterial {...GOLD} /></mesh>
        </group>
      ))}
      <group position={[0, 0.5, 92]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh><cylinderGeometry args={[6, 6, 22, 32]} /><meshStandardMaterial {...GOLD} /></mesh>
        <mesh position={[0, -14, 0]}><cylinderGeometry args={[4.5, 4.5, 9, 6]} /><meshStandardMaterial {...GOLD} /></mesh>
      </group>
    </group>
  )
}

/** The pump: a continuous purple tone running down the pump line into the ring. */
function PumpWave() {
  const ref = useRef<Line2>(null)
  const N = 160
  const buf = useMemo(() => new Float32Array(N * 3), [])
  const init = useMemo(() => Array.from({ length: N }, () => [0, 0, 0] as [number, number, number]), [])
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (let i = 0; i < N; i++) {
      const z = 95 - (i / (N - 1)) * (95 - 4.6)
      const ph = z * 1.6 + t * 9
      buf.set([0.45 * Math.sin(ph), 0.5 + 0.45 * Math.cos(ph), z], i * 3)
    }
    ref.current?.geometry.setPositions(buf)
  })
  return <Line ref={ref} points={init} color="#c39bff" lineWidth={1.6} toneMapped={false} transparent opacity={0.8} />
}

/** Arc length (scene units) along a curve at the point nearest a given x (for curves that move mostly in x). */
function arcAtX(curve: THREE.Curve<THREE.Vector3>, x: number) {
  const pts = curve.getSpacedPoints(1200)
  const len = curve.getLength()
  let best = 0
  for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i].x - x) < Math.abs(pts[best].x - x)) best = i
  return (best / (pts.length - 1)) * len
}

const v3 = (p: [number, number, number][]) => new THREE.CatmullRomCurve3(p.map((q) => new THREE.Vector3(...q)), false, 'centripetal')
const FORWARD: [number, number, number][] = [[-130, 0.6, 4], [-92, 0.6, 4], [-45, 0.6, 4], [-30, 0.6, 4], [-27.5, 2.4, 4], [-25.5, 3.2, 4], [-23.6, 0.3, 4], [-12, 0.3, 4], [-4, 0.3, 4], [-1.6, 0.3, 2], [0, 0.3, 2], [1.6, 0.3, 2], [4, 0.3, 4], [12, 0.3, 4], [23.6, 0.3, 4], [25.5, 3.2, 4], [27.5, 2.4, 4], [30, 0.6, 4], [92, 0.6, 4], [140, 0.6, 4]]
const DETOUR: [number, number, number][] = [[-1.6, 0.35, 2], [-0.7, 0.35, 0.4], [-0.7, 0.35, -6], [-0.7, 0.35, -12.5], [0, 0.35, -14], [0.7, 0.35, -12.5], [0.7, 0.35, -6], [0.7, 0.35, 0.4], [1.6, 0.35, 2], [4, 0.35, 4]]
const NOISE_IN: [number, number, number][] = [[140, 0.6, 4.8], [92, 0.6, 4.8], [30, 0.6, 4.8], [27.5, 2.4, 4.8], [25.5, 3.2, 4.8], [23.6, 0.4, 4.8], [12, 0.4, 4.8], [4, 0.4, 4.5], [1.6, 0.4, 2.4], [0, 0.4, 2.2], [-1.6, 0.4, 2.4], [-4, 0.4, 4.4], [-10, 0.4, 4.6]]
const NOISE_DRAIN: [number, number, number][] = [[0, 0.45, 1.6], [0, 0.45, -6], [0, 0.45, -13], [0, 0.45, -16], [0, 0.45, -19.5]]

export function StationAmp() {
  const { camera } = useThree()
  const fwd = useMemo(() => v3(FORWARD), [])
  const det = useMemo(() => v3(DETOUR), [])
  const nin = useMemo(() => v3(NOISE_IN), [])
  const ndr = useMemo(() => v3(NOISE_DRAIN), [])
  const L = useMemo(() => ({
    fwd: fwd.getLength(), det: det.getLength(), nin: nin.getLength(), ndr: ndr.getLength(),
    ringIn: arcAtX(fwd, -1.6), resB: arcAtX(fwd, 4), ringNoise: arcAtX(nin, 0),
  }), [fwd, det, nin, ndr])
  const vis = useRef(1)

  // forward pulse: arrive at the ring, cross it while the detour copy runs, then leave through b
  const fwdArc = (u: number) => {
    if (u < 0.08) return -999
    if (u < 0.3) return ((u - 0.08) / 0.22) * L.ringIn
    if (u < 0.48) return L.ringIn + ((u - 0.3) / 0.18) * (L.resB - L.ringIn)
    return L.resB + ((u - 0.48) / 0.12) * (L.fwd - L.resB)
  }
  const detArc = (u: number) => (u < 0.3 || u > 0.5 ? -999 : ((u - 0.3) / 0.18) * L.det)
  const ninArc = (u: number) => (u < 0.6 ? -999 : ((u - 0.6) / 0.22) * L.nin)
  const ndrArc = (u: number) => { const a = ninArc(u); return a < L.ringNoise ? -999 : a - L.ringNoise }

  const twist = () => READOUT_PHASE[usePath.getState().qubit]
  const specs = useMemo(() => {
    const fwdSpec: TrailSpec = {
      center: () => fwdArc(usePath.getState().u), width: 4, pitch: 3.2,
      // 20 dB of power gain is 10x in amplitude; drawn as ~3.5x so it stays on screen
      radius: (a) => vis.current * 0.9 * READOUT_AMP * (a < L.ringIn ? 1 : a < L.resB ? 1 + 2.5 * ((a - L.ringIn) / (L.resB - L.ringIn)) : 3.5),
      twist,
    }
    const detSpec: TrailSpec = { center: () => detArc(usePath.getState().u), width: 3, pitch: 3.2, radius: () => vis.current * 0.9, twist }
    const ninSpec: TrailSpec = {
      center: () => ninArc(usePath.getState().u), width: 5, pitch: 2.6,
      radius: (a) => vis.current * 1.1 * (a < L.ringNoise ? 1 : Math.exp(-(a - L.ringNoise) / 1.2)), // cancels past the ring
      twist: () => 0, fuzz: () => 0.9,
    }
    const ndrSpec: TrailSpec = {
      center: () => ndrArc(usePath.getState().u), width: 4, pitch: 2.6,
      radius: (a) => vis.current * 1.1 * Math.exp(-Math.max(0, a - 14) / 2.5), // absorbed in the resistor
      twist: () => 0, fuzz: () => 0.9,
    }
    return { fwdSpec, detSpec, ninSpec, ndrSpec }
  }, [L])

  const look = useRef(new THREE.Vector3(0, 0, 0))
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), pos: new THREE.Vector3(), lk: new THREE.Vector3() }), [])
  useFrame((_, dt) => {
    const { u, playing } = usePath.getState()
    const a = Math.max(0, Math.min(L.fwd, fwdArc(u)))
    fwd.getPointAt(a / L.fwd, tmp.p)
    const chase = tmp.p.clone().add(new THREE.Vector3(-9, 11, 15).multiplyScalar(1 + 1.5 * seg(u, 0.44, 0.56)))
    const K = [
      { pos: new THREE.Vector3(-140, 160, 210), look: new THREE.Vector3(0, 0, 0) },
      { pos: chase, look: tmp.p.clone() },
      { pos: new THREE.Vector3(10, 36, 34), look: new THREE.Vector3(1, 0, -2) },
      { pos: new THREE.Vector3(175, 70, 110), look: new THREE.Vector3(92, 0, 4) },
    ]
    tmp.pos.copy(K[0].pos).lerp(K[1].pos, seg(u, 0.06, 0.2)).lerp(K[2].pos, seg(u, 0.5, 0.6)).lerp(K[3].pos, seg(u, 0.86, 0.98))
    tmp.lk.copy(K[0].look).lerp(K[1].look, seg(u, 0.06, 0.2)).lerp(K[2].look, seg(u, 0.5, 0.6)).lerp(K[3].look, seg(u, 0.86, 0.98))
    vis.current = Math.max(1, camera.position.distanceTo(look.current) / 24)
    if (!playing) return
    const k = 1 - Math.exp(-dt * 3)
    camera.position.lerp(tmp.pos, k)
    look.current.lerp(tmp.lk, k)
    camera.lookAt(look.current)
  })

  return (
    <group>
      <AmpChip />
      <AmpPackage />
      <PumpWave />
      <PulseTrail curve={fwd} spec={specs.fwdSpec} />
      <PulseTrail curve={det} spec={specs.detSpec} color="#ffe2a8" width={2} />
      <PulseTrail curve={nin} spec={specs.ninSpec} color="#ff5a64" width={2.2} />
      <PulseTrail curve={ndr} spec={specs.ndrSpec} color="#ff5a64" width={2.2} />
      <Label pos={[-12, 0.5, 10]}>Mode a (input, faces the qubit)</Label>
      <Label pos={[12, 0.5, 10]}>Mode b (output)</Label>
      <Label pos={[6, 0.5, -9]}>Mode c (heavily damped)</Label>
      <Label pos={[2.2, 0.6, 2]}>Josephson ring: 4 junctions</Label>
      <Label pos={[3.5, 0.5, -18.2]}>On-chip resistor</Label>
      <Label pos={[2, 1, 30]}>Pump tones</Label>
    </group>
  )
}

export function captionAmp(u: number) {
  if (u < 0.12) return 'The directional amplifier: a 5 mm chip in its own copper box. Purple is the pump tone powering it.'
  if (u < 0.3) return 'The pulse enters mode $a$, the side that faces the qubit.'
  if (u < 0.42) return 'At the Josephson ring it splits: straight to $b$, or a detour through $c$.'
  if (u < 0.58) return 'The two routes arrive in step and add up. It leaves $b$ with about 100 times the power (drawn smaller so it fits).'
  if (u < 0.7) return 'Now noise from the 4 K amplifier arrives at $b$, heading back toward the qubit.'
  if (u < 0.86) return 'Going backward, the two routes arrive out of step and cancel. What’s left drains into $c$’s resistor.'
  return 'Out through the output connector, toward the isolator.'
}
