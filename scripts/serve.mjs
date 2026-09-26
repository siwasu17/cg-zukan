#!/usr/bin/env node
// Tiny static file server for local preview (no dependencies).
//   node scripts/serve.mjs [port]      → http://localhost:8000/
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { ROOT } from './lib/manifest.mjs';

const port = Number(process.argv[2] || process.env.PORT || 8000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if ((await stat(file).catch(() => null))?.isDirectory()) {
      if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }).end(); return; }
      file = join(file, 'index.html');
    }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
  }
}).listen(port, () => console.log(`http://localhost:${port}/ で表示しています（Ctrl+C で終了）`));
