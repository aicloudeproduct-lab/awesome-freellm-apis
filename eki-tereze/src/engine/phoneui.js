// Phone screen drawn on a canvas each frame (Kazakh UI). States:
// compose (typing / deleting), feed (Ayan's posts), call, notify/message, photo.
import * as THREE from 'three';
import {clamp, easeIO, lerp} from '../lib/util.js';

export const FONT = 'NotoSansKZ';
const W = 540, H = 1170;

export const POST_TEXT = 'Барлығы мақтайтын «шебер» сәулетші Аянның шын жүзін білесіздер ме? Оның табысы — еңбек емес, таныстық пен сәттілік қана. Мен оны бала кезінен білемін…';
export const CONGRATS_TEXT = 'Құттықтаймын, досым! Шын жүректен қуаныштымын.';

function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  const lines = [];
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  for (const l of lines) { g.fillText(l, x, yy); yy += lh; }
  return {y: yy, last: lines[lines.length - 1] || '', lines};
}

function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

/** Simple illustrated "photos" for Ayan's feed. */
function photo(g, kind, x, y, w, h, extra) {
  g.save(); roundRect(g, x, y, w, h, 18); g.clip();
  if (kind === 'award' && extra?.img) { g.drawImage(extra.img, x, y, w, h); g.restore(); return; }
  const sky = g.createLinearGradient(0, y, 0, y + h);
  if (kind === 'house') { sky.addColorStop(0, '#9cc3e6'); sky.addColorStop(1, '#e8f1f7'); }
  else if (kind === 'car') { sky.addColorStop(0, '#d9d2c4'); sky.addColorStop(1, '#a8a092'); }
  else { sky.addColorStop(0, '#f2d9b0'); sky.addColorStop(1, '#e0b98a'); }
  g.fillStyle = sky; g.fillRect(x, y, w, h);
  if (kind === 'house') {
    g.fillStyle = '#6c9a52'; g.fillRect(x, y + h * 0.78, w, h * 0.22);
    g.fillStyle = '#efe9df'; g.fillRect(x + w * 0.2, y + h * 0.38, w * 0.6, h * 0.42);
    g.fillStyle = '#5b4a42'; g.beginPath(); g.moveTo(x + w * 0.14, y + h * 0.4); g.lineTo(x + w * 0.5, y + h * 0.14); g.lineTo(x + w * 0.86, y + h * 0.4); g.fill();
    g.fillStyle = '#7fa6c8'; for (let i = 0; i < 3; i++) g.fillRect(x + w * (0.27 + i * 0.17), y + h * 0.48, w * 0.1, h * 0.12);
    g.fillStyle = '#6e4a32'; g.fillRect(x + w * 0.46, y + h * 0.62, w * 0.09, h * 0.18);
  } else if (kind === 'car') {
    g.fillStyle = '#3d4248'; roundRect(g, x + w * 0.12, y + h * 0.48, w * 0.76, h * 0.2, 26); g.fill();
    roundRect(g, x + w * 0.26, y + h * 0.34, w * 0.46, h * 0.2, 30); g.fill();
    g.fillStyle = '#9fb3c4'; roundRect(g, x + w * 0.3, y + h * 0.37, w * 0.38, h * 0.12, 18); g.fill();
    g.fillStyle = '#151515'; for (const cx of [0.28, 0.72]) { g.beginPath(); g.arc(x + w * cx, y + h * 0.7, h * 0.08, 0, 7); g.fill(); }
  } else if (kind === 'family') {
    const person = (cx, s, c) => { g.fillStyle = '#e8c09a'; g.beginPath(); g.arc(x + w * cx, y + h * (0.42 - s * 0.12), h * 0.07 * s, 0, 7); g.fill(); g.fillStyle = c; roundRect(g, x + w * cx - h * 0.09 * s, y + h * (0.5 - s * 0.1), h * 0.18 * s, h * 0.5, 30); g.fill(); };
    person(0.3, 1.1, '#c8b897'); person(0.52, 1.0, '#9b6a7a'); person(0.7, 0.7, '#6b9ac8');
  }
  g.restore();
}

