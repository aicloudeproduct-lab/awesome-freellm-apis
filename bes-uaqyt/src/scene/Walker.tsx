// The white line figure, the olive pack with its stones, and falling stones.
import React from 'react';
import {RIG} from '../config/timeline';
import {mix, rgba} from '../lib/color';
import {V} from '../lib/math';
import {Atmos} from '../motion/atmosphere';
import {Joints, LEN} from '../motion/character';
import {releaseTimes} from '../motion/load';
import {PACK_V, PackState, SLOTS, STRAP_LOCAL, packThickness, stoneAt} from '../motion/pack';
import {stonePath} from './geometry';

const H = RIG.H;
const f = (n: number) => n.toFixed(2);
const P = (p: V) => `${f(p.x)} ${f(p.y)}`;

const limb = (pts: V[]) => 'M' + pts.map(P).join('L');

export const StoneDefs: React.FC<{at: Atmos}> = ({at}) => (
  <radialGradient id="stoneG" cx="0.36" cy="0.3" r="0.8">
    <stop offset="0" stopColor={mix(at.p.stone, '#ffffff', 0.28)} />
    <stop offset="0.55" stopColor={at.p.stone} />
    <stop offset="1" stopColor={mix(at.p.stone, '#000000', 0.42)} />
  </radialGradient>
);

const Stone: React.FC<{k: number; r: number; x: number; y: number; rot?: number; scale?: number; opacity?: number}> = ({k, r, x, y, rot = 0, scale = 1, opacity = 1}) => (
  <g transform={`translate(${f(x)} ${f(y)}) rotate(${f((rot * 180) / Math.PI)}) scale(${f(scale)})`} opacity={opacity}>
    <path d={stonePath(`stone-${k}`, r)} fill="url(#stoneG)" stroke="rgba(0,0,0,0.28)" strokeWidth={1} />
  </g>
);

/** The pack in its local frame: X = -u (away from the back), Y = -v (down). */
const PackBody: React.FC<{pack: PackState; t: number; at: Atmos}> = ({pack, t, at}) => {
  const Tk = packThickness(pack.fill);
  const top = -PACK_V.top;
  const bot = -PACK_V.bottom;
  const mid = (top + bot) / 2;
  const slump = pack.empty * 0.035 * H; // empty pack sags on the ground
  const base = mix(at.p.pack, mix(at.p.skyLow, at.p.haze, 0.5), 0.12);
  const dark = mix(base, '#000000', 0.32);
  const light = mix(base, '#ffffff', 0.12);
  const body = `M0 ${f(top + slump * 0.6)} L${f(-Tk * 0.92)} ${f(top + slump)} Q${f(-Tk * 1.13)} ${f(mid)} ${f(-Tk * 0.96)} ${f(bot - 0.02 * H)} Q${f(-Tk * 0.55)} ${f(bot + 0.012 * H)} ${f(-0.012 * H)} ${f(bot)} Z`;
  const pocket = `M${f(-Tk * 0.42)} ${f(mid + 0.012 * H)} L${f(-Tk * 0.98)} ${f(mid + 0.018 * H)} L${f(-Tk * 0.95)} ${f(bot - 0.03 * H)} Q${f(-Tk * 0.7)} ${f(bot - 0.012 * H)} ${f(-Tk * 0.42)} ${f(bot - 0.02 * H)} Z`;
  return (
    <g>
      <path d={body} fill={base} stroke={dark} strokeWidth={1.4} />
      <path d={`M${f(-Tk * 0.18)} ${f(top + 0.02 * H)} Q${f(-Tk * 0.75)} ${f(mid - 0.02 * H)} ${f(-Tk * 0.7)} ${f(bot - 0.03 * H)}`} stroke={light} strokeWidth={2} fill="none" opacity={0.45} />
      <path d={pocket} fill={dark} opacity={0.55} />
      {SLOTS.map((s, k) =>
        t < releaseTimes[k] ? <Stone key={k} k={k} r={s.r} x={-s.u} y={-s.v} rot={k * 0.7} /> : null,
      )}
      {/* rolled rim over the stones */}
      <path d={`M${f(-0.004 * H)} ${f(top + slump * 0.6)} L${f(-Tk * 0.94)} ${f(top + slump)}`} stroke={dark} strokeWidth={0.024 * H} strokeLinecap="round" />
      <path d={`M${f(-0.004 * H)} ${f(top + slump * 0.6 - 1)} L${f(-Tk * 0.94)} ${f(top + slump - 1)}`} stroke={light} strokeWidth={1.4} strokeLinecap="round" opacity={0.6} />
    </g>
  );
};

const packTransform = (pack: PackState) => `translate(${f(pack.xf.o.x)} ${f(pack.xf.o.y)}) rotate(${f((pack.xf.a * 180) / Math.PI)})`;

