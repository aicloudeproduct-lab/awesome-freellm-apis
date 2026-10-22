// Кадрларды Chromium арқылы PNG етіп рендерлейді.
// Қолдану:
//   node tools/render.mjs                      — барлық 750 кадр -> frames/ (бар кадрлар өткізіледі, яғни жалғастыруға болады)
//   node tools/render.mjs --times 1.0,4.5,...  — сынақ кадрлары (секунд) -> tests/
//   опциялар: --workers 4 --from 0 --to 959 --force
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]] : a), []));
const FPS = 30, DUR = 25, TOTAL = FPS * DUR;
const workers = parseInt(args.workers || '4', 10);

let jobs;
if (args.times) {
  fs.mkdirSync(path.join(ROOT, 'tests'), { recursive: true });
  jobs = String(args.times).split(',').map(s => ({ t: parseFloat(s), out: path.join(ROOT, 'tests', `t_${parseFloat(s).toFixed(2).padStart(5, '0')}.png`) }));
} else {
  fs.mkdirSync(path.join(ROOT, 'frames'), { recursive: true });
  const from = parseInt(args.from || '0', 10), to = parseInt(args.to || String(TOTAL - 1), 10);
  jobs = [];
  for (let f = from; f <= to; f++) {
    const out = path.join(ROOT, 'frames', `f_${String(f).padStart(4, '0')}.png`);
    if (!args.force && fs.existsSync(out) && fs.statSync(out).size > 10000) continue;
    jobs.push({ t: f / FPS, out });
  }
}
console.log(`кадр саны: ${jobs.length}, параллель: ${workers}`);
if (!jobs.length) process.exit(0);

const browser = await pw.chromium.launch({ args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const url = pathToFileURL(path.join(ROOT, 'scene', 'index.html')).href + '?render=1';
let next = 0, done = 0;
const t0 = Date.now();
async function worker(id) {
  const page = await browser.newPage({ viewport: { width: 2048, height: 1536 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(url);
  await page.evaluate(() => window.__ready);
  while (next < jobs.length) {
    const j = jobs[next++];
    await page.evaluate(t => window.renderFrame(t), j.t);
    const tmp = j.out + '.tmp.png';
    await page.screenshot({ path: tmp, type: 'png' });
    fs.renameSync(tmp, j.out);
    done++;
    if (done % 60 === 0 || done === jobs.length) console.log(`${done}/${jobs.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await page.close();
}
await Promise.all(Array.from({ length: Math.min(workers, jobs.length) }, (_, i) => worker(i)));
await browser.close();
console.log('дайын');
