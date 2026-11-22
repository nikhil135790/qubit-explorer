import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { READOUT_PHASE } from '../journey/state'
import { Label } from '../scene/common'
import { PulseTrail } from './PulseTrail'
import type { TrailSpec } from './PulseTrail'
import { GOLD } from './StationQubit'
import { FR } from './Fridge'
import { usePath, seg, useSettled, ST } from './state'
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
export const FRONT = RACK.z1
export const GEN_Y = 10445
const MIX_Y = 9222, DIG_Y = 8145
// every cable plugs into a labelled jack at both ends:
// generator RF out -> splitter on top of the rack -> (1) the fridge's input line, (2) the mixer's LO (reference) input;
// fridge output -> mixer RF in; mixer I and Q outs -> digitizer channels; digitizer data -> FPGA -> monitor
// on a 2U panel the jacks sit on the lower row, 183 units below the panel's centre
const JACK_DROP = 183
const GEN_OUT: V = [26600, GEN_Y - JACK_DROP, FRONT + 60]
const SPLIT = { x: 26800, y: RACK.top + 160, z: 3600 } // power splitter sitting on the rack's roof
const RF_IN: V = [23500, MIX_Y, FRONT + 60]
const LO_IN: V = [26000, MIX_Y, FRONT + 60]
const I_OUT: V = [24400, MIX_Y, FRONT + 60], Q_OUT: V = [24900, MIX_Y, FRONT + 60]
const CH1: V = [24400, DIG_Y - JACK_DROP, FRONT + 60], CH2: V = [24900, DIG_Y - JACK_DROP, FRONT + 60]
const DATA_OUT: V = [27200, DIG_Y - JACK_DROP, FRONT + 60]
// desk and monitor
const MON = { x: 14200, y: 3700, z: 1777, w: 5800, h: 3200 }

// the pulse's route: up out of the 4 K box's line, through the top flange, along a flexible cable, down the rack's left edge to the mixer
const ROUTE: V[] = [
  [1972, 11000, 226], [1972, TOP, 226], [1972, 13100, 226], [3200, 13900, 600], [8000, 14200, 1800],
  [16000, 14000, 4200], [21800, 13400, 6300], [22350, 12200, 6400], [22350, 10000, 6400], [22500, MIX_Y + 250, 6350], [23300, MIX_Y + 40, FRONT + 300], RF_IN,
]
// generator to splitter (up the rack's right edge), splitter to the fridge's input on the top flange
const GEN_TO_SPLIT: V[] = [GEN_OUT, [26600, GEN_Y - JACK_DROP, FRONT + 400], [27500, GEN_Y + 300, FRONT + 500], [27600, RACK.top + 400, 4600], [27300, SPLIT.y, SPLIT.z], [27100, SPLIT.y, SPLIT.z]]
const SPLIT_TO_FRIDGE: V[] = [[26500, SPLIT.y, SPLIT.z - 120], [26100, SPLIT.y + 200, SPLIT.z - 300], [24000, 14200, 2600], [14000, 14600, 2400], [2000, 14400, -200], [-282, 13200, 0], [-282, TOP, 0]]
/** The pulse's whole route at room temperature: out of the generator, through the splitter, to the fridge. */
export const TO_FRIDGE: V[] = [...GEN_TO_SPLIT, ...SPLIT_TO_FRIDGE]
const SPLIT_TO_LO: V[] = [[26500, SPLIT.y, SPLIT.z + 120], [26200, SPLIT.y + 150, SPLIT.z + 900], [27700, RACK.top - 300, FRONT + 500], [27700, MIX_Y + 600, FRONT + 500], [26200, MIX_Y + 100, FRONT + 360], LO_IN]
const IQ_OUT: V[][] = [
  [I_OUT, [24400, MIX_Y - 150, FRONT + 360], [24400, DIG_Y + 150, FRONT + 360], CH1],
  [Q_OUT, [24900, MIX_Y - 150, FRONT + 440], [24900, DIG_Y + 150, FRONT + 440], CH2],
]
const TO_MONITOR: V[] = [[25500, 5480, FRONT - 200], [25600, 5300, FRONT + 300], [25200, 4800, FRONT + 700], [24000, 300, 3400], [18000, 60, 1200], [MON.x + 600, 60, 1000]]

const v3 = (p: V[]) => new THREE.CatmullRomCurve3(p.map((q) => new THREE.Vector3(...q)), false, 'centripetal')

const STEEL = { color: '#7d8086', metalness: 0.6, roughness: 0.5 }
const PANEL = { color: '#1f2124', metalness: 0.4, roughness: 0.55 }

