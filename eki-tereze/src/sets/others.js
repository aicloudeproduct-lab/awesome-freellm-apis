// Childhood yard, student dorm, exhibition hall (+ award stage).
import * as THREE from 'three';
import * as M from '../engine/materials.js';
import * as T from '../engine/textures.js';
import * as P from './props.js';
import {rng, shadow} from '../lib/util.js';

const grad = (top, low) => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(1, low); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};

function dirLight(color, I, pos, target, size = 4, map = 2048) {
  const l = new THREE.DirectionalLight(color, I); l.position.copy(pos); l.target.position.copy(target);
  l.castShadow = true; l.shadow.mapSize.set(map, map);
  Object.assign(l.shadow.camera, {left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 40});
  l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02;
  return l;
}

// ------------------------------------------------------------------ yard
export function buildYard(env) {
  const scene = new THREE.Scene(); scene.environment = env; scene.environmentIntensity = 0.35;
  scene.background = grad('#8fb8dc', '#f3dcae');
  scene.fog = new THREE.Fog('#efd9b0', 12, 45);
  const S = {scene};
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({map: T.dirt('yard', [14, 14]), normalMap: T.dirtNormal([14, 14]), roughness: 0.95}));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // whitewashed adobe wall with a blue window, wooden door
  const wallM = M.plaster('#efe6d6', 'adobe', [3, 1.5]);
  const wall = P.box(9, 3.0, 0.4, wallM, 0.02); wall.position.set(0, 1.5, -3.2); scene.add(wall);
  const sock = P.box(9, 0.45, 0.45, M.plaster('#9db3c4', 'sock', [4, 1]), 0.02); sock.position.set(0, 0.22, -3.0); scene.add(sock);
  const winF = P.box(1.1, 1.0, 0.1, M.matte('#3f7fb0', 0.6), 0.01); winF.position.set(-1.6, 1.7, -2.96); scene.add(winF);
  const winG = P.box(0.9, 0.8, 0.02, M.glass('#9fc0d4', 0.6), 0); winG.position.set(-1.6, 1.7, -2.9); scene.add(winG);
  const door = P.box(0.95, 2.1, 0.08, M.wood('yarddoor', '#7a5a3c', '#4e3624', [1, 2]), 0.01); door.position.set(1.9, 1.05, -2.95); scene.add(door);
  const roof = P.box(9.6, 0.15, 1.2, M.matte('#8a6a50', 0.85), 0.01); roof.position.set(0, 3.05, -2.7); roof.rotation.x = -0.15; scene.add(roof);
  // fence on the right
  const fM = M.wood('yardfence', '#8b6f55', '#5d4837');
  for (let z = -2.8; z < 6; z += 0.16) { const p = P.box(0.09, 1.3 + Math.sin(z * 13) * 0.06, 0.03, fM, 0.004); p.position.set(3.2, 0.62, z); p.rotation.z = Math.sin(z * 7) * 0.03; scene.add(p); }
  // apricot tree
  const tr = P.tree('apricot', 5.2); tr.position.set(-2.8, 0, 0.6); for (const l of tr.userData.leaves) l.material.color.set('#6f8f45'); scene.add(tr);
  // bucket, basin, stick
  const buck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.25, 24, 1, true), M.metal('#8d949a', 0.45)); buck.material.side = THREE.DoubleSide; buck.position.set(0.9, 0.125, -0.5); scene.add(buck);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), new THREE.MeshPhysicalMaterial({color: '#5a4630', roughness: 0.05, clearcoat: 1})); water.rotation.x = -Math.PI / 2; water.position.set(0.9, 0.2, -0.5); scene.add(water);
  // the mud house: small sun-dried bricks
  const mud = new THREE.MeshPhysicalMaterial({color: '#7b5a3e', roughness: 0.75, clearcoat: 0.25, clearcoatRoughness: 0.6, normalMap: T.dirtNormal([1, 1]), normalScale: new THREE.Vector2(0.6, 0.6)});
  const mudHouse = new THREE.Group(); mudHouse.position.set(0, 0, 0.15); scene.add(mudHouse);
  const bricks = [];
  const brick = (x, y, z, ry) => { const b = P.box(0.062, 0.03, 0.032, mud, 0.006, 2); b.position.set(x, y + 0.015, z); b.rotation.y = ry; mudHouse.add(b); bricks.push(b); return b; };
  const W = 0.34, D = 0.26;
  for (let row = 0; row < 6; row++) {
    const y = row * 0.031, off = row % 2 ? 0.031 : 0;
    for (let x = -W / 2 + 0.03 + off; x < W / 2 - 0.02; x += 0.064) { brick(x, y, D / 2, 0); if (!(row < 4 && Math.abs(x) < 0.05)) brick(x, y, -D / 2, 0); }
    for (let z = -D / 2 + 0.05 + off; z < D / 2 - 0.03; z += 0.064) { brick(-W / 2, y, z, Math.PI / 2); brick(W / 2, y, z, Math.PI / 2); }
  }
  // the wall section that falls (front-left top rows)
  S.fallSection = new THREE.Group(); S.fallSection.position.set(-W / 2, 0.19, 0); mudHouse.add(S.fallSection);
  for (let row = 0; row < 3; row++) for (let z = -D / 2 + 0.05; z < D / 2 - 0.03; z += 0.064) { const b = P.box(0.062, 0.03, 0.032, mud, 0.006, 2); b.position.set(0, row * 0.031 + 0.015, z); b.rotation.y = Math.PI / 2; S.fallSection.add(b); }
  // little roof of sticks
  const stickM = M.wood('stick', '#8a6a46', '#5e4630');
  S.roofSticks = new THREE.Group(); S.roofSticks.position.set(0, 0.3, 0); mudHouse.add(S.roofSticks);
  for (let i = 0; i < 9; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, W + 0.08, 6), stickM); st.rotation.z = Math.PI / 2; st.position.set(0, 0, -D / 2 + i * D / 8); S.roofSticks.add(st); }
  S.mudHouse = mudHouse; S.mudBricks = bricks;
  shadow(scene);
  ground.castShadow = false;
  // warm afternoon sun, sky fill
  const sun = dirLight('#ffdcaa', 3.6, new THREE.Vector3(-5, 4.5, 4), new THREE.Vector3(0, 0, 0), 3); scene.add(sun, sun.target); S.sun = sun;
  scene.add(new THREE.HemisphereLight('#bcd4ec', '#a7845c', 0.55));
  // dust motes in the sun
  const r = rng('motes'), n = 400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 3; pos[i * 3 + 1] = r() * 2.2; pos[i * 3 + 2] = (r() - 0.5) * 3; }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  S.motes = new THREE.Points(mg, new THREE.PointsMaterial({color: '#fff2d6', size: 0.006, transparent: true, opacity: 0.7, depthWrite: false})); scene.add(S.motes);
  S.moteBase = Float32Array.from(pos);
  S.update = (t) => {
    const p = S.motes.geometry.attributes.position;
    for (let i = 0; i < n; i++) { p.setX(i, S.moteBase[i * 3] + Math.sin(t * 0.3 + i) * 0.05); p.setY(i, (S.moteBase[i * 3 + 1] + t * 0.03) % 2.2); }
    p.needsUpdate = true;
  };
  return S;
}

