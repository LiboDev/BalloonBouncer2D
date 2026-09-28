# Art direction for AI key art

## Style brief (goes in `jobs.style`, shared by every job)

Write it once, concretely, from the real game:
1. Rendering style (e.g. "bright toy-like low-poly 3D, chunky bevelled geometry, matte/plastic materials").
2. Hero colours with hex codes (player vehicle `#2f7bff` + accent `#ffd23f`).
3. World and lighting (sunset gradient, pastel buildings, skyline silhouette).
4. The exact list of props/effects that exist in the game.
5. Safety: family friendly, no people, no gore, no text.
6. "The attached images are real screenshots; match palette and design language, render with more polish."

## Per-image prompt formula

**one hero subject + one obvious interaction + one consequence**, then composition, safe areas, exclusions.

- Icon: hero fills ~75%, inside the centre 80% (survives circle/rounded crops), simple gradient background, readable at 48 px, no text/border.
- Landscape cover (generate 3:2): keep the action inside the central 16:9 band (~9% expendable top/bottom); keep one quadrant calm for the logo.
- Portrait cover (generate 2:3): hero in the lower-middle third; content in the central 9:16 band; top ~20% sky for the logo.
- Square: an "evolution" or before/after story reads well at 1:1.
- Logo: spell the word letter by letter in the prompt ("C-R-A-S-H L-A-B"), transparent background, thick outline, generous padding. Check spelling on every output.
- Key art (boss, lineup): same safe-area rules; no firing weapons at people; show only real content.

Append negatives: no photorealism, no tiny detail, no letters/numbers/logos/UI/watermarks, no muted colours.

## Composition safe areas used by `build_assets.py`

Logo boxes are fractions `(x, y, w, h)` of the final image:
- 16:9 banners: top-left `(0.03, 0.04, 0.42, 0.30)`
- 9:16 banners: top band `(0.08, 0.03, 0.84, 0.17)`
- 1:1: `(0.04, 0.03, 0.50, 0.22)`
- 3:1 social: left `(0.02, 0.08, 0.34, 0.50)`; shift crop focus up (`0.36`) so the hero isn't beheaded.

## Review questions

- Does it read at 128 px? (contact sheet)
- Is everything shown actually in the game?
- Vehicle/hero colours correct? Any stray text, letters, extra wheels, melted geometry?
- Does the logo area stay calm after cropping to every size?
