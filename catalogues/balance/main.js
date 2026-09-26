/* 確率とゲームバランス図鑑 — card definitions. Runtime: assets/js/g2d.js */
(function () {
const { rng, clamp, lerp, ease, COL, label, run } = G2D;
const W = 240, H = 256, PH = 124, GAP = 8, TAU = Math.PI * 2;
const AXIS = '#3b4870', GRIDC = '#1c2340', FAINT = '#6f7894';

/* ---------- small helpers ---------- */
function bg(g, c = '#0d1122') { g.fillStyle = c; g.fillRect(0, 0, W, H); }
const pct = (v, d = 1) => (isFinite(v) ? (v * 100).toFixed(d) : '—') + '%';
const num = (n) => Math.round(n).toLocaleString('en-US');
function axes(g, x0, y0, x1, y1) { g.fillStyle = AXIS; g.fillRect(x0, y1, x1 - x0, 1); g.fillRect(x0, y0, 1, y1 - y0 + 1); }
function line(g, x0, y0, x1, y1, col, lw = 1, dash) { g.save(); g.strokeStyle = col; g.lineWidth = lw; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore(); }
function poly(g, pts, col, lw = 1.6, dash) { if (!pts.length) return; g.save(); g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'round'; if (dash) g.setLineDash(dash); g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.restore(); }
function dot(g, x, y, r, col, ring) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); if (ring) { g.strokeStyle = ring; g.lineWidth = 1.5; g.stroke(); } }
function bars(g, x, y, w, h, arr, max, col) { const n = arr.length, bw = w / n, gp = bw > 4 ? 1 : 0; for (let i = 0; i < n; i++) { const bh = Math.min(1, arr[i] / max) * h; if (!(bh > 0)) continue; g.fillStyle = typeof col === 'function' ? col(i) : col; g.fillRect(x + i * bw + gp / 2, y + h - bh, bw - gp, bh); } }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const small = (g, t, x, y, o = {}) => label(g, t, x, y, Object.assign({ size: 9.5, color: COL.muted, weight: 500 }, o));
/* first success of a p-chance trial: 1, 2, 3, ... */
const geo = (rand, p) => Math.floor(Math.log(1 - rand()) / Math.log(1 - p)) + 1;
/* trials per step: slow at first so single results can be seen, then grows ~3% per step */
const ramp = (n, t, cap) => Math.min(cap, n < 30 ? (t % 3 === 0 ? 1 : 0) : Math.ceil(n * .03));

/* slider drawn on the canvas */
function slider(o) {
  const s = Object.assign({ x0: 86, x1: 186, step: 1, fmt: v => String(v) }, o);
  s.draw = (g) => {
    label(g, s.label, 8, s.y + 4, { size: 10, color: COL.muted });
    const k = (s.v - s.min) / (s.max - s.min), kx = lerp(s.x0, s.x1, k);
    g.fillStyle = '#2a3252'; rr(g, s.x0, s.y - 2, s.x1 - s.x0, 4, 2); g.fill();
    g.fillStyle = COL.accent; rr(g, s.x0, s.y - 2, Math.max(4, kx - s.x0), 4, 2); g.fill();
    dot(g, kx, s.y, 5.5, '#fff', COL.accent);
    label(g, s.fmt(s.v), 232, s.y + 4, { size: 10.5, mono: true, align: 'right', weight: 500 });
  };
  s.hit = (p) => Math.abs(p.y - s.y) < 11 && p.x > s.x0 - 14 && p.x < s.x1 + 14;
  s.set = (p) => { let v = s.min + clamp((p.x - s.x0) / (s.x1 - s.x0), 0, 1) * (s.max - s.min); v = Math.round(v / s.step) * s.step; v = +v.toFixed(4); if (v !== s.v) { s.v = v; return true; } return false; };
  return s;
}

/* single card: o.init(st) / step(st) / draw(g, st) / hud(st), optional sliders(st) → [slider], down/drag(st, p), change(st) */
function card(o) {
  return {
    s: o.s, name: o.name, tag: o.tag, desc: o.desc, hint: o.hint, reseed: o.reseed !== false, warm: o.warm,
    interactive: !!(o.sliders || o.down), capture: true,
    make: (env) => {
      const st = { t: 0, rand: env.rand, seed: env.seed };
      st.reset = () => { st.t = 0; o.init(st); };
      st.sl = o.sliders ? o.sliders(st) : [];
      o.init(st);
      let drag = null;
      const changed = () => { if (o.change) o.change(st); else st.reset(); };
      return {
        step() { if (o.step) o.step(st); st.t++; },
        draw(g) { o.draw(g, st); for (const s of st.sl) s.draw(g); },
        down(p) { drag = st.sl.find(s => s.hit(p)) || null; if (drag) { if (drag.set(p)) changed(); } else if (o.down) o.down(st, p); },
        move(p, isDown) { if (!isDown) return; if (drag) { if (drag.set(p)) changed(); } else if (o.drag) o.drag(st, p); },
        up() { drag = null; },
        hud() { return o.hud ? o.hud(st) : []; }
      };
    }
  };
}

/* comparison card: the same situation without (top) and with (bottom) the technique */
function pair(o) {
  return {
    s: o.s, name: o.name, tag: o.tag, desc: o.desc, hint: o.hint, reseed: true,
    make: (env) => {
      const A = o.scen({ rand: rng(env.seed), f: false }), B = o.scen({ rand: rng(env.seed + 977), f: true });
      return {
        step() { A.step(); B.step(); },
        draw(g) {
          [[A, 0, o.labels[0]], [B, PH + GAP, o.labels[1]]].forEach(([S, oy, name], i) => {
            g.save(); g.translate(0, oy); g.beginPath(); g.rect(0, 0, W, PH); g.clip();
            g.fillStyle = i ? '#0f1428' : '#0d1020'; g.fillRect(0, 0, W, PH);
            S.draw(g); g.restore();
            g.save(); g.translate(0, oy);
            label(g, name, 8, 15, { size: 10.5, color: i ? '#15171b' : COL.ink, bg: i ? COL.accent : 'rgba(80,88,110,.9)' });
            if (S.note) { const n = S.note(); if (n) label(g, n, W - 8, 15, { size: 10, align: 'right', color: i ? COL.yellow : COL.ink, weight: 500 }); }
            g.restore();
          });
          g.fillStyle = '#15171b'; g.fillRect(0, PH, W, GAP);
        }
      };
    }
  };
}

/* ======================================================================
   1. 乱数の性質
   ====================================================================== */
const uniform = card({
  s: 'rand', name: '一様乱数のばらつき', tag: 'floor(rand() × 10)',
  desc: '0〜9 のどれかを同じ確率で選び、出た数の箱に積みます。数十回では高さがでこぼこですが、回数が増えるほど点線（理想の高さ）にそろっていきます。「同じ確率」は、たくさん試したときにだけ見えてきます。',
  init(st) { st.c = new Array(10).fill(0); st.n = 0; st.last = -1; st.hold = 0; },
  step(st) {
    if (st.hold) { if (--st.hold === 0) st.reset(); return; }
    const k = ramp(st.n, st.t, 5000);
    for (let i = 0; i < k; i++) { const b = st.rand() * 10 | 0; st.c[b]++; st.n++; st.last = b; }
    if (st.n >= 400000) st.hold = 150;
  },
  draw(g, st) {
    bg(g);
    label(g, 'n = ' + num(st.n), 12, 27, { size: 16, mono: true, weight: 500 });
    small(g, '0〜9 を同じ確率で', 228, 25, { align: 'right' });
    const x0 = 16, x1 = 228, y1 = 206, ideal = 96, bw = (x1 - x0) / 10;
    axes(g, x0, 44, x1, y1);
    for (let i = 0; i < 10; i++) {
      const h = st.n ? Math.min(160, st.c[i] / (st.n / 10) * ideal) : 0;
      g.fillStyle = i === st.last ? COL.yellow : COL.cyan; g.fillRect(x0 + i * bw + 2, y1 - h, bw - 4, h);
      label(g, String(i), x0 + (i + .5) * bw, 220, { size: 10, mono: true, align: 'center', color: COL.muted, weight: 500 });
    }
    line(g, x0, y1 - ideal, x1, y1 - ideal, COL.accent, 1.2, [4, 3]);
    small(g, '理想の高さ', x1, y1 - ideal - 5, { align: 'right', color: COL.accent });
  },
  hud(st) { const e = st.n / 10; let d = 0; for (const c of st.c) d = Math.max(d, Math.abs(c - e) / e); return ['いちばん大きいずれ ±' + (st.n ? pct(d) : '—')]; }
});

