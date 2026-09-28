(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const TAU = Math.PI * 2;
  const W = 1000;
  const H = 1300;
  const G = 950;                 // gravity px/s^2
  const DT = 1 / 120;            // fixed physics step
  const MIN_BOUNCE = 640;        // every bounce leaves at least this fast
  const MAX_SPEED = 1500;
  const MIN_NORMAL_FRAC = 0.32;  // bounce always has a real "away" component (no sliding)
  const BALL_LIFETIME = 18;      // seconds before a ball fizzles out
  const PASS_RATIO = 0.75;
  const LAUNCH = { x: W / 2, y: H - 120 };
  const LAUNCH_MIN = 750;
  const LAUNCH_MAX = 1500;
  const DRAG_FULL = 280;         // drag distance for full power
  const SAVE_VERSION = 1;
  const captureParams = new URLSearchParams(location.search);
  const promoDebug = !Platform.inPlayables && captureParams.has('debug');
  const manualCapture = promoDebug && captureParams.has('capture');

  const BALL_TYPES = {
    ball:      { name: 'Ball',          dmg: 1,        price: 8,    r: 12, desc: '1 damage per hit', trail: '160,180,255' },
    saw:       { name: 'Saw Blade',     dmg: 3,        price: 40,   r: 15, desc: '3 damage per hit', trail: '210,215,225' },
    fireball:  { name: 'Fireball',      dmg: 5,        price: 150,  r: 14, desc: '5 damage + 1 dmg blast on every pop', trail: '255,140,0' },
    lightning: { name: 'Lightning Orb', dmg: 25,       price: 600,  r: 15, desc: '25 damage per hit', trail: '120,230,255' },
    blackhole: { name: 'Black Hole',    dmg: Infinity, price: 3000, r: 17, desc: 'Infinite damage, eats through balloons', trail: '150,90,255' },
  };
  const BALL_ORDER = ['ball', 'saw', 'fireball', 'lightning', 'blackhole'];

  const BALLOON_TYPES = {
    basic:    { name: 'Balloon',          hp: 1,   r: 28 },
    fire:     { name: 'Fire Balloon',     hp: 1,   r: 29 },
    ice:      { name: 'Ice Balloon',      hp: 3,   r: 30 },
    iron:     { name: 'Iron Balloon',     hp: 5,   r: 31 },
    stone:    { name: 'Stone Balloon',    hp: 10,  r: 33 },
    obsidian: { name: 'Obsidian Balloon', hp: 100, r: 40 },
  };
  const UNLOCK_ORDER = ['basic', 'fire', 'ice', 'iron', 'stone', 'obsidian'];
  const WEIGHTS = { basic: 6, fire: 2.5, ice: 3, iron: 3, stone: 2.5, obsidian: 1 };
  const BASIC_COLORS = ['#ff4d6d', '#ffb703', '#3a86ff', '#ff66c4', '#2ec4b6', '#8f5cff'];
  const IRON_TILES = 10;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const fmt = (n) => Math.floor(n).toLocaleString('en-US');

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
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

  function weightedPick(list) {
    let total = 0;
    for (const t of list) total += WEIGHTS[t];
    let r = Math.random() * total;
    for (const t of list) {
      r -= WEIGHTS[t];
      if (r <= 0) return t;
    }
    return list[0];
  }

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    hud: $('hud'), level: $('hud-level'), money: $('hud-money'), bar: $('hud-bar'), count: $('hud-count'),
    speed: $('btn-speed'), sound: $('btn-sound'), hint: $('hint'),
    title: $('overlay-title'), results: $('overlay-results'), shop: $('overlay-shop'),
    play: $('btn-play'), toShop: $('btn-to-shop'), next: $('btn-next'),
    resTitle: $('res-title'), resSub: $('res-sub'), resPopped: $('res-popped'), resEarned: $('res-earned'),
    resUnlock: $('res-unlock'), unlockCanvas: $('unlock-canvas'), unlockName: $('unlock-name'), unlockHp: $('unlock-hp'),
    shopMoney: $('shop-money'), shopList: $('shop-list'),
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const save = {
    version: SAVE_VERSION,
    money: 0,
    level: 1,
    owned: { ball: 3, saw: 0, fireball: 0, lightning: 0, blackhole: 0 },
    speed: 1,
    muted: false,
  };

  let mode = 'title'; // title | aim | play | results | shop
  let currentLevel = 1;
  let balloons = [], platforms = [], balls = [], shards = [], particles = [], explosions = [];
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
    if ([1, 2, 3].includes(data.speed)) save.speed = data.speed;
    save.muted = !!data.muted;
    if (data.owned) {
      for (const k of BALL_ORDER) {
        const v = data.owned[k];
        if (Number.isInteger(v) && v >= 0) save.owned[k] = v;
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
          const ba = a + (Math.random() < 0.5 ? 0.9 : -0.9);
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
        const a = rand(0, TAU), d = Math.sqrt(Math.random()) * 0.85;
        b.speckles.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: rand(0.04, 0.1), light: Math.random() < 0.5 });
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
    platforms = [];
    balloons = [];

    const nPlat = randInt(3, 6);
    let tries = 0;
    while (platforms.length < nPlat && tries++ < 400) {
      const len = rand(150, 300);
      const ang = Math.random() < 0.7 ? rand(-0.4, 0.4) : rand(-0.9, 0.9);
      const cx = rand(110, W - 110);
      const cy = rand(260, H - 340);
      const hx = (Math.cos(ang) * len) / 2, hy = (Math.sin(ang) * len) / 2;
      const p = { x1: cx - hx, y1: cy - hy, x2: cx + hx, y2: cy + hy, t: 20, cx, cy, flash: 0 };
      if (p.x1 < 30 || p.x2 > W - 30) continue;
      if (platforms.some((q) => Math.hypot(q.cx - cx, q.cy - cy) < 230)) continue;
      // Keep the launch lane open so the first flight isn't instantly deflected into the pit.
      if (Math.max(p.y1, p.y2) > H - 640 && p.x1 < LAUNCH.x + 160 && p.x2 > LAUNCH.x - 160) continue;
      platforms.push(p);
    }

    // Low side ledges catch falling balls and bounce them back into the field.
    // The middle stays open so balls can still fall off the map.
    for (const side of [-1, 1]) {
      const len = rand(250, 320);
      const y = rand(H - 280, H - 210);
      const tilt = rand(20, 55); // inner end lower -> bounces lean toward the center
      const outer = side < 0 ? rand(20, 60) : W - rand(20, 60);
      const inner = outer - side * len;
      const p = side < 0
        ? { x1: outer, y1: y - tilt / 2, x2: inner, y2: y + tilt / 2 }
        : { x1: inner, y1: y + tilt / 2, x2: outer, y2: y - tilt / 2 };
      Object.assign(p, { t: 20, cx: (p.x1 + p.x2) / 2, cy: y, flash: 0 });
      platforms.push(p);
    }

    const unlocked = UNLOCK_ORDER.slice(0, Math.min(level, UNLOCK_ORDER.length));
    const newest = unlocked[unlocked.length - 1];
    const count = Math.min(10 + (level - 1) * 3, 48);
    const obsCap = level >= 6 ? 1 + Math.floor((level - 6) / 2) : 0;

    const types = [];
    if (newest !== 'basic') {
      const guaranteed = newest === 'obsidian' ? 1 : 2;
      for (let i = 0; i < guaranteed; i++) types.push(newest);
    }
    let obs = types.filter((t) => t === 'obsidian').length;
    while (types.length < count) {
      const t = weightedPick(unlocked);
      if (t === 'obsidian') {
        if (obs >= obsCap) continue;
        obs++;
      }
      types.push(t);
    }
    types.sort((a, b) => BALLOON_TYPES[b].r - BALLOON_TYPES[a].r); // place big ones first

    for (const type of types) {
      const r = BALLOON_TYPES[type].r;
      for (let k = 0; k < 250; k++) {
        const x = rand(r + 25, W - r - 25);
        const y = rand(110 + r, H - 380);
        if (balloons.some((o) => Math.hypot(o.x - x, o.baseY - y) < o.r + r + 14)) continue;
        if (platforms.some((p) => {
          const c = closestOnSeg(x, y, p);
          return Math.hypot(c.x - x, c.y - y) < r + p.t / 2 + 14;
        })) continue;
        balloons.push(makeBalloon(type, x, y));
        break;
      }
    }

    stats = { total: balloons.length, popped: 0, earned: 0 };
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

  function bolt(x1, y1, x2, y2) {
    const pts = [[x1, y1]];
    const segs = 7;
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      pts.push([lerp(x1, x2, t) + rand(-14, 14), lerp(y1, y2, t) + rand(-14, 14)]);
    }
    pts.push([x2, y2]);
    addP({ kind: 'bolt', pts, max: 0.18, color: '#c8faff' });
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
        queueExplosion(b.x, b.y, 135, 3, 0.07, true);
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

  function queueExplosion(x, y, r, dmg, delay, big) {
    explosions.push({ x, y, r, dmg, t: delay, big });
  }

  function detonate(e) {
    const s = e.r;
    addP({ x: e.x, y: e.y, kind: 'flash', size: s, color: e.big ? '#ffb347' : '#ffd166', max: e.big ? 0.3 : 0.2 });
    addP({ x: e.x, y: e.y, kind: 'ring', size: s, color: '#fff3b0', max: e.big ? 0.35 : 0.22 });
    burst(e.x, e.y, e.big ? 22 : 8, { kind: 'ember', speed: [150, e.big ? 520 : 300], color: ['#ffd166', '#ff8a00', '#ff5400', '#fff3b0'], size: [2, 5], life: [0.3, 0.7], drag: 2.5, g: 200 });
    if (e.big) burst(e.x, e.y, 8, { kind: 'smoke', speed: [30, 110], color: '#6b5b73', size: [18, 30], life: [0.6, 1.1], up: -40 });
    addShake(e.big ? 12 : 4);
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
    const target = clamp(sp, MIN_BOUNCE, MAX_SPEED);
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
    const sp = MIN_BOUNCE * 1.3;
    b.vx = Math.cos(a) * sp;
    b.vy = Math.sin(a) * sp;
  }

  function spawnBall(type) {
    const def = BALL_TYPES[type];
    const a = aim.angle + rand(-0.05, 0.05);
    const sp = lerp(LAUNCH_MIN, LAUNCH_MAX, aim.power) * rand(0.95, 1.05);
    const muzzle = 60;
    balls.push({
      type, r: def.r, dmg: def.dmg,
      x: LAUNCH.x + Math.cos(aim.angle) * muzzle, y: LAUNCH.y + Math.sin(aim.angle) * muzzle,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0, rot: 0, hits: new Map(), trail: [], dead: false,
      ax: LAUNCH.x, ay: LAUNCH.y, anchorT: simTime,
    });
    burst(LAUNCH.x + Math.cos(aim.angle) * muzzle, LAUNCH.y + Math.sin(aim.angle) * muzzle, 5,
      { kind: 'smoke', speed: [40, 120], color: '#ffffff', size: [8, 14], life: [0.25, 0.45] });
    Sfx.launch();
  }

  function hitBalloon(ball, bl) {
    const popped = damageBalloon(bl, ball.dmg);
    switch (ball.type) {
      case 'fireball':
        if (popped) queueExplosion(bl.x, bl.y, 85, 1, 0, false);
        burst(ball.x, ball.y, 5, { kind: 'ember', speed: [80, 220], color: ['#ffd166', '#ff8a00'], size: [2, 4], life: [0.2, 0.4] });
        break;
      case 'lightning':
        for (let i = 0; i < 3; i++) bolt(ball.x, ball.y, bl.x + rand(-bl.r, bl.r), bl.y + rand(-bl.r, bl.r));
        burst(bl.x, bl.y, 8, { kind: 'ember', speed: [150, 400], color: ['#c8faff', '#5ee7ff'], size: [2, 4], life: [0.15, 0.3] });
        Sfx.zap();
        break;
      case 'saw':
        burst(ball.x, ball.y, 6, { speed: [200, 450], color: ['#fff3b0', '#ffffff'], size: [2, 3], life: [0.12, 0.25] });
        break;
      case 'blackhole':
        burst(bl.x, bl.y, 8, { kind: 'ember', speed: [60, 200], color: ['#b388ff', '#ff7ad9'], size: [2, 4], life: [0.3, 0.5] });
        break;
    }
  }

  function stepBall(b, dt) {
    b.vy += G * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life += dt;

    // Walls and ceiling (floor is open: fall off the map)
    if (b.x < b.r) { b.x = b.r; bounce(b, 1, 0); }
    else if (b.x > W - b.r) { b.x = W - b.r; bounce(b, -1, 0); }
    if (b.y < b.r) { b.y = b.r; bounce(b, 0, 1); }

    for (const p of platforms) {
      const c = closestOnSeg(b.x, b.y, p);
      let dx = b.x - c.x, dy = b.y - c.y;
      const rr = b.r + p.t / 2;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        let d = Math.sqrt(d2);
        if (d < 1e-4) { dx = 0; dy = -1; d = 1; }
        const nx = dx / d, ny = dy / d;
        b.x = c.x + nx * rr;
        b.y = c.y + ny * rr;
        bounce(b, nx, ny);
        p.flash = 1;
        Sfx.bonk();
      }
    }

    for (const bl of balloons) {
      if (!bl.alive) continue;
      const dx = b.x - bl.x, dy = b.y - bl.y;
      const rr = b.r + bl.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const lastHit = b.hits.get(bl.id);
      if (lastHit === undefined || simTime - lastHit > 0.1) {
        b.hits.set(bl.id, simTime);
        hitBalloon(b, bl);
      }
      if (b.type !== 'blackhole') {
        const d = Math.sqrt(d2) || 1;
        const nx = d2 > 0 ? dx / d : 0, ny = d2 > 0 ? dy / d : -1;
        b.x = bl.x + nx * rr;
        b.y = bl.y + ny * rr;
        bounce(b, nx, ny);
      }
    }

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

    for (const b of balls) {
      b.rot += dt * (b.type === 'saw' ? 24 : b.type === 'blackhole' ? 5 : 3);
      b.trail.push([b.x, b.y]);
      if (b.trail.length > 9) b.trail.shift();
      if (b.type === 'fireball' && Math.random() < dt * 40) {
        addP({ x: b.x + rand(-5, 5), y: b.y + rand(-5, 5), vx: -b.vx * 0.1, vy: -b.vy * 0.1 - 30, kind: 'ember', color: pick(['#ffd166', '#ff8a00', '#ff5400']), size: rand(2, 4.5), max: rand(0.25, 0.5) });
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

  function drawBall(c, type, x, y, r, rot) {
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
        c.globalCompositeOperation = 'lighter';
        const glow = c.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.4);
        glow.addColorStop(0, 'rgba(120,230,255,0.6)'); glow.addColorStop(1, 'rgba(60,120,255,0)');
        c.fillStyle = glow;
        c.beginPath(); c.arc(0, 0, r * 2.4, 0, TAU); c.fill();
        c.strokeStyle = '#d8fdff'; c.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          let a = rand(0, TAU), px = Math.cos(a) * r * 0.6, py = Math.sin(a) * r * 0.6;
          c.beginPath(); c.moveTo(px, py);
          for (let k = 1; k <= 3; k++) {
            const d = r * (0.6 + k * 0.35);
            a += rand(-0.5, 0.5);
            c.lineTo(Math.cos(a) * d, Math.sin(a) * d);
          }
          c.stroke();
        }
        c.globalCompositeOperation = 'source-over';
        const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#6ff0ff'); g.addColorStop(1, '#2a6fff');
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        break;
      }
      case 'blackhole': {
        const glow = c.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 2);
        glow.addColorStop(0, 'rgba(140,80,255,0.55)'); glow.addColorStop(1, 'rgba(140,80,255,0)');
        c.fillStyle = glow;
        c.beginPath(); c.arc(0, 0, r * 2, 0, TAU); c.fill();
        c.rotate(rot);
        c.lineCap = 'round';
        const cols = ['#b388ff', '#ff7ad9', '#8c5cff'];
        for (let i = 0; i < 3; i++) {
          c.strokeStyle = cols[i];
          c.lineWidth = 3;
          c.beginPath();
          c.arc(0, 0, r * (1.15 + i * 0.18), i * 2.1, i * 2.1 + 2.2);
          c.stroke();
        }
        c.fillStyle = '#000000';
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.strokeStyle = '#7c4dff'; c.lineWidth = 2.5;
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
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
      case 'bolt':
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 1 - k;
        c.strokeStyle = p.color;
        c.lineWidth = 3;
        c.lineJoin = 'round';
        c.beginPath();
        p.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
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
      drawBall(ctx, b.type, b.x, b.y, b.r, b.rot);
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
    ui.level.textContent = 'Level ' + currentLevel;
    ui.money.textContent = fmt(save.money);
    const pct = stats.total ? stats.popped / stats.total : 0;
    ui.bar.style.width = pct * 100 + '%';
    ui.bar.classList.toggle('passed', pct >= PASS_RATIO);
    ui.count.textContent = `${stats.popped} / ${stats.total}`;
    ui.speed.textContent = save.speed + '×';
    ui.sound.textContent = save.muted ? '🔇' : '🔊';
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
    hide(ui.title); hide(ui.results); hide(ui.shop);
    show(ui.hud);
    const n = totalBalls();
    ui.hint.textContent = `Drag back & release to fling ${n} ball${n === 1 ? '' : 's'}`;
    show(ui.hint);
    hudDirty = true;
  }

  function launch() {
    if (mode !== 'aim') return;
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
    const pct = stats.total ? stats.popped / stats.total : 1;
    const passed = pct >= PASS_RATIO;
    let unlock = null;

    for (const b of balls) burst(b.x, b.y, 8, { kind: 'smoke', speed: [40, 120], color: '#ffffff', size: [8, 14], life: [0.3, 0.5] });
    balls = []; shards = []; launchQueue = []; explosions = [];

    if (passed) {
      save.level++;
      if (save.level <= UNLOCK_ORDER.length) unlock = UNLOCK_ORDER[save.level - 1];
      Sfx.fanfare();
      Platform.sendScore(save.level - 1);
    }
    persist();

    const perfect = stats.popped >= stats.total;
    ui.resTitle.textContent = passed ? (perfect ? 'Perfect clear!' : `Level ${currentLevel} cleared!`) : 'So close!';
    ui.resSub.textContent = passed
      ? `You popped ${Math.round(pct * 100)}% of the balloons.`
      : `You popped ${Math.round(pct * 100)}%. Pop 75% to clear. Grab more balls and try again.`;
    ui.resPopped.textContent = `${stats.popped}/${stats.total}`;
    ui.resEarned.textContent = '+' + fmt(stats.earned);

    if (unlock) {
      const def = BALLOON_TYPES[unlock];
      ui.unlockName.textContent = def.name;
      ui.unlockHp.textContent = `${def.hp} HP · worth ${def.hp} coin${def.hp === 1 ? '' : 's'}`;
      const c = ui.unlockCanvas.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, 240, 280);
      c.setTransform(2, 0, 0, 2, 0, 0);
      const b = makeBalloon(unlock, 60, 58);
      b.r = Math.min(40, b.r * 1.3);
      drawBalloon(c, b, 0);
      show(ui.resUnlock);
    } else {
      hide(ui.resUnlock);
    }

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
      const card = document.createElement('div');
      card.className = 'card';

      const icon = document.createElement('canvas');
      icon.width = 180; icon.height = 180;
      const ic = icon.getContext('2d');
      ic.setTransform(2, 0, 0, 2, 0, 0);
      drawBall(ic, key, 45, 45, 24, 0.5);

      const info = document.createElement('div');
      info.className = 'info';
      info.innerHTML = `<div class="name"></div><div class="desc"></div><div class="owned"></div>`;
      info.querySelector('.name').textContent = def.name;
      info.querySelector('.desc').textContent = def.desc;
      info.querySelector('.owned').textContent = `Owned: ${save.owned[key]}`;

      const btn = document.createElement('button');
      btn.className = 'buy';
      btn.textContent = fmt(def.price);
      btn.disabled = save.money < def.price;
      btn.setAttribute('aria-label', `Buy ${def.name} for ${def.price} coins`);
      btn.addEventListener('click', () => buy(key));

      card.append(icon, info, btn);
      ui.shopList.append(card);
    }
  }

  function buy(key) {
    const def = BALL_TYPES[key];
    if (save.money < def.price) return;
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
    if (mode !== 'aim') return;
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
    if (mode !== 'aim' || e.target instanceof HTMLButtonElement) return;
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
      configure({ level = 1, owned = {}, money = 0 } = {}) {
        save.level = Math.max(1, Math.floor(level));
        save.money = Math.max(0, Math.floor(money));
        for (const type of BALL_ORDER) save.owned[type] = Math.max(0, Math.floor(owned[type] || 0));
        if (!totalBalls()) save.owned.ball = 1;
        startLevel();
      },
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
    if (!paused && !manualCapture) {
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
    generateLevel(3);
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
