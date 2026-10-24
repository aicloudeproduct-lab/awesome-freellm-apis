// «Екі терезе» — all shots. Times are film seconds; each frame(C, t, lt)
// poses the cast, lights the set, moves the camera and returns what to render.
import * as THREE from 'three';
import {clamp, lerp, smooth, easeIO, easeOut, sine, mixV, track} from '../lib/util.js';
import {seated, standing, kneeling, squat, walking, toWorld, blend, hangHand} from '../anim/poses.js';
import {lightApartment, drawTV, DESK, DINING, WIN, AYAN_DOOR, AYAN_HOUSE_Z} from '../sets/apartment.js';
import {talk, camRig, charCam, inHand, palm, attach, hideAllBut, LOOK, key} from './core.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

// ---------------------------------------------------------------- shared poses
const ARMAN_DESK = {x: DESK.x, z: DESK.z + 0.74, ry: PI};
const ARMAN_DINE = {x: DINING.x, z: DINING.z + 0.64, ry: PI};
const WIFE_DINE = {x: DINING.x, z: DINING.z - 0.62, ry: 0};

/** Arman at the desk holding the phone in front of him. f: face params; o: tweak */
function armanPhone(C, t, f = {}, o = {}) {
  const A = C.cast.arman, b = ARMAN_DESK;
  const p = seated(A, b, {seat: 0.46, lean: o.lean ?? 0.22, neck: o.neck || [0.3, 0, 0], head: o.head || [0.12, 0, 0]});
  const hy = o.hy ?? 0.98, hz = o.hz ?? 0.3;
  p.armR = {ik: toWorld(b, -0.06, hy, hz), twist: 1.35, flex: -0.25, curl: [0.62, 0.7, 0.78, 0.82], thumb: o.thumb ?? 0.15, pole: toWorld(b, -0.6, 0.6, -0.2)};
  p.armL = o.oneHand ? {ik: toWorld(b, 0.24, 0.72, 0.28), twist: 0.4, curl: 0.35, pole: toWorld(b, 0.6, 0.5, -0.2)} : {ik: toWorld(b, 0.05, hy - 0.02, hz + 0.02), twist: 1.1, flex: -0.15, curl: 0.55, thumb: 0.4, pole: toWorld(b, 0.6, 0.6, -0.2)};
  if (o.armR) p.armR = {...p.armR, ...o.armR};
  if (o.armL) p.armL = {...p.armL, ...o.armL};
  p.face = f;
  A.setPose(p, t);
  inHand(C.phone, A, 'R', [0.02, 0.012, 0.0], [0, 0, 0]);
  return A;
}

function phoneLightPos(C) { return C.phone.localToWorld(V(0, 0, 0.12)); }

function wifeAtTable(C, t, f = {}, o = {}) {
  const W = C.cast.wife, b = WIFE_DINE;
  const p = seated(W, b, {seat: 0.46, lean: o.lean ?? 0.06, neck: [0.05, 0, 0], head: o.head || [0.05, 0, 0]});
  p.armL = o.armL || {ik: toWorld(b, 0.09, 0.8, 0.32), twist: 0.6, curl: 0.4};
  p.armR = o.armR || {ik: toWorld(b, -0.07, 0.8, 0.34), twist: 0.6, curl: 0.4};
  p.face = f;
  W.setPose(p, t);
  return W;
}

function curtainState(C, closeAmt) {
  const S = C.S.apt;
  const x1 = lerp(0.3, 2.05, easeIO(closeAmt));
  S.curtainL.set(-0.35, x1, closeAmt > 0 && closeAmt < 1 ? 0.6 : 0, C.t, 14);
}

// ---------------------------------------------------------------- ACT 1 · night
const s01Cam = camRig([[0, [0.78, 1.47, 0.05], [1.05, 1.55, -2.6], 40], [4.2, [0.8, 1.43, -0.35], [1.05, 1.52, -2.6], 37]]);
const s02Cam = camRig([[0, [0.82, 1.26, -1.15], [1.0, 0.97, -1.62], 26], [2.6, [0.86, 1.2, -1.28], [1.0, 0.97, -1.63], 22]]);
const s03Cam = charCam([[0, {yaw: 0.45, pitch: -0.16, dist: 0.85, fov: 26, ty: -0.03}], [1.8, {yaw: 0.4, pitch: -0.14, dist: 0.74, fov: 25, ty: -0.03}]]);
const s04Cam = camRig([[0, [1.32, 1.42, -0.92], [0.3, 1.05, -2.2], 40], [1.45, [1.25, 1.4, -1.0], [0.3, 1.08, -2.2], 38], [2.2, [0.85, 1.55, -1.85], [1.15, 1.95, -6], 24]]);

const POST_TYPED = track([[0, 0.5], [5.4, 1.0]]);

function act1Frame(C, t, lt, which) {
  const S = C.S.apt; attach(S.scene, C.cast.arman, C.cast.son, C.cast.wife);
  hideAllBut(C.cast, ['arman', 'son', 'wife']);
  const typed = POST_TYPED(t);
  const hover = smooth(7.6, 8.6, t);
  C.ui.draw({mode: 'compose', typed, hover, t, key: Math.floor(t * 9) % 40});
  // Arman: tense, thumb typing, then hovering
  const typing = t < 5.4 ? 0.5 + 0.5 * Math.sin(t * 19) : 0;
  const A = armanPhone(C, t, {look: C.phone.position, tense: 0.45 + 0.2 * smooth(6, 9, t), squint: 0.2, browDown: 0.2},
    {thumb: 0.15 + typing * 0.25 + hover * 0.1, hy: 0.98, hz: 0.3});
  // son approaches the curtain in S04
  const Sn = C.cast.son;
  const reach = smooth(9.3, 9.95, t);
  const sb = {x: -0.12, z: -1.95, ry: PI * 0.5};
  const sp = standing(Sn, sb, {spine: [0.05, 0, 0]});
  sp.armL = {ik: toWorld(sb, 0.25, 0.85, 0.12)};
  sp.armR = {ik: V(lerp(-0.05, 0.27, reach), lerp(0.85, 1.12, reach), lerp(-1.85, -2.2, reach)), twist: 0.8, curl: lerp(0.3, 0.15, reach), spread: 0.2};
  sp.face = {look: V(0.3, 1.2, -2.25), browIn: 0.3};
  Sn.root.visible = which === 4;
  Sn.setPose(sp, t);
  // wife waiting in the warm kitchen light (background)
  wifeAtTable(C, t, {look: A.eyesWorld(), sad: 0.25}, {lean: 0.12, head: [0.15, 0.25, 0]});
  curtainState(C, 0);
  lightApartment(S, {mode: 'night', t, phone: which === 3 ? 0.55 : 1, phonePos: phoneLightPos(C), pendant: 0.55, hall: 0.0, warmth: 1});
  const cam = C.cam;
  if (which === 1) s01Cam(cam, lt);
  if (which === 2) s02Cam(cam, lt);
  if (which === 3) s03Cam(cam, lt, A);
  if (which === 4) {
    if (lt < 0.9) {
      const ph = C.phone, q = ph.getWorldQuaternion(new THREE.Quaternion());
      const n = V(0, 0, 1).applyQuaternion(q), up = V(0, 1, 0).applyQuaternion(q), ac = V(1, 0, 0).applyQuaternion(q);
      const tgt = ph.getWorldPosition(V(0, 0, 0)).addScaledVector(up, -0.035).addScaledVector(ac, 0.012);
      const eye = tgt.clone().addScaledVector(n, lerp(0.17, 0.14, lt / 0.9)).addScaledVector(up, -0.06).addScaledVector(ac, 0.02);
      cam.position.copy(eye);
      cam.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, tgt, up));
      cam.fov = 30; cam.updateProjectionMatrix();
    }
    else if (lt < 1.6) camRig([[0.9, [-0.25, 1.22, -1.55], [0.3, 1.1, -2.22], 30], [1.6, [-0.2, 1.22, -1.6], [0.3, 1.12, -2.22], 28]])(cam, lt);
    else camRig([[1.6, [0.75, 1.5, -1.35], [1.1, 1.9, -6], 30], [2.2, [0.9, 1.6, -1.95], [1.15, 1.95, -6], 22]])(cam, lt);
  }
  const focus = which === 1 ? 2.0 : which === 2 ? 0.45 : which === 3 ? 0.8 : lt < 0.9 ? 0.16 : lt < 1.6 ? 0.8 : 14;
  const flash = which === 4 ? smooth(1.55, 2.2, lt) : 0;
  return {scene: S.scene, camera: cam, look: {...LOOK.night, exposure: 1.25, focus, aperture: which === 1 ? 0.35 : 0.5, maxBlur: 0.01, flash, flashColor: '#ffe6bf', vignette: 0.42}};
}

