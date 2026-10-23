// Vector rig for the walker: pose parameters → joints (FK for spine/arms,
// two-bone IK for legs). Walking is procedural (gait.ts); prayer and finale
// are pose-to-pose keyframes blended with a monotone spline, so limbs keep
// their lengths and contact points stay on the planks.

import {FINALE, PRAYERS, PRAYER_KEYS, RIG} from '../config/timeline';
import {
  Key,
  V,
  add,
  bumpPulse,
  clamp,
  dist,
  downDir,
  lerp,
  mul,
  sampleTrack,
  smax,
  smoothstep,
  sub,
  upDir,
  vlerp,
} from '../lib/math';
import {deckSlope, deckY} from './bridge';
import {Foot, PLANS, STRIKES, WalkPlan, footState, planAt, sAt, speedAt} from './gait';
import {loadAt, releaseTimes} from './load';

const H = RIG.H;
export const LEN = {
  thigh: RIG.thigh * H,
  shin: RIG.shin * H,
  foot: RIG.foot * H,
  ankleH: RIG.ankleH * H,
  spine: RIG.spine * H,
  neck: RIG.neck * H,
  headR: RIG.headR * H,
  upper: RIG.upperArm * H,
  fore: RIG.foreArm * H,
  line: RIG.line * H,
};
const TOE_CLEAR = LEN.line * 0.5;
const PHI0 = Math.asin((LEN.ankleH - TOE_CLEAR) / LEN.foot);
const LEG = LEN.thigh + LEN.shin;

/** Blendable pose description. y values are relative to the deck under that x. */
export type Params = {
  px: number;
  py: number;
  spine: number;
  hunch: number;
  neck: number;
  gaze: number;
  shDrop: number;
  tnx: number;
  tny: number;
  phiN: number;
  tfx: number;
  tfy: number;
  phiF: number;
  aN: number;
  eN: number;
  aF: number;
  eF: number;
};
const ORDER: (keyof Params)[] = ['px', 'py', 'spine', 'hunch', 'neck', 'gaze', 'shDrop', 'tnx', 'tny', 'phiN', 'tfx', 'tfy', 'phiF', 'aN', 'eN', 'aF', 'eF'];
const toArr = (p: Params) => ORDER.map((k) => p[k]);
const fromArr = (a: number[]): Params => Object.fromEntries(ORDER.map((k, i) => [k, a[i]])) as Params;

export type Leg = {hip: V; knee: V; ankle: V; toe: V};
export type Arm = {sh: V; elbow: V; hand: V};
export type Joints = {
  P: V;
  C: V;
  ctrl: V;
  neckTop: V;
  head: V;
  sh: V;
  chestA: number;
  spineA: number;
  back: V;
  legN: Leg;
  legF: Leg;
  armN: Arm;
  armF: Arm;
};

// ---------------------------------------------------------------- solvers

/** Two-bone IK. sign +1 bends towards +x for a downward chain (knees), -1 the other way. */
export const ik2 = (A: V, T: V, l1: number, l2: number, sign: number) => {
  const d0 = dist(A, T) || 1e-6;
  const dir = mul(sub(T, A), 1 / d0);
  const d = clamp(d0, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4);
  const c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const s = Math.sqrt(1 - c * c);
  const perp = sign > 0 ? {x: dir.y, y: -dir.x} : {x: -dir.y, y: dir.x};
  const mid = add(add(A, mul(dir, l1 * c)), mul(perp, l1 * s));
  const end = add(mid, mul(sub(T, mid), l2 / (dist(T, mid) || 1e-6)));
  return {mid, end};
};

const backDir = (a: number): V => ({x: -Math.cos(a), y: -Math.sin(a)});
const fwdDir = (a: number): V => ({x: Math.cos(a), y: Math.sin(a)});

type Torso = Pick<Joints, 'P' | 'C' | 'ctrl' | 'neckTop' | 'head' | 'sh' | 'chestA' | 'spineA' | 'back'>;

const torso = (P: V, spine: number, hunch: number, neck: number, gaze: number, shDrop: number): Torso => {
  const chestA = spine + hunch * 0.2;
  const C = add(P, mul(upDir(chestA), LEN.spine));
  const ctrl = add(add(P, mul(upDir(spine), LEN.spine * 0.55)), mul(backDir(spine), hunch * 0.05 * H));
  const na = chestA + neck;
  const neckTop = add(C, mul(upDir(na), LEN.neck));
  const head = add(neckTop, mul(upDir(na + gaze), LEN.headR * 0.92));
  const sh = add(add(C, mul(upDir(chestA), -0.045 * H)), mul(fwdDir(chestA), 0.006 * H));
  sh.y += shDrop * H;
  return {P, C, ctrl, neckTop, head, sh, chestA, spineA: spine, back: backDir(chestA)};
};

