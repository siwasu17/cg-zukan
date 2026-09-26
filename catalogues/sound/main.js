/* サウンド表現図鑑 — card definitions. Runtime: assets/js/g2d.js + Web Audio API.
   Every sound is synthesised on the spot; there are no audio files. */
(function () {
const { clamp, lerp, COL, label, run } = G2D;
const W = 240, H = 220, TAU = Math.PI * 2;

/* ---------- audio core ---------- */
const AU = { ctx: null, master: null, vol: .5, noise: {} };
function ac() {
  if (!AU.ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    const c = AU.ctx = new C();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = .003; comp.release.value = .2;
    AU.master = c.createGain(); AU.master.gain.value = AU.vol * AU.vol;
    AU.master.connect(comp); comp.connect(c.destination);
  }
  if (AU.ctx.state === 'suspended') AU.ctx.resume();
  return AU.ctx;
}
const now = () => AU.ctx ? AU.ctx.currentTime : 0;

function noiseGen(kind, rand) {
  if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    return () => { const w = rand() * 2 - 1; b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; const o = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362; b6 = w * .115926; return o * .11; };
  }
  if (kind === 'brown') { let l = 0; return () => { l = (l + .02 * (rand() * 2 - 1)) / 1.02; return l * 3.5; }; }
  return () => rand() * 2 - 1;
}
function noiseBuf(kind) {
  if (AU.noise[kind]) return AU.noise[kind];
  const c = AU.ctx, n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0), gen = noiseGen(kind, Math.random);
  for (let i = 0; i < n; i++) d[i] = gen();
  return AU.noise[kind] = b;
}
function osc(c, type, f, t0, t1, out) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; if (out) o.connect(out); o.start(t0); if (t1) o.stop(t1); return o; }
function noiseSrc(c, kind, t0, t1, out) { const s = c.createBufferSource(); s.buffer = noiseBuf(kind); s.loop = true; if (out) s.connect(out); s.start(t0, Math.random() * 1.5); if (t1) s.stop(t1); return s; }
function gain(c, v, out) { const g = c.createGain(); g.gain.value = v; if (out) g.connect(out); return g; }
function filt(c, type, f, q, out) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q === undefined ? .7 : q; if (out) b.connect(out); return b; }
/* quick attack, exponential decay */
function perc(c, t, peak, dur, out, a = .004) { const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur); g.connect(out); return g; }
function pluck(c, t, f, out, peak = .3, dur = .5, type = 'triangle') { const g = perc(c, t, peak, dur, out, .005); osc(c, type, f, t, t + dur + .05, g); osc(c, 'sine', f * 2, t, t + dur * .5, perc(c, t, peak * .25, dur * .4, out)); }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

/* one output bus per card: gain → analyser → master. stopAll() cuts everything the card has scheduled. */
const BUS = {};
function bus(key) {
  const B = BUS[key] || (BUS[key] = {
    in: null, an: null, td: new Float32Array(2048), fd: new Uint8Array(1024), held: new Set(), x: {},
    ctx() {
      const c = ac(); if (!c) return null;
      if (!this.in) { this.in = c.createGain(); this.an = c.createAnalyser(); this.an.fftSize = 2048; this.an.smoothingTimeConstant = .75; this.in.connect(this.an); this.an.connect(AU.master); }
      return c;
    },
    stopAll() {
      for (const v of this.held) v.off(.01);
      this.held.clear();
      if (this.in) { const old = this.in, t = now(); old.gain.setTargetAtTime(0, t, .01); setTimeout(() => old.disconnect(), 80); this.in = null; this.x = {}; }
    }
  });
  B.stopAll();
  return B;
}
/* a sustained voice that is released on pointer up */
function voice(B, g, nodes, level) {
  const v = {
    g, nodes, alive: true,
    off(r = .12) { if (!v.alive) return; v.alive = false; const t = now(); g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.setTargetAtTime(0, t, r / 3); for (const n of nodes) n.stop(t + r * 2 + .05); B.held.delete(v); }
  };
  g.gain.setValueAtTime(0, now()); g.gain.setTargetAtTime(level, now(), .015);
  B.held.add(v);
  return v;
}
/* look-ahead scheduler for loops: fn(time, index) for every tick that falls in the next 150 ms */
function clock(sec) {
  return {
    next: 0, n: 0, q: [],
    tick(fn) {
      const c = AU.ctx; if (!c) return;
      const t = c.currentTime;
      if (this.next < t) this.next = t + .05;
      while (this.next < t + .15) { fn(this.next, this.n); this.q.push([this.next, this.n]); this.n++; this.next += sec; }
      while (this.q.length > 1 && this.q[1][0] <= t) this.q.shift();
    },
    cur() { const c = AU.ctx; if (!c || !this.q.length || this.q[0][0] > c.currentTime) return -1; return this.q[0][1]; },
    clear() { this.q = []; this.n = 0; this.next = 0; }
  };
}

/* ---------- drawing helpers ---------- */
function bg(g, c = '#0d1122') { g.fillStyle = c; g.fillRect(0, 0, W, H); }
function chip(g, text, x, y, on, align) { label(g, text, x, y, { size: 10.5, align, color: on ? '#15171b' : COL.ink, bg: on ? COL.accent : 'rgba(80,88,110,.9)' }); }
function note(g, text, x, y, o = {}) { label(g, text, x, y, Object.assign({ size: 10, color: COL.muted }, o)); }
function mono(g, text, x, y, o = {}) { label(g, text, x, y, Object.assign({ size: 10, mono: true, weight: 500, color: '#c9cfdf' }, o)); }
function plot(g, fn, x, y, w, h, n = 180) { g.beginPath(); for (let i = 0; i <= n; i++) { const u = i / n, v = fn(u); if (i) g.lineTo(x + u * w, y - v * h); else g.moveTo(x + u * w, y - v * h); } g.stroke(); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/* live oscilloscope from the card's analyser; returns the peak level */
function scope(g, B, x, y, w, h, col = COL.cyan, n = 700) {
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
  if (!B.an) return 0;
  const d = B.td; B.an.getFloatTimeDomainData(d);
  let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
  if (pk < .003) return 0;
  let s = 0; for (let i = 1; i < d.length - n; i++) if (d[i - 1] < 0 && d[i] >= 0) { s = i; break; }
  const k = h * .46 / Math.max(pk, .3);
  g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath();
  for (let i = 0; i < n; i += 2) { const px = x + i / n * w, py = y + h / 2 - d[s + i] * k; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
  g.stroke();
  return pk;
}
const F0 = 40, F1 = 12000, fx = u => F0 * Math.pow(F1 / F0, u), xf = f => Math.log(f / F0) / Math.log(F1 / F0);
function spectrum(g, B, x, y, w, h, col = 'rgba(79,224,255,.35)') {
  if (!B.an) return;
  B.an.getByteFrequencyData(B.fd);
  const ny = AU.ctx.sampleRate / 2; g.fillStyle = col;
  for (let px = 0; px < w; px += 2) { const bin = Math.min(1023, Math.round(fx(px / w) / ny * 1024)), v = B.fd[bin] / 255; if (v > 0) g.fillRect(x + px, y + h - v * h, 1.6, v * h); }
}
function freqGrid(g, x, y, w, h) {
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
  for (const f of [100, 1000, 10000]) { const px = x + xf(f) * w; g.beginPath(); g.moveTo(px, y); g.lineTo(px, y + h); g.stroke(); mono(g, f >= 1000 ? f / 1000 + 'k' : '' + f, px + 2, y + h - 3, { size: 8.5, color: COL.muted }); }
}

/* keyboard: nWhite white keys starting at C */
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const SOL = ['ド', 'ド♯', 'レ', 'レ♯', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ソ♯', 'ラ', 'ラ♯', 'シ'];
function keyboard(x, y, w, h, nWhite) {
  const kw = w / nWhite, keys = []; let wi = 0;
  for (let s = 0; wi < nWhite; s++) {
    if (WHITE.includes(s % 12)) { keys.push({ s, x: x + wi * kw, y, w: kw, h, black: false }); wi++; }
    else keys.push({ s, x: x + wi * kw - kw * .32, y, w: kw * .64, h: h * .6, black: true });
  }
  return keys;
}
function keyAt(keys, p) { const inK = k => p.x >= k.x && p.x < k.x + k.w && p.y >= k.y && p.y < k.y + k.h; return keys.find(k => k.black && inK(k)) || keys.find(k => !k.black && inK(k)); }
function drawKeys(g, keys, lit, col = COL.accent) {
  for (const k of keys) if (!k.black) { g.fillStyle = lit(k.s) ? col : '#dfe3ec'; g.fillRect(k.x + .5, k.y, k.w - 1, k.h); }
  for (const k of keys) if (k.black) { g.fillStyle = lit(k.s) ? col : '#1a1d27'; g.fillRect(k.x, k.y, k.w, k.h); }
}

/* ---------- sound-effect recipes: the same data drives the synth and the graph ---------- */
function curveAt(pts, t, mode) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t < pts[i][0]) {
    const a = pts[i - 1], b = pts[i];
    if (mode === 'step') return a[1];
    const u = (t - a[0]) / (b[0] - a[0]);
    return mode === 'exp' ? a[1] * Math.pow(b[1] / a[1], u) : lerp(a[1], b[1], u);
  }
  return pts[pts.length - 1][1];
}
function sched(param, pts, T, mode, k = 1) {
  param.setValueAtTime(pts[0][1] * k, T);
  for (let i = 1; i < pts.length; i++) {
    const at = T + pts[i][0], v = pts[i][1] * k;
    if (mode === 'step') param.setValueAtTime(v, at);
    else if (mode === 'exp') param.exponentialRampToValueAtTime(Math.max(v, 1e-4), at);
    else param.linearRampToValueAtTime(v, at);
  }
}
function playRecipe(c, rec, T, out, pm = 1, vm = 1) {
  for (const L of rec.layers) {
    const amp = c.createGain(); amp.connect(out); sched(amp.gain, L.a, T, 'lin', vm);
    let fparam;
    if (L.w === 'noise') { const fl = filt(c, L.filter || 'lowpass', 1000, L.q || 1, amp); noiseSrc(c, 'white', T, T + rec.dur + .05, fl); fparam = fl.frequency; }
    else fparam = osc(c, L.w, 440, T, T + rec.dur + .05, amp).frequency;
    sched(fparam, L.f, T, L.step ? 'step' : 'exp', pm);
  }
}
const LAYER_COL = [COL.yellow, COL.cyan, COL.pink];
function recipe(o) {
  const rec = o.rec;
  return {
    s: 'sfx', name: o.name, tag: o.tag, desc: o.desc, hint: 'クリックで鳴らす', interactive: true,
    make: () => {
      const B = bus(o.name); let t = -1;
      const X0 = 30, X1 = 228, PY0 = 26, PY1 = 122, AY0 = 134, AY1 = 170;
      const ty = f => PY1 - clamp(Math.log(f / 40) / Math.log(8000 / 40), 0, 1) * (PY1 - PY0);
      const tx = s => X0 + s / rec.dur * (X1 - X0);
      return {
        step() { if (t >= 0) t++; if (t / 60 > rec.dur + .6) t = -1; },
        down() { const c = B.ctx(); if (!c) return; t = 0; playRecipe(c, rec, c.currentTime + .01, B.in); },
        draw(g) {
          bg(g);
          g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
          for (const f of [100, 1000]) { g.beginPath(); g.moveTo(X0, ty(f)); g.lineTo(X1, ty(f)); g.stroke(); mono(g, f === 1000 ? '1k' : '100', X0 - 4, ty(f) + 3, { size: 8.5, color: COL.muted, align: 'right' }); }
          mono(g, 'Hz', X0 - 4, PY0 + 4, { size: 8.5, color: COL.muted, align: 'right' });
          note(g, '高さ', X0, 14, { size: 9.5 }); note(g, '大きさ', X0, AY0 - 2, { size: 9.5 });
          rec.layers.forEach((L, li) => {
            const col = LAYER_COL[li % 3], amax = Math.max(...L.a.map(p => p[1])) || 1, mode = L.step ? 'step' : 'exp';
            g.strokeStyle = col; g.lineWidth = 2; g.setLineDash(L.w === 'noise' ? [3, 3] : []);
            const n = 90;
            for (let i = 0; i < n; i++) {
              const s0 = i / n * rec.dur, s1 = (i + 1) / n * rec.dur, a = curveAt(L.a, (s0 + s1) / 2, 'lin') / amax;
              g.globalAlpha = .12 + .88 * a; g.beginPath(); g.moveTo(tx(s0), ty(curveAt(L.f, s0, mode))); g.lineTo(tx(s1), ty(curveAt(L.f, s1, mode))); g.stroke();
            }
            g.setLineDash([]); g.globalAlpha = .28; g.fillStyle = col; g.beginPath(); g.moveTo(X0, AY1);
            for (let i = 0; i <= n; i++) { const s = i / n * rec.dur; g.lineTo(tx(s), AY1 - curveAt(L.a, s, 'lin') / amax * (AY1 - AY0) * (li ? .8 : 1)); }
            g.lineTo(X1, AY1); g.fill(); g.globalAlpha = 1;
            mono(g, L.w === 'noise' ? 'noise (' + (L.filter || 'lowpass') + ')' : L.w, X1, 14 + li * 11, { size: 8.5, color: col, align: 'right' });
          });
          if (t >= 0 && t / 60 <= rec.dur) { const px = tx(t / 60); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, PY0 - 4); g.lineTo(px, AY1); g.stroke(); }
          mono(g, rec.dur.toFixed(2) + ' s', X1, AY1 + 10, { size: 8.5, color: COL.muted, align: 'right' });
          scope(g, B, X0, 182, X1 - X0, 32, COL.ink);
        }
      };
    }
  };
}
const REC = {
  jump: { dur: .3, layers: [{ w: 'square', f: [[0, 240], [.2, 720]], a: [[0, 0], [.01, .26], [.16, .2], [.27, 0]] }] },
  coin: { dur: .5, layers: [{ w: 'square', step: true, f: [[0, 988], [.08, 1319]], a: [[0, 0], [.005, .22], [.08, .22], [.48, 0]] }] },
  laser: { dur: .3, layers: [{ w: 'sawtooth', f: [[0, 1600], [.22, 110]], a: [[0, 0], [.005, .28], [.26, 0]] }, { w: 'square', f: [[0, 1700], [.22, 120]], a: [[0, 0], [.005, .1], [.2, 0]] }] },
  boom: { dur: 1.3, layers: [{ w: 'noise', filter: 'lowpass', f: [[0, 4000], [.25, 900], [1.2, 110]], a: [[0, 0], [.01, 1], [.3, .6], [1.25, 0]] }, { w: 'sine', f: [[0, 110], [.5, 38]], a: [[0, 0], [.01, .9], [.6, 0]] }] },
  power: { dur: .75, layers: [{ w: 'square', step: true, f: [523, 659, 784, 1047, 587, 740, 880, 1175, 659, 831, 988, 1319].map((f, i) => [i * .05, f]), a: [[0, 0], [.005, .18], [.55, .18], [.72, 0]] }] },
  hurt: { dur: .4, layers: [{ w: 'sawtooth', f: [[0, 480], [.3, 70]], a: [[0, 0], [.005, .28], [.33, 0]] }, { w: 'noise', filter: 'bandpass', f: [[0, 2500], [.1, 1200]], a: [[0, 0], [.003, .7], [.1, 0]] }] },
  punch: { dur: .3, layers: [{ w: 'sine', f: [[0, 160], [.18, 45]], a: [[0, 0], [.003, 1], [.26, 0]] }, { w: 'noise', filter: 'lowpass', f: [[0, 6000], [.08, 1200]], a: [[0, 0], [.002, .9], [.07, 0]] }] },
  shot: { dur: .12, layers: [{ w: 'square', f: [[0, 900], [.1, 260]], a: [[0, 0], [.003, .22], [.1, 0]] }, { w: 'noise', filter: 'bandpass', q: 1.5, f: [[0, 3000], [.08, 1500]], a: [[0, 0], [.002, .5], [.06, 0]] }] }
};

