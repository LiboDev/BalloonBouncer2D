(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const TAU = Math.PI * 2;
  // 9:16 portrait world so the game fills phone screens with little letterboxing.
  const W = 720;
  const H = 1280;
  const G = 950;                 // gravity px/s^2
  const DT = 1 / 120;            // fixed physics step
  const MIN_BOUNCE = 640;        // every bounce leaves at least this fast
  const MAX_SPEED = 1500;
  const MIN_NORMAL_FRAC = 0.32;  // bounce always has a real "away" component (no sliding)
  const BALL_LIFETIME = 18;      // seconds before a ball fizzles out
  const LAUNCH = { x: W / 2, y: H - 110 };
  const LAUNCH_MIN = 750;
  const LAUNCH_MAX = 1500;
  const DRAG_FULL = 240;         // drag distance for full power
  const BALL_CAP = 10;           // max owned per ball type
  const LIGHTNING_CHAIN = 3;     // extra balloons zapped per lightning hit
  const LIGHTNING_RANGE = 230;
  const BUMPER_BOOST = 1.18;
  const SAVE_VERSION = 1;
  const captureParams = new URLSearchParams(location.search);
  const promoDebug = !Platform.inPlayables && captureParams.has('debug');
  const manualCapture = promoDebug && captureParams.has('capture');

  // speed: launch-speed multiplier. bounce: per-bounce speed gain. minB/maxS: bounce speed floor/ceiling.
  const BALL_TYPES = {
    ball:      { name: 'Ball',          dmg: 1,    price: 10,    r: 11, desc: '1 damage per hit', trail: '160,180,255' },
    rubber:    { name: 'Rubber Ball',   dmg: 1,    price: 25,    r: 7,  desc: 'Tiny, super fast and extra bouncy', trail: '255,90,200',
                 speed: 1.35, bounce: 1.1, minB: 950, maxS: 2200 },
    saw:       { name: 'Saw Blade',     dmg: 5,    price: 100,   r: 13, desc: '5 damage per hit', trail: '210,215,225' },
    fireball:  { name: 'Fireball',      dmg: 5,    price: 100,   r: 13, desc: '5 damage + fiery blast on every pop', trail: '255,140,0' },
    lightning: { name: 'Lightning Orb', dmg: 25,   price: 1000,  r: 14, desc: '25 damage, chains to 3 nearby balloons', trail: '120,230,255' },
    blackhole: { name: 'Black Hole',    dmg: 1000, price: 10000, r: 24, desc: '1,000 damage, eats through balloons', trail: '150,90,255' },
  };
  const BALL_ORDER = ['ball', 'rubber', 'saw', 'fireball', 'lightning', 'blackhole'];

  const BALLOON_TYPES = {
    basic:    { name: 'Balloon',          hp: 1,   r: 24 },
    fire:     { name: 'Fire Balloon',     hp: 1,   r: 25 },
    ice:      { name: 'Ice Balloon',      hp: 3,   r: 26 },
    iron:     { name: 'Metal Balloon',    hp: 5,   r: 27 },
    stone:    { name: 'Stone Balloon',    hp: 10,  r: 29 },
    obsidian: { name: 'Obsidian Balloon', hp: 100, r: 35 },
  };
  const BASIC_COLORS = ['#ff4d6d', '#ffb703', '#3a86ff', '#ff66c4', '#2ec4b6', '#8f5cff'];
  const IRON_TILES = 10;

  const WIN_LINES = [
    'Amazing job!', 'Pop-tastic!', 'You nailed it!', 'Brilliant bouncing!', 'What a shot!',
    'Unstoppable!', 'Balloon master!', 'Total clear!', 'You\'re on fire!', 'Spectacular!',
    'Flawless!', 'Keep it up!', 'Legendary fling!', 'Wow, just wow!',
  ];
  const WIN_SUBS = [
    'Every last balloon popped.', 'The sky is spotless.', 'Not a single balloon survived.',
    'That was a chain reaction to remember.', 'Your aim keeps getting better.',
  ];
  const FAIL_LINES = ['So close!', 'Almost there!', 'Don\'t give up!', 'You\'ve got this!', 'Nice try!', 'One more go!'];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  // `rnd` is swapped for a seeded generator during level generation so that
  // retrying a level rebuilds exactly the same layout.
  let rnd = Math.random;
  const rand = (a, b) => a + rnd() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const fmt = (n) => Math.floor(n).toLocaleString('en-US');

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function levelSeed(level) {
    let h = (save.seed ^ Math.imul(level, 0x9e3779b1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt > 0 ? 255 : 0;
    const k = Math.abs(amt);
    r = Math.round(r + (t - r) * k);
    g = Math.round(g + (t - g) * k);
    b = Math.round(b + (t - b) * k);
    return `rgb(${r},${g},${b})`;
  }

  function closestOnSeg(px, py, p) {
    const dx = p.x2 - p.x1, dy = p.y2 - p.y1;
    const t = clamp(((px - p.x1) * dx + (py - p.y1) * dy) / (dx * dx + dy * dy), 0, 1);
    return { x: p.x1 + dx * t, y: p.y1 + dy * t };
  }

  function weightedPick(weights) {
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = rnd() * total;
    for (const k in weights) {
      r -= weights[k];
      if (r <= 0) return k;
    }
    return Object.keys(weights)[0];
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    hud: $('hud'), money: $('hud-money'), settingsBtn: $('btn-settings'), hint: $('hint'),
    settings: $('overlay-settings'), setLevel: $('settings-level'),
    speed: $('btn-speed'), sound: $('btn-sound'), resume: $('btn-resume'),
    title: $('overlay-title'), results: $('overlay-results'), shop: $('overlay-shop'),
    play: $('btn-play'), toShop: $('btn-to-shop'), next: $('btn-next'),
    resTitle: $('res-title'), resSub: $('res-sub'), resEarned: $('res-earned'),
    shopMoney: $('shop-money'), shopList: $('shop-list'),
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const save = {
    version: SAVE_VERSION,
    seed: (Math.random() * 0x7fffffff) >>> 0,
    money: 0,
    level: 1,
    owned: { ball: 3, rubber: 0, saw: 0, fireball: 0, lightning: 0, blackhole: 0 },
    speed: 1,
    muted: false,
  };

  let mode = 'title'; // title | aim | play | results | shop
  let settingsOpen = false;
  let currentLevel = 1;
  let balloons = [], platforms = [], bumpers = [], balls = [], shards = [], particles = [], explosions = [];
  let launchQueue = [], launchClock = 0;
  let stats = { total: 0, popped: 0, earned: 0 };
  const aim = { angle: -Math.PI / 2 - 0.25, power: 0.75 };
  let drag = null;
  let simTime = 0, shake = 0, endTimer = 0;
  let paused = false, hudDirty = true;
  let renderScale = 1;
  let nextId = 1;

  // ---------------------------------------------------------------------------
  // Save / load
  // ---------------------------------------------------------------------------
  function persist() {
    Platform.save(save);
  }

  function applyLoaded(data) {
    if (!data || data.version !== SAVE_VERSION) return;
    if (Number.isFinite(data.money) && data.money >= 0) save.money = data.money;
    if (Number.isInteger(data.level) && data.level >= 1) save.level = data.level;
    if (Number.isInteger(data.seed) && data.seed >= 0) save.seed = data.seed >>> 0;
    if ([1, 2, 3].includes(data.speed)) save.speed = data.speed;
    save.muted = !!data.muted;
    if (data.owned) {
      for (const k of BALL_ORDER) {
        const v = data.owned[k];
        if (Number.isInteger(v) && v >= 0) save.owned[k] = Math.min(v, BALL_CAP);
      }
    }
    if (totalBalls() === 0) save.owned.ball = 1;
  }

  function totalBalls() {
    return BALL_ORDER.reduce((s, k) => s + save.owned[k], 0);
  }

  // ---------------------------------------------------------------------------
  // Level generation
  // ---------------------------------------------------------------------------
  function makeCracks(n) {
    const cracks = [];
    for (let i = 0; i < n; i++) {
      let a = (i / n) * TAU + rand(-0.4, 0.4);
      let rr = rand(0, 0.2);
      const pts = [[Math.cos(a) * rr, Math.sin(a) * rr]];
      let x = pts[0][0], y = pts[0][1];
      const steps = randInt(3, 5);
      let branch = null;
      for (let s = 0; s < steps; s++) {
        a += rand(-0.6, 0.6);
        const len = rand(0.18, 0.32);
        x += Math.cos(a) * len;
        y += Math.sin(a) * len;
        pts.push([x, y]);
        if (s === 1 && !branch) {
          const ba = a + (rnd() < 0.5 ? 0.9 : -0.9);
          branch = [[x, y], [x + Math.cos(ba) * 0.25, y + Math.sin(ba) * 0.25]];
        }
      }
      cracks.push({ pts, branch });
    }
    return cracks;
  }

  function makeBalloon(type, x, y) {
    const t = BALLOON_TYPES[type];
    const b = {
      id: nextId++, type, x, y, baseY: y, r: t.r, hp: t.hp, maxHp: t.hp,
      alive: true, flash: 0, squash: 0, phase: rand(0, TAU),
      color: type === 'basic' ? pick(BASIC_COLORS) : '#e63946',
    };
    if (type === 'ice') b.cracks = makeCracks(6);
    if (type === 'stone') {
      b.cracks = makeCracks(10);
      b.speckles = [];
      for (let i = 0; i < 16; i++) {
        const a = rand(0, TAU), d = Math.sqrt(rnd()) * 0.85;
        b.speckles.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: rand(0.04, 0.1), light: rnd() < 0.5 });
      }
    }
    if (type === 'obsidian') {
      b.cracks = makeCracks(14);
      b.facets = [];
      for (let i = 0; i < 4; i++) {
        const a = rand(0, TAU);
        b.facets.push([a, a + rand(0.6, 1.2), rand(0.3, 0.7)]);
      }
    }
    if (type === 'iron') {
      const order = shuffle([...Array(IRON_TILES).keys()]);
      b.rank = [];
      order.forEach((tile, rank) => { b.rank[tile] = rank; });
    }
    return b;
  }

  function generateLevel(level) {
    // Seeded so that a retry rebuilds exactly the same map.
    rnd = mulberry32(levelSeed(level));
    try {
      buildObstacles();
      placeBalloons(levelMix(level));
    } finally {
      rnd = Math.random;
    }
    stats = { total: balloons.length, popped: 0, earned: 0 };
  }

  // Balloon roster by level tier:
  //   1-3   a handful of basic balloons
  //   4-10  lots of basic plus a few ice and fire
  //   11-19 more balloons, adding metal (iron) and stone
  //   20+   obsidian joins the mix
  function levelMix(level) {
    const types = [];
    const add = (type, n) => { for (let i = 0; i < n; i++) types.push(type); };

    if (level <= 3) {
      add('basic', [4, 5, 7][level - 1]);
    } else if (level <= 10) {
      const count = 12 + (level - 4) * 2;           // 12..24
      const specials = 2 + Math.floor((level - 4) / 2); // 2..5
      add('ice', 1);
      add('fire', 1);
      for (let i = 2; i < specials; i++) types.push(rnd() < 0.5 ? 'ice' : 'fire');
      add('basic', count - specials);
    } else {
      const late = level >= 20;
      const count = late ? Math.min(42 + Math.floor((level - 20) / 2), 48) : Math.min(24 + (level - 10) * 2, 42);
      const t = late ? 1 : (level - 11) / 8;
      const obsidian = late ? Math.min(1 + Math.floor((level - 20) / 3), 5) : 0;
      const heavy = Math.round(count * (late ? Math.min(0.3 + (level - 20) * 0.01, 0.4) : 0.1 + 0.2 * t));
      const mid = Math.round(count * (0.2 + 0.06 * t));
      add('obsidian', obsidian);
      // Guarantee at least one of each heavy type so the new balloons are obvious.
      add('iron', 1);
      add('stone', 1);
      for (let i = 2; i < heavy; i++) types.push(weightedPick({ iron: 1.2 - 0.4 * t, stone: 0.6 + 0.4 * t }));
      for (let i = 0; i < mid; i++) types.push(rnd() < 0.5 ? 'ice' : 'fire');
      add('basic', Math.max(0, count - types.length));
    }
    return types;
  }

  function segObstacle(kind, cx, cy, len, ang, t) {
    const hx = (Math.cos(ang) * len) / 2, hy = (Math.sin(ang) * len) / 2;
    return { kind, x1: cx - hx, y1: cy - hy, x2: cx + hx, y2: cy + hy, t, cx, cy, flash: 0 };
  }

  function inLaunchLane(x0, y0, x1, y1) {
    return y1 > H - 620 && x0 < LAUNCH.x + 120 && x1 > LAUNCH.x - 120;
  }

  function buildObstacles() {
    platforms = [];
    bumpers = [];

    // ~5 obstacles per map: always at least one platform, wall and bumper.
    const n = randInt(4, 6);
    const kinds = ['platform', 'wall', 'bumper'];
    while (kinds.length < n) kinds.push(weightedPick({ platform: 1, wall: 0.7, bumper: 1 }));
    shuffle(kinds);

    const centers = [];
    for (const kind of kinds) {
      for (let tries = 0; tries < 200; tries++) {
        let o, box;
        if (kind === 'bumper') {
          const r = rand(26, 34);
          const cx = rand(70 + r, W - 70 - r), cy = rand(210, H - 480);
          o = { cx, cy, r, flash: 0, pulse: 0 };
          box = [cx - r, cy - r, cx + r, cy + r];
        } else if (kind === 'wall') {
          const len = rand(130, 190);
          o = segObstacle('wall', rand(110, W - 110), rand(230, H - 520), len, Math.PI / 2 + rand(-0.18, 0.18), 22);
        } else {
          const len = rand(120, 180);
          const ang = rnd() < 0.7 ? rand(-0.4, 0.4) : rand(-0.8, 0.8);
          o = segObstacle('platform', rand(90, W - 90), rand(210, H - 500), len, ang, 18);
        }
        if (!box) {
          if (Math.min(o.x1, o.x2) < 30 || Math.max(o.x1, o.x2) > W - 30) continue;
          box = [Math.min(o.x1, o.x2), Math.min(o.y1, o.y2), Math.max(o.x1, o.x2), Math.max(o.y1, o.y2)];
        }
        if (centers.some(([x, y]) => Math.hypot(x - o.cx, y - o.cy) < 175)) continue;
        if (inLaunchLane(box[0], box[1], box[2], box[3])) continue;
        centers.push([o.cx, o.cy]);
        (kind === 'bumper' ? bumpers : platforms).push(o);
        break;
      }
    }

    // Low side ledges catch falling balls and bounce them back into the field.
    // The middle stays open so balls can still fall off the map.
    for (const side of [-1, 1]) {
      const len = rand(150, 185);
      const y = rand(H - 270, H - 215);
      const tilt = rand(20, 45); // inner end lower -> bounces lean toward the center
      const outer = side < 0 ? rand(15, 40) : W - rand(15, 40);
      const inner = outer - side * len;
      const p = side < 0
        ? { x1: outer, y1: y - tilt / 2, x2: inner, y2: y + tilt / 2 }
        : { x1: inner, y1: y + tilt / 2, x2: outer, y2: y - tilt / 2 };
      Object.assign(p, { kind: 'ledge', t: 18, cx: (p.x1 + p.x2) / 2, cy: y, flash: 0 });
      platforms.push(p);
    }
  }

  function placeBalloons(types) {
    balloons = [];
    types.sort((a, b) => BALLOON_TYPES[b].r - BALLOON_TYPES[a].r); // place big ones first
    for (const type of types) {
      const r = BALLOON_TYPES[type].r;
      for (let k = 0; k < 300; k++) {
        const x = rand(r + 18, W - r - 18);
        const y = rand(125 + r, H - 430);
        if (balloons.some((o) => Math.hypot(o.x - x, o.baseY - y) < o.r + r + 12)) continue;
        if (platforms.some((p) => {
          const c = closestOnSeg(x, y, p);
          return Math.hypot(c.x - x, c.y - y) < r + p.t / 2 + 16;
        })) continue;
        if (bumpers.some((q) => Math.hypot(q.cx - x, q.cy - y) < r + q.r + 18)) continue;
        balloons.push(makeBalloon(type, x, y));
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Particles / FX
  // ---------------------------------------------------------------------------
  function addP(o) {
    if (particles.length > 1800) return;
    particles.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0.6, size: 4, color: '#fff',
      kind: 'dot', g: 0, drag: 0, rot: 0, vr: 0,
    }, o));
  }

  function burst(x, y, n, opts) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(opts.speed[0], opts.speed[1]);
      addP({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (opts.up || 0),
        kind: opts.kind || 'dot', color: Array.isArray(opts.color) ? pick(opts.color) : opts.color,
        size: rand(opts.size[0], opts.size[1]), max: rand(opts.life[0], opts.life[1]),
        g: opts.g || 0, drag: opts.drag || 0, rot: rand(0, TAU), vr: rand(-15, 15),
      });
    }
  }

  function addText(x, y, text, color = '#ffd23f', size = 34) {
    addP({ x, y, vy: -120, drag: 2.5, kind: 'text', text, color, size, max: 1.1 });
  }

  function popRing(x, y, r, color = '#fff') {
    addP({ x, y, kind: 'ring', size: r * 1.8, color, max: 0.3 });
  }

  function bolt(x1, y1, x2, y2, width = 3, life = 0.22) {
    const pts = [[x1, y1]];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const segs = Math.max(4, Math.round(len / 22));
    const jit = Math.min(16, 4 + len * 0.06);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      pts.push([lerp(x1, x2, t) + rand(-jit, jit), lerp(y1, y2, t) + rand(-jit, jit)]);
    }
    pts.push([x2, y2]);
    addP({ kind: 'bolt', pts, max: life, size: width, color: '#c8faff' });
  }

  // Flames licking off a fireball whenever it touches something.
  function fireSplash(x, y, nx, ny, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(ny, nx) + rand(-1.2, 1.2);
      const sp = rand(90, 300);
      addP({
        x: x + rand(-4, 4), y: y + rand(-4, 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        kind: 'flame', color: pick(['#fff3b0', '#ffd166', '#ff8a00', '#ff5400']),
        size: rand(4, 8), max: rand(0.25, 0.5), drag: 3, g: -220,
      });
    }
  }

  function addShake(v) {
    shake = Math.max(shake, v);
  }

  // ---------------------------------------------------------------------------
  // Damage / destruction
  // ---------------------------------------------------------------------------
  function ironTiles(b) {
    return Math.ceil((Math.max(0, b.hp) / b.maxHp) * IRON_TILES);
  }

  function throwIronTile(b, tile) {
    const a = ((tile + 0.5) / IRON_TILES) * TAU;
    addP({
      x: b.x + Math.cos(a) * b.r * 0.76, y: b.y + Math.sin(a) * b.r * 0.84,
      vx: Math.cos(a) * rand(120, 260), vy: Math.sin(a) * rand(120, 260) - 180,
      kind: 'plate', color: '#9aa5b1', size: b.r * 0.42, g: G, max: 1.4, rot: a, vr: rand(-10, 10),
    });
  }

  function damageBalloon(b, dmg) {
    if (!b.alive) return false;
    const prevTiles = b.type === 'iron' ? ironTiles(b) : 0;
    b.hp -= dmg;
    b.flash = 1;
    b.squash = 1;
    if (b.hp <= 0) {
      popBalloon(b, prevTiles);
      return true;
    }
    hitFx(b, prevTiles);
    return false;
  }

  function hitFx(b, prevTiles) {
    switch (b.type) {
      case 'iron': {
        const removedBefore = IRON_TILES - prevTiles;
        const removedNow = IRON_TILES - ironTiles(b);
        for (let tile = 0; tile < IRON_TILES; tile++) {
          if (b.rank[tile] >= removedBefore && b.rank[tile] < removedNow) throwIronTile(b, tile);
        }
        burst(b.x, b.y, 8, { speed: [200, 420], color: ['#fff3b0', '#ffd166'], size: [2, 4], life: [0.15, 0.3] });
        Sfx.clink();
        break;
      }
      case 'ice':
        burst(b.x, b.y, 8, { kind: 'chip', speed: [80, 220], color: ['#e8fbff', '#aeeaff'], size: [4, 7], life: [0.4, 0.7], g: G * 0.6 });
        Sfx.crack();
        break;
      case 'stone':
        burst(b.x, b.y, 7, { kind: 'chip', speed: [60, 180], color: ['#a8a29e', '#78716c'], size: [4, 8], life: [0.4, 0.8], g: G * 0.8 });
        burst(b.x, b.y, 4, { kind: 'smoke', speed: [20, 60], color: '#d6d3d1', size: [10, 16], life: [0.4, 0.7] });
        Sfx.thud();
        break;
      case 'obsidian':
        burst(b.x, b.y, 6, { speed: [150, 350], color: ['#ff4fd8', '#b388ff'], size: [2, 4], life: [0.2, 0.4] });
        Sfx.clink();
        break;
      default:
        break;
    }
  }

  function popBalloon(b, prevTiles) {
    b.alive = false;
    stats.popped++;
    stats.earned += b.maxHp;
    save.money += b.maxHp;
    hudDirty = true;
    addText(b.x, b.y - b.r, '+' + b.maxHp, '#ffd23f', b.maxHp >= 100 ? 52 : 34);

    switch (b.type) {
      case 'basic':
        popRing(b.x, b.y, b.r);
        burst(b.x, b.y, 14, { kind: 'scrap', speed: [150, 380], color: [b.color, shade(b.color, 0.4)], size: [6, 11], life: [0.5, 0.9], g: G * 0.5, drag: 1.5 });
        Sfx.pop();
        break;

      case 'fire':
        burst(b.x, b.y, 10, { kind: 'scrap', speed: [150, 380], color: ['#ff8a00', '#b8141f'], size: [6, 11], life: [0.5, 0.9], g: G * 0.5, drag: 1.5 });
        queueExplosion(b.x, b.y, 120, 3, 0.07, true);
        Sfx.pop();
        break;

      case 'ice':
        popRing(b.x, b.y, b.r, '#dff8ff');
        spawnShards(b, 6, 'ice');
        burst(b.x, b.y, 14, { kind: 'chip', speed: [100, 320], color: ['#ffffff', '#aeeaff', '#6cc7f0'], size: [4, 8], life: [0.4, 0.8], g: G * 0.5 });
        burst(b.x, b.y, 6, { kind: 'smoke', speed: [30, 80], color: '#e8fbff', size: [12, 20], life: [0.4, 0.7] });
        Sfx.shatter();
        break;

      case 'stone':
        popRing(b.x, b.y, b.r, '#e7e5e4');
        spawnShards(b, 8, 'stone');
        burst(b.x, b.y, 16, { kind: 'chip', speed: [80, 300], color: ['#a8a29e', '#78716c', '#57534e'], size: [5, 10], life: [0.5, 1], g: G * 0.8 });
        burst(b.x, b.y, 8, { kind: 'smoke', speed: [30, 90], color: '#d6d3d1', size: [16, 26], life: [0.5, 0.9] });
        addShake(6);
        Sfx.crumble();
        break;

      case 'iron': {
        const removed = IRON_TILES - prevTiles;
        for (let tile = 0; tile < IRON_TILES; tile++) if (b.rank[tile] >= removed) throwIronTile(b, tile);
        addP({ x: b.x, y: b.y, vx: rand(-80, 80), vy: -220, kind: 'plate', color: '#7d8894', size: b.r * 0.8, g: G, max: 1.4, vr: rand(-8, 8) });
        popRing(b.x, b.y, b.r);
        burst(b.x, b.y, 10, { kind: 'scrap', speed: [150, 350], color: ['#e63946', '#ff8fa3'], size: [6, 10], life: [0.5, 0.9], g: G * 0.5, drag: 1.5 });
        burst(b.x, b.y, 10, { speed: [250, 500], color: ['#fff3b0', '#ffd166'], size: [2, 4], life: [0.15, 0.35] });
        addShake(4);
        Sfx.clink();
        Sfx.pop();
        break;
      }

      case 'obsidian':
        popRing(b.x, b.y, b.r * 1.6, '#ff4fd8');
        addP({ x: b.x, y: b.y, kind: 'flash', size: b.r * 3, color: '#ff4fd8', max: 0.35 });
        burst(b.x, b.y, 30, { kind: 'chip', speed: [150, 520], color: ['#2a1440', '#6b3fa0', '#120a1c'], size: [6, 13], life: [0.6, 1.2], g: G * 0.7 });
        burst(b.x, b.y, 24, { kind: 'ember', speed: [200, 600], color: ['#ff4fd8', '#b388ff', '#ffffff'], size: [2, 5], life: [0.3, 0.7], drag: 2 });
        addShake(16);
        Sfx.boom(true);
        Sfx.shatter();
        break;
    }
  }

  function spawnShards(b, n, kind) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.25, 0.25);
      const sp = rand(450, 700);
      shards.push({
        x: b.x + Math.cos(a) * b.r * 0.5, y: b.y + Math.sin(a) * b.r * 0.5,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
        r: 6, rot: a, vr: rand(-14, 14), life: 0, kind, src: b.id, dead: false,
        size: kind === 'ice' ? 10 : 11,
      });
    }
  }

  function queueExplosion(x, y, r, dmg, delay, big, shakeAmt) {
    explosions.push({ x, y, r, dmg, t: delay, big, shake: shakeAmt ?? (big ? 12 : 4) });
  }

  function detonate(e) {
    const s = e.r;
    addP({ x: e.x, y: e.y, kind: 'flash', size: s, color: e.big ? '#ffb347' : '#ffd166', max: e.big ? 0.3 : 0.2 });
    addP({ x: e.x, y: e.y, kind: 'ring', size: s, color: '#fff3b0', max: e.big ? 0.35 : 0.22 });
    burst(e.x, e.y, e.big ? 22 : 8, { kind: 'ember', speed: [150, e.big ? 520 : 300], color: ['#ffd166', '#ff8a00', '#ff5400', '#fff3b0'], size: [2, 5], life: [0.3, 0.7], drag: 2.5, g: 200 });
    if (e.big) burst(e.x, e.y, 8, { kind: 'smoke', speed: [30, 110], color: '#6b5b73', size: [18, 30], life: [0.6, 1.1], up: -40 });
    addShake(e.shake);
    Sfx.boom(e.big);

    for (const bl of balloons) {
      if (!bl.alive) continue;
      if (Math.hypot(bl.x - e.x, bl.y - e.y) < e.r + bl.r) damageBalloon(bl, e.dmg);
    }
    for (const ball of balls) {
      const dx = ball.x - e.x, dy = ball.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < e.r && d > 0.01) {
        const push = e.big ? 420 : 200;
        ball.vx += (dx / d) * push;
        ball.vy += (dy / d) * push;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Physics
  // ---------------------------------------------------------------------------
  // Reflect off surface normal (nx, ny) and guarantee a lively exit:
  // minimum speed, a minimum normal component (no sliding/resting), plus jitter
  // so balls never settle into a perfect loop.
  function bounce(o, nx, ny) {
    let vn = o.vx * nx + o.vy * ny;
    if (vn < 0) {
      o.vx -= 2 * vn * nx;
      o.vy -= 2 * vn * ny;
    }
    const sp = Math.hypot(o.vx, o.vy);
    const target = clamp(sp * o.gain, o.minB, o.maxS);
    vn = o.vx * nx + o.vy * ny;
    let tx = o.vx - vn * nx, ty = o.vy - vn * ny;
    const tl = Math.hypot(tx, ty);
    const nMag = clamp(vn, target * MIN_NORMAL_FRAC, target);
    const tMag = Math.sqrt(Math.max(0, target * target - nMag * nMag));
    if (tl > 1e-6) {
      tx /= tl; ty /= tl;
    } else {
      tx = -ny; ty = nx;
      if (Math.random() < 0.5) { tx = -tx; ty = -ty; }
    }
    o.vx = nx * nMag + tx * tMag;
    o.vy = ny * nMag + ty * tMag;

    const a = rand(-0.07, 0.07), c = Math.cos(a), s = Math.sin(a);
    const jx = o.vx * c - o.vy * s, jy = o.vx * s + o.vy * c;
    if (jx * nx + jy * ny > 0) { o.vx = jx; o.vy = jy; }
  }

  function kick(b) {
    const a = -Math.PI / 2 + rand(-1, 1);
    const sp = b.minB * 1.3;
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp;
  }

  function spawnBall(type) {
    const def = BALL_TYPES[type];
    const a = aim.angle + rand(-0.05, 0.05);
    const sp = lerp(LAUNCH_MIN, LAUNCH_MAX, aim.power) * (def.speed || 1) * rand(0.95, 1.05);
    const muzzle = 60;
    balls.push({
      type, r: def.r, dmg: def.dmg,
      gain: def.bounce || 1, minB: def.minB || MIN_BOUNCE, maxS: def.maxS || MAX_SPEED,
      x: LAUNCH.x + Math.cos(aim.angle) * muzzle, y: LAUNCH.y + Math.sin(aim.angle) * muzzle,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0, rot: 0, hits: new Map(), trail: [], dead: false, flash: 0, fxT: -1,
      ax: LAUNCH.x, ay: LAUNCH.y, anchorT: simTime,
    });
    burst(LAUNCH.x + Math.cos(aim.angle) * muzzle, LAUNCH.y + Math.sin(aim.angle) * muzzle, 5,
      { kind: 'smoke', speed: [40, 120], color: '#ffffff', size: [8, 14], life: [0.25, 0.45] });
    Sfx.launch();
  }

  // Called for every contact a ball makes (border, obstacle, balloon).
  function touch(b, nx, ny) {
    if (b.type !== 'fireball' || simTime - b.fxT < 0.035) return;
    b.fxT = simTime;
    fireSplash(b.x - nx * b.r, b.y - ny * b.r, nx, ny);
    Sfx.sizzle();
  }

  function lightningChain(ball, bl) {
    const targets = [];
    for (const o of balloons) {
      if (!o.alive || o === bl) continue;
      const d = Math.hypot(o.x - bl.x, o.y - bl.y);
      if (d < LIGHTNING_RANGE) targets.push([d, o]);
    }
    targets.sort((a, b) => a[0] - b[0]);
    for (const [, o] of targets.slice(0, LIGHTNING_CHAIN)) {
      bolt(bl.x, bl.y, o.x, o.y, 3.5, 0.28);
      bolt(bl.x, bl.y, o.x, o.y, 1.5, 0.2);
      burst(o.x, o.y, 6, { kind: 'ember', speed: [120, 320], color: ['#c8faff', '#5ee7ff', '#ffffff'], size: [2, 4], life: [0.15, 0.3] });
      damageBalloon(o, ball.dmg);
    }
  }

  function hitBalloon(ball, bl) {
    const popped = damageBalloon(bl, ball.dmg);
    switch (ball.type) {
      case 'fireball':
        // Same fiery blast as a fire balloon, a bit smaller and weaker.
        if (popped) queueExplosion(bl.x, bl.y, 95, 1, 0, true, 6);
        break;
      case 'lightning':
        ball.flash = 1;
        addP({ x: ball.x, y: ball.y, kind: 'flash', size: ball.r * 4, color: '#9ff5ff', max: 0.18 });
        for (let i = 0; i < 3; i++) bolt(ball.x, ball.y, bl.x + rand(-bl.r, bl.r) * 0.6, bl.y + rand(-bl.r, bl.r) * 0.6, 3.5, 0.25);
        burst(bl.x, bl.y, 10, { kind: 'ember', speed: [150, 400], color: ['#c8faff', '#5ee7ff', '#ffffff'], size: [2, 4], life: [0.15, 0.3] });
        lightningChain(ball, bl);
        Sfx.zap();
        break;
      case 'saw':
        burst(ball.x, ball.y, 6, { speed: [200, 450], color: ['#fff3b0', '#ffffff'], size: [2, 3], life: [0.12, 0.25] });
        break;
      case 'blackhole':
        burst(bl.x, bl.y, 12, { kind: 'ember', speed: [60, 200], color: ['#b388ff', '#ff7ad9', '#ffffff'], size: [2, 4], life: [0.3, 0.5] });
        addP({ x: bl.x, y: bl.y, kind: 'ring', size: bl.r * 1.4, color: '#b388ff', max: 0.3 });
        break;
      case 'rubber':
        Sfx.boing();
        break;
    }
  }

  function collideSegment(b, p) {
    const c = closestOnSeg(b.x, b.y, p);
    let dx = b.x - c.x, dy = b.y - c.y;
    const rr = b.r + p.t / 2;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    let d = Math.sqrt(d2);
    if (d < 1e-4) { dx = 0; dy = -1; d = 1; }
    const nx = dx / d, ny = dy / d;
    b.x = c.x + nx * rr;
    b.y = c.y + ny * rr;
    bounce(b, nx, ny);
    touch(b, nx, ny);
    p.flash = 1;
    if (b.type === 'rubber') Sfx.boing(); else Sfx.bonk();
  }

  // Pinball-style bumper: bounces the ball away and boosts its speed.
  function collideBumper(b, q) {
    let dx = b.x - q.cx, dy = b.y - q.cy;
    const rr = b.r + q.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    let d = Math.sqrt(d2);
    if (d < 1e-4) { dx = 0; dy = -1; d = 1; }
    const nx = dx / d, ny = dy / d;
    b.x = q.cx + nx * rr;
    b.y = q.cy + ny * rr;
    bounce(b, nx, ny);
    const sp = Math.hypot(b.vx, b.vy);
    const boosted = clamp(sp * BUMPER_BOOST, 1150, Math.max(b.maxS, 1650));
    b.vx *= boosted / sp;
    b.vy *= boosted / sp;
    touch(b, nx, ny);
    q.flash = 1;
    q.pulse = 1;
    addP({ x: q.cx, y: q.cy, kind: 'ring', size: q.r * 1.7, color: '#fff3b0', max: 0.25 });
    burst(b.x - nx * b.r, b.y - ny * b.r, 6, { speed: [150, 350], color: ['#fff3b0', '#ffd166', '#ffffff'], size: [2, 4], life: [0.15, 0.3] });
    Sfx.boing();
  }

  function substepBall(b, dt) {
    b.vy += G * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Walls and ceiling (floor is open: fall off the map)
    if (b.x < b.r) { b.x = b.r; bounce(b, 1, 0); touch(b, 1, 0); }
    else if (b.x > W - b.r) { b.x = W - b.r; bounce(b, -1, 0); touch(b, -1, 0); }
    if (b.y < b.r) { b.y = b.r; bounce(b, 0, 1); touch(b, 0, 1); }

    for (const p of platforms) collideSegment(b, p);
    for (const q of bumpers) collideBumper(b, q);

    for (const bl of balloons) {
      if (!bl.alive) continue;
      const dx = b.x - bl.x, dy = b.y - bl.y;
      const rr = b.r + bl.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 1;
      const nx = d2 > 0 ? dx / d : 0, ny = d2 > 0 ? dy / d : -1;
      const lastHit = b.hits.get(bl.id);
      if (lastHit === undefined || simTime - lastHit > 0.1) {
        b.hits.set(bl.id, simTime);
        touch(b, nx, ny);
        hitBalloon(b, bl);
      }
      if (b.type !== 'blackhole') {
        b.x = bl.x + nx * rr;
        b.y = bl.y + ny * rr;
        bounce(b, nx, ny);
      }
    }
  }

  function stepBall(b, dt) {
    b.life += dt;
    // Substep fast balls so they can't tunnel through thin obstacles.
    const n = clamp(Math.ceil((Math.hypot(b.vx, b.vy) * dt) / (b.r * 0.5)), 1, 10);
    for (let i = 0; i < n; i++) substepBall(b, dt / n);

    // Anti-stuck: if a ball hasn't really moved in a while, launch it.
    if (simTime - b.anchorT > 0.9) {
      if (Math.hypot(b.x - b.ax, b.y - b.ay) < 30) kick(b);
      b.ax = b.x; b.ay = b.y; b.anchorT = simTime;
    }

    if (b.y > H + 60) b.dead = true;
    if (b.life > BALL_LIFETIME) {
      b.dead = true;
      burst(b.x, b.y, 10, { kind: 'smoke', speed: [40, 140], color: '#ffffff', size: [8, 14], life: [0.3, 0.6] });
    }
  }

  function stepShard(s, dt) {
    s.vy += G * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.rot += s.vr * dt;
    s.life += dt;

    const color = s.kind === 'ice' ? ['#e8fbff', '#aeeaff'] : ['#a8a29e', '#78716c'];
    const breakFx = () => burst(s.x, s.y, 4, { kind: 'chip', speed: [50, 150], color, size: [2, 4], life: [0.2, 0.4], g: G * 0.5 });

    if (s.x < s.r || s.x > W - s.r || s.y < s.r) { s.dead = true; breakFx(); return; }
    if (s.y > H + 40 || s.life > 3) { s.dead = true; return; }

    for (const p of platforms) {
      const c = closestOnSeg(s.x, s.y, p);
      if (Math.hypot(s.x - c.x, s.y - c.y) < s.r + p.t / 2) {
        s.dead = true; p.flash = 0.6; breakFx(); return;
      }
    }
    for (const q of bumpers) {
      if (Math.hypot(s.x - q.cx, s.y - q.cy) < s.r + q.r) {
        s.dead = true; q.flash = 0.6; breakFx(); return;
      }
    }
    for (const bl of balloons) {
      if (!bl.alive || bl.id === s.src) continue;
      if (Math.hypot(s.x - bl.x, s.y - bl.y) < s.r + bl.r) {
        s.dead = true;
        breakFx();
        damageBalloon(bl, 1);
        return;
      }
    }
  }

  function step(dt) {
    simTime += dt;

    for (const bl of balloons) {
      if (!bl.alive) continue;
      bl.y = bl.baseY + Math.sin(simTime * 1.6 + bl.phase) * 3;
    }

    if (mode !== 'play') return;

    launchClock += dt;
    while (launchQueue.length && launchQueue[0].t <= launchClock) spawnBall(launchQueue.shift().type);

    for (const b of balls) stepBall(b, dt);
    for (let i = 0; i < shards.length; i++) stepShard(shards[i], dt);

    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i];
      e.t -= dt;
      if (e.t <= 0) {
        explosions.splice(i, 1);
        detonate(e);
      }
    }

    balls = balls.filter((b) => !b.dead);
    shards = shards.filter((s) => !s.dead);

    // End-of-level detection
    const allPopped = stats.popped >= stats.total;
    const active = balls.length || launchQueue.length || shards.length || explosions.length;
    if (allPopped || !active) {
      endTimer += dt;
      if (endTimer > (allPopped ? 1.2 : 0.8)) finishLevel();
    } else {
      endTimer = 0;
    }
  }

  function updateFx(dt) {
    for (const p of particles) {
      p.life += dt;
      p.vy += p.g * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k; p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    particles = particles.filter((p) => p.life < p.max);

    for (const bl of balloons) {
      bl.flash = Math.max(0, bl.flash - dt * 6);
      bl.squash = Math.max(0, bl.squash - dt * 7);
      if (bl.alive && bl.type === 'fire' && Math.random() < dt * 6) {
        addP({ x: bl.x + rand(-8, 8), y: bl.y - bl.r * 0.9, vx: rand(-20, 20), vy: rand(-90, -50), kind: 'ember', color: pick(['#ffd166', '#ff8a00']), size: rand(2, 3.5), max: rand(0.4, 0.7) });
      }
    }
    for (const p of platforms) p.flash = Math.max(0, p.flash - dt * 5);
    for (const q of bumpers) {
      q.flash = Math.max(0, q.flash - dt * 5);
      q.pulse = Math.max(0, q.pulse - dt * 6);
    }

    for (const b of balls) {
      b.rot += dt * (b.type === 'saw' ? 24 : b.type === 'blackhole' ? 5 : 3);
      b.flash = Math.max(0, b.flash - dt * 5);
      b.trail.push([b.x, b.y]);
      if (b.trail.length > 9) b.trail.shift();
      if (b.type === 'fireball' && Math.random() < dt * 40) {
        addP({ x: b.x + rand(-5, 5), y: b.y + rand(-5, 5), vx: -b.vx * 0.1, vy: -b.vy * 0.1 - 30, kind: 'ember', color: pick(['#ffd166', '#ff8a00', '#ff5400']), size: rand(2, 4.5), max: rand(0.25, 0.5) });
      }
      if (b.type === 'blackhole' && Math.random() < dt * 30) {
        // Matter spiralling into the event horizon.
        const a = rand(0, TAU), d = b.r * rand(2.2, 3.2);
        const inward = rand(90, 150);
        addP({
          x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d,
          vx: b.vx - Math.cos(a) * inward - Math.sin(a) * inward * 1.3,
          vy: b.vy - Math.sin(a) * inward + Math.cos(a) * inward * 1.3,
          kind: 'ember', color: pick(['#b388ff', '#ff7ad9', '#8c5cff', '#ffffff']), size: rand(1.5, 3), max: d / 300,
        });
      }
    }

    shake *= Math.exp(-10 * dt);
    if (shake < 0.1) shake = 0;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  const bgCanvas = document.createElement('canvas');
  function buildBackground() {
    bgCanvas.width = W;
    bgCanvas.height = H;
    const c = bgCanvas.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7fd0ff');
    g.addColorStop(0.6, '#b9c6ff');
    g.addColorStop(1, '#d6b8ff');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    c.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 7; i++) {
      const cx = rand(0, W), cy = rand(80, H - 300), s = rand(40, 80);
      for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.arc(cx + (k - 2) * s * 0.7, cy + Math.sin(k * 1.7) * s * 0.2, s * rand(0.5, 0.8), 0, TAU);
        c.fill();
      }
    }

    // Fall zone at the bottom
    const pit = c.createLinearGradient(0, H - 90, 0, H);
    pit.addColorStop(0, 'rgba(40,20,80,0)');
    pit.addColorStop(1, 'rgba(40,20,80,0.55)');
    c.fillStyle = pit;
    c.fillRect(0, H - 90, W, 90);
  }

  function drawPlatform(c, p) {
    c.lineCap = 'round';
    if (p.kind === 'wall') {
      // Chunky stone wall with brick seams.
      const len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
      const ang = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
      c.save();
      c.translate(p.cx, p.cy);
      c.rotate(ang);
      const hl = len / 2 + p.t / 2, ht = p.t / 2;
      c.fillStyle = '#2a2233';
      c.beginPath(); c.roundRect(-hl - 3, -ht - 3, hl * 2 + 6, ht * 2 + 6, 8); c.fill();
      const g = c.createLinearGradient(0, -ht, 0, ht);
      const base = p.flash > 0 ? shade('#8a7f96', p.flash * 0.45) : '#8a7f96';
      g.addColorStop(0, base); g.addColorStop(1, '#5a5066');
      c.fillStyle = g;
      c.beginPath(); c.roundRect(-hl, -ht, hl * 2, ht * 2, 6); c.fill();
      c.strokeStyle = 'rgba(30,20,40,0.55)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-hl + 4, 0); c.lineTo(hl - 4, 0);
      const brick = 34;
      for (let x = -hl + brick; x < hl - 6; x += brick) {
        c.moveTo(x, -ht + 2); c.lineTo(x, 0);
        c.moveTo(x - brick / 2, 0); c.lineTo(x - brick / 2, ht - 2);
      }
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(-hl + 5, -ht + 2, hl * 2 - 10, 3);
      c.restore();
      return;
    }
    c.strokeStyle = '#232a4a';
    c.lineWidth = p.t + 6;
    c.beginPath(); c.moveTo(p.x1, p.y1); c.lineTo(p.x2, p.y2); c.stroke();
    c.strokeStyle = p.flash > 0 ? shade('#4f5fa8', p.flash * 0.5) : '#4f5fa8';
    c.lineWidth = p.t;
    c.stroke();
    // top highlight
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(p.x1, p.y1 - p.t * 0.2); c.lineTo(p.x2, p.y2 - p.t * 0.2); c.stroke();
  }

  // Pinball bumper: bright ring and star cap that pulses when struck.
  function drawBumper(c, q, t) {
    const s = 1 + 0.18 * q.pulse;
    const r = q.r * s;
    c.save();
    c.translate(q.cx, q.cy);
    if (q.flash > 0) {
      c.globalCompositeOperation = 'lighter';
      const glow = c.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2);
      glow.addColorStop(0, `rgba(255,220,120,${0.6 * q.flash})`);
      glow.addColorStop(1, 'rgba(255,120,60,0)');
      c.fillStyle = glow;
      c.beginPath(); c.arc(0, 0, r * 2, 0, TAU); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    c.fillStyle = '#3b1030';
    c.beginPath(); c.arc(0, 0, r + 4, 0, TAU); c.fill();
    const ring = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
    ring.addColorStop(0, '#ff9ecb'); ring.addColorStop(0.7, '#ff2e7e'); ring.addColorStop(1, '#a3124f');
    c.fillStyle = ring;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    // Chasing lights around the rim
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const on = (Math.floor(t * 6) + i) % 2 === 0 || q.flash > 0.3;
      c.fillStyle = on ? '#fff3b0' : '#7a1840';
      c.beginPath(); c.arc(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, r * 0.09, 0, TAU); c.fill();
    }
    const cap = c.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.05, 0, 0, r * 0.6);
    cap.addColorStop(0, '#ffffff'); cap.addColorStop(1, q.flash > 0 ? '#ffe066' : '#ffd23f');
    c.fillStyle = cap;
    c.beginPath(); c.arc(0, 0, r * 0.58, 0, TAU); c.fill();
    c.fillStyle = '#ff2e7e';
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const rr = i % 2 === 0 ? r * 0.4 : r * 0.17;
      i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath(); c.fill();
    c.restore();
  }

  function drawCracks(c, b, color, width, glow) {
    const frac = 1 - Math.max(0, b.hp) / b.maxHp;
    const n = Math.ceil(b.cracks.length * frac);
    if (n <= 0) return;
    const r = b.r;
    c.save();
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    if (glow) { c.shadowColor = color; c.shadowBlur = 10; }
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const cr = b.cracks[i];
      c.moveTo(cr.pts[0][0] * r, cr.pts[0][1] * r * 1.1);
      for (let k = 1; k < cr.pts.length; k++) c.lineTo(cr.pts[k][0] * r, cr.pts[k][1] * r * 1.1);
      if (cr.branch) {
        c.moveTo(cr.branch[0][0] * r, cr.branch[0][1] * r * 1.1);
        c.lineTo(cr.branch[1][0] * r, cr.branch[1][1] * r * 1.1);
      }
    }
    c.stroke();
    c.restore();
  }

  function drawBalloon(c, b, t) {
    const r = b.r, ry = r * 1.1;
    c.save();
    c.translate(b.x, b.y);
    const sq = b.squash || 0;
    c.scale(1 + 0.14 * sq, 1 - 0.1 * sq);

    // String and knot
    c.strokeStyle = 'rgba(40,40,70,0.45)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, ry);
    c.quadraticCurveTo(7 + Math.sin(t * 2 + b.phase) * 4, ry + 20, 0, ry + 38);
    c.stroke();

    const body = () => { c.beginPath(); c.ellipse(0, 0, r, ry, 0, 0, TAU); };
    const grad = (stops) => {
      const g = c.createRadialGradient(-r * 0.35, -ry * 0.4, r * 0.1, 0, 0, r * 1.2);
      stops.forEach(([o, col]) => g.addColorStop(o, col));
      return g;
    };

    let knot = '#333', outline = '#222';
    switch (b.type) {
      case 'basic':
      case 'iron':
        knot = shade(b.color, -0.4);
        outline = shade(b.color, -0.5);
        body();
        c.fillStyle = grad([[0, shade(b.color, 0.5)], [0.5, b.color], [1, shade(b.color, -0.35)]]);
        c.fill();
        break;
      case 'fire': {
        knot = '#8a0f16'; outline = '#6e0b12';
        body();
        c.fillStyle = grad([[0, '#fff3a0'], [0.45, '#ff8a00'], [1, '#b8141f']]);
        c.fill();
        const f = 0.85 + 0.15 * Math.sin(t * 18 + b.phase);
        c.fillStyle = 'rgba(255,224,102,0.85)';
        c.beginPath();
        c.moveTo(0, -ry * 0.6 * f);
        c.bezierCurveTo(r * 0.5, -ry * 0.1, r * 0.4, ry * 0.5, 0, ry * 0.55);
        c.bezierCurveTo(-r * 0.4, ry * 0.5, -r * 0.5, -ry * 0.1, 0, -ry * 0.6 * f);
        c.fill();
        c.fillStyle = 'rgba(255,255,230,0.9)';
        c.beginPath();
        c.moveTo(0, -ry * 0.15 * f);
        c.bezierCurveTo(r * 0.25, ry * 0.1, r * 0.2, ry * 0.45, 0, ry * 0.48);
        c.bezierCurveTo(-r * 0.2, ry * 0.45, -r * 0.25, ry * 0.1, 0, -ry * 0.15 * f);
        c.fill();
        break;
      }
      case 'ice':
        knot = '#3aa0d8'; outline = '#1f6f9c';
        body();
        c.fillStyle = grad([[0, '#ffffff'], [0.5, '#aeeaff'], [1, '#3aa0d8']]);
        c.fill();
        c.save(); body(); c.clip();
        c.strokeStyle = 'rgba(255,255,255,0.5)';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-r * 0.2, -ry); c.lineTo(r * 0.3, ry * 0.2); c.lineTo(r, ry * 0.1);
        c.moveTo(-r, ry * 0.3); c.lineTo(r * 0.3, ry * 0.2);
        c.stroke();
        drawCracks(c, b, 'rgba(20,90,140,0.7)', 4.5);
        drawCracks(c, b, '#ffffff', 2.2);
        c.restore();
        break;
      case 'stone':
        knot = '#4e4945'; outline = '#2e2a27';
        body();
        c.fillStyle = grad([[0, '#d6d1cb'], [0.55, '#8f8984'], [1, '#4e4945']]);
        c.fill();
        c.save(); body(); c.clip();
        for (const s of b.speckles) {
          c.fillStyle = s.light ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
          c.beginPath(); c.arc(s.x * r, s.y * ry, s.r * r, 0, TAU); c.fill();
        }
        drawCracks(c, b, 'rgba(255,255,255,0.25)', 5);
        drawCracks(c, b, '#26221f', 2.8);
        c.restore();
        break;
      case 'obsidian':
        knot = '#120a1c'; outline = '#000000';
        body();
        c.fillStyle = grad([[0, '#6b3fa0'], [0.4, '#2a1440'], [1, '#0b0612']]);
        c.fill();
        c.save(); body(); c.clip();
        c.fillStyle = 'rgba(200,160,255,0.12)';
        for (const [a0, a1, d] of b.facets) {
          c.beginPath();
          c.moveTo(Math.cos(a0) * r * d * 0.3, Math.sin(a0) * ry * d * 0.3);
          c.lineTo(Math.cos(a0) * r * 1.2, Math.sin(a0) * ry * 1.2);
          c.lineTo(Math.cos(a1) * r * 1.2, Math.sin(a1) * ry * 1.2);
          c.closePath();
          c.fill();
        }
        drawCracks(c, b, '#ff4fd8', 3, true);
        drawCracks(c, b, '#ffd6f5', 1.2);
        c.restore();
        break;
    }

    // Knot
    c.fillStyle = knot;
    c.beginPath(); c.moveTo(-6, ry + 7); c.lineTo(6, ry + 7); c.lineTo(0, ry - 2); c.closePath(); c.fill();

    body();
    c.strokeStyle = outline;
    c.lineWidth = 3;
    c.stroke();

    // Iron casing: ring of plates + center cap. Plates fall off as HP drops.
    if (b.type === 'iron') {
      c.save();
      c.scale(1, 1.1);
      const removed = IRON_TILES - ironTiles(b);
      const mg = c.createLinearGradient(0, -r, 0, r);
      mg.addColorStop(0, '#d5dce3');
      mg.addColorStop(1, '#5f6b78');
      for (let i = 0; i < IRON_TILES; i++) {
        if (b.rank[i] < removed) continue;
        const a0 = (i / IRON_TILES) * TAU + 0.04, a1 = ((i + 1) / IRON_TILES) * TAU - 0.04;
        c.beginPath();
        c.arc(0, 0, r * 1.03, a0, a1);
        c.arc(0, 0, r * 0.5, a1, a0, true);
        c.closePath();
        c.fillStyle = mg;
        c.fill();
        c.strokeStyle = '#2c333b';
        c.lineWidth = 2;
        c.stroke();
        const am = (a0 + a1) / 2;
        c.fillStyle = '#eef2f5';
        c.beginPath(); c.arc(Math.cos(am) * r * 0.77, Math.sin(am) * r * 0.77, r * 0.065, 0, TAU); c.fill();
      }
      c.beginPath();
      c.arc(0, 0, r * 0.46, 0, TAU);
      c.fillStyle = mg;
      c.fill();
      c.strokeStyle = '#2c333b';
      c.lineWidth = 2.5;
      c.stroke();
      c.restore();
    }

    // Gloss highlight
    c.fillStyle = b.type === 'obsidian' ? 'rgba(220,190,255,0.35)' : 'rgba(255,255,255,0.55)';
    c.beginPath();
    c.ellipse(-r * 0.38, -ry * 0.45, r * 0.18, ry * 0.28, -0.5, 0, TAU);
    c.fill();

    if (b.flash > 0) {
      c.globalAlpha = b.flash * 0.7;
      body();
      c.fillStyle = '#ffffff';
      c.fill();
      c.globalAlpha = 1;
    }

    if (b.maxHp > 1) {
      const hp = Math.max(1, Math.ceil(b.hp));
      c.font = `900 ${Math.round(r * 0.62)}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 5;
      c.strokeStyle = 'rgba(0,0,0,0.75)';
      c.strokeText(hp, 0, 2);
      c.fillStyle = '#ffffff';
      c.fillText(hp, 0, 2);
    }
    c.restore();
  }

  function drawBall(c, type, x, y, r, rot, flash) {
    c.save();
    c.translate(x, y);
    switch (type) {
      case 'ball': {
        const g = c.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#dfe7ff'); g.addColorStop(1, '#7c93ff');
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.rotate(rot);
        c.strokeStyle = '#ff4d6d'; c.lineWidth = r * 0.25;
        c.beginPath(); c.arc(0, 0, r * 0.62, -0.9, 0.9); c.stroke();
        c.rotate(-rot);
        c.strokeStyle = '#2b3a8f'; c.lineWidth = 2.5;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
        break;
      }
      case 'saw': {
        c.rotate(rot);
        const teeth = 14;
        c.beginPath();
        for (let i = 0; i < teeth * 2; i++) {
          const a = (i / (teeth * 2)) * TAU;
          const rr = i % 2 === 0 ? r * 1.12 : r * 0.8;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
        }
        c.closePath();
        c.fillStyle = '#dfe4ea'; c.fill();
        c.strokeStyle = '#3f4854'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#9aa3ad';
        c.beginPath(); c.arc(0, 0, r * 0.62, 0, TAU); c.fill();
        c.fillStyle = '#ffc300';
        c.beginPath(); c.arc(0, 0, r * 0.28, 0, TAU); c.fill();
        c.strokeStyle = '#3f4854'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(0, 0, r * 0.28, 0, TAU); c.stroke();
        break;
      }
      case 'fireball': {
        c.globalCompositeOperation = 'lighter';
        const glow = c.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.2);
        glow.addColorStop(0, 'rgba(255,150,0,0.55)'); glow.addColorStop(1, 'rgba(255,80,0,0)');
        c.fillStyle = glow;
        c.beginPath(); c.arc(0, 0, r * 2.2, 0, TAU); c.fill();
        c.globalCompositeOperation = 'source-over';
        const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#fff8c0'); g.addColorStop(0.45, '#ffb000'); g.addColorStop(1, '#e63900');
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        break;
      }
      case 'lightning': {
        const f = flash || 0;
        c.globalCompositeOperation = 'lighter';
        const glow = c.createRadialGradient(0, 0, r * 0.4, 0, 0, r * (2.4 + f * 1.6));
        glow.addColorStop(0, `rgba(120,230,255,${0.6 + f * 0.4})`); glow.addColorStop(1, 'rgba(60,120,255,0)');
        c.fillStyle = glow;
        c.beginPath(); c.arc(0, 0, r * (2.4 + f * 1.6), 0, TAU); c.fill();
        // Sparks jumping off the orb
        c.strokeStyle = '#d8fdff'; c.lineWidth = 2;
        for (let i = 0; i < 3 + Math.round(f * 3); i++) {
          let a = Math.random() * TAU;
          c.beginPath(); c.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
          for (let k = 1; k <= 3; k++) {
            const d = r * (0.9 + k * (0.3 + f * 0.25));
            a += (Math.random() - 0.5);
            c.lineTo(Math.cos(a) * d, Math.sin(a) * d);
          }
          c.stroke();
        }
        c.globalCompositeOperation = 'source-over';
        const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#6ff0ff'); g.addColorStop(1, '#2a6fff');
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        // Electricity crawling across the surface
        c.save();
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
        c.globalCompositeOperation = 'lighter';
        c.lineJoin = 'round';
        for (let i = 0; i < 3; i++) {
          const a0 = Math.random() * TAU, a1 = a0 + Math.PI * (0.6 + Math.random() * 0.8);
          const x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r, x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r;
          c.strokeStyle = i === 0 ? '#ffffff' : '#bff8ff';
          c.lineWidth = i === 0 ? 2 : 1.4;
          c.beginPath(); c.moveTo(x0, y0);
          for (let k = 1; k < 5; k++) {
            const t = k / 5;
            c.lineTo(lerp(x0, x1, t) + (Math.random() - 0.5) * r * 0.5, lerp(y0, y1, t) + (Math.random() - 0.5) * r * 0.5);
          }
          c.lineTo(x1, y1);
          c.stroke();
        }
        c.restore();
        if (f > 0) {
          c.globalAlpha = f * 0.85;
          c.fillStyle = '#ffffff';
          c.beginPath(); c.arc(0, 0, r * (1 + f * 0.25), 0, TAU); c.fill();
          c.globalAlpha = 1;
        }
        break;
      }
      case 'rubber': {
        const g = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#ffd6f2'); g.addColorStop(0.5, '#ff4fc3'); g.addColorStop(1, '#b0127e');
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.rotate(rot * 3);
        c.strokeStyle = '#ffe066'; c.lineWidth = r * 0.3;
        c.beginPath(); c.arc(0, 0, r * 0.55, -0.7, 0.7); c.stroke();
        c.rotate(-rot * 3);
        c.strokeStyle = '#6d0a4c'; c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
        break;
      }
      case 'blackhole': {
        // Swirling aura / accretion disk
        const pulse = 1 + 0.08 * Math.sin(rot * 3);
        const aura = c.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 3.2 * pulse);
        aura.addColorStop(0, 'rgba(160,90,255,0.65)');
        aura.addColorStop(0.45, 'rgba(255,90,200,0.22)');
        aura.addColorStop(1, 'rgba(120,60,255,0)');
        c.fillStyle = aura;
        c.beginPath(); c.arc(0, 0, r * 3.2 * pulse, 0, TAU); c.fill();
        c.save();
        c.rotate(rot);
        c.lineCap = 'round';
        const cols = ['#b388ff', '#ff7ad9', '#8c5cff', '#e0ccff'];
        for (let i = 0; i < 4; i++) {
          c.strokeStyle = cols[i];
          c.globalAlpha = 0.9 - i * 0.15;
          c.lineWidth = 4 - i * 0.6;
          c.beginPath();
          c.ellipse(0, 0, r * (1.25 + i * 0.32), r * (1.05 + i * 0.22), i * 0.7, i * 1.7, i * 1.7 + 2.6);
          c.stroke();
        }
        c.globalAlpha = 1;
        c.restore();
        c.fillStyle = '#000000';
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        const rim = c.createRadialGradient(0, 0, r * 0.75, 0, 0, r * 1.08);
        rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(0.8, 'rgba(180,120,255,0.9)'); rim.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = rim;
        c.beginPath(); c.arc(0, 0, r * 1.08, 0, TAU); c.fill();
        break;
      }
    }
    c.restore();
  }

  function drawShard(c, s) {
    c.save();
    c.translate(s.x, s.y);
    c.rotate(s.rot);
    const z = s.size;
    c.beginPath();
    if (s.kind === 'ice') {
      c.moveTo(z, 0); c.lineTo(-z * 0.6, z * 0.5); c.lineTo(-z * 0.4, -z * 0.5);
      c.fillStyle = '#dff8ff';
      c.strokeStyle = '#3aa0d8';
    } else {
      c.moveTo(z * 0.8, -z * 0.2); c.lineTo(z * 0.2, z * 0.7); c.lineTo(-z * 0.7, z * 0.3); c.lineTo(-z * 0.4, -z * 0.6);
      c.fillStyle = '#9c958f';
      c.strokeStyle = '#3b3632';
    }
    c.closePath();
    c.fill();
    c.lineWidth = 2;
    c.stroke();
    c.restore();
  }

  function drawParticle(c, p) {
    const k = p.life / p.max;
    switch (p.kind) {
      case 'dot':
        c.globalAlpha = 1 - k;
        c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, TAU); c.fill();
        break;
      case 'ember':
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 1 - k;
        c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x, p.y, p.size * (1 - k * 0.6), 0, TAU); c.fill();
        c.globalCompositeOperation = 'source-over';
        break;
      case 'scrap':
        c.globalAlpha = 1 - k * k;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillStyle = p.color;
        c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        c.restore();
        break;
      case 'chip':
        c.globalAlpha = 1 - k * k;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillStyle = p.color;
        c.beginPath(); c.moveTo(p.size, 0); c.lineTo(-p.size * 0.6, p.size * 0.6); c.lineTo(-p.size * 0.5, -p.size * 0.5); c.closePath(); c.fill();
        c.restore();
        break;
      case 'plate':
        c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillStyle = p.color;
        c.strokeStyle = '#2c333b';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-p.size * 0.5, -p.size * 0.3); c.lineTo(p.size * 0.5, -p.size * 0.4);
        c.lineTo(p.size * 0.4, p.size * 0.3); c.lineTo(-p.size * 0.45, p.size * 0.35);
        c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#eef2f5';
        c.beginPath(); c.arc(0, 0, 2.5, 0, TAU); c.fill();
        c.restore();
        break;
      case 'ring': {
        const e = 1 - Math.pow(1 - k, 3);
        c.globalAlpha = 1 - k;
        c.strokeStyle = p.color;
        c.lineWidth = 8 * (1 - k) + 1;
        c.beginPath(); c.arc(p.x, p.y, lerp(p.size * 0.3, p.size, e), 0, TAU); c.stroke();
        break;
      }
      case 'flash':
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = (1 - k) * 0.8;
        c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x, p.y, p.size * (0.6 + 0.4 * k), 0, TAU); c.fill();
        c.globalCompositeOperation = 'source-over';
        break;
      case 'smoke':
        c.globalAlpha = 0.4 * (1 - k);
        c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x, p.y, p.size * (1 + k), 0, TAU); c.fill();
        break;
      case 'flame': {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 1 - k;
        const fr = p.size * (1 - k * 0.5);
        const fg = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, fr * 1.6);
        fg.addColorStop(0, p.color);
        fg.addColorStop(1, 'rgba(255,60,0,0)');
        c.fillStyle = fg;
        c.beginPath(); c.arc(p.x, p.y, fr * 1.6, 0, TAU); c.fill();
        c.globalCompositeOperation = 'source-over';
        break;
      }
      case 'bolt':
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 1 - k;
        c.lineJoin = 'round';
        c.lineCap = 'round';
        c.beginPath();
        p.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.strokeStyle = 'rgba(90,200,255,0.45)';
        c.lineWidth = p.size * 3;
        c.stroke();
        c.strokeStyle = p.color;
        c.lineWidth = p.size;
        c.stroke();
        c.globalCompositeOperation = 'source-over';
        break;
      case 'text': {
        c.globalAlpha = 1 - Math.pow(k, 3);
        const s = k < 0.15 ? lerp(0.5, 1.15, k / 0.15) : 1;
        c.save(); c.translate(p.x, p.y); c.scale(s, s);
        c.font = `900 ${p.size}px system-ui, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineWidth = 6;
        c.strokeStyle = 'rgba(60,20,0,0.8)';
        c.strokeText(p.text, 0, 0);
        c.fillStyle = p.color;
        c.fillText(p.text, 0, 0);
        c.restore();
        break;
      }
    }
    c.globalAlpha = 1;
  }

  function drawAim(c) {
    const sp = lerp(LAUNCH_MIN, LAUNCH_MAX, aim.power);
    let x = LAUNCH.x + Math.cos(aim.angle) * 60, y = LAUNCH.y + Math.sin(aim.angle) * 60;
    let vx = Math.cos(aim.angle) * sp, vy = Math.sin(aim.angle) * sp;
    const dots = 28;
    outer: for (let i = 0; i < dots; i++) {
      for (let s = 0; s < 3; s++) {
        const dt = 0.01;
        vy += G * dt; x += vx * dt; y += vy * dt;
        if (x < 12) { x = 12; vx = -vx; }
        if (x > W - 12) { x = W - 12; vx = -vx; }
        if (y < 12) { y = 12; vy = -vy; }
        for (const p of platforms) {
          const cp = closestOnSeg(x, y, p);
          if (Math.hypot(x - cp.x, y - cp.y) < 12 + p.t / 2) break outer;
        }
        for (const q of bumpers) if (Math.hypot(x - q.cx, y - q.cy) < 12 + q.r) break outer;
      }
      c.globalAlpha = 1 - i / dots;
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(x, y, 6 - (i / dots) * 3, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(40,30,90,0.6)'; c.lineWidth = 2; c.stroke();
    }
    c.globalAlpha = 1;
  }

  function drawLauncher(c) {
    c.save();
    c.translate(LAUNCH.x, LAUNCH.y);
    c.save();
    c.rotate(aim.angle);
    c.fillStyle = '#ff7a59';
    c.strokeStyle = '#7a2a14';
    c.lineWidth = 4;
    c.beginPath();
    c.roundRect(0, -19, 72, 38, 10);
    c.fill(); c.stroke();
    c.fillStyle = '#ffd166';
    c.fillRect(44, -19, 10, 38);
    c.restore();

    c.fillStyle = '#3d4a7a';
    c.strokeStyle = '#1c2340';
    c.lineWidth = 4;
    c.beginPath(); c.arc(0, 0, 42, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#6f7fc0';
    c.beginPath(); c.arc(-10, -12, 12, 0, TAU); c.fill();

    if (mode === 'aim') {
      const n = totalBalls();
      c.font = '900 30px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 6;
      c.strokeStyle = 'rgba(20,10,50,0.8)';
      c.strokeText('×' + n, 0, 2);
      c.fillStyle = '#fff';
      c.fillText('×' + n, 0, 2);
    }
    c.restore();

    // Power meter while dragging
    if (mode === 'aim' && drag) {
      c.fillStyle = 'rgba(20,10,50,0.6)';
      c.fillRect(LAUNCH.x - 80, LAUNCH.y + 58, 160, 14);
      c.fillStyle = aim.power > 0.8 ? '#ff4d6d' : '#ffd166';
      c.fillRect(LAUNCH.x - 78, LAUNCH.y + 60, 156 * aim.power, 10);
    }
  }

  function render() {
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.drawImage(bgCanvas, 0, 0, W, H);

    ctx.save();
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));

    for (const p of platforms) drawPlatform(ctx, p);
    for (const q of bumpers) drawBumper(ctx, q, simTime);
    for (const b of balloons) if (b.alive) drawBalloon(ctx, b, simTime);
    for (const s of shards) drawShard(ctx, s);

    for (const b of balls) {
      const tr = b.trail;
      const col = BALL_TYPES[b.type].trail;
      ctx.lineCap = 'round';
      for (let i = 1; i < tr.length; i++) {
        ctx.strokeStyle = `rgba(${col},${(i / tr.length) * 0.45})`;
        ctx.lineWidth = b.r * 1.4 * (i / tr.length);
        ctx.beginPath(); ctx.moveTo(tr[i - 1][0], tr[i - 1][1]); ctx.lineTo(tr[i][0], tr[i][1]); ctx.stroke();
      }
      const fading = b.life > BALL_LIFETIME - 3;
      if (fading && Math.floor(b.life * 8) % 2 === 0) ctx.globalAlpha = 0.45;
      drawBall(ctx, b.type, b.x, b.y, b.r, b.rot, b.flash);
      ctx.globalAlpha = 1;
    }

    for (const p of particles) drawParticle(ctx, p);

    if (mode === 'aim') drawAim(ctx);
    if (mode !== 'title') drawLauncher(ctx);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // HUD / UI
  // ---------------------------------------------------------------------------
  function updateHud() {
    ui.money.textContent = fmt(save.money);
    ui.setLevel.textContent = 'Level ' + currentLevel;
    ui.speed.textContent = 'Speed ' + save.speed + '×';
    ui.sound.textContent = save.muted ? 'Sound: Off' : 'Sound: On';
    ui.sound.setAttribute('aria-pressed', String(!save.muted));
    hudDirty = false;
  }

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function startLevel() {
    currentLevel = save.level;
    generateLevel(currentLevel);
    balls = []; shards = []; particles = []; explosions = []; launchQueue = [];
    endTimer = 0;
    mode = 'aim';
    closeSettings();
    hide(ui.title); hide(ui.results); hide(ui.shop);
    show(ui.hud);
    // Only first-time players need the instructions.
    if (currentLevel === 1) {
      ui.hint.textContent = 'Drag back & release to fling';
      show(ui.hint);
    } else {
      hide(ui.hint);
    }
    hudDirty = true;
  }

  function launch() {
    if (mode !== 'aim' || settingsOpen) return;
    const list = [];
    for (const k of BALL_ORDER) for (let i = 0; i < save.owned[k]; i++) list.push(k);
    shuffle(list);
    launchQueue = list.map((type, i) => ({ type, t: i * 0.07 }));
    launchClock = 0;
    mode = 'play';
    hide(ui.hint);
  }

  function finishLevel() {
    mode = 'results';
    hide(ui.hint);
    closeSettings();
    // A level is only won by popping every balloon.
    const passed = stats.popped >= stats.total;

    for (const b of balls) burst(b.x, b.y, 8, { kind: 'smoke', speed: [40, 120], color: '#ffffff', size: [8, 14], life: [0.3, 0.5] });
    balls = []; shards = []; launchQueue = []; explosions = [];

    if (passed) {
      save.level++;
      Sfx.fanfare();
      Platform.sendScore(save.level - 1);
    }
    persist();

    const left = stats.total - stats.popped;
    if (passed) {
      ui.resTitle.textContent = WIN_LINES[Math.floor(Math.random() * WIN_LINES.length)];
      ui.resSub.textContent = WIN_SUBS[Math.floor(Math.random() * WIN_SUBS.length)];
      ui.toShop.textContent = 'Next';
    } else {
      ui.resTitle.textContent = FAIL_LINES[Math.floor(Math.random() * FAIL_LINES.length)];
      ui.resSub.textContent = `${left} balloon${left === 1 ? '' : 's'} left. Grab more balls and try again!`;
      ui.toShop.textContent = 'Retry';
    }
    ui.resEarned.textContent = '+' + fmt(stats.earned);

    hudDirty = true;
    setTimeout(() => { show(ui.results); ui.toShop.focus(); }, 350);
  }

  function openShop() {
    mode = 'shop';
    hide(ui.results);
    renderShop();
    show(ui.shop);
    ui.next.focus();
  }

  function renderShop() {
    ui.shopMoney.textContent = fmt(save.money);
    ui.next.textContent = `Play Level ${save.level}`;
    ui.shopList.innerHTML = '';
    for (const key of BALL_ORDER) {
      const def = BALL_TYPES[key];
      const owned = save.owned[key];
      const maxed = owned >= BALL_CAP;
      const card = document.createElement('div');
      card.className = 'card';

      const icon = document.createElement('canvas');
      icon.width = 180; icon.height = 180;
      const ic = icon.getContext('2d');
      ic.setTransform(2, 0, 0, 2, 0, 0);
      drawBall(ic, key, 45, 45, key === 'blackhole' ? 14 : key === 'rubber' ? 16 : 24, 0.5);

      const info = document.createElement('div');
      info.className = 'info';
      info.innerHTML = `<div class="name"></div><div class="desc"></div><div class="owned"></div>`;
      info.querySelector('.name').textContent = def.name;
      info.querySelector('.desc').textContent = def.desc;
      info.querySelector('.owned').textContent = `Owned: ${owned}/${BALL_CAP}`;

      const btn = document.createElement('button');
      btn.className = 'buy';
      btn.textContent = maxed ? 'MAX' : fmt(def.price);
      btn.disabled = maxed || save.money < def.price;
      btn.setAttribute('aria-label', maxed ? `${def.name}: maximum owned` : `Buy ${def.name} for ${def.price} coins`);
      btn.addEventListener('click', () => buy(key));

      card.append(icon, info, btn);
      ui.shopList.append(card);
    }
  }

  function buy(key) {
    const def = BALL_TYPES[key];
    if (save.money < def.price || save.owned[key] >= BALL_CAP) return;
    save.money -= def.price;
    save.owned[key]++;
    Sfx.coin();
    persist();
    renderShop();
    hudDirty = true;
    const btns = ui.shopList.querySelectorAll('.buy');
    const idx = BALL_ORDER.indexOf(key);
    if (btns[idx] && !btns[idx].disabled) btns[idx].focus();
  }

  function openSettings() {
    if (settingsOpen) return;
    settingsOpen = true;
    drag = null;
    hudDirty = true;
    show(ui.settings);
    ui.resume.focus();
  }

  function closeSettings() {
    if (!settingsOpen) return;
    settingsOpen = false;
    lastT = performance.now();
    hide(ui.settings);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  function toWorld(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function setAimFromDrag(p) {
    const dx = drag.x - p.x, dy = drag.y - p.y;
    const len = Math.hypot(dx, dy);
    drag.len = len;
    if (len < 10) return;
    let a = Math.atan2(dy, dx);
    // Only allow upward shots.
    if (a > -0.15 && a <= Math.PI / 2) a = -0.15;
    else if (a > Math.PI / 2 || a < -Math.PI + 0.15) a = -Math.PI + 0.15;
    aim.angle = a;
    aim.power = clamp(len / DRAG_FULL, 0.15, 1);
  }

  canvas.addEventListener('pointerdown', (e) => {
    Sfx.unlock();
    if (mode !== 'aim' || settingsOpen) return;
    canvas.setPointerCapture(e.pointerId);
    const p = toWorld(e);
    drag = { x: p.x, y: p.y, len: 0, id: e.pointerId };
    hide(ui.hint);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    setAimFromDrag(toWorld(e));
  });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const long = drag.len > 30;
    drag = null;
    if (long && mode === 'aim') launch();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) drag = null; });

  window.addEventListener('keydown', (e) => {
    Sfx.unlock();
    if (e.key === 'Escape' && (mode === 'aim' || mode === 'play')) {
      settingsOpen ? closeSettings() : openSettings();
      e.preventDefault();
      return;
    }
    if (mode !== 'aim' || settingsOpen || e.target instanceof HTMLButtonElement) return;
    switch (e.key) {
      case 'ArrowLeft': aim.angle = clamp(aim.angle - 0.03, -Math.PI + 0.15, -0.15); e.preventDefault(); break;
      case 'ArrowRight': aim.angle = clamp(aim.angle + 0.03, -Math.PI + 0.15, -0.15); e.preventDefault(); break;
      case 'ArrowUp': aim.power = clamp(aim.power + 0.03, 0.15, 1); e.preventDefault(); break;
      case 'ArrowDown': aim.power = clamp(aim.power - 0.03, 0.15, 1); e.preventDefault(); break;
      case ' ':
      case 'Enter': launch(); e.preventDefault(); break;
    }
  });

  ui.play.addEventListener('click', () => { Sfx.unlock(); startLevel(); });
  ui.toShop.addEventListener('click', openShop);
  ui.next.addEventListener('click', startLevel);
  ui.settingsBtn.addEventListener('click', () => { Sfx.unlock(); openSettings(); });
  ui.resume.addEventListener('click', closeSettings);
  ui.speed.addEventListener('click', () => {
    save.speed = save.speed >= 3 ? 1 : save.speed + 1;
    persist();
    hudDirty = true;
  });
  ui.sound.addEventListener('click', () => {
    save.muted = !save.muted;
    Sfx.setEnabled(!save.muted);
    Sfx.unlock();
    persist();
    hudDirty = true;
  });

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    stage.style.transform = `translate(${(vw - W * s) / 2}px, ${(vh - H * s) / 2}px) scale(${s})`;
    const requestedDpr = promoDebug ? Number(captureParams.get('dpr')) : NaN;
    const dpr = Number.isFinite(requestedDpr) && requestedDpr > 0
      ? Math.min(requestedDpr, 4) : Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(W * s * dpr));
    canvas.height = Math.max(1, Math.round(H * s * dpr));
    renderScale = canvas.width / W;
  }
  window.addEventListener('resize', resize);

  document.addEventListener('visibilitychange', () => { paused = document.hidden; });

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  let lastT = performance.now();
  let acc = 0;
  let firstFrameSent = false;

  // Local-only capture controls. They are absent from the Playables build.
  if (promoDebug) {
    window.__game = {
      get state() { return mode; },
      get stats() { return { ...stats }; },
      get level() { return currentLevel; },
      get balls() { return balls.length; },
      start: startLevel,
      launch,
      openShop,
      finish: finishLevel,
      setAim(angle, power = 1) {
        aim.angle = clamp(angle, -Math.PI + 0.15, -0.15);
        aim.power = clamp(power, 0.15, 1);
      },
      configure({ level = 1, owned = {}, money = 0, seed } = {}) {
        save.level = Math.max(1, Math.floor(level));
        save.money = Math.max(0, Math.floor(money));
        if (Number.isInteger(seed)) save.seed = seed >>> 0;
        for (const type of BALL_ORDER) save.owned[type] = clamp(Math.floor(owned[type] || 0), 0, BALL_CAP);
        if (!totalBalls()) save.owned.ball = 1;
        startLevel();
      },
      // Layout fingerprint used by the verification harness.
      summary() {
        const types = {};
        for (const b of balloons) types[b.type] = (types[b.type] || 0) + 1;
        const obstacles = { bumper: bumpers.length };
        for (const p of platforms) obstacles[p.kind] = (obstacles[p.kind] || 0) + 1;
        return {
          types, obstacles,
          layout: balloons.map((b) => `${b.type}@${b.x.toFixed(1)},${b.baseY.toFixed(1)}`).join('|')
            + '#' + platforms.map((p) => `${p.kind}${p.x1.toFixed(1)},${p.y1.toFixed(1)}`).join('|')
            + '#' + bumpers.map((q) => `${q.cx.toFixed(1)},${q.cy.toFixed(1)}`).join('|'),
        };
      },
      get save() { return JSON.parse(JSON.stringify(save)); },
      buy,
      openSettings,
      closeSettings,
      pop(count = 1) {
        const live = balloons.filter((b) => b.alive).slice(0, count);
        for (const b of live) damageBalloon(b, Infinity);
        hudDirty = true;
      },
      step(seconds = 1 / 15) {
        if (!manualCapture) return;
        let remaining = Math.max(0, Math.min(seconds, 10));
        while (remaining > 0) {
          const dt = Math.min(DT, remaining);
          step(dt);
          updateFx(dt);
          remaining -= dt;
        }
        if (hudDirty) updateHud();
        render();
      },
    };
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!paused && !settingsOpen && !manualCapture) {
      const sdt = dt * (mode === 'play' ? save.speed : 1);
      acc += sdt;
      let steps = 0;
      while (acc >= DT && steps < 16) {
        step(DT);
        acc -= DT;
        steps++;
      }
      if (steps >= 16) acc = 0;
      updateFx(sdt);
    }
    if (hudDirty) updateHud();
    render();
    if (!firstFrameSent) {
      firstFrameSent = true;
      Platform.firstFrameReady();
    }
    requestAnimationFrame(frame);
  }

  async function boot() {
    resize();
    buildBackground();
    // A decorative level behind the title screen.
    generateLevel(14);
    stats = { total: 0, popped: 0, earned: 0 };
    requestAnimationFrame(frame);

    applyLoaded(await Platform.load());
    Sfx.setEnabled(!save.muted);
    Platform.bindSystemEvents({
      onPause: () => { paused = true; },
      onResume: () => { paused = false; lastT = performance.now(); },
      onAudioEnabled: (v) => Sfx.setPlatformAudio(v),
    });
    if (save.level > 1) ui.play.textContent = `Continue · Level ${save.level}`;
    hudDirty = true;
    Platform.gameReady();
  }

  boot();
})();
