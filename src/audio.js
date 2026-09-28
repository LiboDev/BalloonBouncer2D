// Tiny synthesized sound effects via Web Audio. No asset files needed.
window.Sfx = (() => {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let enabled = true;
  let platformAudio = true;
  const last = {};

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended' && platformAudio) ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // Throttle each sound so big chain reactions don't turn into noise.
  function ok(name, gap) {
    if (!ctx || !enabled || !platformAudio) return false;
    const t = ctx.currentTime;
    if (last[name] !== undefined && t - last[name] < gap) return false;
    last[name] = t;
    return true;
  }

  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, type = 'bandpass', q = 1) {
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  const r = (a, b) => a + Math.random() * (b - a);

  return {
    unlock,
    setEnabled(v) { enabled = v; },
    setPlatformAudio(v) {
      platformAudio = v;
      if (ctx) v ? ctx.resume() : ctx.suspend();
    },
    pop() {
      if (!ok('pop', 0.025)) return;
      const p = r(0.8, 1.3);
      noise(0.08, 0.5, 1700 * p, 'bandpass', 0.8);
      tone(520 * p, 0.07, 'triangle', 0.22, 180 * p);
    },
    clink() {
      if (!ok('clink', 0.03)) return;
      const p = r(0.9, 1.15);
      tone(1700 * p, 0.12, 'square', 0.06);
      tone(2500 * p, 0.09, 'sine', 0.1);
    },
    crack() {
      if (!ok('crack', 0.03)) return;
      noise(0.07, 0.45, 4200, 'highpass');
      tone(r(1800, 2400), 0.05, 'triangle', 0.08);
    },
    shatter() {
      if (!ok('shatter', 0.04)) return;
      noise(0.28, 0.5, 5200, 'highpass');
      tone(2800, 0.18, 'sine', 0.08, 3600);
    },
    thud() {
      if (!ok('thud', 0.03)) return;
      tone(r(110, 150), 0.12, 'sine', 0.4, 55);
      noise(0.1, 0.3, 500, 'lowpass');
    },
    crumble() {
      if (!ok('crumble', 0.04)) return;
      noise(0.4, 0.6, 700, 'lowpass');
      tone(90, 0.25, 'sine', 0.35, 40);
    },
    boom(big) {
      if (!ok(big ? 'boom' : 'boomS', 0.05)) return;
      noise(big ? 0.6 : 0.3, big ? 0.9 : 0.45, big ? 450 : 800, 'lowpass');
      tone(big ? 95 : 160, big ? 0.45 : 0.2, 'sine', big ? 0.6 : 0.3, 35);
    },
    zap() {
      if (!ok('zap', 0.04)) return;
      noise(0.12, 0.3, 3200, 'bandpass', 2);
      tone(900, 0.09, 'sawtooth', 0.1, 1800);
    },
    boing() {
      if (!ok('boing', 0.04)) return;
      tone(r(300, 360), 0.22, 'sine', 0.3, r(700, 800));
      tone(r(900, 1000), 0.08, 'triangle', 0.1);
    },
    sizzle() {
      if (!ok('sizzle', 0.05)) return;
      noise(0.16, 0.3, 2600, 'highpass');
    },
    bonk() {
      if (!ok('bonk', 0.04)) return;
      tone(r(230, 300), 0.06, 'sine', 0.14, 160);
    },
    launch() {
      if (!ok('launch', 0.05)) return;
      noise(0.18, 0.35, 900, 'bandpass');
      tone(260, 0.18, 'triangle', 0.2, 620);
    },
    coin() {
      if (!ok('coin', 0.05)) return;
      tone(1200, 0.07, 'square', 0.06);
      tone(1650, 0.12, 'square', 0.06, null, 0.07);
    },
    fanfare() {
      if (!ok('fanfare', 0.5)) return;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.18, null, i * 0.11));
    },
  };
})();
