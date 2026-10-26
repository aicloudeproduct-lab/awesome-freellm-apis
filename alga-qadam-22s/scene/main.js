// Рендерер, пост-өңдеу, экрандағы мәтін және детерминирленген renderFrame(t) (1080×1920, 9:16).
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {Character} from './character.js';
import {buildWorld} from './world.js';
import {DURATION, cameraAt, heroAt, titlesAt, worldAt} from './timeline.js';

const W = 1080, H = 1920;
const q = new URLSearchParams(location.search);
const scale = parseFloat(q.get('scale') || '1');
const renderer = new THREE.WebGLRenderer({antialias: false, preserveDrawingBuffer: true});
renderer.setPixelRatio(1); renderer.setSize(W * scale, H * scale, false);
renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const stage = document.getElementById('stage');
stage.style.width = W * scale + 'px'; stage.style.height = H * scale + 'px';
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.18;
const world = buildWorld(scene);
const hero = new Character('W'); scene.add(hero.root);
const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 2500);
const S = {scene, world, hero, camera, THREE};

const composer = new EffectComposer(renderer);
composer.setSize(W * scale, H * scale);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W * scale, H * scale), 0.22, 0.6, 0.9));
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass());
// бояу: шамамен монохром (жылы ақ жарыққа сәл ғана реңк), виньетка, нәзік түйір, жұмсақ жарық ауысуы, соңғы сөну
const grade = new ShaderPass({
  uniforms: {tDiffuse: {value: null}, uTime: {value: 0}, uFlash: {value: 0}, uFade: {value: 0}, uRes: {value: new THREE.Vector2(W, H)}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uFlash, uFade; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = mix(vec3(l), c, 0.16) * vec3(1.015, 1.0, 0.975);
      vec2 d = vUv - 0.5; d.y *= 1.4; c *= mix(0.58, 1., smoothstep(0.9, 0.28, length(d)));
      c += uFlash * (0.6 + 0.4*l);
      float g = h(vUv*uRes + fract(uTime*7.31)*vec2(311.,173.)) - 0.5; c += g * 0.028 * (0.4 + 0.6*(1. - l));
      c *= 1. - uFade; gl_FragColor = vec4(c, 1.); }`,
});
composer.addPass(grade);

// ---- мәтін
const titlesEl = document.getElementById('titles');
if (scale !== 1) { titlesEl.style.fontSize = 70 * scale + 'px'; titlesEl.style.top = 300 * scale + 'px'; titlesEl.style.left = titlesEl.style.right = 76 * scale + 'px'; }
let TIMING = null;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function setTitles(t) {
  const list = titlesAt(t, TIMING);
  titlesEl.innerHTML = list.map(T => T.lines.map((parts, i) => {
    const a = T.t0 + i * 0.18, p = Math.min(1, Math.max(0, (t - a) / 0.75)), e = 1 - Math.pow(1 - p, 3);
    const o = Math.min(1, Math.max(0, (t - T.t1) / 0.5)), eo = o * o * (3 - 2 * o);
    const y = (1 - e) * 34 - eo * 18, op = e * (1 - eo);
    const kwp = Math.min(1, Math.max(0, (t - T.key + 0.05) / 0.35)), k = kwp * kwp * (3 - 2 * kwp);
    const html = parts.map(x => typeof x === 'string' ? esc(x).replace(/^ | $/g, '&nbsp;') :
      `<span class="kw" style="color:rgba(255,255,255,${(0.86 + 0.14 * k).toFixed(3)});transform:scale(${(1 + 0.05 * k).toFixed(4)});text-shadow:0 0 ${(28 * k).toFixed(1)}px rgba(255,248,232,${(0.55 * k).toFixed(3)}),0 2px 22px rgba(0,0,0,0.5)">${esc(x.w)}</span>`).join('');
    return `<span class="ln" style="opacity:${op.toFixed(3)};transform:translateY(${(y * scale).toFixed(1)}px)">${html}</span>`;
  }).join('')).join('');
}

window.DURATION = DURATION;
window.__S = S;
window.renderFrame = (t) => {
  heroAt(S, t);
  worldAt(S, t);
  const c = cameraAt(t);
  camera.position.copy(c.pos); camera.lookAt(c.look); camera.fov = c.fov; camera.updateProjectionMatrix();
  renderer.toneMappingExposure = S.exposure;
  grade.uniforms.uTime.value = t; grade.uniforms.uFlash.value = S.flash; grade.uniforms.uFade.value = S.endFade;
  if (!q.has('norender')) composer.render(); else { camera.updateMatrixWorld(); hero.root.updateMatrixWorld(true); }
  setTitles(t);
  return 'ok';
};
window.__ready = Promise.all([document.fonts.load("800 70px 'Noto Sans'"), fetch('../audio/timing.json').then(r => r.json()).then(j => (TIMING = j))]).then(() => true);
