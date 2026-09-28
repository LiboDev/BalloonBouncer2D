// Zero-dependency static dev server for local/mobile testing.
//   node scripts/serve.mjs [port]
// Serves the project root (live source, no build needed). Listens on all
// interfaces so phones on the same Wi-Fi can connect; there is no auth, so
// only run it on trusted networks.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.argv[2]) || 5173;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.mp4': 'video/mp4',
};

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // Block traversal and dotfiles (.git, .github, etc.).
    if (path.split('/').some((seg) => seg.startsWith('.'))) throw 404;
    let file = normalize(join(root, path));
    if (!file.startsWith(normalize(root))) throw 404;
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Balloon Bouncer dev server:\n  http://localhost:${port}/`);
  for (const list of Object.values(networkInterfaces())) {
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) console.log(`  http://${n.address}:${port}/`);
  }
});
