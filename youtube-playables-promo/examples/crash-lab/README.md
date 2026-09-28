# Worked example: Crash Lab

Three.js + Vite YouTube Playable (drive, smash, evolve through 7 vehicles, boss finale).

- `promo.config.json` - the exact devices, 11-shot scene script, bot, preview beats and crops used.
- `jobs.json` - the style brief and the 7 image-agent jobs (icon, 3 covers, boss key art, vehicle lineup, logo).

## What was run

```powershell
npm run dev                                   # vite.config.ts ignores **/marketing/**
python <skill>/scripts/capture.py marketing/promo.config.json
python <skill>/scripts/capture.py marketing/promo.config.json --refs-only
python <skill>/scripts/run_codex_jobs.py marketing/jobs.json     # 7 agents in parallel, ~6.5 min
python <skill>/scripts/build_assets.py marketing/promo.config.json
```

## Results / lessons
- All 7 agents succeeded on the first try; the logo spelled CRASH LAB correctly.
- Reference screenshots (portrait frames at <=1280 px) kept vehicle colours and the sunset palette consistent across all art.
- The 1500x500 banner needed its crop focus moved up (0.36) to keep the truck's cab.
- Game hooks added for capture: `?debug`, `?dpr`, `?capture` + `step(dt)`, `debugUpgrade()`; see `references/game-hooks.md`.
- The dev server died once from the watcher (pitfalls #1) and a 2x tablet capture timed out at 20 s (pitfalls #4); the skill's scripts include the fixes (`--resume`, retry, 45-60 s timeouts).
