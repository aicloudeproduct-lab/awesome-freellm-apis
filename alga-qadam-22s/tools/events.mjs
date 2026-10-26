// Дыбыс синхроны: кейіпкердің табаны жерге тиген сәттері (сахнаның өзінен) → out/events.json
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module';
const require = createRequire(import.meta.url); const pw = require('/opt/node-tools/node_modules/playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream'}); fs.createReadStream(p).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const b = await pw.chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const pg = await b.newPage({viewport: {width: 270, height: 480}});
await pg.goto(`http://127.0.0.1:${server.address().port}/scene/index.html?scale=0.25&norender`, {timeout: 600000}); await pg.evaluate(() => window.__ready);
const rows = await pg.evaluate(() => {
  const S = window.__S, v = new S.THREE.Vector3(), cp = new S.THREE.Vector3(), out = [];
  for (let i = 0; i <= 22 * 120; i++) {
    const t = i / 120; window.renderFrame(t); S.hero.root.updateMatrixWorld(true); S.camera.getWorldPosition(cp);
    const r = [t];
    for (const s of ['L', 'R']) { S.hero.leg[s].an.getWorldPosition(v); r.push(v.y, v.x, v.z, v.distanceTo(cp)); }
    out.push(r);
  }
  return out;
});
const steps = [];
for (const [k, off] of [['L', 1], ['R', 5]]) {
  const rest = Math.min(...rows.map(r => r[off]));
  let air = false;
  for (let i = 1; i < rows.length; i++) {
    const y = rows[i][off] - rest;
    if (y > 0.02) air = true;
    else if (air && y < 0.006) { steps.push({t: +rows[i][0].toFixed(3), foot: k, x: +rows[i][off + 1].toFixed(2), z: +rows[i][off + 2].toFixed(2), dist: +rows[i][off + 3].toFixed(2)}); air = false; }
  }
}
steps.sort((a, b) => a.t - b.t);
fs.mkdirSync(path.join(ROOT, 'out'), {recursive: true});
fs.writeFileSync(path.join(ROOT, 'out/events.json'), JSON.stringify({steps}, null, 1));
console.log(`${steps.length} қадам:`, steps.map(s => s.t.toFixed(2) + s.foot).join(' '));
await b.close(); server.close();
