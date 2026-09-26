/* 3Dアニメーション図鑑 — card definitions. Runtime: assets/js/g3d.js
   Everything is built procedurally: no model files. Characters are simple
   capsule mannequins whose joint positions are computed each frame. */
(function () {
const { run, series } = G3D;
const PI = Math.PI, TAU = PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
/* 0 → 1, hold, → 0, hold (linear ramps), period p */
const ramp = (t, p = 6) => { const u = (t % p) / p; return u < .1 ? 0 : u < .45 ? (u - .1) / .35 : u < .6 ? 1 : u < .95 ? 1 - (u - .6) / .35 : 0; };
const hold = (t, p) => smooth(ramp(t, p));
/* smooth pseudo-noise in about -1..1 */
const wob = (t, s = 0) => (Math.sin(t * 1.13 + s) + .6 * Math.sin(t * 2.31 + s * 1.7 + 1.3) + .3 * Math.sin(t * 4.57 + s * 2.9 + .7)) / 1.9;

/* ---------- shared helpers ---------- */
let _G = null;
const G = () => _G || (_G = { sph: new THREE.SphereGeometry(1, 20, 14), cyl: new THREE.CylinderGeometry(1, 1, 1, 12, 1), box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 4).translate(0, .5, 0), dia: new THREE.OctahedronGeometry(1, 0) });
const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .55 }, o));
const OV = (c, op = 1) => new THREE.MeshBasicMaterial({ color: c, depthTest: false, depthWrite: false, transparent: true, opacity: op });
function mesh(geo, mat, parent, order) { const m = new THREE.Mesh(geo, mat); if (order) m.renderOrder = order; if (parent) parent.add(m); return m; }
function ball(parent, r, mat, order) { const m = mesh(G().sph, mat, parent, order); m.scale.setScalar(r); return m; }
const UP = V(0, 1, 0), _a = V(), _b = V(), _c = V(), _d = V(), _q = new THREE.Quaternion();
/* put a y-aligned mesh between a and b (scale r × length × r when r is given) */
function place(m, a, b, r) {
  _d.subVectors(b, a); const L = _d.length(); m.position.addVectors(a, b).multiplyScalar(.5);
  if (L > 1e-6) m.quaternion.setFromUnitVectors(UP, _d.divideScalar(L));
  if (r !== undefined) m.scale.set(r, Math.max(L, 1e-4), r);
}
function line(parent, pts, color, op = 1) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: op < 1, opacity: op }));
  parent.add(l); return l;
}
/* a two-point line that can be moved every frame */
function Seg(parent, color, op = .6) {
  const l = line(parent, [V(), V()], color, op); l.frustumCulled = false; const p = l.geometry.attributes.position;
  return (a, b) => { p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true; };
}
/* the last n positions of a moving point */
function Trail(parent, n, color, op = .7) {
  const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); l.frustumCulled = false; parent.add(l); let fresh = true;
  return (p) => { if (fresh) { for (let i = 0; i < n; i++) p.toArray(pos, i * 3); fresh = false; } pos.copyWithin(0, 3); p.toArray(pos, (n - 1) * 3); g.attributes.position.needsUpdate = true; };
}
/* a chain of cylinders with a ball at each joint; set(points) */
function Chain(parent, n, o = {}) {
  const segs = [], joints = [], mat = o.mat || M(o.color || 0xd9d2c4), jm = o.jmat || M(0x2c3038, { roughness: .4 });
  for (let i = 0; i < n; i++) segs.push(mesh(G().cyl, mat, parent));
  for (let i = 0; i <= n; i++) joints.push(ball(parent, typeof o.jr === 'function' ? o.jr(i) : (o.jr || .045), i === n && o.tip ? o.tip : jm));
  const r = o.r || .03;
  return { set(P) { for (let i = 0; i < n; i++) place(segs[i], P[i], P[i + 1], typeof r === 'function' ? r(i) : r); for (let i = 0; i <= n; i++) joints[i].position.copy(P[i]); } };
}
/* a bar gauge fixed to the camera (0..1) */
function Gauge(S, x, y, w, color) {
  const g = new THREE.Group(); g.position.set(x, y, -3); S.camera.add(g);
  const bg = mesh(G().box, new THREE.MeshBasicMaterial({ color: 0x0c0e12 }), g); bg.scale.set(w + .04, .085, .01);
  const fill = mesh(new THREE.BoxGeometry(1, 1, 1).translate(.5, 0, 0), new THREE.MeshBasicMaterial({ color }), g); fill.position.set(-w / 2, 0, .01); fill.scale.set(.001, .05, .01);
  return (v) => { fill.scale.x = Math.max(.001, clamp(v, 0, 1) * w); };
}
function stage(ctx, o = {}) {
  const scene = new THREE.Scene(); scene.background = ctx.BG;
  const camera = new THREE.PerspectiveCamera(o.fov || 32, 1, .1, 50);
  camera.position.set(...(o.cam || [0, 1.25, 5.2])); camera.lookAt(...(o.look || [0, .85, 0])); scene.add(camera);
  const root = new THREE.Group(); scene.add(root);
  const d = new THREE.DirectionalLight(0xffffff, 1.35); d.position.set(-2, 4, 3); scene.add(d);
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a2622, .35));
  const S = { scene, camera, root };
  if (o.floor !== false) { S.floor = mesh(new THREE.CircleGeometry(o.floor || 2.2, 64), M(0x30333a, { roughness: .95 }), root); S.floor.rotation.x = -PI / 2; }
  return S;
}
/* stripes on the floor so that sliding and walking speed can be seen */
function stripes(ctx, floorMesh, worldW) {
  const t = ctx.tex(64, 8, (g) => { g.fillStyle = '#4a4e57'; g.fillRect(0, 0, 64, 8); g.fillStyle = '#383b42'; g.fillRect(0, 0, 32, 8); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(worldW / .5, 1); floorMesh.material.map = t; floorMesh.material.needsUpdate = true;
  return (dist) => { t.offset.x = (t.offset.x + dist / .5) % 1; };
}

/* ---------- IK solvers ---------- */
/* two-bone IK: root A, target T, lengths a, b, pole point → mid (elbow/knee), end */
function ik2(A, T, a, b, pole, mid, end) {
  const dir = _a.subVectors(T, A); let d = dir.length(); dir.divideScalar(d || 1);
  d = clamp(d, Math.abs(a - b) + 1e-3, a + b - 1e-4);
  const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
  const bend = _b.subVectors(pole, A); bend.addScaledVector(dir, -bend.dot(dir)).normalize();
  mid.copy(A).addScaledVector(dir, x).addScaledVector(bend, h);
  end.copy(A).addScaledVector(dir, d);
}
function ccd(P, T, iters, maxAng) {
  const n = P.length - 1;
  for (let k = 0; k < iters; k++) for (let i = n - 1; i >= 0; i--) {
    _a.subVectors(P[n], P[i]).normalize(); _b.subVectors(T, P[i]).normalize(); _q.setFromUnitVectors(_a, _b);
    const ang = 2 * Math.acos(clamp(_q.w, -1, 1)); if (ang > maxAng) _q.slerp(new THREE.Quaternion(), 1 - maxAng / ang);
    for (let j = i + 1; j <= n; j++) P[j].sub(P[i]).applyQuaternion(_q).add(P[i]);
  }
}
function fabrik(P, L, base, T, iters, minY = -1e9) {
  const n = P.length - 1, total = L.reduce((s, x) => s + x, 0);
  if (base.distanceTo(T) >= total) { P[0].copy(base); for (let i = 0; i < n; i++) P[i + 1].copy(P[i]).addScaledVector(_a.subVectors(T, P[i]).normalize(), L[i]); return; }
  for (let k = 0; k < iters; k++) {
    P[n].copy(T); for (let i = n - 1; i >= 0; i--) { _a.subVectors(P[i], P[i + 1]).normalize(); P[i].copy(P[i + 1]).addScaledVector(_a, L[i]); }
    P[0].copy(base); for (let i = 0; i < n; i++) { if (P[i + 1].y < minY) P[i + 1].y = minY; _a.subVectors(P[i + 1], P[i]).normalize(); P[i + 1].copy(P[i]).addScaledVector(_a, L[i]); }
  }
}

/* ---------- a capsule mannequin (faces +x, up +y, its right side is +z) ---------- */
const ANK = .075, SIDE = [-1, 1];
function makeJ() { const J = { pelvis: V(), chest: V(), head: V(), lean: 0 }; for (const k of ['hip', 'knee', 'ankle', 'sh', 'el', 'ha']) J[k] = [V(), V()]; return J; }
function upper(J) {
  const l = J.lean, b = J.breath || 0;
  J.chest.set(J.pelvis.x + .4 * Math.sin(l), J.pelvis.y + .4 * Math.cos(l) + .012 * b, J.pelvis.z);
  J.head.set(J.chest.x + .27 * Math.sin(l * .6), J.chest.y + .27 * Math.cos(l * .6), J.chest.z);
  for (let i = 0; i < 2; i++) { J.sh[i].set(J.chest.x - .01, J.chest.y - .05 + .014 * b, J.chest.z + SIDE[i] * .22); J.hip[i].set(J.pelvis.x, J.pelvis.y - .06, J.pelvis.z + SIDE[i] * .1); }
}
const _pole = V();
function leg(J, i, T) { ik2(J.hip[i], T, .44, .42, _pole.set(J.hip[i].x + 1, J.hip[i].y, J.hip[i].z), J.knee[i], J.ankle[i]); }
function arm(J, i, th, e) {
  const s = J.sh[i], el = J.el[i];
  el.set(s.x + .29 * Math.sin(th), s.y - .29 * Math.cos(th), s.z + SIDE[i] * .02);
  J.ha[i].set(el.x + .27 * Math.sin(th + e), el.y - .27 * Math.cos(th + e), el.z);
}
function footAt(f, P, out) {
  if (f < P.duty) return out.set(P.S / 2 - P.S * f / P.duty, ANK, 0);
  const s = (f - P.duty) / (1 - P.duty);
  return out.set(-P.S / 2 + P.S * (s - Math.sin(TAU * s) / TAU), ANK + P.lift * Math.sin(PI * s), 0);
}
const _f = V();
function gait(ph, P, J) {
  J.pelvis.set(0, P.hip + P.bob * Math.cos(2 * TAU * (ph - P.duty / 2)), 0); J.lean = P.lean; J.breath = 0; upper(J);
  for (let i = 0; i < 2; i++) {
    const f = (ph + i * .5) % 1; footAt(f, P, _f); _f.z = SIDE[i] * .1; leg(J, i, _f);
    const th = -P.arm * Math.cos(TAU * f) + P.armFwd; arm(J, i, th, P.elbow + .3 * Math.max(0, th));
  }
}
function stand(J, o = {}) {
  J.pelvis.set(o.px || 0, .92 + (o.py || 0), o.pz || 0); J.lean = o.lean || .02; J.breath = o.breath || 0; upper(J);
  for (let i = 0; i < 2; i++) { _f.set(.01, ANK, SIDE[i] * .11); leg(J, i, _f); arm(J, i, .06 + (o.arm || 0) * SIDE[i], .18 + (o.elbow || 0)); }
}
const WALK = { T: 1.1, S: .56, duty: .6, lift: .13, hip: .93, bob: .025, lean: .05, arm: .35, armFwd: 0, elbow: .25 };
const RUN = { T: .68, S: 1.0, duty: .36, lift: .3, hip: .9, bob: -.04, lean: .22, arm: .75, armFwd: .15, elbow: 1.3 };
const speed = (P) => P.S / (P.duty * P.T);
function mixP(a, b, w, out = {}) { for (const k in a) out[k] = lerp(a[k], b[k], w); return out; }

function Figure(parent, o = {}) {
  const g = new THREE.Group(); parent.add(g);
  const mT = M(o.torso || 0x5b8fd6), mH = M(o.head || 0xeadfcf);
  const mA = [M(o.armL || 0xa9a296), M(o.armR || 0xece6da)], mL = [M(o.legL || 0x7d869a), M(o.legR || 0xbcc4d4)];
  const cap = (r, len, m) => mesh(new THREE.CapsuleGeometry(r, len, 3, 10), m, g);
  const torso = cap(.13, .4, mT);
  const head = new THREE.Group(); g.add(head); ball(head, .15, mH);
  const eyeM = M(0x22252b); for (const s of SIDE) ball(head, .026, eyeM).position.set(.132, .03, s * .055);
  const th = [], sh = [], ft = [], ua = [], fa = [], hd = [];
  for (let i = 0; i < 2; i++) {
    th.push(cap(.068, .44, mL[i])); sh.push(cap(.056, .42, mL[i]));
    const f = mesh(G().box, mL[i], g); f.scale.set(.23, .06, .1); ft.push(f);
    ua.push(cap(.05, .29, mA[i])); fa.push(cap(.044, .27, mA[i])); hd.push(ball(g, .055, mA[i]));
  }
  const J = makeJ();
  return { g, J, pose() {
    place(torso, J.pelvis, J.chest); const b = J.breath || 0; torso.scale.set(1 + .06 * b, 1, 1.3 * (1 + .06 * b));
    head.position.copy(J.head); head.rotation.set(J.roll || 0, J.yaw || 0, (J.nod || 0) - J.lean * .3);
    for (let i = 0; i < 2; i++) {
      place(th[i], J.hip[i], J.knee[i]); place(sh[i], J.knee[i], J.ankle[i]); ft[i].position.set(J.ankle[i].x + .06, J.ankle[i].y - .04, J.ankle[i].z);
      place(ua[i], J.sh[i], J.el[i]); place(fa[i], J.el[i], J.ha[i]); hd[i].position.copy(J.ha[i]);
    }
  } };
}

/* ---------- skinned tube: n bones along +y ---------- */
function boneViz(bone, len, color = 0xffb800) {
  const m = mesh(G().cone, OV(color), bone, 10); m.scale.set(.055, len, .055);
  ball(bone, .04, OV(0xffffff), 11);
}
function skinTube(o) {
  const seg = o.L / o.n, geo = new THREE.CylinderGeometry(o.r, o.r, o.L, o.rad || 32, o.hs || 48, false); geo.translate(0, o.L / 2, 0);
  const pos = geo.attributes.position, N = pos.count;
  const si = new Uint16Array(N * 4), sw = new Float32Array(N * 4), col = new Float32Array(N * 3);
  for (let v = 0; v < N; v++) {
    const y = pos.getY(v), u = y / seg, k = clamp(Math.round(u), 1, o.n - 1), tt = u - k;
    const wu = o.w < .01 ? (tt >= 0 ? 1 : 0) : smooth(.5 + tt / o.w);
    si[v * 4] = k - 1; si[v * 4 + 1] = k; sw[v * 4] = 1 - wu; sw[v * 4 + 1] = wu;
    const c = o.color(y, Math.atan2(pos.getX(v), pos.getZ(v)), wu, k); col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2];
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const bones = []; for (let i = 0; i < o.n; i++) { const b = new THREE.Bone(); b.position.y = i ? seg : 0; if (i) bones[i - 1].add(b); bones.push(b); }
  const m = new THREE.SkinnedMesh(geo, M(0xffffff, { vertexColors: true, roughness: .5 })); m.add(bones[0]); m.updateMatrixWorld(true); m.bind(new THREE.Skeleton(bones)); m.frustumCulled = false;
  if (o.viz !== false) bones.forEach(b => boneViz(b, seg, o.vizColor));
  return { mesh: m, bones, seg };
}

/* a little plane-like object: nose +z, fin +y */
function glider(color, op) {
  const g = new THREE.Group(), m = M(color, op ? { transparent: true, opacity: op, depthWrite: false } : {});
  mesh(G().box, m, g).scale.set(.16, .12, .7);
  const nose = mesh(new THREE.ConeGeometry(.08, .18, 12), m, g); nose.rotation.x = PI / 2; nose.position.z = .44;
  const wing = mesh(G().box, m, g); wing.scale.set(.9, .03, .2);
  const fin = mesh(G().box, m, g); fin.scale.set(.03, .22, .14); fin.position.set(0, .15, -.26);
  return g;
}

/* ================= cards ================= */
const ITEMS = [
  /* ---------- rig ---------- */
  { s: 'rig', name: '親子の階層（FK）', tag: 'Object3D の親子 · FK',
    desc: '腕を「土台 → 肩 → ひじ → 手首」と親子につないでいます。親を回すと、子はその上に乗ったまま一緒に動きます。関節の角度を根元から順に決めていくやり方をFK（フォワードキネマティクス）といいます。白い線は指先の通った跡で、すべての関節の回転が足し合わされた動きです。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.4, 5.6], look: [0, .95, 0] }), R = S.root, mL = M(0xe6e0d4);
      mesh(new THREE.CylinderGeometry(.3, .36, .2, 32), M(0x3d4250), R).position.y = .1;
      const yaw = new THREE.Group(); yaw.position.y = .2; R.add(yaw);
      mesh(new THREE.CylinderGeometry(.08, .08, .3, 16), mL, yaw).position.y = .15;
      const sh = new THREE.Group(); sh.position.y = .3; yaw.add(sh); ball(sh, .1, M(0xff6b5a));
      mesh(new THREE.CapsuleGeometry(.065, .6, 3, 12), mL, sh).position.y = .35;
      const el = new THREE.Group(); el.position.y = .7; sh.add(el); ball(el, .085, M(0xffc24a));
      mesh(new THREE.CapsuleGeometry(.055, .5, 3, 12), mL, el).position.y = .3;
      const wr = new THREE.Group(); wr.position.y = .6; el.add(wr); ball(wr, .07, M(0x5ad1a0));
      const hand = mesh(G().box, mL, wr); hand.scale.set(.18, .1, .1); hand.position.y = .09;
      for (const s of [-1, 1]) { const f = mesh(G().box, mL, wr); f.scale.set(.035, .14, .07); f.position.set(s * .065, .2, 0); }
      const tip = new THREE.Object3D(); tip.position.y = .27; wr.add(tip);
      const tr = Trail(R, 180, 0xffffff, .6);
      S.update = (t) => {
        yaw.rotation.y = .9 * Math.sin(t * .45); sh.rotation.z = .35 + .45 * Math.sin(t * .8);
        el.rotation.z = .8 + .6 * Math.sin(t * 1.25 + 1); wr.rotation.z = .7 * Math.sin(t * 2.1);
        R.updateMatrixWorld(true); tip.getWorldPosition(_c); tr(R.worldToLocal(_c));
      };
      return S;
    } },
  { s: 'rig', name: 'ボーンとスキニング', tag: 'SkinnedMesh · Bone',
    desc: '1本の筒の中に、黄色い骨（ボーン）を5本つないで入れています。表面の点（頂点）は、どの骨にどれだけついて動くかが決めてあり、骨を回すと表面がなめらかに曲がります。この仕組みをスキニングといい、キャラクターの体はほとんどこれで動いています。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.3, 5.2], look: [0, 1, 0] });
      const T = skinTube({ n: 5, L: 2, r: .17, w: .7, hs: 60, color: (y) => (Math.floor(y / .1) % 2 ? [.93, .9, .84] : [.55, .75, .95]) });
      S.root.add(T.mesh);
      S.update = (t) => { for (let i = 1; i < 5; i++) { T.bones[i].rotation.z = .38 * Math.sin(t * 1.5 - i * .7); T.bones[i].rotation.x = .16 * Math.sin(t * 1.1 - i * .5); } };
      return S;
    } },
  { s: 'rig', name: 'スキンウェイト', tag: 'skinWeight 硬い / なめらか', hint: '左：硬いウェイト　右：なめらかなウェイト',
    desc: '頂点が「どの骨に何割ついていくか」をウェイトといいます。赤は下の骨、青は上の骨に100%ついている頂点で、紫はその中間です。左は関節の上下でぱっきり分けたので、曲げると外側が引きのばされ、内側はめりこみます。右は関節の近くで少しずつ割合を変えたので、ゴムのようになめらかに曲がります。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.3, 5], look: [0, .8, 0] });
      const col = (y, a, w) => [lerp(1, .25, w), lerp(.38, .5, w), lerp(.28, 1, w)];
      const tubes = [.02, .9].map((w, i) => { const T = skinTube({ n: 2, L: 1.6, r: .17, w, hs: 64, color: col }); T.mesh.position.x = i ? .45 : -.75; S.root.add(T.mesh); return T; });
      S.update = (t) => { const a = -1.5 * hold(t, 6); tubes.forEach(T => { T.bones[1].rotation.z = a; }); };
      return S;
    } },
  { s: 'rig', name: 'ねじれてつぶれる関節', tag: 'キャンディラッパー現象', hint: '左：骨2本でねじる　右：ねじりを骨4つに分ける',
    desc: '先の骨を軸のまわりに大きくねじっています。ふつうのスキニングは、2つの骨の動きを「割合で平均」するので、ねじれが大きいと中間の頂点が真ん中に寄ってしまい、あめの包み紙のようにくびれます（左）。右のように、ねじりを何本かの骨に少しずつ分けると、つぶれが目立たなくなります。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.3, 5], look: [0, .8, 0] });
      const col = (y, a) => (Math.floor((a + PI) / TAU * 8) % 2 ? [.95, .92, .86] : [.9, .33, .3]);
      const mk = (n, x) => { const T = skinTube({ n, L: 1.6, r: .17, w: .9, hs: 64, color: col }); T.mesh.position.x = x; S.root.add(T.mesh);
        const p = mesh(G().box, M(0x3d4250), T.bones[n - 1]); p.scale.set(.5, .05, .12); p.position.y = T.seg; return T; };
      const A = mk(2, -.6), B = mk(5, .6);
      S.update = (t) => { const a = 2.9 * hold(t, 6); A.bones[1].rotation.y = a; for (let i = 1; i < 5; i++) B.bones[i].rotation.y = a / 4; };
      return S;
    } },
  { s: 'rig', name: 'ブレンドシェイプ', tag: 'morphTargetInfluences', hint: '下のバー：まばたき・口を開く・笑う の強さ',
    desc: '骨を使わず、形そのものを何通りか作っておき、元の形との間を割合で混ぜる方法です（モーフターゲット）。この顔には「目を閉じた形」「口を開けた形」「笑った形」が入っていて、それぞれの割合を0〜1で変えています。細かい表情づくりによく使われます。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, .15, 4.4], look: [0, -.05, 0], floor: false });
      const geo = new THREE.SphereGeometry(1, 128, 96), P = geo.attributes.position, N = P.count;
      const col = new Float32Array(N * 3), tg = [0, 1, 2].map(() => new Float32Array(N * 3));
      const EY = .2, EX = .34, mc = (u) => -.3 + .32 * u * u;
      const put = (arr, v, r, u, w) => { arr[v * 3] = r * Math.cos(w) * Math.sin(u); arr[v * 3 + 1] = r * Math.sin(w); arr[v * 3 + 2] = r * Math.cos(w) * Math.cos(u); };
      for (let v = 0; v < N; v++) {
        const u = Math.atan2(P.getX(v), P.getZ(v)), w = Math.asin(clamp(P.getY(v), -1, 1)), dm = w - mc(u);
        let c = [1, .72, .3];
        for (const s of [-1, 1]) {
          const bu = (u - s * .56) / .13, bv = (w + .07) / .09, bl = Math.max(0, 1 - Math.sqrt(bu * bu + bv * bv));
          c = [lerp(c[0], 1, bl * .8), lerp(c[1], .38, bl * .8), lerp(c[2], .35, bl * .8)];
          const eu = (u - s * EX) / .085, ev = (w - EY) / .13; if (eu * eu + ev * ev < 1) c = [.04, .035, .05];
        }
        if (Math.abs(u) < .3 && Math.abs(dm) < .045 * (1 - Math.pow(u / .3, 4) * .6)) c = [.28, .03, .05];
        col.set(c, v * 3);
        /* 0 blink: squeeze each eye vertically */
        let w0 = w, w2 = w;
        for (const s of [-1, 1]) {
          const du = (u - s * EX) / .2, dv = (w - EY) / .26, f = smooth(1 - Math.sqrt(du * du + dv * dv));
          w0 = lerp(w0, EY - .02 + (w - EY) * .08, f);
          if (w < EY) w2 += .045 * f;
        }
        put(tg[0], v, 1, u, w0);
        /* 1 open mouth: lips move apart, the dark band stretches into an opening */
        const fx = smooth(1 - Math.abs(u) / .42), fy = 1 - smooth(Math.abs(dm) / .28), inner = 1 - smooth(Math.abs(dm) / .1);
        put(tg[1], v, 1 - .07 * fx * inner, u, w + (dm > 0 ? .06 : -.17) * fx * fy);
        /* 2 smile: mouth corners go up, lower eyelids rise */
        const sx = smooth(1 - Math.abs(u) / .55), sy = 1 - smooth(Math.abs(dm) / .3);
        put(tg[2], v, 1, u, w2 + .12 * Math.min(1, (u / .32) * (u / .32)) * sx * sy);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const nrm = tg.map((a) => { const g = new THREE.BufferGeometry(); g.setIndex(geo.index); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); g.computeVertexNormals(); return g.attributes.normal; });
      geo.morphAttributes.position = tg.map(a => new THREE.Float32BufferAttribute(a, 3)); geo.morphAttributes.normal = nrm;
      const face = mesh(geo, M(0xffffff, { vertexColors: true, roughness: .45 }), S.root);
      const gs = [Gauge(S, -.56, -.72, .44, 0x6ad0ff), Gauge(S, 0, -.72, .44, 0xff7a8a), Gauge(S, .56, -.72, .44, 0xffd05a)];
      S.update = (t) => {
        const b = t % 3.1, c = t % 9, wB = b < .24 ? Math.sin(b / .24 * PI) : 0;
        const env = smooth(c / .4) * (1 - smooth((c - 4) / .4)), wO = clamp(env * (.45 + .35 * Math.sin(c * 8.3) + .2 * Math.sin(c * 13.1)), 0, 1);
        const wS = smooth((c - 4.5) / .6) * (1 - smooth((c - 8.3) / .6));
        const inf = face.morphTargetInfluences; inf[0] = wB; inf[1] = wO; inf[2] = wS;
        gs[0](wB); gs[1](wO); gs[2](wS); face.rotation.y = .3 * Math.sin(t * .5);
      };
      S.noSpin = true; return S;
    } },
  { s: 'rig', name: '頂点アニメーション', tag: '頂点の位置を毎フレーム計算',
    desc: '骨も形のお手本も使わず、旗の頂点1つ1つの位置を、毎フレーム波の式で計算し直しています。うっすら見える網の目の交点が頂点です。旗・水面・草のゆれなど、決まったパターンでくり返し動くものによく使われ、シェーダーで計算すればとても軽く動きます。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.4, 5], look: [0, 1.15, 0] });
      const pole = mesh(new THREE.CylinderGeometry(.03, .03, 2.2, 12), M(0xc9c3b6, { metalness: .6, roughness: .3 }), S.root); pole.position.set(-.75, 1.1, 0);
      ball(S.root, .05, M(0xffd24a, { metalness: .6, roughness: .3 })).position.set(-.75, 2.22, 0);
      const W = 1.5, H = .95, geo = new THREE.PlaneGeometry(W, H, 30, 18); geo.translate(W / 2, 0, 0);
      const base = geo.attributes.position.array.slice();
      const map = ctx.tex(256, 160, (g, w, h) => { const cs = ['#e04a4a', '#f2eee4', '#3d6fc4']; cs.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * h / 3, w, h / 3 + 1); }); g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(w * .3, h / 2, 26, 0, TAU); g.fill(); });
      const flag = mesh(geo, M(0xffffff, { map, side: THREE.DoubleSide, roughness: .8 }), S.root); flag.position.set(-.75, 1.72, 0);
      const wire = mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: .18 }), S.root); wire.position.copy(flag.position);
      const pa = geo.attributes.position.array;
      S.update = (t) => {
        for (let i = 0; i < pa.length; i += 3) {
          const x = base[i], y = base[i + 1], a = x / W;
          pa[i + 2] = a * (.17 * Math.sin(x * 4.2 - t * 5 + y * 1.3) + .05 * Math.sin(x * 9 - t * 8.3 + y * 2));
          pa[i + 1] = y - .05 * a * a * (1 + Math.sin(t * 1.3));
        }
        geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
      };
      return S;
    } },

  /* ---------- rotation & interpolation ---------- */
  { s: 'rot', name: 'オイラー角とクォータニオン', tag: 'Euler の補間 vs slerp', hint: '左（橙）：オイラー角を補間　右（青緑）：クォータニオンで補間',
    desc: 'どちらも同じ向きから、半透明で示した同じ向きまで回しています。X・Y・Zの3つの角度（オイラー角）をそれぞれ別々に補間すると、左のように大きくひっくり返る遠回りになります。回転を1つのまとまり（クォータニオン）として補間すると、右のように一番近い道筋でまっすぐ回ります。線は機首の通り道です。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.3, 4.1], look: [0, .8, 0], floor: false });
      const qA = new THREE.Quaternion(), eB = new THREE.Euler(PI, .6, PI), qB = new THREE.Quaternion().setFromEuler(eB);
      const sides = [[-.85, 0xff9a4a], [.85, 0x4ad6c0]].map(([x, c], k) => {
        const piv = new THREE.Group(); piv.position.set(x, .8, 0); S.root.add(piv);
        const g = glider(c); piv.add(g); const gh = glider(c, .25); gh.quaternion.copy(qB); piv.add(gh);
        const pts = []; for (let i = 0; i <= 80; i++) { const s = i / 80, q = new THREE.Quaternion(); if (k) q.slerpQuaternions(qA, qB, s); else q.setFromEuler(new THREE.Euler(PI * s, .6 * s, PI * s)); pts.push(V(0, 0, .53).applyQuaternion(q)); }
        line(piv, pts, c, .9); return g;
      });
      S.update = (t) => { const s = hold(t, 7); sides[0].rotation.set(PI * s, .6 * s, PI * s); sides[1].quaternion.slerpQuaternions(qA, qB, s); };
      return S;
    } },
  { s: 'rot', name: 'ジンバルロック', tag: 'Euler XYZ · 3つの輪',
    desc: 'オイラー角の回転を、入れ子になった3つの輪で表しました。外の緑がY軸、真ん中の赤がX軸、内側の青がZ軸の回転です。赤の輪が90度まで回ると、青と緑の輪がぴったり重なり、どちらを回しても同じ向きにしか回らなくなります。回せる向きが1つ減ってしまうこの状態をジンバルロックといいます。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.6, 5], look: [0, .9, 0], floor: false });
      const piv = new THREE.Group(); piv.position.y = .9; S.root.add(piv);
      const ring = (r, c, parent) => { const m = M(c, { roughness: .35, emissive: c, emissiveIntensity: 0 }); const g = new THREE.Group(); parent.add(g); mesh(new THREE.TorusGeometry(r, .035, 12, 96), m, g); return [g, m]; };
      const [gy, my] = ring(1.15, 0x5ad17a, piv); gy.children[0].rotation.x = PI / 2;
      const [gx] = ring(1.0, 0xff5a5a, gy); gx.children[0].rotation.y = PI / 2;
      const [gz, mz] = ring(.85, 0x5a9cff, gx);
      const obj = glider(0xe6e0d4); obj.scale.setScalar(1.05); gz.add(obj);
      for (const [g, p] of [[gy, V(0, 1.15, 0)], [gx, V(1, 0, 0)], [gz, V(0, 0, .85)]]) { ball(g, .05, M(0xd8d8d8)).position.copy(p); ball(g, .05, M(0xd8d8d8)).position.copy(p).negate(); }
      S.update = (t) => {
        gy.rotation.y = .5 * Math.sin(t * .6); gx.rotation.x = PI / 2 * hold(t, 8); gz.rotation.z = .6 * Math.sin(t * .9);
        const lock = smooth((gx.rotation.x - 1.3) / .25); my.emissiveIntensity = mz.emissiveIntensity = .9 * lock;
      };
      return S;
    } },
  { s: 'rot', name: '動きの緩急（イージング）', tag: 'linear · ease-in-out · back', hint: '上から：等速／ゆっくり始まりゆっくり止まる／行きすぎて戻る',
    desc: '3つの玉は、同じ時間で左から右へ動きます。うすい玉は、同じ時間おきに位置を写したもの（コマ送り）です。間隔が広いところは速く、せまいところはゆっくり動いています。始まりと終わりをゆっくりにしたり、少し行きすぎて戻したりするだけで、動きに重さや勢いが生まれます。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 0, 4.4], look: [0, 0, 0], floor: false }); S.root = null;
      const grp = new THREE.Group(); S.scene.add(grp);
      const c1 = 1.70158, fs = [(x) => x, (x) => smooth(x) * 0 + (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), (x) => 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)];
      const cols = [0x5cc8ff, 0xffb45c, 0xff6fa8], X0 = -1.1, XW = 2.2;
      const balls = fs.map((f, k) => {
        const y = .75 - k * .75; line(grp, [V(X0 - .15, y, 0), V(X0 + XW + .15, y, 0)], 0x8a90a0, .35);
        for (const x of [X0, X0 + XW]) { const m = mesh(G().box, new THREE.MeshBasicMaterial({ color: 0x8a90a0 }), grp); m.scale.set(.02, .26, .02); m.position.set(x, y, 0); }
        const gm = M(cols[k], { transparent: true, opacity: .3, depthWrite: false });
        for (let i = 0; i <= 12; i++) ball(grp, .06, gm).position.set(X0 + XW * f(i / 12), y, 0);
        const b = ball(grp, .1, M(cols[k], { emissive: cols[k], emissiveIntensity: .25 })); b.position.y = y; return b;
      });
      S.update = (t) => { const s = ramp(t, 5); balls.forEach((b, k) => { b.position.x = X0 + XW * fs[k](s); }); };
      S.noSpin = true; return S;
    } },
  { s: 'rot', name: 'キーのつなぎ方', tag: 'Discrete · Linear · Smooth', hint: '上から：ステップ／直線／なめらかな曲線',
    desc: 'ひし形は、アニメーターが決めた「キーフレーム」（この時刻にこの高さ、という印）です。3本とも同じキーですが、キーとキーの間の埋め方が違います。上は次のキーまで止まったまま、中は直線、下はなめらかな曲線でつなぎます。three.js の AnimationMixer で実際に再生しています。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 0, 4.4], look: [0, 0, 0], floor: false }); S.root = null;
      const grp = new THREE.Group(); S.scene.add(grp);
      const times = [0, 1, 2, 3, 4], vals = [0, .45, .1, .38, 0], X0 = -1.1, XW = 2.2, DUR = 4;
      const lanes = [[THREE.InterpolateDiscrete, 0xff8a5c], [THREE.InterpolateLinear, 0x5cc8ff], [THREE.InterpolateSmooth, 0x8ee07a]];
      const players = lanes.map(([mode, col], k) => {
        const y0 = .42 - k * .76;
        line(grp, [V(X0, y0, 0), V(X0 + XW, y0, 0)], 0x8a90a0, .3);
        const track = new THREE.NumberKeyframeTrack('.position[y]', times, vals.map(v => v + y0), mode);
        const ip = track.createInterpolant(); ip.settings = { endingStart: THREE.WrapAroundEnding, endingEnd: THREE.WrapAroundEnding };
        const pts = []; for (let i = 0; i <= 200; i++) { const tt = i / 200 * DUR; pts.push(V(X0 + XW * tt / DUR, ip.evaluate(Math.min(tt, DUR - 1e-4))[0], 0)); }
        line(grp, pts, col, .85);
        const dm = new THREE.MeshBasicMaterial({ color: 0xffffff });
        times.forEach((tt, i) => { const d = mesh(G().dia, dm, grp); d.scale.setScalar(.055); d.position.set(X0 + XW * tt / DUR, vals[i] + y0, 0); });
        const b = ball(grp, .075, M(col, { emissive: col, emissiveIntensity: .3 })); b.position.x = X0;
        const mx = new THREE.AnimationMixer(b), act = mx.clipAction(new THREE.AnimationClip('keys', DUR, [track])); act.play();
        return { mx, act, b };
      });
      S.update = (t, dt) => { for (const p of players) { p.mx.update(dt); p.b.position.x = X0 + XW * p.act.time / DUR; } };
      S.noSpin = true; return S;
    } },

  /* ---------- IK ---------- */
  { s: 'ik', name: '2関節IK', tag: 'two-bone IK · ポール',
    desc: '手の先を赤い玉に届かせるには、肩とひじを何度曲げればよいか、を逆算しています。このように「先の位置」から関節の角度を決める方法をIK（インバースキネマティクス）といいます。関節が2つなら三角形の計算で1回で解けます。ひじが曲がる向きは、紫の四角（ポール）で決めています。届かないときは、腕をまっすぐ伸ばします。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.5, 5.3], look: [0, .95, 0] }), R = S.root;
      const A = V(-.45, 1.05, 0);
      const post = mesh(G().cyl, M(0x3d4250), R); place(post, V(-.45, 0, 0), V(-.45, 1, 0), .07);
      const ch = Chain(R, 2, { r: .06, jr: .085, color: 0xe6e0d4, jmat: M(0xffc24a) });
      const handM = mesh(G().box, M(0xe6e0d4), R); handM.scale.setScalar(.13);
      const tgt = ball(R, .075, M(0xff4a4a, { emissive: 0xff2020, emissiveIntensity: .5 }));
      const pole = mesh(G().box, M(0xb07aff, { emissive: 0x7040c0, emissiveIntensity: .4 }), R); pole.scale.setScalar(.11);
      const toPole = Seg(R, 0xb07aff, .45), gap = Seg(R, 0xff6a6a, .7);
      const mid = V(), end = V(), T = V(), Pp = V();
      S.update = (t) => {
        T.set(.3 + .8 * Math.sin(t * .8), 1.0 + .6 * Math.sin(t * 1.3), .55 * Math.cos(t * .6)); tgt.position.copy(T);
        Pp.set(-.2 + .5 * Math.sin(t * .4), 2.1, -.4 + .6 * Math.cos(t * .5)); pole.position.copy(Pp);
        ik2(A, T, .75, .7, Pp, mid, end); ch.set([A, mid, end]); handM.position.copy(end); toPole(mid, Pp); gap(end, T);
      };
      return S;
    } },
  { s: 'ik', name: 'CCD IK', tag: 'CCD · 先の関節から順に回す',
    desc: '関節がたくさんある長いしっぽを、赤い玉に向けています。先端に近い関節から根元へ向かって1つずつ、「先端が目標に近づく向き」へ少しだけ回す、をくり返します（CCD）。計算が簡単で関節がいくつあっても使えますが、先のほうから曲がりやすく、くるりと丸まりがちです。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.4, 5.2], look: [0, .85, 0] }), R = S.root, n = 10;
      const P = []; for (let i = 0; i <= n; i++) P.push(V(0, i * .17, 0));
      const ch = Chain(R, n, { r: (i) => .065 * (1 - i / 12), jr: (i) => .07 * (1 - i / 13), color: 0xd9a066, tip: M(0xffe08a) });
      mesh(new THREE.CylinderGeometry(.18, .22, .08, 24), M(0x3d4250), R).position.y = .04;
      const tgt = ball(R, .075, M(0xff4a4a, { emissive: 0xff2020, emissiveIntensity: .5 })), T = V();
      S.update = (t) => { T.set(.8 * Math.cos(t * .55), .95 + .5 * Math.sin(t * 1.2), .8 * Math.sin(t * .55)); tgt.position.copy(T); P[0].set(0, .08, 0); ccd(P, T, 2, .18); ch.set(P); };
      return S;
    } },
  { s: 'ik', name: 'FABRIK', tag: 'FABRIK · 前後に引っぱる',
    desc: '3本の触手が同じ赤い玉を追いかけています。まず先端を目標に置き、骨の長さを保ったまま根元のほうへ順に引っぱり、次に根元を元の場所に戻して先端のほうへ引っぱり直す、をくり返します（FABRIK）。角度の計算がいらず速いので、ゲームでよく使われます。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.6, 5.2], look: [0, .8, 0] }), R = S.root, n = 7, L = new Array(n).fill(.24);
      const cols = [0x6fb2ff, 0x8ee07a, 0xffb45c];
      const arms = cols.map((c, k) => {
        const a = k / 3 * TAU + .3, base = V(.85 * Math.cos(a), .06, .85 * Math.sin(a));
        mesh(new THREE.CylinderGeometry(.13, .16, .08, 20), M(0x3d4250), R).position.set(base.x, .04, base.z);
        const P = []; for (let i = 0; i <= n; i++) P.push(V(base.x * (1 - i * .08), .06 + i * .2, base.z * (1 - i * .08)));
        return { base, P, ch: Chain(R, n, { r: (i) => .055 * (1 - i / 9), jr: (i) => .06 * (1 - i / 10), color: c }) };
      });
      const tgt = ball(R, .075, M(0xff4a4a, { emissive: 0xff2020, emissiveIntensity: .5 })), T = V();
      S.update = (t) => {
        T.set(.5 * Math.sin(t * .9), 1.05 + .3 * Math.sin(t * 1.3), .5 * Math.cos(t * .7)); tgt.position.copy(T);
        for (const a of arms) { for (let i = 1; i < n; i++) a.P[i].y += .04; fabrik(a.P, L, a.base, T, 3, .12); a.ch.set(a.P); }
      };
      return S;
    } },
  { s: 'ik', name: '足を段差に合わせる', tag: 'フットIK', hint: '左：IKなし　右：IKあり（赤い点が足の下の地面の高さ）',
    desc: '足元の段差が少しずつ流れていきます。左は立ちポーズのままなので、片足が宙に浮いたり、段にめりこんだりします。右は、それぞれの足の真下の地面の高さを調べ（赤い点）、そこへ足首が届くように2関節IKでひざを曲げ、腰も低いほうの足に合わせて下げています。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.5, 5], look: [0, .72, 0], floor: false }), R = S.root;
      const Hs = [0, .1, .2, .2, .1, 0, 0, .14, .28, .14], CW = .22, PER = CW * Hs.length;
      const terr = new THREE.Group(); R.add(terr); const mA = M(0x6a707c, { roughness: .9 }), mB = M(0x5a5f69, { roughness: .9 });
      for (let i = -14; i < 14; i++) { const h = Hs[((i % 10) + 10) % 10], b = mesh(G().box, i % 2 ? mA : mB, terr); b.scale.set(CW, h + .1, 1); b.position.set(i * CW + CW / 2, (h + .1) / 2 - .1, 0); }
      const hAt = (x, off) => { const i = Math.floor((x - off) / CW); return Hs[((i % 10) + 10) % 10]; };
      const figs = [-.75, .75].map((x, k) => {
        const F = Figure(R, k ? {} : { torso: 0x8d96a8 }); F.g.rotation.y = -PI / 2; F.g.position.x = x; return { F, x, ik: k === 1, h: [0, 0] };
      });
      const hits = [0, 1].map(() => ball(R, .035, OV(0xff4a4a), 12));
      S.update = (t, dt) => {
        const off = (t * .16) % PER; terr.position.x = off; const k = 1 - Math.exp(-dt * 14);
        for (const fg of figs) {
          const J = fg.F.J;
          if (!fg.ik) { const hc = hAt(fg.x, off); stand(J, { py: hc }); for (let i = 0; i < 2; i++) { _f.set(.01, ANK + hc, SIDE[i] * .11); leg(J, i, _f); } }
          else {
            for (let i = 0; i < 2; i++) fg.h[i] = lerp(fg.h[i], hAt(fg.x - SIDE[i] * .11, off), k);
            stand(J, { py: Math.min(fg.h[0], fg.h[1]) - .02 });
            for (let i = 0; i < 2; i++) { _f.set(.01, ANK + fg.h[i], SIDE[i] * .11); leg(J, i, _f); hits[i].position.set(fg.x - SIDE[i] * .11, fg.h[i] + .01, .2); }
          }
          fg.F.pose();
        }
      };
      S.noSpin = true; return S;
    } },
  { s: 'ik', name: '視線を向ける', tag: 'LookAt · 首と目',
    desc: 'オレンジの玉を目で追っています。目は玉のほうへまっすぐ向けますが、首は回せる角度に上限をつけ、少し遅れてゆっくりついていくようにしました。体も首の半分くらいだけ一緒にひねります。目・首・体で動きを分けると、人形っぽさが消えて自然に見えます。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.45, 5.4], look: [0, 1.1, 0], floor: false }), R = S.root;
      const body = new THREE.Group(); R.add(body);
      const torso = mesh(new THREE.CapsuleGeometry(.26, .3, 4, 16), M(0x5b8fd6), body); torso.position.y = .55; torso.scale.z = .75;
      mesh(new THREE.CylinderGeometry(.08, .09, .25, 12), M(0xeadfcf), body).position.y = 1.02;
      const head = new THREE.Group(); head.position.y = 1.35; head.rotation.order = 'YXZ'; body.add(head);
      ball(head, .3, M(0xeadfcf));
      const nose = mesh(new THREE.ConeGeometry(.05, .12, 12), M(0xe0c8b0), head); nose.rotation.x = PI / 2; nose.position.set(0, -.04, .31);
      const eyes = [-1, 1].map((s) => { const e = new THREE.Group(); e.position.set(s * .11, .07, .24); head.add(e); ball(e, .075, M(0xffffff, { roughness: .3 })); ball(e, .038, M(0x1c2230, { roughness: .2 })).position.z = .055; return e; });
      const tgt = ball(R, .065, M(0xffa53a, { emissive: 0xff8a20, emissiveIntensity: .6 })), T = V(), W = V(), E = V();
      const sight = Seg(R, 0xffa53a, .35); let yaw = 0, pitch = 0;
      S.update = (t, dt) => {
        T.set(.95 * Math.sin(t * .7), 1.3 + .5 * Math.sin(t * 1.13), .9 + .4 * Math.cos(t * .5)); tgt.position.copy(T);
        const dx = T.x, dy = T.y - 1.35, dz = T.z, k = 1 - Math.exp(-dt * 3.5);
        const dyaw = clamp(Math.atan2(dx, dz), -.9, .9), dpitch = clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -.45, .45);
        yaw = lerp(yaw, dyaw, k); pitch = lerp(pitch, dpitch, k);
        body.rotation.y = yaw * .35; head.rotation.set(pitch, yaw * .65, 0);
        R.updateMatrixWorld(true); tgt.getWorldPosition(W); for (const e of eyes) e.lookAt(W);
        head.localToWorld(E.set(0, .07, .3)); R.worldToLocal(E); sight(E, T);
      };
      S.noSpin = true; return S;
    } },

  /* ---------- secondary motion ---------- */
  { s: 'second', name: '揺れもの', tag: 'スプリングボーン',
    desc: '体は左右に走って急に止まり、ぴょこぴょこはねています。触角としっぽは手で動きをつけておらず、「元の向きに戻ろうとするばね」と「おもさ・空気の抵抗」だけで毎フレーム計算しています（スプリングボーン）。髪やスカート、アクセサリーの揺れによく使われます。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.3, 5], look: [0, .6, 0] }), R = S.root;
      const body = new THREE.Group(); R.add(body); ball(body, .36, M(0x7ad0a0, { roughness: .45 }));
      for (const s of [-1, 1]) { const e = new THREE.Group(); e.position.set(s * .13, .08, .3); body.add(e); ball(e, .075, M(0xffffff, { roughness: .3 })); ball(e, .04, M(0x1c2230)).position.z = .05; }
      const defs = [
        { off: V(-.14, .31, .02), dir: V(-.3, 1, 0), n: 5, len: .11, k: .02, damp: .035 },
        { off: V(.14, .31, .02), dir: V(.3, 1, 0), n: 5, len: .11, k: .02, damp: .035 },
        { off: V(0, -.02, -.33), dir: V(0, .3, -1), n: 6, len: .1, k: .008, damp: .03 }];
      const chains = defs.map((d, j) => { d.dir.normalize(); d.P = []; d.Q = []; for (let i = 0; i <= d.n; i++) { d.P.push(V()); d.Q.push(V()); }
        d.ch = Chain(R, d.n, { r: (i) => (j < 2 ? .02 : .05 * (1 - i / 8)), jr: (i) => (j < 2 ? .025 : .055 * (1 - i / 8)), color: j < 2 ? 0x3d4250 : 0x7ad0a0, jmat: M(j < 2 ? 0x3d4250 : 0x6abf90), tip: M(0xffd24a, { emissive: 0xffa000, emissiveIntensity: .3 }) });
        d.init = false; return d; });
      const pos = V(); let acc = 0; const h = 1 / 120, g = -9.8 * h * h * .35;
      const bodyAt = (t, out) => out.set(.75 * clamp(3 * Math.sin(t * 1.25), -1, 1), .42 + .16 * Math.abs(Math.sin(t * 3.4)), 0);
      let simT = 0;
      S.update = (t, dt) => {
        acc += dt; if (!simT) simT = t - dt;
        while (acc >= h) {
          acc -= h; simT += h; bodyAt(simT, pos);
          for (const d of chains) {
            d.P[0].copy(pos).add(d.off);
            if (!d.init) { for (let i = 1; i <= d.n; i++) { d.P[i].copy(d.P[i - 1]).addScaledVector(d.dir, d.len); d.Q[i].copy(d.P[i]); } d.init = true; }
            for (let i = 1; i <= d.n; i++) {
              const p = d.P[i], q = d.Q[i]; _c.copy(d.P[i - 1]).addScaledVector(d.dir, d.len);
              _a.subVectors(p, q).multiplyScalar(1 - d.damp); q.copy(p);
              p.add(_a).addScaledVector(_b.subVectors(_c, p), d.k); p.y += g;
              p.sub(d.P[i - 1]).setLength(d.len).add(d.P[i - 1]);
            }
          }
        }
        body.position.copy(pos); for (const d of chains) d.ch.set(d.P);
      };
      return S;
    } },
  { s: 'second', name: '遅れて追いかける', tag: 'オーバーラップ · フォロースルー', hint: '左：遅れなし　右：先へいくほど遅れる',
    desc: '台の傾きに合わせて、2本の棒を左右にふっています。左は全部の節が同じ角度で動くので、1本の固い棒に見えます。右は先の節ほど少し遅れて同じ動きをするようにしただけですが、しなやかにしなって見えます。根元が止まっても先が遅れて動き続けるこの表現は、アニメーションの基本の1つです。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.3, 5], look: [0, .8, 0] }), R = S.root, n = 7, sl = .19;
      const mk = (x, c, lag) => {
        const base = mesh(G().box, M(0x3d4250), R); base.scale.set(.34, .12, .34); base.position.set(x, .06, 0);
        const P = []; for (let i = 0; i <= n; i++) P.push(V(x, .12, 0));
        return { x, lag, base, P, ch: Chain(R, n, { r: (i) => .05 * (1 - i / 9), jr: (i) => .055 * (1 - i / 9), color: c, tip: M(0xffd24a) }), tr: Trail(R, 70, c, .5) };
      };
      const st = [mk(-.7, 0x8fa4c8, 0), mk(.7, 0xff9a5c, .11)];
      const A = (t) => .5 * Math.sin(t * 2.2) * (.6 + .4 * Math.sin(t * .37));
      S.update = (t) => {
        for (const s of st) {
          s.base.rotation.z = -A(t) * .4; s.P[0].set(s.x, .12, 0);
          for (let i = 0; i < n; i++) { const a = A(t - i * s.lag) * (s.lag ? 1 + i * .12 : 1); s.P[i + 1].set(s.P[i].x - sl * Math.sin(a), s.P[i].y + sl * Math.cos(a), 0); }
          s.ch.set(s.P); s.tr(s.P[n]);
        }
      };
      return S;
    } },
  { s: 'second', name: '呼吸と揺らぎ', tag: '待機モーション · ノイズ', hint: '左：止めたまま　右：呼吸と小さな揺らぎあり',
    desc: '立って待っているだけのポーズです。左は完全に止めているので、置物のように見えます。右は、ゆっくりした呼吸で胸と肩を上下させ、さらに不規則な小さな揺れ（ノイズ）で頭の向きや重心を少しずつずらしています。動かない場面でも、ほんの少しの動きが「生きている感じ」を作ります。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.2, 4.8], look: [0, .88, 0] }), R = S.root;
      const figs = [-.6, .6].map((x, k) => { const F = Figure(R, k ? {} : { torso: 0x8d96a8 }); F.g.rotation.y = -PI / 2; F.g.position.x = x; return F; });
      stand(figs[0].J); figs[0].pose();
      S.update = (t) => {
        const F = figs[1], J = F.J, br = Math.sin(TAU * t / 3.6);
        stand(J, { breath: br, pz: .03 * wob(t * .45, 1), px: .01 * wob(t * .5, 4), lean: .03 + .025 * wob(t * .6, 2), arm: .03 * wob(t * .7, 6), elbow: .04 * br });
        J.yaw = .28 * wob(t * .38, 5); J.nod = .08 * wob(t * .55, 7) - .03 * br; J.roll = .06 * wob(t * .42, 9); F.pose();
      };
      S.noSpin = true; return S;
    } },

  /* ---------- combining ---------- */
  { s: 'blend', name: '歩きを計算で作る', tag: '手続き的な歩行サイクル',
    desc: '歩くアニメーションを、手で作らずに式で作っています。足首は線で示したD字形の道を回り、地面についている間は床と同じ速さで後ろへ、浮いている間は弧を描いて前へ戻ります。ひざの角度はその足首の位置からIKで決め、腕は足と逆向きにふり、腰は1歩ごとに少し上下させています。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.2, 5.2], look: [0, .8, 0] }), R = S.root, scroll = stripes(ctx, S.floor, 4.4);
      const F = Figure(R); let ph = 0;
      const cols = [0x6fb2ff, 0xff9a5c], marks = [0, 1].map((i) => { const pts = []; for (let k = 0; k <= 64; k++) { const p = footAt(k / 64, WALK, V()); p.z = SIDE[i] * .1; pts.push(p); } line(R, pts, cols[i], .9); return ball(R, .045, OV(cols[i]), 12); });
      S.update = (t, dt) => {
        ph = (ph + dt / WALK.T) % 1; gait(ph, WALK, F.J); F.pose(); scroll(speed(WALK) * dt);
        for (let i = 0; i < 2; i++) marks[i].position.copy(F.J.ankle[i]);
      };
      return S;
    } },
  { s: 'blend', name: '歩き↔走りのブレンド', tag: 'ブレンドの重み · 足並みの同期', hint: '下のバー：走りの割合（0＝歩き、1＝走り）',
    desc: '「歩き」と「走り」の2つの動きを、割合を変えながら混ぜています。歩幅・足の上げ方・前かがみ・腕のふりをそれぞれ割合で混ぜ、1歩の長さも混ぜた値に合わせて進めるので、足並みがずれずに歩きから走りへ切れ目なく変わります。床の模様は、その時の速さで流しています。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.2, 5.2], look: [0, .78, 0] }), R = S.root, scroll = stripes(ctx, S.floor, 4.4);
      const F = Figure(R), P = {}, gauge = Gauge(S, 0, -.72, 1.2, 0xffb45c); let ph = 0;
      S.update = (t, dt) => {
        const w = hold(t, 9); mixP(WALK, RUN, w, P);
        ph = (ph + dt / P.T) % 1; gait(ph, P, F.J); F.pose(); scroll(speed(P) * dt); gauge(w);
      };
      return S;
    } },
  { s: 'blend', name: '上半身と下半身で別の動き', tag: 'レイヤー · マスク', hint: '青：歩きの動き　オレンジ：手をふる動き',
    desc: '下半身（青）には歩きの動きを、上半身の右腕（オレンジ）には手をふる動きを使っています。体の部分ごとに「どの動きを使うか」を分けて重ねる仕組みをレイヤー（またはマスク）といいます。「走りながら撃つ」「歩きながら手をふる」といった組み合わせを、別々に作った動きから作れます。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.25, 5.2], look: [0, .85, 0] }), R = S.root, scroll = stripes(ctx, S.floor, 4.4);
      const F = Figure(R, { torso: 0x5b8fd6, legL: 0x4d6fa8, legR: 0x7aa6e8, armL: 0x7aa6e8, armR: 0xffa24a }); let ph = 0;
      const J = F.J, dir = V();
      S.update = (t, dt) => {
        ph = (ph + dt / WALK.T) % 1; gait(ph, WALK, J);
        const s = J.sh[1], w = .55 * Math.sin(t * 7);
        J.el[1].copy(s).addScaledVector(dir.set(.1, .85, .45).normalize(), .29);
        J.ha[1].copy(J.el[1]).addScaledVector(dir.set(.12, Math.cos(w), Math.sin(w)).normalize(), .27);
        F.pose(); scroll(speed(WALK) * dt);
      };
      return S;
    } },
  { s: 'blend', name: 'ルートモーション', tag: 'root motion vs その場歩き', hint: '手前：足の動きどおりに進む　奥：速すぎて足がすべる',
    desc: '2人とも同じ歩きの動きですが、進む速さの決め方が違います。手前は、足が地面をけった分だけ体を前へ進めるので（ルートモーション）、足あとがその場にとどまります。奥は、その場歩きの動きを別に決めた速さで動かしているので、速さが合わず足が地面をすべり、足あとが長くのびてしまいます。',
    make: (ctx) => {
      const S = stage(ctx, { cam: [0, 1.7, 6.2], look: [0, .6, 0], fov: 36, floor: false }), R = new THREE.Group(); R.rotation.y = .25; S.root.add(R);
      const fl = mesh(new THREE.PlaneGeometry(4.6, 2.2), M(0x5a5f69, { roughness: .95 }), R); fl.rotation.x = -PI / 2; stripes(ctx, fl, 4.6);
      const v = speed(WALK);
      const mk = (z, mul, c, torso) => { const F = Figure(R, { torso }); F.g.position.z = z;
        const mm = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .8, depthWrite: false });
        const marks = [0, 1].map(() => { const m = mesh(G().box, mm, R); m.scale.set(.001, .004, .1); return m; });
        return { F, z, mul, x: z < 0 ? -1.2 : -.3, ph: 0, marks, st: [null, null], was: [false, false] }; };
      const ws = [mk(-.55, 1.9, 0xff6a3a, 0x8d96a8), mk(.55, 1, 0x1c1f26, 0x5b8fd6)];
      S.update = (t, dt) => {
        for (const w of ws) {
          w.ph = (w.ph + dt / WALK.T) % 1; w.x += v * w.mul * dt; let wrap = false; if (w.x > 2.1) { w.x -= 4.2; wrap = true; for (const m of w.marks) m.scale.x = .001; }
          w.F.g.position.x = w.x; gait(w.ph, WALK, w.F.J); w.F.pose();
          for (let i = 0; i < 2; i++) {
            const f = (w.ph + i * .5) % 1, on = f < WALK.duty, fx = w.x + w.F.J.ankle[i].x + .06, m = w.marks[i];
            if (on && (!w.was[i] || wrap || w.st[i] === null)) w.st[i] = fx;
            if (on) { const a = Math.min(w.st[i], fx) - .115, b = Math.max(w.st[i], fx) + .115; m.scale.x = b - a; m.position.set((a + b) / 2, .003, w.z + SIDE[i] * .1); }
            w.was[i] = on;
          }
        }
      };
      S.noSpin = true; return S;
    } }
];

