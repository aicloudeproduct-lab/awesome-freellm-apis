import schedule from './schedule.json';

export const W = 2048;
export const H = 1536;
export const FPS = 30;
export const DURATION_FRAMES = 810; // дәл 27 секунд

// Әлем координаталары: жер сызығы (жылтыр су беті) G.
export const G = 1010;

export const PAL = {
  night: '#08090b',
  charcoal: '#101114',
  graphite: '#1c1e22',
  slate: '#2a2d33',
  silver: '#a7abb3',
  ivory: '#ece8de',
  ivoryDim: '#cfcabe',
  wood: '#e7e0d0',
  woodShade: '#c9c0ab',
  woodLine: '#a59a82',
  amber: '#f2b45a',
  amberDeep: '#c9782e',
  amberSoft: '#ffd89a',
};

// Үй геометриясы (әлем координаталары)
export const HOUSE = {
  x0: 1480,
  x1: 1860,
  cx: 1670,
  wallTop: G - 270,
  ridge: G - 410,
  eaveL: 1460,
  eaveR: 1880,
  door: {x: 1515, y: G - 221, w: 90, h: 185}, // рама (сыртқы өлшем)
  win: {x: 1700, y: G - 218, w: 110, h: 108},
};
export const rowRect = (i: number) => ({x: HOUSE.x0, y: G - 36 - (i + 1) * 39 + 3, w: 380, h: 36});
export const sillRect = (i: number) => ({x: HOUSE.x0, y: G - 18 * (i + 1), w: 380, h: 18});

export const SCHEDULE = schedule;

/** B кейіпкерінің ішкі сағаты: 6.8–12.3 с аралығында құрылыс жылдамдайды (timelapse). */
export function tauOf(t: number): number {
  const {S, upStart, upEnd, downStart, downEnd} = schedule.speed;
  const k = S - 1, du = upEnd - upStart, dd = downEnd - downStart;
  const r = (u: number) => u * u * u - (u * u * u * u) / 2; // ∫ smoothstep
  if (t <= upStart) return t;
  if (t <= upEnd) return t + k * du * r((t - upStart) / du);
  if (t <= downStart) return t + k * (du * 0.5 + (t - upEnd));
  if (t <= downEnd) { const u = (t - downStart) / dd; return t + k * (du * 0.5 + (downStart - upEnd) + dd * (u - r(u))); }
  return t + k * (du * 0.5 + (downStart - upEnd) + dd * 0.5);
}
