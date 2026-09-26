/* Shared runtime for the 3D catalogues: one fixed WebGL canvas drawn over the
   page, one scissored viewport per card, drag-to-rotate, lazy scene building. */
(function () {
'use strict';
const DPR = Math.min(window.devicePixelRatio || 1, 2);

function series() { /* handled by assets/js/series.js */ }

function run(cfg) {
  const main = document.getElementById('main'), nav = document.getElementById('nav');
  const fail = (msg) => { const d = document.createElement('div'); d.className = 'fail'; d.textContent = msg; main.prepend(d); };
  const views = [];
  for (const sec of cfg.sections) {
    const a = document.createElement('a'); a.href = '#' + sec.id; a.textContent = sec.title; nav.appendChild(a);
    const el = document.createElement('section'); el.id = sec.id;
    el.innerHTML = `<header><div class="eyebrow"></div><h2></h2><p></p></header><div class="grid"></div>`;
    el.querySelector('.eyebrow').textContent = sec.en; el.querySelector('h2').textContent = sec.title; el.querySelector('p').textContent = sec.lead;
    const grid = el.querySelector('.grid'); if (cfg.minCol) grid.style.setProperty('--min', cfg.minCol + 'px');
    for (const it of cfg.items.filter(x => x.s === sec.id)) {
      const card = document.createElement('article'); card.className = 'card';
      const st = document.createElement('div'); st.className = 'stage3d'; st.tabIndex = 0; st.style.setProperty('--ar', cfg.aspect || '1');
      st.setAttribute('role', 'img'); st.setAttribute('aria-label', it.name + '（ドラッグで回転）');
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.innerHTML = '<h3></h3><code></code><p></p>' + (it.hint ? '<p class="hint"></p>' : '');
      meta.querySelector('h3').textContent = it.name; meta.querySelector('code').textContent = it.tag; meta.querySelector('p').textContent = it.desc;
      if (it.hint) meta.querySelector('.hint').textContent = it.hint;
      card.append(st, meta); grid.appendChild(card);
      views.push({ el: st, it, v: null, rx: cfg.rx !== undefined ? cfg.rx : 0, ry: cfg.ry !== undefined ? cfg.ry : 0, drag: null, last: -1e9 });
    }
    main.appendChild(el);
  }
  if (typeof THREE === 'undefined') { fail('3D描画ライブラリを読み込めませんでした。ページを再読み込みしてください。'); return; }
  const canvas = document.getElementById('gl');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { fail('このブラウザでは WebGL が使えないため、描画できません。'); return; }
  renderer.setPixelRatio(DPR); renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  if (cfg.shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; }

  const ctx = { renderer, DPR };
  ctx.tex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; };
  ctx.BG = ctx.tex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(w * .5, h * .42, 0, w * .5, h * .5, w * .75); gr.addColorStop(0, '#34383f'); gr.addColorStop(1, '#16181c'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  ctx.makeEnv = () => {
    const room = new THREE.Scene();
    room.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x4a4d54, side: THREE.BackSide })));
    const panel = (w, h, rgb, pos) => { const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); m.color.setRGB(...rgb); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(...pos); p.lookAt(0, 0, 0); room.add(p); };
    panel(5, 3, [7, 7, 7], [0, 4.8, .5]); panel(1.2, 6, [3.5, 3.8, 4.5], [-4.8, .5, 1.5]); panel(2, 2, [5, 3.6, 2.4], [4.8, 1, -1.5]); panel(3, 1, [2, 2, 2.2], [0, 1, -4.8]);
    const pm = new THREE.PMREMGenerator(renderer); const t = pm.fromScene(room, .04).texture; pm.dispose(); return t;
  };
  if (cfg.setup) cfg.setup(ctx);

  for (const v of views) {
    const el = v.el;
    el.addEventListener('pointerdown', (e) => { v.drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { el.setPointerCapture(e.pointerId); } catch (_) {} });
    el.addEventListener('pointermove', (e) => { if (!v.drag || v.drag.id !== e.pointerId) return; v.ry += (e.clientX - v.drag.x) * .01; v.rx = Math.max(-.6, Math.min(.9, v.rx + (e.clientY - v.drag.y) * .006)); v.drag.x = e.clientX; v.drag.y = e.clientY; v.last = performance.now(); });
    const end = () => { v.drag = null; v.last = performance.now(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', (e) => { const k = { ArrowLeft: [0, -.2], ArrowRight: [0, .2], ArrowUp: [-.1, 0], ArrowDown: [.1, 0] }[e.key]; if (k) { e.preventDefault(); v.rx = Math.max(-.6, Math.min(.9, v.rx + k[0])); v.ry += k[1]; v.last = performance.now(); } });
  }
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let prev = performance.now(); const t0 = prev;
  function frame(now) {
    const dt = Math.min(.05, (now - prev) / 1000); prev = now; const t = (now - t0) / 1000; ctx.t = t;
    const Wc = canvas.clientWidth, Hc = canvas.clientHeight;
    if (canvas.width !== Math.floor(Wc * DPR) || canvas.height !== Math.floor(Hc * DPR)) renderer.setSize(Wc, Hc, false);
    renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
    let built = 0;
    for (const v of views) {
      const r = v.el.getBoundingClientRect();
      if (r.bottom < -40 || r.top > Hc + 40 || r.right < 0 || r.left > Wc || r.width < 2) continue;
      if (!v.v) { if (built > 1) continue; v.v = v.it.make(ctx); built++; }
      if (!v.drag && !REDUCED && now - v.last > 1600 && !v.v.noSpin) v.ry += dt * (cfg.spin !== undefined ? cfg.spin : .25);
      const V = v.v;
      if (V.root) V.root.rotation.set(v.rx, v.ry, 0);
      if (V.camera && V.camera.isPerspectiveCamera && V.camera.aspect !== r.width / r.height) { V.camera.aspect = r.width / r.height; V.camera.updateProjectionMatrix(); }
      if (V.update) V.update(t, dt, v);
      const x = r.left, y = Hc - r.bottom;
      if (V.render) V.render(ctx, x, y, r.width, r.height, v);
      else { renderer.setViewport(x, y, r.width, r.height); renderer.setScissor(x, y, r.width, r.height); renderer.render(V.scene, V.camera); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
window.G3D = { run, series, DPR };
})();
