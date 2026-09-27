/* ライティング図鑑 — card definitions. Runtime: assets/js/g3d.js */
(function () {
const { run, series } = G3D;
const PI = Math.PI;

/* the shared little stage: a round floor, a sphere, a box and a cone */
function stage(ctx, o = {}) {
  const scene = new THREE.Scene(); scene.background = o.bg !== undefined ? o.bg : ctx.BG;
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 60); camera.position.set(0, 2.15, 5.7); camera.lookAt(0, .42, 0);
  const root = new THREE.Group(); scene.add(root);
  const floor = new THREE.Mesh(o.floorGeo || new THREE.CircleGeometry(3.2, 72), new THREE.MeshStandardMaterial({ color: o.floor || 0x767b85, roughness: .92 }));
  floor.rotation.x = -PI / 2; floor.receiveShadow = true; root.add(floor);
  const mk = (geo, col, pos, extra = {}) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(Object.assign({ color: col, roughness: .5 }, extra))); m.position.set(...pos); m.castShadow = m.receiveShadow = true; root.add(m); return m; };
  const sphere = mk(new THREE.SphereGeometry(.55, 64, 48), 0xe9e5dd, [-.5, o.lift || .55, .1], o.sphereMat);
  const box = mk(new THREE.BoxGeometry(.62, .62, .62), 0xd98c5f, [.62, .31, -.3]); box.rotation.y = .55;
  const cone = mk(new THREE.ConeGeometry(.26, .72, 48), 0x6f9fd8, [.28, .36, .78]);
  return { scene, camera, root, floor, sphere, box, cone, objs: [sphere, box, cone] };
}
function dirLight(color, intensity, pos, shadow = {}) {
  const l = new THREE.DirectionalLight(color, intensity); l.position.set(...pos);
  if (shadow !== false) { l.castShadow = true; const c = l.shadow.camera; c.left = c.bottom = -3.2; c.right = c.top = 3.2; c.near = .5; c.far = 16;
    l.shadow.mapSize.set(shadow.size || 1024, shadow.size || 1024); l.shadow.radius = shadow.radius || 1; l.shadow.bias = -.0006; l.shadow.normalBias = .02; }
  return l;
}
function bulb(scene, light, col = 0xfff2d0, r = .06) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: col })); scene.add(m); return () => m.position.copy(light.position); }
const bob = (S, t) => { S.sphere.position.y = .95 + Math.sin(t * 1.3) * .35; };

