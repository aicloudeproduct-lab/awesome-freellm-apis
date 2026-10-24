// Numeric QA for the rig: bone lengths, foot sliding, penetration through the
// deck, joint pops. Run: npm run check
import {DURATION_FRAMES, FPS} from '../src/config/timeline';
import {deckY} from '../src/motion/bridge';
import {LEN, jointsAt} from '../src/motion/character';
import {dist, V} from '../src/lib/math';
import {packAt, stoneAt} from '../src/motion/pack';

type Issue = {frame: number; what: string; value: number};
const issues: Issue[] = [];
const note = (frame: number, what: string, value: number) => issues.push({frame, what, value});

const bones: [string, number][] = [
  ['thigh', LEN.thigh],
  ['shin', LEN.shin],
  ['upper', LEN.upper],
  ['fore', LEN.fore],
  ['spine', LEN.spine],
];
let maxBoneErr = 0;
let maxSlide = 0;
let maxPen = 0;
let maxJump = 0;
let prev: ReturnType<typeof jointsAt> | null = null;
let maxPackGap = 0;

const below = (p: V, t: number, r: number) => p.y + r - deckY(p.x, t);

for (let f = 0; f < DURATION_FRAMES; f++) {
  const t = f / FPS;
  const j = jointsAt(t);
  const meas: Record<string, number[]> = {
    thigh: [dist(j.legN.hip, j.legN.knee), dist(j.legF.hip, j.legF.knee)],
    shin: [dist(j.legN.knee, j.legN.ankle), dist(j.legF.knee, j.legF.ankle)],
    upper: [dist(j.armN.sh, j.armN.elbow), dist(j.armF.sh, j.armF.elbow)],
    fore: [dist(j.armN.elbow, j.armN.hand), dist(j.armF.elbow, j.armF.hand)],
    spine: [dist(j.P, j.C)],
  };
  for (const [k, L] of bones) for (const m of meas[k]) {
    const e = Math.abs(m - L);
    maxBoneErr = Math.max(maxBoneErr, e);
    if (e > 0.5) note(f, `bone ${k}`, e);
  }
  // penetration: stroke radius below deck surface
  const r = LEN.line * 0.5;
  const pts: [string, V, number][] = [
    ['kneeN', j.legN.knee, r], ['kneeF', j.legF.knee, r], ['toeN', j.legN.toe, r], ['toeF', j.legF.toe, r],
    ['ankleN', j.legN.ankle, r], ['ankleF', j.legF.ankle, r], ['handN', j.armN.hand, r], ['handF', j.armF.hand, r],
    ['elbowN', j.armN.elbow, r], ['head', j.head, LEN.headR],
  ];
  for (const [n, p, rr] of pts) {
    const b = below(p, t, rr);
    if (b > 1.5) note(f, `penetrate ${n}`, b);
    maxPen = Math.max(maxPen, b);
  }
  if (prev) {
    for (const [n, a, b] of [['toeN', prev.legN.toe, j.legN.toe], ['toeF', prev.legF.toe, j.legF.toe]] as [string, V, V][]) {
      const onDeck = Math.abs(below(b, t, r)) < 1.0 && Math.abs(below(a, t - 1 / FPS, r)) < 1.0;
      const dx = Math.abs(b.x - a.x);
      if (onDeck && dx > 0.05 && dx < 3) {
        maxSlide = Math.max(maxSlide, dx);
        if (dx > 0.35) note(f, `slide ${n}`, dx);
      }
    }
    const pairs: [string, V, V][] = [
      ['head', prev.head, j.head], ['handN', prev.armN.hand, j.armN.hand], ['handF', prev.armF.hand, j.armF.hand],
      ['kneeN', prev.legN.knee, j.legN.knee], ['elbowN', prev.armN.elbow, j.armN.elbow], ['P', prev.P, j.P],
    ];
    for (const [n, a, b] of pairs) {
      const d = dist(a, b);
      maxJump = Math.max(maxJump, d);
      if (d > 14) note(f, `jump ${n}`, d);
    }
  }
  const pk = packAt(t);
  if (pk.mode === 'back') {
    maxPackGap = Math.max(maxPackGap, pk.gap);
    if (pk.gap > 2.5) note(f, 'pack gap', pk.gap);
  }
  for (let i = 0; i < 5; i++) {
    const s = stoneAt(i, t);
    if (s && !isFinite(s.x + s.y)) note(f, `stone ${i} NaN`, 0);
  }
  prev = j;
}

const summary = {maxBoneErr, maxSlide, maxPenetration: maxPen, maxJointJumpPerFrame: maxJump, maxPackGap, issues: issues.length};
console.log(JSON.stringify(summary, null, 2));
const grouped = new Map<string, Issue[]>();
for (const i of issues) grouped.set(i.what, [...(grouped.get(i.what) ?? []), i]);
for (const [k, list] of grouped) {
  const worst = list.reduce((a, b) => (b.value > a.value ? b : a));
  console.log(`${k}: ${list.length} frames, worst ${worst.value.toFixed(2)} @ frame ${worst.frame} (t=${(worst.frame / FPS).toFixed(2)}s); frames ${list[0].frame}…${list[list.length - 1].frame}`);
}
if (issues.length && process.argv.includes('--strict')) process.exit(1);