const DICE_N = [1, 2, 3, 5];
function pips(g, x, y, s, v) {
  g.fillStyle = '#ece8e0'; rr(g, x, y, s, s, s * .2); g.fill(); g.fillStyle = '#15171b';
  const P = { 1: [[.5, .5]], 2: [[.27, .27], [.73, .73]], 3: [[.27, .27], [.5, .5], [.73, .73]], 4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]], 5: [[.27, .27], [.73, .27], [.5, .5], [.27, .73], [.73, .73]], 6: [[.27, .25], [.73, .25], [.27, .5], [.73, .5], [.27, .75], [.73, .75]] };
  for (const [u, w] of P[v]) { g.beginPath(); g.arc(x + u * s, y + w * s, s * .09, 0, TAU); g.fill(); }
}
const dice = card({
  s: 'rand', name: 'サイコロの合計', tag: 'sum of k × d6',
  desc: 'サイコロ1個なら1〜6はどれも同じ割合ですが、2個の合計では7が一番多く、2と12はめったに出ません。個数を増やすほど真ん中が高い山の形になります。オレンジの点が計算上の割合です。',
  hint: 'クリックでサイコロの数を 1→2→3→5 個と切り替え',
  init(st) {
    if (st.ki === undefined) st.ki = 1;
    const k = st.k = DICE_N[st.ki];
    st.c = new Array(5 * k + 1).fill(0); st.n = 0; st.sum = 0; st.last = [];
    let d = [1]; for (let j = 0; j < k; j++) { const nd = new Array(d.length + 5).fill(0); d.forEach((v, i) => { for (let f = 0; f < 6; f++) nd[i + f] += v / 6; }); d = nd; }
    st.th = d;
  },
  step(st) {
    const r = st.n < 40 ? (st.t % 5 === 0 ? 1 : 0) : Math.min(800, Math.ceil(st.n * .03));
    if (st.n > 2e6) return;
    for (let i = 0; i < r; i++) { let s = 0; const L = []; for (let j = 0; j < st.k; j++) { const v = 1 + (st.rand() * 6 | 0); s += v; L.push(v); } st.c[s - st.k]++; st.n++; st.sum += s; st.last = L; }
  },
  down(st) { st.ki = (st.ki + 1) % DICE_N.length; st.reset(); },
  draw(g, st) {
    bg(g);
    const k = st.k, ds = 24, tot = k * 30 - 6; st.last.forEach((v, i) => pips(g, 120 - tot / 2 + i * 30, 12, ds, v));
    if (!st.last.length) small(g, 'サイコロ ' + k + '個', 120, 28, { align: 'center' });
    const x0 = 16, x1 = 228, y0 = 60, y1 = 204, n = st.c.length, bw = (x1 - x0) / n;
    const mx = Math.max(...st.th) * 1.3;
    axes(g, x0, y0, x1, y1);
    bars(g, x0, y0, x1 - x0, y1 - y0, st.c.map(c => st.n ? c / st.n : 0), mx, COL.cyan);
    const pts = st.th.map((p, i) => [x0 + (i + .5) * bw, y1 - p / mx * (y1 - y0)]);
    poly(g, pts, COL.accent, 1.2);
    if (n <= 16) pts.forEach(([x, y]) => dot(g, x, y, 2.4, COL.accent));
    const labs = [k, Math.round(3.5 * k), 6 * k];
    for (const v of labs) label(g, String(v), x0 + (v - k + .5) * bw, 218, { size: 10, mono: true, align: 'center', color: COL.muted, weight: 500 });
  },
  hud(st) { return ['サイコロ ' + st.k + '個 · ' + num(st.n) + '回', '合計の平均 ' + (st.n ? (st.sum / st.n).toFixed(2) : '—') + '（理論 ' + (3.5 * st.k).toFixed(1) + '）']; }
});

const streak = card({
  s: 'rand', name: '連続して外れる確率', tag: 'P(N連続で外れ) = (1 − p)^N',
  desc: '当たる確率 p のくじを、当たるまで引き続ける人を何人も試し、何回目で当たったかを積み上げます。10%のくじでも、20回続けて外れる人は約8人に1人います。赤い部分が N 回以上続けて外れた人です。',
  hint: 'つまみを左右にドラッグして確率と回数を変える',
  sliders: () => [slider({ label: '当たる確率', y: 16, min: 1, max: 50, v: 10, fmt: v => v + '%' }), slider({ label: '連続 N', y: 36, min: 3, max: 40, v: 20, fmt: v => v + '回' })],
  init(st) { st.h = new Array(61).fill(0); st.n = 0; st.over = 0; st.sum = 0; },
  step(st) {
    if (st.n > 3e6) return;
    const p = st.sl[0].v / 100, N = st.sl[1].v;
    for (let i = 0; i < 300; i++) { const m = geo(st.rand, p); st.sum += m; if (m > N) st.over++; st.h[Math.min(60, m)]++; st.n++; }
  },
  draw(g, st) {
    bg(g);
    const p = st.sl[0].v / 100, N = st.sl[1].v, x0 = 16, x1 = 228, y0 = 60, y1 = 204, bw = (x1 - x0) / 60, mx = p * 1.15;
    axes(g, x0, y0, x1, y1);
    bars(g, x0, y0, x1 - x0, y1 - y0, st.h.slice(1).map(c => st.n ? c / st.n : 0), mx, i => i + 1 > N ? COL.red : COL.cyan);
    const pts = []; for (let i = 1; i <= 59; i++) pts.push([x0 + (i - .5) * bw, y1 - Math.min(1, p * Math.pow(1 - p, i - 1) / mx) * (y1 - y0)]);
    poly(g, pts, COL.accent, 1.2);
    const bx = x0 + N * bw; line(g, bx, y0 + 4, bx, y1, 'rgba(255,84,112,.7)', 1, [3, 3]);
    small(g, N + '回外れ →', bx + 3, y1 - 4, { color: COL.red, size: 9 });
    const tx = 226;
    small(g, N + '回続けて外れた人', tx, 86, { align: 'right', color: COL.ink, size: 10 });
    label(g, st.n ? pct(st.over / st.n) : '—', tx, 110, { size: 22, align: 'right', color: COL.red, mono: true, weight: 500 });
    small(g, '計算では ' + pct(Math.pow(1 - p, N)), tx, 126, { align: 'right' });
    for (const v of [1, 20, 40]) label(g, String(v), x0 + (v - .5) * bw, 218, { size: 10, mono: true, align: 'center', color: COL.muted, weight: 500 });
    label(g, '60+', x1, 218, { size: 10, mono: true, align: 'right', color: COL.muted, weight: 500 });
  },
  hud(st) { return ['試した人 ' + num(st.n), '平均 ' + (st.n ? (st.sum / st.n).toFixed(1) : '—') + ' 回目で当たり']; }
});

const seedCard = card({
  s: 'rand', name: '乱数の種で再現する', tag: 'rng(seed) → 同じ並び',
  desc: 'コンピューターの乱数は、種（シード）と呼ぶ数から計算で作る「決まった並び」です。上の2本は同じ種なので最後まで完全に同じ道をたどり、種を1つ変えた3本目はまったく別の道になります。リプレイや対戦の同期、同じマップの共有に使われます。',
  hint: 'クリックで種を変える',
  init(st) {
    if (st.a === undefined) st.a = 10 + st.seed % 990;
    st.rows = [st.a, st.a, st.a + 1].map(sd => { const r = rng(sd), v = []; let y = 0; const nums = []; for (let i = 0; i < 170; i++) { const x = r(); if (i < 4) nums.push(x); y = clamp(y + (x - .5) * 6, -22, 22); v.push(y); } return { sd, v, nums }; });
  },
  down(st) { st.a = 10 + (st.rand() * 990 | 0); st.reset(); },
  step(st) { if (st.t > 200) st.t = 0; },
  draw(g, st) {
    bg(g);
    label(g, '同じ種からは、同じ並びが出る', 120, 20, { size: 11, align: 'center' });
    const u = Math.min(170, st.t * 1.4 | 0);
    st.rows.forEach((R, k) => {
      const cy = 58 + k * 70, col = k === 2 ? COL.orange : COL.cyan;
      g.fillStyle = '#131a33'; g.fillRect(70, cy - 26, 162, 52);
      line(g, 70, cy, 232, cy, GRIDC, 1);
      label(g, '種 ' + R.sd, 8, cy - 3, { size: 11.5, mono: true, weight: 500, color: col });
      if (k === 1) small(g, '＝ 上と同じ', 8, cy + 13, { color: COL.green });
      if (k === 2) small(g, '≠ 1つ違う', 8, cy + 13, { color: COL.red });
      poly(g, R.v.slice(0, u + 1).map((y, i) => [72 + i * .94, cy + y]), col, 1.6);
      if (u > 0) dot(g, 72 + u * .94, cy + R.v[u], 2.8, '#fff');
      label(g, R.nums.map(x => x.toFixed(3)).join('  '), 72, cy + 38, { size: 9.5, mono: true, color: COL.muted, weight: 400 });
    });
  }
});

