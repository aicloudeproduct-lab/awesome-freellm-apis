// Рендерер, пост-өңдеу және детерминирленген renderFrame(t).
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {TexturePass} from 'three/addons/postprocessing/TexturePass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {Character} from './character.js';
import {buildWorld} from './world.js';
import {skinMaterial, stoneMaterial} from './materials.js';
import {DURATION, setupFilm, shotAt} from './timeline.js';

const W = 2048, H = 1536;
const q = new URLSearchParams(location.search);
const scale = parseFloat(q.get('scale') || '1');
const renderer = new THREE.WebGLRenderer({antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(1);
renderer.setSize(W * scale, H * scale, false);
renderer.domElement.style.width = W * scale + 'px';
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = !q.has('noshadow');
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const world = buildWorld(scene);
const hero = new Character('A');   // кейіпкер: қызғанады, кейін еркіндік табады — оң жол
const other = new Character('B');  // жарық ертерек түсетін адам — сол жол
scene.add(hero.root, other.root);
const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 400);
const composer = new EffectComposer(renderer);
composer.setSize(W * scale, H * scale);
// Сахна бір рет қана рендерленеді: түс + тереңдік текстурасы. GTAO нормальдарды тереңдіктен қалпына келтіреді,
// сондықтан сахнаны екінші рет (normal/depth G-buffer) салудың қажеті жоқ — кадр ~3.5 с жылдам.
const sceneRT = new THREE.WebGLRenderTarget(W * scale, H * scale, {type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(W * scale, H * scale)});
class SceneToTarget extends Pass {
  constructor() { super(); this.needsSwap = false; }
  render(r) { r.setRenderTarget(sceneRT); r.clear(); r.render(scene, camera); }
}
const gbufAO = q.has('depthao'); // тексерілді: SwiftShader-де жылдамырақ емес, сондықтан әдепкі бойынша өшік
if (gbufAO) { composer.addPass(new SceneToTarget()); composer.addPass(new TexturePass(sceneRT.texture)); }
else composer.addPass(new RenderPass(scene, camera));
const aoDiv = parseFloat(q.get('ao') || '2'); // AO буфері ажыратымдылықтың 1/aoDiv бөлігінде (жылдамдық)
const gtao = new GTAOPass(scene, camera, Math.round(W * scale / aoDiv), Math.round(H * scale / aoDiv));
if (gbufAO) gtao.setGBuffer(sceneRT.depthTexture); // конструкторға беру three r185-те normalRenderTarget жоқ болғандықтан құлайды
gtao.updateGtaoMaterial({radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12});
gtao.blendIntensity = 0.85;
if (!q.has('noao')) composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(W * scale, H * scale), 0.16, 0.5, 0.93);
if (!q.has('nobloom')) composer.addPass(bloom);
composer.addPass(new OutputPass());
if (!q.has('nosmaa')) composer.addPass(new SMAAPass());
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

if (q.has('noshaft')) { world.shaftA.visible = world.shaftB.visible = false; }
if (q.has('std')) scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial) { const m = o.material; o.material = new THREE.MeshStandardMaterial({color: m.color, roughness: m.roughness, normalMap: m.normalMap, normalScale: m.normalScale}); } });
const S = {scene, camera, world, hero, other, THREE};
setupFilm(S);
scene.add(camera);
// камера кеңістігіндегі алдыңғы план: кейіпкердің алақаны (wipe) және тас бағана (wipe)
const palm = new THREE.Group();
{ const skin = skinMaterial(); const p = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.2, 0.05, 4, 0.03), skin); palm.add(p);
  for (let f = 0; f < 4; f++) { const fg = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, 0.13, 6, 12), skin); fg.position.set((f - 1.5) * 0.037, 0.17 - Math.abs(f - 1.5) * 0.012, 0); palm.add(fg); }
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.09, 6, 12), skin); th.position.set(-0.1, 0.02, 0.01); th.rotation.z = 0.8; palm.add(th);
  palm.rotation.z = -0.25; camera.add(palm); }
