# Workflow: build a new Playable

## 1. Define a Playables-sized game

Before coding, establish:

- core action in one sentence;
- first meaningful interaction target: seconds, not minutes;
- expected session length;
- portrait + landscape control scheme;
- progression/save model;
- score dimension, if any;
- rewarded ad moments, if any;
- interstitial natural breaks, if any;
- asset budget.

Use `templates/game-spec.md`.

## 2. Pick stack

Read `../references/stack.md`.

Default:

- 3D -> TS + Vite + Three.js;
- 2D -> TS + PixiJS/Phaser/Canvas.

Avoid backend dependencies.

## 3. Build shell before content

Implement first:

- responsive viewport;
- input abstraction;
- YouTube platform adapter;
- pause/resume;
- audio gate;
- load/save interface;
- loading screen -> `firstFrameReady` -> interactable -> `gameReady`.

Then build gameplay.

## 4. Develop vertical slice

The first slice must already work with:

- touch;
- mouse;
- narrow portrait;
- wide landscape;
- pause/resume;
- muted YouTube state;
- empty/corrupt save fallback.

## 5. Add progression and monetization

Add saves/scores before content quantity. Add ads only after the base loop works without them.

## 6. Optimize continuously

Track:

- dist size;
- initial-load assets;
- largest files;
- draw calls / frame time;
- heap trend;
- touch latency.

## 7. Preflight

Run audit script, test matrix, and official Test Suite before calling the build done.
