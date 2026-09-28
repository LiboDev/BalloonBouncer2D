# Game hooks for capture

The capture script drives the game through a few **dev-only** hooks. Gate every hook so it can never activate inside YouTube Playables (`ytgame.IN_PLAYABLES_ENV`).

| Query param | Hook | Why |
|---|---|---|
| `?debug` | `window.__game = game` | scripts read state and trigger scenes |
| `?dpr=N` | force renderer pixel ratio (disable adaptive resolution) | crisp captures at 2x/3x |
| `?capture` | manual clock: game only advances via `game.step(dt)` | smooth previews on slow/software GPUs |
| (method) | one-step helpers, e.g. `debugUpgrade()`, `activatePower(kind)` | reproducible scenes |

## Reference implementation (TypeScript, from Crash Lab)

```ts
// main.ts - expose the game only locally
if (!platform.inPlayables && new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __game: Game }).__game = game;
}

// Game constructor - fixed pixel ratio for captures
const q = new URLSearchParams(location.search).get('dpr');
if (q && !platform.inPlayables) this.dpr = this.dprMin = Number(q) || dpr;

// Game - fixed-timestep capture clock
private manualClock = !this.platform.inPlayables && new URLSearchParams(location.search).has('capture');

step(dt: number): void {            // called by the capture script once per recorded frame
  if (this.manualClock) this.tick(dt);
}

frame = (now: number): void => {    // requestAnimationFrame loop
  const realDt = Math.min(1 / 15, (now - this.last) / 1000);
  this.last = now;
  if (!this.manualClock) this.tick(realDt);
  requestAnimationFrame(this.frame);
};

private tick(realDt: number): void {
  if (this.paused) return;
  this.update(realDt, realDt);
  this.renderer.render(this.scene, this.camera);
}

// Scene helper - exactly ONE progression step (setting a huge value skips several tiers)
debugUpgrade(): void {
  if (this.platform.inPlayables || this.tier >= MAX_TIER) return;
  this.scrap = VEHICLES[this.tier].scrapToNext;
}
```

## Design notes

- The capture bot needs a JS expression that returns "which way to steer" (e.g. `targetX - playerX`). Expose enough state (`props`, `pickups`, player `x/d`) for that.
- Any state you jump to in a scene (end of run, boss fight) needs a way to reach it quickly: e.g. set `time`, `finaleTimer` from the page.
- Keep hooks side-effect free when the param is absent; run the normal build + audit after adding them.
- Hide cursor/dev overlays; captures should look exactly like the shipped game.
