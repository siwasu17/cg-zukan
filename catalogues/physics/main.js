/* 物理シミュレーション図鑑 — card definitions. Runtime: assets/js/g2d.js */
(function () {
const { rng, clamp, lerp, COL, label, run, series } = G2D;
const W = 240, H = 240, TAU = Math.PI * 2;

function bg(g) { g.fillStyle = '#0d1122'; g.fillRect(0, 0, W, H); }
function floorAt(g, y) { g.fillStyle = '#1d2338'; g.fillRect(0, y, W, H - y); g.fillStyle = '#3b4870'; g.fillRect(0, y, W, 2); }
function ball(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x - r * .35, y - r * .35, r * .3, 0, TAU); g.fill(); }
function tag(g, t, x, y, o = {}) { label(g, t, x, y, Object.assign({ size: 10, color: COL.muted, weight: 500 }, o)); }

/* ---------- verlet engine ---------- */
class Verlet {
  constructor(o = {}) { this.P = []; this.C = []; this.g = o.g !== undefined ? o.g : .25; this.iters = o.iters || 8; this.damp = o.damp || .995; this.floor = o.floor !== undefined ? o.floor : 228; this.fric = o.fric || .9; this.grab = null; this.tear = o.tear || 0; this.solids = o.solids || []; }
  pt(x, y, pin = false, r = 2) { const p = { x, y, px: x, py: y, pin, r, fx: 0, fy: 0 }; this.P.push(p); return p; }
  st(a, b, k = 1, len) { const c = { a, b, len: len !== undefined ? len : Math.hypot(a.x - b.x, a.y - b.y), k }; this.C.push(c); return c; }
  step() {
    for (const p of this.P) { if (p.pin || p === this.grab?.p) continue; const vx = (p.x - p.px) * this.damp, vy = (p.y - p.py) * this.damp; p.px = p.x; p.py = p.y; p.x += vx + p.fx; p.y += vy + this.g + p.fy; p.fx = p.fy = 0; }
    if (this.grab) { const p = this.grab.p; p.px = p.x; p.py = p.y; p.x = this.grab.x; p.y = this.grab.y; }
    for (let it = 0; it < this.iters; it++) {
      for (let i = this.C.length - 1; i >= 0; i--) { const c = this.C[i], dx = c.b.x - c.a.x, dy = c.b.y - c.a.y, d = Math.hypot(dx, dy) || 1e-6;
        if (this.tear && d > c.len * this.tear) { this.C.splice(i, 1); continue; }
        const diff = (d - c.len) / d * c.k, wa = c.a.pin || c.a === this.grab?.p ? 0 : 1, wb = c.b.pin || c.b === this.grab?.p ? 0 : 1, ws = wa + wb; if (!ws) continue;
        c.a.x += dx * diff * wa / ws; c.a.y += dy * diff * wa / ws; c.b.x -= dx * diff * wb / ws; c.b.y -= dy * diff * wb / ws; }
      for (const p of this.P) this.collide(p);
    }
  }
  collide(p) {
    if (p.pin) return;
    if (p.y > this.floor - p.r) { p.y = this.floor - p.r; const vx = p.x - p.px; p.px = p.x - vx * this.fric; }
    if (p.x < p.r) p.x = p.r; if (p.x > W - p.r) p.x = W - p.r;
    for (const [x, y, w, h] of this.solids) { if (p.x > x - p.r && p.x < x + w + p.r && p.y > y - p.r && p.y < y + h + p.r) {
      const dl = p.x - (x - p.r), dr = x + w + p.r - p.x, du = p.y - (y - p.r), dd = y + h + p.r - p.y, m = Math.min(dl, dr, du, dd);
      if (m === du) { p.y = y - p.r; const vx = p.x - p.px; p.px = p.x - vx * this.fric; } else if (m === dd) p.y = y + h + p.r; else if (m === dl) p.x = x - p.r; else p.x = x + w + p.r; } }
  }
  nearest(x, y, r = 22) { let b = null, bd = r; for (const p of this.P) { if (p.pin) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; b = p; } } return b; }
}
function verletCard(o) {
  return { s: o.s, name: o.name, tag: o.tag, desc: o.desc, hint: o.hint || 'つかんで引っぱれる', interactive: true, capture: true, cursor: 'grab', warm: o.warm || 0,
    make: (env) => { const st = { t: 0, rand: env.rand }; o.init(st);
      return {
        step() { if (o.step) o.step(st); for (const v of st.V) v.step(); if (o.after) o.after(st); st.t++; },
        draw(g) { bg(g); o.draw(g, st); },
        down(p) { for (const v of st.V) { const q = v.nearest(p.x, p.y); if (q) { v.grab = { p: q, x: p.x, y: p.y }; st.gv = v; break; } } },
        move(p, d) { if (d && st.gv && st.gv.grab) { st.gv.grab.x = p.x; st.gv.grab.y = p.y; } },
        up() { if (st.gv) st.gv.grab = null; st.gv = null; },
        hud() { return o.hud ? o.hud(st) : []; } }; } };
}
function simple(o) {
  return { s: o.s, name: o.name, tag: o.tag, desc: o.desc, hint: o.hint, interactive: !!(o.down || o.move), capture: !!o.drag, warm: o.warm || 0,
    make: (env) => { const st = { t: 0, rand: env.rand, ptr: null, down: false }; o.init(st);
      return { step() { o.step(st); st.t++; }, draw(g) { bg(g); o.draw(g, st); },
        down(p) { st.down = true; st.ptr = p; if (o.down) o.down(st, p); }, move(p, d) { st.ptr = p; if (o.move) o.move(st, p, d); }, up() { st.down = false; if (o.up) o.up(st); }, leave() { st.ptr = null; },
        hud() { return o.hud ? o.hud(st) : []; } }; } };
}

