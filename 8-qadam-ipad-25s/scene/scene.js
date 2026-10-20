'use strict';
/* «Өміріңді өзгертетін 8 қадам» — iPad 4:3 (2048×1536), 25 с, 30 fps.
   renderFrame(t) кез келген уақыт сәтін тәуелсіз салады: кадрларды кез келген ретпен рендерлеуге болады. */

const W = 2048, H = 1536, FPS = 30, DUR = 25;
const COL = { black: '#101010', cream: '#F1EDE3', lime: '#D6FF27', violet: '#7451FF', orange: '#FF542E' };
const RGB = { black: [16, 16, 16], cream: [241, 237, 227], lime: [214, 255, 39], violet: [116, 81, 255], orange: [255, 84, 46] };
const FD = '"Inter Display","Inter",sans-serif', FT = '"Inter",sans-serif';
const TAU = Math.PI * 2;
const MX = 143, MY = 108;            // 7% қауіпсіз шет
const VX = 1500, VY = 768;           // қадам визуалының орталығы
const PPU = 340;                     // металл: 1 бірлік = 340 px

/* ---------- helpers ---------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
const range = (t, a, b) => clamp((t - a) / (b - a));
const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo = t => 1 - Math.pow(1 - t, 3);
const eo5 = t => 1 - Math.pow(1 - t, 5);
const ei = t => t * t * t;
const ss = t => t * t * (3 - 2 * t);
const back = t => { const c = 1.6; return t <= 0 ? 0 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`;
const mixc = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
function bez(p0, p1, p2, p3, s) {
  const m = 1 - s;
  return [m * m * m * p0[0] + 3 * m * m * s * p1[0] + 3 * m * s * s * p2[0] + s * s * s * p3[0],
          m * m * m * p0[1] + 3 * m * m * s * p1[1] + 3 * m * s * s * p2[1] + s * s * s * p3[1]];
}
function halo(g, x, y, r, c, a) {
  if (a <= 0.002) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(c, a)); gr.addColorStop(0.45, rgba(c, a * 0.4)); gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function line(g, a, b) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
function partial(g, a, b, p) { if (p > 0) line(g, a, lerp2(a, b, p)); }
function check(g, x, y, s, p, color, w) {
  if (p <= 0) return;
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  const a = [x - 0.45 * s, y], b = [x - 0.12 * s, y + 0.32 * s], c = [x + 0.5 * s, y - 0.36 * s];
  g.beginPath(); g.moveTo(a[0], a[1]);
  if (p < 0.4) { const q = lerp2(a, b, p / 0.4); g.lineTo(q[0], q[1]); } else { g.lineTo(b[0], b[1]); const q = lerp2(b, c, (p - 0.4) / 0.6); g.lineTo(q[0], q[1]); }
  g.stroke();
}

const cv = document.getElementById('c'), g = cv.getContext('2d');

/* ---------- typography ---------- */
const BLOCKS = {};
function defBlock(id, o) { BLOCKS[id] = o; }
function setFont(size, weight) {
  g.font = `${weight} ${size}px ${weight >= 700 ? FD : FT}`;
  g.letterSpacing = weight >= 700 ? `${(-0.012 * size).toFixed(2)}px` : '0px';
}
function lineWidth(L, size) { setFont(size, L.w); return (L.parts || [{ t: L.t }]).reduce((s, p) => s + g.measureText(p.t).width, 0); }
function layoutBlocks() {
  Object.values(BLOCKS).forEach(B => {
    B.lines.forEach(L => {
      L.size0 = L.size0 || L.size;
      let w = lineWidth(L, L.size0);
      L.size = w > B.maxW ? L.size0 * B.maxW / w : L.size0;
      L.width = lineWidth(L, L.size);
    });
    let y = 0;
    B.lines.forEach((L, i) => { if (i) y += 0.27 * B.lines[i - 1].size; y += 0.73 * L.size; L.rel = y; });
    const top = B.yc - (y + 0.04 * B.lines[B.lines.length - 1].size) / 2;
    B.top = top;
    B.lines.forEach(L => { L.base = top + L.rel; });
    B.bottom = top + y;
  });
}
function resolveColor(c, fg) { return c === 'fg' ? fg : COL[c]; }
function drawBlock(id, t, fg) {
  const B = BLOCKS[id];
  const tin = B.tin, tout = B.tout;
  if (t < tin - 0.02) return;
  if (B.label) {
    const pin = eo5(range(t, tin - 0.06, tin + 0.4)), pout = ei(range(t, tout - 0.04, tout + 0.2));
    if (pin > 0 && pout < 1) {
      g.save(); g.globalAlpha = pin * (1 - pout);
      setFont(34, 500); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      const y = B.top - 62 + (1 - pin) * 16 - pout * 16;
      g.fillStyle = COL[B.accent]; g.fillText(B.label, B.x, y);
      const w = g.measureText(B.label).width;
      g.fillStyle = fg; g.globalAlpha *= 0.45; g.fillText('  /  08', B.x + w, y);
      g.restore();
    }
  }
  B.lines.forEach((L, i) => {
    const a = tin + i * 0.075, pin = eo5(range(t, a, a + 0.5));
    const o = tout + i * 0.035, pout = ei(range(t, o, o + 0.24));
    if (pin <= 0 || pout >= 1) return;
    const top = L.base - L.size * 0.98, hgt = L.size * 1.26;
    const x0 = B.align === 'center' ? B.x - L.width / 2 : B.x;
    g.save();
    g.beginPath(); g.rect(x0 - 200, top, L.width + 400, hgt); g.clip();
    g.translate(0, (1 - pin) * hgt * 1.02 - pout * hgt * 1.02);
    if (L.punch) {
      const s = lerp(1.1, 1, eo(range(t, a, a + 0.65)));
      const px = B.align === 'center' ? B.x : x0;
      g.translate(px, L.base); g.scale(s, s); g.translate(-px, -L.base);
    }
    setFont(L.size, L.w); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    let x = x0;
    (L.parts || [{ t: L.t, c: L.c }]).forEach(p => { g.fillStyle = resolveColor(p.c, fg); g.fillText(p.t, x, L.base); x += g.measureText(p.t).width; });
    g.restore();
  });
}

