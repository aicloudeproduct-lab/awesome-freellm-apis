// A кейіпкері: «мінсіз жоспар» құрушы. Үстелге қарап тұр (алдынан көрініс), жоспарды шексіз қайта сызады.
import React from 'react';
import {G, PAL} from './constants';
import {FrontFigure, FrontPose, solveFront} from './rig';
import {V, clamp, eo, esine, lerp, lerpV, pathD, pointAlong, polyLen, range, wobble} from './util';

export const A_X = 620;
/** A-ның бүкіл «бұрышы» (үстел, сызба, жазу) әлемде осыншаға жылжытылған: композиция iPad кадрына сыяды. */
export const A_SHIFT = 180;
const FOOT_Y = G - 38;
export const DESK = {front: G - 112, top0: G - 124, top1: G - 158, x0: 500, x1: 740};
// Үстелдегі қағаз (перспективадағы төртбұрыш): алдыңғы шеті және артқы шеті
const SHEET = {fy: G - 124, by: G - 150, fx0: 565, fx1: 695, bx0: 573, bx1: 687};
export const sheetPoint = (u: number, v: number): V => {
  const y = lerp(SHEET.by, SHEET.fy, v);
  return [lerp(lerp(SHEET.bx0, SHEET.fx0, v), lerp(SHEET.bx1, SHEET.fx1, v), u), y];
};
// Ауадағы жоспар (жарқыраған жоба): әлем координатасы
export const SKETCH = {x: 470, y: G - 520, w: 320, h: 180};

type Stroke = V[];
function house(v: number): Stroke[] {
  // v — нұсқа: шатыр биіктігі, терезе орны, қосымша бөлшектер өзгереді
  const roofH = [58, 72, 48, 64, 66][v], winX = [182, 168, 196, 176, 186][v], doorX = [92, 100, 86, 96, 94][v];
  const s: Stroke[] = [
    [[40, 150], [280, 150]],
    [[66, 150], [66, 82]], [[254, 150], [254, 82]],
    [[52, 88], [160, 88 - roofH], [268, 88]],
    [[doorX, 150], [doorX, 104], [doorX + 32, 104], [doorX + 32, 150]],
    [[winX, 96], [winX + 44, 96], [winX + 44, 126], [winX, 126], [winX, 96]],
    [[winX + 22, 96], [winX + 22, 126]],
    [[66, 164], [254, 164]], [[66, 159], [66, 169]], [[254, 159], [254, 169]],
    [[296, 150], [296, 82]], [[291, 150], [301, 150]], [[291, 82], [301, 82]],
  ];
  if (v === 1 || v === 3) s.push([[214, 62 - (v === 1 ? 8 : 0)], [214, 40], [230, 40], [230, 70]]); // мұржа
  if (v >= 2) s.push([[20, 30], [60, 30]], [[20, 40], [48, 40]]); // жазба сызықтары
  return s.map((st, i) => wobble(st, 1.1, v * 100 + i));
}
const VERSIONS = [0, 1, 2, 3, 4].map(house);
const CROSS: Stroke[] = [wobble([[60, 40], [270, 158]], 2, 7), wobble([[270, 40], [60, 158]], 2, 8)];

// Нұсқалар уақыты: [сызу басталуы, аяқталуы, өшу/умаждау басталуы, жоғалуы, түрі]
const CYCLES: {v: number; draw: [number, number]; gone: [number, number]; mode: 'crumple' | 'erase' | 'keep'; cross?: [number, number]}[] = [
  {v: 0, draw: [0.5, 3.4], cross: [3.55, 4.0], gone: [4.1, 4.6], mode: 'crumple'},
  {v: 1, draw: [5.7, 8.8], gone: [9.6, 10.4], mode: 'erase'},
  {v: 2, draw: [10.6, 13.3], cross: [13.45, 13.95], gone: [14.1, 14.6], mode: 'crumple'},
  {v: 3, draw: [15.6, 19.8], gone: [22.0, 22.4], mode: 'erase'},
  {v: 4, draw: [22.5, 26.0], gone: [99, 99], mode: 'keep'},
];
const BALLS = [{release: 4.75, land: 5.25, from: [596, G - 200] as V, to: [512, G - 9] as V}, {release: 14.85, land: 15.35, from: [596, G - 200] as V, to: [478, G - 9] as V}];

function cycleAt(t: number) { for (const c of CYCLES) if (t < c.gone[1]) return c; return CYCLES[CYCLES.length - 1]; }

