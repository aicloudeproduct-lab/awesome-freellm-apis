// Reusable props: furniture, tea set (kese bowls), phone, architectural models,
// papers, curtain, houses, street furniture, trees, trophy.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as M from '../engine/materials.js';
import * as T from '../engine/textures.js';
import {rng, shadow} from '../lib/util.js';

export const box = (w, h, d, mat, r = 0.004, seg = 2) => new THREE.Mesh(r > 0 ? new RoundedBoxGeometry(w, h, d, seg, r) : new THREE.BoxGeometry(w, h, d), mat);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const lathe = (pts, mat, seg = 48) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat);

export function table(w, d, h, mat, legMat = mat) {
  const g = new THREE.Group();
  g.add(at(box(w, 0.035, d, mat, 0.006), 0, h - 0.0175, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.045, h - 0.035, 0.045, legMat, 0.004), sx * (w / 2 - 0.06), (h - 0.035) / 2, sz * (d / 2 - 0.06)));
  g.add(at(box(w - 0.14, 0.07, 0.02, legMat, 0.003), 0, h - 0.07, d / 2 - 0.06));
  return shadow(g);
}

export function chair(mat, seat = 0.46, back = true) {
  const g = new THREE.Group();
  g.add(at(box(0.44, 0.04, 0.42, mat, 0.008), 0, seat, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.035, seat, 0.035, mat, 0.004), sx * 0.19, seat / 2, sz * 0.18));
  if (back) {
    for (const sx of [-1, 1]) g.add(at(box(0.035, 0.48, 0.035, mat, 0.004), sx * 0.19, seat + 0.24, -0.19));
    g.add(at(box(0.42, 0.12, 0.025, mat, 0.006), 0, seat + 0.4, -0.19));
  }
  return shadow(g);
}

/** Kazakh tea bowl (kese) on a saucer; returns {group, tea} where tea level can change. */
export function kese(color = '#f3efe6', pattern = '#3d6fb5') {
  const g = new THREE.Group();
  const cer = M.ceramic(color);
  const bowl = lathe([[0.0, 0.0], [0.024, 0.0], [0.026, 0.004], [0.04, 0.025], [0.046, 0.05], [0.044, 0.052], [0.038, 0.028], [0.022, 0.008], [0.0, 0.007]], cer, 40);
  g.add(bowl);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.0452, 0.0018, 6, 40), new THREE.MeshPhysicalMaterial({color: pattern, roughness: 0.2, clearcoat: 0.8})); band.rotation.x = Math.PI / 2; band.position.y = 0.044; g.add(band);
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.039, 32), new THREE.MeshPhysicalMaterial({color: '#7a4a24', roughness: 0.05, clearcoat: 1, transmission: 0, transparent: true, opacity: 0.92}));
  tea.rotation.x = -Math.PI / 2; tea.position.y = 0.036; g.add(tea);
  const saucer = lathe([[0, 0], [0.06, 0.0], [0.07, 0.008], [0.072, 0.01], [0.058, 0.004], [0.0, 0.004]], cer, 40);
  saucer.position.y = -0.006; g.add(saucer);
  shadow(g);
  return {group: g, tea};
}

export function teapot(color = '#f1ece2') {
  const g = new THREE.Group();
  const cer = M.ceramic(color);
  g.add(lathe([[0, 0], [0.05, 0], [0.075, 0.03], [0.082, 0.07], [0.07, 0.11], [0.04, 0.125], [0.0, 0.127]], cer, 48));
  const lid = lathe([[0, 0.14], [0.012, 0.14], [0.01, 0.13], [0.04, 0.125], [0.042, 0.12], [0, 0.12]], cer, 32); g.add(lid);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.016, 0.1, 16), cer); spout.position.set(0.09, 0.08, 0); spout.rotation.z = -0.9; g.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 10, 24, Math.PI * 1.2), cer); handle.position.set(-0.08, 0.07, 0); handle.rotation.z = Math.PI * 0.4; g.add(handle);
  return shadow(g);
}

