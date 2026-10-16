# Adventure Verification

Local tests: 2026-10-16 (Asia/Singapore), based on `3c9260e`.
Released on 2026-10-17 as `74b013e4b0e12fd427dded7984909fe6741b095b` after
the user authorized pushing all changes. Hosted checks are recorded below;
the earlier campaign/asset checks remain local evidence.

## Completed Campaign Checks

Both full keyboard autoplay seeds cleared all 12 meals and three pet doors,
entered the boss through the third door, and defeated it using ordinary movement
and claw input. The driver changes camera aim, not positions, equipment, boss
phases, or health. Optional enemies were not killed by these campaign runs.

| Seed | XP | Jumps | Bonks/deaths | Boss | Time |
| --- | --- | --- | --- | --- | --- |
| 424242 | 850 | 7 | 0 / 0 | Eight claws, nine lives left | 2m 47s |
| 765432 | 850 | 6 | 0 / 0 | Eight claws, nine lives left | 2m 44s |

The campaign runs collected collars but no pendants, so they used base claw
damage. Separate encounter tests cover pendant damage and losing it on death.

## Rules And Generation

- Pure rules passed: equipment tiers/ownership, stronger-slot selection, charm loss and collar retention, rear-only claws, armored front, bite rejection, cooldown, suction direction/height, nine lives/retry, and base-damage victory.
- The rules test supplies a different attack handler and a different weak-point policy, verifying that later bosses need not use the vacuum's mechanics.
- All 90 seeded room layouts passed overlap, obstacle-count, deterministic replay, protected-route, accessory access, and full hazard/enemy-patrol-envelope route checks. Moving-platform carry passed.
- Hurdles and bridge approaches carried valid conservative jump assessments; hurdles reserved takeoff/landing lanes. Isolated physics checks cleared a generated hurdle in all three rooms. Scenario starts are placed by the test, not described as whole-route autoplay.
- Desktop smoke/camera and vertical challenges passed, including native mouse input, capture/focus guards, 30/60/144 FPS consistency, camera-corner recovery, all stairs, catnip leaps, return shelves, condition blocks, expiry, and gallery underside collision.

## Integration And Phone Checks

- Expanded adventure integration passed: room pickups and bone-attached equipment, room-to-room carry, food and pendant enemy drops, no duplicate snack reward, enemy warning/pounce/death, and pendant loss with collar retention.
- Actual hurdle checks ran with no equipment at 38 satiety / 75 chonk. Sampled heights were approximately 0.442, 0.559, and 0.518 units across the three rooms; all were cleared and landed using real jump physics.
- Boss integration passed front armor, bite rejection, rear equipped-claw damage at animation impact, all nine suction losses, pendant loss on suction, retained boss damage within an attempt, full-health/nine-life fight retry, and fresh-run equipment reset.
- Keyboard encounter autoplay won with a collar and no pendant (eight attack inputs, nine lives left, about 14 seconds), then with no equipment at all (nine attack inputs, nine lives left, about 15 seconds). The latter required eight damaging hits; one input did not land.
- Expanded mobile controls passed all four portrait/landscape sizes, including equipment/boss panels, simultaneous touch controls, the last-life retry button, a touch claw finishing the boss, completion/restart, desktop mode switching, and zero mobile pointer-lock requests. No browser errors were recorded.
- Visual cat inspection passed four angles and sampled animation poses, with no sampled floor penetration or browser errors. Local median was approximately 59.9 FPS; this is not physical-phone performance evidence.
- Runtime-only Pages package verification passed at local `/MegaChonk/`: 30 runtime files, approximately 12.51 MB, canonical model hash, attribution, all three rooms, movement/jumping, and no browser errors. Development models/source tools remain excluded.

Reviewed captures: [vacuum arena](../assets/previews/mega-chonk-vacuum-boss.png),
[phone portrait](../assets/previews/mega-chonk-boss-mobile-portrait.png),
[phone landscape](../assets/previews/mega-chonk-boss-mobile-landscape.png),
[retry](../assets/previews/mega-chonk-boss-retry.png),
[equipment](../assets/previews/mega-chonk-equipment.png), and
[clockwork mouse](../assets/previews/mega-chonk-clockwork-mouse.png).

Scenario checks intentionally set room/encounter starts or phases to isolate
armor, rear hits, pounces, loot, death, and retry. These are distinct from the
control-driven campaign and boss autoplay. Phone tests dispatch browser touch
events in Chromium emulation; they are not physical-device or Safari tests.

## Regressions Found During Implementation

- A crowded seed placed no rotating vacuum after new enemy reservations. Largest swept hazards now place first, with a larger deterministic attempt budget; the 90-layout sweep passed afterward.
- The equipment label overlapped the touch toggle at 568x320. Short landscape layouts now place equipment in the free center-bottom area between controls.
- On the last suction loss, virtual controls could remain visible for one render frame. Loss/victory/transitions now synchronously release/hide touch gameplay input.
- A fading retry overlay could swallow an immediate attack after restart. Hidden transition/completion overlays now stop accepting pointer events immediately.

## Hosted Release

[Pages workflow 38943348005](https://github.com/desmondttm123/MegaChonk/actions/runs/38943348005)
succeeded, including syntax/pure-rule checks. The public manifest at
https://desmondttm123.github.io/MegaChonk/ reported the exact released revision.

- `tools/pages-test.js` passed against the live URL: 30 runtime files, canonical model hash, attribution, all three rooms, movement/jumping, no browser errors.
- `tools/mobile-controls-test.js` passed live: four phone layouts, three simultaneous touches, boss last-life retry and finishing claw, completion/restart, desktop switching, zero pointer-lock requests, no browser errors.
- `tools/camera-controls-test.js` passed live: native/small mouse input, spike/focus/capture guards, 30/60/144 FPS consistency, and furniture-corner recovery, with no browser errors.
- A fresh hosted browser entered an isolated boss encounter with no collar/pendant, full boss health, and nine lives. The existing keyboard boss driver defeated it with eight attack inputs in approximately 14 seconds, keeping all nine lives and recording no browser errors. It did not change positions, boss phases, or health during combat. This is a full boss fight, not a hosted replay of the three-room campaign.

Live desktop and portrait/landscape screenshots were reviewed and refreshed.
The release-evidence follow-up contains only notes/captures, not runtime changes.

## Limits

No character model regeneration was needed. The canonical cat SHA-256 remains
`a2e47a69b82af295e3d30f8d2186760907e827f02c72c85ced2fa1a0bebe126d`.
Equipment/loot is run-scoped memory, not a saved inventory. The vacuum is the
only shipped boss; clockwork mice are the first simple enemy type. Combat death
and ordinary environmental bumps deliberately have different consequences.

Physical Android/iPhone Safari playability, notched-screen behavior, heat/frame
pacing, and encounter tuning by human players remain manual follow-up. Automated
success is not a claim of production AAA quality or universal phone performance.
