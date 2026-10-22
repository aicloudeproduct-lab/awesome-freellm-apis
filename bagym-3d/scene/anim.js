// Анимация құралдары: easing, позаларды араластыру, табан сырғымайтын жүріс, затты қолмен ұстау.
import * as THREE from 'three';
import {BODY, legIK} from './character.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const range = (t, a, b) => clamp((t - a) / (b - a));
export const ss = t => t * t * (3 - 2 * t);
export const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const esine = t => -(Math.cos(Math.PI * t) - 1) / 2;
export const eo = t => 1 - Math.pow(1 - t, 3);
export function kf(t, keys, ease = esine) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) { const [t0, v0] = keys[i], [t1, v1] = keys[i + 1]; if (t <= t1) return lerp(v0, v1, ease(range(t, t0, t1))); }
  return keys[keys.length - 1][1];
}
export const kfV = (t, keys, ease) => new THREE.Vector3(kf(t, keys.map(([k, p]) => [k, p[0]]), ease), kf(t, keys.map(([k, p]) => [k, p[1]]), ease), kf(t, keys.map(([k, p]) => [k, p[2]]), ease));

/** Позаларды сызықты араластыру (барлық сандық өрістер, массивтер, ішкі объектілер). */
export function mixPose(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b;
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k], y = b[k];
    if (x === undefined) out[k] = y; else if (y === undefined) out[k] = x;
    else if (typeof x === 'number') out[k] = lerp(x, y, t);
    else if (Array.isArray(x)) out[k] = x.map((v, i) => lerp(v, y[i] ?? v, t));
    else out[k] = mixPose(x, y, t);
  }
  return out;
}
/** Кілттік позалар тізбегі: [[t, pose], ...]. */
export function posesAt(t, keys, ease = esine) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) { const [t0, p0] = keys[i], [t1, p1] = keys[i + 1]; if (t <= t1) return mixPose(p0, p1, ease(range(t, t0, t1))); }
  return keys[keys.length - 1][1];
}

const A = (l, r = 0) => ({sh: l, el: r});
export const POSE = {
  stand: {hipY: 0.93, spine: [0.03, 0, 0], chest: [0.02, 0, 0], neck: [0, 0, 0], head: [0, 0, 0], armL: {sh: [0.04, 0, 0.07], el: -0.18, grip: 0.35}, armR: {sh: [0.04, 0, -0.07], el: -0.18, grip: 0.35}},
  slump: {hipY: 0.91, spine: [0.2, 0, 0], chest: [0.16, 0, 0], neck: [0.12, 0, 0], head: [0.22, 0, 0], armL: {sh: [0.08, 0, 0.04], el: -0.08, grip: 0.9}, armR: {sh: [0.08, 0, -0.04], el: -0.08, grip: 0.9}, brow: 1},
  upright: {hipY: 0.94, spine: [-0.02, 0, 0], chest: [-0.03, 0, 0], neck: [-0.02, 0, 0], head: [-0.05, 0, 0], armL: {sh: [0.02, 0, 0.08], el: -0.2, grip: 0.2}, armR: {sh: [0.02, 0, -0.08], el: -0.2, grip: 0.2}},
};
export {A as armPose};

/** Табаны еденге бекітілген жүріс: жамбас траекториясы pz(t) (әлемдік z), бағыт heading. Табандар қадам симуляциясымен. */
export function walkFeet(pz, t, t0, {stride = 0.62, swing = 0.42, spread = 0.1, lift = 0.07} = {}) {
  const dt = 1 / 120;
  let z = pz(t0), prev = z;
  const feet = [z, z];                     // әлемдік z (екі табан)
  let sw = null;
  for (let tt = t0; tt <= t + 1e-9; tt += dt) {
    z = pz(tt); const vel = (z - prev) / dt; prev = z;
    if (sw && tt - sw.t0 >= swing) { feet[sw.i] = sw.to; sw = null; }
    if (!sw) {
      const want = z + vel * swing * 0.55;
      const e0 = want - feet[0], e1 = want - feet[1];
      if (Math.max(Math.abs(e0), Math.abs(e1)) > stride * 0.32) {
        const i = Math.abs(e0) > Math.abs(e1) ? 0 : 1;
        sw = {i, from: feet[i], to: want + vel * swing * 0.45, t0: tt};
      }
    }
  }
  const out = feet.map(f => ({z: f, y: 0}));
  let phase = 0;
  if (sw) { const p = clamp((t - sw.t0) / swing), e = ss(p); out[sw.i] = {z: lerp(sw.from, sw.to, e), y: Math.sin(Math.PI * p) * lift}; phase = (sw.i ? -1 : 1) * Math.sin(Math.PI * p); }
  return {feet: out, spread, phase};
}

