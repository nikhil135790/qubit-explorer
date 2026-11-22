import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { READOUT_PHASE } from '../journey/state'
import { Label } from '../scene/common'
import { PulseTrail } from './PulseTrail'
import type { TrailSpec } from './PulseTrail'
import { GOLD } from './StationQubit'
import { FR } from './Fridge'
import { usePath, seg, useSettled } from './state'
import { blendShots, drive, rig, shot } from './rig'
import type { Shot } from './rig'

/**
 * Station 5: out of the fridge to room temperature. The lab around the fridge: floor, the support
 * frame the fridge hangs from, a 19-inch rack of electronics (microwave generator, IQ mixer,
 * digitizer, computer) and a desk with the scientist's monitor. Scene units: 1 = 0.1 mm.
 *
 * The plot on the monitor uses our readout model: with the directional amplifier the two clouds are
 * separated by 7.4 times their spread (99.7% of 0.4 us readings right); without it, 2.2 times (86.6%).
 */
export const FLOOR = -7500
const TOP = 12115 + 180
const PLATE_TOP_Y = 12135
type V = [number, number, number]

export const SNR = { with: 7.43, without: 2.24 }
export const FID = { with: 99.7, without: 86.6 }

// rack and instruments
const RACK = { x0: 22000, x1: 28000, z0: -2000, z1: 6000, top: 12500 }
const FRONT = RACK.z1
const GEN_Y = 10445, MIX_Y = 9222, DIG_Y = 8145
const RF_IN: V = [23500, MIX_Y, FRONT + 60]
const LO_IN: V = [24300, MIX_Y, FRONT + 60]
// desk and monitor
const MON = { x: 14200, y: 3700, z: 1777, w: 5800, h: 3200 }

// the pulse's route: up out of the 4 K box's line, through the top flange, along a flexible cable to the mixer
const ROUTE: V[] = [
  [1972, 11000, 226], [1972, TOP, 226], [1972, 13100, 226], [3200, 13900, 600], [8000, 14200, 1800],
  [16000, 14000, 4200], [22300, 13300, 6200], [23400, 11600, 6420], [23500, 9800, 6330], [23500, 9420, 6200], RF_IN,
]
// the generator's tone, split: one cable to the fridge input on the top flange, one short loop to the mixer
const TO_FRIDGE: V[] = [[23000, GEN_Y, FRONT + 60], [23000, GEN_Y, FRONT + 500], [22600, 12600, 6000], [14000, 14600, 2400], [2000, 14400, -200], [-282, 13200, 0], [-282, TOP, 0]]
const TO_LO: V[] = [[23250, GEN_Y - 120, FRONT + 60], [23300, GEN_Y - 200, FRONT + 500], [24100, MIX_Y + 300, FRONT + 480], LO_IN]
const IQ_OUT: V[][] = [
  [[25500, MIX_Y, FRONT + 60], [25550, MIX_Y - 300, FRONT + 420], [25450, DIG_Y + 300, FRONT + 420], [25300, DIG_Y, FRONT + 60]],
  [[26000, MIX_Y, FRONT + 60], [26050, MIX_Y - 300, FRONT + 520], [25950, DIG_Y + 300, FRONT + 520], [25800, DIG_Y, FRONT + 60]],
]
const TO_MONITOR: V[] = [[27400, 6200, FRONT + 60], [27400, 4800, FRONT + 700], [24000, 300, 3400], [18000, 60, 1200], [MON.x + 600, 60, 1000]]

const v3 = (p: V[]) => new THREE.CatmullRomCurve3(p.map((q) => new THREE.Vector3(...q)), false, 'centripetal')

const STEEL = { color: '#7d8086', metalness: 0.6, roughness: 0.5 }
const PANEL = { color: '#1f2124', metalness: 0.4, roughness: 0.55 }

function Cable({ pts, r = 30, color = '#5f7490' }: { pts: V[]; r?: number; color?: string }) {
  const c = useMemo(() => v3(pts), [pts])
  return <mesh><tubeGeometry args={[c, 240, r, 12, false]} /><meshStandardMaterial color={color} roughness={0.55} metalness={0.1} /></mesh>
}

function SmaJack({ at }: { at: V }) {
  return (
    <group position={at} rotation={[Math.PI / 2, 0, 0]}>
      <mesh><cylinderGeometry args={[32, 32, 120, 6]} /><meshStandardMaterial {...GOLD} /></mesh>
    </group>
  )
}

