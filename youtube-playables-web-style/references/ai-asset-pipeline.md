# AI Asset Pipeline

## Best uses of AI

Use generative image tools for:

- visual exploration
- thumbnail concepts
- backgrounds
- icons
- texture ideas
- simple sprite concepts
- UI motifs
- material references
- VFX reference sheets

## Recommended pipeline

1. Generate **concept boards**, not final assets.
2. Select one coherent direction.
3. Record the direction in `templates/style-brief.md`.
4. Generate production assets using the same vocabulary and reference images.
5. Normalize assets manually or programmatically:
   - canvas size
   - outline width
   - palette
   - lighting direction
   - transparency
   - naming
6. Integrate into the game.
7. Compare generated assets inside the actual runtime, not on isolated white backgrounds.

## 2D assets

When generating 2D game objects, request:

- isolated subject
- simple readable silhouette
- fixed camera/view angle
- transparent or removable background
- limited palette
- consistent outline/shading
- no text unless required

For sprite sheets, generated output should be treated as a draft. Verify alignment and animation continuity before use.

## 3D assets

For this style, prefer code/procedural geometry before AI mesh generation.

Use AI mesh tools when a unique silhouette cannot be cheaply constructed from primitives.

Require:

- clean topology appropriate to the toolchain
- modest polygon count
- UVs only when needed
- simple material separation
- predictable forward/up orientation
- sensible pivot/origin
- tested GLB export

## Texture generation

Generate reusable material families rather than one-off textures.

Examples:

- plastic color variants
- stone variants
- ice/frost
- painted metal
- stylized road/ground

For casual visuals, small tiling textures or procedural shader variation often outperform unique large textures.

## AI limitations

Watch for:

- inconsistent proportions
- changing details between frames
- accidental text/logos
- fake transparency
- mismatched light direction
- excessive tiny detail
- non-tileable texture seams
- geometry that looks good in a render but fails in motion
