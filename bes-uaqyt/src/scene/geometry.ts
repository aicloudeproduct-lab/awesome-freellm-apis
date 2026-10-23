// Seeded, memoised scenery shapes (computed once per render process).

import {BRIDGE} from '../config/timeline';
import {lerp, rng} from '../lib/math';

/** Smooth 1D value noise in roughly [-1, 1]. */
export const noise1 = (seed: string) => {
  const r = rng(seed);
  const table = Array.from({length: 512}, () => r() * 2 - 1);
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = table[((i % 512) + 512) % 512];
    const b = table[(((i + 1) % 512) + 512) % 512];
    const u = f * f * (3 - 2 * f);
    return lerp(a, b, u);
  };
};

const fbm = (seed: string, oct = 4) => {
  const ns = Array.from({length: oct}, (_, k) => noise1(`${seed}-${k}`));
  return (x: number) => {
    let s = 0;
    let a = 1;
    let f = 1;
    let n = 0;
    for (const fn of ns) {
      s += a * fn(x * f);
      n += a;
      a *= 0.5;
      f *= 2.1;
    }
    return s / n;
  };
};

export type Pt = [number, number];
export const pathOf = (pts: Pt[], close = true) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('') + (close ? 'Z' : '');

/** Mountain ridge silhouette polygon. */
const ridge = (seed: string, x0: number, x1: number, base: number, amp: number, scale: number, bottom: number, sharp = 1.6): Pt[] => {
  const n = fbm(seed, 5);
  const pts: Pt[] = [];
  for (let x = x0; x <= x1; x += 8) {
    const v = n(x / scale);
    const peak = Math.sign(v) * Math.pow(Math.abs(v), 1 / sharp);
    pts.push([x, base - amp * peak]);
  }
  pts.push([x1, bottom], [x0, bottom]);
  return pts;
};

let memo: ReturnType<typeof make> | null = null;
export const geometry = () => (memo ??= make());

