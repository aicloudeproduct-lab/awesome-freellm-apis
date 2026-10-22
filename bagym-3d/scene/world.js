// Монументалды тас әлем: екі параллель жол, бағаналар, алыс қабырға, көлемді сәулелер, шаң.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {PAL, metalMaterial, stoneMaterial} from './materials.js';

export const PATH = {ax: -1.45, bx: 1.45, width: 1.7, z0: 14, z1: -70};

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Көлемді сәуле: конус ішіндегі тығыздық (жиекке қарай әлсірейді, биіктікке қарай сөнеді, нәзік шаң шуы). */
export function lightShaft({from, to, r0, r1, color, intensity = 1}) {
  const dir = new THREE.Vector3().subVectors(to, from), L = dir.length();
  const geo = new THREE.CylinderGeometry(r0, r1, L, 64, 24, true);
  geo.translate(0, -L / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {uColor: {value: new THREE.Color(color)}, uInt: {value: intensity}, uTime: {value: 0}, uLen: {value: L}},
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vP;
      void main(){ vY = position.y; vP = position; vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uInt; uniform float uTime; uniform float uLen; varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.8);
        float along = clamp(-vY/uLen, 0., 1.);
        float fade = smoothstep(0., 0.12, along) * (1. - smoothstep(0.82, 1., along));
        float dust = 0.75 + 0.35*n3(vP*1.7 + vec3(0., uTime*0.08, 0.));
        gl_FragColor = vec4(uColor * edge * fade * dust * uInt * 0.22, 1.);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(from);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  m.renderOrder = 10;
  return m;
}

/** Ауадағы шаң: детерминирленген нүктелер, баяу қозғалады; жұмсақ дөңгелек спрайт. */
export function dust(count, box, seed, color = '#EEE7DA', size = 0.035) {
  const r = rng(seed), pos = new Float32Array(count * 3), base = [];
  for (let i = 0; i < count; i++) base.push([box.min.x + r() * (box.max.x - box.min.x), box.min.y + r() * (box.max.y - box.min.y), box.min.z + r() * (box.max.z - box.min.z), r() * 6.28, 0.2 + r() * 0.6]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const mat = new THREE.PointsMaterial({color, size, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, sizeAttenuation: true});
  const pts = new THREE.Points(geo, mat);
  pts.update = t => { for (let i = 0; i < count; i++) { const b = base[i]; pos[i * 3] = b[0] + Math.sin(t * 0.13 * b[4] + b[3]) * 0.25; pos[i * 3 + 1] = b[1] + Math.sin(t * 0.09 * b[4] + b[3] * 2) * 0.18 + t * 0.012 * b[4]; pos[i * 3 + 2] = b[2] + Math.cos(t * 0.11 * b[4] + b[3]) * 0.25; } geo.attributes.position.needsUpdate = true; };
  pts.update(0);
  return pts;
}

export function buildWorld(scene) {
  const W = {};
  scene.background = PAL.deep.clone();
  scene.fog = new THREE.FogExp2(PAL.deep.getHex(), 0.028);

  // еден: үлкен тас тақталар
  const floorMat = stoneMaterial({seed: 3, tiles: 4, base: '#30343b', repeat: [40, 40], rough: 0.58});
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // екі жол: биіктетілген тақталар қатары
  const slabMat = stoneMaterial({seed: 5, tiles: 1, base: '#454a53', grout: false, rough: 0.5});
  const slabGeo = new RoundedBoxGeometry(PATH.width, 0.1, 2.36, 3, 0.025);
  W.slabs = [];
  for (const [i, x] of [[0, PATH.ax], [1, PATH.bx]]) {
    for (let z = PATH.z0; z > PATH.z1; z -= 2.4) {
      const s = new THREE.Mesh(slabGeo, slabMat); s.position.set(x, 0.05, z - 1.2); s.castShadow = false; s.receiveShadow = true; scene.add(s); W.slabs.push(s);
    }
  }
  // жолдар арасындағы жіңішке металл із
  const groove = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, PATH.z0 - PATH.z1), metalMaterial('#6b6f76'));
  groove.position.set(0, 0.006, (PATH.z0 + PATH.z1) / 2); groove.receiveShadow = true; scene.add(groove); W.groove = groove;

  // монументалды бағаналар
  const pillarMat = stoneMaterial({seed: 9, tiles: 2, base: '#3b4048', rough: 0.7, repeat: [1, 6]});
  const pillarGeo = new RoundedBoxGeometry(1.5, 18, 1.5, 2, 0.04);
  for (const x of [-7.5, 7.5]) for (let z = 6; z > -90; z -= 7) {
    const p = new THREE.Mesh(pillarGeo, pillarMat); p.position.set(x, 9, z); p.castShadow = true; p.receiveShadow = true; scene.add(p);
    const cap = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.5, 1.9, 2, 0.05), pillarMat); cap.position.set(x, 0.25, z); cap.receiveShadow = true; scene.add(cap);
  }
  // алыс қабырға биік саңылаулармен
  const wallMat = stoneMaterial({seed: 13, tiles: 3, base: '#2e3239', rough: 0.75, repeat: [6, 3]});
  for (const [x, w] of [[-10.5, 13], [10.5, 13], [0, 3.2]]) {
    const wl = new THREE.Mesh(new THREE.BoxGeometry(w, 26, 2), wallMat); wl.position.set(x, x === 0 ? 17 : 13, -86); wl.receiveShadow = true; scene.add(wl);
  }
  // жоғарыдағы арқалықтар (шатыр сұлбасы)
  for (let z = 6; z > -90; z -= 7) { const b = new THREE.Mesh(new THREE.BoxGeometry(16.5, 1.1, 1.1), pillarMat); b.position.set(0, 18.4, z); scene.add(b); }

  // жарық
  const hemi = new THREE.HemisphereLight('#4a505a', '#111318', 0.55); scene.add(hemi);
  const key = new THREE.DirectionalLight('#aab4c4', 0.55); key.position.set(9, 16, 12); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, {left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60}); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  scene.add(key);
  const amber = new THREE.SpotLight(PAL.amber.getHex(), 0, 70, 0.26, 0.75, 1.2); amber.position.set(-3.2, 17.5, -4); amber.target.position.set(PATH.ax, 0, 0.5);
  amber.castShadow = true; amber.shadow.mapSize.set(2048, 2048); amber.shadow.bias = -0.0003; amber.shadow.radius = 6;
  scene.add(amber, amber.target);
  const coolSpot = new THREE.SpotLight('#c8d2e0', 0, 70, 0.24, 0.8, 1.2); coolSpot.position.set(3.4, 17.5, -2); coolSpot.target.position.set(PATH.bx, 0, 0);
  coolSpot.castShadow = true; coolSpot.shadow.mapSize.set(1024, 1024); coolSpot.shadow.radius = 6;
  scene.add(coolSpot, coolSpot.target);
  Object.assign(W, {hemi, key, amber, coolSpot, floor});

  // көлемді сәулелер (жарық көзінен жолға)
  W.shaftA = lightShaft({from: amber.position.clone(), to: new THREE.Vector3(PATH.ax, 0, 0.5), r0: 0.35, r1: 2.6, color: '#D9A45C', intensity: 0});
  W.shaftB = lightShaft({from: coolSpot.position.clone(), to: new THREE.Vector3(PATH.bx, 0, 0), r0: 0.3, r1: 2.3, color: '#c9d3e2', intensity: 0});
  scene.add(W.shaftA, W.shaftB);
  W.dustA = dust(260, new THREE.Box3(new THREE.Vector3(-4.5, 0.2, -5), new THREE.Vector3(1.5, 9, 4)), 7, '#f2d9b0', 0.03);
  W.dustB = dust(160, new THREE.Box3(new THREE.Vector3(-1, 0.2, -5), new THREE.Vector3(5, 9, 4)), 8, '#dfe4ea', 0.026);
  scene.add(W.dustA, W.dustB);
  return W;
}

