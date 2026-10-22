// B кейіпкері: «алғашқы қадам» жасаушы. Құрылыс tau сағатымен, кейінгі әрекеттер нақты уақытпен жүреді.
import React from 'react';
import {G, HOUSE, PAL, SCHEDULE, tauOf} from './constants';
import {PIECES, PieceState, activePiece, bWalkX, handBlend, pieceState} from './pieces';
import {BONES, Joints, MorphFigure, SidePose, SideFigure, frontLines, postureFor, sideLines, simulateFeet, solveFront, solveSide} from './rig';
import {V, clamp, esine, kf, lerp, lerpV, range} from './util';

const E = SCHEDULE.events;
const TAU_SHIFT = tauOf(30) - 30; // 12.3 с кейін tau = t + TAU_SHIFT
/** B жамбасының x-траекториясы tau бойынша (құрылыс + есікке бару). */
export const hipXAt = (tau: number) => (tau <= 22.95 ? bWalkX(tau) : kf(tau, [[22.95, 1640], [17.0 + TAU_SHIFT, 1640], [17.6 + TAU_SHIFT, 1560]]));

export function doorOpen(t: number, fps: number, springFn: (f: number) => number) {
  if (t < E.doorOpen) return 1;
  const s = springFn(Math.round((t - E.doorOpen) * fps));
  let open = lerp(1, 0.16, clamp(s, 0, 1.08));
  if (t > E.doorAjar) open = lerp(open, 0.62, esine(range(t, E.doorAjar, E.doorAjar + 0.8)));
  return open;
}
export const doorKnob = (open: number): V => [HOUSE.door.x + 9 + 72 * open - 9 * open, G - 120];

export type BuilderFrame = {
  tau: number; j: Joints; states: PieceState[]; turnK: number; fj: ReturnType<typeof solveFront> | null;
  mode: 'out' | 'enter' | 'inside' | 'gone';
  xf: string; color: string; opacity: number;
};

export function builderFrame(t: number, open: number): BuilderFrame {
  const tau = tauOf(t);
  const facing: 1 = 1;
  const hipX = hipXAt(tau);
  const states = PIECES.map((p, k) => pieceState(p, k, tau, hipXAt));
  const gait = simulateFeet(hipXAt, tau, 0, () => 1, {spread: 7, swingDur: 0.24, lift: 12});
  let footN: V = [gait.feet[0].x, G - gait.feet[0].lift], footF: V = [gait.feet[1].x, G - gait.feet[1].lift];

  // қол нысаналары
  const act = activePiece(tau);
  let target: V | null = null, handN: V, handF: V;
  const armSwing = (footN[0] - footF[0]) * -0.35;
  if (act) {
    const {p, k} = act;
    const hb = handBlend(p, tau);
    const st = states[k];
    const grips = st.grips ?? (tau < p.pick ? pieceState(p, k, p.pick, hipXAt).grips! : pieceState(p, k, p.release - 1e-4, hipXAt).grips!);
    const post0 = postureFor(hipX, null, facing);
    const restN: V = [hipX + 8, post0.hipY + 6], restF: V = [hipX - 6, post0.hipY + 8];
    handN = lerpV(restN, grips[0], hb.toPiece); handF = lerpV(restF, grips[1], hb.toPiece);
    target = hb.toPiece > 0 ? lerpV(lerpV(restN, restF, 0.5), lerpV(grips[0], grips[1], 0.5), hb.toPiece) : null;
  } else {
    const post0 = postureFor(hipX, null, facing);
    handN = [hipX + 8 + armSwing, post0.hipY + 6]; handF = [hipX - 6 - armSwing, post0.hipY + 8];
  }
  const post = postureFor(hipX, target && target[1] > G - 140 ? target : target, facing);
  let hipY = post.hipY, lean = post.lean, headTilt = 0.12;
  if (target) headTilt = clamp((target[1] - (hipY - 200)) / 300, -0.45, 0.5);

  // құрылыстан кейін: шатырға қарау, маңдайды сүрту
  if (t > 12.6) {
    const up = range(t, 12.8, 13.4) * (1 - range(t, 14.0, 14.5));
    headTilt = lerp(headTilt, -0.42, esine(up));
    const wipe = range(t, 14.2, 14.45) * (1 - range(t, 14.75, 14.95));
    if (wipe > 0) {
      const sh: V = [hipX + Math.sin(lean) * BONES.torso, hipY - Math.cos(lean) * BONES.torso];
      const brow: V = [sh[0] + 24 + Math.sin(t * 18) * 5, sh[1] - 34];
      handN = lerpV(handN, brow, esine(wipe));
    }
  }
  // есікті ашу: тұтқаға созылу және ере жүру
  const reach = range(t, E.doorReach, E.doorOpen) * (1 - range(t, 18.1, 18.35));
  if (reach > 0) handN = lerpV(handN, doorKnob(open), esine(reach));

  const pose: SidePose = {hip: [hipX, hipY], lean, headTilt, footN, footF, handN, handF, facing};
  let mode: BuilderFrame['mode'] = 'out', xf = '', color: string = PAL.ivory, opacity = 1, turnK = 0;
  let fj: ReturnType<typeof solveFront> | null = null;

  // бұрылу (есікке қарай), табалдырыққа көтерілу, ішке кіру
  if (t >= E.turn) {
    const turn = esine(range(t, E.turn, E.stepIn));
    const step = esine(range(t, E.stepIn, E.inside));
    const deep = esine(range(t, E.inside, E.inside + 0.45));
    const cx = 1560;
    pose.footN = [cx + 4, G - Math.sin(Math.PI * range(t, E.stepIn, 18.95)) * 10];
    pose.footF = [cx - 4, G - Math.sin(Math.PI * range(t, 18.95, E.inside)) * 10];
    pose.hip = [cx, G - 112]; pose.lean = 0.02; pose.headTilt = 0;
    pose.handN = [cx + 6, G - 106]; pose.handF = [cx - 6, G - 106];
    const s = lerp(1, 0.66, step) * lerp(1, 0.9, deep);
    const dy = -36 * step - 6 * deep;
    xf = `translate(${cx},${G + dy}) scale(${s}) translate(${-cx},${-G})`;
    turnK = turn;
    fj = solveFront({hip: [cx, G - 112], shoulderDrop: 0, headOff: [0, 0], handL: [cx - 24, G - 100], handR: [cx + 24, G - 100],
      footL: [cx - 10, G - Math.sin(Math.PI * range(t, 18.95, E.inside)) * 10], footR: [cx + 10, G - Math.sin(Math.PI * range(t, E.stepIn, 18.95)) * 10]});
    color = mixHex(PAL.ivory, '#2b2219', range(t, 19.0, E.inside));
    mode = t >= E.inside ? 'inside' : 'enter';
    opacity = 1 - range(t, E.inside + 0.2, E.inside + 0.45);
    if (t >= E.inside + 0.45) mode = 'gone';
  }
  return {tau, j: solveSide(pose), states, mode, xf, color, opacity, turnK, fj};
}

