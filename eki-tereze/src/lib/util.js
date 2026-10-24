// Deterministic helpers shared by every module.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
export const smoother = (a, b, x) => { const t = inv(a, b, x); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeIO = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const sine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));
export const deg = (d) => (d * Math.PI) / 180;
export const mixV = (a, b, t) => a.map((x, i) => lerp(x, b[i], t));

export const hash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const rng = (seed) => {
  let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

/** Smooth 1D value noise in [-1, 1]. */
export const noise1 = (seed) => {
  const r = rng(seed); const T = Array.from({length: 256}, () => r() * 2 - 1);
  return (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(T[i & 255], T[(i + 1) & 255], u); };
};
/** Smooth 2D value noise in [-1, 1]. */
export const noise2 = (seed) => {
  const r = rng(seed); const T = Array.from({length: 256 * 256}, () => r() * 2 - 1);
  const g = (x, y) => T[(y & 255) * 256 + (x & 255)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(g(xi, yi), g(xi + 1, yi), u), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), u), v);
  };
};
export const fbm2 = (seed, oct = 4) => {
  const ns = Array.from({length: oct}, (_, k) => noise2(seed + ':' + k));
  return (x, y) => { let s = 0, a = 0.5, f = 1, n = 0; for (const fn of ns) { s += a * fn(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return s / n; };
};

/**
 * Keyframe track: keys = [[t, value(s)], ...]. Values may be numbers or arrays.
 * Monotone cubic between keys (no overshoot); `hold` keys ([t, v, 'h']) get zero slope.
 */
export const track = (keys) => {
  const K = keys.map((k) => ({t: k[0], v: Array.isArray(k[1]) ? k[1] : [k[1]], hold: k[2] === 'h', scalar: !Array.isArray(k[1])}));
  const tan = (i, c) => {
    if (i === 0 || i === K.length - 1 || K[i].hold) return 0;
    const dp = (K[i].v[c] - K[i - 1].v[c]) / (K[i].t - K[i - 1].t);
    const dn = (K[i + 1].v[c] - K[i].v[c]) / (K[i + 1].t - K[i].t);
    if (dp * dn <= 0) return 0;
    const m = (dp + dn) / 2, lim = 3 * Math.min(Math.abs(dp), Math.abs(dn));
    return Math.sign(m) * Math.min(Math.abs(m), lim);
  };
  return (t) => {
    let out;
    if (t <= K[0].t) out = K[0].v;
    else if (t >= K[K.length - 1].t) out = K[K.length - 1].v;
    else {
      let i = 0; while (t > K[i + 1].t) i++;
      const a = K[i], b = K[i + 1], h = b.t - a.t, u = (t - a.t) / h;
      const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
      out = a.v.map((_, c) => h00 * a.v[c] + h10 * h * tan(i, c) + h01 * b.v[c] + h11 * h * tan(i + 1, c));
    }
    return K[0].scalar ? out[0] : out.slice();
  };
};

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const col = (hex) => new THREE.Color(hex);
export const shadow = (o, cast = true, recv = true) => { o.traverse((c) => { if (c.isMesh) { c.castShadow = cast; c.receiveShadow = recv; } }); return o; };