const lln = card({
  s: 'rand', name: '回数を重ねると割合が落ち着く', tag: 'law of large numbers · ±1/√n',
  desc: '24人が同時にコインを投げ続け、表が出た割合を線で描いています。最初の数回は0%や100%まで大きく揺れますが、回数が増えるほど全員が50%に集まっていきます。オレンジの帯は、ほとんどの人が入る範囲（±1/√n）です。横軸は10倍ごとに同じ幅です。',
  init(st) { st.P = Array.from({ length: 24 }, () => ({ h: 0, n: 0, pts: [] })); st.N = 0; st.hold = 0; },
  step(st) {
    if (st.hold) { if (--st.hold === 0) st.reset(); return; }
    if (st.t % 2) return;
    const T = Math.min(3000, Math.max(st.N + 1, Math.floor(st.N * 1.035)));
    for (const P of st.P) { while (P.n < T) { if (st.rand() < .5) P.h++; P.n++; } P.pts.push([P.n, P.h / P.n]); }
    st.N = T; if (T >= 3000) st.hold = 160;
  },
  draw(g, st) {
    bg(g);
    const x0 = 34, x1 = 226, y0 = 32, y1 = 200, L = Math.log10(3000);
    const X = n => x0 + Math.log10(n) / L * (x1 - x0), Y = v => y1 - v * (y1 - y0);
    small(g, '表が出た割合', 8, 20, { color: COL.ink, size: 10 });
    g.fillStyle = 'rgba(240,165,74,.14)'; g.beginPath();
    for (let i = 0; i <= 60; i++) { const n = Math.pow(3000, i / 60); g.lineTo(X(n), Y(Math.min(1, .5 + 1 / Math.sqrt(n)))); }
    for (let i = 60; i >= 0; i--) { const n = Math.pow(3000, i / 60); g.lineTo(X(n), Y(Math.max(0, .5 - 1 / Math.sqrt(n)))); }
    g.fill();
    axes(g, x0, y0, x1, y1);
    line(g, x0, Y(.5), x1, Y(.5), COL.accent, 1, [4, 3]);
    st.P.forEach((P, i) => { const c = `hsla(${(i * 47) % 360},80%,68%,.75)`; poly(g, P.pts.map(([n, v]) => [X(n), Y(v)]), c, 1.1); const q = P.pts[P.pts.length - 1]; if (q) dot(g, X(q[0]), Y(q[1]), 1.8, c); });
    for (const [v, s] of [[0, '0%'], [.5, '50%'], [1, '100%']]) small(g, s, x0 - 4, Y(v) + 3, { align: 'right', mono: true });
    for (const n of [1, 10, 100, 1000]) small(g, String(n), X(n), 214, { align: 'center', mono: true });
    small(g, '回', x1, 214, { align: 'right' });
  },
  hud(st) { let d = 0; for (const P of st.P) if (P.n) d = Math.max(d, Math.abs(P.h / P.n - .5)); return ['投げた回数 ' + num(st.N), 'いちばん外れた人 50% ± ' + pct(d)]; }
});

/* ======================================================================
   2. 偏りを抑える工夫
   ====================================================================== */
const PIECE = [COL.cyan, COL.yellow, COL.purple, COL.green, COL.red, COL.blue, COL.orange];
function histPanel(g, arr, n, mx, col, labs) {
  const x0 = 8, x1 = 232, y0 = 50, y1 = 104;
  g.fillStyle = AXIS; g.fillRect(x0, y1, x1 - x0, 1);
  bars(g, x0, y0, x1 - x0, y1 - y0, arr.map(c => n ? c / n : 0), mx, col);
  const bw = (x1 - x0) / arr.length;
  for (const [i, s, al] of labs) small(g, s, al === 'right' ? x1 : x0 + (i + .5) * bw, 117, { align: al || 'center', mono: /^[\d+]+$/.test(s) });
}
const S = {};
S.bag = ({ rand, f }) => {
  const gen = () => { let bag = []; return () => { if (!f) return rand() * 7 | 0; if (!bag.length) { bag = [0, 1, 2, 3, 4, 5, 6]; for (let i = 6; i > 0; i--) { const j = rand() * (i + 1) | 0; [bag[i], bag[j]] = [bag[j], bag[i]]; } } return bag.pop(); }; };
  const vis = gen(), sim = gen(), row = [], last = new Array(7).fill(-1), hist = new Array(24).fill(0);
  for (let i = 0; i < 16; i++) row.push(vis());
  let t = 0, slide = 0, idx = 0, cnt = 0, maxG = 0;
  return {
    step() {
      t++; if (t % 14 === 0) { row.push(vis()); row.shift(); slide = 1; } slide *= .78;
      if (cnt < 2e6) for (let i = 0; i < 100; i++) { const v = sim(); if (last[v] >= 0) { const gp = idx - last[v]; hist[Math.min(24, gp) - 1]++; cnt++; maxG = Math.max(maxG, gp); } last[v] = idx; idx++; }
    },
    draw(g) {
      row.forEach((v, i) => { const x = 8 + i * 14 + slide * 14; g.fillStyle = PIECE[v]; rr(g, x, 24, 12, 12, 2); g.fill(); label(g, 'IOTSZJL'[v], x + 6, 33.5, { size: 8.5, align: 'center', color: '#0b0e1a', mono: true }); });
      histPanel(g, hist, cnt, .2, i => i >= 13 ? COL.red : COL.cyan, [[0, '同じ形が来る間隔 1', 'left'], [6, '7'], [12, '13'], [23, '24+', 'right']]);
    },
    note: () => '最長 ' + maxG + '個あく'
  };
};
S.prd = ({ rand, f }) => {
  const C = 0.084744;
  const gen = () => { let N = 1; return () => { if (!f) return rand() < .25; const hit = rand() < C * N; N = hit ? 1 : N + 1; return hit; }; };
  const vis = gen(), sim = gen(), row = [], hist = new Array(16).fill(0);
  for (let i = 0; i < 40; i++) row.push(vis());
  let t = 0, k = 0, hits = 0, tot = 0, cnt = 0;
  return {
    step() {
      t++; if (t % 6 === 0) { row.push(vis()); row.shift(); }
      if (tot < 4e6) for (let i = 0; i < 200; i++) { k++; tot++; if (sim()) { hist[Math.min(16, k) - 1]++; cnt++; hits++; k = 0; } }
    },
    draw(g) {
      row.forEach((h, i) => { const x = 8 + i * 5.6; g.fillStyle = h ? COL.yellow : '#4a5270'; if (h) g.fillRect(x, 22, 4, 18); else g.fillRect(x, 34, 4, 6); });
      histPanel(g, hist, cnt, .3, COL.cyan, [[0, '会心の間隔 1', 'left'], [3, '4'], [7, '8'], [15, '16+', 'right']]);
    },
    note: () => '会心 ' + pct(hits / tot)
  };
};
S.twin = ({ rand, f }) => {
  const gen = () => { let a = -1, b = -1; return () => { let v = rand() < .5 ? 1 : 0; if (f && v === a && v === b) v = 1 - v; b = a; a = v; return v; }; };
  const vis = gen(), sim = gen(), row = [], hist = new Array(10).fill(0);
  for (let i = 0; i < 30; i++) row.push(vis());
  let t = 0, cur = -1, len = 0, cnt = 0, mx = 0;
  return {
    step() {
      t++; if (t % 8 === 0) { row.push(vis()); row.shift(); }
      if (cnt < 2e6) for (let i = 0; i < 200; i++) { const v = sim(); if (v === cur) len++; else { if (len) { hist[Math.min(10, len) - 1]++; cnt++; mx = Math.max(mx, len); } cur = v; len = 1; } }
    },
    draw(g) {
      let s = 0;
      for (let i = 1; i <= row.length; i++) if (i === row.length || row[i] !== row[s]) { if (i - s >= 3) { g.fillStyle = 'rgba(255,84,112,.35)'; rr(g, 8 + s * 7.4 - 1, 24, (i - s) * 7.4 - 1, 14, 4); g.fill(); } s = i; }
      row.forEach((v, i) => dot(g, 11.5 + i * 7.4, 31, 3, v ? COL.yellow : COL.blue));
      histPanel(g, hist, cnt, .6, i => i >= 2 ? COL.red : COL.cyan, [[0, '同じ面が続く回数 1', 'left'], [2, '3'], [5, '6'], [9, '10+', 'right']]);
    },
    note: () => '最長 ' + mx + '連続'
  };
};

