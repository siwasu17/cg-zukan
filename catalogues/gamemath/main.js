/* ゲームの数学図鑑 — card definitions. Runtime: assets/js/g2d.js */
(function () {
const { clamp, lerp, COL, label, run } = G2D;
const W = 240, H = 240, TAU = Math.PI * 2, DEG = 180 / Math.PI;
const PW = 240, PH = 124, GAP = 8;

/* ---------- vector helpers ---------- */
const V = (x, y) => ({ x, y });
const add = (a, b) => V(a.x + b.x, a.y + b.y);
const sub = (a, b) => V(a.x - b.x, a.y - b.y);
const mul = (a, k) => V(a.x * k, a.y * k);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const len = (a) => Math.hypot(a.x, a.y);
const norm = (a) => { const l = len(a) || 1; return V(a.x / l, a.y / l); };
const rot = (a, t) => { const c = Math.cos(t), s = Math.sin(t); return V(a.x * c - a.y * s, a.x * s + a.y * c); };
const fromAng = (t, r = 1) => V(Math.cos(t) * r, Math.sin(t) * r);
const vlerp = (a, b, t) => V(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
const angDiff = (a, b) => (((b - a) % TAU) + TAU + Math.PI) % TAU - Math.PI;
const pingpong = (x) => 1 - Math.abs(1 - (x % 2));
/* number → text with a real minus sign and no "-0" */
function f(x, d = 0) { const s = x.toFixed(d); return (/^-0(\.0+)?$/.test(s) ? s.slice(1) : s).replace('-', '−'); }
function hex(c) { return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); }
function mix(a, b, t) { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')'; }

/* ---------- drawing helpers ---------- */
function bg(g, w = W, h = H, col = '#0d1122') {
  g.fillStyle = col; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,140,200,.07)'; g.lineWidth = 1; g.beginPath();
  for (let x = 20; x < w; x += 20) { g.moveTo(x + .5, 0); g.lineTo(x + .5, h); }
  for (let y = 20; y < h; y += 20) { g.moveTo(0, y + .5); g.lineTo(w, y + .5); }
  g.stroke();
}
function line(g, a, b, col, lw = 1.5, dash) { g.strokeStyle = col; g.lineWidth = lw; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); if (dash) g.setLineDash([]); }
function arrow(g, a, b, col, lw = 2, hs = 8) {
  const d = sub(b, a), l = len(d); if (l < .5) return;
  const u = mul(d, 1 / l), h = Math.min(hs, l * .6), p = V(-u.y, u.x);
  line(g, a, sub(b, mul(u, h * .7)), col, lw);
  g.fillStyle = col; g.beginPath(); g.moveTo(b.x, b.y);
  g.lineTo(b.x - u.x * h + p.x * h * .45, b.y - u.y * h + p.y * h * .45);
  g.lineTo(b.x - u.x * h - p.x * h * .45, b.y - u.y * h - p.y * h * .45); g.closePath(); g.fill();
}
function circ(g, p, r, fill, stroke, lw = 1.5, dash) {
  g.beginPath(); g.arc(p.x, p.y, r, 0, TAU);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; if (dash) g.setLineDash(dash); g.stroke(); if (dash) g.setLineDash([]); }
}
function txt(g, t, x, y, o = {}) { label(g, t, x, y, Object.assign({ size: 10, color: COL.muted, weight: 500 }, o)); }
/* draggable point: ring + name */
function handle(g, p, col, name, o = {}) {
  circ(g, p, 8, 'rgba(255,255,255,.06)', col, 1.4);
  if (!o.hollow) circ(g, p, 3, col);
  if (name) txt(g, name, p.x + (o.dx || 10), p.y + (o.dy || -9), { color: col, weight: 700, size: 10.5 });
}
function poly(g, pts, fill, stroke, lw = 1.5) {
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
function path(g, pts, col, lw = 2) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); }

/* ---------- card runners ---------- */
/* card(o): o.pts = draggable points [[x,y],…] (st.P); o.auto(st) moves them until the user touches the card;
   o.free = index of the point that jumps to a click on empty space; o.down/move/up for other input. */
function card(o) {
  const w = o.W || W, h = o.H || H, drag = !!o.pts;
  return { s: o.s, name: o.name, tag: o.tag, desc: o.desc, hint: o.hint, W: o.W, H: o.H, warm: o.warm || 0,
    interactive: !!(o.pts || o.down), capture: !!(o.pts || o.down), cursor: drag ? 'grab' : undefined,
    make: (env) => {
      const s = { t: 0, rand: env.rand, P: (o.pts || []).map(p => V(p[0], p[1])), grab: -1, touched: false };
      if (o.init) o.init(s);
      if (o.auto) o.auto(s);
      const put = (p) => { const q = s.P[s.grab]; q.x = clamp(p.x, 4, w - 4); q.y = clamp(p.y, 4, h - 4); };
      return {
        step() { if (o.auto && !s.touched) o.auto(s); if (o.step) o.step(s); s.t++; },
        draw(g) { bg(g, w, h); o.draw(g, s); },
        down(p) {
          let best = -1, bd = 20;
          s.P.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = i; } });
          if (best < 0 && o.free !== undefined && !(o.freeIf && !o.freeIf(p))) best = o.free;
          if (best >= 0) { s.grab = best; s.touched = true; put(p); } else if (o.down) o.down(s, p);
        },
        move(p, d) { if (d && s.grab >= 0) put(p); else if (o.move) o.move(s, p, d); },
        up() { s.grab = -1; if (o.up) o.up(s); },
        hud() { return o.hud ? o.hud(s) : []; }
      };
    } };
}
/* pair(o): the same scenario twice, top = without (f=false), bottom = with (f=true) */
function pair(o) {
  const names = o.names || ['なし', 'あり'];
  return { s: o.s, name: o.name, tag: o.tag, desc: o.desc, hint: o.hint || 'クリックで最初から', H: PH * 2 + GAP, interactive: true,
    make: () => {
      const A = o.scen(false), B = o.scen(true);
      return {
        step() { A.step(); B.step(); },
        down() { A.act && A.act(); B.act && B.act(); },
        draw(g) {
          [[A, 0], [B, PH + GAP]].forEach(([S, oy], i) => {
            g.save(); g.translate(0, oy); g.beginPath(); g.rect(0, 0, PW, PH); g.clip();
            bg(g, PW, PH, i ? '#0f1428' : '#0d1020'); S.draw(g); g.restore();
            g.save(); g.translate(0, oy);
            label(g, names[i], 8, 16, { size: 10.5, color: i ? '#15171b' : COL.ink, bg: i ? COL.accent : 'rgba(80,88,110,.9)' });
            if (S.note) { const n = S.note(); if (n) label(g, n, PW - 8, 16, { size: 10, align: 'right', color: COL.muted, bg: 'rgba(13,16,32,.75)' }); }
            g.restore();
          });
          g.fillStyle = '#15171b'; g.fillRect(0, PH, PW, GAP);
        }
      };
    } };
}

