import React from 'react';
import {G, H, PAL, SCHEDULE, W} from './constants';
import {clamp, esine, kf, range, rng, ss} from './util';

const E = SCHEDULE.events;

// ---------- ауа райы мен жарық қисықтары ----------
export const weather = (t: number) => {
  const reveal = 0.18 + 0.82 * ss(range(t, 0, 1.7));                     // атмосфералық ашылу (0 кадр бос емес)
  const moon = kf(t, [[0, 0.55], [2.4, 1], [12.6, 1], [15.0, 0.22], [20.3, 0.22], [23.2, 0.7], [27, 0.75]]);
  const clouds = kf(t, [[11.8, 0], [15.2, 1], [20.2, 1], [24.0, 0.45], [27, 0.4]]);
  const rain = kf(t, [[E.rainStart, 0], [13.8, 0.45], [E.rainFull, 1], [20.0, 1], [22.5, 0.7], [E.rainFadeStart, 0.6], [E.rainEnd, 0]]);
  const warm = kf(t, [[E.warmStart, 0], [E.warmFull, 1], [27, 1]]);
  const dim = kf(t, [[23.6, 0], [25.0, 0.5], [27, 0.56]]);
  const fadeOut = ss(range(t, E.fadeOut, 27.0));
  const wet = kf(t, [[12.6, 0], [15.5, 1], [27, 1]]);
  return {reveal, moon, clouds, rain, warm, dim, fadeOut, wet};
};
export type Weather = ReturnType<typeof weather>;

// ---------- камера ----------
type Cam = {cx: number; cy: number; z: number};
const CAM_KEYS: [number, Cam][] = [
  [0, {cx: 1250, cy: 800, z: 1.34}],
  [3, {cx: 1272, cy: 798, z: 1.36}],
  [7, {cx: 1290, cy: 790, z: 1.38}],
  [12, {cx: 1300, cy: 772, z: 1.4}],
  [16.3, {cx: 1290, cy: 768, z: 1.37}],
  [19.9, {cx: 1655, cy: 880, z: 2.4}],
  [22.3, {cx: 1282, cy: 790, z: 1.36}],
  [24.0, {cx: 1278, cy: 790, z: 1.35}],
  [27.0, {cx: 1272, cy: 788, z: 1.33}],
];
export function camera(t: number): Cam {
  const f = (k: keyof Cam) => kf(t, CAM_KEYS.map(([tt, c]) => [tt, c[k]]), esine);
  return {cx: f('cx'), cy: f('cy'), z: f('z')};
}
export const CAM0: Cam = {cx: 1150, cy: 770, z: 1};
/** Параллакс: factor 0 — қозғалмайды, 1 — негізгі әлем. */
export function layerTransform(c: Cam, factor: number) {
  const cx = CAM0.cx + (c.cx - CAM0.cx) * factor, cy = CAM0.cy + (c.cy - CAM0.cy) * factor, z = 1 + (c.z - 1) * factor;
  return {str: `translate(${W / 2},${H / 2}) scale(${z}) translate(${-cx},${-cy})`, cx, cy, z};
}
export const toScreen = (c: Cam, x: number, y: number, factor = 1) => {
  const L = layerTransform(c, factor);
  return [(x - L.cx) * L.z + W / 2, (y - L.cy) * L.z + H / 2] as [number, number];
};

// ---------- аспан ----------
export const MOON = {x: 1880, y: 245, r: 52};
const STARS = (() => { const r = rng(11); return Array.from({length: 150}, () => ({x: -200 + r() * 2700, y: -100 + r() * 760, r: 0.6 + r() * 1.5, a: 0.25 + r() * 0.6, p: r() * 6.28, s: 0.4 + r() * 1.2})); })();

export const Sky: React.FC<{t: number; c: Cam; w: Weather}> = ({t, c, w}) => {
  const L = layerTransform(c, 0.12), M = layerTransform(c, 0.2);
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill="url(#skyGrad)" />
      <g transform={L.str} opacity={w.reveal * (1 - 0.85 * w.clouds)}>
        {STARS.map((s, i) => <circle key={i} cx={s.x + t * 2} cy={s.y} r={s.r} fill={PAL.ivory} opacity={s.a * (0.65 + 0.35 * Math.sin(t * s.s + s.p))} />)}
      </g>
      <g transform={M.str} opacity={w.reveal}>
        <circle cx={MOON.x} cy={MOON.y} r={520} fill="url(#moonHalo)" opacity={0.55 * w.moon} />
        <circle cx={MOON.x} cy={MOON.y} r={190} fill="url(#moonHalo)" opacity={0.6 * w.moon} />
        <circle cx={MOON.x} cy={MOON.y} r={MOON.r} fill="url(#moonDisc)" opacity={0.35 + 0.65 * w.moon} />
        <g opacity={0.09 * w.moon}>
          <circle cx={MOON.x - 18} cy={MOON.y - 10} r={13} fill="#6f7178" />
          <circle cx={MOON.x + 16} cy={MOON.y + 14} r={9} fill="#6f7178" />
          <circle cx={MOON.x + 4} cy={MOON.y - 26} r={6} fill="#6f7178" />
        </g>
        {/* ашылудағы ай алдындағы мұнар */}
        <ellipse cx={MOON.x - 40 + t * 30} cy={MOON.y + 20} rx={260} ry={60} fill="#25272c" opacity={0.75 * (1 - ss(range(t, 0.2, 2.6)))} filter="url(#blur30)" />
      </g>
    </g>
  );
};

