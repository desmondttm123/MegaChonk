# Mega Chonk Design Notes

## Core Loop

1. Enter a room and scout every food scent.
2. Traverse furniture, spills, moving footstools, and robot vacuums with smooth camera-relative movement.
3. Eat to restore satiety, gain chonk, and earn XP.
4. Keep hunger and weight in a useful middle band so the cat can move and leap effectively.
5. Reach the glowing pet door after every bowl is empty.
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

## House Levels

- **Living Room Zoomies:** sofas, rugs, plants, floor cushions, an ottoman, a spill, and a robot vacuum.
- **Kitchen Counter Caper:** tiled floor, cabinets, dining furniture, stools, moving footstools, and a wide spill.
- **Attic Midnight Run:** storage boxes, beams, a cat tree, moving platforms, two spills, and the final pet door.

Each run seeds household clutter differently. Placement rejects overlaps with fixed furniture, food, checkpoints, hazards, the spawn, and the exit so objectives remain accessible.

## Controls

- `WASD` or arrow keys: camera-relative movement
- Mouse: orbit camera
- `Shift`: trot
- `Space`: jump
- `Q`: sit or stand
- `F` or left mouse: claw
- `E` or right mouse: bite
- `C`: cycle coat
- `Esc`: release the mouse

## Character

The runtime GLB contains a 228,536-triangle skinned cat and seven clips: idle, walk, groom, jump, sit, claw, and bite. The idle state changes to grooming after five seconds and movement cancels it immediately. Van, tuxedo, calico, and orange-tabby coats are generated at runtime on the same rig.

## Verification

- `tools/smoke-test.js` validates loading, controls, coat changes, all clips, condition limits, generated systems, and screenshots.
- `tools/autoplay-test.js [seed]` uses keyboard movement and jumping to eat all 12 meals and cross all three pet doors.
- Release testing includes the regression seed that previously allowed clutter to obstruct a bowl.