/* ---------- simple drum / instrument voices for the music cards ---------- */
const DRUM = {
  kick(c, t, out, v = 1) { const g = perc(c, t, v, .35, out, .002); const o = osc(c, 'sine', 150, t, t + .4, g); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + .12); },
  snare(c, t, out, v = 1) { noiseSrc(c, 'white', t, t + .2, filt(c, 'highpass', 1200, .7, perc(c, t, .5 * v, .18, out, .002))); osc(c, 'triangle', 190, t, t + .12, perc(c, t, .4 * v, .1, out, .002)); },
  hat(c, t, out, v = 1) { noiseSrc(c, 'white', t, t + .06, filt(c, 'highpass', 7000, .7, perc(c, t, .22 * v, .05, out, .001))); },
  bass(c, t, out, f, v = 1) { const g = perc(c, t, .32 * v, .24, out, .005); osc(c, 'sawtooth', f, t, t + .26, filt(c, 'lowpass', 600, 2, g)); }
};
function blip(c, t, f, out, v = .18) { const g = perc(c, t, v, .07, out, .004); osc(c, 'square', f, t, t + .08, filt(c, 'lowpass', 2400, 1, g)); }

/* ============================================================ */
const SECTIONS = [
  { id: 'source', en: 'Sources', title: '音の素', lead: '音は空気の振動で、スピーカーはそれを「波形」として作り出します。まずは波の形・高さ・倍音・雑音という、あらゆる音の材料から。' },
  { id: 'tone', en: 'Shaping', title: '音色を作る', lead: '素の波形を、削る・揺らす・ぶつける・歪ませることで、同じ高さでもまったく違う音色になります。押している間だけ鳴るカードは、押したまま動かしてみてください。' },
  { id: 'sfx', en: 'Sound effects', title: '効果音のレシピ', lead: 'ゲームの効果音の多くは、波形と「高さの変化」と「大きさの変化」の組み合わせでできています。黄色い線が高さの変化、塗りが大きさの変化で、線の濃さはその瞬間の音量です。' },
  { id: 'space', en: 'Space', title: '空間と距離', lead: '左右の音量差、距離による減衰とこもり、動く音の高さの変化、壁からの反射。音がどこで鳴っているかを耳に伝える技法です。ヘッドホンだと左右の違いがよく分かります。' },
  { id: 'music', en: 'Music & direction', title: '音楽と演出', lead: '音の並べ方の決まりごとと、ゲームの状況に合わせて音楽や音量を変える仕組みです。' }
];

