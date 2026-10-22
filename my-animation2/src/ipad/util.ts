// Жалпы математика: интерполяция, easing, векторлар, екі буынды IK, детерминирленген кездейсоқтық.
export type V = [number, number];

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const range = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const ss = (t: number) => t * t * (3 - 2 * t);
export const eio = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const eo = (t: number) => 1 - Math.pow(1 - t, 3);
export const ei = (t: number) => t * t * t;
export const esine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const eoq = (t: number) => 1 - (1 - t) * (1 - t);

export const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
export const len = (a: V) => Math.hypot(a[0], a[1]);
export const lerpV = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** Кілттік кадрлар: [[уақыт, мән], ...], сегменттер арасында easing. */
export function kf(t: number, keys: [number, number][], ease: (x: number) => number = esine): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) return lerp(v0, v1, ease(range(t, t0, t1)));
  }
  return keys[keys.length - 1][1];
}
export function kfV(t: number, keys: [number, V][], ease: (x: number) => number = esine): V {
  return [kf(t, keys.map(([k, v]) => [k, v[0]]), ease), kf(t, keys.map(([k, v]) => [k, v[1]]), ease)];
}

/** Детерминирленген кездейсоқ сандар (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Екі буынды IK: root → joint → end. bend = +1/−1 буынның қай жаққа бүгілетінін береді. */
export function ik(root: V, target: V, a: number, b: number, bend: number): {joint: V; end: V} {
  let dx = target[0] - root[0], dy = target[1] - root[1];
  let d = Math.hypot(dx, dy) || 0.001;
  const maxD = a + b - 0.5, minD = Math.abs(a - b) + 0.5;
  let end: V = target;
  if (d > maxD) { end = [root[0] + (dx / d) * maxD, root[1] + (dy / d) * maxD]; d = maxD; dx = end[0] - root[0]; dy = end[1] - root[1]; }
  if (d < minD) { end = [root[0] + (dx / d) * minD, root[1] + (dy / d) * minD]; d = minD; dx = end[0] - root[0]; dy = end[1] - root[1]; }
  const th = Math.atan2(dy, dx);
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const ang = th + bend * A;
  return {joint: [root[0] + a * Math.cos(ang), root[1] + a * Math.sin(ang)], end};
}

/** Қолмен салынған сызық әсері: нүктелер тізбегіне шағын тербеліс қосу. */
export function wobble(pts: V[], amp: number, seed: number, step = 14): V[] {
  const r = rng(seed), out: V[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = len(sub(b, a)), n = Math.max(1, Math.round(L / step));
    const nx = -(b[1] - a[1]) / (L || 1), ny = (b[0] - a[0]) / (L || 1);
    for (let k = 0; k < n; k++) {
      const f = k / n, o = (r() - 0.5) * 2 * amp * Math.sin(Math.PI * f);
      out.push([lerp(a[0], b[0], f) + nx * o, lerp(a[1], b[1], f) + ny * o]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
export function polyLen(pts: V[]) { let s = 0; for (let i = 1; i < pts.length; i++) s += len(sub(pts[i], pts[i - 1])); return s; }
export function pointAlong(pts: V[], f: number): V {
  const total = polyLen(pts); let d = clamp(f) * total;
  for (let i = 1; i < pts.length; i++) {
    const s = len(sub(pts[i], pts[i - 1]));
    if (d <= s) return lerpV(pts[i - 1], pts[i], s ? d / s : 0);
    d -= s;
  }
  return pts[pts.length - 1];
}
export const pathD = (pts: V[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