// ------------------------------------------------------------------ dorm
export function buildDorm(env) {
  const scene = new THREE.Scene(); scene.environment = env; scene.environmentIntensity = 0.04;
  scene.background = new THREE.Color('#0c1322');
  const S = {scene};
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), M.wood('dormfloor', '#7d6448', '#5a462f', [4, 4]));
  fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
  const wM = M.plaster('#c9c2ae', 'dormwall', [2, 2]);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.7), wM); back.position.set(0, 1.35, -1.1); back.receiveShadow = true; scene.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.7), wM); left.rotation.y = Math.PI / 2; left.position.set(-1.6, 1.35, 0.8); left.receiveShadow = true; scene.add(left);
  // window with night city
  const cityC = document.createElement('canvas'); cityC.width = 512; cityC.height = 512; const g = cityC.getContext('2d'), r = rng('city');
  const sky = g.createLinearGradient(0, 0, 0, 512); sky.addColorStop(0, '#0a1020'); sky.addColorStop(1, '#2a3550'); g.fillStyle = sky; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++) { const x = r() * 512, w = 30 + r() * 60, h = 120 + r() * 260; g.fillStyle = '#121826'; g.fillRect(x, 512 - h, w, h); for (let k = 0; k < 40; k++) if (r() < 0.35) { g.fillStyle = r() < 0.8 ? '#ffcf80' : '#a8c8ff'; g.fillRect(x + 4 + (k % 5) * (w / 5), 512 - h + 8 + Math.floor(k / 5) * 26, 5, 8); } }
  const cityT = new THREE.CanvasTexture(cityC); cityT.colorSpace = THREE.SRGBColorSpace;
  const city = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.1), new THREE.MeshStandardMaterial({color: '#000', emissive: '#ffffff', emissiveMap: cityT, emissiveIntensity: 0.8}));
  city.position.set(0.95, 1.65, -1.09); scene.add(city);
  const wf = M.matte('#e9e4d8', 0.6);
  for (const [w, h, x, y] of [[1.3, 0.06, 0.95, 1.08], [1.3, 0.06, 0.95, 2.22], [0.06, 1.2, 0.32, 1.65], [0.06, 1.2, 1.58, 1.65], [0.05, 1.12, 0.95, 1.65]]) { const b = P.box(w, h, 0.08, wf, 0.005); b.position.set(x, y, -1.06); scene.add(b); }
  // desk, lamp, papers, model, kese, books
  const desk = P.table(1.5, 0.7, 0.76, M.wood('dormdesk', '#a88660', '#7d6244', [1, 1], 0.5)); desk.position.set(0.3, 0, -0.7); scene.add(desk);
  const lamp = P.lamp('#c94f3a'); lamp.position.set(0.85, 0.76, -0.9); lamp.rotation.y = -0.4; scene.add(lamp);
  S.lampLight = new THREE.PointLight('#ffcf94', 2.4, 4, 1.4); S.lampLight.position.copy(lamp.localToWorld(lamp.userData.lightPos.clone())); S.lampLight.castShadow = true; S.lampLight.shadow.mapSize.set(1024, 1024); S.lampLight.shadow.bias = -0.002; scene.add(S.lampLight);
  lamp.userData.bulb.material.emissiveIntensity = 3;
  S.drawing = P.paperSheet(0.6, 0.42, T.blueprint('competition', 1024, 724, 1.2)); S.drawing.position.set(0.25, 0.762, -0.62); scene.add(S.drawing);
  for (let i = 0; i < 5; i++) { const sh = P.paperSheet(0.42, 0.3, T.blueprint('dorm' + i, 1024, 724, 0.5)); sh.position.set(-0.3 + i * 0.03, 0.761 + i * 0.001, -0.82); sh.rotation.z = (i - 2) * 0.12; scene.add(sh); }
  S.model = P.archModel('dormmodel', 0.9, 1.0); S.model.position.set(-0.28, 0.76, -0.75); scene.add(S.model);
  const books = new THREE.Group(); books.position.set(0.8, 0.76, -0.55); scene.add(books);
  ['#5a3f6a', '#2f4a5f', '#c9b48a'].forEach((c, i) => { const b = P.box(0.22, 0.035, 0.3, M.matte(c, 0.7), 0.004); b.position.y = 0.018 + i * 0.036; b.rotation.y = i * 0.15; books.add(b); });
  S.pencils = [];
  for (let i = 0; i < 3; i++) { const pc = P.pencil(['#e2b23c', '#2e2e2e', '#3c6fb0'][i]); pc.position.set(-0.05 + i * 0.12, 0.764, -0.45); pc.rotation.y = 0.3 * i; scene.add(pc); S.pencils.push(pc); }
  S.kese = P.kese('#efe9de', '#b33a2e'); S.kese.group.position.set(0.55, 0.766, -0.5); scene.add(S.kese.group);
  S.chairA = P.chair(M.wood('dchair2', '#5c4a3a', '#3e3126')); S.chairA.position.set(0.0, 0, -0.1); scene.add(S.chairA);
  S.chairB = P.chair(M.wood('dchair2', '#5c4a3a', '#3e3126')); S.chairB.position.set(0.7, 0, -0.1); scene.add(S.chairB);
  // bunk bed hint and pinned posters
  const bed = P.box(0.9, 0.5, 2.0, M.cloth('#4c5a6e', 'weave', 0.9, [4, 6]), 0.04); bed.position.set(-1.1, 0.35, 0.6); scene.add(bed);
  for (let i = 0; i < 3; i++) { const po = P.paperSheet(0.4, 0.3, T.blueprint('poster' + i, 1024, 724, 0.8)); po.rotation.set(0, 0, 0); po.position.set(-0.9 + i * 0.45, 1.7 + (i % 2) * 0.15, -1.095); scene.add(po); }
  shadow(scene); fl.castShadow = false; back.castShadow = false; left.castShadow = false;
  scene.add(new THREE.HemisphereLight('#3a4f78', '#2a2018', 0.25));
  const moon = new THREE.DirectionalLight('#6f88c0', 0.35); moon.position.set(1, 3, -4); scene.add(moon);
  return S;
}