export const Walker: React.FC<{j: Joints; pack: PackState; t: number; at: Atmos}> = ({j, pack, t, at}) => {
  const white = at.p.figure;
  const far = mix(white, mix(at.p.rockMid, at.p.haze, 0.5), 0.42);
  const w = LEN.line;
  const torso = `M${P(j.P)} Q${P(j.ctrl)} ${P(j.C)} L${P(j.neckTop)}`;
  const legN = limb([j.legN.hip, j.legN.knee, j.legN.ankle, j.legN.toe]);
  const legF = limb([j.legF.hip, j.legF.knee, j.legF.ankle, j.legF.toe]);
  const armN = limb([j.armN.sh, j.armN.elbow, j.armN.hand]);
  const armF = limb([j.armF.sh, j.armF.elbow, j.armF.hand]);
  const halo = 'rgba(8,10,16,0.22)';
  const onBody = pack.mode === 'back';
  const strapA = onBody ? 1 : 0;
  // strap loop from the pack top into the hand while carried
  const strapHand = pack.mode === 'hand';
  const dark = mix(at.p.pack, '#000000', 0.38);
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* separation halo */}
      <g stroke={halo} strokeWidth={w + 5}>
        <path d={legF} />
        <path d={armF} />
        <path d={legN} />
        <path d={torso} />
        <path d={armN} />
      </g>
      <circle cx={j.head.x} cy={j.head.y} r={LEN.headR + 2.5} fill={halo} stroke="none" />
      {/* far limbs */}
      <path d={armF} stroke={far} strokeWidth={w * 0.92} />
      <path d={legF} stroke={far} strokeWidth={w} />
      {/* pack */}
      <g transform={packTransform(pack)}>
        <PackBody pack={pack} t={t} at={at} />
      </g>
      {/* body */}
      <path d={legN} stroke={white} strokeWidth={w} />
      <path d={torso} stroke={white} strokeWidth={w * 1.1} />
      <circle cx={j.head.x} cy={j.head.y} r={LEN.headR} fill={white} stroke="none" />
      {/* near strap over the shoulder, in front of the body */}
      {strapA > 0 && (
        <g transform={packTransform(pack)} opacity={strapA}>
          <path
            d={`M${f(-0.01 * H)} ${f(-PACK_V.top + 0.004 * H)} Q${f(0.035 * H)} ${f(-PACK_V.top - 0.045 * H)} ${f(0.058 * H)} ${f(-PACK_V.top + 0.02 * H)} L${f(0.05 * H)} ${f(-PACK_V.top + 0.13 * H)}`}
            stroke={dark}
            strokeWidth={0.02 * H}
          />
          <path d={`M${f(0.0)} ${f(-PACK_V.bottom - 0.03 * H)} L${f(0.045 * H)} ${f(-PACK_V.bottom - 0.05 * H)}`} stroke={dark} strokeWidth={0.016 * H} opacity={0.9} />
        </g>
      )}
      {strapHand && (
        <g transform={packTransform(pack)}>
          <path d={`M${f(-STRAP_LOCAL.u)} ${f(-STRAP_LOCAL.v)} q${f(0.02 * H)} ${f(0.03 * H)} ${f(0.012 * H)} ${f(0.05 * H)}`} stroke={dark} strokeWidth={0.016 * H} />
        </g>
      )}
      <path d={armN} stroke={white} strokeWidth={w * 0.92} />
    </g>
  );
};

/** Pack resting on the ground after the walker lets go (drawn without the body). */
export const GroundPack: React.FC<{pack: PackState; t: number; at: Atmos}> = ({pack, t, at}) => (
  <g transform={packTransform(pack)} strokeLinecap="round">
    <PackBody pack={pack} t={t} at={at} />
  </g>
);

export const FallingStones: React.FC<{t: number}> = ({t}) => (
  <g>
    {SLOTS.map((s, k) => {
      const st = stoneAt(k, t);
      if (!st || st.alpha <= 0.01) return null;
      const speed = Math.hypot(st.vx, st.vy);
      const ghosts = speed > 380 ? [3, 2, 1] : [];
      return (
        <g key={k}>
          {ghosts.map((g) => (
            <Stone key={g} k={k} r={s.r} x={st.x - (st.vx * g) / 200} y={st.y - (st.vy * g) / 200} rot={st.rot} scale={st.scale} opacity={st.alpha * (0.22 / g)} />
          ))}
          <Stone k={k} r={s.r} x={st.x} y={st.y} rot={st.rot} scale={st.scale} opacity={st.alpha} />
        </g>
      );
    })}
  </g>
);

export const shadowColor = (at: Atmos) => rgba(at.p.chasm, 0.35);