/** Phone with an emissive screen canvas (updated by phoneui). */
export function phone(screenTex) {
  const g = new THREE.Group();
  const body = box(0.072, 0.152, 0.008, new THREE.MeshPhysicalMaterial({color: '#1d1f22', roughness: 0.3, metalness: 0.4, clearcoat: 1}), 0.006, 3);
  g.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.143), new THREE.MeshStandardMaterial({color: '#000000', emissive: '#ffffff', emissiveMap: screenTex, emissiveIntensity: 1.25, roughness: 0.7, metalness: 0, map: null}));
  scr.position.z = 0.0042; g.add(scr);
  g.userData.screen = scr;
  return shadow(g, true, false);
}

/** White card architectural model: stepped volumes with window slits. */
export function archModel(seed = 'model', scale = 1, progress = 1, mat = null) {
  const g = new THREE.Group(), r = rng(seed);
  const card = mat || new THREE.MeshPhysicalMaterial({color: '#f3f0ea', roughness: 0.75, sheen: 0.2});
  const dark = new THREE.MeshStandardMaterial({color: '#9aa3a8', roughness: 0.4});
  const base = box(0.42 * scale, 0.012 * scale, 0.32 * scale, M.wood('modelbase', '#b28b62', '#8a6a48', [1, 1]), 0.002); base.position.y = 0.006 * scale; g.add(base);
  const n = 5;
  for (let i = 0; i < n; i++) {
    if (i / n > progress) break;
    const w = (0.08 + r() * 0.12) * scale, d = (0.06 + r() * 0.1) * scale, h = (0.05 + r() * 0.18) * scale;
    const b = box(w, h, d, card, 0.0015 * scale); b.position.set((r() - 0.5) * 0.24 * scale, 0.012 * scale + h / 2, (r() - 0.5) * 0.16 * scale); g.add(b);
    for (let k = 0; k < Math.floor(h / (0.022 * scale)); k++) {
      const s = box(w * 0.8, 0.004 * scale, 0.001, dark, 0); s.position.set(b.position.x, 0.02 * scale + k * 0.022 * scale, b.position.z + d / 2 + 0.0006); g.add(s);
    }
  }
  return shadow(g);
}

export function paperSheet(w, h, map) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.paper(map));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

export function pencil(color = '#e2b23c', len = 0.17) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, len, 6), new THREE.MeshPhysicalMaterial({color, roughness: 0.4, clearcoat: 0.6}));
  body.rotation.z = Math.PI / 2; g.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0038, 0.018, 12), M.wood('pencil', '#e6c99a', '#c9a777')); tip.rotation.z = -Math.PI / 2; tip.position.x = len / 2 + 0.009; g.add(tip);
  return shadow(g, true, false);
}

export function lamp(shadeColor = '#2f3b3f') {
  const g = new THREE.Group();
  const metal = M.metal('#3a3d40', 0.4);
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 32), metal), 0, 0.01, 0));
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 12), metal); arm1.position.set(0, 0.18, 0); arm1.rotation.z = 0.25; g.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 12), metal); arm2.position.set(-0.13, 0.36, 0); arm2.rotation.z = -1.0; g.add(arm2);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 32, 1, true), new THREE.MeshStandardMaterial({color: shadeColor, roughness: 0.5, side: THREE.DoubleSide, metalness: 0.3}));
  shade.position.set(-0.26, 0.42, 0); shade.rotation.z = 0.9; g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), M.emissive('#ffe4b0', 2)); bulb.position.set(-0.24, 0.4, 0); g.add(bulb);
  g.userData.bulb = bulb; g.userData.lightPos = new THREE.Vector3(-0.27, 0.36, 0);
  return shadow(g);
}

