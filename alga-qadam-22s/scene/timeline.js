// Оқиға (22 с): есікке жақындау → итеру, ашылмайды → жарық басқа бағытты көрсетеді →
// (match cut: есік жақтауы → бүйірдегі жарық саңылау) → кран жоғары/артқа: тар бөлме — үлкен әлемнің бөлшегі →
// камера кейіпкердің артына сырғып түседі: ол биік алаңға соңғы қадамын «Бір қадам жаса» сәтінде басады.
import * as THREE from 'three';
import {POSE, applyStand, clamp, eio, esine, kf, lerp, mixPose, range, ss} from './anim.js';
import {arcTable, walkAlong} from './walk.js';
import {DOOR, GAP, LEDGE, ROOM, aimShaft} from './world.js';

export const DURATION = 22;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- кейіпкер жолдары ----------
// трапеция жылдамдық: жұмсақ бастау/тоқтау; s(t) ∈ [0,1]
function trap(t, t0, t1, acc = 0.8, dec = 1.0) {
  const T = t1 - t0, u = clamp(t - t0, 0, T), vmax = 1 / (T - acc / 2 - dec / 2);
  if (u < acc) return 0.5 * vmax * u * u / acc;
  if (u < T - dec) return vmax * (acc / 2 + (u - acc));
  const r = T - u; return 1 - 0.5 * vmax * r * r / dec;
}
// сызықтық-бөлікті жолды доға ұзындығы бойынша параметрлеу
function polyline(pts) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = L[L.length - 1];
  // бұрыштарды жұмсарту: Chaikin екі рет
  let P = pts; for (let k = 0; k < 3; k++) { const Q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } Q.push(P[P.length - 1]); P = Q; }
  const S = [0]; for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const tot = S[S.length - 1];
  return {length: tot, at(u) { const s = clamp(u) * tot; let i = 1; while (i < S.length - 1 && S[i] < s) i++; const f = (s - S[i - 1]) / Math.max(1e-9, S[i] - S[i - 1]); return [lerp(P[i - 1][0], P[i][0], f), lerp(P[i - 1][1], P[i][1], f)]; }, total};
}

const Z_START = -2.5, Z_DOOR = -7.62;                       // есікке жақындау: z бойымен (бет −z)
const P1 = t => [0.04, lerp(Z_START, Z_DOOR, trap(t, 0.35, 4.75, 0.9, 1.2))];
const T1 = arcTable(P1, 0.35, 4.75);
const Z_BACK = -7.28;                                         // бір қадам артқа
const OUT = polyline([[0.04, Z_BACK], [1.0, -6.9], [2.0, -6.4], [GAP.x, GAP.z], [3.6, -6.2], [5.5, -5.6], [7.6, -4.8], [9.6, -4.3], [LEDGE.x, LEDGE.z]]);
const W0 = 9.55, W1 = 18.05;                                  // шығу жолы: саңылау → алаң (соңғы қадам «Бір қадам жаса» тұсында)
const P3 = t => OUT.at(trap(t, W0, W1, 1.1, 1.5));
const T3 = arcTable(P3, W0, W1);
export const HEADING_GAP = Math.atan2(0.96, 0.38);            // саңылауға қарай бет бұрышы