const ITEMS = [
  /* light types */
  { s: 'types', name: '環境光だけ', tag: 'AmbientLight',
    desc: 'どの方向からも同じ強さで照らす光だけで描いています。陰影も影もできないので、形がのっぺり平らに見えます。ほかの光で暗くなりすぎた部分を少し持ち上げるために、ほんの少し足して使うのが普通です。',
    make: (ctx) => { const S = stage(ctx); S.scene.add(new THREE.AmbientLight(0xffffff, 2.36)); return S; } },
  { s: 'types', name: '平行光源', tag: 'DirectionalLight',
    desc: 'はるか遠くの光源から、すべての場所に同じ向き・同じ強さで届く光。太陽の光を表すのに使います。影はどれも同じ向きに、同じ濃さで落ちます。',
    make: (ctx) => { const S = stage(ctx); S.scene.add(dirLight(0xffffff, 5.34, [-3, 4.2, 2.2])); S.scene.add(new THREE.AmbientLight(0xffffff, .38)); return S; } },
  { s: 'types', name: '点光源', tag: 'PointLight · 周回',
    desc: '1点から全方向に広がる光。電球やろうそくの光です。光源が物体の周りを回っているので、影が放射状に伸びたり縮んだりします。光源から離れるほど暗くなります。',
    make: (ctx) => { const S = stage(ctx); const l = new THREE.PointLight(0xffe2b0, 14, 9, 2); l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -.002; S.scene.add(l); S.scene.add(new THREE.AmbientLight(0xffffff, .16));
      const sync = bulb(S.scene, l); S.update = (t) => { l.position.set(Math.cos(t * .7) * 1.7, 1.25 + Math.sin(t * 1.1) * .25, Math.sin(t * .7) * 1.7); sync(); }; return S; } },
  { s: 'types', name: 'スポットライト', tag: 'SpotLight · angle · penumbra',
    desc: '1点から円すいの形に広がる光。舞台の照明や懐中電灯です。光の広がる角度と、ふちのぼかし具合（ペナンブラ）を決められます。照らす先をゆっくり動かしています。',
    make: (ctx) => { const S = stage(ctx); const l = new THREE.SpotLight(0xffffff, 46, 12, .42, .35, 1.5); l.position.set(1.9, 3.4, 1.4); l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -.0008; S.scene.add(l, l.target); S.scene.add(new THREE.AmbientLight(0xffffff, .13));
      const sync = bulb(S.scene, l); S.update = (t) => { l.target.position.set(Math.sin(t * .5) * .9, 0, Math.cos(t * .4) * .5); sync(); }; return S; } },
  { s: 'types', name: '半球光', tag: 'HemisphereLight · 空と地面',
    desc: '上からは空の色、下からは地面の色でやわらかく照らす光。屋外で、空全体から降ってくる光と地面の照り返しを手軽に表します。上を向いた面は青っぽく、下を向いた面は茶色っぽくなります。',
    make: (ctx) => { const S = stage(ctx); S.scene.add(new THREE.HemisphereLight(0x9ec9ff, 0x6a4a30, 4.71)); return S; } },
  { s: 'types', name: '周りの景色の光', tag: 'scene.environment · IBL',
    desc: '光源を1つも置かず、周りの部屋の写真のような画像から光を受け取っています（イメージベースドライティング）。球をつるつるの金属にしたので、部屋の明かりの映り込みが見えます。',
    make: (ctx) => { const S = stage(ctx, { sphereMat: { metalness: 1, roughness: .12, color: 0xf0f0f0 } }); S.scene.environment = ctx.ENV || (ctx.ENV = ctx.makeEnv()); S.box.material.roughness = .35; return S; } },

  /* shadows */
  { s: 'shadow', name: '影なし', tag: 'castShadow = false',
    desc: '光は当たっていますが影を描いていません。球は上下に動いていますが、床からどれくらい浮いているのかがまったく分かりません。影は「位置」を伝える大事な手がかりです。',
    make: (ctx) => { const S = stage(ctx, { lift: .95 }); const l = dirLight(0xffffff, 5.34, [-2, 5, 2], false); S.scene.add(l, new THREE.AmbientLight(0xffffff, .63)); S.update = (t) => bob(S, t); return S; } },
  { s: 'shadow', name: 'くっきりした影', tag: 'shadow map 2048 · radius 1',
    desc: 'シャドウマップで影を描いたもの。影が床に落ちると、球の高さが一目で分かります。影のふちがくっきりしているのは、小さな光源（太陽など）で照らしたときの見え方です。',
    make: (ctx) => { const S = stage(ctx, { lift: .95 }); S.scene.add(dirLight(0xffffff, 5.34, [-2, 5, 2], { size: 2048, radius: 1 }), new THREE.AmbientLight(0xffffff, .63)); S.update = (t) => bob(S, t); return S; } },
  { s: 'shadow', name: 'やわらかい影', tag: 'shadow radius 7',
    desc: '影のふちを周りの点と平均してぼかしたもの。曇り空や大きな窓の光のように、面積の大きい光源で照らしたときの見え方です。やわらかい影は、落ち着いた雰囲気になります。',
    make: (ctx) => { const S = stage(ctx, { lift: .95 }); S.scene.add(dirLight(0xffffff, 5.34, [-2, 5, 2], { size: 1024, radius: 7 }), new THREE.AmbientLight(0xffffff, .63)); S.update = (t) => bob(S, t); return S; } },
  { s: 'shadow', name: '影のギザギザ', tag: 'shadow map 96 × 96',
    desc: 'シャドウマップの解像度をわざと96×96に下げたもの。影のふちが階段状にギザギザになり、ちらつきます。影の画像の細かさが、影のきれいさを決めます。',
    make: (ctx) => { const S = stage(ctx, { lift: .95 }); S.scene.add(dirLight(0xffffff, 5.34, [-2, 5, 2], { size: 96, radius: 1 }), new THREE.AmbientLight(0xffffff, .63)); S.update = (t) => bob(S, t); return S; } },
  { s: 'shadow', name: '丸影（ニセの影）', tag: 'blob shadow · 半透明の円',
    desc: '影の計算をせず、物体の真下に、ぼんやりした黒い円を置いているだけです。高いところにあるほど大きく薄くしています。とても軽いので、昔のゲームやスマホゲームでよく使われます。',
    make: (ctx) => { const S = stage(ctx, { lift: .95 }); S.scene.add(dirLight(0xffffff, 4.71, [-2, 5, 2], false), new THREE.AmbientLight(0xffffff, .79));
      const t = ctx.tex(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(.6, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
      const blob = (x, z, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); m.rotation.x = -PI / 2; m.position.set(x, .005, z); S.root.add(m); return m; };
      const b = blob(-.5, .1, 1.3); blob(.62, -.3, 1.1); blob(.28, .78, .7);
      S.update = (tt) => { bob(S, tt); const h = S.sphere.position.y; b.scale.setScalar(.8 + h * .35); b.material.opacity = 1.3 - h * .5; }; return S; } },
  { s: 'shadow', name: '隙間の暗がり（AO）', tag: 'ambient occlusion · 焼き込み',
    desc: '直接の光を使わず、空全体からの光だけで照らしています。物体が床に接しているあたりは周りの光がさえぎられて暗くなるので、その暗がりを床の画像に描き込んでおきました（アンビエントオクルージョン）。物体がしっかり置かれて見えます。',
    make: (ctx) => { const S = stage(ctx); S.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x404048, 4.08));
      const r = 3.2, ao = ctx.tex(512, 512, (g, w) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); const spot = (x, z, rad, a) => { const cx = (x / r + 1) / 2 * w, cy = (z / r + 1) / 2 * w, gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad / r / 2 * w); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); };
        spot(-.5, .1, .8, .85); spot(.62, -.3, .75, .8); spot(.28, .78, .45, .7); }, false);
      S.floor.geometry.setAttribute('uv2', S.floor.geometry.attributes.uv); S.floor.material.aoMap = ao; S.floor.material.aoMapIntensity = 1; S.floor.material.needsUpdate = true; return S; } },

  /* properties */
  { s: 'props', name: '距離による減衰', tag: 'PointLight · decay 2',
    desc: '左端の低い位置に電球を1つ置き、同じ白い球を等間隔に並べています。現実の光は距離の2乗に比例して弱くなるので、少し離れるだけで急に暗くなります。',
    make: (ctx) => { const S = stage(ctx, { floorGeo: new THREE.PlaneGeometry(7, 4) }); S.objs.forEach(o => o.visible = false);
      for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.24, 32, 24), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: .5 })); m.position.set(-1.9 + i * .78, .24, 0); m.castShadow = m.receiveShadow = true; S.root.add(m); }
      const l = new THREE.PointLight(0xffe7c0, 16, 0, 2); l.position.set(-2.6, .45, .25); l.castShadow = true; S.root.add(l); const bm = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff2d0 })); bm.position.copy(l.position); S.root.add(bm); S.noSpin = true; return S; } },
  { s: 'props', name: '照り返し（間接光）', tag: '色のついた壁 + 補助の光',
    desc: '赤い壁と緑の壁の部屋に白い球を置いています。現実では壁ではね返った光で球の左右がうっすら赤と緑に染まります。本物の間接光の計算は重いので、ここでは壁の近くに弱い色つきの光を置いてまねしています。約3秒ごとに、その補助の光を入れたり消したりしています。',
    make: (ctx) => { const scene = new THREE.Scene(); scene.background = new THREE.Color(0x121316); const camera = new THREE.PerspectiveCamera(38, 1, .1, 30); camera.position.set(0, 1.1, 4.2); camera.lookAt(0, 1, 0); const root = new THREE.Group(); scene.add(root);
      const wall = (w, h, col, pos, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: col, roughness: .95 })); m.position.set(...pos); m.rotation.set(...rot); m.receiveShadow = true; root.add(m); };
      wall(2.4, 2.4, 0xdddddd, [0, 0, 0], [-PI / 2, 0, 0]); wall(2.4, 2.4, 0xdddddd, [0, 2.4, 0], [PI / 2, 0, 0]); wall(2.4, 2.4, 0xdddddd, [0, 1.2, -1.2], [0, 0, 0]); wall(2.4, 2.4, 0xc0282a, [-1.2, 1.2, 0], [0, PI / 2, 0]); wall(2.4, 2.4, 0x2aa04a, [1.2, 1.2, 0], [0, -PI / 2, 0]);
      const sp = new THREE.Mesh(new THREE.SphereGeometry(.45, 64, 48), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: .6 })); sp.position.set(0, .45, 0); sp.castShadow = true; root.add(sp);
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(.6, .6), new THREE.MeshBasicMaterial({ color: 0xffffff })); lamp.position.set(0, 2.39, 0); lamp.rotation.x = PI / 2; root.add(lamp);
      const key = new THREE.PointLight(0xffffff, 13, 0, 2); key.position.set(0, 2.2, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); root.add(key); root.add(new THREE.AmbientLight(0xffffff, .19));
      const red = new THREE.PointLight(0xff3020, 0, 2.2, 2); red.position.set(-.95, .6, .2); const grn = new THREE.PointLight(0x30ff60, 0, 2.2, 2); grn.position.set(.95, .6, .2); root.add(red, grn);
      return { scene, camera, root, noSpin: true, update: (t) => { const on = Math.floor(t / 3) % 2 === 0 ? 1 : 0; red.intensity += (on * .42 - red.intensity) * .1; grn.intensity += (on * .42 - grn.intensity) * .1; } }; } },
  { s: 'props', name: '色のついた光', tag: 'オレンジ × 青の2灯',
    desc: '左からオレンジ、右から青の光を当てています。どちらか一方の光しか届かない場所は、その色に染まります。影の中も真っ黒ではなく、もう一方の光の色になっているのに注目してください。',
    make: (ctx) => { const S = stage(ctx); S.objs.forEach(o => o.material.color.set(0xeeeeee)); S.scene.add(dirLight(0xff9a3a, 4.4, [-3.5, 3.5, 1.5]), dirLight(0x3a8aff, 4.4, [3.5, 3.5, 1.5])); return S; } },
  { s: 'props', name: '霧（空気遠近法）', tag: 'scene.fog',
    desc: '遠くのものほど背景の色に近づけています。現実でも空気中の水分やちりで、遠くの山ほど青白くかすみます。奥行きがはっきりするうえ、遠くのものを描かずにすむ言い訳にもなります。',
    make: (ctx) => { const col = 0x8fa3bf, S = stage(ctx, { bg: new THREE.Color(col), floorGeo: new THREE.PlaneGeometry(6, 30) }); S.floor.position.z = -10; S.objs.forEach(o => o.visible = false); S.scene.fog = new THREE.Fog(col, 3, 13);
      for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(.4, 1.6, .4), new THREE.MeshStandardMaterial({ color: 0x5a6070, roughness: .7 })); m.position.set(sx * 1.1, .8, 1 - i * 2.2); m.castShadow = true; S.root.add(m); }
      S.scene.add(dirLight(0xffffff, 4.08, [-2, 5, 3], false), new THREE.HemisphereLight(0xcfe0ff, 0x506070, 2.2)); S.noSpin = true; S.camera.position.set(0, 1.4, 4); S.camera.lookAt(0, .8, -4); return S; } },
  { s: 'props', name: '光る物体とその光', tag: 'emissive + PointLight',
    desc: '「光っているように見える材質（発光）」と「周りを照らす光源」は、3DCGでは別物です。ここではランプの球を発光させ、その中心に点光源を置いて、両方をそろえて使っています。炎のように少し揺らしています。',
    make: (ctx) => { const S = stage(ctx, { bg: new THREE.Color(0x0b0c10) }); S.sphere.visible = false; const lamp = new THREE.Mesh(new THREE.SphereGeometry(.16, 32, 24), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb45a, emissiveIntensity: 3 })); lamp.position.set(-.5, .45, .1); S.root.add(lamp);
      const l = new THREE.PointLight(0xffa048, 4.8, 6, 2); l.position.copy(lamp.position); l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -.003; S.root.add(l); S.scene.add(new THREE.AmbientLight(0x3050a0, .25));
      S.update = (t) => { const f = .85 + .15 * Math.sin(t * 13) * Math.sin(t * 7.3); l.intensity = 4.8 * f; lamp.material.emissiveIntensity = 3 * f; }; return S; } },

  /* design */
  { s: 'design', name: '3点照明', tag: 'キー + フィル + リム',
    desc: '写真や映画の基本の組み方です。主役を照らす強い光（キー、左手前の暖色）、影を少し明るくする弱い光（フィル、右手前の寒色）、後ろから輪郭を光らせる光（リム）の3つを使います。小さな点がそれぞれの光の位置です。',
    make: (ctx) => { const S = stage(ctx); const key = dirLight(0xffe0c0, 5.03, [-2.4, 3, 2.6]), fill = new THREE.DirectionalLight(0xa8c8ff, 1.41), rim = new THREE.DirectionalLight(0xffffff, 5.65); fill.position.set(2.8, 1.4, 2.4); rim.position.set(.6, 2.4, -3.4); S.scene.add(key, fill, rim);
      for (const [l, c] of [[key, 0xffc080], [fill, 0x8ab8ff], [rim, 0xffffff]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), new THREE.MeshBasicMaterial({ color: c })); m.position.copy(l.position).normalize().multiplyScalar(2.6); m.position.y = Math.max(m.position.y, .6); S.scene.add(m); } return S; } },
  { s: 'design', name: '逆光', tag: '後ろから強い光',
    desc: '主な光を物体の真後ろ近くに置き、正面はとても弱く照らしています。形の輪郭だけが光って浮かび上がり、印象的で少し神秘的な雰囲気になります。',
    make: (ctx) => { const S = stage(ctx, { bg: new THREE.Color(0x1b1e26) }); S.scene.add(dirLight(0xfff0d8, 7.54, [.4, 2.2, -4]), new THREE.AmbientLight(0x6070a0, .38)); S.objs.forEach(o => o.material.roughness = .35); return S; } },
  { s: 'design', name: '下からの光', tag: '顔の下から照らす',
    desc: '普段、光は上から来るので、下から照らされると見慣れない陰影になり、不気味に見えます。懐中電灯で顔を下から照らす怪談の演出と同じです。',
    make: (ctx) => { const S = stage(ctx, { bg: new THREE.Color(0x0e0f14), lift: .95 }); const l = new THREE.SpotLight(0x9fe0b0, 21, 8, .6, .5, 1.5); l.position.set(-.3, .05, 1.6); l.target.position.set(-.5, .9, 0); l.castShadow = true; S.scene.add(l, l.target, new THREE.AmbientLight(0xffffff, .09)); S.floor.material.color.set(0x3a3d44); return S; } },
  { s: 'design', name: '夕日', tag: '低い暖色の太陽 + 青い空の光',
    desc: '太陽を地平線近くの低い位置に置き、オレンジ色にしています。影が長く伸び、日の当たらない面は空からの青い光に染まります。暖色と寒色の対比が夕方らしさを作ります。',
    make: (ctx) => { const bg = ctx.tex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a3a6a'); gr.addColorStop(.55, '#e0785a'); gr.addColorStop(1, '#f6c27a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
      const S = stage(ctx, { bg }); S.scene.add(dirLight(0xffa35a, 6.6, [-4.5, .9, -1.2], { size: 2048 }), new THREE.HemisphereLight(0x5a78c0, 0x3a2a20, 1.73)); return S; } },
  { s: 'design', name: '月夜と街灯', tag: '青い月明かり + 暖かい街灯',
    desc: '暗い青の月明かりで全体をうっすら照らし、手前に暖かい色の街灯を1つ置きました。明るさを抑えて色の差をつけると、夜の場面らしくなります。',
    make: (ctx) => { const bg = ctx.tex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#05081a'); gr.addColorStop(1, '#1a2448'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
      const S = stage(ctx, { bg }); S.scene.add(dirLight(0x7a9cff, 1.73, [3, 4, -2]), new THREE.AmbientLight(0x2030a0, .38));
      const l = new THREE.PointLight(0xffb060, 7.1, 5, 2); l.position.set(.9, 1.3, .9); l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -.003; S.root.add(l);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.3, 12), new THREE.MeshStandardMaterial({ color: 0x222228 })); post.position.set(.9, .65, .9); S.root.add(post);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(.08, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); glow.position.copy(l.position); S.root.add(glow); return S; } }
];

const SECTIONS = [
  { id: 'types', en: 'Light types', title: '光源の種類', lead: '3DCGで使う代表的な光の種類です。物体と材質はすべて同じで、光だけを入れ替えています。' },
  { id: 'shadow', en: 'Shadows', title: '影のつけ方', lead: '影があるかないか、どう描くかで、物の位置関係や雰囲気が大きく変わります。球はゆっくり上下しています。' },
  { id: 'props', en: 'Behaviour of light', title: '光の性質', lead: '遠くなるほど暗くなる、壁ではね返る、空気でかすむ。現実の光のふるまいを、どこまで・どうやってまねるかです。' },
  { id: 'design', en: 'Lighting design', title: '照明の組み方', lead: '光の数・位置・色の組み合わせで、同じ場面でもまったく違う雰囲気になります。写真や映画の照明の考え方がそのまま使えます。' }
];
run({ sections: SECTIONS, items: ITEMS, minCol: 300, shadows: true, rx: .05, ry: -.3, spin: .15 });
series('lighting');

})();