export function mixHex(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(t))).toString(16).padStart(2, '0')).join('');
}

export const BuilderBody: React.FC<{bf: BuilderFrame; layer: 'far' | 'body' | 'nearArm'}> = ({bf, layer}) => {
  if (bf.mode === 'gone' || bf.mode === 'inside') return null;
  if (bf.mode === 'enter' && bf.fj) {
    if (layer !== 'body') return null;
    return <g transform={bf.xf}><MorphFigure a={sideLines(bf.j)} b={frontLines(bf.fj)} k={bf.turnK} style={{color: bf.color, opacity: bf.opacity}} /></g>;
  }
  return (
    <g transform={bf.xf || undefined}>
      <SideFigure j={bf.j} layer={layer} style={{color: bf.color, opacity: bf.opacity}} />
    </g>
  );
};
/** Есік ішінде (табалдырықтан өткен соң) — есік ойығымен қиылады. */
export const BuilderInside: React.FC<{bf: BuilderFrame}> = ({bf}) => {
  if (bf.mode !== 'inside') return null;
  return (
    <g transform={bf.xf}>
      {bf.fj ? <MorphFigure a={sideLines(bf.j)} b={frontLines(bf.fj)} k={1} style={{color: bf.color, opacity: bf.opacity, outline: false}} /> : null}
    </g>
  );
};

// ---------- терезедегі намаз сұлбасы ----------
const ROOM_FLOOR = G - 36, SIL_SCALE = 0.68;
const silHipX = (t: number) => kf(t, [[19.45, 1712], [19.95, 1752]]);
export const PrayerSilhouette: React.FC<{t: number}> = ({t}) => {
  if (t < 19.45) return null;
  const hipX = silHipX(t);
  const gait = simulateFeet(silHipX, t, 19.0, () => 1, {spread: 7, swingDur: 0.26});
  const hipY = ROOM_FLOOR - 112;
  const ruku = esine(range(t, E.ruku, E.ruku + 0.6)) * (1 - esine(range(t, E.rise, E.rise + 0.5)));
  const lean = lerp(0.03, 1.45, ruku);
  const sh: V = [hipX + Math.sin(lean) * BONES.torso, hipY - Math.cos(lean) * BONES.torso];
  const rest: V[] = [[hipX + 8, hipY + 6], [hipX - 6, hipY + 8]];
  const tak = esine(range(t, E.takbir, E.takbir + 0.4)) * (1 - esine(range(t, E.fold, E.fold + 0.4)));
  const fold = esine(range(t, E.fold, E.fold + 0.4));
  const ear: V[] = [[sh[0] + 6, sh[1] - 36], [sh[0] - 2, sh[1] - 38]];
  const chest: V[] = [[sh[0] + 22, sh[1] + 34], [sh[0] + 18, sh[1] + 30]];
  const knee: V[] = [[hipX + 44, hipY + 52], [hipX + 38, hipY + 54]];
  const hand = (i: number): V => {
    let h = rest[i];
    h = lerpV(h, ear[i], tak);
    h = lerpV(h, chest[i], fold * (1 - ruku));
    return lerpV(h, knee[i], ruku);
  };
  const j = solveSide({hip: [hipX, hipY], lean, headTilt: lerp(0.18, 0.1, ruku), footN: [gait.feet[0].x, ROOM_FLOOR], footF: [gait.feet[1].x, ROOM_FLOOR], handN: hand(0), handF: hand(1), facing: 1});
  const a = range(t, 19.45, 19.75);
  return (
    <g transform={`translate(${hipX},${ROOM_FLOOR}) scale(${SIL_SCALE}) translate(${-hipX},${-ROOM_FLOOR})`} opacity={a}>
      <SideFigure j={j} style={{color: '#2a2117', width: 11, farOpacity: 0.85, outline: false}} />
    </g>
  );
};
