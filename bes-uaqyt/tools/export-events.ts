// Exports every sound-relevant moment, derived from the same motion code the
// renderer uses, to build/events.json (read by tools/make_audio.py).
import {mkdirSync, writeFileSync} from 'node:fs';
import {FINAL_LINES} from '../src/config/text';
import {BRIDGE, DURATION_S, PRAYERS, PRAYER_KEYS, SEGMENTS, TEXT_TIMING} from '../src/config/timeline';
import {cameraAt, toScreen} from '../src/motion/camera';
import {finaleTimes, jointsAt} from '../src/motion/character';
import {STRIKES} from '../src/motion/gait';
import {loadAt, releaseTimes} from '../src/motion/load';
import {flightOf} from '../src/motion/pack';

const pan = (t: number) => {
  const j = jointsAt(t);
  const s = toScreen(cameraAt(t), j.P.x, j.P.y);
  return Math.max(-1, Math.min(1, (s.x - 540) / 540));
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

const events = {
  duration: DURATION_S,
  steps: STRIKES.filter((s) => s.t > -0.2).map((s) => ({t: r3(s.t), lift: r3(s.lift), load: r3(s.load), closing: s.closing, foot: s.foot, onRock: s.x > BRIDGE.x1 + 4 || s.x < BRIDGE.x0 - 4, pan: r3(pan(Math.max(0, s.t)))})),
  prayers: PRAYERS.map((p, i) => {
    const at = (f: number) => r3(p.t0 + p.dur * f);
    const fl = flightOf(i);
    return {
      t0: r3(p.t0),
      squat: at(PRAYER_KEYS.squat),
      kneel: at(PRAYER_KEYS.kneel),
      sajda: at(PRAYER_KEYS.sajda),
      rise: at(PRAYER_KEYS.sajdaHold),
      kneel2: at(PRAYER_KEYS.kneel2),
      end: at(1),
      release: r3(releaseTimes[i]),
      launch: r3(fl.t0),
      bounce: r3(fl.tb),
      pan: r3(pan(p.t0 + p.dur * 0.4)),
    };
  }),
  titles: SEGMENTS.map((s) => ({key: s.key, t: r3(s.start + TEXT_TIMING.title.delay)})),
  finalLines: TEXT_TIMING.final.lines.map((t, i) => ({t, text: FINAL_LINES[i].text})),
  finale: Object.fromEntries(Object.entries(finaleTimes).map(([k, v]) => [k, r3(v)])),
  load: Array.from({length: 201}, (_, i) => r3(loadAt(i * 0.1))),
  pan: Array.from({length: 201}, (_, i) => r3(pan(i * 0.1))),
};

mkdirSync('build', {recursive: true});
writeFileSync('build/events.json', JSON.stringify(events, null, 1));
console.log(`events: ${events.steps.length} steps, ${events.prayers.length} prayers → build/events.json`);
