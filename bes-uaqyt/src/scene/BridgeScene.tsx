// Cliffs and the rope bridge, drawn in the bridge plane (parallax 1). The deck
// is a thin 2.5D band: far edge above the walking line, near edge below.
import React from 'react';
import {BRIDGE, RIG} from '../config/timeline';
import {mix, rgba} from '../lib/color';
import {Atmos} from '../motion/atmosphere';
import {deckY, taper} from '../motion/bridge';
import {geometry, pathOf, Pt} from './geometry';

const H = RIG.H;
const D = BRIDGE.deckHalf;
const RAIL = BRIDGE.railH * H;
const POST_L = BRIDGE.x0 - 16;
const POST_R = BRIDGE.x1 + 16;

const railY = (x: number, t: number, side: -1 | 1) => {
  // the hand rope follows the deck and hangs a little between suspenders
  const base = x < BRIDGE.x0 ? 0 : x > BRIDGE.x1 ? 0 : deckY(x, t);
  return base + side * D - RAIL - 6 + taper(x) * 10 + 0.8 * Math.sin(t * 1.7 + x * 0.01);
};

const ropePath = (t: number, side: -1 | 1) => {
  const pts: Pt[] = [];
  for (let x = POST_L; x <= POST_R; x += 12) pts.push([x, railY(Math.min(x, POST_R), t, side)]);
  pts.push([POST_R, railY(POST_R, t, side)]);
  return pathOf(pts, false);
};

const edgePath = (t: number, side: -1 | 1, extra = 0) => {
  const pts: Pt[] = [];
  for (let x = BRIDGE.x0 - 4; x <= BRIDGE.x1 + 4; x += 10) pts.push([x, deckY(Math.min(Math.max(x, BRIDGE.x0), BRIDGE.x1), t) + side * D + extra]);
  return pathOf(pts, false);
};

