// Түпнұсқа 3D кейіпкер: бойы ~1.75 м, буындары иерархиялы (FK), аяққа 2 буынды IK.
// 'A' — кейіпкер (ұзын шапан, киіз қалпақ), 'B' — екінші адам (қысқа күрте, орамал).
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {clothMaterial, skinMaterial} from './materials.js';

const D = {hipY: 0.95, hipHalf: 0.095, thigh: 0.44, shin: 0.43, ankle: 0.075, spine: 0.27, chest: 0.25, shoulderHalf: 0.175, neck: 0.085, upper: 0.29, fore: 0.26, hand: 0.085};
export const BODY = D;

/** Конусты түтік (буыннан төмен қарай), екі ұшы дөңгеленген — бір материал, тігіссіз. */
function tube(len, r0, r1, mat, seg = 20) {
  const pts = [];
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r1, -len + Math.sin(a) * r1)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0)); }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, seg), mat);
}
const shadowAll = o => o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

export class Character {
  constructor(variant = 'A') {
    this.variant = variant;
    const isA = variant === 'A';
    const coat = clothMaterial(isA ? '#D9CFBF' : '#CFC4B1', isA ? 11 : 23);
    const shirt = clothMaterial(isA ? '#CFC4B2' : '#C7BCA9', 31);
    const pants = clothMaterial(isA ? '#5a5650' : '#4f4c48', 37);
    const skin = skinMaterial();
    const dark = new THREE.MeshStandardMaterial({color: '#2b2622', roughness: 0.45});
    const boot = new THREE.MeshStandardMaterial({color: '#2a2b2e', roughness: 0.5, metalness: 0.05});
    this.mats = {coat, shirt, pants, skin, boot};
    const root = (this.root = new THREE.Group());
    const hips = (this.hips = new THREE.Group()); hips.position.y = D.hipY; root.add(hips);
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), pants); pelvis.scale.set(1.08, 0.7, 0.8); hips.add(pelvis);

    // омыртқа → кеуде: иықтары жатық, кеудесі табиғи
    const spine = (this.spine = new THREE.Group()); hips.add(spine);
    const chest = (this.chest = new THREE.Group()); chest.position.y = D.spine; spine.add(chest);
    const prof = [[0.0, -D.spine - 0.03], [0.145, -D.spine - 0.01], [0.15, -0.14], [0.158, -0.02], [0.17, 0.1], [0.19, 0.18], [0.18, 0.225], [0.12, 0.255], [0.055, 0.27], [0.0, 0.272]];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 48), coat); torso.scale.set(1, 1, 0.66); chest.add(torso);
    // жаға (шапан жағасы / күрте жағасы)
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 10, 32), isA ? coat : shirt); collar.rotation.x = Math.PI / 2; collar.position.y = 0.262; collar.scale.set(1, 0.8, 1); chest.add(collar);
    // алдыңғы өңір сызығы (шапанның қаусырмасы)
    const placket = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.42, 0.01), new THREE.MeshStandardMaterial({color: isA ? '#b9ad98' : '#a9a08f', roughness: 0.8}));
    placket.position.set(0.02, 0.03, 0.118); placket.rotation.z = 0.03; chest.add(placket);
    if (isA) { const sash = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.022, 10, 48), clothMaterial('#8f8576', 51)); sash.rotation.x = Math.PI / 2; sash.scale.set(1, 0.68, 1); sash.position.y = -D.spine + 0.02; chest.add(sash); }

    // мойын, бас
    const neck = (this.neck = new THREE.Group()); neck.position.y = D.chest; chest.add(neck);
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.054, D.neck + 0.02, 18), skin); neckMesh.position.y = D.neck / 2; neck.add(neckMesh);
    const head = (this.head = new THREE.Group()); head.position.y = D.neck; neck.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.108, 48, 32), skin); skull.scale.set(0.9, 1.1, 1.0); skull.position.set(0, 0.125, -0.005); head.add(skull);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.08, 32, 24), skin); face.scale.set(0.95, 1.08, 0.9); face.position.set(0, 0.085, 0.035); head.add(face);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), skin); nose.scale.set(0.8, 1.3, 1.0); nose.position.set(0, 0.105, 0.11); head.add(nose);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 14, 10), dark); eye.position.set(sx * 0.035, 0.13, 0.093); head.add(eye);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), skin); lid.position.set(sx * 0.035, 0.132, 0.088); lid.rotation.x = 0.35; head.add(lid);
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.035, 4, 8), new THREE.MeshStandardMaterial({color: '#5d5248', roughness: 0.8}));
      brow.rotation.z = Math.PI / 2 + sx * 0.12; brow.position.set(sx * 0.036, 0.157, 0.095); head.add(brow); (this.brows ||= []).push(brow);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), skin); ear.scale.set(0.45, 1.1, 0.8); ear.position.set(sx * 0.096, 0.115, -0.005); head.add(ear);
    }
    if (isA) {
      // жұмсақ киіз қалпақ (жиегі сәл қайырылған)
      const kal = new THREE.Mesh(new THREE.LatheGeometry([[0.0, 0.17], [0.07, 0.165], [0.1, 0.13], [0.108, 0.07], [0.118, 0.055], [0.116, 0.045]].map(([x, y]) => new THREE.Vector2(x, y)), 40), clothMaterial('#ECE4D6', 61));
      kal.scale.set(0.98, 1.05, 1.06); kal.position.set(0, 0.12, -0.008); head.add(kal);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.113, 0.009, 8, 40), new THREE.MeshStandardMaterial({color: '#3b3632', roughness: 0.7})); band.rotation.x = Math.PI / 2; band.scale.set(0.98, 1.06, 1); band.position.set(0, 0.17, -0.008); head.add(band);
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.112, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.46), new THREE.MeshStandardMaterial({color: '#3a332d', roughness: 0.8}));
      hair.scale.set(0.93, 1.08, 1.06); hair.position.set(0, 0.13, -0.012); hair.rotation.x = -0.12; head.add(hair);
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.034, 12, 32), clothMaterial('#B89A6A', 41)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.012; neck.add(scarf);
      const tail = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.26, 0.025, 2, 0.011), scarf.material); tail.position.set(0.055, 0.1, 0.112); tail.rotation.set(0.12, 0, 0.1); chest.add(tail);
    }

    // қолдар: тігіссіз жең, жең ұшы, алақан, саусақтар, бас бармақ
    this.arm = {};
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1;
      const sh = new THREE.Group(); sh.position.set(sx * D.shoulderHalf, D.chest - 0.045, -0.005); chest.add(sh);
      sh.add(tube(D.upper, 0.056, 0.048, coat));
      const el = new THREE.Group(); el.position.y = -D.upper; sh.add(el);
      el.add(tube(D.fore - 0.02, 0.048, isA ? 0.052 : 0.043, coat));
      const wr = new THREE.Group(); wr.position.y = -D.fore; el.add(wr);
      const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.05, 14), skin); wrist.position.y = 0.01; wr.add(wrist);
      const palm = new THREE.Mesh(new RoundedBoxGeometry(0.07, D.hand, 0.032, 3, 0.014), skin); palm.position.y = -D.hand / 2; wr.add(palm);
      const fingers = new THREE.Group(); fingers.position.y = -D.hand + 0.012; wr.add(fingers);
      for (let f = 0; f < 4; f++) { const fg = tube(0.068 - Math.abs(f - 1.5) * 0.01, 0.0095, 0.008, skin, 10); fg.position.x = (f - 1.5) * 0.0165; fingers.add(fg); }
      const thumb = new THREE.Group(); thumb.position.set(sx * 0.032, -0.025, 0.016); wr.add(thumb);
      thumb.add(tube(0.05, 0.011, 0.009, skin, 10)); thumb.rotation.set(0.4, 0, sx * 0.55);
      this.arm[s] = {sh, el, wr, fingers, thumb};
    }
    // аяқтар: шалбар, етік
    this.leg = {};
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1;
      const hp = new THREE.Group(); hp.position.set(sx * D.hipHalf, 0, 0); hips.add(hp);
      hp.add(tube(D.thigh, 0.074, 0.058, pants));
      const kn = new THREE.Group(); kn.position.y = -D.thigh; hp.add(kn);
      kn.add(tube(D.shin, 0.056, 0.046, pants));
      const bootShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.052, 0.2, 16), boot); bootShaft.position.y = -D.shin + 0.08; kn.add(bootShaft);
      const an = new THREE.Group(); an.position.y = -D.shin; kn.add(an);
      const foot = new THREE.Mesh(new RoundedBoxGeometry(0.098, 0.075, 0.25, 3, 0.032), boot); foot.position.set(0, -0.04, 0.055); an.add(foot);
      this.leg[s] = {hp, kn, an};
    }
    // етек: екі жартысы, әрқайсысы өз санымен бірге тербеледі (матаның табиғи қозғалысы)
    const len = isA ? 0.6 : 0.2;
    const prof2 = [[0.15, 0.04], [0.162, -0.06], [0.185, -len * 0.5], [0.205, -len], [0.198, -len - 0.012]].map(([x, y]) => new THREE.Vector2(x, y));
    this.skirt = {};
    for (const s of ['L', 'R']) {
      const g = new THREE.LatheGeometry(prof2, 28, s === 'L' ? -0.08 : Math.PI + 0.08, Math.PI + 0.16);
      const m = new THREE.Mesh(g, coat); m.scale.set(1, 1, 0.82);
      const piv = new THREE.Group(); piv.add(m); hips.add(piv); this.skirt[s] = piv;
    }
    shadowAll(root);
  }

  setPose(p) {
    const r = (o, e) => e && o.rotation.set(e[0] || 0, e[1] || 0, e[2] || 0);
    this.hips.position.set(p.hipX || 0, p.hipY ?? D.hipY, p.hipZ || 0);
    r(this.hips, p.hips || [0, 0, 0]); r(this.spine, p.spine || [0, 0, 0]); r(this.chest, p.chest || [0, 0, 0]); r(this.neck, p.neck || [0, 0, 0]); r(this.head, p.head || [0, 0, 0]);
    for (const s of ['L', 'R']) {
      const a = this.arm[s], A = p['arm' + s] || {};
      r(a.sh, A.sh || [0, 0, (s === 'L' ? 1 : -1) * 0.07]);
      a.el.rotation.set(A.el ?? -0.15, 0, 0);
      r(a.wr, A.wr || [0, 0, 0]);
      a.fingers.rotation.x = A.grip ?? 0.3;
      const g = this.leg[s], Lg = p['leg' + s] || {};
      r(g.hp, Lg.hp || [0, 0, 0]);
      g.kn.rotation.set(Lg.kn ?? 0.04, 0, 0);
      r(g.an, Lg.an || [0, 0, 0]);
      // етек жартысы: санның алға/артқа бұрышын жұмсақ қайталайды (тізе етекті итереді)
      const hx = g.hp.rotation.x;
      this.skirt[s].rotation.x = Math.max(-0.75, Math.min(0.3, hx * 0.5)) + (p.sway || 0);
      this.skirt[s].rotation.z = g.hp.rotation.z * 0.5;
    }
    if (this.brows) { const k = p.brow || 0; this.brows.forEach((b, i) => { b.position.y = 0.157 - k * 0.006; b.rotation.z = Math.PI / 2 + (i ? 1 : -1) * (0.12 + k * 0.25); }); }
  }
}

/** Аяқ IK (сагиталь жазықтықта): жамбас буыны → табан нысанасы (root жүйесінде, z — алға). */
export function legIK(hipLocal, footLocal) {
  const dy = hipLocal.y - (footLocal.y + D.ankle), dz = footLocal.z - hipLocal.z;
  const d = Math.min(D.thigh + D.shin - 1e-3, Math.hypot(dy, dz));
  const a = D.thigh, b = D.shin;
  const knee = Math.PI - Math.acos(Math.min(1, Math.max(-1, (a * a + b * b - d * d) / (2 * a * b))));
  const base = Math.atan2(dz, dy);
  const off = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))));
  return {hp: -(base + off), kn: knee};
}
