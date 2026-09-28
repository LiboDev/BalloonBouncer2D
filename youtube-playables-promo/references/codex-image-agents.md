# Headless Codex agents for image generation

Script: `scripts/run_codex_jobs.py <jobs.json> [id ...] [--dry-run] [--max-parallel N]`

## Verified behaviour (codex-cli 0.157.1, 2026-09-26)

- `codex exec` runs an agent non-interactively. Codex has a built-in image generation tool; asked plainly, the agent uses it (not SVG/code), writes the PNG under `~/.codex/generated_images/<session>/...png`, then copies it to the path you asked for.
- Command used per job:
  ```text
  codex exec --skip-git-repo-check -s workspace-write -i ref1.png -i ref2.png -
  ```
  - `-` reads the prompt from **stdin** (avoids Windows command-line length and quoting problems with long prompts).
  - `-i` attaches real screenshots as style references.
  - `-s workspace-write` lets it copy the file into the project; nothing else is needed.
- Timing: one job ~6-7 minutes. Seven jobs started 2 s apart all finished in ~6.5 minutes total, so run them in parallel.
- Sizes that worked: 1024x1024, 1536x1024, 1024x1536. Build every other size by cropping (`build_assets.py`).
- Prerequisite: `codex` installed and logged in (`codex login`). Run a single tiny test job first.

## Smoke test

```powershell
codex exec --skip-git-repo-check -s workspace-write "Use your built-in image generation tool (not code, not SVG) to generate one image: <subject>, no text. Save the resulting PNG to marketing/raw/_test.png. Reply with only the saved path."
```
Check that the file exists and looks right, then delete it.

## Prompt contract (what `run_codex_jobs.py` sends)

```text
You are generating marketing art. Use your built-in image generation tool (do not draw with code,
SVG, canvas or Python; do not download images). Generate exactly ONE image, orientation/size <size>.
[transparent request if background=transparent]
STYLE BRIEF: <jobs.style>
IMAGE: <job.prompt>
When the image is generated, copy the PNG file to this exact path: <job.out> - overwrite if it exists.
Do not create any other files. Reply with only the saved path.
```

## jobs.json schema

```json
{
  "style": "shared art-direction brief, palette, props, safety rules",
  "jobs": [
    { "id": "icon", "out": "marketing/raw/icon.png", "size": "1024x1024",
      "refs": ["marketing/ref/hero.png"], "background": "transparent (optional)",
      "prompt": "one-image description + composition + safe areas + 'no text'" }
  ]
}
```

Standard job set: `icon` (1:1), `cover-landscape` (3:2 -> 16:9 crops), `cover-portrait` (2:3 -> 9:16 crops), `cover-square`, `logo` (transparent wordmark), plus optional key art (`boss`, `lineup`, feature art).

## Operating rules

- Logs per job: `<out>/_jobs/<id>.log`. On failure read the tail; typical causes are auth, quota, or the agent refusing unsafe content.
- Re-run only what failed or looks wrong: `run_codex_jobs.py jobs.json logo cover-square`.
- Always review raw images yourself before building: spelling in the logo, extra text/letters in art, wrong vehicle colours, anything the game doesn't contain.
- The image agents write into the project: make sure dev-server file watchers ignore the output folder (pitfalls #1).
- Keep `jobs.json` and logs as provenance of how each asset was made.
