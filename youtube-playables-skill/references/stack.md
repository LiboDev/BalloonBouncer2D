# Stack and architecture

## Default recommendation

Use a normal web game. YouTube explicitly supports standards-compliant web APIs such as JavaScript, Canvas, and WebGL, and lists Three.js, PixiJS, Phaser, BabylonJS, PlayCanvas, Godot, Unity, and others as technologies used for Playables.

### 3D
Prefer:

```text
TypeScript
Vite
Three.js
optional Rapier physics
DOM/CSS UI
```

Choose Three.js when the game is a small or medium 3D experience and an agent is doing most implementation. It gives direct code-level control, small output, quick iteration, and avoids editor automation.

Use BabylonJS or PlayCanvas only when their higher-level systems clearly save development time.

### 2D
Choose based on scope:

- Canvas API: tiny arcade games and custom rendering.
- PixiJS: rendering-heavy 2D without needing a full gameplay framework.
- Phaser: scenes, input, sprites, cameras, tilemaps, arcade-style game systems.

### Engines
Use Unity/Godot when:

- porting an existing project;
- asset/animation/editor workflows dominate development;
- a complex game is materially easier in the engine.

Avoid choosing an engine merely because it is familiar. Playables rewards low startup cost and small bundles.

## Architecture

Separate these systems:

```text
src/
  game/             pure gameplay and state
  render/           renderer-specific code
  input/            unified pointer/touch/keyboard actions
  audio/            central mixer + YouTube mute gate
  save/             schema + migration
  platform/         YouTube adapter and local fallback
  ui/               menus/HUD/dialogs
```

The game must remain playable locally even though the Playables SDK is a no-op/local-development environment. Keep a local fallback for save data and platform calls where useful.

## Dependency rules

- Runtime assets and libraries must ship inside the bundle unless explicitly allowed by YouTube.
- Do not depend on CDN-hosted Three.js, fonts, analytics, config, levels, or assets at runtime.
- NPM dependencies are fine at development/build time if bundled into the shipped output.
- Avoid unnecessary WASM, workers, `eval`, and code-obfuscation patterns because YouTube must be able to inspect the game and may decline builds it cannot evaluate.
- Minification is allowed; obfuscation intended to conceal behavior is not.

## Build settings

For Vite:

- use a relative base (`base: './'`);
- produce hashed local assets;
- ensure the final `index.html` references only relative local build files except the required YouTube SDK script;
- code-split only when it reduces initial bytes without creating fragile load paths;
- lazy-load later levels/assets from the local YouTube-hosted bundle.
