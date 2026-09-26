// Read / write catalogues.json, keeping one group or catalogue per line block so diffs stay readable.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MANIFEST = join(ROOT, 'catalogues.json');

export function readManifest() {
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

const KEY_ORDER = ['id', 'title', 'group', 'kind', 'cards', 'path', 'thumbnail', 'hidden', 'description'];

function entry(obj, order) {
  const keys = [...order.filter((k) => k in obj), ...Object.keys(obj).filter((k) => !order.includes(k))];
  const parts = keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(obj[k])}`);
  // put a long description on its own line
  const di = keys.indexOf('description');
  if (di > 0) {
    const head = parts.slice(0, di).concat(parts.slice(di + 1));
    return `    { ${head.join(', ')},\n      ${parts[di]} }`;
  }
  return `    { ${parts.join(', ')} }`;
}

export function writeManifest(m) {
  const out = [
    '{',
    `  "site": ${JSON.stringify(m.site, null, 2).replace(/\n/g, '\n  ')},`,
    '  "groups": [',
    (m.groups || []).map((g) => entry(g, ['id', 'title', 'description']).replace('\n      ', ' ')).join(',\n'),
    '  ],',
    '  "catalogues": [',
    (m.catalogues || []).map((c) => entry(c, KEY_ORDER)).join(',\n'),
    '  ]',
    '}',
    ''
  ].join('\n');
  JSON.parse(out); // safety: never write broken JSON
  writeFileSync(MANIFEST, out);
}
