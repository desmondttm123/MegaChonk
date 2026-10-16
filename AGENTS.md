# Mega Chonk Contributor Instructions

These instructions apply to the whole repository. They are a handoff for coding
agents and human contributors, not a running service or autonomous background job.

## Start Every Session

1. Read [MEMORY.md](MEMORY.md) for where work stopped, decisions, and deferred work.
2. Read [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md) for setup and verification.
3. Check `git status --short`, the current branch, and recent commits before editing.
4. Inspect the relevant source. Treat memory as context, not proof that the code or live deployment is unchanged.
5. Follow the latest user request. Do not silently turn deferred ideas into approved work.

## Product Direction

- Keep the name Mega Chonk and the house setting, not a dungeon.
- Use the Turkish Van as the sole default runtime cat: mostly white, brown ears/tail/markings, large dark night pupils.
- Preserve real skinned 3D rendering and interpolated skeletal animation. Do not revert to directional sprites, low-poly placeholders, or a different model just because its filename says v2/v3.
- Aim for believable feline proportions and smooth third-person controls inspired by Stray. Do not use proprietary Stray assets or claim the prototype is AAA quality.
- Keep hunger/chonk changes gradual and eating much faster than movement drain. Balanced condition should feel fastest; hungry/heavy cats have limited jumps.
- Preserve three completable rooms, upstairs routes, optional catnip jumps, and seeded obstacles with reachable objectives.

## Source Map

| Area | Source of truth |
| --- | --- |
| Gameplay, physics, world, animation playback, HUD | `game.js` |
| Mouse input filtering and angular smoothing | `camera-controls.js` |
| Seeded obstacle placement and protected routes | `course-generator.js` |
| Page shell and styling | `index.html`, `styles.css` |
| Active cat asset pipeline | `tools/generate_stray_style_cat.py` |
| Active runtime/editable cat | `assets/models/turkish-van-game-cat.glb`, matching `.blend` |
| Runtime-only Pages package | `tools/build_pages.py` |
| Deployment | `.github/workflows/pages.yml` |
| Browser verification | `tools/*test.js` |

## Engineering Guardrails

- Preserve unrelated changes, experimental assets, licenses, and source files. Never clean the worktree by deleting or reverting someone else's work.
- Keep runtime URLs relative so GitHub Pages works under `/MegaChonk/`. Do not add a bundler, backend, Unity dependency, or package-manager migration without a reason tied to the requested work.
- Change procedural generators as well as their generated assets when modifying the cat. Keep GLB, Blender source, and inspection previews in sync.
- Run Blender in a separate background process with factory startup. Never read, change, or overwrite the user's currently open scene.
- Keep the Jonas Dichelle CC BY 3.0 attribution and Three.js license in the repo and deployment. The sitting printable cat is a separate asset, not the runtime rig.
- Keep vertex colors on the POINT domain in the Blender 3.4 cat exporter; earlier CORNER-domain exports scrambled coat colors.
- Scale collision dimensions, camera framing, and related props with character/world changes. Scaling a Three.js group alone does not update world-space collider records.
- Do not apply raw mouse deltas directly to yaw/pitch. Preserve capture/focus guards, finite-value checks, rate limits, queue clearing, and camera collision recovery.
- Keep render geometry, collision, support surfaces, and moving-platform ownership aligned. Preserve capsule depenetration and gallery underside collision fixes.
- Keep generated obstacles outside protected routes and full moving-hazard envelopes. Do not make optional snacks a requirement for opening a pet door.
- Never publish credentials or store tokens in handoff notes. Git pushes and deployment/settings changes require the user's authorization; these files do not grant it.

## Verify Before Handoff

Use the change-specific matrix and commands in [CONTRIBUTING.md](CONTRIBUTING.md).
Report exactly what ran and what was skipped. A successful Pages workflow checks
syntax and packaging, not the full browser suite. Do not describe isolated tests
that place the cat at scenario starts as full no-teleport gameplay runs.

Test screenshots can update tracked files. Inspect the diff before staging;
do not commit unrelated assets simply because a test regenerated an image.
Keep `dist/`, caches, dependencies, logs, and Blender backup files out of Git.

## Maintain The Memory

Update [MEMORY.md](MEMORY.md) at the end of every meaningful contribution:

1. State what changed and the latest completed request.
2. Record relevant decisions, regressions fixed, and canonical assets/paths.
3. Record tests, seeds, outcomes, and any skipped or inconclusive checks.
4. Separate implemented work, known limitations, deferred ideas, and the next approved step.
5. Record commit/deployment evidence when available; distinguish inspected local state from a verified live revision.

Keep memory concise and curated. Replace obsolete current-state notes rather than
appending every terminal message. Use verification documents for detailed evidence
and Git history for the complete changelog. Never invent a completed test or task.

Memory is persisted by updating and committing these files. There is no automatic
memory database, background agent, or requirement that a contributor have access
to the original chat.
