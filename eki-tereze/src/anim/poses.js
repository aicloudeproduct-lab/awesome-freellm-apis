// Pose builders for MHuman. Positions are given in the character's local
// frame (x = character's left, y up, z forward) and converted to world.
import * as THREE from 'three';
import {clamp, lerp, mixV, smooth} from '../lib/util.js';

export const toWorld = (p, lx, ly, lz) => {
  const c = Math.cos(p.ry || 0), s = Math.sin(p.ry || 0);
  return new THREE.Vector3((p.x || 0) + lx * c + lz * s, (p.y || 0) + ly, (p.z || 0) - lx * s + lz * c);
};

/** Sitting on a seat of height h; lean forward (rad); feet forward distance. */
export function seated(ch, base, o = {}) {
  const r = ch.rest;
  const seatTop = o.seat ?? 0.46;
  const hipY = seatTop + 0.085 * (ch.height / 1.75);
  const p = {...base, hip: [0, hipY - r.root.y, -(o.back ?? 0.02)], pelvis: [-(o.pelvisTilt ?? 0.1), 0, 0]};
  p.spine = [o.lean ?? 0.15, o.twist ?? 0, o.side ?? 0];
  p.neck = o.neck || [0.1, 0, 0];
  p.head = o.head || [0.05, 0, 0];
  const fx = o.feet ?? 0.5 * (ch.height / 1.75), fw = o.feetW ?? 0.12;
  const ay = r['foot.L'].y;
  p.legL = {ik: toWorld(base, fw, ay, fx + (o.footOffL ?? 0)), pitch: 0};
  p.legR = {ik: toWorld(base, -fw, ay, fx + (o.footOffR ?? 0)), pitch: 0};
  return p;
}

export function standing(ch, base, o = {}) {
  const r = ch.rest;
  const p = {...base, hip: [o.hipX ?? 0, -(o.sink ?? 0.0), o.hipZ ?? 0], pelvis: o.pelvis || [0, 0, 0]};
  p.spine = o.spine || [0.02, 0, 0];
  p.neck = o.neck || [0.02, 0, 0];
  p.head = o.head || [0, 0, 0];
  const w = o.stance ?? 0.11;
  const ay = r['foot.L'].y;
  p.legL = {ik: toWorld(base, w + (o.lx || 0), ay, (o.lz || 0)), pitch: 0, pole: o.poleL};
  p.legR = {ik: toWorld(base, -w + (o.rx || 0), ay, (o.rz || 0)), pitch: 0, pole: o.poleR};
  return p;
}

/** Kneeling on one knee (left knee down) — used when Arman joins his son. */
export function kneeling(ch, base, o = {}) {
  const r = ch.rest, k = ch.height / 1.75;
  const p = {...base, hip: [0, -(0.45 * k), -0.05], pelvis: [-0.05, 0, 0]};
  p.spine = o.spine || [0.12, 0, 0]; p.neck = o.neck || [0.1, 0, 0]; p.head = o.head || [0.05, 0, 0];
  const ay = r['foot.L'].y;
  p.legR = {ik: toWorld(base, -0.13, ay, 0.38 * k), pitch: 0};
  p.legL = {ik: toWorld(base, 0.13, 0.06, -0.3 * k), pitch: 1.1, toe: -0.9, pole: toWorld(base, 0.15, 0.3, 0.8)};
  return p;
}

/** Squatting child (yard). */
export function squat(ch, base, o = {}) {
  const r = ch.rest, k = ch.height / 1.75;
  const p = {...base, hip: [0, -(r.root.y * 0.58), -0.06 * k], pelvis: [0.25, 0, 0]};
  p.spine = o.spine || [0.45, 0, 0]; p.neck = o.neck || [0.2, 0, 0]; p.head = o.head || [0.15, 0, 0];
  const ay = r['foot.L'].y;
  p.legL = {ik: toWorld(base, 0.15 * k, ay, 0.12 * k), pitch: 0, pole: toWorld(base, 0.4, 0.5, 1.2)};
  p.legR = {ik: toWorld(base, -0.15 * k, ay, 0.12 * k), pitch: 0, pole: toWorld(base, -0.4, 0.5, 1.2)};
  return p;
}

/**
 * Walk cycle along local +z: phase 0..1 per stride pair; speed in m/stride.
 * Returns pose with planted feet (no sliding when `dist` advances with root).
 */
export function walking(ch, base, dist, o = {}) {
  const r = ch.rest, k = ch.height / 1.75;
  const stride = (o.stride ?? 0.62) * k;
  const ph = dist / (stride * 2);
  const ay = r['foot.L'].y;
  const foot = (off) => {
    const q = ph + off, cyc = q - Math.floor(q);
    // stance 0..0.6 (foot fixed on ground), swing 0.6..1
    const n = Math.floor(q);
    let z, lift = 0;
    if (cyc < 0.6) z = (n * 2 + off * 2) * stride + stride * 1.0 - dist; // planted at fixed world-z
    else { const u = (cyc - 0.6) / 0.4, e = u * u * (3 - 2 * u); const z0 = (n * 2 + off * 2) * stride + stride - dist, z1 = z0 + 2 * stride; z = lerp(z0, z1, e); lift = Math.sin(Math.PI * u) * 0.09 * k; }
    return {z, lift, swing: cyc >= 0.6 ? (cyc - 0.6) / 0.4 : 0};
  };
  const L = foot(0), R = foot(0.5);
  const bob = Math.cos(ph * Math.PI * 4) * 0.018 * k;
  const p = {...base, hip: [Math.sin(ph * Math.PI * 2) * 0.02, -0.03 * k + bob, 0], pelvis: [0, Math.sin(ph * Math.PI * 2) * 0.08, Math.sin(ph * Math.PI * 2) * 0.03]};
  p.spine = [0.04, -Math.sin(ph * Math.PI * 2) * 0.1, 0]; p.neck = [0.02, 0, 0]; p.head = o.head || [0, Math.sin(ph * Math.PI * 2) * 0.04, 0];
  p.legL = {ik: toWorld(base, 0.11, ay + L.lift, L.z), pitch: -L.swing * 0.3};
  p.legR = {ik: toWorld(base, -0.11, ay + R.lift, R.z), pitch: -R.swing * 0.3};
  const sw = Math.sin(ph * Math.PI * 2);
  p.armSwing = sw;
  return p;
}

/** Relaxed arm hand target in local space beside the thigh, swinging with walk. */
export function hangHand(ch, base, side, swing = 0, out = 0) {
  const sx = side === 'L' ? 1 : -1, k = ch.height / 1.75;
  return toWorld(base, sx * (0.2 + out) * k, 0.82 * k, (0.03 + swing * 0.12 * sx) * k);
}

/** Blend two pose objects (numbers / arrays / Vector3s recursively). */
export function blend(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b;
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k], y = b[k];
    if (x === undefined) { out[k] = y; continue; }
    if (y === undefined) { out[k] = x; continue; }
    if (typeof x === 'number') out[k] = lerp(x, y, t);
    else if (x?.isVector3) out[k] = x.clone().lerp(y, t);
    else if (Array.isArray(x)) out[k] = x.map((v, i) => lerp(v, y[i] ?? v, t));
    else if (typeof x === 'object' && x) out[k] = blend(x, y, t);
    else out[k] = t < 0.5 ? x : y;
  }
  return out;
}