/** Curtain panel hanging in the XY plane, folds along x; setSpan(x0, x1) to slide it. */
export class Curtain {
  constructor(height, color = '#c9b79a', seed = 'curtain') {
    this.h = height;
    this.mat = new THREE.MeshPhysicalMaterial({color, roughness: 0.9, sheen: 0.7, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.3), side: THREE.DoubleSide,
      normalMap: T.weaveNormal(48, [8, 8]), normalScale: new THREE.Vector2(0.5, 0.5), transmission: 0, transparent: false});
    this.geo = new THREE.PlaneGeometry(1, height, 96, 24);
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.base = Float32Array.from(this.geo.attributes.position.array);
    this.group = new THREE.Group(); this.group.add(this.mesh);
  }
  /** span in metres, sway (wind/hand) 0..1, folds count */
  set(x0, x1, sway = 0, t = 0, folds = 14) {
    const p = this.geo.attributes.position, w = Math.max(0.12, x1 - x0);
    const amp = 0.035 * Math.min(1.6, 1.4 / (w + 0.25)) + 0.008;
    for (let i = 0; i < p.count; i++) {
      const u = this.base[i * 3] + 0.5, v = (this.base[i * 3 + 1] + this.h / 2) / this.h; // u 0..1, v 0 bottom..1 top
      const x = x0 + u * w;
      const fold = Math.sin(u * folds * Math.PI * 2 + 0.3) * amp * (0.75 + 0.25 * (1 - v));
      const swing = sway * Math.sin(t * 3 + u * 4) * 0.02 * (1 - v);
      p.setXYZ(i, x, this.base[i * 3 + 1], fold + swing);
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

/** Simple two-storey house: walls with window openings, gable roof, door. Faces +Z. */
export function house({w = 9, d = 8, floors = 2, wall = '#d8cfc2', roof = '#5b4a42', trim = '#efe9df', windows = [], door = null, seed = 'house'} = {}) {
  const g = new THREE.Group();
  const H = floors * 2.9 + 0.4;
  const wallMat = M.plaster(wall, seed + 'w', [4, 3]);
  const trimMat = M.matte(trim, 0.6);
  // facade with openings built from strips around the windows
  const holes = windows.map((o) => ({x0: o.x - o.w / 2, x1: o.x + o.w / 2, y0: o.y, y1: o.y + o.h}));
  if (door) holes.push({x0: door.x - door.w / 2, x1: door.x + door.w / 2, y0: 0.0, y1: door.h});
  const shape = new THREE.Shape(); shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, H); shape.lineTo(-w / 2, H); shape.lineTo(-w / 2, 0);
  for (const hl of holes) { const p = new THREE.Path(); p.moveTo(hl.x0, hl.y0); p.lineTo(hl.x0, hl.y1); p.lineTo(hl.x1, hl.y1); p.lineTo(hl.x1, hl.y0); p.lineTo(hl.x0, hl.y0); shape.holes.push(p); }
  const facade = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: 0.25, bevelEnabled: false}), wallMat);
  facade.position.z = d / 2 - 0.25; g.add(facade);
  // other walls
  const side = (x, rot) => { const m = box(d, H, 0.25, wallMat, 0); m.position.set(x, H / 2, 0); m.rotation.y = rot; g.add(m); };
  side(-w / 2 + 0.125, Math.PI / 2); side(w / 2 - 0.125, Math.PI / 2);
  const backW = box(w, H, 0.25, wallMat, 0); backW.position.set(0, H / 2, -d / 2 + 0.125); g.add(backW);
  // gable roof
  const rh = 2.2;
  const roofMat = new THREE.MeshStandardMaterial({color: roof, roughness: 0.75});
  for (const s of [-1, 1]) {
    const len = Math.hypot(d / 2 + 0.5, rh);
    const r = box(w + 0.6, 0.12, len, roofMat, 0); r.position.set(0, H + rh / 2, s * (d / 4 + 0.12)); r.rotation.x = s * Math.atan2(rh, d / 2 + 0.5); g.add(r);
  }
  const gableShape = new THREE.Shape(); gableShape.moveTo(-d / 2, 0); gableShape.lineTo(d / 2, 0); gableShape.lineTo(0, rh); gableShape.lineTo(-d / 2, 0);
  for (const s of [-1, 1]) { const gb = new THREE.Mesh(new THREE.ExtrudeGeometry(gableShape, {depth: 0.2, bevelEnabled: false}), wallMat); gb.rotation.y = Math.PI / 2; gb.position.set(s * (w / 2) - (s > 0 ? 0.2 : 0), H, 0); g.add(gb); }
  // window frames + glass + interior glow planes
  const glass = M.glass('#a9bcc8', 0.28);
  const glows = [];
  for (const o of windows) {
    const fr = new THREE.Group(); fr.position.set(o.x, o.y, d / 2 - 0.12);
    const t = 0.06;
    fr.add(at(box(o.w + t * 2, t, 0.1, trimMat, 0.01), 0, -t / 2, 0.08), at(box(o.w + t * 2, t, 0.1, trimMat, 0.01), 0, o.h + t / 2, 0.08));
    fr.add(at(box(t, o.h, 0.1, trimMat, 0.01), -o.w / 2 - t / 2, o.h / 2, 0.08), at(box(t, o.h, 0.1, trimMat, 0.01), o.w / 2 + t / 2, o.h / 2, 0.08));
    fr.add(at(box(0.04, o.h, 0.05, trimMat, 0.005), 0, o.h / 2, 0.05));
    const sill = box(o.w + 0.2, 0.05, 0.22, trimMat, 0.01); sill.position.set(0, -0.06, 0.15); fr.add(sill);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), glass); gl.position.set(0, o.h / 2, 0.03); fr.add(gl);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshStandardMaterial({color: '#000000', emissive: o.glow || '#ffcf8a', emissiveIntensity: 0, roughness: 1}));
    glow.position.set(0, o.h / 2, -0.35); fr.add(glow);
    // curtain hint inside the glowing window
    const curt = new THREE.Mesh(new THREE.PlaneGeometry(o.w * 0.28, o.h), new THREE.MeshStandardMaterial({color: '#000000', emissive: '#b9783a', emissiveIntensity: 0, roughness: 1}));
    curt.position.set(-o.w * 0.36, o.h / 2, -0.3); fr.add(curt);
    glows.push({glow, curt, cfg: o});
    g.add(fr);
  }
  if (door) {
    const dm = M.wood(seed + 'door', '#6e4a32', '#4a2f1e', [1, 2], 0.5);
    const dr = new THREE.Group(); dr.position.set(door.x - door.w / 2, 0, d / 2 - 0.08); g.add(dr);
    const leaf = box(door.w, door.h, 0.06, dm, 0.01); leaf.position.set(door.w / 2, door.h / 2, 0); dr.add(leaf);
    for (let k = 0; k < 2; k++) { const pan = box(door.w * 0.7, door.h * 0.36, 0.015, dm, 0.008); pan.position.set(door.w / 2, door.h * (0.3 + k * 0.42), 0.035); dr.add(pan); }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), M.metal('#c8a865', 0.25)); knob.position.set(door.w - 0.1, 1.0, 0.07); dr.add(knob);
    const frame = new THREE.Group(); g.add(frame);
    frame.add(at(box(door.w + 0.24, 0.12, 0.2, trimMat, 0.01), door.x, door.h + 0.06, d / 2 + 0.02));
    frame.add(at(box(0.12, door.h, 0.2, trimMat, 0.01), door.x - door.w / 2 - 0.06, door.h / 2, d / 2 + 0.02), at(box(0.12, door.h, 0.2, trimMat, 0.01), door.x + door.w / 2 + 0.06, door.h / 2, d / 2 + 0.02));
    for (let k = 0; k < 3; k++) { const st = box(door.w + 0.9 - k * 0.2, 0.16, 0.34, M.matte('#a59d93', 0.9), 0.01); st.position.set(door.x, 0.08 + k * 0.16 - 0.48 + 0.16 * 0, d / 2 + 0.55 - k * 0.3); st.position.y = 0.08 + (2 - k) * 0.0 + k * 0.16; g.add(st); }
    const lampP = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), M.emissive('#ffd9a0', 0)); lampP.position.set(door.x + door.w / 2 + 0.35, door.h + 0.15, d / 2 + 0.12); g.add(lampP);
    g.userData.door = {pivot: dr, leaf, porchLamp: lampP, cfg: door};
  }
  g.userData.glows = glows;
  g.userData.H = H;
  shadow(g);
  return g;
}