export const Cliffs: React.FC<{t: number; at: Atmos}> = ({at}) => {
  const g = geometry();
  const p = at.p;
  const top = mix(p.cliff, p.cliffRim, 0.32);
  const strata = mix(p.cliff, p.cliffRim, 0.16);
  return (
    <g>
      <path d={pathOf(g.leftFace)} fill={p.cliff} />
      <path d={pathOf(g.rightFace)} fill={p.cliff} />
      {g.strata.map((s, i) => (
        <path key={i} d={`M${s.x0} ${s.y}L${s.x1} ${s.y1}`} stroke={strata} strokeWidth={2} strokeLinecap="round" opacity={0.35} />
      ))}
      {/* top surfaces */}
      <path d={`M-1700 -12 L-30 -12 Q-6 -11 -2 4 L-4 14 L-1700 14 Z`} fill={top} />
      <path d={`M2600 -12 L${BRIDGE.x1 + 30} -12 Q${BRIDGE.x1 + 6} -11 ${BRIDGE.x1 + 2} 4 L${BRIDGE.x1 + 4} 14 L2600 14 Z`} fill={top} />
      <path d={`M-1700 -12 L-30 -12 Q-6 -11 -2 4`} stroke={rgba(p.cliffRim, 0.75)} strokeWidth={2} fill="none" />
      <path d={`M2600 -12 L${BRIDGE.x1 + 30} -12 Q${BRIDGE.x1 + 6} -11 ${BRIDGE.x1 + 2} 4`} stroke={rgba(p.cliffRim, 0.75)} strokeWidth={2} fill="none" />
      {g.pebbles.map((pb, i) => (
        <ellipse key={i} cx={pb.x} cy={pb.y} rx={pb.r} ry={pb.r * 0.62} fill={mix(top, p.cliff, 0.45)} />
      ))}
      {g.tufts.map((tf, i) => (
        <path
          key={i}
          d={`M${tf.x} ${tf.near ? 9 : -6} q${tf.lean * 6} ${-tf.h * 0.6} ${tf.lean * 10 + 2} ${-tf.h} M${tf.x + 3} ${tf.near ? 9 : -6} q${tf.lean * 4} ${-tf.h * 0.5} ${tf.lean * 6 + 5} ${-tf.h * 0.75}`}
          stroke={mix(top, p.cliffRim, 0.5)}
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
};

const Post: React.FC<{x: number; side: -1 | 1; color: string; dark: string; t: number}> = ({x, side, color, dark, t}) => {
  const w = side > 0 ? 9 : 7;
  const y0 = side * D + 4;
  const top = side * D - RAIL - 18;
  return (
    <g>
      <rect x={x - w / 2} y={top} width={w} height={y0 - top} rx={2} fill={side > 0 ? color : dark} />
      <path d={`M${x - w / 2 - 1} ${railY(x, t, side) - 2}h${w + 2}M${x - w / 2 - 1} ${railY(x, t, side) + 3}h${w + 2}`} stroke={dark} strokeWidth={1.6} />
    </g>
  );
};

/** Far rope, far suspenders, posts and planks (behind the walker). */
export const BridgeBack: React.FC<{t: number; at: Atmos}> = ({t, at}) => {
  const g = geometry();
  const p = at.p;
  const rope = mix(p.rope, p.haze, 0.25);
  const ropeFar = mix(p.rope, p.haze, 0.4);
  const susp: React.ReactNode[] = [];
  for (let i = 0; i < g.planks.length; i += 2) {
    const x = (g.planks[i].xa + g.planks[i].xb) / 2;
    susp.push(<path key={i} d={`M${x} ${railY(x, t, -1)}L${x} ${deckY(x, t) - D}`} stroke={ropeFar} strokeWidth={1.4} />);
  }
  return (
    <g>
      {/* anchor ropes into the ground */}
      <path d={`M${POST_L} ${-D - RAIL - 10}L${POST_L - 70} -8M${POST_R} ${-D - RAIL - 10}L${POST_R + 70} -8`} stroke={ropeFar} strokeWidth={1.6} />
      <Post x={POST_L + 4} side={-1} color={p.wood} dark={mix(p.woodDark, p.haze, 0.2)} t={t} />
      <Post x={POST_R - 4} side={-1} color={p.wood} dark={mix(p.woodDark, p.haze, 0.2)} t={t} />
      <path d={ropePath(t, -1)} stroke={ropeFar} strokeWidth={2} fill="none" />
      {susp}
      {/* support ropes under the plank ends */}
      <path d={edgePath(t, -1, 1)} stroke={rope} strokeWidth={2} fill="none" />
      {g.planks.map((pl, i) => {
        const ya = deckY(pl.xa, t);
        const yb = deckY(pl.xb, t);
        const top = mix(p.wood, pl.tone > 0 ? '#ffffff' : '#000000', Math.abs(pl.tone) * 0.5);
        return (
          <g key={i}>
            <path d={`M${pl.xa} ${ya - D + pl.skew * 0.3}L${pl.xb} ${yb - D - pl.skew * 0.3}L${pl.xb} ${yb + D}L${pl.xa} ${ya + D}Z`} fill={top} />
            <path d={`M${pl.xa} ${ya + D}L${pl.xb} ${yb + D}L${pl.xb} ${yb + D + 4.5}L${pl.xa} ${ya + D + 4.5}Z`} fill={p.woodDark} />
          </g>
        );
      })}
      <path d={edgePath(t, 1, 5)} stroke={p.rope} strokeWidth={2.2} fill="none" />
    </g>
  );
};

/** Near rope, near suspenders and near posts (in front of the walker). */
export const BridgeFront: React.FC<{t: number; at: Atmos}> = ({t, at}) => {
  const g = geometry();
  const p = at.p;
  const susp: React.ReactNode[] = [];
  for (let i = 1; i < g.planks.length; i += 2) {
    const x = (g.planks[i].xa + g.planks[i].xb) / 2;
    susp.push(<path key={i} d={`M${x} ${railY(x, t, 1)}L${x} ${deckY(x, t) + D + 3}`} stroke={p.rope} strokeWidth={1.7} opacity={0.9} />);
  }
  return (
    <g>
      <path d={`M${POST_L} ${D - RAIL - 8}L${POST_L - 64} 12M${POST_R} ${D - RAIL - 8}L${POST_R + 64} 12`} stroke={p.rope} strokeWidth={2} />
      {susp}
      <path d={ropePath(t, 1)} stroke={p.rope} strokeWidth={2.6} fill="none" opacity={0.95} />
      <Post x={POST_L} side={1} color={p.wood} dark={p.woodDark} t={t} />
      <Post x={POST_R} side={1} color={p.wood} dark={p.woodDark} t={t} />
    </g>
  );
};