const ITEMS = [
/* ---------------- 音の素 ---------------- */
{
  s: 'source', name: '4つの基本の波形', tag: 'sine · square · sawtooth · triangle', interactive: true, hint: '4つの枠をクリックで鳴らす',
  desc: '同じ高さ（ド 262Hz）でも、波の形で音色が変わります。サイン波は丸く澄んだ音、矩形波はファミコンのようなはっきりした音、のこぎり波は明るくギラついた音、三角波は柔らかい笛のような音です。',
  make: () => {
    const B = bus('waves'), hit = [0, 0, 0, 0]; let t = 0;
    const types = ['sine', 'square', 'sawtooth', 'triangle'], names = ['サイン波', '矩形波', 'のこぎり波', '三角波'], cols = [COL.cyan, COL.yellow, COL.pink, COL.green], vol = [.5, .2, .24, .5];
    const fn = [p => Math.sin(p * TAU), p => (p % 1) < .5 ? 1 : -1, p => 2 * (p % 1) - 1, p => 1 - 4 * Math.abs((p % 1) - .5)];
    return {
      step() { t++; for (let i = 0; i < 4; i++) hit[i] *= .95; },
      down(p) { const i = (p.x >= W / 2 ? 1 : 0) + (p.y >= H / 2 ? 2 : 0); hit[i] = 1; const c = B.ctx(); if (!c) return; const t0 = c.currentTime + .01; osc(c, types[i], 262, t0, t0 + 1, perc(c, t0, vol[i], .95, B.in, .01)); },
      draw(g) {
        bg(g);
        for (let i = 0; i < 4; i++) {
          const x = (i % 2) * 120, y = (i >> 1) * 110;
          g.fillStyle = `rgba(240,165,74,${hit[i] * .12})`; g.fillRect(x, y, 120, 110);
          g.strokeStyle = '#1f2640'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, 119, 109);
          label(g, names[i], x + 10, y + 20, { size: 11.5, color: hit[i] > .1 ? COL.accent : COL.ink });
          g.strokeStyle = cols[i]; g.lineWidth = 2 + hit[i] * 1.5; g.lineJoin = 'round';
          const ph = t * .006 * (1 + hit[i] * 3);
          plot(g, u => fn[i](u * 2 + 4 + ph) * (.75 + hit[i] * .25), x + 12, y + 66, 96, 26, 200);
        }
      }
    };
  }
},
{
  s: 'source', name: '音の高さと周波数', tag: 'f = 440 × 2^((n − 69) / 12)', interactive: true, capture: true, cursor: 'pointer', hint: '鍵盤を押す・なぞる',
  desc: '音の高さは、1秒間に波がくり返す回数（周波数）で決まります。ラの音は 440Hz で、1オクターブ上がると周波数はちょうど2倍。上の波は、同じ時間の中に入る波の数を描いています。',
  make: () => {
    const B = bus('pitch'), keys = keyboard(8, 150, 224, 62, 14);
    let cur = 69, v = null, osc1 = null, lit = -1, t = 0;
    const play = k => {
      cur = 60 + k.s; lit = k.s; const f = mtof(cur);
      if (v && v.alive) { osc1.frequency.setTargetAtTime(f, now(), .008); return; }
      const c = B.ctx(); if (!c) return; const g = gain(c, 0, B.in); osc1 = osc(c, 'triangle', f, c.currentTime, 0, g); v = voice(B, g, [osc1], .45);
    };
    return {
      step() { t++; },
      down(p) { const k = keyAt(keys, p); if (k) play(k); },
      move(p, d) { if (!d) return; const k = keyAt(keys, p); if (k && k.s !== lit) play(k); },
      up() { if (v) v.off(.25); lit = -1; },
      draw(g) {
        bg(g); const f = mtof(cur), on = lit >= 0;
        g.strokeStyle = on ? COL.cyan : 'rgba(79,224,255,.45)'; g.lineWidth = 2;
        plot(g, u => Math.sin(u * TAU * f / 60 - t * .05), 12, 84, 216, 36, 400);
        label(g, SOL[cur % 12] + (Math.floor(cur / 12) - 1), 12, 24, { size: 14, color: on ? COL.accent : COL.ink });
        mono(g, f.toFixed(1) + ' Hz', 228, 22, { align: 'right', size: 11 });
        note(g, '1オクターブ上 = 周波数 ×2', 228, 138, { align: 'right', size: 9.5 });
        drawKeys(g, keys, s => s === lit);
        for (const k of keys) if (!k.black && k.s % 12 === 0) note(g, 'ド' + (4 + k.s / 12), k.x + k.w / 2, 208, { size: 8, align: 'center', color: '#4a5068' });
      }
    };
  }
},
{
  s: 'source', name: '倍音を重ねる', tag: 'Σ sin(n·f·t) / n', interactive: true, hint: '下の棒で倍音を入り切り・上をクリックで鳴らす',
  desc: 'どんな音も、周波数の違うサイン波の重ね合わせで表せます。基本の高さの整数倍の「倍音」を 1/n の強さで足していくと、丸いサイン波がだんだんのこぎり波に近づき、音も明るくなっていきます。',
  make: () => {
    const B = bus('additive'), on = [1, 0, 0, 0, 0, 0, 0, 0]; let flash = 0;
    const play = () => {
      flash = 1; const c = B.ctx(); if (!c) return;
      const re = new Float32Array(9), im = new Float32Array(9); on.forEach((v, i) => { im[i + 1] = v ? 1 / (i + 1) : 0; });
      const o = c.createOscillator(); o.setPeriodicWave(c.createPeriodicWave(re, im)); o.frequency.value = 165;
      const t0 = c.currentTime + .01; o.connect(perc(c, t0, .45, 1, B.in, .01)); o.start(t0); o.stop(t0 + 1.05);
    };
    const sum = u => { let s = 0, m = 0; on.forEach((v, i) => { if (v) { s += Math.sin(u * TAU * 2 * (i + 1)) / (i + 1); } }); for (let i = 0; i < 8; i++) if (on[i]) m += 1 / (i + 1); return s / Math.max(m * .75, 1); };
    return {
      step() { flash *= .94; },
      down(p) {
        if (p.y > 132) { const i = clamp(Math.floor((p.x - 10) / 28), 0, 7); on[i] = on[i] ? 0 : 1; if (!on.some(Boolean)) on[0] = 1; }
        play();
      },
      draw(g) {
        bg(g);
        g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(10, 70); g.lineTo(230, 70); g.stroke();
        on.forEach((v, i) => { if (v && i) { g.strokeStyle = 'rgba(181,123,255,.25)'; plot(g, u => Math.sin(u * TAU * 2 * (i + 1)) / (i + 1), 10, 70, 220, 44, 300); } });
        g.strokeStyle = COL.yellow; g.lineWidth = 2 + flash * 1.5; plot(g, sum, 10, 70, 220, 44, 400);
        note(g, '合成した波形', 10, 16, { size: 9.5 });
        for (let i = 0; i < 8; i++) {
          const x = 10 + i * 28, h = 60 / (i + 1), y = 200 - h;
          g.fillStyle = on[i] ? (i ? COL.purple : COL.yellow) : 'rgba(255,255,255,.04)'; g.fillRect(x + 3, y, 22, h);
          g.strokeStyle = on[i] ? 'transparent' : '#39405a'; g.lineWidth = 1; g.strokeRect(x + 3.5, y + .5, 21, h - 1);
          mono(g, (i + 1) + '', x + 14, 214, { size: 9, align: 'center', color: on[i] ? COL.ink : COL.muted });
        }
        note(g, '倍音の番号（棒の高さ = 1/n）', 10, 136, { size: 9.5 });
      }
    };
  }
},
{
  s: 'source', name: 'ノイズの色', tag: 'white · pink · brown', interactive: true, hint: '帯をクリックで鳴らす',
  desc: '決まった高さのない「ザー」という雑音にも種類があります。高い音から低い音まで均等なホワイト、低い音ほど強くなるピンク、さらに低音寄りのブラウン。波・風・雨・爆発などの効果音の材料になります。',
  make: (env) => {
    const B = bus('noise'), kinds = ['white', 'pink', 'brown'], names = ['ホワイト', 'ピンク', 'ブラウン'], sub = ['ザーッ（テレビの砂嵐）', 'サーッ（雨・滝）', 'ゴーッ（遠い波・風）'], cols = [COL.white, COL.pink, COL.orange], vol = [.3, .55, .9];
    const gens = kinds.map(k => noiseGen(k, env.rand)), tr = kinds.map(() => []), hit = [0, 0, 0];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 110; j++) tr[i].push(gens[i]());
    return {
      step() { for (let i = 0; i < 3; i++) { hit[i] *= .96; const k = 1 + Math.round(hit[i] * 2); for (let j = 0; j < k; j++) { tr[i].shift(); tr[i].push(gens[i]()); } } },
      down(p) { const i = clamp(Math.floor(p.y / (H / 3)), 0, 2); hit[i] = 1; const c = B.ctx(); if (!c) return; const t0 = c.currentTime + .01; const g = c.createGain(); g.connect(B.in); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol[i], t0 + .05); g.gain.setValueAtTime(vol[i], t0 + .8); g.gain.linearRampToValueAtTime(0, t0 + 1.2); noiseSrc(c, kinds[i], t0, t0 + 1.25, g); },
      draw(g) {
        bg(g);
        for (let i = 0; i < 3; i++) {
          const y = i * H / 3, h = H / 3, a = tr[i]; let m = .001; for (const v of a) m = Math.max(m, Math.abs(v));
          g.fillStyle = `rgba(240,165,74,${hit[i] * .1})`; g.fillRect(0, y, W, h);
          if (i) { g.fillStyle = '#1f2640'; g.fillRect(0, y, W, 1); }
          label(g, names[i], 10, y + 17, { size: 11.5, color: hit[i] > .1 ? COL.accent : COL.ink });
          note(g, sub[i], 230, y + 17, { size: 9.5, align: 'right' });
          g.strokeStyle = cols[i]; g.globalAlpha = .55 + hit[i] * .45; g.lineWidth = 1.3; g.beginPath();
          a.forEach((v, j) => { const px = 10 + j * 2, py = y + h * .6 - v / m * h * .3; if (j) g.lineTo(px, py); else g.moveTo(px, py); });
          g.stroke(); g.globalAlpha = 1;
        }
      }
    };
  }
},
{
  s: 'source', name: '音量の形（ADSR）', tag: 'attack · decay · sustain · release', interactive: true, hint: '押している間だけ鳴る（長押しと短押しで比べる）',
  desc: '鍵盤を押してから離すまでの音量の変化を、立ち上がり（A）・減衰（D）・持続（S）・余韻（R）の4つの値で決めます。ピアノは S が0、オルガンは A も R も0に近いなど、楽器らしさの多くはこの形で決まります。',
  make: () => {
    const B = bus('adsr'), A = .15, D = .3, S = .5, R = .7;
    let ph = 'idle', th = 0, tr = 0, lvlAtUp = 0, env = null, oscs = [];
    const X0 = 18, Y0 = 40, Y1 = 150, xA = 58, xD = 98, xS = 168, xR = 226;
    const level = () => ph === 'hold' ? (th < A ? th / A : S + (1 - S) * Math.exp(-(th - A) / (D / 3))) : ph === 'rel' ? lvlAtUp * Math.exp(-tr / (R / 4)) : 0;
    return {
      step() { if (ph === 'hold') th += 1 / 60; else if (ph === 'rel') { tr += 1 / 60; if (tr > R * 1.4) ph = 'idle'; } },
      down() {
        const c = B.ctx(); ph = 'hold'; th = 0; if (!c) return;
        if (env) env.off(.02);
        const t = c.currentTime, g = gain(c, 0, B.in), f = filt(c, 'lowpass', 1800, 1, g);
        oscs = [osc(c, 'sawtooth', 220, t, 0, f), osc(c, 'sawtooth', 220.8, t, 0, f)];
        env = { alive: true, g, off(r) { if (!this.alive) return; this.alive = false; const t2 = now(); g.gain.cancelScheduledValues(t2); g.gain.setValueAtTime(g.gain.value, t2); g.gain.setTargetAtTime(0, t2, r / 4); oscs.forEach(o => o.stop(t2 + r * 1.5)); B.held.delete(this); } };
        B.held.add(env);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.4, t + A); g.gain.setTargetAtTime(.4 * S, t + A, D / 3);
      },
      up() { if (ph !== 'hold') return; lvlAtUp = level(); ph = 'rel'; tr = 0; if (env) env.off(R); },
      draw(g) {
        bg(g);
        const yl = v => Y1 - v * (Y1 - Y0);
        g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(X0, Y0, xR - X0, Y1 - Y0);
        g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1;
        for (const x of [xA, xD, xS]) { g.beginPath(); g.moveTo(x, Y0); g.lineTo(x, Y1); g.stroke(); }
        g.strokeStyle = COL.accent; g.lineWidth = 2; g.beginPath(); g.moveTo(X0, Y1); g.lineTo(xA, Y0);
        for (let i = 1; i <= 20; i++) { const u = i / 20; g.lineTo(lerp(xA, xD, u), yl(S + (1 - S) * Math.exp(-u * 3 * 1.3))); }
        g.lineTo(xS, yl(S)); for (let i = 1; i <= 20; i++) { const u = i / 20; g.lineTo(lerp(xS, xR, u), yl(S * Math.exp(-u * 4 * 1.2))); } g.stroke();
        [['A', X0, xA], ['D', xA, xD], ['S', xD, xS], ['R', xS, xR]].forEach(([n, a, b]) => label(g, n, (a + b) / 2, Y1 + 16, { size: 12, align: 'center', color: COL.ink }));
        mono(g, `A ${A}s  D ${D}s  S ${S * 100}%  R ${R}s`, X0, Y1 + 34, { size: 9, color: COL.muted });
        note(g, '押す', X0, Y0 - 8, { size: 9.5 }); note(g, '離す', xS, Y0 - 8, { size: 9.5 });
        let px = null;
        if (ph === 'hold') px = th < A ? lerp(X0, xA, th / A) : th < A + D ? lerp(xA, xD, (th - A) / D) : lerp(xD, xS - 4, clamp((th - A - D) / 1.5, 0, 1));
        else if (ph === 'rel') px = lerp(xS, xR, clamp(tr / R, 0, 1));
        const lv = level();
        if (px !== null) { g.fillStyle = COL.yellow; g.beginPath(); g.arc(px, yl(lv), 5, 0, TAU); g.fill(); }
        g.fillStyle = '#2a2f40'; g.fillRect(X0, 200, xR - X0, 6); g.fillStyle = COL.yellow; g.fillRect(X0, 200, (xR - X0) * lv, 6);
        mono(g, '音量', X0, 196, { size: 8.5, color: COL.muted });
      }
    };
  }
},

