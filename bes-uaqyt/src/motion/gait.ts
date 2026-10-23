// Footstep planner. Each walk moves the pelvis along a smooth speed profile;
// feet are planted at fixed world x positions while in stance, so they never
// slide. Swing windows are expressed in pelvis distance (s).

import {GAIT, RIG, START_X, WALKS} from '../config/timeline';
import {lerp} from '../lib/math';
import {loadAt} from './load';

export type Foot = 'N' | 'F'; // near / far leg
export type Step = {foot: Foot; from: number; to: number; sa: number; sb: number; closing: boolean};
export type WalkPlan = {
  i: number;
  t0: number;
  t1: number;
  x0: number;
  D: number;
  L: number;
  load: number;
  vmax: number;
  a: number;
  b: number;
  steps: Step[];
  first: Foot;
};

const H = RIG.H;

const profile = (T: number, D: number, a: number, b: number) => D / (T - a / 2 - b / 2);

/** Pelvis distance travelled at time t within a plan. */
export const sAt = (p: WalkPlan, t: number) => {
  const T = p.t1 - p.t0;
  const tau = Math.min(Math.max(t - p.t0, 0), T);
  const {a, b, vmax} = p;
  const ramp = (u: number) => u * u * u - (u * u * u * u) / 2; // ∫ smoothstep
  if (tau <= a) return vmax * a * ramp(tau / a);
  const sA = vmax * a * 0.5;
  if (tau <= T - b) return sA + vmax * (tau - a);
  const sB = sA + vmax * (T - b - a);
  const u = (tau - (T - b)) / b;
  // decel: mirror of the accel ramp
  return sB + vmax * b * (u - ramp(u));
};

export const speedAt = (p: WalkPlan, t: number) => {
  const T = p.t1 - p.t0;
  const tau = t - p.t0;
  if (tau <= 0 || tau >= T) return 0;
  const ss = (u: number) => u * u * (3 - 2 * u);
  if (tau < p.a) return p.vmax * ss(tau / p.a);
  if (tau > T - p.b) return p.vmax * ss((T - tau) / p.b);
  return p.vmax;
};

export const timeAtS = (p: WalkPlan, s: number) => {
  let lo = p.t0;
  let hi = p.t1;
  for (let k = 0; k < 50; k++) {
    const m = (lo + hi) / 2;
    if (sAt(p, m) < s) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
};

const buildPlans = (): WalkPlan[] => {
  const plans: WalkPlan[] = [];
  let x = START_X;
  let first: Foot = 'N';
  WALKS.forEach((w, i) => {
    const load = loadAt(w.t0 + 0.01);
    const L = H * lerp(GAIT.step[1], GAIT.step[0], load);
    const n = w.steps;
    const D = n * L;
    const T = w.t1 - w.t0;
    const a = Math.min(GAIT.accel, T * 0.35);
    const b = Math.min(GAIT.decel, T * 0.4);
    const second: Foot = first === 'N' ? 'F' : 'N';
    const steps: Step[] = [];
    // foot positions are ankle x
    const pos: Record<Foot, number> = {N: x, F: x};
    for (let m = 1; m <= n; m++) {
      const foot = m % 2 === 1 ? first : second;
      const to = x + m * L;
      const sa = Math.max(0, (m - 1) * L - 0.36 * L);
      const sb = (m - 1) * L + 0.45 * L;
      steps.push({foot, from: pos[foot], to, sa, sb, closing: false});
      pos[foot] = to;
    }
    // closing step brings the trailing foot alongside
    const trail: Foot = n % 2 === 1 ? second : first;
    steps.push({foot: trail, from: pos[trail], to: x + D, sa: D - 0.42 * L, sb: D - 0.02 * L, closing: true});
    plans.push({i, t0: w.t0, t1: w.t1, x0: x, D, L, load, vmax: profile(T, D, a, b), a, b, steps, first});
    x += D;
    first = trail === 'N' ? 'F' : 'N';
  });
  return plans;
};

export const PLANS = buildPlans();

/** Ankle x of a foot and swing progress (0 planted, 0..1 swinging). */
export const footState = (p: WalkPlan, foot: Foot, s: number) => {
  let x = p.x0;
  for (const st of p.steps) {
    if (st.foot !== foot) continue;
    if (s <= st.sa) return {x, u: 0, step: null as Step | null};
    if (s < st.sb) return {x: st.from, u: (s - st.sa) / (st.sb - st.sa), step: st};
    x = st.to;
  }
  return {x, u: 0, step: null as Step | null};
};

export type Strike = {t: number; x: number; foot: Foot; load: number; closing: boolean; walk: number; lift: number};

/** Heel strikes and toe-offs, used by the bridge (bounce) and the sound design. */
export const STRIKES: Strike[] = PLANS.flatMap((p) =>
  p.steps.map((st) => ({
    t: timeAtS(p, st.sb),
    x: st.to,
    foot: st.foot,
    load: p.load,
    closing: st.closing,
    walk: p.i,
    lift: timeAtS(p, st.sa),
  })),
);

export const planAt = (t: number) => PLANS.find((p) => t >= p.t0 && t <= p.t1) ?? null;

/** Pelvis x over the whole film (walks only move it; poses add small offsets). */
export const baseX = (t: number) => {
  let x = START_X;
  for (const p of PLANS) {
    if (t < p.t0) return x;
    if (t <= p.t1) return p.x0 + sAt(p, t);
    x = p.x0 + p.D;
  }
  return x;
};
