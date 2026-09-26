/* 自動生成図鑑 — card definitions. Runtime: assets/js/g2d.js */
(function () {
const { rng, clamp, lerp, COL, label, run, series, makeNoise } = G2D;
const W = 240, H = 240, TAU = Math.PI * 2;

/* ---------- helpers ---------- */
function image(res, fn) {
  const c = document.createElement('canvas'); c.width = c.height = res; const g = c.getContext('2d'), im = g.createImageData(res, res);
  for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) { const o = (y * res + x) * 4, [r, gg, b] = fn(x / res, y / res, x, y); im.data[o] = r; im.data[o + 1] = gg; im.data[o + 2] = b; im.data[o + 3] = 255; }
  g.putImageData(im, 0, 0); return c;
}
const gray = (v) => { const k = clamp(v, 0, 1) * 255; return [k, k, k]; };
function mixc(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function pal(stops, t) { t = clamp(t, 0, 1); for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const k = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]); return mixc(stops[i - 1][1], stops[i][1], k); } return stops[stops.length - 1][1]; }
const hx = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function valueNoise(rand, cells) { const V = []; for (let i = 0; i <= cells; i++) { V.push([]); for (let j = 0; j <= cells; j++) V[i].push(rand()); }
  const s = t => t * t * (3 - 2 * t);
  return { V, f: (u, v) => { const x = u * cells, y = v * cells, xi = Math.min(cells - 1, x | 0), yi = Math.min(cells - 1, y | 0), fx = s(x - xi), fy = s(y - yi);
    return lerp(lerp(V[yi][xi], V[yi][xi + 1], fx), lerp(V[yi + 1][xi], V[yi + 1][xi + 1], fx), fy); } }; }
function blit(g, c, x = 0, y = 0, w = W, h = H, smooth = true) { g.imageSmoothingEnabled = smooth; g.drawImage(c, x, y, w, h); g.imageSmoothingEnabled = true; }
const TERRAIN = [[0, hx('#0a2a55')], [.42, hx('#1f5fa0')], [.47, hx('#3d86c4')], [.49, hx('#e3d7a4')], [.53, hx('#6aa84f')], [.66, hx('#3f7a37')], [.76, hx('#7d6b52')], [.86, hx('#a09a8f')], [.92, hx('#f2f4f7')], [1, hx('#ffffff')]];
function shaded(res, hf, palette = TERRAIN) {
  const Hm = new Float32Array(res * res); for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) Hm[y * res + x] = hf(x / res, y / res);
  const c = image(res, (u, v, x, y) => { const h = Hm[y * res + x]; let col = pal(palette, h);
    if (h > .49) { const hx1 = Hm[y * res + Math.min(res - 1, x + 1)], hy1 = Hm[Math.min(res - 1, y + 1) * res + x]; const sh = clamp(1 + ((h - hx1) + (h - hy1)) * 18, .55, 1.35); col = col.map(c => c * sh); }
    return col; });
  return { c, Hm };
}

function card(o) {
  return { s: o.s, name: o.name, tag: o.tag, desc: o.desc, hint: o.hint, reseed: true, pixel: o.pixel, interactive: !!o.down,
    make: (env) => { const st = { t: 0, rand: env.rand, noise: makeNoise(env.rand) }; o.init(st);
      return { step() { if (o.step) o.step(st); st.t++; }, draw(g) { o.draw(g, st); }, down(p) { if (o.down) o.down(st, p); }, hud() { return o.hud ? o.hud(st) : []; } }; } };
}

/* ---------- mazes & grids ---------- */
function drawCells(g, grid, n, cols) { const cs = W / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = cols[grid[y * n + x]]; g.fillRect(x * cs, y * cs, cs + .5, cs + .5); } }

