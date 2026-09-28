# Capturing screenshots and previews

Script: `scripts/capture.py <promo.config.json> [device ...] [--refs-only] [--no-preview] [--previews-only] [--resume]`

Requirements: `pip install playwright pillow`, `python -m playwright install chromium` (or use installed Chrome via `"channel": "chrome"`), dev server running, game hooks from `game-hooks.md`.

## How it works

1. For each device in `devices`, open a fresh page at `viewport x scale` (`device_scale_factor`), with `{scale}` substituted into the URL (`?dpr={scale}`).
2. Run the **step list** in `scenes`. Step types:

| Step | Example | Effect |
|---|---|---|
| `shot` | `{"shot": "02-first-smash"}` | save `<out>/screenshots/<device>/02-first-smash.png` |
| `eval` | `{"eval": "window.__game.debugUpgrade()"}` | run JS in the page |
| `steer` | `{"steer": 3.2}` | bot drives for N seconds (mouse held) |
| `sleep` | `{"sleep": 0.25}` | wait real time |
| `waitFor` | `{"waitFor": "window.__game.state === 'end'"}` | wait for a JS condition (timeout configurable) |
| `mouseDown` / `mouseUp` | `{"mouseDown": true}` | hold/release at the bot anchor |
| `click` | `{"click": [0.5, 0.7]}` | click at viewport fractions |
| `reload` | `{"reload": true}` | fresh page (new run) |

3. Previews use `?capture`: per frame the script evaluates `stepJs` with `{dt} = 1/fps`, grabs a screenshot, and fires scripted `events` at fractions of the clip. Frames go to `<out>/preview/frames-<name>/`. Encoding happens in `build_assets.py`.
4. `--refs-only` downsizes chosen screenshots (`refs` map) into `<out>/ref/` for the image agents.

## The steering bot

`bot.js` returns a signed number: how far the target is from the player in world units. The script converts it into a mouse x offset: `anchorX + clamp(dx / sensitivity, -1, 1) * min(w, h) * range`. For non-steering games replace it with any expression that returns 0 and use `eval` steps.

## Scene design (what to capture)

Aim for 8-11 shots per device that tell the loop in order:

1. title / first frame (hint visible)
2. first interaction (small, readable)
3. progression moment (upgrade banner, flash)
4. mid-game chaos (combo, many effects)
5-7. each distinct power-up / mechanic
8. late-game power fantasy (biggest form)
9-10. climax (boss / finale)
11. result screen

Store set: pick 3-8 of the most readable and order them (`storeShots.order`). Prefer frames where the player object is large and the UI is uncluttered.

## Performance notes

- Software GL (`--use-angle=swiftshader`) works headless everywhere but is slow; 3x DPR on large viewports can take several seconds per frame. Raise `waitTimeout` (default 45 s) rather than lowering quality.
- Run captures **serially**. Two headless browsers on software GL starve each other and cause timeouts.
- `--resume` skips devices whose folder already has every expected shot, so a crash mid-way doesn't redo finished devices.
- Real-time recording on software GL stutters; always record previews with the fixed clock.
