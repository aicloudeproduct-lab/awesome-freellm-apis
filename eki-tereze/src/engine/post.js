// Single-pass finishing: depth of field (CoC from depth), transition blend
// with a second shot, colour grade, ACES tone map, vignette, fine grain.
import * as THREE from 'three';

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const frag = /* glsl */ `
#include <common>
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform sampler2D tPrev; uniform float uMix; uniform int uMode;
uniform float uNear; uniform float uFar; uniform float uFocus; uniform float uAperture; uniform float uMaxBlur;
uniform vec2 uRes; uniform float uAspect;
uniform float uExposure; uniform float uSat; uniform vec3 uTint; uniform float uLift; uniform float uContrast;
uniform float uVignette; uniform float uGrain; uniform float uTime; uniform float uFlash; uniform vec3 uFlashColor;
uniform float uPrevExposure;
varying vec2 vUv;

float linDepth(float d) { float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
float coc(float d) { float z = linDepth(d); return clamp(uAperture * abs(z - uFocus) / max(z, 0.01) / max(uFocus, 0.01), 0.0, 1.0) * uMaxBlur; }

const int N = 14;
vec3 dof(vec2 uv) {
  float c0 = coc(texture2D(tDepth, uv).r);
  vec3 sum = texture2D(tColor, uv).rgb; float w = 1.0;
  if (c0 < 0.0009) return sum;
  float golden = 2.39996323;
  for (int i = 1; i < N; i++) {
    float r = sqrt(float(i) / float(N)); float a = float(i) * golden;
    vec2 o = vec2(cos(a), sin(a)) * r * c0; o.x /= uAspect;
    vec2 suv = uv + o;
    float cs = coc(texture2D(tDepth, suv).r);
    float k = smoothstep(0.0, 1.0, cs / max(c0, 1e-4) + 0.25);
    sum += texture2D(tColor, suv).rgb * k; w += k;
  }
  return sum / w;
}

vec3 grade(vec3 c, float exposure) {
  c *= exposure;
  c *= uTint;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = c + uLift * (1.0 - c) * 0.08;
  return c;
}

void main() {
  vec3 c = grade(dof(vUv), uExposure);
  if (uMix > 0.0) {
    vec3 p = grade(texture2D(tPrev, vUv).rgb, uPrevExposure);
    float m = uMix;
    if (uMode == 1) { // soft vertical curtain wipe: current shot grows from the left edge
      m = smoothstep(uMix - 0.07, uMix + 0.07, vUv.x);
    }
    c = mix(c, p, m);
  }
  c = mix(c, uFlashColor, uFlash);
  vec4 o = vec4(c, 1.0);
  gl_FragColor = o;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec2 q = vUv - 0.5; q.x *= uAspect;
  float vig = 1.0 - uVignette * smoothstep(0.35, 1.05, length(q) * 1.25);
  float n = fract(sin(dot(vUv * uRes + uTime * 61.7, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  gl_FragColor.rgb = gl_FragColor.rgb * vig + n * uGrain;
  gl_FragColor.rgb = (gl_FragColor.rgb - 0.5) * uContrast + 0.5;
}`;

export class Post {
  constructor(renderer, W, H) {
    this.r = renderer;
    const mk = () => {
      const rt = new THREE.WebGLRenderTarget(W, H, {type: THREE.HalfFloatType, samples: 0});
      rt.depthTexture = new THREE.DepthTexture(W, H);
      rt.depthTexture.type = THREE.UnsignedIntType;
      return rt;
    };
    this.rtA = mk();
    this.rtB = mk();
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        tColor: {value: null}, tDepth: {value: null}, tPrev: {value: null}, uMix: {value: 0}, uMode: {value: 0},
        uNear: {value: 0.1}, uFar: {value: 100}, uFocus: {value: 2}, uAperture: {value: 0}, uMaxBlur: {value: 0.012},
        uRes: {value: new THREE.Vector2(W, H)}, uAspect: {value: W / H},
        uExposure: {value: 1}, uPrevExposure: {value: 1}, uSat: {value: 1}, uTint: {value: new THREE.Vector3(1, 1, 1)}, uLift: {value: 0}, uContrast: {value: 1},
        uVignette: {value: 0.35}, uGrain: {value: 0.012}, uTime: {value: 0}, uFlash: {value: 0}, uFlashColor: {value: new THREE.Color(1, 0.95, 0.85)},
      },
      depthTest: false, depthWrite: false,
    });
    this.mat.toneMapped = true;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** look: {focus, aperture, exposure, sat, tint:[r,g,b], lift, contrast, vignette, grain, flash, flashColor} */
  /** Render the outgoing shot into the second buffer (call before posing the incoming one). */
  renderPrev(scene, camera) {
    this.r.setRenderTarget(this.rtB);
    this.r.render(scene, camera);
    this.r.setRenderTarget(null);
  }

  render(scene, camera, look, t, prev = null) {
    const r = this.r, u = this.mat.uniforms;
    if (prev) {
      u.tPrev.value = this.rtB.texture;
      u.uMix.value = prev.mix;
      u.uMode.value = prev.mode || 0;
      u.uPrevExposure.value = prev.look?.exposure ?? 1;
    } else u.uMix.value = 0;
    const P = window.__prof;
    if (P) P.mark('pre');
    r.setRenderTarget(this.rtA);
    r.render(scene, camera);
    if (P) { P.mark('scene'); P.info = {...r.info.render}; }
    r.setRenderTarget(null);
    u.tColor.value = this.rtA.texture;
    u.tDepth.value = this.rtA.depthTexture;
    u.uNear.value = camera.near; u.uFar.value = camera.far;
    u.uFocus.value = look.focus ?? 3;
    u.uAperture.value = look.aperture ?? 0;
    u.uMaxBlur.value = look.maxBlur ?? 0.012;
    u.uExposure.value = look.exposure ?? 1;
    u.uSat.value = look.sat ?? 1;
    const tint = look.tint ?? [1, 1, 1];
    u.uTint.value.set(tint[0], tint[1], tint[2]);
    u.uLift.value = look.lift ?? 0;
    u.uContrast.value = look.contrast ?? 1;
    u.uVignette.value = look.vignette ?? 0.35;
    u.uGrain.value = look.grain ?? 0.012;
    u.uTime.value = t;
    u.uFlash.value = look.flash ?? 0;
    if (look.flashColor) u.uFlashColor.value.set(look.flashColor);
    r.render(this.scene, this.cam);
    if (P) P.mark('post');
  }
}
