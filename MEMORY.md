# Mega Chonk Project Memory

Last updated: 2026-10-17 (Asia/Singapore).
Baseline inspected for the latest adventure update: `3c9260e` on `main`.
Read current Git history before relying on that baseline; this file is not a live
deployment status feed.

## Resume Here

- Latest request: fair generated jump obstacles, a reusable vacuum boss after room three, persistent accessories, and enemies with guaranteed drops. The local adventure implementation is described in [adventure system](docs/adventure-system.md).
- The third pet door now starts the vacuum encounter instead of completing the run. Claw the rear filter; front suction costs one of nine lives. Retry after nine losses resets only the fight. The boss remains winnable without equipment.
- Room-tier collars add pace and survive combat deaths; pendants add claw damage/hunger efficiency and are lost on combat death. Both persist across rooms for the current run. Optional clockwork mice warn/pounce and drop a snack or pendant on defeat. Ordinary environmental bumps remain nonlethal.
- Shared jump rules validate generated hurdles/bridge approaches and reserve takeoff/landing space. Clear objective corridors and stairs remain available to hungry/heavy cats; equipment does not bypass their jump restrictions.
- The user authorized pushing all adventure changes on 2026-10-17. Release is in progress; verify the Pages workflow, public manifest, and relevant hosted behavior before recording it as released. Verification results and limitations are in [adventure verification](docs/adventure-verification.md). The active cat asset is unchanged; desktop/touch controls remain supported.
- Adventure rules/integration, 90 generated layouts, smoke/camera, vertical/visual, expanded phone controls, and local Pages checks passed. Full campaign seeds `424242` and `765432` both finished with 12 meals, 850 XP, no deaths, and the boss defeated; a separate keyboard fight also won without any equipment. Scenario setup is explicitly distinguished from no-teleport autoplay in the verification notes.
- The previous mobile release is `39d9265` with evidence-only follow-up `3c9260e`; both deployed successfully. The mouse-spike fix is `cecfb02`. Physical Android/iPhone Safari checks remain outstanding; do not claim hardware performance from emulation.
- Multiplayer and extra coat variants are still deferred, not approved next tasks. Wait for user feedback or a new request rather than implementing them automatically.

## Product Decisions

- Name: **Mega Chonk**. Single-player browser game with desktop keyboard/mouse and optional phone virtual controls.
- Visual direction: a believable Turkish Van, mostly white with chestnut ears/tail/patches, smooth animated limbs, subtle idle life, and large dark night-adapted pupils. Stray is a quality/control reference, not an asset source.
- The user rejected boxy cats and rigid frame-by-frame sprites. The active character is a real skinned GLB rendered in Three.js. More polygons alone are not the solution to anatomy, clipping, or animation problems.
- The setting is a house with furniture and vertical exploration, not a dungeon. There are three rooms: Living Room Zoomies, Kitchen Counter Caper, and Attic Midnight Run.
- Eat every required bowl, then reach the pet door. Room meal counts are 3/4/5: 12 total, with one upstairs in each room. The third door leads to the vacuum boss. Base completion earns 850 XP including the boss's 250 XP, before optional bonuses.
- Eating restores satiety rapidly and adds chonk. Movement drains satiety/weight slowly; balanced condition is fastest. Satiety at or below 8 or chonk at or above 90 blocks jumping.
- WASD/arrows move relative to the camera; W moves away from it, showing the cat's back. Shift trots, Space jumps, Q sits, F/LMB claws, E/RMB bites. Five idle seconds trigger grooming; movement interrupts it and automatic eating immediately.
- Touch uses a left analog joystick, right-side swipe to look, action buttons, and a latched Trot toggle. Use Trot + Jump for longer jumps. Do not require pointer lock or synthesize sticky WASD keys for touch input.
- Claw and bite damage clockwork mice at animation impact time. Only rear-facing claws damage the vacuum. This is a basic combat/equipment foundation, not a finished RPG, networking, or inventory-menu system.
- Equipment is run-scoped in memory, not saved across reloads. Combat death loses the pendant, not the collar. Nine suction losses require a boss retry; ordinary room hazards do not spend boss lives.

## Current Technical State

