# 3D Visual Style

## Target look

Use **soft low-poly / toy-like 3D** optimized for readability and inexpensive real-time rendering.

Think in terms of shape, color, light, and motion—not texture detail.

## Geometry

Prefer:

- primitive-derived meshes
- bevelled boxes
- chunky cylinders
- low-segment spheres
- extruded 2D profiles
- simple modular kits

Add geometry only when it changes the silhouette or communicates function.

## Materials

Use a tiny material vocabulary:

- matte plastic
- glossy plastic
- painted metal
- stone
- glass/ice
- emissive energy/fire

Each material should be distinguishable at a glance.

Default material treatment:

- medium-to-high roughness for most objects
- restrained metallic surfaces
- broad highlights
- minimal texture maps
- vertex colors or small reusable textures where possible

## Lighting

Default setup:

- one dominant directional/key light
- soft environment/hemisphere fill
- ambient occlusion or contact shadowing if inexpensive
- optional rim light for hero objects

Gameplay clarity beats realism.

Avoid:

- dark cinematic scenes
- many realtime lights
- tiny moving shadows
- lighting that makes interactables blend into the environment

## Camera

For casual play:

- orthographic or mild perspective for puzzle/board games
- 30–50° downward angle for arena/runner/isometric scenes
- moderate FOV rather than aggressive wide-angle distortion
- camera framing that keeps the primary mechanic large on screen

Use screen-space size as a design constraint. The player object should rarely become visually insignificant.

## Color separation

Separate important classes by material/color before relying on icons or text.

Example hierarchy:

- player / main object → strongest unique color
- targets → second distinctive family
- hazards → warm or high-contrast family
- environment → quieter neutral family

## Destruction and deformation

For crash/destruction games, use stylized deformation rather than simulation-heavy realism:

- swap between damage mesh states
- scale/compress child sections
- detach pre-fractured chunks
- spawn lightweight debris
- add brief hit flash
- use particles to sell force

The *perception* of impact matters more than physically exact deformation.

## Environment design

Build from reusable modules:

- road segment
- platform
- wall
- ramp
- barrier
- pillar
- prop cluster
- background silhouette

Vary composition, height, rotation, and palette rather than creating unique geometry for every level.

## Animation

Use procedural animation whenever possible:

- bob/tilt
- squash/stretch
- steering lean
- wheel spin
- spring motion
- recoil
- object wobble
- impact impulses

Use skeletal animation only where it materially improves the game.