// ---------- камера: уақыт бойынша Катмулл–Ром (жылдамдық үздіксіз), шеткі нүктелерде тоқтайды ----------
function spline(keys, t) {
  if (t <= keys[0][0]) return keys[0][1].clone();
  if (t >= keys[keys.length - 1][0]) return keys[keys.length - 1][1].clone();
  let i = 0; while (keys[i + 1][0] < t) i++;
  const [t0, p0] = keys[i], [t1, p1] = keys[i + 1], h = t1 - t0, u = (t - t0) / h;
  const tan = j => { if (j === 0 || j === keys.length - 1) return V(0, 0, 0); const [ta, pa] = keys[j - 1], [tb, pb] = keys[j + 1]; return pb.clone().sub(pa).multiplyScalar(1 / (tb - ta)); };
  const m0 = tan(i).multiplyScalar(h), m1 = tan(i + 1).multiplyScalar(h);
  const u2 = u * u, u3 = u2 * u;
  return p0.clone().multiplyScalar(2 * u3 - 3 * u2 + 1).add(m0.multiplyScalar(u3 - 2 * u2 + u)).add(p1.clone().multiplyScalar(-2 * u3 + 3 * u2)).add(m1.multiplyScalar(u3 - u2));
}
const CUT = 9.5;                                              // match cut: есік жақтауы → саңылау жақтауы
// match cut: есік (1.6×4.2) 6.5 м-ден, саңылау (1.1×2.9) 4.5 м-ден — бұрыштық өлшемі мен орны бірдей; камера биіктігі де сәйкестендірілген
const D_DOOR = 6.5, D_GAP = 4.5, H_DOOR = 1.45, H_GAP = H_DOOR * D_GAP / D_DOOR, LOOK_DOOR = 1.7, LOOK_GAP = H_GAP + (LOOK_DOOR - H_DOOR) * D_GAP / D_DOOR;
const CAM_A = [[0, V(0.42, 1.2, 4.2)], [2.6, V(0.25, 1.32, 1.5)], [5.0, V(0.1, 1.42, -1.05)], [CUT, V(0.0, H_DOOR, DOOR.z + D_DOOR)]];
const LOOK_A = [[0, V(0.0, 1.45, -8)], [5.0, V(0.0, 1.62, -8)], [CUT, V(0.0, LOOK_DOOR, -8)]];
// кран: бөлме ішінен жоғары → үстінен төмен қарау (бөлме — кең үстірттегі кішкентай қорап) → көкжиекке қарай көтеріліп, кейіпкердің артына сырғу
// кран: бөлме ішінен жоғары → үстінен төмен қарау (бөлме — кең үстірттегі кішкентай қорап) → көкжиекке қарай көтеріліп, кейіпкердің артына сырғу
// (кейіпкер бүкіл қозғалыс бойы кадрдың төменгі бөлігінде қалады)
const CAM_B = [[CUT, V(GAP.x - D_GAP, H_GAP, GAP.z)], [11.2, V(-2.1, 2.3, -6.2)], [12.6, V(-1.6, 7.5, -6.0)], [14.2, V(0.5, 19, -5.5)], [16.0, V(2.0, 30, -5.0)],
  [17.4, V(4.0, 19, -4.0)], [18.6, V(4.6, 11, -3.2)], [20.0, V(4.8, 5.5, -2.7)], [21.4, V(4.85, 3.45, -2.62)], [22.0, V(4.88, 3.38, -2.63)]];
const LOOK_B = [[CUT, V(GAP.x, LOOK_GAP, GAP.z)], [11.2, V(3.5, 0.8, -6.0)], [12.6, V(4.5, 0.0, -5.8)], [14.2, V(5.0, 0, -5.5)], [16.0, V(6.5, 0, -5.4)],
  [17.4, V(16, -2, -6)], [18.6, V(22, -5, -7)], [20.0, V(36, -5.4, -9)], [21.4, V(42, -5.8, -10.1)], [22.0, V(42, -5.8, -10.1)]];
const FOV = t => t < CUT ? 50 : kf(t, [[CUT, 50], [12.0, 52], [16.0, 56], [18.5, 54], [21.4, 50], [22, 50]]);

export function cameraAt(t) {
  return t < CUT ? {pos: spline(CAM_A, t), look: spline(LOOK_A, t), fov: FOV(t)} : {pos: spline(CAM_B, t), look: spline(LOOK_B, t), fov: FOV(t)};
}

// ---------- экрандағы мәтін (дауыстағы кілт сөз айтылған сәтте ерекшеленеді) ----------
export function titlesAt(t, timing) {
  const k = id => timing[id].keyAt;
  return [
    {lines: [['БӘРІ СЕН ', {w: 'ОЙЛАҒАНДАЙ'}], ['БОЛМАУЫ МҮМКІН']], t0: 0.8, t1: 4.75, key: k('l1')},
    {lines: [['БҰЛ — ', {w: 'СОҢЫ ЕМЕС'}]], t0: 6.05, t1: 9.25, key: k('l2')},
    {lines: [['АЛДЫҢДА —'], [{w: 'ЖАҢА МҮМКІНДІК'}]], t0: 10.65, t1: 15.45, key: k('l3')},
    {lines: [['АЛҒА ', {w: 'ҚАДАМ'}, ' ЖАСА']], t0: 16.35, t1: 23, key: k('l4b')},
  ].filter(T => t >= T.t0 - 0.01 && t < T.t1 + 0.8);
}

