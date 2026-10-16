# Turkish Van Cat Asset Brief

This is the original design brief, not the current export contract. Artists
should follow the [current artist guide](artist-cat-guide.md) for active files,
the existing rig/actions, material limitations, and game-ready delivery. In
particular, the early triangle targets and clip names below are historical.

## Goal

Create a high-resolution hero cat for a browser game, then ship an optimized runtime version without losing the silhouette or coat identity.

## Character target

- Breed direction: Turkish Van
- Coat: mostly white
- Markings: brown patches around both ears, full brown tail, a few brown body patches
- Build: athletic domestic cat, elegant but not exaggerated
- Fur: medium-long, clean silhouette, fluffy tail
- Style target: believable and appealing, not low poly, not toy-like

## Asset strategy

Do not treat this as a single low-detail game mesh.

Use a two-stage asset:

1. High-quality source model for sculpt, fur breakup, and texture baking
2. Optimized game mesh for browser runtime in `GLB`

Recommended target:

- Source model: high detail in Blender or equivalent
- Runtime mesh: roughly `20k` to `45k` triangles for the cat body
- Textures:
  - `2048x2048` albedo
  - `2048x2048` normal
  - `1024x1024` roughness/packed masks

This is enough to look clean in a close third-person or orbiting camera without becoming too expensive for the web.

## Required animation set

### Must have now

- `idle_base`
- `walk_forward`
- `walk_backward`
- `walk_left`
- `walk_right`
- `groom_lick`

### Strongly recommended next

- `eat_loop`
- `eat_end`
- `turn_left_in_place`
- `turn_right_in_place`

## Idle behavior spec

- After 5 seconds of no movement input, transition from `idle_base` to `groom_lick`
- `groom_lick` should loop cleanly
- Any movement input interrupts the groom animation immediately

The grooming pose should be compact and readable from a gameplay camera, not a fully curled sleeping pose.

## Rigging notes

- Keep root motion optional; in-place clips are safer for the first prototype
- Root at ground center between fore and hind legs
- Stable spine, neck, tail, and ear bones
- Tail needs enough joints to feel alive in idle and walk
- Favor a clean deformation rig over fur simulation

## Runtime conventions

- Forward axis must be consistent across all clips
- Apply transforms before export
- Keep pivot at ground contact for easy placement
- Export final runtime asset as `GLB`
- Keep hierarchy names stable

## Modeling prompt

Use this as the generation or modeling brief:

> Create a high-resolution 3D Turkish Van cat for a browser game. The cat is mostly white with warm brown patches around the ears, a full brown tail, and a few brown patches on the body. Keep the anatomy realistic and elegant, with medium-long fur and a fluffy tail. The result must feel like a believable domestic cat, not low poly, not chibi, and not overly stylized. Include a neutral standing pose suitable for rigging, plus reference for a grooming pose where the cat licks itself.

## Animation prompt

> Create a clean game-ready locomotion and idle set for the Turkish Van cat. Include a neutral idle, a readable walking posture for movement in all directions, and a looping grooming animation where the cat licks itself after 5 seconds of inactivity. Grooming must stop instantly when movement begins. Keep the motion natural and appealing, with the cat fastest at medium satiety and slightly slower when hungry or overfull.
