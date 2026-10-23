// Backpack and stones. The pack is hung from the upper back; its swing is a
// damped spring driven by the body's acceleration (simulated once over the
// whole film, deterministic), so it trails the body slightly. In the finale it
// moves to the hand and is set down. Stones fall ballistically.

import {BRIDGE, FINALE, FPS, RIG} from '../config/timeline';
import {V, add, clamp, lerp, mul, smoothstep, sub, upDir} from '../lib/math';
import {deckY} from './bridge';
import {FINAL_X, finaleTimes, jointsAt} from './character';
import {loadAt, releaseTimes} from './load';

const H = RIG.H;

export type PackXf = {o: V; a: number}; // origin, angle of the pack's up axis from vertical
export const toWorld = (xf: PackXf, u: number, vv: number): V => {
  const up = upDir(xf.a);
  const back = {x: -Math.cos(xf.a), y: -Math.sin(xf.a)};
  return add(xf.o, add(mul(back, u), mul(up, vv)));
};

/** Pack outline thickness (outward from the back) by fill 0..1, px. */
export const packThickness = (fill: number) => H * (0.09 + 0.08 * Math.pow(clamp(fill), 0.7));
export const PACK_V = {bottom: -0.175 * H, top: 0.13 * H};
export const STRAP_LOCAL = {u: 0.03 * H, v: 0.135 * H};

/** Stone slots (local, px) in release order; see STONES in text config. */
export const SLOTS = [
  {u: 0.112, v: 0.168, r: 0.04},
  {u: 0.135, v: 0.128, r: 0.036},
  {u: 0.058, v: 0.176, r: 0.043},
  {u: 0.088, v: 0.136, r: 0.041},
  {u: 0.036, v: 0.138, r: 0.038},
].map((s) => ({u: s.u * H, v: s.v * H, r: s.r * H * 1.22}));

const backXf = (t: number): PackXf => {
  const j = jointsAt(t);
  const a = Math.atan2(j.C.x - j.P.x, -(j.C.y - j.P.y));
  // the body is a line: sit the pack's inner face just behind the stroke
  const base = add(j.P, mul(sub(j.C, j.P), 0.66));
  const back = {x: -Math.cos(a), y: -Math.sin(a)};
  return {o: add(base, mul(back, 0.02 * H)), a};
};

const handXf = (t: number, swing: number): PackXf => {
  const j = jointsAt(t);
  const a = swing;
  const up = upDir(a);
  const back = {x: -Math.cos(a), y: -Math.sin(a)};
  const o = sub(j.armN.hand, add(mul(back, STRAP_LOCAL.u), mul(up, STRAP_LOCAL.v)));
  return {o, a};
};

const GROUND_X = () => handXf(finaleTimes.lower, 0).o.x;
const groundXf = (t: number): PackXf => {
  const settle = smoothstep(finaleTimes.release, finaleTimes.release + 0.5, t);
  const x = GROUND_X();
  return {o: {x, y: 0}, a: lerp(0.0, -0.08, settle)};
};

// ---- spring simulation (memoised for the whole film)
const DT = 1 / 240;
const T_START = -1.25;
const T_END = 20.2;
type SimState = {d: number; w: number; ov: number; vv: number; hs: number; hw: number};
let SIM: SimState[] | null = null;

