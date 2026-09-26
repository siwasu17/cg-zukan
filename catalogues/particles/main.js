/* パーティクル・エフェクト図鑑 — card definitions. Runtime: assets/js/g2d.js */
(function () {
const { rng, clamp, lerp, ease, COL, label, run, series } = G2D;
const W = 240, H = 240, TAU = Math.PI * 2, DEG = Math.PI / 180;

/* ---------- colour ramps ---------- */
function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function ramp(stops) {
  const S = stops.map(([t, c, a]) => [t, hex(c), a === undefined ? 1 : a]);
  return (t) => {
    if (t <= S[0][0]) return [...S[0][1], S[0][2]];
    for (let i = 1; i < S.length; i++) if (t <= S[i][0]) { const [t0, c0, a0] = S[i - 1], [t1, c1, a1] = S[i], k = (t - t0) / (t1 - t0 || 1); return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k), lerp(a0, a1, k)]; }
    const l = S[S.length - 1]; return [...l[1], l[2]];
  };
}
const rgba = (c, a = c[3]) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;

/* soft round sprites, one per step along a colour ramp */
function softSprites(fn, n = 24) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = fn(i / (n - 1)), cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(.35, rgba(c, .75)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); out.push(cv);
  }
  return out;
}

/* ---------- emitter configs & particle system ---------- */
function E(o) {
  const c = Object.assign({ life: [40, 60], speed: [1, 2], angle: -90, spread: 30, g: 0, drag: 1, size: [4, 0], shape: 'dot', blend: 'source-over', spin: [0, 0], area: null, stretch: 3, sizeEase: null }, o);
  c.col = ramp(o.colors || [[0, '#ffffff', 1], [1, '#ffffff', 0]]);
  if (c.shape === 'soft') c.spr = softSprites(c.col);
  return c;
}
class PS {
  constructor(rand) { this.L = []; this.rand = rand; this.t = 0; }
  spawn(c, x, y, n = 1, over = {}) {
    const R = this.rand;
    for (let i = 0; i < n; i++) {
      let px = x, py = y;
      const A = over.area || c.area;
      if (A) {
        if (A.type === 'line') { px += (R() - .5) * A.w; }
        else if (A.type === 'rect') { px += (R() - .5) * A.w; py += (R() - .5) * A.h; }
        else if (A.type === 'circle') { const a = R() * TAU, r = A.r * Math.sqrt(A.fill ? R() : 1); px += Math.cos(a) * r; py += Math.sin(a) * r * (A.sy || 1); }
      }
      const ang = ((over.angle !== undefined ? over.angle : c.angle) + (R() - .5) * c.spread) * DEG;
      const sp = lerp(c.speed[0], c.speed[1], R());
      this.L.push({ c, x: px, y: py, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, age: 0, life: lerp(c.life[0], c.life[1], R()) | 0,
        rot: R() * TAU, spin: lerp(c.spin[0], c.spin[1], R()), seed: R() * 100, sm: over.sizeMul || 1 });
    }
  }
  emit(c, x, y, rate, over) { c._acc = (c._acc || 0) + rate; const n = c._acc | 0; c._acc -= n; if (n) this.spawn(c, x, y, n, over); }
  step() {
    this.t++;
    const L = this.L;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i], c = p.c; p.age++;
      p.vx *= c.drag; p.vy = p.vy * c.drag + c.g;
      if (c.force) c.force(p, this);
      p.x += p.vx; p.y += p.vy; p.rot += p.spin;
      if (c.floor !== undefined && p.y > c.floor) {
        if (c.onFloor === 'bounce') { p.y = c.floor; p.vy *= -.35; p.vx *= .7; }
        else { if (c.onFloor) c.onFloor(p, this); p.age = p.life + 1; }
      }
      if (p.age > p.life) { if (c.onDeath) c.onDeath(p, this); L[i] = L[L.length - 1]; L.pop(); }
    }
  }
  draw(g) {
    let mode = '';
    for (const p of this.L) {
      const c = p.c, t = p.age / p.life;
      if (c.blend !== mode) { g.globalCompositeOperation = mode = c.blend; }
      const st = c.sizeEase ? c.sizeEase(t) : t, s = lerp(c.size[0], c.size[1], st) * p.sm;
      if (s <= 0) continue;
      if (c.shape === 'soft') { const k = Math.min(c.spr.length - 1, (t * c.spr.length) | 0), a = c.col(t)[3]; g.globalAlpha = clamp(a, 0, 1); g.drawImage(c.spr[k], p.x - s, p.y - s, s * 2, s * 2); g.globalAlpha = 1; continue; }
      const col = c.col(t), a = clamp(col[3] * (c.blink ? .5 + .5 * Math.sin(p.age * .15 + p.seed) : 1), 0, 1);
      g.fillStyle = g.strokeStyle = rgba(col, a);
      switch (c.shape) {
        case 'dot': g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.fill(); break;
        case 'square': g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-s, -s, s * 2, s * 2); g.restore(); break;
        case 'spark': { const v = Math.hypot(p.vx, p.vy) || 1; g.lineWidth = s; g.lineCap = 'round'; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / v * v * c.stretch, p.y - p.vy / v * v * c.stretch); g.stroke(); break; }
        case 'ring': g.lineWidth = c.lw || 2; g.beginPath(); g.ellipse(p.x, p.y, s, s * (c.sy || 1), 0, 0, TAU); g.stroke(); break;
        case 'plus': g.fillRect(p.x - s, p.y - s * .3, s * 2, s * .6); g.fillRect(p.x - s * .3, p.y - s, s * .6, s * 2); break;
        case 'star': g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? s * .42 : s, an = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); } g.fill(); g.restore(); break;
        case 'twinkle': g.save(); g.translate(p.x, p.y); g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(0, 0, s, 0); g.quadraticCurveTo(0, 0, 0, s); g.quadraticCurveTo(0, 0, -s, 0); g.quadraticCurveTo(0, 0, 0, -s); g.fill(); g.restore(); break;
        case 'petal': g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, .45 + .4 * Math.sin(p.age * .12 + p.seed)); g.beginPath(); g.ellipse(0, 0, s, s * .55, 0, 0, TAU); g.fill(); g.restore(); break;
        case 'flake': g.lineWidth = .9; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath(); for (let k = 0; k < 3; k++) { g.rotate(Math.PI / 3); g.moveTo(-s, 0); g.lineTo(s, 0); } g.stroke(); g.restore(); break;
        case 'drop': g.lineWidth = 1.2; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6); g.stroke(); break;
        case 'bubble': g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.stroke(); g.fillStyle = rgba([255, 255, 255], a * .8); g.beginPath(); g.arc(p.x - s * .35, p.y - s * .35, s * .22, 0, TAU); g.fill(); break;
      }
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }
  get n() { return this.L.length; }
}

