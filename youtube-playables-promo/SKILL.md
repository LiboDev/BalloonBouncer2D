---
name: youtube-playables-promo
description: End-to-end pipeline for producing promotional/store assets for a web game (YouTube Playables, GameSnacks and similar portals) - icons, logo, cover art/banners in every aspect ratio, real gameplay screenshots per device, and gameplay preview videos/GIFs. Uses headless Codex agents for AI key art and Playwright for real captures. Use when asked for icons, cover art, thumbnails, screenshots, trailers, previews or a store/marketing kit.
---

# YouTube Playables promo kit

Produce a complete, store-ready marketing kit from a running web game:

| Asset | Source | Why |
|---|---|---|
| Logo, icon, cover art, key art | AI images from **headless Codex agents** | Polished, dramatic, but anchored to real screenshots |
| Screenshots | **Real** captures of the running build (Playwright) | Stores and policy require screenshots to show actual gameplay |
| Gameplay previews (MP4/WebM/GIF) | Real frames from a **fixed-timestep capture mode** | Smooth playback even when rendering is slow |
| Every size/aspect variant | `scripts/build_assets.py` (Pillow + ffmpeg) | One source image -> many exact store sizes |

Core rule: **AI art may dramatise the game, but must never show content, features or UI that the game does not have. Screenshots are never AI-generated.**

## Routing

Read only what the current step needs:

- Store sizes, aspect ratios, icon rules, policy constraints: `references/requirements.md`
- Adding capture hooks to the game (debug handle, fixed clock, scene helpers): `references/game-hooks.md`
- Capturing screenshots and preview frames: `references/capture.md`
- Running headless Codex agents for image generation: `references/codex-image-agents.md`
- Writing prompts / art direction / composition safe areas: `references/art-direction.md`
- Cropping, logo overlay, icon sets, video encoding: `references/build.md`
- Problems encountered and their fixes: `references/pitfalls.md`
- Final review before handing off: `checklists/promo-checklist.md`
- A fully worked example (Crash Lab, Three.js game): `examples/crash-lab/`

## Folder map

```text
youtube-playables-promo/
  SKILL.md                         this file
  references/requirements.md       researched store specs + policy, output matrix
  references/game-hooks.md         ?debug / ?dpr / ?capture hooks (TS reference code)
  references/capture.md            capture script, step types, scene design
  references/codex-image-agents.md headless Codex usage, prompt contract, jobs schema
  references/art-direction.md      style brief, prompt formula, safe areas
  references/build.md              cropping, logo overlay, icons, video encoding
  references/pitfalls.md           problems hit and fixes
  scripts/capture.py               real screenshots + fixed-timestep preview frames
  scripts/run_codex_jobs.py        parallel headless Codex image agents
  scripts/build_assets.py          every size, icons, logo, MP4/WebM/GIF, manifest
  scripts/requirements.txt         pinned Python deps
  templates/promo.config.json      capture + build config to adapt
  templates/jobs.json              image-job template with placeholders
  checklists/promo-checklist.md    final review
  examples/crash-lab/              real configs used for Crash Lab + lessons
```

Setup: `pip install -r scripts/requirements.txt`, `python -m playwright install chromium` (or set `"channel": "chrome"`), `npm i -g @openai/codex` + `codex login`.

## Pipeline

```text
0. Verify tools      node, python+playwright, Pillow, imageio-ffmpeg, codex CLI (logged in)
1. Game hooks        ?debug handle, ?dpr, ?capture fixed clock, one-step helpers   (references/game-hooks.md)
2. Dev server        npm run dev; make sure the watcher ignores the output folder  (pitfalls.md #1)
3. Capture           python scripts/capture.py promo.config.json                   -> <out>/screenshots, <out>/preview
4. Reference frames  python scripts/capture.py promo.config.json --refs-only        -> <out>/ref
5. Image agents      python scripts/run_codex_jobs.py jobs.json                     -> <out>/raw (parallel, ~6-7 min)
6. Review raw art    look at every image; re-run only failed/off-brand ids
7. Build kit         python scripts/build_assets.py promo.config.json              -> <out>/dist + manifest.json
8. Review            checklists/promo-checklist.md, contact-sheet.jpg
```

Steps 3 and 5 are independent and can run at the same time (captures are CPU-bound, agents are remote). Never run two capture processes at once.

## Quick start

```powershell
# from the game's project root, with the dev server running
Copy-Item -Recurse <skill>/templates/* marketing/          # promo.config.json + jobs.json
# edit marketing/promo.config.json (URL, scenes, bot) and marketing/jobs.json (style brief, prompts)
python <skill>/scripts/capture.py marketing/promo.config.json
python <skill>/scripts/capture.py marketing/promo.config.json --refs-only
python <skill>/scripts/run_codex_jobs.py marketing/jobs.json --dry-run   # check commands first
python <skill>/scripts/run_codex_jobs.py marketing/jobs.json
python <skill>/scripts/build_assets.py marketing/promo.config.json
```

All relative paths in the configs resolve against the **current working directory** (run from the project root).

## Definition of done

- `dist/manifest.json` lists every file with exact pixel sizes; sizes match `references/requirements.md`.
- Icon PNGs are square and fully opaque; logo spelled correctly; no stray AI text in art.
- At least 3 store screenshots per orientation at exactly 1920x1080 and 1080x1920, all real captures.
- Preview video 16:9 1920x1080 exists (trailer requirement) plus a 9:16 version.
- Every image reviewed at full size and at thumbnail size (contact sheet).
- Official portal requirements re-checked if `references/requirements.md` is older than the submission.
