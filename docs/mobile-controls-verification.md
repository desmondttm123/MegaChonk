# Mobile Controls Verification

Verified locally on 2026-10-16 using Microsoft Edge/Chromium with phone viewport,
touch, and device-pixel-ratio emulation. No physical Android/iOS or Safari test
was performed, and these results do not establish mobile-device frame rates.

## Implementation

- `touch-controls.js` owns independent pointer captures for movement, camera dragging, and action buttons. A second finger cannot replace the first finger's joystick/camera role.
- The joystick has a resting-thumb dead zone, normalized diagonal input, and analog strength. It feeds the existing smooth movement, heading, condition, collision, and animation logic rather than synthesizing stuck keyboard keys.
- The right-side drag uses bounded, frame-smoothed angular input. It does not request pointer lock or trigger the desktop mouse claw/bite handlers.
- Jump, Sit, Claw, Bite, and a latched Trot toggle call the existing gameplay actions. Touch movement interrupts automatic eating, sitting, and grooming.
- Capture cancellation/loss releases its gesture. Blur, hidden-page changes, resize, and non-playable transitions reset gesture state, camera residuals, and Trot. Releasing movement retains normal short deceleration, not an instant velocity teleport.
- Touch controls enable for coarse-pointer devices or first detected touch; the explicit Touch on/off toggle overrides automatic detection for the session. Mode changes return keyboard focus to the game canvas.
- Portrait/landscape HUD and boot layouts avoid overlap with the virtual controls. CSS uses phone safe-area insets; actual notched-device rendering still needs manual review.
- Touch/coarse-pointer rendering uses a maximum pixel ratio of 1.25. The detailed cat GLB, animations, physics, and desktop default rendering cap remain unchanged.
- The catnip sign is input-neutral, and its toast uses Trot + Jump on touch instead of keyboard-only instructions.

The implementation follows the browser's [Pointer Events capture model](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events#capturing_the_pointer)
and declares gesture ownership through [touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action).

## Automated Checks

`node tools/mobile-controls-test.js` passed with browser-dispatched touch events,
not only JavaScript calls to the gameplay action helpers:

- Boot and gameplay controls fit without overlap/overflow at 390x844, 844x390, 320x568, and 568x320.
- A resting thumb in the dead zone does not move the cat; dragging forward moves away from the camera and reduces satiety.
- Trot increased settled speed from approximately 3.10 to 4.84 game units per second in the balanced-condition scenario.
- Movement, camera look, and Jump worked with three simultaneous touch contacts. A 56-pixel camera swipe produced approximately -0.336 radians of yaw, not a violent camera jump.
- Pointer capture kept the joystick active outside its drawn base; lifting or cancelling the contact released input.
- A quick camera swipe retained its final movement after normal release; cancellation still discarded queued look input.
- Sit/stand, Claw, Bite, and movement-interrupted sitting/grooming were verified.
- Small analog movement immediately interrupted eating, before full movement speed was reached.
- Rotation and blur cleared held movement/camera gestures; the UI remained usable afterward.
- The explicit Touch toggle worked in both directions. Desktop users could enable virtual controls, then switch back to native pointer lock and keyboard movement.
- Hungry and heavy cats could not bypass jump limits through the touch button.
- Completion hid the controls; restart restored them. The completion scenario is isolated test setup, not a full touch-only house run.
- The mobile run recorded zero pointer-lock requests and no browser errors.

Desktop/regression checks also passed:

- `tools/smoke-test.js`: normal movement, orientation, actions, condition, grooming, and level systems.
- `tools/camera-controls-test.js`: mouse filtering, native movement, focus/capture transitions, frame-rate consistency, and furniture-corner recovery.
- `tools/vertical-challenges-test.js`: stairs in all three rooms, normal/boosted leaps, return shelves, condition limits, boost expiry, and gallery undersides.
- `tools/autoplay-test.js 424242`: full keyboard-driven house run, 12 meals, 600 XP, seven jumps, zero bumps, about 2 minutes 32 seconds. This verifies the shared movement/progression path, not touch-only autoplay.
- Runtime module syntax and `python tools/build_pages.py`: 27 runtime files, approximately 12.47 MB; `dist/` remains ignored.
- `tools/pages-test.js`: local `/MegaChonk/` package, model hash, all three rooms, movement/jump, and no game browser errors. One initial concurrent run hit an existing DevTools response-body retrieval error; the isolated retry passed.

Screenshots: `assets/previews/mega-chonk-mobile-portrait.png` and
`assets/previews/mega-chonk-mobile-landscape.png`. They were inspected visually as
well as checking element bounds in the automated suite.

## Physical Phone Checklist

1. Open an authorized deployment in current Android Chrome and iPhone Safari; confirm WebGL 2/model loading and the initial download are acceptable.
2. Start in portrait and landscape, including a notched phone. Check that Enter, meters, objectives, joystick, and buttons are reachable with browser UI visible.
3. Move/look together; toggle Trot, then jump while moving. Release all fingers and verify the cat slows to a stop.
4. Eat, interrupt eating, sit/groom, and cancel by moving. Try the catnip route with Trot + Jump and confirm condition limits remain understandable.
5. Switch apps, rotate while holding controls, and interrupt a gesture. Verify no unwanted motion or camera spin continues on return.
6. Check page scrolling/zoom behavior, GPU heat/frame pacing, and whether reduced rendering settings or a separate quality selector are needed.

## Release Status

Released on 2026-10-16 as `39d9265cb67a4a3453ee00f544b922a523910f09` after
the user authorized committing and pushing all pending changes.
[Pages workflow 38854321559](https://github.com/desmondttm123/MegaChonk/actions/runs/38854321559)
succeeded, and the public `build-manifest.json` reported the same revision.

All three suites passed against https://desmondttm123.github.io/MegaChonk/:

- `tools/mobile-controls-test.js`: all four phone layouts, three simultaneous touches, zero pointer-lock requests, desktop mode switching, no browser errors. Settled walk/trot speeds were approximately 3.10/4.84; the camera test swipe changed yaw by -0.336 radians.
- `tools/camera-controls-test.js`: native mouse input, spike rejection, focus recovery, three capture cycles, 30/60/144 FPS consistency, and furniture-corner recovery; no browser errors.
- `tools/pages-test.js`: 27 runtime files, all three rooms, WASD movement/jumping, attribution, and the canonical 193,136-triangle cat; no browser errors. The served cat SHA-256 was `a2e47a69b82af295e3d30f8d2186760907e827f02c72c85ced2fa1a0bebe126d`.

Live portrait, landscape, and desktop captures were visually reviewed and saved
under `assets/previews/`. The follow-up evidence commit updates only these
captures and handoff notes, not the tested runtime. Physical-phone checks above
remain outstanding.
