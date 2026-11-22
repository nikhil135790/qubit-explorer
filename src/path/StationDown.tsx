import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Label } from '../scene/common'
import { PulseTrail } from './PulseTrail'
import type { TrailSpec } from './PulseTrail'
import { GOLD, fridgeShot, PLATE_SHOT } from './StationQubit'
import { PLATES } from './Fridge'
import { TO_FRIDGE, GEN_Y, FRONT } from './StationScreen'
import { usePath, seg, useSettled, ST } from './state'
import { blendShots, drive, rig, shot } from './rig'
import type { Shot } from './rig'

/**
 * Station 0: the trip down. The readout pulse is made by a microwave generator in the rack beside
 * the fridge, split (half stays as the reference), carried to the top flange, and sent down the input
 * line. An attenuator below each plate absorbs most of the pulse together with the warmer stage's
 * noise (each re-emits only the much smaller noise of its own, colder plate), so a faint, clean pulse
 * reaches the qubit box. Typical totals are about 60 dB, a factor of a million in power.
 * Scene units: 1 = 0.1 mm.
 */
const TOP = 12115 + 180
type V = [number, number, number]

// attenuators on the input line, one hanging below each plate from 50 K down, and one on the bottom plate
const ATT_Y = [PLATES[4].y0 - 90, PLATES[3].y0 - 90, PLATES[2].y0 - 90, PLATES[1].y0 - 90, 230]
const ATT_DB = ['0 dB', '20 dB', '10 dB', '10 dB', '20 dB']

const INPUT_LINE: V[] = [[-207, 0.6, 0], [-245, 0.6, 0], [-268, 6, 0], [-280, 30, 0], [-282, 80, 0], [-282, 140, 0], [-282, TOP, 0]]
// the whole route: generator, room-temperature cable, top flange, down the line, into the box, across the board, onto the chip
const ROUTE: V[] = [
  ...TO_FRIDGE, [-282, 11000, 0], [-282, 300, 0], [-282, 140, 0], [-282, 80, 0], [-280, 30, 0], [-268, 6, 0], [-245, 0.6, 0],
  [-207, 0.6, 0], [-178, 0.6, 0], [-160, 0.6, 0], [-100, 0.6, 0], [-55, 0.6, 0], [-51, 2.6, 0], [-47.5, 4.1, 0], [-44, 2.6, 0], [-40, 0.3, 0],
]
const v3 = (p: V[]) => new THREE.CatmullRomCurve3(p.map((q) => new THREE.Vector3(...q)), false, 'centripetal')

function arcNear(curve: THREE.Curve<THREE.Vector3>, p: V) {
  const pts = curve.getSpacedPoints(6000), t = new THREE.Vector3(...p)
  let best = 0
  for (let i = 0; i < pts.length; i++) if (pts[i].distanceToSquared(t) < pts[best].distanceToSquared(t)) best = i
  return (best / 6000) * curve.getLength()
}

const stationU = () => { const st = usePath.getState(); return st.station === ST.down ? st.u : 1 }
const here = () => usePath.getState().station === ST.down

