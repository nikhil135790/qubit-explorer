import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { READOUT_PHASE } from '../journey/state'
import { Label } from '../scene/common'
import { PulseTrail } from './PulseTrail'
import type { TrailSpec } from './PulseTrail'
import { Bond, GOLD } from './StationQubit'
import { usePath, seg, useSettled, ST } from './state'
import { blendShots, zoomShot, drive, rig, shot } from './rig'
import type { Shot } from './rig'

/**
 * Station 4: a cryogenic HEMT amplifier on the 4 K plate (like a Low Noise Factory module):
 * a gold-plated box about 30 x 24 mm, SMA input and output, and inside a ceramic board with three
 * transistor stages in a row, each fed by bias wires from a small connector on the back wall.
 * About 40 dB of gain, adding roughly a dozen photons of noise. Scene units: 1 = 0.1 mm.
 */
const TOP = 12115 + 180
const Y = 6295 // top of the 4 K plate
const RF = 6330 // height of the signal strip inside the box
const BOX = { x0: 1600, x1: 1900, z0: 106, z1: 346, h: 110 }
const STAGES = [1690, 1760, 1830]
const Z = 226
const LID: [number, number, number] = [1760, Y + 4, -60]
type V = [number, number, number]

const FWD: V[] = [
  [1534, 1300, Z], [1534, 3000, Z], [1534, 6262, Z], [1537, 6305, Z], [1548, 6326, Z], [1565, RF, Z], [1600, RF, Z], [1650, RF, Z],
  [1690, RF, Z], [1760, RF, Z], [1830, RF, Z], [1900, RF, Z], [1944, RF, Z], [1962, 6345, Z], [1971, 6380, Z], [1972, 6480, Z], [1972, 8000, Z], [1972, 11000, Z],
]
const NOISE: V[] = [[1690, RF + 1, Z], [1650, RF, Z], [1600, RF, Z], [1565, RF, Z], [1548, 6326, Z], [1537, 6305, Z], [1534, 6262, Z], [1534, 5600, Z], [1534, 4600, Z]]
const COAX_IN: V[] = [[1534, 6262, Z], [1536, 6300, Z], [1544, 6322, Z], [1556, RF, Z]]
const COAX_OUT: V[] = [[1944, RF, Z], [1962, 6345, Z], [1971, 6380, Z], [1972, 6480, Z], [1972, TOP, Z]]

const v3 = (p: V[]) => new THREE.CatmullRomCurve3(p.map((q) => new THREE.Vector3(...q)), false, 'centripetal')
function arcNear(curve: THREE.Curve<THREE.Vector3>, p: V) {
  const pts = curve.getSpacedPoints(3000), t = new THREE.Vector3(...p)
  let best = 0
  for (let i = 0; i < pts.length; i++) if (pts[i].distanceToSquared(t) < pts[best].distanceToSquared(t)) best = i
  return (best / 3000) * curve.getLength()
}

function SeeThrough({ curve, r }: { curve: THREE.Curve<THREE.Vector3>; r: number }) {
  return (
    <group>
      <mesh><tubeGeometry args={[curve, 300, r, 20, false]} /><meshStandardMaterial color="#b8bcc2" metalness={0.8} roughness={0.3} transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <mesh><tubeGeometry args={[curve, 300, 1.2, 8, false]} /><meshStandardMaterial color="#d9c08a" metalness={1} roughness={0.3} /></mesh>
    </group>
  )
}

function Sma({ x, dir }: { x: number; dir: 1 | -1 }) {
  return (
    <group position={[x + dir * 22, RF, Z]} rotation={[0, 0, Math.PI / 2]}>
      <mesh><cylinderGeometry args={[10, 10, 44, 32, 1, true]} /><meshStandardMaterial {...GOLD} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -dir * 14, 0]}><cylinderGeometry args={[13, 13, 10, 6, 1, true]} /><meshStandardMaterial {...GOLD} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <mesh><cylinderGeometry args={[0.8, 0.8, 46, 10]} /><meshStandardMaterial {...GOLD} /></mesh>
    </group>
  )
}

const STRIP = { color: '#e0b468', metalness: 0.6, roughness: 0.3 }

