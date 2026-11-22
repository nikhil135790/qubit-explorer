import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Label } from '../scene/common'
import { usePath, useSettled } from './state'

/**
 * A dilution refrigerator "chandelier" with its radiation shields and vacuum can removed, in the
 * style of a Bluefors XLD. Scene units: 1 = 0.1 mm, so the bottom plate is 42 cm across and the
 * whole stack is about 1.2 m tall. The qubit package sits at the world origin on top of the
 * mixing chamber (MXC) plate; the amplifier package sits 9 cm away on the same plate.
 *
 * Plates, top to bottom: room-temperature flange (stainless), 50 K, 4 K, still (~1 K),
 * cold plate (~100 mK), mixing chamber plate (~10 mK). All but the top are gold-plated copper.
 */
export const FR = { cx: 450, cz: -900 }
export const PLATE_TOP = -25 // top surface of the mixing chamber plate

type Plate = { key: string; y0: number; h: number; r: number; label: string; steel?: boolean }
export const PLATES: Plate[] = [
  { key: 'mxc', y0: -145, h: 120, r: 2100, label: 'Mixing chamber plate, 10 mK' },
  { key: 'cp', y0: 1475, h: 100, r: 2150, label: 'Cold plate, 0.1 K' },
  { key: 'still', y0: 3575, h: 100, r: 2250, label: 'Still plate, 1 K' },
  { key: '4k', y0: 6175, h: 120, r: 2450, label: '4 K plate' },
  { key: '50k', y0: 8795, h: 120, r: 2650, label: '50 K plate' },
  { key: '300k', y0: 11915, h: 220, r: 3000, label: 'Room temperature', steel: true },
]
const TOP = PLATES[5].y0 + PLATES[5].h

const at = (r: number, deg: number): [number, number] => [FR.cx + r * Math.cos((deg * Math.PI) / 180), FR.cz + r * Math.sin((deg * Math.PI) / 180)]

