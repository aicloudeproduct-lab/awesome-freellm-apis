// Arman's home (ground-floor room with the big window) and the street with
// Ayan's house directly opposite. One world: the final two-windows shot and the
// door scene use the same buildings.
import * as THREE from 'three';
import * as M from '../engine/materials.js';
import * as T from '../engine/textures.js';
import * as P from './props.js';
import {lerp, rng, shadow, clamp} from '../lib/util.js';

export const ROOM = {x0: -3.2, x1: 2.4, z0: -2.4, z1: 2.6, h: 2.7};
export const WIN = {x0: 0.1, x1: 1.9, y0: 0.85, y1: 2.35, z: -2.4};
export const DESK = {x: 1.0, z: -2.0, h: 0.76};
export const DINING = {x: -1.7, z: 0.4, h: 0.75};
export const AYAN_HOUSE_Z = -20; // house origin; facade at z = -16
export const AYAN_DOOR = {x: 1.0, w: 1.0, h: 2.15};

function skyDome() {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {top: {value: new THREE.Color('#0b1424')}, mid: {value: new THREE.Color('#1c2b44')}, low: {value: new THREE.Color('#2a3550')}, stars: {value: 0}},
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform float stars; varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ float y = vP.y; vec3 c = y > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, y)) : mix(low, mid, smoothstep(-0.05, 0.15, y));
        vec3 q = floor(vP * 380.0); float s = step(0.9985, h(q)) * stars * smoothstep(0.1, 0.4, y);
        gl_FragColor = vec4(c + s, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  mat.toneMapped = false;
  return new THREE.Mesh(geo, mat);
}

