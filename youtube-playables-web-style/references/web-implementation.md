# Web Implementation

## General strategy

Make the look reusable through code rather than through hundreds of bespoke assets.

## 2D stack

Good approaches:

- Canvas/WebGL renderer for active gameplay
- PixiJS/Phaser for sprite-heavy games
- SVG for simple scalable static/vector elements
- DOM/CSS for menus and overlays where appropriate

Prefer sprite atlases and reusable components over many loose image requests.

## 3D stack

Good approaches:

- Three.js
- Babylon.js
- PlayCanvas
- another lightweight WebGL/WebGPU runtime when justified

Use glTF/GLB for external models.

## Procedural-first rule

Before importing an asset, ask whether it can be built cheaply from:

- box
- sphere
- cylinder
- plane
- extruded polygon
- instanced mesh
- signed-distance/procedural shader
- particle sprite

This is especially effective for hybrid-casual art.

## Performance-friendly art choices

- reuse materials
- atlas 2D textures
- instance repeated geometry
- prefer baked/simple lighting
- limit transparent overdraw
- keep particle lifetimes short
- pool frequently spawned objects
- compress textures appropriately
- load secondary content after core gameplay when possible

## Resolution independence

- design UI in logical coordinates
- support high-DPI screens without increasing art complexity unnecessarily
- use vector/SDF text/icons where useful
- anchor HUD to safe screen regions
- test narrow and wide aspect ratios

## Responsive camera

Do not merely stretch the viewport.

Adjust:

- camera framing
- visible playfield bounds
- UI spacing
- safe zones

while preserving the scale of the primary gameplay object.

## Asset architecture

Keep visual constants centralized:

```text
style/
  palette
  typography
  materials
  particles
  uiTokens
  animationCurves
```

Do not scatter hard-coded style values throughout gameplay code.

## Shipping principle

A slightly simpler art style that loads instantly and stays at a stable frame rate is preferable to a richer style that causes startup delay or stutter.
