import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { READOUT_PHASE } from '../journey/state'
import { Label } from '../scene/common'
import { PulseTrail } from './PulseTrail'
import type { TrailSpec } from './PulseTrail'
import { GOLD } from './StationQubit'
import { usePath, seg, useSettled } from './state'
import { blendShots, zoomShot, drive, rig, shot } from './rig'
import type { Shot } from './rig'

/**
 * Station 3: a cryogenic ferrite isolator, about 26 mm across, on the bottom plate next to the
 * amplifier. Inside: a Y-shaped stripline between two ferrite disks, with permanent magnets above
 * and below. The magnetised ferrite makes the three ports a one-way roundabout (1 -> 2 -> 3 -> 1).
 * Port 3 ends in a 50 ohm resistor, so anything arriving at port 2 from above is absorbed there.
 * Scene units: 1 = 0.1 mm.
 */
export const ISO = new THREE.Vector3(1400, 20, 0) // centre of the puck, at stripline height
const R_BODY = 130
const LIFTED: [number, number, number] = [ISO.x - 215, ISO.y + 30, ISO.z - 95]

const ang = (deg: number, r: number, y = ISO.y): [number, number, number] =>
  [ISO.x + r * Math.cos((deg * Math.PI) / 180), y, ISO.z + r * Math.sin((deg * Math.PI) / 180)]

// the pulse: out of the amplifier box, along a short coax, in port 1, round the ferrite, out port 2, up the fridge
// it starts on the amplifier chip, right after mode b, and leaves through the amplifier's output connector
const AMP_PART: [number, number, number][] = [[904, 0.3, 4], [912, 0.3, 4], [923.6, 0.3, 4], [925.5, 3.2, 4], [927.5, 2.4, 4], [930, 0.6, 4], [960, 0.6, 4], [992, 0.6, 4]]
const REST: [number, number, number][] = [
  [1003, 0.6, 4], [1060, 0.6, 4], [1120, 12, 2], [1180, 20, 0], ang(180, 175), ang(180, 130), ang(180, 70),
  ang(160, 48), ang(120, 45), ang(80, 48), ang(60, 70), ang(60, 130), ang(60, 175), ang(60, 215),
  [1530, 45, 222], [1534, 90, 226], [1534, 300, 226], [1534, 1300, 226],
]
const FWD = [...AMP_PART, ...REST]
// noise from the HEMT: down the output line, in port 2, round to port 3, into the resistor
const NOISE: [number, number, number][] = [
  [1534, 380, 226], [1534, 300, 226], [1534, 90, 226], [1530, 45, 222], ang(60, 215), ang(60, 175), ang(60, 130),
  ang(60, 70), ang(40, 48), ang(0, 45), ang(-40, 48), ang(-60, 70), ang(-60, 104),
]
const LINE_OUT: [number, number, number][] = [...REST.slice(12, 17), [1534, 6262, 226]] // up to the 4 K plate, where the HEMT sits
const COAX_IN: [number, number, number][] = [...REST.slice(0, 5)]

const v3 = (p: [number, number, number][]) => new THREE.CatmullRomCurve3(p.map((q) => new THREE.Vector3(...q)), false, 'centripetal')

/** Arc length of the sample point nearest to a target point. */
function arcNear(curve: THREE.Curve<THREE.Vector3>, p: [number, number, number]) {
  const pts = curve.getSpacedPoints(1500), t = new THREE.Vector3(...p)
  let best = 0
  for (let i = 0; i < pts.length; i++) if (pts[i].distanceToSquared(t) < pts[best].distanceToSquared(t)) best = i
  return (best / 1500) * curve.getLength()
}

/** 0 out in the coax and connectors, 1 inside the puck, smooth in between. A table over arc length. */
function insideTable(curve: THREE.Curve<THREE.Vector3>) {
  const pts = curve.getSpacedPoints(800), len = curve.getLength()
  const k = pts.map((p) => { const r = Math.hypot(p.x - ISO.x, p.z - ISO.z); return p.y < 60 ? 1 - THREE.MathUtils.smoothstep(r, 95, 135) : 0 })
  return (a: number) => k[Math.max(0, Math.min(800, Math.round((a / len) * 800)))]
}

