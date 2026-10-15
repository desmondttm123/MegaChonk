# Mega Chonk

Mega Chonk is a third-person 3D browser game about a cat balancing hunger, weight, and agility across a large house. It uses a locally bundled Three.js renderer and an original animated cat generated from scratch in Blender.

## Run

Double-click `start-game.bat` and keep the terminal window open while playing. Alternatively, run:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173`.

The game must run through the local server; opening `index.html` directly will not load JavaScript modules reliably.

## Controls

- `WASD` or arrow keys: camera-relative movement
- `Shift`: trot
- Mouse: orbit camera
- `Space`: jump
- `Q`: sit or stand
- `F` or left mouse: claw
- `E` or right mouse: bite
- `C`: cycle Turkish Van, tuxedo, calico, and orange-tabby coats
- Click: recapture camera
- `Esc`: release pointer lock

## Core Loop

Find every bowl in a room, then reach the glowing pet door. Complete Living Room Zoomies, Kitchen Counter Caper, and Attic Midnight Run to finish a run.

- Movement accelerates and decelerates instead of starting or stopping instantly.
- The cat smoothly turns toward camera-relative movement.
- Eating restores satiety quickly and adds chonk; movement drains both very slowly.
- The cat is fastest near balanced satiety and slows when hungry, overfull, or heavy.
- A starving cat cannot leap, while a cat at maximum chonk must exercise before jumping again.
- Extra weight progressively shortens jumps without making a normal run unwinnable.
- After five seconds without input, the cat transitions into its grooming animation.
- Sofas, counters, storage boxes, cushions, spills, robot vacuums, raised ottomans, moving footstools, and cat-bed checkpoints form the obstacle courses.
- Each run varies household clutter while protected zones keep every bowl, spawn point, checkpoint, and pet door accessible.
- The runtime cat uses a 228,536-triangle mesh, seven animations, and four procedural fur patterns.

## Main Assets

- `assets/models/turkish-van-game-cat.glb`: animated runtime character
- `assets/models/turkish-van-game-cat.blend`: editable rig and animation source
- `tools/generate_animated_game_cat.py`: reproducible Blender generator
- `assets/models/sitting-turkish-van-cat.stl`: separate printable sitting model
- `vendor/three`: locally bundled Three.js 0.186.0 runtime

## Verification

`tools/smoke-test.js` checks loading, mesh density, coats, all animations, movement, satiety drain, jump limits, house systems, and screenshots.

`tools/autoplay-test.js [seed]` drives the game with keyboard controls through every meal and pet door on all three levels. It fails on an unreachable objective, broken transition, browser error, or incorrect final score. Both scripts require Playwright and Microsoft Edge.
