'use strict';
/* «Өміріңді өзгертетін 8 қадам» — детерминирленген сахна.
   renderFrame(t) кез келген уақыт сәтін (секунд) тәуелсіз салады,
   сондықтан кадрларды кез келген ретпен және қайта жалғастырып рендерлеуге болады. */

const W = 1080, H = 1920, FPS = 30, DUR = 32;
const LIME = [200, 255, 62], CYAN = [111, 214, 255], INK = [243, 246, 241];
const SUN = [236, 255, 140], MOON = [214, 240, 255];
const FD = '"Inter Display","Inter",sans-serif', FT = '"Inter",sans-serif';
const TAU = Math.PI * 2;

/* ---------- helpers ---------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const range = (t, a, b) => clamp((t - a) / (b - a));
const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo = t => 1 - Math.pow(1 - t, 3);
const eo5 = t => 1 - Math.pow(1 - t, 5);
const ei = t => t * t * t;
const ss = t => t * t * (3 - 2 * t);
const back = t => { const c = 1.45; return t <= 0 ? 0 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a)})`;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)].map(Math.round);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
function halo(g, x, y, r, c, a) {
  if (a <= 0.001 || r <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(c, a)); gr.addColorStop(0.4, rgba(c, a * 0.42)); gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function txt(g, s, x, y, size, weight, color, align = 'left', font = FT) {
  g.font = `${weight} ${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y);
}
function alpha(g, a, fn) { if (a <= 0.002) return; g.save(); g.globalAlpha *= a; fn(); g.restore(); }
function bez(p0, p1, p2, p3, s) {
  const m = 1 - s;
  return [m * m * m * p0[0] + 3 * m * m * s * p1[0] + 3 * m * s * s * p2[0] + s * s * s * p3[0],
          m * m * m * p0[1] + 3 * m * m * s * p1[1] + 3 * m * s * s * p2[1] + s * s * s * p3[1]];
}
/* Catmull-Rom арқылы өтетін тегіс жолды доға ұзындығы бойынша біркелкі нүктелерге бөлу */
function smoothPath(pts, n) {
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < 60; k++) {
      const s = k / 60, s2 = s * s, s3 = s2 * s;
      dense.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * s + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3),
                  0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * s + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3), i, s]);
    }
  }
  dense.push([...pts[pts.length - 1], pts.length - 1, 0]);
  return resample(dense, n, pts);
}
function resample(dense, n, ctrl) {
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const L = cum[cum.length - 1], out = []; let j = 0;
  for (let i = 0; i < n; i++) {
    const d = L * i / (n - 1);
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const f = (d - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
    out.push([lerp(dense[j][0], dense[j + 1][0], f), lerp(dense[j][1], dense[j + 1][1], f)]);
  }
  if (ctrl) out.nodes = ctrl.map(c => { let bi = 0, bd = 1e9; out.forEach((p, i) => { const d = Math.hypot(p[0] - c[0], p[1] - c[1]); if (d < bd) { bd = d; bi = i; } }); return bi; });
  return out;
}
function strokePts(g, pts, a, b) {
  const i0 = Math.max(0, Math.floor(a)), i1 = Math.min(pts.length - 1, b);
  if (i1 <= i0) return;
  g.beginPath(); g.moveTo(pts[i0][0], pts[i0][1]);
  for (let i = i0 + 1; i <= Math.floor(i1); i++) g.lineTo(pts[i][0], pts[i][1]);
  const fi = Math.floor(i1), fr = i1 - fi;
  if (fr > 0 && fi + 1 < pts.length) g.lineTo(lerp(pts[fi][0], pts[fi + 1][0], fr), lerp(pts[fi][1], pts[fi + 1][1], fr));
  g.stroke();
}
function ptAt(pts, f) {
  const x = clamp(f) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x)), r = x - i;
  return [lerp(pts[i][0], pts[i + 1][0], r), lerp(pts[i][1], pts[i + 1][1], r)];
}

/* ---------- timeline ---------- */
const STEP0 = 4, SL = 2.5;
const B = k => STEP0 + k * SL;
const STEPS = [
  { l1: 'Өзіңді', l2: 'таны' },
  { l1: 'Нақты', l2: 'мақсат қой' },
  { l1: 'Кішкентай', l2: 'әдеттен баста' },
  { l1: 'Назарыңды', l2: 'басқар' },
  { l1: 'Денең мен', l2: 'ұйқыңды күт' },
  { l1: 'Үздіксіз', l2: 'үйрен' },
  { l1: 'Қолдайтын', l2: 'орта құр' },
  { l1: 'Әрекет ет.', l2: 'Нәтижені бағала' },
];
const TY = 1508, TX0 = 196, TX1 = 884;
const trackerX = k => TX0 + k * (TX1 - TX0) / 7;

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const bctx = $('bg').getContext('2d'), fctx = $('fx').getContext('2d');
const scr = $('screen'), sctx = scr.getContext('2d');
const lap = $('lap'), world = $('world');

function setupLaptop() {
  const T = (id, tr) => { $(id).style.transform = tr; };
  T('shadow', 'translate3d(-700px,24px,-260px) rotateX(90deg)');
  T('deck', 'translate3d(-470px,0px,0px) rotateX(90deg)');
  T('spill', 'translate3d(-470px,-0.5px,0px) rotateX(90deg)');
  T('baseFront', 'translate3d(-470px,0px,610px)');
  T('baseL', 'translate3d(-470px,0px,0px) rotateY(-90deg)');
  T('baseR', 'translate3d(470px,0px,610px) rotateY(90deg)');
  T('lid', 'translate3d(0px,0px,16px) rotateX(19deg)');
  T('lidGlow', 'translate3d(-750px,-820px,-90px)');
  T('lidBack', 'translate3d(450px,-580px,-5px) rotateY(180deg)');
  T('lidL', 'translate3d(-450px,-580px,-5px) rotateY(-90deg)');
  T('lidR', 'translate3d(450px,-580px,5px) rotateY(90deg)');
  T('lidTop', 'translate3d(-450px,-580px,-5px) rotateX(90deg)');
  T('lidFront', 'translate3d(-450px,-580px,5px)');
  drawDeck();
}