// ---------------------------------------------------------------- ACT 2 · together
const YARD_A = {x: -0.42, z: 0.18, ry: PI * 0.5};
const YARD_B = {x: 0.42, z: 0.12, ry: -PI * 0.5};
const s05Cam = camRig([[0, [1.0, 0.74, 1.85], [0, 0.44, 0.1], 34], [4.4, [-0.6, 0.76, 1.75], [0, 0.43, 0.1], 31]]);
const s06aCam = camRig([[0, [0.05, 0.62, 1.05], [0, 0.16, 0.15], 34], [1.0, [0.03, 0.58, 0.95], [0, 0.16, 0.15], 32]]);

function yardFrame(C, t, lt, close = false) {
  const Y = C.S.yard; attach(Y.scene, C.cast.armanKid, C.cast.ayanKid); hideAllBut(C.cast, ['armanKid', 'ayanKid']);
  Y.update(t);
  // wall section falls (11.6–12.0) and is held up by Arman (12.2–13.4), rebuilt
  const fall = smooth(11.5, 12.0, t) * (1 - smooth(12.6, 13.4, t));
  Y.fallSection.rotation.z = fall * 1.1;
  const AK = C.cast.armanKid, YK = C.cast.ayanKid;
  // Ayan places a brick, Arman catches the falling wall
  const pa = squat(AK, YARD_A, {spine: [0.5, 0, 0]});
  const catchT = smooth(11.7, 12.15, t) * (1 - smooth(13.2, 13.8, t));
  pa.armR = {ik: V(lerp(-0.2, -0.17, catchT), lerp(0.12, 0.27, catchT), lerp(0.25, 0.12, catchT)), twist: 0.4, curl: 0.25};
  pa.armL = {ik: V(lerp(-0.25, -0.18, catchT), lerp(0.1, 0.22, catchT), lerp(0.05, 0.0, catchT)), twist: 0.6, curl: 0.25};
  const grin = smooth(13.6, 14.2, t);
  pa.face = {look: catchT > 0.3 ? V(-0.17, 0.25, 0.15) : V(0.1, 0.3, 0.1), smile: 0.35 + grin * 0.4, wide: catchT * 0.4 * (1 - grin)};
  AK.setPose(pa, t);
  const pb = squat(YK, YARD_B, {spine: [0.5, 0, 0]});
  const place = smooth(10.8, 11.5, t);
  pb.armL = {ik: V(lerp(0.3, 0.06, place), lerp(0.25, 0.2, place), lerp(0.25, 0.12, place)), twist: 0.6, curl: 0.4};
  pb.armR = {ik: V(0.2, 0.12, 0.0), twist: 0.4, curl: 0.3};
  const oops = smooth(11.6, 12.0, t) * (1 - smooth(12.8, 13.4, t));
  pb.face = {look: oops > 0.2 ? V(-0.15, 0.2, 0.12) : V(0.0, 0.2, 0.15), wide: oops * 0.6, browIn: oops * 0.4, smile: grin * 0.7 + 0.15};
  YK.setPose(pb, t);
  if (close) s06aCam(C.cam, lt); else s05Cam(C.cam, lt);
  return {scene: Y.scene, camera: C.cam, look: {...LOOK.warm, exposure: 1.08, focus: close ? 0.6 : 1.5, aperture: 0.6, maxBlur: 0.012, vignette: 0.32}};
}

const s06bCam = camRig([[0, [-0.28, 1.17, -0.33], [-0.28, 0.85, -0.75], 26], [1.0, [-0.25, 1.2, -0.25], [-0.27, 0.86, -0.75], 30]]);
const s07Cam = camRig([[0, [1.38, 1.28, -0.98], [0.3, 1.12, -0.18], 40], [4.0, [1.32, 1.26, -0.9], [0.32, 1.12, -0.18], 37]]);
function dormFrame(C, t, lt, which) {
  const D = C.S.dorm; attach(D.scene, C.cast.armanStudent, C.cast.ayanStudent); hideAllBut(C.cast, ['armanStudent', 'ayanStudent']);
  const A = C.cast.armanStudent, Y = C.cast.ayanStudent;
  const ba = {x: 0.0, z: -0.15, ry: PI}, bb = {x: 0.7, z: -0.15, ry: PI};
  // beats (film time): pencil pass 17.2–18.6, tea 18.8–20.0, celebrate 20.1–21.0
  const pass = smooth(17.2, 17.9, t) * (1 - smooth(18.3, 18.9, t));
  const tea = smooth(18.9, 19.6, t) * (1 - smooth(19.9, 20.3, t));
  const cele = smooth(20.1, 20.6, t);
  const pa = seated(A, ba, {seat: 0.46, lean: 0.3 - cele * 0.2, neck: [0.35 - cele * 0.3, 0, 0], head: [0.1, cele * 0.3, 0]});
  pa.armR = {ik: cele > 0.01 ? toWorld(ba, lerp(-0.1, -0.25, cele), lerp(0.82, 1.35, cele), lerp(0.42, 0.25, cele)) : toWorld(ba, -0.12 + pass * -0.25, 0.8 + pass * 0.05, 0.45 + pass * 0.05), twist: 0.9, curl: 0.5};
  pa.armL = {ik: toWorld(ba, 0.15, 0.8 + tea * 0.35, 0.45 - tea * 0.2), twist: 0.6, curl: 0.4};
  pa.face = {look: pass > 0.3 ? Y.eyesWorld() : cele > 0.3 ? Y.eyesWorld() : V(0.25, 0.77, -0.62), smile: 0.25 + cele * 0.55, open: 1 - tea * 0.25, squint: tea * 0.3};
  A.setPose(pa, t);
  const pb = seated(Y, bb, {seat: 0.46, lean: 0.25 - cele * 0.15, neck: [0.3 - cele * 0.25, 0, 0], head: [0.1, -cele * 0.3, 0]});
  pb.armL = {ik: cele > 0.01 ? toWorld(bb, lerp(0.1, 0.22, cele), lerp(0.82, 1.35, cele), lerp(0.42, 0.25, cele)) : toWorld(bb, 0.08 + pass * 0.12, 0.8 + pass * 0.04, 0.42), twist: 0.9, curl: 0.5};
  pb.armR = {ik: toWorld(bb, -0.12 - tea * 0.3, 0.8 + tea * 0.06, 0.42 - tea * 0.05), twist: 0.6, curl: 0.5};
  pb.face = {look: tea > 0.2 ? A.eyesWorld() : cele > 0.3 ? A.eyesWorld() : V(0.25, 0.77, -0.62), smile: 0.2 + cele * 0.6};
  Y.setPose(pb, t);
  // pencil follows the passing hand; kese slides to Arman
  const pc = D.pencils[0];
  if (pass > 0.05) { inHand(pc, A, 'R', [0.02, 0.01, 0], [0, 0, PI / 2]); } else { pc.position.set(-0.05, 0.764, -0.45); pc.rotation.set(0, 0, 0); }
  D.kese.group.position.set(lerp(0.55, 0.15, smooth(18.9, 19.7, t)), 0.766, lerp(-0.5, -0.42, smooth(18.9, 19.7, t)));
  D.drawing.position.y = 0.762 + cele * 0.0;
  if (which === 'model') s06bCam(C.cam, lt); else s07Cam(C.cam, lt);
  return {scene: D.scene, camera: C.cam, look: {...LOOK.warm, exposure: 1.15, focus: which === 'model' ? 0.42 : 1.5, aperture: 0.55, maxBlur: 0.012, vignette: 0.38}};
}

// S08: lines rise from the drawing into a building
const s08Cam = camRig([[0, [0.25, 1.35, -0.6], [0.25, 0.76, -0.62], 30], [2.2, [0.55, 1.15, -0.05], [0.25, 0.86, -0.62], 32], [4.0, [0.9, 1.05, 0.35], [0.25, 0.9, -0.62], 30]]);
function linesFrame(C, t, lt) {
  const D = C.S.dorm; attach(D.scene); hideAllBut(C.cast, []);
  const g = C.lines;
  if (g.parent !== D.scene) D.scene.add(g);
  g.visible = true;
  g.position.set(0.25, 0.763, -0.62);
  const grow = smooth(0.3, 2.6, lt);
  g.userData.wire.scale.set(1, Math.max(0.001, grow), 1);
  g.userData.wire.material.opacity = 1 - smooth(2.6, 3.4, lt);
  g.userData.solid.visible = lt > 2.4;
  g.userData.solid.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = smooth(2.4, 3.3, lt); } });
  s08Cam(C.cam, lt);
  return {scene: D.scene, camera: C.cam, look: {...LOOK.warm, exposure: 1.15, focus: 0.8, aperture: 0.45, maxBlur: 0.01, vignette: 0.38}};
}

