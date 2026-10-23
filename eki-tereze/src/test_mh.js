import * as THREE from 'three';
import {createStage} from './engine/stage.js';
import {loadCharacter} from './characters/mhuman.js';
import {LOOKS} from './config/looks.js';
import * as M from './engine/materials.js';

const st = createStage();
const scene = new THREE.Scene();
scene.environment = st.env; scene.environmentIntensity = 0.45;
scene.background = new THREE.Color('#2a2622');
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), M.wood('floor', '#7a5a3e', '#4e3622', [8, 8]));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const key = new THREE.DirectionalLight('#ffe0bc', 2.8); key.position.set(2, 3, 3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, {left: -4, right: 4, top: 3, bottom: -1}); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; scene.add(key);
const fill = new THREE.DirectionalLight('#9fb4d8', 0.7); fill.position.set(-3, 2, 1); scene.add(fill);
const rim = new THREE.DirectionalLight('#ffffff', 1.4); rim.position.set(-1, 2.5, -3); scene.add(rim);
const cam = new THREE.PerspectiveCamera(30, st.W / st.H, 0.05, 60);
const order = ['armanKid', 'ayanKid', 'son', 'armanStudent', 'ayanStudent', 'arman', 'ayan', 'wife', 'juror'];
const cast = {};
window.__ready = (async () => {
  for (const k of order) { cast[k] = await loadCharacter(k, LOOKS[k]); scene.add(cast[k].root); }
  return true;
})();
window.renderFrame = (t) => {
  const q = new URLSearchParams(location.search);
  const mode = q.get('mode') || 'line';
  order.forEach((k, i) => {
    const c = cast[k];
    if (i === 0) { cam.position.set(0, 1.1, 9.5); }
    c.setPose({x: (i - 4) * 0.62, ry: 0, face: {look: cam.position, smile: +(q.get('smile') || 0), talk: {open: +(q.get('open') || 0), round: 0}}}, t);
  });
  if (mode === 'line') { cam.fov = 30; cam.position.set(0, 1.1, 9.5); cam.lookAt(0, 0.9, 0); }
  else if (q.get('eye')) { const c = cast[mode]; const h = c.eyes[0].pivot.getWorldPosition(new THREE.Vector3()); cam.fov = 12; cam.position.set(h.x + 0.03, h.y + 0.01, h.z + 0.2); cam.lookAt(h.x, h.y, h.z); }
  else { const c = cast[mode]; const h = c.eyesWorld(); cam.fov = 18; cam.position.set(h.x + 0.18, h.y + 0.03, h.z + 0.75); cam.lookAt(h.x, h.y - 0.03, h.z); }
  cam.aspect = st.W / st.H; cam.updateProjectionMatrix();
  st.post.render(scene, cam, {exposure: 1.0, aperture: 0, vignette: 0.3}, t);
  return mode;
};
