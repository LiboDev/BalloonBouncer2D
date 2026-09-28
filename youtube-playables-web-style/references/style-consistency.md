# Style Consistency

## Build a visual grammar

Define a few rules that every asset follows.

### Geometry grammar

Example:

- all hard objects use bevelled edges
- no feature thinner than 3% of the object's width
- circular details are oversized
- background props use 60–80% of foreground saturation

### Shading grammar

Example:

- one key light from upper left
- soft ambient fill
- no detailed baked shadows in 2D sprites
- highlights are broad rather than sharp

### Outline grammar

Pick one:

- no outlines
- dark outlines everywhere
- colored outlines based on local fill
- silhouette-only outline shader

Do not mix styles casually.

### Palette grammar

Assign semantic roles:

- player
- friendly/goal
- enemy/hazard
- reward
- neutral environment
- disabled/inactive

## AI consistency packet

When prompting image generation, reuse:

- the same style paragraph
- the same camera angle
- the same palette description
- the same rendering vocabulary
- reference images when supported

Do not rely on phrases such as “same style as before” without giving the model actual context.

## Runtime consistency

Where possible, recolor or shade assets in-engine so one asset source can produce multiple variants without style drift.