// ---------------------------------------------------------------- ACT 3 · fair competition
const s09Cam = camRig([[0, [1.55, 1.55, -2.9], [0.2, 1.2, 0.0], 36], [4.6, [1.45, 1.5, -2.7], [0.35, 1.2, -0.2], 33]]);
function hallFrame(C, t, lt, which) {
  const H = C.S.hall; attach(H.scene, C.cast.arman, C.cast.ayan, C.cast.juror); hideAllBut(C.cast, ['arman', 'ayan', 'juror']);
  H.trophy.visible = false;
  if (C.lines.parent) C.lines.visible = false;
  H.stageSpot.intensity = 0; H.audience.visible = which === 'award';
  H.backWall.visible = H.banner.visible = which !== 'award'; // the stage lies behind the exhibition wall
  const A = C.cast.arman, Y = C.cast.ayan, J = C.cast.juror;
  if (which === 'jury') {
    // juror walks to Ayan's model and pins the rosette (26.2–27.6)
    const jw = clamp((t - 25.0) / 1.6);
    const jb = {x: lerp(-1.8, 0.75, easeOut(jw)), z: lerp(-0.2, -0.55, easeOut(jw)), ry: lerp(PI * 0.5, PI, smooth(0.6, 1, jw))};
    const jp = jw < 1 ? walking(J, jb, jw * 2.2) : standing(J, jb);
    const pin = smooth(26.9, 27.6, t);
    jp.armR = {ik: pin > 0 ? V(lerp(0.6, 0.75, pin), lerp(1.1, 1.23, pin), lerp(-0.7, -1.1, pin)) : hangHand(J, jb, 'R', jp.armSwing || 0), curl: 0.5, twist: 0.5};
    jp.armL = {ik: hangHand(J, jb, 'L', -(jp.armSwing || 0))};
    jp.face = {look: V(0.75, 1.1, -1.2)};
    J.setPose(jp, t);
    if (pin > 0.5) { H.rosette.position.set(0.75, 1.2, -0.97); H.rosette.rotation.set(PI / 2, 0, 0); }
    else inHand(H.rosette, J, 'R', [0.01, 0.01, 0], [PI / 2, 0, 0]);
    H.rosette.visible = true;
    // friends watching, side by side
    const ab = {x: -0.55, z: 0.75, ry: PI}, yb = {x: 0.15, z: 0.8, ry: PI};
    const ap = standing(A, ab); ap.armL = {ik: hangHand(A, ab, 'L')}; ap.armR = {ik: hangHand(A, ab, 'R')};
    const won = smooth(27.6, 28.3, t);
    ap.face = {look: V(0.75, 1.1, -1.2), browIn: won * 0.4, sad: won * 0.15}; A.setPose(ap, t);
    const yp = standing(Y, yb); yp.armL = {ik: hangHand(Y, yb, 'L')}; yp.armR = {ik: hangHand(Y, yb, 'R')};
    yp.face = {look: V(0.75, 1.1, -1.2), wide: won * 0.5, smile: won * 0.5}; Y.setPose(yp, t);
    s09Cam(C.cam, lt);
    return {scene: H.scene, camera: C.cam, look: {...LOOK.warm, exposure: 1.05, focus: 2.2, aperture: 0.35, maxBlur: 0.01}};
  }
  if (which === 'congrats') {
    J.root.visible = false;
    H.rosette.visible = true; H.rosette.position.set(0.75, 1.2, -0.97);
    const ab = {x: -0.17, z: 0.55, ry: PI * 0.62}, yb = {x: 0.36, z: 0.5, ry: -PI * 0.62};
    const beat = smooth(29.6, 30.6, t), smileT = smooth(30.6, 31.3, t), shake = smooth(31.0, 31.6, t) * (1 - smooth(34.6, 35.4, t));
    // handshake (right hands meet between them, a few pumps) + a pat on Ayan's shoulder
    const meet = V(0.095, 1.0 + Math.sin(Math.max(0, t - 31.6) * 9) * 0.02 * smooth(31.6, 31.8, t) * (1 - smooth(33.0, 33.4, t)), 0.53);
    const pat = smooth(31.7, 32.0, t) * (1 - smooth(32.9, 33.3, t));
    const ap = standing(A, ab, {spine: [0.04 + (1 - smileT) * beat * 0.06, 0, 0]});
    ap.armR = {ik: meet.clone().add(V(-0.012, 0, 0)).lerp(hangHand(A, ab, 'R'), 1 - shake), curl: 0.45 * shake + 0.2, twist: 0.3, thumb: 0.3};
    const ys = Y.boneWorld('upperarm01.R').add(V(-0.04, 0.03 + Math.abs(Math.sin(t * 11)) * 0.015 * pat, 0));
    ap.armL = {ik: pat > 0 ? ys.lerp(hangHand(A, ab, 'L'), 1 - pat) : hangHand(A, ab, 'L'), curl: 0.25, twist: 0.5};
    ap.head = [beat * (1 - smileT) * 0.25, 0, 0];
    ap.face = {look: smileT > 0.2 ? Y.eyesWorld() : V(0.4, 0.9, -0.3), sad: beat * (1 - smileT) * 0.5, browIn: beat * (1 - smileT) * 0.4, smile: smileT * 0.65, talk: talk('arman', t)};
    A.setPose(ap, t);
    const yp = standing(Y, yb);
    yp.armL = {ik: hangHand(Y, yb, 'L')}; yp.armR = {ik: meet.clone().add(V(0.012, 0, 0)).lerp(hangHand(Y, yb, 'R'), 1 - shake), curl: 0.45 * shake + 0.2, twist: 0.3, thumb: 0.3};
    yp.face = {look: A.eyesWorld(), smile: 0.35 + smileT * 0.4 + shake * 0.1, browIn: 0.15};
    Y.setPose(yp, t);
    const cam = camRig([[0, [1.25, 1.58, 2.75], [0.08, 1.45, 0.5], 32], [6.8, [1.05, 1.58, 2.35], [0.08, 1.48, 0.5], 28]]);
    cam(C.cam, lt);
    return {scene: H.scene, camera: C.cam, look: {...LOOK.warm, exposure: 1.05, focus: 1.9, aperture: 0.5, maxBlur: 0.011}};
  }
  if (which === 'success') {
    // Ayan shakes the juror's (client's) hand, receives a folder
    A.root.visible = false;
    const yb = {x: 0.2, z: 0.2, ry: -PI * 0.5}, jb = {x: -0.55, z: 0.2, ry: PI * 0.5};
    const sh = smooth(36.6, 37.2, t) * (1 - smooth(38.6, 39.2, t));
    const meet = V(-0.17, 1.02, 0.25);
    const yp = standing(Y, yb); yp.armR = {ik: sh > 0 ? meet.clone().lerp(hangHand(Y, yb, 'R'), 1 - sh) : hangHand(Y, yb, 'R'), curl: 0.45, twist: 0.3}; yp.armL = {ik: hangHand(Y, yb, 'L')};
    yp.face = {look: J.eyesWorld(), smile: 0.6, talk: {open: 0.15 * Math.max(0, Math.sin(t * 9)) * sh, round: 0}};
    Y.setPose(yp, t);
    const jp = standing(J, jb); jp.armR = {ik: sh > 0 ? meet.clone().add(V(0.02, 0, 0)).lerp(hangHand(J, jb, 'R'), 1 - sh) : hangHand(J, jb, 'R'), curl: 0.45, twist: 0.3}; jp.armL = {ik: hangHand(J, jb, 'L')};
    jp.face = {look: Y.eyesWorld(), smile: 0.45};
    J.setPose(jp, t);
    const cam = camRig([[0, [-0.25, 1.4, 2.7], [-0.17, 1.3, 0.2], 36], [3.2, [0.05, 1.42, 2.4], [-0.15, 1.32, 0.2], 33]]);
    cam(C.cam, lt);
    return {scene: H.scene, camera: C.cam, look: {...LOOK.warm, exposure: 1.05, focus: 1.7, aperture: 0.5, maxBlur: 0.011}};
  }
  // award stage
  A.root.visible = false; J.root.visible = false; H.rosette.visible = false;
  H.stageSpot.intensity = 60; H.spotA.intensity = 3; H.spotB.intensity = 2; H.hemi.intensity = 0.12;
  const yb = {x: 0.3, z: -7.05, ry: 0, y: 0.4};
  const lift = smooth(43.6, 44.4, t);
  const yp = standing(Y, yb);
  yp.armR = {ik: toWorld(yb, -0.12, lerp(0.95, 1.25, lift), 0.28), twist: 0.9, curl: 0.62, thumb: 0.5};
  yp.armL = {ik: toWorld(yb, 0.12, 1.0, 0.25), twist: 0.6, curl: 0.4};
  yp.face = {look: V(0.3, 1.6, -3.5), smile: 0.7};
  Y.setPose(yp, t);
  // held upright by its base (world-aligned, so it reads as a trophy, not a slab)
  H.trophy.visible = true; inHand(H.trophy, Y, 'R', [0, 0.03, 0]);
  H.trophy.position.y -= 0.03; H.trophy.rotation.set(0, 0.35, 0);
  const tp = H.trophy.position;
  const cam = camRig([[0, [0.4, 1.9, -3.2], [0.3, 1.6, -7.1], 28], [2.2, [0.36, 1.85, -4.6], [tp.x, tp.y + 0.1, tp.z], 22], [3.6, [tp.x + 0.16, tp.y + 0.2, tp.z + 0.4], [tp.x, tp.y + 0.17, tp.z], 18]]);
  cam(C.cam, lt);
  return {scene: H.scene, camera: C.cam, look: {...LOOK.neutral, exposure: 1.15, focus: lerp(3.8, 0.3, smooth(2.0, 3.6, lt)), aperture: 0.55, maxBlur: 0.013, flash: smooth(3.2, 3.6, lt) * 0.5, flashColor: '#dfe9f2'}};
}