// ------------------------------------------------------------------ hall
function banner(text, sub) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#1f2a33'; g.fillRect(0, 0, 2048, 512);
  g.fillStyle = '#d8b46a'; g.fillRect(80, 380, 1888, 6);
  g.fillStyle = '#f3efe6'; g.font = '700 150px NotoSansKZ'; g.textAlign = 'center'; g.fillText(text, 1024, 250);
  g.font = '400 70px NotoSansKZ'; g.fillStyle = '#c9c2b3'; g.fillText(sub, 1024, 470);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function label(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f7f5f0'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#2b2b2b'; g.font = '600 64px NotoSansKZ'; g.textAlign = 'center'; g.fillText(text, 256, 120);
  g.font = '400 36px NotoSansKZ'; g.fillStyle = '#6b6b6b'; g.fillText('байқау жобасы', 256, 190);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildHall(env) {
  const scene = new THREE.Scene(); scene.environment = env; scene.environmentIntensity = 0.25;
  scene.background = new THREE.Color('#1c1e22');
  const S = {scene};
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshPhysicalMaterial({color: '#8f8b84', roughness: 0.32, clearcoat: 0.4, map: T.plaster('concrete', '#a7a39b', 10, [6, 6])}));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wM = M.plaster('#e9e6e0', 'hallwall', [6, 2]);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 7), wM); back.position.set(0, 3.5, -4); back.receiveShadow = true; scene.add(back); S.backWall = back;
  const ban = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshStandardMaterial({map: banner('СӘУЛЕТ БАЙҚАУЫ', 'жас сәулетшілер · 2016'), roughness: 0.8}));
  ban.position.set(0, 3.6, -3.98); scene.add(ban); S.banner = ban;
  // two models on plinths
  S.plinthA = P.plinth(0.7, 1.0, 0.6); S.plinthA.position.set(-0.75, 0.5, -1.2); scene.add(S.plinthA);
  S.plinthB = P.plinth(0.7, 1.0, 0.6); S.plinthB.position.set(0.75, 0.5, -1.2); scene.add(S.plinthB);
  S.modelArman = P.archModel('arman-entry', 1.25, 1.0); S.modelArman.position.set(-0.75, 1.0, -1.2); scene.add(S.modelArman);
  S.modelAyan = P.archModel('ayan-entry', 1.25, 1.0); S.modelAyan.position.set(0.75, 1.0, -1.2); scene.add(S.modelAyan);
  for (const [x, txt] of [[-0.75, 'Арман'], [0.75, 'Аян']]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), new THREE.MeshStandardMaterial({map: label(txt), roughness: 0.6})); l.position.set(x, 0.86, -0.895); scene.add(l); }
  // winner rosette (placed by the juror)
  const ros = new THREE.Group();
  const gold = new THREE.MeshPhysicalMaterial({color: '#d7a63e', roughness: 0.3, metalness: 0.8, clearcoat: 0.5});
  ros.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.006, 32), gold));
  for (let i = 0; i < 12; i++) { const pet = P.box(0.02, 0.004, 0.012, M.matte('#b9302a', 0.6), 0.002); pet.position.set(Math.cos(i / 12 * 6.28) * 0.04, -0.001, Math.sin(i / 12 * 6.28) * 0.04); pet.rotation.y = -i / 12 * 6.28; ros.add(pet); }
  S.rosette = ros; scene.add(ros);
  // award stage
  const stage = P.box(6, 0.4, 3, M.wood('stage', '#4a3626', '#2e2016', [4, 2]), 0.02); stage.position.set(0, 0.2, -7.5); scene.add(stage);
  const podium = P.box(0.7, 1.1, 0.5, M.matte('#2a2d33', 0.5), 0.02); podium.position.set(1.2, 0.95, -7.2); scene.add(podium);
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshPhysicalMaterial({color: '#3b1b22', roughness: 0.9, sheen: 0.8, sheenColor: new THREE.Color('#a04050'), normalMap: T.weaveNormal(40, [10, 4])}));
  curtain.position.set(0, 2.9, -9); scene.add(curtain);
  S.trophy = P.trophy(); scene.add(S.trophy);
  // audience silhouettes (stage scenes)
  const sil = new THREE.MeshStandardMaterial({color: '#141518', roughness: 0.9});
  S.audience = new THREE.Group(); scene.add(S.audience);
  const rr = rng('aud');
  for (let i = 0; i < 18; i++) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.4, 4, 8), sil); b.position.y = 0.75; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), sil); h.position.y = 1.25; g.add(h); g.position.set(-3 + (i % 6) * 1.2 + rr() * 0.2, 0, -3.2 + Math.floor(i / 6) * 1.1); S.audience.add(g); }
  shadow(scene); floor.castShadow = false; back.castShadow = false;
  // gallery spots
  S.spotA = new THREE.SpotLight('#fff2dc', 18, 9, 0.5, 0.6, 1.2); S.spotA.position.set(-1, 4, 0.8); S.spotA.target.position.set(-0.4, 1.1, -1.2); S.spotA.castShadow = true; S.spotA.shadow.mapSize.set(2048, 2048); S.spotA.shadow.bias = -0.0005; scene.add(S.spotA, S.spotA.target);
  S.spotB = new THREE.SpotLight('#ffe9cc', 9, 9, 0.6, 0.6, 1.2); S.spotB.position.set(1.6, 4, 1.2); S.spotB.target.position.set(0.6, 1.0, -1.0); scene.add(S.spotB, S.spotB.target);
  S.stageSpot = new THREE.SpotLight('#fff3e0', 0, 12, 0.32, 0.5, 1.2); S.stageSpot.position.set(0.5, 6, -4.5); S.stageSpot.target.position.set(0.3, 1.2, -7.2); S.stageSpot.castShadow = true; S.stageSpot.shadow.mapSize.set(1024, 1024); scene.add(S.stageSpot, S.stageSpot.target);
  S.hemi = new THREE.HemisphereLight('#c7c9cf', '#3a3632', 0.35); scene.add(S.hemi);
  return S;
}
