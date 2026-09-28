# Input, controls, and responsive UI

## Required interaction coverage

Every interaction must work with:

- touch;
- mouse.

Keyboard directional/text input is recommended and usually worth implementing for desktop quality.

Use a unified action layer rather than scattering device-specific listeners through gameplay:

```text
Pointer/touch -> Action.Move / Action.Aim / Action.Primary
Mouse         -> same actions
Keyboard      -> same actions where applicable
```

Prefer Pointer Events for unified mouse/touch/stylus handling unless a framework already abstracts them well.

## Mobile controls

For direct manipulation games, prefer touching/dragging the object/world itself.

For virtual controls:

- avoid tiny buttons;
- recommended touch targets >=48x48 dp with >=8 dp separation;
- keep important controls away from likely system/browser edges;
- support multi-touch when gameplay requires movement + action simultaneously;
- cancel/repair pointer state on lost focus, pause, pointer cancel, and resize.

Do not require hover.

## Keyboard

Where applicable:

- WASD / arrows for direction;
- Space/Enter for primary action;
- Esc closes in-game dialogs/pause menus;
- never call `preventDefault()` on Esc.

Do not map critical functionality only to keyboard.

## Responsive aspect ratios

The game must adapt to arbitrary Playables viewports. Official examples span extremely tall to extremely wide ratios (such as 9:32 through 32:9).

Rules:

- do not lock orientation;
- preserve current gameplay/progress across resize;
- fill the viewport when practical;
- otherwise center with intentional letterbox/pillarbox;
- never stretch graphics non-uniformly;
- avoid accidental page scrollbars.

### Recommended 3D camera strategy

Define a protected gameplay region and change camera distance/FOV/framing based on aspect ratio rather than exposing important off-screen elements.

For HUD, use CSS/DOM anchors relative to safe screen edges or a responsive layout system.

### Recommended 2D strategy

Choose one:

- fixed world height, variable horizontal reveal;
- fixed world width, variable vertical reveal;
- cover/contain camera with gameplay-safe margins.

Do not make aspect ratio change the game's difficulty substantially unless intentional.

## Rendering quality

- handle devicePixelRatio with a sensible cap for performance;
- avoid low-resolution raster UI that blurs on large screens;
- ensure text remains legible at mobile sizes;
- do not make the UI look like YouTube's close/mute/menu controls;
- do not add an in-game quit/exit button.

## Haptics

Haptics are optional. If used, include an in-game toggle and fail silently on unsupported devices.
