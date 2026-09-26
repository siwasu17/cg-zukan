/*
 * {{TITLE}} — card definitions (2D).
 *
 * Runtime: assets/js/g2d.js  (window.G2D)
 *
 * G2D.run({ sections, items, W, H, minCol })
 *   sections: [{ id, en, title, lead }]           — headings, in order
 *   items:    [{ s, name, tag, desc, hint?, make, W?, H?, warm?, reseed?, pixel?, interactive?, capture? }]
 *     s        section id this card belongs to
 *     make(env)  called to (re)create the card. env = { W, H, rand, seed }
 *                returns a "sim" object:
 *                  step(t)        advance one fixed step (60 per second)
 *                  draw(g, t)     draw with Canvas 2D; g is already scaled to W×H logical pixels
 *                  down(p) / move(p, isDown) / up() / leave() / key(k)   optional input, p = {x, y}
 *                  hud()          optional, returns lines shown bottom-left
 *     warm     steps to run before the first frame (so the card opens mid-animation)
 *     reseed   true → the card's button says 「作り直す」 and uses a new random seed
 *     pixel    true → image smoothing off (crisp pixel art)
 *   W, H:     default logical canvas size (240 × 240)
 *   minCol:   minimum card width in px (e.g. 300 → three columns on desktop)
 *
 * Helpers on G2D: rng(seed), clamp, lerp, ease.*, makeNoise(rand) → { n2, fbm }, COL, label(g, text, x, y, opts)
 */
(function () {
const { clamp, COL, label, run } = G2D;
const W = 240, H = 240, TAU = Math.PI * 2;

function bg(g) { g.fillStyle = '#0d1122'; g.fillRect(0, 0, W, H); }

const SECTIONS = [
  { id: 'basic', en: 'Basics', title: '基本', lead: 'この節の説明をここに書きます。' }
];

const ITEMS = [
  {
    s: 'basic', name: '跳ねるボール', tag: 'vy += g', desc: 'カードの説明をここに書きます。見えているものと、その仕組みを2〜3文で。',
    hint: 'クリックで持ち上げる', interactive: true,
    make: (env) => {
      let y = 40, vy = 0;
      return {
        step() { vy += .3; y += vy; if (y > 200) { y = 200; vy *= -.8; } },
        draw(g) { bg(g); g.fillStyle = COL.yellow; g.beginPath(); g.arc(120, y, 14, 0, TAU); g.fill(); },
        down() { y = 30; vy = 0; },
        hud() { return ['y ' + y.toFixed(0)]; }
      };
    }
  },
  {
    s: 'basic', name: '回る四角', tag: 'rotate(t)', desc: '乱数の種（seed）を変えると並びが変わる例です。「作り直す」を押してみてください。',
    reseed: true,
    make: (env) => {
      const boxes = Array.from({ length: 12 }, () => ({ x: 20 + env.rand() * 200, y: 20 + env.rand() * 200, s: 6 + env.rand() * 14, v: (env.rand() - .5) * .1 }));
      let t = 0;
      return {
        step() { t++; },
        draw(g) { bg(g); for (const b of boxes) { g.save(); g.translate(b.x, b.y); g.rotate(t * b.v); g.strokeStyle = COL.cyan; g.strokeRect(-b.s / 2, -b.s / 2, b.s, b.s); g.restore(); }
          label(g, 'seed ' + env.seed, 8, 18, { size: 10, mono: true, color: COL.muted }); }
      };
    }
  }
];

run({ sections: SECTIONS, items: ITEMS, W, H, minCol: 300 });
})();