| Area | Current implementation |
| --- | --- |
| Stack | Buildless JavaScript modules, locally bundled Three.js, no runtime backend |
| Gameplay | `game.js`: world construction, collisions, support surfaces, condition, progression, animation, UI |
| Camera | `camera-controls.js`: filtered input consumed per frame; `game.js`: follow camera and collision recovery |
| Touch | `touch-controls.js`: pointer capture, analog movement, look smoothing, buttons, mode/lifecycle state; `window.__megaChonk.touchSnapshot()` is a test/debug hook |
| Adventure rules | `adventure-rules.js`: run equipment/ownership, boss phase/attack/weak-point registries, health/lives/retry |
| Adventure visuals/AI | `adventure-world.js`: original procedural vacuum, optional clockwork mice, pickups, loot and animation-impact interactions |
| Jump planning | `jump-rules.js`: runtime pace/impulse and conservative generation envelope (38 satiety, 75 chonk, no equipment/catnip) |
| Generation | `course-generator.js`: seeded layouts, grid routes, reserved corridors and swept obstacle envelopes |
| Character | `turkish-van-game-cat.glb`: 193,136 triangles, 24 skinned meshes, one armature |
| Animation clips | Idle, Walk, Groom, Sit, Jump, Claw, Bite |
| House scale | Floor 46 x 42, ceiling 7.2; cat scale 0.84, capsule radius 0.24, height 0.76; bowls scale 0.70 |
| Vertical route | Gallery height 2.7; 18 stairs with 0.15 rise; protected launch/return shelves |
| Catnip | Optional; 18 seconds of 1.32x speed and 1.18x jump impulse; regrows after 22 seconds; cannot bypass condition limits |
| Course counts | 25/30/37 generated obstacles across the three rooms in verified layouts |
| Debug/test hooks | `window.__megaChonk`: state, navigation, snapshot, cameraSnapshot, seeded regeneration, scenario helpers |

Obstacles, sizes, phases, and some meal positions vary by seed. The structural
stairs/gallery/catnip jump route is intentionally authored and protected, not a
fully random building generator. Floors and collision bounds are world-space.

## Canonical Assets And Pitfalls

- Edit `tools/generate_stray_style_cat.py` to regenerate the active `assets/models/turkish-van-game-cat.blend` and `.glb`, plus `assets/models/game-cat-previews/`.
- Artist instructions: [artist cat guide](docs/artist-cat-guide.md). The from-scratch generator overwrites canonical files and does not read a manually edited `.blend`. Keep artist candidates separate; an accepted manual workflow must explicitly preserve an authoritative source and repeatable export recipe/tool rather than regenerating from the old FBX. No pipeline switch has been made yet.
- Runtime `loadCat()` replaces `TurkishVan.Fur` with vertex-color/procedural-bump shading. Texture-based upgrades need a coordinated material-loader and test update; a better Blender material/render alone will not carry through unchanged.
- Blender 3.4 runs in background mode with `--factory-startup`; it must not touch the user's open Blender scene.
- The active base mesh is Jonas Dichelle's CC BY 3.0 cat at `assets/models/source/jonas-dichelle-cat/cat.fbx`. Preserve source attribution and `credits.html`; no Stray assets are included.
- POINT-domain coat/iris vertex colors avoid the Blender 3.4 CORNER export bug. Keep normalized skin weights and verify all seven clips after export/re-import.
- The face now uses larger almond apertures, round nearly black pupils, a thin amber rim, deeper sockets to avoid lower-eye clipping, and skeletal eyelid blinks.
- Earlier foreleg work raised the elbows, added scapula articulation, smoothed joint weights, reduced paw lift, and improved grooming paw-to-muzzle alignment. Avoid undoing these by switching pipelines.
- `generate_rigged_cat_v2.py`, `generate_rigged_cat_v3.py`, matching v2/v3 assets, standing CC0 assets, and sprite sheets are historical experiments, now tracked. They are not the active pipeline; do not remove them without agreement.
- `generate_sitting_cat_blender.py` and the sitting STL/OBJ are a separate printable-model task. STL has no standard material-color support; colors live in Blender/OBJ materials.
- PNG writes can hit transient Windows locks. Use `tools/capture-screenshot.js` for test captures; the active Blender generator renders to temporary PNGs and replaces completed files.

## Recent Changes

| Commit | Handoff significance |
| --- | --- |
| `71899df` | Animated runtime cat, upstairs routes, catnip, attribution, runtime-only GitHub Pages deployment |
| `f5dc901` | Nearly doubled floor area; cat 37% smaller; protected seeded courses; larger dark night eyes |
| `cecfb02` | Mouse-spike filtering, frame-based smoothing/rate limits, capture/focus guards, camera collision recovery |
| `ef96e40` | Check-in of older experimental assets/tools; active gameplay remains the above version |
| `ee37670` | Repository contributor instructions, persistent memory, setup/test/release handoff |
| `a7a626d` | Artist instructions covering manual/source ownership, rig/material/export constraints, and delivery |
| `39d9265` | Mobile joystick/look/actions, responsive phone layouts, lifecycle cleanup, automated touch verification; deployed and tested live |
| `3c9260e` | Successful live mobile/camera/Pages verification evidence and refreshed captures; same runtime as `39d9265` |
| Local, uncommitted | Vacuum finale, equipment/death/loot, clockwork enemies, shared fair-jump planning, combat tests and contributor guidance |

Mouse regression details: old code directly applied every `movementX/Y` event;
an oversized sample rotated yaw by -28.2 radians. A small furniture-corner orbit
also switched the requested camera distance from about 1.25 to 3.38 units.
The fix rejects invalid/oversized deltas, guards lock/focus changes, clears queues,
reduces sensitivity, limits rotation speed, and eases collision-distance recovery.
Do not put direct raw-delta angle updates back into `setupInput()`.

