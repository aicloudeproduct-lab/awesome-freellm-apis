// Shot system helpers: lip sync from voice.json, camera keyframes, hand
// attachments and gaze/expression utilities.
import * as THREE from 'three';
import {clamp, lerp, track, smooth} from '../lib/util.js';
import VOICE from '../../build/voice.json';

export const voice = VOICE;
const FPS = 24;

/** Mouth for character `who` at film time t (sub-frame interpolated). */
export function talk(who, t, gain = 1) {
  for (const v of Object.values(VOICE)) {
    if (v.who !== who) continue;
    const lt = t - v.at;
    if (lt < -0.05 || lt > v.dur + 0.1) continue;
    const f = lt * FPS, i = Math.floor(f), u = f - i;
    const at = (arr, k) => arr[Math.max(0, Math.min(arr.length - 1, k))] || 0;
    const o = lerp(at(v.open, i), at(v.open, i + 1), u);
    const r = lerp(at(v.round, i), at(v.round, i + 1), u);
    return {open: clamp(o * gain), round: clamp(r)};
  }
  return {open: 0, round: 0};
}
export const lineAt = (id) => VOICE[id];
export const speaking = (who, t) => talk(who, t).open > 0.05;

/** Camera keys: [[t, [px,py,pz], [tx,ty,tz], fov], ...] (local shot time). */
export function camRig(keys) {
  const pos = track(keys.map((k) => [k[0], k[1], k[4]]));
  const tgt = track(keys.map((k) => [k[0], k[2], k[4]]));
  const fov = track(keys.map((k) => [k[0], k[3] ?? 35, k[4]]));
  return (cam, lt, shake = 0) => {
    const p = pos(lt), q = tgt(lt);
    cam.position.set(p[0], p[1], p[2]);
    if (shake) cam.position.add(new THREE.Vector3(Math.sin(lt * 1.3) * shake, Math.sin(lt * 1.7 + 1) * shake * 0.6, 0));
    cam.lookAt(q[0], q[1], q[2]);
    cam.fov = fov(lt);
    cam.updateProjectionMatrix();
  };
}

/** Palm frame of a character's hand (world): origin at the palm centre. */
export function palm(ch, side) {
  const w = ch.bones['wrist.' + side], m = ch.bones['finger3-1.' + side];
  const pw = w.getWorldPosition(new THREE.Vector3()), pm = m.getWorldPosition(new THREE.Vector3());
  const q = w.getWorldQuaternion(new THREE.Quaternion());
  const nrm = ch.palmN[side].clone().applyQuaternion(q).normalize();
  const along = pm.clone().sub(pw).normalize();
  const across = new THREE.Vector3().crossVectors(along, nrm).normalize();
  const c = pw.clone().lerp(pm, 0.55).add(nrm.clone().multiplyScalar(0.012));
  return {c, along, nrm, across, q};
}

/** Place an object in a hand: off = [along, normal, across] metres; obj axes: x=across, y=along, z=normal (screen faces +z). */
export function inHand(obj, ch, side, off = [0, 0, 0], extra = null) {
  const P = palm(ch, side);
  obj.position.copy(P.c).addScaledVector(P.along, off[0]).addScaledVector(P.nrm, off[1]).addScaledVector(P.across, off[2]);
  const m = new THREE.Matrix4().makeBasis(P.across, P.along, P.nrm);
  obj.quaternion.setFromRotationMatrix(m);
  if (extra) obj.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...extra)));
}

/** Ease helpers for keyed scalar values in local time: k = [[t, v], ...] */
export const key = (k) => track(k);

export function attach(scene, ...chars) { for (const c of chars) if (c && c.root.parent !== scene) scene.add(c.root); }
export function detachAll(cast) { for (const c of Object.values(cast)) c.root.removeFromParent(); }
export const hideAllBut = (cast, keep) => { for (const [k, c] of Object.entries(cast)) c.root.visible = keep.includes(k); };

export const LOOK = {
  warm: {tint: [1.07, 1.0, 0.9], sat: 1.05},
  neutral: {tint: [1, 1, 1], sat: 1.0},
  cool1: {tint: [0.97, 0.99, 1.04], sat: 0.95},
  cool2: {tint: [0.93, 0.97, 1.08], sat: 0.85},
  cool3: {tint: [0.9, 0.95, 1.1], sat: 0.78},
  night: {tint: [0.92, 0.97, 1.1], sat: 0.9},
};

/**
 * Camera framed on a character: yaw is measured from the character's facing
 * (0 = straight in front, + towards the character's left), pitch + looks down
 * from above. part: 'eyes' | 'chest' | 'hips'. keys: [[lt, {yaw, pitch, dist, fov, dx, dy}], ...]
 */
export function charCam(keys) {
  const tr = track(keys.map((k) => [k[0], [k[1].yaw ?? 0, k[1].pitch ?? 0, k[1].dist ?? 1, k[1].fov ?? 30, k[1].dx ?? 0, k[1].dy ?? 0, k[1].ty ?? 0], k[2]]));
  return (cam, lt, ch, part = 'eyes') => {
    const [yaw, pitch, dist, fov, dx, dy, ty] = tr(lt);
    const c = part === 'eyes' ? ch.eyesWorld() : part === 'chest' ? ch.boneWorld('spine01') : ch.boneWorld('spine04');
    const face = ch.root.rotation.y + yaw;
    const fwd = new THREE.Vector3(Math.sin(face), 0, Math.cos(face));
    const left = new THREE.Vector3(Math.cos(face), 0, -Math.sin(face));
    cam.position.copy(c).addScaledVector(fwd, dist * Math.cos(pitch)).add(new THREE.Vector3(0, dist * Math.sin(pitch) + dy, 0)).addScaledVector(left, dx);
    cam.lookAt(c.x, c.y + ty, c.z);
    cam.fov = fov; cam.updateProjectionMatrix();
    return c.distanceTo(cam.position);
  };
}
