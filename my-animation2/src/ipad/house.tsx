import React from 'react';
import {G, HOUSE, PAL} from './constants';
import {EDGE, PIECES, PieceState, geom, isRoof} from './pieces';
import {V, lerp, rng} from './util';

/** Ағаш тақтай: талшық сызықтары, бұтақ іздері, шеге — бәрі seed бойынша детерминирленген. */
export const Plank: React.FC<{x: number; y: number; w: number; h: number; seed: number; nails?: boolean; tone?: number}> = ({x, y, w, h, seed, nails = true, tone = 0}) => {
  const r = rng(seed);
  const lines: string[] = [];
  const nLines = h > 20 ? 4 : h > 12 ? 2 : 1;
  for (let i = 0; i < nLines; i++) {
    const fy = (i + 0.5 + (r() - 0.5) * 0.4) / nLines, amp = 0.6 + r() * 1.4, ph = r() * 6, fr = 0.012 + r() * 0.02;
    let d = '';
    for (let xx = 0; xx <= w; xx += 12) d += `${xx ? 'L' : 'M'}${(x + xx).toFixed(1)},${(y + fy * h + Math.sin(xx * fr + ph) * amp).toFixed(1)}`;
    lines.push(d);
  }
  const knot = h > 20 && r() < 0.7 ? {cx: x + 30 + r() * (w - 60), cy: y + h * (0.35 + r() * 0.3), rx: 5 + r() * 5} : null;
  const shade = tone ? `rgba(16,17,20,${tone})` : null;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill="url(#woodGrad)" stroke={PAL.woodLine} strokeWidth={1.1} />
      {lines.map((d, i) => <path key={i} d={d} fill="none" stroke="#b5aa91" strokeWidth={0.9} opacity={0.55} />)}
      {knot && <ellipse cx={knot.cx} cy={knot.cy} rx={knot.rx} ry={knot.rx * 0.45} fill="none" stroke="#a3977d" strokeWidth={1} opacity={0.7} />}
      {nails && h > 14 && (
        <>
          <circle cx={x + 8} cy={y + h / 2} r={1.8} fill="#6d665a" />
          <circle cx={x + w - 8} cy={y + h / 2} r={1.8} fill="#6d665a" />
        </>
      )}
      <rect x={x} y={y} width={w} height={Math.min(2, h / 4)} fill="#fbf8f1" opacity={0.55} />
      {shade && <rect x={x} y={y} width={w} height={h} fill={shade} />}
    </g>
  );
};

/** Есік рамасы мен есік жапқышы. open: 1 — жабық, 0.16 — ашық (топса сол жақта). */
export const DoorUnit: React.FC<{open: number; warm: number; interior?: React.ReactNode}> = ({open, warm, interior}) => {
  const d = HOUSE.door, t = 9, ix = d.x + t, iy = d.y + t, iw = d.w - 2 * t, ih = d.h - t;
  const slabW = iw * open;
  return (
    <g>
      <rect x={ix} y={iy} width={iw} height={ih} fill={warm > 0 ? 'url(#interiorGrad)' : '#0c0d10'} />
      {warm > 0 && <rect x={ix} y={iy} width={iw} height={ih} fill="#0c0d10" opacity={1 - warm} />}
      {interior}
      {/* жапқыш: тік тақтайлар + Z-тірек */}
      <g>
        <rect x={ix} y={iy} width={slabW} height={ih} fill="url(#woodGradDoor)" stroke={PAL.woodLine} strokeWidth={1} />
        {[1, 2].map(i => <line key={i} x1={ix + (slabW * i) / 3} y1={iy + 2} x2={ix + (slabW * i) / 3} y2={iy + ih - 2} stroke="#a89d84" strokeWidth={1} opacity={0.8} />)}
        <path d={`M${ix + 4},${iy + ih * 0.78} L${ix + slabW - 4},${iy + ih * 0.3}`} stroke="#b9ae95" strokeWidth={5} opacity={0.75} />
        <rect x={ix} y={iy} width={slabW} height={ih} fill="#0d0e11" opacity={(1 - open) * 0.55} />
        <circle cx={ix + slabW - 9 * open} cy={G - 120} r={3.2} fill="#5d564a" />
      </g>
      <Plank x={d.x} y={d.y} w={d.w} h={t} seed={801} nails={false} />
      <Plank x={d.x} y={d.y} w={t} h={d.h} seed={802} nails={false} />
      <Plank x={d.x + d.w - t} y={d.y} w={t} h={d.h} seed={803} nails={false} />
    </g>
  );
};