/* ---------------- 音色を作る ---------------- */
{
  s: 'tone', name: 'フィルターと共鳴', tag: 'lowpass · cutoff × Q', interactive: true, capture: true, cursor: 'crosshair', hint: '押したまま動かす（横で境目の高さ、縦で共鳴の強さ）',
  desc: 'ローパスフィルターは、ある高さ（カットオフ）より上の成分を削ってこもった音にします。境目のあたりを強調する「共鳴（Q）」を上げると、ミョーンという癖のある音に。シンセサイザーの音作りの中心です。',
  make: () => {
    const B = bus('filter'); let fc = 700, q = 6, v = null, fl = null;
    const set = p => { fc = fx(clamp((p.x - 10) / (W - 20), 0, 1)) * .9 + 30; q = lerp(18, .7, clamp((p.y - 30) / (H - 60), 0, 1)); if (v && v.alive) { const t = now(); fl.frequency.setTargetAtTime(fc, t, .02); fl.Q.setTargetAtTime(q, t, .02); } };
    const resp = f => { const r = f / fc; return 1 / Math.sqrt((1 - r * r) * (1 - r * r) + (r / q) * (r / q)); };
    return {
      down(p) { set(p); const c = B.ctx(); if (!c) return; const t = c.currentTime, g = gain(c, 0, B.in); fl = filt(c, 'lowpass', fc, q, g); v = voice(B, g, [osc(c, 'sawtooth', 110, t, 0, fl), osc(c, 'sawtooth', 110.6, t, 0, fl), osc(c, 'sawtooth', 55, t, 0, fl)], .28); },
      move(p, d) { if (d) set(p); },
      up() { if (v) v.off(.15); },
      draw(g) {
        bg(g); const X = 10, Y = 26, w = W - 20, h = 164;
        freqGrid(g, X, Y, w, h); spectrum(g, B, X, Y, w, h);
        const yd = db => Y + h - clamp((db + 40) / 66, 0, 1) * h;
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(X, yd(0)); g.lineTo(X + w, yd(0)); g.stroke();
        g.fillStyle = 'rgba(240,165,74,.12)'; g.strokeStyle = COL.accent; g.lineWidth = 2; g.beginPath();
        for (let i = 0; i <= 160; i++) { const u = i / 160, y = yd(20 * Math.log10(resp(fx(u)))); if (i) g.lineTo(X + u * w, y); else g.moveTo(X + u * w, y); }
        g.stroke(); g.lineTo(X + w, Y + h); g.lineTo(X, Y + h); g.fill();
        const cx = X + xf(fc) * w; g.setLineDash([3, 3]); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, Y); g.lineTo(cx, Y + h); g.stroke(); g.setLineDash([]);
        mono(g, `cutoff ${fc.toFixed(0)} Hz`, X, 16); mono(g, `Q ${q.toFixed(1)}`, X + w, 16, { align: 'right' });
        note(g, '通す', X + 2, 206, { size: 9.5 }); note(g, '削る →', X + w, 206, { size: 9.5, align: 'right' });
      }
    };
  }
},
{
  s: 'tone', name: 'ビブラートとトレモロ', tag: 'LFO 6Hz → frequency / gain', interactive: true, hint: '左右をクリックで鳴らす',
  desc: '耳に聞こえないほどゆっくりした波（LFO）で、別の値を揺らします。高さを揺らすとビブラート、音量を揺らすとトレモロ。どちらも歌声や楽器に表情をつけ、止まった電子音を生き生きと聞かせます。',
  make: () => {
    const B = bus('lfo'); let t = 0; const act = [-1, -1];
    return {
      step() { t++; for (let i = 0; i < 2; i++) if (act[i] >= 0 && ++act[i] > 100) act[i] = -1; },
      down(p) {
        const i = p.x < W / 2 ? 0 : 1; act[i] = 0; const c = B.ctx(); if (!c) return;
        const t0 = c.currentTime + .01, env = c.createGain(); env.connect(B.in);
        env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(.45, t0 + .05); env.gain.setValueAtTime(.45, t0 + 1.3); env.gain.linearRampToValueAtTime(0, t0 + 1.65);
        const o = osc(c, 'triangle', 440, t0, t0 + 1.7), lfo = osc(c, 'sine', 6, t0, t0 + 1.7);
        if (i === 0) { o.connect(env); lfo.connect(gain(c, 14, o.frequency)); }
        else { const tg = gain(c, .5, env); o.connect(tg); lfo.connect(gain(c, .5, tg.gain)); }
      },
      draw(g) {
        bg(g); g.fillStyle = '#15171b'; g.fillRect(119, 0, 2, H);
        [['ビブラート', '高さを揺らす'], ['トレモロ', '音量を揺らす']].forEach(([n, s], i) => {
          const x = i * 121, on = act[i] >= 0, ph = t * (on ? .04 : .01);
          chip(g, n, x + 10, 18, on); note(g, s, x + 10, 40, { size: 9.5 });
          g.strokeStyle = on ? COL.cyan : 'rgba(79,224,255,.5)'; g.lineWidth = 1.6;
          if (i === 0) plot(g, u => Math.sin(TAU * (u * 9 + ph * 3) + 1.3 * Math.sin(TAU * (u * 1.4 + ph))), x + 10, 104, 99, 30, 300);
          else plot(g, u => Math.sin(TAU * (u * 9 + ph * 3)) * (.55 + .45 * Math.sin(TAU * (u * 1.4 + ph))), x + 10, 104, 99, 30, 300);
          g.strokeStyle = 'rgba(240,165,74,.7)'; g.lineWidth = 1.2; g.setLineDash([3, 3]);
          plot(g, u => Math.sin(TAU * (u * 1.4 + ph)), x + 10, 172, 99, 16, 80); g.setLineDash([]);
          note(g, 'LFO（6Hz）', x + 10, 206, { size: 9.5 });
        });
      }
    };
  }
},
{
  s: 'tone', name: 'FM合成', tag: 'sin(ωt + I·sin(r·ωt))', interactive: true, cursor: 'crosshair', hint: 'クリックで鳴らす（横で周波数比、縦で変調の深さ）',
  desc: 'ある波の高さを、耳に聞こえる速さの別の波で激しく揺らすと、たくさんの倍音が生まれます。周波数の比が整数だと楽器らしく、半端だと鐘や金属のような音に。変調の深さを時間とともに弱めると、叩いた瞬間だけ明るい音になります。',
  make: () => {
    const B = bus('fm'); let r = 3.5, I = 7, el = -1;
    const X0 = 14, X1 = 226, Y0 = 60, Y1 = 190;
    return {
      step() { if (el >= 0) { el += 1 / 60; if (el > 2.2) el = -1; } },
      down(p) {
        r = Math.round(lerp(.5, 5, clamp((p.x - X0) / (X1 - X0), 0, 1)) * 2) / 2; I = Math.round(lerp(12, 0, clamp((p.y - Y0) / (Y1 - Y0), 0, 1)) * 2) / 2; el = 0;
        const c = B.ctx(); if (!c) return; const t0 = c.currentTime + .01, fc = 330, fm = fc * r;
        const car = osc(c, 'sine', fc, t0, t0 + 2.3, perc(c, t0, .4, 2.2, B.in, .003)), mod = osc(c, 'sine', fm, t0, t0 + 2.3), mg = gain(c, 0, car.frequency);
        mod.connect(mg); mg.gain.setValueAtTime(Math.max(I * fm, .01), t0); mg.gain.exponentialRampToValueAtTime(Math.max(I * fm * .02, .01), t0 + 1.8);
      },
      draw(g) {
        bg(g); const Ic = el >= 0 ? I * Math.pow(.02, clamp(el / 1.8, 0, 1)) : I;
        g.strokeStyle = el >= 0 ? COL.yellow : 'rgba(255,216,77,.55)'; g.lineWidth = 1.6;
        plot(g, u => Math.sin(TAU * u * 3 + Ic * Math.sin(TAU * u * 3 * r)), X0, 30, X1 - X0, 16, 500);
        g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
        g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
        for (let k = 1; k <= 5; k++) { const px = X0 + (k - .5) / 4.5 * (X1 - X0); g.beginPath(); g.moveTo(px, Y0); g.lineTo(px, Y1); g.stroke(); mono(g, '' + k, px, Y1 + 11, { size: 8.5, align: 'center', color: COL.muted }); }
        const px = X0 + (r - .5) / 4.5 * (X1 - X0), py = Y0 + (1 - I / 12) * (Y1 - Y0);
        g.fillStyle = COL.accent; g.beginPath(); g.arc(px, py, 5, 0, TAU); g.fill();
        if (el >= 0) { g.strokeStyle = COL.accent; g.globalAlpha = 1 - el / 2.2; g.beginPath(); g.arc(px, py, 5 + el * 30, 0, TAU); g.stroke(); g.globalAlpha = 1; }
        mono(g, `比 r = ${r}`, X0, Y0 - 6); mono(g, `深さ I = ${Ic.toFixed(1)}`, X1, Y0 - 6, { align: 'right' });
        note(g, Number.isInteger(r) ? '整数比: 楽器らしい音' : '半端な比: 鐘・金属の音', X0, 214, { size: 9.5 });
        note(g, '周波数比 →', X1, 214, { size: 9.5, align: 'right' });
      }
    };
  }
},
{
  s: 'tone', name: '歪み（ディストーション）', tag: 'y = tanh(k·x) / tanh(k)', interactive: true, capture: true, cursor: 'ew-resize', hint: '押したまま左右に動かす（右ほど強く歪む）',
  desc: '入ってきた波を、大きいところほど押しつぶすように曲げます。丸い波が四角に近づいて倍音が増え、エレキギターのような荒々しい音に。左の曲線が「入力 → 出力」の変換、右がそれを通したサイン波です。',
  make: () => {
    const B = bus('dist'); let k = 4, v = null, sh = null;
    const curve = k => { const n = 1024, a = new Float32Array(n), d = Math.tanh(k); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; a[i] = Math.tanh(k * x) / d; } return a; };
    const set = p => { k = Math.pow(60, clamp((p.x - 10) / (W - 20), 0, 1)) * .8 + .2; if (sh && v && v.alive) sh.curve = curve(k); };
    return {
      down(p) {
        set(p); const c = B.ctx(); if (!c) return; const t = c.currentTime, g = gain(c, 0, B.in), lp = filt(c, 'lowpass', 5000, .7, g);
        sh = c.createWaveShaper(); sh.curve = curve(k); sh.oversample = '4x'; sh.connect(lp); const pre = gain(c, .5, sh);
        v = voice(B, g, [osc(c, 'sine', 110, t, 0, pre), osc(c, 'sine', 165, t, 0, pre), osc(c, 'sine', 55, t, 0, pre)], .22);
      },
      move(p, d) { if (d) set(p); },
      up() { if (v) v.off(.2); },
      draw(g) {
        bg(g); const d = Math.tanh(k), on = v && v.alive;
        g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(12, 34, 96, 96); g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(12, 82); g.lineTo(108, 82); g.moveTo(60, 34); g.lineTo(60, 130); g.stroke();
        g.setLineDash([2, 3]); g.beginPath(); g.moveTo(12, 130); g.lineTo(108, 34); g.stroke(); g.setLineDash([]);
        g.strokeStyle = COL.accent; g.lineWidth = 2; plot(g, u => Math.tanh(k * (u * 2 - 1)) / d, 12, 82, 96, 46, 120);
        note(g, '入力 → 出力', 12, 146, { size: 9.5 });
        g.strokeStyle = 'rgba(79,224,255,.3)'; g.lineWidth = 1.2; plot(g, u => Math.sin(u * TAU * 2), 124, 82, 104, 40, 200);
        g.strokeStyle = on ? COL.red : 'rgba(255,84,112,.7)'; g.lineWidth = 2; plot(g, u => Math.tanh(k * Math.sin(u * TAU * 2)) / d, 124, 82, 104, 40, 200);
        note(g, '通したサイン波', 124, 146, { size: 9.5 });
        mono(g, `k = ${k.toFixed(1)}`, 12, 20); note(g, k < 2 ? 'ほぼそのまま' : k < 10 ? 'オーバードライブ' : 'ファズ（ほぼ四角）', 228, 20, { align: 'right', size: 9.5 });
        scope(g, B, 12, 164, 216, 44, COL.red);
      }
    };
  }
},
{
  s: 'tone', name: 'ビットクラッシュ', tag: 'quantize to 2^bits levels', interactive: true, capture: true, cursor: 'ew-resize', hint: '押したまま左右に動かす（左ほど粗い）',
  desc: '波の高さを表す段階の数（ビット数）を減らすと、なめらかな波が階段になります。段差のぶんだけ耳障りな倍音が加わり、昔のゲーム機やおもちゃのような、ざらついた音になります。',
  make: () => {
    const B = bus('crush'); let bits = 3, v = null, sh = null;
    const curve = b => { const n = 4096, L = Math.pow(2, b), a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; a[i] = Math.round((x + 1) / 2 * (L - 1)) / (L - 1) * 2 - 1; } return a; };
    const q = (x, b) => { const L = Math.pow(2, b); return Math.round((x + 1) / 2 * (L - 1)) / (L - 1) * 2 - 1; };
    const set = p => { const nb = Math.round(lerp(1, 8, clamp((p.x - 10) / (W - 20), 0, 1))); if (nb !== bits) { bits = nb; if (sh && v && v.alive) sh.curve = curve(bits); } };
    return {
      down(p) { set(p); const c = B.ctx(); if (!c) return; const t = c.currentTime, g = gain(c, 0, B.in); sh = c.createWaveShaper(); sh.curve = curve(bits); sh.connect(g); v = voice(B, g, [osc(c, 'sine', 220, t, 0, sh)], .3); },
      move(p, d) { if (d) set(p); },
      up() { if (v) v.off(.15); },
      draw(g) {
        bg(g); const on = v && v.alive, L = Math.pow(2, bits);
        g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1;
        if (L <= 32) for (let i = 0; i < L; i++) { const y = 92 - (i / (L - 1) * 2 - 1) * 56; g.beginPath(); g.moveTo(12, y); g.lineTo(228, y); g.stroke(); }
        g.strokeStyle = 'rgba(79,224,255,.3)'; g.lineWidth = 1.2; plot(g, u => Math.sin(u * TAU * 1.5), 12, 92, 216, 56, 200);
        g.strokeStyle = on ? COL.green : 'rgba(94,240,138,.7)'; g.lineWidth = 2; plot(g, u => q(Math.sin(u * TAU * 1.5), bits), 12, 92, 216, 56, 600);
        mono(g, `${bits} bit = ${L} 段階`, 12, 20, { size: 11 }); note(g, bits >= 7 ? 'ほぼなめらか' : bits >= 4 ? 'ざらざら' : 'ガビガビ', 228, 20, { align: 'right', size: 9.5 });
        for (let b = 1; b <= 8; b++) { const x = 12 + (b - 1) / 7 * 216; g.fillStyle = b === bits ? COL.accent : '#39405a'; g.beginPath(); g.arc(x, 162, b === bits ? 4 : 2.5, 0, TAU); g.fill(); }
        scope(g, B, 12, 172, 216, 40, COL.green);
      }
    };
  }
},