/* ---------- timeline ---------- */
const S = k => 3 + 2 * k;   // k-қадамның басталуы
const STEP_TEXT = [
  { lines: [{ t: 'ӨЗІҢДІ', c: 'lime', k: 1 }, { t: 'ТАНЫ', c: 'fg', k: 1 }], accent: 'lime' },
  { lines: [{ t: 'НАҚТЫ', c: 'fg' }, { t: 'МАҚСАТ', c: 'orange', k: 1 }, { t: 'ҚОЙ', c: 'fg', k: 1 }], accent: 'orange' },
  { lines: [{ t: 'КІШКЕНТАЙ', c: 'fg' }, { t: 'ӘДЕТТЕН', c: 'lime', k: 1 }, { t: 'БАСТА', c: 'fg' }], accent: 'lime' },
  { lines: [{ t: 'НАЗАРЫҢДЫ', c: 'violet', k: 1 }, { t: 'БАСҚАР', c: 'fg' }], accent: 'violet' },
  { lines: [{ t: 'ДЕМАЛ. ҚОЗҒАЛ.', c: 'fg' }, { t: 'ҰЙҚЫҢДЫ', c: 'violet', k: 1 }, { t: 'КҮТ', c: 'fg', k: 1 }], accent: 'violet' },
  { lines: [{ t: 'ҮЗДІКСІЗ', c: 'fg', k: 1 }, { t: 'ҮЙРЕН', c: 'orange', k: 1 }], accent: 'orange' },
  { lines: [{ t: 'ҚОЛДАЙТЫН', c: 'fg' }, { t: 'ОРТА', c: 'lime', k: 1 }, { t: 'ҚҰР', c: 'fg', k: 1 }], accent: 'lime' },
  { lines: [{ t: 'ӘРЕКЕТ ЕТ.', c: 'violet', k: 1 }, { t: 'НӘТИЖЕНІ', c: 'fg' }, { t: 'БАҒАЛА', c: 'fg' }], accent: 'violet' },
];
function setupText() {
  defBlock('intro', { x: MX, yc: 768, maxW: 1000, align: 'left', tin: 1.45, tout: 2.62, lines: [
    { t: 'ӨМІРІҢДІ', size: 128, w: 900, c: 'fg' }, { t: 'ӨЗГЕРТЕТІН', size: 128, w: 900, c: 'fg' }, { t: '8 ҚАДАМ', size: 250, w: 900, c: 'lime', punch: 1 }] });
  STEP_TEXT.forEach((s, k) => defBlock('s' + k, {
    x: MX, yc: 790, maxW: 860, align: 'left', tin: S(k) + 0.06, tout: S(k) + 1.6, label: String(k + 1).padStart(2, '0'), accent: s.accent,
    lines: s.lines.map(l => ({ t: l.t, size: l.k ? 215 : 118, w: l.k ? 900 : 700, c: l.c, punch: l.k })),
  }));
  defBlock('unify', { x: 1024, yc: 1030, maxW: 1762, align: 'center', tin: 19.55, tout: 21.48, lines: [
    { t: 'ҮЛКЕН ӨЗГЕРІС —', size: 150, w: 900, c: 'fg' }, { t: 'ШАҒЫН ӘРЕКЕТТЕН', size: 178, w: 900, c: 'lime', punch: 1 }] });
  defBlock('final', { x: 1024, yc: 700, maxW: 1762, align: 'center', tin: 22.15, tout: 99, lines: [
    { t: 'БҮГІН', size: 310, w: 900, c: 'fg', punch: 1 },
    { t: 'БІР ҚАДАМ ЖАСА', size: 205, w: 900, parts: [{ t: 'БІР ', c: 'fg' }, { t: 'ҚАДАМ', c: 'violet' }, { t: ' ЖАСА', c: 'fg' }] }] });
  layoutBlocks();
}

/* ---------- background ---------- */
function gridOffset(t) { if (t < 22) return 9 * t; const s = Math.min(t - 22, 0.8); return 9 * 22 + 9 * (s - s * s / 1.6); }
function background(color, t) {
  g.fillStyle = COL[color]; g.fillRect(0, 0, W, H);
  const dark = color === 'black';
  const o = gridOffset(t) % 64;
  g.fillStyle = dark ? 'rgba(241,237,227,0.075)' : 'rgba(16,16,16,0.085)';
  const a = t < 0.8 ? ss(range(t, 0.1, 0.8)) : 1;
  if (a <= 0) return;
  g.save(); g.globalAlpha = a;
  for (let x = -64 + o; x < W + 64; x += 64) for (let y = 32; y < H; y += 64) g.fillRect(x - 2, y - 2, 4, 4);
  g.restore();
}
function withCam(u, push, fn, cx = VX, cy = VY) {
  g.save();
  const s = 1 + push * clamp(u / 2, 0, 1.2);
  g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy);
  fn(); g.restore();
}

/* ---------- INTRO: нүкте → 8 элемент → алып «8» ---------- */
const EIGHT = [{ cx: 0, cy: -310, r: 250 }, { cx: 0, cy: 280, r: 280 }];
const SEG_GAP = 0.1, SEG_W = 92;
function segDef(k) { const L = EIGHT[k < 4 ? 0 : 1], j = k % 4; return { L, a0: (k < 4 ? Math.PI / 2 : -Math.PI / 2) + j * Math.PI / 2 + SEG_GAP / 2, sw: Math.PI / 2 - SEG_GAP }; }
function segPoint(k, f) { const d = segDef(k), a = d.a0 + d.sw * f; return [d.L.cx + d.L.r * Math.cos(a), d.L.cy + d.L.r * Math.sin(a)]; }
function introXf(t) { const m = eio(range(t, 1.1, 1.55)); return { c: lerp2([1024, 768], [VX, VY], m), s: lerp(1, 0.62, m) }; }
const FINAL8 = { c: [VX, VY], s: 0.62 };
const DOT_PATH = [[640, 1010], [760, 640], [930, 700], [1024, 768]];
function burstPos(k, t) { const a = -Math.PI / 2 + k * Math.PI / 4, e = eo(range(t, 0.58, 0.8)); return [1024 + Math.cos(a) * 170 * e, 768 + Math.sin(a) * 170 * e]; }

function drawIntro(t) {
  drawIntroShape(t);
  drawBlock('intro', t, COL.cream);
}
function drawIntroShape(t) {
  if (t < 0.58) {
    const f = eio(range(t, 0.14, 0.58)), r = 16 * back(range(t, 0, 0.22));
    for (let j = 10; j >= 1; j--) { const q = f - j * 0.022; if (q <= 0 || f >= 1) continue; const p = bez(...DOT_PATH, q); g.fillStyle = rgba(RGB.lime, 0.5 * (1 - j / 11)); circle(g, p[0], p[1], r * (1 - j / 13)); g.fill(); }
    const p = bez(...DOT_PATH, f);
    halo(g, p[0], p[1], 150, RGB.lime, 0.45 * range(t, 0, 0.2));
    g.fillStyle = COL.lime; circle(g, p[0], p[1], r); g.fill();
    return;
  }
  if (t >= 2.8) return;
  const xf = introXf(t);
  const hk = range(t, 0.98, 1.4), sp = 1 + 0.05 * Math.sin(hk * Math.PI) * (1 - hk);
  if (t > 0.98 && t < 1.7) { const rp = range(t, 0.98, 1.7); g.strokeStyle = rgba(RGB.lime, 0.5 * (1 - rp)); g.lineWidth = 4; circle(g, 1024, 768, 260 + 900 * eo(rp)); g.stroke(); }
  halo(g, xf.c[0], xf.c[1], 700 * xf.s, RGB.lime, 0.12 * range(t, 0.7, 1.0));
  g.save(); g.translate(xf.c[0], xf.c[1]); g.scale(xf.s * sp, xf.s * sp);
  g.lineCap = 'round'; g.strokeStyle = COL.lime;
  for (let k = 0; k < 8; k++) {
    const d = segDef(k), e = eio(range(t, 0.72 + k * 0.015, 1.0));
    const st = segPoint(k, 0), bp = burstPos(k, t), bpl = [bp[0] - 1024, bp[1] - 768];
    const off = [(1 - e) * (bpl[0] - st[0]), (1 - e) * (bpl[1] - st[1])];
    g.save(); g.translate(off[0], off[1]);
    g.lineWidth = lerp(32, SEG_W, e);
    g.beginPath(); g.arc(d.L.cx, d.L.cy, d.L.r, d.a0, d.a0 + Math.max(0.001, d.sw * e)); g.stroke();
    g.restore();
  }
  g.restore();
}

