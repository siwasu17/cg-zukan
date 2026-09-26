/*
 * {{TITLE}} — card definitions (3D).
 *
 * Runtime: assets/js/g3d.js  (window.G3D) on top of three.js r149 (global THREE)
 *
 * G3D.run({ sections, items, minCol, aspect, shadows, rx, ry, spin, setup })
 *   items: [{ s, name, tag, desc, hint?, make(ctx) }]
 *     make(ctx) is called once, the first time the card scrolls into view. Return a "view":
 *       { scene, camera, root?, update?(t, dt, v), render?(ctx, x, y, w, h, v), noSpin? }
 *       root   Object3D that is rotated by dragging / auto-spin
 *       update called every frame before drawing (t = seconds)
 *       render optional custom drawing into the card's viewport (for post-processing etc.)
 *   ctx: { renderer, DPR, t, BG (background texture), tex(w, h, draw, srgb), makeEnv() → PMREM env map }
 *   aspect  card aspect ratio, e.g. '4 / 3' (default '1')
 *   shadows true → renderer.shadowMap enabled
 *   rx, ry  initial rotation; spin = auto-rotation speed (rad/s)
 */
(function () {
const { run } = G3D;

function stage(ctx) {
  const scene = new THREE.Scene(); scene.background = ctx.BG;
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 50); camera.position.set(0, 0, 4.4);
  const root = new THREE.Group(); scene.add(root);
  const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(-2, 3, 4); scene.add(d);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x303038, .35));
  return { scene, camera, root };
}

const SECTIONS = [
  { id: 'basic', en: 'Basics', title: '基本', lead: 'この節の説明をここに書きます。' }
];

const ITEMS = [
  { s: 'basic', name: 'プラスチックの球', tag: 'MeshStandardMaterial', desc: 'カードの説明をここに書きます。',
    make: (ctx) => { const v = stage(ctx); v.root.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ color: 0xd23c3c, roughness: .35 }))); return v; } },
  { s: 'basic', name: '金属のトーラス', tag: 'metalness 1', desc: '周りの景色（環境マップ）が映り込む例です。',
    make: (ctx) => { const v = stage(ctx); v.scene.environment = ctx.ENV || (ctx.ENV = ctx.makeEnv());
      v.root.add(new THREE.Mesh(new THREE.TorusKnotGeometry(.7, .24, 200, 32), new THREE.MeshStandardMaterial({ color: 0xffc356, metalness: 1, roughness: .2 })));
      v.update = (t) => { v.root.children[0].rotation.x = t * .4; }; return v; } }
];

run({ sections: SECTIONS, items: ITEMS, minCol: 300, rx: .3, ry: -.4 });
})();