/** Gold plating over machined copper: faint fly-cut swirl, mottling, optional tapped-hole grid. */
function plateTexture(holes: boolean, steel = false) {
  const N = 1024
  const c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')!
  g.fillStyle = steel ? '#a9aaa8' : '#d3a75a'
  g.fillRect(0, 0, N, N)
  let s = holes ? 11 : 5
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  // fly-cutter swirl: overlapping arcs from an off-centre spindle
  g.lineWidth = 1.2
  for (let i = 0; i < 520; i++) {
    const rad = 80 + r() * 900
    g.strokeStyle = `rgba(${steel ? '255,255,255' : '255,236,190'},${0.02 + r() * 0.05})`
    g.beginPath(); g.arc(N * 0.5 + (r() - 0.5) * 60, N * 1.15, rad, Math.PI * 1.1, Math.PI * 1.9); g.stroke()
  }
  // mottling from handling and uneven plating
  for (let i = 0; i < 900; i++) {
    const x = r() * N, y = r() * N, rr = 4 + r() * 40
    const grd = g.createRadialGradient(x, y, 0, x, y, rr)
    const dark = r() < 0.5
    grd.addColorStop(0, dark ? 'rgba(90,60,20,0.07)' : 'rgba(255,240,200,0.06)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd; g.fillRect(x - rr, y - rr, rr * 2, rr * 2)
  }
  if (holes) {
    // M4 tapped holes on a 25 mm grid, as on real fridge plates (plate is ~1 m across in this texture's span)
    const step = N / 18
    for (let i = 1; i < 18; i++) for (let j = 1; j < 18; j++) {
      const x = i * step, y = j * step
      g.fillStyle = 'rgba(40,26,8,0.85)'; g.beginPath(); g.arc(x, y, 4.2, 0, Math.PI * 2); g.fill()
      g.strokeStyle = 'rgba(255,230,170,0.35)'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, 5.6, 0, Math.PI * 2); g.stroke()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function Disc({ p, map }: { p: Plate; map: THREE.Texture }) {
  return (
    <mesh position={[FR.cx, p.y0 + p.h / 2, FR.cz]}>
      <cylinderGeometry args={[p.r, p.r, p.h, 128]} />
      <meshStandardMaterial map={map} color="#ffffff" metalness={1} roughness={p.steel ? 0.45 : 0.42} />
    </mesh>
  )
}

/** Instanced helper: one mesh, many transforms. */
function Many({ geo, mat, items }: { geo: THREE.BufferGeometry; mat: THREE.Material; items: THREE.Matrix4[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    items.forEach((mx, i) => m.setMatrixAt(i, mx))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} />
}

const M = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(sx, sy, sz))

/** Where the bottom plate stays clear of drilled holes (under the two packages and the mixing chamber). */
const CHAINS: [number, number, boolean][] = [[0, 0, true], [150, -1500, true], [-1250, -700, false]] // our chain and the two others
const clear = (x: number, z: number) =>
  CHAINS.some(([ox, oz, iso]) => (Math.abs(x - ox) < 205 && Math.abs(z - oz) < 205) || (Math.abs(x - ox - 900) < 110 && Math.abs(z - oz) < 110) || (iso && Math.hypot(x - ox - 1400, z - oz) < 200)) ||
  Math.hypot(x - FR.cx, z - FR.cz) < 470 || Math.hypot(x - FR.cx, z - FR.cz) > 1990

/** Semi-rigid coax lines from the top flange down to the bottom plate, with an attenuator at each stage. */
const LINE_ANGLES = Array.from({ length: 15 }, (_, i) => 198 + i * 10.5)

export function Fridge() {
  const settled = useSettled()
  const beat = usePath((s) => (s.station === 0 && settled ? s.beat : -1))
  const tex = useMemo(() => ({ gold: plateTexture(true), plain: plateTexture(false), steel: plateTexture(true, true) }), [])

  const mats = useMemo(() => ({
    hole: new THREE.MeshStandardMaterial({ color: '#1b1208', metalness: 0.3, roughness: 0.9 }),
    chamfer: new THREE.MeshStandardMaterial({ color: '#e9c27a', metalness: 1, roughness: 0.25 }),
    screw: new THREE.MeshStandardMaterial({ color: '#9a9690', metalness: 1, roughness: 0.32 }),
    socket: new THREE.MeshStandardMaterial({ color: '#141414', metalness: 0.5, roughness: 0.7 }),
    coax: new THREE.MeshStandardMaterial({ color: '#c8c8c6', metalness: 1, roughness: 0.28 }),
    atten: new THREE.MeshStandardMaterial({ color: '#d9b366', metalness: 1, roughness: 0.3 }),
    nut: new THREE.MeshStandardMaterial({ color: '#cfa955', metalness: 1, roughness: 0.35 }),
  }), [])
  const geos = useMemo(() => ({
    cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
    hex: new THREE.CylinderGeometry(1, 1, 1, 6),
    ring: new THREE.RingGeometry(1, 1.35, 24).rotateX(-Math.PI / 2),
    disc: new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
  }), [])

  // drilled, tapped holes on the bottom plate, 25 mm apart, as real geometry so they read up close
  const holes = useMemo(() => {
    const disc: THREE.Matrix4[] = [], ring: THREE.Matrix4[] = []
    for (let x = FR.cx - 2000; x <= FR.cx + 2000; x += 250) for (let z = FR.cz - 2000; z <= FR.cz + 2000; z += 250) {
      if (clear(x, z)) continue
      disc.push(M(x, PLATE_TOP + 0.4, z, 21, 1, 21))
      ring.push(M(x, PLATE_TOP + 0.3, z, 21, 1, 21))
    }
    return { disc, ring }
  }, [])

  // socket-head screws around the rim of every plate
  const screws = useMemo(() => {
    const body: THREE.Matrix4[] = [], sock: THREE.Matrix4[] = []
    for (const p of PLATES) {
      const n = 28
      for (let i = 0; i < n; i++) {
        const [x, z] = at(p.r - 110, (i / n) * 360 + 6)
        const y = p.y0 + p.h
        body.push(M(x, y + 20, z, 34, 40, 34))
        sock.push(M(x, y + 40.5, z, 15, 1, 15))
      }
    }
    return { body, sock }
  }, [])

  // coax lines, attenuators below each plate, and SMA nuts on both ends of each attenuator
  const lines = useMemo(() => {
    const coax: THREE.Matrix4[] = [], att: THREE.Matrix4[] = [], nut: THREE.Matrix4[] = []
    LINE_ANGLES.forEach((deg, i) => {
      const [x, z] = at(i % 2 ? 1330 : 1530, deg)
      const y0 = PLATE_TOP + 260
      coax.push(M(x, (y0 + TOP + 180) / 2, z, 11, TOP + 180 - y0, 11))
      // attenuator just above the bottom plate, then one hanging under each plate above
      const stops = [PLATE_TOP + 150, ...PLATES.slice(1, 5).map((p) => p.y0 - 90)]
      for (const y of stops) {
        att.push(M(x, y, z, 27, 120, 27))
        nut.push(M(x, y + 70, z, 31, 20, 31), M(x, y - 70, z, 31, 20, 31))
      }
      // SMA bulkhead on the bottom plate, and a hermetic feedthrough on top
      nut.push(M(x, PLATE_TOP + 45, z, 34, 90, 34), M(x, TOP + 40, z, 46, 80, 46))
    })
    return { coax, att, nut }
  }, [])

  const supports = (lower: Plate, upper: Plate, r: number, mat: 'g10' | 'steel') => [30, 150, 270].map((deg) => {
    const [x, z] = at(Math.min(lower.r, upper.r) * 0.86, deg)
    const y0 = lower.y0 + lower.h, y1 = upper.y0
    return (
      <mesh key={upper.key + deg} position={[x, (y0 + y1) / 2, z]}>
        <cylinderGeometry args={[r, r, y1 - y0, 28]} />
        {mat === 'g10'
          ? <meshStandardMaterial color="#a9a06e" roughness={0.55} metalness={0} />
          : <meshStandardMaterial color="#b9bab8" roughness={0.3} metalness={1} />}
      </mesh>
    )
  })

  // the continuous heat exchanger between the still and the mixing chamber: a long coiled tube
  const chx = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const turns = 11, y0 = 3120, y1 = 1640
    for (let i = 0; i <= turns * 32; i++) {
      const t = i / (turns * 32)
      const a = t * turns * Math.PI * 2
      pts.push(new THREE.Vector3(FR.cx + 240 * Math.cos(a), y0 + (y1 - y0) * t, FR.cz + 240 * Math.sin(a)))
    }
    return new THREE.CatmullRomCurve3(pts)
  }, [])

  const [ptx, ptz] = at(1450, 222)
  const [plx, plz] = at(900, 300)
  const [loomx, loomz] = at(1820, 250)
  const labelAt = (p: Plate): [number, number, number] => { const [x, z] = at(p.r * 1.0, -24); return [x, p.y0 + p.h / 2, z] }

  return (
    <group>
      {PLATES.map((p) => <Disc key={p.key} p={p} map={p.steel ? tex.steel : p.key === 'mxc' ? tex.plain : tex.gold} />)}
      <Many geo={geos.disc} mat={mats.hole} items={holes.disc} />
      <Many geo={geos.ring} mat={mats.chamfer} items={holes.ring} />
      <Many geo={geos.cyl} mat={mats.screw} items={screws.body} />
      <Many geo={geos.hex} mat={mats.socket} items={screws.sock} />
      <Many geo={geos.cyl} mat={mats.coax} items={lines.coax} />
      <Many geo={geos.cyl} mat={mats.atten} items={lines.att} />
      <Many geo={geos.hex} mat={mats.nut} items={lines.nut} />

      {/* supports: stainless rods at the top, fibreglass (G10) tubes lower down, where heat leaks must be tiny */}
      {supports(PLATES[4], PLATES[5], 75, 'steel')}
      {supports(PLATES[3], PLATES[4], 85, 'g10')}
      {supports(PLATES[2], PLATES[3], 70, 'g10')}
      {supports(PLATES[1], PLATES[2], 60, 'g10')}
      {supports(PLATES[0], PLATES[1], 55, 'g10')}

      {/* pulse tube cooler: motor head on top, first stage cold at the 50 K plate, second at 4 K */}
      <group>
        <mesh position={[ptx, TOP + 520, ptz]}><cylinderGeometry args={[310, 310, 1040, 40]} /><meshStandardMaterial color="#3b3d41" roughness={0.5} metalness={0.4} /></mesh>
        <mesh position={[ptx, TOP + 1080, ptz]}><cylinderGeometry args={[200, 260, 90, 40]} /><meshStandardMaterial color="#2a2b2e" roughness={0.6} /></mesh>
        <mesh position={[ptx, (PLATES[4].y0 + PLATES[4].h + TOP) / 2, ptz]}><cylinderGeometry args={[230, 230, TOP - PLATES[4].y0 - PLATES[4].h, 40]} /><meshStandardMaterial color="#c4c5c3" roughness={0.3} metalness={1} /></mesh>
        <mesh position={[ptx, PLATES[4].y0 + PLATES[4].h + 90, ptz]}><cylinderGeometry args={[330, 330, 180, 40]} /><meshStandardMaterial color="#b4703f" roughness={0.35} metalness={1} /></mesh>
        <mesh position={[ptx - 70, (PLATES[3].y0 + PLATES[3].h + PLATES[4].y0) / 2, ptz]}><cylinderGeometry args={[130, 130, PLATES[4].y0 - PLATES[3].y0 - PLATES[3].h, 32]} /><meshStandardMaterial color="#c4c5c3" roughness={0.3} metalness={1} /></mesh>
        <mesh position={[ptx + 150, (PLATES[3].y0 + PLATES[3].h + PLATES[4].y0) / 2, ptz]}><cylinderGeometry args={[60, 60, PLATES[4].y0 - PLATES[3].y0 - PLATES[3].h, 24]} /><meshStandardMaterial color="#c4c5c3" roughness={0.3} metalness={1} /></mesh>
        <mesh position={[ptx, PLATES[3].y0 + PLATES[3].h + 80, ptz]}><cylinderGeometry args={[240, 240, 160, 40]} /><meshStandardMaterial color="#b4703f" roughness={0.35} metalness={1} /></mesh>
      </group>

      {/* still pumping line: the wide tube that pumps helium-3 vapour off the still */}
      <mesh position={[plx, (PLATES[2].y0 + PLATES[2].h + TOP) / 2, plz]}><cylinderGeometry args={[190, 190, TOP - PLATES[2].y0 - PLATES[2].h, 40]} /><meshStandardMaterial color="#c2c3c1" roughness={0.28} metalness={1} /></mesh>

      {/* still pot under the still plate, the heat exchangers, and the mixing chamber on the bottom plate */}
      <mesh position={[FR.cx, PLATES[2].y0 - 220, FR.cz]}><cylinderGeometry args={[430, 430, 440, 64]} /><meshStandardMaterial color="#d6ab5e" metalness={1} roughness={0.3} /></mesh>
      <mesh position={[FR.cx, PLATES[2].y0 - 450, FR.cz]}><cylinderGeometry args={[470, 470, 30, 64]} /><meshStandardMaterial color="#d6ab5e" metalness={1} roughness={0.3} /></mesh>
      <mesh><tubeGeometry args={[chx, 900, 13, 8, false]} /><meshStandardMaterial color="#d8d6d0" metalness={1} roughness={0.25} /></mesh>
      {[2950, 2620, 2290, 1960, 1700].map((y) => (
        <mesh key={y} position={[FR.cx, y, FR.cz]}><cylinderGeometry args={[165, 165, 80, 40]} /><meshStandardMaterial color="#cfd0d2" metalness={1} roughness={0.3} /></mesh>
      ))}
      {[-70, 70].map((dx) => (
        <mesh key={dx} position={[FR.cx + dx, (PLATE_TOP + 520 + PLATES[2].y0 - 470) / 2, FR.cz]}><cylinderGeometry args={[16, 16, PLATES[2].y0 - 470 - PLATE_TOP - 520, 12]} /><meshStandardMaterial color="#d8d6d0" metalness={1} roughness={0.25} /></mesh>
      ))}
      <group position={[FR.cx, PLATE_TOP, FR.cz]}>
        <mesh position={[0, 15, 0]}><cylinderGeometry args={[450, 450, 30, 64]} /><meshStandardMaterial color="#d6ab5e" metalness={1} roughness={0.3} /></mesh>
        <mesh position={[0, 270, 0]}><cylinderGeometry args={[380, 380, 480, 64]} /><meshStandardMaterial color="#d6ab5e" metalness={1} roughness={0.28} /></mesh>
        <mesh position={[0, 520, 0]}><cylinderGeometry args={[450, 450, 40, 64]} /><meshStandardMaterial color="#d6ab5e" metalness={1} roughness={0.3} /></mesh>
        {/* thermometer and heater blocks with their thin wiring */}
        <mesh position={[420, 50, 220]}><boxGeometry args={[120, 70, 80]} /><meshStandardMaterial color="#d1a85c" metalness={1} roughness={0.35} /></mesh>
        <mesh position={[-430, 30, 160]}><boxGeometry args={[70, 40, 110]} /><meshStandardMaterial color="#d1a85c" metalness={1} roughness={0.35} /></mesh>
      </group>

      {/* a flat loom of thermometer and heater wiring running down the back */}
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[loomx + k * 70, (PLATE_TOP + TOP) / 2, loomz - k * 30]}>
          <boxGeometry args={[55, TOP - PLATE_TOP, 5]} />
          <meshStandardMaterial color="#6a4a2b" roughness={0.75} />
        </mesh>
      ))}

      {beat === 0 && PLATES.map((p) => <Label key={p.key} open pos={labelAt(p)}>{p.label}</Label>)}
      {beat === 0 && <Label open pos={[ptx - 300, TOP + 700, ptz]}>Pulse tube cooler</Label>}
      {beat === 1 && <>
        <Label open pos={[-60, 40, 120]}>Our qubit chip box</Label>
        <Label open pos={[960, 40, 60]}>Amplifier box</Label>
        <Label open pos={[1400, 75, 0]}>Isolator</Label>
        <Label open pos={[FR.cx + 380, 300, FR.cz + 120]}>Mixing chamber</Label>
      </>}
    </group>
  )
}

