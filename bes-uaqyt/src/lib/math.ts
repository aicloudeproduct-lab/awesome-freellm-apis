// Small deterministic math toolkit shared by motion, scene and tools.

export type V = {x: number; y: number};

export const v = (x: number, y: number): V => ({x, y});
export const add = (a: V, b: V): V => ({x: a.x + b.x, y: a.y + b.y});
export const sub = (a: V, b: V): V => ({x: a.x - b.x, y: a.y - b.y});
export const mul = (a: V, s: number): V => ({x: a.x * s, y: a.y * s});
export const len = (a: V) => Math.hypot(a.x, a.y);
export const dist = (a: V, b: V) => Math.hypot(a.x - b.x, a.y - b.y);
export const vlerp = (a: V, b: V, t: number): V => ({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t});
/** Unit direction for an angle measured from "straight up", positive leaning forward (+x). y grows downward. */
export const upDir = (a: number): V => ({x: Math.sin(a), y: -Math.cos(a)});
/** Unit direction for an angle measured from "straight down", positive swinging forward (+x). */
export const downDir = (a: number): V => ({x: Math.sin(a), y: Math.cos(a)});

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = invLerp(a, b, x);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a: number, b: number, x: number) => {
  const t = invLerp(a, b, x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const easeInOutSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOutCubic = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Smooth max / min (log-sum-exp), k in the same units as the inputs. */
export const smax = (a: number, b: number, k: number) => {
  const m = Math.max(a, b);
  return m + k * Math.log(Math.exp((a - m) / k) + Math.exp((b - m) / k));
};

/** Damped oscillation impulse, 0 before t0. */
export const ring = (t: number, t0: number, freq: number, decay: number) => {
  const d = t - t0;
  if (d < 0) return 0;
  return Math.exp(-d / decay) * Math.sin(2 * Math.PI * freq * d);
};
/** Soft one-shot bump: rises then decays (normalised to peak ~1). */
export const bumpPulse = (t: number, t0: number, rise: number, decay: number) => {
  const d = t - t0;
  if (d < 0) return 0;
  return (1 - Math.exp(-d / rise)) * Math.exp(-d / decay) / peakOf(rise, decay);
};
const peakOf = (r: number, dcy: number) => {
  const tp = r * Math.log(1 + dcy / r);
  return (1 - Math.exp(-tp / r)) * Math.exp(-tp / dcy);
};

// ---------- seeded randomness ----------
export const hashString = (s: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
export const rng = (seed: number | string) => {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ---------- keyframe tracks ----------
export type Key = {t: number; v: number[]; hold?: boolean};

/**
 * Monotone cubic Hermite interpolation of vector keyframes (Fritsch–Carlson
 * limited), so poses flow through keys without overshooting them. Keys marked
 * `hold` (and the first/last) get zero velocity.
 */
export const sampleTrack = (keys: Key[], t: number): number[] => {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].v.slice();
  if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[i];
  const k1 = keys[i + 1];
  const h = k1.t - k0.t;
  const u = (t - k0.t) / h;
  const h00 = 2 * u * u * u - 3 * u * u + 1;
  const h10 = u * u * u - 2 * u * u + u;
  const h01 = -2 * u * u * u + 3 * u * u;
  const h11 = u * u * u - u * u;
  const out: number[] = [];
  for (let c = 0; c < k0.v.length; c++) {
    const m0 = tangent(keys, i, c);
    const m1 = tangent(keys, i + 1, c);
    out.push(h00 * k0.v[c] + h10 * h * m0 + h01 * k1.v[c] + h11 * h * m1);
  }
  return out;
};

const tangent = (keys: Key[], i: number, c: number) => {
  const n = keys.length;
  if (i === 0 || i === n - 1 || keys[i].hold) return 0;
  const dPrev = (keys[i].v[c] - keys[i - 1].v[c]) / (keys[i].t - keys[i - 1].t);
  const dNext = (keys[i + 1].v[c] - keys[i].v[c]) / (keys[i + 1].t - keys[i].t);
  if (dPrev * dNext <= 0) return 0;
  const m = (dPrev + dNext) / 2;
  const lim = 3 * Math.min(Math.abs(dPrev), Math.abs(dNext));
  return Math.sign(m) * Math.min(Math.abs(m), lim);
};

/** Piecewise linear lookup over sorted [t, value] pairs. */
export const pw = (pairs: [number, number][], t: number) => {
  if (t <= pairs[0][0]) return pairs[0][1];
  for (let i = 0; i < pairs.length - 1; i++) {
    const [t0, a] = pairs[i];
    const [t1, b] = pairs[i + 1];
    if (t <= t1) return lerp(a, b, (t - t0) / (t1 - t0));
  }
  return pairs[pairs.length - 1][1];
};

/** Smooth piecewise lookup (smoothstep between consecutive pairs). */
export const pws = (pairs: [number, number][], t: number) => {
  if (t <= pairs[0][0]) return pairs[0][1];
  for (let i = 0; i < pairs.length - 1; i++) {
    const [t0, a] = pairs[i];
    const [t1, b] = pairs[i + 1];
    if (t <= t1) return lerp(a, b, smoothstep(t0, t1, t));
  }
  return pairs[pairs.length - 1][1];
};

export const fmt = (n: number) => (Math.round(n * 100) / 100).toString();
