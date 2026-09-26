/* ゲームの手触り図鑑 — card definitions. Runtime: assets/js/g2d.js */
(function () {
const { rng, clamp, lerp, ease, COL, label, run, series } = G2D;
const PW = 240, PH = 124, GAP = 8, GY = 100;

/* ---------- drawing helpers ---------- */
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function hero(g, x, y, o = {}) {
  g.save(); g.translate(x, y); g.rotate(o.rot || 0); g.scale((o.sx || 1) * (o.face || 1), o.sy || 1);
  g.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  g.fillStyle = o.col || '#7fd6ff'; rr(g, -8, -16, 16, 16, 4); g.fill();
  g.fillStyle = '#0b0e1a'; g.fillRect(1, -11, 2.5, 4); g.fillRect(5, -11, 2.5, 4);
  g.restore();
}
function enemy(g, x, y, o = {}) {
  const s = o.scale || 1;
  g.save(); g.translate(x, y); g.rotate(o.rot || 0); g.scale(s, s);
  g.fillStyle = o.flash ? '#ffffff' : (o.col || '#ff5470'); rr(g, -11, -20, 22, 20, 7); g.fill();
  if (!o.flash) { g.fillStyle = '#0b0e1a'; g.fillRect(-6, -13, 3, 4); g.fillRect(3, -13, 3, 4); g.fillRect(-6, -15, 4, 1.5); g.fillRect(2, -15, 4, 1.5); }
  g.restore();
}
function ground(g, y = GY, x0 = 0, x1 = PW) { g.fillStyle = '#232b45'; g.fillRect(x0, y, x1 - x0, PH - y + 20); g.fillStyle = '#3b4870'; g.fillRect(x0, y, x1 - x0, 2); }
function hpBar(g, x, y, w, v, col = COL.green) { g.fillStyle = '#2a2f40'; g.fillRect(x, y, w, 4); g.fillStyle = col; g.fillRect(x, y, w * clamp(v, 0, 1), 4); }
function inputMark(g, text, x, y, age) { if (age < 0 || age > 30) return; g.globalAlpha = 1 - age / 30; label(g, text, x, y - age * .4, { size: 10, align: 'center', color: COL.yellow, bg: 'rgba(11,14,26,.8)' }); g.globalAlpha = 1; }

/* simple particle list */
function parts() {
  const L = [];
  return {
    add(p) { L.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 20, age: 0, r: 2, col: '#cfd6e6', drag: .92 }, p)); },
    step() { for (let i = L.length - 1; i >= 0; i--) { const p = L[i]; p.age++; p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; if (p.age > p.life) L.splice(i, 1); } },
    draw(g) { for (const p of L) { const k = 1 - p.age / p.life; g.globalAlpha = k; g.fillStyle = p.col; if (p.sq) g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); else { g.beginPath(); g.arc(p.x, p.y, p.r * (p.shrink ? k : 1) + .3, 0, Math.PI * 2); g.fill(); } } g.globalAlpha = 1; },
    get n() { return L.length; }
  };
}
function dust(P, x, y, n, rand, dir = 0) { for (let i = 0; i < n; i++) P.add({ x: x + (rand() - .5) * 10, y: y - 1, vx: (dir || (rand() - .5) * 2) * (1 + rand() * 2), vy: -rand() * 1.4, life: 16 + rand() * 12, r: 1.5 + rand() * 2.5, shrink: true, col: '#8d97b5', drag: .9 }); }

/* ---------- pair runner: same scenario with feel off (top) and on (bottom) ---------- */
function pair(o) {
  return {
    s: o.s, name: o.name, tag: o.tag, desc: o.desc, hint: o.hint || 'クリックでもう一度実行', H: PH * 2 + GAP, interactive: true,
    make: (env) => {
      const A = o.scen({ rand: rng(env.seed), f: false }), B = o.scen({ rand: rng(env.seed), f: true });
      return {
        step() { A.step(); B.step(); },
        down() { A.act && A.act(); B.act && B.act(); },
        draw(g) {
          [[A, 0, 'なし'], [B, PH + GAP, 'あり']].forEach(([S, oy, name], i) => {
            g.save(); g.translate(0, oy); g.beginPath(); g.rect(0, 0, PW, PH); g.clip();
            g.fillStyle = i ? '#0f1428' : '#0d1020'; g.fillRect(0, 0, PW, PH);
            S.draw(g);
            g.restore();
            g.save(); g.translate(0, oy);
            label(g, name, 8, 16, { size: 10.5, color: i ? '#15171b' : COL.ink, bg: i ? COL.accent : 'rgba(80,88,110,.9)' });
            if (S.note) { const n = S.note(); if (n) label(g, n, PW - 8, 16, { size: 10, align: 'right', color: COL.muted }); }
            g.restore();
          });
          g.fillStyle = '#15171b'; g.fillRect(0, PH, PW, GAP);
        }
      };
    }
  };
}

