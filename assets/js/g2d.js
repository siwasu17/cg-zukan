/* Shared runtime for the 2D catalogues: builds the cards, runs every visible
   simulation at a fixed 60 steps per second, maps pointer input to logical
   coordinates and handles reset / reseed. */
(function () {
'use strict';
const DPR = Math.min(window.devicePixelRatio || 1, 2);

function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = {
  linear: t => t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inQuad: t => t * t,
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI) / 3) + 1,
  outBounce: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; }
};
/* 2D gradient noise (Perlin style) with a seeded permutation */
function makeNoise(rand) {
  const p = new Uint8Array(512), perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const grad = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return x - y; case 2: return -x + y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function n2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y), a = p[X] + Y, b = p[X + 1] + Y;
    return lerp(lerp(grad(p[a], x, y), grad(p[b], x - 1, y), u), lerp(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u), v) * .7071;
  }
  function fbm(x, y, oct = 5) { let s = 0, a = .5, f = 1; for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); f *= 2; a *= .5; } return s; }
  return { n2, fbm };
}
const COL = { red: '#ff5470', orange: '#ff9f43', yellow: '#ffd84d', green: '#5ef08a', cyan: '#4fe0ff', blue: '#5b8cff', purple: '#b57bff', pink: '#ff7ad9', white: '#ffffff', ink: '#ece8e0', muted: '#9da2ac', accent: '#f0a54a', bg: '#0b0e1a' };
const FONT = '"Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
function label(g, text, x, y, o = {}) {
  g.font = `${o.weight || 700} ${o.size || 11}px ${o.mono ? MONO : FONT}`;
  g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic';
  if (o.bg) { const w = g.measureText(text).width, s = o.size || 11, px = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x; g.fillStyle = o.bg; g.fillRect(px - 4, y - s - 1, w + 8, s + 6); }
  g.fillStyle = o.color || COL.ink; g.fillText(text, x, y); g.textAlign = 'left';
}

