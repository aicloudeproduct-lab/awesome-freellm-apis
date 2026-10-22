// QC скриншоттары: бір рет бума жинап, берілген секундтардағы кадрларды PNG етіп шығарады.
// Қолдану: node tools/stills.mjs 0,3,6,9 [--scale 0.5] [--out out/qc]
import path from 'node:path';
import fs from 'node:fs';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';

const args = process.argv.slice(2);
const secs = (args[0] || '0').split(',').map(Number);
const scale = Number(args.includes('--scale') ? args[args.indexOf('--scale') + 1] : 0.5);
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'out/qc';
const browserExecutable = process.env.REMOTION_BROWSER || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id: 'IpadCinematic', browserExecutable});
for (const s of secs) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(s * 30));
  const output = path.join(outDir, `f_${String(frame).padStart(3, '0')}.png`);
  await renderStill({serveUrl, composition, frame, output, scale, browserExecutable, chromiumOptions: {gl: 'swangle'}});
  console.log('ok', s, output);
}
