// Процедуралық PBR материалдар: графит тас, жылы ақшыл мата, күңгірт металл. Барлық текстура детерминирленген шуылмен жасалады.
import * as THREE from 'three';

export const PAL = {
  deep: new THREE.Color('#111318'),
  graphite: new THREE.Color('#383D45'),
  ivory: new THREE.Color('#EEE7DA'),
  amber: new THREE.Color('#D9A45C'),
};

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Тайлданатын value-noise fbm (size×size), 0..1. */
function fbm(size, seed, octaves = 5, base = 8) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = base << o, r = rng(seed + o * 101), grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells, fy = (y / size) * cells, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const g = (i, j) => grid[((j % cells) * cells) + (i % cells)];
      const v = g(x0, y0) * (1 - sx) * (1 - sy) + g(x0 + 1, y0) * sx * (1 - sy) + g(x0, y0 + 1) * (1 - sx) * sy + g(x0 + 1, y0 + 1) * sx * sy;
      out[y * size + x] += v * amp;
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function toTexture(size, fill, srgb) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), im = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) { const [r, gg, b] = fill(i); im.data[i * 4] = r; im.data[i * 4 + 1] = gg; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function normalFromHeight(h, size, strength) {
  return (i) => {
    const x = i % size, y = (i / size) | 0;
    const hx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)];
    const hy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
    let nx = -hx * strength, ny = -hy * strength, nz = 1; const l = Math.hypot(nx, ny, nz);
    return [((nx / l) * 0.5 + 0.5) * 255, ((ny / l) * 0.5 + 0.5) * 255, ((nz / l) * 0.5 + 0.5) * 255];
  };
}

/** Тас тақталар: жіктер (grout), тақта бойынша түс ауытқуы, ұсақ кедір-бұдыр. tiles — бір текстурадағы тақта саны. */
export function stoneMaterial({seed = 1, tiles = 4, base = '#3a3f47', grout = true, size = 512, rough = 0.62, repeat = [1, 1]} = {}) {
  const n1 = fbm(size, seed, 6, 4), n2 = fbm(size, seed + 7, 4, 32);
  const r = rng(seed + 3), tileTone = Array.from({length: tiles * tiles}, () => (r() - 0.5) * 0.16);
  const h = new Float32Array(size * size);
  const tsz = size / tiles, gw = Math.max(2, size / 220);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    let v = 0.55 + 0.3 * n1[i] + 0.15 * n2[i];
    if (grout) {
      const gx = x % tsz, gy = y % tsz, d = Math.min(gx, gy, tsz - gx, tsz - gy);
      if (d < gw) v -= 0.55 * (1 - d / gw);
      else if (d < gw * 3) v -= 0.08 * (1 - (d - gw) / (gw * 2));
    }
    h[i] = v;
  }
  const bc = new THREE.Color(base);
  const map = toTexture(size, i => {
    const x = i % size, y = (i / size) | 0, tile = Math.floor(y / tsz) * tiles + Math.floor(x / tsz);
    const k = 0.62 + 0.55 * (h[i] - 0.55) + (grout ? tileTone[tile] : 0) + (n2[i] - 0.5) * 0.12;
    return [bc.r * 255 * k * 1.25, bc.g * 255 * k * 1.25, bc.b * 255 * k * 1.25].map(v => Math.max(0, Math.min(255, v)));
  }, true);
  const roughMap = toTexture(size, i => { const v = Math.max(0, Math.min(255, (rough + (0.5 - n2[i]) * 0.25 + (h[i] < 0.3 ? 0.2 : 0)) * 255)); return [v, v, v]; }, false);
  const normalMap = toTexture(size, normalFromHeight(h, size, 6), false);
  [map, roughMap, normalMap].forEach(t => t.repeat.set(repeat[0], repeat[1]));
  return new THREE.MeshStandardMaterial({map, roughnessMap: roughMap, normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 1, metalness: 0, envMapIntensity: 0.6});
}

/** Мата: нәзік тоқыма нормалі + sheen (жақын планда матаның жұмсақтығы). */
export function clothMaterial(color = '#EEE7DA', seed = 11) {
  const size = 256, n = fbm(size, seed, 3, 64);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = 0.5 * Math.sin(x * 0.9) * Math.sin(y * 0.9) + 0.4 * n[y * size + x];
  const normalMap = toTexture(size, normalFromHeight(h, size, 1.6), false);
  normalMap.repeat.set(10, 10);
  return new THREE.MeshPhysicalMaterial({color, roughness: 0.82, sheen: 0.6, sheenRoughness: 0.55, sheenColor: new THREE.Color('#fff4e2'), normalMap, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.5});
}
export const skinMaterial = () => new THREE.MeshPhysicalMaterial({color: '#DCCBB2', roughness: 0.55, sheen: 0.25, sheenColor: new THREE.Color('#ffe9cf'), clearcoat: 0.05, envMapIntensity: 0.55});
export const metalMaterial = (color = '#5b5f66') => new THREE.MeshStandardMaterial({color, metalness: 0.9, roughness: 0.38, envMapIntensity: 1.0});