/* ---------- scenarios ---------- */
const S = {};

S.shake = ({ rand, f }) => {
  let t = 0, hx = 40, er = 0, shake = 0, sx = 0, sy = 0; const P = parts();
  return {
    act() { t = 0; },
    step() {
      const ph = t % 100;
      if (ph < 18) hx = lerp(40, 150, ease.inQuad(ph / 18));
      else if (ph === 18) { er = 12; if (f) { shake = 7; for (let i = 0; i < 8; i++) P.add({ x: 162, y: GY - 10, vx: 1 + rand() * 3, vy: (rand() - .5) * 4, life: 14, r: 1.6, col: COL.yellow }); } }
      else if (ph > 50) hx = lerp(150, 40, ease.inOutCubic(clamp((ph - 50) / 40, 0, 1)));
      er *= .85; shake *= .82; sx = (rand() - .5) * 2 * shake; sy = (rand() - .5) * 2 * shake;
      P.step(); t++;
    },
    draw(g) { g.translate(sx, sy); ground(g); enemy(g, 180 + er, GY); hero(g, hx, GY); P.draw(g); }
  };
};

S.hitstop = ({ rand, f }) => {
  let lt = 0, freeze = 0, er = 0, flash = 0; const P = parts();
  return {
    act() { lt = 0; freeze = 0; },
    step() {
      if (flash > 0) flash--;
      if (freeze > 0) { freeze--; return; }
      const ph = lt % 70;
      if (ph === 8) { er = 9; flash = 5; if (f) freeze = 8; for (let i = 0; i < 10; i++) P.add({ x: 140, y: GY - 12, vx: rand() * 4, vy: (rand() - .5) * 5, life: 16, r: 1.5, col: '#fff' }); }
      er *= .82; P.step(); lt++;
    },
    draw(g) {
      ground(g); const ph = lt % 70;
      enemy(g, 156 + er, GY, { flash: flash > 0 && f });
      hero(g, 100, GY);
      const a = ph < 14 ? lerp(-2.2, 1.1, ease.outCubic(ph / 14)) : 1.1;
      if (ph < 26) {
        g.save(); g.translate(104, GY - 9); g.rotate(a);
        g.strokeStyle = '#e8ecf7'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(4, 0); g.lineTo(34, 0); g.stroke();
        g.restore();
        if (ph < 14) { g.strokeStyle = 'rgba(232,236,247,.35)'; g.lineWidth = 12; g.beginPath(); g.arc(104, GY - 9, 26, -2.2, a); g.stroke(); }
      }
      P.draw(g);
    },
    note: () => f && freeze > 0 ? '停止中' : ''
  };
};

S.knock = ({ rand, f }) => {
  let t = 0, ex = 170, vx = 0, tilt = 0;
  return {
    act() { t = 0; },
    step() {
      const ph = t % 90;
      if (ph === 10 && f) { vx = 6; tilt = .35; }
      ex += vx; vx *= .82; tilt *= .88;
      if (ph > 40) ex = lerp(ex, 170, .06);
      t++;
    },
    draw(g) {
      ground(g); const ph = t % 90; const ext = ph < 10 ? ph / 10 : ph < 22 ? 1 : Math.max(0, 1 - (ph - 22) / 10);
      enemy(g, ex, GY, { rot: tilt });
      hero(g, 120, GY);
      g.fillStyle = '#7fd6ff'; g.fillRect(126, GY - 10, 4 + ext * 22, 5); rr(g, 128 + ext * 22, GY - 12, 8, 9, 2); g.fill();
    }
  };
};