const twoRN = card({
  s: 'fair', name: '見かけの確率（2つの乱数の平均）', tag: 'hit if (r1 + r2) / 2 < p',
  desc: '人は「90%なのに外れた」ことを強く覚えていて、表示より当たらないと感じがちです。そこで乱数を2つ引いて平均をとると、高い確率はより当たりやすく、低い確率はより当たりにくくなります（オレンジの曲線）。一部のシミュレーションRPGで知られる工夫です。',
  hint: 'つまみで表示の命中率を変える',
  sliders: () => [slider({ label: '表示の命中率', y: 16, min: 0, max: 100, v: 80, fmt: v => v + '%' })],
  init(st) { st.a = 0; st.b = 0; st.n = 0; },
  step(st) {
    if (st.n > 2e6) return;
    const p = st.sl[0].v / 100;
    for (let i = 0; i < 400; i++) { if (st.rand() < p) st.a++; if ((st.rand() + st.rand()) / 2 < p) st.b++; st.n++; }
  },
  draw(g, st) {
    bg(g);
    const x0 = 40, x1 = 226, y0 = 38, y1 = 196, X = v => x0 + v * (x1 - x0), Y = v => y1 - v * (y1 - y0), p = st.sl[0].v / 100;
    axes(g, x0, y0, x1, y1);
    for (const v of [.25, .5, .75]) { line(g, X(v), y0, X(v), y1, GRIDC); line(g, x0, Y(v), x1, Y(v), GRIDC); }
    poly(g, [[X(0), Y(0)], [X(1), Y(1)]], FAINT, 1.4, [4, 3]);
    const th = q => q <= .5 ? 2 * q * q : 1 - 2 * (1 - q) * (1 - q);
    const pts = []; for (let i = 0; i <= 50; i++) pts.push([X(i / 50), Y(th(i / 50))]); poly(g, pts, COL.accent, 2);
    line(g, X(p), y0, X(p), y1, 'rgba(255,255,255,.35)', 1, [2, 3]);
    if (st.n) { dot(g, X(p), Y(st.a / st.n), 4, COL.cyan, '#0d1122'); dot(g, X(p), Y(st.b / st.n), 4.5, COL.yellow, '#0d1122'); }
    small(g, '乱数1つ', X(.9), Y(.9) + 14, { align: 'center', color: COL.cyan });
    small(g, '2つの平均', X(.2), Y(th(.3)) - 10, { color: COL.accent });
    for (const v of [0, .5, 1]) { small(g, (v * 100) + '%', X(v), 209, { align: 'center', mono: true }); small(g, (v * 100) + '%', x0 - 4, Y(v) + 3, { align: 'right', mono: true }); }
    small(g, '実際', x0 - 4, y0 - 6, { align: 'right', color: COL.ink });
  },
  hud(st) { return st.n ? ['乱数1つ   ' + pct(st.a / st.n), '2つの平均 ' + pct(st.b / st.n)] : []; }
});

/* ======================================================================
   3. ガチャと報酬
   ====================================================================== */
const cumul = card({
  s: 'gacha', name: '1%は何回で出るか', tag: '1 − (1 − p)^n',
  desc: '1%のくじを当たるまで引く人を大勢試し、「n回までに当たった人の割合」を青い面で描きます。100回引いても約37%の人は出ません。半分の人が当たるのは約69回、99%の人が当たるには約460回かかります。',
  hint: 'つまみで当たる確率を変える',
  sliders: () => [slider({ label: '当たる確率', y: 16, min: .5, max: 10, step: .5, v: 1, fmt: v => v.toFixed(1) + '%' })],
  init(st) { const p = st.sl[0].v / 100; st.N = Math.ceil(Math.log(.005) / Math.log(1 - p)); st.h = new Array(st.N + 2).fill(0); st.n = 0; },
  step(st) { if (st.n >= 40000) return; const p = st.sl[0].v / 100; for (let i = 0; i < 60; i++) { st.h[Math.min(st.N + 1, geo(st.rand, p))]++; st.n++; } },
  draw(g, st) {
    bg(g);
    const p = st.sl[0].v / 100, N = st.N, x0 = 34, x1 = 226, y0 = 40, y1 = 198, X = n => x0 + n / N * (x1 - x0), Y = v => y1 - v * (y1 - y0);
    axes(g, x0, y0, x1, y1);
    if (st.n) { g.fillStyle = 'rgba(79,224,255,.3)'; g.beginPath(); g.moveTo(X(0), Y(0)); let c = 0; for (let n = 1; n <= N; n++) { c += st.h[n]; g.lineTo(X(n), Y(c / st.n)); } g.lineTo(X(N), Y(0)); g.fill(); }
    const pts = []; for (let i = 0; i <= 80; i++) { const n = i / 80 * N; pts.push([X(n), Y(1 - Math.pow(1 - p, n))]); } poly(g, pts, COL.accent, 1.8);
    for (const q of [.5, .9, .99]) {
      const n = Math.ceil(Math.log(1 - q) / Math.log(1 - p));
      line(g, x0, Y(q), X(n), Y(q), 'rgba(255,255,255,.3)', 1, [2, 3]); line(g, X(n), Y(q), X(n), y1, 'rgba(255,255,255,.3)', 1, [2, 3]);
      dot(g, X(n), Y(q), 2.6, '#fff');
      label(g, (q * 100) + '% → ' + n + '回', X(n) + 5, Y(q) + 12, { size: 9.5, mono: true, weight: 500, color: COL.ink, bg: 'rgba(13,17,34,.8)' });
      small(g, (q * 100) + '%', x0 - 4, Y(q) + 3, { align: 'right', mono: true });
    }
    const m = Math.round(1 / p); line(g, X(m), y0 + 30, X(m), y1, COL.red, 1, [3, 2]);
    small(g, '1/p = ' + m + '回', X(m) - 3, y1 - 6, { align: 'right', color: COL.red });
    small(g, '0', x0, 211, { align: 'center', mono: true }); small(g, N + '回', x1, 211, { align: 'right', mono: true });
  },
  hud(st) { const p = st.sl[0].v / 100, m = Math.round(1 / p); let c = 0; for (let n = 1; n <= m; n++) c += st.h[n]; return ['試した人 ' + num(st.n), m + '回引いても出ない人 ' + (st.n ? pct(1 - c / st.n) : '—')]; }
});

const pity = card({
  s: 'gacha', name: '天井つきガチャ', tag: 'p = 1% · 天井で確定',
  desc: '決まった回数まで外れ続けたら必ず当たりにする「天井」をつけます。右にはみ出していた長い裾が、天井の位置にまとめて立つ赤い柱に変わり、最悪でも何回で済むかが保証されます。平均回数も少し減ります。',
  hint: 'つまみで天井の回数を変える',
  sliders: () => [slider({ label: '天井', y: 16, min: 20, max: 300, step: 10, v: 100, fmt: v => v + '回' })],
  init(st) { st.h = new Array(30).fill(0); st.n = 0; st.sum = 0; st.top = 0; },
  step(st) {
    if (st.n > 2e6) return; const c = st.sl[0].v;
    for (let i = 0; i < 300; i++) { let m = geo(st.rand, .01); if (m >= c) { m = c; st.top++; } st.sum += m; st.h[Math.min(29, (m - 1) / 10 | 0)]++; st.n++; }
  },
  draw(g, st) {
    bg(g);
    const c = st.sl[0].v, x0 = 16, x1 = 228, y0 = 50, y1 = 196, bw = (x1 - x0) / 30, ci = Math.min(29, (c - 1) / 10 | 0), mx = .13;
    axes(g, x0, y0, x1, y1);
    bars(g, x0, y0, x1 - x0, y1 - y0, st.h.map(v => st.n ? v / st.n : 0), mx, i => i === ci ? COL.red : COL.cyan);
    const pts = []; for (let i = 0; i < 30; i++) pts.push([x0 + (i + .5) * bw, y1 - (Math.pow(.99, i * 10) - Math.pow(.99, i * 10 + 10)) / mx * (y1 - y0)]);
    poly(g, pts, FAINT, 1.2, [3, 3]);
    small(g, '天井なしの形', 226, y1 - 60, { align: 'right', color: FAINT });
    const share = st.n ? st.h[ci] / st.n : 0;
    if (share > mx) label(g, '↑ ' + pct(share, 0), x0 + (ci + .5) * bw, y0 - 2, { size: 10, align: ci > 24 ? 'right' : 'center', color: COL.red, mono: true, weight: 500 });
    for (const v of [1, 100, 200]) small(g, String(v), x0 + (v === 1 ? .5 : v / 10) * bw, 209, { align: 'center', mono: true });
    small(g, '300+', x1, 209, { align: 'right', mono: true });
  },
  hud(st) { return ['平均 ' + (st.n ? (st.sum / st.n).toFixed(1) : '—') + '回（天井なしは100回）', '天井まで行った人 ' + (st.n ? pct(st.top / st.n) : '—')]; }
});