/* ---------- shared bits ---------- */
function bezier(P, t) { const u = 1 - t; return V(u * u * u * P[0].x + 3 * u * u * t * P[1].x + 3 * u * t * t * P[2].x + t * t * t * P[3].x, u * u * u * P[0].y + 3 * u * u * t * P[1].y + 3 * u * t * t * P[2].y + t * t * t * P[3].y); }
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t, c = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return V(c(p0.x, p1.x, p2.x, p3.x), c(p0.y, p1.y, p2.y, p3.y));
}
function catmullD(p0, p1, p2, p3, t) {
  const c = (a, b, c, d) => .5 * ((-a + c) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t * t);
  return V(c(p0.x, p1.x, p2.x, p3.x), c(p0.y, p1.y, p2.y, p3.y));
}
/* ray (o + d·t) against a circle / a segment → t or Infinity, plus the surface normal */
function rayCircle(o, d, c, r) {
  const m = sub(o, c), b = dot(m, d), cc = dot(m, m) - r * r;
  if (cc > 0 && b > 0) return null; const disc = b * b - cc; if (disc < 0) return null;
  const t = -b - Math.sqrt(disc); if (t < .01) return null;
  const p = add(o, mul(d, t)); return { t, p, n: norm(sub(p, c)) };
}
function raySeg(o, d, a, b) {
  const s = sub(b, a), den = cross(d, s); if (Math.abs(den) < 1e-9) return null;
  const ao = sub(a, o), t = cross(ao, s) / den, u = cross(ao, d) / den;
  if (t < .01 || u < 0 || u > 1) return null;
  let n = norm(V(-s.y, s.x)); if (dot(n, d) > 0) n = mul(n, -1);
  return { t, p: add(o, mul(d, t)), n };
}
function boxCorners(c, hw, hh, a) { return [V(-hw, -hh), V(hw, -hh), V(hw, hh), V(-hw, hh)].map(p => add(c, rot(p, a))); }
function project(pts, ax) { let lo = Infinity, hi = -Infinity; for (const p of pts) { const v = dot(p, ax); lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; }

/* ---------- catalogue ---------- */
const ITEMS = [
  /* ===== vectors ===== */
  card({ s: 'vec', name: '位置の差で向きを出す', tag: 'd = B − A',
    desc: '砲台 A から的 B へ向かう矢印は、B の位置から A の位置を引くだけで求まります。横の差 dx と縦の差 dy、この2つの数がそのまま矢印です。弾はこの矢印の向きに、長さをそろえて（正規化して）撃っています。',
    hint: 'A と B をドラッグ', pts: [[46, 190], [178, 70]], free: 1,
    init: (s) => { s.B = []; },
    auto: (s) => { s.P[1].x = 160 + 55 * Math.cos(s.t * .013); s.P[1].y = 78 + 45 * Math.sin(s.t * .021); },
    step: (s) => { const [A, B] = s.P, u = norm(sub(B, A));
      if (s.t % 30 === 0) s.B.push({ p: V(A.x, A.y), v: mul(u, 3) });
      for (const b of s.B) b.p = add(b.p, b.v);
      s.B = s.B.filter(b => b.p.x > -10 && b.p.x < W + 10 && b.p.y > -10 && b.p.y < H + 10); },
    draw: (g, s) => { const [A, B] = s.P, d = sub(B, A), K = V(B.x, A.y), u = norm(d);
      line(g, A, K, COL.cyan, 1.2, [3, 3]); line(g, K, B, COL.pink, 1.2, [3, 3]);
      txt(g, 'dx ' + f(d.x), (A.x + B.x) / 2, A.y + (d.y < 0 ? 15 : -6), { align: 'center', color: COL.cyan });
      txt(g, 'dy ' + f(d.y), B.x + (d.x > 0 ? -6 : 6), (A.y + B.y) / 2, { color: COL.pink, align: d.x > 0 ? 'right' : 'left' });
      for (const b of s.B) circ(g, b.p, 2.6, COL.yellow);
      arrow(g, A, B, COL.yellow, 2.2, 10);
      g.save(); g.translate(A.x, A.y); g.rotate(Math.atan2(u.y, u.x)); g.fillStyle = '#7fd6ff'; g.fillRect(0, -3.5, 18, 7); g.restore();
      circ(g, A, 10, '#7fd6ff');
      circ(g, B, 12, null, COL.red, 1.5); circ(g, B, 6, null, COL.red, 1.5);
      handle(g, A, COL.ink, 'A', { dx: -18, dy: 18 }); handle(g, B, COL.ink, 'B', { dx: 13 }); },
    hud: (s) => { const d = sub(s.P[1], s.P[0]); return ['B − A = (' + f(d.x) + ', ' + f(d.y) + ')', '長さ |B − A| = ' + f(len(d), 1)]; } }),

  pair({ s: 'vec', name: '斜め移動が速すぎる', tag: 'v = normalize(入力) × 速さ',
    desc: '上下左右の入力をそのまま足すと、斜めの矢印は (1, 1) になり、長さは √2 ≈ 1.41。斜めだけ4割ほど速く動いてしまいます（上）。下は入力を正規化して（向きはそのまま長さを1にして）いるので、8方向どれも同じ距離で止まります。',
    scen: (fix) => {
      let t = 0; const D = [];
      for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) if (x || y) D.push(V(x, y));
      return {
        act() { t = 0; }, step() { t++; },
        draw(g) { const c = V(120, 68), k = Math.min(t % 110, 60) / 60 * 38;
          circ(g, c, 38, null, 'rgba(255,255,255,.25)', 1, [3, 3]);
          for (const d of D) { const v = fix ? norm(d) : d, p = add(c, mul(v, k)), bad = d.x && d.y && !fix;
            line(g, c, p, bad ? 'rgba(255,84,112,.55)' : 'rgba(79,224,255,.45)', 1.4); circ(g, p, 4.5, bad ? COL.red : COL.cyan); }
          circ(g, c, 5, '#c9cfdf'); },
        note: () => fix ? '8方向とも 1.00倍' : 'ななめは 1.41倍'
      };
    } }),

  card({ s: 'vec', name: '内積で前か後ろか', tag: 'dot(f, d) = cos θ',
    desc: '見張りの向き f と、見張りから相手への向き d（どちらも長さ1）の内積は、2本の矢印のなす角 θ の cos になります。プラスなら前、マイナスなら後ろ。さらに cos 40° と比べれば、左右40°の扇形の視界に入っているかが、角度を計算せずにわかります。',
    hint: '相手をドラッグ', pts: [[190, 90]], free: 0,
    auto: (s) => { const a = s.t * .017; s.P[0].x = 120 + 85 * Math.cos(a); s.P[0].y = 124 + 80 * Math.sin(a * 1.3); },
    draw: (g, s) => {
      const G = V(120, 128), fa = -Math.PI / 2 + Math.sin(s.t * .01) * .8, F = fromAng(fa), T = s.P[0], d = norm(sub(T, G)), k = dot(F, d),
        half = 40 / DEG, see = k > Math.cos(half); s.k = k;
      g.save(); g.translate(G.x, G.y); g.rotate(fa);
      g.fillStyle = 'rgba(79,224,255,.06)'; g.fillRect(0, -400, 400, 800);
      g.fillStyle = see ? 'rgba(255,84,112,.2)' : 'rgba(255,216,77,.12)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 170, -half, half); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(79,224,255,.35)'; g.lineWidth = 1; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, -400); g.lineTo(0, 400); g.stroke(); g.setLineDash([]);
      g.restore();
      const tip = add(G, mul(d, 46)), foot = add(G, mul(F, k * 46));
      line(g, tip, foot, 'rgba(255,255,255,.4)', 1, [2, 3]);
      line(g, G, foot, k > 0 ? COL.green : COL.red, 5);
      arrow(g, G, add(G, mul(F, 46)), COL.cyan, 2.2); txt(g, 'f', G.x + F.x * 56 - 3, G.y + F.y * 56 + 4, { color: COL.cyan, weight: 700, size: 11 });
      arrow(g, G, tip, '#e8ecf7', 1.8); txt(g, 'd', G.x + d.x * 56 - 3, G.y + d.y * 56 + 4, { color: '#e8ecf7', weight: 700, size: 11 });
      circ(g, G, 9, '#c9cfdf');
      circ(g, T, 7, see ? COL.red : k > 0 ? COL.yellow : '#6b7390'); handle(g, T, COL.ink, null, { hollow: true });
      txt(g, see ? '視界の中' : k > 0 ? '前（視界の外）' : '後ろ', T.x + (T.x > 170 ? -12 : 12), T.y - 12, { color: COL.ink, align: T.x > 170 ? 'right' : 'left', bg: 'rgba(13,17,34,.8)' }); },
    hud: (s) => ['dot(f, d) = ' + f(s.k, 2), '視界: dot > cos40° = 0.77'] }),

  card({ s: 'vec', name: '外積で右か左か', tag: 'cross(f, d) = f.x·d.y − f.y·d.x',
    desc: '向き f と相手への向き d の外積（2Dでは1つの数になります）は、相手が右にいるとプラス、左にいるとマイナス。ミサイルはこの符号だけを見て、毎フレーム少しずつ右か左に曲がっています。画面は下が y のプラスなので、数学の教科書とは左右が逆になります。',
    hint: '的をドラッグ', pts: [[180, 70]], free: 0,
    init: (s) => { s.m = V(40, 200); s.a = -.6; s.tr = []; s.c = 0; },
    auto: (s) => { s.P[0].x = 120 + 80 * Math.sin(s.t * .011); s.P[0].y = 110 + 70 * Math.sin(s.t * .017 + 1); },
    step: (s) => { const F = fromAng(s.a), d = sub(s.P[0], s.m); s.c = cross(F, norm(d));
      if (len(d) > 6 && Math.abs(s.c) > .02) s.a += .05 * Math.sign(s.c);
      s.m = add(s.m, mul(F, 1.7)); s.m.x = clamp(s.m.x, 6, W - 6); s.m.y = clamp(s.m.y, 6, H - 6);
      if (s.t % 2 === 0) { s.tr.push(V(s.m.x, s.m.y)); if (s.tr.length > 40) s.tr.shift(); } },
    draw: (g, s) => { const M = s.m, F = fromAng(s.a), T = s.P[0], d = norm(sub(T, M));
      g.save(); g.translate(M.x, M.y); g.rotate(s.a);
      g.fillStyle = 'rgba(255,84,112,.08)'; g.fillRect(-400, 0, 800, 400);
      g.fillStyle = 'rgba(79,224,255,.08)'; g.fillRect(-400, -400, 800, 400);
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(-400, 0); g.lineTo(400, 0); g.stroke(); g.setLineDash([]);
      g.restore();
      const R = add(M, fromAng(s.a + Math.PI / 2, 40)), L = add(M, fromAng(s.a - Math.PI / 2, 40));
      txt(g, '右 +', R.x, R.y + 4, { align: 'center', color: COL.red, weight: 700 }); txt(g, '左 −', L.x, L.y + 4, { align: 'center', color: COL.cyan, weight: 700 });
      s.tr.forEach((p, i) => circ(g, p, 1.6, `rgba(255,216,77,${i / s.tr.length * .6})`));
      arrow(g, M, add(M, mul(d, 34)), '#e8ecf7', 1.6);
      g.save(); g.translate(M.x, M.y); g.rotate(s.a); g.fillStyle = COL.yellow; g.beginPath(); g.moveTo(11, 0); g.lineTo(-7, -6); g.lineTo(-4, 0); g.lineTo(-7, 6); g.closePath(); g.fill(); g.restore();
      arrow(g, add(M, mul(F, 12)), add(M, mul(F, 38)), COL.yellow, 1.8);
      circ(g, T, 11, null, COL.ink, 1.3); line(g, V(T.x - 15, T.y), V(T.x + 15, T.y), COL.ink, 1); line(g, V(T.x, T.y - 15), V(T.x, T.y + 15), COL.ink, 1); },
    hud: (s) => ['cross(f, d) = ' + (s.c > 0 ? '+' : '') + f(s.c, 2), Math.abs(s.c) <= .02 ? '→ まっすぐ' : s.c > 0 ? '→ 右へ曲がる' : '→ 左へ曲がる'] }),

  card({ s: 'vec', name: '反射ベクトル', tag: 'r = v − 2 (v·n) n',
    desc: '壁に当たった弾の跳ね返る向きです。壁の法線 n（壁に垂直な長さ1の矢印）との内積 v·n で、進む向き v のうち「壁に向かう成分」を取り出し、それを2回ぶん引いて裏返します。壁に沿った成分はそのまま残るので、点線は壁と平行になります。',
    hint: '発射点をドラッグ', pts: [[60, 50]], free: 0,
    auto: (s) => { s.P[0].x = 120 + 85 * Math.cos(s.t * .01); s.P[0].y = 62 + 25 * Math.sin(s.t * .023); },
    draw: (g, s) => {
      const C = V(120, 160), wa = Math.sin(s.t * .007) * .4, w = fromAng(wa), n = V(w.y, -w.x), S = s.P[0], v = sub(C, S), vn = dot(v, n),
        r = sub(v, mul(n, 2 * vn)), R = add(C, r), M = sub(C, mul(n, vn)); s.vn = vn; s.r = r;
      g.strokeStyle = 'rgba(201,207,223,.35)'; g.lineWidth = 1; g.beginPath();
      for (let k = -100; k <= 100; k += 10) { const p = add(C, mul(w, k)); g.moveTo(p.x, p.y); g.lineTo(p.x - n.x * 8 - w.x * 6, p.y - n.y * 8 - w.y * 6); } g.stroke();
      line(g, sub(C, mul(w, 110)), add(C, mul(w, 110)), '#c9cfdf', 3);
      line(g, S, R, 'rgba(255,255,255,.3)', 1, [3, 3]);
      line(g, C, M, COL.green, 1.2, [2, 3]); txt(g, '−(v·n)', M.x + 5, (M.y + C.y) / 2 - 8, { color: COL.green });
      arrow(g, add(C, mul(n, 0)), add(C, mul(n, 34)), COL.green, 2.4); txt(g, 'n', C.x + n.x * 34 + 6, C.y + n.y * 34 + 8, { color: COL.green, weight: 700, size: 11 });
      arrow(g, S, C, COL.yellow, 2); txt(g, 'v', (S.x + C.x) / 2 - 12, (S.y + C.y) / 2, { color: COL.yellow, weight: 700, size: 11 });
      arrow(g, C, R, COL.cyan, 2); txt(g, 'r', (R.x + C.x) / 2 + 8, (R.y + C.y) / 2, { color: COL.cyan, weight: 700, size: 11 });
      const ph = (s.t % 120) / 120, b = ph < .5 ? vlerp(S, C, ph * 2) : vlerp(C, R, (ph - .5) * 2); circ(g, b, 4, '#fff');
      handle(g, S, COL.yellow, null, { hollow: true }); },
    hud: (s) => ['v·n = ' + f(s.vn, 1), 'r = (' + f(s.r.x) + ', ' + f(s.r.y) + ')'] }),

  card({ s: 'vec', name: '線分にいちばん近い点', tag: 't = dot(P − A, B − A) / |B − A|²',
    desc: '点 P から線分 AB に下ろした垂線の足は、内積で「A から B の方向にどれだけ進んだところか」を割合 t で求め、0〜1 の範囲に丸めると得られます。この点までの距離を使うと、剣の刃や細長い体のようなカプセル形の当たり判定ができます。',
    hint: 'A・B・P をドラッグ', pts: [[40, 170], [200, 96], [120, 60]], free: 2,
    auto: (s) => { const a = s.t * .012; s.P[2].x = 120 + 96 * Math.cos(a); s.P[2].y = 128 + 78 * Math.sin(a * 1.7); },
    draw: (g, s) => {
      const [A, B, P] = s.P, ab = sub(B, A), t0 = dot(sub(P, A), ab) / (dot(ab, ab) || 1), t = clamp(t0, 0, 1),
        Q = add(A, mul(ab, t)), Q0 = add(A, mul(ab, t0)), dist = len(sub(P, Q)), hit = dist < 26;
      s.t0 = t0; s.tc = t; s.dist = dist;
      line(g, sub(A, mul(ab, 3)), add(B, mul(ab, 3)), 'rgba(255,255,255,.14)', 1, [4, 4]);
      g.strokeStyle = hit ? 'rgba(255,84,112,.3)' : 'rgba(79,224,255,.13)'; g.lineWidth = 36; g.lineCap = 'round';
      g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); g.lineCap = 'butt';
      line(g, A, B, '#c9cfdf', 2);
      if (t0 < 0 || t0 > 1) { line(g, P, Q0, 'rgba(255,255,255,.3)', 1, [2, 3]); circ(g, Q0, 3.5, null, 'rgba(255,255,255,.6)', 1.2); txt(g, '丸める前', Q0.x + 6, Q0.y + 14, { color: 'rgba(255,255,255,.55)' }); }
      line(g, P, Q, hit ? COL.red : COL.yellow, 1.8); circ(g, Q, 4, COL.yellow);
      circ(g, P, 8, hit ? COL.red : '#7fd6ff');
      handle(g, A, COL.ink, 'A', { dx: -16, dy: 18 }); handle(g, B, COL.ink, 'B'); handle(g, P, COL.ink, 'P', { hollow: true }); },
    hud: (s) => ['t = ' + f(s.t0, 2) + (s.t0 < 0 || s.t0 > 1 ? ' → ' + f(s.tc, 2) : ''), '距離 ' + f(s.dist, 1) + (s.dist < 26 ? '  当たり' : '')] }),

  /* ===== angles & rotation ===== */
  card({ s: 'angle', name: 'atan2 で相手を向く', tag: 'θ = atan2(dy, dx)',
    desc: '相手との差 (dx, dy) から角度を出すには atan2 を使います。dy ÷ dx の atan だけだと、相手が右か左かの区別がつかず、左側では真逆を向いてしまいます（点線）。画面は下が y のプラスなので、角度は時計回りがプラスです。',
    hint: '的をドラッグ', pts: [[200, 80]], free: 0,
    auto: (s) => { const a = s.t * .01; s.P[0].x = 120 + 88 * Math.cos(a); s.P[0].y = 118 + 78 * Math.sin(a); },
    draw: (g, s) => {
      const C = V(120, 118), T = s.P[0], d = sub(T, C), th = Math.atan2(d.y, d.x), na = Math.atan(d.y / (Math.abs(d.x) < 1e-6 ? 1e-6 : d.x)); s.th = th; s.na = na;
      line(g, V(0, C.y), V(W, C.y), 'rgba(255,255,255,.16)', 1); line(g, V(C.x, 0), V(C.x, H), 'rgba(255,255,255,.08)', 1);
      txt(g, '0°', W - 8, C.y - 4, { align: 'right' });
      line(g, C, V(T.x, C.y), COL.cyan, 1.2, [3, 3]); line(g, V(T.x, C.y), T, COL.pink, 1.2, [3, 3]);
      txt(g, 'dx', (C.x + T.x) / 2, C.y + (d.y < 0 ? 13 : -5), { color: COL.cyan, align: 'center' });
      txt(g, 'dy', T.x + (d.x > 0 ? 5 : -5), (C.y + T.y) / 2 + 3, { color: COL.pink, align: d.x > 0 ? 'left' : 'right' });
      g.strokeStyle = COL.yellow; g.lineWidth = 1.6; g.beginPath(); g.arc(C.x, C.y, 26, 0, th, th < 0); g.stroke();
      const lp = add(C, fromAng(th / 2, 42)); txt(g, f(th * DEG) + '°', lp.x, lp.y + 4, { color: COL.yellow, align: 'center', weight: 700, bg: 'rgba(13,17,34,.75)' });
      const gp = add(C, fromAng(na, 74)), wrong = d.x < 0;
      line(g, C, gp, wrong ? 'rgba(255,84,112,.8)' : 'rgba(200,205,225,.45)', 1.6, [4, 3]);
      txt(g, wrong ? 'atan（逆向き）' : 'atan', gp.x, gp.y + (gp.y < C.y ? -6 : 14), { align: 'center', color: wrong ? COL.red : COL.muted });
      g.save(); g.translate(C.x, C.y); g.rotate(th); g.fillStyle = '#7fd6ff'; g.fillRect(0, -4, 34, 8); g.restore();
      circ(g, C, 12, '#7fd6ff');
      circ(g, T, 12, null, COL.red, 1.5); circ(g, T, 5, COL.red); },
    hud: (s) => ['atan2(dy, dx) = ' + f(s.th * DEG) + '°', 'atan(dy / dx)  = ' + f(s.na * DEG) + '°'] }),

  pair({ s: 'angle', name: '角度の補間は近いほうへ', tag: '差 = (b − a + 180°) mod 360° − 180°',
    desc: '砲台を目標（赤）の角度へ少しずつ回します。角度の差をそのまま使うと、150° から −150° へ向かうとき、60° 先なのに 300° も逆回りしてしまいます（上）。下は差を −180°〜180° の範囲に直してから補間するので、いつも近いほうへ回ります。',
    scen: (fix) => {
      const T = [150, -150, -100, 160, -170, 30].map(x => x / DEG);
      let t = 0, a = T[0], i = 0, sw = 0; const hist = [];
      return {
        act() { t = 0; a = T[0]; i = 0; sw = 0; hist.length = 0; },
        step() { if (t % 90 === 20) { i = (i + 1) % T.length; sw = 0; }
          const da = (fix ? angDiff(a, T[i]) : T[i] - a) * .08; a += da; sw += Math.abs(da);
          hist.push(a); if (hist.length > 36) hist.shift(); t++; },
        draw(g) { const c = V(120, 66), R = 42;
          circ(g, c, R, null, 'rgba(255,255,255,.14)', 1);
          txt(g, '0°', c.x + R + 6, c.y + 4); txt(g, '±180°', c.x - R - 6, c.y + 4, { align: 'right' });
          hist.forEach((h, k) => circ(g, add(c, fromAng(h, R)), 2.2, `rgba(255,216,77,${k / hist.length * .7})`));
          const tp = add(c, fromAng(T[i], R)); circ(g, tp, 5.5, COL.red);
          g.save(); g.translate(c.x, c.y); g.rotate(a); g.fillStyle = COL.yellow; g.fillRect(0, -3, R - 6, 6); g.restore();
          circ(g, c, 9, '#7fd6ff'); },
        note: () => '回った角度 ' + Math.round(sw * DEG) + '°'
      };
    } }),

  card({ s: 'angle', name: '回転行列', tag: "x′ = x cosθ − y sinθ,  y′ = x sinθ + y cosθ",
    desc: '点を原点のまわりに θ だけ回すための2つの式です。赤い矢印（x 軸を回したもの）は (cosθ, sinθ)、緑の矢印（y 軸を回したもの）は (−sinθ, cosθ)。形の各点を「赤の方向に x、緑の方向に y 進んだところ」に置き直すと、形全体が回ります。',
    hint: 'ドラッグで回す',
    init: (s) => { s.th = .4; },
    auto: (s) => { s.th += .008; },
    down: (s, p) => { s.touched = true; s.th = Math.atan2(p.y - 120, p.x - 120); },
    move: (s, p, d) => { if (d) s.th = Math.atan2(p.y - 120, p.x - 120); },
    draw: (g, s) => {
      const O = V(120, 120), th = s.th, ex = fromAng(th), ey = fromAng(th + Math.PI / 2), T = (p) => add(O, add(mul(ex, p.x), mul(ey, p.y)));
      line(g, V(0, O.y), V(W, O.y), 'rgba(255,255,255,.14)', 1); line(g, V(O.x, 0), V(O.x, H), 'rgba(255,255,255,.14)', 1);
      g.strokeStyle = 'rgba(79,224,255,.12)'; g.lineWidth = 1; g.beginPath();
      for (let k = -80; k <= 80; k += 20) { let a = T(V(k, -80)), b = T(V(k, 80)); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); a = T(V(-80, k)); b = T(V(80, k)); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); } g.stroke();
      poly(g, [V(40, 0), V(-22, -22), V(-10, 0), V(-22, 22)].map(T), 'rgba(127,214,255,.2)', '#7fd6ff', 1.5);
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.2; g.beginPath(); g.arc(O.x, O.y, 16, 0, ((th % TAU) + TAU) % TAU); g.stroke();
      arrow(g, O, add(O, mul(ex, 64)), COL.red, 2.2); arrow(g, O, add(O, mul(ey, 64)), COL.green, 2.2);
      const xl = add(O, mul(ex, 76)), yl = add(O, mul(ey, 76));
      txt(g, "x′", xl.x, xl.y + 4, { color: COL.red, weight: 700, size: 11, align: 'center' }); txt(g, "y′", yl.x, yl.y + 4, { color: COL.green, weight: 700, size: 11, align: 'center' });
      const p1 = T(V(50, 0)), p = T(V(50, 34)); s.p = sub(p, O);
      line(g, O, p1, COL.red, 1.3, [3, 3]); line(g, p1, p, COL.green, 1.3, [3, 3]); circ(g, p, 4.5, COL.yellow);
      txt(g, 'p', p.x + 7, p.y - 5, { color: COL.yellow, weight: 700, size: 11 }); },
    hud: (s) => { const a = angDiff(0, s.th); return ['θ = ' + f(a * DEG) + '°   cos ' + f(Math.cos(a), 2) + '  sin ' + f(Math.sin(a), 2), 'p (50, 34) → (' + f(s.p.x) + ', ' + f(s.p.y) + ')']; } }),

  card({ s: 'angle', name: '親子の座標（惑星と衛星）', tag: 'ワールド = 親の変換 × ローカル',
    desc: '月は「惑星から見て x 方向に 24」の場所に置いてあるだけ、惑星は「太陽から見て x 方向に 72」の場所に置いてあるだけです。それぞれの座標系（赤と緑の短い矢印）が親といっしょに回るので、変換を順にかけていくと、月は花びらのような道をたどります。',
    warm: 500,
    init: (s) => { s.tr = []; },
    step: (s) => { const b = bodies(s.t); s.tr.push(b.moon); if (s.tr.length > 760) s.tr.shift(); },
    draw: (g, s) => { const b = bodies(s.t);
      circ(g, b.sun, 72, null, 'rgba(255,255,255,.1)', 1); circ(g, b.planet, 24, null, 'rgba(255,255,255,.14)', 1);
      path(g, s.tr, 'rgba(181,123,255,.55)', 1.2);
      line(g, b.sun, b.planet, 'rgba(255,255,255,.3)', 1); line(g, b.planet, b.moon, 'rgba(255,255,255,.3)', 1);
      const axes = (p, a, l) => { arrow(g, p, add(p, fromAng(a, l)), COL.red, 1.6, 6); arrow(g, p, add(p, fromAng(a + Math.PI / 2, l)), COL.green, 1.6, 6); };
      circ(g, b.sun, 13, COL.yellow); axes(b.sun, b.a1, 30);
      circ(g, b.planet, 7, COL.cyan); axes(b.planet, b.a1 + b.a2, 17);
      circ(g, b.moon, 4, '#e8ecf7');
      txt(g, '太陽', b.sun.x, b.sun.y + 26, { align: 'center' }); txt(g, '月', b.moon.x + 7, b.moon.y - 6, { color: COL.ink }); },
    hud: (s) => { const m = bodies(s.t).moon; return ['月のローカル (24, 0)', '月のワールド (' + f(m.x) + ', ' + f(m.y) + ')']; } }),

  card({ s: 'angle', name: '相手から見た位置', tag: 'local = R(−θ) · (P − 位置)',
    desc: '画面全体の座標（ワールド座標）で表した点 P を、戦車から見た「前にいくつ、右にいくつ」に直します。まず戦車の位置を引き、次に戦車の向きのぶんだけ逆に回すだけ。前後左右がわかれば「後ろからの攻撃だけよく効く」といった判定も簡単です。',
    hint: 'P をドラッグ', pts: [[190, 60]], free: 0,
    auto: (s) => { s.P[0].x = 120 + 92 * Math.cos(s.t * .006 + 1); s.P[0].y = 120 + 92 * Math.sin(s.t * .0095); },
    draw: (g, s) => {
      const a = s.t * .008, pos = V(120 + 46 * Math.cos(a), 120 + 46 * Math.sin(a)), th = a + Math.PI / 2, P = s.P[0], L = rot(sub(P, pos), -th); s.L = L;
      g.save(); g.translate(pos.x, pos.y); g.rotate(th);
      g.strokeStyle = 'rgba(79,224,255,.12)'; g.lineWidth = 1; g.beginPath();
      for (let k = -160; k <= 160; k += 20) { g.moveTo(k, -160); g.lineTo(k, 160); g.moveTo(-160, k); g.lineTo(160, k); } g.stroke();
      g.fillStyle = '#7fd6ff'; g.fillRect(-13, -10, 26, 20); g.fillStyle = '#4b90b0'; g.fillRect(-15, -12, 30, 4); g.fillRect(-15, 8, 30, 4);
      g.fillStyle = '#c9ecff'; g.fillRect(0, -2.5, 20, 5); g.restore();
      const fw = fromAng(th), rt = fromAng(th + Math.PI / 2);
      arrow(g, add(pos, mul(fw, 16)), add(pos, mul(fw, 52)), COL.red, 2); arrow(g, add(pos, mul(rt, 14)), add(pos, mul(rt, 46)), COL.green, 2);
      const fl = add(pos, mul(fw, 64)), rl = add(pos, mul(rt, 58));
      txt(g, '前', fl.x, fl.y + 4, { color: COL.red, weight: 700, align: 'center' }); txt(g, '右', rl.x, rl.y + 4, { color: COL.green, weight: 700, align: 'center' });
      const K = add(pos, mul(fw, L.x)); line(g, pos, K, COL.red, 1.3, [3, 3]); line(g, K, P, COL.green, 1.3, [3, 3]);
      circ(g, P, 6, COL.yellow); handle(g, P, COL.yellow, null, { hollow: true });
      const where = (L.y >= 0 ? '右' : '左') + (L.x >= 0 ? '前' : '後ろ');
      txt(g, 'P：' + where, P.x + (P.x > 170 ? -12 : 12), P.y - 12, { color: COL.ink, align: P.x > 170 ? 'right' : 'left', bg: 'rgba(13,17,34,.8)' }); },
    hud: (s) => ['ワールド (' + f(s.P[0].x) + ', ' + f(s.P[0].y) + ')', 'ローカル 前 ' + f(s.L.x) + ' / 右 ' + f(s.L.y)] }),

  card({ s: 'angle', name: '円運動と波', tag: '(cos t, sin t)',
    desc: '円の上を一定の速さで回る点の、横の位置が cos、縦の位置が sin です。時間とともに並べると、どちらも同じ形の波になります。右下のコインは、ふわふわ上下する動きに sin を、回って見える幅に cos を使っています。',
    draw: (g, s) => {
      const C = V(58, 62), r = 38, a = s.t * .03, P = V(C.x + r * Math.cos(a), C.y - r * Math.sin(a)), k = .05;
      line(g, V(C.x - r - 6, C.y), V(232, C.y), 'rgba(255,255,255,.14)', 1); line(g, V(C.x, C.y - r - 6), V(C.x, 232), 'rgba(255,255,255,.14)', 1);
      circ(g, C, r, null, 'rgba(255,255,255,.3)', 1.2);
      const sw = [], cw = [];
      for (let x = 108; x <= 232; x += 2) sw.push(V(x, C.y - r * Math.sin(a - (x - 108) * k)));
      for (let y = 112; y <= 232; y += 2) cw.push(V(C.x + r * Math.cos(a - (y - 112) * k), y));
      path(g, sw, COL.pink, 2); path(g, cw, COL.cyan, 2);
      line(g, P, V(108, P.y), 'rgba(255,122,217,.6)', 1, [2, 3]); line(g, P, V(P.x, 112), 'rgba(79,224,255,.6)', 1, [2, 3]);
      circ(g, V(108, P.y), 3.5, COL.pink); circ(g, V(P.x, 112), 3.5, COL.cyan);
      line(g, C, P, '#e8ecf7', 1.5); circ(g, P, 5, COL.yellow);
      txt(g, 'sin', 230, 20, { color: COL.pink, align: 'right', weight: 700, size: 11 }); txt(g, 'cos', C.x + r + 6, 230, { color: COL.cyan, weight: 700, size: 11 });
      const cy = 176 + 12 * Math.sin(s.t * .06), cw2 = 16 * Math.cos(s.t * .05);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(178, 214, 14 - (cy - 164) * .15, 3, 0, 0, TAU); g.fill();
      g.fillStyle = cw2 > 0 ? COL.yellow : '#c99a2a'; g.beginPath(); g.ellipse(178, cy, Math.max(1, Math.abs(cw2)), 16, 0, 0, TAU); g.fill();
      if (Math.abs(cw2) > 6) { g.strokeStyle = 'rgba(120,80,0,.6)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(178, cy, Math.abs(cw2) * .6, 10, 0, 0, TAU); g.stroke(); }
      txt(g, '高さ = 12 sin(t)', 178, 140, { align: 'center', color: COL.pink }); txt(g, '幅 = 16 cos(t)', 178, 232, { align: 'center', color: COL.cyan }); } }),

  /* ===== interpolation & curves ===== */
  card({ s: 'interp', name: '線形補間（lerp）', tag: 'lerp(A, B, t) = A + (B − A) × t',
    desc: 'A と B のあいだを割合 t で結びます。t = 0 なら A、t = 1 なら B、0.5 ならちょうど真ん中。位置だけでなく、色や大きさ、音量など、数で表せるものは何でも同じ式で混ぜられます。',
    hint: 'A・B と下のつまみをドラッグ', pts: [[36, 64], [204, 124]],
    init: (s) => { s.tt = 0; s.man = false; },
    step: (s) => { if (!s.man) s.tt = pingpong(s.t * .008); },
    down: (s, p) => { if (p.y > 170) { s.man = s.sl = s.touched = true; s.tt = clamp((p.x - 30) / 180, 0, 1); } },
    move: (s, p, d) => { if (d && s.sl) s.tt = clamp((p.x - 30) / 180, 0, 1); },
    up: (s) => { s.sl = false; },
    draw: (g, s) => {
      const [A, B] = s.P, t = s.tt, P = vlerp(A, B, t), ab = norm(sub(B, A)), nn = V(-ab.y, ab.x);
      line(g, A, B, 'rgba(255,255,255,.35)', 1.5);
      [0, .25, .5, .75, 1].forEach(k => { const q = vlerp(A, B, k); line(g, add(q, mul(nn, -5)), add(q, mul(nn, 5)), 'rgba(255,255,255,.4)', 1);
        if (k === .5) txt(g, 't = 0.5', q.x + nn.x * 16, q.y + nn.y * 16 + 4, { align: 'center' }); });
      circ(g, P, lerp(5, 13, t), mix(COL.blue, COL.orange, t));
      handle(g, A, COL.blue, 'A', { dx: -4, dy: -14 }); handle(g, B, COL.orange, 'B', { dx: -4, dy: -14 });
      const y = 192, x0 = 30, x1 = 210, gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, COL.blue); gr.addColorStop(1, COL.orange);
      g.fillStyle = gr; g.fillRect(x0, y - 4, x1 - x0, 8);
      const kx = lerp(x0, x1, t); circ(g, V(kx, y), 7, '#fff'); circ(g, V(kx, y), 4, mix(COL.blue, COL.orange, t));
      txt(g, 't = ' + t.toFixed(2), kx, y - 12, { align: 'center', color: COL.ink, weight: 700 });
      txt(g, '0', x0, y + 18, { align: 'center' }); txt(g, '1', x1, y + 18, { align: 'center' }); },
    hud: (s) => { const P = vlerp(s.P[0], s.P[1], s.tt); return ['P = (' + f(P.x) + ', ' + f(P.y) + ')', '色・大きさも同じ t で混ぜる']; } }),

  pair({ s: 'interp', name: 'fps に左右されない追従', tag: '× 0.1 → × (1 − e^(−k·dt))',
    desc: '「毎フレーム、残りの距離の1割だけ近づく」追従は手軽ですが、1秒に60回と15回では呼ばれる回数が違うので、遅い環境では4倍ゆっくりになります（上）。下は経過時間 dt を使い、1 − e^(−k·dt) の割合で近づくので、60fps でも 15fps でも同じ速さで追いつきます。',
    scen: (fix) => {
      const k = 6.32; let t = 0, tx = 40; const x = [40, 40], hist = [[], []];
      const upd = (i, dt) => { x[i] += (tx - x[i]) * (fix ? 1 - Math.exp(-k * dt) : .1); };
      return {
        act() { t = 0; tx = 40; x[0] = x[1] = 40; hist[0].length = hist[1].length = 0; },
        step() { if (t % 130 === 0) tx = tx > 120 ? 40 : 200;
          upd(0, 1 / 60); if (t % 4 === 0) upd(1, 4 / 60);
          for (let i = 0; i < 2; i++) { hist[i].push(x[i]); if (hist[i].length > 20) hist[i].shift(); } t++; },
        draw(g) { line(g, V(tx, 30), V(tx, 114), 'rgba(255,216,77,.7)', 1.2, [3, 3]); txt(g, '目標', tx + 4, 112, { color: COL.yellow });
          [[52, COL.cyan, '60fps'], [90, COL.pink, '15fps']].forEach(([y, col, name], i) => {
            line(g, V(30, y), V(214, y), 'rgba(255,255,255,.1)', 1);
            hist[i].forEach((h, j) => circ(g, V(h, y), 6, `rgba(255,255,255,${j / hist[i].length * .12})`));
            circ(g, V(x[i], y), 7, col); txt(g, name, 8, y - 10, { color: col, weight: 700 }); }); },
        note: () => fix ? '1 − e^(−k·dt)' : '毎回 1割'
      };
    } }),

  card({ s: 'interp', name: 'ばねで追う（臨界減衰）', tag: 'a = ω²(目標 − x) − 2ζω·v,  ζ = 1',
    desc: 'カメラや UI が目標を追う3つの方法です。黄は残りの1割ずつ近づくので、動き出しがいきなり速い。桃はばねで、行きすぎて揺れます。緑はブレーキ（減衰）をちょうどよい強さにしたばねで、なめらかに動き出し、行きすぎずに止まります。下は位置のグラフです。',
    hint: 'クリックで目標を動かす',
    init: (s) => { s.tx = 60; s.M = [{ x: 60, v: 0 }, { x: 60, v: 0 }, { x: 60, v: 0 }]; s.hist = []; },
    down: (s, p) => { s.touched = true; s.tx = clamp(p.x, 20, 220); },
    step: (s) => {
      if (!s.touched && s.t % 120 === 30) s.tx = s.tx < 120 ? 165 + s.rand() * 50 : 25 + s.rand() * 50;
      const w = .13, [a, b, c] = s.M;
      a.x += (s.tx - a.x) * .12;
      b.v += w * w * (s.tx - b.x) - 2 * .18 * w * b.v; b.x += b.v;
      c.v += w * w * (s.tx - c.x) - 2 * 1 * w * c.v; c.x += c.v;
      s.hist.push([s.tx, a.x, b.x, c.x]); if (s.hist.length > 224) s.hist.shift(); },
    draw: (g, s) => {
      const cols = [COL.yellow, COL.pink, COL.green], names = ['1割ずつ', 'ばね', '臨界減衰'];
      names.forEach((n, i) => txt(g, '● ' + n, 10 + i * 72, 16, { color: cols[i], weight: 700 }));
      line(g, V(s.tx, 26), V(s.tx, 100), 'rgba(255,255,255,.55)', 1.2, [3, 3]);
      s.M.forEach((m, i) => { const y = 38 + i * 26; line(g, V(8, y), V(232, y), 'rgba(255,255,255,.08)', 1); circ(g, V(m.x, y), 7, cols[i]); });
      const gy0 = 112, gy1 = 232, map = (v) => gy1 - 6 - clamp(v / 240, -.1, 1.1) * (gy1 - gy0 - 12);
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.strokeRect(8.5, gy0 + .5, 224, gy1 - gy0 - 4);
      for (let k = 3; k >= 0; k--) { const pts = s.hist.map((h, i) => V(8 + i, map(h[k]))); if (k === 0) { g.setLineDash([3, 3]); path(g, pts, 'rgba(255,255,255,.5)', 1.2); g.setLineDash([]); } else path(g, pts, cols[k - 1], 1.8); }
      txt(g, '位置', 12, gy0 + 13); txt(g, '時間 →', 228, gy1 - 8, { align: 'right' }); } }),

  card({ s: 'interp', name: 'ベジェ曲線', tag: 'lerp を3段重ねる（3次ベジェ）',
    desc: '4つの制御点を順に lerp で結び、できた3点をまた lerp、2点をまた lerp……と3回くり返した点が、曲線の上の点になります（ド・カステリョの方法）。曲線は両端の点を通り、真ん中の2点のほうへ引っぱられます。',
    hint: '4つの点をドラッグ', pts: [[28, 206], [44, 42], [196, 42], [212, 206]],
    draw: (g, s) => {
      const P = s.P, t = pingpong(s.t * .006); s.tt = t;
      path(g, P, 'rgba(255,255,255,.25)', 1);
      const full = [], part = []; for (let i = 0; i <= 80; i++) { const q = bezier(P, i / 80); full.push(q); if (i / 80 <= t) part.push(q); }
      part.push(bezier(P, t));
      path(g, full, 'rgba(255,255,255,.22)', 2); path(g, part, COL.yellow, 3);
      const L1 = [0, 1, 2].map(i => vlerp(P[i], P[i + 1], t)), L2 = [0, 1].map(i => vlerp(L1[i], L1[i + 1], t)), Q = vlerp(L2[0], L2[1], t);
      path(g, L1, COL.green, 1.3); L1.forEach(p => circ(g, p, 3, COL.green));
      line(g, L2[0], L2[1], COL.cyan, 1.5); L2.forEach(p => circ(g, p, 3.5, COL.cyan));
      circ(g, Q, 6, COL.yellow);
      P.forEach((p, i) => handle(g, p, COL.ink, 'P' + i, { dx: i < 2 ? -24 : 10, dy: i === 0 || i === 3 ? 4 : -9 })); },
    hud: (s) => ['t = ' + s.tt.toFixed(2), '緑: 1段目  水色: 2段目  黄: 3段目'] }),

  card({ s: 'interp', name: 'Catmull-Rom スプライン', tag: '接線 = (P[i+1] − P[i−1]) / 2',
    desc: 'ベジェ曲線は制御点の上を通りませんが、こちらは置いた点をすべて通るなめらかな曲線です。各点での向き（接線）を、前後の点を結んだ向きから自動で決めます（点線）。敵の巡回ルートやカメラの通り道を「通ってほしい点を置くだけ」で作れます。',
    hint: '点をドラッグ', pts: [[48, 62], [130, 36], [206, 78], [194, 176], [112, 204], [38, 160]],
    draw: (g, s) => {
      const P = s.P, n = P.length, at = (i) => P[((i % n) + n) % n];
      g.setLineDash([2, 4]); poly(g, P, null, 'rgba(255,255,255,.18)', 1); g.setLineDash([]);
      const pts = []; for (let i = 0; i < n; i++) for (let k = 0; k <= 20; k++) pts.push(catmull(at(i - 1), at(i), at(i + 1), at(i + 2), k / 20));
      path(g, pts, COL.cyan, 2.2);
      const u = (s.t * .008) % n, i = Math.floor(u), t = u - i; s.seg = i; s.tt = t;
      const A = at(i), tg = norm(sub(at(i + 1), at(i - 1)));
      line(g, at(i - 1), at(i + 1), 'rgba(255,216,77,.45)', 1, [3, 3]);
      arrow(g, sub(A, mul(tg, 22)), add(A, mul(tg, 22)), COL.yellow, 1.8, 7);
      const p = catmull(at(i - 1), A, at(i + 1), at(i + 2), t), d = catmullD(at(i - 1), A, at(i + 1), at(i + 2), t), a = Math.atan2(d.y, d.x);
      g.save(); g.translate(p.x, p.y); g.rotate(a); g.fillStyle = COL.pink; g.beginPath(); g.moveTo(10, 0); g.lineTo(-7, -6); g.lineTo(-4, 0); g.lineTo(-7, 6); g.closePath(); g.fill(); g.restore();
      P.forEach((q, k) => handle(g, q, k === i ? COL.yellow : COL.ink, null)); },
    hud: (s) => ['区間 ' + s.seg + ' → ' + ((s.seg + 1) % 6) + '   t = ' + s.tt.toFixed(2)] }),

  pair({ s: 'interp', name: '曲線の上を同じ速さで', tag: '弧長パラメータ化（長さの表 → t）', names: ['t を等間隔', '長さを等間隔'],
    desc: 'ベジェ曲線の t を一定の速さで増やしても、曲線の上を進む速さは一定になりません。制御点が集まったところでは遅く、離れたところでは速くなります（上）。下は先に曲線を細かく区切って長さの表を作り、「進んだ距離」から t を逆に引いているので、等速で進みます。',
    scen: (fix) => {
      const P = [V(16, 104), V(22, 22), V(84, 24), V(226, 100)], N = 200, ts = [], ls = [];
      let L = 0, prev = bezier(P, 0);
      for (let i = 0; i <= N; i++) { const q = bezier(P, i / N); L += len(sub(q, prev)); prev = q; ts.push(i / N); ls.push(L); }
      const tAt = (d) => { let i = 1; while (i < N && ls[i] < d) i++; const a = ls[i - 1], b = ls[i]; return lerp(ts[i - 1], ts[i], b > a ? clamp((d - a) / (b - a), 0, 1) : 0); };
      const curve = []; for (let i = 0; i <= 80; i++) curve.push(bezier(P, i / 80));
      const ticks = []; for (let k = 0; k <= 16; k++) { const t = fix ? tAt(L * k / 16) : k / 16, q = bezier(P, t), q2 = bezier(P, Math.min(1, t + .01)), q1 = bezier(P, Math.max(0, t - .01)), d = norm(sub(q2, q1)); ticks.push([q, V(-d.y, d.x)]); }
      let t = 0, sp = 0, last = null; const tr = [];
      return {
        act() { t = 0; tr.length = 0; last = null; },
        step() { const u = clamp((t % 170) / 140, 0, 1), tt = fix ? tAt(u * L) : u, p = bezier(P, tt);
          sp = last ? len(sub(p, last)) : 0; last = p; tr.push(p); if (tr.length > 14) tr.shift(); t++; },
        draw(g) { path(g, curve, 'rgba(255,255,255,.3)', 2);
          for (const [q, n] of ticks) line(g, add(q, mul(n, -6)), add(q, mul(n, 6)), fix ? COL.green : COL.pink, 1.5);
          tr.forEach((p, i) => circ(g, p, 3, `rgba(255,216,77,${i / tr.length * .5})`));
          if (last) circ(g, last, 5.5, COL.yellow); },
        note: () => '速さ ' + sp.toFixed(1)
      };
    } }),

  /* ===== collision ===== */
  card({ s: 'hit', name: '円と円', tag: 'd² < (r₁ + r₂)²',
    desc: '2つの円は、中心どうしの距離 d が半径の和より短ければ重なっています。平方根（√）の計算は少し重いので、両辺を2乗したまま比べるのが定番です。重なったときは、中心を結ぶ向きに重なったぶんだけ押し戻せば離れます（点線の円）。',
    hint: '小さい円をドラッグ', pts: [[190, 60]], free: 0,
    auto: (s) => { const a = s.t * .011, r = 58 + 32 * Math.sin(s.t * .023); s.P[0].x = 116 + r * Math.cos(a); s.P[0].y = 116 + r * Math.sin(a); },
    draw: (g, s) => {
      const A = V(116, 116), ra = 42, B = s.P[0], rb = 26, d = sub(B, A), d2 = dot(d, d), rr = (ra + rb) * (ra + rb), hit = d2 < rr;
      s.d2 = d2; s.rr = rr; s.dep = ra + rb - Math.sqrt(d2);
      circ(g, A, ra, hit ? 'rgba(255,84,112,.22)' : 'rgba(91,140,255,.2)', hit ? COL.red : COL.blue, 2);
      circ(g, B, rb, hit ? 'rgba(255,84,112,.22)' : 'rgba(255,159,67,.2)', hit ? COL.red : COL.orange, 2);
      line(g, A, B, 'rgba(255,255,255,.6)', 1.2, [3, 3]); circ(g, A, 2.5, '#fff'); circ(g, B, 2.5, '#fff');
      const m = vlerp(A, B, .5); txt(g, 'd', m.x + 5, m.y - 5, { color: COL.ink, weight: 700, size: 11 });
      if (hit) { const n = norm(d), G = add(B, mul(n, s.dep)); circ(g, G, rb, null, COL.green, 1.3, [4, 3]); arrow(g, B, G, COL.green, 2, 6); }
      handle(g, B, COL.ink, null, { hollow: true }); },
    hud: (s) => ['d² = ' + Math.round(s.d2) + '   (r₁ + r₂)² = ' + Math.round(s.rr), s.d2 < s.rr ? '重なり ' + f(s.dep, 1) + ' → 押し戻す' : '離れている'] }),

  card({ s: 'hit', name: '箱と箱（AABB）', tag: 'x でも y でも区間が重なる',
    desc: '回っていない箱どうしは、横（x）の範囲と縦（y）の範囲を別々に比べます。上の帯が x の範囲、左の帯が y の範囲です。両方が重なったときだけ当たり。どちらか一方でも離れていれば、当たっていません。',
    hint: '橙の箱をドラッグ', pts: [[180, 170]], free: 0,
    auto: (s) => { s.P[0].x = 122 + 76 * Math.sin(s.t * .013); s.P[0].y = 124 + 64 * Math.sin(s.t * .021 + .5); },
    draw: (g, s) => {
      const A = { x0: 80, y0: 86, x1: 160, y1: 144 }, c = s.P[0], B = { x0: c.x - 28, y0: c.y - 20, x1: c.x + 28, y1: c.y + 20 },
        ox = A.x0 < B.x1 && A.x1 > B.x0, oy = A.y0 < B.y1 && A.y1 > B.y0, hit = ox && oy; s.ox = ox; s.oy = oy;
      g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; g.setLineDash([2, 3]); g.beginPath();
      for (const b of [A, B]) { g.moveTo(b.x0, b.y0); g.lineTo(b.x0, 26); g.moveTo(b.x1, b.y0); g.lineTo(b.x1, 26); g.moveTo(b.x0, b.y0); g.lineTo(26, b.y0); g.moveTo(b.x0, b.y1); g.lineTo(26, b.y1); }
      g.stroke(); g.setLineDash([]);
      const rect = (b, fill, st) => { g.fillStyle = fill; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); g.strokeStyle = st; g.lineWidth = 2; g.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); };
      rect(A, hit ? 'rgba(255,84,112,.2)' : 'rgba(91,140,255,.2)', hit ? COL.red : COL.blue);
      rect(B, hit ? 'rgba(255,84,112,.2)' : 'rgba(255,159,67,.2)', hit ? COL.red : COL.orange);
      if (ox) { g.fillStyle = 'rgba(94,240,138,.3)'; g.fillRect(Math.max(A.x0, B.x0), 6, Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), 20); }
      if (oy) { g.fillStyle = 'rgba(94,240,138,.3)'; g.fillRect(6, Math.max(A.y0, B.y0), 20, Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0)); }
      g.fillStyle = COL.blue; g.fillRect(A.x0, 10, A.x1 - A.x0, 5); g.fillRect(10, A.y0, 5, A.y1 - A.y0);
      g.fillStyle = COL.orange; g.fillRect(B.x0, 17, B.x1 - B.x0, 5); g.fillRect(17, B.y0, 5, B.y1 - B.y0);
      txt(g, 'x', 232, 20, { align: 'right', weight: 700 }); txt(g, 'y', 12, 200, { weight: 700 });
      handle(g, c, COL.ink, null, { hollow: true }); },
    hud: (s) => ['x: ' + (s.ox ? '重なる' : '離れている') + '   y: ' + (s.oy ? '重なる' : '離れている'), s.ox && s.oy ? '→ 当たり' : '→ 当たっていない'] }),

  card({ s: 'hit', name: '回った箱（分離軸定理）', tag: 'すきまのある軸が1本でもあれば外れ',
    desc: '回った箱どうしは、それぞれの辺に垂直な軸（ここでは4本）の上に影を落として比べます。どれか1本でも影にすきまがあれば、そこに線を引いて2つを分けられるので、当たっていません（分離軸定理）。線の上の帯は、すきまが一番大きい軸（当たっているときは重なりが一番小さい軸）への影です。',
    hint: '橙の箱をドラッグ', pts: [[170, 80]], free: 0,
    auto: (s) => { s.P[0].x = 128 + 62 * Math.cos(s.t * .009); s.P[0].y = 100 + 44 * Math.sin(s.t * .016); },
    draw: (g, s) => {
      const aA = s.t * .006, aB = -s.t * .01 + .5, A = boxCorners(V(100, 110), 42, 22, aA), B = boxCorners(s.P[0], 30, 18, aB);
      const axes = [fromAng(aA), fromAng(aA + Math.PI / 2), fromAng(aB), fromAng(aB + Math.PI / 2)];
      let best = null, nsep = 0;
      for (const ax of axes) { const [a0, a1] = project(A, ax), [b0, b1] = project(B, ax), ov = Math.min(a1, b1) - Math.max(a0, b0);
        if (ov < 0) nsep++;
        const score = ov; if (!best || score < best.ov) best = { ax, a: [a0, a1], b: [b0, b1], ov }; }
      const hit = nsep === 0; s.nsep = nsep;
      poly(g, A, hit ? 'rgba(255,84,112,.2)' : 'rgba(91,140,255,.2)', hit ? COL.red : COL.blue, 2);
      poly(g, B, hit ? 'rgba(255,84,112,.2)' : 'rgba(255,159,67,.2)', hit ? COL.red : COL.orange, 2);
      const O = V(120, 106), ax = best.ax; let pp = V(-ax.y, ax.x); if (pp.y < 0) pp = mul(pp, -1);
      const base = add(O, mul(pp, 80)), at = (v, off) => add(add(base, mul(ax, v - dot(O, ax))), mul(pp, off));
      line(g, sub(base, mul(ax, 200)), add(base, mul(ax, 200)), 'rgba(255,255,255,.3)', 1);
      const guide = (pts, [lo, hi], off) => { for (const v of [lo, hi]) { const p = pts.reduce((m, q) => Math.abs(dot(q, ax) - v) < Math.abs(dot(m, ax) - v) ? q : m); line(g, p, at(v, off), 'rgba(255,255,255,.14)', 1, [2, 3]); } };
      guide(A, best.a, -3); guide(B, best.b, 3);
      line(g, at(best.a[0], -3), at(best.a[1], -3), COL.blue, 5); line(g, at(best.b[0], 3), at(best.b[1], 3), COL.orange, 5);
      const lo = Math.max(best.a[0], best.b[0]), hi = Math.min(best.a[1], best.b[1]);
      line(g, at(Math.min(lo, hi), 0), at(Math.max(lo, hi), 0), hit ? COL.red : COL.green, 3);
      const lp = at((lo + hi) / 2, -14); txt(g, hit ? '重なり' : 'すきま', lp.x, lp.y + 4, { align: 'center', color: hit ? COL.red : COL.green, weight: 700, bg: 'rgba(13,17,34,.8)' });
      handle(g, s.P[0], COL.ink, null, { hollow: true }); },
    hud: (s) => ['すきまのある軸 ' + s.nsep + ' / 4 本', s.nsep ? '→ 当たっていない' : '→ 当たり'] }),

  card({ s: 'hit', name: '線分と線分の交差', tag: 'A + t(B − A) = C + u(D − C)',
    desc: '2本の線分を「A から割合 t だけ進んだ点」「C から割合 u だけ進んだ点」と書いて、2つが同じ点になる t と u を外積で解きます。t と u がどちらも 0〜1 なら、線分どうしが本当に交わっています。はみ出していれば、延長した線（点線）の上で交わるだけです。',
    hint: '4つの端をドラッグ', pts: [[28, 70], [212, 180], [100, 130], [220, 60]],
    auto: (s) => { const c = V(150, 96), a = s.t * .01; s.P[2] = add(c, fromAng(a + Math.PI, 56)); s.P[3] = add(c, fromAng(a, 84)); },
    draw: (g, s) => {
      const [A, B, C, D] = s.P, r = sub(B, A), q = sub(D, C), den = cross(r, q);
      line(g, sub(A, mul(r, 3)), add(B, mul(r, 3)), 'rgba(79,224,255,.2)', 1, [4, 4]); line(g, sub(C, mul(q, 3)), add(D, mul(q, 3)), 'rgba(255,159,67,.2)', 1, [4, 4]);
      line(g, A, B, COL.cyan, 2.5); line(g, C, D, COL.orange, 2.5);
      s.par = Math.abs(den) < 1e-6;
      if (!s.par) { const ca = sub(C, A), t = cross(ca, q) / den, u = cross(ca, r) / den, X = add(A, mul(r, t)), ok = t >= 0 && t <= 1 && u >= 0 && u <= 1;
        s.tv = t; s.uv = u; s.ok = ok;
        if (ok) { circ(g, X, 10, 'rgba(255,84,112,.25)'); circ(g, X, 5, COL.red); } else circ(g, X, 4.5, null, 'rgba(255,255,255,.6)', 1.4); }
      handle(g, A, COL.cyan, 'A'); handle(g, B, COL.cyan, 'B'); handle(g, C, COL.orange, 'C'); handle(g, D, COL.orange, 'D'); },
    hud: (s) => s.par ? ['平行（交わらない）'] : ['t = ' + f(s.tv, 2) + '   u = ' + f(s.uv, 2), s.ok ? '→ 交わる' : '→ 延長線の上で交わるだけ'] }),

  card({ s: 'hit', name: 'レイキャストと反射', tag: 'いちばん小さい t を選ぶ + 反射',
    desc: '光線（レイ）が最初にぶつかる場所を求めます。円とは2次方程式、線分とは外積の式で「どれだけ進んだら当たるか（t）」を出し、一番小さい t を選びます。当たった点の法線（緑）と反射ベクトルで向きを変えれば、跳ね返るレーザーになります。',
    hint: '発射点とねらう先をドラッグ', pts: [[30, 186], [150, 60]], free: 1,
    auto: (s) => { s.P[1].x = 150 + 70 * Math.cos(s.t * .009); s.P[1].y = 90 + 60 * Math.sin(s.t * .013); },
    draw: (g, s) => {
      const circles = [[104, 82, 22], [176, 150, 28], [74, 160, 16]], segs = [[V(150, 34), V(214, 70)], [V(2, 2), V(238, 2)], [V(238, 2), V(238, 238)], [V(238, 238), V(2, 238)], [V(2, 238), V(2, 2)]];
      for (const [x, y, r] of circles) circ(g, V(x, y), r, '#1d2338', '#4a5a88', 1.5);
      line(g, segs[0][0], segs[0][1], '#c9cfdf', 3); g.strokeStyle = '#3b4870'; g.lineWidth = 2; g.strokeRect(2, 2, 236, 236);
      const [O, T] = s.P; line(g, O, T, 'rgba(255,255,255,.2)', 1, [3, 4]);
      let o = O, d = norm(sub(T, O)); s.first = 0; s.bounce = 0;
      for (let k = 0; k < 4; k++) {
        let best = null;
        for (const [x, y, r] of circles) { const h = rayCircle(o, d, V(x, y), r); if (h && (!best || h.t < best.t)) best = h; }
        for (const [a, b] of segs) { const h = raySeg(o, d, a, b); if (h && (!best || h.t < best.t)) best = h; }
        if (!best) break;
        if (k === 0) s.first = best.t;
        const al = 1 - k * .22;
        line(g, o, best.p, `rgba(255,84,112,${.25 * al})`, 6); line(g, o, best.p, `rgba(255,120,140,${al})`, 1.8);
        arrow(g, best.p, add(best.p, mul(best.n, 18)), COL.green, 1.5, 6); circ(g, best.p, 3, '#fff');
        d = sub(d, mul(best.n, 2 * dot(d, best.n))); o = best.p; s.bounce = k;
      }
      circ(g, O, 7, COL.red); handle(g, O, COL.ink, null, { hollow: true }); handle(g, T, COL.yellow, null, { hollow: true }); },
    hud: (s) => ['最初に当たるまで t = ' + f(s.first, 1), '跳ね返り ' + s.bounce + ' 回'] }),

  card({ s: 'hit', name: '点が多角形の内側か', tag: '交わる回数が奇数なら内側',
    desc: '点から右へまっすぐ線を伸ばし、多角形の辺と何回交わるかを数えます。外から中に入ると1回、中から外に出るともう1回なので、奇数回なら内側、偶数回なら外側。星形のようにへこんだ形でも、同じ方法で判定できます。',
    hint: '点をドラッグ', pts: [[60, 60]], free: 0,
    auto: (s) => { s.P[0].x = 116 + 96 * Math.sin(s.t * .008); s.P[0].y = 120 + 74 * Math.sin(s.t * .0133 + .7); },
    draw: (g, s) => {
      const S = []; for (let k = 0; k < 12; k++) S.push(add(V(120, 118), fromAng(k * TAU / 12 - Math.PI / 2, k % 2 ? 42 : 96)));
      const P = s.P[0], X = [];
      for (let i = 0, j = S.length - 1; i < S.length; j = i++) { const a = S[i], b = S[j];
        if ((a.y > P.y) !== (b.y > P.y)) { const x = a.x + (P.y - a.y) * (b.x - a.x) / (b.y - a.y); if (x > P.x) X.push(x); } }
      X.sort((a, b) => a - b); const inside = X.length % 2 === 1; s.n = X.length;
      poly(g, S, inside ? 'rgba(94,240,138,.18)' : 'rgba(79,224,255,.08)', inside ? COL.green : '#4a8fb0', 1.8);
      line(g, P, V(W, P.y), COL.yellow, 1.4, [4, 3]);
      X.forEach((x, i) => { circ(g, V(x, P.y), 7, '#0d1122', COL.yellow, 1.4); txt(g, String(i + 1), x, P.y + 4, { align: 'center', color: COL.yellow, weight: 700, size: 9.5 }); });
      circ(g, P, 5, inside ? COL.green : '#e8ecf7'); handle(g, P, COL.ink, null, { hollow: true }); },
    hud: (s) => ['交わった回数 ' + s.n, s.n % 2 ? '奇数 → 内側' : '偶数 → 外側'] })
];

