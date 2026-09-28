# Balloon Bouncer promotional kit

`dist/` contains the delivery files. `dist/manifest.json` lists every file and its exact pixel size; `dist/contact-sheet.jpg` is the visual index. Open `gallery.html` for a visual preview. `copy.md` holds the store listing, video description, and social captions.
The downloadable ZIP includes these delivery files and guides. Source captures, illustrated masters, preview frames, and build scripts remain in the project's `marketing/` working folder for later revisions.
`gamesnacks-marketing.json` is a ready marketing object; copy it into the game's `game.json` and preserve its referenced relative paths when packaging.

## Select assets

| Placement | File |
|---|---|
| YouTube Playables 16:9 thumbnail | `dist/cover-art/clean/banner-16x9-1920x1080.jpg` |
| YouTube Playables 9:16 thumbnail | `dist/cover-art/clean/banner-9x16-1080x1920.jpg` |
| GameSnacks horizontal banner | `dist/cover-art/clean/banner-16x9-1920x1080.jpg` |
| GameSnacks vertical banner | `dist/cover-art/clean/banner-9x16-1080x1920.jpg` |
| Store icon | `dist/icons/icon-512.png` |
| Landscape store screenshots | `dist/store/screenshots-16x9/` (five real captures) |
| Portrait store screenshots | `dist/store/screenshots-9x16/` (five real captures) |
| Landscape gameplay trailer | `dist/previews/gameplay-landscape-1920x1080.mp4` |
| Portrait gameplay preview | `dist/previews/gameplay-portrait-1080x1920.mp4` |
| Social art with the game title | `dist/cover-art/with-logo/` |
| Transparent title wordmark | `dist/logo/logo-transparent.png` |

Use **clean** art for YouTube Playables thumbnails. [YouTube's current design requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_design) prohibit branding or logos in thumbnails. The `with-logo` variants are for placements whose rules allow a title on the image. The private preview Developer Portal may impose additional upload sizes; check its form before submission. The size matrix follows [Google GameSnacks' published marketing requirements](https://developers.google.com/gamesnacks/developer/config/marketing).

Screenshots and preview frames come from the running game in Chrome. The four illustrated masters are AI generated from actual game screenshot references; they are cover art, never presented as gameplay screenshots. The logo is rendered from the game's existing title design for exact spelling. Video previews contain gameplay only and are silent: MP4 and WebM are 12 seconds at 30 fps; the compact GIFs are 6 seconds at 5 fps.

## Build again

On this Windows workspace, Python is unavailable, so these Node scripts implement the local skill's capture/build pipeline. They use Playwright, Sharp, and installed Chrome. Video exports use WebCodecs to preserve all 360 captured frames with exact timestamps, with local MP4/WebM container writers in `video-mux.cjs`. If the Node packages are not installed locally, the scripts search the existing npm cache.

```powershell
node marketing/capture.cjs --no-preview
node marketing/capture.cjs --previews-only
node marketing/make-logo.cjs
node marketing/encode.cjs
node marketing/build.cjs
node marketing/verify.cjs
node marketing/smoke-game.cjs
```

The game enables `?debug&capture&dpr=N` only outside the YouTube Playables environment. The capture script starts its own localhost server, so no persistent dev server is needed. `marketing/raw/` holds the selected art masters. Replacing a master and running `build.cjs` updates all its exact-size variants.

## Source and rights notes

- `art-prompts.md` records the final selected illustrations and generation inputs.
- The generated art was made with OpenAI's built-in image generation tool from screenshots of this game. [OpenAI's terms](https://openai.com/policies/row-terms-of-use/) address output ownership; the publisher remains responsible for its own game assets and submission rights.
- No external stock art, music, logos, or footage is used in this kit.