S.flash = ({ rand, f }) => {
  let t = 0, fl = 0, pop = 1; const shots = [];
  return {
    act() { shots.push({ x: 50 }); },
    step() {
      if (t % 40 === 0) shots.push({ x: 50 });
      for (let i = shots.length - 1; i >= 0; i--) { shots[i].x += 5; if (shots[i].x > 165) { shots.splice(i, 1); if (f) { fl = 4; pop = 1.25; } } }
      if (fl > 0) fl--; pop = lerp(pop, 1, .25); t++;
    },
    draw(g) {
      ground(g); hero(g, 40, GY);
      g.fillStyle = COL.yellow; for (const s of shots) { g.beginPath(); g.arc(s.x, GY - 9, 3.5, 0, Math.PI * 2); g.fill(); }
      enemy(g, 180, GY, { flash: fl > 0, scale: pop });
    }
  };
};

S.numbers = ({ rand, f }) => {
  let t = 0, hp = 1; const shots = [], nums = [];
  return {
    act() { shots.push({ x: 50 }); },
    step() {
      if (t % 26 === 0) shots.push({ x: 50 });
      for (let i = shots.length - 1; i >= 0; i--) {
        shots[i].x += 5;
        if (shots[i].x > 165) { shots.splice(i, 1); const d = 8 + ((rand() * 30) | 0), crit = rand() < .2; hp -= (crit ? d * 2 : d) / 400; if (hp <= 0) hp = 1;
          if (f) nums.push({ v: crit ? d * 2 : d, crit, x: 180 + (rand() - .5) * 20, y: GY - 28, age: 0 }); }
      }
      for (let i = nums.length - 1; i >= 0; i--) { nums[i].age++; nums[i].y -= .5; if (nums[i].age > 45) nums.splice(i, 1); }
      t++;
    },
    draw(g) {
      ground(g); hero(g, 40, GY);
      g.fillStyle = COL.yellow; for (const s of shots) { g.beginPath(); g.arc(s.x, GY - 9, 3.5, 0, Math.PI * 2); g.fill(); }
      enemy(g, 180, GY); hpBar(g, 162, GY - 30, 36, hp, COL.red);
      for (const n of nums) {
        const sc = n.age < 12 ? ease.outBack(n.age / 12) : 1; g.globalAlpha = n.age > 30 ? 1 - (n.age - 30) / 15 : 1;
        g.save(); g.translate(n.x, n.y); g.scale(sc, sc);
        g.font = `800 ${n.crit ? 16 : 12}px ${G2D.FONT}`; g.textAlign = 'center';
        g.lineWidth = 3; g.strokeStyle = '#0b0e1a'; g.strokeText(n.v, 0, 0); g.fillStyle = n.crit ? COL.yellow : '#fff'; g.fillText(n.v, 0, 0);
        g.restore(); g.globalAlpha = 1; g.textAlign = 'left';
      }
    }
  };
};

S.slowmo = ({ rand, f }) => {
  let t = 0, hp = 3, dead = false, slow = 0, acc = 0, zoom = 1, flash = 0; const shots = [], P = parts();
  const reset = () => { t = 0; hp = 3; dead = false; slow = 0; zoom = 1; shots.length = 0; };
  return {
    act() { reset(); },
    step() {
      const scale = slow > 0 ? .18 : 1; if (slow > 0) slow--;
      acc += scale; zoom = lerp(zoom, slow > 0 ? 1.35 : 1, .12); if (flash > 0) flash--;
      while (acc >= 1) {
        acc -= 1;
        if (!dead && t % 34 === 0 && t < 110) shots.push({ x: 50 });
        for (let i = shots.length - 1; i >= 0; i--) { shots[i].x += 5; if (shots[i].x > 166) { shots.splice(i, 1); hp--; flash = 3;
          if (hp <= 0) { dead = true; if (f) slow = 50; for (let k = 0; k < 18; k++) { const a = rand() * Math.PI * 2, s = 1 + rand() * 3.5; P.add({ x: 180, y: GY - 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g: .12, life: 40, r: 2.5, sq: true, col: k % 3 ? COL.red : '#fff', drag: .97 }); } } } }
        P.step(); t++; if (t > 200) reset();
      }
    },
    draw(g) {
      g.translate(180, GY - 10); g.scale(zoom, zoom); g.translate(-180, -(GY - 10));
      ground(g, GY, -60, 300); hero(g, 40, GY);
      g.fillStyle = COL.yellow; for (const s of shots) { g.beginPath(); g.arc(s.x, GY - 9, 3.5, 0, Math.PI * 2); g.fill(); }
      if (!dead) { enemy(g, 180, GY, { flash: flash > 0 }); hpBar(g, 162, GY - 30, 36, hp / 3, COL.red); }
      P.draw(g);
    },
    note: () => f && slow > 0 ? 'スロー ×0.18' : ''
  };
};

