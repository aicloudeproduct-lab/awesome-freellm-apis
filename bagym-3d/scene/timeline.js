// Толық 90 с фильмнің таймлайны. Көрініс шекаралары SHOTS кестесінде — түпнұсқа дауыс келгенде осында сөйлемдерге сәйкестендіріледі.
import * as THREE from 'three';
import {Character} from './character.js';
import {PATH, buildDwelling, buildPebbles, buildTower} from './world.js';
import {stoneMaterial, metalMaterial} from './materials.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {POSE, applyStand, applyWalk, clamp, eio, eo, esine, holdBetween, kf, kfV, lerp, mixPose, posesAt, range, ss} from './anim.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const OX = PATH.ax, HX = PATH.bx, TOP = 0.1;
const BLK = 0.6, BH = 0.3, ZC0 = -2.4;      // сатылар: 4 баған × (j+1) қабат
export const DURATION = 90;

// ---------- сахна құрамы ----------
export function setupFilm(S) {
  const {scene} = S;
  const blockMat = stoneMaterial({seed: 17, tiles: 1, base: '#4d525b', grout: false, rough: 0.55});
  const blockGeo = new RoundedBoxGeometry(BLK, BH, BLK, 3, 0.028);
  const mk = () => { const m = new THREE.Mesh(blockGeo, blockMat); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  const stairs = x => { const arr = []; for (let j = 0; j < 4; j++) for (let k = 0; k <= j; k++) { const b = mk(); b.userData.home = V(x, TOP + BH / 2 + k * BH, ZC0 - j * BLK); b.position.copy(b.userData.home); arr.push(b); } return arr; };
  S.stairsO = stairs(OX); S.stairsH = stairs(HX);
  // үйінділер (жолдың сыртқы жағында, еденде): екі қабат
  const pile = (x, z) => [0, 1].map(k => { const b = mk(); b.position.set(x, BH / 2 + k * BH, z); return b; });
  S.pileO = pile(OX - 1.25, ZC0); S.pileH = pile(HX + 1.25, ZC0);
  S.carryO = mk(); S.carryH = mk();
  // өлшеуіш (металл сызғыш) — басқа кейіпкердің сатысында жатыр
  S.ruler = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.7), metalMaterial('#8a8e95')); S.ruler.castShadow = true; scene.add(S.ruler);
  S.tower = buildTower(scene, -3.8, -40);
  S.dwelling = buildDwelling(scene, V(-5.6, 0, -24));
  S.family = [new Character('B'), new Character('A'), new Character('B')];
  // отбасы: жылы есікке қарсы тұрған қараңғы силуэттер (негізгі кейіпкерлермен шатастырмау үшін басқа материал)
  const silMat = new THREE.MeshStandardMaterial({color: '#2b2723', roughness: 0.85, metalness: 0});
  S.family.forEach((c, i) => { c.root.scale.setScalar([0.97, 0.94, 0.6][i]); c.root.traverse(m => { if (m.isMesh) m.material = silMat; }); scene.add(c.root); });
  S.pebbles = buildPebbles(scene, HX, [-7.6, -8.9, -10.4, -11.8, -13.1], 77);
  // кейіпкердің өз жолындағы жылы мүмкіндік-жарық
  const own = new THREE.SpotLight('#e8bf86', 0, 70, 0.27, 0.8, 1.2); own.position.set(3.4, 17.5, -10); own.target.position.set(HX, 0, -8); own.castShadow = true; own.shadow.mapSize.set(1024, 1024); own.shadow.radius = 6;
  scene.add(own, own.target); S.ownLight = own;
  // едендегі дөңгелек шағылыс (S9→S10 ауысуы)
  const pc = document.createElement('canvas'); pc.width = pc.height = 256; const pg = pc.getContext('2d');
  const gr = pg.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.85, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  pg.fillStyle = gr; pg.fillRect(0, 0, 256, 256);
  S.pool = new THREE.Mesh(new THREE.CircleGeometry(1.15, 64), new THREE.MeshBasicMaterial({color: '#d9a45c', map: new THREE.CanvasTexture(pc), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending}));
  S.pool.rotation.x = -Math.PI / 2; S.pool.position.set(OX, TOP + 0.004, -1.0); scene.add(S.pool);
}