function Cable({ pts, r = 30, color = '#5f7490', see }: { pts: V[]; r?: number; color?: string; see?: boolean }) {
  const c = useMemo(() => v3(pts), [pts])
  if (see) return (
    <group>
      <mesh><tubeGeometry args={[c, 240, r, 16, false]} /><meshStandardMaterial color="#9fb0c4" roughness={0.4} metalness={0.3} transparent opacity={0.25} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <mesh><tubeGeometry args={[c, 240, 3, 8, false]} /><meshStandardMaterial color="#d9c08a" metalness={1} roughness={0.3} /></mesh>
    </group>
  )
  return <mesh><tubeGeometry args={[c, 240, r, 12, false]} /><meshStandardMaterial color={color} roughness={0.55} metalness={0.1} /></mesh>
}

function SmaJack({ at }: { at: V }) {
  return (
    <group position={at} rotation={[Math.PI / 2, 0, 0]}>
      <mesh><cylinderGeometry args={[32, 32, 120, 6]} /><meshStandardMaterial {...GOLD} /></mesh>
    </group>
  )
}

type Face = (g: CanvasRenderingContext2D, W: number, H: number, toX: (x: number) => number) => void

/** One rack instrument: a box, a front panel with its face printed on it, optional knob and jacks. */
function Instrument({ y, u, knobs = 0, jacks = [] as number[], leds = 0, face, knobAt }: { y: number; u: number; knobs?: number; jacks?: number[]; leds?: number; face?: Face; knobAt?: [number, number] }) {
  const h = u * 445 - 20, cx = (RACK.x0 + RACK.x1) / 2, w = RACK.x1 - RACK.x0 - 400
  const tex = useMemo(() => {
    if (!face) return null
    const W = 2048, H = Math.round((W * h) / w)
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d')!
    g.fillStyle = '#2b2e33'; g.fillRect(0, 0, W, H)
    face(g, W, H, (x) => ((x - (cx - w / 2)) / w) * W)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
    return t
  }, [face, h, w, cx])
  return (
    <group>
      <mesh position={[cx, y, FRONT - 3000]}><boxGeometry args={[w - 200, h, 6000]} /><meshStandardMaterial {...PANEL} /></mesh>
      <mesh position={[cx, y, FRONT]}><boxGeometry args={[w, h, 60]} /><meshStandardMaterial color="#2a2c30" metalness={0.5} roughness={0.5} /></mesh>
      {tex && <mesh position={[cx, y, FRONT + 31]}><planeGeometry args={[w, h]} /><meshStandardMaterial map={tex} roughness={0.6} metalness={0.1} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.18} /></mesh>}
      {knobAt && <mesh position={[knobAt[0], knobAt[1], FRONT + 100]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[190, 200, 140, 32]} /><meshStandardMaterial color="#1b1c1f" metalness={0.3} roughness={0.45} /></mesh>}
      {Array.from({ length: knobs }, (_, i) => (
        <mesh key={i} position={[cx + 400 + i * 520, y, FRONT + 90]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[150, 150, 120, 24]} /><meshStandardMaterial color="#1b1c1f" roughness={0.6} /></mesh>
      ))}
      {Array.from({ length: leds }, (_, i) => (
        <mesh key={i} position={[RACK.x0 + 600 + i * 160, y + h * 0.3, FRONT + 32]}><circleGeometry args={[30, 12]} /><meshBasicMaterial color={i % 3 === 0 ? '#7cff9a' : '#ffb35c'} /></mesh>
      ))}
      {jacks.map((x) => <SmaJack key={x} at={[x, y - (face && u === 2 ? JACK_DROP : 0), FRONT + 60]} />)}
    </group>
  )
}

const label = (g: CanvasRenderingContext2D, t: string, x: number, y: number, size = 26, color = '#c9ccd3', align: CanvasTextAlign = 'center') => {
  g.fillStyle = color; g.font = `500 ${size}px "IBM Plex Sans", sans-serif`; g.textAlign = align; g.fillText(t, x, y)
}
const jackRing = (g: CanvasRenderingContext2D, x: number, y: number) => { g.strokeStyle = '#8d93a0'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.stroke() }