// ---------------------------------------------------------------- ACT 3/4 · Arman at home (day)
const s12CharCam = charCam([[0, {yaw: 0.6, pitch: 0.0, dist: 1.0, fov: 32, ty: -0.1}], [3.4, {yaw: 0.5, pitch: 0.0, dist: 0.92, fov: 31, ty: -0.1}]]);
const s12Cam = (cam, lt, C) => s12CharCam(cam, lt, C.cast.arman);
s12Cam.char = true;
function armanWorks(C, t, lt, season = 'spring', mode = 'day', camFn = s12Cam, extra = {}) {
  const S = C.S.apt; attach(S.scene, C.cast.arman); hideAllBut(C.cast, ['arman']);
  const A = C.cast.arman, b = ARMAN_DESK;
  const p = seated(A, b, {seat: 0.46, lean: extra.lean ?? 0.42, neck: [0.4, 0, 0], head: [0.12, 0, 0]});
  const draw = Math.sin(t * 2.2) * 0.04;
  p.armR = extra.armR || {ik: toWorld(b, -0.08 + draw, 0.8, 0.45), twist: 1.0, flex: -0.2, curl: [0.4, 0.6, 0.75, 0.8], thumb: 0.5};
  p.armL = extra.armL || {ik: toWorld(b, 0.22, 0.79, 0.4), twist: 0.4, curl: 0.2, spread: 0.2};
  p.face = extra.face || {look: V(DESK.x - 0.05, DESK.h, DESK.z + 0.05), browDown: 0.15, press: 0.2};
  A.setPose(p, t);
  if (!extra.noPencil) inHand(C.pencil, A, 'R', [0.03, 0.0, 0], [0, 0, PI * 0.45]); else C.pencil.position.set(0, -10, 0);
  C.phone.position.copy(V(DESK.x + 0.35, DESK.h + 0.005, DESK.z + 0.22)); C.phone.rotation.set(-PI / 2, 0, 0.3);
  curtainState(C, 0);
  lightApartment(S, {mode, season, t, desk: extra.desk ?? 0, pendant: 0, phone: 0});
  if (extra.hideLamp) S.deskLamp.visible = false;
  if (camFn.char) camFn(C.cam, lt, C); else camFn(C.cam, lt);
  return {scene: S.scene, camera: C.cam, look: {...(extra.look || LOOK.neutral), exposure: extra.exposure ?? 1.0, focus: extra.focus ?? 1.0, aperture: 0.45, maxBlur: 0.011}};
}

// ---------------------------------------------------------------- ACT 4 · envy
const s14CamA = camRig([[0, [0.9, 1.22, -1.22], [0.98, 0.98, -1.6], 20], [2.2, [0.88, 1.2, -1.28], [0.98, 0.98, -1.6], 24]]);
const s14CamB = charCam([[2.2, {yaw: -0.5, pitch: -0.3, dist: 0.62, fov: 25}], [4.6, {yaw: -0.45, pitch: -0.28, dist: 0.54, fov: 22}]]);
function scrollFrame(C, t, lt) {
  const S = C.S.apt; attach(S.scene, C.cast.arman); hideAllBut(C.cast, ['arman']);
  const scroll = lt < 1.0 ? 0 : (lt - 1.0) * 380;
  C.ui.draw({mode: 'feed', scroll, t, time: '22:14'});
  const A = armanPhone(C, t, {look: C.phone.position, tense: 0.3 + 0.25 * smooth(2, 4.5, lt), browDown: 0.15}, {oneHand: false, thumb: 0.2 + 0.25 * Math.max(0, Math.sin(t * 6))});
  curtainState(C, 0);
  lightApartment(S, {mode: 'evening', season: 'summer', t, phone: 1, phonePos: phoneLightPos(C), desk: 0.25, pendant: 0.4});
  if (lt < 2.2) s14CamA(C.cam, lt); else s14CamB(C.cam, lt, A);
  return {scene: S.scene, camera: C.cam, look: {...LOOK.cool1, exposure: 1.2, focus: lt < 2 ? 0.35 : 0.5, aperture: 0.5, maxBlur: 0.011}};
}

const s15CamA = camRig([[0, [1.36, 1.12, -1.6], [1.32, 0.76, -1.75], 30], [2.0, [1.38, 1.1, -1.62], [1.32, 0.76, -1.75], 27]]);
const s15CamB = charCam([[2.0, {yaw: -0.7, pitch: -0.15, dist: 0.85, fov: 30}], [4.0, {yaw: -0.6, pitch: -0.12, dist: 0.75, fov: 27}]]);
function declineFrame(C, t, lt) {
  const S = C.S.apt; attach(S.scene, C.cast.arman); hideAllBut(C.cast, ['arman']);
  const A = C.cast.arman, b = ARMAN_DESK;
  const flip = smooth(53.2, 53.8, t);
  const buzz = t < 53.2 ? Math.sin(t * 90) * 0.0015 * (Math.sin(t * 6.3) > 0 ? 1 : 0) : 0;
  C.ui.draw({mode: flip > 0.5 ? 'off' : 'call', t, time: '19:02'});
  C.phone.position.set(DESK.x + 0.32 + buzz, DESK.h + 0.005, DESK.z + 0.25);
  C.phone.rotation.set(-PI / 2 + flip * PI, 0, 0.3);
  if (flip > 0 && flip < 1) C.phone.position.y += Math.sin(flip * PI) * 0.04;
  const p = seated(A, b, {seat: 0.46, lean: 0.35, neck: [0.4, 0, 0]});
  const reach = smooth(52.6, 53.2, t) * (1 - smooth(53.9, 54.5, t));
  p.armR = {ik: reach > 0 ? toWorld(b, lerp(-0.1, 0.32 - 0.33, reach), lerp(0.8, 0.79, reach), lerp(0.45, 0.48, reach)).lerp(C.phone.position.clone().add(V(0, 0.04, 0)), reach) : toWorld(b, -0.1, 0.8, 0.45), twist: 1.1, curl: 0.3};
  p.armL = {ik: toWorld(b, 0.22, 0.79, 0.4), twist: 0.4, curl: 0.25};
  const look = t < 52.0 ? V(DESK.x, DESK.h, DESK.z + 0.05) : C.phone.position;
  p.face = {look, tense: 0.35 + smooth(52.5, 53.5, t) * 0.4, browDown: 0.3, press: 0.3};
  A.setPose(p, t);
  C.pencil.position.set(DESK.x - 0.1, DESK.h + 0.005, DESK.z + 0.15);
  curtainState(C, 0);
  lightApartment(S, {mode: 'day', season: 'summer', t, desk: 0, pendant: 0, phone: flip > 0.5 ? 0 : 0.6, phonePos: C.phone.position.clone().add(V(0, 0.1, 0))});
  if (lt < 2.0) s15CamA(C.cam, lt); else s15CamB(C.cam, lt, A);
  return {scene: S.scene, camera: C.cam, look: {...LOOK.cool1, exposure: 1.0, focus: lt < 2 ? 0.55 : 0.7, aperture: 0.5, maxBlur: 0.011}};
}

// seasons: camera slides along the window; behind each mullion the season changes
function seasonsFrame(C, t, lt) {
  const S = C.S.apt;
  const prog = lt / 5.8;
  const season = prog < 0.36 ? 'summer' : prog < 0.64 ? 'autumn' : 'winter';
  // paper pile grows, model stays unfinished
  const n = Math.floor(lerp(4, 36, prog));
  S.pile.children.forEach((c, i) => { c.visible = i < n; });
  const cam = camRig([[0, [0.15, 1.62, -0.55], [0.35, 1.45, -2.6], 38], [5.8, [1.85, 1.62, -0.55], [1.65, 1.45, -2.6], 38]]);
  const look = prog < 0.5 ? LOOK.cool1 : LOOK.cool2;
  return armanWorks(C, t, lt, season, 'day', cam, {hideLamp: true, noPencil: prog > 0.25, lean: 0.25, armR: prog > 0.25 ? {ik: toWorld(ARMAN_DESK, -0.06, 0.98, 0.3), twist: 1.35, flex: -0.25, curl: 0.7} : null,
    face: {look: prog > 0.25 ? C.phone.position : V(DESK.x, DESK.h, DESK.z), tense: 0.2 + prog * 0.3, browDown: 0.15}, look, focus: 1.2, exposure: season === 'winter' ? 0.95 : 1.0});
}

