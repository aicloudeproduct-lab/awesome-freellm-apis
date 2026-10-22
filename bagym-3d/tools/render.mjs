// Кадр рендері: ішкі статикалық сервер + Chromium (WebGL/SwiftShader) → PNG.
// Сынақ: node tools/render.mjs --shot opening --t 5 --out tests/opening.png [--scale 0.5]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const pw = require('/opt/node-tools/node_modules/playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MIME = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.wav': 'audio/wav'};
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'}); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const scale = parseFloat(arg('scale', '1'));
const browser = await pw.chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none']});
const page = await browser.newPage({viewport: {width: Math.round(2048 * scale), height: Math.round(1536 * scale)}, deviceScaleFactor: 1});
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/scene/index.html?scale=${scale}`);
await page.evaluate(() => window.__ready);
const shots = (arg('shot', 'opening')).split(','), ts = (arg('t', '5')).split(',').map(Number), outs = (arg('out', 'tests/frame.png')).split(',');
if (scale !== 1) await page.addStyleTag({content: `#title{transform:scale(${scale});transform-origin:top center}`});
for (let i = 0; i < shots.length; i++) {
  const t0 = Date.now();
  await page.evaluate(([t, s]) => window.renderFrame(t, s), [ts[i] ?? ts[0], shots[i]]);
  fs.mkdirSync(path.dirname(path.join(ROOT, outs[i])), {recursive: true});
  await page.screenshot({path: path.join(ROOT, outs[i]), clip: {x: 0, y: 0, width: Math.round(2048 * scale), height: Math.round(1536 * scale)}});
  console.log('ok', shots[i], outs[i], (Date.now() - t0) + ' ms');
}
await browser.close(); server.close();
