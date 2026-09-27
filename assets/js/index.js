/*
 * List page. Everything shown here comes from catalogues.json:
 *   site      → page title and lead
 *   groups    → sections, in this order
 *   catalogues→ one card each, placed in its group (unknown groups go to "その他")
 */
(function () {
  'use strict';
  const list = document.getElementById('list');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const hue = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };

  function card(c) {
    const a = el('a', 'book'); a.href = c.path;
    const cover = el('div', 'cover');
    if (c.thumbnail) {
      const img = el('img'); img.src = c.thumbnail; img.alt = ''; img.loading = 'lazy'; img.width = 640; img.height = 400; cover.appendChild(img);
    } else {
      const tile = el('div', 'tile'); tile.style.setProperty('--h', hue(c.id)); tile.appendChild(el('span', '', [...c.title][0])); cover.appendChild(tile);
    }
    const badges = el('div', 'badges');
    if (c.kind) badges.appendChild(el('span', 'badge kind', c.kind));
    if (c.cards) badges.appendChild(el('span', 'badge', c.cards + ' 枚'));
    cover.appendChild(badges);
    const body = el('div', 'body');
    body.appendChild(el('h3', '', c.title));
    if (c.description) body.appendChild(el('p', '', c.description));
    body.appendChild(el('span', 'more', '開く →'));
    a.append(cover, body);
    return a;
  }

  function render(data) {
    if (data.site) {
      if (data.site.title) { document.getElementById('site-title').textContent = data.site.title; document.title = data.site.title; }
      if (data.site.description) document.getElementById('site-lead').textContent = data.site.description;
    }
    const cats = (data.catalogues || []).filter((c) => !c.hidden);
    const total = cats.reduce((n, c) => n + (c.cards || 0), 0);
    const stats = document.getElementById('stats');
    stats.innerHTML = ''; stats.append(el('b', '', String(cats.length)), ' 冊 · 見本 ', el('b', '', String(total)), ' 枚');

    const groups = (data.groups || []).slice();
    const known = new Set(groups.map((g) => g.id));
    if (cats.some((c) => !known.has(c.group))) groups.push({ id: '__other', title: 'その他', description: '' });
    const nav = document.getElementById('nav');
    list.textContent = '';
    for (const g of groups) {
      const items = cats.filter((c) => (g.id === '__other' ? !known.has(c.group) : c.group === g.id));
      if (!items.length) continue;
      const sec = el('section', 'group'); sec.id = g.id;
      const head = el('header'); head.appendChild(el('h2', '', g.title)); if (g.description) head.appendChild(el('p', '', g.description));
      const grid = el('div', 'books'); items.forEach((c) => grid.appendChild(card(c)));
      sec.append(head, grid); list.appendChild(sec);
      const link = el('a', '', g.title); link.href = '#' + g.id; nav.appendChild(link);
    }
  }

  // offline support / install as an app (see sw.js)
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  fetch('catalogues.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render)
    .catch(() => {
      list.textContent = '';
      list.appendChild(el('p', 'fail', 'catalogues.json を読み込めませんでした。ファイルを直接開いている場合は、docs/guide.md の手順でローカルサーバーを起動してから開いてください。'));
    });
})();
