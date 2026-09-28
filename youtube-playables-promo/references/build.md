# Building the kit

Script: `scripts/build_assets.py <promo.config.json>` (Pillow; ffmpeg from `imageio-ffmpeg` or PATH).

Install: `pip install pillow imageio-ffmpeg`

## Steps performed

1. **Logo**: load `raw/logo.png`; if it came back opaque, key out the corner colour; trim to the alpha bounding box; export `logo-transparent.png` and fixed-width variants.
2. **Icons**: centre-crop to square, flatten to **opaque RGB** (store rule: no transparency), export the size ladder, rounded/circle alpha variants, and a multi-size `favicon.ico`.
3. **Covers**: for each entry in `covers`, `cover()` = scale-to-fill then crop around a focus point; save a clean JPG, and a with-logo JPG (logo fitted into the box with a soft drop shadow). Tiny sizes skip the logo.
4. **Key art**: extra full-bleed crops (`keyArt`).
5. **Screenshots**: copy every device capture; build ordered store sets for the 16:9 and 9:16 devices (JPG, exact size).
6. **Previews**: ffmpeg encodes frame folders at the capture fps, resamples to 30 fps H.264 MP4 (`yuv420p`, `+faststart`) at the target size, a half-size VP9 WebM, and a short GIF (Pillow palette per frame).
7. **Manifest + contact sheet**: `dist/manifest.json` (file, width, height) and `dist/contact-sheet.jpg`.

## Config keys (`promo.config.json`)

```json
{
  "outDir": "marketing",
  "covers": [{ "name": "banner-16x9-1920x1080", "src": "cover-landscape.png",
               "size": [1920, 1080], "focus": [0.5, 0.5], "logo": [0.03, 0.04, 0.42, 0.3] }],
  "keyArt": [{ "name": "boss-1920x1080", "src": "boss.png", "size": [1920, 1080] }],
  "storeShots": { "sets": { "landscape-16x9": "16x9", "portrait-9x16": "9x16" },
                  "order": ["02-first-smash", "04-combo"] },
  "previews": [{ "name": "landscape", "size": [1920, 1080], "fps": 15 }]
}
```
If `covers`/`keyArt` are omitted, the built-in default matrix (see `requirements.md`) is used.

## Why crop instead of generating each size

One generation per orientation keeps every size consistent, costs 3-4 agent runs instead of ~20, and gives exact pixel dimensions. Generate at the closest native aspect (3:2, 2:3, 1:1) and design prompts with safe areas so crops hold up.