// ---------- құрылыс циклі: көтеру → бұрылу → жүру → қою (→ өлшеу) ----------
const slotHome = (stairs, idx) => stairs[idx].userData.home;
/** side: −1 (басқа адам, сыртқы жағы −x), +1 (кейіпкер). Цикл 5.0 с (өлшеу болса 6.2 с). warp — әрекеттің баяулауы. */
function carryCycle(S, ch, side, carry, pileTop, stairs, slotIdx, u, measure = false) {
  const pathX = side < 0 ? OX : HX, lane = pathX + side * 0.62, zPile = ZC0, zSlot = slotHome(stairs, slotIdx).z;
  const out = side * Math.PI / 2, along = Math.PI, inward = -side * Math.PI / 2;
  const home = slotHome(stairs, slotIdx);
  let pose, heading = out, z = zPile, carrying = false, blockPos = null;
  const crouch = {...POSE.stand, hipY: 0.66, spine: [0.62, 0, 0], chest: [0.22, 0, 0], neck: [-0.18, 0, 0], head: [-0.12, 0, 0],
    armL: {sh: [-1.05, 0, 0.18], el: -0.25, grip: 0.9}, armR: {sh: [-1.05, 0, -0.18], el: -0.25, grip: 0.9}};
  const hold = {...POSE.stand, hipY: 0.9, spine: [0.1, 0, 0], chest: [-0.04, 0, 0], head: [0.06, 0, 0], carry: true,
    armL: {sh: [-0.62, 0, 0.28], el: -1.0, wr: [0, 0, -0.25], grip: 0.9}, armR: {sh: [-0.62, 0, -0.28], el: -1.0, wr: [0, 0, 0.25], grip: 0.9}};
  const placeHi = home.y > 1.0;
  const place = {...hold, hipY: placeHi ? 0.95 : 0.9, spine: [0.16, 0, 0], armL: {sh: [placeHi ? -1.2 : -0.95, 0, 0.26], el: placeHi ? -0.55 : -0.7, wr: [0, 0, -0.25], grip: 0.9}, armR: {sh: [placeHi ? -1.2 : -0.95, 0, -0.26], el: placeHi ? -0.55 : -0.7, wr: [0, 0, 0.25], grip: 0.9}};
  const release = {...POSE.stand, spine: [0.08, 0, 0], armL: {sh: [-0.5, 0, 0.12], el: -0.6, grip: 0.3}, armR: {sh: [-0.5, 0, -0.12], el: -0.6, grip: 0.3}};
  const measureP = {...POSE.stand, spine: [0.2, 0, 0], head: [0.25, 0, 0], armL: {sh: [-0.2, 0, 0.1], el: -0.3}, armR: {sh: [-1.05, 0, -0.1], el: -0.45, grip: 0.8}};
  const T = {lift: 0.9, up: 1.5, turn1: 2.0, walk: 3.1, turn2: 3.5, set: 4.3, end: 5.0};
  if (u < T.lift) { pose = posesAt(u, [[0, POSE.stand], [0.25, POSE.stand], [T.lift, crouch]]); }
  else if (u < T.up) { pose = mixPose(crouch, hold, esine(range(u, T.lift, T.up))); carrying = true; }
  else if (u < T.turn1) { pose = hold; heading = lerp(out, along, esine(range(u, T.up, T.turn1))); carrying = true; }
  else if (u < T.walk) { heading = along; carrying = true; }
  else if (u < T.turn2) { pose = hold; heading = lerp(along, inward, esine(range(u, T.walk, T.turn2))); z = zSlot; carrying = true; }
  else if (u < T.set) { pose = mixPose(hold, place, esine(range(u, T.turn2, T.set))); heading = inward; z = zSlot; carrying = true; }
  else { heading = inward; z = zSlot; pose = mixPose(place, release, esine(range(u, T.set, T.set + 0.5))); if (measure) pose = mixPose(pose, measureP, esine(range(u, T.end, T.end + 0.5)) * (1 - esine(range(u, 6.0, 6.4)))); }
  if (u >= T.turn1 && u < T.walk) {
    const pz = tt => lerp(zPile, zSlot, esine(range(tt, T.turn1, T.walk)));
    applyWalk(ch, lane, uu => pz(uu), u, T.turn1 - 0.01, along, hold, {stride: 0.5, swing: 0.36});
  } else {
    // орнында бұрылу: табандар кезекпен көтеріледі (сырғымайды)
    const turning = (u >= T.up && u < T.turn1) || (u >= T.walk && u < T.turn2);
    const lt = turning ? range(u, u < T.turn1 ? T.up : T.walk, u < T.turn1 ? T.turn1 : T.turn2) : 0;
    applyStand(ch, [lane, TOP, z], heading, pose, {footL: [0.1, turning ? Math.max(0, Math.sin(lt * Math.PI * 2)) * 0.05 : 0, 0.03], footR: [-0.1, turning ? Math.max(0, -Math.sin(lt * Math.PI * 2)) * 0.05 : 0, -0.03]});
  }
  // блок: үйіндіде → қолда → орнында
  if (u < T.lift) { carry.position.copy(pileTop); carry.quaternion.identity(); carry.visible = true; }
  else if (u < T.set) {
    holdBetween(carry, ch, [0, -0.02, 0]);
    if (u < T.up) carry.position.lerp(pileTop, 1 - esine(range(u, T.lift, T.lift + 0.25)));
    if (u > T.turn2) carry.position.lerp(home, esine(range(u, T.turn2 + 0.45, T.set)));
    carry.visible = true;
  } else { carry.visible = false; }
  return {placed: u >= T.set};
}