/* ---------------- 効果音のレシピ ---------------- */
recipe({ name: 'ジャンプ', tag: 'square · 240 → 720 Hz', rec: REC.jump,
  desc: '矩形波の高さを、短い時間でぐっと上げるだけ。音が上がることで、体が上に持ち上がる感じが伝わります。' }),
recipe({ name: 'コイン', tag: 'square · シ5 → ミ6 の2音', rec: REC.coin,
  desc: '高い2つの音を、すき間なく切り替えます。2つ目を長めに残すと、キラッとした余韻が出ます。音の高さは「上がる」方がうれしく聞こえます。' }),
recipe({ name: 'レーザー', tag: 'saw + square · 1.6k → 110 Hz', rec: REC.laser,
  desc: '高いところから一気に下げると、飛んでいく光線の音に。少しずらした2つの波を重ねると、厚みが出ます。' }),
recipe({ name: '爆発', tag: 'noise + lowpass sweep + sine drop', rec: REC.boom,
  desc: 'ノイズを、通す高さ（フィルター）を下げながら鳴らします。最初は明るく「バッ」、だんだんこもって「ゴロゴロ…」。下で低いサイン波を落とすと、お腹に響く重さが出ます。' }),
recipe({ name: 'パワーアップ', tag: 'square arpeggio × 12', rec: REC.power,
  desc: '和音の音を1つずつ素早く鳴らす「アルペジオ」を、だんだん高い和音にずらしていきます。上がり続ける音は、強くなっていく感じを伝えます。' }),
recipe({ name: 'ダメージ', tag: 'saw drop + noise burst', rec: REC.hurt,
  desc: '下がる音は「失敗」や「痛み」を表します。頭に短いノイズを重ねて、当たった瞬間の衝撃を出しています。' }),
recipe({ name: '打撃（パンチ）', tag: 'sine 160 → 45 Hz + click', rec: REC.punch,
  desc: '低いサイン波をすばやく落とした「ドッ」に、ごく短いノイズの「パチッ」を重ねます。低音が重さ、ノイズが当たりの鋭さの担当です。' }),
{
  s: 'sfx', name: '毎回少し変える', tag: 'pitch × 0.88 〜 1.12 · volume ± 20%', interactive: true, hint: '上と下をクリックで6連射',
  desc: '同じ音を何度もくり返すと、機械的で耳障りに聞こえます（マシンガン効果）。鳴らすたびに高さと大きさを少しだけ乱数でずらすと、自然で聞き疲れしない音になります。足音や銃声の定番の工夫です。',
  make: (env) => {
    const B = bus('vary'), shots = [[], []], age = [-1, -1];
    return {
      step() { for (let i = 0; i < 2; i++) if (age[i] >= 0 && ++age[i] > 60) age[i] = -1; },
      down(p) {
        const i = p.y < H / 2 ? 0 : 1; age[i] = 0; shots[i] = [];
        for (let k = 0; k < 6; k++) shots[i].push(i ? { p: .88 + env.rand() * .24, v: .8 + env.rand() * .4 } : { p: 1, v: 1 });
        const c = B.ctx(); if (!c) return; const t0 = c.currentTime + .02;
        shots[i].forEach((s, k) => playRecipe(c, REC.shot, t0 + k * .1, B.in, s.p, s.v));
      },
      draw(g) {
        bg(g);
        [['毎回同じ', 0], ['毎回ゆらす', 1]].forEach(([n, i]) => {
          const y = i * (H / 2 + 2), h = H / 2 - 2;
          g.fillStyle = i ? '#0f1428' : '#0d1020'; g.fillRect(0, y, W, h);
          chip(g, n, 8, y + 17, i === 1);
          g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(20, y + 62); g.lineTo(226, y + 62); g.stroke();
          const list = shots[i].length ? shots[i] : Array.from({ length: 6 }, () => ({ p: 1, v: 1 }));
          list.forEach((s, k) => {
            const x = 40 + k * 34, cy = y + 62 - (s.p - 1) * 250, lit = age[i] >= 0 && age[i] >= k * 6 && age[i] < k * 6 + 10;
            g.fillStyle = lit ? COL.yellow : i ? 'rgba(255,216,77,.55)' : 'rgba(157,162,172,.6)';
            g.beginPath(); g.arc(x, cy, 4 + s.v * 4 + (lit ? 2 : 0), 0, TAU); g.fill();
          });
          note(g, '高', 10, y + 36, { size: 9 }); note(g, '低', 10, y + 94, { size: 9 });
        });
        g.fillStyle = '#15171b'; g.fillRect(0, H / 2 - 2, W, 4);
      }
    };
  }
},
{
  s: 'sfx', name: 'しゃべる電子音', tag: '1文字 = 1回の短い音', interactive: true, hint: 'クリックで次のセリフ',
  desc: 'セリフが1文字出るたびに短い音を鳴らすと、声がなくても「しゃべっている」感じが出ます。音の高さを文字ごとに決めておくと、同じ言葉はいつも同じ節回しになり、キャラクターの口ぐせのように聞こえます。',
  make: () => {
    const B = bus('babble');
    const LINES = ['やあ！ きょうは いい てんき だね。', 'この どうくつの おくに たからが ねむって いるらしい。', 'ことばは なくても きもちは つたわるよ。'];
    let li = -1, pos = 0, wait = 0, mouth = 0, text = '', blink = 0;
    const start = () => { li = (li + 1) % LINES.length; text = LINES[li]; pos = 0; wait = 10; };
    return {
      step() {
        mouth *= .8; blink = (blink + 1) % 200;
        if (li < 0 || pos >= text.length) return;
        if (--wait > 0) return;
        const ch = text[pos++]; wait = '、。！？'.includes(ch) ? 14 : 4;
        if (ch !== ' ' && !'、。！？'.includes(ch)) {
          mouth = 1; const c = B.ctx();
          if (c) blip(c, c.currentTime + .005, 400 * Math.pow(2, ((ch.charCodeAt(0) * 7) % 9 - 4) / 12), B.in, .2);
        }
      },
      down() { start(); },
      draw(g) {
        bg(g);
        g.fillStyle = '#5b8cff'; rr(g, 92, 26, 56, 52, 18); g.fill();
        g.fillStyle = '#0b0e1a'; const eh = blink < 6 ? 1.5 : 7; g.fillRect(106, 44 + (7 - eh) / 2, 5, eh); g.fillRect(129, 44 + (7 - eh) / 2, 5, eh);
        g.beginPath(); g.ellipse(120, 64, 6, 1 + mouth * 5, 0, 0, TAU); g.fill();
        g.fillStyle = '#12162a'; g.strokeStyle = '#ece8e0'; g.lineWidth = 1.5; rr(g, 12, 98, 216, 108, 8); g.fill(); g.stroke();
        if (li < 0) { note(g, 'クリックで話しかける', 120, 158, { align: 'center', size: 11 }); return; }
        g.font = '500 13px ' + G2D.FONT; g.fillStyle = COL.ink; g.textBaseline = 'alphabetic';
        let x = 26, y = 124; const shown = text.slice(0, pos);
        for (const ch of shown) { const w = g.measureText(ch).width; if (x + w > 214) { x = 26; y += 22; } g.fillText(ch, x, y); x += w; }
        if (pos >= text.length && blink % 40 < 24) { g.fillStyle = COL.accent; g.beginPath(); g.moveTo(206, 192); g.lineTo(214, 192); g.lineTo(210, 197); g.fill(); }
      }
    };
  }
},

