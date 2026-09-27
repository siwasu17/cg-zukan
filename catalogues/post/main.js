/* ポストエフェクト図鑑 — card definitions. Runtime: assets/js/g3d.js */
(function () {
const { run, series, DPR } = G3D;
const PI = Math.PI;

/* ---------- shared scene, built once ---------- */
function buildScene(ctx) {
  const scene = new THREE.Scene();
  scene.background = ctx.tex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1c2350'); gr.addColorStop(.6, '#7a4a78'); gr.addColorStop(1, '#e8906a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  scene.environment = ctx.makeEnv();
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40); camera.position.set(0, 1.35, 5.2); camera.lookAt(0, .6, 0);
  const group = new THREE.Group(); scene.add(group);
  const chk = ctx.tex(256, 256, (g, w) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#3a3f4c' : '#5c6272'; g.fillRect(x * 32, y * 32, 32, 32); } });
  chk.wrapS = chk.wrapT = THREE.RepeatWrapping; chk.repeat.set(12, 12);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: chk, roughness: .75 })); floor.rotation.x = -PI / 2; group.add(floor);
  const add = (geo, mat, pos) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); group.add(m); return m; };
  add(new THREE.SphereGeometry(.72, 64, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .12 }), [-1.15, .72, .1]);
  add(new THREE.SphereGeometry(.48, 48, 32), new THREE.MeshStandardMaterial({ color: 0xe0303a, roughness: .35 }), [1.25, .48, .7]);
  const cube = add(new THREE.BoxGeometry(.6, .6, .6), new THREE.MeshStandardMaterial({ color: 0xffc23a, roughness: .5 }), [.2, .3, 1.5]); cube.rotation.y = .6;
  const torus = add(new THREE.TorusGeometry(.55, .09, 24, 96), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x40e0ff, emissiveIntensity: 6 }), [0, 1.2, -1.3]);
  const bulbs = []; [[-2, .12, 1.4, 0xff6ad5], [2.1, .12, 1.1, 0xffb040], [-.2, .12, -2.6, 0x9f7bff]].forEach(([x, y, z, c]) => bulbs.push(add(new THREE.SphereGeometry(.12, 24, 16), new THREE.MeshStandardMaterial({ color: 0, emissive: c, emissiveIntensity: 8 }), [x, y, z])));
  for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) add(new THREE.BoxGeometry(.35, 2.2, .35), new THREE.MeshStandardMaterial({ color: 0x8890a8, roughness: .6 }), [sx * 2.6, 1.1, -1 - i * 2.4]);
  const ball = add(new THREE.SphereGeometry(.28, 32, 24), new THREE.MeshStandardMaterial({ color: 0x5ef08a, roughness: .3 }), [1.9, .3, -.6]);
  const d = new THREE.DirectionalLight(0xfff0e0, 4.71); d.position.set(-3, 5, 2); scene.add(d); scene.add(new THREE.HemisphereLight(0x8090ff, 0x402030, 1.57));
  let lastT = -1;
  const animate = (t) => { if (t === lastT) return; lastT = t; torus.rotation.set(t * .9, t * 1.3, 0); ball.position.y = .28 + Math.abs(Math.sin(t * 2.6)) * 1.2; ball.position.x = 1.9 + Math.sin(t * 1.1) * .5; };
  return { scene, camera, group, animate };
}

