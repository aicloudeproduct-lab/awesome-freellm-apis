// Толық фильм кадрлары: frames/f_0000.jpg … (бар кадрлар өткізіледі — үзілсе, қайта іске қосқанда жалғасады).
// node tools/render_film.mjs [--workers 3] [--from 0] [--to 2699] [--fps 30] [--q 96]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const pw = require('/opt/node-tools/node_modules/playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MIME = {'.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf'};
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'}); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const fps = +arg('fps', 30), from = +arg('from', 0), to = +arg('to', 2699), workers = +arg('workers', 3), quality = +arg('q', 96), flags = arg('flags', 'noao');
const dir = path.join(ROOT, arg('dir', 'frames')); fs.mkdirSync(dir, {recursive: true});
const jobs = [];
for (let f = from; f <= to; f++) { const out = path.join(dir, `f_${String(f).padStart(4, '0')}.jpg`); if (!(fs.existsSync(out) && fs.statSync(out).size > 20000)) jobs.push({f, out}); }
console.log(`кадр: ${jobs.length}, параллель: ${workers}`);
const browser = await pw.chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none']});
let next = 0, done = 0; const t0 = Date.now();
async function worker(i) {
  await new Promise(r => setTimeout(r, i * 4000));
  const page = await browser.newPage({viewport: {width: 2048, height: 1536}, deviceScaleFactor: 1});
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.setDefaultTimeout(600000);
  await page.goto(`http://127.0.0.1:${server.address().port}/scene/index.html?scale=1&${flags}`, {timeout: 600000});
  await page.evaluate(() => window.__ready);
  while (next < jobs.length) {
    const j = jobs[next++];
    await page.evaluate(t => window.renderFrame(t), j.f / fps);
    const tmp = j.out + '.tmp.jpg';
    await page.screenshot({path: tmp, type: 'jpeg', quality, clip: {x: 0, y: 0, width: 2048, height: 1536}});
    fs.renameSync(tmp, j.out);
    if (++done % 30 === 0 || done === jobs.length) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${jobs.length}  ${el.toFixed(0)} с  (${(el / done).toFixed(2)} с/кадр, қалды ~${((jobs.length - done) * el / done / 60).toFixed(0)} мин)`); }
  }
  await page.close();
}
await Promise.all(Array.from({length: Math.min(workers, jobs.length)}, (_, i) => worker(i)));
await browser.close(); server.close();
console.log('дайын');
