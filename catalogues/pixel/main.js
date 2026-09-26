/* ドット絵・2D技法図鑑 — card definitions. Runtime: assets/js/g2d.js */
(function () {
const { rng, clamp, lerp, COL, label, run, series, makeNoise } = G2D;
const W = 240, H = 240, TAU = Math.PI * 2;

/* ---------- sprite data (one character = one palette index, '.' = transparent) ---------- */
const HERO_BODY = [
  '......1111......',
  '....11222211....',
  '...1222222221...',
  '...1222222221...',
  '...1233333321...',
  '...1343333431...',
  '...1333333331...',
  '....13366331....',
  '.....111111.....',
  '....15555551....',
  '...1556666551...',
  '..131555555131..'
];
const LEGS = [
  ['...1155555511...', '....15511551....', '....17711771....', '....11111111....'],
  ['...1155555511...', '....1551.1551...', '...17711..1771..', '...1111...1111..'],
  ['...1155555511...', '....15511551....', '....17711771....', '....11111111....'],
  ['...1155555511...', '...1551..1551...', '..17711...1771..', '..1111....1111..']
];
const hero = (f = 0) => HERO_BODY.concat(LEGS[f]);
const HERO_PAL = { 1: '#1a1423', 2: '#9a4f2c', 3: '#f2c79b', 4: '#1a1423', 5: '#3b6fd8', 6: '#f0c040', 7: '#6b3e26' };
const SLIME = [
  '................',
  '......1111......',
  '....11222211....',
  '...1222222221...',
  '..122233222221..',
  '..122332222221..',
  '.12222222222221.',
  '.12211222211221.',
  '.12211222211221.',
  '.12222222222221.',
  '.12222444422221.',
  '..122222222221..',
  '...1111111111...'
];
const SLIME_PALS = {
  'みどり': { 1: '#10301a', 2: '#4fcf5a', 3: '#c8ffc0', 4: '#10301a' },
  'あお': { 1: '#101a40', 2: '#4f8cff', 3: '#d0e4ff', 4: '#101a40' },
  'あか': { 1: '#401010', 2: '#ff5a4a', 3: '#ffd0c8', 4: '#401010' },
  'メタル': { 1: '#202028', 2: '#a8b0c0', 3: '#ffffff', 4: '#202028' }
};
const SWORD = [
  '..............11',
  '.............1f1',
  '............1f1.',
  '...........1f1..',
  '..........1f1...',
  '.........1f1....',
  '........1f1.....',
  '...11..1f1......',
  '...1e11f1.......',
  '....1ee1........',
  '....1ee1........',
  '...1e11e1.......',
  '..1d1..1e1......',
  '.1d1....11......',
  '11..............',
  '................'
];
const SWORD_PAL = { 1: '#1a1423', d: '#6b3e26', e: '#f0c040', f: '#dfe6f5' };

/* ---------- helpers ---------- */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
function spr(rows, pal, override) { const h = rows.length, w = Math.max(...rows.map(r => r.length)); const [c, g] = canvas(w, h);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.' || ch === ' ') return; g.fillStyle = override || pal[ch] || '#f0f'; g.fillRect(x, y, 1, 1); })); return c; }
function put(g, c, x, y, s, flip) { g.imageSmoothingEnabled = false; if (flip) { g.save(); g.translate(x + c.width * s, y); g.scale(-1, 1); g.drawImage(c, 0, 0, c.width * s, c.height * s); g.restore(); } else g.drawImage(c, x, y, c.width * s, c.height * s); }
function bg(g, col = '#10152a') { g.fillStyle = col; g.fillRect(0, 0, W, H); }
function tag(g, text, x, y, o = {}) { label(g, text, x, y, Object.assign({ size: 10.5, bg: 'rgba(11,14,26,.8)' }, o)); }
const hx = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function pixbuf(w, h, fn) { const [c, g] = canvas(w, h), im = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, col = fn(x, y); if (!col) continue; im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = col[3] === undefined ? 255 : col[3]; } g.putImageData(im, 0, 0); return c; }
function bayer4(x, y) { const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; return (m[(y & 3) * 4 + (x & 3)] + .5) / 16; }
function mask(rows) { return rows.map(r => [...r].map(ch => ch !== '.' && ch !== ' ')); }

function card(o) {
  return { s: o.s, name: o.name, tag: o.tag, desc: o.desc, hint: o.hint, pixel: true, interactive: !!o.down,
    make: (env) => { const st = { t: 0, rand: env.rand }; if (o.init) o.init(st);
      return { step() { if (o.step) o.step(st); st.t++; }, draw(g) { o.draw(g, st); }, down(p) { if (o.down) o.down(st, p); }, hud() { return o.hud ? o.hud(st) : []; } }; } };
}

/* ---------- catalogue ---------- */
const ITEMS = [
  /* colour */
  card({ s: 'color', name: 'パレットスワップ', tag: '同じ絵 × 別のパレット',
    desc: '絵そのものは1枚で、「何番の色を使うか」の一覧だけを差し替えています。容量の少なかった時代に、少ないデータで敵の種類を増やすための定番の技法で、強い色違いの敵はこうして作られていました。',
    init: (s) => { s.S = Object.entries(SLIME_PALS).map(([k, p]) => [k, spr(SLIME, p)]); },
    draw: (g, s) => { bg(g); s.S.forEach(([k, c], i) => { const x = 20 + (i % 2) * 110, y = 22 + ((i / 2) | 0) * 110, bob = Math.round(Math.sin(s.t * .08 + i) * 1.5) * 5; put(g, c, x, y + bob + 8, 5); label(g, k, x + 40, y + 102, { size: 10.5, align: 'center', color: COL.muted }); }); } }),
  card({ s: 'color', name: 'カラーサイクル', tag: 'パレットの色だけを順番に回す',
    desc: '滝と川の画素は「水の1番〜6番の色」を指しているだけです。絵は1枚のまま、パレットの中身を毎フレームずらすと、水が流れているように見えます。絵を描き直す必要がないので、とても軽い技法でした。',
    init: (s) => { s.idx = new Int8Array(80 * 80).fill(-1); const R = rng(3);
      for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) { if (x >= 32 && x < 46 && y < 58) s.idx[y * 80 + x] = ((y >> 1) + (x % 3)) % 6; if (y >= 58 && y < 74) s.idx[y * 80 + x] = ((x >> 2) + (y % 2) * 2 + (R() < .1 ? 1 : 0)) % 6; }
      s.base = pixbuf(80, 80, (x, y) => { if (y < 58 && (x < 32 || x >= 46)) { const n = ((x * 7 + y * 13) % 11) / 11; return x < 32 ? [60 + n * 30, 52 + n * 20, 70 + n * 20] : [70 + n * 30, 60 + n * 20, 76 + n * 20]; } if (y >= 74) return [40, 90, 50]; return null; });
      s.water = ['#1d4e9e', '#2f6fd0', '#5a9cf0', '#a8d4ff', '#ffffff', '#5a9cf0'].map(hx); },
    draw: (g, s) => { bg(g, '#1a2240'); const off = (s.t / 5) | 0;
      const c = pixbuf(80, 80, (x, y) => { const i = s.idx[y * 80 + x]; if (i < 0) return null; return s.water[((i - off) % 6 + 6) % 6]; });
      g.imageSmoothingEnabled = false; g.drawImage(s.base, 0, 0, 240, 240); g.drawImage(c, 0, 0, 240, 240);
      s.water.forEach((cc, i) => { const k = ((i + off) % 6 + 6) % 6; g.fillStyle = `rgb(${s.water[k].join(',')})`; g.fillRect(150 + i * 13, 12, 11, 11); }); tag(g, 'パレット', 146, 38, { size: 9.5 }); } }),
  card({ s: 'color', name: 'ディザリング', tag: 'なし / 規則的 / 誤差拡散',
    desc: '4色しか使えないときの空のグラデーションです。左はそのまま塗り分けたので段差がはっきり見えます。中央は決まった模様で2色を混ぜ、右は近くのドットに誤差を分け合う方法（誤差拡散）で、離れて見るとなめらかな中間色に見えます。',
    init: (s) => { const P = ['#141c3c', '#2f4a8c', '#6f8fd0', '#c8d8f5'].map(hx), w = 20, h = 60;
      s.a = pixbuf(w, h, (x, y) => P[Math.min(3, (y / h * 4) | 0)]);
      s.b = pixbuf(w, h, (x, y) => P[clamp(Math.floor(y / h * 3 + bayer4(x, y)), 0, 3)]);
      const err = new Float32Array(w * h); for (let i = 0; i < w * h; i++) err[i] = ((i / w) | 0) / h * 3; const out = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, v = err[i], q = clamp(Math.round(v), 0, 3), e = v - q; out[i] = q; if (x + 1 < w) err[i + 1] += e * 7 / 16; if (y + 1 < h) { if (x) err[i + w - 1] += e * 3 / 16; err[i + w] += e * 5 / 16; if (x + 1 < w) err[i + w + 1] += e / 16; } }
      s.c = pixbuf(w, h, (x, y) => P[out[y * w + x]]); },
    draw: (g, s) => { bg(g); [s.a, s.b, s.c].forEach((c, i) => { g.imageSmoothingEnabled = false; g.drawImage(c, 8 + i * 78, 26, 68, 204); }); ['なし', '規則的', '誤差拡散'].forEach((t, i) => tag(g, t, 42 + i * 78, 18, { align: 'center', size: 10 })); } }),
  card({ s: 'color', name: '色数を減らす', tag: 'k-means 減色 · 16 → 8 → 4 → 2',
    desc: '夕焼けの絵を、使う色の数を減らして描き直しています。絵の中でよく使われている色を自動で選ぶ方法（k平均法）で、下の四角が選ばれた色です。色数が少ないほど、どの色を残すかの判断が絵の印象を決めます。',
    init: (s) => { const [c, g] = canvas(80, 80); let gr = g.createLinearGradient(0, 0, 0, 52); gr.addColorStop(0, '#2a1b4d'); gr.addColorStop(.55, '#d8577a'); gr.addColorStop(1, '#ffc46b'); g.fillStyle = gr; g.fillRect(0, 0, 80, 52);
      g.fillStyle = '#fff1b8'; g.beginPath(); g.arc(52, 46, 11, 0, TAU); g.fill(); g.fillStyle = '#3a2350'; g.beginPath(); g.moveTo(0, 50); g.lineTo(18, 34); g.lineTo(34, 48); g.lineTo(46, 40); g.lineTo(80, 54); g.lineTo(80, 80); g.lineTo(0, 80); g.fill();
      gr = g.createLinearGradient(0, 54, 0, 80); gr.addColorStop(0, '#6b3a5e'); gr.addColorStop(1, '#1b1433'); g.fillStyle = gr; g.fillRect(0, 56, 80, 24); g.fillStyle = 'rgba(255,220,150,.6)'; for (let y = 58; y < 78; y += 3) g.fillRect(44 + Math.sin(y) * 3, y, 16 - (y - 58) * .4, 1);
      const d = g.getImageData(0, 0, 80, 80).data, px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]); s.px = px; const R = rng(1);
      s.out = [16, 8, 4, 2].map(k => { let C = Array.from({ length: k }, () => px[(R() * px.length) | 0].slice()); const as = new Uint8Array(px.length);
        for (let it = 0; it < 12; it++) { const sum = C.map(() => [0, 0, 0, 0]); px.forEach((p, i) => { let b = 0, bd = 1e9; C.forEach((c, j) => { const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (dd < bd) { bd = dd; b = j; } }); as[i] = b; const q = sum[b]; q[0] += p[0]; q[1] += p[1]; q[2] += p[2]; q[3]++; }); C = C.map((c, j) => sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : c); }
        return { k, C, c: pixbuf(80, 80, (x, y) => C[as[y * 80 + x]]) }; }); },
    draw: (g, s) => { bg(g); const o = s.out[((s.t / 90) | 0) % 4]; g.imageSmoothingEnabled = false; g.drawImage(o.c, 20, 14, 200, 200); const sw = Math.min(12, 200 / o.k); o.C.forEach((c, i) => { g.fillStyle = `rgb(${c.map(v => v | 0).join(',')})`; g.fillRect(20 + i * sw, 220, sw - 1, 12); }); tag(g, o.k + ' 色', 26, 32, { size: 12 }); } }),
  card({ s: 'color', name: '手で入れるアンチエイリアス', tag: 'ジャギー vs 中間色のドット',
    desc: '左は「半分以上かかったドットだけ塗る」ので、ふちがギザギザ（ジャギー）です。右はふちのドットを、かかり具合に応じて2段階の中間色で塗っています。ドット絵では、この中間色を1つずつ手で置いてなめらかに見せます。',
    init: (s) => { const n = 28, cov = (x, y) => { let c = 0; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const px = x + (i + .5) / 4, py = y + (j + .5) / 4; const inC = Math.hypot(px - 14, py - 14) < 11; const inL = Math.abs(py - 26 + px * .45) < .8; if (inC || inL) c++; } return c / 16; };
      const bgc = [16, 21, 42], fg = [255, 200, 90], mid1 = [110, 90, 70], mid2 = [190, 150, 80];
      s.a = pixbuf(n, n, (x, y) => cov(x, y) >= .5 ? fg : bgc); s.b = pixbuf(n, n, (x, y) => { const c = cov(x, y); return c > .8 ? fg : c > .5 ? mid2 : c > .2 ? mid1 : bgc; }); },
    draw: (g, s) => { bg(g); g.imageSmoothingEnabled = false; g.drawImage(s.a, 6, 46, 112, 112); g.drawImage(s.b, 122, 46, 112, 112); tag(g, 'なし', 62, 36, { align: 'center' }); tag(g, 'あり', 178, 36, { align: 'center' });
      g.drawImage(s.a, 40, 180, 28, 28); g.drawImage(s.b, 156, 180, 28, 28); label(g, '実際の大きさ', 120, 228, { size: 9.5, align: 'center', color: COL.muted, weight: 500 }); } }),
  card({ s: 'color', name: '輪郭線の種類', tag: 'なし / 黒 / 色つき / 影',
    desc: '同じキャラクターに、輪郭線なし、真っ黒な輪郭線、隣の色を暗くした色つきの輪郭線（セルアウト）、1ドットずらした影を付けています。黒い線はくっきり、色つきの線はやわらかい印象になります。',
    init: (s) => { const body = hero(0).map(r => r.replace(/1/g, '.')), m = mask(body), h = body.length, w = 16;
      const base = spr(body, HERO_PAL);
      const around = (fn) => pixbuf(w + 2, h + 2, (x, y) => { const ix = x - 1, iy = y - 1; if (m[iy] && m[iy][ix]) return null; let hit = null; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = ix + dx, ny = iy + dy; if (m[ny] && m[ny][nx]) { hit = body[ny][nx]; break; } } return hit ? fn(hit) : null; });
      const dark = (ch) => hx(HERO_PAL[ch]).map(v => v * .45);
      s.v = [[base, null], [base, around(() => [20, 16, 30])], [base, around(dark)], [base, 'shadow']]; },
    draw: (g, s) => { bg(g); s.v.forEach(([b, o], i) => { const x = 18 + (i % 2) * 114, y = 16 + ((i / 2) | 0) * 112;
      if (o === 'shadow') { const sh = spr(hero(0).map(r => r.replace(/1/g, '.')), HERO_PAL, 'rgba(0,0,0,.55)'); put(g, sh, x + 5 + 5, y + 5 + 5, 5); }
      else if (o) put(g, o, x, y, 5); put(g, b, x + 5, y + 5, 5); label(g, ['なし', '黒い線', '色つきの線', '影'][i], x + 45, y + 104, { size: 10, align: 'center', color: COL.muted }); }); } }),

  /* animation */
  card({ s: 'anim', name: '歩きのアニメーション', tag: '4 コマのくり返し',
    desc: '足の位置だけが違う4枚の絵を順番に切り替えています。1コマを8フレーム（約0.13秒）ずつ見せ、2枚目と4枚目で足を大きく開きます。下の小さな絵が4枚のコマで、枠がいま表示中のコマです。',
    init: (s) => { s.F = [0, 1, 2, 3].map(f => spr(hero(f), HERO_PAL)); },
    draw: (g, s) => { bg(g, '#1a2240'); const f = ((s.t / 8) | 0) % 4, bob = f % 2 ? -5 : 0; g.fillStyle = '#2a3a5a'; g.fillRect(0, 150, W, 90); g.fillStyle = '#3b5078'; for (let x = -((s.t * 2) % 30); x < W; x += 30) g.fillRect(x, 150, 14, 4);
      put(g, s.F[f], 72, 54 + bob, 6); s.F.forEach((c, i) => { put(g, c, 26 + i * 50, 176, 2); if (i === f) { g.strokeStyle = COL.accent; g.lineWidth = 2; g.strokeRect(22 + i * 50, 172, 40, 40); } }); } }),
  card({ s: 'anim', name: '待機アニメーション', tag: '1ドットの呼吸 + まばたき',
    desc: '左はまったく動かない立ち絵、右は体を1ドットだけ上下させ、ときどきまばたきさせています。たった1ドットの動きで、キャラクターが生きているように見えます。',
    init: (s) => { s.a = spr(hero(0), HERO_PAL); s.blink = spr(hero(0).map((r, i) => i === 5 ? '...1333333331...' : r), HERO_PAL); s.up = spr(hero(0).slice(0, 12).concat(['...1155555511...', '....15511551....', '....17711771....', '....11111111....']), HERO_PAL); },
    draw: (g, s) => { bg(g); g.fillStyle = '#232b45'; g.fillRect(0, 180, W, 60); put(g, s.a, 12, 80, 6);
      const ph = s.t % 60, down = ph >= 30 ? 6 : 0, blink = s.t % 200 > 190; const c = blink ? s.blink : s.a;
      g.save(); g.beginPath(); g.rect(124, 0, 116, 150 + 6 * 12 - 12 + down); g.clip(); put(g, c, 124, 80 + down, 6); g.restore();
      g.save(); g.beginPath(); g.rect(124, 80 + 6 * 12 + down, 116, 200); g.clip(); put(g, s.a, 124, 80, 6); g.restore();
      tag(g, '動かない', 60, 30, { align: 'center' }); tag(g, '呼吸・まばたき', 172, 30, { align: 'center' }); } }),
  card({ s: 'anim', name: 'サブピクセルの動き', tag: '1ドット未満の移動を濃淡で表す',
    desc: 'どちらもゆっくり右へ動いています。上は位置を丸めて1ドット単位で動くので、カクッ、カクッと跳びます。下はドットにかかる割合で濃さを変えているので、1ドットより小さい動きもなめらかに見えます。',
    draw: (g, s) => { bg(g); const x = 4 + ((s.t * .06) % 36), n = 48, h = 18;
      const draw1 = (y0, smooth) => { const c = pixbuf(n, h, (px, py) => { let cov = 0; const ox = smooth ? x : Math.round(x); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const sx = px + (i + .5) / 4, sy = py + (j + .5) / 4; if (Math.hypot(sx - ox - 4, sy - 9) < 3.6) cov++; } cov /= 16; return [lerp(22, 255, cov), lerp(28, 210, cov), lerp(50, 90, cov)]; });
        g.imageSmoothingEnabled = false; g.drawImage(c, 0, y0, 240, 90); };
      draw1(20, false); draw1(130, true); tag(g, '1ドット単位', 8, 16); tag(g, 'サブピクセル', 8, 126); } }),
  card({ s: 'anim', name: 'スミア（ぶれの絵）', tag: '速い動きの途中に引き伸ばした絵を挟む',
    desc: '速く投げたボールは1フレームで大きく移動するので、上ではボールが飛び飛びに見えます。下は移動中のコマだけ、ボールを進む向きに引き伸ばした「ぶれの絵」に差し替えています。アニメでもよく使われる工夫です。',
    draw: (g, s) => { bg(g); const ph = s.t % 60, step = (ph / 3) | 0, pos = [4, 4, 4, 18, 34, 50, 60, 60, 60][Math.min(step, 8)];
      const draw1 = (y0, smear) => { g.fillStyle = '#232b45'; g.fillRect(0, y0 + 78, 240, 6);
        const moving = step >= 3 && step <= 5; const c = pixbuf(60, 20, (px, py) => { const inBall = Math.hypot(px + .5 - pos, py + .5 - 10) < 4; const inSm = smear && moving && py >= 7 && py <= 12 && px + .5 > pos - 14 && px + .5 < pos && Math.abs(py + .5 - 10) < 3.5 - (pos - px) * .2; return inBall ? [255, 216, 77] : inSm ? [255, 170, 60] : null; });
        g.imageSmoothingEnabled = false; g.drawImage(c, 0, y0, 240, 80); };
      draw1(10, false); draw1(126, true); tag(g, 'スミアなし', 8, 22); tag(g, 'スミアあり', 8, 138); } }),
  card({ s: 'anim', name: 'ダメージの点滅', tag: '白に差し替え → 点滅',
    desc: 'ダメージを受けた瞬間、パレットを全部白に差し替えて2フレーム光らせ、その後は一定間隔で消したり出したりして無敵時間を示します。専用の絵を描かずに、パレットと表示の切り替えだけで表現しています。',
    init: (s) => { s.n = spr(hero(0), HERO_PAL); s.w = spr(hero(0), HERO_PAL, '#ffffff'); s.r = spr(hero(0), { 1: '#401018', 2: '#ff6a6a', 3: '#ffb0a0', 4: '#401018', 5: '#ff5a6a', 6: '#ffd0a0', 7: '#a03030' }); },
    draw: (g, s) => { bg(g); g.fillStyle = '#232b45'; g.fillRect(0, 186, W, 54); const ph = s.t % 110; let c = s.n, vis = true, kx = 0;
      if (ph < 3) c = s.w; else if (ph < 7) c = s.r; if (ph < 50 && ph >= 7) vis = ((ph >> 2) & 1) === 0; if (ph < 12) kx = -ph * 1.2;
      if (vis) put(g, c, 72 + kx, 90, 6);
      tag(g, ph < 3 ? '白く光る' : ph < 7 ? '赤くなる' : ph < 50 ? '点滅（無敵）' : 'ふつう', 120, 40, { align: 'center', size: 12 }); } }),
  card({ s: 'anim', name: '回転とドットの崩れ', tag: '最近傍で回転 vs なめらかに回転',
    desc: 'ドット絵をそのまま回転させると、左のように線が太ったり欠けたりして崩れます。右のように色を混ぜて回すとぼやけてしまいます。多くのドット絵ゲームでは、必要な角度の絵をあらかじめ手で描いています。',
    init: (s) => { s.sw = spr(SWORD, SWORD_PAL); },
    draw: (g, s) => { bg(g); const a = s.t * .012, n = 24;
      const [c1, g1] = canvas(n, n); const src = s.sw.getContext('2d').getImageData(0, 0, 16, 16).data, im = g1.createImageData(n, n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const dx = x + .5 - n / 2, dy = y + .5 - n / 2, sx = Math.floor(Math.cos(-a) * dx - Math.sin(-a) * dy + 8), sy = Math.floor(Math.sin(-a) * dx + Math.cos(-a) * dy + 8);
        if (sx < 0 || sy < 0 || sx >= 16 || sy >= 16) continue; const o = (sy * 16 + sx) * 4, q = (y * n + x) * 4; for (let k = 0; k < 4; k++) im.data[q + k] = src[o + k]; }
      g1.putImageData(im, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(c1, 4, 60, 112, 112);
      const [c2, g2] = canvas(n, n); g2.imageSmoothingEnabled = true; g2.translate(n / 2, n / 2); g2.rotate(a); g2.drawImage(s.sw, -8, -8); g.drawImage(c2, 124, 60, 112, 112);
      tag(g, '最近傍', 60, 40, { align: 'center' }); tag(g, 'なめらか', 180, 40, { align: 'center' }); } }),

  /* screen */
  card({ s: 'screen', name: '多重スクロール', tag: '奥の層ほどゆっくり動かす',
    desc: '空・遠くの山・近くの丘・木・地面を別々の層に分け、奥の層ほどゆっくりスクロールさせています。平面の絵を重ねているだけなのに、奥行きが感じられます。',
    init: (s) => { const R = rng(9); s.L = [[.1, '#3a3060', 40, 10, 12], [.3, '#4a4a80', 52, 7, 20], [.6, '#2d5a4a', 60, 5, 36], [1, '#1f3d2e', 66, 3, 60]].map(([sp, col, base, amp, per]) => { const hs = []; for (let i = 0; i < 160; i++) hs.push(base - amp * Math.abs(Math.sin(i / per * 7 + R() * .3)) - (R() * 2 | 0)); return { sp, col, hs }; }); },
    draw: (g, s) => { const [c, gg] = canvas(80, 80); const gr = gg.createLinearGradient(0, 0, 0, 60); gr.addColorStop(0, '#1b1840'); gr.addColorStop(1, '#e07a6a'); gg.fillStyle = gr; gg.fillRect(0, 0, 80, 80);
      gg.fillStyle = '#ffe0a0'; gg.fillRect(56, 30, 6, 6);
      for (const l of s.L) { gg.fillStyle = l.col; const off = s.t * .5 * l.sp; for (let x = 0; x < 80; x++) { const h = l.hs[Math.floor(x + off) % 160]; gg.fillRect(x, h | 0, 1, 80 - h); } }
      gg.fillStyle = '#6b4a2e'; gg.fillRect(0, 72, 80, 8); gg.fillStyle = '#8a6a44'; for (let x = -(s.t * .5 % 8); x < 80; x += 8) gg.fillRect(x, 72, 4, 1);
      g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, 240, 240); } }),
  card({ s: 'screen', name: 'ラスタースクロール', tag: '1行ごとに横へずらす量を変える',
    desc: '画面を横1行ずつ描くときに、行ごとにずらす量を変えています。水面の反射の部分だけ、行ごとに sin 関数でゆらゆら揺らしました。昔のゲーム機が画面を1行ずつ描いていたことを利用した技法です。',
    init: (s) => { const [c, g] = canvas(80, 40); const gr = g.createLinearGradient(0, 0, 0, 40); gr.addColorStop(0, '#12103a'); gr.addColorStop(1, '#f08a5d'); g.fillStyle = gr; g.fillRect(0, 0, 80, 40);
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(40, 30, 8, 0, TAU); g.fill(); g.fillStyle = '#2a1e40'; g.beginPath(); g.moveTo(0, 40); g.lineTo(0, 30); g.lineTo(10, 26); g.lineTo(22, 34); g.lineTo(30, 40); g.fill(); g.beginPath(); g.moveTo(80, 40); g.lineTo(80, 28); g.lineTo(66, 32); g.lineTo(56, 40); g.fill(); s.sky = c; },
    draw: (g, s) => { const [c, gg] = canvas(80, 80); gg.drawImage(s.sky, 0, 0);
      for (let y = 0; y < 40; y++) { const off = Math.round(Math.sin(y * .5 + s.t * .08) * (1 + y * .08)); gg.drawImage(s.sky, 0, 39 - y, 80, 1, off, 40 + y, 80, 1); }
      gg.fillStyle = 'rgba(20,30,80,.35)'; gg.fillRect(0, 40, 80, 40); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, 240, 240); } }),
  card({ s: 'screen', name: '擬似3Dの床（モード7風）', tag: '行ごとに奥行きを計算して床の絵を読む',
    desc: '平らな床の絵を、画面の下の行ほど近く、上の行ほど遠くとして、行ごとに拡大率を変えて読み出しています。カメラを回転・前進させると、1枚の絵が奥へ広がる地面に見えます。スーパーファミコンのレースゲームなどで使われた方法です。',
    init: (s) => { const n = 64; s.tex = new Uint8Array(n * n * 3); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = (y * n + x) * 3, road = Math.abs(Math.hypot(x - 32, y - 32) - 20) < 5, edge = Math.abs(Math.hypot(x - 32, y - 32) - 20) < 6 && !road, ch = ((x >> 3) + (y >> 3)) & 1;
      const c = road ? [96, 96, 110] : edge ? ((x + y) & 2 ? [230, 60, 60] : [240, 240, 240]) : ch ? [62, 150, 72] : [52, 128, 62]; s.tex.set(c, o); } },
    draw: (g, s) => { const w = 96, h = 96, hor = 34, [c, gg] = canvas(w, h), im = gg.createImageData(w, h), a = s.t * .01, cx = 32 + Math.cos(a) * 20, cy = 32 + Math.sin(a) * 20, dir = a + Math.PI / 2, ca = Math.cos(dir), sa = Math.sin(dir);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (y <= hor) { const k = y / hor; im.data[o] = lerp(40, 240, k); im.data[o + 1] = lerp(60, 170, k); im.data[o + 2] = lerp(140, 150, k); im.data[o + 3] = 255; continue; }
        const z = 520 / (y - hor), sx = (x - w / 2) / w * z * 1.4; const wx = cx + ca * (z - 8) - sa * sx, wy = cy + sa * (z - 8) + ca * sx; const tx = ((wx % 64) + 64) % 64 | 0, ty = ((wy % 64) + 64) % 64 | 0, t = (ty * 64 + tx) * 3, fog = clamp((y - hor) / 30, .25, 1);
        im.data[o] = s.tex[t] * fog; im.data[o + 1] = s.tex[t + 1] * fog; im.data[o + 2] = s.tex[t + 2] * fog + 40 * (1 - fog); im.data[o + 3] = 255; }
      gg.putImageData(im, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, 240, 240); } }),
  card({ s: 'screen', name: 'オートタイル', tag: '上下左右の4マスを見て形を選ぶ',
    desc: '地図の作り手は「ここは水」と置くだけで、各マスの上下左右が水かどうか（16通り）を調べて、岸の形のタイルを自動で選んでいます。2秒ごとに「そのまま」と「オートタイル」を切り替えています。',
    hint: 'クリックで水と草を切り替え',
    init: (s) => { const n = 12; s.n = n; const noise = makeNoise(s.rand); s.m = new Uint8Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) s.m[y * n + x] = noise.fbm(x * .22 + 3, y * .22 + 1, 3) > .05 ? 1 : 0; },
    down: (s, p) => { const x = (p.x / 20) | 0, y = (p.y / 20) | 0; if (x < s.n && y < s.n) s.m[y * s.n + x] ^= 1; },
    draw: (g, s) => { const n = s.n, cs = 20, auto = ((s.t / 120) | 0) % 2 === 1, at = (x, y) => x < 0 || y < 0 || x >= n || y >= n ? 1 : s.m[y * n + x];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const X = x * cs, Y = y * cs; g.fillStyle = '#4a9a4a'; g.fillRect(X, Y, cs, cs); g.fillStyle = '#6ab85a'; g.fillRect(X + 4, Y + 5, 2, 2); g.fillRect(X + 13, Y + 12, 2, 2);
        if (!s.m[y * n + x]) continue;
        if (!auto) { g.fillStyle = '#2f6fd0'; g.fillRect(X, Y, cs, cs); continue; }
        const u = at(x, y - 1), d = at(x, y + 1), l = at(x - 1, y), r = at(x + 1, y), b = 4;
        g.fillStyle = '#e3d08a'; g.fillRect(X, Y, cs, cs); g.fillStyle = '#2f6fd0';
        g.fillRect(X + (l ? 0 : b), Y + (u ? 0 : b), cs - (l ? 0 : b) - (r ? 0 : b), cs - (u ? 0 : b) - (d ? 0 : b));
        g.fillStyle = '#5a9cf0'; if (!u) g.fillRect(X + (l ? 0 : b), Y + b, cs - (l ? 0 : b) - (r ? 0 : b), 2); }
      tag(g, auto ? 'オートタイル' : 'そのまま', 8, 18); } }),
  card({ s: 'screen', name: '重なり順（Yソート）', tag: '足もとが下にあるものほど後から描く',
    desc: '見下ろし型の画面では、画面の下にいるものほど手前にあるように見せたいので、足もとの高さの順に並べ替えてから描きます。並べ替えないと、木の手前を通るはずのスライムが木の後ろに隠れてしまいます。',
    init: (s) => { s.sl = spr(SLIME, SLIME_PALS['みどり']); s.tr = spr(['....1111....', '..11222211..', '.1222322221.', '122232222221', '122222232221', '.1223222221.', '..11222211..', '....1441....', '....1441....', '....1441....', '...114411...', '............'], { 1: '#0e2a14', 2: '#3d8a3a', 3: '#7ccf6a', 4: '#6b3e26' });
      s.trees = [[40, 50], [140, 40], [90, 110], [180, 120], [50, 170], [150, 190]]; s.S = [0, 1, 2].map(i => ({ ph: i * 2.1, r: 50 + i * 12 })); },
    draw: (g, s) => { bg(g, '#3b7a3b'); const sort = ((s.t / 150) | 0) % 2 === 1;
      const obj = s.trees.map(([x, y]) => ({ y: y + 33, d: () => put(g, s.tr, x - 18, y, 3) }));
      const sl = s.S.map(o => { const x = 120 + Math.cos(s.t * .012 + o.ph) * o.r * 1.1, y = 120 + Math.sin(s.t * .017 + o.ph) * o.r; return { y: y + 26, d: () => put(g, s.sl, x - 16, y, 2) }; });
      const list = sort ? obj.concat(sl).sort((a, b) => a.y - b.y) : sl.concat(obj); for (const o of list) o.d();
      tag(g, sort ? '並べ替えあり' : '並べ替えなし（木を常に後から）', 8, 18); } }),

  /* display */
  card({ s: 'display', name: '拡大のしかた', tag: '最近傍 vs 補間',
    desc: '同じ16ドットの絵を7倍に拡大しています。左は一番近いドットの色をそのまま使う方法（最近傍）で、くっきりした四角のまま。右は周りの色を混ぜる方法で、ぼやけます。ドット絵は左の方法で拡大します。',
    init: (s) => { s.h = spr(hero(0), HERO_PAL); },
    draw: (g, s) => { bg(g); g.imageSmoothingEnabled = false; g.drawImage(s.h, 2, 60, 112, 112); g.imageSmoothingEnabled = true; g.drawImage(s.h, 126, 60, 112, 112); g.imageSmoothingEnabled = false;
      tag(g, '最近傍', 58, 44, { align: 'center' }); tag(g, '補間', 182, 44, { align: 'center' }); } }),
  card({ s: 'display', name: '整数倍でない拡大', tag: '×2 / ×2.5 / ×3',
    desc: '2倍や3倍ならすべてのドットが同じ大きさになります。2.5倍にすると、2つ分になるドットと3つ分になるドットが混ざり、線の太さや目の大きさがばらばらになります。ドット絵のゲームが画面を整数倍で拡大したがる理由です。',
    init: (s) => { s.h = spr(hero(0), HERO_PAL); s.ck = pixbuf(16, 4, (x, y) => (x + y) & 1 ? [230, 230, 240] : [40, 50, 80]); },
    draw: (g, s) => { bg(g); g.imageSmoothingEnabled = false; [2, 2.5, 3].forEach((k, i) => { const x = 8 + i * 78; const w = Math.floor(16 * k), h2 = Math.floor(16 * k); g.drawImage(s.h, x, 40, w, h2); g.drawImage(s.ck, x, 150, Math.floor(16 * k), Math.floor(4 * k)); tag(g, '×' + k, x + 20, 30, { align: 'center' }); });
      label(g, '市松模様のマスの幅に注目', 120, 220, { size: 9.5, align: 'center', color: COL.muted, weight: 500 }); } }),
  card({ s: 'display', name: 'ブラウン管とドット絵', tag: 'にじみ + 走査線',
    desc: '左はドットをそのまま、右はブラウン管テレビのにじみと走査線を再現したものです。1ドットおきに2色を並べた部分（ディザ）は、ブラウン管ではにじんで混ざり、中間色に見えます。当時の絵師はこれを前提に描いていました。',
    init: (s) => { s.c = pixbuf(30, 60, (x, y) => { if (y < 20) return (x + y) & 1 ? [40, 60, 180] : [230, 120, 60]; if (y < 40) return (x & 1) ? [240, 240, 240] : [20, 20, 30]; const sp = spr(hero(0), HERO_PAL); return null; });
      const [c, g] = canvas(30, 60); g.drawImage(s.c, 0, 0); g.drawImage(spr(hero(0), HERO_PAL), 7, 42); s.c = c; },
    draw: (g, s) => { bg(g); g.imageSmoothingEnabled = false; g.drawImage(s.c, 4, 0, 112, 224);
      const [c, gg] = canvas(112, 224); gg.imageSmoothingEnabled = true; gg.filter = 'blur(1.3px)'; gg.drawImage(s.c, 0, 0, 112, 224); gg.filter = 'none';
      gg.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < 224; y += 3.73) gg.fillRect(0, y, 112, 1.3);
      for (let x = 0; x < 112; x += 3) { gg.fillStyle = 'rgba(255,0,0,.06)'; gg.fillRect(x, 0, 1, 224); gg.fillStyle = 'rgba(0,255,0,.06)'; gg.fillRect(x + 1, 0, 1, 224); gg.fillStyle = 'rgba(0,0,255,.06)'; gg.fillRect(x + 2, 0, 1, 224); }
      g.drawImage(c, 124, 0); tag(g, 'そのまま', 60, 236, { align: 'center', size: 10 }); tag(g, 'ブラウン管風', 180, 236, { align: 'center', size: 10 }); } })
];

const SECTIONS = [
  { id: 'color', en: 'Colour', title: '色の技法', lead: '使える色の数が限られているからこそ生まれた工夫です。どれも「絵が色そのものではなく、パレットの何番かを覚えている」ことを活かしています。' },
  { id: 'anim', en: 'Animation', title: '動かし方', lead: '少ないコマ数と小さな絵で、動きを豊かに見せる工夫です。' },
  { id: 'screen', en: 'Backgrounds', title: '背景と画面づくり', lead: '平面の絵を重ねたり、行ごとに加工したりして、奥行きや動きを作ります。' },
  { id: 'display', en: 'Display', title: '拡大と表示', lead: '小さなドット絵を大きな画面に映すときの問題と、ブラウン管の時代の見え方です。' }
];
run({ sections: SECTIONS, items: ITEMS, W, H, minCol: 300 });
series('pixel');

})();