/** Ағымдағы сызу нүктесі (қарындаш) — u,v ∈ [0,1]. */
function pencil(t: number): {uv: V; drawing: boolean} | null {
  for (const c of CYCLES) {
    if (t >= c.draw[0] && t <= c.draw[1]) {
      const strokes = VERSIONS[c.v], total = strokes.reduce((s, st) => s + polyLen(st), 0);
      let d = range(t, c.draw[0], c.draw[1]) * total;
      for (const st of strokes) { const L = polyLen(st); if (d <= L) { const p = pointAlong(st, d / L); return {uv: [p[0] / SKETCH.w, p[1] / SKETCH.h], drawing: true}; } d -= L; }
    }
    if (c.cross && t >= c.cross[0] && t <= c.cross[1]) {
      const f = range(t, c.cross[0], c.cross[1]), st = f < 0.5 ? CROSS[0] : CROSS[1], p = pointAlong(st, (f % 0.5) * 2);
      return {uv: [p[0] / SKETCH.w, p[1] / SKETCH.h], drawing: true};
    }
  }
  return null;
}

/** A позасы уақыт бойынша. */
export function plannerPose(t: number) {
  const hip: V = [A_X + Math.sin(t * 0.9) * 1.5, FOOT_Y - 110];
  const footL: V = [A_X - 13, FOOT_Y], footR: V = [A_X + 13, FOOT_Y];
  const restL: V = [568, DESK.top0 + 2], restR: V = [684, DESK.top0 + 1];
  let handL = restL, handR = restR, shoulderDrop = 40, headOff: V = [0, 12];
  const pc = pencil(t);
  if (pc) {
    const sp = sheetPoint(pc.uv[0], pc.uv[1]);
    handR = [sp[0], sp[1] - 2 + Math.sin(t * 31) * 0.8];
  }
  // ойлану: қол иекке (3.4–3.55, 8.8–9.0), басты қасу (9.0–9.6)
  const chin = Math.max(range(t, 3.3, 3.45) * (1 - range(t, 3.5, 3.6)), range(t, 8.85, 9.0) * (1 - range(t, 9.55, 9.7)));
  if (chin > 0) {
    const scratch = range(t, 9.0, 9.55) > 0 && t < 9.6;
    const target: V = scratch ? [A_X + 18 + Math.sin(t * 40) * 4, FOOT_Y - 110 - 92 + 34 - 46] : [A_X + 8, FOOT_Y - 110 - 92 + 34 - 6];
    handR = lerpV(handR, target, esine(chin));
  }
  // өшіру: оң қол қағаз үстінде ары-бері
  for (const c of CYCLES) if (c.mode === 'erase' && t >= c.gone[0] && t <= c.gone[1]) {
    const f = range(t, c.gone[0], c.gone[1]);
    handR = sheetPoint(0.5 + 0.4 * Math.sin(f * Math.PI * 7), 0.5 + 0.25 * Math.sin(f * Math.PI * 3));
  }
  // умаждау және лақтыру
  const ball = BALLS.find(b => t >= b.release - 0.9 && t <= b.release + 0.45);
  if (ball) {
    const lift = eo(range(t, ball.release - 0.65, ball.release - 0.4));
    const crush = range(t, ball.release - 0.4, ball.release - 0.12);
    const chest: V = [A_X, FOOT_Y - 152];
    const sheetL = sheetPoint(0, 0.6), sheetR = sheetPoint(1, 0.6);
    const holdL = lerpV(sheetL, [chest[0] - 62 + 52 * crush, chest[1]], lift);
    const holdR = lerpV(sheetR, [chest[0] + 62 - 52 * crush, chest[1]], lift);
    handL = holdL; handR = holdR;
    // лақтыру: сол қол сыртқа қарай серпеді
    const thr = range(t, ball.release - 0.12, ball.release + 0.1);
    if (thr > 0) handL = lerpV(holdL, [A_X - 92, FOOT_Y - 214], esine(thr));
    const back = range(t, ball.release + 0.1, ball.release + 0.45);
    if (back > 0) { handL = lerpV([A_X - 92, FOOT_Y - 214], restL, esine(back)); handR = lerpV(holdR, restR, esine(back)); }
    shoulderDrop = lerp(34, 14, lift * (1 - back));
    headOff = [0, lerp(12, 2, lift * (1 - back))];
  }
  // жаңа парақ: оң қол үстелдің шетінен тартады
  for (const nt of [5.35, 14.95]) if (t >= nt && t <= nt + 0.45) {
    const f = range(t, nt, nt + 0.45);
    handR = lerpV([DESK.x1 - 6, DESK.top0 - 4], sheetPoint(0.8, 0.5), esine(f));
  }
  // 6-сахна: парақты ай жарығына көтеріп қарау, сосын үйге қарау
  const raise = range(t, 20.4, 20.9) * (1 - range(t, 21.6, 22.0));
  if (raise > 0) {
    const e = esine(raise);
    handL = lerpV(handL, [A_X - 44, FOOT_Y - 262], e); handR = lerpV(handR, [A_X + 44, FOOT_Y - 262], e);
    shoulderDrop = lerp(shoulderDrop, 6, e); headOff = lerpV(headOff, [0, -9], e);
  }
  const look = range(t, 22.2, 22.6) * (1 - range(t, 23.3, 23.7));
  if (look > 0) { headOff = lerpV(headOff, [9, -5], esine(look)); shoulderDrop = lerp(shoulderDrop, 20, esine(look)); }
  // жалпы: сызу кезінде еңкейеді, басқа уақытта сәл тіктеледі
  if (!pc && !ball && raise <= 0) shoulderDrop = lerp(shoulderDrop, 26, 0.5);
  const pose: FrontPose = {hip, shoulderDrop, headOff, handL, handR, footL, footR};
  return {j: solveFront(pose), raise, ball};
}