export function tree(seed = 'tree', h = 6, season = 'summer') {
  const g = new THREE.Group(), r = rng(seed);
  const bark = M.wood(seed + 'bark', '#4a3a2e', '#2e231b', [1, 4], 0.9);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, h * 0.55, 10), bark); trunk.position.y = h * 0.275; g.add(trunk);
  const leaves = [];
  for (let i = 0; i < 9; i++) {
    const s = 0.9 + r() * 1.1;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), new THREE.MeshStandardMaterial({color: '#4f6b3a', roughness: 0.9, flatShading: false}));
    m.position.set((r() - 0.5) * 2.2, h * 0.6 + r() * h * 0.35, (r() - 0.5) * 2.2);
    m.scale.y = 0.8; g.add(m); leaves.push(m);
  }
  for (let i = 0; i < 4; i++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 2.2, 6), bark); br.position.set((r() - 0.5) * 1.2, h * 0.62, (r() - 0.5) * 1.2); br.rotation.set((r() - 0.5) * 1.4, r() * 6, (r() - 0.5) * 1.4); g.add(br); }
  g.userData.leaves = leaves;
  shadow(g);
  return g;
}

export const SEASON_LEAF = {spring: '#7f9f4f', summer: '#4f6b3a', autumn: '#c0823a', winter: null};

