// Real browser capture for Balloon Bouncer. Uses an installed Playwright package.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');

const root = path.resolve(__dirname, '..');
const out = __dirname;
const devices = {
  'portrait-9x16': [360, 640, 3],
  'landscape-16x9': [640, 360, 3],
  'phone-tall': [390, 844, 3],
  'phone-wide': [844, 390, 3],
  'tablet-portrait': [768, 1024, 2],
  'tablet-landscape': [1024, 768, 2],
  'desktop-1440p': [1280, 720, 2],
};
const shots = [
  '01-title', '02-ready-to-fling', '03-first-bounce', '04-chain-reaction',
  '05-fireball', '06-saw-blade', '07-lightning-orb', '08-black-hole',
  '09-results', '10-upgrade-shop',
];

function packageFromCache(name) {
  try { return require(name); } catch {}
  const npx = path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx');
  for (const entry of fs.readdirSync(npx)) {
    const candidate = path.join(npx, entry, 'node_modules', name);
    if (fs.existsSync(candidate)) return require(candidate);
  }
  throw Error(`Missing ${name}; install it in this project or npm cache.`);
}
const { chromium } = packageFromCache('playwright');

function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function server() {
  const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png' };
  return http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + rel, rel.endsWith('/') ? 'index.html' : '');
    if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) {
      res.writeHead(403).end(); return;
    }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

async function open(browser, base, width, height, scale) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/?debug&capture&dpr=${scale}`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__game && document.querySelector('#overlay-title'));
  await page.waitForTimeout(180);
  if (errors.length) throw Error(errors.join('\n'));
  return { page, context, errors };
}
async function runShot(page, dir, name) {
  await page.screenshot({ path: path.join(dir, `${name}.png`), animations: 'disabled' });
}
async function game(page, code) { return page.evaluate(code); }
async function captureDevice(browser, base, name, [width, height, scale], resultsOnly = false) {
  const dir = path.join(out, 'screenshots', name);
  mkdir(dir);
  const { page, context, errors } = await open(browser, base, width, height, scale);
  try {
    if (!resultsOnly) {
    await runShot(page, dir, shots[0]);
    await game(page, () => window.__game.start());
    await runShot(page, dir, shots[1]);
    await game(page, () => { window.__game.setAim(-1.55, 1); window.__game.launch(); window.__game.step(0.7); });
    await runShot(page, dir, shots[2]);
    await game(page, () => window.__game.step(1.5));
    await runShot(page, dir, shots[3]);
    await game(page, () => { window.__game.configure({ level: 3, owned: { ball: 2, fireball: 3 }, money: 180 }); window.__game.setAim(-1.55); window.__game.launch(); window.__game.step(0.9); });
    await runShot(page, dir, shots[4]);
    await game(page, () => { window.__game.configure({ level: 3, owned: { saw: 4, ball: 1 }, money: 80 }); window.__game.setAim(-1.55); window.__game.launch(); window.__game.step(1.1); });
    await runShot(page, dir, shots[5]);
    await game(page, () => { window.__game.configure({ level: 5, owned: { lightning: 3, fireball: 2 }, money: 750 }); window.__game.setAim(-1.55); window.__game.launch(); window.__game.step(0.9); });
    await runShot(page, dir, shots[6]);
    await game(page, () => { window.__game.configure({ level: 6, owned: { blackhole: 2, fireball: 2, saw: 2 }, money: 3200 }); window.__game.setAim(-1.55); window.__game.launch(); window.__game.step(1.0); });
    await runShot(page, dir, shots[7]);
    }
    await game(page, () => {
      window.__game.configure({ level: 5, owned: { ball: 2, saw: 2, fireball: 2, lightning: 1 }, money: 820 });
      window.__game.pop(window.__game.stats.total);
      window.__game.finish();
    });
    await page.waitForTimeout(420);
    await runShot(page, dir, shots[8]);
    await game(page, () => window.__game.openShop());
    await runShot(page, dir, shots[9]);
    if (errors.length) throw Error(errors.join('\n'));
  } finally { await context.close(); }
  console.log(`${name}: ${resultsOnly ? 2 : shots.length} real screenshots`);
}

async function capturePreview(browser, base, name, [width, height, scale], seconds = 12, fps = 30) {
  const dir = path.join(out, 'preview', `frames-${name}`);
  mkdir(dir);
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  const { page, context, errors } = await open(browser, base, width, height, scale);
  const total = Math.round(seconds * fps);
  try {
    for (let n = 0; n < total; n++) {
      if (n === 0) await game(page, () => { window.__game.configure({ level: 3, owned: { ball: 2, saw: 2, fireball: 2 }, money: 210 }); window.__game.setAim(-1.55); });
      if (n === Math.round(fps * .47)) await game(page, () => window.__game.launch());
      if (n === Math.round(fps * 4.13)) await game(page, () => { window.__game.configure({ level: 5, owned: { lightning: 3, fireball: 2 }, money: 850 }); window.__game.setAim(-1.55); });
      if (n === Math.round(fps * 4.60)) await game(page, () => window.__game.launch());
      if (n === Math.round(fps * 8.13)) await game(page, () => { window.__game.configure({ level: 6, owned: { blackhole: 2, fireball: 2, saw: 2 }, money: 3200 }); window.__game.setAim(-1.55); });
      if (n === Math.round(fps * 8.60)) await game(page, () => window.__game.launch());
      await page.evaluate(dt => window.__game.step(dt), 1 / fps);
      await page.screenshot({ path: path.join(dir, `${String(n).padStart(4, '0')}.png`), animations: 'disabled' });
      if (n % 30 === 0) console.log(`${name}: ${n}/${total}`);
    }
    if (errors.length) throw Error(errors.join('\n'));
  } finally { await context.close(); }
  console.log(`${name}: ${total} fixed-step frames`);
}

async function main() {
  const args = process.argv.slice(2);
  const app = server();
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    if (args.includes('--smoke')) {
      const { page, context, errors } = await open(browser, base, 360, 640, 3);
      const state = await game(page, () => ({ state: window.__game.state, title: document.title }));
      mkdir(path.join(out, 'ref'));
      await page.screenshot({ path: path.join(out, 'ref', 'smoke.png') });
      console.log(JSON.stringify({ ...state, errors }));
      await context.close();
      return;
    }
    if (!args.includes('--previews-only')) {
      const only = args.find(a => devices[a]);
      for (const [name, spec] of Object.entries(devices)) {
        if (only && only !== name) continue;
        await captureDevice(browser, base, name, spec, args.includes('--results-only'));
      }
    }
    if (!args.includes('--no-preview') && !args.includes('--results-only') && !args.some(a => devices[a])) {
      await capturePreview(browser, base, 'landscape', [640, 360, 3]);
      await capturePreview(browser, base, 'portrait', [360, 640, 3]);
    }
  } finally { await browser.close(); app.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
