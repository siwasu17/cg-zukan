/*
 * Series navigation shared by every catalogue page.
 *
 * Usage (at the end of a catalogue page):
 *   <div class="series" id="series"></div>        ← where the links appear
 *   <script src="../../assets/js/series.js" data-catalogue="feel"></script>
 *
 * The list of catalogues is read from /catalogues.json, so adding a catalogue
 * there automatically adds it to the navigation of every page.
 */
(function () {
  'use strict';
  const me = document.currentScript;
  const current = me ? me.dataset.catalogue : '';
  // site root = the folder that contains assets/js/series.js
  const root = me ? me.src.replace(/assets\/js\/series\.js(\?.*)?$/, '') : '../../';

  function render(data) {
    const box = document.getElementById('series');
    if (!box) return;
    box.textContent = '';
    const home = document.createElement('a');
    home.href = root; home.className = 'series-home'; home.textContent = '← 図鑑一覧';
    box.appendChild(home);
    const label = document.createElement('b'); label.textContent = '図鑑シリーズ'; box.appendChild(label);
    for (const c of data.catalogues) {
      if (c.hidden) continue;
      if (c.id === current) {
        const s = document.createElement('span'); s.textContent = c.title; s.setAttribute('aria-current', 'page'); box.appendChild(s);
      } else {
        const a = document.createElement('a'); a.href = root + c.path; a.textContent = c.title; box.appendChild(a);
      }
    }
  }

  function start() {
    fetch(root + 'catalogues.json', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(render)
      .catch(() => {
        // file:// or offline: keep at least the link back to the list page
        const box = document.getElementById('series');
        if (box) { box.innerHTML = ''; const a = document.createElement('a'); a.href = root + 'index.html'; a.className = 'series-home'; a.textContent = '← 図鑑一覧'; box.appendChild(a); }
      });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