/* ---------- S1: бөлшектер → компас ---------- */
const NP = 96;
function compassTarget(i) {
  if (i < 60) { const a = -Math.PI / 2 + i * TAU / 60, major = i % 15 === 0; return { p: [VX + Math.cos(a) * 360, VY + Math.sin(a) * 360], r: major ? 12 : 5.5, major }; }
  const a = -Math.PI / 2 + (i - 60) * TAU / 36; return { p: [VX + Math.cos(a) * 250, VY + Math.sin(a) * 250], r: 3.6, major: false };
}
function particleStart(i) { const k = Math.floor(i / 12), j = i % 12, p = segPoint(k, (j + 0.5) / 12); return [FINAL8.c[0] + p[0] * FINAL8.s, FINAL8.c[1] + p[1] * FINAL8.s]; }
const COMPASS_TGT = -Math.PI / 4;
function drawS1(t) {
  const u = t - 3;
  withCam(u, 0.03, () => {
    const ra = eo(range(u, 0.4, 0.8));
    if (ra > 0) { g.strokeStyle = rgba(RGB.cream, 0.2 * ra); g.lineWidth = 2; circle(g, VX, VY, 360); g.stroke(); circle(g, VX, VY, 250); g.stroke(); }
    for (let i = 0; i < NP; i++) {
      const k = Math.floor(i / 12), j = i % 12, d = k * 0.02 + j * 0.005;
      const f = eio(range(t, 2.8 + d, 3.38 + d));
      const s0 = particleStart(i), T = compassTarget(i);
      const out = [(T.p[0] - VX) / 360, (T.p[1] - VY) / 360];
      const p = bez(s0, [s0[0] + (s0[1] - VY) * 0.6, s0[1] - (s0[0] - VX) * 0.6], [T.p[0] + out[0] * 170, T.p[1] + out[1] * 170], T.p, f);
      const r = lerp(SEG_W * FINAL8.s / 2, T.r, eo(f));
      const c = T.major ? RGB.lime : mixc(RGB.lime, RGB.cream, range(f, 0.75, 1));
      g.fillStyle = rgba(c, T.major ? 1 : lerp(1, i < 60 ? 0.85 : 0.5, range(f, 0.75, 1)));
      circle(g, p[0], p[1], r); g.fill();
    }
    const gn = eo(range(u, 0.5, 0.8)), uu = Math.max(0, u - 0.5);
    if (gn > 0) {
      const th = COMPASS_TGT + 1.7 * Math.exp(-3 * uu) * Math.cos(7.5 * uu);
      g.save(); g.translate(VX, VY); g.rotate(th);
      g.fillStyle = rgba(RGB.cream, 0.6); g.beginPath(); g.moveTo(-170 * gn, 0); g.lineTo(0, -24); g.lineTo(0, 24); g.closePath(); g.fill();
      g.fillStyle = COL.lime; g.beginPath(); g.moveTo(300 * gn, 0); g.lineTo(0, -26); g.lineTo(0, 26); g.closePath(); g.fill();
      g.restore();
      Metal.draw(g, { balls: [[0, 0, 0, 0.11 * back(range(u, 0.5, 0.8))]], tintA: [0.84, 1, 0.15], tintB: [0.5, 0.5, 0.55], bgLight: 0.35 }, VX, VY, PPU);
    }
    const mk = back(range(u, 1.1, 1.4));
    if (mk > 0) {
      const a = COMPASS_TGT, p = [VX + Math.cos(a) * 412, VY + Math.sin(a) * 412];
      g.save(); g.translate(p[0], p[1]); g.rotate(a + Math.PI); g.scale(mk, mk);
      g.fillStyle = COL.lime; g.beginPath(); g.moveTo(-6, 0); g.lineTo(-34, -18); g.lineTo(-34, 18); g.closePath(); g.fill(); g.restore();
    }
  });
  if (t > 4.74) { const rw = 1730 * Math.sqrt(eio(range(t, 4.74, 5.22))); g.strokeStyle = COL.lime; g.lineWidth = 14; circle(g, VX, VY, rw); g.stroke(); }
  drawBlock('s0', t, COL.cream);
}

/* ---------- S2: нысана ---------- */
const DOT2 = [[2160, 150], [1900, 110], [1640, 430], [VX, VY]];
function drawS2(t) {
  const u = t - 5;
  const land = range(u, 0.95, 1.3), pun = 1 + 0.035 * Math.sin(land * Math.PI) * (1 - land);
  withCam(u, 0.03, () => {
    g.save(); g.translate(VX, VY); g.scale(pun, pun); g.translate(-VX, -VY);
    const R = [360, 270, 180, 90], LW = [5, 16, 5, 16], R0 = [360, 360, 250, 250];
    R.forEach((r, i) => {
      const p = eo(range(u, -0.2 + i * 0.07, 0.32 + i * 0.07)); if (p <= 0) return;
      g.strokeStyle = rgba(RGB.black, p); g.lineWidth = LW[i]; circle(g, VX, VY, lerp(R0[i], r, p)); g.stroke();
    });
    const tk = eo(range(u, 0.1, 0.4));
    g.strokeStyle = COL.black; g.lineWidth = 5; g.lineCap = 'butt';
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => partial(g, [VX + dx * 384, VY + dy * 384], [VX + dx * 420, VY + dy * 420], tk));
    g.restore();
    const f = range(u, 0.15, 0.95), fe = f * f * (3 - 2 * f) * 0.35 + ei(f) * 0.65;
    if (f > 0 && f < 1) {
      for (let j = 12; j >= 0; j--) { const q = fe - j * 0.018; if (q <= 0) continue; const p = bez(...DOT2, q); g.fillStyle = rgba(RGB.orange, j ? 0.55 * (1 - j / 13) : 1); circle(g, p[0], p[1], 34 * (1 - j / 16)); g.fill(); }
    }
    if (u >= 0.95) {
      const rp = range(u, 0.95, 1.7);
      g.strokeStyle = rgba(RGB.orange, 0.75 * (1 - rp)); g.lineWidth = 7; circle(g, VX, VY, 40 + 420 * eo(rp)); g.stroke();
      g.fillStyle = COL.orange; circle(g, VX, VY, 36 * back(range(u, 0.95, 1.15))); g.fill();
    }
  });
  drawBlock('s1', t, COL.black);
}