S.squash = ({ rand, f }) => {
  let y = 30, vy = 0, sq = 0; const P = parts();
  return {
    act() { y = 20; vy = 0; },
    step() {
      vy += .32; y += vy;
      if (y >= GY) { y = GY; vy = -7.4; if (f) { sq = 1; dust(P, 120, GY, 6, rand); } }
      sq *= .78; P.step();
    },
    draw(g) {
      ground(g);
      let sx = 1, sy = 1;
      if (f) { const st = clamp(Math.abs(vy) * .05, 0, .35); sy = 1 + st - sq * .45; sx = 1 / sy; }
      g.save(); g.translate(120, y); g.scale(sx, sy); g.fillStyle = '#ffd84d'; g.beginPath(); g.arc(0, -11, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0b0e1a'; g.fillRect(-4, -15, 2.5, 4); g.fillRect(2, -15, 2.5, 4); g.restore();
      P.draw(g);
    }
  };
};

S.easing = ({ f }) => {
  let t = 0; const trail = [];
  const pos = () => { const ph = t % 140, dir = ph < 70 ? 1 : -1, k = (ph % 70) / 45; const e = k >= 1 ? 1 : (f ? ease.outBack(k) : k); return dir > 0 ? lerp(40, 200, e) : lerp(200, 40, e); };
  return {
    act() { t = 0; trail.length = 0; },
    step() { t++; if (t % 3 === 0) { trail.push(pos()); if (trail.length > 16) trail.shift(); } },
    draw(g) {
      ground(g);
      g.fillStyle = 'rgba(127,214,255,.25)'; for (const x of trail) { g.fillRect(x - 1, GY - 30, 2, 8); }
      hero(g, pos(), GY);
      label(g, f ? '速く出て、行き過ぎて戻る' : '最初から最後まで同じ速さ', PW / 2, GY + 16, { size: 9.5, align: 'center', color: COL.muted, weight: 500 });
    }
  };
};

S.accel = ({ rand, f }) => {
  let t = 0, x = 60, v = 0, face = 1, lean = 0; const P = parts();
  return {
    act() { t = 40; },
    step() {
      const dir = (t % 160) < 80 ? 1 : -1, target = dir * 3.2;
      if (f) { const a = Math.sign(target - v) === Math.sign(v) || v === 0 ? .22 : .38; if (Math.abs(target - v) < a) v = target; else v += Math.sign(target - v) * a;
        if (Math.sign(v) !== dir && Math.abs(v) > .5 && t % 2 === 0) dust(P, x, GY, 1, rand, -dir); }
      else v = target;
      x += v; if (x < 30) { x = 30; } if (x > 210) { x = 210; }
      if (v !== 0) face = Math.sign(v); lean = f ? lerp(lean, v * .06, .3) : 0;
      P.step(); t++;
    },
    draw(g) { ground(g); P.draw(g); hero(g, x, GY, { face, rot: lean }); }
  };
};

S.landing = ({ rand, f }) => {
  let t = 0, y = -20, vy = 0, sq = 0, shake = 0, landed = false; const P = parts();
  return {
    act() { t = 0; y = -20; vy = 0; landed = false; },
    step() {
      if (!landed) { vy += .35; y += vy; if (y >= GY) { y = GY; landed = true; if (f) { sq = 1; shake = 4; dust(P, 120, GY, 12, rand); } } }
      sq *= .8; shake *= .8; P.step(); t++;
      if (t > 110) { t = 0; y = -20; vy = 0; landed = false; }
    },
    draw(g) {
      g.translate((rand() - .5) * shake * 2, (rand() - .5) * shake * 2);
      ground(g); P.draw(g);
      hero(g, 120, y, { sx: 1 + sq * .5, sy: 1 - sq * .4 });
    }
  };
};

S.recoil = ({ rand, f }) => {
  let t = 0, kick = 0, flash = 0, shake = 0; const B = [], P = parts();
  return {
    act() { t = 0; },
    step() {
      const ph = t % 90;
      if (ph < 40 && ph % 8 === 0) {
        B.push({ x: 72, y: GY - 14 + (f ? (rand() - .5) * 3 : 0) });
        if (f) { kick = 5; flash = 3; shake = 2; P.add({ x: 58, y: GY - 18, vx: -1 - rand(), vy: -2.5 - rand(), g: .25, life: 40, r: 1.6, sq: true, col: COL.yellow, drag: .99 }); }
      }
      for (let i = B.length - 1; i >= 0; i--) { B[i].x += 8; if (B[i].x > 250) B.splice(i, 1); }
      kick *= .7; if (flash > 0) flash--; shake *= .7; P.step(); t++;
    },
    draw(g) {
      g.translate((rand() - .5) * shake * 2, (rand() - .5) * shake * 2);
      ground(g); hero(g, 40 - kick * .4, GY);
      g.fillStyle = '#c9cfdf'; g.fillRect(48 - kick, GY - 16, 22, 5); g.fillRect(50 - kick, GY - 12, 5, 6);
      if (flash > 0) { g.fillStyle = '#fff4c2'; g.beginPath(); g.arc(74 - kick, GY - 14, 6 + flash, 0, Math.PI * 2); g.fill(); }
      for (const b of B) { if (f) { g.strokeStyle = 'rgba(255,216,77,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(b.x - 14, b.y); g.lineTo(b.x, b.y); g.stroke(); } g.fillStyle = f ? '#fff' : '#9aa3b8'; g.fillRect(b.x - 3, b.y - 1, 6, 2); }
      P.draw(g);
    }
  };
};

/* platform helpers for input-forgiveness scenarios */
S.coyote = ({ f }) => {
  let t, x, y, vy, grounded, lastGround, jumped, pressAt, result;
  const reset = () => { t = 0; x = 20; y = GY; vy = 0; grounded = true; lastGround = 0; jumped = false; pressAt = -99; result = ''; };
  reset();
  const onPlat = (x) => x <= 132 || x >= 188;
  return {
    act() { reset(); },
    step() {
      t++; if (t > 150) reset();
      if (result === '') x += 2;
      if (x > 146 && pressAt < 0) pressAt = t;
      if (t === pressAt && !jumped) { if (grounded || (f && t - lastGround <= 7)) { vy = -5.6; jumped = true; grounded = false; } }
      if (grounded && !onPlat(x)) grounded = false;
      if (!grounded) { vy += .35; y += vy; if (vy > 0 && y >= GY && onPlat(x) && y - vy <= GY + 1) { y = GY; vy = 0; grounded = true; } }
      if (grounded) lastGround = t;
      if (y > PH + 20 && result === '') result = '落ちた';
      if (x > 215 && grounded && result === '') result = '成功';
    },
    draw(g) {
      ground(g, GY, 0, 132); ground(g, GY, 188, PW);
      g.fillStyle = 'rgba(255,84,112,.12)'; g.fillRect(132, GY, 56, PH);
      hero(g, x, y);
      inputMark(g, 'ジャンプ!', 146 + 4, GY - 26, t - pressAt);
      if (result) label(g, result, PW / 2, 50, { size: 13, align: 'center', color: result === '成功' ? COL.green : COL.red });
    },
    note: () => f ? '足場を離れて7フレームまでOK' : '足場の上でしか跳べない'
  };
};

S.buffer = ({ f }) => {
  let t, y, vy, grounded, pressAt, buffered, jumpedAt;
  const reset = () => { t = 0; y = 10; vy = 0; grounded = false; pressAt = -99; buffered = -99; jumpedAt = -99; };
  reset();
  return {
    act() { reset(); },
    step() {
      t++; if (t > 130) reset();
      if (!grounded) { vy += .3; y += vy; }
      if (!grounded && pressAt < 0 && vy > 0 && y > GY - 6 * vy - 12) { pressAt = t; buffered = t; }
      if (!grounded && y >= GY) { y = GY; vy = 0; grounded = true;
        if (f && t - buffered <= 8 && jumpedAt < 0) { vy = -6; grounded = false; jumpedAt = t; } }
    },
    draw(g) { ground(g); hero(g, 120, y); inputMark(g, 'ジャンプ!', 150, GY - 40, t - pressAt); if (jumpedAt < 0 && grounded && pressAt > 0) label(g, '押したのに跳ばない', PW / 2, 46, { size: 11, align: 'center', color: COL.red }); },
    note: () => f ? '着地8フレーム前の入力を覚えておく' : '空中の入力は捨てる'
  };
};

S.varjump = ({ f }) => {
  let t, y, vy, grounded, holdLeft, cut, kind = 0, trail = [];
  const start = () => { t = 0; y = GY; vy = -6.4; grounded = false; cut = false; holdLeft = kind ? 22 : 5; trail = []; };
  start();
  return {
    act() { start(); },
    step() {
      t++;
      if (!grounded) {
        if (holdLeft > 0) holdLeft--; else if (f && !cut && vy < 0) { vy *= .4; cut = true; }
        vy += .3; y += vy; if (t % 3 === 0) trail.push([90 + t * .9, y]);
        if (y >= GY) { y = GY; grounded = true; }
      } else if (t > 70) { kind = 1 - kind; start(); }
    },
    draw(g) {
      ground(g); g.fillStyle = 'rgba(127,214,255,.3)'; for (const [x, yy] of trail) g.fillRect(x - 1, yy - 9, 2, 2);
      hero(g, 90 + Math.min(t, 70) * .9, y);
      const w = (kind ? 22 : 5) * 3; g.fillStyle = '#2a2f40'; g.fillRect(16, GY + 12, 66, 5); g.fillStyle = COL.yellow; g.fillRect(16, GY + 12, w, 5);
      label(g, kind ? '長押し' : '短く押す', 88, GY + 18, { size: 9.5, color: COL.muted, weight: 500 });
    }
  };
};

S.asym = ({ f }) => {
  let t, x, y, vy, trail;
  const start = () => { t = 0; x = 30; y = GY; vy = f ? -6.2 : -6.2; trail = []; };
  start();
  return {
    act() { start(); },
    step() {
      t++;
      if (y < GY || vy < 0) {
        let gr = .3; if (f) { gr = vy > 0 ? .62 : Math.abs(vy) < 1.2 ? .16 : .3; }
        vy += gr; y += vy; x += 2.4; if (t % 2 === 0) trail.push([x, y]);
        if (y >= GY) { y = GY; vy = 0; }
      } else if (t > 100) start();
    },
    draw(g) {
      ground(g); g.fillStyle = f ? 'rgba(240,165,74,.55)' : 'rgba(127,214,255,.45)'; for (const [xx, yy] of trail) g.fillRect(xx - 1, yy - 9, 2, 2);
      hero(g, x, y);
    },
    note: () => f ? '上昇ゆっくり・頂点で溜め・落下は速く' : '上りも下りも同じ重力'
  };
};

S.iframes = ({ f }) => {
  let t = 0, hp = 1, inv = 0, bx = 260;
  return {
    act() { hp = 1; bx = 260; t = 0; },
    step() {
      t++; bx -= 2.2; if (bx < -30) { bx = 270; if (hp < .3) hp = 1; }
      if (inv > 0) inv--;
      const hit = Math.abs(bx - 120) < 18;
      if (hit) { if (!f) hp -= .025; else if (inv === 0) { hp -= .12; inv = 50; } }
    },
    draw(g) {
      ground(g);
      const vis = !(f && inv > 0 && (inv >> 2) % 2 === 0);
      if (vis) hero(g, 120, GY, { col: inv > 0 || (!f && Math.abs(bx - 120) < 18) ? '#ff9fb0' : undefined });
      g.save(); g.translate(bx, GY - 10); g.rotate(-t * .12); g.fillStyle = '#9aa3b8';
      for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(8, -3); g.lineTo(15, 0); g.lineTo(8, 3); g.fill(); }
      g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill(); g.restore();
      label(g, 'HP', 150, 32, { size: 9.5, mono: true, color: COL.muted }); hpBar(g, 168, 26, 60, hp, hp < .3 ? COL.red : COL.green);
    },
    note: () => ''
  };
};

function camScenario(kind) {
  return ({ rand, f }) => {
    let t = 0, x = 60, v = 0, cam = 60, dir = 1, plan = 0;
    const posts = []; for (let i = 0; i < 40; i++) posts.push(i * 45 + (i % 3) * 7);
    return {
      act() { t = 0; },
      step() {
        t++;
        if (kind === 'follow') { plan = t % 60; v = plan < 12 ? 6 * dir : 0; if (x > 880) dir = -1; if (x < 60) dir = 1; }
        else { const ph = t % 260; dir = ph < 170 ? 1 : -1; v = 2.6 * dir; }
        x += v; x = clamp(x, 40, 1000);
        let target = x;
        if (kind === 'look' && f) target = x + dir * 70;
        cam = f ? lerp(cam, target, kind === 'look' ? .05 : .08) : target;
      },
      draw(g) {
        g.save(); g.translate(PW / 2 - cam, 0);
        for (let i = 0; i < posts.length; i++) { const px = posts[i]; g.fillStyle = i % 4 === 0 ? '#34406a' : '#262f4f'; g.fillRect(px, GY - 34 - (i % 3) * 8, 10, 34 + (i % 3) * 8); }
        g.fillStyle = '#232b45'; g.fillRect(-200, GY, 1600, 40); g.fillStyle = '#3b4870'; g.fillRect(-200, GY, 1600, 2);
        if (kind === 'look') for (let i = 1; i < 12; i++) enemy(g, 90 * i + 150, GY, { scale: .7 });
        hero(g, x, GY, { face: v < 0 ? -1 : 1 });
        g.restore();
        g.strokeStyle = 'rgba(240,165,74,.35)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(PW / 2, 24); g.lineTo(PW / 2, GY); g.stroke(); g.setLineDash([]);
      },
      note: () => kind === 'follow' ? (f ? 'カメラが少し遅れてついていく' : 'カメラが自機に固定') : (f ? '進む方向の先を多めに映す' : '自機が常に真ん中')
    };
  };
}

/* ---------- catalogue ---------- */
const SECTIONS = [
  { id: 'impact', en: 'Impact', title: '打撃の手応え', lead: '攻撃が「当たった」と感じるかどうかは、当たった瞬間の数フレームの演出でほぼ決まります。ダメージの計算は、上下どちらも同じです。' },
  { id: 'motion', en: 'Motion', title: '動きの気持ちよさ', lead: '同じ距離を同じ時間で動いても、速さの変化のつけ方や、形の変化で印象は大きく変わります。' },
  { id: 'input', en: 'Forgiving input', title: '操作のやさしさ', lead: '人間の反応はフレーム単位では正確ではありません。少しずれた入力でも、意図どおりに動いたように見せる工夫です。' },
  { id: 'camera', en: 'Camera', title: 'カメラ', lead: 'どこを映すかで、遊びやすさも気持ちよさも変わります。オレンジの点線が画面の中心です。' }
];

const ITEMS = [
  pair({ s: 'impact', name: '画面の揺れ', tag: 'shake = 7px → ×0.82 / frame', scen: S.shake,
    desc: '当たった瞬間に画面全体を数ピクセルだけ揺らし、すぐ収めます。弱すぎると気づかれず、強すぎると酔うので、大きさと収まる速さの調整がすべてです。' }),
  pair({ s: 'impact', name: 'ヒットストップ', tag: 'freeze 8 frames', scen: S.hitstop,
    desc: '攻撃が当たった瞬間、攻撃した側も受けた側も数フレームだけ止めます。わずか0.13秒ですが、「重いものを斬った」感覚が生まれます。格闘ゲームやアクションゲームの定番です。' }),
  pair({ s: 'impact', name: 'ノックバック', tag: 'velocity 6 → ×0.82', scen: S.knock,
    desc: '殴られた敵を後ろに押し出し、少し傾けます。何も起きない「なし」では、当たったのかどうかすら分かりません。' }),
  pair({ s: 'impact', name: 'ヒットフラッシュ', tag: 'white 4 frames + scale 1.25', scen: S.flash,
    desc: '当たった敵を一瞬だけ真っ白にし、少し膨らませます。どの敵に当たったかが一目で分かります。' }),
  pair({ s: 'impact', name: 'ダメージ数字', tag: 'pop-up · ease-out-back', scen: S.numbers,
    desc: 'ダメージを数字で飛び出させます。出るときに少し大きくなってから戻り、上に漂って消えます。会心の一撃だけ大きく黄色にすると、うれしさが増えます。' }),
  pair({ s: 'impact', name: '最後の一撃のスロー', tag: 'time × 0.18 + zoom', scen: S.slowmo,
    desc: '敵を倒した一撃だけ、時間を遅くして少し寄ります。とどめの瞬間を印象に残す演出です。' }),

  pair({ s: 'motion', name: '伸び縮み', tag: 'squash & stretch', scen: S.squash,
    desc: '速く動くときは縦に伸ばし、着地の瞬間はつぶします。体積は変えないように、縦に伸ばしたら横は細くします。アニメーションの基本原則のひとつです。' }),
  pair({ s: 'motion', name: 'イージング', tag: 'linear vs ease-out-back', scen: S.easing,
    desc: '一定の速さで動くと機械的に見えます。「あり」は最初に速く動き、少し行き過ぎてから戻ります。薄い線は3フレームごとの位置で、間隔の違いが速さの違いです。' }),
  pair({ s: 'motion', name: '加速と減速', tag: 'accel 0.22 · turn 0.38', scen: S.accel,
    desc: '「なし」は向きを変えた瞬間に最高速で逆走します。「あり」は少しずつ加速し、切り返しでは滑りながら止まって砂ぼこりを出し、体も進む方向に傾けます。' }),
  pair({ s: 'motion', name: '着地の演出', tag: 'squash + dust + shake', scen: S.landing,
    desc: '高いところから着地したときに、体をつぶし、砂ぼこりを出し、画面をわずかに揺らします。3つとも小さな演出ですが、重さが伝わります。' }),
  pair({ s: 'motion', name: '射撃の反動', tag: 'recoil + flash + shells', scen: S.recoil,
    desc: '撃つたびに銃口の光、銃が後ろに下がる反動、飛び出す薬きょう、弾道の光、わずかな揺れを重ねています。弾の強さは同じです。' }),

  pair({ s: 'input', name: 'コヨーテタイム', tag: 'grace 7 frames after leaving ledge', scen: S.coyote,
    desc: '足場の端を踏み外した直後でも、少しの間はジャンプを受け付けます。名前は、崖から走り出てから落ちるアニメのコヨーテに由来します。「なし」では同じタイミングの入力で落ちてしまいます。' }),
  pair({ s: 'input', name: '先行入力', tag: 'jump buffer 8 frames', scen: S.buffer,
    desc: '着地の少し前に押されたジャンプを覚えておき、着地した瞬間に実行します。「なし」では、押したのに跳ばない理不尽さを感じます。' }),
  pair({ s: 'input', name: '可変ジャンプ', tag: 'release → vy × 0.4', scen: S.varjump,
    desc: 'ボタンを早く離すと上昇を打ち切り、低いジャンプにします。短く押すか長押しするかを交互に試していて、「なし」はどちらも同じ高さです。' }),
  pair({ s: 'input', name: '非対称なジャンプ', tag: 'fall gravity × 2 · apex hang', scen: S.asym,
    desc: '「なし」は物理どおりの左右対称な放物線。「あり」は頂点付近で重力を弱めて一瞬ためを作り、落ちるときは重力を強くしています。ふわふわ感が消え、狙った場所に着地しやすくなります。' }),
  pair({ s: 'input', name: '無敵時間', tag: 'invincible 50 frames + blink', scen: S.iframes,
    desc: '「なし」はトゲに触れている間、毎フレームダメージを受けて一気に体力が減ります。「あり」は1回当たったら少しの間点滅して無敵になり、逃げる時間をもらえます。' }),

  pair({ s: 'camera', name: 'カメラのなめらかな追従', tag: 'cam += (target − cam) × 0.08', scen: camScenario('follow'),
    desc: '自機がダッシュと停止をくり返します。「なし」は背景が急発進・急停止して目が疲れます。「あり」はカメラが毎フレーム残りの距離の8%ずつ近づくので、なめらかに追いかけます。' }),
  pair({ s: 'camera', name: 'カメラの先読み', tag: 'target = x + 向き × 70', scen: camScenario('look'),
    desc: '進んでいる方向の先を多めに映すようにカメラをずらします。前から来る敵が早く見えるので、反応する余裕が生まれます。' })
];

run({ sections: SECTIONS, items: ITEMS, W: 240, H: 256, minCol: 300 });
series('feel');

})();
