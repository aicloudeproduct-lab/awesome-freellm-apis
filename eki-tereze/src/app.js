// «Екі терезе» — film entry: deterministic renderFrame(t) for the frame renderer.
import * as THREE from 'three';
import {createStage} from './engine/stage.js';
import {loadCharacter} from './characters/mhuman.js';
import {LOOKS} from './config/looks.js';
import {buildApartment} from './sets/apartment.js';
import {buildYard, buildDorm, buildHall} from './sets/others.js';
import * as P from './sets/props.js';
import * as T from './engine/textures.js';
import {PhoneUI} from './engine/phoneui.js';
import {loadFont, buildCues, drawSubtitles, drawTitle, drawThought} from './engine/typo.js';
import {SHOTS, DURATION} from './film/shots.js';
import {voice} from './film/core.js';
import {smooth, sine, easeIO} from './lib/util.js';

const st = createStage();
const C = {st, S: {}, cast: {}, cam: new THREE.PerspectiveCamera(35, st.W / st.H, 0.03, 600), t: 0};
window.__C = C;
window.__gl = st.renderer.getContext();
let cues = [];
const THOUGHT = [{text: 'Жігіттің өзімен тартыссаң да,', size: 104, weight: 400, y: 1380, at: 120.9, step: 0.32}, {text: 'бағымен тартыспа.', size: 128, weight: 600, y: 1560, at: 121.9, step: 0.35}];

function snapshot(fn, w, h) {
  // render a frame through the normal pipeline and copy a centred crop
  fn();
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const src = st.renderer.domElement, sw = src.width, sh = src.height;
  const k = Math.min(sw / w, sh / h) * 0.9;
  c.getContext('2d').drawImage(src, (sw - w * k) / 2, (sh - h * k) / 2 - sh * 0.08, w * k, h * k, 0, 0, w, h);
  return c;
}

function linesGroup() {
  const g = new THREE.Group();
  const solid = P.archModel('arman-entry', 1.0, 1.0);
  const wire = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({color: '#3d6fbf', emissive: '#1d3f80', emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.45, depthWrite: false});
  const edge = new THREE.MeshBasicMaterial({color: '#9cc0ff', transparent: true, opacity: 0.9});
  solid.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, pr = {width: bb.max.x - bb.min.x, height: bb.max.y - bb.min.y, depth: bb.max.z - bb.min.z};
    if (pr.height < 0.03 || pr.depth < 0.01) return;
    const b = new THREE.Mesh(new THREE.BoxGeometry(pr.width, pr.height, pr.depth), mat);
    b.position.copy(o.position); wire.add(b);
    // thin glowing edge rods at the four vertical corners
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.0016, pr.height, 0.0016), edge); r.position.set(o.position.x + sx * pr.width / 2, o.position.y, o.position.z + sz * pr.depth / 2); wire.add(r); }
  });
  wire.material = mat;
  g.add(wire, solid);
  g.userData = {wire, solid};
  return g;
}

window.__ready = (async () => {
  await loadFont('../assets/fonts/NotoSans.ttf');
  C.S.apt = buildApartment(st.env);
  C.S.yard = buildYard(st.env);
  C.S.dorm = buildDorm(st.env);
  C.S.hall = buildHall(st.env);
  for (const k of ['arman', 'armanStudent', 'armanKid', 'ayan', 'ayanStudent', 'ayanKid', 'wife', 'son', 'juror']) C.cast[k] = await loadCharacter(k, LOOKS[k]);
  C.ui = new PhoneUI();
  C.phone = P.phone(C.ui.tex); C.S.apt.scene.add(C.phone);
  C.pencil = P.pencil('#e2b23c'); C.S.apt.scene.add(C.pencil);
  const dmat = new THREE.MeshStandardMaterial({map: T.childDrawing(1), roughness: 0.95, side: THREE.DoubleSide});
  C.drawing = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.212), dmat); C.drawing.castShadow = true; C.drawing.receiveShadow = true; C.S.apt.scene.add(C.drawing);
  C.lines = linesGroup();
  // photos for the phone feed and the TV, rendered from the film's own sets
  const award = SHOTS.find((s) => s.id === 's13');
  C.ui.awardImg = snapshot(() => {
    const r = award.f(C, 44.6, 1.6);
    C.cam.position.set(0.3, 1.62, -5.5); C.cam.lookAt(0.3, 1.45, -7.05); C.cam.fov = 26; C.cam.updateProjectionMatrix();
    st.post.render(r.scene, C.cam, {...r.look, focus: 1.5, aperture: 0.2, flash: 0}, 0);
  }, 480, 520);
  C.ayanPortrait = C.ui.awardImg;
  cues = buildCues(voice, ['n7:1']);
  return true;
})();

