// Time-of-day state: blends the palette keys (OKLab) and the sun/moon/star
// parameters with a smoothstep between neighbouring keys.

import {PALETTE_KEYS, Palette} from '../config/palette';
import {mix} from '../lib/color';
import {lerp, smoothstep} from '../lib/math';

export type Atmos = {p: Palette; stars: number; sun: {x: number; y: number; alpha: number}; fog: number; moon: number; lightDir: number};

export const atmosAt = (t: number): Atmos => {
  const K = PALETTE_KEYS;
  let i = 0;
  while (i < K.length - 2 && t > K[i + 1].t) i++;
  const a = K[i];
  const b = K[i + 1];
  const u = smoothstep(a.t, b.t, t);
  const p = {} as Palette;
  for (const k of Object.keys(a.p) as (keyof Palette)[]) p[k] = mix(a.p[k], b.p[k], u);
  const sx = lerp(a.sunXY[0], b.sunXY[0], u);
  const sy = lerp(a.sunXY[1], b.sunXY[1], u);
  return {
    p,
    stars: lerp(a.stars, b.stars, u),
    sun: {x: sx, y: sy, alpha: lerp(a.sunAlpha, b.sunAlpha, u)},
    fog: lerp(a.fog, b.fog, u),
    moon: lerp(a.moon, b.moon, u),
    // -1 lit from the left … +1 from the right (drives rim light on rocks)
    lightDir: Math.max(-1, Math.min(1, (sx - 540) / 380)),
  };
};