// ---------- кейіпкердің әрекеті ----------
const reachP = {...POSE.stand, spine: [0.12, 0, 0], chest: [0.05, 0, 0], head: [-0.05, 0, 0],
  armL: {sh: [-1.32, 0, 0.12], el: -0.25, wr: [0.5, 0, 0], grip: 0.05}, armR: {sh: [-1.32, 0, -0.12], el: -0.25, wr: [0.5, 0, 0], grip: 0.05}};
const pushP = {...reachP, hipY: 0.9, spine: [0.3, 0, 0], chest: [0.1, 0, 0], head: [-0.15, 0, 0],
  armL: {sh: [-1.38, 0, 0.12], el: -0.08, wr: [0.6, 0, 0], grip: 0.0}, armR: {sh: [-1.38, 0, -0.12], el: -0.08, wr: [0.6, 0, 0], grip: 0.0}};
const lowP = {...POSE.stand, spine: [0.1, 0, 0], chest: [0.06, 0, 0], neck: [0.1, 0, 0], head: [0.25, 0, 0], armL: {sh: [0.02, 0, 0.06], el: -0.12, grip: 0.5}, armR: {sh: [0.02, 0, -0.06], el: -0.12, grip: 0.5}};
const walkP = {...POSE.stand, spine: [0.06, 0, 0], head: [-0.02, 0, 0]};
const turnFeet = (on, lt) => ({footL: [0.1, on ? Math.max(0, Math.sin(lt * Math.PI * 2)) * 0.05 : 0, 0.03], footR: [-0.1, on ? Math.max(0, -Math.sin(lt * Math.PI * 2)) * 0.05 : 0, -0.03]});

export function heroAt(S, t) {
  const h = S.hero;
  if (t < 4.75) {                                                    // есікке жақындау
    if (t < 0.35) { applyStand(h, [0.04, 0, Z_START], Math.PI, walkP); return; }
    walkAlong(h, P1, T1, t, 0.35, walkP, {stride: 0.62, swing: 0.44, armSwing: 0.8, t1: 4.75}, Math.PI);
    return;
  }
  if (t < 7.7) {                                                     // қол созу → екі рет итеру → босату
    const push = Math.max(Math.sin(Math.PI * range(t, 5.35, 5.95)), 1.25 * Math.sin(Math.PI * range(t, 6.05, 6.85)));
    let p = mixPose(walkP, reachP, esine(range(t, 4.75, 5.3)));
    p = mixPose(p, pushP, clamp(push));
    p = mixPose(p, lowP, esine(range(t, 7.0, 7.7)));
    // салмақ: итергенде оң аяқ артқа тіреледі
    const brace = esine(range(t, 5.0, 5.4)) * (1 - esine(range(t, 7.1, 7.6)));
    applyStand(h, [0.04, 0, Z_DOOR + 0.03 * clamp(push)], Math.PI, p, {footL: [0.1, 0, 0.06 + 0.06 * brace], footR: [-0.1, Math.max(0, Math.sin(Math.PI * range(t, 4.95, 5.3))) * 0.05, -0.03 - 0.22 * brace]});
    return;
  }
  if (t < 8.45) {                                                    // бір қадам артқа: алдымен оң аяқ, сосын сол
    const u = range(t, 7.7, 8.45), rz = lerp(Z_DOOR, Z_BACK, ss(u));
    const fR = Z_DOOR + 0.03 - lerp(0, Z_BACK - Z_DOOR + 0.1, ss(range(t, 7.7, 8.05)));
    const fL = Z_DOOR - 0.03 - lerp(0, Z_BACK - Z_DOOR, ss(range(t, 8.05, 8.45)));
    const lift = (a, b) => Math.sin(Math.PI * range(t, a, b)) * 0.045;
    applyStand(h, [0.04, 0, rz], Math.PI, lowP, {footL: [0.1, lift(8.05, 8.45), -(fL - rz)], footR: [-0.1, lift(7.7, 8.05), -(fR - rz)]});
    return;
  }
  if (t < W0) {                                                      // басын көтеріп, жарыққа бұрылу
    const look = esine(range(t, 8.45, 8.95)), turn = range(t, 8.85, 9.5);
    const p = mixPose(lowP, {...walkP, head: [-0.05, -0.55 * (1 - esine(turn)), 0]}, look);
    applyStand(h, [0.04, 0, Z_BACK], lerp(Math.PI, HEADING_GAP, esine(turn)), p, turnFeet(turn > 0 && turn < 1, turn));
    return;
  }
  // жарыққа қарай жүру → алаңда тоқтау; соңында иық түзу, басы сәл көтеріңкі
  const arrive = esine(range(t, W1 - 0.4, W1 + 0.8));
  const base = mixPose(walkP, {...POSE.upright, head: [-0.12, 0, 0]}, arrive);
  if (t < W1) walkAlong(h, P3, T3, t, W0, base, {stride: 0.66, swing: 0.44, armSwing: 0.85, t1: W1});
  else { const [x, z] = P3(W1); applyStand(h, [x, 0, z], Math.PI / 2 - 0.02, base); }
}