/* ---------- post shaders ---------- */
const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const HEAD = `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tPrev;
uniform vec2 uRes; uniform float uTime; uniform float uNear; uniform float uFar; uniform float uDpr;
varying vec2 vUv;
vec3 aces(vec3 x){ x *= 0.6; return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
vec3 gam(vec3 c){ return pow(clamp(c,0.0,1.0), vec3(1.0/2.2)); }
vec3 outc(vec3 hdr){ return gam(aces(hdr)); }
vec3 tex(vec2 uv){ return texture2D(tColor, uv).rgb; }
float lin(vec2 uv){ float z = texture2D(tDepth, uv).x*2.0-1.0; return (2.0*uNear*uFar)/(uFar+uNear-z*(uFar-uNear)); }
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float split(){ return 0.5 + 0.32*sin(uTime*0.6); }
vec3 divider(vec3 c){ return abs(vUv.x-split()) < 1.2/uRes.x ? vec3(1.0) : c; }
`;
const FX = {
  none: `void main(){ gl_FragColor = vec4(outc(tex(vUv)),1.0); }`,
  tonemap: `void main(){ vec3 c = tex(vUv); vec3 o = vUv.x < split() ? gam(c) : outc(c); gl_FragColor = vec4(divider(o),1.0); }`,
  grade: `void main(){ vec3 c = aces(tex(vUv)); vec3 o = c;
    if (vUv.x > split()) { float l = luma(c); vec3 tint = mix(vec3(0.0,0.42,0.5), vec3(1.25,0.72,0.38), smoothstep(0.08,0.65,l));
      o = mix(c, c*tint*1.35, 0.55); o = mix(vec3(luma(o)), o, 1.3); o = (o-0.5)*1.15+0.5; }
    gl_FragColor = vec4(divider(gam(o)),1.0); }`,
  mono: `void main(){ vec3 c = aces(tex(vUv)); float l = luma(c); vec3 o = vUv.x < split() ? vec3(pow(l,0.95)) : vec3(l*1.07, l*0.86, l*0.62) + vec3(0.04,0.02,0.0);
    gl_FragColor = vec4(divider(gam(o)),1.0); }`,
  vignette: `void main(){ vec3 c = outc(tex(vUv)); vec2 d = (vUv-0.5)*vec2(uRes.x/uRes.y,1.0); float v = smoothstep(0.95,0.25,length(d)); gl_FragColor = vec4(c*mix(0.15,1.0,v),1.0); }`,
  grain: `void main(){ vec3 c = outc(tex(vUv)); float n = hash(floor(vUv*uRes/uDpr) + fract(uTime*7.3)*91.0) - 0.5;
    float flick = 0.96 + 0.04*sin(uTime*37.0); c = c*flick + n*0.16;
    float scratch = step(0.997, hash(vec2(floor(vUv.x*uRes.x/uDpr/2.0), floor(uTime*12.0)))); c = mix(c, vec3(0.9), scratch*0.5);
    c = mix(c, vec3(luma(c))*vec3(1.05,1.0,0.9), 0.35); gl_FragColor = vec4(c,1.0); }`,

  bloom: `void main(){ vec3 c = tex(vUv), b = vec3(0.0);
    for (int i = 0; i < 40; i++) { float a = float(i)*2.39996, r = sqrt(float(i)/40.0)*22.0*uDpr; vec3 s = tex(vUv + vec2(cos(a),sin(a))*r/uRes); b += max(s-vec3(1.0),0.0); }
    vec3 w = vec3(0.0); for (int i = 0; i < 24; i++) { float a = float(i)*2.39996, r = sqrt(float(i)/24.0)*60.0*uDpr; vec3 s = tex(vUv + vec2(cos(a),sin(a))*r/uRes); w += max(s-vec3(1.0),0.0); }
    gl_FragColor = vec4(outc(c + b/40.0*2.2 + w/24.0*1.4),1.0); }`,
  dof: `void main(){ float focus = mix(3.0, 12.0, 0.5+0.5*sin(uTime*0.45)); float d = lin(vUv);
    float coc = clamp(abs(d-focus)/focus*1.8, 0.0, 1.0)*9.0*uDpr; vec3 acc = vec3(0.0); float tot = 0.0;
    for (int i = 0; i < 40; i++) { float a = float(i)*2.39996, r = sqrt(float(i)/40.0)*coc; vec2 uv2 = vUv + vec2(cos(a),sin(a))*r/uRes; float d2 = lin(uv2);
      float c2 = clamp(abs(d2-focus)/focus*1.8, 0.0, 1.0)*9.0*uDpr; float w = d2 < d ? smoothstep(r-1.0, r+1.0, c2) : 1.0; acc += tex(uv2)*w; tot += w; }
    gl_FragColor = vec4(outc(acc/max(tot,1e-3)),1.0); }`,
  accum: `void main(){ vec3 cur = tex(vUv), prev = texture2D(tPrev, vUv).rgb; gl_FragColor = vec4(mix(prev, cur, 0.22), 1.0); }`,
  show: `void main(){ gl_FragColor = vec4(outc(tex(vUv)),1.0); }`,
  chroma: `void main(){ vec2 d = vUv-0.5; float k = 0.006 + 0.012*(0.5+0.5*sin(uTime*0.8)); float r = tex(vUv + d*k*2.0).r, g = tex(vUv).g, b = tex(vUv - d*k*2.0).b;
    gl_FragColor = vec4(outc(vec3(r,g,b)),1.0); }`,
  lens: `void main(){ vec2 d = vUv-0.5; float k = 0.45*sin(uTime*0.5); vec2 uv = 0.5 + d*(1.0 + k*dot(d,d)*2.0)/(1.0+max(k,0.0)*0.5);
    vec3 c = (uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0) ? vec3(0.0) : outc(tex(uv)); gl_FragColor = vec4(c,1.0); }`,

  toon: `void main(){ vec3 c = aces(tex(vUv)); float l = luma(c); float q = floor(l*4.0+0.5)/4.0; c = c/max(l,1e-3)*max(q,0.08);
    vec2 px = uDpr/uRes; float d = lin(vUv); float e = 0.0;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) { e = max(e, abs(lin(vUv+vec2(float(i),float(j))*px*1.5)-d)); }
    float edge = smoothstep(0.04, 0.09, e/d); float le = abs(luma(aces(tex(vUv+vec2(px.x*1.5,0.0))))-luma(aces(tex(vUv-vec2(px.x*1.5,0.0))))) + abs(luma(aces(tex(vUv+vec2(0.0,px.y*1.5))))-luma(aces(tex(vUv-vec2(0.0,px.y*1.5)))));
    edge = max(edge, smoothstep(0.25,0.4,le)); gl_FragColor = vec4(gam(mix(c*1.1, vec3(0.05,0.04,0.08), edge)),1.0); }`,
  pixel: `
    vec3 pal(int i){ if(i==0) return vec3(0.0); if(i==1) return vec3(0.114,0.169,0.325); if(i==2) return vec3(0.494,0.145,0.325); if(i==3) return vec3(0.0,0.529,0.318);
      if(i==4) return vec3(0.671,0.322,0.212); if(i==5) return vec3(0.373,0.341,0.31); if(i==6) return vec3(0.761,0.765,0.78); if(i==7) return vec3(1.0,0.945,0.91);
      if(i==8) return vec3(1.0,0.0,0.302); if(i==9) return vec3(1.0,0.639,0.0); if(i==10) return vec3(1.0,0.925,0.153); if(i==11) return vec3(0.0,0.894,0.212);
      if(i==12) return vec3(0.161,0.678,1.0); if(i==13) return vec3(0.514,0.463,0.612); if(i==14) return vec3(1.0,0.467,0.659); return vec3(1.0,0.8,0.667); }
    float bayer(vec2 p){ vec2 q = mod(p,4.0); int x = int(q.x), y = int(q.y); float v = 0.0;
      if(y==0) v = x==0?0.0:x==1?8.0:x==2?2.0:10.0; else if(y==1) v = x==0?12.0:x==1?4.0:x==2?14.0:6.0; else if(y==2) v = x==0?3.0:x==1?11.0:x==2?1.0:9.0; else v = x==0?15.0:x==1?7.0:x==2?13.0:5.0; return v/16.0-0.5; }
    void main(){ float bs = 4.0*uDpr; vec2 cell = floor(vUv*uRes/bs); vec2 uv = (cell+0.5)*bs/uRes; vec3 c = gam(aces(tex(uv))) + bayer(cell)*0.12;
      vec3 best = vec3(0.0); float bd = 9.0; for (int i = 0; i < 16; i++) { vec3 p = pal(i); float dd = dot(c-p,c-p); if (dd < bd) { bd = dd; best = p; } } gl_FragColor = vec4(best,1.0); }`,
  kuwahara: `void main(){ vec2 px = 1.6*uDpr/uRes; vec3 m[4]; vec3 s[4];
    for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
    for (int j = -4; j <= 4; j++) for (int i = -4; i <= 4; i++) { vec3 c = aces(tex(vUv + vec2(float(i),float(j))*px)); vec3 c2 = c*c;
      if (i <= 0 && j <= 0) { m[0] += c; s[0] += c2; } if (i >= 0 && j <= 0) { m[1] += c; s[1] += c2; } if (i <= 0 && j >= 0) { m[2] += c; s[2] += c2; } if (i >= 0 && j >= 0) { m[3] += c; s[3] += c2; } }
    vec3 best = vec3(0.0); float bv = 1e9; for (int k = 0; k < 4; k++) { vec3 mu = m[k]/25.0; vec3 v = abs(s[k]/25.0 - mu*mu); float vv = v.r+v.g+v.b; if (vv < bv) { bv = vv; best = mu; } }
    gl_FragColor = vec4(gam(best*1.05),1.0); }`,
  halftone: `
    float dotc(vec2 p, float ang, float val){ float cs = 7.0*uDpr; mat2 R = mat2(cos(ang),-sin(ang),sin(ang),cos(ang)); vec2 q = R*p; vec2 f = fract(q/cs)-0.5; return 1.0-smoothstep(sqrt(val)*0.6-0.06, sqrt(val)*0.6+0.06, length(f)); }
    void main(){ vec2 p = vUv*uRes; vec3 c = gam(aces(tex(vUv))); vec3 cmy = 1.0-c; float k = min(cmy.r,min(cmy.g,cmy.b));
      float C = dotc(p,0.26,cmy.r-k*0.6), M = dotc(p,1.3,cmy.g-k*0.6), Y = dotc(p,0.0,cmy.b-k*0.6), K = dotc(p,0.78,k*0.8);
      vec3 paper = vec3(0.98,0.96,0.9); vec3 o = paper*(1.0-C*vec3(1.0,0.0,0.0)*0.9)*(1.0-M*vec3(0.0,1.0,0.0)*0.9)*(1.0-Y*vec3(0.0,0.0,1.0)*0.9)*(1.0-K*0.9);
      gl_FragColor = vec4(o,1.0); }`,
  crt: `void main(){ vec2 d = vUv-0.5; vec2 uv = 0.5 + d*(1.0+0.18*dot(d,d)); if (uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0) { gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
    vec2 px = uDpr/uRes; vec3 c = vec3(tex(uv+vec2(px.x*1.5,0.0)).r, tex(uv).g, tex(uv-vec2(px.x*1.5,0.0)).b); c += (tex(uv+vec2(px.x*3.0,0.0))+tex(uv-vec2(px.x*3.0,0.0)))*0.25;
    c = outc(c*0.8); float line = 0.6 + 0.4*sin(uv.y*uRes.y/uDpr*1.6); c *= line;
    float col = mod(floor(vUv.x*uRes.x/uDpr), 3.0); vec3 mask = col < 1.0 ? vec3(1.0,0.7,0.7) : col < 2.0 ? vec3(0.7,1.0,0.7) : vec3(0.7,0.7,1.0); c *= mask*1.25;
    c *= smoothstep(0.75,0.3,length(d)*1.1); gl_FragColor = vec4(c,1.0); }`,
  glitch: `void main(){ float t = floor(uTime*10.0); float row = floor(vUv.y*24.0); float r = hash(vec2(row, t)); vec2 uv = vUv;
    float burst = step(0.6, hash(vec2(t,3.1))); if (r > 0.86 && burst > 0.5) uv.x += (hash(vec2(row, t+1.0))-0.5)*0.18;
    float sh = burst*0.012; vec3 c = vec3(tex(uv+vec2(sh,0.0)).r, tex(uv).g, tex(uv-vec2(sh,0.0)).b); c = outc(c);
    if (burst > 0.5 && hash(vec2(floor(vUv.y*60.0), t+7.0)) > 0.97) c = 1.0-c; if (hash(vec2(floor(vUv.x*8.0), floor(vUv.y*6.0)) + t) > 0.985) c = vec3(c.g, c.b, c.r);
    gl_FragColor = vec4(c,1.0); }`,

  night: `void main(){ vec2 d = (vUv-0.5)*vec2(uRes.x/uRes.y,1.0); float n = hash(vUv*uRes + fract(uTime)*50.0);
    float l = luma(aces(tex(vUv)*3.0)); vec3 c = vec3(0.12,1.0,0.28)*(l*1.2+0.05) + (n-0.5)*0.15; c *= 0.85 + 0.15*sin(vUv.y*uRes.y/uDpr*1.2);
    float lens = min(length(d-vec2(0.22,0.0)), length(d+vec2(0.22,0.0))); c *= smoothstep(0.5,0.42,lens); gl_FragColor = vec4(gam(c),1.0); }`,
  thermal: `vec3 heat(float t){ t = clamp(t,0.0,1.0); vec3 a = vec3(0.0,0.0,0.1), b = vec3(0.3,0.0,0.6), c = vec3(0.9,0.1,0.3), d = vec3(1.0,0.6,0.0), e = vec3(1.0,1.0,0.8);
      return t<0.25?mix(a,b,t/0.25):t<0.5?mix(b,c,(t-0.25)/0.25):t<0.75?mix(c,d,(t-0.5)/0.25):mix(d,e,(t-0.75)/0.25); }
    void main(){ vec3 c = tex(vUv); float l = luma(aces(c)); float hot = clamp(luma(c)-0.9,0.0,3.0); float dd = lin(vUv);
      gl_FragColor = vec4(heat(l*0.7 + hot*0.35 + (1.0-clamp(dd/15.0,0.0,1.0))*0.15),1.0); }`,
  underwater: `void main(){ vec2 uv = vUv + vec2(sin(vUv.y*18.0+uTime*1.7), cos(vUv.x*14.0+uTime*1.3))*0.004; float d = lin(uv);
    vec3 c = aces(tex(uv)); vec3 water = vec3(0.02,0.25,0.33); c = mix(c*vec3(0.55,0.9,1.0), water, 1.0-exp(-d*0.16));
    vec2 q = uv*vec2(uRes.x/uRes.y,1.0)*9.0; float ca = pow(abs(sin(q.x+sin(q.y*1.3+uTime)+uTime*0.7)*sin(q.y+sin(q.x*1.1-uTime*0.8))), 6.0);
    c += vec3(0.3,0.55,0.6)*ca*exp(-d*0.2)*0.5; c *= 0.8 + 0.2*smoothstep(0.0,0.6,vUv.y); gl_FragColor = vec4(gam(c),1.0); }`,
  haze: `void main(){ float s = smoothstep(0.75,0.15,vUv.y); vec2 p = vUv*vec2(uRes.x/uRes.y,1.0);
    vec2 off = vec2(vnoise(p*22.0+vec2(0.0,-uTime*2.2))-0.5, vnoise(p*22.0+vec2(7.0,-uTime*2.6))-0.5)*0.014*s;
    vec3 c = outc(tex(vUv+off)); c = mix(c, c*vec3(1.08,0.98,0.88), s*0.5); gl_FragColor = vec4(c,1.0); }`
};