/* ---------- catalogue ---------- */
const ITEMS = [
  /* noise */
  card({ s: 'noise', name: 'ホワイトノイズ', tag: 'value = random()', pixel: true,
    desc: '1マスごとに、となりと無関係な乱数を置いたもの。テレビの砂嵐のようで、自然な地形や模様にはなりません。ここから「となりどうしをなめらかにつなぐ」工夫が始まります。',
    init: (s) => { s.c = image(60, () => gray(s.rand())); }, draw: (g, s) => blit(g, s.c, 0, 0, W, H, false) }),
  card({ s: 'noise', name: 'バリューノイズ', tag: '格子点の乱数をなめらかに補間',
    desc: '格子の交点（白い点）だけに乱数を置き、その間を なめらかな曲線でつないで埋めます。なめらかにはなりますが、格子の形がうっすら見えてしまいます。',
    init: (s) => { s.vn = valueNoise(s.rand, 6); s.c = image(120, (u, v) => gray(s.vn.f(u, v))); },
    draw: (g, s) => { blit(g, s.c); for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) { const k = s.vn.V[i][j] * 255; g.fillStyle = `rgb(${k},${k},${k})`; g.strokeStyle = COL.accent; g.lineWidth = 1.2; g.beginPath(); g.arc(j * 40, i * 40, 4, 0, TAU); g.fill(); g.stroke(); } } }),
  card({ s: 'noise', name: 'パーリンノイズ', tag: '格子点に「傾き」を置く',
    desc: '格子点に値ではなく「傾きの向き」を置いて補間する方法。バリューノイズより格子の形が目立たず、山や谷が自然に見えます。1980年代に映画の CG のために考案され、今でも基本の道具です。',
    init: (s) => { s.c = image(120, (u, v) => gray(s.noise.n2(u * 6, v * 6) * .9 + .5)); }, draw: (g, s) => blit(g, s.c) }),
  card({ s: 'noise', name: 'フラクタルノイズ', tag: 'fbm · オクターブを重ねる',
    desc: '大きなうねりのノイズに、半分の大きさ・半分の強さのノイズを何回も重ねます。重ねる回数（オクターブ）が増えるほど細かな起伏が加わり、岩肌や雲のようになります。',
    init: (s) => { s.C = []; for (let k = 1; k <= 6; k++) s.C.push(image(120, (u, v) => gray(s.noise.fbm(u * 4, v * 4, k) * 1.1 + .5))); },
    draw: (g, s) => { const k = ((s.t / 70) | 0) % 6; blit(g, s.C[k]); label(g, 'オクターブ ' + (k + 1), 10, 22, { size: 12, bg: 'rgba(11,14,26,.75)' }); } }),
  card({ s: 'noise', name: 'ドメインワープ', tag: 'fbm(p + fbm(p + fbm(p)))',
    desc: 'ノイズの値で「座標そのもの」をずらしてから、もう一度ノイズを読みます。これを重ねると、流れる煙や大理石、木星の雲のような渦を巻いた模様になります。',
    init: (s) => { const f = s.noise.fbm; s.c = image(120, (u, v) => { const x = u * 3, y = v * 3; const qx = f(x, y, 4), qy = f(x + 5.2, y + 1.3, 4); const rx = f(x + 4 * qx + 1.7, y + 4 * qy + 9.2, 4), ry = f(x + 4 * qx + 8.3, y + 4 * qy + 2.8, 4); const n = f(x + 4 * rx, y + 4 * ry, 4);
      return pal([[0, hx('#0e1a3a')], [.35, hx('#2b5d8c')], [.55, hx('#e8c38a')], [.75, hx('#b3452c')], [1, hx('#fff2d8')]], n * 1.2 + .5 + qx * .3); }); },
    draw: (g, s) => blit(g, s.c) }),
  card({ s: 'noise', name: 'ボロノイ図', tag: '一番近い点で塗り分ける',
    desc: 'ばらまいた点のうち、どれに一番近いかで平面を塗り分けます。国境、細胞、石畳、ひび割れなど、「区切られた領域」を作るときの基本です。',
    init: (s) => { s.P = []; for (let i = 0; i < 26; i++) s.P.push([s.rand(), s.rand(), [40 + s.rand() * 140, 60 + s.rand() * 120, 90 + s.rand() * 120]]);
      s.c = image(120, (u, v) => { let d1 = 9, d2 = 9, b = null; for (const p of s.P) { const d = Math.hypot(u - p[0], v - p[1]); if (d < d1) { d2 = d1; d1 = d; b = p; } else if (d < d2) d2 = d; } return d2 - d1 < .012 ? [20, 22, 30] : b[2].map(c => c * (1 - d1 * 1.3)); }); },
    draw: (g, s) => { blit(g, s.c); g.fillStyle = '#fff'; for (const p of s.P) { g.beginPath(); g.arc(p[0] * W, p[1] * H, 2.2, 0, TAU); g.fill(); } } }),

  /* nature */
  card({ s: 'nature', name: '高さマップの地形', tag: '高さ → 色 + 陰影',
    desc: 'フラクタルノイズの値を「高さ」とみなし、低い順に深い海、浅瀬、砂浜、草原、森、岩、雪と色を割り当てます。隣との高さの差から陰影をつけると、立体的な地図になります。',
    init: (s) => { s.c = shaded(160, (u, v) => s.noise.fbm(u * 3, v * 3, 6) * 1.1 + .5).c; }, draw: (g, s) => blit(g, s.c) }),
  card({ s: 'nature', name: '島', tag: '高さ − 中心からの距離',
    desc: '同じ地形から、中心から離れるほど高さを引いていくと、周りが海に囲まれた島になります。引き方を変えると、島の形や大きさを調整できます。',
    init: (s) => { s.c = shaded(160, (u, v) => { const d = Math.hypot(u - .5, v - .5) * 2; return s.noise.fbm(u * 3, v * 3, 6) * 1.1 + .62 - d * d * .55; }).c; }, draw: (g, s) => blit(g, s.c) }),
  card({ s: 'nature', name: '川', tag: '一番低いとなりへ流す',
    desc: '島の高いところに雨粒を落とし、周りで一番低いマスへ1歩ずつ流していきます。流れが集まった道筋が川になり、窪みで止まった水は湖になります。',
    init: (s) => { const R = 120; s.R = R; const res = shaded(R, (u, v) => { const d = Math.hypot(u - .5, v - .5) * 2; return s.noise.fbm(u * 3, v * 3, 6) * 1.1 + .66 - d * d * .6; }); s.c = res.c; s.Hm = res.Hm;
      s.rivers = []; let tries = 0; while (s.rivers.length < 14 && tries++ < 400) { const x = (s.rand() * R) | 0, y = (s.rand() * R) | 0; if (s.Hm[y * R + x] > .72) s.rivers.push({ p: [[x, y]], done: false }); } },
    step: (s) => { const R = s.R; if (s.t % 2) return; for (const r of s.rivers) { if (r.done) continue; const [x, y] = r.p[r.p.length - 1]; let bx = x, by = y, bh = s.Hm[y * R + x];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= R || ny >= R) continue; const h = s.Hm[ny * R + nx]; if (h < bh) { bh = h; bx = nx; by = ny; } }
        if (bx === x && by === y) { r.done = true; r.lake = true; } else { r.p.push([bx, by]); if (bh < .47) r.done = true; } } },
    draw: (g, s) => { blit(g, s.c); const k = W / s.R; g.strokeStyle = '#4aa3ff'; g.lineWidth = 1.6; g.lineJoin = 'round';
      for (const r of s.rivers) { g.beginPath(); r.p.forEach(([x, y], i) => i ? g.lineTo(x * k + k / 2, y * k + k / 2) : g.moveTo(x * k + k / 2, y * k + k / 2)); g.stroke(); if (r.lake) { const [x, y] = r.p[r.p.length - 1]; g.fillStyle = '#4aa3ff'; g.beginPath(); g.arc(x * k, y * k, 4, 0, TAU); g.fill(); } } } }),
  card({ s: 'nature', name: '再帰的な木', tag: '枝 → 2本の小さな枝 → …',
    desc: '1本の枝の先から、少し短く少し角度の違う枝を2本（ときどき3本）伸ばす、という同じ手順を何回もくり返します。角度と長さに乱数を混ぜ、風で揺らしています。',
    init: (s) => { const R = s.rand; const mk = (d) => ({ a: (R() - .5) * .5, l: .72 + R() * .12, kids: d > 0 ? ((n) => Array.from({ length: n }, (_, i) => Object.assign(mk(d - 1), { off: (i - (n - 1) / 2) * (.45 + R() * .2) })))(R() < .15 ? 3 : 2) : [] }); s.tree = mk(9); s.tree.off = 0; },
    draw: (g, s) => { g.fillStyle = '#10152a'; g.fillRect(0, 0, W, H); g.fillStyle = '#1b2238'; g.fillRect(0, 222, W, 18);
      const grow = clamp(s.t / 160, 0, 1) * 10, wind = Math.sin(s.t * .02) * .05;
      const br = (n, x, y, ang, L, d) => { if (d > grow) return; const k = clamp(grow - d, 0, 1), a = ang + n.off + n.a + wind * d * .6, x2 = x + Math.cos(a) * L * k, y2 = y + Math.sin(a) * L * k;
        g.strokeStyle = d > 6 ? '#6fbf5e' : '#8a6a4a'; g.lineWidth = Math.max(.6, 7 - d * .8); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        if (!n.kids.length && k >= 1) { g.fillStyle = 'rgba(255,170,200,.8)'; g.beginPath(); g.arc(x2, y2, 2, 0, TAU); g.fill(); }
        if (k >= 1) for (const c of n.kids) br(c, x2, y2, a, L * n.l, d + 1); };
      g.lineCap = 'round'; br(s.tree, 120, 224, -Math.PI / 2, 46, 0); } }),
  card({ s: 'nature', name: 'L-システムの植物', tag: 'X → F+[[X]-X]-F[-FX]+X',
    desc: '文字の置き換え規則をくり返して長い命令の列を作り、それを「F＝前に線を引く、＋−＝曲がる、［］＝今の位置を覚えて戻る」として描きます。くり返すたびに枝分かれが増えていきます。',
    init: (s) => { const rules = { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }; s.gens = ['X']; for (let i = 0; i < 5; i++) s.gens.push([...s.gens[i]].map(c => rules[c] || c).join('')); s.ang = (22 + s.rand() * 6) * Math.PI / 180;
      s.paths = s.gens.map(str => { const segs = [], stack = []; let x = 0, y = 0, a = -Math.PI / 2 + .3; for (const c of str) { if (c === 'F') { const nx = x + Math.cos(a), ny = y + Math.sin(a); segs.push([x, y, nx, ny]); x = nx; y = ny; } else if (c === '+') a += s.ang; else if (c === '-') a -= s.ang; else if (c === '[') stack.push([x, y, a]); else if (c === ']') [x, y, a] = stack.pop(); }
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of segs) { x0 = Math.min(x0, q[0], q[2]); x1 = Math.max(x1, q[0], q[2]); y0 = Math.min(y0, q[1], q[3]); y1 = Math.max(y1, q[1], q[3]); }
        return { segs, x0, x1, y0, y1, n: str.length }; }); },
    draw: (g, s) => { g.fillStyle = '#10152a'; g.fillRect(0, 0, W, H); const k = 1 + ((s.t / 90) | 0) % 5, P = s.paths[k], sc = Math.min(200 / (P.x1 - P.x0 || 1), 200 / (P.y1 - P.y0 || 1));
      g.strokeStyle = '#7fd08a'; g.lineWidth = .8; g.beginPath(); for (const [a, b, c, d] of P.segs) { g.moveTo(20 + (a - P.x0) * sc, 225 - (P.y1 - b) * sc); g.lineTo(20 + (c - P.x0) * sc, 225 - (P.y1 - d) * sc); } g.stroke();
      label(g, `くり返し ${k} 回 · 命令 ${P.n} 文字`, 10, 20, { size: 11, bg: 'rgba(11,14,26,.75)' }); } }),
  card({ s: 'nature', name: 'ポアソンディスク', tag: '点どうしを一定距離以上離す',
    desc: '左は純粋な乱数で点を置いたもので、固まる所とすき間ができます。右は「既にある点から一定距離以上離れた場所にだけ置く」方法。木や岩を配置すると、自然でむらのない散らばりになります。',
    init: (s) => { s.A = []; for (let i = 0; i < 95; i++) s.A.push([4 + s.rand() * 108, 30 + s.rand() * 190]);
      const r = 12, P = [[60, 125]], act = [0]; while (act.length) { const i = act[(s.rand() * act.length) | 0], p = P[i]; let ok = false;
        for (let k = 0; k < 30; k++) { const a = s.rand() * TAU, d = r * (1 + s.rand()), q = [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d]; if (q[0] < 4 || q[0] > 112 || q[1] < 30 || q[1] > 220) continue; if (P.every(o => Math.hypot(o[0] - q[0], o[1] - q[1]) >= r)) { P.push(q); act.push(P.length - 1); ok = true; break; } }
        if (!ok) act.splice(act.indexOf(i), 1); } s.B = P; },
    draw: (g, s) => { g.fillStyle = '#12281c'; g.fillRect(0, 0, W, H); g.fillStyle = '#15171b'; g.fillRect(118, 0, 4, H);
      const tree = (x, y) => { g.fillStyle = '#2f6a3a'; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); g.fillStyle = '#5fae5a'; g.beginPath(); g.arc(x - 1.2, y - 1.2, 2.6, 0, TAU); g.fill(); };
      for (const p of s.A) tree(p[0], p[1]); for (const p of s.B) tree(p[0] + 124, p[1]);
      label(g, 'ただの乱数', 60, 20, { size: 11, align: 'center' }); label(g, 'ポアソンディスク', 182, 20, { size: 11, align: 'center' }); } }),

  /* dungeon */
  card({ s: 'dungeon', name: '迷路（穴掘り法）', tag: 'recursive backtracker',
    desc: '今いるマスから、まだ掘っていない隣のマスへランダムに掘り進み、行き止まりになったら来た道を戻って別の枝を掘ります。長く曲がりくねった、行き止まりの少ない迷路になります。',
    init: (s) => { const n = 23; s.n = n; s.gr = new Uint8Array(n * n); s.stack = [[1, 1]]; s.gr[n + 1] = 1; },
    step: (s) => { const n = s.n; for (let k = 0; k < 2 && s.stack.length; k++) { const [x, y] = s.stack[s.stack.length - 1]; const opts = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx > 0 && ny > 0 && nx < n - 1 && ny < n - 1 && !s.gr[ny * n + nx]; });
        if (!opts.length) { s.stack.pop(); continue; } const [dx, dy] = opts[(s.rand() * opts.length) | 0]; s.gr[(y + dy / 2) * n + x + dx / 2] = 1; s.gr[(y + dy) * n + x + dx] = 1; s.stack.push([x + dx, y + dy]); } },
    draw: (g, s) => { drawCells(g, s.gr, s.n, ['#2d3656', '#dfe6f5']); const cs = W / s.n; if (s.stack.length) { const [x, y] = s.stack[s.stack.length - 1]; g.fillStyle = COL.red; g.fillRect(x * cs, y * cs, cs, cs); g.fillStyle = 'rgba(255,84,112,.25)'; for (const [a, b] of s.stack) g.fillRect(a * cs, b * cs, cs, cs); } } }),
  card({ s: 'dungeon', name: '迷路（棒倒し法）', tag: '柱から1本ずつ棒を倒す',
    desc: '一定間隔に立てた柱から、ランダムな向きに棒（壁）を1本ずつ倒していく方法。1段目だけは上下左右、2段目からは上以外の3方向に倒します。日本で昔からよく知られた、とても簡単な作り方です。',
    init: (s) => { const n = 23; s.n = n; s.gr = new Uint8Array(n * n); for (let i = 0; i < n; i++) { s.gr[i] = s.gr[(n - 1) * n + i] = s.gr[i * n] = s.gr[i * n + n - 1] = 1; } s.posts = []; for (let y = 2; y < n - 1; y += 2) for (let x = 2; x < n - 1; x += 2) s.posts.push([x, y]); s.pi = 0; },
    step: (s) => { if (s.t % 2 || s.pi >= s.posts.length) return; const n = s.n, [x, y] = s.posts[s.pi++]; s.gr[y * n + x] = 1;
      const dirs = (y === 2 ? [[0, -1], [0, 1], [1, 0], [-1, 0]] : [[0, 1], [1, 0], [-1, 0]]).filter(([dx, dy]) => !s.gr[(y + dy) * n + x + dx]);
      if (dirs.length) { const [dx, dy] = dirs[(s.rand() * dirs.length) | 0]; s.gr[(y + dy) * n + x + dx] = 2; } },
    draw: (g, s) => { drawCells(g, s.gr, s.n, ['#dfe6f5', '#2d3656', '#f0a54a']); } }),
  card({ s: 'dungeon', name: '洞窟（セル・オートマトン）', tag: '周り8マスのうち壁が多ければ壁',
    desc: '最初は47%のマスをランダムに壁にします。次に「周りの8マスのうち壁が5マス以上なら壁、自分が壁で周りに4マス以上壁があっても壁、それ以外は空洞」という規則を全マス同時に数回あてはめると、なめらかな洞窟の形に落ち着きます。',
    init: (s) => { const n = 60; s.n = n; s.gr = new Uint8Array(n * n); for (let i = 0; i < n * n; i++) s.gr[i] = s.rand() < .47 ? 1 : 0; s.gen = 0; },
    step: (s) => { if (s.t % 45 !== 44 || s.gen >= 6) return; const n = s.n, nx = new Uint8Array(n * n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; c += (xx < 0 || yy < 0 || xx >= n || yy >= n) ? 1 : s.gr[yy * n + xx]; } nx[y * n + x] = (c >= 5 || (s.gr[y * n + x] && c >= 4)) ? 1 : 0; }
      s.gr = nx; s.gen++; },
    draw: (g, s) => { drawCells(g, s.gr, s.n, ['#1a1f33', '#8b7355']); label(g, s.gen === 0 ? '最初の乱数' : `規則を ${s.gen} 回適用`, 10, 20, { size: 11, bg: 'rgba(11,14,26,.75)' }); } }),
  card({ s: 'dungeon', name: '洞窟（酔歩）', tag: 'random walk carving',
    desc: '全部が岩の状態から、1人の「掘り手」が上下左右にでたらめに歩き、通った場所を掘っていきます。全体の40%が掘れたら終わり。つながった、有機的な形の洞窟ができます。',
    init: (s) => { const n = 60; s.n = n; s.gr = new Uint8Array(n * n).fill(1); s.x = 30; s.y = 30; s.open = 0; s.gr[30 * n + 30] = 0; },
    step: (s) => { const n = s.n; for (let k = 0; k < 25 && s.open < n * n * .4; k++) { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][(s.rand() * 4) | 0]; s.x = clamp(s.x + d[0], 1, n - 2); s.y = clamp(s.y + d[1], 1, n - 2); if (s.gr[s.y * n + s.x]) { s.gr[s.y * n + s.x] = 0; s.open++; } } },
    draw: (g, s) => { drawCells(g, s.gr, s.n, ['#1a1f33', '#8b7355']); const cs = W / s.n; g.fillStyle = COL.yellow; g.fillRect(s.x * cs - 1, s.y * cs - 1, cs + 2, cs + 2); },
    hud: (s) => ['掘れた割合 ' + Math.round(s.open / (s.n * s.n) * 100) + '%'] }),
  card({ s: 'dungeon', name: 'ダンジョン（部屋と通路）', tag: 'BSP · 領域を半分に割り続ける',
    desc: '四角い領域を縦か横にランダムな位置で2つに割る、を何回かくり返します（オレンジの線）。分けた領域の中に1つずつ部屋を置き、同じ親から分かれた部屋どうしを通路でつなぐと、ダンジョンになります。',
    init: (s) => { const R = s.rand, leaves = [], splits = [], corridors = [];
      const split = (r, d) => { const [x, y, w, h] = r; if (d === 0 || (w < 50 && h < 50)) { leaves.push(r); return r; }
        const vert = w > h ? true : h > w ? false : R() < .5; const k = .35 + R() * .3; let a, b;
        if (vert) { const cut = Math.round(w * k); a = [x, y, cut, h]; b = [x + cut, y, w - cut, h]; splits.push([x + cut, y, x + cut, y + h]); }
        else { const cut = Math.round(h * k); a = [x, y, w, cut]; b = [x, y + cut, w, h - cut]; splits.push([x, y + cut, x + w, y + cut]); }
        const ra = split(a, d - 1), rb = split(b, d - 1); const ca = centre(ra), cb = centre(rb); corridors.push([ca, cb]); return R() < .5 ? ra : rb; };
      const rooms = new Map(); const centre = (leaf) => { if (!rooms.has(leaf)) { const [x, y, w, h] = leaf, rw = Math.max(10, w * (.5 + R() * .35)), rh = Math.max(10, h * (.5 + R() * .35)), rx = x + 4 + R() * Math.max(0, w - rw - 8), ry = y + 4 + R() * Math.max(0, h - rh - 8); rooms.set(leaf, [rx, ry, Math.min(rw, w - 8), Math.min(rh, h - 8)]); } const r = rooms.get(leaf); return [r[0] + r[2] / 2, r[1] + r[3] / 2]; };
      split([4, 4, 232, 232], 4); s.leaves = leaves; s.splits = splits; s.rooms = [...rooms.values()]; s.cor = corridors; },
    draw: (g, s) => { g.fillStyle = '#10152a'; g.fillRect(0, 0, W, H); const t = s.t, ns = Math.min(s.splits.length, (t / 8) | 0);
      g.strokeStyle = 'rgba(240,165,74,.7)'; g.lineWidth = 1; g.setLineDash([3, 3]); for (let i = 0; i < ns; i++) { const [a, b, c, d] = s.splits[i]; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); } g.setLineDash([]);
      const t2 = t - s.splits.length * 8; if (t2 > 0) { g.fillStyle = '#2d3656'; const nr = Math.min(s.rooms.length, (t2 / 5) | 0 + 1);
        const t3 = t2 - s.rooms.length * 5; if (t3 > 0) { g.strokeStyle = '#2d3656'; g.lineWidth = 5; const nc = Math.min(s.cor.length, (t3 / 6) | 0 + 1); for (let i = 0; i < nc; i++) { const [a, b] = s.cor[i]; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
        for (let i = 0; i < nr; i++) { const [x, y, w, h] = s.rooms[i]; g.fillStyle = '#dfe6f5'; g.fillRect(x, y, w, h); }
        if (t3 > 0) { g.strokeStyle = '#dfe6f5'; g.lineWidth = 3; const nc = Math.min(s.cor.length, (t3 / 6) | 0 + 1); for (let i = 0; i < nc; i++) { const [a, b] = s.cor[i]; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } } } } }),
  card({ s: 'dungeon', name: '波動関数崩壊', tag: 'WFC · 一番迷っていないマスから決める',
    desc: '各マスは最初「どのタイルにもなれる」状態です。候補が一番少ないマスを1つ選んでタイルを決め、その結果、隣のマスで辺がつながらなくなる候補を消していきます。これをくり返すと、つじつまの合った配管や道路の地図ができあがります。',
    init: (s) => { const n = 12; s.n = n; s.all = (1 << 16) - 1; s.reset = () => { s.cand = new Uint32Array(n * n).fill(s.all); s.tile = new Int8Array(n * n).fill(-1); s.done = 0; }; s.reset();
      s.w = []; for (let m = 0; m < 16; m++) { const c = [0, 1, 2, 3].filter(b => m >> b & 1).length; s.w.push(m === 0 ? 2 : c === 1 ? .6 : c === 2 ? ((m === 5 || m === 10) ? 3 : 2.2) : c === 3 ? 1 : .6); } },
    step: (s) => { if (s.t % 2) return; const n = s.n; if (s.done >= n * n) { if (s.t % 200 === 0) s.reset(); return; }
      let best = -1, bc = 99; for (let i = 0; i < n * n; i++) { if (s.tile[i] >= 0) continue; let c = 0, m = s.cand[i]; while (m) { c += m & 1; m >>>= 1; } const x = i % n, y = (i / n) | 0; const edge = (x === 0 || y === 0 || x === n - 1 || y === n - 1) ? -.1 : 0; if (c + edge + s.rand() * .01 < bc) { bc = c + edge; best = i; } }
      if (best < 0) return; const opts = []; for (let m = 0; m < 16; m++) if (s.cand[best] >> m & 1) opts.push(m); if (!opts.length) { s.reset(); return; }
      let tot = opts.reduce((a, m) => a + s.w[m], 0), r = s.rand() * tot, pick = opts[0]; for (const m of opts) { r -= s.w[m]; if (r <= 0) { pick = m; break; } }
      s.tile[best] = pick; s.cand[best] = 1 << pick; s.done++;
      const q = [best]; while (q.length) { const i = q.pop(), x = i % n, y = (i / n) | 0;
        for (const [dx, dy, b, ob] of [[1, 0, 0, 2], [-1, 0, 2, 0], [0, 1, 1, 3], [0, -1, 3, 1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue; const j = ny * n + nx;
          let canOn = false, canOff = false; for (let m = 0; m < 16; m++) if (s.cand[i] >> m & 1) { if (m >> b & 1) canOn = true; else canOff = true; }
          let nc = 0; for (let m = 0; m < 16; m++) if (s.cand[j] >> m & 1) { const on = m >> ob & 1; if ((on && canOn) || (!on && canOff)) nc |= 1 << m; }
          if (nc !== s.cand[j]) { s.cand[j] = nc; q.push(j); } } } },
    draw: (g, s) => { const n = s.n, cs = W / n; g.fillStyle = '#10152a'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < n * n; i++) { const x = (i % n) * cs, y = ((i / n) | 0) * cs, t = s.tile[i];
        if (t < 0) { let c = 0, m = s.cand[i]; while (m) { c += m & 1; m >>>= 1; } g.fillStyle = `rgba(127,214,255,${.04 + (16 - c) * .02})`; g.fillRect(x + 1, y + 1, cs - 2, cs - 2); label(g, String(c), x + cs / 2, y + cs / 2 + 4, { size: 8.5, mono: true, align: 'center', color: 'rgba(160,170,200,.6)', weight: 400 }); continue; }
        g.fillStyle = '#1b2440'; g.fillRect(x, y, cs, cs); g.strokeStyle = '#4fe0ff'; g.lineWidth = 5; g.lineCap = 'round';
        const cx = x + cs / 2, cy = y + cs / 2; g.beginPath(); if (t & 1) { g.moveTo(cx, cy); g.lineTo(x + cs, cy); } if (t & 2) { g.moveTo(cx, cy); g.lineTo(cx, y + cs); } if (t & 4) { g.moveTo(cx, cy); g.lineTo(x, cy); } if (t & 8) { g.moveTo(cx, cy); g.lineTo(cx, y); } g.stroke();
        if ([1, 2, 4, 8].includes(t)) { g.fillStyle = '#4fe0ff'; g.beginPath(); g.arc(cx, cy, 4, 0, TAU); g.fill(); } } } }),

  /* misc */
  card({ s: 'misc', name: '名前の生成（マルコフ連鎖）', tag: '直前の2文字から次の1文字を選ぶ',
    desc: '実在の地名の読みを集め、「この2文字の次にはどの文字が来やすいか」を数えておきます。その確率に従って1文字ずつつなぐと、それっぽいけれど実在しない地名が生まれます。',
    init: (s) => { const src = 'ヤマガタ アキタ ミヤギ イワテ アオモリ フクシマ ニイガタ ナガノ ヤマナシ シズオカ ナゴヤ カナザワ トヤマ フクイ キョウト オオサカ ナラ ワカヤマ ヒメジ コウベ オカヤマ ヒロシマ マツヤマ コウチ トクシマ タカマツ サガ ナガサキ クマモト オオイタ ミヤザキ カゴシマ オキナワ サッポロ ハコダテ アサヒカワ クシロ オタル センダイ モリオカ ヨコハマ カマクラ チバ サイタマ ミト ウツノミヤ マエバシ タカサキ カワゴエ ナリタ イセ トバ クワナ ヒダ タカヤマ ハママツ ヌマヅ アタミ'.split(' ');
      const M = {}; for (const w of src) { const t = '^^' + w + '$'; for (let i = 2; i < t.length; i++) { const k = t.slice(i - 2, i); (M[k] = M[k] || []).push(t[i]); } }
      s.gen = () => { for (let tries = 0; tries < 50; tries++) { let k = '^^', out = ''; for (let i = 0; i < 8; i++) { const opts = M[k]; if (!opts) break; const c = opts[(s.rand() * opts.length) | 0]; if (c === '$') break; out += c; k = k[1] + c; } if (out.length >= 3 && !src.includes(out)) return out; } return 'ナナシ'; };
      s.list = Array.from({ length: 8 }, s.gen); s.n = src.length; },
    step: (s) => { if (s.t % 50 === 49) { s.list.shift(); s.list.push(s.gen()); } },
    draw: (g, s) => { g.fillStyle = '#10152a'; g.fillRect(0, 0, W, H); label(g, `学習した地名 ${s.n} 個 → 新しい地名`, 14, 24, { size: 10, color: COL.muted, weight: 500 });
      s.list.forEach((w, i) => { const a = i === 7 ? clamp((s.t % 50) / 12, 0, 1) : 1; g.globalAlpha = a * (.45 + i * .08); label(g, w, 20, 56 + i * 23, { size: 17, color: i === 7 ? COL.accent : COL.ink }); }); g.globalAlpha = 1; } }),
  card({ s: 'misc', name: '渦巻き銀河', tag: '対数らせん + ばらつき',
    desc: '星を数本の「らせんの腕」に沿って置き、腕からのずれを乱数で散らします。中心に近いほど速く回すと、腕がゆっくり巻きついていきます。',
    init: (s) => { s.S = []; const arms = 2 + ((s.rand() * 3) | 0); s.arms = arms; for (let i = 0; i < 2600; i++) { const r = Math.pow(s.rand(), 1.6) * 105 + 4, arm = (s.rand() * arms) | 0; const a = arm / arms * TAU + Math.log(r) * 1.9 + (s.rand() - .5) * (20 / r + .35); const d = (s.rand() - .5) * 10 * (1 - r / 120);
      const hot = s.rand(); s.S.push({ r: r + d, a, col: r < 25 ? [255, 230, 190] : hot < .12 ? [150, 190, 255] : hot < .2 ? [255, 160, 200] : [220, 225, 255], s: s.rand() < .05 ? 1.6 : .9 }); } },
    draw: (g, s) => { g.fillStyle = '#05060c'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(120, 120, 0, 120, 120, 40); gr.addColorStop(0, 'rgba(255,220,170,.5)'); gr.addColorStop(1, 'rgba(255,220,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (const st of s.S) { const a = st.a + s.t * .004 * (30 / (st.r + 10)), x = 120 + Math.cos(a) * st.r, y = 120 + Math.sin(a) * st.r * .62; g.fillStyle = `rgba(${st.col[0]},${st.col[1]},${st.col[2]},.7)`; g.fillRect(x, y, st.s, st.s); }
      g.globalCompositeOperation = 'source-over'; label(g, `腕 ${s.arms} 本`, 10, 20, { size: 11, color: COL.muted }); } }),
  card({ s: 'misc', name: '街の区画', tag: '区画を道路で割り続ける',
    desc: '大きな区画を道路で2つに割る、をくり返して街区を作り、それぞれの区画に高さの違う建物を並べます。ところどころを公園にするだけで、上空から見た街らしくなります。',
    init: (s) => { const R = s.rand, blocks = [], roads = [];
      const split = (r, d) => { const [x, y, w, h] = r; if (d === 0 || (w < 34 && h < 34)) { blocks.push(r); return; } const v = w > h ? true : h > w ? false : R() < .5, k = .3 + R() * .4, road = d > 3 ? 6 : d > 1 ? 4 : 3;
        if (v) { const c = w * k; roads.push([x + c - road / 2, y, road, h, d]); split([x, y, c - road / 2, h], d - 1); split([x + c + road / 2, y, w - c - road / 2, h], d - 1); }
        else { const c = h * k; roads.push([x, y + c - road / 2, w, road, d]); split([x, y, w, c - road / 2], d - 1); split([x, y + c + road / 2, w, h - c - road / 2], d - 1); } };
      split([0, 0, 240, 240], 6); s.blocks = blocks.map(b => { const park = R() < .1, lots = []; if (!park) { const [x, y, w, h] = b, nx = Math.max(1, (w / 14) | 0), ny = Math.max(1, (h / 14) | 0);
          for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1 || R() < .3) lots.push([x + 1.5 + i * w / nx, y + 1.5 + j * h / ny, w / nx - 3, h / ny - 3, R()]); } return { b, park, lots }; }); s.roads = roads; },
    draw: (g, s) => { g.fillStyle = '#3b4258'; g.fillRect(0, 0, W, H); const k = clamp(s.t / 90, 0, 1);
      for (const bl of s.blocks) { const [x, y, w, h] = bl.b; g.fillStyle = bl.park ? '#2f6a3a' : '#23283a'; g.fillRect(x, y, w, h);
        if (bl.park) { g.fillStyle = '#4f9a50'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + w * ((i * .37) % 1), y + h * ((i * .61) % 1), 3, 0, TAU); g.fill(); } }
        for (const [lx, ly, lw, lh, r] of bl.lots) { if (r > k * 1.2) continue; const v = 60 + r * 120; g.fillStyle = `rgb(${v * .75 | 0},${v * .8 | 0},${v | 0})`; g.fillRect(lx, ly, lw, lh); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(lx + lw * .6, ly + lh * .6, lw * .4, lh * .4); } }
      g.fillStyle = 'rgba(255,216,77,.12)'; for (const [x, y, w, h, d] of s.roads) if (d > 4) g.fillRect(x, y, w, h); } })
];

const SECTIONS = [
  { id: 'noise', en: 'Noise', title: 'ノイズ：なめらかな乱数', lead: '自動生成の土台になる「ノイズ」の作り方です。白黒の濃さが値の大きさを表します。' },
  { id: 'nature', en: 'Terrain & nature', title: '地形と自然', lead: 'ノイズを高さや密度として使い、地形や川、植物を作ります。' },
  { id: 'dungeon', en: 'Mazes & dungeons', title: '迷路とダンジョン', lead: '遊ぶ場所になるので、見た目だけでなく「必ずつながっている」ことが大事です。作る過程をそのまま動かしています。' },
  { id: 'misc', en: 'Other things', title: '名前・宇宙・街', lead: '同じ考え方で、言葉や天体や街並みも作れます。' }
];
run({ sections: SECTIONS, items: ITEMS, W, H, minCol: 300 });
series('procgen');

})();
