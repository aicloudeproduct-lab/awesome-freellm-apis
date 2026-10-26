// Еркін жол бойымен жүру: жол — уақыттың функциясы P(t) → [x, z]. Табандар жерде бекітіледі (сырғымайды),
// дене жол жанамасына бұрылады. anim.js-тегі walkFeet жол ұзындығы s(t) бойынша қолданылады.
import * as THREE from 'three';
import {legIK} from './character.js';
import {clamp, walkFeet} from './anim.js';

/** Жолдың доға ұзындығы кестесі [t0, t1] аралығында (1/240 с қадам). */
export function arcTable(P, t0, t1) {
  const dt = 1 / 240, ts = [t0], ss = [0];
  let [px, pz] = P(t0), s = 0;
  for (let t = t0 + dt; t <= t1 + 1e-9; t += dt) { const [x, z] = P(t); s += Math.hypot(x - px, z - pz); px = x; pz = z; ts.push(t); ss.push(s); }
  const sAt = t => { if (t <= t0) return 0; if (t >= ts[ts.length - 1]) return ss[ss.length - 1]; const i = Math.floor((t - t0) / dt); const f = (t - ts[i]) / dt; return ss[i] + (ss[Math.min(i + 1, ss.length - 1)] - ss[i]) * f; };
  return {sAt, total: s};
}

/** Жол бағыты (жанама) бойынша бет бұрышы; жылдамдық ~0 болса, соңғы мағынасы сақталады. */
export function headingAt(P, t, t0, t1) {
  for (const h of [0.08, 0.2, 0.5]) {
    const a = Math.max(t0, t - h), b = Math.min(t1, t + h);
    const [x0, z0] = P(a), [x1, z1] = P(b);
    if (Math.hypot(x1 - x0, z1 - z0) > 1e-3) return Math.atan2(x1 - x0, z1 - z0);
  }
  const [x0, z0] = P(t1 - 0.3), [x1, z1] = P(t1); return Math.atan2(x1 - x0, z1 - z0);
}

/**
 * Кейіпкерді P бойымен жүргізу. tbl — arcTable(P, t0, t1). heading — бет бұрышы (берілмесе, жол жанамасы).
 * Табандар: walkFeet жол ұзындығы бойынша; жергілікті z = s(табан) − s(дене) (жол жергілікті түзу деп алынады).
 */
export function walkAlong(ch, P, tbl, t, t0, base, opts = {}, heading) {
  const wf = walkFeet(tbl.sAt, t, t0, opts);
  const s = tbl.sAt(t), [x, z] = P(t);
  ch.root.position.set(x, opts.y ?? 0, z);
  ch.root.rotation.y = heading ?? headingAt(P, t, t0, opts.t1 ?? t + 1);
  const hipY = (base.hipY ?? 0.93) - Math.abs(wf.phase) * 0.012;
  const pose = {...base, hipY};
  ['L', 'R'].forEach((side, i) => {
    const f = wf.feet[i];
    const ik = legIK(new THREE.Vector3(0, hipY, 0), new THREE.Vector3(0, f.y, f.z - s));
    pose['leg' + side] = {hp: [ik.hp, 0, (i ? -1 : 1) * 0.02], kn: ik.kn, an: [-(ik.hp + ik.kn) * 0.85, 0, 0]};
  });
  const sw = (wf.feet[0].z - wf.feet[1].z) * 1.1;
  if (!base.noSwing) {
    // қарсы қол-аяқ: сол аяқ алда → сол қол артта (иық x бұрышы оң — қол артқа)
    pose.armL = {...(base.armL || {}), sh: [clamp(sw * (opts.armSwing ?? 1), -0.45, 0.45) + ((base.armL || {}).sh?.[0] || 0), 0, 0.07]};
    pose.armR = {...(base.armR || {}), sh: [clamp(-sw * (opts.armSwing ?? 1), -0.45, 0.45) + ((base.armR || {}).sh?.[0] || 0), 0, -0.07]};
  }
  ch.setPose(pose);
  return wf;
}