/** Еңбек құрылымы: сатылар (білім мен еңбек қабаттары). steps — жиналған блок саны (0..n), бөлшекті прогресс. */
export function buildSteps(scene, x, z0, seed) {
  const mat = stoneMaterial({seed, tiles: 1, base: '#4a4f58', grout: false, rough: 0.55});
  const geo = new RoundedBoxGeometry(1.0, 0.36, 0.7, 3, 0.03);
  const blocks = [];
  // 3 қатар × 6 саты: әр сатыда 1 блок (ені бойынша)
  for (let i = 0; i < 6; i++) for (let k = 0; k <= i; k++) {
    const b = new THREE.Mesh(geo, mat); b.castShadow = true; b.receiveShadow = true;
    b.userData.home = new THREE.Vector3(x, 0.1 + 0.18 + k * 0.36, z0 - i * 0.7);
    b.position.copy(b.userData.home); scene.add(b); blocks.push(b);
  }
  return blocks;
}

/** Алыстағы жылы отбасы силуэттері: жарықтанған есік ойығы және үш тұлға (ересек екеу, бала). */
export function buildFamily(scene, pos) {
  const g = new THREE.Group(); g.position.copy(pos);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), new THREE.MeshBasicMaterial({color: '#e8b56a', transparent: true, opacity: 0.9}));
  glow.position.set(0, 1.8, -0.05); g.add(glow);
  const sil = new THREE.MeshBasicMaterial({color: '#1a1714'});
  const person = (h, x) => { const p = new THREE.Group(); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.16 * h, 0.9 * h, 6, 12), sil); b.position.y = 0.62 * h; const hd = new THREE.Mesh(new THREE.SphereGeometry(0.12 * h, 16, 12), sil); hd.position.y = 1.3 * h; p.add(b, hd); p.position.x = x; return p; };
  g.add(person(1.0, -0.45), person(0.95, 0.35), person(0.62, -0.02));
  scene.add(g);
  return g;
}
