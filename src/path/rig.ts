import * as THREE from 'three'

export type Shot = { pos: THREE.Vector3; look: THREE.Vector3 }
export const shot = (): Shot => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() })

/**
 * Shared camera state. `look` is where the scripted camera is aiming (the drag pivot uses it),
 * `catchup` > 0 means the camera was moved by hand or jumped, so ease back onto the script
 * instead of snapping.
 */
export const rig = { look: new THREE.Vector3(), catchup: 0 }

/**
 * Blend two camera shots so that zooming feels even across scales: the look point moves linearly,
 * the viewing direction rotates smoothly, and the distance changes geometrically (log space).
 */
export function blendShots(a: Shot, b: Shot, t: number, out: Shot = shot()): Shot {
  const da = a.pos.clone().sub(a.look), db = b.pos.clone().sub(b.look)
  const la = Math.max(da.length(), 1e-9), lb = Math.max(db.length(), 1e-9)
  const w = la < lb ? Math.pow(t, 0.35) : 1 - Math.pow(1 - t, 0.35)
  out.look.copy(a.look).lerp(b.look, w)
  const dir = da.divideScalar(la).lerp(db.divideScalar(lb), t).normalize()
  out.pos.copy(out.look).addScaledVector(dir, Math.exp(Math.log(la) + (Math.log(lb) - Math.log(la)) * t))
  return out
}

/**
 * Zoom between a close shot of something small and a wide shot that contains it (t = 0 is the
 * close shot, t = 1 the wide one). Distance changes in log space, and the look point only drifts
 * away from the small subject in proportion to how far back the camera already is, so the subject
 * never slides out of frame. Works in both directions: use 1 - t to zoom in.
 */
export function zoomShot(small: Shot, big: Shot, t: number, out: Shot = shot()): Shot {
  const ds = small.pos.clone().sub(small.look), db = big.pos.clone().sub(big.look)
  const ls = Math.max(ds.length(), 1e-9), lb = Math.max(db.length(), 1e-9)
  const d = Math.exp(Math.log(ls) + (Math.log(lb) - Math.log(ls)) * t)
  const w = Math.min(1, Math.max(0, (d - ls) / (lb - ls)))
  out.look.copy(small.look).lerp(big.look, w)
  const dir = ds.divideScalar(ls).lerp(db.divideScalar(lb), t).normalize()
  out.pos.copy(out.look).addScaledVector(dir, d)
  return out
}

/** Put the camera on a scripted shot. Exact, unless it is catching up after a jump or a drag. */
export function drive(camera: THREE.Camera, target: Shot, dt: number) {
  if (rig.catchup > 0) {
    rig.catchup = Math.max(0, rig.catchup - dt)
    const cur: Shot = { pos: camera.position.clone(), look: rig.look.clone() }
    const k = rig.catchup === 0 ? 1 : 1 - Math.exp(-dt * 6)
    const s = blendShots(cur, target, k)
    camera.position.copy(s.pos)
    rig.look.copy(s.look)
  } else {
    camera.position.copy(target.pos)
    rig.look.copy(target.look)
  }
  camera.lookAt(rig.look)
}