function drawDeck() {
  const c = $('deck'), g = c.getContext('2d');
  g.scale(2, 2);
  const W2 = 940, H2 = 610;
  const gr = g.createLinearGradient(0, 0, 0, H2);
  gr.addColorStop(0, '#2a2f35'); gr.addColorStop(0.5, '#1c2025'); gr.addColorStop(1, '#14171a');
  g.fillStyle = gr; rr(g, 0, 0, W2, H2, 26); g.fill();
  const r = rng(7);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${0.012 + r() * 0.02})`; g.fillRect(r() * W2, r() * H2, 1 + r() * 30, 0.6); }
  g.fillStyle = '#0d0f12'; g.fillRect(40, 0, W2 - 80, 22);
  g.fillStyle = '#0a0c0e'; rr(g, 92, 56, 756, 312, 14); g.fill();
  const rows = [
    { y: 66, h: 26, keys: Array(14).fill(1) },
    { y: 100, h: 46, keys: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6] },
    { y: 152, h: 46, keys: [1.6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    { y: 204, h: 46, keys: [1.9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.75] },
    { y: 256, h: 46, keys: [2.4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.4] },
    { y: 308, h: 46, keys: [1, 1, 1, 1.25, 5.2, 1.25, 1, 1, 1] },
  ];
  rows.forEach(row => {
    const gap = 7, tot = row.keys.reduce((a, b) => a + b, 0), unit = (736 - gap * (row.keys.length - 1)) / tot;
    let x = 102;
    row.keys.forEach(k => {
      const w = k * unit;
      g.shadowColor = 'rgba(200,255,62,0.10)'; g.shadowBlur = 6;
      const kg = g.createLinearGradient(0, row.y, 0, row.y + row.h);
      kg.addColorStop(0, '#22262b'); kg.addColorStop(1, '#16191d');
      g.fillStyle = kg; rr(g, x, row.y, w, row.h, 6); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1; rr(g, x + 0.5, row.y + 0.5, w - 1, row.h - 1, 6); g.stroke();
      x += w + gap;
    });
  });
  const tg = g.createLinearGradient(0, 392, 0, 580);
  tg.addColorStop(0, '#22272c'); tg.addColorStop(1, '#1a1e22');
  g.fillStyle = tg; rr(g, 320, 392, 300, 188, 16); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1.2; rr(g, 320, 392, 300, 188, 16); g.stroke();
  [[44, 60], [870, 60]].forEach(([sx, sy]) => {
    for (let yy = 0; yy < 50; yy++) for (let xx = 0; xx < 5; xx++) { g.fillStyle = 'rgba(0,0,0,0.55)'; circle(g, sx + xx * 6, sy + yy * 6.2, 1.2); g.fill(); }
  });
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1.5; rr(g, 0.75, 0.75, W2 - 1.5, H2 - 1.5, 26); g.stroke();
}

/* ---------- text blocks ---------- */
const blocks = [];
function addBlock(o) {
  const el = document.createElement('div'); el.className = 'block'; el.style.top = o.top + 'px';
  let chip = null;
  if (o.chip) {
    chip = document.createElement('div'); chip.className = 'chip';
    chip.innerHTML = `<i></i><span>Қадам ${o.chip}</span><b>/ 08</b>`;
    el.appendChild(chip);
  }
  const lines = o.lines.map(l => {
    const m = document.createElement('div'); m.className = 'mask';
    const i = document.createElement('div'); i.className = 'inner ' + l.cls; i.textContent = l.text;
    m.appendChild(i); el.appendChild(m); return i;
  });
  $('text').appendChild(el);
  blocks.push({ el, chip, lines, at: o.lines.map((l, i) => l.at ?? o.tIn + i * (o.stagger ?? 0.1)), tIn: o.tIn, tOut: o.tOut });
}
function fitBlocks() {
  blocks.forEach(b => {
    const maxW = Math.max(...b.lines.map(l => l.getBoundingClientRect().width));
    if (maxW > 920) b.lines.forEach(l => { const fs = parseFloat(getComputedStyle(l).fontSize); l.style.fontSize = (fs * 920 / maxW).toFixed(1) + 'px'; });
  });
}
function animBlocks(t) {
  blocks.forEach(b => {
    const vis = t >= Math.min(...b.at) - 0.02 && t <= b.tOut + 0.8;
    b.el.style.visibility = vis ? 'visible' : 'hidden';
    if (!vis) return;
    b.lines.forEach((ln, i) => {
      const pin = eo5(range(t, b.at[i], b.at[i] + 0.75));
      const o = b.tOut + i * 0.06, pout = ei(range(t, o, o + 0.34));
      ln.style.transform = `translate3d(0,${((1 - pin) * 135 - pout * 135).toFixed(2)}%,0)`;
      ln.style.opacity = (clamp(pin * 1.6) * (1 - pout * 0.7)).toFixed(3);
    });
    if (b.chip) {
      const pin = eo5(range(t, b.tIn - 0.08, b.tIn + 0.5)), pout = ei(range(t, b.tOut - 0.04, b.tOut + 0.26));
      b.chip.style.opacity = (pin * (1 - pout)).toFixed(3);
      b.chip.style.transform = `translate3d(0,${((1 - pin) * 18 - pout * 18).toFixed(1)}px,0)`;
    }
  });
}
function setupText() {
  addBlock({ top: 352, tIn: 1.7, tOut: 3.42, lines: [
    { text: 'Өміріңді өзгертетін', cls: 't-intro1 w', at: 1.65 },
    { text: '8 қадам', cls: 't-intro2 l', at: 1.92 },
    { text: 'Өзгеріс өзіңнен басталады', cls: 'sub', at: 2.45 }] });
  STEPS.forEach((s, k) => addBlock({ top: 292, chip: String(k + 1).padStart(2, '0'), tIn: B(k) + 0.12, tOut: B(k) + 2.18, stagger: 0.1,
    lines: [{ text: s.l1, cls: 't1 w' }, { text: s.l2, cls: 't1 l' }] }));
  addBlock({ top: 318, tIn: 25.0, tOut: 28.45, stagger: 0.16, lines: [
    { text: 'Үлкен өзгеріс —', cls: 't-mid w' }, { text: 'күнделікті шағын', cls: 't-mid l' }, { text: 'әрекеттен', cls: 't-mid l' }] });
  addBlock({ top: 772, tIn: 29.45, tOut: 99, stagger: 0.18, lines: [
    { text: 'Бүгін', cls: 't-final w' }, { text: 'бір қадам жаса', cls: 't-final l' }] });
}

/* ---------- screen visuals (1600×1000 coordinate space) ---------- */
let MINI = false;
function caption(g, s, a) { if (MINI || a <= 0) return; alpha(g, a, () => txt(g, s, 800, 948, 40, 500, 'rgba(200,212,222,0.9)', 'center')); }

function vCompass(g, u) {
  const cx = 800, cy = 480, R = 300, uu = Math.max(0, u);
  const settle = eo(range(u, 0.95, 1.5));
  halo(g, cx, cy, R * 1.3, LIME, 0.05 + 0.05 * settle);
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.18)'; circle(g, cx, cy, R); g.stroke();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.07)'; circle(g, cx, cy, R * 0.62); g.stroke();
  const rot = 0.32 * Math.exp(-1.6 * uu) * Math.sin(3.0 * uu + 0.5);
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * TAU + rot, major = i % 9 === 0, l = major ? 30 : 13;
    g.strokeStyle = major ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.22)'; g.lineWidth = major ? 4 : 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 16), cy + Math.sin(a) * (R - 16)); g.lineTo(cx + Math.cos(a) * (R - 16 - l), cy + Math.sin(a) * (R - 16 - l)); g.stroke();
  }
  const tgt = -Math.PI / 4;
  const th = tgt + 1.9 * Math.exp(-1.9 * uu) * Math.cos(6.0 * uu + 0.3);
  const sw = 1 - settle;
  if (sw > 0.01) {
    const cg = g.createConicGradient(th - 0.9, cx, cy);
    cg.addColorStop(0, rgba(LIME, 0)); cg.addColorStop(0.143, rgba(LIME, 0.22 * sw)); cg.addColorStop(0.144, rgba(LIME, 0)); cg.addColorStop(1, rgba(LIME, 0));
    g.fillStyle = cg; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R - 18, th - 0.9, th); g.closePath(); g.fill();
  }
  const mk = eo(range(u, 0.95, 1.35));
  if (mk > 0) {
    const mx = cx + Math.cos(tgt) * R, my = cy + Math.sin(tgt) * R;
    halo(g, mx, my, 80, LIME, 0.4 * mk);
    g.fillStyle = rgba(LIME, mk); circle(g, mx, my, 12 * back(range(u, 0.95, 1.35))); g.fill();
    const pp = range(u, 1.15, 2.1);
    g.strokeStyle = rgba(LIME, 0.6 * (1 - pp) * mk); g.lineWidth = 3; circle(g, mx, my, 14 + 56 * eo(pp)); g.stroke();
    if (!MINI) alpha(g, mk, () => txt(g, 'Сенің бағытың', mx + 44, my - 26, 38, 600, rgba(LIME, 1)));
  }
  g.save(); g.translate(cx, cy); g.rotate(th);
  const L = R * 0.8, wN = 22;
  g.shadowColor = rgba(LIME, 0.8); g.shadowBlur = 30;
  g.fillStyle = rgba(LIME, 1); g.beginPath(); g.moveTo(L, 0); g.lineTo(0, -wN); g.lineTo(0, wN); g.closePath(); g.fill();
  g.shadowBlur = 0; g.fillStyle = '#3a434c'; g.beginPath(); g.moveTo(-L * 0.6, 0); g.lineTo(0, -wN); g.lineTo(0, wN); g.closePath(); g.fill();
  g.restore();
  g.fillStyle = '#0b1014'; circle(g, cx, cy, 20); g.fill(); g.strokeStyle = rgba(LIME, 1); g.lineWidth = 4; g.stroke();
  caption(g, 'Бағыт табылды', eo(range(u, 1.3, 1.7)));
}

const TGT_LINES = (() => { const r = rng(21); return Array.from({ length: 14 }, (_, i) => ({ a: i / 14 * TAU + 0.2 + (r() - 0.5) * 0.25, d: (i * 7) % 5, c: i % 2 ? CYAN : LIME })); })();
function vTarget(g, u) {
  const cx = 800, cy = 480;
  halo(g, cx, cy, 420, LIME, 0.06);
  [300, 228, 156, 84].forEach((r, i) => {
    const p = i === 0 ? 1 : eo(range(u, -0.15 + i * 0.12, 0.4 + i * 0.12));
    if (p <= 0) return;
    alpha(g, p, () => {
      const rad = r * lerp(1.3, 1, p);
      g.fillStyle = i % 2 ? rgba(LIME, 0.04) : 'rgba(255,255,255,0.025)'; circle(g, cx, cy, rad); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.stroke();
    });
  });
  const la = 1 - range(u, 1.45, 2.1);
  TGT_LINES.forEach(l => {
    const q = eio(range(u, 0.05 + l.d * 0.06, 1.1 + l.d * 0.06));
    if (q <= 0 || la <= 0) return;
    const tip = lerp(820, 46, q), tail = Math.min(820, tip + 280);
    const dx = Math.cos(l.a), dy = Math.sin(l.a);
    const gr = g.createLinearGradient(cx + dx * tail, cy + dy * tail, cx + dx * tip, cy + dy * tip);
    gr.addColorStop(0, rgba(l.c, 0)); gr.addColorStop(1, rgba(l.c, 0.9 * la));
    g.strokeStyle = gr; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx + dx * tail, cy + dy * tail); g.lineTo(cx + dx * tip, cy + dy * tip); g.stroke();
    g.fillStyle = rgba(l.c, la); circle(g, cx + dx * tip, cy + dy * tip, 5); g.fill();
  });
  const b = range(u, 1.12, 1.5);
  if (b > 0) {
    halo(g, cx, cy, 170, LIME, 0.5 * b);
    g.fillStyle = rgba(LIME, 1); circle(g, cx, cy, 40 * back(b)); g.fill();
    g.fillStyle = '#0b1205'; circle(g, cx, cy, 13 * back(b)); g.fill();
    const pp = range(u, 1.25, 2.2);
    g.strokeStyle = rgba(LIME, 0.55 * (1 - pp)); g.lineWidth = 4; circle(g, cx, cy, 44 + 230 * eo(pp)); g.stroke();
  }
  caption(g, 'Бір нақты нысана', eo(range(u, 1.35, 1.75)));
}

const WEEK = ['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб', 'Жс'];
function vCalendar(g, u) {
  const cw = 118, ch = 92, gp = 14, gx = 800 - (7 * cw + 6 * gp) / 2, gy = 210;
  WEEK.forEach((d, i) => alpha(g, eo(range(u, -0.25, 0.2)), () => txt(g, d, gx + i * (cw + gp) + cw / 2, gy - 22, 28, 500, 'rgba(170,182,194,0.85)', 'center')));
  let n = 0;
  for (let k = 0; k < 28; k++) {
    const col = k % 7, row = Math.floor(k / 7), x = gx + col * (cw + gp), y = gy + row * (ch + gp);
    const ap = eo(range(u, -0.3 + k * 0.008, 0.15 + k * 0.008));
    const Lk = 0.22 + k * 0.05, lit = eo(range(u, Lk, Lk + 0.16));
    if (lit > 0.5) n++;
    alpha(g, ap, () => {
      const fresh = lit * (1 - range(u, Lk + 0.1, Lk + 0.7));
      if (fresh > 0.01) halo(g, x + cw / 2, y + ch / 2, 120, LIME, 0.35 * fresh);
      g.fillStyle = lit > 0 ? rgba(mix([22, 28, 34], LIME, lit), 1) : 'rgba(255,255,255,0.035)';
      rr(g, x, y, cw, ch, 16); g.fill();
      g.strokeStyle = lit > 0 ? rgba(LIME, 0.4 + 0.6 * lit) : 'rgba(255,255,255,0.10)'; g.lineWidth = 2; rr(g, x + 1, y + 1, cw - 2, ch - 2, 15); g.stroke();
      txt(g, String(k + 1), x + 14, y + 32, 24, 600, lit > 0.5 ? 'rgba(11,18,5,0.75)' : 'rgba(170,182,194,0.7)');
      if (lit > 0.3) {
        const cp = range(lit, 0.3, 1);
        g.strokeStyle = 'rgba(11,18,5,0.9)'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
        const ax = x + cw / 2 - 18, ay = y + ch / 2 + 6;
        g.beginPath(); g.moveTo(ax, ay);
        if (cp < 0.4) g.lineTo(ax + 12 * cp / 0.4, ay + 12 * cp / 0.4);
        else { g.lineTo(ax + 12, ay + 12); g.lineTo(ax + 12 + 26 * (cp - 0.4) / 0.6, ay + 12 - 28 * (cp - 0.4) / 0.6); }
        g.stroke();
      }
    });
  }
  if (!MINI) alpha(g, eo(range(u, 0.3, 0.7)), () => {
    g.font = `700 92px ${FD}`; const nw = g.measureText(String(n)).width;
    g.font = `500 40px ${FT}`; const lw = g.measureText(' күн қатарынан').width;
    const x0 = 800 - (nw + lw) / 2;
    g.shadowColor = rgba(LIME, 0.6); g.shadowBlur = 24;
    txt(g, String(n), x0, 870, 92, 700, rgba(LIME, 1), 'left', FD);
    g.shadowBlur = 0;
    txt(g, ' күн қатарынан', x0 + nw, 868, 40, 500, 'rgba(225,232,238,0.92)');
  });
}

const NOTES = [
  { t: 'Жаңа хабарлама', s: 'Топтық чат · 12 пікір' },
  { t: 'Жеңілдік тек бүгін', s: 'Жарнамалық ұсыныс' },
  { t: 'Басты тапсырма', s: 'Бүгінгі ең маңызды іс', imp: true },
  { t: 'Ұсынылған видео', s: 'Саған ұнауы мүмкін' },
  { t: 'Еске салғыш', s: 'Тағы 5 хабарландыру' },
];
function bell(g, x, y, c) {
  g.strokeStyle = c; g.lineWidth = 4; g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - 14, y + 10); g.quadraticCurveTo(x - 12, y - 18, x, y - 18); g.quadraticCurveTo(x + 12, y - 18, x + 14, y + 10); g.closePath(); g.stroke();
  g.fillStyle = c; circle(g, x, y + 16, 4); g.fill();
}
function vFocus(g, u) {
  const cw = 760, ch = 120, x0 = 800 - cw / 2;
  let order = 0;
  NOTES.forEach((n, i) => {
    const y0 = 136 + i * 134;
    const pin = eo(range(u, -0.28 + i * 0.07, 0.15 + i * 0.07));
    let x = x0, y = y0 - (1 - pin) * 40, a = pin, sc = 1;
    if (!n.imp) {
      const o = 0.72 + (order++) * 0.1, p = ei(range(u, o, o + 0.5));
      x += (i % 2 ? 1 : -1) * 1150 * p; a *= (1 - p) * lerp(1, 0.55, eo(range(u, 0.3, 0.7)));
    } else {
      const m = eio(range(u, 1.0, 1.5)); y = lerp(y0, 440 - ch / 2, m); sc = lerp(1, 1.16, m);
    }
    if (a <= 0.003) return;
    alpha(g, a, () => {
      g.save(); g.translate(x + cw / 2, y + ch / 2); g.scale(sc, sc); g.translate(-cw / 2, -ch / 2);
      if (n.imp) {
        const gl = eo(range(u, 0.9, 1.5));
        g.shadowColor = rgba(LIME, 0.5 * gl); g.shadowBlur = 50 * gl;
        g.fillStyle = rgba(mix([20, 26, 30], [28, 40, 22], gl), 1); rr(g, 0, 0, cw, ch, 26); g.fill(); g.shadowBlur = 0;
        g.strokeStyle = rgba(LIME, 0.35 + 0.6 * gl); g.lineWidth = 3; rr(g, 1.5, 1.5, cw - 3, ch - 3, 25); g.stroke();
        g.fillStyle = rgba(LIME, 1); circle(g, 60, ch / 2, 30); g.fill();
        g.strokeStyle = '#0b1205'; g.lineWidth = 4; circle(g, 60, ch / 2, 15); g.stroke(); g.fillStyle = '#0b1205'; circle(g, 60, ch / 2, 5); g.fill();
        txt(g, n.t, 112, 50, 36, 600, rgba(mix(INK, LIME, gl), 1), 'left', FD);
        txt(g, n.s, 112, 84, 26, 400, 'rgba(180,192,204,0.9)');
        const fp = eio(range(u, 1.5, 2.4));
        if (fp > 0) {
          g.fillStyle = 'rgba(255,255,255,0.08)'; rr(g, 112, ch - 13, cw - 150, 5, 2.5); g.fill();
          g.fillStyle = rgba(LIME, 1); rr(g, 112, ch - 13, (cw - 150) * fp, 5, 2.5); g.fill();
        }
      } else {
        g.fillStyle = 'rgba(26,31,37,0.95)'; rr(g, 0, 0, cw, ch, 26); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2; rr(g, 1, 1, cw - 2, ch - 2, 25); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.06)'; circle(g, 60, ch / 2, 30); g.fill();
        bell(g, 60, ch / 2 - 2, 'rgba(200,210,220,0.75)');
        txt(g, n.t, 112, 50, 34, 600, 'rgba(225,232,238,0.9)');
        txt(g, n.s, 112, 88, 26, 400, 'rgba(160,172,184,0.8)');
        g.fillStyle = rgba(CYAN, 0.9); circle(g, cw - 40, ch / 2, 8); g.fill();
      }
      g.restore();
    });
  });
  caption(g, 'Қалғаны кейін күте тұрады', eo(range(u, 1.55, 1.95)));
}

const STARS = (() => { const r = rng(5); return Array.from({ length: 30 }, () => { const a = Math.PI + r() * Math.PI, d = 60 + r() * 380; return { x: 800 + Math.cos(a) * d * 1.25, y: 620 + Math.sin(a) * d * 0.85, r: 1.5 + r() * 2.5, p: r() * TAU }; }); })();
let moonCanvas = null;
function moonImg() {
  if (moonCanvas) return moonCanvas;
  moonCanvas = document.createElement('canvas'); moonCanvas.width = moonCanvas.height = 160;
  const g = moonCanvas.getContext('2d');
  g.fillStyle = rgba(MOON, 1); circle(g, 80, 80, 54); g.fill();
  g.globalCompositeOperation = 'destination-out'; circle(g, 104, 62, 48); g.fill();
  return moonCanvas;
}
function vSleep(g, u) {
  const cx = 800, cy = 620, R = 360;
  const prog = eio(range(u, 0.05, 2.0)), ang = Math.PI + prog * Math.PI;
  const n = ss(range(prog, 0.38, 0.72));
  const bx = cx + Math.cos(ang) * R, by = cy + Math.sin(ang) * R;
  halo(g, bx, by, 420, mix(SUN, [70, 120, 220], n), 0.16);
  STARS.forEach(s => { const a = n * (0.55 + 0.45 * Math.sin(u * 2 + s.p)); if (a > 0.01) { g.fillStyle = rgba(MOON, a); circle(g, s.x, s.y, s.r); g.fill(); } });
  g.setLineDash([3, 14]); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R, Math.PI, TAU); g.stroke(); g.setLineDash([]);
  const ag = g.createLinearGradient(cx - R, 0, cx + R, 0); ag.addColorStop(0, rgba(LIME, 0.9)); ag.addColorStop(1, rgba(CYAN, 0.9));
  g.strokeStyle = ag; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, R, Math.PI, ang); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(300, cy); g.lineTo(1300, cy); g.stroke();
  if (n < 1) alpha(g, 1 - n, () => {
    g.save(); g.translate(bx, by); g.rotate(u * 0.25);
    g.strokeStyle = rgba(SUN, 0.85); g.lineWidth = 5; g.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 70, Math.sin(a) * 70); g.lineTo(Math.cos(a) * 92, Math.sin(a) * 92); g.stroke(); }
    g.restore();
    g.shadowColor = rgba(SUN, 0.9); g.shadowBlur = 50; g.fillStyle = rgba(SUN, 1); circle(g, bx, by, 54); g.fill(); g.shadowBlur = 0;
  });
  if (n > 0) alpha(g, n, () => { g.shadowColor = rgba(CYAN, 0.8); g.shadowBlur = 40; g.drawImage(moonImg(), bx - 80, by - 80); g.shadowBlur = 0; });
  const x0 = 330, x1 = 1270, wy = 790, xr = lerp(x0, x1, clamp(prog * 1.05));
  const wg = g.createLinearGradient(x0, 0, x1, 0); wg.addColorStop(0, rgba(LIME, 1)); wg.addColorStop(1, rgba(CYAN, 1));
  g.strokeStyle = wg; g.lineWidth = 5; g.lineJoin = 'round';
  g.beginPath();
  for (let x = x0; x <= xr; x += 4) {
    const f = (x - x0) / (x1 - x0), amp = lerp(62, 5, Math.pow(f, 0.8)), ph = (x - x0) * lerp(0.05, 0.016, f);
    const y = wy + Math.sin(ph) * amp;
    x === x0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.stroke();
  if (!MINI) {
    alpha(g, eo(range(u, 0.0, 0.4)), () => txt(g, 'Қозғалыс', x0, 905, 38, 600, rgba(LIME, 1)));
    alpha(g, eo(range(u, 1.3, 1.8)), () => txt(g, 'Демалыс', x1, 905, 38, 600, rgba(CYAN, 1), 'right'));
  }
}

const BOOK_LINES = (() => { const r = rng(11); return Array.from({ length: 22 }, () => 0.55 + r() * 0.42); })();
function page(g, x0, y0, w, h, side, shade) {
  g.fillStyle = rgba(mix([206, 214, 208], [120, 130, 132], shade), 1);
  g.beginPath();
  if (side > 0) { g.moveTo(x0, y0); g.lineTo(x0 + w, y0 - 6); g.lineTo(x0 + w, y0 + h + 6); g.lineTo(x0, y0 + h); }
  else { g.moveTo(x0, y0); g.lineTo(x0 - w, y0 - 6); g.lineTo(x0 - w, y0 + h + 6); g.lineTo(x0, y0 + h); }
  g.closePath(); g.fill();
}
function bookLines(g, x0, y0, w, side, off) {
  for (let i = 0; i < 9; i++) {
    const L = (w - 70) * BOOK_LINES[(i + off) % 22];
    g.fillStyle = 'rgba(40,52,60,0.35)';
    g.fillRect(side > 0 ? x0 + 36 : x0 - 36 - L, y0 + 50 + i * 34, L, 9);
  }
}
const PROJ_BLOCKS = [[920, 300, 460, 110], [920, 426, 222, 150], [1158, 426, 222, 150], [920, 592, 460, 42]];
function vLearn(g, u) {
  const sx = 470, sy = 300, pw = 270, ph = 380;
  const dim = lerp(1, 0.7, eo(range(u, 1.3, 1.9)));
  alpha(g, dim, () => {
    halo(g, sx, sy + ph / 2, 360, LIME, 0.07);
    g.fillStyle = '#0f1418'; rr(g, sx - pw - 14, sy - 14, pw * 2 + 28, ph + 28, 14); g.fill();
    page(g, sx, sy, pw, ph, -1, 0.05); page(g, sx, sy, pw, ph, 1, 0.0);
    bookLines(g, sx, sy, pw, -1, 0); bookLines(g, sx, sy, pw, 1, 5);
    [[0.0, 0.6], [0.35, 0.95]].forEach(([a, b], fi) => {
      const p = eio(range(u, a, b)); if (p <= 0 || p >= 1) return;
      const phi = p * Math.PI, w = pw * Math.cos(phi), side = w >= 0 ? 1 : -1;
      page(g, sx, sy, Math.abs(w), ph * (1 + 0.04 * Math.sin(phi)), side, 0.35 * Math.sin(phi));
      if (Math.abs(w) > 60) bookLines(g, sx, sy, Math.abs(w), side, 9 + fi * 3);
    });
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(sx - 2, sy, 4, ph);
  });
  const cardA = eo(range(u, 0.5, 0.85));
  alpha(g, cardA, () => {
    g.fillStyle = 'rgba(20,26,31,0.95)'; rr(g, 890, 220, 520, 440, 24); g.fill();
    const done = eo(range(u, 1.75, 2.05));
    g.strokeStyle = rgba(mix([80, 92, 104], LIME, done), 0.7 + 0.3 * done); g.lineWidth = 3; rr(g, 891.5, 221.5, 517, 437, 23); g.stroke();
    txt(g, done > 0.5 ? 'Дайын жоба' : 'Жоба', 922, 272, 32, 600, rgba(mix(INK, LIME, done), 1), 'left', FD);
    PROJ_BLOCKS.forEach(([x, y, w, h], i) => {
      const land = eo(range(u, 0.98 + i * 0.16, 1.22 + i * 0.16));
      g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 2; g.setLineDash([8, 8]); rr(g, x, y, w, h, 12); g.stroke(); g.setLineDash([]);
      if (land > 0) {
        g.fillStyle = rgba(i === 0 ? LIME : CYAN, 0.16 * land); rr(g, x, y, w, h, 12); g.fill();
        g.strokeStyle = rgba(i === 0 ? LIME : CYAN, 0.7 * land); g.lineWidth = 2; rr(g, x, y, w, h, 12); g.stroke();
        alpha(g, land, () => {
          g.fillStyle = 'rgba(235,242,236,0.85)';
          if (i === 0) { g.fillRect(x + 24, y + 28, 260, 16); g.fillRect(x + 24, y + 58, 180, 10); g.fillStyle = rgba(LIME, 1); rr(g, x + w - 130, y + 34, 100, 40, 20); g.fill(); }
          if (i === 1) { g.strokeStyle = 'rgba(235,242,236,0.8)'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 30, y + h - 30); g.lineTo(x + 90, y + 50); g.lineTo(x + 130, y + 100); g.lineTo(x + 160, y + 75); g.lineTo(x + 196, y + h - 30); g.stroke(); circle(g, x + 170, y + 42, 12); g.fill(); }
          if (i === 2) for (let r = 0; r < 3; r++) { g.fillStyle = rgba(CYAN, 1); circle(g, x + 34, y + 38 + r * 38, 7); g.fill(); g.fillStyle = 'rgba(235,242,236,0.8)'; g.fillRect(x + 54, y + 33 + r * 38, 120 - r * 20, 10); }
          if (i === 3) { g.fillRect(x + 24, y + 16, 140, 10); }
        });
      }
    });
    if (done > 0) {
      const bx = 1400, by = 228, s = back(range(u, 1.75, 2.1));
      halo(g, bx, by, 110, LIME, 0.5 * done);
      g.fillStyle = rgba(LIME, 1); circle(g, bx, by, 40 * s); g.fill();
      g.strokeStyle = '#0b1205'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(bx - 16 * s, by + 1); g.lineTo(bx - 4 * s, by + 13 * s); g.lineTo(bx + 18 * s, by - 12 * s); g.stroke();
    }
  });
  PROJ_BLOCKS.forEach(([x, y, w, h], i) => {
    const t0 = 0.6 + i * 0.16, p = range(u, t0, t0 + 0.62);
    if (p <= 0 || p >= 1) return;
    const e = eio(p), p0 = [sx + 140, sy + 120 + i * 50], p3 = [x + w / 2, y + h / 2];
    const pt = bez(p0, [p0[0] + 120, p0[1] - 260], [p3[0] - 160, p3[1] - 260], p3, e);
    halo(g, pt[0], pt[1], 60, LIME, 0.5);
    g.fillStyle = rgba(LIME, 1); rr(g, pt[0] - lerp(40, 22, e), pt[1] - 6, lerp(80, 44, e), 12, 6); g.fill();
  });
  caption(g, 'Білім → нақты нәтиже', eo(range(u, 1.5, 1.9)));
}

const PEOPLE = (() => { const r = rng(33); return Array.from({ length: 7 }, (_, i) => { const a = -Math.PI / 2 + i / 7 * TAU + (r() - 0.5) * 0.3; return [800 + Math.cos(a) * 480 * (0.9 + r() * 0.15), 470 + Math.sin(a) * 300 * (0.9 + r() * 0.12)]; }); })();
const NET_EDGES = [...PEOPLE.map((_, i) => [-1, i, 0.15 + i * 0.11]), ...PEOPLE.map((_, i) => [i, (i + 1) % 7, 0.9 + i * 0.07]), [0, 3, 1.35], [2, 5, 1.42], [1, 4, 1.5]];
function person(g, x, y, r, c, fill) {
  g.fillStyle = fill; circle(g, x, y, r); g.fill();
  g.save(); circle(g, x, y, r - 2); g.clip();
  g.fillStyle = c; circle(g, x, y - r * 0.22, r * 0.25); g.fill(); circle(g, x, y + r * 0.62, r * 0.48); g.fill();
  g.restore();
}
function vNetwork(g, u) {
  const C0 = [800, 470];
  const lit = PEOPLE.map(() => 0);
  NET_EDGES.forEach(([a, b, t0]) => {
    const pa = a < 0 ? C0 : PEOPLE[a], pb = PEOPLE[b];
    const e = eo(range(u, t0, t0 + 0.38));
    if (e <= 0) return;
    lit[b] = Math.max(lit[b], eo(range(u, t0 + 0.3, t0 + 0.6)));
    const ra = a < 0 ? 64 : 46, d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]), ux = (pb[0] - pa[0]) / d, uy = (pb[1] - pa[1]) / d;
    const s = [pa[0] + ux * ra, pa[1] + uy * ra], en = [lerp(s[0], pb[0] - ux * 46, e), lerp(s[1], pb[1] - uy * 46, e)];
    g.strokeStyle = a < 0 ? rgba(LIME, 0.55) : rgba(CYAN, 0.35); g.lineWidth = a < 0 ? 4 : 3;
    g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(en[0], en[1]); g.stroke();
    if (a < 0 && u > 1.2) {
      const f = ((u - 1.2) * 0.75 + b * 0.143) % 1, pp = [lerp(s[0], pb[0] - ux * 46, f), lerp(s[1], pb[1] - uy * 46, f)];
      halo(g, pp[0], pp[1], 26, LIME, 0.6 * range(u, 1.2, 1.5)); g.fillStyle = rgba(LIME, range(u, 1.2, 1.5)); circle(g, pp[0], pp[1], 5); g.fill();
    }
  });
  PEOPLE.forEach((p, i) => {
    const ap = eo(range(u, -0.25 + i * 0.04, 0.2 + i * 0.04)), l = lit[i];
    alpha(g, ap, () => {
      if (l > 0) halo(g, p[0], p[1], 120, CYAN, 0.32 * l);
      person(g, p[0], p[1], 46, rgba(mix([110, 122, 134], [225, 245, 255], l), 1), '#0f151b');
      g.strokeStyle = rgba(mix([70, 80, 90], CYAN, l), 1); g.lineWidth = 3; circle(g, p[0], p[1], 46); g.stroke();
    });
  });
  halo(g, C0[0], C0[1], 190, LIME, 0.35);
  person(g, C0[0], C0[1], 64, rgba(LIME, 1), '#111a0b');
  g.strokeStyle = rgba(LIME, 1); g.lineWidth = 4; circle(g, C0[0], C0[1], 64); g.stroke();
  if (!MINI) txt(g, 'Сен', C0[0], C0[1] + 112, 36, 600, rgba(LIME, 1), 'center', FD);
  caption(g, 'Қолдау желісі', eo(range(u, 1.4, 1.8)));
}

const ACT_ROWS = ['Әрекет ет', 'Нәтижені өлше', 'Бағытты түзет'];
function vAct(g, u) {
  ACT_ROWS.forEach((s, i) => {
    const y = 300 + i * 150, ap = eo(range(u, -0.25 + i * 0.08, 0.2 + i * 0.08)), ck = eo(range(u, 0.2 + [0, 0.4, 1.05][i], 0.5 + [0, 0.4, 1.05][i]));
    alpha(g, ap, () => {
      g.fillStyle = ck > 0 ? rgba(LIME, ck) : 'rgba(255,255,255,0.04)'; rr(g, 200, y - 30, 64, 64, 16); g.fill();
      g.strokeStyle = ck > 0 ? rgba(LIME, 1) : 'rgba(255,255,255,0.25)'; g.lineWidth = 3; rr(g, 201.5, y - 28.5, 61, 61, 15); g.stroke();
      if (ck > 0) {
        g.strokeStyle = '#0b1205'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(216, y + 2);
        if (ck < 0.4) g.lineTo(216 + 12 * ck / 0.4, y + 2 + 12 * ck / 0.4); else { g.lineTo(228, y + 14); g.lineTo(228 + 22 * (ck - 0.4) / 0.6, y + 14 - 26 * (ck - 0.4) / 0.6); }
        g.stroke();
      }
      txt(g, s, 296, y + 14, 40, 600, rgba(mix([150, 160, 170], INK, ck), 1), 'left', FD);
    });
  });
  const S = [900, 760], T = [1330, 300], V = [1250, 640];
  alpha(g, eo(range(u, -0.2, 0.3)), () => {
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 2;
    for (let x = 860; x <= 1400; x += 90) { g.beginPath(); g.moveTo(x, 240); g.lineTo(x, 800); g.stroke(); }
    for (let y = 240; y <= 800; y += 80) { g.beginPath(); g.moveTo(860, y); g.lineTo(1400, y); g.stroke(); }
    g.setLineDash([10, 12]); g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 3; g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(T[0], T[1]); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,0.8)'; circle(g, S[0], S[1], 10); g.fill();
  });
  const reach = eo(range(u, 1.95, 2.3));
  halo(g, T[0], T[1], 130, LIME, 0.2 + 0.4 * reach);
  g.strokeStyle = 'rgba(230,240,230,0.9)'; g.lineWidth = 4; g.beginPath(); g.moveTo(T[0], T[1] + 30); g.lineTo(T[0], T[1] - 50); g.stroke();
  g.fillStyle = rgba(LIME, 1); g.beginPath(); g.moveTo(T[0], T[1] - 50); g.lineTo(T[0] + 52, T[1] - 34); g.lineTo(T[0], T[1] - 18); g.closePath(); g.fill();
  const seg1 = s => bez(S, [1080, 760], [1220, 700], V, s), seg2 = s => bez(V, [1290, 560], [1310, 420], T, s);
  const p1 = eio(range(u, 0.15, 1.0)), p2 = eio(range(u, 1.25, 2.0));
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = rgba(CYAN, 0.9); g.lineWidth = 6; g.beginPath();
  for (let i = 0; i <= 40 * p1; i++) { const p = seg1(i / 40); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
  g.stroke();
  const fix = eo(range(u, 1.0, 1.3));
  if (fix > 0) {
    halo(g, V[0], V[1], 70, LIME, 0.45 * fix);
    g.strokeStyle = rgba(LIME, fix); g.lineWidth = 3; circle(g, V[0], V[1], 22); g.stroke();
    if (!MINI) alpha(g, fix, () => txt(g, 'Түзету', V[0] + 34, V[1] + 54, 32, 600, rgba(LIME, 1)));
  }
  if (p2 > 0) {
    g.shadowColor = rgba(LIME, 0.8); g.shadowBlur = 22; g.strokeStyle = rgba(LIME, 1); g.lineWidth = 7; g.beginPath();
    for (let i = 0; i <= 40 * p2; i++) { const p = seg2(i / 40); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
    g.stroke(); g.shadowBlur = 0;
    const tip = seg2(p2), pr = seg2(Math.max(0, p2 - 0.03)), an = Math.atan2(tip[1] - pr[1], tip[0] - pr[0]);
    g.save(); g.translate(tip[0], tip[1]); g.rotate(an); g.fillStyle = rgba(LIME, 1); g.beginPath(); g.moveTo(16, 0); g.lineTo(-12, -13); g.lineTo(-12, 13); g.closePath(); g.fill(); g.restore();
  }
  if (!MINI) alpha(g, reach, () => txt(g, 'Келесі қадам', T[0] - 28, T[1] - 72, 34, 600, rgba(LIME, 1), 'right'));
  caption(g, 'Әрекет → бағалау → түзету', eo(range(u, 1.6, 2.0)));
}
const VISUALS = [vCompass, vTarget, vCalendar, vFocus, vSleep, vLearn, vNetwork, vAct];

function screenBG(g) {
  const gr = g.createLinearGradient(0, 0, 1600, 1000); gr.addColorStop(0, '#0b1117'); gr.addColorStop(1, '#05090c');
  g.fillStyle = gr; g.fillRect(0, 0, 1600, 1000);
  halo(g, 300, 120, 700, LIME, 0.05); halo(g, 1400, 950, 800, CYAN, 0.05);
  g.fillStyle = 'rgba(255,255,255,0.035)';
  for (let x = 40; x < 1600; x += 48) for (let y = 130; y < 1000; y += 48) g.fillRect(x, y, 2, 2);
}
function drawScreen(t) {
  const g = sctx;
  g.setTransform(scr.width / 1600, 0, 0, scr.height / 1000, 0, 0); g.globalAlpha = 1;
  screenBG(g);
  const k = clamp(Math.floor((t - STEP0 + 0.2) / SL), 0, 7);
  g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 96, 1600, 2);
  g.fillStyle = rgba(LIME, 1); circle(g, 62, 50, 9); g.fill();
  txt(g, 'Өзгеріс жоспары', 88, 61, 30, 600, 'rgba(225,232,238,0.85)');
  g.save(); g.beginPath(); g.rect(1300, 10, 280, 80); g.clip();
  for (let j = 0; j < 8; j++) {
    const bnd = j === 0 ? -99 : B(j) - 0.2, p = eio(range(t, bnd, bnd + 0.4)), pn = j < 7 ? eio(range(t, B(j + 1) - 0.2, B(j + 1) + 0.2)) : 0;
    const y = 61 + (1 - p) * 60 - pn * 60;
    if (p > 0 && pn < 1) txt(g, `${String(j + 1).padStart(2, '0')} / 08`, 1540, y, 30, 600, rgba(LIME, 1), 'right');
  }
  g.restore();
  for (let j = 0; j < 8; j++) {
    const u = t - B(j);
    if (u < -0.32 || (j < 7 && u > 2.82)) continue;
    const inA = j === 0 ? 1 : eo(range(u, -0.3, 0.3)), outA = j === 7 ? 1 : 1 - ei(range(u, 2.2, 2.8));
    const a = inA * outA;
    if (a <= 0.003) continue;
    g.save(); g.globalAlpha = a;
    const sc = lerp(0.94, 1, inA) * lerp(1.06, 1, outA), dx = (1 - inA) * 70 - (1 - outA) * 70;
    g.translate(800 + dx, 520); g.scale(sc, sc); g.translate(-800, -520);
    VISUALS[j](g, u);
    g.restore();
  }
  [3.95, ...[1, 2, 3, 4, 5, 6, 7].map(B)].forEach(b => {
    const p = range(t, b - 0.35, b + 0.5); if (p <= 0 || p >= 1) return;
    const x = lerp(-700, 2300, eio(p));
    g.save(); g.translate(x, 500); g.rotate(0.38);
    const gr = g.createLinearGradient(-260, 0, 260, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(235,255,210,${0.13 * Math.sin(p * Math.PI)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-260, -1200, 520, 2400); g.restore();
  });
}

/* ---------- background ---------- */
const FAR = (() => { const r = rng(3); return Array.from({ length: 120 }, () => ({ x: r() * W, y: r() * H, r: 0.8 + r() * 2.2, a: 0.12 + r() * 0.4, v: 4 + r() * 12, d: 0.3 + r() * 0.7, p: r() * TAU, c: r() < 0.5 ? LIME : CYAN })); })();
const BOKEH = (() => { const r = rng(9); return Array.from({ length: 11 }, () => ({ x: r() * W, y: 200 + r() * 1500, r: 14 + r() * 30, a: 0.05 + r() * 0.08, v: 6 + r() * 10, c: r() < 0.5 ? LIME : CYAN })); })();
const RIBBONS = [
  [[-200, 1700], [300, 1100], [700, 1500], [1300, 700]],
  [[-200, 500], [400, 800], [700, 300], [1300, 600]],
  [[-150, 1250], [350, 1500], [800, 900], [1300, 1150]],
];
function ribbonPts(rb) { return Array.from({ length: 80 }, (_, i) => bez(rb[0], rb[1], rb[2], rb[3], i / 79)); }
const RIB_PTS = RIBBONS.map(ribbonPts);
const COMETS = [[0.5, 0], ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => [B(k) - 0.55, k % 3]), [24.1, 0], [25.6, 2], [29.0, 1]];

function cam(t) {
  const NUDGE = [0, 5, -2, 4, -3, 3, -2, 1];
  let ry = -17;
  for (let k = 1; k < 8; k++) ry += (NUDGE[k] - NUDGE[k - 1]) * eio(range(t, B(k) - 0.4, B(k) + 0.5));
  ry += 1.5 * Math.sin(t * 0.3);
  return { ry, px: (ry + 17) * 6 };
}

function drawBG(t, c) {
  const g = bctx;
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#040608'; g.fillRect(0, 0, W, H);
  const on = 0.25 + 0.75 * ss(range(t, 0, 1.2));
  const fin = 1 - 0.35 * eio(range(t, 29, 30.5));
  halo(g, 170 + 60 * Math.sin(t * 0.21) - c.px * 0.3, 560 + 40 * Math.cos(t * 0.17), 1000, LIME, 0.15 * on * fin);
  halo(g, 920 + 50 * Math.cos(t * 0.19) - c.px * 0.3, 1430 + 60 * Math.sin(t * 0.15), 1080, CYAN, 0.14 * on * fin);
  const lapA = range(t, 3.5, 4.5) * (1 - range(t, 24, 25));
  halo(g, 540, 1080, 650, [140, 220, 170], 0.08 * on + 0.05 * lapA);
  // перспективалық еден торы
  const y0 = 1240, gridA = 0.065 * on * (1 - 0.6 * range(t, 24, 26));
  g.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    const d = 12 - ((i + t * 0.5) % 12);
    const y = y0 + 560 / d;
    if (y > H) continue;
    g.strokeStyle = `rgba(160,230,190,${gridA * clamp(1.2 - d / 12)})`;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  for (let j = -12; j <= 12; j++) {
    const xb = 540 + j * 190 - c.px * 1.2;
    const gr = g.createLinearGradient(0, y0 + 40, 0, H);
    gr.addColorStop(0, 'rgba(160,230,190,0)'); gr.addColorStop(1, `rgba(160,230,190,${gridA})`);
    g.strokeStyle = gr; g.beginPath(); g.moveTo(540 + (xb - 540) * 0.07, y0 + 40); g.lineTo(xb, H); g.stroke();
  }
  // жарық ағындары
  g.globalCompositeOperation = 'lighter';
  RIB_PTS.forEach((pts, ri) => {
    const a = 0.022 * on * (1 - 0.5 * range(t, 29, 31));
    [[140, a * 0.5], [60, a], [16, a * 1.6], [3, a * 4]].forEach(([w, al]) => {
      g.strokeStyle = rgba(ri % 2 ? CYAN : LIME, al); g.lineWidth = w; g.lineCap = 'round';
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] - c.px * 0.5, p[1]) : g.moveTo(p[0] - c.px * 0.5, p[1]))); g.stroke();
    });
  });
  COMETS.forEach(([t0, ri]) => {
    const p = range(t, t0, t0 + 1.1); if (p <= 0 || p >= 1) return;
    const pts = RIB_PTS[ri], head = eio(p), fade = Math.sin(p * Math.PI);
    for (let j = 0; j < 26; j++) {
      const f = head - j * 0.012; if (f < 0) break;
      const q = ptAt(pts, f);
      halo(g, q[0] - c.px * 0.5, q[1], lerp(70, 14, j / 26), ri % 2 ? CYAN : LIME, 0.16 * fade * (1 - j / 26));
    }
  });
  FAR.forEach(s => {
    const y = ((s.y - t * s.v * s.d) % H + H) % H, x = s.x - c.px * s.d * 0.8;
    const a = s.a * on * (0.7 + 0.3 * Math.sin(t * 0.8 + s.p));
    g.fillStyle = rgba(s.c, a); circle(g, x, y, s.r); g.fill();
  });
  g.globalCompositeOperation = 'source-over';
}

/* ---------- intro "8" → path → tracker ---------- */
const N8 = 420;
const EIGHT = (() => {
  const top = [540, 772, 142, 148], bot = [540, 1086, 170, 166];
  const ct = top[2] + top[3], cb = bot[2] + bot[3], ft = ct / (ct + cb), dense = [];
  for (let i = 0; i <= 1200; i++) {
    const s = i / 1200;
    if (s < ft) { const a = Math.PI / 2 + (s / ft) * TAU; dense.push([top[0] + Math.cos(a) * top[2], top[1] + Math.sin(a) * top[3]]); }
    else { const a = -Math.PI / 2 - ((s - ft) / (1 - ft)) * TAU; dense.push([bot[0] + Math.cos(a) * bot[2], bot[1] + Math.sin(a) * bot[3]]); }
  }
  return resample(dense, N8);
})();
const PATH_CTRL = [[214, 1470], [520, 1440], [806, 1372], [724, 1262], [430, 1202], [316, 1092], [560, 1014], [840, 944]];
const PATH = smoothPath(PATH_CTRL, N8);
const TRACK = (() => {
  const nd = PATH.nodes;
  return PATH.map((_, i) => {
    let k = 0; while (k < 6 && i > nd[k + 1]) k++;
    const f = clamp((i - nd[k]) / Math.max(1, nd[k + 1] - nd[k]));
    return [lerp(trackerX(k), trackerX(k + 1), f), TY];
  });
})();

function glowStroke(g, pts, n, width, a, grad) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  [[width * 5, a * 0.10], [width * 2.4, a * 0.22], [width, a]].forEach(([w, al], i) => {
    g.strokeStyle = i === 2 ? grad(1) : grad(al / Math.max(a, 1e-6)); g.globalAlpha = i === 2 ? a : al; g.lineWidth = w; strokePts(g, pts, 0, n);
  });
  g.globalAlpha = 1;
}
function limeCyan(g, y0, y1) { return k => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, rgba(CYAN, 1)); gr.addColorStop(1, rgba(LIME, 1)); return gr; }; }

function drawIntro(g, t) {
  if (t > 4.35) return;
  const zoom = 1 + 0.14 * eio(range(t, 0, 2.3));
  const m = range(t, 1.3, 2.5), m2 = range(t, 3.3, 4.25);
  const draw = eio(range(t, 0.08, 1.4));
  const pts = EIGHT.map((p, i) => {
    const q = [540 + (p[0] - 540) * zoom, 930 + (p[1] - 930) * zoom];
    const fr = i / (N8 - 1);
    const e1 = eio(clamp(m * 1.45 - fr * 0.45));
    let r = [lerp(q[0], PATH[i][0], e1), lerp(q[1], PATH[i][1], e1)];
    const e2 = eio(clamp(m2 * 1.35 - (1 - fr) * 0.35));
    return [lerp(r[0], TRACK[i][0], e2), lerp(r[1], TRACK[i][1], e2)];
  });
  const n = m > 0 ? N8 - 1 : draw * (N8 - 1);
  const fadeTo = range(t, 3.9, 4.3);
  g.save();
  glowStroke(g, pts, n, lerp(13, 3, eio(m2)), (1 - fadeTo) * lerp(1, 0.5, eio(m2)), limeCyan(g, 600, 1500));
  if (m === 0 && draw > 0 && draw < 1) { const hd = ptAt(pts, draw); halo(g, hd[0], hd[1], 90, LIME, 0.6); g.fillStyle = '#f6ffe0'; circle(g, hd[0], hd[1], 7); g.fill(); }
  PATH.nodes.forEach((ni, k) => {
    const ap = range(t, 2.0 + k * 0.09, 2.45 + k * 0.09);
    if (ap <= 0) return;
    const p = pts[ni], s = back(ap) * lerp(1, 0.9, eio(m2));
    halo(g, p[0], p[1], 60, LIME, 0.5 * ap * (1 - fadeTo));
    g.globalAlpha = 1 - fadeTo;
    g.fillStyle = rgba(LIME, 1); circle(g, p[0], p[1], 10 * s); g.fill();
    g.fillStyle = '#0b1205'; circle(g, p[0], p[1], 3.5 * s); g.fill();
    g.globalAlpha = 1;
  });
  g.restore();
}

function drawTracker(g, t) {
  const a = range(t, 3.9, 4.3) * (1 - range(t, 24.0, 24.45));
  if (a <= 0) return;
  g.save(); g.globalAlpha = a;
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(trackerX(0), TY); g.lineTo(trackerX(7), TY); g.stroke();
  let fx = trackerX(0);
  for (let k = 1; k < 8; k++) { const p = eio(range(t, B(k) - 0.35, B(k) + 0.1)); if (p > 0) fx = lerp(trackerX(k - 1), trackerX(k), p); }
  g.shadowColor = rgba(LIME, 0.9); g.shadowBlur = 16; g.strokeStyle = rgba(LIME, 1); g.lineWidth = 4;
  g.beginPath(); g.moveTo(trackerX(0), TY); g.lineTo(fx, TY); g.stroke(); g.shadowBlur = 0;
  const cur = clamp(Math.floor((t - STEP0 + 0.05) / SL), 0, 7);
  for (let k = 0; k < 8; k++) {
    const x = trackerX(k), act = eo(range(t, B(k) - 0.06, B(k) + 0.22));
    if (k === cur && act > 0) {
      const pp = range(t, B(k), B(k) + 0.9);
      g.strokeStyle = rgba(LIME, 0.7 * (1 - pp)); g.lineWidth = 2.5; circle(g, x, TY, 10 + 22 * eo(pp)); g.stroke();
      g.strokeStyle = rgba(LIME, 0.45); g.lineWidth = 2; circle(g, x, TY, 17); g.stroke();
    }
    if (act > 0) halo(g, x, TY, 46, LIME, 0.45 * act);
    g.fillStyle = act > 0 ? rgba(mix([11, 15, 19], LIME, act), 1) : '#0b0f13'; circle(g, x, TY, lerp(8, 10, act)); g.fill();
    g.strokeStyle = act > 0 ? rgba(LIME, 1) : 'rgba(255,255,255,0.35)'; g.lineWidth = 2.5; g.stroke();
    if (act > 0) { g.fillStyle = '#0b1205'; circle(g, x, TY, 3.5 * act); g.fill(); }
    txt(g, String(k + 1), x, TY + 50, 24, 600, act > 0.5 ? 'rgba(235,242,236,0.95)' : 'rgba(150,162,174,0.7)', 'center');
  }
  g.restore();
}

/* ---------- unify & final ---------- */
const TILES = [[300, 1436, 1.0], [700, 1380, 0.95], [810, 1224, 0.9], [452, 1172, 0.86], [292, 1028, 0.82], [622, 990, 0.78], [790, 860, 0.74], [512, 800, 0.7]];
const TW = 260, TH = 163;
const SUMMIT = [560, 690];
const TILE_PATH = smoothPath([[150, 1500], ...TILES.map(p => [p[0], p[1]]), SUMMIT], 300);
let tileImgs = null;
function makeTiles() {
  if (tileImgs) return tileImgs;
  const big = document.createElement('canvas'); big.width = 1600; big.height = 1000;
  const bg = big.getContext('2d');
  MINI = true;
  tileImgs = VISUALS.map((v, k) => {
    bg.setTransform(1, 0, 0, 1, 0, 0); bg.globalAlpha = 1; screenBG(bg);
    bg.save(); bg.translate(800, 520); bg.scale(1.12, 1.12); bg.translate(-800, -560); v(bg, 2.4); bg.restore();
    const c = document.createElement('canvas'); c.width = 480; c.height = 300;
    const cg = c.getContext('2d'); cg.imageSmoothingQuality = 'high'; cg.drawImage(big, 0, 0, 480, 300);
    return c;
  });
  MINI = false;
  return tileImgs;
}
function groupXf(t) { const r = eio(range(t, 25.0, 29.0)); return { dy: 46 * r, s: 1 + 0.035 * r }; }
function xf(p, gx) { return [540 + (p[0] - 540) * gx.s, 1100 + (p[1] - 1100) * gx.s + gx.dy]; }

function drawUnify(g, t) {
  if (t < 23.95) return;
  const imgs = makeTiles(), gx = groupXf(t);
  const pathA = 1 - range(t, 28.9, 29.5);
  const dp = eio(range(t, 24.85, 26.1));
  if (dp > 0 && pathA > 0) {
    const pts = TILE_PATH.map(p => xf(p, gx));
    g.save();
    glowStroke(g, pts, dp * (pts.length - 1), 6, 0.95 * pathA, limeCyan(g, 700, 1500));
    const lp = range(t, 26.1, 27.7);
    if (lp > 0 && lp < 1) for (let j = 0; j < 20; j++) { const f = eio(lp) - j * 0.01; if (f < 0) break; const q = ptAt(pts, f); halo(g, q[0], q[1], lerp(50, 10, j / 20), [235, 255, 200], 0.55 * Math.sin(lp * Math.PI) * (1 - j / 20)); }
    g.restore();
  }
  TILES.forEach((tp, k) => {
    const s0 = 24.0 + k * 0.08, p = eio(range(t, s0, s0 + 0.95));
    if (p <= 0) return;
    const out = eio(range(t, 28.75 + k * 0.05, 29.3 + k * 0.05));
    if (out >= 1) return;
    const from = [trackerX(k), TY], to = xf([tp[0], tp[1]], gx);
    const x = lerp(from[0], to[0], p), y = lerp(from[1], to[1], p) - 110 * Math.sin(p * Math.PI);
    const g2 = eo(range(p, 0.25, 1)), sc = tp[2] * gx.s * lerp(1, 0.6, out);
    const w = lerp(20, TW * sc, g2), h = lerp(20, TH * sc, g2), r = lerp(10, 16 * sc, g2);
    g.save(); g.globalAlpha = 1 - out;
    halo(g, x, y, Math.max(w, h) * 0.9, k % 2 ? CYAN : LIME, 0.18 + 0.3 * (1 - g2));
    g.fillStyle = rgba(mix(LIME, [8, 12, 15], g2), 1); rr(g, x - w / 2, y - h / 2, w, h, r); g.fill();
    const ia = range(p, 0.55, 1);
    if (ia > 0) { g.save(); rr(g, x - w / 2, y - h / 2, w, h, r); g.clip(); g.globalAlpha *= ia; g.drawImage(imgs[k], x - w / 2, y - h / 2, w, h); g.restore(); }
    const bg2 = g.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
    bg2.addColorStop(0, rgba(LIME, 0.85)); bg2.addColorStop(1, rgba(CYAN, 0.6));
    g.strokeStyle = bg2; g.lineWidth = 2; rr(g, x - w / 2, y - h / 2, w, h, r); g.stroke();
    if (g2 > 0.6) {
      const ba = range(g2, 0.6, 1), bx = x - w / 2 + 4, by = y - h / 2 + 4;
      g.globalAlpha *= ba;
      g.fillStyle = rgba(LIME, 1); circle(g, bx, by, 21 * sc); g.fill();
      txt(g, String(k + 1).padStart(2, '0'), bx, by + 7.5 * sc, 21 * sc, 700, '#0b1205', 'center', FD);
    }
    g.restore();
  });
  // шың нүктесі → соңғы «бір қадам»
  const sa = eo(range(t, 25.95, 26.35));
  if (sa > 0) {
    const sp = xf(SUMMIT, gx), mv = eio(range(t, 29.0, 29.9));
    const STAIR = [[372, 1272], [540, 1272], [540, 1186], [708, 1186]];
    const startP = STAIR[0];
    let pos = [lerp(sp[0], startP[0], mv), lerp(sp[1], startP[1], mv)];
    const walk = eio(range(t, 30.0, 30.95));
    const drawn = eio(range(t, 29.55, 30.05));
    if (drawn > 0) {
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 4;
      const segs = [[STAIR[0], STAIR[1]], [STAIR[1], STAIR[2]], [STAIR[2], STAIR[3]]], lens = [168, 86, 168], tot = 422;
      const along = (f) => { let d = f * tot; for (let i = 0; i < 3; i++) { if (d <= lens[i] || i === 2) { const r = clamp(d / lens[i]); return [lerp(segs[i][0][0], segs[i][1][0], r), lerp(segs[i][0][1], segs[i][1][1], r), i]; } d -= lens[i]; } };
      const drawPoly = (f) => { g.beginPath(); g.moveTo(STAIR[0][0], STAIR[0][1]); const e = along(f); for (let i = 1; i <= e[2]; i++) g.lineTo(STAIR[i][0], STAIR[i][1]); g.lineTo(e[0], e[1]); g.stroke(); };
      drawPoly(drawn);
      if (walk > 0) { g.shadowColor = rgba(LIME, 0.9); g.shadowBlur = 18; g.strokeStyle = rgba(LIME, 1); g.lineWidth = 6; drawPoly(walk); g.shadowBlur = 0; const e = along(walk); pos = [e[0], e[1]]; }
      g.restore();
    }
    const done = eo(range(t, 30.85, 31.3));
    halo(g, pos[0], pos[1], 90 + 30 * done, LIME, 0.55 * sa);
    g.fillStyle = rgba(LIME, sa); circle(g, pos[0], pos[1], 13 * back(range(t, 25.95, 26.35))); g.fill();
    g.fillStyle = rgba([11, 18, 5], sa); circle(g, pos[0], pos[1], 4.5); g.fill();
    if (done > 0) { g.strokeStyle = rgba(LIME, 0.6 * (1 - range(t, 30.9, 31.8))); g.lineWidth = 2.5; circle(g, pos[0], pos[1], 16 + 34 * eo(range(t, 30.9, 31.8))); g.stroke(); }
  }
}

function drawBokeh(g, t, c) {
  const on = ss(range(t, 0.3, 1.8)) * (1 - 0.6 * range(t, 29, 30.5));
  g.save(); g.globalCompositeOperation = 'lighter';
  BOKEH.forEach(b => {
    const y = ((b.y - t * b.v) % H + H) % H, x = b.x - c.px * 1.6;
    halo(g, x, y, b.r * 2.2, b.c, b.a * on);
  });
  g.restore();
}

/* ---------- laptop pose ---------- */
function poseLaptop(t, c) {
  const a = eio(range(t, 3.4, 4.65)), d = eio(range(t, 23.8, 24.9));
  const push = eio(range(t, 4.0, 24.0));
  const z = lerp(-1300, 0, a) + 110 * push - 700 * d;
  const y = lerp(1370, 1134, a) + 14 * Math.sin(t * 0.5) + 160 * d;
  const x = 540 + lerp(80, 0, a) - c.px * 0.4;
  const ry = c.ry + lerp(-24, 0, a) + 10 * d, rx = -15 + lerp(-8, 0, a) - 6 * d;
  lap.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) scale(0.76)`;
  world.style.opacity = (a * (1 - range(t, 24.1, 24.85))).toFixed(3);
  world.style.visibility = a > 0 && t < 24.9 ? 'visible' : 'hidden';
}