/** Arm angles (upper absolute from straight down, elbow relative) reaching a target. */
const armTo = (sh: V, target: V, sign: number) => {
  const {mid, end} = ik2(sh, target, LEN.upper, LEN.fore, sign);
  const a = Math.atan2(mid.x - sh.x, mid.y - sh.y);
  const b = Math.atan2(end.x - mid.x, end.y - mid.y);
  let e = b - a;
  while (e > Math.PI) e -= 2 * Math.PI;
  while (e < -Math.PI) e += 2 * Math.PI;
  return {a, e};
};

const armFK = (sh: V, a: number, e: number): Arm => {
  const elbow = add(sh, mul(downDir(a), LEN.upper));
  const hand = add(elbow, mul(downDir(a + e), LEN.fore));
  return {sh, elbow, hand};
};

const world = (x: number, rel: number, t: number): V => ({x, y: deckY(x, t) + rel});

// ---------------------------------------------------------------- posture by load

const posture = (load: number) => ({
  spine: lerp(0.035, 0.34, load),
  hunch: lerp(0.1, 0.95, load),
  neck: lerp(0.05, 0.3, load),
  gaze: lerp(0.0, 0.22, load),
  shDrop: lerp(0, 0.024, load),
  hip: LEN.ankleH + LEG * lerp(0.975, 0.93, load),
});

const gripTarget = (T: Torso, far: boolean): V =>
  add(add(T.sh, mul(fwdDir(T.chestA), (far ? 0.03 : 0.04) * H)), mul(upDir(T.chestA), -(far ? 0.09 : 0.075) * H));

// ---------------------------------------------------------------- walking

type FootPose = {toe: V; phiRel: number; ankle: V};

const plantedFoot = (x: number, t: number): FootPose => {
  const slope = deckSlope(x, t);
  const ankle = {x, y: deckY(x, t) - LEN.ankleH};
  const toeX = x + LEN.foot * Math.cos(PHI0 + slope);
  return {toe: world(toeX, -TOE_CLEAR, t), phiRel: PHI0, ankle};
};

const TOE_OFF = 0.24; // fraction of the swing spent rolling over the toe
const walkFoot = (p: WalkPlan, f: Foot, s: number, t: number): FootPose => {
  const st = footState(p, f, s);
  if (!st.step || st.u <= 0) return plantedFoot(st.x, t);
  const u = st.u;
  const from = plantedFoot(st.step.from, t);
  if (u < TOE_OFF) {
    // heel rises, the toe stays put on its plank
    const k = u / TOE_OFF;
    const phi = PHI0 + 0.72 * k * k * (3 - 2 * k);
    const slope = deckSlope(from.toe.x, t);
    const ankle = sub(from.toe, {x: LEN.foot * Math.cos(phi + slope), y: LEN.foot * Math.sin(phi + slope)});
    return {toe: from.toe, phiRel: phi, ankle};
  }
  const w = (u - TOE_OFF) / (1 - TOE_OFF);
  const e = w * w * (3 - 2 * w);
  const phiStart = PHI0 + 0.72;
  const startAnkle = sub(from.toe, {x: LEN.foot * Math.cos(phiStart + deckSlope(from.toe.x, t)), y: LEN.foot * Math.sin(phiStart + deckSlope(from.toe.x, t))});
  const x = lerp(startAnkle.x, st.step.to, e);
  const liftAmp = H * lerp(0.062, 0.03, p.load) * (st.step.closing ? 0.65 : 1);
  const lift = liftAmp * Math.pow(Math.sin(Math.PI * w), 0.9);
  const baseY = lerp(startAnkle.y - deckY(startAnkle.x, t), -LEN.ankleH, smoothstep(0, 0.55, w));
  // toes point down after push-off, lift before the heel lands, flatten on contact
  const phi = PHI0 + 0.72 * (1 - smoothstep(0, 0.45, w)) - 0.3 * Math.sin(Math.PI * smoothstep(0.3, 1, w));
  const slope = deckSlope(x, t);
  const ankle = {x, y: deckY(x, t) + baseY - lift};
  let toe = add(ankle, {x: LEN.foot * Math.cos(phi + slope), y: LEN.foot * Math.sin(phi + slope)});
  const under = toe.y - (deckY(toe.x, t) - TOE_CLEAR);
  if (under > 0) {
    ankle.y -= under;
    toe = {x: toe.x, y: toe.y - under};
  }
  return {toe, phiRel: phi, ankle};
};

