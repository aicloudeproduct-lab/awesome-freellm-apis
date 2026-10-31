// usage: node render.mjs <outDir> <frames...|start:end>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.otf': 'font/otf' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
const port = server.address().port;

const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
let frames = [];
for (const a of process.argv.slice(3)) {
  if (a.includes(':')) { const [s, e, st = 1] = a.split(':').map(Number); for (let f = s; f < e; f += st) frames.push(f); }
  else frames.push(Number(a));
}
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => { console.log('[err]', e.message); process.exit(1); });
await page.goto(`http://localhost:${port}/index.html?capture`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
const stage = await page.$('#stage');
const t0 = Date.now();
for (const f of frames) {
  const r0=Date.now(); await page.evaluate(f => window.__render(f), f); console.log(f, "render", Date.now()-r0);
  const a=Date.now(); await page.screenshot({ timeout: 0, clip: { x: 0, y: 0, width: 1920, height: 1080 }, path: path.join(out, `f_${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 94 }); console.log(f, "shot", Date.now()-a);
}
console.log(`done ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await browser.close(); server.close();
