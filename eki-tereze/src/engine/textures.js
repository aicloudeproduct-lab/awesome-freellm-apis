// Procedural textures painted on canvases (seeded, cached): wood, paper,
// plaster, fabric weave/knit normals, skin, dirt, brick, and drawings.
import * as THREE from 'three';
import {fbm2, noise2, rng, clamp} from '../lib/util.js';

const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, {srgb = true, repeat = [1, 1], aniso = 8} = {}) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
};
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Fill a canvas per-pixel: fn(u, v) → [r, g, b]. */
const paint = (w, h, fn) => {
  const c = canvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, gg, b] = fn(x / w, y / h, x, y); const i = (y * w + x) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return c;
};

/** Height field → tangent-space normal map. */
const normalFrom = (w, h, height, strength = 2) => {
  const H = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = height(x / w, y / h, x, y);
  return paint(w, h, (u, v, x, y) => {
    const xl = H[y * w + ((x - 1 + w) % w)], xr = H[y * w + ((x + 1) % w)];
    const yu = H[((y - 1 + h) % h) * w + x], yd = H[((y + 1) % h) * w + x];
    let nx = (xl - xr) * strength, ny = (yu - yd) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    return [(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, (nz * 0.5 + 0.5) * 255];
  });
};

export const wood = (seed = 'oak', base = '#8a6240', dark = '#5b3d25', repeat = [1, 1]) => memo(`wood:${seed}:${base}`, () => {
  const n = fbm2(seed, 4), m = noise2(seed + 'm');
  const A = hexRgb(base), B = hexRgb(dark);
  const c = paint(512, 512, (u, v) => {
    const warp = n(u * 3, v * 0.6) * 0.9;
    const ring = 0.5 + 0.5 * Math.sin((u * 26 + warp * 6) * Math.PI);
    const fine = 0.5 + 0.5 * Math.sin((u * 190 + n(u * 8, v * 3) * 9) * Math.PI);
    const k = clamp(ring * 0.6 + fine * 0.25 + m(u * 6, v * 40) * 0.15);
    return A.map((a, i) => a + (B[i] - a) * k);
  });
  return tex(c, {repeat});
});

export const woodNormal = (seed = 'oak', repeat = [1, 1]) => memo(`woodN:${seed}`, () => {
  const n = fbm2(seed, 3);
  return tex(normalFrom(256, 256, (u, v) => 0.5 + 0.5 * Math.sin((u * 190 + n(u * 8, v * 3) * 9) * Math.PI) * 0.3 + n(u * 20, v * 2) * 0.2, 1.4), {srgb: false, repeat});
});

export const plaster = (seed = 'wall', base = '#d9cfc0', var_ = 10, repeat = [2, 2]) => memo(`plaster:${seed}:${base}`, () => {
  const n = fbm2(seed, 5), A = hexRgb(base);
  return tex(paint(512, 512, (u, v) => { const k = n(u * 6, v * 6) * var_ + n(u * 40, v * 40) * var_ * 0.4; return A.map((a) => a + k); }), {repeat});
});
export const plasterNormal = (seed = 'wall', repeat = [2, 2]) => memo(`plasterN:${seed}`, () => {
  const n = fbm2(seed + 'n', 4);
  return tex(normalFrom(256, 256, (u, v) => n(u * 18, v * 18), 3), {srgb: false, repeat});
});

/** Woven cloth normal map (shirts, curtains, scarf). */
export const weaveNormal = (density = 64, repeat = [1, 1]) => memo(`weave:${density}`, () => tex(normalFrom(256, 256, (u, v) => {
  const a = Math.sin(u * density * Math.PI * 2) * 0.5 + 0.5, b = Math.sin(v * density * Math.PI * 2) * 0.5 + 0.5;
  const over = (Math.floor(u * density) + Math.floor(v * density)) % 2;
  return over ? a * 0.8 + b * 0.2 : b * 0.8 + a * 0.2;
}, 1.2), {srgb: false, repeat}));

/** Knitted jersey (sweaters). */
export const knitNormal = (repeat = [6, 8]) => memo('knit', () => tex(normalFrom(256, 256, (u, v) => {
  const col = (u * 16) % 1, row = (v * 24) % 1;
  const vshape = Math.abs(col - 0.5) * 2;
  return Math.sin((row + vshape * 0.5) * Math.PI * 2) * 0.5 + 0.5 - vshape * 0.3;
}, 2.2), {srgb: false, repeat}));

/** Subtle skin: mottling map + pore normal. */
export const skinMap = (base, seed = 'skin') => memo(`skin:${base}:${seed}`, () => {
  const n = fbm2(seed, 4), A = hexRgb(base);
  return tex(paint(256, 256, (u, v) => { const k = n(u * 8, v * 8); return [A[0] + k * 9 + 2, A[1] + k * 6, A[2] + k * 5]; }), {repeat: [1, 1]});
});
export const poreNormal = () => memo('pores', () => {
  const n = noise2('pore');
  return tex(normalFrom(256, 256, (u, v) => n(u * 90, v * 90) * 0.5 + n(u * 30, v * 30) * 0.3, 0.9), {srgb: false, repeat: [3, 3]});
});
export const hairNormal = () => memo('hairN', () => {
  const n = noise2('hairstrand');
  return tex(normalFrom(256, 256, (u, v) => n(u * 120, v * 6) * 0.7 + n(u * 260, v * 12) * 0.3, 2.5), {srgb: false, repeat: [4, 2]});
});

export const dirt = (seed = 'yard', repeat = [6, 6]) => memo(`dirt:${seed}`, () => {
  const n = fbm2(seed, 5), m = noise2(seed + 'p');
  return tex(paint(512, 512, (u, v) => {
    const k = n(u * 5, v * 5), p = m(u * 80, v * 80);
    return [150 + k * 30 + p * 10, 118 + k * 26 + p * 8, 84 + k * 20 + p * 6];
  }), {repeat});
});
export const dirtNormal = (repeat = [6, 6]) => memo('dirtN', () => {
  const n = fbm2('dirtN', 4), m = noise2('pebble');
  return tex(normalFrom(256, 256, (u, v) => n(u * 10, v * 10) * 0.6 + Math.max(0, m(u * 50, v * 50)) * 0.8, 4), {srgb: false, repeat});
});

export const brick = (repeat = [3, 3]) => memo('brick', () => {
  const n = noise2('brick'), r = rng('brickc');
  const tones = Array.from({length: 400}, () => r() * 0.25 - 0.12);
  return tex(paint(512, 512, (u, v) => {
    const row = Math.floor(v * 16), off = row % 2 ? 0.5 : 0, cx = (u * 8 + off) % 1, cy = (v * 16) % 1;
    const id = row * 9 + Math.floor(u * 8 + off);
    if (cx < 0.04 || cy < 0.08) return [190, 182, 170];
    const t = tones[id % 400] + n(u * 60, v * 60) * 0.05;
    return [176 * (1 + t), 112 * (1 + t), 86 * (1 + t)];
  }), {repeat});
});

export const asphalt = (repeat = [8, 8]) => memo('asphalt', () => {
  const n = noise2('asph'), f = fbm2('asphf', 3);
  return tex(paint(256, 256, (u, v) => { const k = n(u * 120, v * 120) * 14 + f(u * 4, v * 4) * 10; return [62 + k, 63 + k, 66 + k]; }), {repeat});
});

/** Paper sheet with an architectural drawing (lines, grid, title block). */
export const blueprint = (seed = 'plan', w = 1024, h = 724, density = 1) => memo(`plan:${seed}:${density}`, () => {
  const c = canvas(w, h), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = '#f2ede2'; g.fillRect(0, 0, w, h);
  const n = noise2(seed + 'pp');
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) { const x = (i / 4) % w, y = Math.floor(i / 4 / w); const k = n(x * 0.05, y * 0.05) * 6; img.data[i] += k; img.data[i + 1] += k; img.data[i + 2] += k; }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(80,90,110,0.12)'; g.lineWidth = 1;
  for (let x = 0; x < w; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = 'rgba(30,34,44,0.85)'; g.lineWidth = 2.2;
  g.strokeRect(40, 40, w - 80, h - 80);
  const lines = Math.round(40 * density);
  // plan: rooms as rectangles, doors as arcs, dimension lines
  for (let i = 0; i < lines; i++) {
    const x = 80 + r() * (w - 260), y = 80 + r() * (h - 200), ww = 60 + r() * 220, hh = 40 + r() * 160;
    g.lineWidth = r() < 0.3 ? 3 : 1.4;
    g.strokeRect(x, y, Math.min(ww, w - 120 - x), Math.min(hh, h - 120 - y));
    if (r() < 0.4) { g.beginPath(); g.arc(x, y + 20, 18, 0, Math.PI / 2); g.stroke(); }
  }
  g.lineWidth = 1; g.strokeStyle = 'rgba(40,60,110,0.7)';
  for (let i = 0; i < 10; i++) { const y = 60 + r() * (h - 120); g.beginPath(); g.moveTo(60, y); g.lineTo(w - 60, y); g.stroke(); }
  g.fillStyle = 'rgba(30,34,44,0.9)'; g.fillRect(w - 240, h - 110, 190, 60);
  g.fillStyle = '#f2ede2'; g.font = '20px sans-serif'; g.fillText('ЖОБА · ' + seed.toUpperCase().slice(0, 8), w - 228, h - 74);
  return tex(c, {repeat: [1, 1]});
});

export const plainPaper = (tone = '#f3efe6') => memo(`paper:${tone}`, () => {
  const n = noise2('paperfib'), A = hexRgb(tone);
  return tex(paint(256, 256, (u, v) => { const k = n(u * 60, v * 60) * 4 + n(u * 200, v * 15) * 2; return A.map((a) => a + k); }));
});

/** The son's crayon drawing: a small house with two lit windows and a family holding hands. */
export const childDrawing = (progress = 1) => {
  const key = `child:${Math.round(progress * 20)}`;
  return memo(key, () => {
    const w = 1024, h = 724, c = canvas(w, h), g = c.getContext('2d'), r = rng('crayon');
    g.drawImage(plainPaper('#f6f1e4').image, 0, 0, w, h);
    const crayon = (color, width, pts, close = false, fill = null) => {
      for (let pass = 0; pass < 3; pass++) {
        g.strokeStyle = color; g.globalAlpha = 0.55; g.lineWidth = width * (0.8 + r() * 0.4); g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath();
        pts.forEach(([x, y], i) => { const jx = (r() - 0.5) * 4, jy = (r() - 0.5) * 4; i ? g.lineTo(x + jx, y + jy) : g.moveTo(x + jx, y + jy); });
        if (close) g.closePath();
        if (fill && pass === 0) { g.fillStyle = fill; g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 0.55; }
        g.stroke();
      }
      g.globalAlpha = 1;
    };
    const P = progress;
    // sun
    if (P > 0.05) { crayon('#f2b632', 10, Array.from({length: 25}, (_, i) => [880 + Math.cos(i / 24 * 6.3) * 55, 120 + Math.sin(i / 24 * 6.3) * 55]), true, '#f6cf52'); }
    // ground
    crayon('#5f9a46', 14, [[60, 600], [300, 590], [600, 604], [960, 592]]);
    // house
    crayon('#c0563d', 9, [[330, 300], [520, 170], [710, 300]], false);
    crayon('#7a5236', 8, [[350, 300], [350, 560], [690, 560], [690, 300], [350, 300]], true, '#f0d9a8');
    // two windows, warm
    crayon('#3d6fb5', 6, [[390, 340], [470, 340], [470, 410], [390, 410]], true, '#ffd36a');
    crayon('#3d6fb5', 6, [[570, 340], [650, 340], [650, 410], [570, 410]], true, '#ffd36a');
    crayon('#7a5236', 6, [[490, 560], [490, 450], [550, 450], [550, 560]], false);
    // family: father, mother (scarf), child holding hands
    const person = (x, s, color, scarf = false) => {
      crayon('#3a2a20', 6, Array.from({length: 17}, (_, i) => [x + Math.cos(i / 16 * 6.3) * 18 * s, 470 - 95 * s + Math.sin(i / 16 * 6.3) * 18 * s]), true, '#f2c9a0');
      if (scarf) crayon('#d77f9a', 7, [[x - 22 * s, 470 - 100 * s], [x, 470 - 122 * s], [x + 22 * s, 470 - 100 * s]]);
      crayon(color, 9, [[x, 470 - 76 * s], [x, 470 - 20 * s]]);
      crayon(color, 7, [[x, 470 - 20 * s], [x - 14 * s, 480], [x, 470 - 20 * s], [x + 14 * s, 480]]);
      return [x, 470 - 60 * s];
    };
    if (P > 0.4) {
      const f = person(160, 1.15, '#3b4f7a'), m = person(250, 1.05, '#9b5a8a', true), k = person(320, 0.75, '#e07a3a');
      crayon('#3a2a20', 5, [[f[0], f[1]], [m[0], m[1]]]);
      crayon('#3a2a20', 5, [[m[0], m[1]], [k[0], k[1] + 10]]);
    }
    return tex(c);
  });
};

export const clearCache = () => cache.clear();