const pelvisY = (px: number, desired: number, feet: FootPose[]) => {
  const R = LEG * 0.992;
  let y = desired;
  for (const f of feet) {
    const dx = Math.min(Math.abs(f.ankle.x - px), R * 0.98);
    y = smax(y, f.ankle.y - Math.sqrt(R * R - dx * dx), 1.6);
  }
  return y;
};

const gaitParams = (px: number, load: number, fN: FootPose, fF: FootPose, t: number, phase: number, L: number): Params => {
  const pst = posture(load);
  const desired = deckY(px, t) - pst.hip;
  const pyW = pelvisY(px, desired, [fN, fF]);
  const spine = pst.spine + 0.012 * Math.sin(2 * Math.PI * phase);
  const P = {x: px, y: pyW};
  const T = torso(P, spine, pst.hunch, pst.neck, pst.gaze, pst.shDrop);
  // arm swing opposite to the same-side leg
  const A = lerp(0.46, 0.1, load);
  const fwdN = clamp((fN.ankle.x - px) / (0.6 * L), -1.2, 1.2);
  const fwdF = clamp((fF.ankle.x - px) / (0.6 * L), -1.2, 1.2);
  // heavy: arms hang limp in front of the leaning torso
  const a0 = 0.06 + 0.3 * load;
  const swing = (fw: number) => {
    const a = a0 - A * fw;
    return {a, e: 0.14 + 0.5 * Math.max(0, a - a0) + 0.12 * load};
  };
  let armN = swing(fwdN);
  let armF = swing(fwdF);
  // one hand clutches the strap only under the heaviest load
  const gN = 0.0 * load;
  const gF = 0.0 * load;
  if (gN > 0) {
    const g = armTo(T.sh, gripTarget(T, false), -1);
    armN = {a: lerp(armN.a, g.a, gN), e: lerp(armN.e, g.e, gN)};
  }
  if (gF > 0) {
    const g = armTo(T.sh, gripTarget(T, true), -1);
    armF = {a: lerp(armF.a, g.a, gF), e: lerp(armF.e, g.e, gF)};
  }
  return {
    px,
    py: pyW - deckY(px, t),
    spine,
    hunch: pst.hunch,
    neck: pst.neck,
    gaze: pst.gaze,
    shDrop: pst.shDrop,
    tnx: fN.toe.x,
    tny: fN.toe.y - deckY(fN.toe.x, t),
    phiN: fN.phiRel,
    tfx: fF.toe.x,
    tfy: fF.toe.y - deckY(fF.toe.x, t),
    phiF: fF.phiRel,
    aN: armN.a,
    eN: armN.e,
    aF: armF.a,
    eF: armF.e,
  };
};

const walkParams = (p: WalkPlan, t: number): Params => {
  const s = sAt(p, t);
  const px = p.x0 + s;
  return gaitParams(px, p.load, walkFoot(p, 'N', s, t), walkFoot(p, 'F', s, t), t, s / p.L, p.L);
};

/** Feet together at xb, at rest. Identical to the last frame of a walk. */
export const standParams = (xb: number, load: number, t: number): Params =>
  gaitParams(xb, load, plantedFoot(xb, t), plantedFoot(xb, t), t, 0, 1);

// ---------------------------------------------------------------- prayer keys

const solveSajdaSpine = (P: V, hunch: number, neck: number, gaze: number, t: number) => {
  let lo = 1.2;
  let hi = 2.4;
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    const T = torso(P, m, hunch, neck, gaze, 0);
    if (T.head.y + LEN.headR < deckY(T.head.x, t) - 0.008 * H) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
};

