import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Chip, Cpw, Rect, FILM, GAP, Y_GAP, Y_TRACE } from '../journey/Chip'
import { READOUT_PHASE, READOUT_AMP } from '../journey/state'
import { Label } from '../scene/common'
import { PulseTrail } from './PulseTrail'
import type { TrailSpec } from './PulseTrail'
import { usePath, seg } from './state'

// Scene units: 1 = 0.1 mm. The chip (9 x 6 mm) sits in a pocket of a gold-plated circuit board.
export const GOLD = { color: '#c39a4c', metalness: 1, roughness: 0.34 }
export const PCB = { color: '#3b3428', metalness: 0.1, roughness: 0.8 }
export const AL = { color: '#d3d0c8', metalness: 1, roughness: 0.25 }

export function Bond({ from, to, h = 4 }: { from: [number, number, number]; to: [number, number, number]; h?: number }) {
  const curve = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to)
    const m = a.clone().lerp(b, 0.35).setY(Math.max(a.y, b.y) + h)
    return new THREE.QuadraticBezierCurve3(a, m, b)
  }, [from, to, h])
  return <mesh><tubeGeometry args={[curve, 24, 0.13, 6, false]} /><meshStandardMaterial {...AL} /></mesh>
}

function Package() {
  const bonds: [[number, number, number], [number, number, number]][] = []
  for (const z of [-1.4, 0, 1.4]) { bonds.push([[41, 0.09, z], [53, 0.09, z]]); bonds.push([[-41, 0.09, z], [-53, 0.09, z]]) }
  for (const z of [-30, -20, -10, 10, 18]) { bonds.push([[44, 0.09, z], [53, 0.09, z]]); bonds.push([[-44, 0.09, z], [-53, 0.09, z]]) }
  return (
    <group>
      {/* circuit board with a pocket for the chip */}
      {[[-108, 0, 124, 340], [108, 0, 124, 340], [0, -104, 92, 132], [0, 98, 92, 148]].map(([x, z, w, d], i) => (
        <group key={i}>
          <mesh position={[x, -7.4, z]}><boxGeometry args={[w, 15, d]} /><meshStandardMaterial {...PCB} /></mesh>
          <mesh position={[x, 0.09, z]}><boxGeometry args={[w, 0.2, d]} /><meshStandardMaterial {...GOLD} /></mesh>
        </group>
      ))}
      {/* board trace (coplanar waveguide) from the bond pad to the connector */}
      <mesh position={[110, 0.2, 0]}><boxGeometry args={[116, 0.05, 7]} /><meshStandardMaterial color="#2a241b" roughness={0.8} /></mesh>
      <mesh position={[110, 0.28, 0]}><boxGeometry args={[116, 0.08, 3]} /><meshStandardMaterial {...GOLD} /></mesh>
      <mesh position={[-110, 0.2, 0]}><boxGeometry args={[116, 0.05, 7]} /><meshStandardMaterial color="#2a241b" roughness={0.8} /></mesh>
      <mesh position={[-110, 0.28, 0]}><boxGeometry args={[116, 0.08, 3]} /><meshStandardMaterial {...GOLD} /></mesh>
      {/* bond pads at the chip edge */}
      {[-41, 41].map((x) => <mesh key={x} position={[x, 0.09, 0]}><boxGeometry args={[5, 0.03, 5]} /><meshStandardMaterial {...AL} /></mesh>)}
      {bonds.map(([a, b], i) => <Bond key={i} from={a} to={b} />)}
      {/* copper package base and low walls */}
      <mesh position={[0, -20, 0]}><boxGeometry args={[380, 10, 380]} /><meshStandardMaterial color="#9c5f35" metalness={1} roughness={0.4} /></mesh>
      {[[0, 185, 380, 10], [0, -185, 380, 10], [185, 0, 10, 360], [-185, 0, 10, 360]].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, -4, z]}><boxGeometry args={[w, 22, d]} /><meshStandardMaterial color="#9c5f35" metalness={1} roughness={0.4} /></mesh>
      ))}
      {/* SMA connectors through the walls */}
      {[1, -1].map((s) => (
        <group key={s} position={[s * 185, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh><cylinderGeometry args={[6, 6, 24, 32]} /><meshStandardMaterial {...GOLD} /></mesh>
          <mesh position={[0, s * 16, 0]}><cylinderGeometry args={[4.5, 4.5, 10, 6]} /><meshStandardMaterial {...GOLD} /></mesh>
          <mesh position={[0, -s * 14, 0]}><cylinderGeometry args={[0.6, 0.6, 6, 12]} /><meshStandardMaterial {...GOLD} /></mesh>
        </group>
      ))}
    </group>
  )
}

