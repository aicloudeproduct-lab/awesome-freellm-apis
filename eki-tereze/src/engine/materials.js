// Material factory: natural skin, cloth, wood, glass, paper, metal.
import * as THREE from 'three';
import * as T from './textures.js';

const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

export const skin = (tone = '#c99a78', seed = 'skin') => memo(`skin:${tone}:${seed}`, () => new THREE.MeshPhysicalMaterial({
  color: '#ffffff', map: T.skinMap(tone, seed), normalMap: T.poreNormal(), normalScale: new THREE.Vector2(0.25, 0.25),
  roughness: 0.52, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffb8a0'),
  specularIntensity: 0.45, vertexColors: false,
}));

/** Skin with vertex colours (beard shadow, lip tint painted on the head mesh). */
export const skinVC = (tone, seed) => memo(`skinVC:${tone}:${seed}`, () => { const m = skin(tone, seed).clone(); m.vertexColors = true; return m; });

export const cloth = (color, kind = 'weave', rough = 0.85, repeat = [4, 4]) => memo(`cloth:${color}:${kind}:${repeat}`, () => new THREE.MeshStandardMaterial({
  color, roughness: rough,
  normalMap: kind === 'knit' ? T.knitNormal(repeat) : T.weaveNormal(64, repeat), normalScale: new THREE.Vector2(0.6, 0.6),
}));

export const hair = (color = '#1d1714') => memo(`hair:${color}`, () => new THREE.MeshStandardMaterial({
  color, roughness: 0.55, metalness: 0.0, normalMap: T.hairNormal(), normalScale: new THREE.Vector2(0.7, 0.7),
}));

export const wood = (seed = 'oak', base = '#8a6240', dark = '#5b3d25', repeat = [1, 1], rough = 0.6) => memo(`wood:${seed}:${base}:${repeat}`, () => new THREE.MeshStandardMaterial({
  map: T.wood(seed, base, dark, repeat), normalMap: T.woodNormal(seed, repeat), normalScale: new THREE.Vector2(0.4, 0.4), roughness: rough,
}));

export const plaster = (base = '#d9cfc0', seed = 'wall', repeat = [2, 2]) => memo(`plaster:${base}:${seed}`, () => new THREE.MeshStandardMaterial({
  map: T.plaster(seed, base, 8, repeat), normalMap: T.plasterNormal(seed, repeat), normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.92,
}));

export const glass = (tint = '#cfe0e8', opacity = 0.18) => memo(`glass:${tint}:${opacity}`, () => new THREE.MeshPhysicalMaterial({
  color: tint, roughness: 0.03, metalness: 0, transparent: true, opacity, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false,
}));

export const paper = (map) => new THREE.MeshStandardMaterial({map, roughness: 0.95, side: THREE.DoubleSide});

export const metal = (color = '#b8b4ac', rough = 0.35) => memo(`metal:${color}:${rough}`, () => new THREE.MeshStandardMaterial({color, roughness: rough, metalness: 1}));

export const matte = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: rough, ...extra});

export const ceramic = (color = '#f2eee6') => memo(`ceramic:${color}`, () => new THREE.MeshPhysicalMaterial({color, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.1}));

export const emissive = (color, intensity = 1) => new THREE.MeshStandardMaterial({color: '#000000', emissive: color, emissiveIntensity: intensity, roughness: 1});
