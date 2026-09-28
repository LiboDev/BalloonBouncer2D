// Headless verification harness: runs the real game code in a stubbed DOM.
//   node scripts/sim.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function makeCtx() {
  const noop = () => grad;
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : noop),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}

function makeEl() {
  const el = {
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: {}, textContent: '', innerHTML: '', width: 0, height: 0,
    addEventListener() {}, setAttribute() {}, focus() {}, append() {},
    setPointerCapture() {}, querySelector: () => makeEl(), querySelectorAll: () => [],
    getContext: () => makeCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 720, height: 1280 }),
  };
  return el;
}

const els = {};
const context = {
  console, Math, JSON, Map, Set, Number, Array, Object, String, Promise, URLSearchParams, Proxy,
  location: { search: '?debug&capture' },
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  setTimeout: (fn) => { fn(); return 0; },
  localStorage: { getItem: () => null, setItem() {} },
  HTMLButtonElement: class {},
  document: {
    hidden: false,
    getElementById: (id) => (els[id] ||= makeEl()),
    createElement: () => makeEl(),
    addEventListener() {},
  },
  innerWidth: 390, innerHeight: 844, devicePixelRatio: 1,
  addEventListener() {},
};
context.window = context;
vm.createContext(context);
for (const f of ['src/platform.js', 'src/audio.js', 'src/game.js']) {
  vm.runInContext(readFileSync(root + f, 'utf8'), context, { filename: f });
}
await new Promise((r) => setImmediate(r)); // let boot() finish loading
const g = context.__game;

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

// 1. Determinism: same level + seed -> same map, including after a failed attempt.
{
  g.configure({ level: 7, seed: 1234, owned: { ball: 1 } });
  const a = g.summary().layout;
  g.setAim(-Math.PI / 2, 0.2);
  g.launch();
  for (let i = 0; i < 400 && g.state === 'play'; i++) g.step(0.1);
  const failed = g.state === 'results' && g.stats.popped < g.stats.total;
  g.start();
  const b = g.summary().layout;
  check(failed && g.level === 7, 'failed attempt keeps player on level 7');
  check(a === b, 'retry regenerates identical layout');
  g.configure({ level: 8, seed: 1234 });
  check(g.summary().layout !== a, 'different level -> different layout');
  g.configure({ level: 7, seed: 999 });
  check(g.summary().layout !== a, 'different save seed -> different layout');
}

// 2. Balloon mix and obstacle counts per level.
console.log('\nlvl  total  mix                                         obstacles');
for (let lvl = 1; lvl <= 26; lvl++) {
  let bad = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    g.configure({ level: lvl, seed });
    const { types, obstacles } = g.summary();
    const field = (obstacles.platform || 0) + (obstacles.wall || 0) + (obstacles.bumper || 0);
    const has = (t) => (types[t] || 0) > 0;
    if (lvl <= 3 && Object.keys(types).some((t) => t !== 'basic')) bad.push('non-basic early');
    if (lvl >= 4 && lvl <= 10 && (has('iron') || has('stone') || has('obsidian'))) bad.push('heavy too early');
    if (lvl >= 4 && lvl <= 10 && (types.basic || 0) <= (types.ice || 0) + (types.fire || 0)) bad.push('not mostly basic');
    if (lvl < 20 && has('obsidian')) bad.push('obsidian before 20');
    if (lvl >= 11 && !(has('iron') && has('stone'))) bad.push('missing metal/stone');
    if (lvl >= 20 && !has('obsidian')) bad.push('missing obsidian');
    if (field < 4 || field > 6 || !obstacles.platform || !obstacles.wall || !obstacles.bumper) bad.push('obstacles ' + JSON.stringify(obstacles));
    if (seed === 1) {
      const total = Object.values(types).reduce((s, n) => s + n, 0);
      const mix = Object.entries(types).map(([k, v]) => `${k}:${v}`).join(' ');
      console.log(`${String(lvl).padStart(3)}  ${String(total).padStart(5)}  ${mix.padEnd(44)}${field} (p${obstacles.platform} w${obstacles.wall} b${obstacles.bumper})`);
    }
  }
  if (bad.length) check(false, `level ${lvl}: ${[...new Set(bad)].join(', ')}`);
}
check(true, 'balloon mix rules checked for levels 1-26 x 5 seeds (failures listed above if any)');

// 3. Shop cap and prices.
{
  g.configure({ level: 1, money: 1_000_000, owned: { ball: 0 } });
  for (let i = 0; i < 15; i++) g.buy('rubber');
  const s = g.save;
  check(s.owned.rubber === 10, `rubber capped at 10 (got ${s.owned.rubber})`);
  check(s.money === 1_000_000 - 100, `rubber costs 10 each (spent ${1_000_000 - s.money})`);
  for (const [k, price] of [['ball', 5], ['saw', 25], ['fireball', 100], ['lightning', 500], ['blackhole', 1000]]) {
    const before = g.save.money;
    g.buy(k);
    check(before - g.save.money === price, `${k} costs ${price}`);
  }
}

// 4. Clear rates: full clear required. Random aims, typical loadouts.
function trial(level, owned, seed, angle, power) {
  g.configure({ level, seed, owned });
  g.setAim(angle ?? -Math.PI / 2 + (Math.random() - 0.5) * 1.6, power ?? 0.55 + Math.random() * 0.45);
  g.launch();
  for (let i = 0; i < 600 && g.state === 'play'; i++) g.step(0.1);
  const { popped, total } = g.stats;
  return { won: g.level !== level || popped >= total, frac: popped / total };
}
// Early levels: can a deliberate shot clear them? Sweep aim angles (3 tries each).
console.log('\nEarly-level aim sweep (starting 3 balls): angles with at least one clear out of 3 tries');
for (let level = 1; level <= 3; level++) {
  for (const seed of [42, 7, 99]) {
    let good = 0;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI + 0.3 + (i / (n - 1)) * (Math.PI - 0.6);
      let ok = false;
      for (let k = 0; k < 3 && !ok; k++) ok = trial(level, { ball: 3 }, seed, a, 0.85).won;
      good += ok;
    }
    console.log(`  L${level} seed ${seed}: ${good}/${n} angles`);
  }
}
console.log('\nClear rate (20 random shots each)');
const loadouts = [
  [1, { ball: 3 }], [1, { ball: 5 }], [3, { ball: 4 }], [5, { ball: 6 }], [5, { ball: 8 }], [8, { ball: 10, rubber: 2 }],
  [10, { ball: 10, rubber: 5 }], [12, { ball: 10, rubber: 10, saw: 3 }],
  [16, { ball: 10, rubber: 10, saw: 8, fireball: 5 }], [20, { ball: 10, rubber: 10, saw: 10, fireball: 10, lightning: 3 }],
  [25, { ball: 10, rubber: 10, saw: 10, fireball: 10, lightning: 10, blackhole: 2 }],
];
for (const [level, owned] of loadouts) {
  let wins = 0, frac = 0;
  const N = 20;
  for (let i = 0; i < N; i++) {
    const r = trial(level, owned, 42);
    wins += r.won; frac += r.frac;
  }
  console.log(`  L${String(level).padEnd(3)} ${JSON.stringify(owned).padEnd(80)} win ${String(Math.round((wins / N) * 100)).padStart(3)}%  avg popped ${Math.round((frac / N) * 100)}%`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