/** Another qubit on the same feedline. A different number of meander turns means a different
 *  resonator length, so a different readout frequency: that's how one line reads several qubits. */
function ExtraQubit({ x0, turns }: { x0: number; turns: number }) {
  const pts: [number, number][] = [[x0 - 4, -2.6], [x0 + 4, -2.6]]
  let right = true
  for (let i = 1; i <= turns; i++) {
    const z = -2.6 - 1.6 * i
    pts.push([right ? x0 + 4 : x0 - 4, z], [right ? x0 - 4 : x0 + 4, z])
    right = !right
  }
  const zl = -2.6 - 1.6 * turns
  pts.push([x0, zl], [x0, zl - 2.5])
  const qz = zl - 5.4
  return (
    <group>
      <Cpw pts={pts} wc={0.5} wg={1.1} />
      <group position={[x0, 0, qz]}>
        <Rect x={0} z={0} w={7.0} d={1.8} y={Y_GAP} mat={GAP} />
        <Rect x={0} z={0} w={1.8} d={7.0} y={Y_GAP} mat={GAP} />
        <Rect x={0} z={0} w={5.4} d={0.6} y={Y_TRACE} mat={FILM} h={0.012} />
        <Rect x={0} z={0} w={0.6} d={5.4} y={Y_TRACE} mat={FILM} h={0.012} />
        <mesh position={[0, 0.088, -3.1]}><boxGeometry args={[0.1, 0.02, 0.85]} /><meshStandardMaterial color="#e9e3d4" metalness={1} roughness={0.2} /></mesh>
      </group>
    </group>
  )
}

// where the pulse travels: along the chip feedline, over a wire bond, along the board, into the connector
const PATH_PTS: [number, number, number][] = [
  [-40, 0.3, 0], [0, 0.3, 0], [40, 0.3, 0], [44, 2.6, 0], [47.5, 4.1, 0], [51, 2.6, 0], [55, 0.6, 0], [100, 0.6, 0], [160, 0.6, 0], [178, 0.6, 0], [205, 0.6, 0],
]
const RES_ARC = 40 // the resonator couples to the feedline here (x = 0 on the chip)
const PULSE_START = 0.42

