// Time-of-day palettes. The scene blends neighbouring keys in OKLab with a
// smoothstep, so the sky never jumps between segments.

export type Palette = {
  skyTop: string;
  skyMid: string;
  skyLow: string;
  sun: string;
  glow: string;
  cloud: string;
  ridgeFar: string;
  ridgeNear: string;
  haze: string;
  rockMid: string;
  rockRim: string;
  cliff: string;
  cliffRim: string;
  chasm: string;
  fog: string;
  wood: string;
  woodDark: string;
  rope: string;
  mote: string;
  figure: string;
  pack: string;
  stone: string;
};

export type PaletteKey = {t: number; p: Palette; stars: number; sunXY: [number, number]; sunAlpha: number; fog: number; moon: number};

const night: Palette = {
  skyTop: '#090e18', skyMid: '#111a2a', skyLow: '#1d2839', sun: '#c9d2e6', glow: '#3a4a66', cloud: '#1c2536',
  ridgeFar: '#1b2435', ridgeNear: '#141c2a', haze: '#26324a', rockMid: '#111926', rockRim: '#34435e',
  cliff: '#0b1018', cliffRim: '#3a4862', chasm: '#05080d', fog: '#2c3852', wood: '#3e3c38', woodDark: '#262522',
  rope: '#4d4a43', mote: '#c8d4ea', figure: '#eef1f6', pack: '#4b4c34', stone: '#7b7f84',
};
const dawn: Palette = {
  skyTop: '#243248', skyMid: '#4c5c74', skyLow: '#a3aebb', sun: '#f0f2f4', glow: '#c7cfd8', cloud: '#7d8a9c',
  ridgeFar: '#5d6a80', ridgeNear: '#465268', haze: '#8996a9', rockMid: '#364153', rockRim: '#8593a8',
  cliff: '#1d2430', cliffRim: '#7b8aa0', chasm: '#0e131b', fog: '#8592a5', wood: '#5c574f', woodDark: '#3a3732',
  rope: '#6d675d', mote: '#e8edf4', figure: '#f6f6f4', pack: '#5a5b3d', stone: '#8c8f92',
};
const noon: Palette = {
  skyTop: '#5a7593', skyMid: '#8ea2b7', skyLow: '#d3d8db', sun: '#fffdf6', glow: '#eef0ee', cloud: '#e2e6e8',
  ridgeFar: '#7f8b98', ridgeNear: '#68737f', haze: '#b8c1c9', rockMid: '#545d68', rockRim: '#aab3bb',
  cliff: '#2f353d', cliffRim: '#a4acb3', chasm: '#151a20', fog: '#aeb7c0', wood: '#776a5b', woodDark: '#4d453c',
  rope: '#8a7e6e', mote: '#ffffff', figure: '#ffffff', pack: '#5f603f', stone: '#93959a',
};
const asr: Palette = {
  skyTop: '#55617a', skyMid: '#a8997f', skyLow: '#e6c48d', sun: '#fff0cc', glow: '#f2cf8e', cloud: '#e9caa0',
  ridgeFar: '#867967', ridgeNear: '#6c5f50', haze: '#c9ae86', rockMid: '#544739', rockRim: '#d9b077',
  cliff: '#2c251f', cliffRim: '#d1a96f', chasm: '#16110d', fog: '#c4a984', wood: '#7a5e44', woodDark: '#4c3a2a',
  rope: '#8d7255', mote: '#fff3dc', figure: '#fffaf1', pack: '#62603a', stone: '#97928a',
};
const maghrib: Palette = {
  skyTop: '#2f3255', skyMid: '#875d6c', skyLow: '#dc8f68', sun: '#ffd0a6', glow: '#e9946c', cloud: '#c17b78',
  ridgeFar: '#57455a', ridgeNear: '#433548', haze: '#9b6c76', rockMid: '#382c3b', rockRim: '#cf8a74',
  cliff: '#1c1720', cliffRim: '#c98572', chasm: '#0d0a0f', fog: '#8e6672', wood: '#5b4541', woodDark: '#382a29',
  rope: '#6e5551', mote: '#ffe2d0', figure: '#fff5ef', pack: '#55543a', stone: '#8d8686',
};
const isha: Palette = {
  skyTop: '#04070f', skyMid: '#0a1324', skyLow: '#172748', sun: '#dfe6f5', glow: '#2b3f6c', cloud: '#14203a',
  ridgeFar: '#111c31', ridgeNear: '#0d1527', haze: '#1f3054', rockMid: '#0b1322', rockRim: '#3b5080',
  cliff: '#070b14', cliffRim: '#40568a', chasm: '#020409', fog: '#22355b', wood: '#35373d', woodDark: '#222328',
  rope: '#41434b', mote: '#d3defc', figure: '#eef2ff', pack: '#434532', stone: '#7a7f88',
};

/** sunXY is in screen px (sky layer barely moves with the camera). */
export const PALETTE_KEYS: PaletteKey[] = [
  {t: 0.0, p: night, stars: 0.55, sunXY: [150, 1010], sunAlpha: 0, fog: 0.42, moon: 0},
  {t: 3.0, p: dawn, stars: 0.06, sunXY: [180, 960], sunAlpha: 0.0, fog: 0.5, moon: 0},
  {t: 6.1, p: noon, stars: 0, sunXY: [760, 560], sunAlpha: 0.9, fog: 0.5, moon: 0},
  {t: 8.9, p: asr, stars: 0, sunXY: [880, 760], sunAlpha: 1, fog: 0.46, moon: 0},
  {t: 11.75, p: maghrib, stars: 0.12, sunXY: [790, 935], sunAlpha: 0.95, fog: 0.42, moon: 0},
  {t: 14.6, p: isha, stars: 1, sunXY: [760, 1120], sunAlpha: 0, fog: 0.4, moon: 1},
  {t: 20.0, p: isha, stars: 1, sunXY: [760, 1120], sunAlpha: 0, fog: 0.4, moon: 1},
];

export const MOON = {x: 250, y: 520, r: 26};