function Tube({ curve, r, see }: { curve: THREE.Curve<THREE.Vector3>; r: number; see?: boolean }) {
  return (
    <group>
      <mesh><tubeGeometry args={[curve, 300, r, 20, false]} />
        {see
          ? <meshStandardMaterial color="#b8bcc2" metalness={0.8} roughness={0.3} transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} />
          : <meshStandardMaterial color="#c8c8c6" metalness={1} roughness={0.28} />}
      </mesh>
      {see && <mesh><tubeGeometry args={[curve, 300, 1.2, 8, false]} /><meshStandardMaterial color="#d9c08a" metalness={1} roughness={0.3} /></mesh>}
    </group>
  )
}

/** SMA connector sticking straight out of the puck at a given angle. Shell drawn see-through. */
function Port({ deg }: { deg: number }) {
  const [x, , z] = ang(deg, R_BODY + 22)
  return (
    <group position={[x, ISO.y, z]} rotation={[0, -(deg * Math.PI) / 180, Math.PI / 2]}>
      <mesh><cylinderGeometry args={[10, 10, 44, 32, 1, true]} /><meshStandardMaterial {...GOLD} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -12, 0]}><cylinderGeometry args={[13, 13, 10, 6, 1, true]} /><meshStandardMaterial {...GOLD} transparent opacity={0.35} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <mesh><cylinderGeometry args={[0.8, 0.8, 46, 10]} /><meshStandardMaterial {...GOLD} /></mesh>
    </group>
  )
}

/** A curved arrow on the ferrite, from angle d0 to d1 (degrees): the way the waves get steered. */
function Turn({ d0, d1 }: { d0: number; d1: number }) {
  const pts = Array.from({ length: 24 }, (_, i) => ang(d0 + ((d1 - d0) * i) / 23, 80, ISO.y + 2))
  const end = new THREE.Vector3(...pts[23]), prev = new THREE.Vector3(...pts[21])
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(prev).normalize())
  return (
    <group>
      <Line points={pts} color="#f3dcae" lineWidth={2} transparent opacity={0.85} />
      <mesh position={end} quaternion={q}><coneGeometry args={[5, 13, 12]} /><meshBasicMaterial color="#f3dcae" /></mesh>
    </group>
  )
}

/** A short upward arrow for the magnetic field. */
function FieldArrow({ at }: { at: [number, number, number] }) {
  return (
    <group position={at}>
      <mesh position={[0, 18, 0]}><cylinderGeometry args={[1.6, 1.6, 36, 8]} /><meshBasicMaterial color="#9fb7ff" /></mesh>
      <mesh position={[0, 40, 0]}><coneGeometry args={[5, 12, 12]} /><meshBasicMaterial color="#9fb7ff" /></mesh>
    </group>
  )
}