const prayerKeys = (xb: number, load: number, t: number, t0: number, dur: number): Key[] => {
  const stand = standParams(xb, load, t);
  const toeX = stand.tnx;
  const pst = posture(load);
  const phiK = 1.36;
  const toeW = world(toeX, -TOE_CLEAR, t);
  const sl = deckSlope(toeX, t);
  const ankleW = sub(toeW, {x: LEN.foot * Math.cos(phiK + sl), y: LEN.foot * Math.sin(phiK + sl)});
  const kneeRel = -LEN.line * 0.5;
  let kneeX = ankleW.x + LEN.shin * 0.9;
  for (let k = 0; k < 6; k++) {
    const ky = deckY(kneeX, t) + kneeRel;
    kneeX = ankleW.x + Math.sqrt(Math.max(1, LEN.shin * LEN.shin - (ky - ankleW.y) ** 2));
  }
  const kneeW = world(kneeX, kneeRel, t);
  const hipAt = (hx: number) => {
    const y = kneeW.y - Math.sqrt(LEN.thigh ** 2 - (kneeW.x - hx) ** 2);
    return {x: hx, rel: y - deckY(hx, t)};
  };
  const hipK = hipAt(ankleW.x + 0.02 * H);
  const hipS = hipAt(kneeW.x - 0.07 * H);
  const hipKX = hipK.x;
  const hipKRel = hipK.rel;
  const hipSX = hipS.x;
  const hipSRel = hipS.rel;
  const kneeX0 = kneeW.x;

  const legs = (phi: number) => ({tnx: toeX, tny: -TOE_CLEAR, phiN: phi, tfx: toeX, tfy: -TOE_CLEAR, phiF: phi});

  // squat (lowering, heels lifting, leaning for balance)
  const squat = (lean: number): Params => {
    const px = xb - 0.012 * H;
    const py = -0.305 * H;
    const T = torso(world(px, py, t), lean, lerp(0.35, 0.9, load), 0.22 + 0.2 * load, 0.05, pst.shDrop);
    const reach = armTo(T.sh, add(T.sh, {x: 0.16 * H, y: 0.24 * H}), -1);
    return {px, py, spine: lean, hunch: lerp(0.35, 0.9, load), neck: 0.22 + 0.2 * load, gaze: 0.05, shDrop: pst.shDrop, ...legs(0.62), aN: reach.a, eN: reach.e, aF: reach.a - 0.06, eF: reach.e};
  };

  const kneel = (): Params => {
    const spine = lerp(0.03, 0.2, load);
    const hunch = lerp(0.12, 0.8, load);
    const neck = 0.1 + 0.32 * load;
    const P = world(hipKX, hipKRel, t);
    const T = torso(P, spine, hunch, neck, 0.04, pst.shDrop * 0.6);
    const knee = world(kneeX0, kneeRel, t);
    const hand = add(vlerp(P, knee, 0.74), {x: 0, y: -0.034 * H});
    const arm = armTo(T.sh, hand, -1);
    const armF = armTo(T.sh, add(hand, {x: -0.02 * H, y: 0}), -1);
    return {px: hipKX, py: hipKRel, spine, hunch, neck, gaze: 0.04, shDrop: pst.shDrop * 0.6, ...legs(phiK), aN: arm.a, eN: arm.e, aF: armF.a, eF: armF.e};
  };

  const sajda = (settle: number): Params => {
    const hunch = 0.5;
    const neck = 0.34;
    const gaze = 0.18;
    const P = world(hipSX, hipSRel, t);
    const spine = solveSajdaSpine(P, hunch, neck, gaze, t) + settle;
    const T = torso(P, spine, hunch, neck, gaze, 0);
    const hand = world(T.head.x - 0.02 * H, -LEN.line * 0.5, t);
    const arm = armTo(T.sh, hand, +1);
    const armF = armTo(T.sh, add(hand, {x: -0.015 * H, y: 0}), +1);
    return {px: hipSX, py: hipSRel, spine, hunch, neck, gaze, shDrop: 0, ...legs(phiK), aN: arm.a, eN: arm.e, aF: armF.a, eF: armF.e};
  };

  const end = standParams(xb, load, t);
  const K = PRAYER_KEYS;
  const at = (f: number) => t0 + dur * f;
  const keys: Key[] = [
    {t: at(0), v: toArr(stand), hold: true},
    {t: at(K.squat), v: toArr(squat(0.42))},
    {t: at(K.kneel), v: toArr(kneel())},
    {t: at(K.sajda), v: toArr(sajda(0)), hold: true},
    {t: at(K.sajdaHold), v: toArr(sajda(0.02)), hold: true},
    {t: at(K.kneel2), v: toArr(kneel())},
    {t: at(K.squat2), v: toArr(squat(0.5))},
    {t: at(1), v: toArr(end), hold: true},
  ];
  return unwrapKeys(keys);
};

