# Mouse Look Fix

Verified on 2026-10-16 in headless Microsoft Edge at 1440 x 900.

## Reproduction

The old mouse handler changed camera angles directly on each mouse event, without checking delta size or capture/focus transitions. A simulated pointer-lock spike of `(12000, -9000)` changed yaw from 0 to -28.2 radians in one event and clamped pitch to its lower limit.

A separate furniture-corner scenario showed that a 0.02-radian orbit adjustment could change the requested follow distance from approximately 1.25 to 3.38 units. The old collision trace had no separate recovery damping.

## Changes

- Filter non-finite and implausibly large deltas before they reach the camera.
- Discard initial cursor motion and briefly guard capture/focus transitions.
- Accumulate input per rendered frame, apply bounded angular rates, and smooth the short residual without retaining a long input backlog.
- Reduce default mouse sensitivity and clear pending input on unlock, blur, and visibility changes.
- Ease the camera outward after an obstruction clears; permit closer collision distances instead of enforcing the previous 1.25-unit minimum through nearby furniture.

## Regression Coverage

`tools/camera-controls-test.js` reproduces the oversized-delta failure and verifies the fix, plus normal mouse look:

- Four-pixel horizontal motion produces approximately -0.0058 radians of yaw; two vertical pixels produce +0.0022 radians of pitch.
- Actual browser-generated pointer-locked mouse movement remains responsive and small.
- Identical input totals produce matching rotation at simulated 30, 60, and 144 FPS.
- NaN, infinite values, and oversized movement are rejected.
- High-volume event bursts stay within angular-rate limits and stop without a lingering spin.
- Blur clears queued motion; focus recovery rejects a cursor warp and then accepts normal movement.
- Three real pointer-lock release/capture cycles retain the camera heading.
- The furniture-corner camera transition recovers gradually, rather than jumping to full distance.

The ordinary gameplay smoke test also checks that movement, jumping, action states, grooming interruption, satiety, and level generation still work. These are automated browser tests, not a guarantee of identical behavior with every mouse, driver, or browser.
