// Master timeline. Everything that moves is derived from these numbers, so
// retiming the film means editing this file (seconds, world pixels).

export const FPS = 60;
export const DURATION_S = 20;
export const DURATION_FRAMES = FPS * DURATION_S;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Character rig, proportions in units of standing height H (px). */
export const RIG = {
  H: 268,
  thigh: 0.245,
  shin: 0.245,
  ankleH: 0.034,
  foot: 0.108,
  spine: 0.292,
  neck: 0.058,
  headR: 0.064,
  upperArm: 0.168,
  foreArm: 0.162,
  line: 0.034, // stroke width
};

/** Rope bridge, world px. Deck centre line y = 0 on the cliff tops. */
export const BRIDGE = {
  x0: 0,
  x1: 750,
  sag: 54,
  deckHalf: 7, // half depth of the deck band (2.5D)
  plankW: 25,
  plankGap: 3.2,
  railH: 0.5, // hand-rope height, × H
  /** Static deflection under the walker (px) at full load / empty pack. */
  loadDip: [15, 6] as [number, number],
  dipWidth: 210,
};

export const START_X = -64;

/**
 * Walks: from t0 to t1 the pelvis travels `steps` strides. Step length comes
 * from the current load (see GAIT). The first walk starts before frame 0 so
 * the film opens mid-stride.
 */
export const WALKS = [
  {t0: -1.3, t1: 2.75, steps: 5},
  {t0: 4.7, t1: 5.55, steps: 1},
  {t0: 7.4, t1: 8.25, steps: 1},
  {t0: 10.05, t1: 10.9, steps: 1},
  {t0: 12.65, t1: 13.5, steps: 1},
  {t0: 15.2, t1: 16.35, steps: 2},
];

export const GAIT = {
  /** stride length × H at load 1 → load 0 */
  step: [0.27, 0.36] as [number, number],
  accel: 0.42,
  decel: 0.5,
  lift: [0.03, 0.062] as [number, number],
};

/** Prayer moments: start time, duration; the stone leaves at `release` (0..1 of duration). */
export const PRAYERS = [
  {t0: 2.75, dur: 1.95},
  {t0: 5.55, dur: 1.85},
  {t0: 8.25, dur: 1.8},
  {t0: 10.9, dur: 1.75},
  {t0: 13.5, dur: 1.7},
];
export const PRAYER_RELEASE = 0.38;

/** Prayer pose keys as fractions of the prayer duration. */
export const PRAYER_KEYS = {
  squat: 0.12,
  kneel: 0.25,
  sajda: 0.45,
  sajdaHold: 0.55,
  kneel2: 0.74,
  squat2: 0.87,
};

/** The five times of day. `start`/`end` frame the title; colour keys live in palette.ts. */
export const SEGMENTS = [
  {key: 'tan', start: 2.0, end: 4.8},
  {key: 'besin', start: 4.8, end: 7.6},
  {key: 'ekinti', start: 7.6, end: 10.4},
  {key: 'aqsham', start: 10.4, end: 13.2},
  {key: 'quptan', start: 13.2, end: 16.3},
] as const;

/** Taking the empty pack off on the far cliff. */
export const FINALE = {
  t0: 16.35,
  reach: 0.3, // hand to strap
  slip: 0.62, // pack slides off shoulder into hand
  lower: 1.02, // bends, pack touches ground
  release: 1.2,
  rise: 1.75,
  lookUp: [2.3, 3.3] as [number, number],
};

export const CAMERA = {
  smooth: 0.5, // gaussian sigma, seconds
  /** desired screen x of the walker over time */
  screenX: [
    [0, 410],
    [6, 470],
    [13, 500],
    [17, 610],
    [20, 616],
  ] as [number, number][],
  zoom: [
    [0, 0.975],
    [3, 1.0],
    [15.5, 1.0],
    [20, 1.045],
  ] as [number, number][],
  /** crane up at the end (character sinks in frame) */
  crane: [
    [15.6, 0],
    [19.6, 175],
  ] as [number, number][],
  anchorY: 1060, // screen y of the deck line under the walker
};

/** Text cues (seconds). fadeIn/out kept within 0.3–0.5 s per the brief. */
export const TEXT_TIMING = {
  title: {delay: 0.05, hold: 1.75, fadeIn: 0.45, fadeOut: 0.5, rise: 14},
  stone: {delay: 0.12, hold: 1.05, fadeIn: 0.38, fadeOut: 0.45, drift: 12},
  final: {
    lines: [16.75, 17.35, 17.95],
    fadeIn: 0.5,
    rise: 12,
    out: 19.55,
  },
  fadeToBlack: [19.55, 20.0] as [number, number],
  fadeFromBlack: [0, 0.35] as [number, number],
};
