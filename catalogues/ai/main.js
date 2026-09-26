/* 動き・AI図鑑 — card definitions. Runtime: assets/js/g2d.js */
(function () {
const { rng, clamp, lerp, COL, label, run, series, makeNoise } = G2D;
const W = 240, H = 240, TAU = Math.PI * 2;

/* ---------- vectors & agents ---------- */
const len = (x, y) => Math.hypot(x, y);
function setLen(x, y, l) { const d = Math.hypot(x, y) || 1; return [x / d * l, y / d * l]; }
function limit(x, y, m) { const d = Math.hypot(x, y); return d > m ? [x / d * m, y / d * m] : [x, y]; }
class Ag {
  constructor(x, y, ms = 2, mf = .08) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.ms = ms; this.mf = mf; this.ax = 0; this.ay = 0; this.trail = []; }
  add(f, w = 1) { this.ax += f[0] * w; this.ay += f[1] * w; }
  steer(dx, dy) { return limit(dx - this.vx, dy - this.vy, this.mf); }
  seek(tx, ty) { return this.steer(...setLen(tx - this.x, ty - this.y, this.ms)); }
  flee(tx, ty) { return this.steer(...setLen(this.x - tx, this.y - ty, this.ms)); }
  arrive(tx, ty, r = 60) { const d = len(tx - this.x, ty - this.y), sp = d < r ? this.ms * d / r : this.ms; return this.steer(...setLen(tx - this.x, ty - this.y, sp)); }
  update(wrap) {
    this.vx += this.ax; this.vy += this.ay; [this.vx, this.vy] = limit(this.vx, this.vy, this.ms);
    this.x += this.vx; this.y += this.vy; this.ax = this.ay = 0;
    if (wrap) { if (this.x < -5) this.x += W + 10; if (this.x > W + 5) this.x -= W + 10; if (this.y < -5) this.y += H + 10; if (this.y > H + 5) this.y -= H + 10; }
  }
  get ang() { return Math.atan2(this.vy, this.vx); }
}
function drawAg(g, a, col = '#7fd6ff', s = 1) {
  g.save(); g.translate(a.x, a.y); g.rotate(a.ang); g.scale(s, s); g.fillStyle = col;
  g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, 4.2); g.lineTo(-3, 0); g.lineTo(-5, -4.2); g.closePath(); g.fill(); g.restore();
}
function trail(g, a, col, n = 40) { a.trail.push([a.x, a.y]); if (a.trail.length > n) a.trail.shift(); g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); a.trail.forEach(([x, y], i) => { if (i && Math.abs(x - a.trail[i - 1][0]) > 50) g.moveTo(x, y); else i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
function bg(g) { g.fillStyle = '#0d1122'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(120,140,200,.06)'; g.lineWidth = 1; g.beginPath(); for (let i = 20; i < W; i += 20) { g.moveTo(i, 0); g.lineTo(i, H); g.moveTo(0, i); g.lineTo(W, i); } g.stroke(); }
function target(g, x, y, col = COL.red) { g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.moveTo(x - 10, y); g.lineTo(x + 10, y); g.moveTo(x, y - 10); g.lineTo(x, y + 10); g.stroke(); }
function lissa(t) { return [120 + Math.sin(t * .013) * 85, 120 + Math.sin(t * .021 + 1) * 80]; }

/* generic card with a pointer-controllable target */
function card(o) {
  return Object.assign({ interactive: true, capture: false }, o, {
    make: (env) => {
      const st = { t: 0, rand: env.rand, ptr: null, env };
      o.init(st); o.step(st); st.t++;
      return {
        step() { o.step(st); st.t++; },
        draw(g) { bg(g); o.draw(g, st); },
        move(p) { st.ptr = p; if (o.move) o.move(st, p); },
        leave() { st.ptr = null; },
        down(p) { if (o.down) o.down(st, p); },
        hud() { return o.hud ? o.hud(st) : []; }
      };
    }
  });
}

/* ---------- boids ---------- */
function flockForces(a, all, o) {
  let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, ns = 0, na = 0, nc = 0;
  for (const b of all) { if (b === a) continue; const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
    if (d < 16 && d > 0) { sx += dx / d / d; sy += dy / d / d; ns++; }
    if (d < 32) { ax += b.vx; ay += b.vy; na++; }
    if (d < 44) { cx += b.x; cy += b.y; nc++; } }
  if (o.sep && ns) a.add(a.steer(...setLen(sx, sy, a.ms)), o.sep);
  if (o.ali && na) a.add(a.steer(...setLen(ax, ay, a.ms)), o.ali);
  if (o.coh && nc) a.add(a.seek(cx / nc, cy / nc), o.coh);
}
function flockCard(o) {
  return card({ s: 'flock', name: o.name, tag: o.tag, desc: o.desc, hint: o.hint,
    init: (s) => { s.B = []; for (let i = 0; i < 70; i++) { const b = new Ag(o.cluster ? 120 + (s.rand() - .5) * 60 : s.rand() * W, o.cluster ? 120 + (s.rand() - .5) * 60 : s.rand() * H, 1.6, .05); const a = s.rand() * TAU; b.vx = Math.cos(a); b.vy = Math.sin(a); b.wa = s.rand() * TAU; s.B.push(b); }
      if (o.init) o.init(s); },
    step: (s) => { for (const b of s.B) {
        flockForces(b, s.B, o.w);
        if (o.wander) { b.wa += (s.rand() - .5) * .5; b.add([Math.cos(b.wa) * .03, Math.sin(b.wa) * .03]); }
        if (s.ptr && o.repel) { const d = len(b.x - s.ptr.x, b.y - s.ptr.y); if (d < 45) b.add(b.flee(s.ptr.x, s.ptr.y), 2.5); }
        if (o.extra) o.extra(s, b);
      }
      if (o.stepExtra) o.stepExtra(s);
      for (const b of s.B) b.update(true); },
    draw: (g, s) => { for (const b of s.B) drawAg(g, b, b.col || o.col || '#7fd6ff', .85); if (o.drawExtra) o.drawExtra(g, s); if (s.ptr && o.repel) { g.strokeStyle = 'rgba(255,84,112,.4)'; g.beginPath(); g.arc(s.ptr.x, s.ptr.y, 45, 0, TAU); g.stroke(); } } });
}

/* ---------- grid map for path-finding ---------- */
const N = 24, CS = 10;
const idx = (x, y) => y * N + x;
function makeMap() {
  let seed = 4242;
  for (;;) {
    const R = rng(seed++), noise = makeNoise(R), wall = new Uint8Array(N * N), cost = new Float32Array(N * N).fill(1);
    for (let k = 0; k < 9; k++) { const w = 1 + (R() * 5) | 0, h = 1 + (R() * 6) | 0, x0 = 3 + (R() * (N - 6 - w)) | 0, y0 = (R() * (N - h)) | 0; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) wall[idx(x, y)] = 1; }
    for (let x = 6; x < 18; x++) if (x !== 11 && x !== 12) wall[idx(x, 7)] = 1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!wall[idx(x, y)] && noise.fbm(x * .12, y * .12, 3) > .12) cost[idx(x, y)] = 5;
    const S = [1, 12], G = [22, 12];
    for (const [cx, cy] of [S, G]) for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) { wall[idx(x, y)] = 0; cost[idx(x, y)] = 1; }
    const m = { wall, cost, S, G };
    if (search(m, 'bfs', G).path.length) return m;
  }
}
function neigh(m, i, diag) {
  const x = i % N, y = (i / N) | 0, out = [];
  const D = diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of D) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; if (m.wall[idx(nx, ny)]) continue;
    if (dx && dy && (m.wall[idx(x + dx, y)] || m.wall[idx(x, y + dy)])) continue; out.push([idx(nx, ny), dx && dy ? Math.SQRT2 : 1]); }
  return out;
}
class Heap { constructor() { this.a = []; } push(v, p) { const a = this.a; a.push([p, v]); let i = a.length - 1; while (i) { const j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top[1]; }
  get size() { return this.a.length; } }
function search(m, kind, goal) {
  const s = idx(...m.S), gI = idx(...goal), gx = goal[0], gy = goal[1];
  const prev = new Int32Array(N * N).fill(-1), gs = new Float32Array(N * N).fill(Infinity), closed = new Uint8Array(N * N), order = [];
  const h = (i) => Math.abs(i % N - gx) + Math.abs(((i / N) | 0) - gy);
  gs[s] = 0;
  if (kind === 'bfs') {
    const q = [s]; closed[s] = 1; let qi = 0;
    while (qi < q.length) { const i = q[qi++]; order.push(i); if (i === gI) break; for (const [j] of neigh(m, i)) if (!closed[j]) { closed[j] = 1; prev[j] = i; q.push(j); } }
  } else {
    const hp = new Heap(); hp.push(s, 0);
    while (hp.size) { const i = hp.pop(); if (closed[i]) continue; closed[i] = 1; order.push(i); if (i === gI) break;
      for (const [j] of neigh(m, i)) { const ng = gs[i] + m.cost[j]; if (ng < gs[j]) { gs[j] = ng; prev[j] = i; hp.push(j, kind === 'dijkstra' ? ng : kind === 'astar' ? ng + h(j) : h(j)); } } }
  }
  const path = []; if (prev[gI] !== -1 || gI === s) { for (let i = gI; i !== -1; i = prev[i]) path.unshift(i); }
  let c = 0; for (let k = 1; k < path.length; k++) c += m.cost[path[k]];
  return { order, path, cost: c };
}
const MAP = makeMap();
function drawMap(g, m, o = {}) {
  g.fillStyle = '#10152a'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = idx(x, y);
    if (m.wall[i]) { g.fillStyle = '#3a4468'; g.fillRect(x * CS, y * CS, CS, CS); }
    else if (m.cost[i] > 1 && o.swamp !== false) { g.fillStyle = '#17332a'; g.fillRect(x * CS, y * CS, CS, CS); g.fillStyle = '#23503f'; g.fillRect(x * CS + 2, y * CS + 6, 3, 1); g.fillRect(x * CS + 6, y * CS + 3, 3, 1); } }
}
const cc = (i) => [(i % N) * CS + CS / 2, ((i / N) | 0) * CS + CS / 2];
function endpoints(g, m, goal) { const [sx, sy] = [m.S[0] * CS + 5, m.S[1] * CS + 5]; g.fillStyle = COL.green; g.beginPath(); g.arc(sx, sy, 4.5, 0, TAU); g.fill(); target(g, goal[0] * CS + 5, goal[1] * CS + 5); }
function cellAt(p) { return [clamp((p.x / CS) | 0, 0, N - 1), clamp((p.y / CS) | 0, 0, N - 1)]; }