/* ---------------- 空間と距離 ---------------- */
{
  s: 'space', name: '左右の定位（パン）', tag: 'StereoPanner −1 … +1', interactive: true, capture: true, cursor: 'ew-resize', hint: '押したまま左右に動かす（ヘッドホン推奨）',
  desc: '左右のスピーカーの音量の割合を変えるだけで、音が鳴っている方向を表せます。真ん中で音量が下がって聞こえないよう、2乗の和が一定になる曲線（等パワー）で振り分けるのが基本です。',
  make: () => {
    const B = bus('pan'); let sx = 170, t = 0, held = false; const rings = [];
    const pan = () => clamp((sx - 120) / 100, -1, 1);
    const ping = () => { rings.push({ x: sx, r: 0 }); const c = B.ctx(); if (!c) return; const p = c.createStereoPanner(); p.pan.value = pan(); p.connect(B.in); pluck(c, c.currentTime + .005, 880, p, .35, .3, 'sine'); };
    return {
      step() { t++; for (const r of rings) r.r += 2; while (rings.length && rings[0].r > 140) rings.shift(); if (held && t % 16 === 0) ping(); },
      down(p) { held = true; sx = clamp(p.x, 20, 220); t = 0; ping(); },
      move(p, d) { if (d) sx = clamp(p.x, 20, 220); },
      up() { held = false; },
      draw(g) {
        bg(g); const pv = pan(), L = Math.cos((pv + 1) * Math.PI / 4), R = Math.sin((pv + 1) * Math.PI / 4);
        for (const r of rings) { g.strokeStyle = `rgba(255,216,77,${.6 * (1 - r.r / 140)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(r.x, 62, r.r, 0, TAU); g.stroke(); }
        g.fillStyle = COL.yellow; g.beginPath(); g.arc(sx, 62, 8, 0, TAU); g.fill();
        g.fillStyle = '#39405a'; g.beginPath(); g.arc(120, 162, 22, 0, TAU); g.fill();
        g.fillStyle = '#6b7493'; g.beginPath(); g.ellipse(97, 162, 5, 9, 0, 0, TAU); g.ellipse(143, 162, 5, 9, 0, 0, TAU); g.fill();
        g.fillStyle = '#6b7493'; g.beginPath(); g.moveTo(114, 141); g.lineTo(126, 141); g.lineTo(120, 133); g.fill();
        [[L, 14, '左'], [R, 204, '右']].forEach(([v, x, n]) => { g.fillStyle = '#2a2f40'; g.fillRect(x, 130, 22, 64); g.fillStyle = COL.accent; g.fillRect(x, 194 - v * 64, 22, v * 64); label(g, n, x + 11, 208, { size: 10, align: 'center', color: COL.muted }); mono(g, Math.round(v * 100) + '%', x + 11, 125, { size: 9, align: 'center' }); });
        mono(g, `pan ${pv >= 0 ? '+' : ''}${pv.toFixed(2)}`, 120, 20, { align: 'center' });
      }
    };
  }
},
{
  s: 'space', name: '距離で小さく、こもる', tag: 'gain = 1 / (1 + d/40) · lowpass', interactive: true, capture: true, cursor: 'move', hint: '押したまま音源を動かす',
  desc: '遠くの音は小さくなるだけでなく、高い音ほど空気に吸われてこもって聞こえます。音量・こもり具合・左右の定位の3つを距離と方向から計算すると、目を閉じても音源の位置がなんとなく分かります。',
  make: () => {
    const B = bus('dist3d'), LX = 120, LY = 118; let sx = 190, sy = 50, t = 0, held = false; const rings = [];
    const params = () => { const d = Math.hypot(sx - LX, sy - LY); return { d, g: 1 / (1 + d / 40), cut: clamp(14000 * Math.exp(-d / 45), 250, 14000), pan: clamp((sx - LX) / 110, -1, 1) }; };
    const ping = () => {
      rings.push({ x: sx, y: sy, r: 0 }); const c = B.ctx(); if (!c) return; const P = params();
      const p = c.createStereoPanner(); p.pan.value = P.pan; p.connect(B.in);
      const f = filt(c, 'lowpass', P.cut, .7, gain(c, P.g, p)); pluck(c, c.currentTime + .005, 660, f, .5, .35, 'sawtooth'); noiseSrc(c, 'white', c.currentTime, c.currentTime + .05, perc(c, c.currentTime, .3, .04, f, .001));
    };
    return {
      step() { t++; for (const r of rings) r.r += 1.6; while (rings.length && rings[0].r > 60) rings.shift(); if (held && t % 18 === 0) ping(); },
      down(p) { held = true; sx = clamp(p.x, 8, 232); sy = clamp(p.y, 8, 212); t = 0; ping(); },
      move(p, d) { if (d) { sx = clamp(p.x, 8, 232); sy = clamp(p.y, 8, 212); } },
      up() { held = false; },
      draw(g) {
        bg(g); const P = params();
        [[40, '50%'], [120, '25%'], [200, '17%']].forEach(([r, n]) => { g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.setLineDash([3, 4]); g.beginPath(); g.arc(LX, LY, r, 0, TAU); g.stroke(); g.setLineDash([]); mono(g, n, LX + r * .72 + 3, LY - r * .72, { size: 8.5, color: COL.muted }); });
        for (const r of rings) { g.strokeStyle = `rgba(255,216,77,${.7 * (1 - r.r / 60) * P.g * 1.5})`; g.lineWidth = 1.5; g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.stroke(); }
        g.fillStyle = '#6b7493'; g.beginPath(); g.arc(LX, LY, 9, 0, TAU); g.fill(); g.fillStyle = '#9da2ac'; g.beginPath(); g.moveTo(LX - 4, LY - 8); g.lineTo(LX + 4, LY - 8); g.lineTo(LX, LY - 14); g.fill();
        g.fillStyle = COL.yellow; g.globalAlpha = .4 + .6 * P.g * 1.2; g.beginPath(); g.arc(sx, sy, 7, 0, TAU); g.fill(); g.globalAlpha = 1;
        mono(g, `音量 ${Math.round(P.g * 100)}%`, 8, 16); mono(g, `こもり ${P.cut >= 1000 ? (P.cut / 1000).toFixed(1) + 'k' : P.cut.toFixed(0)}Hz`, 232, 16, { align: 'right' });
      }
    };
  }
},
{
  s: 'space', name: 'ドップラー効果', tag: "f' = f · c / (c + v)", interactive: true, hint: 'クリックで車を走らせる',
  desc: '近づいてくる音源は、前に出した波に追いつきながら次の波を出すので、波の間隔が詰まって高く聞こえます。遠ざかるときは逆に低く。救急車のサイレンでおなじみの効果で、速く動くものの音に使います。',
  make: () => {
    const B = bus('doppler'), LX = 120, LY = 190, SY = 70, C = 5, V = 2.2;
    let run = -1, sx = -30, lastD = null, fr = 1, v = null, oA = null, oB = null, pn = null, gg = null; let waves = [];
    return {
      step() {
        for (const w of waves) w.r += C; waves = waves.filter(w => w.r < 320);
        if (run < 0) return;
        run++; sx += V; if (run % 5 === 0) waves.push({ x: sx, r: 0 });
        const d = Math.hypot(sx - LX, SY - LY), vr = lastD === null ? 0 : d - lastD; lastD = d; fr = C / (C + vr);
        if (v && v.alive) { const t = now(); oA.frequency.setTargetAtTime(392 * fr, t, .02); oB.frequency.setTargetAtTime(588 * fr, t, .02); pn.pan.setTargetAtTime(clamp((sx - LX) / 140, -1, 1), t, .03); gg.gain.setTargetAtTime(1 / (1 + d / 70), t, .03); }
        if (sx > 280) { run = -1; if (v) v.off(.1); }
      },
      down() {
        run = 0; sx = -30; lastD = null; fr = 1; waves = [];
        const c = B.ctx(); if (!c) return; if (v) v.off(.02);
        const t = c.currentTime, g = gain(c, 0, B.in); pn = c.createStereoPanner(); pn.connect(g); gg = gain(c, .3, pn); const lp = filt(c, 'lowpass', 2200, 1, gg);
        oA = osc(c, 'sawtooth', 392, t, 0, lp); oB = osc(c, 'triangle', 588, t, 0, lp); v = voice(B, g, [oA, oB], .45);
      },
      draw(g) {
        bg(g);
        for (const w of waves) { g.strokeStyle = `rgba(79,224,255,${.5 * (1 - w.r / 320)})`; g.lineWidth = 1.2; g.beginPath(); g.arc(w.x, SY, w.r, 0, TAU); g.stroke(); }
        g.fillStyle = '#232b45'; g.fillRect(0, SY + 12, W, 4);
        g.fillStyle = COL.red; rr(g, sx - 16, SY - 10, 32, 16, 5); g.fill(); g.fillStyle = '#ffd6de'; g.fillRect(sx + 4, SY - 7, 8, 5);
        g.fillStyle = '#15171b'; g.beginPath(); g.arc(sx - 9, SY + 7, 4, 0, TAU); g.arc(sx + 9, SY + 7, 4, 0, TAU); g.fill();
        g.fillStyle = '#6b7493'; g.beginPath(); g.arc(LX, LY, 9, 0, TAU); g.fill(); g.fillStyle = '#9da2ac'; g.beginPath(); g.moveTo(LX - 4, LY - 8); g.lineTo(LX + 4, LY - 8); g.lineTo(LX, LY - 14); g.fill();
        if (run >= 0) { mono(g, `×${fr.toFixed(2)}`, 12, 20, { size: 11, color: fr > 1.01 ? COL.yellow : fr < .99 ? COL.cyan : COL.ink }); note(g, fr > 1.01 ? '近づく → 高く' : fr < .99 ? '遠ざかる → 低く' : '真横', 228, 20, { align: 'right', size: 10 }); }
        else note(g, 'クリックで走らせる', 228, 20, { align: 'right', size: 10 });
      }
    };
  }
},
{
  s: 'space', name: 'エコー（やまびこ）', tag: 'delay · feedback', interactive: true, cursor: 'crosshair', hint: 'クリックで鳴らす（横で間隔、縦で返ってくる強さ）',
  desc: '音を少し遅らせて、小さくしてからもう一度鳴らし、それをまた遅らせて…とくり返します。間隔が長いと山びこ、短いと狭い金属の筒の中のような響きに。下の棒は、返ってくる音の時刻と大きさです。',
  make: () => {
    const B = bus('echo'); let dt = .3, fb = .5, el = -1;
    return {
      step() { if (el >= 0) { el += 1 / 60; if (el > 3.2) el = -1; } },
      down(p) {
        dt = lerp(.06, .6, clamp((p.x - 10) / (W - 20), 0, 1)); fb = lerp(.8, .15, clamp((p.y - 20) / 110, 0, 1)); el = 0;
        const c = B.ctx(); if (!c) return;
        if (!B.x.dl) { const dl = c.createDelay(2), f = gain(c, fb, dl), lp = filt(c, 'lowpass', 4000, .5, f); dl.connect(lp); dl.connect(gain(c, .9, B.in)); B.x = { dl, f }; }
        const t0 = c.currentTime + .01; B.x.dl.delayTime.setValueAtTime(dt, t0); B.x.f.gain.setValueAtTime(fb, t0);
        const s = gain(c, 1, B.in); s.connect(B.x.dl); pluck(c, t0, 523, s, .4, .25, 'square');
      },
      draw(g) {
        bg(g);
        g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(10, 20, W - 20, 110);
        const px = 10 + (dt - .06) / .54 * (W - 20), py = 20 + (.8 - fb) / .65 * 110;
        g.fillStyle = COL.accent; g.beginPath(); g.arc(px, py, 5, 0, TAU); g.fill();
        mono(g, `間隔 ${(dt * 1000).toFixed(0)} ms`, 10, 14); mono(g, `返り ${Math.round(fb * 100)}%`, 230, 14, { align: 'right' });
        note(g, '短い ← 間隔 → 長い', 120, 124, { align: 'center', size: 9 });
        const T = 3, X0 = 12, X1 = 228, Y1 = 206, hh = 56, tx = s => X0 + s / T * (X1 - X0);
        g.fillStyle = '#232b45'; g.fillRect(X0, Y1, X1 - X0, 1);
        for (let k = 0, a = 1; tx(k * dt) <= X1 && a > .01; k++, a *= fb) {
          const x = tx(k * dt), lit = el >= k * dt && el < k * dt + .2;
          g.fillStyle = lit ? COL.yellow : k ? 'rgba(255,216,77,.5)' : COL.ink; g.fillRect(x - 1.5, Y1 - a * hh, 3, a * hh);
        }
        if (el >= 0 && el <= T) { const x = tx(el); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, Y1 - hh - 4); g.lineTo(x, Y1); g.stroke(); }
        mono(g, '0', X0, Y1 + 11, { size: 8.5, color: COL.muted }); mono(g, '3 s', X1, Y1 + 11, { size: 8.5, color: COL.muted, align: 'right' });
      }
    };
  }
},
{
  s: 'space', name: '残響（リバーブ）', tag: 'convolution · impulse response', interactive: true, hint: '3つの場所をクリックで鳴らす',
  desc: '部屋の中では、壁や天井で何百回も反射した音が重なり、なめらかな余韻になります。その場所で手を1回叩いたときの響き（インパルス応答）を用意しておき、音に畳み込むと、その場所で鳴らしたように聞こえます。',
  make: (env) => {
    const B = bus('reverb'), P = [{ n: '小部屋', len: .5, dec: 3, pre: 0 }, { n: 'ホール', len: 2.2, dec: 2.2, pre: .015 }, { n: '洞窟', len: 4.2, dec: 1.6, pre: .06, dark: true }];
    const vis = P.map(p => Array.from({ length: 60 }, (_, i) => { const u = i / 59, tt = u * 4.4; return tt < p.pre ? 0 : tt > p.len ? 0 : Math.pow(1 - (tt - p.pre) / (p.len - p.pre), p.dec) * (.35 + .65 * env.rand()); }));
    let act = -1, el = 0;
    const ir = (c, p) => { const n = Math.ceil(c.sampleRate * (p.len + .05)), b = c.createBuffer(2, n, c.sampleRate), pre = Math.floor(p.pre * c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = pre; i < n; i++) { const u = (i - pre) / (n - pre), w = Math.random() * 2 - 1; lp = p.dark ? lp + (w - lp) * .12 : w; d[i] = lp * Math.pow(1 - u, p.dec) * (p.dark ? 2.2 : 1); } } return b; };
    return {
      step() { if (act >= 0) { el += 1 / 60; if (el > P[act].len + .4) act = -1; } },
      down(p) {
        const i = clamp(Math.floor(p.x / 80), 0, 2); act = i; el = 0; const c = B.ctx(); if (!c) return;
        if (!B.x.cv) B.x.cv = P.map(pp => { const cv = c.createConvolver(); cv.buffer = ir(c, pp); cv.connect(gain(c, .55, B.in)); return cv; });
        const t0 = c.currentTime + .01, s = gain(c, 1, B.in); s.connect(B.x.cv[i]);
        noiseSrc(c, 'white', t0, t0 + .08, filt(c, 'bandpass', 1800, .8, perc(c, t0, .9, .07, s, .001))); osc(c, 'triangle', 200, t0, t0 + .12, perc(c, t0, .6, .1, s, .002));
      },
      draw(g) {
        bg(g);
        P.forEach((p, i) => {
          const x = i * 80, on = act === i;
          if (i) { g.fillStyle = '#15171b'; g.fillRect(x - 1, 0, 2, H); }
          chip(g, p.n, x + 8, 18, on); mono(g, p.len + ' s', x + 72, 18, { align: 'right', size: 9, color: COL.muted });
          g.fillStyle = on ? 'rgba(240,165,74,.08)' : 'transparent'; g.fillRect(x, 28, 80, H - 28);
          const base = 196, sh = [[0, 0, 44, 40], [0, 0, 70, 34], [0, 0, 70, 50]][i];
          g.strokeStyle = '#39405a'; g.lineWidth = 1.5;
          if (i === 2) { g.beginPath(); g.moveTo(x + 6, 110); g.quadraticCurveTo(x + 40, 40, x + 74, 110); g.stroke(); }
          else { g.strokeRect(x + 40 - sh[2] / 2, 110 - sh[3], sh[2], sh[3]); }
          vis[i].forEach((v, j) => { const tt = j / 59 * 4.4, lit = on && el >= tt; g.fillStyle = lit ? COL.yellow : 'rgba(255,216,77,.35)'; g.fillRect(x + 6 + j * 1.15, base - v * 60, 1, v * 60); });
          g.fillStyle = '#232b45'; g.fillRect(x + 6, base, 70, 1);
          note(g, '響きの形', x + 8, 212, { size: 9 });
        });
      }
    };
  }
},

/* ---------------- 音楽と演出 ---------------- */
{
  s: 'music', name: 'ペンタトニックは外さない', tag: 'ド・レ・ミ・ソ・ラ の5音', interactive: true, hint: '上と下をクリックで、でたらめに10音',
  desc: '12個の音から完全にでたらめに選ぶと、ぶつかり合って落ち着かないメロディになります。ドレミソラの5音（ペンタトニック）だけから選ぶと、ぶつかる組み合わせがないので、でたらめでもそれらしく聞こえます。自動作曲やBGMの即興でよく使う手です。',
  make: (env) => {
    const B = bus('penta'), PENTA = [0, 2, 4, 7, 9], rolls = [[], []], age = [-1, -1];
    const gen = i => { const out = []; for (let k = 0; k < 10; k++) { let s; if (i) { s = PENTA[Math.floor(env.rand() * 5)] + (env.rand() < .5 ? 0 : 12); } else s = Math.floor(env.rand() * 24); out.push(s); } return out; };
    return {
      step() { for (let i = 0; i < 2; i++) if (age[i] >= 0 && ++age[i] > 140) age[i] = -1; },
      down(p) {
        const i = p.y < H / 2 ? 0 : 1; rolls[i] = gen(i); age[i] = 0; const c = B.ctx(); if (!c) return; const t0 = c.currentTime + .02;
        rolls[i].forEach((s, k) => pluck(c, t0 + k * .2, mtof(60 + s), B.in, .32, .45));
        osc(c, 'triangle', mtof(48), t0, t0 + 2.2, (() => { const g = c.createGain(); g.connect(B.in); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.18, t0 + .05); g.gain.linearRampToValueAtTime(0, t0 + 2.1); return g; })());
      },
      draw(g) {
        bg(g);
        [['12音からでたらめ', 0], ['5音からでたらめ', 1]].forEach(([n, i]) => {
          const y = i * (H / 2 + 2), h = H / 2 - 2, ry = s => y + h - 8 - s / 24 * (h - 30);
          g.fillStyle = i ? '#0f1428' : '#0d1020'; g.fillRect(0, y, W, h);
          for (let s = 0; s < 24; s++) if (!i || PENTA.includes(s % 12)) { g.fillStyle = i ? 'rgba(240,165,74,.1)' : 'rgba(255,255,255,.03)'; g.fillRect(34, ry(s) - 1.5, 196, 3); }
          chip(g, n, 8, y + 17, i === 1);
          rolls[i].forEach((s, k) => { const shown = age[i] < 0 || age[i] >= k * 12; if (!shown) return; const lit = age[i] >= k * 12 && age[i] < k * 12 + 12; g.fillStyle = lit ? COL.yellow : i ? 'rgba(255,216,77,.7)' : 'rgba(157,162,172,.8)'; g.fillRect(40 + k * 19, ry(s) - 3, 14, 6); });
        });
        g.fillStyle = '#15171b'; g.fillRect(0, H / 2 - 2, W, 4);
      }
    };
  }
},
{
  s: 'music', name: '長調と短調', tag: 'major 0-4-7 · minor 0-3-7', interactive: true, hint: '左右をクリックで鳴らす',
  desc: 'ドから数えて4つ上（ミ）と7つ上（ソ）を重ねると明るい長三和音、真ん中を半音だけ下げて3つ上（ミ♭）にすると暗い短三和音になります。たった1音の違いで、勝利の場面にも悲しい場面にも聞こえます。',
  make: () => {
    const B = bus('chord'), CH = [[0, 4, 7, 12], [0, 3, 7, 12]], keys = [keyboard(8, 120, 104, 70, 8), keyboard(128, 120, 104, 70, 8)]; const age = [-1, -1];
    return {
      step() { for (let i = 0; i < 2; i++) if (age[i] >= 0 && ++age[i] > 130) age[i] = -1; },
      down(p) {
        const i = p.x < W / 2 ? 0 : 1; age[i] = 0; const c = B.ctx(); if (!c) return; const t0 = c.currentTime + .02;
        CH[i].forEach((s, k) => { const st = t0 + k * .14, g = c.createGain(); g.connect(B.in); g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(.2, st + .01); g.gain.setTargetAtTime(.1, st + .02, .3); g.gain.setTargetAtTime(0, t0 + 1.6, .15); osc(c, 'triangle', mtof(60 + s), st, t0 + 2.3, g); osc(c, 'sine', mtof(72 + s), st, t0 + 2.3, gain(c, .3, g)); });
      },
      draw(g) {
        bg(g); g.fillStyle = '#15171b'; g.fillRect(119, 0, 2, H);
        [['長三和音', 'あかるい', 'ド・ミ・ソ'], ['短三和音', 'くらい', 'ド・ミ♭・ソ']].forEach(([n, m, k], i) => {
          const x = i * 121, on = age[i] >= 0;
          chip(g, n, x + 8, 18, on); label(g, m, x + 60, 64, { size: 18, align: 'center', color: on ? COL.accent : COL.ink }); note(g, k, x + 60, 90, { align: 'center', size: 10 });
          drawKeys(g, keys[i], s => CH[i].includes(s) && (!on || age[i] >= CH[i].indexOf(s) * 8.4), i ? COL.purple : COL.yellow);
        });
        mono(g, '+4 +3', 60, 206, { align: 'center', size: 9, color: COL.muted }); mono(g, '+3 +4', 180, 206, { align: 'center', size: 9, color: COL.muted });
      }
    };
  }
},
{
  s: 'music', name: 'ステップシーケンサー', tag: '16 steps · 112 BPM', interactive: true, hint: 'マスをクリックで入り切り・上の帯で再生と停止',
  desc: '1小節を16のマスに区切り、鳴らすマスに印をつけていくだけでリズムができます。キックが1・5・9・13マス目、スネアが5・13マス目という並びは、ほとんどのポップスやゲーム音楽の土台です。音はすべてその場で合成しています。',
  make: () => {
    const B = bus('seq'), N = ['キック', 'スネア', 'ハット', 'ベース'], cols = [COL.red, COL.yellow, COL.cyan, COL.purple];
    const grid = [[0, 4, 8, 12, 14], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14, 15], [0, 3, 6, 8, 10, 11, 14]].map(a => Array.from({ length: 16 }, (_, i) => a.includes(i)));
    const BASS = [55, 55, 55, 55, 55, 55, 55, 55, 43.65, 43.65, 43.65, 43.65, 49, 49, 49, 49];
    const clk = clock(60 / 112 / 4); let on = false;
    const GX = 50, GY = 36, cw = 11.5, ch = 44;
    return {
      step() { if (!on) return; clk.tick((t, n) => { const s = n % 16, c = AU.ctx; if (grid[0][s]) DRUM.kick(c, t, B.in); if (grid[1][s]) DRUM.snare(c, t, B.in); if (grid[2][s]) DRUM.hat(c, t, B.in, s % 4 === 2 ? 1.3 : .8); if (grid[3][s]) DRUM.bass(c, t, B.in, BASS[s]); }); },
      down(p) {
        if (p.y < 30) { on = !on; if (on) { if (!B.ctx()) on = false; clk.clear(); } return; }
        const s = Math.floor((p.x - GX) / cw), r = Math.floor((p.y - GY) / ch);
        if (s >= 0 && s < 16 && r >= 0 && r < 4) { grid[r][s] = !grid[r][s]; if (grid[r][s]) { const c = B.ctx(); if (c) { const t = c.currentTime + .005; if (r === 3) DRUM.bass(c, t, B.in, BASS[s]); else DRUM[['kick', 'snare', 'hat'][r]](c, t, B.in); } } }
      },
      draw(g) {
        bg(g); const cur = on ? clk.cur() % 16 : -1;
        g.fillStyle = on ? 'rgba(240,165,74,.15)' : 'rgba(255,255,255,.04)'; g.fillRect(0, 0, W, 28);
        label(g, on ? '■ 停止' : '▶ 再生', 10, 19, { size: 11.5, color: on ? COL.accent : COL.ink }); mono(g, '112 BPM', 230, 18, { align: 'right', color: COL.muted });
        for (let r = 0; r < 4; r++) {
          label(g, N[r], 6, GY + r * ch + ch / 2 + 4, { size: 10, color: COL.muted });
          for (let s = 0; s < 16; s++) {
            const x = GX + s * cw, y = GY + r * ch + 3;
            g.fillStyle = s === cur ? 'rgba(255,255,255,.1)' : s % 4 === 0 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.025)'; g.fillRect(x + 1, y, cw - 2, ch - 6);
            if (grid[r][s]) { g.fillStyle = cols[r]; g.globalAlpha = s === cur ? 1 : .7; g.fillRect(x + 2, y + 1, cw - 4, ch - 8); g.globalAlpha = 1; }
          }
        }
      }
    };
  }
},
{
  s: 'music', name: '盛り上がりで変わるBGM', tag: 'vertical layering · gain by intensity', interactive: true, capture: true, cursor: 'ns-resize', hint: '上の帯で再生・押したまま上下に動かして盛り上げる',
  desc: '同じ曲をパートごとに分けて同時に流しておき、戦闘の激しさなどに応じてパートの音量を上げ下げします。曲の途中で切り替えても拍がずれないので、場面にあわせて音楽がなめらかに盛り上がります。',
  make: (env) => {
    const B = bus('layers'), N = ['メロディ', 'ドラム', 'ベース', 'パッド'], TH = [.75, .5, .25, 0], cols = [COL.pink, COL.red, COL.purple, COL.cyan];
    const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; /* Am F C G */
    const clk = clock(60 / 100 / 4); let on = false, inten = .3; const lvl = [0, 0, 0, 1], flash = [0, 0, 0, 0];
    const lg = () => B.x.lg;
    const target = i => inten >= TH[i] - .001 ? 1 : 0;
    const set = p => { inten = clamp(1 - (p.y - 40) / (H - 56), 0, 1); if (lg()) lg().forEach((g, i) => g.gain.setTargetAtTime(target(i) * [.9, 1, 1, .8][i], now(), .25)); };
    return {
      step() {
        for (let i = 0; i < 4; i++) { lvl[i] += (target(i) - lvl[i]) * .06; flash[i] *= .85; }
        if (!on) return;
        clk.tick((t, n) => {
          const c = AU.ctx, s = n % 16, ch = CH[Math.floor(n / 16) % 4], L = lg();
          if (s === 0) { ch.forEach(m => { const g = c.createGain(); g.connect(L[3]); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + .3); g.gain.setTargetAtTime(0, t + 2.2, .15); osc(c, 'triangle', mtof(m), t, t + 2.6, g); }); flash[3] = 1; }
          if ([0, 3, 6, 8, 10, 14].includes(s)) { DRUM.bass(c, t, L[2], mtof(ch[0] - 24), .9); if (target(2)) flash[2] = 1; }
          if (s % 8 === 0) DRUM.kick(c, t, L[1], .8); if (s % 8 === 4) DRUM.snare(c, t, L[1], .7); if (s % 2 === 0) DRUM.hat(c, t, L[1], .6); if (s % 4 === 0 && target(1)) flash[1] = 1;
          if (s % 2 === 0) { const k = [0, 1, 2, 1, 2, 0, 1, 2][(s / 2) | 0], m = ch[k] + 12 + (s === 14 && env.rand() < .5 ? 12 : 0); blip(c, t, mtof(m), L[0], .14); if (target(0)) flash[0] = 1; }
        });
      },
      down(p) {
        if (p.y < 30) {
          on = !on; if (!on) return;
          const c = B.ctx(); if (!c) { on = false; return; }
          if (!B.x.lg) B.x.lg = [0, 1, 2, 3].map(i => gain(c, target(i) * [.9, 1, 1, .8][i], B.in)); clk.clear(); return;
        }
        set(p);
      },
      move(p, d) { if (d && p.y >= 30) set(p); },
      draw(g) {
        bg(g);
        g.fillStyle = on ? 'rgba(240,165,74,.15)' : 'rgba(255,255,255,.04)'; g.fillRect(0, 0, W, 28);
        label(g, on ? '■ 停止' : '▶ 再生', 10, 19, { size: 11.5, color: on ? COL.accent : COL.ink }); mono(g, `盛り上がり ${Math.round(inten * 100)}%`, 230, 18, { align: 'right' });
        const Y0 = 40, Y1 = H - 16, yi = v => Y1 - v * (Y1 - Y0);
        g.fillStyle = '#2a2f40'; g.fillRect(14, Y0, 12, Y1 - Y0); g.fillStyle = COL.accent; g.fillRect(14, yi(inten), 12, Y1 - yi(inten));
        for (let i = 0; i < 4; i++) {
          const y = Y0 + i * (Y1 - Y0) / 4, h = (Y1 - Y0) / 4 - 6;
          g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(40, y, 188, h);
          g.fillStyle = cols[i]; g.globalAlpha = .15 + lvl[i] * .55 + flash[i] * lvl[i] * .3; g.fillRect(40, y, 188 * lvl[i], h); g.globalAlpha = 1;
          label(g, N[i], 48, y + h / 2 + 4, { size: 11, color: lvl[i] > .5 ? '#0b0e1a' : COL.muted });
          if (TH[i]) { g.strokeStyle = 'rgba(255,255,255,.25)'; g.setLineDash([2, 3]); g.lineWidth = 1; g.beginPath(); g.moveTo(10, yi(TH[i])); g.lineTo(32, yi(TH[i])); g.stroke(); g.setLineDash([]); }
        }
      }
    };
  }
},
{
  s: 'music', name: 'ダッキング', tag: 'BGM 0.55 → 0.12 while voice', interactive: true, hint: '上と下をクリックで再生して比べる',
  desc: 'セリフや大事な効果音が鳴っている間だけ、BGMの音量を自動で下げます。「なし」ではセリフが音楽に埋もれて聞き取りにくくなります。下げるときは素早く、戻すときはゆっくりにすると、下がったことに気づかれにくくなります。',
  make: (env) => {
    const B = bus('duck'), T = 4, V0 = 1, V1 = 2.8, age = [-1, -1];
    const bgmAt = (duck, s) => !duck ? .55 : s < V0 - .1 ? .55 : s < V0 ? lerp(.55, .12, (s - V0 + .1) / .1) : s < V1 ? .12 : s < V1 + .5 ? lerp(.12, .55, (s - V1) / .5) : .55;
    return {
      step() { for (let i = 0; i < 2; i++) if (age[i] >= 0 && (age[i] += 1 / 60) > T) age[i] = -1; },
      down(p) {
        const i = p.y < H / 2 ? 0 : 1; age[i] = 0; const c = B.ctx(); if (!c) return; const t0 = c.currentTime + .02;
        const bg_ = gain(c, .55, B.in);
        if (i) { bg_.gain.setValueAtTime(.55, t0 + V0 - .1); bg_.gain.linearRampToValueAtTime(.12, t0 + V0); bg_.gain.setValueAtTime(.12, t0 + V1); bg_.gain.linearRampToValueAtTime(.55, t0 + V1 + .5); }
        bg_.gain.setValueAtTime(bgmAt(i, T - .3), t0 + T - .3); bg_.gain.linearRampToValueAtTime(0, t0 + T);
        const CH = [[57, 60, 64], [53, 57, 60]];
        for (let k = 0; k < T / .125; k++) { const ch = CH[Math.floor(k / 16) % 2], t = t0 + k * .125; blip(c, t, mtof(ch[k % 3] + 12), bg_, .2); if (k % 4 === 0) DRUM.bass(c, t, bg_, mtof(ch[0] - 24), .8); if (k % 8 === 0) DRUM.kick(c, t, bg_, .6); if (k % 2 === 1) DRUM.hat(c, t, bg_, .7); }
        for (let t = V0; t < V1 - .05; t += .09) if (env.rand() < .85) { const g = perc(c, t0 + t, .3, .08, B.in, .004); osc(c, 'sawtooth', 260 * Math.pow(2, (Math.floor(env.rand() * 7) - 3) / 12), t0 + t, t0 + t + .09, filt(c, 'bandpass', 1100, 2, g)); }
      },
      draw(g) {
        bg(g);
        [['なし', 0], ['あり', 1]].forEach(([n, i]) => {
          const y = i * (H / 2 + 2), h = H / 2 - 2, X0 = 50, X1 = 228, tx = s => X0 + s / T * (X1 - X0);
          g.fillStyle = i ? '#0f1428' : '#0d1020'; g.fillRect(0, y, W, h);
          chip(g, n, 8, y + 17, i === 1);
          note(g, 'BGM', 8, y + 52, { size: 9.5 }); note(g, 'セリフ', 8, y + 90, { size: 9.5 });
          g.fillStyle = 'rgba(79,224,255,.35)'; g.beginPath(); g.moveTo(X0, y + 64);
          for (let k = 0; k <= 80; k++) { const s = k / 80 * T; g.lineTo(tx(s), y + 64 - bgmAt(i, s) * 60); }
          g.lineTo(X1, y + 64); g.fill();
          g.fillStyle = 'rgba(255,122,217,.7)'; g.fillRect(tx(V0), y + 78, tx(V1) - tx(V0), 16);
          if (age[i] >= 0) { const x = tx(age[i]); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + 22); g.lineTo(x, y + h - 6); g.stroke(); }
        });
        g.fillStyle = '#15171b'; g.fillRect(0, H / 2 - 2, W, 4);
      }
    };
  }
}
];

/* keyboard (Enter / Space) plays a card like a short click */
for (const it of ITEMS) {
  const mk = it.make;
  it.make = (env) => { const s = mk(env); if (!s.key && s.down) s.key = () => { s.down({ x: W * .7, y: H * .7 }); if (s.up) setTimeout(() => s.up(), 400); }; return s; };
}

run({ sections: SECTIONS, items: ITEMS, W, H, minCol: 300 });

/* master volume */
const vol = document.getElementById('vol');
if (vol) {
  const apply = () => { AU.vol = +vol.value; if (AU.master) AU.master.gain.setTargetAtTime(AU.vol * AU.vol, AU.ctx.currentTime, .03); };
  vol.addEventListener('input', apply); apply();
}
})();
