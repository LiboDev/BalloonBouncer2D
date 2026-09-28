---
name: youtube-playables-web-style
description: Visual art-direction skill for building lightweight 2D and 3D web games in the YouTube Playables / hybrid-casual visual language. Use when designing, implementing, reviewing, or generating art for browser games where instant readability, bright stylization, satisfying feedback, and thumbnail clarity matter.
---

# YouTube Playables Web Style

Use this skill to make browser games look intentional, readable, lightweight, and immediately understandable.

## Core rule

Optimize for **instant comprehension before visual complexity**.

The player should understand the main object, goal, danger, and interaction within roughly one glance. Prefer a small coherent visual system over many detailed assets.

## Routing

Read only the references needed for the current task:

- **2D game, sprites, vector art, flat-shaded scenes:** `references/2d-style.md`
- **3D game, low-poly scenes, materials, lighting:** `references/3d-style.md`
- **Thumbnail / store tile / discovery image:** `references/thumbnails.md`
- **HUD, menus, buttons, health bars, upgrade cards:** `references/ui-feedback.md`
- **Particles, impacts, explosions, destruction, juice:** `references/game-feel.md`
- **How to implement the look efficiently on the web:** `references/web-implementation.md`
- **AI-generated images, textures, sprites, concepts:** `references/ai-asset-pipeline.md`
- **How to keep style consistent across generated assets:** `references/style-consistency.md`
- **Before shipping or reviewing visuals:** `checklists/visual-review.md`
- **Starting a new game:** fill `templates/style-brief.md`
- **Prompting an image model:** adapt `prompts/visual-generation.md`

## Default visual direction

When the user gives no stronger art direction, default to:

- bright hybrid-casual presentation
- clean silhouettes
- large readable shapes
- limited material/texture complexity
- exaggerated scale and motion
- minimal background clutter
- strong subject/background separation
- toy-like rather than photorealistic rendering
- rounded UI and large touch-friendly controls
- clear, satisfying particles and state changes

Do **not** blindly imitate a specific existing game. Translate the desired qualities into an original visual system.

## Workflow

1. Identify whether the game is primarily **2D or 3D**.
2. Define the visual hierarchy: player/object → goal → hazard → secondary decoration.
3. Choose a tiny palette/material system before creating individual assets.
4. Prototype gameplay using primitives or placeholder sprites first.
5. Apply the final style consistently through reusable shaders/materials/components.
6. Add feedback effects only after the core scene reads clearly.
7. Test at gameplay size **and at thumbnail size**.
8. Run `checklists/visual-review.md` before finalizing.

## Non-goals

Avoid by default:

- photorealism
- noisy textures
- thin silhouettes
- tiny critical UI
- low-contrast foreground/background combinations
- complex lighting that hides gameplay
- inconsistent AI-generated art styles
- decorative detail that materially increases load time without improving readability