/** A microwave signal generator: display with frequency and power, soft keys, keypad, knob, RF output. */
const genFace: Face = (g, _W, H, toX) => {
  label(g, 'Microwave signal generator, 100 kHz to 20 GHz', 40, 46, 26, '#9aa0aa', 'left')
  g.fillStyle = '#0d2533'; g.fillRect(40, 70, 760, H - 110)
  label(g, '7.245 000 000 GHz', 70, 165, 64, '#8fe3ff', 'left')
  label(g, '-20.00 dBm', 70, 235, 44, '#8fe3ff', 'left')
  g.fillStyle = '#2f7a4a'; g.fillRect(560, 205, 200, 44); label(g, 'RF ON', 660, 238, 28, '#d8ffe6')
  for (let i = 0; i < 5; i++) { g.fillStyle = '#3b3f46'; g.fillRect(830, 74 + i * 46, 120, 36) }
  // keypad
  const keys = ['7', '8', '9', 'GHz', '4', '5', '6', 'MHz', '1', '2', '3', 'kHz', '0', '.', '-', 'Enter']
  keys.forEach((k, i) => { const x = 1010 + (i % 4) * 84, y = 70 + Math.floor(i / 4) * 58; g.fillStyle = '#41454d'; g.fillRect(x, y, 74, 48); label(g, k, x + 37, y + 33, k.length > 2 ? 18 : 26, '#dfe2e7') })
  label(g, 'FREQ', 1420, 100, 22); label(g, 'AMPL', 1420, 160, 22); label(g, 'RF ON/OFF', 1420, 220, 22)
  const jx = toX(GEN_OUT[0]); jackRing(g, jx, H - 92); label(g, 'RF OUTPUT', jx, H - 150, 24)
  g.fillStyle = '#7cff9a'; g.beginPath(); g.arc(jx + 120, H - 92, 10, 0, Math.PI * 2); g.fill()
}
/** An IQ mixer: RF in, LO (reference) in, I and Q out. */
const mixFace: Face = (g, _W, H, toX) => {
  label(g, 'IQ mixer', 40, H / 2 + 10, 30, '#9aa0aa', 'left')
  for (const [x, t] of [[RF_IN[0], 'RF in'], [I_OUT[0], 'I out'], [Q_OUT[0], 'Q out'], [LO_IN[0], 'LO in (reference)']] as const) {
    const cx = toX(x); jackRing(g, cx, H / 2); label(g, t, cx + 46, H / 2 + 9, 22, '#c9ccd3', 'left')
  }
}
/** A two-channel digitizer: inputs, a small trace display, data out to the FPGA. */
const digFace: Face = (g, _W, H, toX) => {
  label(g, 'Digitizer, 2 channels, 1 billion samples per second', 40, 46, 26, '#9aa0aa', 'left')
  for (const [x, t] of [[CH1[0], 'CH1  I'], [CH2[0], 'CH2  Q']] as const) { const cx = toX(x); jackRing(g, cx, H - 92); label(g, t, cx, H - 150, 22) }
  g.fillStyle = '#0d2533'; g.fillRect(1120, 70, 520, H - 110)
  g.strokeStyle = '#8fe3ff'; g.lineWidth = 3; g.beginPath()
  for (let i = 0; i <= 200; i++) { const x = 1130 + i * 2.5, env = Math.sin((i / 200) * Math.PI); const yy = H / 2 + 10 - env * 60 * Math.sin(i * 0.5); i ? g.lineTo(x, yy) : g.moveTo(x, yy) }
  g.stroke()
  const dx = toX(DATA_OUT[0]); jackRing(g, dx, H - 92); label(g, 'DATA', dx, H - 150, 22)
}