/* ---------- per-card post view ---------- */
let quadScene, quadCam, quad, SC;
function postView(ctx, fx, o = {}) {
  if (!SC) {
    SC = buildScene(ctx);
    quadScene = new THREE.Scene(); quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
  }
  const mk = (src) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: HEAD + src, depthTest: false, depthWrite: false,
    uniforms: { tColor: { value: null }, tDepth: { value: null }, tPrev: { value: null }, uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uNear: { value: .1 }, uFar: { value: 40 }, uDpr: { value: DPR } } });
  const mat = mk(FX[fx]); const acc = o.feedback ? mk(FX.accum) : null;
  let rt = null, fb = [null, null], w0 = 0, h0 = 0, flip = 0;
  const mkRT = (w, h, depth) => { const r = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    if (depth) { r.depthTexture = new THREE.DepthTexture(w, h); r.depthTexture.type = THREE.UnsignedIntType; } return r; };
  return {
    update: (t) => SC.animate(t),
    render: (ctx, x, y, w, h, v) => {
      const R = ctx.renderer, pw = Math.max(2, Math.round(w * DPR)), ph = Math.max(2, Math.round(h * DPR));
      if (pw !== w0 || ph !== h0) { if (rt) { rt.dispose(); rt.depthTexture && rt.depthTexture.dispose(); } rt = mkRT(pw, ph, true); if (acc) { fb.forEach(f => f && f.dispose()); fb = [mkRT(pw, ph), mkRT(pw, ph)]; } w0 = pw; h0 = ph; }
      SC.group.rotation.set(v.rx * .5, v.ry * .6, 0); SC.camera.aspect = w / h; SC.camera.updateProjectionMatrix();
      R.setRenderTarget(rt); R.render(SC.scene, SC.camera);
      let src = rt.texture;
      if (acc) {
        const write = fb[flip], read = fb[1 - flip]; acc.uniforms.tColor.value = rt.texture; acc.uniforms.tPrev.value = read.texture; quad.material = acc;
        R.setRenderTarget(write); R.render(quadScene, quadCam); src = write.texture; flip = 1 - flip;
      }
      const U = mat.uniforms; U.tColor.value = src; U.tDepth.value = rt.depthTexture; U.uRes.value.set(pw, ph); U.uTime.value = ctx.t;
      quad.material = mat; R.setRenderTarget(null); R.setViewport(x, y, w, h); R.setScissor(x, y, w, h); R.setScissorTest(true); R.render(quadScene, quadCam);
    }
  };
}