/* ---------- S3: тор, күнделікті ұяшықтар ---------- */
const CELL = 92, CG = 22, GX0 = VX - (7 * CELL + 6 * CG) / 2, GY0 = VY - (5 * CELL + 4 * CG) / 2;
const cellC = i => [GX0 + (i % 7) * (CELL + CG) + CELL / 2, GY0 + Math.floor(i / 7) * (CELL + CG) + CELL / 2];
const HERO = 17;
const HASH = (() => { const r = rng(42); return Array.from({ length: 64 }, r); })();
const WEEK = ['ДС', 'СС', 'СР', 'БС', 'ЖМ', 'СБ', 'ЖС'];
function flowPos(i, t) {
  const c = cellC(i); if (i === HERO) return c;
  const col = i % 7, row = Math.floor(i / 7);
  const s0 = 8.72 + (6 - col) * 0.075 + HASH[i] * 0.06, p = range(t, s0, s0 + 0.9);
  const e = 0.35 * p * p + 0.65 * ei(p);
  const dy = (row === 2 ? (col < 3 ? -58 : 58) * eo(range(t, 8.7, 9.0)) : 0) + (row - 2) * 70 * e;
  return [c[0] + 1300 * e, c[1] + dy];
}
function drawS3(t) {
  const u = t - 7;
  withCam(u, 0.025, () => {
    const la = eo(range(u, 0.25, 0.5)) * (1 - range(u, 1.55, 1.75));
    if (la > 0) { setFont(28, 500); g.textAlign = 'center'; g.fillStyle = rgba(RGB.cream, 0.5 * la); WEEK.forEach((d, i) => g.fillText(d, cellC(i)[0], GY0 - 26)); }
    if (u < 0.05) { g.fillStyle = COL.lime; circle(g, VX, VY, 13 * back(range(u, -0.12, 0.05))); g.fill(); return; }
    for (let i = 0; i < 35; i++) {
      const c = cellC(i), dist = Math.hypot(c[0] - VX, c[1] - VY);
      const f = eo(range(u, 0.02 + dist * 0.0006, 0.36 + dist * 0.0006));
      const L = 0.42 + i * 0.032, lit = eo(range(u, L, L + 0.1));
      const q = eio(range(u, 1.6, 1.78));
      let p = lerp2([VX, VY], c, f);
      if (u >= 1.72) p = flowPos(i, t);
      let sz = lerp(26, CELL, eo(range(f, 0.4, 1)));
      sz = lerp(sz, 22, q);
      const pop = 1 + 0.14 * Math.sin(Math.PI * lit) * (lit < 1 ? 1 : 0);
      const s = sz * pop, rad = lerp(lerp(13, 20, range(f, 0.4, 1)), 11, q);
      if (p[0] - s > W) continue;
      if (sz < 50) { g.fillStyle = COL.lime; rr(g, p[0] - s / 2, p[1] - s / 2, s, s, rad); g.fill(); continue; }
      if (lit > 0) { g.fillStyle = rgba(RGB.lime, lit); rr(g, p[0] - s / 2, p[1] - s / 2, s, s, rad); g.fill(); }
      g.strokeStyle = COL.lime; g.lineWidth = 3; rr(g, p[0] - s / 2 + 1.5, p[1] - s / 2 + 1.5, s - 3, s - 3, rad); g.stroke();
      if (lit > 0.3) check(g, p[0], p[1], 34, range(lit, 0.3, 1), COL.black, 6);
    }
  });
  drawBlock('s2', t, COL.cream);
}

/* ---------- S4: назар — бір объект қалады ---------- */
const EXTRA = (() => { const r = rng(4); return Array.from({ length: 18 }, (_, j) => { let y = 500 + j * 31; if (Math.abs(y - VY) < 45) y += 90; return { y, s: 9.0 + r() * 0.4, r: 6 + r() * 4, d: 0.8 + r() * 0.35 }; }); })();
const SAT = [[1.45, 0.55, 0.62], [1.3, -0.62, 0.7], [-1.15, 0.42, 0.78]];
function heroMetal(t, sunMix, onCream) {
  const u = t - 9, grow = eo(range(u, 0.5, 1.1));
  const balls = [[0, 0, 0, lerp(0.035, 0.56, grow)]];
  SAT.forEach(([x, y, d]) => { const f = ei(range(u, 0.4 + d * 0.3, 0.95 + d * 0.3)); if (f < 1) balls.push([x * (1 - f), y * (1 - f), 0, lerp(0.15, 0.09, f) * eo(range(u, 0.35, 0.6))]); });
  const tintA = mixc([116, 81, 255], [255, 92, 50], sunMix).map(v => v / 255 * (1 + 0.4 * sunMix));
  const tintB = onCream ? [0.85, 0.82, 0.76] : mixc([150, 150, 170], [255, 160, 80], sunMix).map(v => v / 255 * 0.7);
  return { balls, k: 0.42, tintA, tintB, bgLight: onCream ? 1.0 : 0.3 };
}
const bob = t => 5 * Math.sin(t * 2.2);
function drawS4(t) {
  const u = t - 9;
  withCam(u, 0.025, () => {
    for (let i = 0; i < 35; i++) { if (i === HERO) continue; const p = flowPos(i, t); if (p[0] > W + 20) continue; g.fillStyle = COL.black; circle(g, p[0], p[1], 11); g.fill(); }
    EXTRA.forEach(e => {
      const p = range(t, e.s, e.s + e.d); if (p <= 0 || p >= 1) return;
      const x = 1080 + 1100 * (0.4 * p + 0.6 * p * p);
      g.fillStyle = rgba(RGB.black, 0.85 * range(x, 1080, 1180)); circle(g, x, e.y, e.r); g.fill();
    });
    const grow = eo(range(u, 0.5, 1.1));
    if (u < 0.6) { g.fillStyle = COL.black; circle(g, VX, VY, 11); g.fill(); }
    if (grow > 0) {
      const sh = g.createRadialGradient(VX, VY + 232, 0, VX, VY + 232, 200);
      sh.addColorStop(0, rgba(RGB.black, 0.22 * grow)); sh.addColorStop(1, rgba(RGB.black, 0));
      g.save(); g.translate(VX, VY + 232); g.scale(1, 0.16); g.translate(-VX, -(VY + 232)); g.fillStyle = sh; g.fillRect(VX - 220, VY + 12, 440, 440); g.restore();
    }
    if (u > 0.35) Metal.draw(g, heroMetal(t, 0, true), VX, VY + bob(t), PPU);
    const ring = eio(range(u, 0.95, 1.45));
    if (ring > 0) {
      g.strokeStyle = COL.violet; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.arc(VX, VY, 280, -Math.PI / 2, -Math.PI / 2 + TAU * ring); g.stroke();
      const tk = eo(range(u, 1.25, 1.5));
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => partial(g, [VX + dx * 300, VY + dy * 300], [VX + dx * 340, VY + dy * 340], tk));
    }
  });
  drawBlock('s3', t, COL.black);
}