export function StationDown() {
  const settled = useSettled()
  const beat = usePath((st) => (st.station === ST.down && settled ? st.beat : -1))
  const { camera } = useThree()
  const route = useMemo(() => v3(ROUTE), [])
  const line = useMemo(() => v3(INPUT_LINE), [])
  const vis = useRef(1)

  // per-sample facts along the route: which zone the pulse is in and how many attenuators it has passed
  const L = useMemo(() => {
    const N = 3000, pts = route.getSpacedPoints(N), len = route.getLength()
    const zone = pts.map((p) => (p.y > TOP + 1 ? 0 : p.x <= -279 && p.y > 140 ? 1 : p.x < -173 ? 2 : 3)) // room temp, fridge line, connector, board/chip
    const passed = pts.map((p) => (p.y > TOP + 1 ? 0 : ATT_Y.filter((y) => p.y < y).length))
    const at = (a: number) => Math.max(0, Math.min(N, Math.round((a / len) * N)))
    return {
      len, zone: (a: number) => zone[at(a)], passed: (a: number) => passed[at(a)],
      top: arcNear(route, [-282, TOP, 0]), low: arcNear(route, [-282, 300, 0]), chip: len,
    }
  }, [route])

  // made at the generator, along the cable to the fridge, down through the plates, then across onto the chip
  const arcAt = (u: number) => {
    if (!here() || u < 0.2) return -999 // it leaves the generator when the trip starts
    if (u < 0.4) return ((u - 0.2) / 0.2) * L.top
    if (u < 0.7) return L.top + ((u - 0.4) / 0.3) * (L.low - L.top)
    if (u < 0.8) return L.low + ((u - 0.7) / 0.1) * (L.chip - L.low)
    return -999 // it waits at the chip while we look at the plate
  }

  const spec = useMemo<TrailSpec>(() => {
    const size = (a: number) => {
      const z = L.zone(a)
      const fade = Math.pow(0.72, L.passed(a)) // each attenuator leaves it fainter
      if (z === 0) return 22 // inside the room-temperature cable (radius 30)
      if (z === 1) return 7 * fade // inside the fridge's coax (radius 10)
      if (z === 2) return Math.min(2.2, vis.current * 1.1) // inside the box's connector
      return Math.min(2.2, vis.current * 1.1) // over the board and onto the chip
    }
    return {
      center: () => arcAt(stationU()), width: 900, pitch: 180,
      radius: size,
      lift: (a) => (L.zone(a) === 3 ? size(a) * 1.05 : 0),
      twist: () => 0,
      // warm noise riding on the pulse: jittery at room temperature, cleaner after every attenuator
      fuzz: (a) => (L.zone(a) <= 1 ? 0.9 * Math.pow(0.45, L.passed(a)) : 0),
    }
  }, [L])
  // on the board the spiral is drawn tight, like on the chip; the long one is for the cables
  const tight = useMemo<TrailSpec>(() => ({
    ...spec, width: 5, pitch: 4,
    radius: (a) => (L.zone(a) >= 2 ? spec.radius(a) : 0),
    center: () => { const a = arcAt(stationU()); return a >= L.low + 40 ? a : -999 },
  }), [spec, L])
  const long = useMemo<TrailSpec>(() => ({
    ...spec, radius: (a) => (L.zone(a) <= 1 ? spec.radius(a) : 0),
    center: () => { const a = arcAt(stationU()); return a > -999 && a < L.low + 40 ? a : -999 },
  }), [spec, L])
  // a soft glow inside the cable where the pulse is, so it reads from far away; dimmer after each attenuator
  const glow = useRef<THREE.Mesh>(null)
  const glowMat = useRef<THREE.MeshBasicMaterial>(null)

  const tmp = useMemo(() => ({ p: new THREE.Vector3(), a: shot(), b: shot(), c: shot() }), [])
  const K = useMemo(() => {
    const gl = new THREE.Vector3(23300, GEN_Y - 200, FRONT)
    return { gen: { look: gl, pos: gl.clone().add(new THREE.Vector3(2400, 900, 7600)) } as Shot }
  }, [])
  // outward from the fridge's axis through the input line, so the camera rides outside the plates
  const OUT = new THREE.Vector3(-0.63, 0, 0.78)

  useFrame((_, dt) => {
    const u = stationU()
    let target: Shot
    if (u < 0.05) target = fridgeShot(seg(u, 0, 0.05), tmp.c)
    else if (u < 0.2) target = blendShots(fridgeShot(1, tmp.a), K.gen, seg(u, 0.05, 0.18), tmp.c)
    else {
      // the camera follows where the pulse is, even after it is hidden on arrival at the chip
      const a = u >= 0.8 ? L.chip : Math.max(0, arcAt(u))
      route.getPointAt(Math.min(1, a / L.len), tmp.p)
      const p = tmp.p
      // along the room-temperature cable: from the side and above
      const cable = new THREE.Vector3(1800, 1600, 6500)
      // down the fridge: outside the plates, slightly above the pulse
      const down = OUT.clone().multiplyScalar(2600).add(new THREE.Vector3(0, 400, 0))
      // near the bottom: close in beside the box, then behind the pulse across the board
      const near = new THREE.Vector3(-150, 160, 380)
      const board = new THREE.Vector3(-9, 15, 13).multiplyScalar(6)
      const kDown = THREE.MathUtils.smoothstep(a, L.top - 4000, L.top)
      const kNear = 1 - THREE.MathUtils.smoothstep(p.y, 250, 1100)
      const kBoard = THREE.MathUtils.smoothstep(a, L.low + 200, L.low + 330)
      const off = cable.clone().lerp(down, kDown).lerp(near, kNear).lerp(board, kBoard)
      const ch: Shot = { look: p.clone(), pos: p.clone().add(off) }
      blendShots(K.gen, ch, seg(u, 0.2, 0.24), tmp.b)
      target = blendShots(tmp.b, PLATE_SHOT, seg(u, 0.8, 0.96), tmp.c)
    }
    vis.current = Math.max(1, camera.position.distanceTo(rig.look) / 22)
    {
      const a = arcAt(u)
      const show = a > -999 && a < L.low + 40 && L.zone(Math.max(0, a)) === 1 // only inside the fridge, where the camera has to stay far back
      if (glow.current && glowMat.current) {
        glow.current.visible = show
        if (show) {
          route.getPointAt(Math.min(1, a / L.len), tmp.p)
          glow.current.position.copy(tmp.p)
          glow.current.scale.setScalar(9)
          glowMat.current.color.setRGB(1, 0.8, 0.45).multiplyScalar(9 * Math.pow(0.72, L.passed(a)))
        }
      }
    }
    const { paused, orbiting } = usePath.getState()
    if (!here() || paused || orbiting) return
    drive(camera, target, dt)
  })

  return (
    <group>
      {/* the input line: see-through, with its attenuators */}
      <mesh><tubeGeometry args={[line, 400, 10, 16, false]} /><meshStandardMaterial color="#b8bcc2" metalness={0.8} roughness={0.3} transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <mesh><tubeGeometry args={[line, 400, 1.2, 8, false]} /><meshStandardMaterial color="#d9c08a" metalness={1} roughness={0.3} /></mesh>
      {ATT_Y.map((y) => (
        <group key={y} position={[-282, y, 0]}>
          <mesh><cylinderGeometry args={[26, 26, 120, 24, 1, true]} /><meshStandardMaterial {...GOLD} transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} /></mesh>
          {[-70, 70].map((dy) => <mesh key={dy} position={[0, dy, 0]}><cylinderGeometry args={[30, 30, 20, 6, 1, true]} /><meshStandardMaterial {...GOLD} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} /></mesh>)}
        </group>
      ))}
      <mesh ref={glow} visible={false}><sphereGeometry args={[1, 16, 12]} /><meshBasicMaterial ref={glowMat} toneMapped={false} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
      <PulseTrail curve={route} spec={long} />
      <PulseTrail curve={route} spec={tight} />
      {beat === 1 && <>
        <Label open pos={[23000, GEN_Y + 500, FRONT + 100]}>Microwave generator</Label>
        <Label open pos={[26800, 12500 + 400, 3600]}>Splitter</Label>
      </>}
      {beat === 2 && <Label open pos={[-282, TOP + 300, 0]}>Sealed connector on the top flange</Label>}
      {beat === 3 && ATT_Y.slice(3).map((y, i) => <Label key={y} open pos={[-282, y, 0]}>{`Attenuator, ${ATT_DB[i + 3]}`}</Label>)}
    </group>
  )
}
