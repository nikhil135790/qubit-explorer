import { useMemo } from 'react'
import * as THREE from 'three'
import { Package } from './StationQubit'
import { AmpPackage } from './StationAmp'
import { Isolator } from './StationIso'
import { Rect, GAP, FILM, Y_GROUND } from '../journey/Chip'

/**
 * Other experiments sharing the bottom plate, as in any working fridge: more qubit chip boxes,
 * each with its own amplifier (and isolator), wired up through the fridge. They are static scenery,
 * built from the same parts as the chain we follow, but with simpler chips so they stay light.
 */
const TOP = 12115 + 180
type V = [number, number, number]

const tube = (pts: V[], up = true) => {
  const full = up ? [...pts, [pts[pts.length - 1][0], TOP, pts[pts.length - 1][2]] as V] : pts
  return new THREE.CatmullRomCurve3(full.map((p) => new THREE.Vector3(...p)), false, 'centripetal', 0.2)
}
const shift = (pts: V[], o: V): V[] => pts.map(([x, y, z]) => [x + o[0], y + o[1], z + o[2]])

/** A plain stand-in for a chip: silicon, a metal film, and a feedline. */
function PlainChip() {
  return (
    <group>
      <mesh position={[0, -0.6, -6]}><boxGeometry args={[90, 1.2, 60]} /><meshStandardMaterial {...GAP} /></mesh>
      <Rect x={0} z={-6} w={90} d={60} y={Y_GROUND} mat={FILM} h={0.02} />
      <Rect x={0} z={0} w={90} d={2.2} y={0.066} mat={GAP} />
      {[-30, -10, 10, 30].map((x) => <Rect key={x} x={x} z={-14} w={7} d={9} y={0.066} mat={GAP} />)}
    </group>
  )
}

const CABLE: V[] = [[207, 0.6, 0], [260, 0.6, 0], [330, 22, 0], [480, 34, 2], [630, 22, 4], [720, 0.6, 4], [792, 0.6, 4]]
const INPUT: V[] = [[-207, 0.6, 0], [-245, 0.6, 0], [-268, 6, 0], [-280, 30, 0], [-282, 80, 0], [-282, 140, 0]]
const TO_ISO: V[] = [[1003, 0.6, 4], [1060, 0.6, 4], [1120, 12, 2], [1180, 20, 0], [1225, 20, 0]]
const ISO_OUT: V[] = [[1487, 20, 152], [1507, 20, 186], [1530, 45, 222], [1534, 90, 226], [1534, 300, 226]]
const AMP_OUT: V[] = [[1003, 0.6, 4], [1055, 0.6, 4], [1080, 8, 4], [1094, 40, 4], [1096, 100, 4], [1096, 150, 4]]

function Chain({ at, iso }: { at: V; iso: boolean }) {
  const curves = useMemo(() => {
    const c = [tube(shift(CABLE, at), false), tube(shift(INPUT, at))]
    if (iso) c.push(tube(shift(TO_ISO, at), false), tube(shift(ISO_OUT, at)))
    else c.push(tube(shift(AMP_OUT, at)))
    return c
  }, [at, iso])
  return (
    <group>
      <group position={at}>
        <PlainChip />
        <Package lite />
        <group position={[900, 0, 0]}><AmpPackage lite /></group>
        {iso && <Isolator closed />}
      </group>
      {curves.map((c, i) => (
        <mesh key={i}><tubeGeometry args={[c, 200, 10, 12, false]} /><meshStandardMaterial color="#c8c8c6" metalness={1} roughness={0.28} /></mesh>
      ))}
    </group>
  )
}

export const OTHER: { at: V; iso: boolean }[] = [
  { at: [150, 0, -1500], iso: true },
  { at: [-1250, 0, -700], iso: false },
]

export function OtherChains() {
  return <>{OTHER.map((c, i) => <Chain key={i} {...c} />)}</>
}