/* ---------- S5: күн → ай ---------- */
const STARS = (() => { const r = rng(12); const out = []; while (out.length < 16) { const p = [1110 + r() * 790, 180 + r() * 1180]; if (Math.hypot(p[0] - VX, p[1] - VY) > 330) out.push({ p, r: 2.5 + r() * 2.5, d: r() * 0.3 }); } return out; })();
function drawS5(t) {
  const u = t - 11, sun = 1 - ss(range(u, 0.7, 1.3));
  withCam(u, 0.025, () => {
    halo(g, VX, VY, 640, RGB.orange, 0.38 * sun);
    halo(g, VX, VY, 600, RGB.violet, 0.34 * (1 - sun));
    const e = eo(range(u, 0.05, 0.45)) * (1 - ei(range(u, 0.62, 0.92)));
    if (e > 0) {
      g.strokeStyle = COL.orange; g.lineWidth = 8; g.lineCap = 'round';
      for (let k = 0; k < 16; k++) { const a = k * TAU / 16; line(g, [VX + Math.cos(a) * 240, VY + Math.sin(a) * 240], [VX + Math.cos(a) * (240 + 90 * e), VY + Math.sin(a) * (240 + 90 * e)]); }
    }
    Metal.draw(g, heroMetal(t, sun, false), VX, VY + bob(t), PPU);
    if (u > 0.6) {
      const off = lerp2([620, -300], [150, -96], eio(range(u, 0.72, 1.32)));
      g.save(); circle(g, VX, VY + bob(t), 192); g.clip(); g.fillStyle = COL.black; circle(g, VX + off[0], VY + bob(t) + off[1], 198); g.fill(); g.restore();
    }
    STARS.forEach(s => { const a = eo(range(u, 1.12 + s.d, 1.42 + s.d)); if (a > 0) { g.fillStyle = rgba(RGB.cream, 0.85 * a); circle(g, s.p[0], s.p[1], s.r * a); g.fill(); } });
  });
  drawBlock('s4', t, COL.cream);
}

/* ---------- S6: кітап беттері → қабаттар → хром куб ---------- */
const SPINE = [VX, 1020];
function cubeState(sizeG, boxMix, ballR, ry) {
  return { balls: [[0, 0, 0, ballR]], k: 0.3, box: [0, 0, 0, 0.42 * sizeG, 0.42 * sizeG, 0.42 * sizeG, 0.05], boxMix, rot: [0.62, ry], tintA: [1.15, 0.42, 0.22], tintB: [0.85, 0.8, 0.72], bgLight: 1.0 };
}
const cubeRy = t => 0.785 + 0.22 * range(t, 13.9, 15.2);
function drawS6(t) {
  const u = t - 13;
  withCam(u, 0.02, () => {
    if (u < 0.25) {
      const m = eio(range(u, -0.28, 0.22));
      const c = lerp2([VX, VY + bob(t)], SPINE, m);
      Metal.draw(g, { balls: [[0, 0, 0, lerp(0.56, 0.0, m)]], tintA: [1.15, 0.42, 0.22], tintB: [0.85, 0.8, 0.72], bgLight: 1 }, c[0], c[1], PPU);
    }
    const open = eo(range(u, 0.0, 0.5)), len = 420 * eo(range(u, -0.05, 0.32));
    const coll = eio(range(u, 0.78, 1.12));
    const pagesA = 1 - range(u, 0.95, 1.15);
    if (len > 1 && pagesA > 0) {
      g.save(); g.globalAlpha = pagesA; g.lineCap = 'round';
      const cov = eo(range(u, 0.05, 0.4)) * (1 - coll);
      g.strokeStyle = COL.black; g.lineWidth = 9;
      if (cov > 0) { line(g, SPINE, [SPINE[0] - 450 * cov, SPINE[1] + 24 * cov]); line(g, SPINE, [SPINE[0] + 450 * cov, SPINE[1] + 24 * cov]); }
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.3 * open;
        const L = len * (1 - 0.05 * Math.abs(i - 4));
        let tip = [SPINE[0] + Math.cos(a) * L, SPINE[1] + Math.sin(a) * L];
        const yL = VY - 150 + i * 36, half = 250 * (1 - 0.45 * coll);
        const slabL = [VX - half, yL], slabR = [VX + half, yL];
        const from = lerp2(SPINE, slabL, coll); tip = lerp2(tip, slabR, coll);
        const nrm = [-Math.sin(a), Math.cos(a)], bulge = 46 * (i < 4 ? 1 : i > 4 ? -1 : 0) * (1 - coll);
        const mid = [(from[0] + tip[0]) / 2 + nrm[0] * bulge, (from[1] + tip[1]) / 2 + nrm[1] * bulge];
        g.strokeStyle = i === 4 ? COL.orange : COL.black; g.lineWidth = i === 4 ? 9 : 6;
        g.beginPath(); g.moveTo(from[0], from[1]); g.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); g.stroke();
      }
      const fl = range(u, 0.45, 0.8);
      if (fl > 0 && fl < 1) {
        const a = -Math.PI / 2 + lerp(1.2, -1.2, eio(fl)), L = 400, tip = [SPINE[0] + Math.cos(a) * L, SPINE[1] + Math.sin(a) * L];
        g.strokeStyle = COL.orange; g.lineWidth = 9; g.beginPath(); g.moveTo(SPINE[0], SPINE[1]);
        g.quadraticCurveTo((SPINE[0] + tip[0]) / 2 - Math.sin(a) * 60, (SPINE[1] + tip[1]) / 2 + Math.cos(a) * 60, tip[0], tip[1]); g.stroke();
      }
      g.restore();
    }
    const gs = eo(range(u, 0.92, 1.3));
    if (gs > 0) {
      const sh = g.createRadialGradient(VX, VY + 300, 0, VX, VY + 300, 260);
      sh.addColorStop(0, rgba(RGB.black, 0.2 * gs)); sh.addColorStop(1, rgba(RGB.black, 0));
      g.save(); g.translate(VX, VY + 300); g.scale(1, 0.15); g.translate(-VX, -(VY + 300)); g.fillStyle = sh; g.fillRect(VX - 280, VY + 20, 560, 560); g.restore();
      Metal.draw(g, cubeState(gs, ss(range(u, 0.98, 1.4)), 0.5 * gs, cubeRy(t)), VX, VY, PPU);
      const ul = eo(range(u, 1.25, 1.6));
      g.strokeStyle = COL.orange; g.lineWidth = 10; g.lineCap = 'round'; partial(g, [VX - 130, VY + 345], [VX + 130, VY + 345], ul);
    }
  });
  drawBlock('s5', t, COL.black);
}

