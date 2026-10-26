// Әр кадр (рендерсіз): камера қатты дененің ішінде ме (қабырға/есік/алаң), камера мен кейіпкер арасындағы ең аз қашықтық,
// кейіпкер кадрда көріне ме (басы мен табаны экран шегінде).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module';
const require = createRequire(import.meta.url); const pw = require('/opt/node-tools/node_modules/playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream'}); fs.createReadStream(p).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const b = await pw.chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const pg = await b.newPage({viewport: {width: 270, height: 480}});
pg.on('pageerror', e => console.error('PAGEERR', e.message));
await pg.goto(`http://127.0.0.1:${server.address().port}/scene/index.html?scale=0.25&norender`, {timeout: 600000}); await pg.evaluate(() => window.__ready);
const res = await pg.evaluate(() => {
  const S = window.__S, T = S.THREE, boxes = []; window.renderFrame(0); S.scene.updateMatrixWorld(true);
  S.scene.traverse(o => { if (o.isMesh && (o.geometry.type === 'BoxGeometry' || o.geometry.type === 'RoundedBoxGeometry') && o.castShadow) { o.updateMatrixWorld(true); boxes.push(new T.Box3().setFromObject(o).expandByScalar(0.12)); } });
  const out = {inside: [], hidden: [], minDist: 1e9};
  for (let f = 0; f < 660; f++) {
    const t = f / 30; window.renderFrame(t);
    const c = S.camera.position;
    if (boxes.some(bx => bx.containsPoint(c))) out.inside.push(f);
    const h = S.hero.root; h.updateMatrixWorld(true);
    const head = new T.Vector3(); S.hero.head.getWorldPosition(head); const feet = h.position.clone();
    out.minDist = Math.min(out.minDist, head.distanceTo(c));
    S.camera.updateMatrixWorld(); const a = head.clone().project(S.camera), z = feet.clone().project(S.camera);
    const vis = [a, z].some(p => Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1);
    if (!vis) out.hidden.push(f);
  }
  return out;
});
const runs = a => { const r = []; for (const f of a) { const l = r[r.length - 1]; if (l && f === l[1] + 1) l[1] = f; else r.push([f, f]); } return r.map(([x, y]) => `${(x / 30).toFixed(2)}–${(y / 30).toFixed(2)} с`); };
console.log('камера қатты дене ішінде:', runs(res.inside).join(', ') || 'жоқ');
console.log('кейіпкер кадрдан тыс:', runs(res.hidden).join(', ') || 'жоқ');
console.log('камера–бас ең аз қашықтық:', res.minDist.toFixed(2), 'м');
await b.close(); server.close();