const sim = () => {
  if (SIM) return SIM;
  const out: SimState[] = [];
  let s: SimState = {d: 0, w: 0, ov: 0, vv: 0, hs: 0, hw: 0};
  const anchor = (t: number) => backXf(t);
  let p0 = anchor(T_START - 2 * DT);
  let p1 = anchor(T_START - DT);
  let h0 = jointsAt(T_START - 2 * DT).armN.hand;
  let h1 = jointsAt(T_START - DT).armN.hand;
  const kA = (2 * Math.PI * 2.1) ** 2;
  const cA = 2 * 0.3 * 2 * Math.PI * 2.1;
  const kV = (2 * Math.PI * 3.2) ** 2;
  const cV = 2 * 0.42 * 2 * Math.PI * 3.2;
  const kH = (2 * Math.PI * 1.25) ** 2; // pendulum in hand
  const cH = 2 * 0.22 * 2 * Math.PI * 1.25;
  const lEff = 0.16 * H;
  const steps = Math.ceil((T_END - T_START) / DT);
  for (let i = 0; i <= steps; i++) {
    const t = T_START + i * DT;
    const p2 = anchor(t);
    const h2 = jointsAt(t).armN.hand;
    const ax = (p2.o.x - 2 * p1.o.x + p0.o.x) / (DT * DT);
    const ay = (p2.o.y - 2 * p1.o.y + p0.o.y) / (DT * DT);
    const alpha = (p2.a - 2 * p1.a + p0.a) / (DT * DT);
    const up = upDir(p2.a);
    const fwd = {x: Math.cos(p2.a), y: Math.sin(p2.a)};
    const aFwd = ax * fwd.x + ay * fwd.y;
    const aUp = ax * up.x + ay * up.y;
    const accD = -kA * s.d - cA * s.w + aFwd / lEff - alpha * 0.9;
    const accV = -kV * s.ov - cV * s.vv - aUp;
    const hax = (h2.x - 2 * h1.x + h0.x) / (DT * DT);
    const accH = -kH * s.hs - cH * s.hw - hax / (0.2 * H);
    s = {
      w: s.w + accD * DT,
      d: s.d + (s.w + accD * DT) * DT,
      vv: s.vv + accV * DT,
      ov: s.ov + (s.vv + accV * DT) * DT,
      hw: s.hw + accH * DT,
      hs: s.hs + (s.hw + accH * DT) * DT,
    };
    out.push(s);
    p0 = p1;
    p1 = p2;
    h0 = h1;
    h1 = h2;
  }
  SIM = out;
  return out;
};

const simAt = (t: number) => {
  const arr = sim();
  const i = clamp(Math.round((t - T_START) / DT), 0, arr.length - 1);
  return arr[i];
};

export type PackState = {xf: PackXf; fill: number; mode: 'back' | 'hand' | 'ground'; gap: number; empty: number};

export const packAt = (t: number): PackState => {
  const s = simAt(t);
  const fill = loadAt(t);
  const b = backXf(t);
  const d = s.d > 0 ? 0.15 * Math.tanh(s.d / 0.15) : 0.025 * Math.tanh(s.d / 0.025);
  const ov = 2.4 * Math.tanh(s.ov / 2.4);
  const onBack: PackXf = {o: add(toWorld({o: b.o, a: b.a}, 0, 0), mul(upDir(b.a), ov)), a: b.a + d};
  // rotate about the strap point (top), so the top stays on the shoulder
  const pivotL = STRAP_LOCAL;
  const pivotW = toWorld({o: b.o, a: b.a}, pivotL.u, pivotL.v);
  const rotated = toWorld({o: {x: 0, y: 0}, a: onBack.a}, pivotL.u, pivotL.v);
  const back: PackXf = {o: add(sub(pivotW, rotated), mul(upDir(b.a), ov)), a: onBack.a};
  const gap = Math.abs(ov);

  const wHand = smoothstep(finaleTimes.reach + 0.05, finaleTimes.slip, t);
  if (wHand <= 0) return {xf: back, fill, mode: 'back', gap, empty: 0};
  const swing = clamp(s.hs, -0.35, 0.35);
  const hx = handXf(t, swing * (1 - smoothstep(finaleTimes.lower - 0.2, finaleTimes.lower, t)));
  const wGround = smoothstep(finaleTimes.lower - 0.06, finaleTimes.lower + 0.04, t);
  const g = groundXf(t);
  // ground transform: bottom on the ground
  const gO = {x: g.o.x, y: deckY(g.o.x, t) - (-PACK_V.bottom)};
  const ground: PackXf = {o: gO, a: g.a};
  const mixXf = (A: PackXf, B: PackXf, w: number): PackXf => ({o: {x: lerp(A.o.x, B.o.x, w), y: lerp(A.o.y, B.o.y, w)}, a: lerp(A.a, B.a, w)});
  const inHand = mixXf(back, hx, easeIO(wHand));
  const xf = mixXf(inHand, ground, wGround);
  return {xf, fill, mode: wGround >= 1 ? 'ground' : 'hand', gap: 0, empty: smoothstep(finaleTimes.release, finaleTimes.release + 0.4, t)};
};
const easeIO = (x: number) => x * x * (3 - 2 * x);

