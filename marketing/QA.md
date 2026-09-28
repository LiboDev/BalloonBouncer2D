# Balloon Bouncer — delivery checks

Checked on 2026-09-27 in installed Chrome on Windows.

Icon revision: replaced the original with a simpler, bolder balloon-and-ball collision. Rebuilt every icon size and favicon, checked the 48-pixel icon and circular crop, refreshed the contact sheet and gallery, and repeated asset/path checks. The exact built-in image generation edit prompt is saved in `icon-refresh-prompt.txt`.

| Check | Result |
|---|---|
| Delivery manifest | 139 assets; every image has its specified dimensions |
| Square store icons | 11 PNG sizes, fully opaque; favicon included |
| Cover art | 17 clean variants and 15 title variants |
| Gameplay captures | 70 real screenshots across seven viewport/device sets |
| Store selections | Five at 1920 × 1080 and five at 1080 × 1920 |
| MP4 gameplay | Landscape and portrait; 360 encoded frames each, 30 fps, exactly 12 seconds |
| WebM gameplay | Landscape and portrait; 360 encoded frames each, 30 fps, exactly 12 seconds |
| Animated GIFs | Landscape and portrait; 30 frames each, 5 fps, six seconds, valid full decode |
| GameSnacks marketing object | Every referenced path exists and matches its declared dimensions |
| Gallery | Desktop and mobile checked; all images load; no horizontal overflow |
| Normal gameplay | Play button and keyboard launch work with no page errors |
| Capture isolation | Debug controls absent when the YouTube Playables environment is active |
| Visual review | Illustrated masters, title spelling, crop variants, screenshot sets, thumbnail sheets, and decoded video samples checked |

The videos are silent gameplay previews. The screenshots show actual rendered game states prepared through local capture controls; illustrations are identified separately as promotional key art.

The game's HTML identifiers and stage dimensions were repaired to match `src/game.js` before capture. The results hint and unlock illustration aspect ratio were also corrected. Capture controls run only in local debug mode outside Playables.

Public [GameSnacks marketing specifications](https://developers.google.com/gamesnacks/developer/config/marketing) and [YouTube Playables design requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_design) were checked on the delivery date. Use the clean artwork for Playables thumbnails. The private portal's upload form is the final authority for any additional submission fields and size limits.
