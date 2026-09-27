#!/usr/bin/env node
// Validate catalogues.json and the files it points to. Exits with 1 on any error.
//   node scripts/check.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readManifest } from './lib/manifest.mjs';

const errors = [], warnings = [];
let m;
try { m = readManifest(); } catch (e) { console.error('catalogues.json を読めません: ' + e.message); process.exit(1); }

if (!Array.isArray(m.groups)) errors.push('groups が配列ではありません');
if (!Array.isArray(m.catalogues)) errors.push('catalogues が配列ではありません');
const groups = new Set((m.groups || []).map((g) => g.id));
const ids = new Set();

for (const c of m.catalogues || []) {
  const where = `catalogues["${c.id || '?'}"]`;
  for (const k of ['id', 'title', 'path']) if (!c[k]) errors.push(`${where}: ${k} がありません`);
  if (!c.id) continue;
  if (ids.has(c.id)) errors.push(`${where}: id が重複しています`);
  ids.add(c.id);
  if (c.group && !groups.has(c.group)) warnings.push(`${where}: group "${c.group}" が groups にありません（一覧では「その他」に入ります）`);
  if (c.kind && !['2D', '3D'].includes(c.kind)) warnings.push(`${where}: kind は "2D" か "3D" を推奨します`);
  if (c.path) {
    if (!c.path.endsWith('/')) warnings.push(`${where}: path は "/" で終わらせてください（例: catalogues/${c.id}/）`);
    const page = join(ROOT, c.path, 'index.html');
    if (!existsSync(page)) errors.push(`${where}: ${c.path}index.html がありません`);
    else {
      const html = readFileSync(page, 'utf8');
      if (!html.includes('assets/js/series.js')) warnings.push(`${where}: series.js を読み込んでいません（シリーズのリンクが出ません）`);
      else if (!html.includes(`data-catalogue="${c.id}"`)) warnings.push(`${where}: series.js の data-catalogue が "${c.id}" になっていません`);
      if (!html.includes('manifest.webmanifest')) warnings.push(`${where}: manifest.webmanifest を読み込んでいません（アプリとして追加したときの名前やアイコンが出ません）`);
      if (/claude\.ai\/artifact/.test(html)) warnings.push(`${where}: claude.ai のアーティファクトへのリンクが残っています`);
    }
  }
  if (c.thumbnail && !existsSync(join(ROOT, c.thumbnail))) errors.push(`${where}: thumbnail ${c.thumbnail} がありません`);
}

for (const w of warnings) console.warn('注意: ' + w);
for (const e of errors) console.error('エラー: ' + e);
if (errors.length) process.exit(1);
console.log(`OK: ${ids.size} 冊の図鑑を確認しました${warnings.length ? `（注意 ${warnings.length} 件）` : ''}`);