export function Isolator({ glow, closed }: { glow?: React.RefObject<THREE.MeshStandardMaterial | null>; closed?: boolean }) {
  const y = ISO.y
  return (
    <group>
      {/* gold-plated cup with its lid off, so the inside shows */}
      <mesh position={[ISO.x, -25 + 12, ISO.z]}><cylinderGeometry args={[R_BODY, R_BODY, 24, 64]} /><meshStandardMaterial {...GOLD} /></mesh>
      <mesh position={[ISO.x, y + 10, ISO.z]}><cylinderGeometry args={[R_BODY, R_BODY, 66, 64, 1, true]} /><meshStandardMaterial {...GOLD} side={THREE.DoubleSide} /></mesh>
      <mesh position={[ISO.x, y + 43, ISO.z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[R_BODY - 8, R_BODY, 64]} /><meshStandardMaterial {...GOLD} side={THREE.DoubleSide} /></mesh>
      {/* mounting ears */}
      {[90, 270].map((d) => { const [x, , z] = ang(d, R_BODY + 28, 0); return <mesh key={d} position={[x, -21, z]}><boxGeometry args={[60, 8, 60]} /><meshStandardMaterial {...GOLD} /></mesh> })}
      {/* bottom magnet and ferrite disk (solid) */}
      <mesh position={[ISO.x, y - 24, ISO.z]}><cylinderGeometry args={[95, 95, 18, 48]} /><meshStandardMaterial color="#3a3b40" metalness={0.6} roughness={0.45} /></mesh>
      <mesh position={[ISO.x, y - 8, ISO.z]}><cylinderGeometry args={[105, 105, 14, 48]} /><meshStandardMaterial color="#26262a" roughness={0.8} /></mesh>
      {/* Y-junction stripline: a centre disc with three arms, one to each port */}
      <mesh position={[ISO.x, y, ISO.z]}><cylinderGeometry args={[34, 34, 2, 40]} /><meshStandardMaterial color="#e3b468" metalness={0.55} roughness={0.32} /></mesh>
      {[180, 60, -60].map((d) => {
        const [x, , z] = ang(d, 30 + (d === -60 ? 70 : 100) / 2)
        return <mesh key={d} position={[x, y, z]} rotation={[0, -(d * Math.PI) / 180, 0]}><boxGeometry args={[d === -60 ? 70 : 100, 2, 14]} /><meshStandardMaterial color="#e3b468" metalness={0.55} roughness={0.32} /></mesh>
      })}
      {/* the 50 ohm resistor that ends port 3: a dark thin-film chip on a small ceramic pad */}
      <group position={ang(-60, 108)} rotation={[0, (60 * Math.PI) / 180, 0]}>
        <mesh position={[0, -1, 0]}><boxGeometry args={[18, 3, 26]} /><meshStandardMaterial color="#e8e4da" roughness={0.6} /></mesh>
        <mesh position={[0, 1.2, 0]}><boxGeometry args={[12, 1.5, 18]} /><meshStandardMaterial ref={glow} color="#3b2a25" roughness={0.5} emissive="#ff4a3a" emissiveIntensity={0} /></mesh>
      </group>
      {/* screws holding the lid down (the lid itself is off) */}
      {Array.from({ length: 6 }, (_, i) => { const [x, , z] = ang(i * 60 + 30, R_BODY - 4, 0); return (
        <group key={i} position={[x, y + 44, z]}>
          <mesh><cylinderGeometry args={[6, 6, 3, 16]} /><meshStandardMaterial color="#9a9690" metalness={1} roughness={0.3} /></mesh>
          <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[2.6, 2.6, 0.4, 6]} /><meshStandardMaterial color="#141414" /></mesh>
        </group>) })}
      <Port deg={180} />
      <Port deg={60} />
      {!closed && <>
        {/* which way the magnetised ferrite steers waves around: 1 to 2 to 3 */}
        {[[165, 78], [45, -42], [-75, -162]].map(([d0, d1]) => <Turn key={d0} d0={d0} d1={d1} />)}
        {/* the magnet's field B points straight up through the ferrite */}
        {[100, 220, 340].map((d) => <FieldArrow key={d} at={ang(d, 58, y + 2)} />)}
      </>}
      {closed && <mesh position={[ISO.x, y + 45, ISO.z]}><cylinderGeometry args={[R_BODY, R_BODY, 5, 64]} /><meshStandardMaterial {...GOLD} /></mesh>}
      {/* the top ferrite disk and magnet, lifted off and set to one side so the inside shows */}
      {!closed && <><group position={LIFTED}>
        <mesh position={[0, 0, 0]}><cylinderGeometry args={[105, 105, 14, 48]} /><meshStandardMaterial color="#26262a" roughness={0.85} /></mesh>
        <mesh position={[0, 18, 0]}><cylinderGeometry args={[95, 95, 18, 48]} /><meshStandardMaterial color="#9ea1a8" metalness={0.9} roughness={0.35} /></mesh>
      </group></>}
    </group>
  )
}

const stationU = () => { const st = usePath.getState(); return st.station === 2 ? st.u : st.station > 2 ? 1 : 0 }
const here = () => usePath.getState().station === 2