const coupon = card({
  s: 'gacha', name: '全種類そろえるまで', tag: 'coupon collector · N × (1 + 1/2 + … + 1/N)',
  desc: 'N種類が同じ確率で出るとき、全部そろうまで何回かかるかを調べます。最初はどんどん増えますが、最後の1種類はなかなか出ません。20種類なら平均72回と、種類の数の3倍以上かかります。',
  hint: 'つまみで種類の数を変える',
  sliders: () => [slider({ label: '種類の数', y: 16, min: 5, max: 60, v: 20, fmt: v => v + '種' })],
  init(st) {
    const N = st.sl[0].v; let hN = 0; for (let i = 1; i <= N; i++) hN += 1 / i; st.E = N * hN; st.max = Math.ceil(st.E * 2.6);
    st.h = new Array(40).fill(0); st.n = 0; st.sum = 0; st.cur = new Array(N).fill(0); st.got = 0; st.draws = 0; st.flash = -1; st.hold = 0;
  },
  step(st) {
    const N = st.sl[0].v, r = st.rand;
    if (st.hold) { if (--st.hold === 0) { st.cur.fill(0); st.got = 0; st.draws = 0; } }
    else if (st.t % 2 === 0) { const v = r() * N | 0; st.draws++; if (!st.cur[v]) st.got++; st.cur[v]++; st.flash = v; if (st.got === N) st.hold = 60; }
    if (st.n > 4e5) return;
    for (let k = 0; k < 20; k++) { const seen = new Uint8Array(N); let got = 0, d = 0; while (got < N) { const v = r() * N | 0; d++; if (!seen[v]) { seen[v] = 1; got++; } } st.sum += d; st.n++; st.h[Math.min(39, d / st.max * 40 | 0)]++; }
  },
  draw(g, st) {
    bg(g);
    const N = st.sl[0].v, cs = 11.2;
    st.cur.forEach((c, i) => {
      const x = 8 + (i % 20) * cs, y = 32 + (i / 20 | 0) * cs;
      g.fillStyle = c ? `hsl(${i / N * 330},75%,${i === st.flash ? 80 : 60}%)` : '#222a45'; g.fillRect(x, y, cs - 2, cs - 2);
      if (c > 1) { g.fillStyle = 'rgba(11,14,26,.75)'; g.fillRect(x + 1, y + 1, Math.min(cs - 4, (c - 1) * 1.5), 2); }
    });
    const x0 = 8, x1 = 232, y0 = 104, y1 = 200;
    axes(g, x0, y0, x1, y1);
    const mh = Math.max(1, ...st.h);
    bars(g, x0, y0, x1 - x0, y1 - y0, st.h, mh * 1.1, COL.cyan);
    const ex = x0 + st.E / st.max * (x1 - x0); line(g, ex, y0 - 4, ex, y1, COL.accent, 1.4, [4, 3]);
    small(g, '平均 ' + st.E.toFixed(0) + '回', ex + 4, y0 + 6, { color: COL.accent });
    small(g, '全部そろうまでの回数', x1, y0 + 20, { align: 'right' });
    small(g, '0', x0, 213, { mono: true }); small(g, st.max + '回', x1, 213, { align: 'right', mono: true });
  },
  hud(st) { return ['いまの人 ' + st.draws + '回目 · ' + st.got + '/' + st.sl[0].v + '種', '試した人 ' + num(st.n) + ' · 平均 ' + (st.n ? (st.sum / st.n).toFixed(1) : '—') + '回']; }
});

const DROP = [['薬', COL.green], ['銅貨', COL.orange], ['剣', COL.cyan], ['盾', COL.blue], ['宝石', COL.pink]];
const weighted = card({
  s: 'gacha', name: '重みつき抽選', tag: 'r = rand × Σw → 累積で探す',
  desc: 'ドロップ品ごとに「重み」を決め、重みの合計に対する割合で選びます。確率を直接書くより、1つ足したり減らしたりしても合計を100%に合わせ直す必要がありません。白い線は実際に出た割合で、重みの棒の高さに寄っていきます。',
  hint: '下の棒を上下にドラッグして重みを変える',
  init(st) {
    if (!st.w) { st.w = [40, 30, 15, 10, 5]; st.ang = 0; st.res = -1; }
    st.c = [0, 0, 0, 0, 0]; st.n = 0; st.from = st.to = st.ang; st.sp = 1;
  },
  step(st) {
    const w = st.w, S = w.reduce((a, b) => a + b, 0), pick = () => { let r = st.rand() * S; for (let i = 0; i < 5; i++) if ((r -= w[i]) < 0) return i; return 4; };
    if (st.n < 3e6) for (let i = 0; i < 100; i++) { st.c[pick()]++; st.n++; }
    if (st.t % 60 === 0) {
      const i = pick(); let a0 = 0; for (let j = 0; j < i; j++) a0 += w[j];
      const a = (a0 + (.15 + .7 * st.rand()) * w[i]) / S * TAU; st.from = st.ang % TAU; let to = a; while (to < st.from + TAU * 2) to += TAU;
      st.to = to; st.ang = st.from; st.sp = 0; st.next = i;
    }
    if (st.sp < 1) { st.sp = Math.min(1, st.sp + 1 / 40); st.ang = lerp(st.from, st.to, ease.outCubic(st.sp)); if (st.sp >= 1) st.res = st.next; }
  },
  down(st, p) { this.drag(st, p); },
  drag(st, p) { if (p.y < 104) return; const i = clamp(Math.floor((p.x - 7) / 45), 0, 4), v = clamp(Math.round((200 - p.y) / 80 * 60), 1, 60); if (v !== st.w[i]) { st.w[i] = v; st.c = [0, 0, 0, 0, 0]; st.n = 0; } },
  draw(g, st) {
    bg(g);
    const w = st.w, S = w.reduce((a, b) => a + b, 0), cx = 58, cy = 56, R = 42;
    let a = -Math.PI / 2;
    w.forEach((v, i) => { const b = a + v / S * TAU; g.fillStyle = DROP[i][1]; g.globalAlpha = st.sp >= 1 && st.res === i ? 1 : .7; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a, b); g.closePath(); g.fill(); a = b; });
    g.globalAlpha = 1; g.strokeStyle = '#0d1122'; g.lineWidth = 1.5; a = -Math.PI / 2;
    w.forEach(v => { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); a += v / S * TAU; });
    const pa = st.ang - Math.PI / 2; line(g, cx, cy, cx + Math.cos(pa) * (R + 4), cy + Math.sin(pa) * (R + 4), '#fff', 2.5); dot(g, cx, cy, 4, '#fff');
    if (st.res >= 0 && st.sp >= 1) {
      label(g, DROP[st.res][0], 116, 44, { size: 20, color: DROP[st.res][1] });
      small(g, '重み ' + w[st.res] + ' / 合計 ' + S, 116, 64, { color: COL.ink, size: 10 });
      small(g, '→ ' + pct(w[st.res] / S) + ' で出る', 116, 79, { size: 10 });
    } else small(g, '抽選中…', 116, 44, { size: 11 });
    const by = 200, bh = 80 / 60;
    g.fillStyle = AXIS; g.fillRect(6, by, 228, 1);
    w.forEach((v, i) => {
      const x = 14 + i * 45, h = v * bh;
      g.fillStyle = DROP[i][1]; g.globalAlpha = .85; g.fillRect(x, by - h, 30, h); g.globalAlpha = 1;
      if (st.n) { const oy = by - st.c[i] / st.n * S * bh; line(g, x - 4, oy, x + 34, oy, '#fff', 2); }
      label(g, pct(v / S, 0), x + 15, by - h - 6, { size: 10, mono: true, align: 'center', weight: 500 });
      label(g, DROP[i][0], x + 15, by + 14, { size: 10.5, align: 'center', color: COL.ink });
    });
  },
  hud(st) { return ['抽選 ' + num(st.n) + '回']; }
});

S.box = ({ rand, f }) => {
  const hist = new Array(30).fill(0); let cnt = 0;
  let cells, prize, drawn, flash, hold, left;
  const refill = () => { cells = new Uint8Array(100); prize = rand() * 100 | 0; drawn = 0; flash = -1; hold = 0; left = 100; };
  refill(); let t = 0;
  return {
    step() {
      t++;
      if (hold) { if (--hold === 0) refill(); }
      else if (t % 3 === 0) {
        let i; if (f) { do i = rand() * 100 | 0; while (cells[i]); cells[i] = 1; left--; } else i = rand() * 100 | 0;
        drawn++; flash = i; if (i === prize) hold = 50;
      }
      if (cnt < 2e6) for (let k = 0; k < 300; k++) { const m = f ? 1 + (rand() * 100 | 0) : geo(rand, .01); hist[Math.min(29, (m - 1) / 10 | 0)]++; cnt++; }
    },
    draw(g) {
      for (let i = 0; i < 100; i++) { const x = 13 + (i % 10) * 6.4, y = 30 + (i / 10 | 0) * 6.4; const col = i === flash ? '#fff' : i === prize ? COL.yellow : cells[i] ? '#1e2440' : '#5a6488'; dot(g, x, y, i === prize ? 2.9 : 2.3, col); }
      small(g, hold ? '当たり！ ' + drawn + '回目' : '引いた ' + drawn + '回', 10, 106, { color: hold ? COL.yellow : COL.ink });
      const x0 = 84, x1 = 232, y0 = 26, y1 = 96;
      g.fillStyle = AXIS; g.fillRect(x0, y1, x1 - x0, 1);
      bars(g, x0, y0, x1 - x0, y1 - y0, hist.map(c => cnt ? c / cnt : 0), .12, f ? COL.cyan : COL.cyan);
      const bw = (x1 - x0) / 30;
      small(g, '1', x0 + bw / 2, 108, { align: 'center', mono: true }); small(g, '100', x0 + 10 * bw, 108, { align: 'center', mono: true }); small(g, '300+', x1, 108, { align: 'right', mono: true });
      small(g, '当たるまでの回数', x1, 120, { align: 'right', size: 9 });
    },
    note: () => '次に当たる ' + (f ? (hold ? '—' : '1/' + left + ' = ' + pct(1 / left)) : '1.0%')
  };
};

/* ======================================================================
   4. 数値の曲線
   ====================================================================== */
