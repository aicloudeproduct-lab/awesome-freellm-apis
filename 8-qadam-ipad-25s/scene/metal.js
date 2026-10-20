'use strict';
/* Сұйық металл / хром: WebGL2 фрагмент шейдеріндегі raymarching.
   Metal.draw(g, state, cx, cy, pxPerUnit) — пішінді мөлдір фонда салып, 2D сахнаға (cx, cy) нүктесіне қояды.
   state: { balls:[[x,y,z,r],...], k, box:[x,y,z,hx,hy,hz,round], boxMix, rot:[ax,ay], tintA, tintB, bgLight } */
const Metal = (() => {
  const SIZE = 1200;
  const cv = document.createElement('canvas'); cv.width = SIZE; cv.height = SIZE;
  const gl = cv.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true });
  if (!gl) throw new Error('WebGL2 жоқ');
  const vs = `#version 300 es
  in vec2 p; out vec2 uv; void main(){ uv = p; gl_Position = vec4(p,0.,1.); }`;
  const fs = `#version 300 es
  precision highp float;
  in vec2 uv; out vec4 o;
  uniform vec4 B[8]; uniform int N; uniform float K;
  uniform vec4 BX; uniform vec4 BXS; uniform float BM;
  uniform vec2 ROT; uniform vec3 TA; uniform vec3 TB; uniform float BG; uniform float FOV;
  const float PI = 3.14159265;
  mat3 ry(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
  mat3 rx(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
  float smin(float a, float b, float k){ float h = max(k-abs(a-b),0.)/max(k,1e-4); return min(a,b) - h*h*k*0.25; }
  float sdBox(vec3 p, vec3 b, float r){ vec3 q = abs(p)-b+r; return length(max(q,0.)) + min(max(q.x,max(q.y,q.z)),0.) - r; }
  float map(vec3 p){
    float d = 1e3;
    for(int i=0;i<8;i++){ if(i>=N) break; d = smin(d, length(p-B[i].xyz)-B[i].w, K); }
    if(BM>0.001){
      vec3 q = ry(ROT.y)*rx(ROT.x)*(p-BX.xyz);
      d = mix(d, sdBox(q, BXS.xyz, BXS.w), BM);
    }
    return d;
  }
  vec3 nrm(vec3 p){ vec2 e=vec2(0.0012,0.); return normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx))); }
  float wrapA(float a){ return mod(a+PI, 2.*PI)-PI; }
  float box2(float az, float el, float a0, float e0, float wa, float we, float soft){
    float d = max(abs(wrapA(az-a0))-wa, abs(el-e0)-we); return smoothstep(soft,-soft,d);
  }
  // процедуралық студия: еден, көкжиек, софтбокстар, акцент жолақтар
  vec3 env(vec3 r){
    float el = asin(clamp(r.y,-1.,1.)), az = atan(r.x, r.z);
    vec3 warm = vec3(0.95,0.93,0.88);
    vec3 floorC = mix(warm*(0.12+0.62*BG), vec3(0.03+0.08*BG), smoothstep(-0.02,-1.2,el));
    vec3 skyC = mix(vec3(0.08)+warm*0.42*BG, vec3(0.02)+warm*0.12*BG, smoothstep(0.0,1.1,el));
    vec3 col = el < 0. ? floorC : skyC;
    col += vec3(0.95,0.92,0.86)*exp(-pow(el*26.,2.))*0.8;
    col *= 1. - 0.65*exp(-pow((el-0.07)*16.,2.));
    col += vec3(2.6)*box2(az, el, 0.0, 1.0, 1.1, 0.34, 0.04);
    col += vec3(1.4)*box2(az, el, -0.55, 0.32, 0.09, 0.45, 0.02);
    col += vec3(2.1)*box2(az, el, 0.72, 0.28, 0.05, 0.55, 0.015);
    col += vec3(1.1)*box2(az, el, 0.86, 0.28, 0.02, 0.55, 0.01);
    col += TA*2.7*box2(az, el, -1.2, 0.18, 0.13, 0.5, 0.05);
    col += TB*2.0*box2(az, el, 2.2, 0.08, 0.4, 0.38, 0.08);
    return col;
  }
  void main(){
    vec3 ro = vec3(0.,0.,4.2);
    vec3 rd = normalize(vec3(uv*FOV, -1.6));
    float t = 0.5, dmin = 1e3, tmin = 0.; bool hit = false;
    for(int i=0;i<100;i++){
      vec3 p = ro+rd*t; float d = map(p);
      if(d/t < dmin){ dmin = d/t; tmin = t; }
      if(d<0.0006){ hit=true; break; }
      t += d; if(t>9.) break;
    }
    float px = 2.0/${SIZE}.*FOV/1.6*1.1;
    float a = hit ? 1. : clamp(1.-dmin/px,0.,1.);
    if(a<=0.){ o=vec4(0.); return; }
    if(!hit) t = tmin;
    vec3 p = ro+rd*t, n = nrm(p), r = reflect(rd,n);
    float fr = pow(1.-max(dot(n,-rd),0.),4.);
    vec3 col = env(r)*mix(0.86,1.05,fr) * vec3(0.98,0.97,0.95);
    col *= mix(0.6,1.0, smoothstep(-1.0,0.2,n.y));
    col = col/(1.+col*0.42);
    col = pow(col, vec3(1./1.1));
    o = vec4(col*a, a);
  }`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  const u = Object.fromEntries(['B', 'N', 'K', 'BX', 'BXS', 'BM', 'ROT', 'TA', 'TB', 'BG', 'FOV'].map(n => [n, U(n)]));
  gl.viewport(0, 0, SIZE, SIZE);
  function draw(g, s, cx, cy, pxPerUnit, alpha = 1) {
    const balls = (s.balls || []).slice(0, 8), arr = new Float32Array(32);
    balls.forEach((b, i) => arr.set(b, i * 4));
    gl.uniform4fv(u.B, arr); gl.uniform1i(u.N, balls.length); gl.uniform1f(u.K, s.k ?? 0.4);
    const bx = s.box || [0, 0, 0, 0.5, 0.5, 0.5, 0.06];
    gl.uniform4f(u.BX, bx[0], bx[1], bx[2], 0); gl.uniform4f(u.BXS, bx[3], bx[4], bx[5], bx[6]);
    gl.uniform1f(u.BM, s.boxMix || 0); gl.uniform2f(u.ROT, ...(s.rot || [0, 0]));
    gl.uniform3f(u.TA, ...(s.tintA || [0.84, 1, 0.15])); gl.uniform3f(u.TB, ...(s.tintB || [0.45, 0.32, 1]));
    gl.uniform1f(u.BG, s.bgLight ?? 1);
    // z=0 жазықтығында 1 бірлік = pxPerUnit пиксель болатындай көру бұрышы
    gl.uniform1f(u.FOV, (SIZE / 2) / pxPerUnit / 4.2 * 1.6);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    g.save(); g.globalAlpha *= alpha; g.drawImage(cv, cx - SIZE / 2, cy - SIZE / 2); g.restore();
  }
  return { draw, SIZE };
})();