const FPGA = { x: 24300, y: 5400, z: FRONT - 1400 }
function FpgaBoard() {
  const { x, y, z } = FPGA
  return (
    <group>
      <mesh position={[(RACK.x0 + RACK.x1) / 2, y - 60, FRONT - 3000]}><boxGeometry args={[RACK.x1 - RACK.x0 - 400, 60, 6000]} /><meshStandardMaterial color="#2a2c30" metalness={0.5} roughness={0.5} /></mesh>
      <mesh position={[x + 600, y, z]}><boxGeometry args={[4200, 40, 2600]} /><meshStandardMaterial color="#1e5a3c" roughness={0.6} /></mesh>
      {/* the FPGA itself, with its heatsink */}
      <mesh position={[x, y + 60, z]}><boxGeometry args={[900, 80, 900]} /><meshStandardMaterial color="#1b1c1f" roughness={0.4} /></mesh>
      {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[x - 400 + i * 100, y + 260, z]}><boxGeometry args={[40, 320, 880]} /><meshStandardMaterial color="#9a9da3" metalness={0.8} roughness={0.35} /></mesh>)}
      {/* memory and support chips, and the connectors along the front edge */}
      {[[-1200, -700], [-1200, 0], [-1200, 700], [1700, -600], [1700, 400]].map(([dx, dz], i) => (
        <mesh key={i} position={[x + dx, y + 40, z + dz]}><boxGeometry args={[520, 40, 380]} /><meshStandardMaterial color="#202125" roughness={0.45} /></mesh>
      ))}
      {[0, 1, 2, 3].map((i) => <mesh key={i} position={[x - 700 + i * 600, y + 80, z + 1250]}><boxGeometry args={[360, 120, 160]} /><meshStandardMaterial {...GOLD} /></mesh>)}
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
          <mesh position={[x, (FLOOR + 11900) / 2, z]}><boxGeometry args={[450, 11900 - FLOOR, 450]} /><meshStandardMaterial color="#4a4d53" metalness={0.5} roughness={0.55} /></mesh>
          <mesh position={[x, FLOOR + 60, z]}><boxGeometry args={[1600, 120, 1600]} /><meshStandardMaterial color="#1c1c1e" roughness={0.7} /></mesh>
          {(() => {
            const dx = FR.cx - x, dz = FR.cz - z, L = Math.hypot(dx, dz) - 2900
            const mx = x + (dx / Math.hypot(dx, dz)) * (L / 2), mz = z + (dz / Math.hypot(dx, dz)) * (L / 2)
            return <mesh position={[mx, 11700, mz]} rotation={[0, -Math.atan2(dz, dx), 0]}><boxGeometry args={[L, 400, 400]} /><meshStandardMaterial color="#4a4d53" metalness={0.5} roughness={0.55} /></mesh>
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
      <Instrument y={GEN_Y} u={2} jacks={[GEN_OUT[0]]} face={genFace} knobAt={[25350, GEN_Y - 60]} />
      <Instrument y={MIX_Y} u={1} jacks={[RF_IN[0], I_OUT[0], Q_OUT[0], LO_IN[0]]} face={mixFace} />
      <Instrument y={DIG_Y} u={2} jacks={[CH1[0], CH2[0], DATA_OUT[0]]} face={digFace} />
      {/* FPGA board on an open shelf: a green circuit board with the FPGA chip under a finned heatsink */}
      <FpgaBoard />
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

      {/* cables, each from one jack to another */}
      <Cable pts={GEN_TO_SPLIT} see />
      <Cable pts={SPLIT_TO_FRIDGE} see />
      <group position={[SPLIT.x, SPLIT.y, SPLIT.z]}>
        <mesh><boxGeometry args={[600, 160, 420]} /><meshStandardMaterial {...GOLD} /></mesh>
        {[[310, 0], [-310, -120], [-310, 120]].map(([dx, dz], i) => <mesh key={i} position={[dx, 0, dz]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[34, 34, 90, 6]} /><meshStandardMaterial {...GOLD} /></mesh>)}
      </group>
      <Cable pts={SPLIT_TO_LO} r={26} />
      {IQ_OUT.map((p, i) => <Cable key={i} pts={p} r={26} />)}
      <Cable pts={[DATA_OUT, [27200, DIG_Y - JACK_DROP, FRONT + 450], [27300, FPGA.y + 700, FRONT + 500], [26400, FPGA.y + 200, FRONT + 300], [FPGA.x + 1500, FPGA.y + 80, FPGA.z + 1250]]} r={34} color="#1a1a1c" />
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

function drawPlot(ctx: CanvasRenderingContext2D, n: number, single: boolean, qubit: 0 | 1, withAmp: boolean, ping: number, logo: HTMLImageElement | null) {
  const W = 1600, H = 900
  ctx.fillStyle = '#0b0e13'; ctx.fillRect(0, 0, W, H)
  // the lab's logo, top right, if public/logo.png exists
  if (logo) { const h = 110, w = (logo.width / logo.height) * h; ctx.drawImage(logo, W - 50 - w, 28, w, h) }
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

const stationU = () => { const st = usePath.getState(); return st.station === ST.screen ? st.u : 0 }
const here = () => usePath.getState().station === ST.screen

export function StationScreen() {
  const settled = useSettled()
  const beat = usePath((st) => (st.station === ST.screen && settled ? st.beat : -1))
  const { camera } = useThree()
  const route = useMemo(() => v3(ROUTE), [])
  const len = useMemo(() => route.getLength(), [route])
  const vis = useRef(1)

  const canvas = useMemo(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 900; return c }, [])
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t }, [canvas])
  const last = useRef('')
  // optional logo: drop an image at public/logo.png and it appears on the monitor
  const logo = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    const img = new Image()
    img.onload = () => { logo.current = img; last.current = '' }
    img.src = '/logo.png'
  }, [])
  useEffect(() => () => tex.dispose(), [tex])

  const spec = useMemo<TrailSpec>(() => ({
    center: () => (here() && stationU() < 0.25 ? (stationU() / 0.25) * len : -999),
    width: 260, pitch: 60, lift: () => 0,
    radius: () => 22, // inside the cable (radius 30)
    twist: () => READOUT_PHASE[usePath.getState().qubit],
  }), [len])

  const tmp = useMemo(() => ({ p: new THREE.Vector3(), a: shot(), b: shot() }), [])
  const K = useMemo(() => {
    const wl = new THREE.Vector3(13000, 8000, 2500), rl = new THREE.Vector3(25000, 9000, FRONT), ml = new THREE.Vector3(MON.x + 900, MON.y, MON.z)
    return {
      wide: { look: wl, pos: wl.clone().addScaledVector(new THREE.Vector3(0.15, 0.25, 1).normalize(), 36000) } as Shot,
      rack: { look: rl, pos: rl.clone().add(new THREE.Vector3(2600, 1400, 10500)) } as Shot,
      mon: { look: ml, pos: ml.clone().add(new THREE.Vector3(900, 500, 8400)) } as Shot,
      fpga: { look: new THREE.Vector3(FPGA.x + 900, FPGA.y + 200, FPGA.z + 600), pos: new THREE.Vector3(FPGA.x + 900, FPGA.y + 200, FPGA.z + 600).add(new THREE.Vector3(1400, 2600, 5200)) } as Shot,
    }
  }, [])

  useFrame((_, dt) => {
    const u = stationU()
    // redraw the monitor only when what it shows has changed
    const st = usePath.getState()
    const n = st.station === ST.screen ? Math.floor(seg(u, 0.6, 0.97) * NPTS) : 0
    const single = st.station === ST.screen && u >= 0.57 && u < 0.6 + 1e-4 && n === 0
    const ping = single ? (st.time * 0.8) % 1 : 0
    const key = `${n}|${single}|${st.qubit}|${st.withAmp}|${single ? ping.toFixed(2) : ''}`
    if (key !== last.current) {
      last.current = key
      const ctx = canvas.getContext('2d')
      if (ctx) { drawPlot(ctx, n, single, st.qubit, st.withAmp, ping, logo.current); tex.needsUpdate = true }
    }

    let target: Shot
    if (u < 0.25) {
      const a = Math.max(0, Math.min(len, (u / 0.25) * len))
      route.getPointAt(a / len, tmp.p)
      const s = 3.6 + 10 * seg(u, 0.02, 0.12)
      const ch: Shot = { look: tmp.p.clone(), pos: tmp.p.clone().add(new THREE.Vector3(170, 40, 270).multiplyScalar(s)) }
      target = blendShots(ch, K.wide, seg(u, 0.12, 0.2), tmp.a)
      target = blendShots(target, K.rack, seg(u, 0.21, 0.25), tmp.b)
    } else if (u < 0.5) target = blendShots(K.rack, K.fpga, seg(u, 0.4, 0.46), tmp.a)
    else target = blendShots(K.fpga, K.mon, seg(u, 0.5, 0.57), tmp.a)
    vis.current = Math.max(1, camera.position.distanceTo(rig.look) / 22)
    if (!here() || st.paused || st.orbiting) return
    drive(camera, target, dt)
  })

  return (
    <group>
      <Lab />
      <Cable pts={ROUTE.slice(1)} see />
      <mesh position={[MON.x, MON.y, MON.z]}><planeGeometry args={[MON.w, MON.h]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      <PulseTrail curve={route} spec={spec} />
      {beat === 0 && <>
        <Label open pos={[1972, PLATE_TOP_Y + 260, 226]}>Sealed connector on the top flange</Label>
        <Label open pos={[25000, RACK.top + 600, FRONT]}>Room-temperature electronics</Label>
      </>}
      {beat === 2 && <Label open pos={[FPGA.x, FPGA.y + 480, FPGA.z]}>FPGA</Label>}
      {beat === 1 && <>
        <Label open pos={[RF_IN[0], MIX_Y + 330, FRONT + 100]}>Mixer</Label>
        <Label open pos={[27700, MIX_Y + 900, FRONT + 500]}>Reference from the splitter</Label>
        <Label open pos={[22350, 11000, 6400]}>Pulse from the fridge</Label>
        <Label open pos={[CH1[0], DIG_Y - 560, FRONT + 100]}>Digitizer</Label>
      </>}
    </group>
  )
}
