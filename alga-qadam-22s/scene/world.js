// Минималистік қара-ақ әлем: төбесіз тар бөлме (биік қабырғалар, жабық есік, бүйірдегі саңылау),
// биік үстірт, жартас жиегіндегі алаң, тұманды тау қатарлары және көкжиектен тараған жарық.
// Координаттар: y — жоғары; бөлме ішкі кеңістігі x∈[−2.5, 2.5], z∈[−8, 2]; жаңа әлем +x бағытында.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {stoneMaterial} from './materials.js';

export const ROOM = {x0: -2.5, x1: 2.5, z0: -8, z1: 5, h: 14, t: 0.6};
export const DOOR = {x: 0, z: -8, w: 1.6, h: 4.2};
export const GAP = {x: 2.5, z: -6.3, w: 1.1, h: 2.9};        // оң қабырғадағы ашық саңылау (есік жақтауымен бірдей пропорция: match cut)
export const LEDGE = {x: 11.0, z: -4.2, y: 0};                // жартас жиегіндегі алаң (кейіпкер тоқтайтын жер)

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function vnoise2(seed) {
  const r = rng(seed), P = new Float32Array(512); for (let i = 0; i < 512; i++) P[i] = r();
  const h = (x, y) => P[((x * 73856093) ^ (y * 19349663)) & 511];
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (h(xi, yi) * (1 - sx) + h(xi + 1, yi) * sx) * (1 - sy) + (h(xi, yi + 1) * (1 - sx) + h(xi + 1, yi + 1) * sx) * sy; };
}
const fbm2 = (n, x, y, o = 5) => { let a = 0.5, s = 0, f = 1; for (let i = 0; i < o; i++) { s += a * n(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };

/** Көлемді жарық шоғы (аддитивті конус): шеттері жұмсақ, бойымен сөнеді, ішінде баяу шаң. */
export function lightShaft({r0, r1, len, color = '#ffffff', intensity = 1}) {
  const geo = new THREE.CylinderGeometry(r0, r1, len, 64, 24, true); geo.translate(0, -len / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {uColor: {value: new THREE.Color(color)}, uInt: {value: intensity}, uTime: {value: 0}, uLen: {value: len}},
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vP;
      void main(){ vY = position.y; vP = position; vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uInt, uTime, uLen; varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
        float along = clamp(-vY/uLen, 0., 1.);
        float fade = smoothstep(0., 0.15, along) * (1. - smoothstep(0.85, 1., along));
        float dust = 0.7 + 0.4*n3(vP*1.6 + vec3(0., uTime*0.07, 0.));
        gl_FragColor = vec4(uColor * edge * fade * dust * uInt * 0.2, 1.);
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 10; m.frustumCulled = false;
  return m;
}
/** Шоқты from → to бағытына қою. */
export function aimShaft(m, from, to) { m.position.copy(from); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3().subVectors(to, from).normalize()); }

/** Нәзік шаң бөлшектері: детерминирленген, баяу қалқиды. */
export function dust(count, box, seed, size = 0.03, opacity = 0.5) {
  const r = rng(seed), pos = new Float32Array(count * 3), base = [];
  for (let i = 0; i < count; i++) base.push([box.min.x + r() * (box.max.x - box.min.x), box.min.y + r() * (box.max.y - box.min.y), box.min.z + r() * (box.max.z - box.min.z), r() * 6.28, 0.2 + r() * 0.6]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const mat = new THREE.PointsMaterial({color: '#f4f1ea', size, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity, sizeAttenuation: true});
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  pts.update = t => { for (let i = 0; i < count; i++) { const b = base[i]; pos[i * 3] = b[0] + Math.sin(t * 0.13 * b[4] + b[3]) * 0.25; pos[i * 3 + 1] = b[1] + Math.sin(t * 0.09 * b[4] + b[3] * 2) * 0.18 + t * 0.01 * b[4]; pos[i * 3 + 2] = b[2] + Math.cos(t * 0.11 * b[4] + b[3]) * 0.25; } geo.attributes.position.needsUpdate = true; };
  pts.update(0);
  return pts;
}

/** Жұмсақ градиент текстура (тұман жолақтары, еденге түскен жарық дағы үшін). */
function radialTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); stops.forEach(([o, a]) => gr.addColorStop(o, `rgba(255,255,255,${a})`)); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

const lerpZ = (x, x0, x1, z0, z1) => z0 + (z1 - z0) * Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));

export function buildWorld(scene) {
  const W = {};
  const SKY_H = new THREE.Color('#d9d6cf'), SKY_T = new THREE.Color('#0b0c0e');
  scene.background = SKY_T.clone();
  scene.fog = new THREE.FogExp2('#8e8d8a', 0.0);

  // ---- аспан: көкжиекте (+x) жұмсақ жарық, жоғары қарай қараңғы
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {uH: {value: SKY_H}, uT: {value: SKY_T}, uSun: {value: new THREE.Vector3(1, 0.06, -0.12).normalize()}, uGlow: {value: 1}},
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 uH, uT, uSun; uniform float uGlow; varying vec3 vD;
      void main(){ float e = clamp(vD.y, -0.2, 1.); float k = exp(-max(e, 0.)*5.5);
        vec3 c = mix(uT, uH*0.55, k);
        float s = max(dot(vD, uSun), 0.);
        c += uH * (pow(s, 6.)*0.55 + pow(s, 40.)*0.9) * uGlow * smoothstep(-0.15, 0.05, e);
        c = mix(c, uH*0.42, smoothstep(0.02, -0.2, e));
        gl_FragColor = vec4(c, 1.); }`,
  }));
  scene.add(sky); W.sky = sky;

  // ---- үстірт: бөлме тұрған биік жазық (жеңіл бедер), +x жағында жартас жиегі
  const stone = stoneMaterial({seed: 4, tiles: 3, base: '#77797d', grout: false, repeat: [9, 9], rough: 0.82});   // табиғи жартас: тақта жіктерінсіз
  const n = vnoise2(11);
  const ground = new THREE.PlaneGeometry(90, 90, 180, 180); ground.rotateX(-Math.PI / 2);
  const gp = ground.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i) - 25, z = gp.getZ(i); gp.setX(i, x);
    let y = (fbm2(n, x * 0.08, z * 0.08) - 0.5) * 0.5;
    const inRoom = x > -3.4 && x < 3.4 && z > -8.9 && z < 5.9; if (inRoom) y = 0;
    const nearPath = z > -7.8 && z < -2.6 && x > 2 && x < LEDGE.x + 1.5; if (nearPath) y *= 0.15;
    const edge = 11.9 + (fbm2(n, z * 0.12, 3.3) - 0.5) * 2.5;           // жиек сызығы
    if (x > edge) y -= (x - edge) * (x - edge) * 2.2 + (x - edge) * 6;     // жартас: тік құлама
    gp.setY(i, Math.max(y, -60));
  }
  ground.computeVertexNormals();
  const plateau = new THREE.Mesh(ground, stone); plateau.receiveShadow = true; plateau.castShadow = true; scene.add(plateau);
  // жиектегі алаң: тегіс тас тақта
  const ledge = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.5, 3.0, 3, 0.08), stoneMaterial({seed: 6, tiles: 2, base: '#8e9094', grout: true, rough: 0.7}));
  ledge.position.set(LEDGE.x + 0.4, -0.23, LEDGE.z); ledge.receiveShadow = ledge.castShadow = true; scene.add(ledge);
  // саңылаудан алаңға дейінгі жол: сирек тас тақталар
  const slabMat = stoneMaterial({seed: 8, tiles: 1, base: '#8a8c90', grout: false, rough: 0.72});
  const rs = rng(5);
  const nS = 9, step = (LEDGE.x - 1.4 - GAP.x - 0.9) / (nS - 1);
  for (let i = 0; i < nS; i++) {
    const s = new THREE.Mesh(new RoundedBoxGeometry(0.85 + rs() * 0.2, 0.08, 0.7 + rs() * 0.15, 2, 0.03), slabMat);
    const px = GAP.x + 0.9 + i * step, pz = px < 3.6 ? -6.2 : px < 5.5 ? lerpZ(px, 3.6, 5.5, -6.2, -5.6) : px < 7.6 ? lerpZ(px, 5.5, 7.6, -5.6, -4.8) : lerpZ(px, 7.6, LEDGE.x, -4.8, LEDGE.z);
    s.position.set(px, 0.02, pz + Math.sin(i * 0.9) * 0.06); s.rotation.y = (rs() - 0.5) * 0.25;
    s.receiveShadow = true; scene.add(s);
  }

  // ---- бөлме: үш тұтас қабырға + оң қабырғада саңылау + артқы қабырғада есік
  const wallMat = stoneMaterial({seed: 2, tiles: 3, base: '#3b3d41', repeat: [3, 4], rough: 0.85});
  const R = ROOM, wall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  const L = R.z1 - R.z0;
  wall(R.t, R.h, L + 2 * R.t, R.x0 - R.t / 2, R.h / 2, (R.z0 + R.z1) / 2);                         // сол
  wall(R.x1 - R.x0 + 2 * R.t, R.h, R.t, 0, R.h / 2, R.z1 + R.t / 2);                                // алдыңғы
  // артқы қабырға: есік ойығымен (үш бөлік)
  const bw = (R.x1 - R.x0 + 2 * R.t - DOOR.w) / 2;
  wall(bw, R.h, R.t, R.x0 - R.t + bw / 2, R.h / 2, R.z0 - R.t / 2);
  wall(bw, R.h, R.t, R.x1 + R.t - bw / 2, R.h / 2, R.z0 - R.t / 2);
  wall(DOOR.w, R.h - DOOR.h, R.t, DOOR.x, DOOR.h + (R.h - DOOR.h) / 2, R.z0 - R.t / 2);
  // оң қабырға: саңылаумен
  const zA = GAP.z + GAP.w / 2, zB = GAP.z - GAP.w / 2;
  wall(R.t, R.h, R.z1 + R.t - zA, R.x1 + R.t / 2, R.h / 2, (R.z1 + R.t + zA) / 2);
  wall(R.t, R.h, zB - (R.z0 - R.t), R.x1 + R.t / 2, R.h / 2, (zB + R.z0 - R.t) / 2);
  wall(R.t, R.h - GAP.h, GAP.w, R.x1 + R.t / 2, GAP.h + (R.h - GAP.h) / 2, GAP.z);
  // бөлме едені: үлкен тас тақталар
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, L), stoneMaterial({seed: 3, tiles: 4, base: '#45474b', repeat: [1.6, 3.2], rough: 0.62}));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.004, (R.z0 + R.z1) / 2); floor.receiveShadow = true; scene.add(floor);

  // есік: ауыр қара тақта, жақтау, есік артында жабық жарық камерасы (саңылаулардан жарық төгіледі)
  const doorMat = new THREE.MeshStandardMaterial({color: '#1d1e21', roughness: 0.55, metalness: 0.35});
  const door = new THREE.Group(); door.position.set(DOOR.x, 0, DOOR.z - 0.25); scene.add(door);
  const leaf = new THREE.Mesh(new RoundedBoxGeometry(DOOR.w - 0.05, DOOR.h - 0.04, 0.16, 3, 0.02), doorMat); leaf.position.y = DOOR.h / 2; leaf.castShadow = leaf.receiveShadow = true; door.add(leaf);
  for (const y of [0.7, 2.0]) { const band = new THREE.Mesh(new THREE.BoxGeometry(DOOR.w - 0.12, 0.05, 0.03), new THREE.MeshStandardMaterial({color: '#2c2d31', metalness: 0.6, roughness: 0.4})); band.position.set(0, y, 0.09); door.add(band); }
  W.door = door;
  const frameMat = stoneMaterial({seed: 7, tiles: 1, base: '#2c2e32', grout: false, rough: 0.7});
  for (const s of [-1, 1]) { const j = new THREE.Mesh(new THREE.BoxGeometry(0.16, DOOR.h + 0.2, 0.3), frameMat); j.position.set(DOOR.x + s * (DOOR.w / 2 + 0.06), (DOOR.h + 0.2) / 2, DOOR.z + 0.12); j.castShadow = true; scene.add(j); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(DOOR.w + 0.44, 0.22, 0.32), frameMat); lintel.position.set(DOOR.x, DOOR.h + 0.11, DOOR.z + 0.12); lintel.castShadow = true; scene.add(lintel);
  // есік артындағы жарық: жабық қорап + эмиссия; саңылау жолақтары (шеттер мен төменгі жік)
  const behind = new THREE.Mesh(new THREE.BoxGeometry(DOOR.w + 0.6, DOOR.h + 0.6, 1.2), new THREE.MeshBasicMaterial({color: '#ffffff', side: THREE.BackSide})); behind.position.set(DOOR.x, DOOR.h / 2, DOOR.z - R.t - 0.6); scene.add(behind);
  const slitMat = new THREE.MeshBasicMaterial({color: '#fffaf0', toneMapped: false});
  const slits = new THREE.Group(); scene.add(slits);
  const slit = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), slitMat); m.position.set(x, y, DOOR.z - 0.15); slits.add(m); };
  slit(0.018, DOOR.h - 0.05, DOOR.x + DOOR.w / 2 - 0.02, DOOR.h / 2);       // оң жік (кеңірек)
  slit(0.008, DOOR.h - 0.05, DOOR.x - DOOR.w / 2 + 0.02, DOOR.h / 2);
  slit(DOOR.w - 0.05, 0.012, DOOR.x, 0.012);                                  // табалдырық жігі
  W.slits = slits; W.slitMat = slitMat;
  // жіктерден еденге түскен жарық сызықтары (жұмсақ аддитивті жолақтар)
  const streakTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = h; g.fillRect(0, 0, 64, 256); return new THREE.CanvasTexture(c); })();
  const streaks = new THREE.Group(); scene.add(streaks);
  const streak = (w, len, x, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({map: streakTex, color: '#fff6e8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55}));
    m.rotation.set(-Math.PI / 2, 0, rot); m.geometry.translate(0, -len / 2, 0); m.position.set(x, 0.012, DOOR.z + 0.02); streaks.add(m); };
  streak(0.12, 3.6, DOOR.x + DOOR.w / 2 - 0.02, 0.06); streak(0.06, 2.8, DOOR.x - DOOR.w / 2 + 0.02, -0.05); streak(DOOR.w * 1.1, 1.1, DOOR.x, 0);
  W.streaks = streaks;
  W.doorSpill = new THREE.PointLight('#fff4e4', 0.6, 5, 2); W.doorSpill.position.set(DOOR.x + 0.3, 0.6, DOOR.z + 0.5); scene.add(W.doorSpill);
  W.doorShaft = lightShaft({r0: 0.03, r1: 0.5, len: 5.0, color: '#fff6e6', intensity: 0.8}); scene.add(W.doorShaft);
  aimShaft(W.doorShaft, new THREE.Vector3(DOOR.x + DOOR.w / 2 - 0.02, 2.2, DOOR.z - 0.1), new THREE.Vector3(DOOR.x + 1.05, 0.0, DOOR.z + 4.2));

  // ---- жарықтар
  W.hemi = new THREE.HemisphereLight('#d8d6d0', '#202124', 0.25); scene.add(W.hemi);
  // көкжиектегі күн (+x жақтан, аласа): ұзын көлеңкелер
  const sun = new THREE.DirectionalLight('#fff2e2', 2.2); sun.position.set(60, 28, -10); sun.target.position.set(0, 0, -4); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, {left: -26, right: 26, top: 22, bottom: -22, near: 10, far: 120}); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  W.sun = sun;
  // бөлмеге жоғарыдан түсетін қозғалмалы жарық шоғы (бағыт көрсетеді)
  const beam = new THREE.SpotLight('#fffaf2', 0, 60, 0.07, 0.6, 1.2); beam.position.set(0.6, 34, -6.0); beam.castShadow = true; beam.shadow.mapSize.set(2048, 2048); beam.shadow.bias = -0.0002; scene.add(beam, beam.target);
  W.beam = beam;
  W.beamShaft = lightShaft({r0: 0.2, r1: 1.05, len: 30, color: '#fffaf2', intensity: 0}); scene.add(W.beamShaft);
  // бөлмедегі жалпы күңгірт толтырушы жарық (қабырғалар мүлде жоғалып кетпеуі үшін)
  W.fill = new THREE.PointLight('#c9c8c4', 0.0, 14, 1.6); W.fill.position.set(0, 7, -2); scene.add(W.fill);

  // ---- тау қатарлары: алыстаған сайын ақшылданады (ауа перспективасы), аралығында тұман жолақтары
  const ranges = [];
  const layers = [[60, 18, 0.55, '#3b3d40', 21], [120, 34, 0.42, '#55575a', 22], [220, 60, 0.32, '#77787a', 23], [380, 95, 0.24, '#97979a', 24]];
  for (const [dist, hgt, rough, col, seed] of layers) {
    const nn = vnoise2(seed), g = new THREE.PlaneGeometry(dist * 3.2, dist * 0.9, 320, 60); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = p.getZ(i);
      const ridge = 1 - Math.abs(fbm2(nn, u * 0.012 * (120 / dist), 0.5, 5) * 2 - 1);
      const prof = Math.exp(-((v / (dist * 0.3)) ** 2));
      p.setY(i, (ridge * ridge * hgt * 1.6 + fbm2(nn, u * 0.05, v * 0.05, 3) * hgt * rough) * prof - hgt * 0.7);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color: col, roughness: 0.95, fog: true}));
    m.rotation.y = Math.PI / 2; m.position.set(dist * 0.9, -14, -4); scene.add(m); ranges.push(m);
  }
  W.ranges = ranges;
  // тұман: аласа, жұмсақ, тау арасында (кадрды толтырмайтын жұқа жолақтар)
  const mistTex = radialTex([[0, 0.55], [0.5, 0.22], [1, 0]]);
  const mists = [];
  for (const [x, y, z, sx, sz, op] of [[40, -8, -4, 140, 30, 0.35], [90, -6, 10, 220, 40, 0.3], [160, -2, -30, 300, 60, 0.28], [260, 4, 20, 420, 80, 0.26], [26, -4, -30, 90, 24, 0.22]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: mistTex, color: '#d4d2cc', transparent: true, depthWrite: false, opacity: op, fog: false}));
    m.rotation.x = -Math.PI / 2; m.scale.set(sx, sz, 1); m.position.set(x, y, z); m.renderOrder = 5; scene.add(m); mists.push(m);
  }
  W.mists = mists;

  // шаң: бөлмеде (жарық шоғында көрінеді) және сыртта (сирек)
  W.dustIn = dust(900, new THREE.Box3(new THREE.Vector3(R.x0, 0.1, R.z0), new THREE.Vector3(R.x1, 6, R.z1)), 3, 0.022, 0.55); scene.add(W.dustIn);
  W.dustOut = dust(500, new THREE.Box3(new THREE.Vector3(2, 0.2, -12), new THREE.Vector3(16, 6, 4)), 9, 0.035, 0.35); scene.add(W.dustOut);
  return W;
}