const XPC = [['1次（線形）', COL.cyan, t => 1 + t / (.25 / 9)], ['2乗', COL.yellow, t => 1 + Math.sqrt(t / (.25 / 81))], ['指数 ×1.3', COL.red, t => 1 + Math.log(t / (.25 / (Math.pow(1.3, 9) - 1)) + 1) / Math.log(1.3)]];
const xp = card({
  s: 'curve', name: '経験値カーブ', tag: '必要経験値 ∝ L / L² / 1.3^L',
  desc: '同じペースで経験値をかせいだとき、レベルがどう上がるかを3種類の式で比べます。どれもレベル10までは同じ時間になるよう合わせています。1次は上がり続け、2乗はゆるやかに、指数は後半ほとんど上がらなくなります。',
  reseed: false,
  init() {},
  step(st) { if (st.t > 540) st.t = 0; },
  draw(g, st) {
    bg(g);
    const u = Math.min(1, st.t / 420), x0 = 30, x1 = 226, y0 = 34, y1 = 200, X = t => x0 + t * (x1 - x0), Y = L => y1 - (L - 1) / 39 * (y1 - y0);
    axes(g, x0, y0, x1, y1);
    for (const L of [10, 20, 30, 40]) { line(g, x0, Y(L), x1, Y(L), GRIDC); small(g, String(L), x0 - 4, Y(L) + 3, { align: 'right', mono: true }); }
    small(g, 'Lv', x0 - 4, y0 - 8, { align: 'right', color: COL.ink });
    line(g, X(.25), Y(10), X(.25), y1, 'rgba(255,255,255,.3)', 1, [2, 3]);
    small(g, 'ここまで同じ', X(.25) + 3, y1 - 5, { size: 9 });
    XPC.forEach(([name, col, f], k) => {
      const lv = t => Math.min(40, Math.floor(f(t) + 1e-9));
      const full = [], now = []; for (let i = 0; i <= 200; i++) { const t = i / 200, p = [X(t), Y(lv(t))]; full.push(p); if (t <= u) now.push(p); }
      g.globalAlpha = .22; poly(g, full, col, 1.2); g.globalAlpha = 1; poly(g, now, col, 2);
      const L = lv(u); dot(g, X(u), Y(L), 3.5, col, '#0d1122');
      label(g, 'Lv' + L, Math.min(X(u) + 6, 200), Y(L) + (k === 2 ? 12 : -4), { size: 10, mono: true, color: col, weight: 500 });
      g.fillStyle = col; g.fillRect(38, 42 + k * 15, 10, 3); small(g, name, 52, 46 + k * 15, { color: COL.ink });
    });
    small(g, 'プレイ時間 →', x1, 214, { align: 'right' });
  },
  hud(st) { return ['プレイ時間 ' + pct(Math.min(1, st.t / 420), 0)]; }
});

const dmg = card({
  s: 'curve', name: 'ダメージ計算式', tag: '攻 − 防  vs  攻 × 100 / (100 + 防)',
  desc: '引き算式は分かりやすい反面、防御力が攻撃力に近づくと急に1ダメージしか通らなくなります。割り算式は防御を上げるほど効き目が少しずつ弱まり、0にはなりません。つまみを動かして、2本の線がどこで分かれるかを見てください。',
  hint: 'つまみで攻撃力と防御力を変える', reseed: false,
  sliders: () => [slider({ label: '攻撃力', y: 16, min: 20, max: 200, step: 5, v: 100 }), slider({ label: '防御力', y: 36, min: 0, max: 200, step: 5, v: 60 })],
  init() {}, change() {},
  draw(g, st) {
    bg(g);
    const A = st.sl[0].v, D = st.sl[1].v, x0 = 30, x1 = 226, y0 = 58, y1 = 200, X = d => x0 + d / 200 * (x1 - x0), Y = v => y1 - v / 200 * (y1 - y0);
    axes(g, x0, y0, x1, y1);
    for (const v of [50, 100, 150, 200]) { line(g, x0, Y(v), x1, Y(v), GRIDC); small(g, String(v), x0 - 4, Y(v) + 3, { align: 'right', mono: true }); }
    const sub = d => Math.max(1, A - d), div = d => A * 100 / (100 + d);
    const p1 = [], p2 = []; for (let d = 0; d <= 200; d += 2) { p1.push([X(d), Y(sub(d))]); p2.push([X(d), Y(div(d))]); }
    poly(g, p1, COL.cyan, 2); poly(g, p2, COL.accent, 2);
    line(g, X(D), y0, X(D), y1, 'rgba(255,255,255,.35)', 1, [2, 3]);
    dot(g, X(D), Y(sub(D)), 4, COL.cyan, '#0d1122'); dot(g, X(D), Y(div(D)), 4, COL.accent, '#0d1122');
    small(g, '引き算', 222, 70, { align: 'right', color: COL.cyan, size: 10 }); small(g, '割り算', 222, 84, { align: 'right', color: COL.accent, size: 10 });
    small(g, 'ダメージ', x0 + 4, y0 + 2, { color: COL.ink });
    small(g, '0', x0, 212, { align: 'center', mono: true }); small(g, '防御力 200', x1, 212, { align: 'right' });
  },
  hud(st) { const A = st.sl[0].v, D = st.sl[1].v; return ['引き算 ' + Math.max(1, A - D) + ' · 割り算 ' + Math.round(A * 100 / (100 + D))]; }
});

function heatColor(t) {
  const S = [[0, [16, 24, 60]], [.35, [70, 60, 150]], [.65, [200, 80, 120]], [.85, [255, 160, 70]], [1, [255, 228, 140]]];
  for (let i = 1; i < S.length; i++) if (t <= S[i][0]) { const k = (t - S[i - 1][0]) / (S[i][0] - S[i - 1][0]); return S[i - 1][1].map((a, j) => a + (S[i][1][j] - a) * k); }
  return S[S.length - 1][1];
}
let critImg = null;
function critHeat() {
  if (critImg) return critImg;
  const n = 64, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), im = g.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = (x + .5) / n, m = 1 + 2 * (1 - (y + .5) / n), E = 1 + r * (m - 1), [R, G, B] = heatColor((E - 1) / 2), o = (y * n + x) * 4; im.data[o] = R * .8; im.data[o + 1] = G * .8; im.data[o + 2] = B * .8; im.data[o + 3] = 255; }
  g.putImageData(im, 0, 0); return (critImg = c);
}
const crit = card({
  s: 'curve', name: '会心率とダメージの期待値', tag: 'E = 1 + 会心率 × (倍率 − 1)',
  desc: '横が会心率、縦が会心のときの倍率で、色が明るいほど1回あたりの平均ダメージ（期待値）が大きくなります。白い線の上はどこも同じ期待値で、「めったに出ないが強い会心」と「よく出るが弱い会心」が同じ強さになることが分かります。',
  hint: 'グラフの中をドラッグして会心率と倍率を変える',
  init(st) { if (st.r === undefined) { st.r = .25; st.m = 2; } st.sum = 0; st.n = 0; },
  step(st) { if (st.n > 4e6) return; for (let i = 0; i < 500; i++) { st.sum += st.rand() < st.r ? st.m : 1; st.n++; } },
  down(st, p) { this.drag(st, p); },
  drag(st, p) { const r = clamp((p.x - 34) / 192, 0, 1), m = clamp(1 + 2 * (196 - p.y) / 168, 1, 3); st.r = Math.round(r * 100) / 100; st.m = Math.round(m * 10) / 10; st.sum = 0; st.n = 0; },
  draw(g, st) {
    bg(g);
    const x0 = 34, x1 = 226, y0 = 28, y1 = 196, X = r => x0 + r * (x1 - x0), Y = m => y1 - (m - 1) / 2 * (y1 - y0);
    g.imageSmoothingEnabled = true; g.drawImage(critHeat(), x0, y0, x1 - x0, y1 - y0);
    for (const E of [1.25, 1.5, 2, 2.5]) {
      const pts = []; for (let i = 0; i <= 40; i++) { const r = (E - 1) / 2 + i / 40 * (1 - (E - 1) / 2); pts.push([X(r), Y(1 + (E - 1) / r)]); }
      poly(g, pts, 'rgba(255,255,255,.55)', 1);
      label(g, '×' + E, x1 - 3, Y(E) - 3, { size: 9.5, align: 'right', mono: true, weight: 500, color: '#fff' });
    }
    axes(g, x0, y0, x1, y1);
    const px = X(st.r), py = Y(st.m); line(g, px, py, px, y1, 'rgba(255,255,255,.4)', 1, [2, 2]); line(g, x0, py, px, py, 'rgba(255,255,255,.4)', 1, [2, 2]);
    dot(g, px, py, 5.5, '#fff', '#0d1122');
    small(g, '明るいほど平均ダメージが大きい', 8, 17, { color: COL.ink });
    for (const [r, s] of [[0, '0%'], [.5, '50%'], [1, '100%']]) small(g, s, X(r), 208, { align: r === 1 ? 'right' : 'center', mono: true });
    small(g, '会心率', 120, 220, { align: 'center' });
    for (const m of [1, 2, 3]) small(g, '×' + m, x0 - 4, Y(m) + 3, { align: 'right', mono: true });
  },
  hud(st) { return ['会心率 ' + pct(st.r, 0) + ' · 倍率 ×' + st.m.toFixed(1), '期待値 ×' + (1 + st.r * (st.m - 1)).toFixed(3) + ' · 実測 ×' + (st.n ? (st.sum / st.n).toFixed(3) : '—')]; }
});