function tvFrame(C, t, lt) {
  const S = C.S.apt; attach(S.scene, C.cast.arman, C.cast.wife); hideAllBut(C.cast, ['arman', 'wife']);
  drawTV(S, t, C.ayanPortrait);
  const A = C.cast.arman, b = {x: -1.0, z: -0.2, ry: -PI * 0.5};
  const harden = smooth(62.2, 63.4, t), turn = smooth(64.0, 64.8, t);
  const p = standing(A, b, {spine: [0.02, 0, 0], head: [0, -turn * 0.5, 0]});
  p.armL = {ik: hangHand(A, b, 'L')}; p.armR = {ik: hangHand(A, b, 'R')};
  p.face = {look: turn > 0.5 ? V(1.0, 1.4, 0.5) : V(-3.1, 1.45, -1.1), tense: 0.2 + harden * 0.6, browDown: harden * 0.4, press: harden * 0.5};
  A.setPose(p, t);
  wifeAtTable(C, t, {look: V(-3.1, 1.45, -1.1), smile: 0.35}, {head: [0.05, -0.6, 0]});
  lightApartment(S, {mode: 'evening', season: 'winter', t, tv: 1, pendant: 0.5});
  if (lt < 1.6) camRig([[0, [-0.55, 1.68, 0.2], [-3.1, 1.45, -1.05], 34], [1.6, [-0.6, 1.66, 0.12], [-3.1, 1.45, -1.05], 32]])(C.cam, lt);
  else charCam([[1.6, {yaw: 0.35, pitch: 0.0, dist: 0.8, fov: 26}], [4.4, {yaw: 0.3, pitch: 0.0, dist: 0.62, fov: 22}]])(C.cam, lt, A);
  return {scene: S.scene, camera: C.cam, look: {...LOOK.cool3, exposure: 1.2, focus: 0.9, aperture: 0.6, maxBlur: 0.012}};
}

// ---------------------------------------------------------------- ACT 5 · unnoticed happiness
function homeEvening(C, t, lt, which) {
  const S = C.S.apt; attach(S.scene, C.cast.arman, C.cast.wife, C.cast.son); hideAllBut(C.cast, ['arman', 'wife', 'son']);
  const A = C.cast.arman, W = C.cast.wife, Sn = C.cast.son;
  C.ui.draw({mode: 'feed', scroll: 660 + Math.max(0, t - 68) * 40, t, time: '20:31'});
  // Arman sits (65.4–66.6 arrives & sits), takes phone out 67.4
  const sit = smooth(65.4, 66.6, t);
  const phoneUp = smooth(67.2, 67.9, t);
  const b = ARMAN_DINE;
  let p = seated(A, b, {seat: 0.46, lean: 0.12 + phoneUp * 0.1, neck: [0.15 + phoneUp * 0.25, 0, 0]});
  if (sit < 1) { const sp = standing(A, {...b, z: b.z + 0.1}); p = blend(sp, p, sit); }
  p.armR = phoneUp > 0 ? {ik: toWorld(b, -0.06, lerp(0.78, 0.98, phoneUp), lerp(0.3, 0.3, phoneUp)), twist: 1.35, flex: -0.25, curl: [0.62, 0.7, 0.78, 0.82], thumb: 0.2} : {ik: toWorld(b, -0.12, 0.8, 0.32), twist: 0.6, curl: 0.4};
  p.armL = {ik: toWorld(b, 0.2, 0.78, 0.3), twist: 0.6, curl: 0.4};
  const lookPhone = phoneUp > 0.5 && !(which === 'window' && t > 80.6);
  p.face = {look: lookPhone ? C.phone.position : which === 'window' ? V(1.0, 1.9, -6) : W.eyesWorld(), tense: 0.2, talk: talk('arman', t)};
  if (which === 'window') p.head = [0, smooth(80.4, 81.4, t) * 0.55, 0];
  A.setPose(p, t);
  if (phoneUp > 0.2) inHand(C.phone, A, 'R', [0.02, 0.012, 0]); else { C.phone.position.set(b.x + 0.15, DINING.h + 0.005, b.z - 0.15); C.phone.rotation.set(-PI / 2, 0, 0); }
  // wife pours tea (66.0–67.6), then watches him
  const pour = smooth(66.0, 66.5, t) * (1 - smooth(67.3, 67.8, t));
  wifeAtTable(C, t, {look: which === 'window' ? A.eyesWorld() : (pour > 0.3 ? S.keseArman.group.position : A.eyesWorld()), smile: which === 'window' ? 0.1 : 0.45, sad: which === 'window' ? 0.3 : 0},
    {armR: {ik: pour > 0 ? toWorld(WIFE_DINE, -0.15, lerp(0.8, 0.95, pour), lerp(0.33, 0.55, pour)) : toWorld(WIFE_DINE, -0.07, 0.8, 0.34), twist: 0.8, curl: 0.55}, lean: 0.06 + pour * 0.1});
  if (pour > 0.01) { inHand(S.teapot, W, 'R', [0.02, 0.06, 0], [0, 0, -pour * 0.8]); } else { S.teapot.position.set(DINING.x + 0.2, DINING.h, DINING.z - 0.12); S.teapot.rotation.set(0, -0.6, 0); }
  S.keseArman.tea.visible = t > 66.8;
  // son with his drawing (70.6 → 75.8), then leaves (75.8 → 78.5)
  const comeIn = smooth(70.4, 71.4, t), wait = t > 74.4 && t < 76.8, leave = smooth(77.2, 78.6, t);
  const sb0 = {x: -0.5, z: 1.9, ry: PI * 0.8}, sb1 = {x: -1.25, z: 1.2, ry: PI * 1.15};
  let sbb = {x: lerp(sb0.x, sb1.x, comeIn), z: lerp(sb0.z, sb1.z, comeIn), ry: lerp(sb0.ry, sb1.ry, comeIn)};
  if (leave > 0) sbb = {x: lerp(sb1.x, -2.9, leave), z: lerp(sb1.z, 2.0, leave), ry: lerp(PI * 1.15, PI * 1.75, Math.min(1, leave * 3))};
  const walk = (comeIn > 0 && comeIn < 1) || (leave > 0 && leave < 1);
  let sp = walk ? walking(Sn, sbb, (comeIn + leave) * 1.6) : standing(Sn, sbb);
  const place = smooth(76.2, 76.9, t);
  const hold = comeIn > 0.6 && leave === 0;
  const holdPos = toWorld(sbb, 0.0, lerp(1.0, 0.9, wait ? 1 : 0), 0.3);
  const tablePos = V(DINING.x + 0.2, DINING.h + 0.05, DINING.z + 0.32);
  sp.armL = hold ? {ik: (place > 0 ? holdPos.clone().lerp(tablePos.clone().add(V(0.1, 0.02, 0)), place) : holdPos.clone().add(toWorld({ry: sbb.ry}, 0.12, 0, 0))), twist: 0.6, curl: 0.3} : {ik: hangHand(Sn, sbb, 'L', sp.armSwing || 0)};
  sp.armR = hold && place < 0.9 ? {ik: holdPos.clone().add(toWorld({ry: sbb.ry}, -0.12, 0, 0)), twist: 0.6, curl: 0.3} : {ik: hangHand(Sn, sbb, 'R', -(sp.armSwing || 0))};
  const dis = smooth(74.6, 75.6, t);
  sp.face = {look: A.eyesWorld(), smile: 0.6 * (1 - dis), sad: dis * 0.55, browIn: dis * 0.5, talk: talk('son', t)};
  if (wait) sp.head = [0.25 * dis, 0, 0];
  Sn.root.visible = t > 70.3 && t < 78.7;
  Sn.setPose(sp, t);
  // drawing: held, then lying on the table
  const dr = C.drawing;
  dr.visible = t > 70.3;
  if (place >= 0.95 || t > 77) { dr.position.copy(tablePos).setY(DINING.h + 0.004); dr.rotation.set(-PI / 2, 0, 0.15); }
  else if (hold) { dr.position.copy(holdPos).add(V(0, 0.02, 0)); dr.lookAt(A.eyesWorld()); }
  else dr.visible = false;
  curtainState(C, 0);
  lightApartment(S, {mode: 'evening', season: 'winter', t, pendant: 1, hall: 0.4, phone: phoneUp, phonePos: phoneLightPos(C)});
  let cam;
  if (which === 'tea') cam = camRig([[0, [2.3, 1.75, 0.45], [-1.7, 1.12, 0.41], 36], [5.2, [2.05, 1.72, 0.44], [-1.7, 1.12, 0.41], 34]]);
  else if (which === 'son') cam = camRig([[0, [-1.65, 1.32, -0.05], [-1.45, 1.12, 1.15], 36], [5.2, [-1.62, 1.3, 0.0], [-1.45, 1.12, 1.15], 33]]);
  else if (which === 'leave') cam = lt < 2.5 ? camRig([[0, [-0.55, 1.38, -0.4], [-1.65, 1.0, 1.25], 40], [2.5, [-0.6, 1.36, -0.32], [-2.05, 0.98, 1.45], 40]]) : camRig([[2.5, [DINING.x + 0.22, DINING.h + 0.45, DINING.z + 0.38], [DINING.x + 0.2, DINING.h, DINING.z + 0.32], 32], [4.2, [DINING.x + 0.22, DINING.h + 0.38, DINING.z + 0.36], [DINING.x + 0.2, DINING.h, DINING.z + 0.32], 28]]);
  else cam = camRig([[0, [-1.6, 1.25, 0.25], [-1.7, 1.22, 1.05], 26], [1.4, [-1.62, 1.25, 0.28], [-1.7, 1.22, 1.05], 25], [1.8, [-1.95, 1.45, 1.75], [0.95, 1.7, -3.5], 30], [3.4, [-1.9, 1.45, 1.6], [0.95, 1.75, -3.5], 28]]);
  cam(C.cam, lt);
  const focus = which === 'leave' && lt > 2.5 ? 0.42 : which === 'window' ? lerp(0.8, 6, smooth(1.8, 3.2, lt)) : 1.5;
  return {scene: S.scene, camera: C.cam, look: {...LOOK.cool2, exposure: 1.15, focus, aperture: 0.5, maxBlur: 0.011}};
}

