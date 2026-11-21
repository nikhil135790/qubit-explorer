import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ProcessorChip, QZ, MAIN_X } from './ProcessorChip'
import { READOUT_PHASE, READOUT_AMP } from '../journey/state'
import { Label } from '../scene/common'
import { PulseTrail } from './PulseTrail'
import type { TrailSpec } from './PulseTrail'
import { usePath, seg } from './state'
import { JunctionDetail, J } from './Junction'
import { blendShots, follow } from './rig'
import type { Shot } from './rig'

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

// where the pulse travels: along the chip feedline, over a wire bond, along the board, into the connector
const PATH_PTS: [number, number, number][] = [
  [-40, 0.3, 0], [0, 0.3, 0], [40, 0.3, 0], [44, 2.6, 0], [47.5, 4.1, 0], [51, 2.6, 0], [55, 0.6, 0], [100, 0.6, 0], [160, 0.6, 0], [178, 0.6, 0], [205, 0.6, 0],
]
const RES_ARC = 40 + MAIN_X // the followed qubit's resonator couples to the feedline here
const PULSE_START = 0.42

export function StationQubit() {
  const { camera } = useThree()
  const beat = usePath((st) => (st.station === 0 ? st.beat : -1))
  const curve = useMemo(() => new THREE.CatmullRomCurve3(PATH_PTS.map((p) => new THREE.Vector3(...p)), false, 'centripetal'), [])
  const len = useMemo(() => curve.getLength(), [curve])
  const vis = useRef(1) // drawing scale: keeps the pulse readable as the camera pulls back
  // slow on the chip so you can watch the resonator interaction, faster once it leaves
  const arcAt = (u: number) => {
    if (usePath.getState().station !== 0 || u < PULSE_START) return -999
    const v = (u - PULSE_START) / (1 - PULSE_START)
    if (v < 0.3) return (v / 0.3) * RES_ARC
    if (v < 0.55) return RES_ARC + ((v - 0.3) / 0.25) * 20
    return RES_ARC + 20 + ((v - 0.55) / 0.45) * (len - RES_ARC - 20)
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

  // camera: open on the qubit's pads, dive 1000x into the junction, back out to the whole chip,
  // then ride behind the pulse and pull back as it leaves the chip. Zooms blend in log space.
  const look = useRef(new THREE.Vector3(MAIN_X, 0, QZ))
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), a: { pos: new THREE.Vector3(), look: new THREE.Vector3() } as Shot, b: { pos: new THREE.Vector3(), look: new THREE.Vector3() } as Shot }), [])
  const kJ = useMemo<Shot>(() => {
    const lk = new THREE.Vector3(MAIN_X + 0.002, J.ySi, QZ + 0.001)
    return { look: lk, pos: lk.clone().add(new THREE.Vector3(0.45, 0.7, 0.55).normalize().multiplyScalar(0.016)) }
  }, [])
  const kChip = useMemo<Shot>(() => ({ pos: new THREE.Vector3(30, 78, 82), look: new THREE.Vector3(0, 0, -9) }), [])
  useFrame((_, dt) => {
    const { u, paused, orbiting, station } = usePath.getState()
    const a = Math.max(0, arcAt(u))
    curve.getPointAt(Math.min(1, a / len), tmp.p)
    const s = 1 + Math.max(0, a - 84) / 22 // start widening once the pulse reaches the chip edge
    const chase: Shot = { pos: tmp.p.clone().add(new THREE.Vector3(-13, 9, 16).multiplyScalar(s)), look: tmp.p.clone() }
    const p0 = seg(u, 0, 0.06)
    const kPads: Shot = { pos: new THREE.Vector3(MAIN_X + 3.2 - 0.6 * p0, 11.5 - 1.5 * p0, QZ + 8.5 - 1.2 * p0), look: new THREE.Vector3(MAIN_X, 0, QZ) }
    blendShots(kPads, kJ, seg(u, 0.06, 0.14), tmp.a)
    blendShots(tmp.a, kChip, seg(u, 0.15, 0.28), tmp.b)
    const target = blendShots(tmp.b, chase, seg(u, 0.34, 0.46))
    vis.current = Math.max(1, camera.position.distanceTo(look.current) / 22)
    if (station !== 0 || paused || orbiting) return
    follow(camera, look.current, target, 1 - Math.exp(-dt * 3))
  })

  return (
    <group>
      <ProcessorChip pulseX={() => arcAt(usePath.getState().u) - RES_ARC} />
      <Package />
      <PulseTrail curve={curve} spec={ghost} color="#86b5e0" width={1.6} />
      <PulseTrail curve={curve} spec={spec} />
      <JunctionDetail at={[MAIN_X, 0, QZ]} showPairs />
      {beat === 1 ? (
        <>
          <Label pos={[MAIN_X, J.ySi + 0.0004, QZ + 0.012]}>Bottom aluminum wire (30 nm thick)</Label>
          <Label pos={[MAIN_X + 0.012, J.ySi + 0.0007, QZ]}>Top aluminum wire (60 nm thick)</Label>
          <Label pos={[MAIN_X + 0.0012, J.ySi + 0.0004, QZ + 0.0012]}>Oxide barrier, about 2 nm</Label>
        </>
      ) : (
        <>
          <Label pos={[MAIN_X + 0.35, 0.25, QZ]}>Josephson junction</Label>
          <Label pos={[MAIN_X + 1.6, 0.25, QZ + 1.6]}>Capacitor pad</Label>
          <Label pos={[MAIN_X + 1.6, 0.25, QZ - 1.6]}>Capacitor pad</Label>
        </>
      )}
      <Label pos={[MAIN_X - 5, 0.4, -6]}>Readout resonator</Label>
      <Label pos={[47, 5, 3]}>Wire bonds</Label>
      <Label pos={[185, 9, 0]}>SMA connector</Label>
    </group>
  )
}
