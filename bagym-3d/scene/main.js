// Рендерер, пост-өңдеу және детерминирленген renderFrame(t).
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {Character} from './character.js';
import {PATH, buildFamily, buildSteps, buildWorld} from './world.js';
import {stoneMaterial} from './materials.js';
import {TEST_SHOTS} from './shots.js';

const W = 2048, H = 1536;
const q = new URLSearchParams(location.search);
const scale = parseFloat(q.get('scale') || '1');
const renderer = new THREE.WebGLRenderer({antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(1);
renderer.setSize(W * scale, H * scale, false);
renderer.domElement.style.width = W * scale + 'px';
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const world = buildWorld(scene);
const hero = new Character('A');   // қызғанып, кейін еркіндік табатын кейіпкер — оң жол
const other = new Character('B');  // жарық ертерек түсетін кейіпкер — сол жол
scene.add(hero.root, other.root);
const steps = buildSteps(scene, PATH.ax, -3.0, 21);
const family = buildFamily(scene, new THREE.Vector3(-4.2, 0, -30));
const blockMat = stoneMaterial({seed: 17, tiles: 1, base: '#4d525b', grout: false, rough: 0.55});
const heldBlock = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.3, 0.42, 3, 0.03), blockMat); heldBlock.castShadow = true; heldBlock.receiveShadow = true; scene.add(heldBlock);
const heroBlock = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.3, 0.42, 3, 0.03), blockMat); heroBlock.castShadow = true; heroBlock.receiveShadow = true; scene.add(heroBlock);

const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 400);
const composer = new EffectComposer(renderer);
composer.setSize(W * scale, H * scale);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, W * scale, H * scale);
gtao.updateGtaoMaterial({radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12});
gtao.blendIntensity = 0.85;
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(W * scale, H * scale), 0.22, 0.55, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass());
const grade = new ShaderPass({
  uniforms: {tDiffuse: {value: null}, uTime: {value: 0}, uVig: {value: 0.42}, uGrain: {value: 0.035}, uFade: {value: 0}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uFade; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*0.0)*43758.5453); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 d = vUv - 0.5; d.x *= 1.333; float v = smoothstep(0.85, 0.25, length(d)); c *= mix(1. - uVig, 1., v);
      float g = h(vUv*vec2(2048.,1536.) + fract(uTime*7.31)*vec2(311.,173.)) - 0.5; c += g*uGrain*(0.35 + 0.65*(1. - dot(c, vec3(.33))));
      c *= 1. - uFade; gl_FragColor = vec4(c, 1.); }`,
});
composer.addPass(grade);

const S = {scene, camera, world, hero, other, steps, family, heldBlock, heroBlock, THREE};
window.renderFrame = (t, shotName) => {
  const shot = TEST_SHOTS[shotName] || Object.values(TEST_SHOTS)[0];
  shot(S, t);
  world.dustA.update(t); world.dustB.update(t);
  world.shaftA.material.uniforms.uTime.value = t; world.shaftB.material.uniforms.uTime.value = t;
  grade.uniforms.uTime.value = t;
  composer.render();
  const txt = document.getElementById('title');
  txt.innerHTML = S.title || '';
  txt.style.opacity = S.titleOpacity ?? 0;
};
window.__ready = document.fonts.ready.then(() => true);