/** The three lines that matter to us, routed from the two boxes up through the fridge. */
export function OurLines() {
  const tube = (pts: [number, number, number][]) => {
    const full = [...pts, [pts[pts.length - 1][0], TOP + 180, pts[pts.length - 1][2]] as [number, number, number]]
    return new THREE.CatmullRomCurve3(full.map((p) => new THREE.Vector3(...p)), false, 'centripetal', 0.2)
  }
  const routes = useMemo(() => [
    // qubit drive and readout input, coming down from room temperature
    { c: tube([[-207, 0.6, 0], [-245, 0.6, 0], [-268, 6, 0], [-280, 30, 0], [-282, 80, 0], [-282, 140, 0]]), att: [-282, 230, 0] as const },
    // pump line for the amplifier
    { c: tube([[900, 0.5, 103], [900, 0.5, 160], [882, 0.5, 222], [842, 0.5, 270], [770, 0.5, 300], [732, 0.5, 300], [708, 8, 300], [700, 40, 300], [698, 100, 300], [698, 150, 300]]), att: [698, 260, 300] as const },
  ], [])
  return (
    <group>
      {routes.map((r, i) => (
        <group key={i}>
          <mesh><tubeGeometry args={[r.c, 400, 10, 14, false]} /><meshStandardMaterial color="#c8c8c6" metalness={1} roughness={0.28} /></mesh>
          {r.att && <group position={r.att as unknown as [number, number, number]}>
            <mesh><cylinderGeometry args={[26, 26, 120, 24]} /><meshStandardMaterial color="#d9b366" metalness={1} roughness={0.3} /></mesh>
            {[-70, 70].map((dy) => <mesh key={dy} position={[0, dy, 0]}><cylinderGeometry args={[30, 30, 20, 6]} /><meshStandardMaterial color="#cfa955" metalness={1} roughness={0.35} /></mesh>)}
          </group>}
        </group>
      ))}
    </group>
  )
}