const card = (s, name, tag, fx, desc, o) => ({ s, name, tag, desc, make: (ctx) => postView(ctx, fx, o) });
const ITEMS = [
  card('tone', '元の絵', 'フィルターなし', 'none', 'すべてのカードの元になる場面です。3Dの場面を描いたあと、明るすぎる部分を自然に丸めて（トーンマッピング）、画面用の明るさに変換しただけのものです。'),
  card('tone', 'トーンマッピング', '切り捨て ↔ ACES', 'tonemap', '左は、画面で出せる明るさ（1.0）を超えた部分をそのまま切り捨てたもの。光る輪や電球が真っ白に飛び、色も消えます。右は明るい部分をなだらかに圧縮する方法（ACES）で、まぶしさを保ちつつ色も残ります。'),
  card('tone', '色調補正（カラーグレーディング）', 'ティール & オレンジ', 'grade', '境目の右側だけ、暗い部分を青緑に、明るい部分をオレンジに寄せ、コントラストと彩度も上げています。ハリウッド映画でよく見る色づくりで、同じ場面が映画のワンシーンのように見えます。'),
  card('tone', '白黒とセピア', 'luminance', 'mono', '色を明るさだけに置き換えると白黒になり、そこに茶色みを足すとセピアになります。境目の左が白黒、右がセピアです。回想シーンの演出などに使われます。'),
  card('tone', 'ビネット', '周辺減光', 'vignette', '画面の四隅を暗くしています。古いカメラのレンズで起きる現象ですが、視線が自然と中央に集まるので、わざと加えることがよくあります。'),
  card('tone', 'フィルムグレイン', 'ノイズ + ちらつき + 傷', 'grain', '毎フレーム違う細かいノイズを乗せ、明るさをわずかにちらつかせ、ときどき縦の傷を入れています。デジタルのつるっとした絵に、古い映画フィルムの質感が加わります。'),

  card('lens', 'ブルーム', '明るすぎる部分をにじませる', 'bloom', '明るさが1.0を超えた部分だけを取り出してぼかし、元の絵に足しています。光る輪や電球の周りに光がにじみ、本当にまぶしく光っているように見えます。今のゲームではほぼ必ず使われる効果です。'),
  card('lens', '被写界深度', '深度でぼかす量を決める', 'dof', 'カメラからの距離（深度）を使って、ピントの合った距離から離れた部分ほど強くぼかしています。ピントの位置を手前と奥の間でゆっくり動かしています。'),
  card('lens', 'モーションブラー（残像）', '前のフレームと混ぜる', 'show', '毎フレーム、前のフレームまでの絵に今の絵を22%だけ混ぜています。速く動くボールや回る輪に尾を引いたような残像が出ます。ドラッグで場面を回すと、全体が流れて見えます。', { feedback: true }),
  card('lens', '色収差', 'RGB を少しずつずらす', 'chroma', 'レンズは色ごとに光の曲がり方が少し違うので、画面の端ほど赤と青がずれます。そのずれを、赤は外側、青は内側にずらして再現しています。強さをゆっくり変えています。'),
  card('lens', 'レンズのゆがみ', '樽型 ↔ 糸巻き型', 'lens', '画面の中心からの距離に応じて、読み取る位置を外や内にずらしています。広角レンズや魚眼レンズのように膨らむゆがみ（樽型）と、しぼむゆがみ（糸巻き型）を行き来しています。'),

  card('style', 'アニメ調（輪郭線と階調）', '深度の段差で線 + 明るさを4段階', 'toon', '深度（距離）が急に変わる場所に黒い線を引き、明るさを4段階に区切っています。3Dモデルに手を加えなくても、画面の後処理だけでアニメやマンガのような絵になります。'),
  card('style', 'ドット絵化', '4ドット単位 + 16色 + ディザ', 'pixel', '画面を4ドット四方のマスに区切ってマスごとに1色にし、決められた16色の中から一番近い色を選んでいます。規則的な模様（ディザ）を足して、少ない色でもグラデーションを表しています。'),
  card('style', '油絵風', 'Kuwahara フィルター', 'kuwahara', '各点の周りを4つの区画に分け、色のばらつきが一番小さい区画の平均色を使います。細かい模様は消えるのに輪郭は残るので、筆で塗ったような絵になります。'),
  card('style', '印刷の網点', 'CMYK ハーフトーン', 'halftone', 'シアン・マゼンタ・イエロー・黒の4色それぞれを、角度の違う網目状の点の大きさで表しています。カラー印刷やアメコミのような質感です。'),
  card('style', 'ブラウン管', '湾曲 + 走査線 + RGB の縦じま', 'crt', '画面をふくらませ、横じまの走査線と、赤・緑・青の細い縦じまを重ね、色を少しにじませています。レトロゲーム機をブラウン管テレビで遊んでいた頃の見た目です。'),
  card('style', 'グリッチ', 'ブロックのずれ + 色ずれ', 'glitch', '時々、横の帯をランダムにずらし、赤と青をずらし、色を反転させています。映像信号が壊れたような演出で、SFやホラーの演出に使われます。'),

  card('vision', '暗視ゴーグル', '明るさを増幅して緑に', 'night', '暗い場所の光を強く増幅し、緑一色で表しています。粒の荒いノイズと、双眼鏡のような2つの円の視界を重ねています。'),
  card('vision', 'サーモグラフィ', '明るさ → 温度の色', 'thermal', '本物の温度は分からないので、明るさとまぶしさ、近さを「温度」とみなして、黒→紫→赤→黄→白の色に置き換えています。光っている輪や電球が一番熱く見えます。'),
  card('vision', '水中', '揺らぎ + 距離で青く + 光の網', 'underwater', '画面全体を波のように揺らし、遠いものほど水の色に沈め、水面から差し込む光の網目模様（コースティクス）を重ねています。'),
  card('vision', '陽炎', 'ノイズで画面をゆらゆらずらす', 'haze', '画面の下のほうほど強く、ノイズで読み取る位置をずらしています。ノイズを上に流しているので、熱い地面から空気が立ち上っているように見えます。')
];

const SECTIONS = [
  { id: 'tone', en: 'Tone & colour', title: '明るさと色', lead: '画面の色をどう整えるかで、場面の雰囲気がまず決まります。境目の線が動いているカードは、左右で比べています。' },
  { id: 'lens', en: 'Camera & lens', title: 'カメラとレンズ', lead: '本物のカメラやレンズで起きる現象を、わざと再現する効果です。「映像らしさ」が加わります。' },
  { id: 'style', en: 'Stylisation', title: '絵のスタイルを変える', lead: '写実から離れて、アニメ、ドット絵、絵画、印刷物、古いテレビのような見た目に変える効果です。' },
  { id: 'vision', en: 'Special vision', title: '特殊な視界', lead: 'ゲームの中の道具や環境を表す、特別な見え方です。' }
];
run({ sections: SECTIONS, items: ITEMS, minCol: 300, aspect: '4 / 3', spin: .12 });
series('post');

})();
