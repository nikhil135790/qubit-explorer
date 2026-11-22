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
import { usePath, seg, ampU, useSettled } from './state'
import { blendShots, drive, rig } from './rig'
import type { Shot } from './rig'

// Scene units: 1 = 0.1 mm. A 5 mm amplifier chip: three resonators (a, b, c) meeting at a
// Josephson ring modulator, a pump line, and an on-chip resistor that drains mode c.
const RESISTOR = { color: '#5c3b30', metalness: 0.3, roughness: 0.6 }
const OXIDE = { color: '#7fd6ff', metalness: 0.2, roughness: 0.3 }

const RES_A: [number, number][] = [[-24, 4], [-19, 4], [-19, 8.5], [-16.5, 8.5], [-16.5, -0.5], [-14, -0.5], [-14, 8.5], [-11.5, 8.5], [-11.5, -0.5], [-9, -0.5], [-9, 8.5], [-6.5, 8.5], [-6.5, 4], [-4, 4], [-4, 2], [-1.6, 2]]
const RES_B: [number, number][] = RES_A.map(([x, z]) => [-x, z])
const RES_C: [number, number][] = [[0, 0.4], [0, -3], [4.5, -3], [4.5, -5.5], [-4.5, -5.5], [-4.5, -8], [4.5, -8], [4.5, -10.5], [-4.5, -10.5], [-4.5, -13], [0, -13], [0, -15.5]]
const PUMP: [number, number][] = [[0, 24], [0, 4.6]]

