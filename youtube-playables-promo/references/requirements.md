# Store / portal asset requirements

Last checked: 2026-09-27. Portal rules change; re-verify before submission (links below).

## What was found

### YouTube Playables Developer Portal
- The public page describes the portal as a **private preview** (invite only). It does **not** publish image dimension rules; the upload form inside the portal is authoritative. Check it when you have access.
- Source: https://developers.google.com/youtube/gaming/playables/developer_portal

### Google GameSnacks marketing config (closest published spec from the same Google games family)
Source: https://developers.google.com/gamesnacks/developer/config/marketing (paraphrased)

| Field | Aspect | Required size | Optional sizes | Notes |
|---|---|---|---|---|
| Horizontal banner | 16:9 | 1920x1080 | 480x270, 240x135 | |
| Vertical banner | 9:16 | 1080x1920 | 270x480, 135x240 | |
| Screenshots | 16:9 or 9:16 | >= 1920x1080 / 1080x1920 | | at least 3 different screenshots |
| Game icon | 1:1 | 512x512 | 256x256, 128x128 | **no transparency, no shadows** |
| Trailer (video) | 16:9 | one at 1920x1080 | | optional field |

This kit targets these as the baseline because they are the strictest published numbers.

### YouTube Playables certification (affects what the art may show)
- Current design requirements say developer metadata must not include branding or logos in thumbnails, descriptions, or titles. Use `dist/cover-art/clean/` for Playables thumbnails; reserve `with-logo/` for social/video or other placements whose rules allow it.
  https://developers.google.com/youtube/gaming/playables/certification/requirements_design
- Design requirements: the game must work at any aspect ratio (examples 9:32 ... 32:9), so capture both orientations and extremes.
  https://developers.google.com/youtube/gaming/playables/certification/requirements_design
- Content must suit a general 13+ audience; no personal data, no off-platform links. Keep promo art family-friendly, no people/gore, no URLs or social handles.
  https://developers.google.com/youtube/gaming/playables/certification/requirements
- Do not imitate YouTube UI or use YouTube logos in your art (branding guidelines).
  https://developers.google.com/youtube/terms/branding-guidelines
- Rights: you must own/clear every asset. Check the terms of the image model you use for commercial rights; keep the prompt log (`_jobs/*.log`) as provenance.

## Output matrix produced by this kit

### Icons (`dist/icons/`)
- `icon-{1024,512,256,192,180,128,96,64,48,32,16}.png` - opaque square (store + web + Apple touch sizes)
- `icon-rounded-{512,256}.png`, `icon-circle-{512,256}.png` - with alpha, for previews/social only
- `favicon.ico` (16-64)

### Cover art (`dist/cover-art/clean/` and `dist/cover-art/with-logo/`)
| Name | Size | Use |
|---|---|---|
| banner-16x9-3840x2160 / 1920x1080 / 1280x720 / 480x270 / 240x135 | 16:9 | horizontal banners, desktop, TV |
| banner-9x16-1080x1920 / 270x480 / 135x240 | 9:16 | vertical banners, Shorts-style shelves |
| phone-9x19.5-1170x2532 | ~9:19.5 | modern phones |
| tablet-3x4-1536x2048, tablet-4x3-2048x1536 | 3:4 / 4:3 | tablets |
| square-1x1-1080 / 512 | 1:1 | square shelves, social |
| ultrawide-21x9-2560x1080 | 21:9 | ultrawide / hero headers |
| social-og-1200x630, social-x-1500x500, youtube-thumb-1280x720 | misc | link previews, banners, video thumbs |

Tiny sizes (240x135, 135x240) are shipped **without** the logo (unreadable). Clean versions exist for platforms that overlay their own title.

### Screenshots (`dist/screenshots/<device>/`, `dist/store/`)
Captured natively (no upscaling):
| Device folder | CSS viewport x scale | Pixels |
|---|---|---|
| portrait-9x16 | 360x640 x3 | 1080x1920 (store) |
| landscape-16x9 | 640x360 x3 | 1920x1080 (store) |
| phone-tall | 390x844 x3 | 1170x2532 |
| phone-wide | 844x390 x3 | 2532x1170 |
| tablet-portrait | 768x1024 x2 | 1536x2048 |
| tablet-landscape | 1024x768 x2 | 2048x1536 |
| desktop-1440p | 1280x720 x2 | 2560x1440 |

`dist/store/screenshots-16x9/` and `screenshots-9x16/` hold the ordered store set (>= 3, JPG).

### Previews (`dist/previews/`)
- `gameplay-landscape-1920x1080.mp4` (H.264, 30 fps, trailer spec), `...-960x540.webm`
- `gameplay-portrait-1080x1920.mp4`, `...-540x960.webm`
- short looping GIFs (480 wide / 270 wide)

### Logo (`dist/logo/`)
`logo-transparent.png` (trimmed) and `logo-{1024,512,256}w.png`.