// ---------------------------------------------------------------- ACT 6 · climax (night, present)
function climaxFrame(C, t, lt, which) {
  const S = C.S.apt; attach(S.scene, C.cast.arman, C.cast.son, C.cast.wife); hideAllBut(C.cast, ['arman', 'son', 'wife']);
  const A = C.cast.arman, Sn = C.cast.son, W = C.cast.wife;
  const closeAmt = which === 'wipe' ? smooth(83.5, 85.4, t) : 1;
  curtainState(C, closeAmt);
  // phone: compose (full) → deleting 96.5–97.3 → face down 97.6
  const del = smooth(96.5, 97.3, t);
  const down = smooth(97.4, 98.0, t);
  C.ui.draw({mode: down > 0.5 ? 'off' : 'compose', typed: 1 - del, hover: 0, t});
  const kneel = smooth(98.0, 99.4, t);
  const b = ARMAN_DESK;
  let p;
  if (kneel < 0.01) {
    p = null;
    A.root.visible = true;
    armanPhone(C, t, {
      look: which === 'question' && t > 87.2 ? Sn.eyesWorld() : which === 'real' ? realLook(C, t) : C.phone.position,
      tense: lerp(0.5, 0.0, smooth(90.5, 95, t)), sad: smooth(93, 95.5, t) * 0.55, browIn: smooth(92.5, 95, t) * 0.5, wide: smooth(88.5, 90, t) * (1 - smooth(91, 93, t)) * 0.5,
    }, {head: [0.1 + (which === 'question' ? -0.05 : 0), (which === 'question' && t > 87.2) ? -0.55 : realHead(t), 0], neck: [0.25, (which === 'question' && t > 87.2) ? -0.3 : 0, 0], hy: lerp(0.98, 0.8, down), hz: lerp(0.3, 0.42, down)});
    if (down > 0) { const pp = C.phone.position.clone(); C.phone.position.lerp(V(DESK.x - 0.15, DESK.h + 0.006, DESK.z + 0.28), down); C.phone.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(PI / 2, 0, 0.2)), down); }
  } else {
    C.phone.position.set(DESK.x - 0.15, DESK.h + 0.006, DESK.z + 0.28); C.phone.rotation.set(PI / 2, 0, 0.2);
    const kb = {x: lerp(DESK.x, 0.42, kneel), z: lerp(DESK.z + 0.74, -1.62, kneel), ry: lerp(PI, PI * 0.62, kneel)};
    const sp = seated(A, ARMAN_DESK, {lean: 0.2});
    const kp = kneeling(A, kb, {spine: [0.2, 0, 0], head: [0.15, 0, 0]});
    p = blend(sp, kp, kneel);
    p.armL = {ik: toWorld(kb, 0.18, 0.62, 0.32), curl: 0.3, twist: 0.4};
    p.armR = {ik: toWorld(kb, -0.12, 0.58, 0.38), curl: 0.3, twist: 0.4};
    p.face = {look: Sn.eyesWorld(), smile: smooth(99.2, 100.2, t) * 0.55, sad: (1 - smooth(99.0, 100.0, t)) * 0.3, browIn: 0.25, talk: talk('arman', t)};
    A.setPose(p, t);
  }
  // son by the closed curtain
  const sb = {x: 0.05, z: -1.95, ry: PI * 0.42};
  const sp = standing(Sn, sb, {spine: [0.04, 0, 0]});
  const pull = which === 'wipe' ? closeAmt : 1;
  const curtainEdge = V(lerp(0.3, 2.05, easeIO(closeAmt)) - 0.02, 1.15, -2.25);
  sp.armR = which === 'wipe' && closeAmt < 0.98 ? {ik: curtainEdge, curl: 0.55, twist: 0.6} : {ik: hangHand(Sn, sb, 'R'), curl: 0.3};
  sp.armL = {ik: hangHand(Sn, sb, 'L')};
  const shy = which === 'question' ? 0.35 : 0;
  sp.face = {look: which === 'wipe' ? curtainEdge : A.eyesWorld(), browIn: 0.4 + shy, sad: 0.2, talk: talk('son', t), smile: smooth(99.4, 100.4, t) * 0.6};
  if (kneel > 0.6) { sp.armL = {ik: toWorld(sb, 0.1, 0.78, 0.25), curl: 0.3}; sp.armR = {ik: toWorld(sb, -0.1, 0.78, 0.25), curl: 0.3}; }
  Sn.setPose(sp, t);
  // drawing in the son's hands once Arman asks
  C.drawing.visible = kneel > 0.6 || which === 'real';
  if (which === 'real' && kneel < 0.6) { C.drawing.position.set(DINING.x + 0.2, DINING.h + 0.004, DINING.z + 0.32); C.drawing.rotation.set(-PI / 2, 0, 0.15); }
  else if (kneel > 0.6) { const c = Sn.handWorld('L').lerp(Sn.handWorld('R'), 0.5); C.drawing.position.copy(c).add(V(0, 0.05, 0.02)); C.drawing.lookAt(A.eyesWorld()); }
  // wife waiting at the warm table, cold tea
  wifeAtTable(C, t, {look: A.eyesWorld(), sad: 0.35, smile: smooth(99.5, 100.5, t) * 0.35}, {lean: 0.15});
  S.keseArman.tea.visible = true;
  const calm = which === 'question' || which === 'real';
  lightApartment(S, {mode: 'night', t, phone: (1 - down) * (calm ? 0.5 : 1), phonePos: phoneLightPos(C), pendant: 0.6, hall: which === 'question' ? 0.55 : 0.2, warmth: 1});
  let cam;
  if (which === 'wipe') cam = camRig([[0, [-0.75, 1.3, -0.65], [0.7, 1.25, -2.2], 30], [3.0, [-0.65, 1.3, -0.75], [0.7, 1.25, -2.2], 28]]);
  else if (which === 'question') cam = camRig([[0, [2.32, 1.38, -1.2], [0.35, 1.0, -1.85], 42], [6.0, [2.3, 1.38, -1.22], [0.35, 1.0, -1.85], 41.5]]);
  else if (which === 'real') cam = realCam(t);
  else cam = lt < 1.2 ? camRig([[0, [0.9, 1.22, -1.22], [0.98, 0.98, -1.6], 22], [1.2, [0.88, 1.2, -1.28], [0.98, 0.98, -1.6], 22]]) : camRig([[1.2, [-0.75, 1.15, -0.55], [0.35, 0.85, -1.8], 40], [4.6, [-0.65, 1.1, -0.7], [0.32, 0.85, -1.8], 36]]);
  cam(C.cam, lt);
  const focus = which === 'question' ? 1.6 : which === 'real' ? realFocus(t) : lt < 1.2 ? 0.4 : 1.1;
  const look = which === 'del' ? {tint: [1.0, 0.99, 0.98], sat: 0.95} : LOOK.night;
  return {scene: S.scene, camera: C.cam, look: {...look, exposure: which === 'real' ? 1.12 : 1.25, focus, aperture: 0.55, maxBlur: 0.011, vignette: 0.42}};
}
// realization beat: face → drawing → cold tea → wife → face
function realLook(C, t) {
  if (t < 93.6) return C.cast.son.eyesWorld();
  if (t < 94.6) return V(DINING.x + 0.2, DINING.h, DINING.z + 0.32);
  if (t < 95.4) return C.S.apt.keseArman.group.position;
  return C.cast.wife.eyesWorld();
}
function realHead(t) { return t < 93.4 ? -0.4 : t < 95.6 ? lerp(-0.4, 0.6, smooth(93.4, 94.2, t)) : lerp(0.6, -0.2, smooth(95.6, 96.3, t)); }
function realCam(t) {
  if (t < 93.6) return camRig([[0, [0.58, 1.16, -2.05], [0.98, 1.24, -1.4], 30], [1.2, [0.6, 1.16, -2.02], [0.98, 1.24, -1.4], 28]]);
  if (t < 94.6) return camRig([[1.2, [DINING.x + 0.25, DINING.h + 0.42, DINING.z + 0.5], [DINING.x + 0.2, DINING.h, DINING.z + 0.32], 30], [2.2, [DINING.x + 0.24, DINING.h + 0.38, DINING.z + 0.48], [DINING.x + 0.2, DINING.h, DINING.z + 0.32], 28]]);
  if (t < 95.4) return camRig([[2.2, [DINING.x - 0.05, DINING.h + 0.22, DINING.z + 0.48], [DINING.x - 0.05, DINING.h + 0.04, DINING.z + 0.28], 30], [3.0, [DINING.x - 0.05, DINING.h + 0.2, DINING.z + 0.46], [DINING.x - 0.05, DINING.h + 0.04, DINING.z + 0.28], 28]]);
  if (t < 95.9) return camRig([[3.0, [-0.6, 1.3, 1.2], [DINING.x, 1.15, DINING.z - 0.62], 22], [3.5, [-0.62, 1.3, 1.15], [DINING.x, 1.15, DINING.z - 0.62], 21]]);
  return camRig([[3.5, [0.58, 1.16, -2.05], [0.98, 1.24, -1.4], 27], [4.0, [0.59, 1.16, -2.03], [0.98, 1.24, -1.4], 26]]);
}
function realFocus(t) { return t < 93.6 ? 0.6 : t < 95.4 ? 0.45 : t < 95.9 ? 1.9 : 0.55; }