Other regressions to preserve: capsule depenetration when leaving a platform,
gallery underside sweeps, walkable stairs even when jumping is blocked, movement
interrupting food/grooming, and destination-floor planning in the autoplay bot.

## Recorded Verification

The table below records earlier implementation sessions. Current mobile-input
checks are in [mobile verification](docs/mobile-controls-verification.md); latest
adventure checks/autoplay are in [adventure verification](docs/adventure-verification.md).
Re-run relevant tests after changing behavior; do not treat historical results as
evidence for an untested checkout.

| Check | Last recorded result |
| --- | --- |
| Blender export/re-import | 193,136 triangles, 24 skinned meshes, one armature, seven clips |
| Gameplay smoke | Passed model loading, orientation, action states, grooming/eating interruption, condition limits, levels |
| Visual inspection | Four angles and 19 sampled poses; no sampled floor penetration; night eyes/blinks checked; approximately 59.9 FPS locally |
| Generation | 90 layouts (30 seeds x three rooms), deterministic replay, obstacle clearance, reachable lower objectives/stairs/exits; moving-platform carry checked |
| Full autoplay `424242` | 12 meals, 600 XP, 8 jumps, 0 bumps, about 2m 34s after scale/generation changes |
| Full autoplay `765432` | 12 meals, 600 XP, 7 jumps, 0 bumps, about 2m 33s with final eye export |
| Vertical challenges | Stairs in every room, hungry/heavy stair access, normal vs boosted leap, three return shelves, boost expiry, underside collision |
| Camera regression at `cecfb02` | Local and live pass: native/small motion, invalid samples, input bursts, focus recovery, three capture cycles, 30/60/144 FPS input consistency, furniture-corner recovery |
| Pages at `cecfb02` | Live revision and model hash confirmed; three rooms, movement/jump, no browser errors; 26 runtime files, about 12.45 MB |

Full autoplay uses actual keyboard navigation without teleporting to meals.
Isolated vertical/platform tests place the cat at scenario starts. Sampled mesh
inspection is not an exhaustive intersection test, and local FPS is not a promise
for every device. Full autoplay was not rerun for the later mouse-only fix;
camera, smoke, and Pages checks were run instead.

Detailed evidence: [cat verification](docs/cat-upgrade-verification.md) and
[camera verification](docs/camera-controls-verification.md).
The old [asset brief](docs/cat-asset-brief.md) contains early triangle/clip targets;
those are not the current runtime specification.

## Hosting And Release

- Repository: https://github.com/desmondttm123/MegaChonk (the account ends in `123`).
- Live game: https://desmondttm123.github.io/MegaChonk/.
- `main` pushes trigger `.github/workflows/pages.yml`. Pages uses the Actions deployment source.
- `python tools/build_pages.py` follows actual module imports and packages only runtime assets/licenses into ignored `dist/`, with revision/hash metadata.
- Do not upload the whole repo as the website: Blender/FBX/STL, experiments, sprite sheets, and test captures are not required at runtime.
- CI checks module syntax and builds/deploys; it does not run the Playwright regression suite. Confirm the workflow and live build manifest when verifying a release.
- Runtime revision `39d9265cb67a4a3453ee00f544b922a523910f09` passed hosted mobile/camera/Pages checks on 2026-10-16. The evidence-only follow-up `3c9260e62025a55bf204a28bf35843ff7e12ced8` also deployed successfully, with the public manifest and unchanged runtime hashes checked. [Final release workflow](https://github.com/desmondttm123/MegaChonk/actions/runs/38854555719).
- That mobile deployment has 27 runtime files, approximately 12.47 MB. The verified local adventure package has 30 runtime files, approximately 12.51 MB. No model regeneration was needed. CI now includes adventure module syntax and pure rules tests, but not browser autoplay. This does not mean the new CI workflow has run on GitHub yet.

## Deferred Or Limited

- Multiplayer/two-browser interaction was discussed and explicitly postponed. No networking implementation exists.
- Tuxedo, calico, and orange-tabby options were requested earlier, then superseded by using only the Turkish Van to save resources. No coat selector is currently shipped.
- Phone controls are implemented and tested with browser-dispatched multi-touch in Windows Edge/Chromium emulation. Actual Android/iOS hardware and Safari behavior/performance still require manual verification; desktop browser test launchers still assume Windows Edge.
- The game remains a stylized prototype, not production AAA quality. Continue improving anatomy/animation and environment quality only against a concrete request.
- The adventure contribution's release is authorized and in progress. New bosses, more levels, saved inventories, and additional enemy types are not automatically approved next tasks. Physical-phone playtesting and user feedback remain useful follow-up.

## Updating This Handoff

Keep this file current when contributing. Record the latest request, actual
changes, tests/seeds, limitations, deployment evidence, and exact next approved
step. Remove superseded current-state facts; do not turn memory into a transcript.
