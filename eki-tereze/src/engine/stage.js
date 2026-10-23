// Renderer + post + text overlay, shared by the film and tests.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {Post} from './post.js';

export function createStage() {
  const q = new URLSearchParams(location.search);
  const W = +q.get('w') || 2160, H = Math.round((W * 16) / 9);
  const renderer = new THREE.WebGLRenderer({antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  const overlay = document.createElement('canvas');
  overlay.width = W; overlay.height = H;
  document.body.appendChild(overlay);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const post = new Post(renderer, W, H);
  return {renderer, overlay, ctx: overlay.getContext('2d'), env, post, W, H, scale: W / 2160};
}