// ---------------------------------------------------------------- ACT 7 · forgiveness at Ayan's door
function doorFrame(C, t, lt, which) {
  const S = C.S.apt; attach(S.scene, C.cast.arman, C.cast.ayan); hideAllBut(C.cast, ['arman', 'ayan']);
  const A = C.cast.arman, Y = C.cast.ayan;
  const facadeZ = AYAN_HOUSE_Z + 4;
  const door = S.ayanHouse.userData.door;
  const open = smooth(103.0, 103.9, t);
  door.pivot.rotation.y = -open * 1.25;
  const ab = {x: AYAN_DOOR.x + 0.05, z: facadeZ + 1.25, ry: PI};
  // knock 101.8, 102.2, 102.6
  const kn = (t0) => Math.exp(-Math.pow((t - t0) / 0.08, 2));
  const knock = kn(101.8) + kn(102.2) + kn(102.6);
  const raise = smooth(101.3, 101.6, t) * (1 - smooth(102.8, 103.2, t));
  const p = standing(A, ab, {spine: [0.04, 0, 0], head: [0.08 + (which === 'apology' ? 0.12 : 0), 0, 0]});
  p.armR = raise > 0 ? {ik: toWorld(ab, 0.06, lerp(1.0, 1.45, raise), lerp(0.25, 0.48 + knock * 0.07, raise)), curl: 0.85, thumb: 0.8, twist: -1.2} : {ik: hangHand(A, ab, 'R'), curl: 0.35};
  p.armL = {ik: hangHand(A, ab, 'L')};
  const apol = which !== 'knock';
  const lookDown = which === 'apology' && t < 107.6;
  p.face = {look: apol ? (lookDown ? toWorld(ab, 0, 1.0, 1.2) : Y.eyesWorld()) : V(AYAN_DOOR.x, 1.5, facadeZ), sad: apol ? 0.45 : 0.2, browIn: apol ? 0.5 : 0.35, talk: talk('arman', t), smile: which === 'reply' ? smooth(112.8, 113.8, t) * 0.4 : 0};
  A.setPose(p, t);
  const yb = {x: AYAN_DOOR.x + 0.05, z: facadeZ + 0.3, ry: 0};
  Y.root.visible = open > 0.3;
  const yp = standing(Y, yb, {spine: [0.0, 0, 0]});
  const touch = smooth(113.6, 114.2, t);
  yp.armR = touch > 0 ? {ik: A.boneWorld('upperarm01.L').add(V(0, -0.02, 0.04)).lerp(hangHand(Y, yb, 'R'), 1 - touch), curl: 0.3, twist: 0.3} : {ik: hangHand(Y, yb, 'R')};
  yp.armL = {ik: toWorld(yb, 0.35, 1.05, 0.0), curl: 0.5};
  yp.face = {look: A.eyesWorld(), wide: which === 'apology' ? 0.2 : 0, browIn: which === 'reply' ? 0.45 : 0.25, sad: which === 'reply' ? 0.3 * (1 - smooth(112.6, 113.6, t)) : 0.1, smile: which === 'reply' ? smooth(112.8, 113.8, t) * 0.5 : 0, talk: talk('ayan', t)};
  Y.setPose(yp, t);
  lightApartment(S, {mode: 'day', season: 'spring', t});
  let cam;
  if (which === 'knock') cam = camRig([[0, [AYAN_DOOR.x - 0.9, 1.5, facadeZ + 2.0], [AYAN_DOOR.x + 0.2, 1.35, facadeZ + 0.4], 32], [2.4, [AYAN_DOOR.x - 0.75, 1.48, facadeZ + 1.85], [AYAN_DOOR.x + 0.15, 1.4, facadeZ + 0.4], 30]]);
  else if (which === 'apology') cam = null;
  else cam = null;
  if (cam) cam(C.cam, lt);
  else if (which === 'apology') charCam([[0, {yaw: 0.35, pitch: 0.02, dist: 0.95, fov: 26}], [7.4, {yaw: 0.3, pitch: 0.02, dist: 0.78, fov: 23}]])(C.cam, lt, A);
  else charCam([[0, {yaw: -0.32, pitch: 0.02, dist: 1.0, fov: 26}], [3.4, {yaw: -0.3, pitch: 0.02, dist: 0.85, fov: 23}]])(C.cam, lt, Y);
  return {scene: S.scene, camera: C.cam, look: {...LOOK.neutral, exposure: 1.0, focus: which === 'knock' ? 1.6 : 0.95, aperture: 0.55, maxBlur: 0.012}};
}