// ---- stones
export type StoneState = {x: number; y: number; rot: number; scale: number; alpha: number; vx: number; vy: number; inFront: boolean};
type Flight = {t0: number; p0: V; v0: V; tb: number; pb: V; vb: V; spin: number};
const G = 1250;
const flights: (Flight | null)[] = [null, null, null, null, null];
const LIFT = 0.1;

export const flightOf = (k: number): Flight => {
  const cached = flights[k];
  if (cached) return cached;
  const r = releaseTimes[k];
  const slot = SLOTS[k];
  const t0 = r + LIFT;
  const xfA = packAt(t0 - 1 / 120).xf;
  const xfB = packAt(t0).xf;
  const local = {u: slot.u, v: slot.v + 0.035 * H};
  const pA = toWorld(xfA, local.u, local.v);
  const p0 = toWorld(xfB, local.u, local.v);
  const vPack = mul(sub(p0, pA), 120);
  const v0 = add(mul(vPack, 0.5), {x: -35, y: -95});
  // first contact with the near edge of the planks
  const edge = (x: number) => deckY(x, r + 0.4) + BRIDGE.deckHalf - slot.r * 0.55;
  let tb = 0;
  for (let i = 1; i < 400; i++) {
    const tau = i / 400;
    const x = p0.x + v0.x * tau;
    const y = p0.y + v0.y * tau + 0.5 * G * tau * tau;
    if (y >= edge(x) && v0.y + G * tau > 0) {
      tb = tau;
      break;
    }
  }
  const pb = {x: p0.x + v0.x * tb, y: p0.y + v0.y * tb + 0.5 * G * tb * tb};
  const vyImpact = v0.y + G * tb;
  const vb = {x: v0.x * 0.45 - 18, y: -0.3 * vyImpact};
  const f = {t0, p0, v0, tb: t0 + tb, pb, vb, spin: (k % 2 ? -1 : 1) * (3 + k)};
  flights[k] = f;
  return f;
};

/** Stone k in world space after it leaves the pack; null while it is still inside. */
export const stoneAt = (k: number, t: number): StoneState | null => {
  const r = releaseTimes[k];
  if (t < r) return null;
  const slot = SLOTS[k];
  if (t < r + LIFT) {
    // working loose: rises out of its slot with the pack
    const u = (t - r) / LIFT;
    const xf = packAt(t).xf;
    const p = toWorld(xf, slot.u, slot.v + 0.035 * H * u * u);
    return {x: p.x, y: p.y, rot: 0.3 * u, scale: 1, alpha: 1, vx: 0, vy: 0, inFront: true};
  }
  const f = flightOf(k);
  let x: number;
  let y: number;
  let vx: number;
  let vy: number;
  let scale = 1;
  let rot: number;
  if (t < f.tb) {
    const tau = t - f.t0;
    x = f.p0.x + f.v0.x * tau;
    y = f.p0.y + f.v0.y * tau + 0.5 * G * tau * tau;
    vx = f.v0.x;
    vy = f.v0.y + G * tau;
    rot = 0.3 + f.spin * 0.5 * tau;
  } else {
    const tau = t - f.tb;
    x = f.pb.x + f.vb.x * tau;
    y = f.pb.y + f.vb.y * tau + 0.5 * G * tau * tau;
    vx = f.vb.x;
    vy = f.vb.y + G * tau;
    scale = 1 + 0.22 * smoothstep(0, 0.4, tau);
    rot = 0.3 + f.spin * 0.5 * (f.tb - f.t0) + f.spin * tau;
  }
  const depth = y - f.pb.y;
  const alpha = 1 - smoothstep(380, 1050, depth);
  return {x, y, rot, scale, alpha, vx, vy, inFront: true};
};

export const stoneImpactTimes = () => [0, 1, 2, 3, 4].map((k) => flightOf(k).tb);
export const PACK_GROUND_X = () => GROUND_X();
export const FINAL_STAND_X = FINAL_X;
export const FRAME_DT = 1 / FPS;
export const FIN = FINALE;