function run(cfg) {
  const main = document.getElementById('main'), nav = document.getElementById('nav');
  const cards = [];
  let seedBase = 101;
  for (const sec of cfg.sections) {
    const a = document.createElement('a'); a.href = '#' + sec.id; a.textContent = sec.title; nav.appendChild(a);
    const el = document.createElement('section'); el.id = sec.id;
    el.innerHTML = `<header><div class="eyebrow"></div><h2></h2><p></p></header><div class="grid"></div>`;
    el.querySelector('.eyebrow').textContent = sec.en; el.querySelector('h2').textContent = sec.title; el.querySelector('p').textContent = sec.lead;
    const grid = el.querySelector('.grid');
    if (cfg.minCol) grid.style.setProperty('--min', cfg.minCol + 'px');
    for (const it of cfg.items.filter(x => x.s === sec.id)) {
      const W = it.W || cfg.W || 240, H = it.H || cfg.H || 240;
      const card = document.createElement('article'); card.className = 'card';
      const cv = document.createElement('canvas'); cv.className = 'stage'; cv.width = W * DPR; cv.height = H * DPR;
      cv.style.setProperty('--ar', W + ' / ' + H); cv.tabIndex = 0;
      cv.style.cursor = it.cursor || (it.interactive ? 'pointer' : 'default');
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', it.name);
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.innerHTML = '<div class="row"><h3></h3><button type="button"></button></div><code></code><p></p>' + (it.hint ? '<p class="hint"></p>' : '');
      meta.querySelector('h3').textContent = it.name; meta.querySelector('code').textContent = it.tag;
      meta.querySelector('p').textContent = it.desc; if (it.hint) meta.querySelector('.hint').textContent = it.hint;
      const btn = meta.querySelector('button'); btn.textContent = it.reseed ? '作り直す' : '最初から';
      card.append(cv, meta); grid.appendChild(card);
      const c = { it, cv, g: cv.getContext('2d'), W, H, seed: seedBase += 7, sim: null, t: 0, visible: false, down: false };
      cards.push(c);
      btn.addEventListener('click', () => { create(c, !!it.reseed); draw(c); });
      const loc = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
      cv.addEventListener('pointerdown', (e) => { c.down = true; if (it.capture) { try { cv.setPointerCapture(e.pointerId); } catch (_) {} } c.sim.down && c.sim.down(loc(e)); if (!playing) draw(c); });
      cv.addEventListener('pointermove', (e) => { c.sim.move && c.sim.move(loc(e), c.down); });
      const up = () => { if (c.down) { c.down = false; c.sim.up && c.sim.up(); } };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', () => { up(); c.sim.leave && c.sim.leave(); });
      cv.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && c.sim.key) { e.preventDefault(); c.sim.key(e.key); } });
    }
    main.appendChild(el);
  }
  function create(c, reseed) {
    if (reseed) c.seed = (Math.random() * 1e9) | 0;
    c.t = 0;
    c.sim = c.it.make({ W: c.W, H: c.H, rand: rng(c.seed), seed: c.seed });
    const warm = c.it.warm || 0; for (let i = 0; i < warm; i++) { c.sim.step && c.sim.step(c.t); c.t++; }
  }
  function draw(c) {
    const cw = Math.round(c.cv.clientWidth * DPR), ch = Math.round(c.cv.clientHeight * DPR);
    if (cw && ch && (c.cv.width !== cw || c.cv.height !== ch)) { c.cv.width = cw; c.cv.height = ch; }
    const g = c.g, s = c.cv.width / c.W;
    g.setTransform(s, 0, 0, s, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.imageSmoothingEnabled = !c.it.pixel;
    c.sim.draw(g, c.t, s);
    g.setTransform(s, 0, 0, s, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const hud = c.sim.hud ? c.sim.hud() : null;
    if (hud && hud.length) {
      g.font = `500 9.5px ${MONO}`; g.textBaseline = 'alphabetic';
      let w = 0; for (const l of hud) w = Math.max(w, g.measureText(l).width);
      g.fillStyle = 'rgba(9,11,20,.66)'; g.fillRect(4, c.H - 16 - (hud.length - 1) * 12, w + 10, 13 + (hud.length - 1) * 12);
      g.fillStyle = '#c9cfdf'; hud.forEach((l, i) => g.fillText(l, 9, c.H - 6 - (hud.length - 1 - i) * 12));
    }
  }
  cards.forEach(c => { create(c, false); draw(c); });

  const io = new IntersectionObserver((ents) => { for (const e of ents) { const c = cards.find(k => k.cv === e.target); if (c) c.visible = e.isIntersecting; } }, { rootMargin: '80px' });
  cards.forEach(c => io.observe(c.cv));

  let playing = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const playBtn = document.getElementById('play');
  if (playBtn) {
    const sync = () => { playBtn.textContent = playing ? '一時停止' : '再生'; playBtn.setAttribute('aria-pressed', String(!playing)); };
    sync(); playBtn.addEventListener('click', () => { playing = !playing; sync(); });
  }
  const ra = document.getElementById('resetAll');
  if (ra) ra.addEventListener('click', () => cards.forEach(c => { create(c, false); draw(c); }));

  const STEP = 1000 / 60; let acc = 0, prev = performance.now();
  function loop(now) {
    const dt = Math.min(100, now - prev); prev = now;
    if (playing) {
      acc += dt; let n = 0;
      while (acc >= STEP && n < 4) { for (const c of cards) if (c.visible && c.sim.step) { c.sim.step(c.t); c.t++; } acc -= STEP; n++; }
      if (n === 4) acc = 0;
    }
    for (const c of cards) if (c.visible) draw(c);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function series() { /* handled by assets/js/series.js */ }

window.G2D = { rng, clamp, lerp, ease, makeNoise, COL, FONT, MONO, label, run, series, DPR };
})();