// ---------- камера ----------
function cam(S, pos, look, fov = 38) { S.camera.position.copy(pos); S.camera.lookAt(look); S.camera.fov = fov; S.camera.updateProjectionMatrix(); }
function lights(S, o) {
  const W = S.world;
  W.amber.intensity = o.amber ?? 0; W.coolSpot.intensity = o.cool ?? 0; S.ownLight.intensity = o.own ?? 0;
  W.shaftA.material.uniforms.uInt.value = o.shaftA ?? 0; W.shaftB.material.uniforms.uInt.value = o.shaftB ?? 0;
  W.key.intensity = o.key ?? 0.5; W.hemi.intensity = o.hemi ?? 0.55;
  if (o.amberAt) { W.amber.target.position.copy(o.amberAt); aim(W.shaftA, W.amber.position, o.amberAt); }
  if (o.amberFrom) { W.amber.position.copy(o.amberFrom); aim(W.shaftA, o.amberFrom, o.amberAt || W.amber.target.position); }
  if (o.bAt) { W.coolSpot.target.position.copy(o.bAt); aim(W.shaftB, W.coolSpot.position, o.bAt); }
  if (o.bColor) { W.coolSpot.color.set(o.bColor); W.shaftB.material.uniforms.uColor.value.set(o.bColor); }
  S.fogDensity = o.fog ?? 0.028;
}
function aim(shaft, from, to) { const d = new THREE.Vector3().subVectors(to, from); shaft.position.copy(from); shaft.quaternion.setFromUnitVectors(V(0, -1, 0), d.normalize()); }

// құрылыс кестесі (әлемдік уақыт): басқа адам 8, 9 блоктарды қояды; кейіпкер 7, 8 блоктарды
const CYC = {O1: 6.2, O2: 12.6, H1: 7.3, H2: 18.4};
function buildState(S, t) {
  // сатылардағы блоктардың көрінуі
  const oDone = 8 + (t >= CYC.O1 + 4.3 ? 1 : 0) + (t >= CYC.O2 + 4.3 ? 1 : 0);
  const hDone = 7 + (t >= CYC.H1 + 4.3 ? 1 : 0) + (t >= CYC.H2 + 4.3 ? 1 : 0);
  S.stairsO.forEach((b, i) => (b.visible = i < oDone)); S.stairsH.forEach((b, i) => (b.visible = i < hDone));
  // үйінді: циклдағы блок көтерілгенде үстіңгі блок жоғалады
  const takenO = (t >= CYC.O1 + 0.9 ? 1 : 0) + (t >= CYC.O2 + 0.9 ? 1 : 0), takenH = (t >= CYC.H1 + 0.9 ? 1 : 0) + (t >= CYC.H2 + 0.9 ? 1 : 0);
  S.pileO.forEach((b, i) => (b.visible = i < 2 - takenO)); S.pileH.forEach((b, i) => (b.visible = i < 2 - takenH));
  S.ruler.position.set(OX, TOP + 2 * BH + 0.006, ZC0 - 2 * BLK); S.ruler.rotation.set(0, 0, 0);
}
const pileTopPos = (pile, n) => pile[Math.max(0, n)].position.clone();

/** Екі кейіпкердің құрылыс кезеңіндегі (0–25 с) әрекеті. slowH — кейіпкердің назары ауғандағы баяулау. */
function workPhase(S, t, {slowH = 0} = {}) {
  buildState(S, t);
  const o = S.other, h = S.hero;
  const oc = t < CYC.O2 ? {T: CYC.O1, idx: 8, pile: 1} : {T: CYC.O2, idx: 9, pile: 0, measure: true};
  const ou = t - oc.T;
  if (ou >= 0 && ou < (oc.measure ? 6.4 : 5.0)) carryCycle(S, o, -1, S.carryO, pileTopPos(S.pileO, oc.pile), S.stairsO, oc.idx, ou, oc.measure);
  else { S.carryO.visible = false; applyStand(o, [OX - 0.62, TOP, ZC0 - 3 * BLK], Math.PI / 2, {...POSE.stand, head: [0.1, -0.2, 0]}); }
  // кейіпкер: баяулау кезінде циклдің ішкі уақыты баяу жүреді
  const hc = t < CYC.H2 ? {T: CYC.H1, idx: 7, pile: 1} : {T: CYC.H2, idx: 8, pile: 0};
  let hu = t - hc.T;
  if (slowH > 0) hu = Math.min(hu, 0.6) + Math.max(0, hu - 0.6) * (1 - slowH);
  if (hu >= 0 && hu < 5.0) carryCycle(S, h, 1, S.carryH, pileTopPos(S.pileH, hc.pile), S.stairsH, hc.idx, hu);
  else { S.carryH.visible = false; applyStand(h, [HX + 0.62, TOP, ZC0 + 0.3], Math.PI / 2, {...POSE.stand, spine: [0.08, 0, 0]}); }
  // (өлшеу сызғышы басқа адамның қолында: 17.3–18.6)
  const mu = t - CYC.O2;
  if (mu > 5.0 && mu < 6.2) { S.other.root.updateMatrixWorld(true); const w = new THREE.Vector3(0, -0.08, 0.02); S.other.arm.R.wr.localToWorld(w); S.ruler.position.set(OX + Math.sin((mu - 5) * 4) * 0.04, TOP + 4 * BH + 0.008, w.z); S.ruler.rotation.y = 0; }
}