function searchCard(kind, o) {
  return card({ s: 'path', name: o.name, tag: o.tag, desc: o.desc, hint: 'クリックでゴールを移動',
    init: (s) => { s.goal = MAP.G.slice(); s.res = search(MAP, kind, s.goal); s.k = 0; },
    step: (s) => { s.k += 3; if (s.k > s.res.order.length + 180) s.k = 0; },
    down: (s, p) => { const c = cellAt(p); if (!MAP.wall[idx(...c)]) { s.goal = c; s.res = search(MAP, kind, s.goal); s.k = 0; } },
    draw: (g, s) => { drawMap(g, MAP, { swamp: kind !== 'bfs' || true });
      const n = Math.min(s.k, s.res.order.length);
      for (let k = 0; k < n; k++) { const i = s.res.order[k], f = k / s.res.order.length; g.fillStyle = `hsla(${lerp(200, 290, f)},80%,62%,.42)`; g.fillRect((i % N) * CS + 1, ((i / N) | 0) * CS + 1, CS - 2, CS - 2); }
      if (s.k >= s.res.order.length) { const p = s.res.path, m = Math.min(p.length, ((s.k - s.res.order.length) / 2) | 0); g.strokeStyle = COL.yellow; g.lineWidth = 2.5; g.lineJoin = 'round'; g.beginPath(); for (let k = 0; k < m; k++) { const [x, y] = cc(p[k]); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
      endpoints(g, MAP, s.goal); },
    hud: (s) => ['調べたマス ' + Math.min(s.k, s.res.order.length), s.k >= s.res.order.length ? '道のコスト ' + s.res.cost.toFixed(0) : '探索中…'] });
}

/* ---------- walls for perception demos ---------- */
const RECTS = [[60, 40, 30, 60], [150, 30, 20, 50], [110, 130, 60, 18], [30, 160, 40, 20], [180, 150, 20, 60]];
function rayRect(ox, oy, dx, dy, r) {
  let t0 = 0, t1 = Infinity; const [x, y, w, h] = r;
  for (const [o, d, lo, hi] of [[ox, dx, x, x + w], [oy, dy, y, y + h]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return Infinity; continue; }
    let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return Infinity;
  }
  return t0;
}
function cast(ox, oy, a, maxD) { const dx = Math.cos(a), dy = Math.sin(a); let t = maxD; for (const r of RECTS) t = Math.min(t, rayRect(ox, oy, dx, dy, r)); return t; }
function canSee(gx, gy, face, px, py, fov, range) {
  const dx = px - gx, dy = py - gy, d = Math.hypot(dx, dy); if (d > range) return false;
  let da = Math.atan2(dy, dx) - face; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > fov) return false;
  return cast(gx, gy, Math.atan2(dy, dx), d) >= d - .5;
}
function cone(g, x, y, face, fov, range, col) {
  g.fillStyle = col; g.beginPath(); g.moveTo(x, y);
  for (let k = 0; k <= 40; k++) { const a = face - fov + 2 * fov * k / 40, d = cast(x, y, a, range); g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  g.closePath(); g.fill();
}
function drawRects(g) { g.fillStyle = '#3a4468'; for (const [x, y, w, h] of RECTS) g.fillRect(x, y, w, h); }
function player(g, x, y, seen) { g.fillStyle = seen ? COL.red : COL.green; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); g.strokeStyle = '#0b0e1a'; g.lineWidth = 1.5; g.stroke(); }
const PLAYER_LOOP = [[20, 20], [120, 20], [215, 110], [140, 225], [95, 115], [20, 225]];
function loopPos(t, pts, sp) {
  let L = 0; const seg = pts.map((p, i) => { const q = pts[(i + 1) % pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); L += l; return l; });
  let d = (t * sp) % L; for (let i = 0; i < pts.length; i++) { if (d <= seg[i]) { const p = pts[i], q = pts[(i + 1) % pts.length], k = d / seg[i]; return [lerp(p[0], q[0], k), lerp(p[1], q[1], k)]; } d -= seg[i]; }
  return pts[0];
}

/* ---------- catalogue ---------- */
const ITEMS = [
  card({ s: 'steer', name: '追いかける（Seek）', tag: 'desired = 目標方向 × 最高速',
    desc: '「目標へ最高速で向かう速さ」と「今の速さ」の差を、少しずつ力として足します。一度に曲がれる量に上限があるので、大回りしながら追いかけます。',
    hint: 'カーソルを置くと目標になる',
    init: (s) => { s.a = new Ag(40, 200, 2.4, .07); },
    step: (s) => { const [tx, ty] = s.ptr ? [s.ptr.x, s.ptr.y] : lissa(s.t); s.tx = tx; s.ty = ty; s.a.add(s.a.seek(tx, ty)); s.a.update(); },
    draw: (g, s) => { trail(g, s.a, 'rgba(127,214,255,.3)'); target(g, s.tx, s.ty); drawAg(g, s.a); } }),
  card({ s: 'steer', name: '逃げる（Flee）', tag: 'desired = 目標と反対方向',
    desc: 'Seekの向きを逆にしただけです。一定距離より近づいたときだけ逃げ、遠いときはゆっくりうろつきます。画面の端では内側に戻る力を足しています。',
    hint: 'カーソルで追い回せる',
    init: (s) => { s.A = []; for (let i = 0; i < 8; i++) { const a = new Ag(60 + s.rand() * 120, 60 + s.rand() * 120, 2.6, .12); a.wa = s.rand() * TAU; s.A.push(a); } },
    step: (s) => { const [tx, ty] = s.ptr ? [s.ptr.x, s.ptr.y] : lissa(s.t * 1.4); s.tx = tx; s.ty = ty;
      for (const a of s.A) { const d = len(a.x - tx, a.y - ty); if (d < 60) a.add(a.flee(tx, ty)); else { a.wa += (s.rand() - .5) * .4; a.add([Math.cos(a.wa) * .03, Math.sin(a.wa) * .03]); a.vx *= .97; a.vy *= .97; }
        if (a.x < 15 || a.x > W - 15 || a.y < 15 || a.y > H - 15) a.add(a.seek(120, 120), 1.5); a.update(); } },
    draw: (g, s) => { g.strokeStyle = 'rgba(255,84,112,.25)'; g.beginPath(); g.arc(s.tx, s.ty, 60, 0, TAU); g.stroke(); target(g, s.tx, s.ty); for (const a of s.A) drawAg(g, a, COL.yellow); } }),
  card({ s: 'steer', name: '到着（Arrive）', tag: 'speed = 最高速 × 距離 / 半径',
    desc: 'オレンジはSeekのままなので、目標を通り過ぎてぐるぐる回ります。水色は目標の周りの円に入ったら、近いほど遅くなるようにしているので、ぴたりと止まります。',
    hint: 'クリックで目標を置く',
    init: (s) => { s.a = new Ag(30, 30, 2.6, .08); s.b = new Ag(30, 60, 2.6, .08); s.tx = 170; s.ty = 160; },
    step: (s) => { if (s.t % 170 === 0 && s.t) { s.tx = 30 + s.rand() * 180; s.ty = 30 + s.rand() * 180; } s.a.add(s.a.seek(s.tx, s.ty)); s.b.add(s.b.arrive(s.tx, s.ty, 60)); s.a.update(); s.b.update(); },
    down: (s, p) => { s.tx = p.x; s.ty = p.y; },
    draw: (g, s) => { g.strokeStyle = 'rgba(127,214,255,.25)'; g.beginPath(); g.arc(s.tx, s.ty, 60, 0, TAU); g.stroke(); trail(g, s.a, 'rgba(255,159,67,.35)'); trail(g, s.b, 'rgba(127,214,255,.35)'); target(g, s.tx, s.ty); drawAg(g, s.a, COL.orange); drawAg(g, s.b); } }),
  card({ s: 'steer', name: '先回り（Pursuit）', tag: '予測位置 = 目標 + 目標の速さ × 時間',
    desc: '円を描いて動く目標を2体が追います。オレンジは今の位置を追う（Seek）ので後ろをついて回るだけ。水色は目標の少し先の位置を予測して向かうので、回り込んで捕まえます。',
    init: (s) => { s.reset = () => { s.a = new Ag(20, 220, 2.2, .07); s.b = new Ag(40, 220, 2.2, .07); s.caught = 0; }; s.reset(); },
    step: (s) => { const ang = s.t * .014, tx = 120 + Math.cos(ang) * 75, ty = 110 + Math.sin(ang) * 75, tvx = -Math.sin(ang) * 75 * .014, tvy = Math.cos(ang) * 75 * .014;
      s.tx = tx; s.ty = ty; const d = len(tx - s.b.x, ty - s.b.y), T = d / s.b.ms; s.px = tx + tvx * T; s.py = ty + tvy * T;
      s.a.add(s.a.seek(tx, ty)); s.b.add(s.b.seek(s.px, s.py)); s.a.update(); s.b.update(); if (s.t % 360 === 0) s.reset(); },
    draw: (g, s) => { g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(120, 110, 75, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(127,214,255,.5)'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(s.b.x, s.b.y); g.lineTo(s.px, s.py); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(127,214,255,.6)'; g.beginPath(); g.arc(s.px, s.py, 3, 0, TAU); g.fill();
      g.fillStyle = COL.red; g.beginPath(); g.arc(s.tx, s.ty, 5, 0, TAU); g.fill(); trail(g, s.a, 'rgba(255,159,67,.3)'); trail(g, s.b, 'rgba(127,214,255,.3)'); drawAg(g, s.a, COL.orange); drawAg(g, s.b); } }),
  card({ s: 'steer', name: 'うろつき（Wander）', tag: '前方の円の上で目標点を少しずつずらす',
    desc: '進行方向の少し前に円を置き、その円の上の点を毎フレーム少しだけランダムに動かして、そこへ向かいます。完全な乱数と違い、なめらかに気ままに歩き回ります。',
    init: (s) => { s.a = new Ag(120, 120, 1.6, .06); s.a.vx = 1; s.wa = 0; },
    step: (s) => { const a = s.a, [hx, hy] = setLen(a.vx, a.vy, 30); s.cx = a.x + hx; s.cy = a.y + hy; s.wa += (s.rand() - .5) * .6;
      const base = a.ang; s.wx = s.cx + Math.cos(base + s.wa) * 14; s.wy = s.cy + Math.sin(base + s.wa) * 14; a.add(a.seek(s.wx, s.wy)); a.update(true); },
    draw: (g, s) => { trail(g, s.a, 'rgba(94,240,138,.35)', 120); g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(s.cx, s.cy, 14, 0, TAU); g.moveTo(s.a.x, s.a.y); g.lineTo(s.cx, s.cy); g.stroke(); g.fillStyle = COL.red; g.beginPath(); g.arc(s.wx, s.wy, 2.5, 0, TAU); g.fill(); drawAg(g, s.a, COL.green); } }),
  card({ s: 'steer', name: '経路に沿う', tag: '少し先の位置 → 経路上の最寄り点 → その先',
    desc: '少し先の自分の位置を予測し、それが道の幅からはみ出しそうなときだけ、道の上の少し先の点へ向かいます。速さの違う4体が、道に沿ってゆるやかに走ります。',
    init: (s) => { s.P = [[30, 40], [200, 30], [215, 120], [150, 200], [60, 210], [25, 130]]; s.A = [1.4, 1.8, 2.2, 2.6].map((v, i) => { const a = new Ag(30 + i * 8, 60 + i * 10, v, .06); a.vx = v; return a; }); },
    step: (s) => { for (const a of s.A) { const [hx, hy] = setLen(a.vx || 1, a.vy, 18), px = a.x + hx, py = a.y + hy; let best = null, bd = 1e9;
        for (let i = 0; i < s.P.length; i++) { const p = s.P[i], q = s.P[(i + 1) % s.P.length], ex = q[0] - p[0], ey = q[1] - p[1], el = ex * ex + ey * ey; let k = ((px - p[0]) * ex + (py - p[1]) * ey) / el; k = clamp(k, 0, 1);
          const nx = p[0] + ex * k, ny = p[1] + ey * k, d = len(px - nx, py - ny); if (d < bd) { bd = d; const [ux, uy] = setLen(ex, ey, 16); best = [nx + ux, ny + uy]; } }
        if (bd > 8) a.add(a.seek(...best)); else a.add(a.steer(...setLen(a.vx, a.vy, a.ms))); a.update(); } },
    draw: (g, s) => { g.lineJoin = 'round'; g.strokeStyle = 'rgba(240,165,74,.14)'; g.lineWidth = 16; g.beginPath(); s.P.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.stroke();
      g.strokeStyle = 'rgba(240,165,74,.6)'; g.lineWidth = 1; g.stroke(); s.A.forEach((a, i) => drawAg(g, a, ['#7fd6ff', '#5ef08a', '#ffd84d', '#ff7ad9'][i])); } }),

  flockCard({ name: '分離だけ', tag: 'separation', w: { sep: 1.6 }, cluster: true, wander: true, col: '#ff7ad9',
    desc: '群れの3つの規則のうち「近すぎる仲間から離れる」だけを使ったもの。固まって生まれた個体が、ぶつからない間隔まで広がり、あとはばらばらに歩きます。' }),
  flockCard({ name: '整列だけ', tag: 'alignment', w: { ali: 1 }, wander: true, col: '#ffd84d',
    desc: '「近くの仲間と同じ向きに進む」だけを使ったもの。最初はばらばらの向きでも、だんだん近くの個体と向きがそろい、同じ方向へ流れる集団ができます。' }),
  flockCard({ name: '結合だけ', tag: 'cohesion', w: { coh: 1 }, wander: true, col: '#5ef08a',
    desc: '「近くの仲間の中心に向かう」だけを使ったもの。個体どうしが寄り集まって、いくつかの塊にまとまっていきます。離れる規則がないので、塊はぎゅっと縮みます。' }),
  flockCard({ name: '群れ（ボイド）', tag: 'separation + alignment + cohesion', w: { sep: 1.8, ali: 1, coh: .9 }, repel: true, hint: 'カーソルを近づけると避ける',
    desc: '3つの規則を同時に使うと、鳥や魚の群れのような動きになります。1990年代に考案された「ボイド」と呼ばれる方法で、全体を指揮する仕組みはどこにもありません。' }),
  flockCard({ name: '天敵から逃げる群れ', tag: 'boids + flee', w: { sep: 1.8, ali: 1, coh: .9 },
    desc: '赤い天敵は一番近い個体を追い、群れの個体は天敵が近づくと逃げる力を足します。群れが割れて、また合流する様子が見られます。',
    init: (s) => { s.pred = new Ag(20, 20, 1.9, .05); },
    extra: (s, b) => { const d = len(b.x - s.pred.x, b.y - s.pred.y); if (d < 55) b.add(b.flee(s.pred.x, s.pred.y), 3); },
    stepExtra: (s) => { let best = null, bd = 1e9; for (const b of s.B) { const d = len(b.x - s.pred.x, b.y - s.pred.y); if (d < bd) { bd = d; best = b; } } if (best) s.pred.add(s.pred.seek(best.x, best.y)); s.pred.update(true); },
    drawExtra: (g, s) => { drawAg(g, s.pred, COL.red, 1.8); } }),
  flockCard({ name: 'リーダーについていく', tag: 'arrive behind leader + separation', w: { sep: 2 },
    desc: 'オレンジのリーダーはうろつき、ほかの個体はリーダーの少し後ろの点に到着しようとします。分離の規則で押し合うので、自然な隊列になります。',
    init: (s) => { s.L = new Ag(120, 120, 1.3, .05); s.L.vx = 1; s.wa = 0; s.B.length = 28; },
    extra: (s, b) => { const [bx, by] = setLen(s.L.vx, s.L.vy, 26); b.add(b.arrive(s.L.x - bx, s.L.y - by, 50)); const d = len(b.x - s.L.x, b.y - s.L.y); if (d < 18) b.add(b.flee(s.L.x, s.L.y), 1.5); },
    stepExtra: (s) => { const a = s.L, [hx, hy] = setLen(a.vx, a.vy, 30); s.wa += (s.rand() - .5) * .4; const cx = a.x + hx + Math.cos(a.ang + s.wa) * 14, cy = a.y + hy + Math.sin(a.ang + s.wa) * 14; a.add(a.seek(cx, cy)); if (a.x < 30 || a.x > 210 || a.y < 30 || a.y > 210) a.add(a.seek(120, 120), 2); a.update(); },
    drawExtra: (g, s) => drawAg(g, s.L, COL.orange, 1.6) }),

  searchCard('bfs', { name: '幅優先探索', tag: 'BFS · queue',
    desc: 'スタートから近いマス順に、波紋のように均等に調べていきます。必ず「マス数が最少」の道を見つけますが、沼（緑のマス、通るのに5倍かかる）を気にしないので、コストの高い道を選びがちです。' }),
  searchCard('dijkstra', { name: 'ダイクストラ法', tag: 'priority = ここまでのコスト',
    desc: 'ここまでにかかったコストが小さいマスから順に調べます。沼を避けた「一番安い」道を必ず見つけますが、ゴールと関係ない方向まで広く調べてしまいます。' }),
  searchCard('astar', { name: 'A*（エースター）', tag: 'priority = コスト + ゴールまでの見込み',
    desc: 'ダイクストラ法に「ゴールまであとどれくらいか」の見込み（ここではマス目の縦横の距離）を足した順で調べます。一番安い道を見つけつつ、調べるマスがぐっと減ります。ゲームの経路探索の定番です。' }),
  searchCard('greedy', { name: '貪欲法', tag: 'priority = ゴールまでの見込みだけ',
    desc: 'ゴールに近そうなマスだけを優先して調べます。とても速いのですが、ここまでのコストを見ないので、遠回りや沼を通る道を選ぶことがあります。A*との比較用です。' }),
  card({ s: 'path', name: 'フローフィールド', tag: '全マスに「ゴールへの向き」を書く',
    desc: 'ゴールから逆向きに全マスまでの距離を1回だけ計算し、各マスに「一番近づける隣の方向」を矢印で書いておきます。あとは何百体いても、足もとの矢印に従うだけでゴールへ向かえます。',
    hint: 'クリックでゴールを移動',
    init: (s) => { s.goal = MAP.G.slice(); s.build = () => { const dist = new Float32Array(N * N).fill(Infinity), hp = new Heap(), gi = idx(...s.goal); dist[gi] = 0; hp.push(gi, 0);
        while (hp.size) { const i = hp.pop(); for (const [j, w] of neigh(MAP, i, true)) { const nd = dist[i] + w * MAP.cost[j]; if (nd < dist[j]) { dist[j] = nd; hp.push(j, nd); } } }
        s.dist = dist; s.dir = new Float32Array(N * N * 2); let mx = 0;
        for (let i = 0; i < N * N; i++) { if (!isFinite(dist[i])) continue; mx = Math.max(mx, dist[i]); let b = dist[i], bj = -1; for (const [j] of neigh(MAP, i, true)) if (dist[j] < b) { b = dist[j]; bj = j; }
          if (bj >= 0) { const [ax, ay] = cc(i), [bx, by] = cc(bj), [ux, uy] = setLen(bx - ax, by - ay, 1); s.dir[i * 2] = ux; s.dir[i * 2 + 1] = uy; } }
        s.mx = mx; };
      s.build(); s.free = []; for (let i = 0; i < N * N; i++) if (!MAP.wall[i] && isFinite(s.dist[i])) s.free.push(i);
      s.spawn = (a) => { const i = s.free[(s.rand() * s.free.length) | 0], [x, y] = cc(i); a.x = x; a.y = y; a.vx = a.vy = 0; };
      s.A = []; for (let k = 0; k < 60; k++) { const a = new Ag(0, 0, 1.2, .1); s.spawn(a); s.A.push(a); } },
    down: (s, p) => { const c = cellAt(p); if (!MAP.wall[idx(...c)]) { s.goal = c; s.build(); } },
    step: (s) => { for (const a of s.A) { const [cx, cy] = cellAt(a); const i = idx(cx, cy); if (i === idx(...s.goal) || MAP.wall[i]) { s.spawn(a); continue; }
        a.add(a.steer(s.dir[i * 2] * a.ms, s.dir[i * 2 + 1] * a.ms)); a.update(); } },
    draw: (g, s) => { g.fillStyle = '#10152a'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < N * N; i++) { const x = (i % N) * CS, y = ((i / N) | 0) * CS;
        if (MAP.wall[i]) { g.fillStyle = '#3a4468'; g.fillRect(x, y, CS, CS); continue; }
        const f = isFinite(s.dist[i]) ? s.dist[i] / s.mx : 1; g.fillStyle = `hsla(${lerp(40, 230, f)},60%,${lerp(34, 14, f)}%,1)`; g.fillRect(x, y, CS, CS);
        const ux = s.dir[i * 2], uy = s.dir[i * 2 + 1]; if (ux || uy) { g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 5 - ux * 3, y + 5 - uy * 3); g.lineTo(x + 5 + ux * 3, y + 5 + uy * 3); g.stroke(); } }
      for (const a of s.A) drawAg(g, a, '#fff', .7); target(g, s.goal[0] * CS + 5, s.goal[1] * CS + 5); } }),
  card({ s: 'path', name: '経路をなめらかにする', tag: 'string pulling (line of sight)',
    desc: 'マス目で求めた道（点線）はカクカクしています。道の先の点のうち、今いる点から壁にさえぎられずにまっすぐ見える一番遠い点へ直接つなぐと、ひもをピンと張ったような短い道（黄色）になります。',
    hint: 'クリックでゴールを移動',
    init: (s) => { s.goal = MAP.G.slice(); s.build = () => { const r = search(MAP, 'astar', s.goal); s.raw = r.path.map(cc);
        const los = (a, b) => { const d = len(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 2); for (let k = 0; k <= n; k++) { const x = lerp(a[0], b[0], k / n), y = lerp(a[1], b[1], k / n); for (const [ox, oy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { const cx = ((x + ox) / CS) | 0, cy = ((y + oy) / CS) | 0; if (MAP.wall[idx(clamp(cx, 0, N - 1), clamp(cy, 0, N - 1))]) return false; } } return true; };
        const out = [s.raw[0]]; let i = 0; while (i < s.raw.length - 1) { let j = s.raw.length - 1; while (j > i + 1 && !los(s.raw[i], s.raw[j])) j--; out.push(s.raw[j]); i = j; } s.smooth = out; s.k = 0; s.a = new Ag(...s.raw[0], 1.5, .12); };
      s.build(); },
    down: (s, p) => { const c = cellAt(p); if (!MAP.wall[idx(...c)]) { s.goal = c; s.build(); } },
    step: (s) => { const tgt = s.smooth[Math.min(s.k + 1, s.smooth.length - 1)]; if (len(tgt[0] - s.a.x, tgt[1] - s.a.y) < 5) { s.k++; if (s.k >= s.smooth.length - 1) s.build(); } else { s.a.add(s.a.arrive(tgt[0], tgt[1], 12)); s.a.update(); } },
    draw: (g, s) => { drawMap(g, MAP, { swamp: false }); g.strokeStyle = 'rgba(127,214,255,.6)'; g.setLineDash([2, 3]); g.lineWidth = 1.2; g.beginPath(); s.raw.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.stroke(); g.setLineDash([]);
      g.strokeStyle = COL.yellow; g.lineWidth = 2; g.beginPath(); s.smooth.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.stroke();
      g.fillStyle = COL.yellow; for (const p of s.smooth) { g.beginPath(); g.arc(p[0], p[1], 2.5, 0, TAU); g.fill(); }
      endpoints(g, MAP, s.goal); drawAg(g, s.a, '#fff'); } }),

  card({ s: 'mind', name: '障害物をよける', tag: '前方の触角で衝突を予測',
    desc: '進む方向に、速さに応じた長さの「触角」を伸ばし、それが障害物に入りそうなら横へそれる力を足します。ぶつかる前に避けるので、ぶつかってから押し戻すより自然です。',
    hint: 'カーソルを置くと目標になる',
    init: (s) => { s.O = [[80, 70, 18], [160, 60, 14], [120, 120, 22], [60, 170, 16], [175, 170, 20], [200, 110, 10], [40, 110, 10]]; s.a = new Ag(20, 20, 2, .12); s.goals = [[220, 220], [20, 220], [220, 20], [20, 20]]; s.gi = 0; },
    step: (s) => { const tg = s.ptr ? [s.ptr.x, s.ptr.y] : s.goals[s.gi]; s.tg = tg; const a = s.a; if (!s.ptr && len(tg[0] - a.x, tg[1] - a.y) < 12) s.gi = (s.gi + 1) % 4;
      a.add(a.arrive(tg[0], tg[1], 30)); const sp = len(a.vx, a.vy), [hx, hy] = setLen(a.vx || 1, a.vy, 14 + sp * 16); s.ahead = [a.x + hx, a.y + hy]; const ah2 = [a.x + hx / 2, a.y + hy / 2];
      let th = null, td = 1e9; for (const o of s.O) { const hit = [s.ahead, ah2, [a.x, a.y]].some(p => len(p[0] - o[0], p[1] - o[1]) < o[2] + 6); const d = len(a.x - o[0], a.y - o[1]); if (hit && d < td) { td = d; th = o; } }
      s.th = th; if (th) a.add(setLen(s.ahead[0] - th[0], s.ahead[1] - th[1], .3)); a.update(); },
    draw: (g, s) => { for (const o of s.O) { g.fillStyle = o === s.th ? '#5a3050' : '#2e3656'; g.beginPath(); g.arc(o[0], o[1], o[2], 0, TAU); g.fill(); }
      g.strokeStyle = s.th ? COL.red : 'rgba(255,255,255,.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(s.a.x, s.a.y); g.lineTo(...s.ahead); g.stroke();
      trail(g, s.a, 'rgba(127,214,255,.3)', 80); target(g, s.tg[0], s.tg[1], COL.yellow); drawAg(g, s.a); } }),
  card({ s: 'mind', name: '状態機械（見張り）', tag: '巡回 → 追跡 → 捜索 → 巡回',
    desc: '見張りは普段は決まった地点を回り（巡回）、視界に緑のプレイヤーが入ると追いかけ（追跡）、見失うと最後に見た場所へ行って辺りを見回し（捜索）、あきらめたら巡回に戻ります。',
    hint: 'カーソルを置くとプレイヤーを動かせる',
    init: (s) => { s.gd = new Ag(40, 125, .8, .06); s.face = 0; s.state = 'patrol'; s.wp = [[40, 125], [130, 110], [205, 125], [130, 205]]; s.wi = 0; s.lost = 0; s.look = 0; s.last = null; },
    step: (s) => { const [px, py] = s.ptr ? [s.ptr.x, s.ptr.y] : loopPos(s.t, PLAYER_LOOP, .7); s.px = px; s.py = py; const g2 = s.gd;
      const sees = canSee(g2.x, g2.y, s.face, px, py, .6, 95); s.sees = sees;
      if (sees) { s.last = [px, py]; if (s.state !== 'chase') s.state = 'chase'; s.lost = 0; }
      if (s.state === 'patrol') { g2.ms = .8; const w = s.wp[s.wi]; g2.add(g2.arrive(w[0], w[1], 20)); if (len(w[0] - g2.x, w[1] - g2.y) < 6) s.wi = (s.wi + 1) % s.wp.length; }
      else if (s.state === 'chase') { g2.ms = 1.5; g2.add(g2.seek(...s.last)); if (!sees && ++s.lost > 30) { s.state = 'search'; s.look = 0; } }
      else if (s.state === 'search') { g2.ms = 1; if (len(s.last[0] - g2.x, s.last[1] - g2.y) > 6) g2.add(g2.arrive(s.last[0], s.last[1], 20)); else { g2.vx *= .8; g2.vy *= .8; s.look++; s.face += Math.sin(s.look * .05) * .05; if (s.look > 150) s.state = 'patrol'; } }
      g2.update(); if (len(g2.vx, g2.vy) > .2) { let d = g2.ang - s.face; d = Math.atan2(Math.sin(d), Math.cos(d)); s.face += d * .15; } },
    draw: (g, s) => { const col = { patrol: 'rgba(94,240,138,.16)', chase: 'rgba(255,84,112,.22)', search: 'rgba(255,216,77,.2)' }[s.state];
      cone(g, s.gd.x, s.gd.y, s.face, .6, 95, col); drawRects(g); if (s.state === 'search' && s.last) { g.strokeStyle = COL.yellow; g.setLineDash([2, 2]); g.beginPath(); g.arc(s.last[0], s.last[1], 6, 0, TAU); g.stroke(); g.setLineDash([]); }
      player(g, s.px, s.py, s.sees); g.save(); g.translate(s.gd.x, s.gd.y); g.rotate(s.face); g.fillStyle = '#c9cfdf'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); g.fillStyle = '#0b0e1a'; g.fillRect(2, -2, 4, 4); g.restore();
      const name = { patrol: '巡回', chase: '追跡', search: '捜索' }[s.state], c = { patrol: COL.green, chase: COL.red, search: COL.yellow }[s.state];
      label(g, name, W - 10, 20, { size: 13, align: 'right', color: c }); } }),
  card({ s: 'mind', name: '視界と遮蔽', tag: '扇形 + 壁で光線を止める',
    desc: '見張りの目から扇形に光線を何十本も飛ばし、壁に当たったところで止めて「見えている範囲」を作っています。範囲内でも、壁の裏に隠れれば見つかりません。',
    hint: 'カーソルを置くとプレイヤーを動かせる',
    init: () => {},
    step: (s) => { s.face = Math.PI * .1 + Math.sin(s.t * .012) * 1.1; const [px, py] = s.ptr ? [s.ptr.x, s.ptr.y] : loopPos(s.t, PLAYER_LOOP, .9); s.px = px; s.py = py; s.seen = canSee(20, 120, s.face, px, py, .5, 230); },
    draw: (g, s) => { g.fillStyle = s.seen ? 'rgba(255,84,112,.22)' : 'rgba(255,216,77,.14)'; g.beginPath(); g.moveTo(20, 120);
      for (let k = 0; k <= 60; k++) { const a = s.face - .5 + k / 60, d = cast(20, 120, a, 230); g.lineTo(20 + Math.cos(a) * d, 120 + Math.sin(a) * d); } g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,216,77,.12)'; g.lineWidth = 1; for (let k = 0; k <= 60; k += 3) { const a = s.face - .5 + k / 60, d = cast(20, 120, a, 230); g.beginPath(); g.moveTo(20, 120); g.lineTo(20 + Math.cos(a) * d, 120 + Math.sin(a) * d); g.stroke(); }
      drawRects(g); player(g, s.px, s.py, s.seen); g.fillStyle = '#c9cfdf'; g.beginPath(); g.arc(20, 120, 6, 0, TAU); g.fill();
      if (s.seen) label(g, '見つかった!', W - 10, 20, { size: 12, align: 'right', color: COL.red }); } })
];
ITEMS.filter(i => !i.s).forEach(i => i.s = 'flock');

const SECTIONS = [
  { id: 'steer', en: 'Steering', title: '1体の動き（操舵）', lead: 'どれも「行きたい速さ」を決めて、今の速さとの差を少しずつ足すだけ。「行きたい速さ」の決め方の違いで、追う・逃げる・止まる・先回りする動きが生まれます。' },
  { id: 'flock', en: 'Flocking', title: '群れの動き', lead: '1体1体が近くの仲間だけを見て3つの規則に従うと、全体として群れのような動きが生まれます。まずは規則を1つずつ、次に組み合わせを見てみます。' },
  { id: 'path', en: 'Path-finding', title: '道を探す', lead: '同じ地図、同じスタート（緑）とゴール（赤）で、探し方だけを変えています。色のついたマスは調べた順番（青→紫）、黄色が見つかった道です。緑の沼は通るのに5倍のコストがかかります。' },
  { id: 'mind', en: 'Perception & decisions', title: '判断と知覚', lead: '周りを見て、状況に応じて行動を切り替える仕組みです。' }
];
run({ sections: SECTIONS, items: ITEMS, W, H, minCol: 300 });
series('ai');

})();
