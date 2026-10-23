// Rope-bridge deck surface. The deck sags as a parabola between the cliffs and
// dips locally under the walker (more while the pack is heavy). Footfalls and
// stone releases add small damped bounces.

import {BRIDGE, PRAYERS, PRAYER_KEYS} from '../config/timeline';
import {clamp, lerp, ring} from '../lib/math';
import {STRIKES, baseX} from './gait';
import {loadAt, releaseTimes} from './load';

const {x0, x1, sag} = BRIDGE;
const W = x1 - x0;

export const onBridge = (x: number) => x > x0 && x < x1;

/** 0 at the anchors, 1 mid-span. */
export const taper = (x: number) => {
  if (!onBridge(x)) return 0;
  return Math.sin((Math.PI * (x - x0)) / W);
};

export const deckBase = (x: number) => {
  if (!onBridge(x)) return 0;
  const u = (x - x0) / W;
  return sag * 4 * u * (1 - u);
};

// knee contacts during prayer (kneel) also nudge the deck
const KNEE_HITS = PRAYERS.map((p) => p.t0 + p.dur * PRAYER_KEYS.kneel * 0.92);

/** Vertical bounce amplitude (px) at time t, centred on the walker. */
export const bounceAt = (t: number) => {
  let b = 0;
  for (const s of STRIKES) {
    if (t < s.t || t > s.t + 1.6) continue;
    b += (s.closing ? 0.6 : 1.0) * lerp(0.9, 2.2, s.load) * ring(t, s.t, 2.1, 0.32);
  }
  for (const k of KNEE_HITS) b += 1.6 * ring(t, k, 2.0, 0.35);
  // releasing weight: deck springs up
  for (const r of releaseTimes) b -= 3.2 * ring(t, r + 0.05, 1.6, 0.55);
  return b;
};

const dipGauss = (x: number, c: number) => {
  const d = (x - c) / BRIDGE.dipWidth;
  return Math.exp(-d * d);
};

/** Deck centre-line y at world x, time t (y grows downward). */
export const deckY = (x: number, t: number) => {
  if (!onBridge(x)) return 0;
  const c = baseX(t);
  const load = loadAt(t);
  const presence = clamp((c - x0 + 40) / 80) * clamp((x1 + 40 - c) / 80);
  const dip = lerp(BRIDGE.loadDip[1], BRIDGE.loadDip[0], load) * presence;
  const g = dipGauss(x, c);
  return deckBase(x) + taper(x) * (dip * g + bounceAt(t) * g * presence) + windSway(x, t);
};

export const windSway = (x: number, t: number) =>
  taper(x) * (0.9 * Math.sin(t * 1.3 + x * 0.004) + 0.5 * Math.sin(t * 2.1 + 1.7 + x * 0.007));

export const deckSlope = (x: number, t: number) => {
  const e = 2;
  return Math.atan2(deckY(x + e, t) - deckY(x - e, t), 2 * e);
};