/** One rack instrument: a front panel with a bezel, an optional display, knobs and jacks. */
function Instrument({ y, u, display, knobs = 0, jacks = [] as number[], leds = 0 }: { y: number; u: number; display?: [number, number]; knobs?: number; jacks?: number[]; leds?: number }) {
  const h = u * 445 - 20, cx = (RACK.x0 + RACK.x1) / 2, w = RACK.x1 - RACK.x0 - 400
  return (
    <group>
      <mesh position={[cx, y, FRONT - 3000]}><boxGeometry args={[w - 200, h, 6000]} /><meshStandardMaterial {...PANEL} /></mesh>
      <mesh position={[cx, y, FRONT]}><boxGeometry args={[w, h, 60]} /><meshStandardMaterial color="#2a2c30" metalness={0.5} roughness={0.5} /></mesh>
      {display && <mesh position={[display[0], y + 40, FRONT + 32]}><planeGeometry args={[display[1], h * 0.55]} /><meshBasicMaterial color="#173a52" /></mesh>}
      {display && <mesh position={[display[0] - display[1] * 0.22, y + 60, FRONT + 33]}><planeGeometry args={[display[1] * 0.4, h * 0.12]} /><meshBasicMaterial color="#7fd0ff" /></mesh>}
      {Array.from({ length: knobs }, (_, i) => (
        <mesh key={i} position={[cx + 400 + i * 520, y, FRONT + 90]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[150, 150, 120, 24]} /><meshStandardMaterial color="#1b1c1f" roughness={0.6} /></mesh>
      ))}
      {Array.from({ length: leds }, (_, i) => (
        <mesh key={i} position={[RACK.x0 + 600 + i * 160, y + h * 0.3, FRONT + 32]}><circleGeometry args={[30, 12]} /><meshBasicMaterial color={i % 3 === 0 ? '#7cff9a' : '#ffb35c'} /></mesh>
      ))}
      {jacks.map((x) => <SmaJack key={x} at={[x, y, FRONT + 60]} />)}
    </group>
  )
}

