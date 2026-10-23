// Slow tracking camera: a gaussian-smoothed follow of the walker (looks a
// little ahead and behind in time, so starts/stops are eased), plus a gentle
// push-in and crane-up for the ending.

import {CAMERA, FPS} from '../config/timeline';
import {pws} from '../lib/math';
import {deckY} from './bridge';
import {baseX} from './gait';

const T0 = -3;
const T1 = 23;
const N = Math.round((T1 - T0) * FPS);
let cache: {x: Float64Array; y: Float64Array} | null = null;

const build = () => {
  if (cache) return cache;
  const rawX = new Float64Array(N + 1);
  const rawY = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const t = T0 + i / FPS;
    const x = baseX(t);
    rawX[i] = x;
    rawY[i] = deckY(x, t) * 0.75;
  }
  const sig = CAMERA.smooth * FPS;
  const R = Math.ceil(sig * 3);
  const w: number[] = [];
  for (let k = -R; k <= R; k++) w.push(Math.exp(-(k * k) / (2 * sig * sig)));
  const sx = new Float64Array(N + 1);
  const sy = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    let ax = 0;
    let ay = 0;
    let ws = 0;
    for (let k = -R; k <= R; k++) {
      const j = Math.min(N, Math.max(0, i + k));
      const wk = w[k + R];
      ax += rawX[j] * wk;
      ay += rawY[j] * wk;
      ws += wk;
    }
    sx[i] = ax / ws;
    sy[i] = ay / ws;
  }
  cache = {x: sx, y: sy};
  return cache;
};

export type Cam = {x: number; y: number; zoom: number};

/** Camera at time t: world point (x, y) maps to screen (540, anchorY). */
export const cameraAt = (t: number): Cam => {
  const c = build();
  const f = (t - T0) * FPS;
  const i = Math.min(N - 1, Math.max(0, Math.floor(f)));
  const u = f - i;
  const sx = c.x[i] + (c.x[i + 1] - c.x[i]) * u;
  const sy = c.y[i] + (c.y[i + 1] - c.y[i]) * u;
  const zoom = pws(CAMERA.zoom, t);
  const screenX = pws(CAMERA.screenX, t);
  const crane = pws(CAMERA.crane, t);
  return {x: sx - (screenX - 540) / zoom, y: sy - crane / zoom, zoom};
};

/** World → screen for a layer with parallax factor p (1 = the bridge plane). */
export const toScreen = (cam: Cam, wx: number, wy: number, p = 1) => {
  const z = 1 + (cam.zoom - 1) * p;
  return {x: 540 + (wx - cam.x * p) * z, y: CAMERA.anchorY + (wy - cam.y * p) * z};
};