const pillar = new THREE.Mesh(new RoundedBoxGeometry(0.9, 6, 0.9, 2, 0.03), stoneMaterial({seed: 9, tiles: 2, base: '#2f333a', rough: 0.7, repeat: [1, 4]}));
camera.add(pillar);

const titleEl = document.getElementById('title');
if (scale !== 1) { const st = document.getElementById('stage'); st.style.width = W * scale + 'px'; st.style.height = H * scale + 'px'; titleEl.style.fontSize = 76 * scale + 'px'; titleEl.style.top = 214 * scale + 'px'; }
function setTitle(T, t) {
  if (!T || t < T.t0) { titleEl.innerHTML = ''; return; }
  const lines = T.html.split('<br>');
  titleEl.innerHTML = lines.map((l, i) => {
    const a = T.t0 + i * 0.45, p = Math.min(1, Math.max(0, (t - a) / 0.9)), e = 1 - Math.pow(1 - p, 3);
    const out = Math.min(1, Math.max(0, (t - T.t1 + 0.1 * (lines.length - i)) / 0.6));
    return `<div style="overflow:hidden;padding:0.06em 0 0.14em"><div style="transform:translateY(${((1 - e) * 110 + out * -110).toFixed(1)}%);opacity:${(e * (1 - out)).toFixed(3)}">${l}</div></div>`;
  }).join('');
}

function resetFrame() {
  S.title = null; S.palmWipe = null; S.pillarWipe = 0; S.shade = 0.1; S.exposure = 0.95; S.endFade = 0; S.fogDensity = 0.028; S.envIntensity = 0.35;
  S.family.forEach(c => (c.root.visible = false)); S.dwelling.userData.warm.intensity = 0; S.dwelling.userData.glow.material.opacity = 0;
  S.pool.material.opacity = 0; S.pool.position.set(-1.45, 0.104, -1.0);
  S.ownLight.position.set(3.4, 17.5, -10); S.ownLight.target.position.set(1.45, 0, -8);
  world.coolSpot.color.set('#c8d2e0'); world.shaftB.material.uniforms.uColor.value.set('#c9d3e2'); world.coolSpot.position.set(3.4, 17.5, -2);
  world.amber.position.set(-3.2, 17.5, -2.0);
  [hero, other].forEach(c => { c.root.visible = true; c.root.scale.setScalar(1); });
}

window.DURATION = DURATION;
window.__S = S;
window.renderFrame = (t) => {
  resetFrame();
  const shot = shotAt(t);
  shot.fn(S, t);
  renderer.toneMappingExposure = S.exposure;
  scene.environmentIntensity = S.envIntensity;
  scene.fog.density = S.fogDensity;
  world.dustA.update(t); world.dustB.update(t);
  world.shaftA.material.uniforms.uTime.value = t; world.shaftB.material.uniforms.uTime.value = t;
  palm.visible = !!S.palmWipe; if (S.palmWipe) palm.position.set(S.palmWipe.x * 0.32, -0.02 + S.palmWipe.y * 0.02, -0.26);
  pillar.visible = S.pillarWipe > 0 && S.pillarWipe < 2; if (pillar.visible) pillar.position.set(1.3 - S.pillarWipe * 1.3, 0, -0.9);
  grade.uniforms.uTime.value = t; grade.uniforms.uVig.value = 0.42 + (S.shade - 0.1) * 0.9; grade.uniforms.uFade.value = S.endFade;
  if (q.has('norender')) { S.camera.updateMatrixWorld(); return shot.name; } // дыбыс оқиғаларын алу үшін (tools/events.mjs)
  if (q.has('direct')) renderer.render(scene, camera); else composer.render();
  setTitle(S.title, t);
  return shot.name;
};
window.__ready = document.fonts.ready.then(() => true);
