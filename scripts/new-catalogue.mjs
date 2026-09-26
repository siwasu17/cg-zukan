#!/usr/bin/env node
// Create a new catalogue from a template and register it in catalogues.json.
//
//   node scripts/new-catalogue.mjs <id> <タイトル> [--kind 2d|3d] [--group <groupId>]
//                                   [--eyebrow "English label"] [--description "一覧に出す説明"]
//
// Example:
//   node scripts/new-catalogue.mjs sound "サウンド表現図鑑" --kind 2d --group game --eyebrow "Sound catalogue"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readManifest, writeManifest } from './lib/manifest.mjs';

function parse(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { opt[a.slice(2)] = argv[i + 1]; i++; } else pos.push(a);
  }
  return { pos, opt };
}

const { pos, opt } = parse(process.argv.slice(2));
const [id, title] = pos;
const fail = (msg) => { console.error('エラー: ' + msg); process.exit(1); };

if (!id || !title) fail('使い方: node scripts/new-catalogue.mjs <id> <タイトル> [--kind 2d|3d] [--group <groupId>] [--eyebrow "..."] [--description "..."]');
if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) fail('id は半角の英小文字・数字・ハイフンだけにしてください（例: sound, ui-motion）');

const kind = (opt.kind || '2d').toLowerCase();
if (!['2d', '3d'].includes(kind)) fail('--kind は 2d か 3d を指定してください');

const m = readManifest();
if (m.catalogues.some((c) => c.id === id)) fail(`id "${id}" はすでに catalogues.json にあります`);
const group = opt.group || (m.groups[0] && m.groups[0].id);
if (group && !m.groups.some((g) => g.id === group)) fail(`group "${group}" は catalogues.json の groups にありません（${m.groups.map((g) => g.id).join(', ')}）`);

const dest = join(ROOT, 'catalogues', id);
if (existsSync(dest)) fail(`catalogues/${id} はすでに存在します`);

const description = opt.description || `${title}の説明をここに書きます。`;
const vars = { ID: id, TITLE: title, EYEBROW: opt.eyebrow || `${id} catalogue`, DESCRIPTION: description };
const tpl = join(ROOT, 'templates', kind);
mkdirSync(dest, { recursive: true });
for (const f of readdirSync(tpl)) {
  const text = readFileSync(join(tpl, f), 'utf8').replace(/\{\{(\w+)\}\}/g, (all, k) => (k in vars ? vars[k] : all));
  writeFileSync(join(dest, f), text);
}

m.catalogues.push({ id, title, group, kind: kind.toUpperCase(), cards: 0, path: `catalogues/${id}/`, description });
writeManifest(m);

console.log(`作成しました: catalogues/${id}/ (index.html, main.js)`);
console.log('catalogues.json に登録しました。');
console.log('次の作業:');
console.log(`  1. catalogues/${id}/main.js の ITEMS にカードを追加する`);
console.log(`  2. catalogues/${id}/index.html の説明文と用語を書き換える`);
console.log('  3. catalogues.json の cards（カード枚数）と description を更新する');
console.log('  4. node scripts/check.mjs で確認する');