// ---------- жарық, есік, атмосфера ----------
export function worldAt(S, t) {
  const W = S.world;
  // есік: итергенде сәл дірілдейді (ашылмайды)
  const hit = (a) => Math.exp(-Math.max(0, t - a) * 9) * (t > a ? 1 : 0);
  const shake = 0.006 * hit(5.62) * Math.sin((t - 5.62) * 70) + 0.009 * hit(6.42) * Math.sin((t - 6.42) * 64);
  W.door.position.z = DOOR.z - 0.25 - Math.abs(shake) * 0.6; W.door.rotation.y = shake * 0.5;
  // жоғарыдан түсетін шоқ: есік алдында → оңға (саңылауға) сырғиды → сөнеді
  const slide = esine(range(t, 7.3, 9.2));
  const tgt = V(lerp(0.1, 1.9, slide), 0, lerp(-6.6, -6.3, slide));
  W.beam.target.position.copy(tgt); W.beam.position.set(tgt.x * 0.4 + 0.3, 34, tgt.z + 0.6);
  const beamI = kf(t, [[0, 0], [1.2, 900], [8.4, 900], [9.35, 0]]);   // match cut-қа дейін сөнеді
  W.beam.intensity = beamI; aimShaft(W.beamShaft, W.beam.position, tgt); W.beamShaft.material.uniforms.uInt.value = beamI / 900 * 0.55;
  // күн (көкжиек жақтан): бастапқыда бұлтта, 7.5–9.3 с жарылып шығады
  W.sun.intensity = kf(t, [[0, 0.05], [7.5, 0.05], [9.3, 2.6], [22, 2.6]]);
  W.hemi.intensity = kf(t, [[0, 0.16], [7.5, 0.16], [9.5, 0.32], [13, 0.62], [22, 0.62]]);
  W.fill.intensity = kf(t, [[0, 0.5], [9.5, 0.5], [12, 0]]);
  W.sky.material.uniforms.uGlow.value = kf(t, [[0, 0.2], [9.0, 1.0], [16, 1.1], [21, 1.35], [22, 1.35]]);
  // есік жіктері: бір қалыпты жарық (саңылау ашылғанда маңызы азаяды)
  const slitK = kf(t, [[0, 1], [9.5, 1], [12, 0.6]]);
  W.slitMat.color.setScalar(slitK * 1.6); W.streaks.children.forEach(m => (m.material.opacity = 0.5 * slitK)); W.doorSpill.intensity = 1.1 * slitK;
  W.doorShaft.material.uniforms.uInt.value = 0.75 * slitK * (1 - range(t, 9.15, 9.45));   // match cut-тан кейін бүйірден көрінбеуі үшін
  // ауа перспективасы
  S.scene.fog.density = kf(t, [[0, 0.0], [9.5, 0.002], [15, 0.0045], [22, 0.0045]]);
  W.dustIn.update(t); W.dustOut.update(t);
  W.beamShaft.material.uniforms.uTime.value = t; W.doorShaft.material.uniforms.uTime.value = t;
  S.exposure = kf(t, [[0, 0.0], [0.9, 0.95], [CUT - 0.25, 0.95], [CUT, 1.0], [12, 0.9], [22, 0.9]]);
  S.endFade = range(t, 21.45, 22.0);
  S.flash = Math.exp(-Math.abs(t - CUT) * 7) * 0.12;                 // жарық арқылы ауысу: жұмсақ жарқырау (қатты жарқыл емес)
}

export const MARKS = {CUT, W0, W1, push: [5.62, 6.42], back: [7.85, 8.25], sunUp: [7.5, 9.3]};
