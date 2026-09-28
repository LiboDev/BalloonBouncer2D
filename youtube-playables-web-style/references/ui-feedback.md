# UI and Gameplay Feedback

## UI principles

The UI should feel like part of the game, not a website layered on top.

Prefer:

- large rounded cards/buttons
- short labels
- icons plus numbers
- generous spacing
- highly legible health/progress bars
- immediate hover/press feedback

## Visual hierarchy

Typical order:

1. gameplay
2. current objective / target
3. health / progress / score
4. upgrades / temporary choices
5. secondary settings

Do not let persistent UI cover the main play area.

## Health bars

For enemies or destructible targets:

- place directly above/near the object
- keep width visually tied to object size
- animate value changes quickly
- briefly emphasize damage with a flash, shake, or trailing value

## Upgrade cards

Each upgrade should communicate its gameplay identity visually.

Examples:

- ball → smooth round icon, bounce lines
- saw blade → radial teeth, spin lines
- fireball → hot core + flame trail
- black hole → dark center + orbital ring

Keep each card to one dominant icon, name, and 1–2 short stat/effect lines.

## Buttons

States should be obvious:

- default
- hover/focus
- pressed
- disabled
- selected

Use scale, elevation, highlight, and saturation changes rather than subtle border-only changes.

## Feedback channels

Important events should combine at least two of:

- motion
- particle effect
- color flash
- sound
- UI number/bar change
- camera impulse

Do not fire every channel at maximum intensity for routine events.