export function StationIso() {
  const settled = useSettled()
  const beat = usePath((st) => (st.station === 2 && settled ? st.beat : -1))
  const { camera } = useThree()
  const fwd = useMemo(() => v3(FWD), [])
  const noise = useMemo(() => v3(NOISE), [])
  const lineOut = useMemo(() => v3(LINE_OUT), [])
  const coaxIn = useMemo(() => v3(COAX_IN), [])
  const glow = useRef<THREE.MeshStandardMaterial>(null)
  const vis = useRef(1)

  const L = useMemo(() => ({
    fwd: fwd.getLength(), noise: noise.getLength(),
    port1: arcNear(fwd, ang(180, 175)), exit: arcNear(fwd, ang(60, 215)),
    resistor: arcNear(noise, ang(-60, 85)),
    inF: insideTable(fwd), inN: insideTable(noise),
    ampEnd: arcNear(fwd, [1003, 0.6, 4]),
    onAmp: (() => { const pts = fwd.getSpacedPoints(800), len = fwd.getLength(); const k = pts.map((p) => 1 - THREE.MathUtils.smoothstep(p.x, 984, 996)); return (a: number) => k[Math.max(0, Math.min(800, Math.round((a / len) * 800)))] })(),
  }), [fwd, noise])

  // where the pulse is: along the coax to port 1, waits there while we look inside, crosses, then climbs
  const fwdArc = (u: number) => {
    if (!here()) return -999
    if (u < 0.15) return (u / 0.15) * (L.port1 - 6)
    if (u < 0.3) return L.port1 - 6
    if (u < 0.6) return L.port1 - 6 + ((u - 0.3) / 0.3) * (L.exit - L.port1 + 6)
    if (u < 0.85) return -999 // out of the way while the noise demo plays
    return L.exit + ((u - 0.85) / 0.15) * (L.fwd - L.exit)
  }
  const noiseArc = (u: number) => (!here() || u <= 0.6 || u > 0.86 ? -999 : ((u - 0.6) / 0.25) * (L.noise + 30))

  const specs = useMemo(() => {
    // the field spreads out in the ferrite, and fits snugly inside the coax and connectors
    const big = () => Math.min(26, Math.max(7, vis.current * 1.4))
    // on the amplifier chip the spiral is drawn tight, as in the amplifier station; from its connector on, long
    const ampSpec: TrailSpec = {
      center: () => { const a = fwdArc(stationU()); return a > -999 && a < L.ampEnd ? a : -999 },
      width: 4, pitch: 3.2,
      lift: (a) => L.onAmp(a) * Math.min(26, vis.current * 2.2) * 1.05,
      radius: (a) => { const m = L.onAmp(a); return 6 * (1 - m) + Math.min(26, vis.current * 2.2) * m },
      twist: () => READOUT_PHASE[usePath.getState().qubit],
    }
    const fwdSpec: TrailSpec = {
      center: () => { const a = fwdArc(stationU()); return a >= L.ampEnd ? a : -999 }, width: 26, pitch: 22,
      // on the amplifier chip and board the field rides above the trace; in connectors and coax it fits inside
      lift: (a) => L.onAmp(a) * Math.min(26, vis.current * 2.2) * 1.05,
      radius: (a) => { const k = L.inF(a), m = L.onAmp(a); return (6 * (1 - k) + big() * k) * (1 - m) + Math.min(26, vis.current * 2.2) * m },
      twist: () => READOUT_PHASE[usePath.getState().qubit],
    }
    const noiseSpec: TrailSpec = {
      center: () => noiseArc(stationU()), width: 24, pitch: 18, lift: () => 0,
      radius: (a) => { const k = L.inN(a); const r = 6 * (1 - k) + big() * 0.9 * k; return r * Math.exp(-Math.max(0, a - L.resistor) / 10) },
      twist: () => 0, fuzz: () => 0.9,
    }
    return { fwdSpec, noiseSpec, ampSpec }
  }, [L])

  const tmp = useMemo(() => ({ p: new THREE.Vector3(), a: shot(), b: shot() }), [])
  const K = useMemo(() => {
    const wl = new THREE.Vector3(1380, 0, 60), il = ISO.clone().add(new THREE.Vector3(30, 0, 10))
    return {
      start: { pos: new THREE.Vector3(910, 36, 34), look: new THREE.Vector3(901, 0, -2) } as Shot, // where the amplifier station ends
      wide: { look: wl, pos: wl.clone().addScaledVector(new THREE.Vector3(0.25, 0.8, 1).normalize(), 950) } as Shot,
      inside: { look: il, pos: il.clone().addScaledVector(new THREE.Vector3(0.15, 1.6, 1).normalize(), 560) } as Shot,
    }
  }, [])
  useFrame((_, dt) => {
    const u = stationU()
    // resistor warms (glows) while it absorbs the noise
    if (glow.current) { const a = noiseArc(u); glow.current.emissiveIntensity = a > L.resistor - 10 ? 1.6 * Math.exp(-Math.max(0, a - L.resistor) / 40) : 0 }
    let target: Shot
    if (u < 0.15) {
      // follow the pulse off the amplifier chip and out of its box, then pull back to see the isolator
      const a = Math.max(0, fwdArc(u))
      fwd.getPointAt(Math.min(1, a / L.fwd), tmp.p)
      const sc = 1 + 5 * THREE.MathUtils.smoothstep(a, 0, L.ampEnd)
      const ch: Shot = { look: tmp.p.clone(), pos: tmp.p.clone().add(new THREE.Vector3(-9, 11, 15).multiplyScalar(sc)) }
      blendShots(K.start, ch, seg(u, 0, 0.025), tmp.b)
      target = blendShots(tmp.b, K.wide, seg(u, 0.075, 0.145), tmp.a)
    }
    else if (u < 0.85) target = zoomShot(K.inside, K.wide, 1 - seg(u, 0.15, 0.28), tmp.a)
    else {
      // follow the pulse up the output line, watching from the side
      const a = Math.max(L.exit, fwdArc(u))
      fwd.getPointAt(Math.min(1, a / L.fwd), tmp.p)
      const chase: Shot = { look: tmp.p.clone(), pos: tmp.p.clone().add(new THREE.Vector3(170, 40, 270)) }
      target = blendShots(K.inside, chase, seg(u, 0.85, 0.9), tmp.b)
    }
    vis.current = Math.max(1, camera.position.distanceTo(rig.look) / 22)
    const { paused, orbiting } = usePath.getState()
    if (!here() || paused || orbiting) return
    drive(camera, target, dt)
  })

  return (
    <group>
      <Tube curve={coaxIn} r={9} see />
      <Tube curve={lineOut} r={10} see />
      <Isolator glow={glow} />
      <PulseTrail curve={fwd} spec={specs.ampSpec} />
      <PulseTrail curve={fwd} spec={specs.fwdSpec} />
      <PulseTrail curve={noise} spec={specs.noiseSpec} color="#ff5a64" width={2.2} />
      {beat === 0 && <>
        <Label open pos={[ISO.x, 75, ISO.z]}>Isolator</Label>
        <Label open pos={[1120, 30, 2]}>Coax cable</Label>
      </>}
      {usePath.getState().station === 2 && beat >= 0 && <Html position={ang(100, 58, ISO.y + 54)} center zIndexRange={[9, 0]}><span className="b-tag">B</span></Html>}
      {beat === 1 && <>
        <Label open pos={[LIFTED[0] + 105, LIFTED[1] + 20, LIFTED[2]]}>Magnet, lifted off</Label>
        <Label open pos={ang(150, 95, ISO.y + 4)}>Ferrite disk</Label>
        <Label open pos={ang(-20, 86, ISO.y + 4)}>Steering direction</Label>
      </>}
      {beat === 2 && <>
        <Label open pos={ang(180, 185)}>Port 1</Label>
        <Label open pos={ang(60, 140, ISO.y + 30)}>Port 2</Label>
      </>}
      {beat === 3 && <Label open pos={ang(-60, 112, ISO.y + 4)}>Port 3 and its resistor</Label>}
      {beat === 4 && <Label open pos={[1534, 1250, 226]}>Up toward the HEMT at 4 K</Label>}
    </group>
  )
}