/** Терезе: рама, айқас бөліктер, шыны (ай шағылысы немесе жылы жарық) және іштегі сұлба. */
export const WindowUnit: React.FC<{warm: number; moon: number; inside?: React.ReactNode}> = ({warm, moon, inside}) => {
  const w = HOUSE.win, t = 8, gx = w.x + t, gy = w.y + t, gw = w.w - 2 * t, gh = w.h - 2 * t;
  return (
    <g>
      <rect x={gx} y={gy} width={gw} height={gh} fill="#111317" />
      <rect x={gx} y={gy} width={gw} height={gh} fill="url(#windowWarm)" opacity={warm} />
      <path d={`M${gx + gw * 0.15},${gy + gh} L${gx + gw * 0.55},${gy}`} stroke="#d8dce3" strokeWidth={10} opacity={0.06 * moon * (1 - warm)} />
      <g clipPath="url(#winClip)">{inside}</g>
      <Plank x={w.x} y={w.y} w={w.w} h={t} seed={901} nails={false} />
      <Plank x={w.x} y={w.y + w.h - t} w={w.w + 8} h={t + 2} seed={902} nails={false} />
      <Plank x={w.x} y={w.y} w={t} h={w.h} seed={903} nails={false} />
      <Plank x={w.x + w.w - t} y={w.y} w={t} h={w.h} seed={904} nails={false} />
    </g>
  );
};

/** Шатырдың жарты-фронтон панелі (табан ортасы — бас нүкте). Оң панель — айналы. */
export const RoofPanel: React.FC<{side: 'L' | 'R'; base: V; face: number}> = ({side, base, face}) => {
  const sx = side === 'L' ? 1 : -1;
  const boards = [];
  for (let i = 0; i < 10; i++) {
    const x = -105 + i * 21, top = -(140 * (x + 105)) / 210;
    boards.push(<line key={i} x1={x} y1={-1} x2={x} y2={top + 1} stroke="#a99e86" strokeWidth={1} opacity={0.75} />);
  }
  const d: V = [0.832, -0.555], n: V = [-0.555, -0.832];
  const p0: V = [-105 - 26 * d[0], 0 - 26 * d[1]], p1: V = [105 + 10 * d[0], -140 + 10 * d[1]];
  const board = `M${p0[0]},${p0[1]} L${p1[0]},${p1[1]} L${p1[0] + n[0] * 17},${p1[1] + n[1] * 17} L${p0[0] + n[0] * 17},${p0[1] + n[1] * 17} Z`;
  return (
    <g transform={`translate(${base[0]},${base[1]}) scale(${sx},${Math.max(0.02, face)})`}>
      <path d="M-105,0 L105,0 L105,-140 Z" fill="url(#woodGradGable)" stroke={PAL.woodLine} strokeWidth={1} />
      {boards}
      <path d={board} fill="url(#woodGrad)" stroke={PAL.woodLine} strokeWidth={1.1} />
      <path d={`M${p0[0] + n[0] * 6},${p0[1] + n[1] * 6} L${p1[0] + n[0] * 6},${p1[1] + n[1] * 6}`} stroke="#b5aa91" strokeWidth={1} opacity={0.6} />
      <path d={`M${p0[0] + n[0] * 12},${p0[1] + n[1] * 12} L${p1[0] + n[0] * 12},${p1[1] + n[1] * 12}`} stroke="#b5aa91" strokeWidth={0.8} opacity={0.45} />
    </g>
  );
};

/** Бөлшекті өз күйінде салу (қолда немесе орнында). */
export const PieceView: React.FC<{st: PieceState; door?: React.ReactNode; win?: React.ReactNode; alpha?: number}> = ({st, door, win, alpha = 1}) => {
  const {p, center, face} = st, g = geom(p);
  let node: React.ReactNode;
  if (isRoof(p)) node = <RoofPanel side={p.kind === 'roofL' ? 'L' : 'R'} base={center} face={face} />;
  else if (p.kind === 'door' || p.kind === 'window') {
    const sy = Math.max(0.05, face);
    const unit = p.kind === 'door' ? door : win;
    const final = p.kind === 'door' ? [HOUSE.door.x + HOUSE.door.w / 2, HOUSE.door.y + HOUSE.door.h / 2] : [HOUSE.win.x + HOUSE.win.w / 2, HOUSE.win.y + HOUSE.win.h / 2];
    node = <g transform={`translate(${center[0]},${center[1]}) scale(1,${sy}) translate(${-final[0]},${-final[1]})`}>{unit}</g>;
  } else {
    const h = lerp(EDGE, g.h, face);
    node = <Plank x={center[0] - g.w / 2} y={center[1] - h / 2} w={g.w} h={h} seed={100 + st.k * 17} nails={face > 0.6} />;
  }
  return <g opacity={alpha}>{node}</g>;
};

/** Үйінді: әр бөлшек жиегімен жатыр (ең үстіңгісі — бірінші қолданылатын). */
export const PileView: React.FC<{states: PieceState[]}> = ({states}) => (
  <g>
    {states.filter(s => s.layer === 'pile').map(s => {
      const g = geom(s.p);
      const w = isRoof(s.p) ? 210 : g.w;
      return <Plank key={s.p.id} x={s.center[0] - w / 2} y={s.center[1] - EDGE / 2} w={w} h={EDGE} seed={300 + s.k * 11} nails={false} />;
    })}
  </g>
);

export const pieceOrder = PIECES.map(p => p.id);