const dimin = card({
  s: 'curve', name: '収穫逓減', tag: '軽減率 = 防 / (防 + 100)',
  desc: '防御力をそのまま「軽減率」にすると、400で100%になり無敵になってしまいます（点線）。防 /(防 + 100) の式にすると、積むほど1回あたりの伸びが小さくなり、決して100%に届きません。下の棒は、防御を40足すごとに増えた量です。',
  reseed: false,
  init() {},
  step(st) { if (st.t > 420) st.t = 0; },
  draw(g, st) {
    bg(g);
    const k = Math.min(10, Math.floor(st.t / 30)), x0 = 34, x1 = 226, y0 = 30, y1 = 146, X = s => x0 + s / 400 * (x1 - x0), Y = v => y1 - v * (y1 - y0), f = s => s / (s + 100);
    axes(g, x0, y0, x1, y1);
    for (const v of [.25, .5, .75, 1]) { line(g, x0, Y(v), x1, Y(v), GRIDC); small(g, (v * 100) + '%', x0 - 4, Y(v) + 3, { align: 'right', mono: true }); }
    poly(g, [[X(0), Y(0)], [X(400), Y(1)]], FAINT, 1.2, [4, 3]);
    small(g, 'そのまま足すと無敵', X(280) - 6, Y(.7) - 4, { align: 'right', color: FAINT });
    const pts = []; for (let s = 0; s <= 400; s += 5) pts.push([X(s), Y(f(s))]); poly(g, pts, COL.accent, 2);
    for (let i = 1; i <= k; i++) { const a = (i - 1) * 40, b = i * 40; line(g, X(a), Y(f(a)), X(b), Y(f(a)), 'rgba(79,224,255,.6)', 1); line(g, X(b), Y(f(a)), X(b), Y(f(b)), COL.cyan, 2); }
    dot(g, X(k * 40), Y(f(k * 40)), 4, '#fff', '#0d1122');
    small(g, '防御力 400', x1, 159, { align: 'right' }); small(g, '0', x0, 159, { align: 'center', mono: true });
    const by = 214, bw = (x1 - x0) / 10;
    g.fillStyle = AXIS; g.fillRect(x0, by, x1 - x0, 1);
    small(g, '+40ごとの伸び', 8, 172, { color: COL.ink });
    for (let i = 1; i <= k; i++) { const d = f(i * 40) - f((i - 1) * 40), h = d / .3 * 40; g.fillStyle = COL.cyan; g.fillRect(x0 + (i - 1) * bw + 2, by - h, bw - 4, h); label(g, '+' + (d * 100).toFixed(0), x0 + (i - .5) * bw, by - h - 3, { size: 9, align: 'center', mono: true, color: COL.ink, weight: 500 }); }
  },
  hud(st) { const k = Math.min(10, Math.floor(st.t / 30)); return ['防御力 ' + k * 40 + ' → 軽減 ' + pct(k * 40 / (k * 40 + 100))]; }
});

/* ======================================================================
   5. 勝負のバランス
   ====================================================================== */
S.rubber = ({ rand, f }) => {
  const VA = 1 / 200, VB = VA * .955;
  const adv = (s) => { let va = VA * (1 + (rand() - .5) * 1.4), vb = VB * (1 + (rand() - .5) * 1.4); if (f) { const gp = s.a - s.b; if (gp > 0) { vb *= 1 + 9 * gp; va *= 1 - 3 * gp; } else { va *= 1 - 9 * gp; vb *= 1 + 3 * gp; } } s.a += va; s.b += vb; };
  let R = { a: 0, b: 0 }, gaps = [], hold = 0, races = 0, bw = 0, lastWin = '';
  return {
    step() {
      if (hold) { if (--hold === 0) { R = { a: 0, b: 0 }; gaps = []; } }
      else { adv(R); gaps.push(R.a - R.b); if (R.a >= 1 || R.b >= 1) { hold = 60; lastWin = R.a >= R.b ? 'a' : 'b'; } }
      if (races < 2e5) for (let k = 0; k < 12; k++) { const s = { a: 0, b: 0 }; while (s.a < 1 && s.b < 1) adv(s); races++; if (s.b > s.a) bw++; }
    },
    draw(g) {
      for (const [y, c, p, who] of [[32, COL.orange, R.a, 'a'], [50, COL.cyan, R.b, 'b']]) {
        line(g, 10, y + 5, 222, y + 5, '#2a3252', 1);
        const x = 10 + Math.min(1, p) * 206; g.fillStyle = c; rr(g, x - 6, y - 2, 14, 7, 2.5); g.fill();
        if (hold && lastWin === who) small(g, '勝ち', x - 8, y + 4, { align: 'right', color: c });
      }
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : '#333'; g.fillRect(224, 26 + i * 5, 3, 5); g.fillStyle = i % 2 ? '#333' : '#fff'; g.fillRect(227, 26 + i * 5, 3, 5); }
      const cy = 90; line(g, 10, cy, 230, cy, AXIS, 1);
      small(g, '差（上：速い車がリード）', 12, 72, { size: 9 });
      poly(g, gaps.map((d, i) => [10 + i / 230 * 220, cy - clamp(d * 220, -26, 26)]), COL.accent, 1.4);
    },
    note: () => '遅い車の勝率 ' + (races ? pct(bw / races, 0) : '—')
  };
};

const RPS_C = [[255, 84, 112], [255, 216, 77], [91, 140, 255]];
const rps = card({
  s: 'match', name: '3すくみ', tag: 'グー > チョキ > パー > グー',
  desc: 'グー・チョキ・パーの3種類が、隣にいる負ける相手を自分の色に塗り替えていきます。どれかが増えると、それに勝つ種類が増えて押し返すので、3色がうず巻きのように追いかけ合い、どれも消えずに回り続けます。',
  hint: 'クリックでその場所に1種類をまとめて置く',
  init(st) {
    const n = st.n = 80, m = st.m = 66; st.a = new Uint8Array(n * m); for (let i = 0; i < n * m; i++) st.a[i] = st.rand() * 3 | 0;
    st.c = document.createElement('canvas'); st.c.width = n; st.c.height = m; st.cg = st.c.getContext('2d'); st.im = st.cg.createImageData(n, m); st.hist = []; st.kind = 0;
  },
  step(st) {
    const { n, m, a, rand } = st;
    for (let k = 0; k < 9000; k++) {
      const i = rand() * n * m | 0, x = i % n, y = i / n | 0, d = rand() * 4 | 0;
      const j = d === 0 ? y * n + (x + 1) % n : d === 1 ? y * n + (x + n - 1) % n : d === 2 ? ((y + 1) % m) * n + x : ((y + m - 1) % m) * n + x;
      if (a[i] === (a[j] + 1) % 3) a[i] = a[j];
    }
    if (st.t % 2 === 0) { const c = [0, 0, 0]; for (let i = 0; i < n * m; i++) c[a[i]]++; st.hist.push(c.map(v => v / (n * m))); if (st.hist.length > 220) st.hist.shift(); }
  },
  down(st, p) { const cx = p.x / 3 | 0, cy = p.y / 3 | 0; if (cy >= st.m) return; for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) if (x * x + y * y <= 49) { const X = (cx + x + st.n) % st.n, Y = (cy + y + st.m) % st.m; st.a[Y * st.n + X] = st.kind; } st.kind = (st.kind + 1) % 3; },
  draw(g, st) {
    bg(g);
    const { a, im } = st; for (let i = 0; i < a.length; i++) { const c = RPS_C[a[i]]; im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255; }
    st.cg.putImageData(im, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(st.c, 0, 0, 240, 198); g.imageSmoothingEnabled = true;
    const y0 = 206, y1 = 252, hh = y1 - y0;
    for (let i = 0; i < st.hist.length; i++) { let acc = 0; for (let k = 0; k < 3; k++) { const v = st.hist[i][k]; g.fillStyle = `rgb(${RPS_C[k]})`; g.fillRect(10 + i, y0 + acc * hh, 1.2, v * hh + .5); acc += v; } }
    const h = st.hist[st.hist.length - 1];
    if (h) label(g, 'グー ' + pct(h[0], 0) + '  チョキ ' + pct(h[1], 0) + '  パー ' + pct(h[2], 0), 6, 16, { size: 10, bg: 'rgba(11,14,26,.8)', weight: 500 });
  }
});