/* ---------- S7: қолдау желісі ---------- */
const NODE = k => { const a = -Math.PI / 2 + Math.PI / 8 + k * Math.PI / 4; return [VX + Math.cos(a) * 365, VY + Math.sin(a) * 365]; };
function cubeCorner(k, ry) {
  const h = 0.42, p = [(k & 1 ? h : -h), (k & 2 ? h : -h), (k & 4 ? h : -h)];
  const cy = Math.cos(-ry), sy = Math.sin(-ry); let x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1];
  const cx = Math.cos(-0.62), sx = Math.sin(-0.62); const y2 = y * cx - z * sx;
  return [VX + x * PPU, VY + y2 * PPU];
}
const CROSS = [[0, 3], [2, 5], [4, 7], [6, 1]];
function drawS7(t) {
  const u = t - 15;
  withCam(u, 0.025, () => {
    const pa = eo(range(u, 0.35, 0.65));
    if (pa > 0) { g.save(); g.setLineDash([8, 16]); g.strokeStyle = rgba(RGB.cream, 0.45 * pa); g.lineWidth = 3; circle(g, VX, VY, 178); g.stroke(); g.restore(); }
    const pos = [...Array(8)].map((_, k) => { const f = eo(range(u, -0.12 + k * 0.02, 0.4 + k * 0.02)); const a = cubeCorner(k, cubeRy(t)), b = NODE(k); const m = lerp2(a, b, f); return [m[0] + Math.sin(f * Math.PI) * 30, m[1]]; });
    g.lineCap = 'round';
    CROSS.forEach(([a, b], i) => { const e = eo(range(u, 1.0 + i * 0.06, 1.3 + i * 0.06)); g.strokeStyle = rgba(RGB.cream, 0.22); g.lineWidth = 2; partial(g, pos[a], pos[b], e); });
    for (let k = 0; k < 8; k++) { const e = eo(range(u, 0.42 + k * 0.045, 0.66 + k * 0.045)); g.strokeStyle = rgba(RGB.cream, 0.5); g.lineWidth = 3; partial(g, pos[k], pos[(k + 1) % 8], e); }
    const lit = [];
    for (let k = 0; k < 8; k++) {
      const e = eo(range(u, 0.7 + k * 0.035, 0.95 + k * 0.035)); lit[k] = e;
      const dir = [VX - pos[k][0], VY - pos[k][1]], d = Math.hypot(...dir), end = [VX - dir[0] / d * 196, VY - dir[1] / d * 196];
      g.strokeStyle = COL.lime; g.lineWidth = 4; partial(g, pos[k], end, e);
      if (u > 1.2) { const f = ((u - 1.2) * 0.9 + k * 0.125) % 1; const q = lerp2(pos[k], end, f); g.fillStyle = rgba(RGB.lime, range(u, 1.2, 1.4)); circle(g, q[0], q[1], 6); g.fill(); }
    }
    for (let k = 0; k < 8; k++) {
      if (lit[k] > 0) { g.strokeStyle = rgba(RGB.lime, 0.55 * lit[k]); g.lineWidth = 3; circle(g, pos[k][0], pos[k][1], 30); g.stroke(); }
      g.fillStyle = COL.lime; circle(g, pos[k][0], pos[k][1], 16); g.fill();
    }
    const m = range(u, -0.28, 0.3);
    Metal.draw(g, { balls: [[0, 0, 0, lerp(0.5, 0.21, eio(m))]], k: 0.3, box: [0, 0, 0, lerp(0.42, 0.2, eio(m)), lerp(0.42, 0.2, eio(m)), lerp(0.42, 0.2, eio(m)), 0.05], boxMix: 1 - ss(range(u, -0.28, 0.22)), rot: [0.62, cubeRy(t)], tintA: [0.84, 1, 0.15], tintB: [0.55, 0.55, 0.6], bgLight: 0.3 }, VX, VY, PPU);
  });
  drawBlock('s6', t, COL.cream);
}

/* ---------- S8: жол, белгілер, түзету ---------- */
const PATH = [[1150, 1160], [1335, 1110], [1290, 960], [1470, 900], [1650, 965], [1725, 800], [1590, 690], [1715, 560]];
const TGT8 = [1835, 345], WRONG = [1890, 640];
function nodePos8(k, t) {
  const u = t - 17, f = eio(range(u, -0.28 + k * 0.015, 0.3 + k * 0.015));
  return lerp2(NODE(k), PATH[k], f);
}
function drawS8(t) {
  const u = t - 17;
  withCam(u, 0.02, () => {
    const P = [...Array(8)].map((_, k) => nodePos8(k, t));
    g.lineCap = 'round'; g.lineJoin = 'round';
    const closeA = 1 - range(u, -0.28, 0.02);
    if (closeA > 0) { g.strokeStyle = rgba(RGB.black, closeA); g.lineWidth = 5; line(g, P[7], P[0]); }
    g.strokeStyle = COL.black; g.lineWidth = 5;
    g.beginPath(); g.moveTo(P[0][0], P[0][1]); for (let k = 1; k < 8; k++) g.lineTo(P[k][0], P[k][1]); g.stroke();
    const prog = clamp((u - 0.3) / 0.085, 0, 7);
    g.strokeStyle = COL.violet; g.lineWidth = 10;
    g.beginPath(); g.moveTo(P[0][0], P[0][1]);
    for (let k = 1; k <= Math.floor(prog); k++) g.lineTo(P[k][0], P[k][1]);
    if (prog < 7 && prog > 0) { const q = lerp2(P[Math.floor(prog)], P[Math.floor(prog) + 1], prog % 1); g.lineTo(q[0], q[1]); }
    if (prog > 0) g.stroke();
    for (let k = 0; k < 8; k++) {
      const c = range(u, 0.3 + k * 0.085, 0.42 + k * 0.085), r = lerp(12, 26, back(c));
      g.fillStyle = c > 0 ? COL.violet : COL.black; circle(g, P[k][0], P[k][1], r); g.fill();
      if (c > 0) check(g, P[k][0], P[k][1], 22, range(c, 0.3, 1), COL.cream, 5);
    }
    const w = eo(range(u, 0.98, 1.15)), wa = 1 - 0.65 * range(u, 1.15, 1.35);
    if (w > 0) { g.save(); g.setLineDash([14, 14]); g.strokeStyle = rgba(RGB.black, 0.45 * wa); g.lineWidth = 5; partial(g, PATH[7], WRONG, w); g.restore(); }
    const cp = eio(range(u, 1.18, 1.55));
    const ctrl = [1830, 540];
    const qb = s => [(1 - s) * (1 - s) * PATH[7][0] + 2 * (1 - s) * s * ctrl[0] + s * s * TGT8[0], (1 - s) * (1 - s) * PATH[7][1] + 2 * (1 - s) * s * ctrl[1] + s * s * TGT8[1]];
    const ta = eo(range(u, 1.0, 1.25));
    if (ta > 0) {
      const fill = eo(range(u, 1.55, 1.75));
      g.strokeStyle = COL.violet; g.lineWidth = 6; circle(g, TGT8[0], TGT8[1], 38 * ta); g.stroke();
      if (fill > 0) { g.fillStyle = COL.violet; circle(g, TGT8[0], TGT8[1], 26 * back(fill)); g.fill(); }
    }
    if (cp > 0) {
      g.strokeStyle = COL.violet; g.lineWidth = 10; g.beginPath(); g.moveTo(PATH[7][0], PATH[7][1]);
      const end = Math.min(cp, 0.86);
      for (let i = 1; i <= 30; i++) { const q = qb(end * i / 30); g.lineTo(q[0], q[1]); }
      g.stroke();
      const tip = qb(end), pr = qb(Math.max(0, end - 0.04)), an = Math.atan2(tip[1] - pr[1], tip[0] - pr[0]);
      g.save(); g.translate(tip[0], tip[1]); g.rotate(an); g.fillStyle = COL.violet; g.beginPath(); g.moveTo(22, 0); g.lineTo(-14, -18); g.lineTo(-14, 18); g.closePath(); g.fill(); g.restore();
    }
  });
  drawBlock('s7', t, COL.black);
}