function Lab() {
  const legs = [18.5, 108.5, 198.5, 288.5].map((d) => [FR.cx + 6500 * Math.cos((d * Math.PI) / 180), FR.cz + 6500 * Math.sin((d * Math.PI) / 180)] as const)
  const rackCx = (RACK.x0 + RACK.x1) / 2, rackCz = (RACK.z0 + RACK.z1) / 2
  return (
    <group>
      {/* lab floor */}
      <mesh position={[8000, FLOOR, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[160000, 160000]} /><meshStandardMaterial color="#17181a" roughness={0.95} /></mesh>
      {/* the frame the fridge hangs from: four aluminium legs, arms out to the top flange */}
      {legs.map(([x, z], i) => (
        <group key={i}>
          <mesh position={[x, (FLOOR + 11900) / 2, z]}><boxGeometry args={[800, 11900 - FLOOR, 800]} /><meshStandardMaterial {...STEEL} /></mesh>
          <mesh position={[x, FLOOR + 60, z]}><boxGeometry args={[1600, 120, 1600]} /><meshStandardMaterial color="#1c1c1e" roughness={0.7} /></mesh>
          {(() => {
            const dx = FR.cx - x, dz = FR.cz - z, L = Math.hypot(dx, dz) - 2900
            const mx = x + (dx / Math.hypot(dx, dz)) * (L / 2), mz = z + (dz / Math.hypot(dx, dz)) * (L / 2)
            return <mesh position={[mx, 11700, mz]} rotation={[0, -Math.atan2(dz, dx), 0]}><boxGeometry args={[L, 600, 600]} /><meshStandardMaterial {...STEEL} /></mesh>
          })()}
        </group>
      ))}
      {/* sealed (hermetic) feedthroughs on the top flange for our output line and the input line */}
      {[[1972, 226], [-282, 0]].map(([x, z]) => <mesh key={x} position={[x, PLATE_TOP_Y + 80, z]}><cylinderGeometry args={[70, 70, 160, 6]} /><meshStandardMaterial {...GOLD} /></mesh>)}

      {/* 19-inch rack */}
      {[[RACK.x0, RACK.z0], [RACK.x1, RACK.z0], [RACK.x0, RACK.z1], [RACK.x1, RACK.z1]].map(([x, z], i) => (
        <mesh key={i} position={[x + (x === RACK.x0 ? 150 : -150), (FLOOR + RACK.top) / 2, z + (z === RACK.z0 ? 150 : -150)]}><boxGeometry args={[300, RACK.top - FLOOR, 300]} /><meshStandardMaterial color="#141517" roughness={0.6} /></mesh>
      ))}
      <mesh position={[rackCx, RACK.top - 100, rackCz]}><boxGeometry args={[RACK.x1 - RACK.x0, 200, RACK.z1 - RACK.z0]} /><meshStandardMaterial color="#141517" roughness={0.6} /></mesh>
      {[RACK.x0 + 40, RACK.x1 - 40].map((x) => <mesh key={x} position={[x, (FLOOR + RACK.top) / 2, rackCz]}><boxGeometry args={[80, RACK.top - FLOOR, RACK.z1 - RACK.z0]} /><meshStandardMaterial color="#1b1c1f" roughness={0.7} /></mesh>)}
      <Instrument y={GEN_Y} u={2} display={[25600, 2600]} knobs={0} jacks={[23000]} leds={2} />
      <Instrument y={MIX_Y} u={1} jacks={[23500, 24300, 25500, 26000]} leds={1} />
      <Instrument y={DIG_Y} u={2} display={[26600, 1400]} jacks={[25300, 25800]} leds={4} />
      <Instrument y={6200} u={4} leds={6} />
      <Instrument y={3600} u={4} knobs={3} leds={2} />
      <Instrument y={1100} u={3} leds={3} />

      {/* desk and the scientist's monitor */}
      <mesh position={[15000, -150, 2000]}><boxGeometry args={[12000, 300, 7000]} /><meshStandardMaterial color="#5b4a3a" roughness={0.7} /></mesh>
      {[[9300, -1300], [20700, -1300], [9300, 5300], [20700, 5300]].map(([x, z], i) => <mesh key={i} position={[x, (FLOOR - 300) / 2, z]}><boxGeometry args={[300, -300 - FLOOR, 300]} /><meshStandardMaterial {...STEEL} /></mesh>)}
      <mesh position={[MON.x, 40, 1400]}><boxGeometry args={[2200, 80, 1500]} /><meshStandardMaterial color="#1b1c1f" roughness={0.5} /></mesh>
      <mesh position={[MON.x, 1200, 1500]}><boxGeometry args={[400, 2300, 250]} /><meshStandardMaterial color="#1b1c1f" roughness={0.5} /></mesh>
      <mesh position={[MON.x, MON.y, MON.z - 90]}><boxGeometry args={[MON.w + 200, MON.h + 200, 160]} /><meshStandardMaterial color="#111214" roughness={0.4} /></mesh>
      {/* keyboard */}
      <mesh position={[MON.x - 200, 60, 4200]}><boxGeometry args={[4400, 120, 1400]} /><meshStandardMaterial color="#1e1f22" roughness={0.6} /></mesh>

      {/* cables */}
      <Cable pts={TO_FRIDGE} />
      <Cable pts={TO_LO} r={26} />
      {IQ_OUT.map((p, i) => <Cable key={i} pts={p} r={26} />)}
      <Cable pts={TO_MONITOR} r={40} color="#1a1a1c" />
    </group>
  )
}

// ---------- the plot on the monitor ----------
const NPTS = 3000
const G = (() => {
  let s = 12345
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  return Array.from({ length: NPTS + 1 }, () => { const m = Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))), a = 2 * Math.PI * r(); return [m * Math.cos(a), m * Math.sin(a)] })
})()