const ANGLE_IDX = [ORDER.indexOf('aN'), ORDER.indexOf('eN'), ORDER.indexOf('aF'), ORDER.indexOf('eF')];
const unwrapKeys = (keys: Key[]) => {
  for (let i = 1; i < keys.length; i++) {
    for (const c of ANGLE_IDX) {
      while (keys[i].v[c] - keys[i - 1].v[c] > Math.PI) keys[i].v[c] -= 2 * Math.PI;
      while (keys[i].v[c] - keys[i - 1].v[c] < -Math.PI) keys[i].v[c] += 2 * Math.PI;
    }
  }
  return keys;
};

export const prayerBase = (i: number) => PLANS[i].x0 + PLANS[i].D;
export const FINAL_X = PLANS[PLANS.length - 1].x0 + PLANS[PLANS.length - 1].D;

// ---------------------------------------------------------------- finale keys

const F = FINALE;
export const finaleTimes = {
  reach: F.t0 + F.reach,
  slip: F.t0 + F.slip,
  lower: F.t0 + F.lower,
  release: F.t0 + F.release,
  rise: F.t0 + F.rise,
  look0: F.t0 + F.lookUp[0],
  look1: F.t0 + F.lookUp[1],
};

const finaleKeys = (t: number): Key[] => {
  const xf = FINAL_X;
  const stand = standParams(xf, 0, t);
  const base = (over: Partial<Params>): Params => ({...stand, ...over});
  const T0 = torso(world(stand.px, stand.py, t), stand.spine, stand.hunch, stand.neck, stand.gaze, stand.shDrop);
  // reach to near strap at the front of the shoulder
  const reachArm = armTo(T0.sh, add(T0.sh, {x: 0.055 * H, y: 0.03 * H}), -1);
  const reach = base({spine: 0.06, shDrop: -0.008, aN: reachArm.a, eN: reachArm.e});
  // slip: pack swung off, held low behind the hip
  const T1 = torso(world(stand.px, stand.py, t), 0.0, 0.08, 0.06, 0, 0);
  const slipArm = armTo(T1.sh, add(world(stand.px, stand.py, t), {x: -0.07 * H, y: 0.07 * H}), -1);
  const slip = base({spine: 0.0, hunch: 0.08, neck: 0.06, shDrop: 0, aN: slipArm.a, eN: slipArm.e});
  // lower: knees bend, lean, the pack touches the ground ahead of the feet
  const pyL = stand.py + 0.085 * H;
  const T2 = torso(world(stand.px, pyL, t), 0.52, 0.3, 0.2, 0.06, 0.004);
  const lowArm = armTo(T2.sh, world(stand.px + 0.235 * H, -0.27 * H, t), -1);
  const lowArmF = armTo(T2.sh, add(T2.sh, {x: 0.07 * H, y: 0.26 * H}), -1);
  const lower = base({py: pyL, spine: 0.52, hunch: 0.3, neck: 0.2, gaze: 0.06, shDrop: 0.004, aN: lowArm.a, eN: lowArm.e, aF: lowArmF.a, eF: lowArmF.e});
  const release = base({...lower, py: pyL - 0.008 * H, spine: 0.47, aN: lowArm.a - 0.06, eN: lowArm.e + 0.08});
  const tall = base({spine: -0.025, hunch: 0, neck: -0.02, gaze: 0, shDrop: -0.012, aN: 0.03, eN: 0.1, aF: 0.0, eF: 0.12, py: stand.py - 0.006 * H});
  const look = base({...tall, neck: -0.2, gaze: -0.14, spine: -0.045});
  return unwrapKeys([
    {t: F.t0, v: toArr(stand), hold: true},
    {t: finaleTimes.reach, v: toArr(reach)},
    {t: finaleTimes.slip, v: toArr(slip)},
    {t: finaleTimes.lower, v: toArr(lower), hold: true},
    {t: finaleTimes.release, v: toArr(release)},
    {t: finaleTimes.rise, v: toArr(tall), hold: true},
    {t: finaleTimes.look0, v: toArr(tall), hold: true},
    {t: finaleTimes.look1, v: toArr(look), hold: true},
  ]);
};

// ---------------------------------------------------------------- global layers

