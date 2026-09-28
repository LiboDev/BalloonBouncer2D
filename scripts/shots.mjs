// Mobile-size screenshots via Chrome DevTools Protocol (no dependencies).
//   node scripts/shots.mjs [outDir]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.argv[2] || join(tmpdir(), 'bb-shots');
mkdirSync(out, { recursive: true });
const chromePath = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9333;
const profile = mkdtempSync(join(tmpdir(), 'bb-chrome-'));
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--allow-file-access-from-files', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    target = list.find((t) => t.type === 'page');
  } catch { /* not up yet */ }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(JSON.stringify(msg.params.args));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(expr + ' -> ' + JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, name + '.png'), Buffer.from(r.result.data, 'base64'));
  console.log('saved', join(out, name + '.png'));
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true });
const url = pathToFileURL(join(root, 'index.html')).href + '?debug&capture&dpr=2';
await send('Page.navigate', { url });
await sleep(1500);

await shot('01-title');
await evaluate(`__game.configure({ level: 1, seed: 42, owned: { ball: 3 } }); __game.step(0.05)`);
await shot('02-level1');
await evaluate(`__game.configure({ level: 7, seed: 42, owned: { ball: 3 } }); __game.step(0.05)`);
await shot('03-level7');
await evaluate(`__game.configure({ level: 22, seed: 42, owned: { ball: 4, rubber: 4, saw: 3, fireball: 4, lightning: 3, blackhole: 1 } }); __game.step(0.05)`);
await shot('04-level22');
await evaluate(`__game.setAim(-Math.PI / 2 - 0.2, 0.9); __game.launch(); __game.step(0.9)`);
await shot('05-level22-action-a');
await evaluate(`__game.step(0.5)`);
await shot('06-level22-action-b');
await evaluate(`__game.openSettings(); __game.step(0.02)`);
await shot('07-settings');
await evaluate(`__game.closeSettings(); __game.pop(999); __game.step(2)`);
await sleep(500);
await shot('08-results-win');
await evaluate(`__game.openShop(); __game.step(0.02)`);
await shot('09-shop');
await evaluate(`__game.configure({ level: 3, seed: 42, owned: { ball: 1 } }); __game.setAim(-0.3, 0.2); __game.launch(); for (let i = 0; i < 100 && __game.state === 'play'; i++) __game.step(0.2);`);
await sleep(500);
await shot('10-results-fail');

// Ice/stone shards mid-flight (launch straight down-left so balls don't interfere).
await evaluate(`__game.configure({ level: 14, seed: 42, owned: { ball: 1 } }); __game.setAim(-3, 0.15); __game.launch(); __game.popKinds(['ice', 'stone']); __game.step(0.1)`);
await shot('12-shards');

// Small phone and landscape tablet to check fit.
await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
await evaluate(`__game.configure({ level: 12, seed: 5 }); __game.step(0.05)`);
await shot('11-small-phone');

console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors');
ws.close();
chrome.kill();