function drawPlot(ctx: CanvasRenderingContext2D, n: number, single: boolean, qubit: 0 | 1, withAmp: boolean, ping: number) {
  const W = 1600, H = 900
  ctx.fillStyle = '#0b0e13'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#dfe5ea'; ctx.font = '500 34px "IBM Plex Sans", sans-serif'
  ctx.fillText('Qubit 3 readout', 60, 64)
  ctx.fillStyle = '#8d93a0'; ctx.font = '24px "IBM Plex Sans", sans-serif'
  ctx.fillText(withAmp ? 'Chain: directional amplifier, isolator, HEMT' : 'Chain: isolator, HEMT (no directional amplifier)', 60, 100)
  // IQ plane
  const ox = 450, oy = 500, S = 230
  ctx.strokeStyle = '#2a2f38'; ctx.lineWidth = 2
  ctx.strokeRect(ox - 370, oy - 370, 740, 740)
  ctx.beginPath(); ctx.moveTo(ox - 370, oy); ctx.lineTo(ox + 370, oy); ctx.moveTo(ox, oy - 370); ctx.lineTo(ox, oy + 370); ctx.stroke()
  ctx.fillStyle = '#6b7280'; ctx.font = '22px "IBM Plex Sans", sans-serif'
  ctx.fillText('I', ox + 345, oy - 10); ctx.fillText('Q', ox + 10, oy - 345)
  ctx.setLineDash([10, 10]); ctx.strokeStyle = '#c9ccd3'; ctx.beginPath(); ctx.moveTo(ox - 370, oy); ctx.lineTo(ox + 370, oy); ctx.stroke(); ctx.setLineDash([])
  ctx.fillStyle = '#f0c46e'; ctx.fillText('reads 1', ox - 355, oy - 340)
  ctx.fillStyle = '#86b5e0'; ctx.fillText('reads 0', ox - 355, oy + 355)
  ctx.fillStyle = '#c9ccd3'; ctx.fillText('dividing line', ox + 200, oy + 30)
  const sig = Math.SQRT2 / (withAmp ? SNR.with : SNR.without) // spread, with the two centres √2 apart
  const centre = (q: 0 | 1) => { const a = READOUT_PHASE[q]; return [Math.cos(a), Math.sin(a)] }
  // a qubit prepared in 1 sometimes decays to 0 during the 0.4 us measurement (T1 = 50 us, so about
  // 0.8% of the time); its dot then lands part of the way toward the 0 cloud
  const decay = (i: number) => { const h = Math.abs(Math.sin(i * 91.7 + 3.1) * 43758.5453) % 1; return h < 0.008 ? h / 0.008 : 1 }
  const pt = (i: number, q: 0 | 1) => {
    const [c1x, c1y] = centre(q)
    let cx = c1x, cy = c1y
    if (q === 1) { const f = decay(i); const [c0x, c0y] = centre(0); cx = c0x + (c1x - c0x) * f; cy = c0y + (c1y - c0y) * f }
    return [ox + (cx + G[i][0] * sig) * S, oy - (cy + G[i][1] * sig) * S]
  }
  // histogram along Q (the axis that separates the clouds)
  const bins = 60, h0 = new Array(bins).fill(0), h1 = new Array(bins).fill(0)
  let right = 0
  for (let i = 0; i < n; i++) {
    const q = (i % 2) as 0 | 1
    const [x, y] = pt(i, q)
    ctx.fillStyle = q === 1 ? 'rgba(240,196,110,0.55)' : 'rgba(134,181,224,0.55)'
    ctx.fillRect(x - 2.5, y - 2.5, 5, 5)
    const qv = (oy - y) / S
    const b = Math.floor(((qv + 2.4) / 4.8) * bins)
    if (b >= 0 && b < bins) (q === 1 ? h1 : h0)[b]++
    if ((qv > 0 ? 1 : 0) === q) right++
  }
  if (single) {
    const [x, y] = pt(NPTS, qubit)
    ctx.strokeStyle = qubit === 1 ? '#f0c46e' : '#86b5e0'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(x, y, 14 + 30 * ping, 0, Math.PI * 2); ctx.globalAlpha = 1 - ping; ctx.stroke(); ctx.globalAlpha = 1
    ctx.fillStyle = qubit === 1 ? '#f0c46e' : '#86b5e0'; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#dfe5ea'; ctx.font = '26px "IBM Plex Sans", sans-serif'
    ctx.fillText('this pulse', x + 22, y + 8)
    ctx.fillText(y < oy ? 'Result: 1' : 'Result: 0', 960, 300)
  }
  // right panel: histogram and score
  if (n > 0) {
    const hx = 960, hy = 760, hw = 560, hh = 360
    const mx = Math.max(...h0, ...h1, 1)
    ctx.strokeStyle = '#2a2f38'; ctx.strokeRect(hx, hy - hh, hw, hh)
    for (const [h, c] of [[h0, 'rgba(134,181,224,0.8)'], [h1, 'rgba(240,196,110,0.8)']] as const) {
      ctx.fillStyle = c
      h.forEach((v, b) => { const bh = (v / mx) * (hh - 20); ctx.fillRect(hx + (b / bins) * hw, hy - bh, hw / bins - 1, bh) })
    }
    ctx.setLineDash([8, 8]); ctx.strokeStyle = '#c9ccd3'; ctx.beginPath(); ctx.moveTo(hx + hw / 2, hy - hh); ctx.lineTo(hx + hw / 2, hy); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = '#8d93a0'; ctx.font = '22px "IBM Plex Sans", sans-serif'
    ctx.fillText('how many dots landed at each height', hx, hy + 34)
    ctx.fillStyle = '#dfe5ea'; ctx.font = '28px "IBM Plex Sans", sans-serif'
    ctx.fillText(`Shots: ${n.toLocaleString()}`, hx, 210)
    ctx.font = '500 44px "IBM Plex Sans", sans-serif'
    ctx.fillText(`Read correctly: ${((100 * right) / n).toFixed(1)}%`, hx, 280)
  }
}