const luck = card({
  s: 'match', name: '運と実力の割合', tag: 'score = (1 − 運) × 実力 + 運 × rand',
  desc: '実力が少し上の人と下の人が何度も対戦します。結果が実力だけで決まるなら強い人が必ず勝ち、運だけなら五分五分です。運の割合を少し入れるだけで、弱い側にも勝つチャンスが生まれ、何度も遊びたくなる勝負になります。',
  hint: 'つまみで運の割合を変える',
  sliders: () => [slider({ label: '運の割合', y: 16, min: 0, max: 100, v: 50, fmt: v => v + '%' })],
  init(st) { st.w = 0; st.n = 0; st.row = []; },
  step(st) {
    const L = st.sl[0].v / 100, play = () => (1 - L) * .6 + L * st.rand() > (1 - L) * .4 + L * st.rand();
    if (st.n < 3e6) for (let i = 0; i < 300; i++) { if (play()) st.w++; st.n++; }
    if (st.t % 5 === 0) { st.row.push(play()); if (st.row.length > 44) st.row.shift(); }
  },
  draw(g, st) {
    bg(g);
    const L = st.sl[0].v / 100, x0 = 38, x1 = 226, y0 = 38, y1 = 170, X = l => x0 + l * (x1 - x0), Y = v => y1 - (v - .4) / .6 * (y1 - y0);
    const th = l => { if (l <= 0) return 1; const k = (1 - l) * .2 / l; return k >= 1 ? 1 : 1 - (1 - k) * (1 - k) / 2; };
    axes(g, x0, y0, x1, y1);
    for (const v of [.5, .75, 1]) { line(g, x0, Y(v), x1, Y(v), GRIDC); small(g, (v * 100) + '%', x0 - 4, Y(v) + 3, { align: 'right', mono: true }); }
    const pts = []; for (let i = 0; i <= 100; i++) pts.push([X(i / 100), Y(th(i / 100))]); poly(g, pts, COL.accent, 2);
    line(g, X(L), y0, X(L), y1, 'rgba(255,255,255,.35)', 1, [2, 3]);
    if (st.n) dot(g, X(L), Y(st.w / st.n), 4.5, COL.yellow, '#0d1122');
    small(g, '強い人の勝率', x0 + 4, y0 + 10, { color: COL.ink });
    small(g, '実力だけ', x0, 182, { align: 'left' }); small(g, '運だけ', x1, 182, { align: 'right' });
    small(g, '最近の対戦', 8, 200, { color: COL.ink });
    st.row.forEach((w, i) => { g.fillStyle = w ? COL.orange : COL.cyan; g.fillRect(66 + i * 3.7, w ? 190 : 196, 2.8, 6); });
    small(g, '強い人の勝ち', 232, 187, { align: 'right', size: 8.5, color: COL.orange }); small(g, '弱い人の勝ち', 232, 211, { align: 'right', size: 8.5, color: COL.cyan });
  },
  hud(st) { const L = st.sl[0].v / 100; const k = L <= 0 ? 9 : (1 - L) * .2 / L; return ['計算 ' + pct(k >= 1 ? 1 : 1 - (1 - k) * (1 - k) / 2) + ' · 実測 ' + (st.n ? pct(st.w / st.n) : '—')]; }
});

const ELO_C = [COL.red, COL.orange, COL.yellow, COL.green, COL.cyan, COL.blue, COL.purple, COL.pink];
const elo = card({
  s: 'match', name: 'Eloレーティング', tag: 'R += K × (結果 − 予想勝率)',
  desc: '8人の本当の強さ（右端の目盛り）は隠れていて、全員1500から始めて対戦をくり返します。勝てば予想より上ぶれした分だけ増え、負ければ減ります。K を大きくすると早く本当の強さに近づきますが、落ち着いた後もふらつきが大きくなります。',
  hint: 'つまみで K（1試合で動く大きさ）を変える',
  sliders: () => [slider({ label: 'K', y: 16, min: 4, max: 64, step: 2, v: 24 })],
  init(st) { st.T = ELO_C.map((_, i) => 1500 + (i - 3.5) * 110); st.R = st.T.map(() => 1500); st.H = [st.R.slice()]; st.games = 0; },
  step(st) {
    const K = st.sl[0].v, r = st.rand;
    for (let k = 0; k < 3; k++) {
      const i = r() * 8 | 0; let j = r() * 7 | 0; if (j >= i) j++;
      const pT = 1 / (1 + Math.pow(10, (st.T[j] - st.T[i]) / 400)), s = r() < pT ? 1 : 0, pE = 1 / (1 + Math.pow(10, (st.R[j] - st.R[i]) / 400));
      st.R[i] += K * (s - pE); st.R[j] -= K * (s - pE); st.games++;
    }
    st.H.push(st.R.slice()); if (st.H.length > 400) st.H.shift();
  },
  draw(g, st) {
    bg(g);
    const x0 = 36, x1 = 218, y0 = 34, y1 = 204, Y = v => y1 - (v - 1000) / 1000 * (y1 - y0), n = st.H.length;
    axes(g, x0, y0, x1, y1);
    for (const v of [1000, 1500, 2000]) { line(g, x0, Y(v), x1, Y(v), GRIDC); small(g, String(v), x0 - 4, Y(v) + 3, { align: 'right', mono: true }); }
    ELO_C.forEach((c, k) => {
      const pts = []; for (let i = 0; i < n; i++) pts.push([x0 + i / 399 * (x1 - x0), Y(st.H[i][k])]); poly(g, pts, c, 1.3);
      g.fillStyle = c; g.fillRect(x1 + 4, Y(st.T[k]) - 1, 10, 2.5);
    });
    small(g, '本当の強さ', x1 + 14, y0 - 8, { align: 'right', size: 9 });
    small(g, '試合 →', x1, 216, { align: 'right' });
  },
  hud(st) { let d = 0; for (let i = 0; i < 8; i++) d += Math.abs(st.R[i] - st.T[i]); return ['試合 ' + num(st.games) + ' · 本当の強さとのずれ 平均 ±' + (d / 8).toFixed(0)]; }
});

/* ---------- catalogue ---------- */
const SECTIONS = [
  { id: 'rand', en: 'Randomness', title: '乱数の性質', lead: 'ゲームの「運」はすべて乱数から作られます。まずは乱数そのものが、少ない回数と多い回数でどう見え方が変わるかを確かめます。' },
  { id: 'fair', en: 'Taming luck', title: '偏りを抑える工夫', lead: '本当にランダムだと、同じものが続いたり長く出なかったりして「不公平だ」と感じられます。平均の確率は変えずに、偏りだけを抑える工夫です。上下に分かれたカードは、上が完全ランダム、下が工夫ありで、同時に動いています。' },
  { id: 'gacha', en: 'Gacha & rewards', title: 'ガチャと報酬', lead: '当たるまで引く、全種類を集める、といった遊びで、実際に何回かかるのかを大勢の分だけ試して描きます。' },
  { id: 'curve', en: 'Number curves', title: '数値の曲線', lead: 'レベルやダメージの式は、数字が大きくなったときにどうふるまうかが大切です。式の形を変えると、ゲームの後半の感触が変わります。' },
  { id: 'match', en: 'Competitive balance', title: '勝負のバランス', lead: '強い人が勝ちすぎず、弱い人にもチャンスがある。対戦やレースの面白さを保つための仕組みです。' }
];

const ITEMS = [
  uniform, dice, streak, seedCard, lln,

  pair({ s: 'fair', name: 'シャッフルバッグ', tag: '7種を袋に入れて順に取り出す', scen: S.bag, labels: ['完全ランダム', '7種1巡の袋'],
    desc: '落ちものパズルの7種類のブロックを、毎回ランダムに選ぶ（上）か、7種を袋に入れて混ぜ、空になるまで順に取り出す（下）かで比べます。袋なら同じ形は最大でも13個あけば必ず来ます。グラフは同じ形が次に来るまでの間隔です。' }),
  pair({ s: 'fair', name: '外れるほど上がる確率（PRD）', tag: 'P(N) = C × N · C ≈ 0.085', scen: S.prd, labels: ['毎回 25%', 'PRD（平均 25%）'],
    desc: '会心率25%を、毎回25%で判定する（上）か、外れるたびに確率を少しずつ上げ、出たら戻す（下）かで比べます。全体の会心率は同じ25%のままですが、下は連続で出たり長く出なかったりすることが減ります。一部の対戦ゲームで使われる方式です。' }),
  pair({ s: 'fair', name: '同じ結果の3連続を防ぐ', tag: 'if last 2 same → flip', scen: S.twin, labels: ['完全ランダム', '3連続を禁止'],
    desc: '表と裏が半々のコインで、直前2回と同じ結果が出そうなときだけ反対にします（下）。赤い帯は3回以上続いた部分です。表と裏の割合は半々のまま、「また同じ」というがっかりをなくせます。' }),
  twoRN,

  cumul, pity, coupon, weighted,
  pair({ s: 'gacha', name: 'ボックスガチャ', tag: '100個の箱から戻さずに引く', scen: S.box, labels: ['普通 1%', 'ボックス 100個'],
    desc: '当たり1個を含む100個の玉を、毎回戻して引く（上）か、引いた玉を戻さない箱から引く（下）かで比べます。箱なら引くたびに当たりの確率が上がり、最悪でも100回で必ず当たります。右は当たるまでの回数の分布です。' }),

  xp, dmg, crit, dimin,

  pair({ s: 'match', name: 'ラバーバンド', tag: '遅れた側を加速 · 先頭を減速', scen: S.rubber, labels: ['なし', 'あり'],
    desc: '少しだけ速いオレンジの車と、遅い青い車のレースです。「なし」では差が開くと二度と縮まず、遅い車はほとんど勝てません。「あり」は離されるほど後ろの車を速く、前の車を遅くして、ゴムでつないだように接戦を保ちます。レースゲームの定番の調整です。' }),
  rps, luck, elo
];

run({ sections: SECTIONS, items: ITEMS, W, H, minCol: 300 });
})();
