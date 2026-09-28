# 2D Visual Style

## Target look

Aim for **clean cartoon/vector art with game-like exaggeration** rather than illustration-heavy detail.

### Shape language

- Build characters and props from large, simple masses.
- Prefer circles, rounded rectangles, chunky polygons, and clear silhouettes.
- Exaggerate important gameplay features: blades, bumpers, balloons, pickups, hazards.
- Avoid small internal details unless they communicate gameplay state.

### Rendering

Preferred order:

1. flat fills
2. one simple shadow tone
3. one highlight tone
4. optional outline or rim treatment
5. limited texture only where it adds material identity

Avoid painterly micro-detail, photographic texture, and subtle gradients that disappear at small scale.

## Palette

- Use a small palette per scene.
- Give interactable object classes distinct color families.
- Reserve high-saturation accent colors for goals, rewards, damage, and upgrades.
- Keep backgrounds quieter than interactive objects.

A strong default is:

- neutral/light environment base
- 3–5 primary gameplay colors
- 1 reward/accent color
- 1 danger color

## Depth and readability

Even flat games should have depth cues:

- soft drop shadows
- scale changes
- foreground overlap
- light ambient gradients
- occasional rim light/highlight

Keep the playfield readable when viewed at 25–33% of its normal size.

## Characters

For casual web games:

- oversized head or core body mass
- simplified hands/feet
- 2–4 expression states instead of subtle facial animation
- strong pose silhouettes
- squash/stretch over detailed frame animation

## Props and hazards

Props should visually explain their behavior.

Examples:

- ice → pale cyan, gloss, cracks/frost
- metal → gray/silver, strong highlight, bolts/rivets
- stone → chunky facets, muted gray/brown
- fire → warm emissive center + particle trail
- black hole → dark center + bright ring + inward streaks

## Backgrounds

Background detail should be subordinate.

Prefer:

- repeated tile motifs
- simple parallax layers
- sparse props
- gradients
- large environmental shapes

Avoid decorating every empty region.

## Animation

Prioritize readable game states over realism:

- idle: subtle bob/breath
- hover/selection: scale pulse or glow
- hit: squash + flash + knockback
- destroy: silhouette break + particles
- reward: pop + arc + sparkle

Use motion curves with noticeable anticipation and overshoot.