export function streetLamp(h = 4.2) {
  const g = new THREE.Group();
  const metal = M.metal('#2c2f33', 0.5);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, h, 12), metal); pole.position.y = h / 2; g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), metal); arm.rotation.z = Math.PI / 2; arm.position.set(0.4, h - 0.05, 0); g.add(arm);
  const head = box(0.36, 0.08, 0.18, metal, 0.02); head.position.set(0.78, h - 0.1, 0); g.add(head);
  const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), M.emissive('#ffd59a', 0)); bulb.rotation.x = Math.PI / 2; bulb.position.set(0.78, h - 0.145, 0); g.add(bulb);
  g.userData.bulb = bulb; g.userData.lightPos = new THREE.Vector3(0.78, h - 0.3, 0);
  return shadow(g, true, false);
}

export function car(color = '#7d8a93') {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({color, roughness: 0.25, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.05});
  const glass = new THREE.MeshPhysicalMaterial({color: '#1b2026', roughness: 0.05, metalness: 0.2, clearcoat: 1});
  const body = box(1.8, 0.62, 4.4, paint, 0.18, 4); body.position.y = 0.55; g.add(body);
  const cab = box(1.6, 0.55, 2.3, glass, 0.22, 4); cab.position.set(0, 1.08, -0.2); g.add(cab);
  const tire = new THREE.MeshStandardMaterial({color: '#151515', roughness: 0.8});
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 20), tire); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.82, 0.33, sz * 1.35); g.add(w); }
  return shadow(g);
}

export function trophy() {
  const g = new THREE.Group();
  const glassM = new THREE.MeshPhysicalMaterial({color: '#cfe6ee', roughness: 0.03, transmission: 0.0, transparent: true, opacity: 0.38, clearcoat: 1, envMapIntensity: 1.6, ior: 1.5, specularIntensity: 1});
  const base = box(0.09, 0.05, 0.09, new THREE.MeshPhysicalMaterial({color: '#1e1f22', roughness: 0.2, metalness: 0.6, clearcoat: 1}), 0.004); base.position.y = 0.025; g.add(base);
  const shape = new THREE.Shape(); shape.moveTo(-0.04, 0); shape.lineTo(0.04, 0); shape.lineTo(0.025, 0.24); shape.lineTo(-0.035, 0.27); shape.lineTo(-0.04, 0);
  const prism = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: 0.03, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 3}), glassM);
  prism.position.set(0, 0.05, -0.015); g.add(prism);
  g.userData.glass = prism;
  return shadow(g, true, false);
}

export function plinth(w = 0.6, h = 1.0, d = 0.6) {
  return shadow(box(w, h, d, new THREE.MeshPhysicalMaterial({color: '#f1efea', roughness: 0.6}), 0.01));
}