export function buildApartment(env) {
  const scene = new THREE.Scene();
  scene.environment = env;
  const sky = skyDome(); scene.add(sky);
  scene.fog = new THREE.Fog('#1c2b44', 40, 160);
  const S = {scene, sky};

  // ---- ground, street
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({color: '#4d5a3c', roughness: 0.95, map: T.dirt('lawn', [40, 40])}));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(200, 7), new THREE.MeshStandardMaterial({map: T.asphalt([60, 2]), roughness: 0.85}));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.0, -9.4); road.receiveShadow = true; scene.add(road);
  const walkMat = M.plaster('#a9a39a', 'walk', [40, 1]);
  for (const z of [-4.6, -14.2]) { const w = P.box(200, 0.12, 1.8, walkMat, 0); w.position.set(0, 0.06, z); w.receiveShadow = true; scene.add(w); }
  const lineMat = M.matte('#d9d4c8', 0.7);
  for (let x = -60; x < 60; x += 4) { const l = P.box(1.8, 0.005, 0.12, lineMat, 0); l.position.set(x, 0.005, -9.4); scene.add(l); }
  // snow cover (winter)
  const snow = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({color: '#e9eef3', roughness: 0.75}));
  snow.rotation.x = -Math.PI / 2; snow.position.y = 0.03; snow.receiveShadow = true; snow.visible = false; scene.add(snow);
  S.snow = snow;

  // ---- Arman's house (facade faces -Z). house() faces +Z, so rotate by π.
  const armanHouse = P.house({w: 9, d: 8, wall: '#ded5c7', roof: '#4e3f39', seed: 'armanhouse',
    windows: [{x: -1.0, y: 0.85, w: 1.8, h: 1.5, glow: '#ffcf8a'}, {x: 2.6, y: 0.95, w: 1.2, h: 1.3}, {x: -1.0, y: 3.8, w: 1.4, h: 1.3}, {x: 2.6, y: 3.8, w: 1.2, h: 1.3}],
    door: {x: -3.3, w: 1.0, h: 2.15}});
  armanHouse.rotation.y = Math.PI; armanHouse.position.set(0, 0, -2.4 + 4 - 0.25);
  scene.add(armanHouse);
  // the room window frame glow is replaced by the real interior; hide that glow plane
  armanHouse.userData.glows[0].glow.visible = false; armanHouse.userData.glows[0].curt.visible = false;
  S.armanHouse = armanHouse;

  // ---- Ayan's house opposite (faces +Z)
  const ayanHouse = P.house({w: 9.5, d: 8, wall: '#e6dccb', roof: '#5a463c', seed: 'ayanhouse',
    windows: [{x: -2.6, y: 0.95, w: 1.4, h: 1.4}, {x: 1.0 + 2.4, y: 0.95, w: 1.4, h: 1.4}, {x: -1.0, y: 3.85, w: 1.6, h: 1.35}, {x: 2.4, y: 3.85, w: 1.4, h: 1.35}],
    door: AYAN_DOOR});
  ayanHouse.position.set(0, 0, AYAN_HOUSE_Z);
  scene.add(ayanHouse);
  S.ayanHouse = ayanHouse;
  const ayanCar = P.car('#8a96a0'); ayanCar.position.set(-5.4, 0, -13.2); ayanCar.rotation.y = 0.08; scene.add(ayanCar);
  // neighbours further along the street
  const r = rng('street');
  for (const [x, z, ry, wall] of [[-15, -20, 0, '#d4c9b8'], [-15, 1.6, Math.PI, '#d9cfbf'], [-30, -20, 0, '#cfc4b2'], [-30, 1.6, Math.PI, '#d6ccbd'], [42, -21, 0, '#dcd2c3'], [42, 2.6, Math.PI, '#e1d8c9']]) {
    const h = P.house({w: 8.5, d: 8, wall, roof: '#4d4039', seed: 'n' + x + z, windows: [{x: -2.2, y: 0.95, w: 1.3, h: 1.3}, {x: 2.2, y: 0.95, w: 1.3, h: 1.3}, {x: -2.2, y: 3.8, w: 1.3, h: 1.3}, {x: 2.2, y: 3.8, w: 1.3, h: 1.3}]});
    h.position.set(x, 0, z); h.rotation.y = ry; scene.add(h);
    (S.neighbours ||= []).push(h);
  }
  // trees, lamps, fences
  S.trees = [];
  for (const [x, z, h] of [[-6.5, -3.6, 6], [5.8, -3.8, 5.5], [-7.5, -15.2, 6.5], [7, -15.4, 6], [-20, -15, 7], [-21, -3.5, 6.5]]) {
    const t = P.tree('tree' + x, h); t.position.set(x, 0, z); scene.add(t); S.trees.push(t);
  }
  S.lamps = [];
  for (const [x, z, ry] of [[-3.5, -5.6, Math.PI / 2], [6.5, -13.2, -Math.PI / 2]]) {
    const l = P.streetLamp(4.4); l.position.set(x, 0, z); l.rotation.y = ry; scene.add(l);
    const pl = new THREE.PointLight('#ffcf94', 0, 14, 1.6); pl.position.copy(l.localToWorld(l.userData.lightPos.clone())); scene.add(pl);
    S.lamps.push({mesh: l, light: pl});
  }
  const fenceMat = M.wood('fence', '#7b6450', '#5a4636', [1, 1]);
  for (const zf of [-5.7, -13.4]) for (let x = -12; x <= 12; x += 0.35) { if (Math.abs(x - 1.0) < 1.0 && zf < -10) continue; if (Math.abs(x + 3.3) < 0.9 && zf > -10) continue; const p = P.box(0.07, 0.9, 0.04, fenceMat, 0.005); p.position.set(x, 0.45, zf); p.castShadow = true; scene.add(p); }

  // ---- interior room
  const room = new THREE.Group(); scene.add(room); S.room = room;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0), M.wood('parquet', '#8b6744', '#5c412a', [6, 6], 0.55));
  floor.rotation.x = -Math.PI / 2; floor.position.set((ROOM.x0 + ROOM.x1) / 2, 0.001, (ROOM.z0 + ROOM.z1) / 2); floor.receiveShadow = true; room.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0), M.plaster('#ece6dc', 'ceil', [3, 3]));
  ceil.rotation.x = Math.PI / 2; ceil.position.set((ROOM.x0 + ROOM.x1) / 2, ROOM.h, (ROOM.z0 + ROOM.z1) / 2); room.add(ceil);
  const wallMat = M.plaster('#d9cbb6', 'iwall', [3, 2]);
  // back wall (inner face) with the window opening
  const sh = new THREE.Shape(); sh.moveTo(ROOM.x0, 0); sh.lineTo(ROOM.x1, 0); sh.lineTo(ROOM.x1, ROOM.h); sh.lineTo(ROOM.x0, ROOM.h); sh.lineTo(ROOM.x0, 0);
  const hole = new THREE.Path(); hole.moveTo(WIN.x0, WIN.y0); hole.lineTo(WIN.x0, WIN.y1); hole.lineTo(WIN.x1, WIN.y1); hole.lineTo(WIN.x1, WIN.y0); hole.lineTo(WIN.x0, WIN.y0); sh.holes.push(hole);
  const back = new THREE.Mesh(new THREE.ShapeGeometry(sh), wallMat); back.position.z = ROOM.z0 + 0.002; back.receiveShadow = true; room.add(back);
  const wall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM.h), wallMat); m.position.set(x, ROOM.h / 2, z); m.rotation.y = ry; m.receiveShadow = true; room.add(m); return m; };
  S.wallLeft = wall(ROOM.z1 - ROOM.z0, ROOM.x0, (ROOM.z0 + ROOM.z1) / 2, Math.PI / 2);
  S.wallRight = wall(ROOM.z1 - ROOM.z0, ROOM.x1, (ROOM.z0 + ROOM.z1) / 2, -Math.PI / 2);
  S.wallFront = wall(ROOM.x1 - ROOM.x0, (ROOM.x0 + ROOM.x1) / 2, ROOM.z1, Math.PI);
  // window reveal + frame (interior side)
  const trim = M.matte('#f2ede4', 0.55);
  const rev = (w, h, d, x, y, z) => { const m = P.box(w, h, d, trim, 0.005); m.position.set(x, y, z); room.add(m); return m; };
  rev(WIN.x1 - WIN.x0 + 0.1, 0.05, 0.3, (WIN.x0 + WIN.x1) / 2, WIN.y0 - 0.02, WIN.z - 0.1); // sill
  rev(WIN.x1 - WIN.x0 + 0.24, 0.035, 0.36, (WIN.x0 + WIN.x1) / 2, WIN.y0 - 0.05, WIN.z + 0.06);
  rev(0.06, WIN.y1 - WIN.y0, 0.28, WIN.x0 - 0.03, (WIN.y0 + WIN.y1) / 2, WIN.z - 0.12);
  rev(0.06, WIN.y1 - WIN.y0, 0.28, WIN.x1 + 0.03, (WIN.y0 + WIN.y1) / 2, WIN.z - 0.12);
  rev(WIN.x1 - WIN.x0 + 0.12, 0.06, 0.28, (WIN.x0 + WIN.x1) / 2, WIN.y1 + 0.03, WIN.z - 0.12);
  S.mullion = rev(0.05, WIN.y1 - WIN.y0, 0.07, (WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, WIN.z - 0.15);
  rev(WIN.x1 - WIN.x0, 0.045, 0.07, (WIN.x0 + WIN.x1) / 2, WIN.y0 + 1.05, WIN.z - 0.15);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), M.glass('#c6d6de', 0.08));
  pane.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, WIN.z - 0.17); room.add(pane);
  // curtains on a rod
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.8, 12), M.metal('#6b6258', 0.4)); rod.rotation.z = Math.PI / 2; rod.position.set(1.0, 2.5, WIN.z + 0.12); room.add(rod);
  S.curtainL = new P.Curtain(2.4, '#c7b292', 'cl'); S.curtainL.group.position.set(0, 1.29, WIN.z + 0.13); room.add(S.curtainL.group);
  S.curtainR = new P.Curtain(2.4, '#c7b292', 'cr'); S.curtainR.group.position.set(0, 1.29, WIN.z + 0.15); room.add(S.curtainR.group);
  S.curtainL.set(-0.35, 0.3, 0, 0); S.curtainR.set(1.7, 2.3, 0, 0);

  // desk + work things
  const deskMat = M.wood('desk', '#9a7552', '#6e4f33', [1, 1], 0.5);
  const desk = P.table(1.5, 0.7, DESK.h, deskMat); desk.position.set(DESK.x, 0, DESK.z); room.add(desk);
  const chairA = P.chair(M.wood('chair', '#5a4130', '#3e2c20')); chairA.position.set(DESK.x, 0, DESK.z + 0.78); chairA.rotation.y = Math.PI; room.add(chairA); S.deskChair = chairA;
  const lampD = P.lamp('#3d4a4f'); lampD.position.set(DESK.x + 0.58, DESK.h, DESK.z - 0.18); lampD.rotation.y = -0.5; room.add(lampD); S.deskLamp = lampD;
  S.deskLight = new THREE.PointLight('#ffd6a0', 0, 3.5, 1.5); S.deskLight.position.copy(lampD.localToWorld(lampD.userData.lightPos.clone())); room.add(S.deskLight);
  const sheets = [];
  for (let i = 0; i < 6; i++) {
    const sht = P.paperSheet(0.42, 0.3, T.blueprint('arman' + i, 1024, 724, 0.6 + i * 0.1));
    sht.position.set(DESK.x - 0.25 + (i % 3) * 0.05, DESK.h + 0.001 + i * 0.0012, DESK.z + 0.02 - (i % 2) * 0.04); sht.rotation.z = (i - 2.5) * 0.06;
    room.add(sht); sheets.push(sht);
  }
  S.sheets = sheets;
  // unfinished architectural model
  S.armanModel = P.archModel('armanmodel', 1.0, 0.6); S.armanModel.position.set(DESK.x + 0.22, DESK.h, DESK.z - 0.12); room.add(S.armanModel);
  for (let i = 0; i < 4; i++) { const pc = P.pencil(['#e2b23c', '#3c6fb0', '#2e2e2e', '#c4503c'][i]); pc.position.set(DESK.x - 0.55 + i * 0.03, DESK.h + 0.004, DESK.z + 0.18 + i * 0.02); pc.rotation.y = 0.4 + i * 0.3; room.add(pc); }
  const ruler = P.box(0.3, 0.003, 0.035, M.matte('#d9d4c4', 0.4), 0.001); ruler.position.set(DESK.x + 0.05, DESK.h + 0.004, DESK.z + 0.22); ruler.rotation.y = 0.2; room.add(ruler);
  // paper pile (grows during the envy montage)
  S.pile = new THREE.Group(); S.pile.position.set(DESK.x - 0.5, DESK.h, DESK.z - 0.15); room.add(S.pile);
  for (let i = 0; i < 40; i++) { const sht = P.paperSheet(0.3, 0.21, T.plainPaper(i % 3 ? '#f3efe6' : '#ece6d8')); sht.position.set((r() - 0.5) * 0.04, 0.0015 * i, (r() - 0.5) * 0.04); sht.rotation.z = (r() - 0.5) * 0.3; sht.visible = false; S.pile.add(sht); }

  // dining area: dastarkhan table, kese, teapot, baursaks
  const dtab = P.table(1.3, 0.85, DINING.h, M.wood('dtab', '#7a5638', '#55391f', [1, 1], 0.5)); dtab.position.set(DINING.x, 0, DINING.z); room.add(dtab);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshPhysicalMaterial({color: '#e9dcc3', roughness: 0.9, sheen: 0.5, normalMap: T.weaveNormal(80, [6, 6])}));
  cloth.rotation.x = -Math.PI / 2; cloth.position.set(DINING.x, DINING.h + 0.002, DINING.z); cloth.receiveShadow = true; room.add(cloth);
  S.teapot = P.teapot('#f1ece2'); S.teapot.position.set(DINING.x + 0.2, DINING.h, DINING.z - 0.12); S.teapot.rotation.y = -0.6; room.add(S.teapot);
  S.keseArman = P.kese(); S.keseArman.group.position.set(DINING.x - 0.05, DINING.h + 0.006, DINING.z + 0.28); room.add(S.keseArman.group);
  S.keseWife = P.kese(); S.keseWife.group.position.set(DINING.x + 0.05, DINING.h + 0.006, DINING.z - 0.27); room.add(S.keseWife.group);
  S.keseDesk = P.kese(); S.keseDesk.group.position.set(DESK.x - 0.6, DESK.h + 0.006, DESK.z + 0.24); room.add(S.keseDesk.group); S.keseDesk.group.visible = false;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.015, 32), M.ceramic('#f4efe5')); plate.position.set(DINING.x - 0.25, DINING.h + 0.008, DINING.z - 0.05); room.add(plate);
  const baur = M.matte('#c58a45', 0.55);
  for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), baur); b.scale.set(1.1, 0.75, 1); b.position.set(DINING.x - 0.25 + (r() - 0.5) * 0.12, DINING.h + 0.03 + (i > 5 ? 0.02 : 0), DINING.z - 0.05 + (r() - 0.5) * 0.12); b.castShadow = true; room.add(b); }
  const chairMat = M.wood('dchair', '#5f4532', '#412e21');
  S.chairArman = P.chair(chairMat); S.chairArman.position.set(DINING.x, 0, DINING.z + 0.68); S.chairArman.rotation.y = Math.PI; room.add(S.chairArman);
  S.chairWife = P.chair(chairMat); S.chairWife.position.set(DINING.x, 0, DINING.z - 0.68); room.add(S.chairWife);
  S.chairSon = P.chair(chairMat); S.chairSon.position.set(DINING.x - 0.9, 0, DINING.z); S.chairSon.rotation.y = Math.PI / 2; room.add(S.chairSon);
  // pendant lamp
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.2, 40, 1, true), new THREE.MeshStandardMaterial({color: '#e8d8bc', roughness: 0.6, side: THREE.DoubleSide, emissive: '#ffcf8a', emissiveIntensity: 0}));
  shade.position.set(DINING.x, 1.95, DINING.z); room.add(shade); S.pendantShade = shade;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.65, 6), M.matte('#2a2a2a')); cord.position.set(DINING.x, 2.38, DINING.z); room.add(cord);
  S.pendant = new THREE.PointLight('#ffc98a', 0, 7, 1.4); S.pendant.position.set(DINING.x, 1.86, DINING.z); room.add(S.pendant);
  // TV on the left wall
  const tvFrame = P.box(0.06, 0.62, 1.05, M.matte('#151618', 0.35), 0.01); tvFrame.position.set(ROOM.x0 + 0.04, 1.45, -1.1); room.add(tvFrame);
  S.tvCanvas = document.createElement('canvas'); S.tvCanvas.width = 1024; S.tvCanvas.height = 576;
  S.tvTex = new THREE.CanvasTexture(S.tvCanvas); S.tvTex.colorSpace = THREE.SRGBColorSpace;
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.55), new THREE.MeshStandardMaterial({color: '#000', emissive: '#ffffff', emissiveMap: S.tvTex, emissiveIntensity: 0, roughness: 0.2}));
  tvScreen.position.set(ROOM.x0 + 0.075, 1.45, -1.1); tvScreen.rotation.y = Math.PI / 2; room.add(tvScreen); S.tvScreen = tvScreen;
  S.tvLight = new THREE.PointLight('#9ec0ff', 0, 4, 1.6); S.tvLight.position.set(ROOM.x0 + 0.5, 1.45, -1.1); room.add(S.tvLight);
  // bookshelf, plant, rug, hall door
  const shelfMat = M.wood('shelf', '#6a4e36', '#4a3423');
  const shelf = new THREE.Group(); shelf.position.set(ROOM.x1 - 0.18, 0, -0.4); room.add(shelf);
  for (let k = 0; k < 5; k++) { const b = P.box(0.32, 0.025, 1.2, shelfMat, 0.003); b.position.set(0, 0.05 + k * 0.42, 0); shelf.add(b); }
  for (const sz of [-0.6, 0.6]) { const s2 = P.box(0.32, 1.8, 0.025, shelfMat, 0.003); s2.position.set(0, 0.9, sz); shelf.add(s2); }
  const bookCols = ['#7a3b2e', '#2f4a5f', '#c9b48a', '#4e5d3a', '#8a6a4a', '#3b3b45', '#a4553c'];
  for (let k = 0; k < 4; k++) { let z = -0.55; while (z < 0.5) { const w = 0.03 + r() * 0.035, h = 0.24 + r() * 0.1; const bk = P.box(0.22, h, w, M.matte(bookCols[Math.floor(r() * bookCols.length)], 0.7), 0.003); bk.position.set(0, 0.065 + k * 0.42 + h / 2, z + w / 2); shelf.add(bk); z += w + 0.004; } }
  shadow(shelf);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.3, 24), M.ceramic('#b9a48a')); pot.position.set(ROOM.x1 - 0.35, 0.15, 1.6); room.add(pot);
  for (let i = 0; i < 14; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), M.matte('#4a6b3a', 0.8)); lf.scale.set(0.35, 1.2, 0.12); lf.position.set(ROOM.x1 - 0.35 + (r() - 0.5) * 0.25, 0.55 + r() * 0.45, 1.6 + (r() - 0.5) * 0.25); lf.rotation.set((r() - 0.5) * 1.2, r() * 6, (r() - 0.5) * 1.2); lf.castShadow = true; room.add(lf); }
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.5), new THREE.MeshStandardMaterial({color: '#8c3f32', roughness: 0.95, normalMap: T.weaveNormal(120, [10, 8])}));
  rug.rotation.x = -Math.PI / 2; rug.position.set(DINING.x, 0.004, DINING.z); rug.receiveShadow = true; room.add(rug);
  const doorG = new THREE.Group(); doorG.position.set(ROOM.x0 + 0.02, 0, 1.55); room.add(doorG);
  const leaf = P.box(0.05, 2.05, 0.9, M.wood('idoor', '#a07e5a', '#7c5d40'), 0.008); leaf.position.set(0, 1.025, 0.45); doorG.add(leaf); S.hallDoor = doorG;
  S.hallLight = new THREE.PointLight('#ffd8a8', 0, 5, 1.5); S.hallLight.position.set(ROOM.x0 - 0.6, 2.0, 2.0); scene.add(S.hallLight);
  shadow(room);
  floor.castShadow = false; ceil.castShadow = false;
  [S.wallLeft, S.wallRight, S.wallFront, back].forEach((w) => { w.castShadow = false; });

  // ---- lights
  const hemi = new THREE.HemisphereLight('#9fb6d6', '#3a3028', 0.2); scene.add(hemi); S.hemi = hemi;
  const sun = new THREE.DirectionalLight('#ffe0b5', 0); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, {left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 60});
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  sun.position.set(3, 9, -16); sun.target.position.set(0.5, 0, -1); scene.add(sun, sun.target); S.sun = sun;
  S.phoneLight = new THREE.PointLight('#cfe0ff', 0, 1.2, 2); scene.add(S.phoneLight);
  // snowflakes (winter)
  const sg = new THREE.BufferGeometry(); const sp = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) { sp[i * 3] = -4 + r() * 10; sp[i * 3 + 1] = r() * 6; sp[i * 3 + 2] = -14 + r() * 11; }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  S.flakes = new THREE.Points(sg, new THREE.PointsMaterial({color: '#ffffff', size: 0.035, transparent: true, opacity: 0.9, depthWrite: false})); S.flakes.visible = false; scene.add(S.flakes);
  S.flakeBase = Float32Array.from(sp);
  return S;
}

