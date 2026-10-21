import React from 'react';
import {G, PAL} from './constants';
import {V, add, clamp, ik, lerp, mul} from './util';

// Екі кейіпкерге ортақ пропорциялар (бір рет анықталады — сахна бойы өзгермейді)
export const BONES = {head: 21, neck: 8, torso: 92, upperArm: 48, foreArm: 46, thigh: 58, shin: 56, shoulderHalf: 19, hipHalf: 9};
export const STAND_HIP = 112; // жерден жамбасқа дейін (тізе сәл бүгілген)
export const REACH = BONES.upperArm + BONES.foreArm;

export type SidePose = {
  hip: V;
  lean: number;      // кеуденің алға еңкеюі (радиан)
  headTilt: number;  // басты төмен/жоғары бұру (радиан, оң — төмен қарау)
  footN: V; footF: V; // жақын/алыс табан (жер нүктесі, y — табан деңгейі)
  handN: V; handF: V;
  facing: 1 | -1;
};

export type Joints = {hip: V; shoulder: V; neck: V; head: V; kneeN: V; kneeF: V; footN: V; footF: V; elbowN: V; elbowF: V; handN: V; handF: V};

export function solveSide(p: SidePose): Joints {
  const f = p.facing;
  const dir: V = [Math.sin(p.lean) * f, -Math.cos(p.lean)];
  const shoulder = add(p.hip, mul(dir, BONES.torso));
  const neck = add(shoulder, mul(dir, BONES.neck));
  const ha = p.lean + p.headTilt;
  const head = add(neck, mul([Math.sin(ha) * f, -Math.cos(ha)], BONES.head));
  const legN = ik(p.hip, p.footN, BONES.thigh, BONES.shin, -f);
  const legF = ik(p.hip, p.footF, BONES.thigh, BONES.shin, -f);
  const armN = ik(shoulder, p.handN, BONES.upperArm, BONES.foreArm, f);
  const armF = ik(shoulder, p.handF, BONES.upperArm, BONES.foreArm, f);
  return {hip: p.hip, shoulder, neck, head, kneeN: legN.joint, kneeF: legF.joint, footN: legN.end, footF: legF.end, elbowN: armN.joint, elbowF: armF.joint, handN: armN.end, handF: armF.end};
}

/** Поза: қол нысанасы иықтан тым төмен болса — алдымен тізе бүгіледі (жамбас түседі), қалғанын кеуде еңкеюі толықтырады.
    Нысана тым жоғары болса — аяқтың ұшымен көтерілу. */
export function postureFor(hipX: number, handTarget: V | null, facing: 1 | -1, groundY = G): {hipY: number; lean: number} {
  const standHipY = groundY - STAND_HIP;
  const standShoulderY = standHipY - BONES.torso;
  if (!handTarget) return {hipY: standHipY, lean: 0.04};
  const desiredShoulderY = handTarget[1] - 70;
  const lower = desiredShoulderY - standShoulderY;
  if (lower > 0) {
    const hipY = standHipY + Math.min(74, lower * 0.65);
    const c = clamp((hipY - desiredShoulderY) / BONES.torso, 0.2, 1);
    const dxf = (handTarget[0] - hipX) * facing;
    const lean = clamp(Math.acos(c) + clamp(dxf / 500, -0.1, 0.12), 0.04, 1.3);
    return {hipY, lean};
  }
  const above = standShoulderY - handTarget[1] - (REACH - 6);
  return {hipY: standHipY - clamp(above, 0, 12), lean: 0.03};
}

