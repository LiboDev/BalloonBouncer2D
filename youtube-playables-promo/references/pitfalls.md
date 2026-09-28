# Pitfalls hit while building the Crash Lab kit (and fixes)

1. **Vite dev server crashed mid-capture** (`EBUSY ... watch ... marketing\raw\cover-portrait.png`). The image agents wrote large PNGs into the project and the Windows file watcher failed.
   Fix: `server: { watch: { ignored: ['**/marketing/**'] } }` in `vite.config.ts` (or write outputs outside the project). Restart the server; use `capture.py --resume`.

2. **Upgrade scenes skipped tiers.** Setting the progress value to a huge number (`scrap = 99999`) triggered several upgrades in consecutive frames.
   Fix: a `debugUpgrade()` hook that fills the meter for exactly one step.

3. **Real-time previews stuttered** (software GL rendered ~5-20 fps and each screenshot took longer than a frame).
   Fix: `?capture` fixed-timestep clock; the script calls `game.step(1/fps)` then screenshots. Output is perfectly smooth.

4. **Timeouts at high DPR.** `wait_for_function` hit 20 s on a 1024x768 x2 capture under swiftshader.
   Fix: `waitTimeout` 45 s+, one retry per device, `--resume`.

5. **Parallel browsers starve each other.** Two software-GL capture runs at once stalled both.
   Fix: captures strictly serial. Image agents are remote and can run alongside.

6. **Wide crops beheaded the hero** (1500x500 cut the truck's cab).
   Fix: per-cover `focus` (shift up to ~0.36-0.4) and review every size.

7. **Long prompts on Windows.** Passing multi-paragraph prompts as CLI arguments risks quoting/length issues.
   Fix: pipe the prompt through stdin (`codex exec ... -`).

8. **Stale folders.** Renaming device folders left old captures that would be packaged.
   Fix: delete `screenshots/` before a full re-capture; the builder copies whatever is there.

9. **Store icons must be opaque.** Rounded/circle icons with alpha are only for previews/social, never the store icon slot.

10. **AI art and policy.** Never let AI art show features the game lacks, people, gore, URLs, or YouTube-like UI; never use AI output as "screenshots".