function HemtBox() {
  const { x0, x1, z0, z1, h } = BOX
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = 16
  return (
    <group>
      {/* gold-plated body: base and four walls, lid off */}
      <mesh position={[cx, Y + 12.5, cz]}><boxGeometry args={[x1 - x0, 25, z1 - z0]} /><meshStandardMaterial {...GOLD} /></mesh>
      {([[cx, z0 + W / 2, x1 - x0, W], [cx, z1 - W / 2, x1 - x0, W], [x0 + W / 2, cz, W, z1 - z0], [x1 - W / 2, cz, W, z1 - z0]] as const).map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, Y + 25 + (h - 25) / 2, z]}><boxGeometry args={[w, h - 25, d]} /><meshStandardMaterial {...GOLD} /></mesh>
      ))}
      {/* screw holes on the rim, where the lid bolts on */}
      {[[x0 + 8, z0 + 8], [x1 - 8, z0 + 8], [x0 + 8, z1 - 8], [x1 - 8, z1 - 8], [cx, z0 + 8], [cx, z1 - 8]].map(([x, z], i) => (
        <mesh key={i} position={[x, Y + h + 0.3, z]}><cylinderGeometry args={[4, 4, 0.6, 16]} /><meshStandardMaterial color="#1b1208" /></mesh>
      ))}
      {/* ceramic circuit board */}
      <mesh position={[cx, Y + 25 + 3, Z]}><boxGeometry args={[x1 - x0 - 2 * W, 6, 120]} /><meshStandardMaterial color="#6f6a61" roughness={0.75} /></mesh>
      {/* signal strip, broken by the three transistors and the coupling capacitors between them */}
      {[[x0 + W, 1678], [1702, 1748], [1772, 1818], [1842, x1 - W]].map(([a, b], i) => (
        <mesh key={i} position={[(a + b) / 2, RF - 3, Z]}><boxGeometry args={[b - a, 1.5, 8]} /><meshStandardMaterial {...STRIP} /></mesh>
      ))}
      {[1655, 1725, 1795].map((x) => (
        <mesh key={x} position={[x, RF + 0.5, Z]}><boxGeometry args={[9, 5, 11]} /><meshStandardMaterial color="#c9b48a" roughness={0.5} /></mesh>
      ))}
      {STAGES.map((x) => (
        <group key={x}>
          {/* the transistor chip, with its gold gate and contact fingers */}
          <mesh position={[x, RF - 1, Z]}><boxGeometry args={[18, 4, 18]} /><meshStandardMaterial color="#25252a" roughness={0.4} metalness={0.3} /></mesh>
          {[-4, 0, 4].map((dz) => <mesh key={dz} position={[x, RF + 1.1, Z + dz]}><boxGeometry args={[12, 0.4, 1.2]} /><meshStandardMaterial {...STRIP} /></mesh>)}
          <Bond from={[x - 13, RF - 2, Z]} to={[x - 6, RF + 1.2, Z]} h={2.5} />
          <Bond from={[x + 6, RF + 1.2, Z]} to={[x + 13, RF - 2, Z]} h={2.5} />
          {/* bias line to the back wall */}
          <mesh position={[x, RF - 3, Z - 36]}><boxGeometry args={[2.5, 1.5, 54]} /><meshStandardMaterial {...STRIP} /></mesh>
          <Bond from={[x, RF + 1.2, Z - 7]} to={[x, RF - 2, Z - 12]} h={2} />
          <mesh position={[x - 8, RF + 0.5, Z - 40]}><boxGeometry args={[8, 5, 8]} /><meshStandardMaterial color="#c9b48a" roughness={0.5} /></mesh>
        </group>
      ))}
      {/* DC connector for the transistor power on the back wall, and its wiring heading up */}
      <mesh position={[cx, Y + 60, z0 - 14]}><boxGeometry args={[110, 34, 28]} /><meshStandardMaterial color="#1e1e20" roughness={0.6} /></mesh>
      {[-30, -10, 10, 30].map((dx) => <mesh key={dx} position={[cx + dx, Y + 60, z0 - 28.5]}><cylinderGeometry args={[2.5, 2.5, 1, 10]} /><meshStandardMaterial {...GOLD} /></mesh>)}
      <mesh position={[cx, (Y + 77 + 8795) / 2, z0 - 20]}><cylinderGeometry args={[9, 9, 8795 - Y - 77, 12]} /><meshStandardMaterial color="#6a4a2b" roughness={0.75} /></mesh>
      <Sma x={x0} dir={-1} />
      <Sma x={x1} dir={1} />
      {/* the lid, unscrewed and set down behind the box */}
      <mesh position={LID}><boxGeometry args={[x1 - x0, 8, z1 - z0]} /><meshStandardMaterial {...GOLD} /></mesh>
    </group>
  )
}

const stationU = () => { const st = usePath.getState(); return st.station === ST.hemt ? st.u : st.station > ST.hemt ? 1 : 0 }
const here = () => usePath.getState().station === ST.hemt