/* ---------- UNIFY: сегіз белгі — бір жүйе ---------- */
const TILE_Y = 430, tileX = i => 330 + i * 198, TILE = 156;
function icon(k, x, y) {
  g.save(); g.translate(x, y); g.lineCap = 'round'; g.lineJoin = 'round';
  const cr = COL.cream, li = COL.lime; g.lineWidth = 4; g.strokeStyle = cr; g.fillStyle = li;
  if (k === 0) { circle(g, 0, 0, 44); g.stroke(); g.save(); g.rotate(-Math.PI / 4); g.beginPath(); g.moveTo(36, 0); g.lineTo(0, -9); g.lineTo(0, 9); g.closePath(); g.fill(); g.fillStyle = 'rgba(241,237,227,0.6)'; g.beginPath(); g.moveTo(-22, 0); g.lineTo(0, -9); g.lineTo(0, 9); g.closePath(); g.fill(); g.restore(); }
  if (k === 1) { [44, 29].forEach(r => { circle(g, 0, 0, r); g.stroke(); }); circle(g, 0, 0, 12); g.fill(); }
  if (k === 2) for (let i = 0; i < 9; i++) { const x0 = -36 + (i % 3) * 26, y0 = -36 + Math.floor(i / 3) * 26; rr(g, x0, y0, 20, 20, 5); if ([0, 1, 2, 3, 4, 6].includes(i)) g.fill(); else g.stroke(); }
  if (k === 3) { g.fillStyle = 'rgba(241,237,227,0.35)'; [[-38, -30], [-30, 32], [36, -36], [40, 28], [-44, 4]].forEach(([a, b]) => { circle(g, a, b, 5); g.fill(); }); g.fillStyle = li; circle(g, 0, 0, 17); g.fill(); circle(g, 0, 0, 28); g.stroke(); }
  if (k === 4) { g.fillStyle = cr; circle(g, -4, 2, 34); g.fill(); g.fillStyle = '#1b1b1b'; circle(g, 12, -10, 31); g.fill(); g.fillStyle = li; circle(g, 30, 26, 5); g.fill(); }
  if (k === 5) { g.beginPath(); g.moveTo(0, -40); g.lineTo(38, -19); g.lineTo(0, 2); g.lineTo(-38, -19); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-38, -19); g.lineTo(-38, 22); g.lineTo(0, 43); g.lineTo(38, 22); g.lineTo(38, -19); g.moveTo(0, 2); g.lineTo(0, 43); g.stroke(); }
  if (k === 6) { const ps = [...Array(6)].map((_, i) => [Math.cos(i * TAU / 6) * 40, Math.sin(i * TAU / 6) * 40]); g.lineWidth = 3; ps.forEach((p, i) => line(g, p, ps[(i + 1) % 6])); g.fillStyle = cr; ps.forEach(p => { circle(g, p[0], p[1], 7); g.fill(); }); g.fillStyle = li; circle(g, 0, 0, 11); g.fill(); }
  if (k === 7) { g.beginPath(); g.moveTo(-40, 34); g.lineTo(-14, 22); g.lineTo(-22, -2); g.lineTo(6, -12); g.stroke(); g.fillStyle = li; circle(g, 26, -26, 17); g.fill(); check(g, 26, -26, 15, 1, '#101010', 4); }
  g.restore();
}
function drawUnify(t) {
  const z = lerp(1.3, 1, eio(range(t, 18.95, 20.3)));
  g.save(); g.translate(1024, TILE_Y); g.scale(z, z); g.translate(-1024, -TILE_Y);
  const lp = eio(range(t, 19.3, 20.1));
  const col = range(t, 21.42, 21.82);
  if (lp > 0 && col <= 0) {
    g.strokeStyle = COL.lime; g.lineWidth = 4; g.lineCap = 'round';
    partial(g, [tileX(0), TILE_Y], [tileX(7), TILE_Y], lp);
    const pp = range(t, 20.25, 21.2);
    if (pp > 0 && pp < 1) { const x = lerp(tileX(0), tileX(7), eio(pp)); halo(g, x, TILE_Y, 70, RGB.lime, 0.7 * Math.sin(pp * Math.PI)); }
  }
  for (let i = 0; i < 8; i++) {
    const dl = Math.abs(i - 3.5) * 0.06, a = back(range(t, 18.9 + dl, 19.3 + dl));
    if (a <= 0) continue;
    const ci = ei(range(t, 21.42 + i * 0.02, 21.8));
    const p = lerp2([tileX(i), TILE_Y], [1024, 640], ci);
    const s = TILE * a * lerp(1, 0.14, ci);
    g.save(); g.globalAlpha = clamp(a);
    g.fillStyle = ci > 0.6 ? COL.lime : '#1c1c1c'; rr(g, p[0] - s / 2, p[1] - s / 2, s, s, lerp(30, s / 2, ci)); g.fill();
    if (ci < 0.6) {
      g.strokeStyle = rgba(RGB.cream, 0.14); g.lineWidth = 2; rr(g, p[0] - s / 2, p[1] - s / 2, s, s, 30 * a); g.stroke();
      g.save(); g.translate(p[0], p[1]); g.scale(a * (1 - ci), a * (1 - ci)); icon(i, 0, 0); g.restore();
      setFont(26, 500); g.textAlign = 'center'; g.fillStyle = rgba(RGB.cream, 0.5 * (1 - ci * 1.6)); g.fillText(String(i + 1).padStart(2, '0'), p[0], p[1] + s / 2 + 46);
    }
    g.restore();
  }
  if (col >= 1) { g.fillStyle = COL.lime; circle(g, 1024, 640, 22); g.fill(); }
  g.restore();
  drawBlock('unify', t, COL.cream);
}