export function StationQubit() {
  const { camera } = useThree()
  const curve = useMemo(() => new THREE.CatmullRomCurve3(PATH_PTS.map((p) => new THREE.Vector3(...p)), false, 'centripetal'), [])
  const len = useMemo(() => curve.getLength(), [curve])
  const vis = useRef(1) // drawing scale: keeps the pulse readable as the camera pulls back
  // slow on the chip so you can watch the resonator interaction, faster once it leaves
  const arcAt = (u: number) => {
    if (u < PULSE_START) return -999
    const v = (u - PULSE_START) / (1 - PULSE_START)
    if (v < 0.3) return (v / 0.3) * 40
    if (v < 0.55) return 40 + ((v - 0.3) / 0.25) * 20
    return 60 + ((v - 0.55) / 0.45) * (len - 60)
  }
  const spec = useMemo<TrailSpec>(() => ({
    center: () => arcAt(usePath.getState().u),
    width: 5,
    pitch: 4,
    radius: (a) => vis.current * 1.1 * (a > RES_ARC ? READOUT_AMP : 1),
    twist: (a) => (a > RES_ARC ? READOUT_PHASE[usePath.getState().qubit] : 0),
  }), [len])
  const ghost = useMemo<TrailSpec>(() => ({
    ...spec,
    radius: (a) => (a > RES_ARC + 2 ? vis.current * 1.1 * READOUT_AMP : 0),
    twist: (a) => (a > RES_ARC ? READOUT_PHASE[usePath.getState().qubit === 1 ? 0 : 1] : 0),
  }), [spec])

  // camera: whole chip, dive to the transmon, then ride behind the pulse and pull back as it leaves the chip
  const look = useRef(new THREE.Vector3(0, 0, -6))
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), pos: new THREE.Vector3(), lk: new THREE.Vector3() }), [])
  useFrame((_, dt) => {
    const { u, playing } = usePath.getState()
    const a = Math.max(0, arcAt(u))
    curve.getPointAt(Math.min(1, a / len), tmp.p)
    const s = 1 + Math.max(0, a - 44) / 22
    const chasePos = tmp.p.clone().add(new THREE.Vector3(-13, 9, 16).multiplyScalar(s))
    // open on the transmon itself (pads and junction), pull back to the whole chip, then pick up the pulse
    const k0 = { pos: new THREE.Vector3(3.2, 4.4, -12.5 - 1.2 * seg(u, 0, 0.12)), look: new THREE.Vector3(0, 0, -17.4) }
    const k1 = { pos: new THREE.Vector3(55, 90, 105), look: new THREE.Vector3(0, 0, -6) }
    tmp.pos.copy(k0.pos).lerp(k1.pos, seg(u, 0.13, 0.28)).lerp(chasePos, seg(u, 0.34, 0.46))
    tmp.lk.copy(k0.look).lerp(k1.look, seg(u, 0.13, 0.28)).lerp(tmp.p, seg(u, 0.34, 0.46))
    vis.current = Math.max(1, camera.position.distanceTo(look.current) / 22)
    if (!playing) return
    const k = 1 - Math.exp(-dt * 3)
    camera.position.lerp(tmp.pos, k)
    look.current.lerp(tmp.lk, k)
    camera.lookAt(look.current)
  })

  return (
    <group>
      <Chip pulseX={() => arcAt(usePath.getState().u) - RES_ARC} />
      <Package />
      <ExtraQubit x0={-28} turns={3} />
      <ExtraQubit x0={-14} turns={4} />
      <ExtraQubit x0={16} turns={6} />
      <PulseTrail curve={curve} spec={ghost} color="#86b5e0" width={1.6} />
      <PulseTrail curve={curve} spec={spec} />
      <Label pos={[0.6, 0.3, -19.1]}>Josephson junction</Label>
      <Label pos={[-2.2, 0.3, -16]}>Capacitor pad</Label>
      <Label pos={[-5, 0.4, -6]}>Readout resonator</Label>
      <Label pos={[47, 5, 3]}>Wire bonds</Label>
      <Label pos={[185, 9, 0]}>SMA connector</Label>
    </group>
  )
}

/** One line of narration for each part of the station. */
export function captionQubit(u: number, qubit: 0 | 1) {
  if (u < 0.14) return 'This is a transmon qubit. The cross is a capacitor pad, and the tiny bridge at the end of one arm is the Josephson junction.'
  if (u < 0.4) return 'Pulling back: the qubit is one small piece of a chip about 9 mm across, patterned in aluminum on silicon.'
  if (u < 0.57) return 'A probe pulse comes down the feedline. The corkscrew’s radius is its amplitude, its twist is its phase.'
  if (u < 0.75) return `It passes the readout resonator and leaves twisted by ${qubit === 1 ? '+45°' : '−45°'}, because the qubit is in |${qubit}⟩. Dashed: the other state.`
  if (u < 0.88) return 'Off the chip, over aluminum wire bonds about 25 µm thick, onto the circuit board.'
  return 'Into the connector. Next stop: the directional amplifier.'
}