export function AmpChip() {
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

export function AmpPackage({ lite = false }: { lite?: boolean } = {}) {
  const bonds: [[number, number, number], [number, number, number]][] = []
  for (const dz of [-1, 0, 1]) {
    bonds.push([[-23.6, 0.1, 4 + dz], [-30, 0.1, 4 + dz]])
    bonds.push([[23.6, 0.1, 4 + dz], [30, 0.1, 4 + dz]])
    bonds.push([[dz, 0.1, 23.6], [dz, 0.1, 30]])
  }
  for (const z of [-20, -10, 14]) { bonds.push([[-24.5, 0.1, z], [-30, 0.1, z]]); bonds.push([[24.5, 0.1, z], [30, 0.1, z]]) }
  for (const x of [-18, -9, 9, 18]) { bonds.push([[x, 0.1, -24.5], [x, 0.1, -30]]); bonds.push([[x, 0.1, 24.5], [x, 0.1, 30]]) }
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
      {!lite && bonds.map(([a, b], i) => <Bond key={i} from={a} to={b} h={3} />)}
      <mesh position={[0, -20, 0]}><boxGeometry args={[190, 10, 190]} /><meshStandardMaterial color="#9c5f35" metalness={1} roughness={0.4} /></mesh>
      {[[0, 92, 190, 8], [0, -92, 190, 8], [92, 0, 8, 176], [-92, 0, 8, 176]].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, -4, z]}><boxGeometry args={[w, 22, d]} /><meshStandardMaterial color="#9c5f35" metalness={1} roughness={0.4} /></mesh>
      ))}
      {([[-92, 4, Math.PI / 2], [92, 4, -Math.PI / 2]] as const).map(([x, z, r]) => (
        <group key={x} position={[x, 0.6, z]} rotation={[0, 0, r]}>
          <mesh><cylinderGeometry args={[10, 10, 22, 40, 1, true]} /><meshStandardMaterial {...GOLD} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 15, 0]}><cylinderGeometry args={[12, 12, 9, 6, 1, true]} /><meshStandardMaterial {...GOLD} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} /></mesh>
          <mesh><cylinderGeometry args={[0.6, 0.6, 30, 12]} /><meshStandardMaterial {...GOLD} /></mesh>
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
  useFrame(() => {
    const t = usePath.getState().time // freezes when paused
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

export const X_AMP = 900 // 9 cm from the qubit package, along the cold plate

// the coax from the qubit box's output connector to the amplifier box's input connector (world coordinates)
const CABLE: [number, number, number][] = [[207, 0.6, 0], [260, 0.6, 0], [330, 22, 0], [480, 34, 2], [630, 22, 4], [720, 0.6, 4], [X_AMP - 108, 0.6, 4]]

function Cable({ curve }: { curve: THREE.Curve<THREE.Vector3> }) {
  return (
    <group>
      <mesh><tubeGeometry args={[curve, 160, 9, 24, false]} /><meshStandardMaterial color="#b8bcc2" metalness={0.8} roughness={0.3} transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      {/* centre conductor */}
      <mesh><tubeGeometry args={[curve, 160, 1.2, 8, false]} /><meshStandardMaterial color="#d9c08a" metalness={1} roughness={0.3} /></mesh>
      {/* connector nuts at both ends */}
      {[0, 1].map((t) => { const p = curve.getPointAt(t); return <mesh key={t} position={p} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[12, 12, 10, 6]} /><meshStandardMaterial color="#c39a4c" metalness={1} roughness={0.34} /></mesh> })}
    </group>
  )
}

/** u for this station's own timeline: 0 before we get here, 1 once we've moved on. */
const stationU = () => { const st = usePath.getState(); return st.station === 1 ? st.u : st.station > 1 ? 1 : 0 }
const here = () => usePath.getState().station === 1

export function StationAmp() {
  const settled = useSettled()
  const beat = usePath((st) => (st.station === 1 && settled ? st.beat : -1))
  const { camera } = useThree()
  const fwd = useMemo(() => v3(FORWARD), [])
  const det = useMemo(() => v3(DETOUR), [])
  const nin = useMemo(() => v3(NOISE_IN), [])
  const ndr = useMemo(() => v3(NOISE_DRAIN), [])
  const L = useMemo(() => ({
    fwd: fwd.getLength(), det: det.getLength(), nin: nin.getLength(), ndr: ndr.getLength(),
    ringIn: arcAtX(fwd, -1.6), resB: arcAtX(fwd, 4), ringNoise: arcAtX(nin, 0), connIn: arcAtX(fwd, -84), connOut: arcAtX(fwd, 84),
  }), [fwd, det, nin, ndr])
  const vis = useRef(1)

  // forward pulse at one steady speed V everywhere except inside the ring, where it lingers while it is
  // amplified (a real pulse dwells in the resonators). It drifts off the chip at the end of the "add" step,
  // and in the last step it is seen again leaving through the output connector, at the same speed.
  const V = L.ringIn / 0.22
  const fwdArc = (u: number) => {
    if (!here() || u < 0.08) return -999
    if (u < 0.3) return (u - 0.08) * V
    if (u < 0.48) return L.ringIn + ((u - 0.3) / 0.18) * (L.resB - L.ringIn)
    if (u < 0.58) return L.resB + (u - 0.48) * V
    if (u < 0.86) return -999
    return L.resB + 0.1 * V + (u - 0.86) * V
  }
  const fade = (u: number) => (u < 0.58 ? 1 - seg(u, 0.55, 0.58) : u > 0.86 ? seg(u, 0.86, 0.88) : 0)
  const detArc = (u: number) => (!here() || u < 0.3 || u > 0.5 ? -999 : ((u - 0.3) / 0.18) * L.det)
  const ninArc = (u: number) => (!here() || u < 0.6 ? -999 : ((u - 0.6) / 0.22) * L.nin)
  const ndrArc = (u: number) => { const a = ninArc(u); return a < L.ringNoise ? -999 : a - L.ringNoise }

  const twist = () => READOUT_PHASE[usePath.getState().qubit]
  const specs = useMemo(() => {
    const inConn = (a: number) => {
      const k1 = Math.max(0, Math.min(1, (L.connIn - a) / 8)), k2 = Math.max(0, Math.min(1, (a - L.connOut) / 8))
      return Math.max(k1, k2)
    }
    const fwdR = (a: number) => vis.current * 0.9 * READOUT_AMP * (a < L.ringIn ? 1 : a < L.resB ? 1 + 2.5 * ((a - L.ringIn) / (L.resB - L.ringIn)) : 3.5)
    const fwdSpec: TrailSpec = {
      lift: (a) => fwdR(a) * 2.4 * (1 - inConn(a)),
      center: () => fwdArc(ampU(stationU())), width: 4, pitch: 3.2,
      // 20 dB of power gain is 10x in amplitude; drawn as ~3.5x so it stays on screen
      radius: (a) => { const k = inConn(a), r = fwdR(a); return (r * (1 - k) + Math.min(r, 6) * k) * fade(ampU(stationU())) },
      twist,
    }
    const detSpec: TrailSpec = { center: () => detArc(ampU(stationU())), width: 3, pitch: 3.2, radius: () => vis.current * 0.9, twist }
    const ninSpec: TrailSpec = {
      center: () => ninArc(ampU(stationU())), width: 5, pitch: 2.6,
      radius: (a) => vis.current * 1.1 * (a < L.ringNoise ? 1 : Math.exp(-(a - L.ringNoise) / 1.2)), // cancels past the ring
      twist: () => 0, fuzz: () => 0.9,
    }
    const ndrSpec: TrailSpec = {
      center: () => ndrArc(ampU(stationU())), width: 4, pitch: 2.6,
      radius: (a) => vis.current * 1.1 * Math.exp(-Math.max(0, a - 14) / 2.5), // absorbed in the resistor
      twist: () => 0, fuzz: () => 0.9,
    }
    return { fwdSpec, detSpec, ninSpec, ndrSpec }
  }, [L])

  const cable = useMemo(() => v3(CABLE), [])
  const cableLen = useMemo(() => cable.getLength(), [cable])
  const cableSpec = useMemo<TrailSpec>(() => ({
    center: () => (here() && stationU() < 0.1 ? (stationU() / 0.1) * cableLen : -999),
    width: 40, pitch: 34, lift: () => 0, // the field rides inside the cable, centred on its axis
    radius: () => 7,
    twist: () => READOUT_PHASE[usePath.getState().qubit],
  }), [cableLen])

  const tmp = useMemo(() => ({ p: new THREE.Vector3(), n: new THREE.Vector3(), c: new THREE.Vector3(), s1: { pos: new THREE.Vector3(), look: new THREE.Vector3() } as Shot }), [])
  const off = (x: number, y: number, z: number) => new THREE.Vector3(x + X_AMP, y, z)
  useFrame((_, dt) => {
    const su = stationU(), u = ampU(su)
    const a = Math.max(0, Math.min(L.fwd, fwdArc(u)))
    fwd.getPointAt(a / L.fwd, tmp.p)
    tmp.p.x += X_AMP
    const chase = tmp.p.clone().add(new THREE.Vector3(-9, 11, 15).multiplyScalar(1 + 1.5 * seg(u, 0.44, 0.56)))
    const K: Shot[] = [
      { pos: off(-140, 160, 210), look: off(0, 0, 0) },
      { pos: chase, look: tmp.p.clone() },
      { pos: off(10, 36, 34), look: off(1, 0, -2) },
      { pos: off(175, 70, 110), look: off(92, 0, 4) },
    ]
    let shot = blendShots(K[0], K[1], seg(u, 0.06, 0.2))
    shot = blendShots(shot, K[2], seg(u, 0.5, 0.6))
    // follow the noise in from the output connector, then settle back over the ring for the cancelling
    const na = Math.max(0, Math.min(L.nin, ninArc(u)))
    nin.getPointAt(na / L.nin, tmp.n)
    tmp.n.x += X_AMP
    const far = 1 + 2.2 * seg(tmp.n.x - X_AMP, 20, 90) // wider while the noise is still out on the board
    const noiseChase: Shot = { look: tmp.n.clone(), pos: tmp.n.clone().add(new THREE.Vector3(10, 16, 22).multiplyScalar(far)) }
    shot = blendShots(shot, noiseChase, seg(u, 0.58, 0.63) * (1 - seg(u, 0.76, 0.82)))
    shot = blendShots(shot, K[3], seg(u, 0.86, 0.98))
    // the cable ride: from where station 1 ended, up to a view of both boxes, then down to the amplifier box
    if (su < 0.1) {
      const ut = su / 0.1
      cable.getPointAt(Math.min(1, ut), tmp.c)
      const start: Shot = { pos: new THREE.Vector3(95, 77, 136), look: new THREE.Vector3(205, 0.6, 0) }
      const wide: Shot = { pos: new THREE.Vector3(tmp.c.x - 150, 620, 900), look: new THREE.Vector3(tmp.c.x * 0.6 + 480 * 0.4, 0, 30) }
      blendShots(start, wide, seg(ut, 0, 0.4), tmp.s1)
      shot = blendShots(tmp.s1, K[0], seg(ut, 0.6, 1))
    }
    vis.current = Math.max(1, camera.position.distanceTo(rig.look) / 24)
    const { paused, orbiting } = usePath.getState()
    if (!here() || paused || orbiting) return
    drive(camera, shot, dt)
  })

  return (
    <group>
      <Cable curve={cable} />
      <PulseTrail curve={cable} spec={cableSpec} />
      {beat === 0 && <Label open pos={[480, 50, 2]}>Coax cable</Label>}
      <group position={[X_AMP, 0, 0]}>
      <AmpChip />
      <AmpPackage />
      <PumpWave />
      <PulseTrail curve={fwd} spec={specs.fwdSpec} />
      <PulseTrail curve={det} spec={specs.detSpec} color="#ffe2a8" width={2} />
      <PulseTrail curve={nin} spec={specs.ninSpec} color="#ff5a64" width={2.2} />
      <PulseTrail curve={ndr} spec={specs.ndrSpec} color="#ff5a64" width={2.2} />
      {beat === 1 && <Label open pos={[2, 1, 30]}>Pump signal (power for the amplifier)</Label>}
      {beat >= 2 && beat <= 4 && <>
        <Label open pos={[-12, 0.5, 10]}>Mode a (faces the qubit)</Label>
        <Label open pos={[12, 0.5, 10]}>Mode b (output)</Label>
        <Label open pos={[6, 0.5, -9]}>Mode c</Label>
        <Label open pos={[2.4, 0.6, 2]}>Josephson ring</Label>
      </>}
      {beat === 5 && <Label open pos={[118, 6, 8]}>Noise coming down from the HEMT</Label>}
      {beat === 6 && <>
        <Label open pos={[6, 0.5, -9]}>Mode c</Label>
        <Label open pos={[3.5, 0.5, -18.2]}>On-chip resistor</Label>
      </>}
      </group>
    </group>
  )
}