/* 親子の座標: sun → planet → moon */
function bodies(t) {
  const sun = V(120, 118), a1 = t * .008, a2 = t * .05;
  const planet = add(sun, rot(V(72, 0), a1)), moon = add(planet, rot(V(24, 0), a1 + a2));
  return { sun, planet, moon, a1, a2 };
}

const SECTIONS = [
  { id: 'vec', en: 'Vectors', title: 'ベクトルの基本', lead: 'ベクトルは「向きと長さをもった矢印」です。位置の引き算、長さをそろえる正規化、内積と外積という少しの道具だけで、「どっちを向くか」「前にいるか」「右にいるか」「どう跳ね返るか」が計算できます。' },
  { id: 'angle', en: 'Angles & rotation', title: '角度と回転', lead: '相手のほうを向く、なめらかに振り向く、親についていく子を動かす。回転はどれも sin と cos の組み合わせで書けます。画面は下が y のプラスなので、角度は時計回りがプラスです。' },
  { id: 'interp', en: 'Interpolation & curves', title: '補間と曲線', lead: '「A から B へ、あいだをどう埋めるか」を決めるのが補間です。まっすぐ結ぶ lerp から、目標の追いかけ方、なめらかな曲線、曲線の上を同じ速さで進む方法まで。' },
  { id: 'hit', en: 'Collision tests', title: '当たり判定', lead: '「重なっているか」「どこで交わるか」を調べる計算です。形ごとに決まった調べ方があり、どれもここまでのベクトルの道具の組み合わせでできています。赤くなったら当たりです。' }
];

run({ sections: SECTIONS, items: ITEMS, W, H, minCol: 300 });
})();
