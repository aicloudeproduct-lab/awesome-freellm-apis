// Typography on the 2D overlay: subtitles (synced to voice parts), the title
// card and the closing thought. Sizes are for 2160×3840 and scale with W.
import {clamp, easeOut, smooth} from '../lib/util.js';
import {FONT} from './phoneui.js';

export function loadFont(url) {
  const face = new FontFace(FONT, `url(${url}) format('truetype')`, {weight: '100 900'});
  return face.load().then((f) => { document.fonts.add(f); return Promise.all([300, 400, 500, 600, 700].map((w) => document.fonts.load(`${w} 40px ${FONT}`, 'ӘҒҚҢӨҰҮҺІ'))); });
}

/** Active subtitle cues from voice.json (each part becomes a cue). */
export function buildCues(voice, hide = []) {
  const cues = [];
  for (const [id, v] of Object.entries(voice)) {
    v.parts.forEach((p, i) => {
      if (hide.includes(`${id}:${i}`)) return;
      cues.push({t0: v.at + p.t0 - 0.06, t1: v.at + p.t1 + 0.3, text: p.text, who: v.who});
    });
  }
  cues.sort((a, b) => a.t0 - b.t0);
  // never overlap: trim a cue when the next one starts
  for (let i = 0; i < cues.length - 1; i++) cues[i].t1 = Math.min(cues[i].t1, cues[i + 1].t0 - 0.02);
  return cues;
}

function wrapLines(ctx, text, maxW) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  // balance two lines
  if (lines.length === 2) {
    const all = text.split(' ');
    let best = null;
    for (let k = 1; k < all.length; k++) { const a = all.slice(0, k).join(' '), b = all.slice(k).join(' '); const d = Math.abs(ctx.measureText(a).width - ctx.measureText(b).width); if (ctx.measureText(a).width <= maxW && ctx.measureText(b).width <= maxW && (!best || d < best.d)) best = {a, b, d}; }
    if (best) return [best.a, best.b];
  }
  return lines;
}

export function drawSubtitles(ctx, cues, t, W, H, opts = {}) {
  const s = W / 2160;
  for (const c of cues) {
    if (t < c.t0 || t > c.t1) continue;
    const a = smooth(c.t0, c.t0 + 0.14, t) * (1 - smooth(c.t1 - 0.16, c.t1, t));
    const size = 74 * s;
    ctx.font = `500 ${size}px ${FONT}`;
    const lines = wrapLines(ctx, c.text, 1720 * s);
    const lh = size * 1.32;
    const baseY = (opts.y ?? 3080) * s;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    lines.forEach((ln, i) => {
      const y = baseY + i * lh - (lines.length - 1) * lh * 0.5;
      const w = ctx.measureText(ln).width;
      ctx.fillStyle = 'rgba(8,10,14,0.42)';
      ctx.beginPath(); ctx.roundRect(W / 2 - w / 2 - 30 * s, y - size * 0.98, w + 60 * s, size * 1.34, 18 * s); ctx.fill();
      ctx.fillStyle = c.who === 'narrator' ? '#f3ede2' : '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10 * s;
      ctx.fillText(ln, W / 2, y);
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }
}

export function drawTitle(ctx, t, t0, t1, W, H) {
  if (t < t0 || t > t1) return;
  const s = W / 2160, p = (t - t0) / (t1 - t0);
  const a = smooth(0, 0.18, p) * (1 - smooth(0.78, 1, p));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  const title = 'ЕКІ ТЕРЕЗЕ';
  const size = 190 * s, track = (0.32 + 0.06 * easeOut(p)) * size;
  ctx.font = `300 ${size}px ${FONT}`;
  // manual letter spacing
  const chars = [...title];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((x, y) => x + y, 0) + track * (chars.length - 1);
  let x = W / 2 - total / 2;
  const y = 1500 * s - 30 * s * easeOut(p);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fbf6ec';
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30 * s;
  chars.forEach((ch, i) => { ctx.fillText(ch, x, y); x += widths[i] + track; });
  ctx.shadowBlur = 0;
  const lw = 520 * s * easeOut(clamp(p * 1.6));
  ctx.fillStyle = 'rgba(251,246,236,0.75)';
  ctx.fillRect(W / 2 - lw / 2, y + 90 * s, lw, 3 * s);
  ctx.font = `400 ${58 * s}px ${FONT}`; ctx.textAlign = 'center';
  ctx.globalAlpha = a * smooth(0.25, 0.45, p);
  ctx.fillText('қысқаметражды фильм', W / 2, y + 200 * s);
  ctx.restore();
}

/** Closing thought: two lines appear word by word. */
export function drawThought(ctx, t, t0, t1, W, H, lines) {
  if (t < t0) return;
  const s = W / 2160;
  const fadeOut = 1 - smooth(t1 - 0.5, t1, t);
  ctx.save(); ctx.textAlign = 'center';
  lines.forEach((ln, li) => {
    const words = ln.text.split(' ');
    ctx.font = `${ln.weight} ${ln.size * s}px ${FONT}`;
    const full = ctx.measureText(ln.text).width;
    let x = W / 2 - full / 2;
    words.forEach((w, wi) => {
      const ws = ln.at + wi * ln.step;
      const a = smooth(ws, ws + 0.45, t) * fadeOut;
      const ww = ctx.measureText(w + ' ').width;
      ctx.globalAlpha = a;
      ctx.fillStyle = ln.color || '#fbf6ec';
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24 * s;
      ctx.textAlign = 'left';
      ctx.fillText(w, x, ln.y * s - 16 * s * (1 - easeOut(clamp((t - ws) / 0.6))));
      x += ww;
    });
  });
  ctx.restore();
}