/* ---------- catalogue ---------- */
const ITEMS = [
  /* basics */
  simple({ s: 'basic', name: '落下と跳ね返り', tag: '反発係数 0.9 / 0.6 / 0.2',
    desc: '3つのボールを同じ高さから落としています。床に当たったとき、下向きの速さに「反発係数」をかけて上向きにします。0.9はスーパーボール、0.2は粘土のように、跳ね返りの強さだけで素材の違いが出ます。',
    init: (s) => { s.reset = () => { s.B = [.9, .6, .2].map((e, i) => ({ x: 55 + i * 65, y: 30, vy: 0, e, tr: [] })); s.rest = 0; }; s.reset(); },
    step: (s) => { let moving = false; for (const b of s.B) { b.vy += .25; b.y += b.vy; if (b.y > 210) { b.y = 210; b.vy = -b.vy * b.e; if (Math.abs(b.vy) < .6) b.vy = 0; } if (b.vy !== 0 || b.y < 209) moving = true; if (s.t % 2 === 0) { b.tr.push(b.y); if (b.tr.length > 60) b.tr.shift(); } }
      if (!moving && ++s.rest > 60) s.reset(); },
    draw: (g, s) => { floorAt(g, 220); s.B.forEach((b, i) => { g.fillStyle = 'rgba(127,214,255,.2)'; b.tr.forEach((y, k) => g.fillRect(b.x - 1 + (k - b.tr.length) * .3, y, 2, 2)); ball(g, b.x, b.y, 10, ['#5ef08a', '#ffd84d', '#ff7a5a'][i]); tag(g, 'e = ' + b.e, b.x, 236, { align: 'center' }); }); } }),
  simple({ s: 'basic', name: '摩擦と斜面', tag: '加速度 = g (sinθ − μ cosθ)',
    desc: '同じ角度の斜面に、摩擦の強さ（μ）が違う箱を置いています。摩擦がないと一気に滑り、摩擦が強いとゆっくり、さらに強いと止まったまま動きません。',
    init: (s) => { s.th = 32 * Math.PI / 180; s.reset = () => { s.B = [0, .3, .62].map(mu => ({ mu, d: 0, v: 0 })); }; s.reset(); },
    step: (s) => { const g = .12; for (const b of s.B) { const a = g * (Math.sin(s.th) - b.mu * Math.cos(s.th)); if (a > 0 || b.v > 0) { b.v = Math.max(0, b.v + a); b.d += b.v; } b.d = Math.min(b.d, 170); } if (s.t % 200 === 199) s.reset(); },
    draw: (g, s) => { s.B.forEach((b, i) => { const y0 = 20 + i * 72, x0 = 20, c = Math.cos(s.th), sn = Math.sin(s.th); g.fillStyle = '#232b45'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 180 * c, y0 + 180 * sn * .5); g.lineTo(x0, y0 + 180 * sn * .5); g.fill();
        const sl = Math.atan2(180 * sn * .5, 180 * c), px = x0 + b.d * Math.cos(sl), py = y0 + b.d * Math.sin(sl); g.save(); g.translate(px, py); g.rotate(sl); g.fillStyle = ['#7fd6ff', '#ffd84d', '#ff7ad9'][i]; g.fillRect(0, -14, 18, 14); g.restore();
        tag(g, 'μ = ' + b.mu, 200, y0 + 20, { align: 'right' }); }); } }),
  simple({ s: 'basic', name: '振り子', tag: 'θ″ = −(g / L) sin θ',
    desc: '振り子の角度の加速度は「重力 ÷ 長さ × sin(角度)」で決まります。空気抵抗はほんの少しだけ入れています。おもりをつかんで持ち上げ、離してみてください。',
    hint: 'おもりをつかんで持ち上げられる', drag: true,
    init: (s) => { s.th = 1.1; s.w = 0; s.L = 150; s.tr = []; },
    step: (s) => { if (s.down && s.ptr) { s.th = Math.atan2(s.ptr.x - 120, s.ptr.y - 30); s.w = 0; } else { s.w += -(.3 / s.L) * Math.sin(s.th); s.w *= .999; s.th += s.w; }
      const x = 120 + Math.sin(s.th) * s.L, y = 30 + Math.cos(s.th) * s.L; s.tr.push([x, y]); if (s.tr.length > 80) s.tr.shift(); },
    draw: (g, s) => { const x = 120 + Math.sin(s.th) * s.L, y = 30 + Math.cos(s.th) * s.L; g.fillStyle = '#3b4870'; g.fillRect(80, 26, 80, 4); g.strokeStyle = 'rgba(255,216,77,.3)'; g.beginPath(); s.tr.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.stroke();
      g.strokeStyle = '#c9cfdf'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(120, 30); g.lineTo(x, y); g.stroke(); ball(g, x, y, 12, COL.yellow); } }),
  simple({ s: 'basic', name: '二重振り子', tag: 'カオス · 初期値の差 0.001',
    desc: '振り子の先にもう1つ振り子をつけると、動きがまったく予測できなくなります。水色とピンクは、最初の角度が0.001ラジアン（約0.06°）だけ違うだけですが、しばらくすると全く別の動きになります。',
    init: (s) => { s.reset = () => { s.P = [0, .001].map(d => ({ a1: 2.2 + d, a2: 2.4, w1: 0, w2: 0, tr: [] })); }; s.reset(); },
    step: (s) => { const g = .5, l1 = 55, l2 = 55, m1 = 1, m2 = 1;
      for (const p of s.P) for (let k = 0; k < 4; k++) { const dt = .25, { a1, a2, w1, w2 } = p, d = a1 - a2, den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
        const al1 = (-g * (2 * m1 + m2) * Math.sin(a1) - m2 * g * Math.sin(a1 - 2 * a2) - 2 * Math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))) / (l1 * den);
        const al2 = (2 * Math.sin(d) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(a1) + w2 * w2 * l2 * m2 * Math.cos(d))) / (l2 * den);
        p.w1 += al1 * dt; p.w2 += al2 * dt; p.a1 += p.w1 * dt; p.a2 += p.w2 * dt; }
      for (const p of s.P) { const x1 = 120 + Math.sin(p.a1) * 55, y1 = 110 + Math.cos(p.a1) * 55; p.tr.push([x1 + Math.sin(p.a2) * 55, y1 + Math.cos(p.a2) * 55]); if (p.tr.length > 140) p.tr.shift(); }
      if (s.t % 1200 === 1199) s.reset(); },
    draw: (g, s) => { s.P.forEach((p, i) => { const col = i ? '#ff7ad9' : '#4fe0ff', x1 = 120 + Math.sin(p.a1) * 55, y1 = 110 + Math.cos(p.a1) * 55, x2 = x1 + Math.sin(p.a2) * 55, y2 = y1 + Math.cos(p.a2) * 55;
      g.strokeStyle = col + '66'; g.lineWidth = 1; g.beginPath(); p.tr.forEach((q, k) => k ? g.lineTo(...q) : g.moveTo(...q)); g.stroke();
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(120, 110); g.lineTo(x1, y1); g.lineTo(x2, y2); g.stroke(); ball(g, x1, y1, 5, col); ball(g, x2, y2, 6, col); }); } }),
  simple({ s: 'basic', name: 'ばねと減衰', tag: 'a = −k x − c v',
    desc: '同じばねに、揺れを弱める力（減衰）の強さだけ違うおもりをつけています。減衰なしはずっと揺れ続け、少しあると徐々に小さくなり、ちょうどよい強さ（臨界減衰）だと行き過ぎずに最短で止まります。',
    init: (s) => { s.reset = () => { s.M = [0, .03, 2 * Math.sqrt(.02)].map(c => ({ c, x: 55, v: 0 })); }; s.reset(); },
    step: (s) => { for (const m of s.M) { const a = -.02 * m.x - m.c * m.v; m.v += a; m.x += m.v; } if (s.t % 360 === 359) s.reset(); },
    draw: (g, s) => { g.fillStyle = '#3b4870'; g.fillRect(20, 16, 200, 4); s.M.forEach((m, i) => { const x = 50 + i * 70, y = 120 + m.x; g.strokeStyle = '#9aa3b8'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, 20);
      for (let k = 1; k < 14; k++) g.lineTo(x + (k % 2 ? 7 : -7), 20 + (y - 30) * k / 14); g.lineTo(x, y - 12); g.stroke(); g.fillStyle = ['#7fd6ff', '#ffd84d', '#5ef08a'][i]; g.fillRect(x - 12, y - 12, 24, 22);
      tag(g, ['減衰なし', '少し', '臨界'][i], x, 232, { align: 'center' }); }); g.strokeStyle = 'rgba(240,165,74,.4)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(20, 119); g.lineTo(220, 119); g.stroke(); g.setLineDash([]); } }),
  simple({ s: 'basic', name: 'ニュートンのゆりかご', tag: '同じ重さの弾性衝突 = 速さの交換',
    desc: '同じ重さのボールどうしがまっすぐぶつかると、速さをそっくり交換します。片端から1つぶつけると、真ん中は動かずに反対側の1つだけが飛び出します。',
    init: (s) => { s.reset = () => { s.A = [-.75, 0, 0, 0, 0]; s.Wv = [0, 0, 0, 0, 0]; }; s.reset(); },
    step: (s) => { const L = 110, r = 11;
      for (let k = 0; k < 8; k++) { for (let i = 0; i < 5; i++) { s.Wv[i] += -(.25 / L) * Math.sin(s.A[i]) / 8; s.Wv[i] *= .99995; s.A[i] += s.Wv[i] / 8; }
        for (let it = 0; it < 5; it++) for (let i = 0; i < 4; i++) { const x1 = 76 + i * 22 + Math.sin(s.A[i]) * L, x2 = 76 + (i + 1) * 22 + Math.sin(s.A[i + 1]) * L; if (x2 - x1 < 2 * r - .01 && s.Wv[i] > s.Wv[i + 1]) { const t = s.Wv[i]; s.Wv[i] = s.Wv[i + 1]; s.Wv[i + 1] = t; } } }
      if (s.t % 900 === 899) s.reset(); },
    draw: (g, s) => { g.fillStyle = '#3b4870'; g.fillRect(40, 36, 160, 5); for (let i = 0; i < 5; i++) { const ax = 76 + i * 22, x = ax + Math.sin(s.A[i]) * 110, y = 40 + Math.cos(s.A[i]) * 110; g.strokeStyle = '#9aa3b8'; g.lineWidth = 1; g.beginPath(); g.moveTo(ax, 40); g.lineTo(x, y); g.stroke(); ball(g, x, y, 11, '#c9cfdf'); } } }),

  /* connected */
  verletCard({ s: 'soft', name: 'ロープ', tag: 'ベルレ積分 + 距離の拘束',
    desc: '短い棒でつないだ点の列です。各点は「前のフレームからの移動量」をそのまま次も進み（ベルレ積分）、そのあと隣の点との距離を元の長さに戻す修正を何回かくり返します。',
    init: (s) => { const v = new Verlet({ iters: 12 }); let prev = v.pt(120, 20, true); for (let i = 1; i <= 20; i++) { const p = v.pt(120 + i * 8, 20, false, 2); v.st(prev, p); prev = p; } prev.r = 7; s.end = prev; s.V = [v]; },
    draw: (g, s) => { const v = s.V[0]; g.strokeStyle = '#d9b27a'; g.lineWidth = 2.5; g.lineJoin = 'round'; g.beginPath(); v.P.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); g.fillStyle = '#3b4870'; g.fillRect(100, 14, 40, 6); ball(g, s.end.x, s.end.y, 7, COL.orange); } }),
  verletCard({ s: 'soft', name: '布', tag: '格子状の点 + 風 + 引き裂き',
    desc: '点を格子に並べ、縦横の隣どうしを棒でつなぐと布になります。上の端を固定し、風の力を足しています。強く引っぱると、伸びすぎた棒が切れて布が裂けます。',
    hint: 'つかんで強く引くと裂ける',
    init: (s) => { const v = new Verlet({ iters: 5, tear: 3.2, g: .2 }), nx = 18, ny = 14, sp = 10, x0 = 35, y0 = 20; s.G = [];
      for (let y = 0; y < ny; y++) { const row = []; for (let x = 0; x < nx; x++) { const p = v.pt(x0 + x * sp, y0 + y * sp, y === 0 && x % 3 === 0); row.push(p); if (x) v.st(row[x - 1], p); if (y) v.st(s.G[y - 1][x], p); } s.G.push(row); } s.V = [v]; },
    step: (s) => { const w = (Math.sin(s.t * .02) + 1) * .04; for (const p of s.V[0].P) p.fx += w * (.5 + .5 * Math.sin(p.y * .05 + s.t * .05)); },
    draw: (g, s) => { const v = s.V[0]; for (const c of v.C) { const st = clamp((Math.hypot(c.a.x - c.b.x, c.a.y - c.b.y) / c.len - 1) * 2, 0, 1); g.strokeStyle = `rgb(${lerp(120, 255, st) | 0},${lerp(170, 90, st) | 0},${lerp(255, 110, st) | 0})`; g.lineWidth = 1; g.beginPath(); g.moveTo(c.a.x, c.a.y); g.lineTo(c.b.x, c.b.y); g.stroke(); }
      g.fillStyle = COL.accent; for (const p of v.P) if (p.pin) g.fillRect(p.x - 2, p.y - 2, 4, 4); } }),
  verletCard({ s: 'soft', name: '吊り橋とボール', tag: '点と線分の衝突',
    desc: '両端を固定した板の列の上を、ボールが転がって渡ります。ボールが板の線分にめり込んだら、ボールを押し戻し、同じだけ板を押し下げています。橋がたわんで揺れる様子が見られます。',
    init: (s) => { const v = new Verlet({ iters: 10, g: .2 }); s.B = []; let prev = v.pt(10, 110, true); s.B.push(prev); for (let i = 1; i <= 15; i++) { const p = v.pt(10 + i * 14.6, 110, i === 15); v.st(prev, p, 1, 14.6); s.B.push(p); prev = p; }
      s.ball = v.pt(20, 40, false, 11); s.V = [v]; },
    after: (s) => { const b = s.ball; for (let i = 0; i < s.B.length - 1; i++) { const a = s.B[i], c = s.B[i + 1], ex = c.x - a.x, ey = c.y - a.y, l2 = ex * ex + ey * ey; let k = clamp(((b.x - a.x) * ex + (b.y - a.y) * ey) / l2, 0, 1);
        const qx = a.x + ex * k, qy = a.y + ey * k, dx = b.x - qx, dy = b.y - qy, d = Math.hypot(dx, dy); if (d < b.r && d > 0) { const pen = b.r - d, nx = dx / d, ny = dy / d; b.x += nx * pen * .6; b.y += ny * pen * .6;
          if (!a.pin) { a.x -= nx * pen * .4 * (1 - k); a.y -= ny * pen * .4 * (1 - k); } if (!c.pin) { c.x -= nx * pen * .4 * k; c.y -= ny * pen * .4 * k; } } }
      if (b !== s.V[0].grab?.p) b.x += .05; if (b.y > 220 || b.x > 232) { b.x = b.px = 20; b.y = b.py = 40; } },
    draw: (g, s) => { g.fillStyle = '#3b4870'; g.fillRect(0, 110, 12, 130); g.fillRect(228, 110, 12, 130); for (let i = 0; i < s.B.length - 1; i++) { const a = s.B[i], c = s.B[i + 1]; g.strokeStyle = '#a07a4a'; g.lineWidth = 5; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke(); g.strokeStyle = 'rgba(200,200,220,.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(a.x, 70); g.stroke(); }
      ball(g, s.ball.x, s.ball.y, 11, COL.cyan); } }),
  verletCard({ s: 'soft', name: 'ソフトボディ', tag: '輪 + ばね + 内側の圧力',
    desc: '点を輪に並べて棒でつなぎ、さらに「中の面積が元の大きさより小さくなったら外へ押す」圧力を足しています。落ちるとつぶれ、ぷるんと元に戻ります。',
    init: (s) => { const v = new Verlet({ iters: 6, g: .18, solids: [[120, 170, 120, 12], [0, 110, 80, 10]] }); const n = 22; s.R = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; s.R.push(v.pt(60 + Math.cos(a) * 28, 40 + Math.sin(a) * 28, false, 2)); }
      for (let i = 0; i < n; i++) { v.st(s.R[i], s.R[(i + 1) % n], 1); v.st(s.R[i], s.R[(i + 2) % n], .15); } s.A0 = 0; s.A0 = area(s.R); s.V = [v]; },
    step: (s) => { const A = area(s.R), f = (s.A0 - A) / s.A0 * 3.5, n = s.R.length; for (let i = 0; i < n; i++) { const a = s.R[(i + n - 1) % n], b = s.R[(i + 1) % n], nx = b.y - a.y, ny = -(b.x - a.x), l = Math.hypot(nx, ny) || 1; s.R[i].fx += nx / l * f; s.R[i].fy += ny / l * f; }
      const c = s.R[0]; if (c.y > 215 && s.t % 400 > 380) for (const p of s.R) { p.px = p.x; p.py = p.y; p.x -= 20; p.y -= 180; } },
    draw: (g, s) => { g.fillStyle = '#3b4870'; for (const [x, y, w, h] of s.V[0].solids) g.fillRect(x, y, w, h); floorAt(g, 228);
      g.fillStyle = 'rgba(255,122,217,.75)'; g.strokeStyle = '#ffb3e8'; g.lineWidth = 2; g.beginPath(); s.R.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.fill(); g.stroke();
      let cx = 0, cy = 0; for (const p of s.R) { cx += p.x; cy += p.y; } cx /= s.R.length; cy /= s.R.length; g.fillStyle = '#2a0f22'; g.fillRect(cx - 7, cy - 5, 3, 5); g.fillRect(cx + 4, cy - 5, 3, 5); } }),
  verletCard({ s: 'soft', name: 'ラグドール', tag: '関節でつないだ棒人間',
    desc: '頭・首・腰・ひじ・手・ひざ・足を点にして棒でつなぎ、階段の上から落としています。力の抜けた人形のように、段差にぶつかりながら転がり落ちます。',
    init: (s) => { const v = new Verlet({ iters: 10, g: .22, fric: .7, solids: [[0, 80, 70, 160], [70, 120, 50, 120], [120, 160, 50, 80], [170, 200, 70, 40]] }); s.V = [v];
      const P = (x, y, r = 3) => v.pt(x, y, false, r), hd = P(30, 20, 7), nk = P(30, 32), pv = P(30, 55), el = P(20, 42), er = P(40, 42), hl = P(14, 54), hr = P(46, 54), kl = P(24, 68), kr = P(36, 68), fl = P(22, 80), fr = P(38, 80);
      [[hd, nk], [nk, pv], [nk, el], [el, hl], [nk, er], [er, hr], [pv, kl], [kl, fl], [pv, kr], [kr, fr], [el, er, .1], [kl, kr, .1], [hd, pv, .2]].forEach(([a, b, k]) => v.st(a, b, k || 1)); s.J = { hd, nk, pv, el, er, hl, hr, kl, kr, fl, fr };
      s.reset = () => { const dx = 30 - s.J.pv.x, dy = 40 - s.J.pv.y; for (const p of v.P) { p.x += dx; p.y += dy; p.px = p.x - 1.5 - s.rand(); p.py = p.y; } }; s.reset(); },
    step: (s) => { if (s.t % 320 === 319) s.reset(); },
    draw: (g, s) => { g.fillStyle = '#2d3656'; for (const [x, y, w, h] of s.V[0].solids) g.fillRect(x, y, w, h); g.fillStyle = '#3b4870'; for (const [x, y, w] of s.V[0].solids) g.fillRect(x, y, w, 2);
      const J = s.J, L = (a, b) => { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }; g.strokeStyle = '#f0e2c8'; g.lineWidth = 4; g.lineCap = 'round';
      [[J.nk, J.pv], [J.nk, J.el], [J.el, J.hl], [J.nk, J.er], [J.er, J.hr], [J.pv, J.kl], [J.kl, J.fl], [J.pv, J.kr], [J.kr, J.fr]].forEach(([a, b]) => L(a, b)); ball(g, J.hd.x, J.hd.y, 7, '#f0e2c8'); } }),
  simple({ s: 'soft', name: 'ボールの山', tag: '円どうしの重なりを押し戻す',
    desc: '上から次々と落ちるボールが、容器の中に積み重なります。毎フレーム、重なっている2つのボールを、重なった分だけ互いに押し離しています。クリックでボールを追加できます。',
    hint: 'クリックでボールを追加',
    init: (s) => { s.B = []; s.add = (x, y) => { const r = 5 + s.rand() * 5; s.B.push({ x, y, px: x - (s.rand() - .5), py: y, r, c: ['#ff5470', '#ffd84d', '#4fe0ff', '#5ef08a', '#b57bff'][(s.rand() * 5) | 0] }); }; },
    down: (s, p) => s.add(p.x, p.y),
    step: (s) => { if (s.t % 8 === 0 && s.B.length < 110) s.add(100 + s.rand() * 40, 10); if (s.t % 1600 === 1599) s.B.length = 0;
      for (const b of s.B) { const vx = (b.x - b.px) * .995, vy = (b.y - b.py) * .995; b.px = b.x; b.py = b.y; b.x += vx; b.y += vy + .2; }
      for (let it = 0; it < 4; it++) { for (let i = 0; i < s.B.length; i++) for (let j = i + 1; j < s.B.length; j++) { const a = s.B[i], b = s.B[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r; if (d < m && d > 0) { const k = (m - d) / d * .5; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; } }
        for (const b of s.B) { if (b.y > 222 - b.r) b.y = 222 - b.r; if (b.x < 30 + b.r) b.x = 30 + b.r; if (b.x > 210 - b.r) b.x = 210 - b.r; } } },
    draw: (g, s) => { g.fillStyle = '#3b4870'; g.fillRect(24, 90, 6, 138); g.fillRect(210, 90, 6, 138); g.fillRect(24, 222, 192, 6); for (const b of s.B) ball(g, b.x, b.y, b.r, b.c); },
    hud: (s) => ['ボール ' + s.B.length] }),

  /* how it works */
  simple({ s: 'calc', name: '積分方法の違い', tag: '前進オイラー / 半陰的オイラー / ベルレ',
    desc: '太陽の周りを回る3つの惑星は、同じ位置・同じ速さから出発し、「速さと位置を更新する順番」だけが違います。単純な方法（赤）は計算の誤差でエネルギーが増えて外へ飛んでいきます。順番を入れ替えるだけで（黄・水色）軌道が安定します。',
    init: (s) => { s.reset = () => { const r = 70, v = Math.sqrt(85 / r); s.P = [0, 1, 2].map(k => ({ k, x: 120 + r, y: 120, vx: 0, vy: -v, px: 120 + r, py: 120 + v, tr: [] })); }; s.reset(); },
    step: (s) => { const acc = (x, y) => { const dx = 120 - x, dy = 120 - y, d = Math.hypot(dx, dy); return [dx / d * 85 / (d * d), dy / d * 85 / (d * d)]; };
      for (const p of s.P) { if (p.k === 0) { const [ax, ay] = acc(p.x, p.y); p.x += p.vx; p.y += p.vy; p.vx += ax; p.vy += ay; }
        else if (p.k === 1) { const [ax, ay] = acc(p.x, p.y); p.vx += ax; p.vy += ay; p.x += p.vx; p.y += p.vy; }
        else { if (!p.init) { p.px = p.x - p.vx; p.py = p.y - p.vy; p.init = 1; } const [ax, ay] = acc(p.x, p.y), nx = 2 * p.x - p.px + ax, ny = 2 * p.y - p.py + ay; p.px = p.x; p.py = p.y; p.x = nx; p.y = ny; }
        if (s.t % 3 === 0) { p.tr.push([p.x, p.y]); if (p.tr.length > 400) p.tr.shift(); } }
      if (s.t % 2400 === 2399) s.reset(); },
    draw: (g, s) => { ball(g, 120, 120, 9, '#ffd84d'); const cols = ['#ff5470', '#ffd84d', '#4fe0ff']; s.P.forEach((p, i) => { g.strokeStyle = cols[i] + '88'; g.lineWidth = 1; g.beginPath(); p.tr.forEach((q, k) => k ? g.lineTo(...q) : g.moveTo(...q)); g.stroke(); if (p.x > -20 && p.x < 260 && p.y > -20 && p.y < 260) ball(g, p.x, p.y, 4, cols[i]); });
      ['前進オイラー', '半陰的オイラー', 'ベルレ'].forEach((t, i) => tag(g, '● ' + t, 8, 16 + i * 13, { color: cols[i], size: 9.5 })); } }),
  simple({ s: 'calc', name: 'すり抜け問題', tag: '点で判定 vs 線で判定',
    desc: '速い弾は1フレームで壁の厚さより長く進むので、「今の位置が壁の中か」だけを調べると、壁をすり抜けてしまいます（上）。下は「前の位置から今の位置までの線が壁と交わるか」で判定しているので、確実に止まります。',
    init: (s) => { s.hits = [0, 0]; s.pass = [0, 0]; s.B = [[], []]; },
    step: (s) => { if (s.t % 30 === 0) for (let k = 0; k < 2; k++) s.B[k].push({ x: 10, px: 10, v: 11 + s.rand() * 6, tr: [] });
      for (let k = 0; k < 2; k++) for (const b of s.B[k]) { if (b.done) { b.done++; continue; } b.px = b.x; b.x += b.v; b.tr.push(b.x);
        const hit = k === 0 ? (b.x >= 160 && b.x <= 163) : (b.px < 160 && b.x >= 160); if (hit) { if (k === 1) b.x = 160; b.done = 1; s.hits[k]++; } else if (b.x > 250) { b.done = 1; s.pass[k]++; } }
      for (let k = 0; k < 2; k++) s.B[k] = s.B[k].filter(b => !b.done || b.done < 20); },
    draw: (g, s) => { [60, 170].forEach((y, k) => { g.fillStyle = '#c9cfdf'; g.fillRect(160, y - 40, 3, 80); for (const b of s.B[k]) { g.fillStyle = 'rgba(255,216,77,.25)'; for (const x of b.tr) g.fillRect(x - 1, y - 1, 2, 2); ball(g, b.x, y, 4, b.done && b.x <= 163 ? COL.red : COL.yellow); }
      tag(g, (k ? '線で判定' : '点で判定') + `  当たり ${s.hits[k]} / すり抜け ${s.pass[k]}`, 8, y - 46, { color: COL.ink }); }); } }),
  simple({ s: 'calc', name: '空間分割で衝突判定を減らす', tag: '総当たり N² vs 格子で近所だけ',
    desc: '120個のボールどうしの衝突を調べるとき、全部の組み合わせを調べると1フレームに7140回です。画面を格子に分け、同じマスと隣のマスにいるボールだけ調べれば、回数は大きく減ります。黄色は1つのボールが調べる範囲です。',
    init: (s) => { s.B = []; for (let i = 0; i < 120; i++) s.B.push({ x: 10 + s.rand() * 220, y: 10 + s.rand() * 220, vx: (s.rand() - .5) * 1.4, vy: (s.rand() - .5) * 1.4 }); s.checks = 0; },
    step: (s) => { const cs = 30, grid = new Map(); for (const b of s.B) { b.x += b.vx; b.y += b.vy; if (b.x < 4 || b.x > 236) b.vx *= -1; if (b.y < 4 || b.y > 236) b.vy *= -1; b.hit = false; const k = ((b.x / cs) | 0) + ',' + ((b.y / cs) | 0); (grid.get(k) || grid.set(k, []).get(k)).push(b); }
      let n = 0; for (const b of s.B) { const cx = (b.x / cs) | 0, cy = (b.y / cs) | 0; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const L = grid.get((cx + dx) + ',' + (cy + dy)); if (!L) continue; for (const o of L) { if (o === b) continue; n++; if (Math.hypot(o.x - b.x, o.y - b.y) < 8) b.hit = true; } } } s.checks = n / 2; },
    draw: (g, s) => { g.strokeStyle = 'rgba(120,140,200,.18)'; g.lineWidth = 1; g.beginPath(); for (let i = 30; i < 240; i += 30) { g.moveTo(i, 0); g.lineTo(i, 240); g.moveTo(0, i); g.lineTo(240, i); } g.stroke();
      const f = s.B[0], cx = (f.x / 30) | 0, cy = (f.y / 30) | 0; g.fillStyle = 'rgba(255,216,77,.12)'; g.fillRect((cx - 1) * 30, (cy - 1) * 30, 90, 90);
      for (const b of s.B) ball(g, b.x, b.y, 4, b === f ? COL.yellow : b.hit ? COL.red : '#7fd6ff'); },
    hud: (s) => ['総当たり 7140 回', '格子 ' + Math.round(s.checks) + ' 回'] }),
  simple({ s: 'calc', name: '拘束の反復回数', tag: '1回 vs 20回',
    desc: '左右とも同じ布ですが、「棒の長さを元に戻す」修正を1フレームに何回くり返すかが違います。1回だと修正が行き渡らず、ゴムのように伸びてしまいます。回数を増やすほど硬くなり、そのぶん計算は重くなります。',
    init: (s) => { s.V = [1, 20].map((it, k) => { const v = new Verlet({ iters: it, g: .25 }), nx = 8, ny = 12, G = []; for (let y = 0; y < ny; y++) { const row = []; for (let x = 0; x < nx; x++) { const p = v.pt(14 + k * 120 + x * 12, 20 + y * 12, y === 0 && (x === 0 || x === nx - 1)); row.push(p); if (x) v.st(row[x - 1], p); if (y) v.st(G[y - 1][x], p); } G.push(row); } v.G = G; return v; }); },
    step: (s) => { for (const v of s.V) v.step(); },
    draw: (g, s) => { s.V.forEach((v, k) => { g.strokeStyle = k ? '#7fd6ff' : '#ff7ad9'; g.lineWidth = 1; for (const c of v.C) { g.beginPath(); g.moveTo(c.a.x, c.a.y); g.lineTo(c.b.x, c.b.y); g.stroke(); } tag(g, k ? '20回' : '1回', 56 + k * 120, 232, { align: 'center', color: COL.ink }); }); } }),
  simple({ s: 'calc', name: '粒子の水（2D）', tag: '粒の押し合い + 粘り',
    desc: '水を300個の粒として計算しています。近すぎる粒どうしは押し合い、近づき合う速さには粘りのブレーキをかけています。カーソルでかき混ぜられます。',
    hint: 'カーソルでかき混ぜる',
    init: (s) => { s.N = 300; s.P = []; for (let i = 0; i < s.N; i++) s.P.push({ x: 20 + (i % 20) * 6 + s.rand(), y: 40 + ((i / 20) | 0) * 6, vx: 0, vy: 0 }); },
    step: (s) => { const Hh = 12, grid = new Map(), key = (x, y) => ((x / Hh) | 0) * 1000 + ((y / Hh) | 0);
      for (const p of s.P) { p.vy += .12; const k = key(p.x, p.y); (grid.get(k) || grid.set(k, []).get(k)).push(p); }
      for (const p of s.P) { const cx = (p.x / Hh) | 0, cy = (p.y / Hh) | 0; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const L = grid.get((cx + dx) * 1000 + cy + dy); if (!L) continue;
        for (const q of L) { if (q === p) continue; const ex = q.x - p.x, ey = q.y - p.y, d = Math.hypot(ex, ey); if (d >= Hh || d < 1e-4) continue; const w = 1 - d / Hh, nx = ex / d, ny = ey / d, imp = 1.8 * w * w, u = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
          let I = imp; if (u > 0) I += .1 * w * u; p.vx -= nx * I * .5; p.vy -= ny * I * .5; q.vx += nx * I * .5; q.vy += ny * I * .5; } } }
      for (const p of s.P) { if (s.ptr) { const dx = p.x - s.ptr.x, dy = p.y - s.ptr.y, d = Math.hypot(dx, dy); if (d < 30 && d > 0) { p.vx += dx / d * .6; p.vy += dy / d * .6; } }
        p.vx *= .995; p.vy *= .995; p.x += p.vx; p.y += p.vy; if (p.x < 4) { p.x = 4; p.vx *= -.3; } if (p.x > 236) { p.x = 236; p.vx *= -.3; } if (p.y > 234) { p.y = 234; p.vy *= -.3; } if (p.y < 4) { p.y = 4; p.vy *= -.3; } } },
    draw: (g, s) => { for (const p of s.P) { const sp = Math.min(1, Math.hypot(p.vx, p.vy) / 3); g.fillStyle = `rgb(${lerp(30, 180, sp) | 0},${lerp(110, 230, sp) | 0},255)`; g.beginPath(); g.arc(p.x, p.y, 4.5, 0, TAU); g.fill(); } } }),
  simple({ s: 'calc', name: '砂と水（セル・オートマトン）', tag: '下 → 斜め下 → 横 の順に空きを探す',
    desc: '画面を小さなマスに分け、砂は「下が空いていれば下、だめなら斜め下」、水はそれに加えて「横へも流れる」という規則で1マスずつ動かしています。砂は水より重いので、水の中に沈みます。クリックで砂を落とせます。',
    hint: 'クリック・ドラッグで砂を落とせる', drag: true,
    init: (s) => { const n = 80; s.n = n; s.g = new Uint8Array(n * n); for (let x = 10; x < 40; x++) s.g[50 * n + x] = 3; for (let x = 45; x < 72; x++) s.g[(62 - ((x - 45) >> 2)) * n + x] = 3; for (let y = 64; y < 80; y++) { s.g[y * n + 30] = 3; } },
    step: (s) => { const n = s.n, g = s.g; if (s.t % 1500 === 1499) { for (let i = 0; i < n * n; i++) if (g[i] < 3) g[i] = 0; }
      if (s.t < 1300) { for (let k = 0; k < 2; k++) { const x = 18 + ((s.rand() * 8) | 0); if (!g[n + x]) g[n + x] = 1; const w = 58 + ((s.rand() * 8) | 0); if (!g[n + w]) g[n + w] = 2; } }
      if (s.down && s.ptr) for (let k = 0; k < 4; k++) { const x = clamp(((s.ptr.x / 3) | 0) + ((s.rand() * 5) | 0) - 2, 0, n - 1), y = clamp((s.ptr.y / 3) | 0, 0, n - 1); if (!g[y * n + x]) g[y * n + x] = 1; }
      const dir = s.t % 2 ? 1 : -1;
      for (let y = n - 2; y >= 0; y--) for (let i = 0; i < n; i++) { const x = dir > 0 ? i : n - 1 - i, c = g[y * n + x]; if (c !== 1 && c !== 2) continue;
        const tryMove = (nx, ny) => { if (nx < 0 || nx >= n || ny >= n) return false; const t = g[ny * n + nx]; if (t === 0 || (c === 1 && t === 2)) { g[ny * n + nx] = c; g[y * n + x] = t; return true; } return false; };
        const r = s.rand() < .5 ? 1 : -1;
        if (tryMove(x, y + 1) || tryMove(x + r, y + 1) || tryMove(x - r, y + 1)) continue;
        if (c === 2) { tryMove(x + r * 1, y) || tryMove(x - r, y); } } },
    draw: (g, s) => { const n = s.n, cs = 3, cols = [null, '#e8c46a', '#3f86ff', '#5a6480']; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const c = s.g[y * n + x]; if (!c) continue; g.fillStyle = cols[c]; g.fillRect(x * cs, y * cs, cs, cs); } } })
];
function area(R) { let a = 0; for (let i = 0; i < R.length; i++) { const p = R[i], q = R[(i + 1) % R.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; }

const SECTIONS = [
  { id: 'basic', en: 'Motion basics', title: '基本の運動', lead: '重力で落ちる、跳ね返る、揺れる。どれも「今の速さに加速度を足し、位置に速さを足す」を毎フレームくり返しているだけです。' },
  { id: 'soft', en: 'Connected bodies', title: 'つながったもの', lead: '点を棒でつなぎ、「この2点の距離は一定」という決まりを守らせると、ロープや布、ぐにゃぐにゃの体が作れます。ゲームでよく使われる「ベルレ法」という手軽な方法です。' },
  { id: 'calc', en: 'Under the hood', title: '計算の仕組みと粒の集まり', lead: '見た目にはあまり出てこない、でも物理計算の正しさや速さを左右する部分と、たくさんの粒で水や砂を表す方法です。' }
];
run({ sections: SECTIONS, items: ITEMS, W, H, minCol: 300 });
series('physics');

})();