/** Табан сырғымайтын процедуралық қадам: жамбастың x-траекториясын симуляциялайды (детерминирленген). */
export function simulateFeet(hipX: (t: number) => number, t: number, t0: number, facing: (t: number) => 1 | -1, opts?: {spread?: number; swingDur?: number; lift?: number}) {
  const spread = opts?.spread ?? 7, swingDur = opts?.swingDur ?? 0.24, lift = opts?.lift ?? 13;
  const dt = 1 / 120;
  let x = hipX(t0);
  let feet: number[] = [x + spread * facing(t0), x - spread * facing(t0)];
  let sw: {i: number; from: number; to: number; t0: number} | null = null;
  let prev = x;
  for (let tt = t0; tt <= t + 1e-9; tt += dt) {
    x = hipX(tt);
    const vel = (x - prev) / dt; prev = x;
    const f = facing(tt);
    if (sw && tt - sw.t0 >= swingDur) { feet[sw.i] = sw.to; sw = null; }
    if (!sw) {
      const want = [x + spread * f + vel * 0.2, x - spread * f + vel * 0.2];
      const e0 = want[0] - feet[0], e1 = want[1] - feet[1];
      if (Math.max(Math.abs(e0), Math.abs(e1)) > 15) {
        const i = Math.abs(e0) > Math.abs(e1) ? 0 : 1;
        sw = {i, from: feet[i], to: want[i] + vel * 0.12, t0: tt};
      }
    }
  }
  const out: {x: number; lift: number}[] = feet.map(fx => ({x: fx, lift: 0}));
  if (sw) {
    const p = clamp((t - sw.t0) / swingDur);
    const e = p * p * (3 - 2 * p);
    out[sw.i] = {x: lerp(sw.from, sw.to, e), lift: Math.sin(Math.PI * p) * lift};
  }
  return {feet: out, swinging: sw ? sw.i : -1, swingP: sw ? clamp((t - sw.t0) / swingDur) : 0};
}

const seg = (a: V, b: V) => `M${a[0].toFixed(2)},${a[1].toFixed(2)}L${b[0].toFixed(2)},${b[1].toFixed(2)}`;
const limb = (a: V, b: V, c: V) => `M${a[0].toFixed(2)},${a[1].toFixed(2)}L${b[0].toFixed(2)},${b[1].toFixed(2)}L${c[0].toFixed(2)},${c[1].toFixed(2)}`;

export type FigureStyle = {color?: string; width?: number; farOpacity?: number; headFill?: string; opacity?: number; outline?: boolean};

