// MakeHuman-based character (CC0 base mesh, built by tools/mh/build_chars.py):
// SkinnedMesh with multi-material groups, identity-oriented rest bones,
// two-bone IK that respects rest directions, finger curls, expression morphs,
// eye pivots for gaze, breathing and blinking.
import * as THREE from 'three';
import {clamp, lerp, rng, smooth, noise1} from '../lib/util.js';
import * as M from '../engine/materials.js';

let SHARED = null;
const fetchBin = async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer());
const view = (bin, b) => {
  const T = {float32: Float32Array, uint32: Uint32Array, uint16: Uint16Array}[b.dtype];
  return new T(bin.buffer.slice(bin.byteOffset + b.offset, bin.byteOffset + b.offset + b.length));
};

export async function loadShared(base = '../assets/chars/') {
  if (SHARED) return SHARED;
  const meta = await (await fetch(base + 'shared.json')).json();
  const bin = await fetchBin(base + 'shared.bin');
  const B = {};
  for (const [k, b] of Object.entries(meta.buffers)) B[k] = view(bin, b);
  const eyeTex = await new THREE.TextureLoader().loadAsync(base + 'eye_brown.png');
  eyeTex.colorSpace = THREE.SRGBColorSpace; eyeTex.anisotropy = 8;
  SHARED = {meta, B, eyeTex, base};
  return SHARED;
}

