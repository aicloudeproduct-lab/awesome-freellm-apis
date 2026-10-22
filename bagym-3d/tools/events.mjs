// Дыбыс синхроны үшін оқиғаларды сахнаның өзінен алу: әр кейіпкердің табаны жерге тиген сәттер,
// табан мен камера арақашықтығы, кадрдағы көрінуі және шот шекаралары → out/events.json
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module';
const require = createRequire(import.meta.url); const pw = require('/opt/node-tools/node_modules/playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, {'Content-Type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream'}); fs.createReadStream(p).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const b = await pw.chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const pg = await b.newPage({viewport: {width: 512, height: 384}});
pg.on('pageerror', e => console.error('PAGEERR', e.message));
await pg.goto(`http://127.0.0.1:${server.address().port}/scene/index.html?scale=0.25&norender`, {timeout: 600000}); await pg.evaluate(() => window.__ready);
const data = await pg.evaluate(() => {
  const S = window.__S, out = {samples: [], dt: 1 / 120}, v = new S.THREE.Vector3(), cp = new S.THREE.Vector3();
  for (let i = 0; i <= 90 * 120; i++) {
    const t = i / 120, shot = window.renderFrame(t);
    S.camera.getWorldPosition(cp);
    const row = {t, shot};
    for (const [k, ch] of [['H', S.hero], ['O', S.other]]) {
      ch.root.updateMatrixWorld(true);
      for (const s of ['L', 'R']) { ch.leg[s].an.getWorldPosition(v); const ndc = v.clone().project(S.camera);
        row[k + s] = [+v.y.toFixed(4), +v.distanceTo(cp).toFixed(3), ch.root.visible && Math.abs(ndc.x) < 1.1 && Math.abs(ndc.y) < 1.1 && ndc.z < 1 ? 1 : 0, +v.x.toFixed(3)]; }
    }
    out.samples.push(row);
  }
  return out;
});
// табан тию: биіктік жоғарыдан тыныш деңгейге түсіп, тоқтаған сәт
const steps = [];
for (const key of ['HL', 'HR', 'OL', 'OR']) {
  const ys = data.samples.map(r => r[key][0]); let air = false, peak = 0;
  const rest = 0.1752; // тұрған кездегі тобық биіктігі (BODY.ankle + табан қалыңдығы)
  for (let i = 1; i < ys.length; i++) {
    const y = ys[i] - rest;
    if (y > 0.02) { air = true; peak = Math.max(peak, y); }
    else if (air && y < 0.006) { const r = data.samples[i], prevShot = data.samples[i - 1].shot; if (prevShot === r.shot) steps.push({t: +r.t.toFixed(3), who: key[0], foot: key[1], dist: r[key][1], vis: r[key][2], x: r[key][3], lift: +peak.toFixed(3)}); air = false; peak = 0; }
  }
}
steps.sort((a, b) => a.t - b.t);
const shots = []; let last = null;
for (const r of data.samples) if (r.shot !== last) { shots.push({name: r.shot, t: r.t}); last = r.shot; }
fs.mkdirSync(path.join(ROOT, 'out'), {recursive: true});
fs.writeFileSync(path.join(ROOT, 'out/events.json'), JSON.stringify({steps, shots}, null, 1));
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(data.samples.map(r => [r.t, r.OL[0], r.OR[0], r.HL[0], r.HR[0]])));
console.log(`${steps.length} табан тию, ${shots.length} шот`);
await b.close(); server.close();