/** Lighting / season presets. mode: night | day | evening | dusk; season: spring|summer|autumn|winter */
export function lightApartment(S, {mode = 'night', season = 'summer', t = 0, pendant = null, desk = null, phone = 0, phonePos = null, tv = 0, hall = 0, ayanWindows = 1, armanWindow = 1, warmth = 1} = {}) {
  const sky = S.sky.material.uniforms;
  const set = (o, c) => o.value.set(c);
  const leaf = P.SEASON_LEAF[season];
  for (const tr of S.trees) for (const l of tr.userData.leaves) { l.visible = !!leaf; if (leaf) l.material.color.set(leaf); }
  S.snow.visible = season === 'winter';
  S.flakes.visible = season === 'winter' && mode !== 'night';
  if (S.flakes.visible) {
    const p = S.flakes.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { p.setY(i, ((S.flakeBase[i * 3 + 1] - t * 0.6) % 6 + 6) % 6); p.setX(i, S.flakeBase[i * 3] + Math.sin(t * 0.7 + i) * 0.15); }
    p.needsUpdate = true;
  }
  let sunI = 0, sunC = '#ffe0b5', hemiI = 0.2, fogC = '#1c2b44';
  if (mode === 'night') { set(sky.top, '#050a14'); set(sky.mid, '#0d1a2e'); set(sky.low, '#1b2a44'); sky.stars.value = 1; sunI = 0.5; sunC = '#7d97c9'; hemiI = 0.08; fogC = '#0d1a2e'; S.sun.position.set(-6, 14, -18); }
  else if (mode === 'day') { set(sky.top, season === 'winter' ? '#9aa6b2' : season === 'autumn' ? '#8fa4b8' : '#4f86c6'); set(sky.mid, season === 'winter' ? '#c4cbd2' : '#a9c6e2'); set(sky.low, '#dfe6ea'); sky.stars.value = 0; sunI = season === 'winter' ? 1.2 : 3.2; sunC = season === 'autumn' ? '#ffd29a' : season === 'winter' ? '#e6ecf5' : '#fff0d6'; hemiI = 0.55; fogC = '#c8d4de'; S.sun.position.set(4, 10, -14); }
  else if (mode === 'evening') { set(sky.top, '#101c33'); set(sky.mid, '#2c3a5c'); set(sky.low, '#5a5068'); sky.stars.value = 0.3; sunI = 0.25; sunC = '#8aa0d0'; hemiI = 0.1; fogC = '#2c3a5c'; S.sun.position.set(-6, 12, -18); }
  else if (mode === 'dusk') { set(sky.top, '#1b2848'); set(sky.mid, '#5a5a80'); set(sky.low, '#e0956a'); sky.stars.value = 0.15; sunI = 0.3; sunC = '#ffb27a'; hemiI = 0.1; fogC = '#5a5a80'; S.sun.position.set(30, 6, -10); }
  S.sun.intensity = sunI; S.sun.color.set(sunC); S.hemi.intensity = hemiI;
  S.deskLamp.visible = true;
  S.scene.environmentIntensity = {night: 0.035, evening: 0.08, dusk: 0.12, day: 0.55}[mode] ?? 0.3;
  S.scene.fog.color.set(fogC);
  const night = mode === 'night' || mode === 'evening' || mode === 'dusk';
  // interior practicals
  const pend = pendant ?? (night ? 1 : 0);
  S.pendant.intensity = pend * 9 * warmth; S.pendantShade.material.emissiveIntensity = pend * 1.2;
  const dk = desk ?? 0;
  S.deskLight.intensity = dk * 5; S.deskLamp.userData.bulb.material.emissiveIntensity = dk * 3;
  S.hallLight.intensity = hall * 5;
  S.phoneLight.intensity = phone * 0.12;
  if (phonePos) S.phoneLight.position.copy(phonePos);
  S.tvLight.intensity = tv * (0.6 + 0.15 * Math.sin(t * 11) * Math.sin(t * 3.7));
  S.tvScreen.material.emissiveIntensity = tv * 1.1;
  // street lamps, Ayan's windows
  for (const l of S.lamps) { l.light.intensity = night ? 2.2 : 0; l.mesh.userData.bulb.material.emissiveIntensity = night ? 3 : 0; }
  for (const g of S.ayanHouse.userData.glows) { g.glow.material.emissiveIntensity = night ? 1.6 * ayanWindows : 0; g.curt.material.emissiveIntensity = night ? 0.9 * ayanWindows : 0; }
  const ad = S.ayanHouse.userData.door; if (ad) ad.porchLamp.material.emissiveIntensity = night ? 2.5 * ayanWindows : 0;
  for (const g of S.armanHouse.userData.glows.slice(1)) { g.glow.material.emissiveIntensity = night ? 1.2 * armanWindow : 0; g.curt.material.emissiveIntensity = night ? 0.6 * armanWindow : 0; }
  for (const h of S.neighbours) for (const g of h.userData.glows) { g.glow.material.emissiveIntensity = night ? 0.7 : 0; g.curt.material.emissiveIntensity = night ? 0.4 : 0; }
}

/** TV news graphic praising Ayan. */
export function drawTV(S, t, img) {
  const g = S.tvCanvas.getContext('2d'), W = 1024, H = 576;
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#16324f'); gr.addColorStop(1, '#0b1726');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (img) g.drawImage(img, 560, 60, 400, 400);
  g.fillStyle = '#c43b33'; g.fillRect(0, 430, W, 70);
  g.fillStyle = '#ffffff'; g.font = '700 38px NotoSansKZ'; g.fillText('ЖЫЛДЫҢ ҮЗДІК СӘУЛЕТШІСІ', 30, 478);
  g.fillStyle = '#e9edf2'; g.font = '600 46px NotoSansKZ'; g.fillText('Аян Нұрланұлы', 40, 200);
  g.font = '400 30px NotoSansKZ'; g.fillStyle = '#b8c6d6'; g.fillText('«Қала жүрегі» жобасының авторы', 40, 250);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 520, W, 56);
  g.fillStyle = '#ffffff'; g.font = '400 26px NotoSansKZ'; g.fillText('ЖАҢАЛЫҚТАР · 21:00', 30, 556);
  S.tvTex.needsUpdate = true;
}
