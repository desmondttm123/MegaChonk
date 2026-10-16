# Mega Chonk Design Notes

## Core Loop

1. Enter a room and scout every food scent.
2. Traverse furniture, spills, moving footstools, and robot vacuums with smooth camera-relative movement.
3. Eat to restore satiety, gain chonk, and earn XP.
4. Keep hunger and weight in a useful middle band so the cat can move and leap effectively.
5. Reach the glowing pet door after every required bowl is empty; bonus snacks are optional.
6. Clear the living room, kitchen, and attic to complete the house run.

## Condition Model

- Satiety ranges from `0` to `100` and only drains while moving.
- Walking drains `0.075` satiety per second; trotting drains `0.13` per second.
- A meal restores `9` or `13` satiety over `1.25` seconds, much faster than movement drains it.
- Meals add chonk; sustained movement reduces chonk very slowly.
- Movement follows overlapping bell curves and is quickest around medium satiety and weight.
- Satiety at or below `8` blocks jumping.
- Chonk at or above `90` blocks jumping.
- Approaching either limit progressively reduces jump height before the hard block.
- Catnip adds 3 satiety and no chonk, then grants an 18-second speed multiplier of `1.32` and jump-impulse multiplier of `1.18`. The base hunger/weight restrictions still apply.
- Catnip regrows 22 seconds after consumption, allowing failed bonus jumps to be retried. Boost time pauses during room transitions.

## House Levels

- **Living Room Zoomies:** sofas, rugs, plants, floor cushions, an ottoman, a spill, and a robot vacuum.
- **Kitchen Counter Caper:** tiled floor, cabinets, dining furniture, stools, moving footstools, and a wide spill.
- **Attic Midnight Run:** storage boxes, beams, a cat tree, moving platforms, two spills, and the final pet door.

Each run seeds household clutter differently. Placement rejects overlaps with fixed furniture, food, checkpoints, hazards, the spawn, and the exit so objectives remain accessible.

Every room also has an upstairs gallery at `Y = 2.7`, reached by 18 oak treads rising `0.15` units each. The staircase entrance is protected from random clutter. One of each room's existing required meals is upstairs; total required meals remain 12. Walking stairs does not depend on jump readiness.

A marked opening on the gallery faces a cushioned bonus perch across a `3.8`-unit edge-to-edge gap. The catnip bowl is beside the launch lane. A sprinting catnip leap reaches the perch; normal balanced jumps fall short. Three descending shelves form an optional return route. Missing the jump lands on the existing room floor rather than an instant death pit.

## Controls

- `WASD` or arrow keys: camera-relative movement
- Mouse: orbit camera
- `Shift`: trot
- `Space`: jump
- `Q`: sit or stand
- `F` or left mouse: claw
- `E` or right mouse: bite
- `Esc`: release the mouse

## Character

The runtime character is a Turkish Van with approximately 193,000 triangles, rendered as a skinned GLB in Three.js. The Blender pipeline uses a CC BY 3.0 base mesh by Jonas Dichelle and adds an anatomical skeleton, corrected skin weights, facial details, white/chestnut coat colors, and seven new animation clips. See the source attribution in `assets/models/source/jonas-dichelle-cat/ATTRIBUTION.md`.

Walking uses continuous foot targets with shoulder/spine motion. Sitting keeps the paws on the floor; idle includes breathing, head turns, ear movement, and a flexible tail. Three.js interpolates the clips and cross-fades between them. Sitting holds its last pose; jump, claw, and bite play once. Grooming starts after five idle seconds and movement returns to walking. There are no directional frame changes in the runtime character.

## Verification

- `tools/smoke-test.js` validates skinned mesh loading, coat colors, controls, action states, grooming interruption, condition limits, generated systems, and screenshots.
- `tools/visual-cat-test.js` captures front, rear, side, and three-quarter views, samples animated ground contact, and measures frame timing.
- `tools/autoplay-test.js [seed]` uses keyboard movement and jumping to eat all 12 meals and cross all three pet doors.
- `tools/vertical-challenges-test.js` checks stair ascent/descent, the catnip jump gap, optional objectives, boost limits/expiry, and underside collision.
- Release testing includes the regression seed that previously allowed clutter to obstruct a bowl.