/* ---------- FINAL ---------- */
function drawFinal(t) {
  drawBlock('final', t, COL.black);
  const B = BLOCKS.final, y0 = B.bottom + 190;
  const pts = [[874, y0], [1024, y0], [1024, y0 - 78], [1174, y0 - 78]], lens = [150, 78, 150], tot = 378;
  const p = eio(range(t, 22.55, 23.05));
  if (p <= 0) return;
  g.strokeStyle = COL.violet; g.lineWidth = 10; g.lineCap = 'round'; g.lineJoin = 'round';
  let d = p * tot; g.beginPath(); g.moveTo(...pts[0]); let end = pts[0];
  for (let i = 0; i < 3; i++) { const f = clamp(d / lens[i]); end = lerp2(pts[i], pts[i + 1], f); g.lineTo(end[0], end[1]); d -= lens[i]; if (f < 1) break; }
  g.stroke();
  g.fillStyle = COL.violet; circle(g, end[0], end[1], 16 * back(range(t, 22.55, 22.8))); g.fill();
}

/* ---------- scenes & wipes ---------- */
const SCENES = [
  { t0: 0, bg: 'black', draw: drawIntro }, { t0: 3, bg: 'black', draw: drawS1 }, { t0: 5, bg: 'cream', draw: drawS2 },
  { t0: 7, bg: 'black', draw: drawS3 }, { t0: 9, bg: 'cream', draw: drawS4 }, { t0: 11, bg: 'black', draw: drawS5 },
  { t0: 13, bg: 'cream', draw: drawS6 }, { t0: 15, bg: 'black', draw: drawS7 }, { t0: 17, bg: 'cream', draw: drawS8 },
  { t0: 19, bg: 'black', draw: drawUnify }, { t0: 22, bg: 'cream', draw: drawFinal },
];
const circ = (x, y, r) => { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); };
const WIPES = [
  null,
  { w0: 2.6, w1: 3.05, path: null },
  { w0: 4.74, w1: 5.22, path: t => circ(VX, VY, 1730 * Math.sqrt(eio(range(t, 4.74, 5.22)))) },
  { w0: 6.7, w1: 7.18, path: t => circ(VX, VY, lerp(36, 1730, Math.sqrt(eio(range(t, 6.7, 7.18))))) },
  { w0: 8.76, w1: 9.2, path: t => { const e = lerp(-200, 2250, eio(range(t, 8.76, 9.2))); g.beginPath(); g.moveTo(-300, 0); g.lineTo(e + 140, 0); g.lineTo(e - 140, H); g.lineTo(-300, H); g.closePath(); } },
  { w0: 10.74, w1: 11.2, path: t => { const e = lerp(-260, 1800, eio(range(t, 10.74, 11.2))); g.beginPath(); g.moveTo(0, -10); g.lineTo(W, -10); g.lineTo(W, e); g.quadraticCurveTo(W / 2, e + 220, 0, e); g.closePath(); } },
  { w0: 12.72, w1: 13.2, path: t => { const e = lerp(2500, -560, eio(range(t, 12.72, 13.2))); g.beginPath(); g.moveTo(e + 230, 0); g.lineTo(W + 10, 0); g.lineTo(W + 10, H); g.lineTo(e - 230, H); g.closePath(); },
    after: t => { const p = range(t, 12.72, 13.2); if (p <= 0 || p >= 1) return; const e = lerp(2500, -560, eio(p)); g.save(); g.beginPath(); g.moveTo(e + 230, 0); g.lineTo(e - 230, H); g.lineTo(e - 140, H); g.lineTo(e + 320, 0); g.closePath(); const gr = g.createLinearGradient(e, 0, e + 110, -40); gr.addColorStop(0, 'rgba(16,16,16,0.28)'); gr.addColorStop(1, 'rgba(16,16,16,0)'); g.fillStyle = gr; g.fill(); g.restore(); } },
  { w0: 14.72, w1: 15.22, path: t => { g.beginPath(); for (let i = 0; i < 8; i++) { const p = eio(range(t, 14.72 + i * 0.025, 15.0 + i * 0.025)), y = i * H / 8; g.rect(W - W * p, y, W * p + 1, H / 8 + 1); } } },
  { w0: 16.72, w1: 17.2, path: t => { const E = lerp(-300, W + H + 300, eio(range(t, 16.72, 17.2))); g.beginPath(); g.moveTo(0, H); g.lineTo(0, H - E); g.lineTo(E, H); g.closePath(); },
    after: t => { const p = range(t, 16.72, 17.2); if (p <= 0 || p >= 1) return; const E = lerp(-300, W + H + 300, eio(p)); g.fillStyle = COL.violet; g.beginPath(); g.moveTo(0, H - E); g.lineTo(E, H); g.lineTo(E + 120, H); g.lineTo(0, H - E - 120); g.closePath(); g.fill(); } },
  { w0: 18.7, w1: 19.2, path: t => circ(TGT8[0], TGT8[1], 2240 * Math.sqrt(eio(range(t, 18.7, 19.2)))) },
  { w0: 21.7, w1: 22.14, path: t => circ(1024, 640, lerp(22, 1410, Math.sqrt(eio(range(t, 21.7, 22.14))))) },
];
function drawScene(i, t, withBg) { if (withBg) background(SCENES[i].bg, t); SCENES[i].draw(t); }
function renderFrame(t) {
  t = clamp(t, 0, DUR);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  for (let j = 1; j < SCENES.length; j++) {
    const w = WIPES[j];
    if (t >= w.w0 && t < w.w1) {
      drawScene(j - 1, t, true);
      if (!w.path) { drawScene(j, t, false); return; }
      g.save(); w.path(t); g.clip(); drawScene(j, t, true); g.restore();
      if (w.after) w.after(t);
      return;
    }
  }
  let i = 0; for (let j = 0; j < SCENES.length; j++) if (t >= SCENES[j].t0) i = j;
  drawScene(i, t, true);
}

window.renderFrame = renderFrame;
window.SCENE = { W, H, FPS, DUR };
window.__ready = (async () => {
  await Promise.all(['900 100px "Inter Display"', '700 100px "Inter Display"', '500 40px Inter'].map(f => document.fonts.load(f, 'ӘҒҚҢӨҰҮҺІәғқңөұүһі')));
  await document.fonts.ready;
  setupText();
  const q = new URLSearchParams(location.search);
  if (q.has('t')) renderFrame(parseFloat(q.get('t')));
  else if (!q.has('render')) { const t0 = performance.now(); const loop = () => { renderFrame(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); }
  return true;
})();