const dipOffset = (t: number) => {
  let d = 0;
  for (const s of STRIKES) {
    if (t < s.t || t > s.t + 1.2) continue;
    d += (s.closing ? 0.5 : 1) * s.load * 0.014 * H * bumpPulse(t, s.t, 0.035, 0.15);
  }
  return d;
};

export const reliefAt = (t: number) => {
  let r = 0;
  for (const rt of releaseTimes) r += bumpPulse(t, rt + 0.08, 0.1, 0.55);
  return r;
};

const breathAt = (t: number) => {
  const amp = lerp(0.004, 0.009, smoothstep(F.t0 + 1.5, F.t0 + 2.5, t));
  return amp * Math.sin(2 * Math.PI * 0.27 * t);
};

// ---------------------------------------------------------------- evaluation

export type Activity = {kind: 'walk' | 'pray' | 'finale'; index: number; u: number};

export const activityAt = (t: number): Activity => {
  for (let i = 0; i < PRAYERS.length; i++) {
    const p = PRAYERS[i];
    if (t >= p.t0 && t < p.t0 + p.dur) return {kind: 'pray', index: i, u: (t - p.t0) / p.dur};
  }
  if (t >= F.t0) return {kind: 'finale', index: 0, u: 0};
  const w = planAt(t);
  return {kind: 'walk', index: w ? w.i : 0, u: 0};
};

export const paramsAt = (t: number): Params => {
  const act = activityAt(t);
  let p: Params;
  if (act.kind === 'pray') {
    const pr = PRAYERS[act.index];
    p = fromArr(sampleTrack(prayerKeys(prayerBase(act.index), loadAt(t), t, pr.t0, pr.dur), t));
  } else if (act.kind === 'finale') {
    p = fromArr(sampleTrack(finaleKeys(t), t));
  } else {
    const w = planAt(t) ?? PLANS[0];
    p = walkParams(w, t);
  }
  const relief = reliefAt(t);
  p.spine -= 0.03 * relief;
  p.hunch = Math.max(0, p.hunch - 0.12 * relief);
  p.neck -= 0.06 * relief;
  p.spine += breathAt(t);
  return p;
};

export const buildJoints = (p: Params, t: number, dip = 0, depth = 0): Joints => {
  const P = world(p.px, p.py + dip, t);
  const T = torso(P, p.spine, p.hunch, p.neck, p.gaze, p.shDrop);
  const leg = (tx: number, ty: number, phi: number): Leg => {
    const toe = world(tx, ty, t);
    const slope = deckSlope(tx, t);
    const ankleT = sub(toe, {x: LEN.foot * Math.cos(phi + slope), y: LEN.foot * Math.sin(phi + slope)});
    const {mid, end} = ik2(P, ankleT, LEN.thigh, LEN.shin, +1);
    // keep the toe attached to the (possibly clamped) ankle
    const toeA = add(end, sub(toe, ankleT));
    return {hip: P, knee: mid, ankle: end, toe: toeA};
  };
  const legN = leg(p.tnx, p.tny, p.phiN);
  const legF = leg(p.tfx, p.tfy, p.phiF);
  // knees never sink into the planks: lift the pelvis by the overlap
  const kneeUnder = (l: Leg) => l.knee.y + LEN.line * 0.5 - deckY(l.knee.x, t);
  const over = Math.max(kneeUnder(legN), kneeUnder(legF));
  if (over > 0 && depth < 12) return buildJoints({...p, py: p.py - over * 1.6 - 0.05}, t, dip, depth + 1);
  const arm = (sh: V, a: number, e: number): Arm => {
    const fk = armFK(sh, a, e);
    const floor = deckY(fk.hand.x, t) - LEN.line * 0.5;
    if (fk.hand.y <= floor) return fk;
    const {mid, end} = ik2(sh, {x: fk.hand.x, y: floor}, LEN.upper, LEN.fore, e >= 0 ? -1 : +1);
    return {sh, elbow: mid, hand: end};
  };
  return {
    ...T,
    legN,
    legF,
    armN: arm(T.sh, p.aN, p.eN),
    armF: arm(add(T.sh, mul(T.back, 0.008 * H)), p.aF, p.eF),
  };
};

export const jointsAt = (t: number) => buildJoints(paramsAt(t), t, dipOffset(t));

export const speedAtT = (t: number) => {
  const w = planAt(t);
  return w ? speedAt(w, t) : 0;
};