/** Кейіпкерді жүргізу: root жамбас астында, табандар әлемде бекітілген → жергілікті IK. heading — бет бұрышы (rad). */
export function applyWalk(ch, x, pz, t, t0, heading, base, opts = {}) {
  const wf = walkFeet(pz, t, t0, opts);
  const rz = pz(t);
  ch.root.position.set(x, opts.y ?? 0.1, rz);
  ch.root.rotation.y = heading;
  const sinH = Math.sin(heading), cosH = Math.cos(heading);
  const toLocalZ = dz => dz * cosH; // жол бойымен жүргенде (heading 0 немесе π)
  const hipY = (base.hipY ?? 0.93) - Math.abs(wf.phase) * 0.012;
  const pose = {...base, hipY};
  ['L', 'R'].forEach((s, i) => {
    const f = wf.feet[i];
    const ik = legIK(new THREE.Vector3(0, hipY, 0), new THREE.Vector3(0, f.y, toLocalZ(f.z - rz)));
    pose['leg' + s] = {hp: [ik.hp, 0, (i ? -1 : 1) * 0.02], kn: ik.kn, an: [-(ik.hp + ik.kn) * 0.85, 0, 0]};
  });
  const sw = (toLocalZ(wf.feet[0].z - rz) - toLocalZ(wf.feet[1].z - rz)) * 1.1;
  if (!base.carry) {
    // қарсы қол-аяқ: сол аяқ алда болса, сол қол артта
    pose.armL = {...(base.armL || {}), sh: [clamp(sw * (opts.armSwing ?? 1), -0.5, 0.5) + ((base.armL || {}).sh?.[0] || 0), 0, 0.07]};
    pose.armR = {...(base.armR || {}), sh: [clamp(-sw * (opts.armSwing ?? 1), -0.5, 0.5) + ((base.armR || {}).sh?.[0] || 0), 0, -0.07]};
  }
  ch.setPose(pose);
  return wf;
}

/** Тұрған кейіпкер: табандар жергілікті (x ±0.1), жамбас биіктігі мен еңкею позадан. */
export function applyStand(ch, pos, heading, pose, {footL = [0.1, 0, 0.03], footR = [-0.1, 0, -0.03]} = {}) {
  ch.root.position.set(pos[0], pos[1] ?? 0.1, pos[2]); ch.root.rotation.y = heading;
  const hipY = pose.hipY ?? 0.93, p = {...pose};
  for (const [s, f] of [['L', footL], ['R', footR]]) {
    const ik = legIK(new THREE.Vector3(0, hipY, 0), new THREE.Vector3(f[0], f[1], f[2]));
    p['leg' + s] = {hp: [ik.hp, 0, s === 'L' ? 0.03 : -0.03], kn: ik.kn, an: [-(ik.hp + ik.kn) * 0.9, 0, 0]};
  }
  ch.setPose(p);
}

export const wristWorld = (ch, s) => { const p = new THREE.Vector3(0, -0.075, 0.012); ch.arm[s].wr.localToWorld(p); return p; };
/** Зат екі қолдың ортасында: позиция мен бағыт кейіпкермен бірге. */
export function holdBetween(obj, ch, off = [0, 0, 0]) {
  ch.root.updateMatrixWorld(true);
  const a = wristWorld(ch, 'L'), b = wristWorld(ch, 'R');
  obj.position.copy(a).add(b).multiplyScalar(0.5).add(new THREE.Vector3(...off));
  obj.quaternion.copy(ch.root.quaternion);
}
export const H = BODY;