/** Lights at zero intensity are made invisible so they drop out of every shader. */
function pruneLights(scene) {
  scene.traverse((o) => { if (o.isLight && !o.isAmbientLight) o.visible = o.intensity > 0.001; });
}

function shotAt(t) {
  for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].t0) return i;
  return 0;
}

const LAYER = new URLSearchParams(location.search).get('layer') || 'all'; // all | scene | text
if (LAYER === 'text') { st.renderer.domElement.style.display = 'none'; document.documentElement.style.background = document.body.style.background = 'transparent'; }
function drawOverlay(t) {
  const ctx = st.ctx; ctx.clearRect(0, 0, st.W, st.H);
  if (LAYER === 'scene') return;
  drawSubtitles(ctx, cues, t, st.W, st.H);
  drawTitle(ctx, t, 9.5, 13.2, st.W, st.H);
  drawThought(ctx, t, 120.9, DURATION - 0.1, st.W, st.H, THOUGHT);
}
window.renderFrame = (t) => {
  C.t = t;
  if (LAYER === 'text') { drawOverlay(t); return SHOTS[shotAt(t)].id; }
  if (new URLSearchParams(location.search).get('prof')) {
    const gl = window.__gl, px = new Uint8Array(4);
    let last = performance.now();
    window.__prof = {log: [], mark(n) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const now = performance.now(); this.log.push(n + '=' + Math.round(now - last)); last = now; }};
  }
  const i = shotAt(t), cur = SHOTS[i];
  let prev = null;
  if (cur.trans && i > 0 && t - cur.t0 < cur.trans.dur) {
    const ps = SHOTS[i - 1];
    const u = (t - cur.t0) / cur.trans.dur;
    const pr = ps.f(C, t, t - ps.t0);
    pruneLights(pr.scene);
    st.post.renderPrev(pr.scene, pr.camera);
    if (cur.trans.type === 'wipe') prev = {mix: u, mode: 1, look: pr.look};
    else prev = {mix: 1 - easeIO(u), mode: 0, look: pr.look};
  }
  const r = cur.f(C, t, t - cur.t0);
  pruneLights(r.scene);
  const look = {...r.look};
  if (cur.trans?.type === 'flash' && t - cur.t0 < cur.trans.dur) { const u = (t - cur.t0) / cur.trans.dur; look.flash = Math.max(look.flash || 0, Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.85); look.flashColor = '#ffe6bf'; }
  const Q = new URLSearchParams(location.search);
  if (Q.get('nodof')) look.aperture = 0;
  if (Q.get('override')) r.scene.overrideMaterial = r.scene.overrideMaterial || new THREE.MeshStandardMaterial({color: '#999'});
  if (Q.get('nocornea')) for (const c of Object.values(C.cast)) for (const e of c.eyes) e.pivot.children[1].visible = false;
  if (Q.get('hairdbg')) for (const c of Object.values(C.cast)) [c.hairMat].forEach((m) => { if (m) { const k = Q.get('hairdbg'); if (k === 'front') m.side = THREE.FrontSide; if (k === 'opaque') { m.transparent = false; m.alphaTest = 0.5; } if (k === 'nonormal') m.normalMap = null; m.needsUpdate = true; } });
  if (Q.get('nochars')) for (const c of Object.values(C.cast)) c.root.visible = false;
  if (Q.get('nolights')) r.scene.traverse((o) => { if (o.isPointLight || o.isSpotLight) o.visible = false; });
  st.renderer.shadowMap.enabled = !Q.get('noshadow');
  if (Q.get('direct')) { st.renderer.setRenderTarget(null); st.renderer.render(r.scene, r.camera); } else
  st.post.render(r.scene, r.camera, look, t, prev);
  drawOverlay(t);
  const P = window.__prof;
  if (P) { const L = {}; r.scene.traverseVisible((o) => { if (o.isLight) { const k = o.type + (o.castShadow ? '*' : ''); L[k] = (L[k] || 0) + 1; } }); P.log.push(JSON.stringify(L)); }
  return cur.id + (P ? ' ' + P.log.join(' ') + ` calls=${P.info?.calls} tris=${P.info?.triangles}` : '');
};
window.__duration = DURATION;
