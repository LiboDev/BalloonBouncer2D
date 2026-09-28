# Game Feel and VFX

## Principle

Make actions feel disproportionately responsive relative to the simplicity of the art.

## Impacts

A strong lightweight impact recipe:

1. contact flash
2. 1–3 frame squash/scale impulse
3. short camera shake or positional kick
4. small debris burst
5. velocity change
6. sound hit

## Destruction

Use layered feedback:

- object cracks or changes state before destruction
- fragments inherit outward velocity
- dust/spark/confetti burst matches material
- shadow disappears with object
- nearby lightweight objects receive impulse

For nonviolent/all-ages themes, prefer confetti, foam, shards, stars, paper, sparkles, elemental fragments, or stylized debris over gore.

## Chain reactions

Make causal links visually obvious:

- expanding rings
- projectile trails
- directional sparks
- brief slow-motion on major cascades
- combo counter near the action

## Particles

Particles should be short-lived and directional.

Prefer many cheap sprite particles over expensive simulation.

Material-specific examples:

- ice → pale shards + frost puff
- metal → sparks + gray chips
- stone → dust + chunky fragments
- balloon → membrane scraps/confetti + pop ring
- fire → ember trail + smoke puff

## Screen effects

Use sparingly:

- chromatic distortion
- bloom bursts
- vignette
- full-screen flash
- large camera shake

Reserve stronger effects for milestones, bosses, rare upgrades, or large chain reactions.