/** Ауадағы жоспар сызбасы және үстелдегі қағаз. */
export const PlanSketch: React.FC<{t: number}> = ({t}) => {
  const c = cycleAt(t);
  const strokes = VERSIONS[c.v], total = strokes.reduce((s, st) => s + polyLen(st), 0);
  const drawn = range(t, c.draw[0], c.draw[1]) * total;
  let acc = 0;
  let fade = 1, scale = 1;
  if (c.mode === 'erase') fade = 1 - range(t, c.gone[0], c.gone[1]);
  if (c.mode === 'crumple') { const f = range(t, c.gone[0], c.gone[1]); fade = 1 - f; scale = 1 - 0.85 * eo(f); }
  const appear = range(t, c.draw[0] - 0.4, c.draw[0]);
  const cx = SKETCH.w / 2, cy = SKETCH.h / 2;
  return (
    <g transform={`translate(${SKETCH.x},${SKETCH.y})`} opacity={clamp(fade) * (0.25 + 0.75 * appear)}>
      <g transform={`translate(${cx},${cy}) scale(${scale}) translate(${-cx},${-cy})`}>
        {/* тор */}
        <g opacity={0.16}>
          {[...Array(9)].map((_, i) => <line key={'v' + i} x1={i * 40} y1={0} x2={i * 40} y2={SKETCH.h} stroke={PAL.silver} strokeWidth={0.8} />)}
          {[...Array(5)].map((_, i) => <line key={'h' + i} x1={0} y1={i * 45} x2={SKETCH.w} y2={i * 45} stroke={PAL.silver} strokeWidth={0.8} />)}
        </g>
        {strokes.map((st, i) => {
          const L = polyLen(st), f = clamp((drawn - acc) / L); acc += L;
          if (f <= 0) return null;
          return <path key={i} d={pathD(st)} fill="none" stroke={PAL.ivory} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={L} strokeDashoffset={L * (1 - f)} />;
        })}
        {c.cross && CROSS.map((st, i) => {
          const L = polyLen(st), f = clamp((range(t, c.cross![0], c.cross![1]) - i * 0.5) * 2);
          if (f <= 0) return null;
          return <path key={'x' + i} d={pathD(st)} fill="none" stroke={PAL.ivory} strokeWidth={2.6} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - f)} opacity={0.9} />;
        })}
        <text x={160} y={176} fill={PAL.silver} fontFamily="Cormorant" fontStyle="italic" fontSize={15} textAnchor="middle" opacity={range(drawn, total * 0.6, total * 0.7)}>4,2 м</text>
        <text x={310} y={120} fill={PAL.silver} fontFamily="Cormorant" fontStyle="italic" fontSize={15} textAnchor="middle" opacity={range(drawn, total * 0.85, total * 0.95)}>2,7</text>
      </g>
    </g>
  );
};