export function StationHemt() {
  const settled = useSettled()
  const beat = usePath((st) => (st.station === ST.hemt && settled ? st.beat : -1))
  const { camera } = useThree()
  const fwd = useMemo(() => v3(FWD), [])
  const noise = useMemo(() => v3(NOISE), [])
  const coaxIn = useMemo(() => v3(COAX_IN), [])
  const coaxOut = useMemo(() => v3(COAX_OUT), [])
  const vis = useRef(1)

  const L = useMemo(() => ({
    fwd: fwd.getLength(), noise: noise.getLength(),
    atBox: arcNear(fwd, [1560, RF, Z]), outBox: arcNear(fwd, [1944, RF, Z]),
    boxIn: arcNear(fwd, [1600, RF, Z]), boxOut: arcNear(fwd, [1900, RF, Z]),
    stage: STAGES.map((x) => arcNear(fwd, [x, RF, Z])),
    nOut: arcNear(noise, [1556, RF, Z]),
  }), [fwd, noise])

  // steady speed on the climbs, slower across the box so you can watch each stage
  const fwdArc = (u: number) => {
    if (!here()) return -999
    if (u < 0.2) return (u / 0.2) * L.atBox
    if (u < 0.35) return L.atBox
    if (u < 0.6) return L.atBox + ((u - 0.35) / 0.25) * (L.outBox - L.atBox)
    if (u < 0.8) return -999
    return L.outBox + ((u - 0.8) / 0.2) * (L.fwd - L.outBox)
  }
  const noiseArc = (u: number) => {
    if (!here() || u <= 0.6 || u > 0.8) return -999
    const t = (u - 0.6) / 0.2 // slow inside the box, where you can see it leave the first transistor
    return t < 0.65 ? (t / 0.65) * L.nOut : L.nOut + ((t - 0.65) / 0.35) * (L.noise - L.nOut)
  }

  const specs = useMemo(() => {
    // each transistor stage makes the pulse bigger (drawn compressed: 40 dB is 100x in amplitude)
    const grow = (a: number) => 0.45 + L.stage.reduce((g, s) => g + 0.3 * THREE.MathUtils.smoothstep(a, s - 8, s + 8), 0)
    const inBox = (a: number) => (a > L.boxIn && a < L.boxOut ? 1 : 0)
    const fwdSpec: TrailSpec = {
      center: () => fwdArc(stationU()), width: 30, pitch: 14,
      radius: (a) => (inBox(a) ? Math.min(12, vis.current) * grow(a) : 7),
      lift: (a) => inBox(a) * Math.min(12, vis.current) * grow(a) * 0.9,
      twist: () => READOUT_PHASE[usePath.getState().qubit],
    }
    const noiseSpec: TrailSpec = {
      center: () => noiseArc(stationU()), width: 26, pitch: 22, lift: (a) => (a < L.nOut ? Math.min(40, vis.current * 0.55) * 0.9 : 0),
      radius: (a) => (a < L.nOut ? Math.min(40, vis.current * 0.55) : 7), twist: () => 0, fuzz: () => 0.9,
    }
    return { fwdSpec, noiseSpec }
  }, [L])

  const tmp = useMemo(() => ({ p: new THREE.Vector3(), a: shot(), b: shot() }), [])
  const K = useMemo(() => {
    const bl = new THREE.Vector3(1750, 6345, 200), il = new THREE.Vector3(1755, RF, Z)
    return {
      box: { look: bl, pos: bl.clone().addScaledVector(new THREE.Vector3(0.35, 0.55, 1).normalize(), 950) } as Shot,
      inside: { look: il, pos: il.clone().addScaledVector(new THREE.Vector3(0.1, 1.3, 1).normalize(), 470) } as Shot,
    }
  }, [])
  const chase = (a: number, s: number, out: Shot) => {
    fwd.getPointAt(Math.min(1, Math.max(0, a) / L.fwd), tmp.p)
    out.look.copy(tmp.p)
    out.pos.copy(tmp.p).add(new THREE.Vector3(170, 40, 270).multiplyScalar(s))
    return out
  }
  useFrame((_, dt) => {
    const u = stationU()
    let target: Shot
    if (u < 0.2) {
      // ride up beside the cable, stepping out past the plate edges so they never get in the way
      chase(fwdArc(u), 1 + 2.6 * seg(u, 0, 0.05), tmp.a)
      target = blendShots(tmp.a, K.box, seg(u, 0.15, 0.2), tmp.b)
    } else if (u < 0.8) target = zoomShot(K.inside, K.box, 1 - seg(u, 0.35, 0.43), tmp.b)
    else {
      chase(fwdArc(u), 3.6, tmp.a)
      target = blendShots(K.inside, tmp.a, seg(u, 0.8, 0.86), tmp.b)
    }
    vis.current = Math.max(1, camera.position.distanceTo(rig.look) / 22)
    const { paused, orbiting } = usePath.getState()
    if (!here() || paused || orbiting) return
    drive(camera, target, dt)
  })

  return (
    <group>
      <SeeThrough curve={coaxIn} r={10} />
      <SeeThrough curve={coaxOut} r={10} />
      <HemtBox />
      <PulseTrail curve={fwd} spec={specs.fwdSpec} />
      <PulseTrail curve={noise} spec={specs.noiseSpec} color="#ff5a64" width={2.2} />
      {beat === 0 && <Label open pos={[1534, 3200, Z]}>Superconducting coax</Label>}
      {beat === 1 && <>
        <Label open pos={[1750, Y + 135, Z + 120]}>HEMT amplifier</Label>
        <Label open pos={[LID[0] + 160, LID[1] + 10, LID[2]]}>Lid, taken off</Label>
      </>}
      {beat === 2 && <>
        <Label open pos={[1760, RF + 8, Z + 14]}>Three transistors in a row</Label>
        <Label open pos={[1750 + 60, Y + 80, BOX.z0 - 20]}>Power for the transistors</Label>
      </>}
      {beat === 3 && <Label open pos={[1620, RF + 14, Z]}>Noise from the transistors</Label>}
      {beat === 4 && <Label open pos={[1972, 10400, Z]}>Up to room temperature</Label>}
    </group>
  )
}