export async function loadCharacter(id, look) {
  const S = await loadShared();
  const meta = await (await fetch(S.base + id + '.json')).json();
  const bin = await fetchBin(S.base + id + '.bin');
  const skin = await new THREE.TextureLoader().loadAsync(S.base + id + '_skin.jpg');
  skin.colorSpace = THREE.SRGBColorSpace; skin.anisotropy = 8; skin.flipY = true;
  return new MHuman(S, meta, bin, skin, look);
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _v = new THREE.Vector3();

/** Rotation taking frame (a1, a2) to (b1, b2) — two non-parallel direction pairs. */
function frameRot(a1, a2, b1, b2) {
  const x1 = a1.clone().normalize(), z1 = new THREE.Vector3().crossVectors(x1, a2).normalize(), y1 = new THREE.Vector3().crossVectors(z1, x1);
  const x2 = b1.clone().normalize(), z2 = new THREE.Vector3().crossVectors(x2, b2).normalize(), y2 = new THREE.Vector3().crossVectors(z2, x2);
  const A = new THREE.Matrix4().makeBasis(x1, y1, z1), Bm = new THREE.Matrix4().makeBasis(x2, y2, z2);
  return new THREE.Quaternion().setFromRotationMatrix(Bm.multiply(A.transpose()));
}

export class MHuman {
  /** look: {top:{color,kind,region:'top'|'tee'}, pants, shoes, hairColor, scarf, skirt, glasses} */
  constructor(S, meta, bin, skinTex, look) {
    this.meta = meta; this.look = look; this.id = meta.id;
    const n = S.meta.vertexCount, ne = S.meta.eyeVertexCount;
    const pos = new Float32Array(bin.buffer, bin.byteOffset, n * 3);
    const nrm = new Float32Array(bin.buffer.slice(bin.byteOffset + n * 12, bin.byteOffset + n * 24));
    const eyePos = new Float32Array(bin.buffer.slice(bin.byteOffset + n * 24, bin.byteOffset + n * 24 + ne * 12));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(S.B.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(S.B.skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(S.B.skinWeight, 4));
    g.setIndex(new THREE.BufferAttribute(S.B.index, 1));
    { // RGBA vertex colour: only the hair material reads it (soft hairline)
      const c = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { c[i * 4] = 1; c[i * 4 + 1] = 1; c[i * 4 + 2] = 1; c[i * 4 + 3] = S.B.alpha ? S.B.alpha[i] : 1; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 4));
    }
    // expression morphs (scaled for smaller faces)
    const fs = meta.faceScale;
    const K = S.meta.expr.length;
    g.morphAttributes.position = [];
    for (let k = 0; k < K; k++) {
      const src = S.B.morph.subarray(k * n * 3, (k + 1) * n * 3);
      const a = new Float32Array(src.length);
      for (let i = 0; i < src.length; i++) a[i] = src[i] * fs;
      g.morphAttributes.position.push(new THREE.BufferAttribute(a, 3));
    }
    g.morphTargetsRelative = true;
    this.exprIndex = Object.fromEntries(S.meta.expr.map((e, i) => [e, i]));
    // material groups
    const skinMat = new THREE.MeshPhysicalMaterial({map: skinTex, roughness: 0.5, sheen: 0.3, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ff9f8a'),
      specularIntensity: 0.42, normalMap: (M.skin('#c08c6c', 'pores').normalMap), normalScale: new THREE.Vector2(0.12, 0.12)});
    skinMat.normalMap = skinMat.normalMap.clone(); skinMat.normalMap.repeat.set(24, 24); skinMat.normalMap.needsUpdate = true;
    const mats = [], add = (group, mat) => { const gr = S.meta.groups[group]; if (!gr) return; g.addGroup(gr[0], gr[1], mats.length); mats.push(mat); };
    add('body', skinMat);
    // body parts hidden under worn garments are simply not drawn
    const wearsTop = look.top && (look.top.region || 'top') === 'top', wearsTee = look.top && look.top.region === 'tee';
    if (!wearsTop && !wearsTee) add('b_tee', skinMat);
    if (!wearsTop) add('b_sleeves', skinMat);
    if (!look.pants) add('b_legs', skinMat);
    if (!look.shoes) add('b_feet', skinMat);
    add('teeth', new THREE.MeshPhysicalMaterial({color: '#b3a893', roughness: 0.5, clearcoat: 0.15}));
    add('tongue', new THREE.MeshPhysicalMaterial({color: '#b4605c', roughness: 0.4, clearcoat: 0.4}));
    add('lashes', new THREE.MeshStandardMaterial({color: '#3a2c24', roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 0.55}));
    const cloth = (spec, rep) => (spec.kind === 'knit' ? M.cloth(spec.color, 'knit', 0.9, rep || [60, 45]) : M.cloth(spec.color, 'weave', spec.rough ?? 0.85, rep || [40, 40]));
    if (look.top) add(look.top.region || 'top', cloth(look.top));
    if (look.pants) add('pants', cloth(look.pants));
    if (look.skirt) add('skirt', cloth(look.skirt));
    if (look.shoes) add('shoes', new THREE.MeshPhysicalMaterial({color: look.shoes, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4}));
    if (look.hair) {
      const hm = new THREE.MeshPhysicalMaterial({color: look.hair, roughness: 0.58, specularIntensity: 0.35, envMapIntensity: 0.45, sheen: 0.35, sheenRoughness: 0.45, sheenColor: new THREE.Color(look.hair).lerp(new THREE.Color('#8a6a52'), 0.4),
        normalMap: M.hair(look.hair).normalMap, normalScale: new THREE.Vector2(0.25, 0.25), vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: true, alphaTest: 0.02});
      add('hair', hm); this.hairMat = hm;
    }
    if (look.scarf) { const sm = cloth({color: look.scarf, kind: 'weave'}, [20, 20]).clone(); sm.side = THREE.DoubleSide; sm.vertexColors = true; sm.alphaTest = 0.5; add('scarf', sm); } // alpha carries the scarf edge
    this.skinMat = skinMat;
    // skeleton (rest: identity rotations at joint heads)
    const bones = [], byName = {};
    const J = meta.joints;
    for (const b of S.meta.bones) {
      const bone = new THREE.Bone(); bone.name = b.name;
      const h = J[b.name][0];
      if (b.parent) { const ph = J[b.parent][0]; bone.position.set(h[0] - ph[0], h[1] - ph[1], h[2] - ph[2]); byName[b.parent].add(bone); }
      else bone.position.set(h[0], h[1], h[2]);
      bones.push(bone); byName[b.name] = bone;
    }
    this.bones = byName;
    const mesh = (this.mesh = new THREE.SkinnedMesh(g, mats));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    const rootBone = bones[0];
    mesh.add(rootBone);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.morphTargetInfluences.fill(0);
    this.root = new THREE.Group(); this.root.name = meta.id; this.root.add(mesh);
    this.rest = Object.fromEntries(Object.keys(byName).map((k) => [k, new THREE.Vector3(...J[k][0])]));
    this.restTail = Object.fromEntries(Object.keys(byName).map((k) => [k, new THREE.Vector3(...J[k][1])]));
    // eyes: split the proxy into two rigid meshes on pivots at the eye joints
    this.eyes = [];
    const eyeMat = new THREE.MeshPhysicalMaterial({map: S.eyeTex, roughness: 0.35, color: '#cdbfb4'});
    // cornea adds only its reflections (catchlights) on top of the iris
    const corneaMat = new THREE.MeshPhysicalMaterial({color: '#000000', roughness: 0.06, specularIntensity: 1, envMapIntensity: 0.5, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false});
    for (const side of ['L', 'R']) {
      const c = this.rest['eye.' + side];
      const sel = [], map = new Map();
      const idx = S.B.eyeIndex;
      const want = (i) => (side === 'L' ? eyePos[i * 3] > 0 : eyePos[i * 3] <= 0);
      const P = [], U = [], Ib = [], Ic = [];
      const uvc = (v) => [S.B.eyeUV[v * 2], S.B.eyeUV[v * 2 + 1]];
      for (let t = 0; t < idx.length; t += 3) {
        if (!want(idx[t])) continue;
        const cu = (uvc(idx[t])[0] + uvc(idx[t + 1])[0] + uvc(idx[t + 2])[0]) / 3, cv = (uvc(idx[t])[1] + uvc(idx[t + 1])[1] + uvc(idx[t + 2])[1]) / 3;
        const cornea = cu > 0.82 && cv < 0.22;
        for (let k = 0; k < 3; k++) {
          const v = idx[t + k];
          if (!map.has(v)) { map.set(v, P.length / 3); P.push(eyePos[v * 3] - c.x, eyePos[v * 3 + 1] - c.y, eyePos[v * 3 + 2] - c.z); U.push(...uvc(v)); }
          (cornea ? Ic : Ib).push(map.get(v));
        }
      }
      const pivot = new THREE.Object3D();
      const headB = byName['head'];
      pivot.position.copy(c).sub(this.rest['head']);
      headB.add(pivot);
      for (const [I, mat] of [[Ib, eyeMat], [Ic, corneaMat]]) {
        const eg = new THREE.BufferGeometry();
        eg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        eg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
        eg.setIndex(I); eg.computeVertexNormals();
        const em = new THREE.Mesh(eg, mat); em.castShadow = false; em.receiveShadow = mat === eyeMat;
        pivot.add(em);
      }
      this.eyes.push({pivot, side});
    }
    if (look.glasses) this.buildGlasses();
    // collars / cuffs / hems: soft rings along garment edges, attached to bones
    for (const rg of meta.rings || []) {
      const worn = rg.region === 'pants' ? look.pants : (look.top && (look.top.region || 'top') === rg.region);
      if (!worn) continue;
      const spec = rg.region === 'pants' ? look.pants : look.top;
      const isNeck = rg.bone.startsWith('neck') || rg.bone.startsWith('spine01') || rg.bone.startsWith('clavicle');
      const tube = isNeck ? 0.009 : 0.0065;
      const mat = cloth(spec);
      const boneName = rg.bone.startsWith('neck') ? 'spine01' : rg.bone;
      const bone = byName[boneName];
      // tube along the smoothed garment edge (rest pose, relative to the bone)
      const o = this.rest[boneName];
      const curve = new THREE.CatmullRomCurve3(rg.pts.map((p) => new THREE.Vector3(p[0] - o.x, p[1] - o.y, p[2] - o.z)), true, 'centripetal');
      const ring = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, tube, 8, true), mat);
      ring.castShadow = true; ring.receiveShadow = true;
      // pants hem rings hidden under shoes look fine; skip the tiny crotch/armpit loops
      if (rg.radius < 0.025) continue;
      // sleeve cuffs twist with the wrist; a rigid tube there floats off the arm
      if (rg.bone.startsWith('lowerarm')) continue;
      bone.add(ring);
    }
    this.lm = meta.landmarks;
    this.height = meta.landmarks.height;
    this.noise = {gaze: noise1(meta.id + 'g'), gazeY: noise1(meta.id + 'gy'), sway: noise1(meta.id + 's')};
    const r = rng(meta.id + 'blink'); this.blinks = []; let t = 0.4 + r() * 2;
    while (t < 200) { this.blinks.push(t); t += 2.4 + r() * 3.4 - (r() < 0.15 ? 1.6 : 0); }
    this.fingerAxes = {};
    for (const s of ['L', 'R']) this.fingerAxes[s] = this.computeFingerAxes(s);
    this.armLen = {L: this.chainLens('L', 'arm'), R: this.chainLens('R', 'arm')};
    this.legLen = {L: this.chainLens('L', 'leg'), R: this.chainLens('R', 'leg')};
  }

  buildGlasses() {
    const L = this.rest['eye.L'], R = this.rest['eye.R'], H = this.rest['head'];
    const d = L.distanceTo(R);
    const frame = new THREE.MeshPhysicalMaterial({color: '#2a2320', roughness: 0.28, clearcoat: 0.9});
    const lens = M.glass('#e8eef0', 0.1);
    const g = new THREE.Group(); this.bones['head'].add(g);
    const zf = 0.026 * (d / 0.064);
    for (const e of [L, R]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(d * 0.36, 0.0016, 10, 48), frame); rim.scale.set(1.08, 0.78, 1);
      rim.position.set(e.x - H.x, e.y - H.y - 0.001, e.z - H.z + zf); g.add(rim);
      const l = new THREE.Mesh(new THREE.CircleGeometry(d * 0.36, 40), lens); l.scale.copy(rim.scale); l.position.copy(rim.position); g.add(l);
      const sx = Math.sign(e.x);
      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.003, 0.105), frame);
      temple.position.set(e.x - H.x + sx * d * 0.4, e.y - H.y + 0.002, e.z - H.z + zf - 0.052); temple.rotation.y = -sx * 0.08; g.add(temple);
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(d * 0.12, 0.0014, 6, 20, Math.PI), frame);
    bridge.position.set(0, L.y - H.y + 0.002, L.z - H.z + zf + 0.002); g.add(bridge);
  }

  chainLens(s, kind) {
    const r = this.rest;
    if (kind === 'arm') return [r['upperarm01.' + s].distanceTo(r['lowerarm01.' + s]), r['lowerarm01.' + s].distanceTo(r['wrist.' + s])];
    return [r['upperleg01.' + s].distanceTo(r['lowerleg01.' + s]), r['lowerleg01.' + s].distanceTo(r['foot.' + s])];
  }

  computeFingerAxes(s) {
    const r = this.rest, out = {};
    const across = r['finger5-1.' + s].clone().sub(r['finger2-1.' + s]).normalize();
    const along = r['finger3-2.' + s].clone().sub(r['finger3-1.' + s]).normalize();
    const palm = new THREE.Vector3().crossVectors(along, across).multiplyScalar(s === 'L' ? 1 : -1).normalize();
    for (let f = 1; f <= 5; f++) {
      for (let j = 1; j <= 3; j++) {
        const name = `finger${f}-${j}.${s}`;
        const dir = this.restTail[name].clone().sub(r[name]).normalize();
        // curl axis: rotate the finger towards the palm side
        const ax = new THREE.Vector3().crossVectors(dir, palm).normalize();
        out[name] = ax;
      }
    }
    this.palmN = this.palmN || {}; this.palmN[s] = palm;
    return out;
  }

  // ---------------------------------------------------------------- posing
  /**
   * pose: {x,y,z,ry, hip:[dx,dy,dz], pelvis:[x,y,z], spine:[x,y,z], neck:[x,y,z], head:[x,y,z],
   *        clav:{L:[..],R:[..]}, armL/armR:{ik:Vector3(world wrist), pole, wr:[x,y,z], curl, thumb}
   *        legL/legR:{ik:Vector3(world ankle), pole, pitch}, face:{...}, breathe}
   * Angles in radians about the character's local axes (X right→left, Y up, Z forward).
   */
  setPose(p, t) {
    const B = this.bones;
    this.root.position.set(p.x || 0, p.y || 0, p.z || 0);
    this.root.rotation.set(0, p.ry || 0, 0);
    for (const b of Object.values(B)) b.quaternion.identity();
    const rootB = B['root'];
    rootB.position.set(this.rest['root'].x + (p.hip?.[0] || 0), this.rest['root'].y + (p.hip?.[1] || 0), this.rest['root'].z + (p.hip?.[2] || 0));
    const E = (e, order = 'YXZ') => _q.setFromEuler(new THREE.Euler(e?.[0] || 0, e?.[1] || 0, e?.[2] || 0, order));
    rootB.quaternion.copy(E(p.pelvis));
    const br = (p.breathe ?? 1) * Math.sin(t * Math.PI * 2 * (p.breathRate ?? 0.23) + this.id.length);
    const sp = p.spine || [0, 0, 0];
    const spineW = {spine05: 0.15, spine04: 0.22, spine03: 0.24, spine02: 0.21, spine01: 0.18};
    for (const [name, w] of Object.entries(spineW)) {
      const e = [sp[0] * w + (name === 'spine02' ? -0.012 * br : 0), sp[1] * w, sp[2] * w];
      B[name].quaternion.copy(E(e));
    }
    const nk = p.neck || [0, 0, 0];
    for (const [name, w] of Object.entries({neck01: 0.4, neck02: 0.35, neck03: 0.25})) B[name].quaternion.copy(E([nk[0] * w, nk[1] * w, nk[2] * w]));
    B['head'].quaternion.copy(E(p.head));
    for (const s of ['L', 'R']) {
      const c = p.clav?.[s] || [0, 0, 0];
      B['clavicle.' + s].quaternion.copy(E([c[0], c[1], (c[2] || 0) + (s === 'L' ? 1 : -1) * 0.012 * br]));
    }
    this.root.updateMatrixWorld(true);
    for (const s of ['L', 'R']) {
      const a = p['arm' + s] || {};
      const ik = a.ik || this.restHand(s, a.hang ?? 0);
      this.solveChain(s, 'arm', ik, a.pole);
      // forearm twist (pronation/supination) split over the twist bone + wrist; wrist flex/deviation
      if (a.twist || a.flex || a.dev) {
        const fore = this.rest['wrist.' + s].clone().sub(this.rest['lowerarm01.' + s]).normalize();
        const palm = this.palmN[s];
        const flexAx = new THREE.Vector3().crossVectors(fore, palm).normalize();
        const tw = (a.twist || 0) * (s === 'L' ? 1 : -1);
        B['lowerarm02.' + s].quaternion.setFromAxisAngle(fore, tw * 0.5);
        const qw = new THREE.Quaternion().setFromAxisAngle(fore, tw * 0.5);
        qw.multiply(new THREE.Quaternion().setFromAxisAngle(flexAx, a.flex || 0));
        qw.multiply(new THREE.Quaternion().setFromAxisAngle(palm, (a.dev || 0) * (s === 'L' ? 1 : -1)));
        B['wrist.' + s].quaternion.copy(qw);
      }
      if (a.wr) B['wrist.' + s].quaternion.multiply(E(a.wr));
      this.root.updateMatrixWorld(true);
      this.curl(s, a.curl ?? 0.28, a.thumb ?? 0.3, a.spread ?? 0.05);
    }
    for (const s of ['L', 'R']) {
      const l = p['leg' + s] || {};
      const ik = l.ik || this.root.localToWorld(new THREE.Vector3(this.rest['foot.' + s].x * 0.96, this.rest['foot.' + s].y, this.rest['foot.' + s].z));
      this.solveChain(s, 'leg', ik, l.pole);
      this.root.updateMatrixWorld(true);
      // foot flat (plus pitch)
      const want = new THREE.Quaternion().setFromEuler(new THREE.Euler(l.pitch || 0, (p.ry || 0) + (l.yaw || 0), 0, 'YXZ'));
      const parentQ = B['foot.' + s].parent.getWorldQuaternion(new THREE.Quaternion());
      B['foot.' + s].quaternion.copy(parentQ.invert().multiply(want));
      if (l.toe) for (let k = 1; k <= 5; k++) B[`toe${k}-1.${s}`].quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), l.toe);
    }
    this.root.updateMatrixWorld(true);
    this.setFace(p.face || {}, t);
  }

  /** Default relaxed hand position (world) beside the thigh. */
  restHand(s, hang = 0) {
    const r = this.rest, sx = s === 'L' ? 1 : -1;
    const sh = this.bones['upperarm01.' + s].getWorldPosition(new THREE.Vector3());
    const L = this.armLen[s][0] + this.armLen[s][1];
    const local = new THREE.Vector3(sx * 0.03, -L * 0.97, 0.05 + hang * 0.2);
    // in character space: hang below the shoulder slightly forward
    const q = this.root.getWorldQuaternion(new THREE.Quaternion());
    return sh.add(local.applyQuaternion(q));
  }

  /** Two-bone IK: upper (A) and lower (B) bones keep their rest frames; end = wrist / foot head. */
  solveChain(s, kind, target, poleW) {
    const B = this.bones;
    const [a, b, e] = kind === 'arm' ? ['upperarm01.' + s, 'lowerarm01.' + s, 'wrist.' + s] : ['upperleg01.' + s, 'lowerleg01.' + s, 'foot.' + s];
    const A = B[a], Bb = B[b];
    const r = this.rest;
    const restU = r[b].clone().sub(r[a]), restF = r[e].clone().sub(r[b]);
    const la = restU.length(), lb = restF.length();
    // rest bend normal (fallback for straight rests)
    let restN = new THREE.Vector3().crossVectors(restU, restF);
    if (restN.lengthSq() < 1e-10) restN = kind === 'arm' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(1, 0, 0);
    restN.normalize();
    // character-space frames: everything below is in world space
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    const restUw = restU.clone().applyQuaternion(rootQ), restFw = restF.clone().applyQuaternion(rootQ), restNw = restN.clone().applyQuaternion(rootQ);
    const Aw = A.getWorldPosition(new THREE.Vector3());
    const sx = s === 'L' ? 1 : -1;
    const pole = poleW || (kind === 'arm'
      ? A.localToWorld(new THREE.Vector3(sx * 0.25, -0.25, -0.45))
      : this.root.localToWorld(new THREE.Vector3(r[a].x * 1.2, r[a].y - 0.3, 1.0)));
    let d = target.clone().sub(Aw);
    let dist = d.length();
    dist = clamp(dist, Math.abs(la - lb) + 1e-4, (la + lb) * 0.9995);
    d.normalize();
    const cosA = clamp((la * la + dist * dist - lb * lb) / (2 * la * dist), -1, 1);
    const ang = Math.acos(cosA);
    let pv = pole.clone().sub(Aw); pv.sub(d.clone().multiplyScalar(pv.dot(d)));
    if (pv.lengthSq() < 1e-10) pv = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQ);
    pv.normalize();
    const Ew = Aw.clone().add(d.clone().multiplyScalar(Math.cos(ang) * la)).add(pv.clone().multiplyScalar(Math.sin(ang) * la));
    const Tw = Aw.clone().add(d.clone().multiplyScalar(dist));
    const dirU = Ew.clone().sub(Aw), dirF = Tw.clone().sub(Ew);
    let desN = new THREE.Vector3().crossVectors(dirU, dirF);
    if (desN.lengthSq() < 1e-12) desN = restNw.clone();
    desN.normalize();
    // keep bend sense consistent with rest
    const qA = frameRot(restUw, restNw.clone().cross(restUw), dirU, desN.clone().cross(dirU));
    const qB = frameRot(restFw, restNw.clone().cross(restFw), dirF, desN.clone().cross(dirF));
    // world rotation of the bone (relative to rest-identity) = qX * rootQ ; local = inv(parentWorld) * world
    const setWorld = (bone, qw) => {
      const pw = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      bone.quaternion.copy(pw.invert().multiply(qw.clone().multiply(rootQ)));
      bone.updateMatrixWorld(true);
    };
    setWorld(A, qA);
    setWorld(Bb, qB);
  }

  curl(s, c, thumb, spread) {
    const C = Array.isArray(c) ? c : [c, c, c, c];
    const ax = this.fingerAxes[s];
    for (let f = 2; f <= 5; f++) {
      const k = C[f - 2];
      for (let j = 1; j <= 3; j++) {
        const name = `finger${f}-${j}.${s}`;
        const amt = k * [1.15, 1.35, 1.0][j - 1];
        this.bones[name].quaternion.setFromAxisAngle(ax[name], amt);
      }
    }
    for (let j = 1; j <= 3; j++) {
      const name = `finger1-${j}.${s}`;
      this.bones[name].quaternion.setFromAxisAngle(ax[name], thumb * [0.4, 0.6, 0.7][j - 1]);
    }
  }

  // ---------------------------------------------------------------- face
  blinkAt(t) {
    let c = 0;
    for (const b of this.blinks) {
      const d = t - b;
      if (d < -0.1 || d > 0.4) continue;
      c = Math.max(c, d < 0.06 ? smooth(-0.02, 0.06, d) : 1 - smooth(0.06, 0.24, d));
    }
    return c;
  }

  /** f: {look: Vector3, yaw, pitch, blink, open, squint, smile, sad, tense, brow, browIn, frown, talk:{open,round}, jaw, still} */
  setFace(f, t) {
    const I = this.exprIndex, inf = this.mesh.morphTargetInfluences;
    inf.fill(0);
    // gaze
    let yaw = f.yaw || 0, pitch = f.pitch || 0;
    const head = this.bones['head'];
    if (f.look) {
      const mid = this.eyes[0].pivot.getWorldPosition(new THREE.Vector3()).add(this.eyes[1].pivot.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
      const hq = head.getWorldQuaternion(new THREE.Quaternion()).invert();
      const dl = f.look.clone().sub(mid).applyQuaternion(hq);
      yaw = Math.atan2(dl.x, dl.z); pitch = Math.atan2(dl.y, Math.hypot(dl.x, dl.z));
    }
    if (!f.still) {
      yaw += 0.022 * this.noise.gaze(t * 1.6) * Math.sign(this.noise.gaze(t * 0.55) + 0.2);
      pitch += 0.015 * this.noise.gazeY(t * 1.25);
    }
    yaw = clamp(yaw, -0.6, 0.6); pitch = clamp(pitch, -0.5, 0.4);
    for (const e of this.eyes) e.pivot.quaternion.setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
    const blink = Math.max(f.noBlink ? 0 : this.blinkAt(t), f.blink || 0);
    const lookDown = Math.max(0, -pitch) * 0.7;
    inf[I.blink] = clamp(blink + lookDown * 0.45 + (1 - (f.open ?? 1)) * 0.6 + (f.tense || 0) * 0.08);
    inf[I.squint] = clamp((f.squint || 0) + (f.smile || 0) * 0.35);
    inf[I.wide] = clamp((f.wide || 0) + Math.max(0, pitch) * 0.6);
    inf[I.browUp] = clamp((f.brow || 0) + (f.wide || 0) * 0.6);
    inf[I.browInner] = clamp((f.browIn || 0) + (f.sad || 0) * 0.85);
    inf[I.browDown] = clamp((f.tense || 0) * 0.55 + (f.browDown || 0));
    const talk = f.talk || {open: 0, round: 0};
    inf[I.jaw] = clamp(talk.open * 0.55 + (f.jaw || 0));
    inf[I.pucker] = clamp(talk.round * 0.5 + (f.pucker || 0));
    inf[I.wideLips] = clamp(talk.open * (1 - talk.round) * 0.25 + (f.smile || 0) * 0.15);
    inf[I.smile] = clamp(f.smile || 0);
    inf[I.frown] = clamp((f.frown || 0) + (f.sad || 0) * 0.4);
    inf[I.press] = clamp((f.tense || 0) * 0.7 + (f.press || 0));
    inf[I.upperUp] = clamp(talk.open * 0.12);
  }

  headWorld() { return this.bones['head'].localToWorld(new THREE.Vector3(0, 0.1 * this.meta.faceScale, 0.02)); }
  eyesWorld() { return this.eyes[0].pivot.getWorldPosition(new THREE.Vector3()).add(this.eyes[1].pivot.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5); }
  handWorld(s) { return this.bones['finger3-1.' + s].getWorldPosition(new THREE.Vector3()); }
  boneWorld(n) { return this.bones[n].getWorldPosition(new THREE.Vector3()); }
}