/** Үстел (жарқыраған жарық үстелі), қағаз, қағаз шумақтары. */
export const Desk: React.FC<{t: number; front: boolean}> = ({t, front}) => {
  if (!front) return null;
  const sheetOn = !BALLS.some(b => t >= b.release - 0.65 && t < b.release + 0.6);
  const sheetPts = [sheetPoint(0, 0), sheetPoint(1, 0), sheetPoint(1, 1), sheetPoint(0, 1)];
  return (
    <g>
      {/* артқы аяқтар */}
      <line x1={DESK.x0 + 18} y1={DESK.top1} x2={DESK.x0 + 22} y2={G - 34} stroke="#6b6e75" strokeWidth={5} />
      <line x1={DESK.x1 - 18} y1={DESK.top1} x2={DESK.x1 - 22} y2={G - 34} stroke="#6b6e75" strokeWidth={5} />
      {/* үстел беті (жарқырайды) */}
      <path d={`M${DESK.x0},${DESK.top0} L${DESK.x1},${DESK.top0} L${DESK.x1 - 14},${DESK.top1} L${DESK.x0 + 14},${DESK.top1} Z`} fill="url(#deskGlow)" />
      {sheetOn && <path d={pathD(sheetPts) + 'Z'} fill="#f6f4ee" opacity={0.92} />}
      {sheetOn && [0.25, 0.45, 0.65].map((v, i) => <path key={i} d={pathD([sheetPoint(0.12, v), sheetPoint(0.12 + 0.7 * clamp(range(t, 0.5, 3.4) + (t > 5.7 ? 1 : 0)), v)])} stroke="#8d8a83" strokeWidth={0.9} />)}
      <rect x={DESK.x0} y={DESK.top0} width={DESK.x1 - DESK.x0} height={12} fill="#d9d7d0" />
      <rect x={DESK.x0} y={DESK.top0 + 12} width={DESK.x1 - DESK.x0} height={2} fill="#8f9096" />
      {/* алдыңғы аяқтар */}
      <rect x={DESK.x0 + 6} y={DESK.top0 + 12} width={7} height={G - DESK.top0 - 12} fill="#c9c8c3" />
      <rect x={DESK.x1 - 13} y={DESK.top0 + 12} width={7} height={G - DESK.top0 - 12} fill="#c9c8c3" />
      {/* қағаз парақтарының бумасы (үстел шетінде) */}
      <path d={`M${DESK.x1 - 44},${DESK.top0 - 1} L${DESK.x1 - 6},${DESK.top0 - 1} L${DESK.x1 - 12},${DESK.top0 - 9} L${DESK.x1 - 40},${DESK.top0 - 9} Z`} fill="#e9e6de" />
    </g>
  );
};

/** Қолдағы парақ (көтеру/умаждау/лақтыру) және жердегі шумақтар. */
export const PaperInHands: React.FC<{t: number; hands: {l: V; r: V}}> = ({t, hands}) => {
  const items: React.ReactNode[] = [];
  BALLS.forEach((b, i) => {
    const r = 12;
    if (t >= b.release - 0.65 && t < b.release) {
      const crush = range(t, b.release - 0.4, b.release - 0.12);
      const c = lerpV(hands.l, hands.r, 0.5);
      const w = Math.abs(hands.r[0] - hands.l[0]) * (1 - crush) + 2 * r * crush, h = lerp(70, 2 * r, crush);
      items.push(<rect key={'s' + i} x={c[0] - w / 2} y={c[1] - h / 2} width={w} height={h} rx={lerp(2, r, crush)} fill="#f3f1ea" opacity={0.95} />);
    } else if (t >= b.release) {
      const f = clamp((t - b.release) / (b.land - b.release));
      let p: V = [lerp(b.from[0], b.to[0], f), lerp(b.from[1], b.to[1], f) - Math.sin(Math.PI * f) * 70];
      if (t > b.land) { const dt = t - b.land; p = [b.to[0] - 16 * (1 - Math.exp(-dt * 4)), b.to[1] - Math.abs(Math.sin(dt * 12)) * 14 * Math.exp(-dt * 7)]; }
      items.push(
        <g key={'b' + i}>
          <circle cx={p[0]} cy={p[1] - 2} r={r} fill="#ebe8df" />
          <path d={`M${p[0] - 7},${p[1] - 6} l6,4 l5,-6 M${p[0] - 4},${p[1] + 3} l8,-1`} stroke="#a6a297" strokeWidth={1} fill="none" />
        </g>,
      );
    }
  });
  // 6-сахна: көтерілген парақ
  const raise = range(t, 20.4, 20.9) * (1 - range(t, 21.6, 22.0));
  if (raise > 0.02) {
    const c = lerpV(hands.l, hands.r, 0.5);
    items.push(<rect key="raised" x={c[0] - 46} y={c[1] - 34 * raise} width={92} height={62 * raise} fill="#f3f1ea" opacity={0.95} />);
  }
  return <g>{items}</g>;
};

export const PlannerFigure: React.FC<{t: number; layer: 'body' | 'arms'}> = ({t, layer}) => {
  const {j} = plannerPose(t);
  const c = PAL.ivory;
  const common = {fill: 'none', stroke: c, strokeWidth: 7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  const L = (a: V, b: V, d: V) => `M${a[0]},${a[1]}L${b[0]},${b[1]}L${d[0]},${d[1]}`;
  if (layer === 'arms') return (
    <g>
      <path d={L(j.shL, j.elbowL, j.handL)} {...common} />
      <path d={L(j.shR, j.elbowR, j.handR)} {...common} />
    </g>
  );
  return <FrontFigure j={{...j, handL: j.shL, elbowL: j.shL, handR: j.shR, elbowR: j.shR}} />;
};
