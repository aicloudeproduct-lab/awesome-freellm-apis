// Құрылыс бөлшектерінің күйі: үйінді → қолда → орнында. Барлық позиция B-ның ішкі сағатына (tau) тәуелді.
import {G, HOUSE, SCHEDULE, rowRect, sillRect} from './constants';
import {V, eio, eo, esine, kf, lerp, lerpV, range} from './util';

export type Piece = (typeof SCHEDULE.pieces)[number] & {arrive?: number; seat?: number; row?: number};
export const PIECES = SCHEDULE.pieces as Piece[];
export const PILE_CX = HOUSE.cx;
const N = PIECES.length;

export type PieceGeom = {w: number; h: number}; // толық бет өлшемі
export function geom(p: Piece): PieceGeom {
  switch (p.kind) {
    case 'sill': return {w: 380, h: 18};
    case 'row': return {w: 380, h: 36};
    case 'door': return {w: HOUSE.door.w, h: HOUSE.door.h};
    case 'window': return {w: HOUSE.win.w, h: HOUSE.win.h};
    default: return {w: 210, h: 140};
  }
}
/** Соңғы орын: бөлшек ортасы (шатыр үшін — табанының ортасы). */
export function finalPos(p: Piece): V {
  if (p.kind === 'sill') { const r = sillRect(p.id === 'sill1' ? 0 : 1); return [r.x + r.w / 2, r.y + r.h / 2]; }
  if (p.kind === 'row') { const r = rowRect(p.row ?? 0); return [r.x + r.w / 2, r.y + r.h / 2]; }
  if (p.kind === 'door') return [HOUSE.door.x + HOUSE.door.w / 2, HOUSE.door.y + HOUSE.door.h / 2];
  if (p.kind === 'window') return [HOUSE.win.x + HOUSE.win.w / 2, HOUSE.win.y + HOUSE.win.h / 2];
  if (p.kind === 'roofL') return [1565, HOUSE.wallTop];
  return [1775, HOUSE.wallTop];
}
export const EDGE = 9; // үйіндідегі қалыңдық (жиегімен жатыр)
export function pilePos(k: number): V { return [PILE_CX, G - (N - 1 - k) * (EDGE + 1) - EDGE / 2]; }
export const isRoof = (p: Piece) => p.kind === 'roofL' || p.kind === 'roofR';

export type PieceState = {
  p: Piece; k: number;
  layer: 'pile' | 'held' | 'placed';
  center: V;        // тақтай/рама ортасы; шатыр үшін табан ортасы
  face: number;     // 0 — жиегімен (жұқа), 1 — бетімен
  frontAlpha: number; // орналастырғаннан кейін алдыңғы көшірменің біртіндеп өшуі
  grips: [V, V] | null; // жақын, алыс қол нүктелері
  settle: number;
};

const carryPos = (p: Piece, hipX: number): V => isRoof(p) ? [hipX + 34, G - 214] : [hipX + 40, G - 150];

export function pieceState(p: Piece, k: number, tau: number, hipXAt: (t: number) => number): PieceState {
  const fin = finalPos(p), pile = pilePos(k);
  const base = {p, k, frontAlpha: 0, settle: 0};
  if (tau < p.pick) return {...base, layer: 'pile', center: pile, face: 0, grips: null};
  const endMove = isRoof(p) ? (p.seat as number) : p.place;
  const startMove = p.arrive ?? p.lifted;
  let center: V, face: number;
  if (tau < p.lifted) {
    // үйіндіден көтеру: алдымен жоғары, сосын кеуде тұсына
    const u = range(tau, p.pick, p.lifted);
    const c = carryPos(p, hipXAt(tau));
    const up: V = [pile[0], Math.min(pile[1], c[1]) - 10];
    center = u < 0.45 ? lerpV(pile, up, eo(u / 0.45)) : lerpV(up, c, esine((u - 0.45) / 0.55));
    face = isRoof(p) ? 0.08 : eio(range(u, 0.25, 1));
  } else if (tau < startMove) {
    center = carryPos(p, hipXAt(tau)); face = isRoof(p) ? 0.08 : 1;
  } else if (tau < endMove) {
    const u = esine(range(tau, startMove, endMove));
    const c = carryPos(p, hipXAt(tau));
    // доға бойымен орнына
    const mid: V = [(c[0] + fin[0]) / 2, Math.min(c[1], fin[1]) - (isRoof(p) ? 18 : 26)];
    const a = lerpV(c, mid, u), b = lerpV(mid, fin, u);
    center = lerpV(a, b, u);
    face = isRoof(p) ? 0.08 : 1;
  } else if (isRoof(p) && tau < p.place) {
    center = fin; face = lerp(0.08, 1, eio(range(tau, p.seat as number, p.place)));
  } else {
    center = fin; face = 1;
  }
  const settle = tau >= p.place ? Math.exp(-(tau - p.place) * 9) * Math.sin((tau - p.place) * 40) * 2.5 : 0;
  if (tau >= p.place) center = [center[0], center[1] + settle];
  const held = tau < p.release;
  const g = geom(p);
  let grips: [V, V] | null = null;
  if (held) {
    if (isRoof(p)) {
      const hgt = g.h * face * 0.22, x = center[0] + (p.kind === 'roofL' ? -4 : 4);
      grips = [[x + 20, center[1] - hgt - 2], [x - 20, center[1] - hgt - 2]];
    } else if (p.kind === 'door' || p.kind === 'window') {
      grips = [[center[0] + 26, center[1] + 6], [center[0] - 26, center[1] + 6]];
    } else if (p.kind === 'sill') {
      // табалдырықты үстіңгі жиегінен ұстайды — жерге қою үшін
      const top = center[1] - (EDGE + (g.h - EDGE) * face) / 2;
      grips = [[center[0] + 12, top], [center[0] - 10, top]];
    } else {
      grips = [[center[0] + 24, center[1] + 2], [center[0] - 22, center[1] + 2]];
    }
  }
  const frontAlpha = tau < p.release ? 1 : 1 - range(tau, p.release, p.release + 0.22);
  return {...base, layer: held ? 'held' : 'placed', center, face, grips, frontAlpha, settle};
}

/** Қол нысанасы: бөлшекке созылу (reach→pick) және босатқаннан кейін қайту. */
export function handBlend(p: Piece, tau: number): {toPiece: number} {
  if (tau < p.reach) return {toPiece: 0};
  if (tau < p.pick) return {toPiece: esine(range(tau, p.reach, p.pick))};
  if (tau < p.release) return {toPiece: 1};
  return {toPiece: 1 - esine(range(tau, p.release, p.release + 0.28))};
}

export function activePiece(tau: number): {p: Piece; k: number} | null {
  for (let k = 0; k < N; k++) { const p = PIECES[k]; if (tau >= p.reach && tau < p.release + 0.28) return {p, k}; }
  return null;
}
export const piecesDone = (tau: number) => PIECES.every(p => tau >= p.release);
export const bWalkX = (tau: number) => kf(tau, SCHEDULE.bWalk as [number, number][]);
