# Turkish Van Character Verification

Verified locally on 2026-10-16 with Blender 3.4.1 and headless Microsoft Edge at 1440 x 900.

## Character

- Runtime: real skinned GLB rendered by Three.js; no directional sprite frames.
- Export: 193,136 triangles, 24 skinned meshes, one armature, seven action clips.
- Clips: Idle, Walk, Groom, Jump, Sit, Claw, Bite.
- GLB re-imported successfully into a clean Blender scene.
- Four skin influences per vertex; Blender previews and runtime use the same weights.
- Forelegs have higher elbows, scapula bones, localized weight smoothing, reduced swing lift, and toe articulation. The enlarged eyes use curved almond surfaces, round dilated night pupils, thin amber iris edges, deeper sockets, and eyelid bones; the muzzle has a rounded nose and tapered whiskers.
- The base mesh is credited to Jonas Dichelle under CC BY 3.0 in the bundled attribution.

## Browser Checks

`tools/smoke-test.js` passed after the final export. It checked model loading, white paw colors, all seven action states, W moving away from the camera, satiety drain, hungry/heavy jump limits, all three generated levels, and movement interrupting grooming.

`tools/visual-cat-test.js` passed after the final export. It captured four camera angles and inspected 19 animation poses across idle, walk, sit, and grooming. Sampled body vertices stayed above the floor, with the lowest sample approximately 0.00009 game units above it. This samples every seventeenth body vertex; it is not an exhaustive triangle-intersection test.

The idle blink was also verified in the browser: both eyelid bones contracted to approximately 0.106 of their open height, with a separate inspection screenshot.

Both exported eyes have approximately 79% near-black color vertices and an aperture height of 0.0423 model units, versus the previous approximately 0.031 height. The Blender close-up was reviewed after deepening the sockets to remove lower-eye surface clipping.

The same inspection measured a median 59.9 FPS and a 95th-percentile frame interval of 16.8 ms over 120 frames. These are local measurements, not a performance guarantee on other hardware.

## Autoplay

`tools/autoplay-test.js 424242` completed all three rooms using keyboard movement and jumping:

- 12 meals consumed.
- 8 jumps.
- 600 XP and the completion screen reached.
- Zero bumps, no unreachable objectives or browser errors, and a completion time of 2 minutes 34 seconds.

Autoplay included every required upstairs meal in the enlarged house and traversed stairs with keyboard input, without teleporting to objectives. Its route planner reads the current world bounds and cat capsule dimensions and uses the destination floor rather than transient jump height. The final eye-socket adjustment changes only the facial geometry; the final exported model was rechecked with the visual and Pages tests.

The earlier capsule-depenetration fix remains in place so walking off an ottoman does not trap the cat at its edge.

A second complete keyboard autoplay on seed `765432`, using the final model export, also passed: 12 meals, 600 XP, seven jumps, zero bumps, and 2 minutes 33 seconds. Neither run teleported to objectives.

## Scale And Generation

- Floor footprint increased from 34 x 29 to 46 x 42 units, a 96% area increase.
- Cat model scale reduced from 1.34 to 0.84; collision radius is 0.24 and body capsule height is 0.76. Camera framing, bowl size, and ground shadow were adjusted accordingly.
- Hurdles, spills with moving bridges, rotating vacuums, and mixed cushions/stools/boxes are generated from the run seed, rather than individually positioned per room.
- `tools/generation-test.js` passed 90 layouts (30 seeds x three rooms), including exact same-seed reproducibility, all expected obstacle types/counts, no overlapping generated footprints, and clear protected corridors.
- Independent routes were found through the final collision geometry and full hazard envelopes to each lower objective, staircase entry, and exit. The upstairs structure and optional catnip leap remain authored and protected.
- Generated obstacle counts were 25, 30, and 37 in the tested rooms. Difficulty increases obstacle density and hurdle heights.
- A generated moving footstool carried the cat through 30 browser samples without slipping, dropping it, or losing ground contact.
- The runtime-only `/MegaChonk/` build passed model-hash, level, WASD, jumping, attribution, and browser-error checks. It contains 25 files totaling approximately 12.45 MB.

## Vertical Challenges

`tools/vertical-challenges-test.js` passed with real keyboard movement after isolated scenario setup:

- Ascended and descended all 18 stairs in all three rooms without jumping.
- Reached the gallery at 2.7 units even at satiety 5 and chonk 95, when jumping is blocked.
- A normal sprint jump fell short of the bonus perch; the catnip sprint jump landed on it at 2.7 units.
- Jump impulse increased from 6.3 to 7.434 and the speed multiplier became 1.32.
- Landed on all three return shelves at heights 1.95, 1.2, and 0.55 units.
- Optional catnip did not change required meal counts; the countdown appeared and expired correctly.
- Movement interrupted automatic eating immediately, and passing a bowl with movement held did not trigger an eating lock.
- Catnip did not bypass hungry/heavy jump restrictions.
- A boosted jump beneath the gallery stopped below its underside rather than passing through the floor.

The isolated vertical tests place the cat at scenario starting points, but do not teleport it during ascents, descents, or leaps. The separate full autoplay traverses the complete required route from each level's normal spawn.

## Visual Scope

The cat has improved anatomy, restrained Turkish Van markings, larger dark night eyes, a shaped nose, articulated tail, subtle fur surface detail, interpolated motion, and planted foot targets. The enlarged house remains stylized. This is not a production-quality match for Stray; no Stray assets were used.
