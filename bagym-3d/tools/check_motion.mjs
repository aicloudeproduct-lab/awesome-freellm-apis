// Әр кадр үшін (рендерсіз) тексеру: камера кейіпкер денесіне тым жақын/ішінде ме, кейіпкер бір шоттың ішінде секіре ме (телепорт).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module';
const require = createRequire(import.meta.url); const pw = require('/opt/node-tools/node_modules/playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream'}); fs.createReadStream(p).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const b = await pw.chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const pg = await b.newPage({viewport: {width: 512, height: 384}});
pg.on('pageerror', e => console.error('PAGEERR', e.message));
await pg.goto(`http://127.0.0.1:${server.address().port}/scene/index.html?scale=0.25&norender`, {timeout: 600000}); await pg.evaluate(() => window.__ready);
const res = await pg.evaluate(() => {
  const S = window.__S, T = S.THREE, cp = new T.Vector3(), out = {near: [], jumps: []}, prev = {};
  const chars = [['hero', S.hero], ['other', S.other], ...S.family.map((c, i) => ['family' + i, c])];
  let prevShot = null;
  for (let f = 0; f < 2700; f++) {
    const t = f / 30, shot = window.renderFrame(t); S.camera.getWorldPosition(cp);
    for (const [name, ch] of chars) {
      if (!ch.root.visible) { delete prev[name]; continue; }
      ch.root.updateMatrixWorld(true);
      // дене: табаннан басқа дейінгі кесінді, радиусы ~0.3 м (иық/қол)
      const a = ch.root.position.clone(), top = new T.Vector3(); ch.head ? ch.head.getWorldPosition(top) : top.copy(a).add(new T.Vector3(0, 1.7, 0));
      const seg = new T.Line3(a, top), q = new T.Vector3(); seg.closestPointToPoint(cp, true, q);
      const d = q.distanceTo(cp) - 0.3 * ch.root.scale.y;
      if (d < 0.25) out.near.push({f, t: +t.toFixed(2), shot, name, d: +d.toFixed(2)});
      const p = ch.root.position;
      if (prev[name] && prevShot === shot && Math.hypot(p.x - prev[name].x, p.z - prev[name].z) > 0.12) out.jumps.push({f, t: +t.toFixed(2), shot, name, dist: +Math.hypot(p.x - prev[name].x, p.z - prev[name].z).toFixed(2)});
      prev[name] = p.clone();
    }
    prevShot = shot;
  }
  return out;
});
const group = arr => { const g = []; for (const e of arr) { const l = g[g.length - 1]; if (l && l.name === e.name && e.f - l.f1 <= 2) { l.f1 = e.f; l.min = Math.min(l.min, e.d ?? e.dist); } else g.push({name: e.name, shot: e.shot, f0: e.f, f1: e.f, min: e.d ?? e.dist}); } return g; };
console.log('камера денеге жақын (<0.25 м):', JSON.stringify(group(res.near)) || 'жоқ');
console.log('шот ішіндегі секірістер (>0.12 м/кадр):', JSON.stringify(group(res.jumps)) || 'жоқ');
await b.close(); server.close();
