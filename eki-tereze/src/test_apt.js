import * as THREE from 'three';
import {createStage} from './engine/stage.js';
import {loadCharacter} from './characters/mhuman.js';
import {LOOKS} from './config/looks.js';
import {buildApartment, lightApartment, DESK} from './sets/apartment.js';
import * as P from './sets/props.js';
import {PhoneUI} from './engine/phoneui.js';
import {loadFont} from './engine/typo.js';
import {seated, standing, toWorld} from './anim/poses.js';

const st = createStage();
const S = buildApartment(st.env);
const cam = new THREE.PerspectiveCamera(32, st.W / st.H, 0.05, 500);
const ui = new PhoneUI();
const phone = P.phone(ui.tex); S.scene.add(phone);
let arman, son, wife;
window.__ready = (async () => {
  await loadFont('../assets/fonts/NotoSans.ttf');
  arman = await loadCharacter('arman', LOOKS.arman); S.scene.add(arman.root);
  son = await loadCharacter('son', LOOKS.son); S.scene.add(son.root);
  wife = await loadCharacter('wife', LOOKS.wife); S.scene.add(wife.root);
  return true;
})();
window.renderFrame = (t) => {
  const q = new URLSearchParams(location.search);
  const mode = q.get('mode') || 'night';
  const view = q.get('view') || 'over';
  if (view === 'over') { cam.fov = 38; cam.position.set(DESK.x - 0.55, 1.62, DESK.z + 1.75); cam.lookAt(DESK.x + 0.05, 1.32, DESK.z - 0.4); }
  else if (view === 'room') { cam.fov = 50; cam.position.set(0.6, 1.5, 2.3); cam.lookAt(-1.7, 1.0, 0.0); }
  else if (view === 'face') { cam.fov = 26; cam.position.set(DESK.x + 0.45, 1.25, DESK.z + 0.2); cam.lookAt(DESK.x, 1.15, DESK.z + 0.75); }
  cam.aspect = st.W / st.H; cam.updateProjectionMatrix();
  const base = {x: DESK.x, z: DESK.z + 0.72, ry: Math.PI};
  const pose = seated(arman, base, {seat: 0.46, lean: 0.2, neck: [0.25, 0, 0], head: [0.12, 0, 0]});
  // phone held in front of the chest
  const ph = toWorld(base, -0.02, 1.0, 0.3);
  phone.position.copy(ph);
  const eyes = toWorld(base, 0, 1.45, 0.08);
  phone.lookAt(eyes); 
  pose.armR = {ik: toWorld(base, -0.035, 0.94, 0.28), curl: [0.5, 0.6, 0.7, 0.75], thumb: 0.2};
  pose.armL = {ik: toWorld(base, 0.06, 0.92, 0.27), curl: 0.55, thumb: 0.5};
  pose.face = {look: ph, tense: 0.35};
  arman.setPose(pose, t);
  ui.draw({mode: 'compose', typed: 0.8, t});
  lightApartment(S, {mode, t, phone: mode === 'night' ? 1 : 0, phonePos: ph.clone().add(new THREE.Vector3(0, 0.05, 0.15)), pendant: mode === 'night' ? 0.6 : 0, hall: 0.3});
  const sb = {x: 0.0, z: DESK.z + 0.35, ry: -Math.PI * 0.7};
  son.setPose({...standing(son, sb), face: {look: arman.eyesWorld()}}, t);
  const wb = {x: -1.7, z: -0.28, ry: 0};
  wife.setPose({...seated(wife, wb, {lean: 0.05}), face: {look: arman.eyesWorld(), smile: 0.2}, armL: {ik: toWorld(wb, 0.1, 0.8, 0.33)}, armR: {ik: toWorld(wb, -0.1, 0.8, 0.33)}}, t);
  st.post.render(S.scene, cam, {exposure: mode === 'night' ? 1.3 : 1.0, focus: 1.6, aperture: 0.0, vignette: 0.35}, t);
  return view;
};
