# Turkish Van Character Verification

Verified locally on 2026-10-16 with Blender 3.4.1 and headless Microsoft Edge at 1440 x 900.

## Character

- Runtime: real skinned GLB rendered by Three.js; no directional sprite frames.
- Export: 193,136 triangles, 24 skinned meshes, one armature, seven action clips.
- Clips: Idle, Walk, Groom, Jump, Sit, Claw, Bite.
- GLB re-imported successfully into a clean Blender scene.
- Four skin influences per vertex; Blender previews and runtime use the same weights.
- Forelegs have higher elbows, scapula bones, localized weight smoothing, reduced swing lift, and toe articulation. The eyes use curved almond surfaces with radial iris colors, inset sockets, and eyelid bones; the muzzle has a rounded nose and tapered whiskers.
- The base mesh is credited to Jonas Dichelle under CC BY 3.0 in the bundled attribution.

## Browser Checks

`tools/smoke-test.js` passed after the final export. It checked model loading, white paw colors, all seven action states, W moving away from the camera, satiety drain, hungry/heavy jump limits, all three generated levels, and movement interrupting grooming.

`tools/visual-cat-test.js` passed after the final export. It captured four camera angles and inspected 19 animation poses across idle, walk, sit, and grooming. Sampled body vertices stayed above the floor, with the lowest sample approximately 0.00009 game units above it. This samples every seventeenth body vertex; it is not an exhaustive triangle-intersection test.

The idle blink was also verified in the browser: both eyelid bones contracted to approximately 0.106 of their open height, with a separate inspection screenshot.

The same inspection measured a median 59.9 FPS and a 95th-percentile frame interval of 16.8 ms over 120 frames. These are local measurements, not a performance guarantee on other hardware.

## Autoplay

`tools/autoplay-test.js 424242` completed all three rooms using keyboard movement and jumping:

- 12 meals consumed.
- 7 jumps.
- 600 XP and the completion screen reached.
- Zero bumps, no unreachable objectives or browser errors, and a completion time of 2 minutes 48 seconds.

Autoplay included every required upstairs meal in the updated house and traversed stairs with keyboard input, without teleporting to objectives. Its route planner uses the destination floor rather than transient jump height. A final grooming-only paw-to-muzzle alignment was regenerated after this replay and checked with the smoke and visual tests; gameplay physics were unchanged.

The run exposed and helped fix a capsule collision trap when leaving an ottoman and a shelf placement that crowded the kitchen supper bowl.

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

The cat has improved anatomy, restrained Turkish Van markings, smaller inset eyes, a shaped nose, articulated tail, subtle fur surface detail, interpolated motion, and planted foot targets. The house remains the existing stylized environment. This is not a production-quality match for Stray; no Stray assets were used.
