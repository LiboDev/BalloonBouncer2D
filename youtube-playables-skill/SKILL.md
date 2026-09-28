---
name: youtube-playables
description: Build, port, audit, and prepare HTML5 games for YouTube Playables. Use for web game architecture, YouTube Playables SDK integration, controls, responsive UI, cloud saves, scores, ads, audio/pause lifecycle, packaging, certification, and submission readiness.
---

# YouTube Playables

Use this skill when creating a new YouTube Playable, adapting an existing web game, or diagnosing certification failures.

## Core behavior

1. Prefer a small standards-based web build unless the project already depends on an engine.
2. Treat YouTube certification requirements as hard constraints, not late-stage cleanup.
3. Keep platform-specific code behind a thin adapter so the core game can run locally and on other portals.
4. Load only the reference files needed for the current task.
5. For SDK names, signatures, limits, or certification rules that may have changed, verify the official Google documentation before asserting them. `references/sources.md` contains canonical links and the date this skill was last checked.
6. Never invent a `ytgame` API. If an API is not in the current SDK reference, do not use it.

## Default stack decision

For a new agent-built game:

- 3D: TypeScript + Three.js + Vite.
- 2D: TypeScript + PixiJS, Phaser, or Canvas depending on complexity.
- UI: DOM/CSS for menus/HUD when practical; canvas UI only when it materially simplifies the game.
- Physics: add Rapier only when real physics is important; otherwise use lightweight custom collision/movement.
- Audio: Web Audio / HTMLAudio behind a central audio manager.
- Storage/YouTube integration: one platform adapter wrapping `ytgame`.
- Do not choose Unity/Godot unless existing assets/tooling or game complexity clearly justifies the extra bundle/runtime cost.

Read `references/stack.md` before making a stack choice.

## Progressive loading map

Read only what the task needs:

| Task | Read |
|---|---|
| Start a new Playable | `workflows/build-new-game.md`, `references/stack.md`, `references/sdk.md` |
| Port an existing web game | `workflows/port-existing-web-game.md`, `references/sdk.md`, `references/performance-bundle.md` |
| SDK boot/lifecycle/audio/pause | `references/sdk.md` |
| Saves or scores | `references/persistence-engagement.md` |
| Touch/mouse/keyboard/responsive UI | `references/input-ui.md` |
| Ads/monetization | `references/ads.md` |
| Bundle/memory/startup optimization | `references/performance-bundle.md` |
| Privacy/network/content/i18n/a11y | `references/privacy-content.md` |
| Certification/submission | `references/certification.md`, `checklists/preflight.md` |
| Debug rejected/failing build | `workflows/debug-certification.md`, `checklists/test-matrix.md` |
| Need canonical docs | `references/sources.md` |

## Non-negotiable platform invariants

Keep these in working memory while editing a Playable:

- It is a single-page web app with an `index.html` at the root.
- Load `https://www.youtube.com/game_api/v1` before any game code.
- Call `ytgame.game.firstFrameReady()` before `ytgame.game.gameReady()`.
- Call `gameReady()` only when the player can actually interact.
- Support every gameplay interaction with touch and mouse; keyboard support is strongly recommended.
- Never lose progress because the viewport resized or orientation/aspect ratio changed.
- Respect YouTube audio state and pause/resume callbacks.
- Use YouTube cloud save APIs for persistent game state in Playables.
- Do not make arbitrary external network calls from the shipped game.
- Do not use off-platform ads or IAP.
- Use relative asset paths only.
- Default hard limits: initial bundle <30 MiB, total bundle <250 MiB, each file <30 MiB, saved data <3 MiB, file count <=8,000, peak JS heap <=512 MB. Target substantially below these limits.

## Agent implementation pattern

Keep the game core independent from YouTube:

```text
Game Core
  ├─ gameplay/state/rendering
  ├─ input abstraction
  ├─ audio manager
  └─ save model
        │
        ▼
PlatformAdapter
  ├─ ready signals
  ├─ cloud save/load
  ├─ pause/resume
  ├─ audio enable state
  ├─ scores
  └─ ads
        │
        ▼
YouTube Playables SDK (`ytgame`)
```

Use `examples/youtube-adapter.ts` as a reference implementation, not as unquestioned truth; reconcile it with the current SDK docs when APIs change.

## Definition of done

Before declaring a Playable finished:

1. Run `scripts/audit_playable.py <dist-folder>`.
2. Complete `checklists/preflight.md`.
3. Exercise `checklists/test-matrix.md` on desktop and mobile-sized viewports.
4. Run Google's Playables SDK Test Suite and Developer Portal verification when access is available.
5. Re-check current official requirements if certification or SDK docs changed since `references/sources.md` was last verified.