const stationU = () => { const st = usePath.getState(); return st.station === 4 ? st.u : 0 }
const here = () => usePath.getState().station === 4

export function StationScreen() {
  const settled = useSettled()
  const beat = usePath((st) => (st.station === 4 && settled ? st.beat : -1))
  const { camera } = useThree()
  const route = useMemo(() => v3(ROUTE), [])
  const len = useMemo(() => route.getLength(), [route])
  const vis = useRef(1)

  const canvas = useMemo(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 900; return c }, [])
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t }, [canvas])
  const last = useRef('')
  useEffect(() => () => tex.dispose(), [tex])

  const spec = useMemo<TrailSpec>(() => ({
    center: () => (here() && stationU() < 0.25 ? (stationU() / 0.25) * len : -999),
    width: 260, pitch: 220, lift: () => 0,
    radius: () => Math.min(110, Math.max(20, vis.current * 0.9)),
    twist: () => READOUT_PHASE[usePath.getState().qubit],
  }), [len])

  const tmp = useMemo(() => ({ p: new THREE.Vector3(), a: shot(), b: shot() }), [])
  const K = useMemo(() => {
    const wl = new THREE.Vector3(13000, 8000, 2500), rl = new THREE.Vector3(25000, 9000, FRONT), ml = new THREE.Vector3(MON.x + 900, MON.y, MON.z)
    return {
      wide: { look: wl, pos: wl.clone().addScaledVector(new THREE.Vector3(0.15, 0.25, 1).normalize(), 36000) } as Shot,
      rack: { look: rl, pos: rl.clone().add(new THREE.Vector3(2600, 1400, 10500)) } as Shot,
      mon: { look: ml, pos: ml.clone().add(new THREE.Vector3(900, 500, 8400)) } as Shot,
    }
  }, [])

  useFrame((_, dt) => {
    const u = stationU()
    // redraw the monitor only when what it shows has changed
    const st = usePath.getState()
    const n = st.station === 4 ? Math.floor(seg(u, 0.6, 0.97) * NPTS) : 0
    const single = st.station === 4 && u >= 0.45 && u < 0.6 + 1e-4 && n === 0
    const ping = single ? (st.time * 0.8) % 1 : 0
    const key = `${n}|${single}|${st.qubit}|${st.withAmp}|${single ? ping.toFixed(2) : ''}`
    if (key !== last.current) {
      last.current = key
      const ctx = canvas.getContext('2d')
      if (ctx) { drawPlot(ctx, n, single, st.qubit, st.withAmp, ping); tex.needsUpdate = true }
    }

    let target: Shot
    if (u < 0.25) {
      const a = Math.max(0, Math.min(len, (u / 0.25) * len))
      route.getPointAt(a / len, tmp.p)
      const s = 3.6 + 10 * seg(u, 0.02, 0.12)
      const ch: Shot = { look: tmp.p.clone(), pos: tmp.p.clone().add(new THREE.Vector3(170, 40, 270).multiplyScalar(s)) }
      target = blendShots(ch, K.wide, seg(u, 0.12, 0.2), tmp.a)
      target = blendShots(target, K.rack, seg(u, 0.21, 0.25), tmp.b)
    } else if (u < 0.45) target = K.rack
    else target = blendShots(K.rack, K.mon, seg(u, 0.4, 0.47), tmp.a)
    vis.current = Math.max(1, camera.position.distanceTo(rig.look) / 22)
    if (!here() || st.paused || st.orbiting) return
    drive(camera, target, dt)
  })

  return (
    <group>
      <Lab />
      <Cable pts={ROUTE.slice(1)} />
      <mesh position={[MON.x, MON.y, MON.z]}><planeGeometry args={[MON.w, MON.h]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      <PulseTrail curve={route} spec={spec} />
      {beat === 0 && <>
        <Label open pos={[1972, PLATE_TOP_Y + 260, 226]}>Sealed connector on the top flange</Label>
        <Label open pos={[25000, RACK.top + 600, FRONT]}>Room-temperature electronics</Label>
      </>}
      {beat === 1 && <>
        <Label open pos={[22800, GEN_Y + 500, FRONT + 100]}>Microwave generator</Label>
        <Label open pos={[24300, MIX_Y - 380, FRONT + 100]}>Mixer</Label>
        <Label open pos={[23400, DIG_Y - 520, FRONT + 100]}>Digitizer</Label>
        <Label open pos={[23700, GEN_Y - 450, FRONT + 520]}>Reference, split from the generator</Label>
      </>}
    </group>
  )
}
