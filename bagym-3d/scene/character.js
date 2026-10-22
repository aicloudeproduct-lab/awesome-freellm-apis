// Түпнұсқа 3D кейіпкер: бойы ~1.75 м, буындары иерархиялы (FK), аяқ-қолға 2 буынды IK.
// Екі нұсқа: 'A' — ұзын шапанды (бағын қызғанатын, кейін еркіндік табатын кейіпкер), 'B' — қысқа күрте мен орамал.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {clothMaterial, skinMaterial} from './materials.js';

const D = {hipY: 0.95, hipHalf: 0.095, thigh: 0.44, shin: 0.43, ankle: 0.075, spine: 0.27, chest: 0.25, shoulderHalf: 0.19, neck: 0.085, upper: 0.29, fore: 0.26, hand: 0.085};
export const BODY = D;

function limb(len, r0, r1, mat, seg = 18) {
  // конусты капсула: жоғарғы ұшы буында (0), төменгі ұшы −len
  const g = new THREE.CylinderGeometry(r0, r1, len, seg, 6);
  g.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(g, mat);
  const capA = new THREE.Mesh(new THREE.SphereGeometry(r0, seg, 12), mat);
  const capB = new THREE.Mesh(new THREE.SphereGeometry(r1, seg, 12), mat); capB.position.y = -len;
  const grp = new THREE.Group(); grp.add(m, capA, capB);
  return grp;
}
const shadowAll = o => o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

