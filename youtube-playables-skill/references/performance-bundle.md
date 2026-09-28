# Performance, bundle, and packaging

## Current hard limits

Treat the following as certification constraints unless current docs supersede them:

| Metric | Hard requirement | Target |
|---|---:|---:|
| Initial bundle | <30 MiB | <15 MiB, preferably much smaller |
| Total bundle | <250 MiB | only what game needs |
| Individual file | <30 MiB | <512 KiB when practical |
| Saved game | <3 MiB | <500 KiB |
| Peak JS heap | <=512 MB | substantially below |
| Total files | <=8,000 | far below |
| Interactive load | — | <5 seconds |

Initial bundle is measured through the point the game calls `gameReady()`.

## Packaging rules

- root `index.html`;
- single-page application;
- relative file paths only;
- filenames restricted to alphanumeric plus `_`, `-`, `.`;
- all runtime game assets packaged locally;
- no arbitrary external runtime calls;
- compression matters for transfer-size estimates, but do not use it to hide an oversized architecture.

## Three.js performance defaults

Start conservative:

- cap pixel ratio, e.g. `Math.min(devicePixelRatio, 2)` and consider lower on mobile;
- reuse geometry/materials;
- instance repeated meshes;
- use texture atlases where useful;
- compress textures and dimensions aggressively;
- avoid thousands of independent draw calls;
- avoid per-frame allocations in hot loops;
- pool frequently spawned objects;
- unload/dispose obsolete textures, geometries, render targets;
- avoid expensive real-time shadows unless they materially improve the game;
- use baked/simple lighting for casual Playables;
- avoid post-processing stacks by default.

## Startup strategy

Load only what is required for the first interaction:

```text
SDK -> shell/loading frame -> firstFrameReady
     -> first playable scene/menu assets
     -> gameReady
     -> lazy-load later content from local bundle
```

Do not call `gameReady()` early just to improve the number. It is a semantic certification signal, not a performance hack.

## Asset rules

- Prefer WebP/AVIF where browser compatibility and pipeline permit; otherwise optimized PNG/JPEG.
- Keep texture dimensions aligned to actual display needs.
- Compress audio and keep clips short.
- Avoid shipping unused source assets.
- Tree-shake dependencies.
- Split oversized files where practical.

## Memory

Peak JavaScript heap must not exceed 512 MB. Also account for GPU textures/buffers even though those are not identical to JS heap metrics.

Stress-test:

- repeated level restart;
- 20+ minutes of play;
- device rotation/resizing;
- repeated rewarded/interstitial attempts;
- scene transitions;
- background/pause/resume cycles.

Memory should plateau, not climb indefinitely.