// ---------- пландар ----------
const W0 = V(0, 0, 0);
export const SHOTS = [
  {name: 'S1_ashylu', t0: 0, t1: 4.6, fn(S, t) {
    workPhase(S, t);
    const k = t / 4.6;
    cam(S, V(lerp(0.35, 0.2, k), lerp(0.62, 0.78, k), lerp(8.4, 6.6, esine(k))), V(0, 0.95, -3.2), 36);
    const a = ss(range(t, 0.9, 2.4));
    lights(S, {amber: 520 * a, cool: 28, shaftA: 0.95 * a, shaftB: 0.12, key: 0.45, amberFrom: V(-3.2, 17.5, -2.0), amberAt: V(OX, 0, -1.6)});
    S.exposure = 0.95 * ss(range(t, 0, 1.3));
  }},
  {name: 'S2_nazar', t0: 4.6, t1: 8.0, fn(S, t) {
    const slow = esine(range(t, 4.9, 6.0));
    workPhase(S, t, {slowH: slow});
    // кейіпкердің басы сол жолға бұрылады
    const h = S.hero; h.head.rotation.y += -0.75 * esine(range(t, 5.0, 5.9)); h.neck.rotation.y += -0.3 * esine(range(t, 5.0, 5.9));
    const u = range(t, 4.6, 8.0);
    const hp = S.hero.root.position;
    const p0 = V(hp.x - 0.35, 1.05, hp.z + 3.4), p1 = V(hp.x - 0.9, 1.0, hp.z + 2.9), p2 = V(0.16, 0.12, -1.2);
    const pos = u < 0.72 ? p0.clone().lerp(p1, esine(u / 0.72)) : p1.clone().lerp(p2, eio((u - 0.72) / 0.28));
    const look = u < 0.72 ? V(hp.x - 0.1, 1.5, hp.z) : V(hp.x - 0.1, 1.5, hp.z).lerp(V(0, 0.0, -6), eio((u - 0.72) / 0.28));
    cam(S, pos, look, lerp(42, 50, eio(range(u, 0.72, 1))));
    lights(S, {amber: 520, cool: 28, shaftA: 0.95, shaftB: 0.1, key: 0.45, amberFrom: V(-3.2, 17.5, -2.0), amberAt: V(OX, 0, -1.6)});
    S.exposure = 0.95;
    S.title = {html: 'Жігіттің өзімен тартыссаң да,<br>бағымен тартыспа.', t0: 5.0, t1: 7.55};
  }},
  {name: 'S3_enbek', t0: 8.0, t1: 13.0, fn(S, t) {
    workPhase(S, t);
    const u = range(t, 8.0, 13.0);
    // жіңішке ізден (макро) архитектуралық сызыққа көтерілу: бағыт — алға, сосын жоғары
    const pos = V(0.0, 0.08, -1.9).lerp(V(0.25, 2.6, 4.2), eio(range(u, 0.1, 1)));
    pos.z -= (1 - eio(range(u, 0, 0.25))) * 0.6 * u;
    const look = V(0, 0.0, -7).lerp(V(0, 0.9, -4.0), eio(range(u, 0.1, 0.8)));
    cam(S, pos, look, lerp(50, 38, eio(range(u, 0.1, 0.9))));
    lights(S, {amber: 500, cool: 40, shaftA: 0.85, shaftB: 0.16, key: 0.5, amberFrom: V(-3.2, 17.5, -2.0), amberAt: V(OX, 0, -3.0), bAt: V(HX, 0, -3.0), bColor: '#c8d2e0'});
    S.exposure = 0.95;
  }},
  {name: 'S4_olsheu', t0: 13.0, t1: 19.0, fn(S, t) {
    workPhase(S, t);
    const u = range(t, 13, 19);
    const o = S.other.root.position;
    cam(S, V(lerp(-3.9, -3.6, u), lerp(1.55, 1.45, u), lerp(-0.4, -1.4, esine(u))), V(o.x + 0.2, 0.95, o.z - 0.2), 40);
    lights(S, {amber: 520, cool: 30, shaftA: 0.7, shaftB: 0.0, key: 0.5, amberFrom: V(-3.2, 17.5, -3.0), amberAt: V(OX, 0, -3.4)});
    S.exposure = 0.95;
  }},
  {name: 'S5_ozinin_enbegi', t0: 19.0, t1: 25.0, fn(S, t) {
    workPhase(S, t);
    const u = range(t, 19, 25), h = S.hero.root.position;
    const look = V(h.x - 0.2, 0.95, h.z - 0.2);
    // соңында блок қырына макро (geometric match)
    const edge = slotHome(S.stairsH, 8).clone().add(V(-0.3, 0.15, 0.3));
    const pos = V(4.4, 1.5, lerp(-0.6, -2.0, esine(range(u, 0, 0.75)))).lerp(edge.clone().add(V(0.35, 0.05, 0.45)), eio(range(u, 0.8, 1)));
    cam(S, pos, look.lerp(edge, eio(range(u, 0.8, 1))), lerp(40, 46, eio(range(u, 0.8, 1))));
    lights(S, {amber: 360, cool: 210, shaftA: 0.4, shaftB: 0.45, key: 0.5, amberFrom: V(-3.2, 17.5, -3.0), amberAt: V(OX, 0, -3.4), bAt: V(HX, 0, -3.4), bColor: '#cfd6e1'});
    S.exposure = 0.95;
  }},
  {name: 'S6_qyzmet', t0: 25.0, t1: 30.0, fn(S, t) {
    workPhase(S, 25);
    const u = range(t, 25, 30), tw = S.tower.position;
    // сатының қырынан мұнараға: камера жоғары көтеріледі (қол қозғалысын жалғастырады)
    cam(S, V(tw.x + 2.2, lerp(0.45, 3.6, eio(u)), tw.z + lerp(1.8, 6.4, esine(u))), V(tw.x, lerp(0.4, 4.4, eio(u)), tw.z), lerp(46, 40, u));
    applyStand(S.other, [tw.x, tw.y + 9 * 0.55, tw.z - 0.2], 0.4, {...POSE.upright, head: [-0.1, 0.1, 0]});
    applyStand(S.hero, [HX + 0.62, TOP, ZC0 + 0.3], Math.PI / 2, POSE.stand);
    lights(S, {amber: 760, cool: 0, shaftA: 0.9, shaftB: 0, key: 0.4, amberFrom: V(-5.5, 18, -12), amberAt: V(tw.x, tw.y + 5, tw.z)});
    S.exposure = 0.95;
  }},
  {name: 'S7_ataq', t0: 30.0, t1: 35.0, fn(S, t) {
    workPhase(S, 25);
    const u = range(t, 30, 35), topZ = ZC0 - 3 * BLK, top = V(OX, TOP + 4 * BH, topZ);
    applyStand(S.other, [top.x, top.y, top.z], 0.35, {...POSE.upright, head: [-0.12, 0, 0]});
    applyStand(S.hero, [HX, TOP, 1.6], -2.6, {...POSE.stand, head: [-0.22, 0.1, 0]});
    // жұмсақ назар сәулесі: кейіпкердің көзқарас биіктігінен
    cam(S, V(lerp(1.4, 1.1, u), 1.55, lerp(2.9, 2.5, u)), V(top.x, top.y + 0.95, top.z), lerp(44, 40, esine(u)));
    lights(S, {amber: 820 * (0.55 + 0.45 * ss(range(t, 30.2, 31.5))), cool: 0, shaftA: 1.1, key: 0.35, amberFrom: V(-2.8, 18, -6.5), amberAt: V(top.x, top.y, top.z)});
    S.exposure = 0.95;
  }},
  {name: 'S8_baspana', t0: 35.0, t1: 39.0, fn(S, t) {
    workPhase(S, 25);
    const u = range(t, 35, 39), d = S.dwelling.position;
    S.dwelling.userData.warm.intensity = 18 * ss(range(t, 35.0, 36.4)); S.dwelling.userData.glow.material.opacity = 0.85 * ss(range(t, 35.0, 36.4));
    applyStand(S.other, [d.x + 1.3, 0, d.z + 3.2], -0.4, {...POSE.stand, head: [0, -0.15, 0]});
    cam(S, V(d.x + lerp(4.6, 3.7, u), 1.7, d.z + lerp(9.5, 8.2, esine(u))), V(d.x - 0.2, 1.8, d.z - 0.5), 38);
    lights(S, {amber: 140, key: 0.45, amberFrom: V(-6, 18, -18), amberAt: V(d.x, 0, d.z + 2)});
    S.exposure = 0.95;
  }},
  {name: 'S9_otbasy', t0: 39.0, t1: 43.0, fn(S, t) {
    workPhase(S, 25);
    const u = range(t, 39, 43), d = S.dwelling.position;
    S.dwelling.userData.warm.intensity = 18; S.dwelling.userData.glow.material.opacity = 0.85;
    // алыстағы жылы отбасы: есік алдында, жылы жарыққа қарсы
    const fam = [[-0.42, -1.2, 0.25], [0.36, -1.35, -0.2], [-0.02, -0.95, 0.1]];
    S.family.forEach((c, i) => { c.root.visible = true; applyStand(c, [d.x + fam[i][0], 0, d.z + fam[i][1]], Math.PI + fam[i][2], i === 2 ? {...POSE.stand, armR: {sh: [-0.9, 0, 0.3], el: -0.3}} : {...POSE.stand, armL: {sh: [-0.25, 0, 0.25], el: -0.4}}); });
    applyStand(S.other, [d.x + 1.2, 0, d.z + 2.6], Math.PI - 0.3, POSE.stand);
    // соңында едендегі дөңгелек шағылысқа тілт
    const pos = V(d.x + 1.9, 1.5, d.z + lerp(8.4, 7.6, esine(range(u, 0, 0.6))));
    const look = V(d.x, 1.35, d.z);
    S.pool.material.opacity = 0.5 * ss(range(u, 0.6, 0.9));
    // соңында: едендегі дөңгелек шағылыс — камера оған қарай төмен түседі
    const k = eio(range(u, 0.62, 1));
    cam(S, pos.lerp(V(OX + 0.5, 1.9, 1.2), k), look.lerp(V(OX, 0.0, -1.0), k), 38);
    lights(S, {amber: 300 * range(u, 0.6, 1), key: 0.4, amberFrom: V(-2.6, 17.5, -1.0), amberAt: V(OX, 0, -1.0)});
    S.exposure = 0.95;
  }},
  {name: 'S10_qol_sozu', t0: 43.0, t1: 50.0, fn(S, t) {
    workPhase(S, 25); S.family.forEach(c => (c.root.visible = false));
    const u = range(t, 43, 50);
    // дөңгелек жарық көзі (сәуле табаны) → кейіпкердің иығынан өтіп, оның көзқарасы
    const beamX = kf(t, [[43, OX], [46.2, OX], [48.5, OX - 0.9]]);
    S.pool.position.set(beamX, TOP + 0.004, -1.0); S.pool.material.opacity = 0.5;
    const reach = esine(range(t, 44.2, 46.0)), tense = range(t, 46.0, 48.5);
    applyStand(S.hero, [HX - 0.55, TOP, -0.6], -Math.PI / 2, {...POSE.stand, spine: [0.08 + 0.1 * reach, 0, 0], head: [0.05, 0, 0],
      armR: {sh: [-1.25 * reach, -0.2 * reach, -0.1], el: -0.12, grip: lerp(0.3, 1.2, tense)}, armL: {sh: [0.06, 0, 0.08], el: -0.2, grip: 0.6 + 0.6 * tense}, brow: tense});
    applyStand(S.other, [OX - 0.62, TOP, ZC0 - 3 * BLK], Math.PI / 2, POSE.stand);
    // жарық көзінен (дөңгелек) басталып, кейіпкердің оң иығының сыртынан өтеді
    const k = eio(range(u, 0, 0.5));
    const pos = V(OX + 0.6, 1.9, 1.2).lerp(V(HX + 1.05, 1.68, -1.75), k);
    cam(S, pos, V(beamX, lerp(0.0, 0.95, k), -1.0), lerp(38, 42, u));
    lights(S, {amber: 520, key: 0.42, amberFrom: V(beamX - 1.8, 17.5, -1.0), amberAt: V(beamX, 0, -1.0), shaftA: 0.9});
    S.exposure = 0.95;
  }},
  {name: 'S11_qabyldau', t0: 50.0, t1: 58.0, fn(S, t) {
    workPhase(S, 25);
    const u = range(t, 50, 58);
    const rel = esine(range(t, 50.2, 52.4)), turn = esine(range(t, 53.0, 55.2));
    const base = mixPose({...POSE.stand, armR: {sh: [-1.25, -0.2, -0.1], el: -0.12, grip: 1.2}, brow: 1}, {...POSE.slump, brow: 0.3}, rel);
    const calm = mixPose(base, {...POSE.stand, head: [0.12, 0, 0], brow: 0}, turn);
    applyStand(S.hero, [HX - 0.55, TOP, -0.6], lerp(-Math.PI / 2, Math.PI, turn), calm);
    applyStand(S.other, [OX - 0.62, TOP, ZC0 - 3 * BLK], Math.PI / 2, POSE.stand);
    // өз жолындағы жарық біртіндеп байқалады; камера бағыты оның жолына бұрылады
    const ownA = ss(range(t, 53.6, 56.0));
    const pos = V(HX + lerp(0.9, 1.2, u), lerp(1.45, 1.55, u), lerp(1.4, 1.9, u));
    const look = V(HX - 0.8, 1.1, -0.8).lerp(V(HX, 0.6, -8), eio(range(t, 53.0, 56.0)));
    // соңында алақан камера алдынан өтеді (foreground wipe)
    const wipe = range(t, 57.25, 58.0);
    cam(S, pos, look, 40);
    if (wipe > 0) S.palmWipe = {x: lerp(1.25, -0.3, eio(wipe)), y: 0.55};
    lights(S, {amber: 380 * (1 - 0.4 * turn), own: 520 * ownA, shaftA: 0.6 * (1 - 0.5 * turn), key: 0.42, amberFrom: V(-3.3, 17.5, -1.0), amberAt: V(OX - 0.9, 0, -1.0)});
    S.exposure = 0.95;
  }},
  {name: 'S12_auyrlyq', t0: 58.0, t1: 66.0, fn(S, t) {
    S.family.forEach(c => (c.root.visible = false));
    const u = range(t, 58, 66);
    // өз жолымен жүреді, бірақ назары қайта-қайта сол жолға ауады; ұсақ тасқа сүрінеді
    const pz = tt => kf(tt, [[58, -2.0], [62.4, -7.3], [62.75, -7.45], [66, -10.6]], x => x);
    const glance = Math.max(esine(range(t, 59.0, 59.6)) * (1 - esine(range(t, 60.4, 61.0))), esine(range(t, 61.6, 62.0)) * (1 - esine(range(t, 62.5, 62.8))), esine(range(t, 63.8, 64.4)) * (1 - esine(range(t, 65.2, 65.8))));
    const stumble = Math.sin(Math.PI * range(t, 62.4, 63.1));
    const base = mixPose({...POSE.stand, spine: [0.08, 0, 0]}, POSE.slump, u * 0.6);
    base.head = [0.05 + 0.1 * u, 0.85 * glance, 0]; base.neck = [0, 0.3 * glance, 0];
    base.spine = [base.spine[0] + 0.25 * stumble, 0, 0];
    applyWalk(S.hero, HX, pz, t, 57.0, Math.PI, base, {stride: 0.58, swing: 0.44, armSwing: 0.7});
    applyStand(S.other, [OX, TOP, -9.0 + (t - 58) * -0.4], Math.PI, POSE.upright);
    const hz = pz(t);
    cam(S, V(HX + lerp(1.6, 1.3, u), 1.25, hz + lerp(2.6, 2.3, u)), V(HX - 0.1, 0.85, hz - 1.4), 42);
    lights(S, {amber: 420, own: 260, key: 0.38, shaftA: 0.6, amberFrom: V(-3.3, 17.5, -11), amberAt: V(OX, 0, -11), fog: 0.028 + 0.012 * u});
    S.shade = 0.1 + 0.25 * u; // көру аймағын тарылтатын көлеңке (виньетка)
    S.exposure = 0.95 - 0.12 * u;
  }},
  {name: 'S13_qyzganysh', t0: 66.0, t1: 75.0, fn(S, t) {
    const u = range(t, 66, 75);
    const pz = tt => kf(tt, [[66, -10.6], [71.5, -12.6], [75, -13.2]], x => x);
    const base = {...POSE.slump, spine: [0.3, 0, 0], head: [0.28, 0.4 * Math.max(0, Math.sin((t - 66) * 0.8)), 0], armL: {sh: [0.1, 0, 0.04], el: -0.1, grip: 1.25}, armR: {sh: [0.1, 0, -0.04], el: -0.1, grip: 1.25}, brow: 1};
    applyWalk(S.hero, HX, pz, t, 64, Math.PI, base, {stride: 0.42, swing: 0.55, armSwing: 0.35});
    applyStand(S.other, [OX, TOP, -12.5], Math.PI, POSE.upright);
    // камера кейіпкерді айналып өтеді; соңында тас бағана кадрды жабады
    const hz = pz(t), ang = lerp(0.9, -1.6, esine(u)), rad = lerp(2.6, 3.2, u);
    const pos = V(HX + Math.sin(ang) * rad, lerp(1.3, 1.6, u), hz + Math.cos(ang) * rad);
    cam(S, pos, V(HX, 0.95, hz), 40);
    S.pillarWipe = range(t, 74.15, 75.0);
    lights(S, {amber: 420, own: 200, key: 0.36, shaftA: 0.55, amberFrom: V(-3.3, 17.5, -12), amberAt: V(OX, 0, -12.5), fog: 0.04});
    S.shade = 0.35; S.exposure = 0.83;
  }},
  {name: 'S14_tilek', t0: 75.0, t1: 82.0, fn(S, t) {
    const u = range(t, 75, 82);
    const turn = esine(range(t, 75.6, 76.8)), heart = esine(range(t, 77.0, 78.0)) * (1 - esine(range(t, 79.4, 80.2))), open = esine(range(t, 79.4, 80.4));
    const straight = esine(range(t, 76.0, 78.5));
    let pose = mixPose({...POSE.slump, armL: {sh: [0.1, 0, 0.04], el: -0.1, grip: 1.25}, armR: {sh: [0.1, 0, -0.04], el: -0.1, grip: 1.25}, brow: 1}, {...POSE.upright, brow: 0}, straight);
    pose = mixPose(pose, {...pose, armL: {sh: [-0.55, 0.35, -0.15], el: -1.75, wr: [0, 0, -0.35], grip: 0.15}, spine: [0.16, 0, 0], head: [0.2, 0, 0]}, heart);
    pose = mixPose(pose, {...pose, armL: {sh: [-0.7, 0, 0.35], el: -0.35, wr: [0, 0, -0.6], grip: 0.05}}, open);
    applyStand(S.hero, [HX - 0.25, TOP, -13.2], lerp(Math.PI, -Math.PI / 2 - 0.1 + 2 * Math.PI, turn) - (turn > 0 ? 0 : 0), pose);
    // басқа адам жауап береді: басын изеп, қолын кеудесіне қояды
    const nod = Math.sin(Math.PI * range(t, 78.3, 79.3)), oh = esine(range(t, 78.6, 79.6)) * (1 - esine(range(t, 81.0, 81.8)));
    applyStand(S.other, [OX + 0.25, TOP, -12.9], Math.PI / 2 + 0.1, {...POSE.upright, head: [0.25 * nod, 0, 0], armR: {sh: [-0.55, -0.35, 0.15], el: -1.75, wr: [0, 0, 0.35], grip: 0.15 + 0 * oh}, ...(oh > 0 ? {} : {})});
    if (oh <= 0) S.other.arm.R.sh.rotation.set(0.04, 0, -0.07);
    else { S.other.arm.R.sh.rotation.set(-0.55 * oh, -0.35 * oh, 0.15 * oh - 0.07 * (1 - oh)); S.other.arm.R.el.rotation.x = -1.75 * oh - 0.18 * (1 - oh); }
    const reveal = 1 - range(t, 75.0, 75.75);
    S.pillarWipe = reveal > 0 ? 1 + (1 - reveal) : 0;
    cam(S, V(lerp(5.0, 4.4, u), lerp(1.55, 1.5, u), lerp(-10.4, -11.0, esine(u))), V(0, 1.15, -13.0), 40);
    lights(S, {amber: 420, own: 380 * ss(range(t, 77, 80)), key: 0.42, shaftA: 0.55, amberFrom: V(-3.0, 17.5, -12.5), amberAt: V(OX, 0, -12.9), fog: lerp(0.04, 0.03, u)});
    S.shade = lerp(0.35, 0.12, esine(range(t, 77, 81))); S.exposure = lerp(0.83, 0.95, esine(range(t, 77, 81)));
  }},
  {name: 'S15_erkindik', t0: 82.0, t1: 90.0, fn(S, t) {
    const u = range(t, 82, 90);
    // әркім өз жолымен; камера баяу алыстап, үлкен ортақ кеңістікті ашады
    const pzO = tt => kf(tt, [[82, -13.6], [90, -17.0]], x => x * (2 - x));
    const pzH = tt => kf(tt, [[82, -13.6], [82.6, -13.7], [90, -17.3]], x => x * (2 - x));
    applyWalk(S.other, OX, pzO, t, 81, Math.PI, POSE.upright, {stride: 0.6, swing: 0.45});
    applyWalk(S.hero, HX, pzH, t, 81, Math.PI, {...POSE.upright, head: [-0.04, 0, 0]}, {stride: 0.6, swing: 0.45});
    const stop = esine(range(t, 86, 90));
    cam(S, V(0, lerp(1.9, 6.2, eio(u)), lerp(-8.5, -0.5, eio(u))), V(0, lerp(1.1, 1.4, u), -20), lerp(40, 36, u));
    lights(S, {amber: 460, own: 460, key: 0.45, shaftA: 0.75, amberFrom: V(-3.0, 17.5, -16), amberAt: V(OX, 0, -16), fog: 0.028});
    S.ownLight.position.set(3.4, 17.5, -14); S.ownLight.target.position.set(HX, 0, -16.2);
    S.title = {html: 'Жігіттің өзімен тартыссаң да,<br>бағымен тартыспа.', t0: 84.6, t1: 99};
    S.shade = 0.1; S.exposure = 0.95 * (1 - 0.85 * ss(range(t, 89.25, 90.0)));
    S.endFade = ss(range(t, 89.25, 90.0));
  }},
];

export function shotAt(t) { for (const s of SHOTS) if (t < s.t1) return s; return SHOTS[SHOTS.length - 1]; }