/** Бүйірден көрінетін фигура. layer: 'body' (алыс аяқ-қол, дене, бас, жақын аяқ) немесе 'nearArm' немесе 'all'. */
export const SideFigure: React.FC<{j: Joints; style?: FigureStyle; layer?: 'far' | 'body' | 'nearArm' | 'all'}> = ({j, style, layer = 'all'}) => {
  const c = style?.color ?? PAL.ivory, w = style?.width ?? 7, fo = style?.farOpacity ?? 0.5;
  const common = {fill: 'none', stroke: c, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  const ol = {...common, stroke: '#121317', strokeWidth: w + 5};
  const outline = style?.outline ?? true;
  return (
    <g opacity={style?.opacity ?? 1}>
      {(layer === 'far' || layer === 'all') && (
        <>
          {outline && <path d={limb(j.shoulder, j.elbowF, j.handF)} {...ol} opacity={0.55 * fo} />}
          <path d={limb(j.shoulder, j.elbowF, j.handF)} {...common} opacity={fo} />
        </>
      )}
      {(layer === 'body' || layer === 'all') && (
        <>
          {outline && <path d={limb(j.hip, j.kneeF, j.footF)} {...ol} opacity={0.55 * fo} />}
          {outline && <path d={seg(j.hip, j.neck)} {...ol} opacity={0.75} />}
          {outline && <circle cx={j.head[0]} cy={j.head[1]} r={BONES.head + 2.5} fill="#121317" opacity={0.75} />}
          {outline && <path d={limb(j.hip, j.kneeN, j.footN)} {...ol} opacity={0.75} />}
          <path d={limb(j.hip, j.kneeF, j.footF)} {...common} opacity={fo} />
          <path d={seg(j.hip, j.neck)} {...common} />
          <circle cx={j.head[0]} cy={j.head[1]} r={BONES.head} fill={style?.headFill ?? c} />
          <path d={limb(j.hip, j.kneeN, j.footN)} {...common} />
        </>
      )}
      {(layer === 'nearArm' || layer === 'all') && outline && <path d={limb(j.shoulder, j.elbowN, j.handN)} {...ol} opacity={0.75} />}
      {(layer === 'nearArm' || layer === 'all') && <path d={limb(j.shoulder, j.elbowN, j.handN)} {...common} />}
    </g>
  );
};

// ---------- алдынан көрінетін фигура (жоспар құрушы A) ----------
export type FrontPose = {hip: V; shoulderDrop: number; headOff: V; handL: V; handR: V; footL: V; footR: V};
export function solveFront(p: FrontPose) {
  const sc: V = [p.hip[0], p.hip[1] - BONES.torso + p.shoulderDrop];
  const shL: V = [sc[0] - BONES.shoulderHalf, sc[1] + 2], shR: V = [sc[0] + BONES.shoulderHalf, sc[1] + 2];
  const hipL: V = [p.hip[0] - BONES.hipHalf, p.hip[1]], hipR: V = [p.hip[0] + BONES.hipHalf, p.hip[1]];
  const neck: V = [sc[0] + p.headOff[0] * 0.3, sc[1] - BONES.neck];
  const head: V = [sc[0] + p.headOff[0], sc[1] - BONES.neck - BONES.head + p.headOff[1]];
  const aL = ik(shL, p.handL, BONES.upperArm, BONES.foreArm, 1);
  const aR = ik(shR, p.handR, BONES.upperArm, BONES.foreArm, -1);
  const lL = ik(hipL, p.footL, BONES.thigh, BONES.shin, 1);
  const lR = ik(hipR, p.footR, BONES.thigh, BONES.shin, -1);
  return {sc, shL, shR, hipL, hipR, neck, head, elbowL: aL.joint, handL: aL.end, elbowR: aR.joint, handR: aR.end, kneeL: lL.joint, footL: lL.end, kneeR: lR.joint, footR: lR.end, hip: p.hip};
}
export type FrontJoints = ReturnType<typeof solveFront>;

export const FrontFigure: React.FC<{j: FrontJoints; style?: FigureStyle}> = ({j, style}) => {
  const c = style?.color ?? PAL.ivory, w = style?.width ?? 7;
  const common = {fill: 'none', stroke: c, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  return (
    <g opacity={style?.opacity ?? 1}>
      <path d={limb(j.hipL, j.kneeL, j.footL)} {...common} />
      <path d={limb(j.hipR, j.kneeR, j.footR)} {...common} />
      <path d={seg(j.hipL, j.hipR)} {...common} />
      <path d={seg(j.hip, j.sc)} {...common} />
      <path d={seg(j.shL, j.shR)} {...common} />
      <path d={limb(j.shL, j.elbowL, j.handL)} {...common} />
      <path d={limb(j.shR, j.elbowR, j.handR)} {...common} />
      <path d={seg(j.sc, j.neck)} {...common} />
      <circle cx={j.head[0]} cy={j.head[1]} r={BONES.head} fill={style?.headFill ?? c} />
    </g>
  );
};

// ---------- бұрылу морфы: бүйір көрініс ↔ арқа көрінісі (буындар нүкте-нүктесімен ауысады, бас дөңгелек қалады) ----------
type Lines = {pl: V[][]; head: V; farIdx: number[]};
export function sideLines(j: Joints): Lines {
  return {pl: [[j.hip, j.kneeF, j.footF], [j.shoulder, j.elbowF, j.handF], [j.hip, j.shoulder, j.neck], [j.shoulder, j.shoulder], [j.hip, j.hip], [j.hip, j.kneeN, j.footN], [j.shoulder, j.elbowN, j.handN]], head: j.head, farIdx: [0, 1]};
}
export function frontLines(f: FrontJoints): Lines {
  return {pl: [[f.hipL, f.kneeL, f.footL], [f.shL, f.elbowL, f.handL], [f.hip, f.sc, f.neck], [f.shL, f.shR], [f.hipL, f.hipR], [f.hipR, f.kneeR, f.footR], [f.shR, f.elbowR, f.handR]], head: f.head, farIdx: []};
}
export const MorphFigure: React.FC<{a: Lines; b: Lines; k: number; style?: FigureStyle}> = ({a, b, k, style}) => {
  const c = style?.color ?? PAL.ivory, w = style?.width ?? 7, outline = style?.outline ?? true;
  const mix = (p: V, q: V): V => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
  const pls = a.pl.map((pl, i) => pl.map((p, n) => mix(p, b.pl[i][n])));
  const head = mix(a.head, b.head);
  const d = (pl: V[]) => pl.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('');
  const op = (i: number) => (a.farIdx.includes(i) ? lerp(style?.farOpacity ?? 0.5, 1, k) : 1);
  const common = {fill: 'none', stroke: c, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  return (
    <g opacity={style?.opacity ?? 1}>
      {outline && pls.map((pl, i) => <path key={'o' + i} d={d(pl)} {...common} stroke="#121317" strokeWidth={w + 5} opacity={0.7 * op(i)} />)}
      {outline && <circle cx={head[0]} cy={head[1]} r={BONES.head + 2.5} fill="#121317" opacity={0.75} />}
      {pls.map((pl, i) => <path key={i} d={d(pl)} {...common} opacity={op(i)} />)}
      <circle cx={head[0]} cy={head[1]} r={BONES.head} fill={style?.headFill ?? c} />
    </g>
  );
};