/* ---------- grain ---------- */
const grainFrames = [];
function setupGrain() {
  const c = $('grain'), g = c.getContext('2d'), r = rng(77);
  for (let f = 0; f < 4; f++) {
    const im = g.createImageData(540, 960);
    for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    grainFrames.push(im);
  }
}

/* ---------- main ---------- */
function renderFrame(t) {
  t = clamp(t, 0, DUR);
  const c = cam(t);
  drawBG(t, c);
  if (t > 3.3 && t < 24.95) drawScreen(t);
  poseLaptop(t, c);
  const g = fctx; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  drawIntro(g, t);
  drawTracker(g, t);
  drawUnify(g, t);
  drawBokeh(g, t, c);
  animBlocks(t);
  $('grain').getContext('2d').putImageData(grainFrames[Math.round(t * FPS) % 4], 0, 0);
}

window.renderFrame = renderFrame;
window.SCENE = { W, H, FPS, DUR };
window.__ready = (async () => {
  setupLaptop(); setupText(); setupGrain();
  await Promise.all(['700 100px "Inter Display"', '600 100px "Inter Display"', '400 40px Inter', '500 40px Inter', '600 40px Inter']
    .map(f => document.fonts.load(f, 'ӘәҒғҚқҢңӨөҰұҮүҺһІі')));
  await document.fonts.ready;
  fitBlocks();
  makeTiles();
  const q = new URLSearchParams(location.search);
  if (q.has('t')) renderFrame(parseFloat(q.get('t')));
  else if (!q.has('render')) { const t0 = performance.now(); const loop = () => { renderFrame(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); }
  return true;
})();