const make = () => {
  const farRidge = ridge('far', -900, 1300, -235, 150, 260, 900, 1.3);
  const nearRidge = ridge('near', -900, 1500, -110, 120, 190, 900, 1.5);

  // rock spires rising out of the fog, two depth bands
  const spires = (seed: string, n: number, x0: number, x1: number, topMin: number, topMax: number, wMin: number, wMax: number) => {
    const r = rng(seed);
    const step = (x1 - x0) / n;
    return Array.from({length: n}, (_, i) => {
      const cx = x0 + (i + 0.5) * step + (r() - 0.5) * step * 0.7;
      const w = wMin + r() * (wMax - wMin);
      const top = topMin + Math.pow(r(), 1.4) * (topMax - topMin);
      const nn = noise1(`${seed}-${i}`);
      const lean = (r() - 0.5) * 0.12;
      const left: Pt[] = [];
      const right: Pt[] = [];
      for (let y = top + 30; y <= 1500; y += 30) {
        const k = Math.min(1, (y - top) / 700);
        const half = w * (0.38 + 0.62 * Math.sqrt(k));
        const off = (y - top) * lean;
        left.push([cx + off - half + nn(y / 70) * w * 0.12, y]);
        right.push([cx + off + half + nn(y / 70 + 50) * w * 0.12, y]);
      }
      const crag: Pt[] = [
        [cx - w * 0.38, top + 30],
        [cx - w * 0.2, top + 6 + r() * 10],
        [cx - w * 0.04, top + r() * 4],
        [cx + w * 0.12, top + 10 + r() * 8],
        [cx + w * 0.26, top + 2 + r() * 12],
        [cx + w * 0.38, top + 30],
      ];
      return {cx, w, top, pts: [...crag, ...right, ...left.reverse()] as Pt[]};
    });
  };
  const pillarsFar = spires('spiresFar', 9, -900, 1200, -40, 260, 50, 120);
  const pillars = spires('spiresNear', 7, -800, 1500, 40, 380, 60, 135);

  // cliff faces (bridge plane)
  const nl = fbm('cliffL', 4);
  const nr = fbm('cliffR', 4);
  const leftFace: Pt[] = [[-1700, 10]];
  leftFace.push([-26, 10], [-4, 4], [2, 16]);
  for (let y = 40; y <= 1600; y += 26) leftFace.push([-6 - 0.16 * y - 26 * (nl(y / 90) + 0.6), y]);
  leftFace.push([-1700, 1600]);
  const rightFace: Pt[] = [[2600, 10]];
  rightFace.push([BRIDGE.x1 + 26, 10], [BRIDGE.x1 + 4, 4], [BRIDGE.x1 - 2, 16]);
  for (let y = 40; y <= 1600; y += 26) rightFace.push([BRIDGE.x1 + 6 + 0.2 * y + 26 * (nr(y / 90) + 0.6), y]);
  rightFace.push([2600, 1600]);

  // strata strokes on the faces
  const rs = rng('strata');
  const strata = Array.from({length: 26}, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const y = 60 + rs() * 900;
    const edge = side < 0 ? -6 - 0.16 * y : BRIDGE.x1 + 6 + 0.2 * y;
    const x0 = edge + side * (20 + rs() * 120);
    const len = 40 + rs() * 140;
    return {x0, x1: x0 + side * len, y, y1: y + (rs() - 0.3) * 30, side};
  });

  // small stones and dry grass on the cliff tops
  const rg = rng('tufts');
  const tufts = Array.from({length: 26}, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const x = side < 0 ? -40 - rg() * 700 : BRIDGE.x1 + 50 + rg() * 800;
    return {x, h: 6 + rg() * 12, lean: (rg() - 0.5) * 0.8, near: rg() > 0.5};
  });
  const pebbles = Array.from({length: 18}, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const x = side < 0 ? -30 - rg() * 650 : BRIDGE.x1 + 90 + rg() * 700;
    return {x, r: 2.5 + rg() * 4, y: (rg() - 0.4) * 14};
  });

  // planks
  const pitch = BRIDGE.plankW + BRIDGE.plankGap;
  const count = Math.floor((BRIDGE.x1 - BRIDGE.x0) / pitch);
  const off = (BRIDGE.x1 - BRIDGE.x0 - count * pitch) / 2;
  const rp = rng('planks');
  const planks = Array.from({length: count}, (_, i) => ({
    xa: BRIDGE.x0 + off + i * pitch + BRIDGE.plankGap / 2,
    xb: BRIDGE.x0 + off + i * pitch + BRIDGE.plankGap / 2 + BRIDGE.plankW,
    tone: (rp() - 0.5) * 0.22,
    skew: (rp() - 0.5) * 2.4,
  }));

  // stars
  const st = rng('stars');
  const stars = Array.from({length: 230}, () => ({
    x: st() * 1180 - 50,
    y: st() * st() * 1050 + 40,
    r: 0.6 + Math.pow(st(), 3) * 2.0,
    ph: st() * Math.PI * 2,
    sp: 0.6 + st() * 2.2,
  }));

  // drifting motes
  const mt = rng('motes');
  const motes = Array.from({length: 64}, () => ({
    x: mt() * 1180,
    y: 300 + mt() * 1650,
    r: 1.1 + mt() * 2.4,
    a: 0.25 + mt() * 0.5,
    sp: 6 + mt() * 18,
    ph: mt() * 10,
    p: 1.05 + mt() * 0.35,
  }));

  // fog blobs
  const fg = rng('fog');
  const fog = Array.from({length: 16}, (_, i) => ({
    x: -700 + fg() * 2200,
    y: 160 + fg() * 900,
    rx: 260 + fg() * 380,
    ry: 50 + fg() * 90,
    a: 0.45 + fg() * 0.55,
    layer: i % 3,
    drift: 4 + fg() * 9,
  }));

  // clouds
  const cl = rng('clouds');
  const clouds = Array.from({length: 7}, () => ({
    x: cl() * 1300 - 100,
    y: 380 + cl() * 470,
    rx: 160 + cl() * 260,
    ry: 9 + cl() * 16,
    a: 0.35 + cl() * 0.4,
  }));

  return {farRidge, nearRidge, pillars, pillarsFar, leftFace, rightFace, strata, tufts, pebbles, planks, stars, motes, fog, clouds};
};

/** Irregular rounded stone outline (local coords, centred). */
export const stonePath = (seed: string, r: number) => {
  const rr = rng(seed);
  const n = 8;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rr() - 0.5) * 0.3;
    const k = 0.84 + rr() * 0.26;
    pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k * 0.8]);
  }
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const m: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (i === 0) {
      const pm = pts[n - 1];
      d += `M${((pm[0] + p[0]) / 2).toFixed(2)} ${((pm[1] + p[1]) / 2).toFixed(2)}`;
    }
    d += `Q${p[0].toFixed(2)} ${p[1].toFixed(2)} ${m[0].toFixed(2)} ${m[1].toFixed(2)}`;
  }
  return d + 'Z';
};