export class PhoneUI {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = W; this.c.height = H;
    this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.awardImg = null;
  }

  statusBar(g, dark = true, time = '23:47') {
    g.fillStyle = dark ? '#e9edf2' : '#20242a'; g.font = `600 24px ${FONT}`;
    g.fillText(time, 40, 50);
    g.fillRect(W - 92, 32, 44, 20); g.fillStyle = dark ? '#0f1216' : '#ffffff'; g.fillRect(W - 88, 36, 30, 12);
  }

  /** state: {mode, typed (0..1), feedScroll (px), callT, notifyT, msgTyped, dim, time} */
  draw(st) {
    const g = this.g;
    const dark = st.mode !== 'message';
    g.fillStyle = dark ? '#0f1216' : '#f4f5f7'; g.fillRect(0, 0, W, H);
    this.statusBar(g, dark, st.time || '23:47');
    if (st.mode === 'compose') this.compose(g, st);
    else if (st.mode === 'feed') this.feed(g, st);
    else if (st.mode === 'call') this.call(g, st);
    else if (st.mode === 'message') this.message(g, st);
    else if (st.mode === 'photo') { photo(g, 'award', 0, 0, W, H, {img: this.awardImg}); }
    else if (st.mode === 'off') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
    if (st.dim) { g.fillStyle = `rgba(0,0,0,${st.dim})`; g.fillRect(0, 0, W, H); }
    this.tex.needsUpdate = true;
  }

  compose(g, st) {
    g.fillStyle = '#e9edf2'; g.font = `600 30px ${FONT}`; g.fillText('Жаңа жазба', 40, 120);
    g.fillStyle = '#7a8594'; g.font = `400 26px ${FONT}`; g.fillText('Бас тарту', W - 160, 120);
    g.fillStyle = '#2a2f37'; g.fillRect(0, 150, W, 2);
    // avatar + name
    g.fillStyle = '#3f515b'; g.beginPath(); g.arc(72, 214, 32, 0, 7); g.fill();
    g.fillStyle = '#e9edf2'; g.font = `600 26px ${FONT}`; g.fillText('Арман С.', 118, 206);
    g.fillStyle = '#7a8594'; g.font = `400 22px ${FONT}`; g.fillText('Барлығына көрінеді', 118, 238);
    const n = Math.round(POST_TEXT.length * clamp(st.typed ?? 1));
    const txt = POST_TEXT.slice(0, n);
    g.fillStyle = '#f2f4f7'; g.font = `400 31px ${FONT}`;
    const r = wrap(g, txt, 40, 310, W - 80, 44);
    // cursor
    if ((st.t * 2) % 1 < 0.6) { const lw = g.measureText(r.last).width; g.fillStyle = '#4c8dff'; g.fillRect(40 + lw + 3, r.y - 44 - 26, 3, 36); }
    // publish button
    const hover = st.hover ?? 0;
    g.fillStyle = n > 10 ? `rgb(${lerp(46, 80, hover)},${lerp(110, 150, hover)},${lerp(230, 255, hover)})` : '#27406b';
    roundRect(g, W - 230, 700, 190, 64, 32); g.fill();
    g.fillStyle = '#ffffff'; g.font = `600 27px ${FONT}`; g.fillText('Жариялау', W - 198, 742);
    // keyboard
    g.fillStyle = '#1b1f25'; g.fillRect(0, 800, W, H - 800);
    const rows = ['йцукенгшщзх', 'фывапролджә', 'ячсмитьбюңғ', 'өқүұһі'];
    g.font = `500 26px ${FONT}`;
    rows.forEach((row, ri) => {
      const kw = (W - 20) / 11;
      [...row].forEach((ch, ci) => {
        const x = 10 + ci * kw + (11 - row.length) * kw / 2, y = 820 + ri * 82;
        const pressed = st.key && st.key === ri * 11 + ci;
        g.fillStyle = pressed ? '#5a6474' : '#2f353e'; roundRect(g, x + 3, y, kw - 6, 70, 10); g.fill();
        g.fillStyle = '#dfe4ea'; g.fillText(ch, x + kw / 2 - 9, y + 46);
      });
    });
  }

  feed(g, st) {
    g.fillStyle = '#e9edf2'; g.font = `700 32px ${FONT}`; g.fillText('Аян Нұрланұлы', 40, 125);
    g.fillStyle = '#7a8594'; g.font = `400 22px ${FONT}`; g.fillText('сәулетші · 12,4 мың оқырман', 40, 160);
    g.save(); g.beginPath(); g.rect(0, 185, W, H - 185); g.clip();
    const posts = [
      {kind: 'award', cap: 'Жылдың үздік жобасы! Командама рахмет.'},
      {kind: 'house', cap: 'Жаңа үйіміз дайын.'},
      {kind: 'car', cap: 'Жол жақсы болсын!'},
      {kind: 'family', cap: 'Отбасыммен демалыста.'},
    ];
    let y = 200 - (st.scroll || 0);
    for (const p of posts) {
      photo(g, p.kind, 30, y, W - 60, 520, {img: this.awardImg});
      g.fillStyle = '#e9edf2'; g.font = `400 26px ${FONT}`; g.fillText(p.cap, 34, y + 565);
      g.fillStyle = '#7a8594'; g.font = `400 22px ${FONT}`; g.fillText('♥ 2 ' + (318 + p.cap.length * 7) + '   ·   жауаптар', 34, y + 602);
      y += 660;
    }
    g.restore();
  }

  call(g, st) {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1d2a36'); gr.addColorStop(1, '#0d1116');
    g.fillStyle = gr; g.fillRect(0, 60, W, H);
    const pulse = 1 + 0.06 * Math.sin((st.t || 0) * 9);
    g.fillStyle = '#c8b897'; g.beginPath(); g.arc(W / 2, 360, 96 * pulse, 0, 7); g.fill();
    g.fillStyle = '#2a2320'; g.font = `700 90px ${FONT}`; g.fillText('А', W / 2 - 30, 392);
    g.fillStyle = '#ffffff'; g.font = `600 46px ${FONT}`; const nm = 'Аян'; g.fillText(nm, W / 2 - g.measureText(nm).width / 2, 560);
    g.fillStyle = '#9aa7b5'; g.font = `400 26px ${FONT}`; const s = 'қоңырау шалуда…'; g.fillText(s, W / 2 - g.measureText(s).width / 2, 608);
    g.fillStyle = '#e0473f'; g.beginPath(); g.arc(150, 960, 56, 0, 7); g.fill();
    g.fillStyle = '#3cb35a'; g.beginPath(); g.arc(W - 150, 960, 56, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.font = `400 22px ${FONT}`; g.fillText('Қабылдамау', 92, 1060); g.fillText('Жауап беру', W - 210, 1060);
  }

  message(g, st) {
    g.fillStyle = '#ffffff'; g.fillRect(0, 70, W, 110);
    g.fillStyle = '#c8b897'; g.beginPath(); g.arc(80, 125, 32, 0, 7); g.fill();
    g.fillStyle = '#20242a'; g.font = `600 28px ${FONT}`; g.fillText('Аян', 128, 135);
    // incoming bubble
    const inc = 'Досым, жаңа жобамыз бас жүлде алды! Сенің кеңесің көп көмектесті.';
    g.font = `400 27px ${FONT}`;
    const ia = clamp((st.notifyT ?? 1) * 3);
    g.globalAlpha = ia;
    g.fillStyle = '#e4e7ec'; roundRect(g, 30, 230, W - 130, 170, 26); g.fill();
    g.fillStyle = '#20242a'; wrap(g, inc, 52, 278, W - 180, 38);
    g.globalAlpha = 1;
    const n = Math.round(CONGRATS_TEXT.length * clamp(st.typed ?? 0));
    if (st.sent) {
      g.fillStyle = '#2f6ee6'; roundRect(g, 110, 440, W - 140, 130, 26); g.fill();
      g.fillStyle = '#ffffff'; wrap(g, CONGRATS_TEXT, 132, 488, W - 190, 38);
    }
    // input
    g.fillStyle = '#ffffff'; roundRect(g, 24, 720, W - 48, 70, 35); g.fill();
    g.fillStyle = '#20242a'; g.font = `400 25px ${FONT}`;
    const shown = st.sent ? '' : CONGRATS_TEXT.slice(0, n);
    const r = wrap(g, shown || ' ', 48, 765, W - 110, 34);
    if (!st.sent && ((st.t || 0) * 2) % 1 < 0.6) { g.fillStyle = '#2f6ee6'; g.fillRect(48 + g.measureText(r.last).width + 2, 742, 3, 32); }
    g.fillStyle = '#d6d9de'; g.fillRect(0, 810, W, H - 810);
  }
}