const SECTIONS = [
  { id: 'rig', en: 'Rig & deformation', title: '形を動かす仕組み', lead: '3Dのキャラクターは、毎回形を作り直すのではなく、中に入れた骨を回したり、用意した形を混ぜたりして動かします。骨のつなぎ方と、表面の曲がり方の決め方です。' },
  { id: 'rot', en: 'Rotation & interpolation', title: '回転と補間', lead: 'アニメーションは、決めておいた「キー」の間を計算で埋めて作ります（補間）。特に回転の補間には、思わぬ落とし穴があります。' },
  { id: 'ik', en: 'Inverse kinematics', title: '目標に届かせる（IK）', lead: '「手をここに置きたい」「足を地面につけたい」という目標から、関節の角度を逆算する方法です。赤い玉が目標です。' },
  { id: 'second', en: 'Secondary motion', title: '二次的な動き', lead: '体の大きな動きにつられて起きる、揺れ・しなり・呼吸などの小さな動きです。これがあるだけで、動きがぐっと生き生きします。' },
  { id: 'blend', en: 'Combining motion', title: '動きを組み合わせる', lead: '歩く・走る・手をふるなど、別々に作った動きを混ぜたり重ねたりして、場面に合った動きを作ります。' }
];

run({ sections: SECTIONS, items: ITEMS, minCol: 300, rx: .12, ry: -.35, spin: .15 });
series('anim3d');
})();
