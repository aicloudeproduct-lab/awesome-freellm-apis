// Deterministic frame renderer: static server + headless Chromium (SwiftShader WebGL).
//   node tools/render.mjs --entry app --t 1.5,10 --out build/stills/a.jpg,build/stills/b.jpg [--w 1080]
//   node tools/render.mjs --entry app --from 0 --to 2880 --pipe build/video.mp4 [--w 2160]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MIME = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav'};
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const W = +arg('w', '2160');
const H = Math.round((W * 16) / 9);
const FPS = 24;
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none', '--disable-gpu-vsync'],
});
const page = await browser.newPage({viewport: {width: W, height: H}, deviceScaleFactor: 1});
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.error('console:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/web/index.html?w=${W}&entry=${arg('entry', 'app')}&${arg('flags', '')}`);
await page.evaluate(() => window.__ready);
const shot = async (fmt) => page.screenshot({type: fmt, quality: fmt === 'jpeg' ? 94 : undefined, clip: {x: 0, y: 0, width: W, height: H}});

if (arg('pipe')) {
  const from = +arg('from', '0');
  const to = +arg('to', '2880');
  // --alpha: transparent PNG frames (text layer) into a PNG-in-MOV with alpha
  const alpha = !!arg('alpha');
  const step = +arg('step', '1');
  const enc = alpha ? ['-c:v', 'png', '-pix_fmt', 'rgba'] : ['-c:v', 'libx264', '-preset', arg('preset', 'medium'), '-crf', arg('crf', '16'), '-pix_fmt', 'yuv420p'];
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS / step), '-c:v', alpha ? 'png' : 'mjpeg', '-i', '-',
    ...enc, '-r', String(FPS / step), arg('pipe')], {stdio: ['pipe', 'inherit', 'inherit']});
  const t0 = Date.now();
  for (let f = from; f < to; f += step) {
    await page.evaluate((t) => window.renderFrame(t), f / FPS);
    const buf = alpha ? await page.screenshot({type: 'png', omitBackground: true, clip: {x: 0, y: 0, width: W, height: H}}) : await shot('jpeg');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - from) % (24 * step) === 0) console.log(`frame ${f} (${((Date.now() - t0) / ((f - from) / step + 1)).toFixed(0)} ms/frame)`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
} else {
  const ts = arg('t', '0').split(',').map(Number);
  const outs = arg('out', '').split(',');
  for (let i = 0; i < ts.length; i++) {
    const t0 = Date.now();
    const name = await page.evaluate((t) => { const a = performance.now(); const n = window.renderFrame(t); const px = new Uint8Array(4); window.__gl.readPixels(0, 0, 1, 1, window.__gl.RGBA, window.__gl.UNSIGNED_BYTE, px); return n + ' js+gpu=' + Math.round(performance.now() - a); }, ts[i]);
    const t1 = Date.now();
    const out = outs[i] || `build/stills/t_${ts[i].toFixed(2).padStart(6, '0')}.jpg`;
    fs.mkdirSync(path.dirname(path.join(ROOT, out)), {recursive: true});
    fs.writeFileSync(path.join(ROOT, out), await shot(out.endsWith('.png') ? 'png' : 'jpeg'));
    console.log('ok', ts[i], name, out, 'eval', t1 - t0, 'shot', Date.now() - t1, 'ms');
  }
}
await browser.close();
server.close();