// ---------- бұлттар ----------
const CLOUDS = [
  {x0: 2700, y: 230, s: 1.25, speed: 120, delay: 11.8},
  {x0: 2950, y: 330, s: 1.0, speed: 105, delay: 12.3},
  {x0: 3300, y: 170, s: 1.4, speed: 95, delay: 12.6},
  {x0: 2500, y: 420, s: 0.8, speed: 130, delay: 13.2},
  {x0: 3600, y: 260, s: 1.2, speed: 100, delay: 13.6},
];
const cloudShape = (s: number) => [[0, 0, 230, 70], [-150, 25, 170, 55], [160, 22, 180, 60], [40, -40, 150, 60], [-60, -25, 120, 48]].map(([x, y, rx, ry]) => [x * s, y * s, rx * s, ry * s]);
export const Clouds: React.FC<{t: number; c: Cam; w: Weather}> = ({t, c, w}) => {
  const L = layerTransform(c, 0.3);
  if (t < 11.5) return null;
  return (
    <g transform={L.str} filter="url(#blur24)">
      {CLOUDS.map((cl, i) => {
        const x = cl.x0 - (t - cl.delay) * cl.speed;
        const a = clamp(w.clouds * 1.2) * (1 - range(t, 21.5, 26) * (i % 2 ? 0.6 : 0.3));
        return (
          <g key={i} transform={`translate(${x},${cl.y})`} opacity={a}>
            {cloudShape(cl.s).map(([x, y, rx, ry], k) => <ellipse key={k} cx={x} cy={y} rx={rx} ry={ry} fill={k < 2 ? '#0d0e11' : '#15161a'} />)}
            <ellipse cx={0} cy={-55 * cl.s} rx={210 * cl.s} ry={18 * cl.s} fill="#5b5e66" opacity={0.25 * w.moon} />
          </g>
        );
      })}
    </g>
  );
};

// ---------- төбелер, тұман ----------
const hillPath = (() => {
  let d = `M-600,${G + 2}`;
  for (let x = -600; x <= 3200; x += 40) d += ` L${x},${(G - 58 - 34 * Math.sin(x * 0.0021 + 1) - 18 * Math.sin(x * 0.0057)).toFixed(1)}`;
  return d + ` L3200,${G + 2} Z`;
})();
const hillPath2 = (() => {
  let d = `M-600,${G + 2}`;
  for (let x = -600; x <= 3200; x += 40) d += ` L${x},${(G - 22 - 18 * Math.sin(x * 0.0033 + 3) - 8 * Math.sin(x * 0.009)).toFixed(1)}`;
  return d + ` L3200,${G + 2} Z`;
})();
export const Hills: React.FC<{c: Cam; w: Weather}> = ({c, w}) => (
  <g opacity={w.reveal}>
    <path d={hillPath} transform={layerTransform(c, 0.4).str} fill="#121317" />
    <path d={hillPath2} transform={layerTransform(c, 0.6).str} fill="#0e0f12" />
  </g>
);
export const Fog: React.FC<{t: number; c: Cam; w: Weather; near?: boolean}> = ({t, c, w, near}) => {
  const L = layerTransform(c, near ? 1.15 : 0.65);
  const bands = near ? [[400, G + 6, 900, 30, 0.06], [1900, G + 12, 1000, 34, 0.05]] : [[600, G - 26, 1300, 46, 0.07], [2000, G - 44, 1200, 60, 0.06], [-200, G - 64, 1100, 50, 0.05]];
  return (
    <g transform={L.str} filter="url(#blur30)" opacity={w.reveal * (1 + 0.5 * w.rain)}>
      {bands.map(([x, y, rx, ry, a], i) => <ellipse key={i} cx={x + Math.sin(t * 0.12 + i) * 80 + t * (near ? 9 : 5)} cy={y} rx={rx} ry={ry} fill="#9da1a9" opacity={a} />)}
    </g>
  );
};