// ---------------------------------------------------------------- ACT 8 · ending
function endingFrame(C, t, lt, which) {
  const S = C.S.apt;
  if (which === 'desk') {
    attach(S.scene, C.cast.arman, C.cast.son); hideAllBut(C.cast, ['arman', 'son']);
    const A = C.cast.arman, Sn = C.cast.son, b = ARMAN_DESK;
    const pick = smooth(114.6, 115.0, t), typing = t > 115.4 && t < 116.9, sent = t > 117.0, putDown = smooth(117.2, 117.6, t);
    C.ui.draw({mode: 'message', notifyT: clamp((t - 114.8) / 0.4), typed: clamp((t - 115.4) / 1.4), sent, t, time: '16:20'});
    const p = seated(A, b, {seat: 0.46, lean: 0.25, neck: [0.25, 0, 0]});
    const hold = pick * (1 - putDown);
    p.armR = {ik: toWorld(b, -0.06, lerp(0.8, 0.98, hold), lerp(0.45, 0.3, hold)), twist: 1.35, flex: -0.25, curl: [0.62, 0.7, 0.78, 0.82], thumb: 0.15 + (typing ? 0.25 * Math.max(0, Math.sin(t * 18)) : 0)};
    const sonIn = smooth(117.4, 118.4, t);
    p.armL = sonIn > 0.5 ? {ik: toWorld(b, 0.25, 0.82, 0.42), curl: 0.5, twist: 0.8} : {ik: toWorld(b, 0.2, 0.79, 0.4), twist: 0.4, curl: 0.25};
    p.face = {look: hold > 0.5 ? C.phone.position : sonIn > 0.3 ? V(DESK.x + 0.3, DESK.h, DESK.z + 0.2) : V(DESK.x, DESK.h, DESK.z), smile: 0.35 + (sent ? 0.25 : 0), talk: {open: 0, round: 0}};
    A.setPose(p, t);
    if (hold > 0.05) inHand(C.phone, A, 'R', [0.02, 0.012, 0]); else { C.phone.position.set(DESK.x - 0.35, DESK.h + 0.005, DESK.z + 0.25); C.phone.rotation.set(-PI / 2, 0, 0.3); }
    const sb = {x: lerp(1.9, 1.62, sonIn), z: lerp(-1.2, -1.75, sonIn), ry: -PI * 0.55};
    Sn.root.visible = t > 117.2;
    const sp = standing(Sn, sb, {spine: [0.25, 0, 0]});
    sp.armR = {ik: V(DESK.x + 0.32, DESK.h + 0.03, DESK.z + 0.18), curl: 0.6, twist: 0.6}; sp.armL = {ik: V(DESK.x + 0.45, DESK.h + 0.02, DESK.z + 0.05), curl: 0.2};
    sp.face = {look: V(DESK.x + 0.3, DESK.h, DESK.z + 0.15), smile: 0.6};
    Sn.setPose(sp, t);
    C.drawing.visible = true; C.drawing.position.set(DESK.x + 0.3, DESK.h + 0.004, DESK.z + 0.12); C.drawing.rotation.set(-PI / 2, 0, 0.0);
    curtainState(C, 0);
    lightApartment(S, {mode: 'day', season: 'spring', t, pendant: 0});
    const cam = camRig([[0, [1.95, 1.3, -1.95], [0.95, 1.05, -1.35], 38], [4.8, [1.92, 1.32, -1.88], [1.0, 1.02, -1.4], 35]]);
    cam(C.cam, lt);
    return {scene: S.scene, camera: C.cam, look: {...LOOK.warm, sat: 1.0, exposure: 1.02, focus: 0.95, aperture: 0.5, maxBlur: 0.011}};
  }
  // two windows: drawing close-up → father and son drawing at the window,
  // Ayan's lit house across the street (the warm mirror of s01)
  attach(S.scene, C.cast.arman, C.cast.son);
  const out = which === 'windows';
  hideAllBut(C.cast, out ? ['arman', 'son'] : []);
  C.drawing.visible = true;
  if (!out) lt = Math.min(lt, 1.59);
  C.drawing.position.set(DESK.x + 0.3, DESK.h + 0.004, DESK.z + 0.12); C.drawing.rotation.set(-PI / 2, 0, 0.0);
  C.phone.position.set(DESK.x - 0.35, DESK.h + 0.005, DESK.z + 0.25); C.phone.rotation.set(-PI / 2, 0, 0.3);
  curtainState(C, 0);
  if (out) {
    const A = C.cast.arman, Sn = C.cast.son, b = ARMAN_DESK;
    const p = seated(A, b, {seat: 0.46, lean: 0.3, neck: [0.3, 0, 0]});
    const stroke = Math.sin(t * 2.6) * 0.03;
    p.armR = {ik: V(DESK.x + 0.22 + stroke, DESK.h + 0.03, DESK.z + 0.2), twist: 1.0, curl: 0.55};
    p.armL = {ik: toWorld(b, 0.24, 0.8, 0.4), curl: 0.3, twist: 0.6};
    p.face = {look: V(DESK.x + 0.3, DESK.h, DESK.z + 0.12), smile: 0.5};
    A.setPose(p, t);
    inHand(C.pencil, A, 'R', [0.03, 0.0, 0], [0, 0, PI * 0.45]);
    const sb = {x: 1.44, z: -1.52, ry: -PI * 0.62};
    const sp = standing(Sn, sb, {spine: [0.3, 0, 0]});
    sp.armR = {ik: V(DESK.x + 0.36, DESK.h + 0.03, DESK.z + 0.14), curl: 0.6, twist: 0.6}; sp.armL = {ik: V(DESK.x + 0.45, DESK.h + 0.02, DESK.z + 0.05), curl: 0.2};
    sp.face = {look: V(DESK.x + 0.3, DESK.h, DESK.z + 0.12), smile: 0.65};
    Sn.setPose(sp, t);
  }
  lightApartment(S, {mode: 'dusk', season: 'spring', t, pendant: 1, desk: 0.8, ayanWindows: 1, armanWindow: 1});
  S.deskLamp.visible = !out;
  const cam = !out
    ? camRig([[0, [DESK.x + 0.3, DESK.h + 0.32, DESK.z + 0.1], [DESK.x + 0.3, DESK.h, DESK.z + 0.095], 26], [1.6, [DESK.x + 0.3, DESK.h + 0.22, DESK.z + 0.1], [DESK.x + 0.3, DESK.h, DESK.z + 0.095], 22]])
    : camRig([[1.6, [1.1, 1.62, 0.3], [1.15, 1.42, -2.6], 44], [5.0, [1.12, 1.56, -0.12], [1.15, 1.45, -2.6], 40]]);
  cam(C.cam, lt);
  const fade = smooth(4.3, 5.0, lt);
  return {scene: S.scene, camera: C.cam, look: {...LOOK.warm, sat: 1.0, exposure: (out ? 1.0 : 1.15) * (1 - fade * 0.92), focus: out ? 2.2 : 0.3, aperture: out ? 0.35 : 0.5, maxBlur: 0.01, vignette: 0.45}};
}

// ---------------------------------------------------------------- shot list
export const SHOTS = [
  {id: 's01', t0: 0.0, t1: 4.0, f: (C, t, lt) => act1Frame(C, t, lt, 1)},
  {id: 's02', t0: 4.0, t1: 6.6, f: (C, t, lt) => act1Frame(C, t, lt, 2)},
  {id: 's03', t0: 6.6, t1: 8.4, f: (C, t, lt) => act1Frame(C, t, lt, 3)},
  {id: 's04', t0: 8.4, t1: 10.6, f: (C, t, lt) => act1Frame(C, t, lt, 4)},
  {id: 's05', t0: 10.6, t1: 15.0, f: (C, t, lt) => yardFrame(C, t, lt), trans: {type: 'flash', dur: 0.7}},
  {id: 's06a', t0: 15.0, t1: 16.0, f: (C, t, lt) => yardFrame(C, t, lt, true)},
  {id: 's06b', t0: 16.0, t1: 17.0, f: (C, t, lt) => dormFrame(C, t, lt, 'model'), trans: {type: 'dissolve', dur: 0.8}},
  {id: 's07', t0: 17.0, t1: 21.0, f: (C, t, lt) => dormFrame(C, t, lt, 'room'), trans: {type: 'dissolve', dur: 0.35}},
  {id: 's08', t0: 21.0, t1: 25.0, f: (C, t, lt) => linesFrame(C, t, lt), trans: {type: 'dissolve', dur: 0.5}},
  {id: 's09', t0: 25.0, t1: 29.6, f: (C, t, lt) => hallFrame(C, t, lt, 'jury'), trans: {type: 'dissolve', dur: 0.9}},
  {id: 's10', t0: 29.6, t1: 36.4, f: (C, t, lt) => hallFrame(C, t, lt, 'congrats')},
  {id: 's11', t0: 36.4, t1: 39.6, f: (C, t, lt) => hallFrame(C, t, lt, 'success'), trans: {type: 'dissolve', dur: 0.4}},
  {id: 's12', t0: 39.6, t1: 43.0, f: (C, t, lt) => armanWorks(C, t, lt, 'spring', 'day', s12Cam, {look: LOOK.neutral}), trans: {type: 'dissolve', dur: 0.5}},
  {id: 's13', t0: 43.0, t1: 46.6, f: (C, t, lt) => hallFrame(C, t, lt, 'award')},
  {id: 's14', t0: 46.6, t1: 51.2, f: (C, t, lt) => scrollFrame(C, t, lt), trans: {type: 'dissolve', dur: 0.6}},
  {id: 's15', t0: 51.2, t1: 55.2, f: (C, t, lt) => declineFrame(C, t, lt)},
  {id: 's16', t0: 55.2, t1: 61.0, f: (C, t, lt) => seasonsFrame(C, t, lt), trans: {type: 'dissolve', dur: 0.4}},
  {id: 's17', t0: 61.0, t1: 65.4, f: (C, t, lt) => tvFrame(C, t, lt)},
  {id: 's18', t0: 65.4, t1: 70.6, f: (C, t, lt) => homeEvening(C, t, lt, 'tea'), trans: {type: 'dissolve', dur: 0.5}},
  {id: 's19', t0: 70.6, t1: 75.8, f: (C, t, lt) => homeEvening(C, t, lt, 'son')},
  {id: 's20', t0: 75.8, t1: 80.0, f: (C, t, lt) => homeEvening(C, t, lt, 'leave')},
  {id: 's21', t0: 80.0, t1: 83.4, f: (C, t, lt) => homeEvening(C, t, lt, 'window')},
  {id: 's22', t0: 83.4, t1: 86.4, f: (C, t, lt) => climaxFrame(C, t, lt, 'wipe'), trans: {type: 'wipe', dur: 1.1}},
  {id: 's23', t0: 86.4, t1: 92.4, f: (C, t, lt) => climaxFrame(C, t, lt, 'question')},
  {id: 's24', t0: 92.4, t1: 96.4, f: (C, t, lt) => climaxFrame(C, t, lt, 'real')},
  {id: 's25', t0: 96.4, t1: 101.0, f: (C, t, lt) => climaxFrame(C, t, lt, 'del')},
  {id: 's26', t0: 101.0, t1: 103.4, f: (C, t, lt) => doorFrame(C, t, lt, 'knock'), trans: {type: 'dissolve', dur: 0.6}},
  {id: 's27', t0: 103.4, t1: 110.8, f: (C, t, lt) => doorFrame(C, t, lt, 'apology')},
  {id: 's28', t0: 110.8, t1: 114.2, f: (C, t, lt) => doorFrame(C, t, lt, 'reply')},
  {id: 's29', t0: 114.2, t1: 119.0, f: (C, t, lt) => endingFrame(C, t, lt, 'desk'), trans: {type: 'dissolve', dur: 0.6}},
  {id: 's30a', t0: 119.0, t1: 120.5, f: (C, t, lt) => endingFrame(C, t, lt, 'drawing'), trans: {type: 'dissolve', dur: 0.5}},
  {id: 's30b', t0: 120.5, t1: 124.0, f: (C, t, lt) => endingFrame(C, t, lt + 1.6, 'windows'), trans: {type: 'dissolve', dur: 0.9}},
];
export const DURATION = 124.0;