function bg(g, top = '#10142a', bot = '#080a12') { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
function floor(g, y, col = '#1d2338') { g.fillStyle = col; g.fillRect(0, y, W, H - y); g.fillStyle = '#2d3656'; g.fillRect(0, y, W, 1.5); }
const wob = (amp, f) => (p) => { p.vx += Math.sin(p.age * f + p.seed) * amp; };

/* generic card factory */
function fx(o) {
  return {
    s: o.s, name: o.name, tag: o.tag, desc: o.desc, hint: o.hint, interactive: !!o.down, warm: o.warm === undefined ? 90 : o.warm,
    make: (env) => {
      const ps = new PS(env.rand), st = { ps, rand: env.rand, t: 0 };
      if (o.init) o.init(st);
      return {
        step() { o.step(st); ps.step(); st.t++; },
        draw(g) { (o.back || ((g) => bg(g)))(g, st); ps.draw(g); if (o.front) o.front(g, st); },
        down(p) { if (o.down) o.down(st, p); },
        move(p) { if (o.move) o.move(st, p); },
        leave() { if (o.leave) o.leave(st); },
        hud() { return ['粒 ' + ps.n].concat(o.hud ? o.hud(st) : []); }
      };
    }
  };
}

/* ---------- shared configs ---------- */
const FIRE = () => E({ life: [28, 48], speed: [.6, 1.6], angle: -90, spread: 24, g: -.035, drag: .985, size: [13, 2], shape: 'soft', blend: 'lighter', area: { type: 'line', w: 28 },
  colors: [[0, '#fff3c4', .9], [.2, '#ffd84d', .85], [.5, '#ff7a2a', .55], [1, '#5a140c', 0]], force: (p, s) => { p.vx += (s.rand() - .5) * .16; } });
const EMBER = () => E({ life: [50, 90], speed: [.8, 2], angle: -90, spread: 40, g: -.02, drag: .99, size: [1.4, .3], shape: 'dot', blend: 'lighter',
  colors: [[0, '#ffe08a', 1], [1, '#ff5a1f', 0]], force: (p, s) => { p.vx += Math.sin(p.age * .1 + p.seed) * .05; } });

const ITEMS = [
  /* ----- building blocks ----- */
  fx({ s: 'basic', name: '放出の基本', tag: 'rate · life · speed · angle',
    desc: '1フレームに2個ずつ、上向き±15°の範囲に、ばらばらの速さで粒を出しています。どの粒も60フレーム（1秒）で消えるので、画面には常に約120個の粒があります。',
    init: (s) => { s.c = E({ life: [60, 60], speed: [2.4, 3.6], angle: -90, spread: 30, g: .08, size: [3, 3], colors: [[0, '#4fe0ff', 1], [1, '#4fe0ff', 1]] }); },
    step: (s) => s.ps.emit(s.c, 120, 205, 2),
    back: (g) => { bg(g); floor(g, 208); },
    hud: () => ['rate 2 / frame', 'life 60 frames'] }),
  fx({ s: 'basic', name: '寿命で色と大きさを変える', tag: 'color & size over life',
    desc: '粒の「生まれてからの時間 ÷ 寿命」を0〜1の値にして、それに応じて色と大きさを変えています。白く生まれて、黄色、赤、紫へと変わりながら小さくなり、透明になって消えます。',
    init: (s) => { s.c = E({ life: [70, 70], speed: [.4, 1.4], angle: 0, spread: 360, size: [9, 0], shape: 'dot', blend: 'lighter',
      colors: [[0, '#ffffff', 1], [.25, '#ffd84d', 1], [.55, '#ff5470', .9], [1, '#6b3cff', 0]] }); },
    step: (s) => s.ps.emit(s.c, 120, 105, 1.5),
    front: (g, s) => { const x0 = 40, w = 160, y = 200; for (let i = 0; i < w; i++) { g.fillStyle = rgba(s.c.col(i / w)); g.fillRect(x0 + i, y, 1, 8); }
      label(g, '生まれたとき', x0, y + 22, { size: 9.5, color: COL.muted, weight: 500 }); label(g, '消えるとき', x0 + w, y + 22, { size: 9.5, color: COL.muted, weight: 500, align: 'right' }); } }),
  fx({ s: 'basic', name: '重力と空気抵抗', tag: 'vy += g · v × drag',
    desc: '左から「重力なし」「重力あり」「重力＋空気抵抗」。同じ向き・同じ速さで出しても、毎フレーム下向きの速さを足すと弧を描き、速さに0.95をかけ続けると失速してふわっと落ちます。',
    init: (s) => { s.cs = [
      E({ life: [70, 70], speed: [3, 3.4], angle: -65, spread: 8, size: [2.5, 2.5], colors: [[0, '#4fe0ff', 1], [1, '#4fe0ff', .2]] }),
      E({ life: [70, 70], speed: [3, 3.4], angle: -65, spread: 8, g: .1, size: [2.5, 2.5], colors: [[0, '#ffd84d', 1], [1, '#ffd84d', .2]] }),
      E({ life: [70, 70], speed: [3, 3.4], angle: -65, spread: 8, g: .1, drag: .95, size: [2.5, 2.5], colors: [[0, '#ff7ad9', 1], [1, '#ff7ad9', .2]] })]; },
    step: (s) => { s.cs.forEach((c, i) => s.ps.emit(c, 20 + i * 75, 200, .5)); },
    back: (g) => { bg(g); floor(g, 203); ['なし', '重力', '重力+抵抗'].forEach((t, i) => label(g, t, 20 + i * 75, 222, { size: 9.5, color: COL.muted, weight: 500 })); } }),
  fx({ s: 'basic', name: '加算合成と普通の合成', tag: "'source-over' vs 'lighter'",
    desc: '左右とも同じ炎の粒です。左は普通に上から塗り重ね、右は色を足し算します。足し算では重なった中心ほど白く明るくなり、光っているように見えます。',
    init: (s) => { s.a = FIRE(); s.b = FIRE(); s.a.blend = 'source-over'; },
    step: (s) => { s.ps.emit(s.a, 65, 190, 3); s.ps.emit(s.b, 175, 190, 3); },
    back: (g) => { bg(g); floor(g, 196); label(g, '普通', 65, 222, { size: 10, align: 'center', color: COL.muted }); label(g, '加算', 175, 222, { size: 10, align: 'center', color: COL.muted }); } }),
  fx({ s: 'basic', name: '放出する形', tag: 'point / line / circle / ring',
    desc: '粒をどこから出すかで、同じ粒でも見た目が変わります。1点、線、円の内側、円周の4つを順番に切り替えています。',
    init: (s) => { s.c = E({ life: [40, 60], speed: [.2, .8], angle: -90, spread: 60, g: -.01, size: [3, 0], shape: 'soft', blend: 'lighter', colors: [[0, '#ffffff', 1], [.4, '#4fe0ff', .8], [1, '#5b8cff', 0]] }); },
    step: (s) => { const k = ((s.t / 120) | 0) % 4; s.k = k;
      const A = [null, { type: 'line', w: 150 }, { type: 'circle', r: 60, fill: true }, { type: 'circle', r: 70 }][k]; s.ps.emit(s.c, 120, 115, 4, { area: A }); },
    front: (g, s) => label(g, ['1点', '線', '円の内側', '円周'][s.k || 0], 120, 24, { size: 12, align: 'center' }) }),
  fx({ s: 'basic', name: '粒の数', tag: 'rate 0.2 / 1 / 5',
    desc: '同じ炎を、出す量だけ変えて並べました。少ないと粒がばらばらに見え、多いほど1つのかたまりに見えます。ただし粒が増えるほど計算も重くなります。',
    init: (s) => { s.cs = [FIRE(), FIRE(), FIRE()]; s.cs.forEach(c => c.area = { type: 'line', w: 16 }); },
    step: (s) => { [.25, 1, 5].forEach((r, i) => s.ps.emit(s.cs[i], 40 + i * 80, 185, r)); },
    back: (g) => { bg(g); floor(g, 190); ['少ない', 'ふつう', '多い'].forEach((t, i) => label(g, t, 40 + i * 80, 215, { size: 10, align: 'center', color: COL.muted })); } }),

  /* ----- nature ----- */
  fx({ s: 'nature', name: '炎', tag: 'soft · lighter · buoyancy',
    desc: 'ぼんやりした丸い粒を加算合成で重ね、上向きに浮かせながら、白→黄→橙→暗い赤と色を変えて小さくしています。横方向に小さなランダムな揺れを足し、別の火の粉の粒も混ぜています。',
    hint: 'クリックで場所を動かせる',
    init: (s) => { s.f = FIRE(); s.e = EMBER(); s.x = 120; },
    step: (s) => { s.ps.emit(s.f, s.x, 188, 3.2); s.ps.emit(s.e, s.x, 185, .25); },
    down: (s, p) => { s.x = clamp(p.x, 30, 210); },
    back: (g, s) => { bg(g); floor(g, 196); g.fillStyle = '#4a2c1a'; g.save(); g.translate(s.x, 194); g.rotate(.25); g.fillRect(-26, -5, 52, 9); g.rotate(-.5); g.fillRect(-26, -5, 52, 9); g.restore(); } }),
  fx({ s: 'nature', name: '煙', tag: 'normal blend · grow · wind',
    desc: '煙は光らないので普通の合成で描きます。生まれたときは小さく、だんだん大きく薄くなり、風で横に流れます。最初の数フレームを透明にしておくと、煙突から自然に湧き出して見えます。',
    warm: 200,
    init: (s) => { s.c = E({ life: [130, 170], speed: [.5, .9], angle: -90, spread: 16, drag: .995, size: [5, 34], spin: [-.01, .01], shape: 'soft',
      colors: [[0, '#8b93a8', 0], [.08, '#8b93a8', .42], [1, '#474d5c', 0]], force: (p) => { p.vx += .012; } }); },
    step: (s) => s.ps.emit(s.c, 80, 170, .55),
    back: (g) => { bg(g, '#1a2034', '#0c0f19'); floor(g, 210, '#141a2c'); g.fillStyle = '#2a3150'; g.fillRect(72, 172, 16, 38); g.fillStyle = '#3a4468'; g.fillRect(70, 170, 20, 5); } }),
  fx({ s: 'nature', name: '雨', tag: 'streak + splash on floor',
    desc: '雨粒は速く落ちる短い線です。地面に届いた粒は消えて、その場所から小さなしぶきの粒を2〜3個跳ね上げます。粒が別の粒を生むのは、エフェクトではよく使う方法です。',
    init: (s) => { s.splash = E({ life: [10, 18], speed: [.8, 1.8], angle: -90, spread: 120, g: .15, size: [1.1, .6], colors: [[0, '#b7d6ff', .9], [1, '#b7d6ff', 0]] });
      s.c = E({ life: [80, 80], speed: [7, 9], angle: 100, spread: 3, size: [1, 1], shape: 'drop', area: { type: 'line', w: 300 }, floor: 212, colors: [[0, '#8fb4ff', .7], [1, '#8fb4ff', .7]],
        onFloor: (p, ps) => { if (ps.rand() < .7) ps.spawn(s.splash, p.x, 211, 2); } }); },
    step: (s) => s.ps.emit(s.c, 140, -10, 3),
    back: (g) => { bg(g, '#141a2a', '#0a0d16'); floor(g, 212, '#161c2e'); } }),
  fx({ s: 'nature', name: '雪', tag: 'slow fall + sway',
    desc: 'ゆっくり落ちる粒に、sin関数で左右の揺れを足しています。大きさと速さをばらつかせると、手前と奥の雪が混ざっているように見えます。',
    warm: 400,
    init: (s) => { s.c = E({ life: [420, 420], speed: [.25, .7], angle: 90, spread: 20, size: [1.6, 1.6], shape: 'flake', spin: [-.02, .02], area: { type: 'line', w: 260 }, floor: 220,
      colors: [[0, '#ffffff', .95], [1, '#dfe8ff', .9]], force: (p) => { p.x += Math.sin(p.age * .03 + p.seed) * .35; } });
      s.d = E({ life: [420, 420], speed: [.2, .5], angle: 90, spread: 20, size: [1, 1], shape: 'dot', area: { type: 'line', w: 260 }, floor: 220, colors: [[0, '#ffffff', .6], [1, '#ffffff', .5]], force: (p) => { p.x += Math.sin(p.age * .02 + p.seed) * .25; } }); },
    step: (s) => { s.ps.emit(s.c, 120, -6, .35); s.ps.emit(s.d, 120, -6, .5); },
    back: (g) => { bg(g, '#1b2440', '#0e1224'); g.fillStyle = '#dfe6f5'; g.beginPath(); g.moveTo(0, 222); g.quadraticCurveTo(60, 212, 120, 220); g.quadraticCurveTo(180, 228, 240, 216); g.lineTo(240, 240); g.lineTo(0, 240); g.fill(); } }),
  fx({ s: 'nature', name: '桜吹雪', tag: 'petal · spin · gust',
    desc: '花びらの形の粒を回転させ、縦方向の大きさを周期的に変えて、ひらひら裏返っているように見せています。風は時間とともに強弱が変わります。',
    warm: 300,
    init: (s) => { s.c = E({ life: [260, 320], speed: [.6, 1.4], angle: 25, spread: 40, size: [3.6, 3], shape: 'petal', spin: [-.06, .06], area: { type: 'rect', w: 40, h: 240 },
      colors: [[0, '#ffc6dc', .95], [1, '#ff9cc4', 0]], force: (p, ps) => { p.vx += (Math.sin(ps.t * .015) + 1) * .012; p.vy += Math.sin(p.age * .05 + p.seed) * .02; } }); },
    step: (s) => s.ps.emit(s.c, -20, 100, .5),
    back: (g) => bg(g, '#1c1a33', '#0d0c18') }),
  fx({ s: 'nature', name: '泡', tag: 'rise · wobble · pop',
    desc: '下から浮かぶ泡は、左右に揺れながら上り、寿命が来たときに小さな輪を残して弾けます。消えるときに別の粒を出すと「消えた理由」が見えます。',
    warm: 200,
    init: (s) => { s.pop = E({ life: [8, 10], speed: [0, 0], size: [2, 7], shape: 'ring', lw: 1, colors: [[0, '#bfefff', .9], [1, '#bfefff', 0]] });
      s.c = E({ life: [80, 170], speed: [.6, 1.1], angle: -90, spread: 10, size: [2, 6], shape: 'bubble', area: { type: 'line', w: 180 },
        colors: [[0, '#8fdcff', .8], [1, '#8fdcff', .8]], force: (p) => { p.x += Math.sin(p.age * .08 + p.seed) * .4; }, onDeath: (p, ps) => ps.spawn(s.pop, p.x, p.y, 1, { sizeMul: p.sm }) }); },
    step: (s) => s.ps.emit(s.c, 120, 236, .3),
    back: (g) => bg(g, '#0b3350', '#051526') }),
  fx({ s: 'magic', name: '蛍', tag: 'wander · blink',
    desc: '寿命の長い少数の粒が、少しずつ向きを変えながらさまよい、明るさをゆっくり点滅させます。数を増やすより、動きをゆっくりにするほうが雰囲気が出ます。',
    warm: 60,
    init: (s) => { s.c = E({ life: [99999, 99999], speed: [.2, .4], angle: 0, spread: 360, size: [7, 7], shape: 'soft', blend: 'lighter', colors: [[0, '#d6ff7a', .9], [1, '#d6ff7a', .9]],
      force: (p, ps) => { p.vx += (ps.rand() - .5) * .05; p.vy += (ps.rand() - .5) * .05; const v = Math.hypot(p.vx, p.vy); if (v > .5) { p.vx *= .5 / v; p.vy *= .5 / v; }
        if (p.x < 10 || p.x > 230) p.vx *= -1; if (p.y < 30 || p.y > 200) p.vy *= -1; p.sm = .35 + .65 * Math.max(0, Math.sin(p.age * .04 + p.seed)); } });
      s.ps.spawn(s.c, 120, 120, 26, { area: { type: 'rect', w: 200, h: 150 } }); },
    step: () => {},
    back: (g) => { bg(g, '#0a1420', '#05080d'); g.fillStyle = '#060a10'; for (let i = 0; i < 9; i++) { const x = i * 30 + 5; g.beginPath(); g.moveTo(x - 18, 240); g.lineTo(x, 150 + (i % 3) * 18); g.lineTo(x + 18, 240); g.fill(); } } }),

  /* ----- combat ----- */
  fx({ s: 'combat', name: '爆発', tag: 'flash + shockwave + fireball + debris + smoke',
    desc: '5種類の粒を同時に出しています。一瞬の白い閃光、広がる輪（衝撃波）、火の玉、飛び散る破片、最後に残る煙。1種類だけでは爆発に見えず、重ねると急に「それらしく」なります。',
    hint: 'クリックした場所で爆発する', warm: 30,
    init: (s) => {
      s.flash = E({ life: [8, 8], speed: [0, 0], size: [40, 70], shape: 'soft', blend: 'lighter', colors: [[0, '#ffffff', 1], [1, '#ffd84d', 0]] });
      s.ring = E({ life: [22, 22], speed: [0, 0], size: [6, 78], shape: 'ring', lw: 3, sizeEase: ease.outCubic, colors: [[0, '#fff3c4', .9], [1, '#ff9f43', 0]] });
      s.fire = E({ life: [22, 40], speed: [.6, 2.8], angle: 0, spread: 360, drag: .92, g: -.02, size: [16, 3], shape: 'soft', blend: 'lighter', colors: [[0, '#fff3c4', 1], [.3, '#ffb347', .9], [.7, '#ff4d2e', .5], [1, '#401008', 0]] });
      s.debris = E({ life: [40, 70], speed: [3, 7], angle: 0, spread: 360, drag: .97, g: .14, size: [1.6, .8], shape: 'spark', stretch: 2.2, blend: 'lighter', floor: 214, onFloor: 'bounce', colors: [[0, '#ffffff', 1], [.4, '#ffd84d', 1], [1, '#ff5a1f', 0]] });
      s.smoke = E({ life: [90, 130], speed: [.3, 1.2], angle: 0, spread: 360, drag: .96, g: -.012, size: [8, 30], shape: 'soft', colors: [[0, '#555b6b', 0], [.2, '#555b6b', .55], [1, '#3a3f4c', 0]] });
      s.boom = (x, y) => { s.ps.spawn(s.smoke, x, y, 12); s.ps.spawn(s.fire, x, y, 26); s.ps.spawn(s.debris, x, y, 34); s.ps.spawn(s.ring, x, y, 1); s.ps.spawn(s.flash, x, y, 1); s.shake = 6; };
      s.shake = 0; },
    step: (s) => { if (s.t % 110 === 0) s.boom(120, 150); s.shake *= .85; },
    down: (s, p) => s.boom(p.x, p.y),
    back: (g, s) => { g.translate((s.rand() - .5) * s.shake, (s.rand() - .5) * s.shake); bg(g); floor(g, 214); } }),
  fx({ s: 'combat', name: '火花', tag: 'spark streak · bounce',
    desc: '速さの向きに引き伸ばした線（ストリーク）を粒にすると、速く飛ぶ火花になります。地面に当たると勢いを失いながら跳ね返ります。',
    hint: 'クリックで場所を動かせる',
    init: (s) => { s.x = 120; s.c = E({ life: [30, 55], speed: [2.5, 6], angle: -60, spread: 60, g: .2, drag: .98, size: [1.5, .8], shape: 'spark', stretch: 2, blend: 'lighter', floor: 210, onFloor: 'bounce',
      colors: [[0, '#ffffff', 1], [.3, '#ffe08a', 1], [1, '#ff5a1f', 0]] }); },
    step: (s) => { const x = s.x + Math.sin(s.t * .03) * 20; s.px = x; s.ps.emit(s.c, x, 150, 4); },
    down: (s, p) => { s.x = clamp(p.x, 40, 200); },
    back: (g, s) => { bg(g); floor(g, 210); g.fillStyle = '#9aa3b8'; g.save(); g.translate(s.px || 120, 150); g.rotate(-.5); g.fillRect(-4, -30, 8, 30); g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill(); g.restore(); } }),
  fx({ s: 'combat', name: '斬撃', tag: 'crescent + particles along the arc',
    desc: '三日月形の太い弧を一瞬だけ描き、その弧に沿って粒をばらまいています。弧は時間とともに細く透明になり、粒だけが少し残ります。',
    hint: 'クリックでもう一度斬る', warm: 20,
    init: (s) => { s.age = 99; s.c = E({ life: [16, 30], speed: [.3, 1.4], angle: 0, spread: 360, drag: .9, size: [2.2, 0], shape: 'dot', blend: 'lighter', colors: [[0, '#ffffff', 1], [1, '#4fe0ff', 0]] }); s.dir = 1; },
    step: (s) => { if (s.t % 55 === 0) { s.age = 0; s.dir *= -1; } s.age++;
      if (s.age < 8) { const a0 = -2.4, a1 = .8, k = s.age / 8, a = lerp(a0, a1, k); const x = 120 + Math.cos(a) * 70 * s.dir, y = 120 + Math.sin(a) * 70; s.ps.spawn(s.c, x, y, 6); } },
    down: (s) => { s.age = 0; },
    front: (g, s) => { if (s.age > 16) return; const k = Math.min(1, s.age / 8), fade = s.age < 8 ? 1 : 1 - (s.age - 8) / 8, a0 = -2.4, a1 = lerp(a0, .8, ease.outCubic(k));
      g.save(); g.translate(120, 120); g.scale(s.dir, 1); g.globalCompositeOperation = 'lighter';
      const N = 24; g.beginPath(); for (let i = 0; i <= N; i++) { const a = lerp(a0, a1, i / N); g.lineTo(Math.cos(a) * 72, Math.sin(a) * 72); }
      for (let i = N; i >= 0; i--) { const a = lerp(a0, a1, i / N), th = Math.sin(i / N * Math.PI) * 18 * fade; g.lineTo(Math.cos(a) * (72 - th), Math.sin(a) * (72 - th)); }
      g.closePath(); g.fillStyle = `rgba(160,235,255,${.85 * fade})`; g.fill(); g.restore(); g.globalCompositeOperation = 'source-over'; } }),
  fx({ s: 'combat', name: '稲妻', tag: 'midpoint displacement',
    desc: '始点と終点を結ぶ線の真ん中を横にずらし、できた2本の線でまた同じことをくり返すと、ギザギザの稲妻になります（中点変位法）。途中から枝も伸ばし、落ちた場所から火花を出しています。',
    hint: 'クリックした場所に落ちる', warm: 10,
    init: (s) => { s.bolts = []; s.flash = 0; s.c = E({ life: [15, 30], speed: [1, 3.5], angle: -90, spread: 150, g: .15, size: [1.3, .6], shape: 'spark', stretch: 1.5, blend: 'lighter', floor: 214, onFloor: 'bounce', colors: [[0, '#ffffff', 1], [1, '#7fb4ff', 0]] });
      const split = (a, b, d, out) => { if (d === 0) { out.push(b); return; } const m = [(a[0] + b[0]) / 2 + (s.rand() - .5) * Math.hypot(b[0] - a[0], b[1] - a[1]) * .45, (a[1] + b[1]) / 2]; split(a, m, d - 1, out); split(m, b, d - 1, out); };
      s.strike = (x) => { const pts = [[120 + (s.rand() - .5) * 40, -5]]; split(pts[0], [x, 214], 6, pts); const br = [];
        for (let k = 0; k < 3; k++) { const i = 8 + ((s.rand() * 40) | 0), st = pts[i], e = [st[0] + (s.rand() - .5) * 90, st[1] + 30 + s.rand() * 50], bp = [st]; split(st, e, 4, bp); br.push(bp); }
        s.bolts.push({ pts, br, age: 0 }); s.flash = 1; s.ps.spawn(s.c, x, 212, 20); }; },
    step: (s) => { if (s.t % 70 === 0) s.strike(60 + s.rand() * 120); s.bolts.forEach(b => b.age++); s.bolts = s.bolts.filter(b => b.age < 16); s.flash *= .8; },
    down: (s, p) => s.strike(clamp(p.x, 10, 230)),
    back: (g, s) => { bg(g, '#141a33', '#07090f'); g.fillStyle = `rgba(160,190,255,${s.flash * .25})`; g.fillRect(0, 0, W, H); floor(g, 214); },
    front: (g, s) => { g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';
      for (const b of s.bolts) { const k = (1 - b.age / 16) * (b.age % 4 < 2 ? 1 : .6);
        const path = (P) => { g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); };
        path(b.pts); g.strokeStyle = `rgba(90,140,255,${.35 * k})`; g.lineWidth = 9; g.stroke(); g.strokeStyle = `rgba(190,215,255,${.8 * k})`; g.lineWidth = 3.5; g.stroke(); g.strokeStyle = `rgba(255,255,255,${k})`; g.lineWidth = 1.4; g.stroke();
        for (const bp of b.br) { path(bp); g.strokeStyle = `rgba(160,190,255,${.6 * k})`; g.lineWidth = 1.2; g.stroke(); } }
      g.globalCompositeOperation = 'source-over'; } }),
  fx({ s: 'combat', name: '衝撃波', tag: 'ground ring + dust',
    desc: '地面に落ちた衝撃を、地面に沿って広がる楕円の輪と、横に吹き飛ぶ砂煙、跳ね上がる小石で表しています。輪を楕円にするだけで、地面の上に広がっているように見えます。',
    hint: 'クリックでもう一度', warm: 20,
    init: (s) => { s.ring = E({ life: [26, 26], speed: [0, 0], size: [6, 100], shape: 'ring', sy: .28, lw: 3, sizeEase: ease.outCubic, colors: [[0, '#ffffff', .9], [1, '#9fc4ff', 0]] });
      s.ring2 = E({ life: [34, 34], speed: [0, 0], size: [4, 70], shape: 'ring', sy: .28, lw: 1.5, sizeEase: ease.outCubic, colors: [[0, '#ffffff', .7], [1, '#9fc4ff', 0]] });
      s.dust = E({ life: [40, 70], speed: [1.5, 4], angle: 0, spread: 20, drag: .93, g: -.01, size: [5, 16], shape: 'soft', colors: [[0, '#8d8471', .5], [1, '#5a5446', 0]] });
      s.rock = E({ life: [40, 60], speed: [2, 4.5], angle: -90, spread: 70, g: .2, size: [1.8, 1.8], shape: 'square', spin: [-.2, .2], floor: 196, onFloor: 'bounce', colors: [[0, '#b7ae96', 1], [1, '#b7ae96', .6]] });
      s.hit = () => { s.ps.spawn(s.ring, 120, 190, 1); s.ps.spawn(s.ring2, 120, 190, 1); s.ps.spawn(s.dust, 120, 190, 10, { angle: 0 }); s.ps.spawn(s.dust, 120, 190, 10, { angle: 180 }); s.ps.spawn(s.rock, 120, 188, 14); s.drop = 0; }; s.drop = 99; },
    step: (s) => { if (s.t % 90 === 60) s.drop = 0; if (s.drop < 99) { s.drop++; if (s.drop === 12) s.hit(); } },
    down: (s) => { s.drop = 0; },
    back: (g, s) => { bg(g); g.fillStyle = '#1d2338'; g.beginPath(); g.ellipse(120, 205, 170, 30, 0, 0, TAU); g.fill(); g.fillRect(0, 205, W, 40);
      if (s.drop < 12) { const y = lerp(20, 184, ease.inQuad(s.drop / 12)); g.fillStyle = '#c9cfdf'; g.fillRect(108, y - 12, 24, 20); } } }),

  /* ----- magic & UI ----- */
  fx({ s: 'magic', name: '魔法陣', tag: 'rotating rings + rising motes',
    desc: '回転する円や多角形、目盛りを楕円に押しつぶして地面に置き、その内側から光る粒を上へ浮かせています。円と粒の色をそろえると、ひとつの魔法に見えます。',
    init: (s) => { s.c = E({ life: [50, 90], speed: [.3, .9], angle: -90, spread: 10, g: -.01, size: [2.5, 0], shape: 'soft', blend: 'lighter', area: { type: 'circle', r: 70, fill: true, sy: .32 }, colors: [[0, '#ffffff', 1], [.3, '#c7a4ff', .9], [1, '#6b3cff', 0]] }); },
    step: (s) => s.ps.emit(s.c, 120, 175, 2),
    back: (g, s) => { bg(g, '#130f24', '#07060c'); const t = s.t;
      g.save(); g.translate(120, 175); g.scale(1, .32); g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(181,123,255,.8)'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 80, 0, TAU); g.stroke(); g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 68, 0, TAU); g.stroke();
      g.rotate(t * .01); for (let i = 0; i < 48; i++) { g.rotate(TAU / 48); g.fillStyle = 'rgba(199,164,255,.8)'; g.fillRect(70, -1, i % 4 ? 4 : 8, 2); }
      g.rotate(-t * .025); g.strokeStyle = 'rgba(79,224,255,.8)'; g.lineWidth = 1.6;
      for (let k = 0; k < 2; k++) { g.beginPath(); for (let i = 0; i <= 3; i++) { const a = i * TAU / 3 + k * Math.PI; g.lineTo(Math.cos(a) * 62, Math.sin(a) * 62); } g.stroke(); }
      g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.stroke(); g.restore(); g.globalCompositeOperation = 'source-over'; } }),
  fx({ s: 'magic', name: '回復', tag: 'plus signs + rising ring',
    desc: '十字の形の粒を、キャラクターの周りから上へふわっと浮かべ、足もとから輪を上に広げています。緑色と上向きの動きだけで「回復」と伝わります。',
    hint: 'クリックでもう一度', warm: 40,
    init: (s) => { s.plus = E({ life: [40, 70], speed: [.5, 1.2], angle: -90, spread: 20, drag: .98, size: [4, 2], shape: 'plus', area: { type: 'circle', r: 26, fill: true, sy: .5 }, blend: 'lighter', colors: [[0, '#b8ffcf', 1], [1, '#35d07a', 0]] });
      s.glow = E({ life: [40, 60], speed: [.4, 1], angle: -90, spread: 20, size: [5, 0], shape: 'soft', area: { type: 'circle', r: 30, fill: true, sy: .4 }, blend: 'lighter', colors: [[0, '#b8ffcf', .8], [1, '#35d07a', 0]] });
      s.ring = E({ life: [40, 40], speed: [0, 0], size: [10, 40], shape: 'ring', sy: .3, lw: 2, colors: [[0, '#b8ffcf', .9], [1, '#35d07a', 0]], force: (p) => { p.y -= 1.2; } });
      s.go = 0; },
    step: (s) => { if (s.t % 100 === 0) s.go = 50; if (s.go > 0) { s.go--; s.ps.emit(s.plus, 120, 175, .5); s.ps.emit(s.glow, 120, 185, 1.5); if (s.go % 16 === 0) s.ps.spawn(s.ring, 120, 195, 1); } },
    down: (s) => { s.go = 50; },
    back: (g) => { bg(g); floor(g, 196); g.fillStyle = '#7fd6ff'; g.beginPath(); g.roundRect ? g.roundRect(108, 170, 24, 26, 6) : g.rect(108, 170, 24, 26); g.fill(); g.fillStyle = '#0b0e1a'; g.fillRect(122, 178, 3, 5); g.fillRect(127, 178, 3, 5); } }),
  fx({ s: 'magic', name: 'アイテム取得', tag: 'star burst + ring + sparkle',
    desc: '取った瞬間に星が勢いよく飛び出して急ブレーキ（空気抵抗を強く）し、同時に輪が広がり、きらめきが少し残ります。アイテム自体は大きくなりながら消えます。',
    hint: 'クリックでもう一度', warm: 30,
    init: (s) => { s.star = E({ life: [30, 45], speed: [3, 5], angle: 0, spread: 360, drag: .86, size: [5, 0], shape: 'star', spin: [-.2, .2], blend: 'lighter', colors: [[0, '#fff6c2', 1], [1, '#ffd84d', 0]] });
      s.ring = E({ life: [18, 18], speed: [0, 0], size: [8, 46], shape: 'ring', lw: 2.5, sizeEase: ease.outCubic, colors: [[0, '#ffffff', 1], [1, '#ffd84d', 0]] });
      s.tw = E({ life: [20, 40], speed: [.2, .6], angle: 0, spread: 360, size: [4, 0], shape: 'twinkle', blend: 'lighter', area: { type: 'circle', r: 40, fill: true }, colors: [[0, '#ffffff', 1], [1, '#ffffff', 0]] });
      s.got = 99; },
    step: (s) => { if (s.t % 80 === 20) s.got = 0; if (s.got === 0) { s.ps.spawn(s.star, 120, 120, 12); s.ps.spawn(s.ring, 120, 120, 1); } if (s.got < 30) s.ps.emit(s.tw, 120, 120, .6); s.got++; },
    down: (s) => { s.got = 0; },
    back: (g, s) => { bg(g); const k = s.got < 99 ? clamp(s.got / 14, 0, 1) : 0; const bob = Math.sin(s.t * .08) * 3;
      if (s.got > 60 || s.got >= 99) { g.globalAlpha = s.got >= 99 ? 1 : clamp((s.got - 60) / 15, 0, 1); drawCoin(g, 120, 120 + bob, 1); g.globalAlpha = 1; }
      else if (k < 1) { g.globalAlpha = 1 - k; drawCoin(g, 120, 120 - k * 16, 1 + k * .8); g.globalAlpha = 1; } } }),
  fx({ s: 'magic', name: 'チャージ', tag: 'attract to center → burst',
    desc: '周りから粒を中心へ吸い寄せ（中心に向かう力をだんだん強く）、中心の光を大きくしていきます。溜めきったところで一気に外へ放出します。',
    hint: 'クリックで放出', warm: 60,
    init: (s) => { s.charge = 0;
      s.c = E({ life: [40, 60], speed: [0, .3], angle: 0, spread: 360, size: [2, 1], shape: 'spark', stretch: 3, blend: 'lighter', area: { type: 'circle', r: 95 }, colors: [[0, '#4fe0ff', 0], [.2, '#bff4ff', 1], [1, '#ffffff', 1]],
        force: (p) => { const dx = 120 - p.x, dy = 120 - p.y, d = Math.hypot(dx, dy) || 1; const f = .12 + p.age * .004; p.vx += dx / d * f; p.vy += dy / d * f; if (d < 8) p.age = p.life + 1; } });
      s.burst = E({ life: [25, 45], speed: [4, 8], angle: 0, spread: 360, drag: .93, size: [2, .5], shape: 'spark', stretch: 3, blend: 'lighter', colors: [[0, '#ffffff', 1], [1, '#4fe0ff', 0]] });
      s.core = softSprites(ramp([[0, '#bff4ff', 1], [1, '#bff4ff', 1]]), 1)[0];
      s.release = () => { s.ps.spawn(s.burst, 120, 120, 60); s.charge = 0; s.fl = 1; }; s.fl = 0; },
    step: (s) => { s.fl *= .85; if (s.charge < 1) { s.charge += 1 / 140; s.ps.emit(s.c, 120, 120, 2.5); } else s.release(); },
    down: (s) => { if (s.charge > .2) s.release(); },
    front: (g, s) => { g.globalCompositeOperation = 'lighter'; const r = 6 + s.charge * 26 + Math.sin(s.t * .5) * 2 * s.charge; g.drawImage(s.core, 120 - r, 120 - r, r * 2, r * 2);
      if (s.fl > .05) { g.fillStyle = `rgba(200,245,255,${s.fl * .4})`; g.fillRect(0, 0, W, H); } g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#2a2f40'; g.fillRect(70, 222, 100, 4); g.fillStyle = COL.cyan; g.fillRect(70, 222, 100 * s.charge, 4); } }),
  fx({ s: 'magic', name: '軌跡', tag: 'ribbon from last 36 positions',
    desc: '動く点の過去の位置を36個覚えておき、それをつないだ帯を、古いほど細く透明にして描いています。粒ではなく「帯」を使うことで、なめらかな軌跡になります。',
    hint: 'カードの上でカーソルを動かすと追いかける', warm: 40,
    init: (s) => { s.hist = []; s.ptr = null; s.px = 120; s.py = 120;
      s.c = E({ life: [20, 36], speed: [0, .4], angle: 0, spread: 360, size: [1.8, 0], shape: 'dot', blend: 'lighter', colors: [[0, '#ffffff', 1], [1, '#ff7ad9', 0]] }); },
    step: (s) => { let tx, ty; if (s.ptr) { tx = s.ptr.x; ty = s.ptr.y; } else { tx = 120 + Math.sin(s.t * .045) * 85; ty = 120 + Math.sin(s.t * .07) * 70; }
      s.px = lerp(s.px, tx, .35); s.py = lerp(s.py, ty, .35); s.hist.unshift([s.px, s.py]); if (s.hist.length > 36) s.hist.pop(); s.ps.emit(s.c, s.px, s.py, .8); },
    move: (s, p) => { s.ptr = p; }, leave: (s) => { s.ptr = null; },
    front: (g, s) => { const h = s.hist; if (h.length < 3) return; g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < h.length - 1; i++) { const k = 1 - i / h.length, a = h[i], b = h[i + 1]; g.strokeStyle = `rgba(${lerp(255, 181, 1 - k) | 0},${lerp(200, 123, 1 - k) | 0},255,${k * .9})`; g.lineWidth = 10 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(h[0][0], h[0][1], 4, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; } })
];
function drawCoin(g, x, y, s) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#ffd84d'; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill(); g.strokeStyle = '#b8860b'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.stroke(); g.fillStyle = '#fff6c2'; g.fillRect(-2, -6, 4, 12); g.restore(); }

const SECTIONS = [
  { id: 'basic', en: 'Building blocks', title: '仕組みを分解する', lead: 'エフェクトを作る材料です。粒を出す量・向き・速さ、重力、寿命に合わせた色と大きさの変化、重ね方。この組み合わせで、あとのエフェクトはすべて作れます。' },
  { id: 'nature', en: 'Nature', title: '自然現象', lead: '炎、煙、雨、雪など。現実の現象をよく観察して、動きの特徴を数値に置き換えます。' },
  { id: 'combat', en: 'Combat', title: '戦闘のエフェクト', lead: '一瞬で終わるエフェクトは、何種類もの粒を同時に重ねて作ります。短い時間に情報をたくさん詰め込むのがコツです。' },
  { id: 'magic', en: 'Magic & UI', title: '魔法と演出', lead: '現実には存在しないものや雰囲気づくりのエフェクトは、色と動きの向きで意味を伝えます。' }
];

run({ sections: SECTIONS, items: ITEMS, W, H, minCol: 300 });
series('particles');

})();
