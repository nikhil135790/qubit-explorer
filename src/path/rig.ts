import * as THREE from 'three'

export type Shot = { pos: THREE.Vector3; look: THREE.Vector3 }

/**
 * Blend two camera shots so that zooming feels even across scales: the look point moves linearly,
 * the viewing direction rotates smoothly, and the distance changes geometrically (log space).
 * Going from a 9 mm chip to a 200 nm junction then takes the same time per factor of 10.
 */
export function blendShots(a: Shot, b: Shot, t: number, out: Shot = { pos: new THREE.Vector3(), look: new THREE.Vector3() }): Shot {
  const da = a.pos.clone().sub(a.look), db = b.pos.clone().sub(b.look)
  const la = Math.max(da.length(), 1e-9), lb = Math.max(db.length(), 1e-9)
  // keep the look point near the subject that is closer to the camera, so small things stay centred
  const w = la < lb ? Math.pow(t, 0.35) : 1 - Math.pow(1 - t, 0.35)
  out.look.copy(a.look).lerp(b.look, w)
  const dir = da.divideScalar(la).lerp(db.divideScalar(lb), t).normalize()
  out.pos.copy(out.look).addScaledVector(dir, Math.exp(Math.log(la) + (Math.log(lb) - Math.log(la)) * t))
  return out
}

/** Ease the real camera toward a target shot, also in log space, so it never overshoots tiny scenes. */
export function follow(camera: THREE.Camera, look: THREE.Vector3, target: Shot, k: number) {
  const cur: Shot = { pos: camera.position.clone(), look: look.clone() }
  const s = blendShots(cur, target, k)
  camera.position.copy(s.pos)
  look.copy(s.look)
  camera.lookAt(look)
}
