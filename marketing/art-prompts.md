# Illustration provenance and final prompts

Generated 2026-09-27 with the built-in OpenAI image generation tool. Each selected output was saved in `raw/` and then resized or cropped by `build.cjs`. The covers use real Chrome captures as references. The icon was revised at the user's request for a flashier, simpler, bolder design; `raw/icon.png` is the active revision and `raw/icon-previous.png` preserves the previous icon.

## Shared constraints

Faithful to the game's real 2D cartoon appearance: blue-to-lavender sky, round glossy pink/yellow/blue/teal balloons, orange-and-navy launcher, short indigo rails, white-blue ball, saw blade, orange fireball, cyan lightning orb, purple black hole, and actual fire/ice/iron/stone/obsidian balloon variants. Bright colors, strong indigo outlines, clean gradients. No people, added mechanics, text, numbers, HUD, brand logos, watermarks, borders, or photorealism. Illustrated key art may dramatize the effects; store screenshots always remain real captures.

## Selected masters

### `raw/icon.png`

**Edit target / style reference:** the previous `raw/icon.png`, now preserved as `raw/icon-previous.png`.  
**Prompt:** Oversized hot-pink balloon struck by a white-blue ball, one golden-yellow pop flash, a few large pink fragments, and a broad cyan-white motion trail. Saturated royal-blue/indigo background with a simple cyan glow, thick outlines, glossy 2D cartoon style, two immediately readable subjects, opaque square. Remove the additional balloons and rail. No text, logos, borders, baked rounded corners, cast shadows, or added mechanics. [Exact generation prompt](icon-refresh-prompt.txt).  
**Tool:** built-in OpenAI image generation, image edit.  
**Generated source:** `exec-dafb3fb3-4d69-4d3f-83ef-d8014aa62999.png`.

### `raw/cover-landscape.png`

**References:** `screenshots/portrait-9x16/05-fireball.png`, `screenshots/portrait-9x16/08-black-hole.png`  
**Prompt:** Premium 3:2 landscape art for 16:9 banners. Pale blue-to-lavender sky; saturated round balloons including real fire, ice and metallic variants; short indigo rails. The orange-and-navy launcher near lower center fires a glowing orange fireball diagonally into a chain reaction with two popping balloons, tiny confetti and circular pop rings. A small purple black hole may appear far right. Keep the central 16:9 band full of action and the upper-left quarter mostly open sky for the overlaid logo. Faithful polished 2D arcade style; no text, letters, numbers, HUD, people, invented objects, watermark, border, or photorealism.

### `raw/cover-portrait.png`

**References:** `screenshots/portrait-9x16/05-fireball.png`, `screenshots/portrait-9x16/08-black-hole.png`  
**Prompt:** Premium 2:3 portrait art for 9:16 banners. The real orange-and-navy launcher in the lower middle fires existing white-blue, orange fireball, and cyan lightning orb projectiles upward. They bounce from short indigo rails into pink, yellow, teal, blue, ice, and iron balloons. Pale blue-to-lavender vertical sky, round clouds, thick outlines, believable ricochet trails and modest confetti. Keep the top 20% quiet for a logo and all action safe in the central 9:16 crop. No text, letters, numbers, HUD, people, invented mechanics, watermark, border, or photorealism.

### `raw/cover-square.png`

**References:** `screenshots/portrait-9x16/05-fireball.png`, `screenshots/portrait-9x16/08-black-hole.png`  
**Prompt:** Square store and social art. At lower center, the orange-and-navy launcher sends a white-blue ball through glossy colorful balloons; one pink balloon pops into confetti and a circular white ring. Include a blue ice balloon, a red-orange fire balloon, and short slanted indigo rails. Pale blue-to-lavender sky, simple cloud puffs, saturated gradients, thick outlines. Central action readable at thumbnail size, quiet sky at upper left for an overlaid title. No text, letters, numbers, HUD, people, invented objects, watermark, border, or photorealism.

## Wordmark

`raw/logo.png` is rendered by `make-logo.cjs` from the game's existing CSS title treatment with the exact text `Balloon Bouncer`. It is transparent PNG, not AI generated.