export class Character {
  constructor(variant = 'A') {
    this.variant = variant;
    const coat = clothMaterial(variant === 'A' ? '#EEE7DA' : '#E6DDCB', variant === 'A' ? 11 : 23);
    const under = clothMaterial(variant === 'A' ? '#D9D0C0' : '#CFC5B3', 31);
    const skin = skinMaterial();
    const shoe = new THREE.MeshStandardMaterial({color: '#2a2d33', roughness: 0.6, metalness: 0.05});
    this.mats = {coat, under, skin, shoe};
    const root = (this.root = new THREE.Group());
    const hips = (this.hips = new THREE.Group()); hips.position.y = D.hipY; root.add(hips);
    // жамбас
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), under); pelvis.scale.set(1.05, 0.62, 0.78); hips.add(pelvis);
    // омыртқа → кеуде
    const spine = (this.spine = new THREE.Group()); hips.add(spine);
    const chest = (this.chest = new THREE.Group()); chest.position.y = D.spine; spine.add(chest);
    const torsoPts = [[0.0, -D.spine - 0.02], [0.145, -D.spine], [0.16, -0.12], [0.175, 0.02], [0.19, 0.15], [0.17, 0.22], [0.09, 0.26], [0.0, 0.265]].map(([x, y]) => new THREE.Vector2(x, y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoPts, 40), coat); torso.scale.set(1, 1, 0.68); chest.add(torso);
    // мойын, бас
    const neck = (this.neck = new THREE.Group()); neck.position.y = D.chest; chest.add(neck);
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.055, D.neck, 16), skin); neckMesh.position.y = D.neck / 2; neck.add(neckMesh);
    const head = (this.head = new THREE.Group()); head.position.y = D.neck; neck.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 40, 28), skin); skull.scale.set(0.93, 1.13, 1.02); skull.position.set(0, 0.12, 0); head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), skin); jaw.scale.set(1, 0.8, 1.05); jaw.position.set(0, 0.055, 0.025); head.add(jaw);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 12), skin); nose.rotation.x = Math.PI / 2 + 0.25; nose.position.set(0, 0.115, 0.115); head.add(nose);
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 24, Math.PI * 0.75), skin); brow.rotation.set(0.1, 0, Math.PI * 1.125); brow.position.set(0, 0.155, 0.075); brow.scale.set(1, 0.5, 1); head.add(brow);
    if (variant === 'A') {
      // жұмсақ қалпақ (бас киім) — силуэтті ерекшелейді
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.118, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), under); cap.scale.set(0.97, 0.8, 1.05); cap.position.y = 0.16; head.add(cap);
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.114, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), new THREE.MeshStandardMaterial({color: '#3a352f', roughness: 0.75})); hair.scale.set(0.97, 1.05, 1.06); hair.position.set(0, 0.135, -0.008); head.add(hair);
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.035, 12, 28), clothMaterial('#C9A770', 41)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.01; neck.add(scarf);
      const tail = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.24, 0.025, 2, 0.01), scarf.material); tail.position.set(0.06, -0.13, 0.085); tail.rotation.z = 0.12; chest.add(tail);
    }
    // қолдар
    this.arm = {};
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1;
      const sh = new THREE.Group(); sh.position.set(sx * D.shoulderHalf, D.chest - 0.035, 0); chest.add(sh);
      const shoulderPad = new THREE.Mesh(new THREE.SphereGeometry(0.068, 18, 12), coat); sh.add(shoulderPad);
      const up = limb(D.upper, 0.058, 0.047, coat); sh.add(up);
      const el = new THREE.Group(); el.position.y = -D.upper; sh.add(el);
      const fo = limb(D.fore, 0.046, 0.04, coat); el.add(fo);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.05, 0.05, 16), under); cuff.position.y = -D.fore + 0.04; el.add(cuff);
      const wr = new THREE.Group(); wr.position.y = -D.fore; el.add(wr);
      const palm = new THREE.Mesh(new RoundedBoxGeometry(0.075, D.hand, 0.03, 3, 0.013), skin); palm.position.y = -D.hand / 2; wr.add(palm);
      const fingers = new THREE.Group(); fingers.position.y = -D.hand + 0.01; wr.add(fingers);
      const fing = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.07, 0.026, 3, 0.012), skin); fing.position.y = -0.035; fingers.add(fing);
      const thumb = new THREE.Group(); thumb.position.set(sx * 0.03, -0.025, 0.015); wr.add(thumb);
      const th = limb(0.05, 0.013, 0.011, skin, 10); thumb.add(th); thumb.rotation.z = sx * 0.6;
      this.arm[s] = {sh, el, wr, fingers, thumb};
    }
    // аяқтар
    this.leg = {};
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1;
      const hp = new THREE.Group(); hp.position.set(sx * D.hipHalf, 0, 0); hips.add(hp);
      const th = limb(D.thigh, 0.078, 0.06, under); hp.add(th);
      const kn = new THREE.Group(); kn.position.y = -D.thigh; hp.add(kn);
      const sn = limb(D.shin, 0.058, 0.044, under); kn.add(sn);
      const an = new THREE.Group(); an.position.y = -D.shin; kn.add(an);
      const foot = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.075, 0.25, 3, 0.03), shoe); foot.position.set(0, -0.04, 0.06); an.add(foot);
      this.leg[s] = {hp, kn, an};
    }
    // етек: жамбасқа бекітілген, аяқпен бірге тербеледі
    const skirtLen = variant === 'A' ? 0.62 : 0.2;
    const skPts = [[0.165, 0.02], [0.185, -0.08], [0.215, -skirtLen * 0.55], [0.245, -skirtLen], [0.235, -skirtLen - 0.01]].map(([x, y]) => new THREE.Vector2(x, y));
    const skirt = (this.skirt = new THREE.Mesh(new THREE.LatheGeometry(skPts, 48, 0, Math.PI * 2), coat)); skirt.scale.set(1, 1, 0.78);
    hips.add(skirt);
    if (variant === 'B') { const belt = new THREE.Mesh(new THREE.TorusGeometry(0.162, 0.015, 8, 40), new THREE.MeshStandardMaterial({color: '#3a3d44', roughness: 0.5, metalness: 0.6})); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.78, 1); hips.add(belt); }
    shadowAll(root);
  }

  /** Поза: жамбас биіктігі/айналымы, омыртқа, бас бұрыштары және қол/аяқ нысаналары (жергілікті координатада IK). */
  setPose(p) {
    const r = (o, e) => e && o.rotation.set(e[0] || 0, e[1] || 0, e[2] || 0);
    this.hips.position.set(p.hipX || 0, p.hipY ?? D.hipY, p.hipZ || 0);
    r(this.hips, p.hips); r(this.spine, p.spine); r(this.chest, p.chest); r(this.neck, p.neck); r(this.head, p.head);
    for (const s of ['L', 'R']) {
      const a = this.arm[s], A = p['arm' + s] || {};
      r(a.sh, A.sh || [0, 0, (s === 'L' ? 1 : -1) * 0.08]);
      a.el.rotation.set(A.el ?? -0.12, 0, 0);
      r(a.wr, A.wr || [0, 0, 0]);
      a.fingers.rotation.x = A.grip ?? 0.25;
      const g = this.leg[s], Lg = p['leg' + s] || {};
      r(g.hp, Lg.hp || [0, 0, 0]);
      g.kn.rotation.set(Lg.kn ?? 0.04, 0, 0);
      r(g.an, Lg.an || [0, 0, 0]);
    }
    // етек: екі санның орташа бұрышын жартылай қайталайды
    const lx = this.leg.L.hp.rotation.x, rx = this.leg.R.hp.rotation.x;
    this.skirt.rotation.x = ((lx + rx) / 2) * 0.55 + (p.sway || 0);
    this.skirt.scale.x = 1 + Math.abs(lx - rx) * 0.12;
  }
}

/** Аяқ IK: жамбас буыны (әлем) → табан нысанасы (әлем). hp.rotation.x/kn.rotation.x қайтарады (сагиталь жазықтықта). */
export function legIK(hipLocal, footLocal) {
  // hipLocal, footLocal — кейіпкердің root жүйесінде (y жоғары, z алға)
  const dy = hipLocal.y - (footLocal.y + D.ankle), dz = footLocal.z - hipLocal.z;
  const d = Math.min(D.thigh + D.shin - 1e-3, Math.hypot(dy, dz));
  const a = D.thigh, b = D.shin;
  const knee = Math.PI - Math.acos(Math.min(1, Math.max(-1, (a * a + b * b - d * d) / (2 * a * b))));
  const base = Math.atan2(dz, dy);                // жамбастан табанға бұрыш (алға оң)
  const off = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))));
  return {hp: -(base + off), kn: knee};           // three.js: rotation.x оң — аяқ артқа
}