// ---------- жер беті ----------
export const Ground: React.FC<{c: Cam; w: Weather}> = ({c, w}) => {
  const gy = toScreen(c, 0, G)[1];
  const m = toScreen(c, MOON.x, MOON.y, 0.2);
  return (
    <g>
      <rect x={0} y={gy} width={W} height={H - gy + 2} fill="url(#groundGrad)" />
      {/* ай жолағы су бетінде */}
      <ellipse cx={m[0]} cy={gy + 240} rx={46 + 30 * w.wet} ry={260} fill="url(#streakGrad)" opacity={(0.16 + 0.14 * w.wet) * w.moon * w.reveal} filter="url(#blur12)" />
      <rect x={0} y={gy - 1} width={W} height={2} fill="#3a3d44" opacity={0.6} />
    </g>
  );
};

// ---------- жаңбыр ----------
type Drop = {x: number; y0: number; v: number; len: number; a: number; w: number};
const mkDrops = (n: number, seed: number, v: [number, number], len: [number, number], a: [number, number], w: number): Drop[] => {
  const r = rng(seed);
  return Array.from({length: n}, () => ({x: r() * (W + 400) - 200, y0: r() * (H + 300), v: v[0] + r() * (v[1] - v[0]), len: len[0] + r() * (len[1] - len[0]), a: a[0] + r() * (a[1] - a[0]), w}));
};
const LAYERS = [
  {drops: mkDrops(260, 21, [1100, 1400], [18, 30], [0.12, 0.26], 1.1), slant: 0.12, blur: false},
  {drops: mkDrops(150, 22, [1700, 2100], [34, 52], [0.18, 0.34], 1.6), slant: 0.14, blur: false},
  {drops: mkDrops(46, 23, [2600, 3100], [80, 120], [0.14, 0.26], 3.2), slant: 0.16, blur: true},
];
export const Rain: React.FC<{t: number; w: Weather}> = ({t, w}) => {
  if (w.rain <= 0.001) return null;
  return (
    <g>
      {LAYERS.map((L, li) => (
        <g key={li} filter={L.blur ? 'url(#blur2)' : undefined}>
          {L.drops.map((d, i) => {
            if (i / L.drops.length > w.rain) return null;
            const span = H + 300, y = ((d.y0 + t * d.v) % span) - 150, x = d.x - y * L.slant;
            return <line key={i} x1={x} y1={y} x2={x + d.len * L.slant} y2={y + d.len} stroke="#d7dbe2" strokeWidth={d.w} strokeLinecap="round" opacity={d.a} />;
          })}
        </g>
      ))}
    </g>
  );
};
/** Жерге тиген тамшылардың шеңбер толқындары (әлем координаталары). */
const SPL = (() => { const r = rng(31); return Array.from({length: 70}, () => ({x: 150 + r() * 2300, dy: 6 + r() * 360, p: r(), period: 0.5 + r() * 0.6})); })();
export const Splashes: React.FC<{t: number; w: Weather}> = ({t, w}) => {
  if (w.rain <= 0.001) return null;
  return (
    <g>
      {SPL.map((s, i) => {
        if (i / SPL.length > w.rain) return null;
        const ph = ((t / s.period + s.p) % 1), depth = 0.5 + s.dy / 360;
        return <ellipse key={i} cx={s.x} cy={G + s.dy * 0.5} rx={(3 + 22 * ph) * depth} ry={(0.8 + 4.5 * ph) * depth} fill="none" stroke="#c9cdd4" strokeWidth={1.1} opacity={0.32 * (1 - ph) * w.rain} />;
      })}
    </g>
  );
};

// ---------- ауадағы бөлшектер ----------
const MOTES = (() => { const r = rng(41); return Array.from({length: 60}, () => ({x: r() * W, y: 200 + r() * 900, r: 0.8 + r() * 2.2, vx: -6 + r() * 12, vy: -4 - r() * 8, p: r() * 6, a: 0.12 + r() * 0.3})); })();
export const Motes: React.FC<{t: number; c: Cam; w: Weather}> = ({t, c, w}) => {
  const ox = -(c.cx - CAM0.cx) * 0.3;
  return (
    <g opacity={w.reveal * (1 - 0.7 * w.rain)}>
      {MOTES.map((m, i) => {
        const x = ((m.x + m.vx * t + ox) % W + W) % W, y = ((m.y + m.vy * t) % 1100 + 1100) % 1100 + 150;
        return <circle key={i} cx={x} cy={y} r={m.r} fill={PAL.ivory} opacity={m.a * (0.6 + 0.4 * Math.sin(t * 0.7 + m.p))} />;
      })}
    </g>
  );
};
