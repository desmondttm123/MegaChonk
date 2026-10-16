# Appetite, Chonk And Body Trials

## Player Loop

Eat required suppers to open the pet door. Stay near 58 satiety for the best
pace and leap; too little energy, overeating and extra body mass slow the cat.
Optional snacks bank points and build mass for weight plates. Trim down at the
scratch post to fit narrow passages or regain jump range. All three rooms and
the vacuum remain completable without doing the optional body trials.

| Food | Satiety | Chonk | Snack Points | Objective |
| --- | --- | --- | --- | --- |
| Required supper | +8, capped at 80 | +0.8 | 0 | Yes |
| Cream/salmon or enemy fish snack | +10 | +9 | 25 | No |
| Slim/heavy stash or balcony treat | +6 | +3 | 60 | No |
| Lean supper near entrance | +14, capped at 80 | 0 | 0 | No |
| Catnip | +2 | 0 | 0 | No |

Caps never lower an already higher satiety. Eating a bowl takes 1.25 active
seconds. Energy and fat accrue per bite, retained across interruptions; points
are awarded only once, on completion. Movement, jumping and manual combat
interrupt eating. A separate repeating `EatLoop` derived from the bite clip
keeps head/jaw motion alive without clamping or locking movement. The source
GLB still contains its original seven animation clips.

Rich bowl snacks refill after 30 seconds, lean supper after 32, and catnip after
22. Refills ensure that even a very lean cat can regain enough mass for a plate.
Stashes and enemy drops are one-shot rewards. Snack points persist through
restarts/reloads in this browser's `localStorage`, not in an account or cloud.
Storage denial falls back to a session wallet. There is no spending/shop UI yet;
the future economy will need its own balancing and save-migration decisions.

## Tuning And Safety

- Base leap impulse rose from 6.3 to 7.1 with 1.12x airborne pace. Grounded walk/trot bases remain 3.15/4.95 before condition, equipment and catnip. Healthy condition now gives a stronger 1.12x peak pace.
- The speed bell curve centers on 58 satiety. Heavy mass progressively lowers pace from 55 chonk, reaching a 52% penalty at 100. Jump power declines from 55 to 90 chonk; satiety at or below 8 or chonk at or above 90 blocks leaps, including catnip leaps.
- Passive energy drain is 0.025/second; walking adds 0.30 and trotting adds 0.42, scaled by pendant efficiency. A minute of continuous unequipped trotting costs about 27 satiety; a meal restores 8 in 1.25 seconds. Condition pauses offscreen, without focus, during transitions and after completion.
- Movement burns `0.035 + speed * 0.012` chonk/second, with a natural floor of 26. An aimed claw on the scratch post removes 4 chonk and costs 1.5 satiety; it requires more than 16 satiety and 28 chonk. Lean supper prevents forced fat gain when recovering energy.
- Warnings appear at 20 and 8 energy. Six active seconds at zero costs one room life and any pendant, retains collar/meal progress/points/weight, and restores at least 55 energy at the checkpoint with a recovery grace period. Nine losses open a checkpoint-continue screen, not a forced replay of completed meals. Boss deaths use the existing independent fight lives.
- Slim filters admit cats at 60 chonk or below. Occupants can always leave, even after the stash pushes their chonk over 60. Heavy plates require 64 chonk and 0.6 seconds grounded; their gate stays latched until the room is regenerated. Neither trial is on a mandatory route.
- Two rich snacks are enough to press the plate from normal starting weight. Trim with the nearby scratch post afterward. Signs and proximity prompts state the thresholds and distinguish supper objectives from optional food.
- The capsule radius varies from 0.22 to 0.35 with mass. A smooth torso blend shape follows actual chonk; head, eyes, paws and root scale are preserved. Its longitudinal/height masks avoid inflating the hind legs. It is a runtime augmentation, not a replacement GLB/Blender source.
- Shared jump assessment still plans generated hurdles at 38 satiety/75 chonk with no equipment or boost. The optional balcony gap is now 5.2 units, preserving a meaningful catnip-only shortcut. Clear corridors, stairs, trial entrances, refill bowls and workout space are reserved before seeded clutter placement.

## Verification

Tested locally on 2026-10-17 using headless Microsoft Edge/Playwright:

| Check | Result |
| --- | --- |
| Pure condition rules | Passed bell curve, weight/jump limits, food caps, partial nutrition, gradual drain, workout and storage denial/save cases |
| Condition browser integration | Passed interpolated eating head motion, immediate movement interruption, proportional partial bites, no duplicate awards, two-snack plate activation, objective separation, fat-blocked slim entry, lean entry, safe post-reward exit, latched plate, scratch workout, lean feeding/refill, starvation/charm loss/recovery, nine-life continue and reload persistence |
| Actual flat-ground sprint jumps | Approximately 5.28 units at 58 satiety/48 chonk versus 2.41 at 58/84; isolated clear-lane scenario starts, normal keyboard movement/physics |
| Campaign seed 424242 | All 12 meals and boss, 850 XP, 6 jumps, no deaths/bonks; keyboard autoplay from spawn, no objective teleports/condition injection |
| Campaign seed 765432 | All 12 meals and boss, 850 XP, 5 jumps, no deaths/bonks; same full-run boundaries |
| Generated layouts | 90 passed, all three rooms, counts 25/30/37, protected routes/hazards/enemies and moving-platform carry |
| Adventure | Equipment, rich enemy loot, deaths, conservative hurdle clearance, nine boss losses/retry and no-equipment keyboard victory passed |
| Vertical routes | All stairs, hungry/heavy stairs, failed unboosted shortcut, successful boosted perch/descending shelves, expiry and gallery underside passed |
| Input, visual and packaging | Smoke, camera, phone input/layout, visual-cat sampling and local Pages tests passed; 33 runtime files, unchanged canonical GLB hash |

The condition integration uses explicit scenario placement and condition setup
to isolate rules; it is not a full campaign. Its plate-from-snacks case earns
the necessary weight by eating, rather than injecting weight for that check.
Two full campaign runs are separate evidence. The original mobile run stalled
after its boss-layout captures; a fresh bounded-timeout run passed the entire
suite. Physical Android/iPhone Safari and human balance playtesting remain
outstanding. Automated checks are not a claim of AAA art or hardware performance.

The canonical GLB and Blender project were not regenerated or changed. Existing
visual-cat sampling passed floor contact and all source animation poses; lean
and heavy runtime captures were also reviewed. Deployment evidence is recorded
in `MEMORY.md` after the authorized push and live checks.

## Extension Points

`condition-rules.js` owns food recipes, metabolism, workout rules, size thresholds
and the wallet. `jump-rules.js` owns actual movement/leap tuning and conservative
planning. `body-trials.js` owns optional pressure/size puzzles and their safe-exit
policy. `cat-condition-visual.js` generates the torso-only morph before the first
render. `game.js` integrates animation, nutrition, life loss, checkpoints and HUD.

Artist replacements must preserve or deliberately adapt the torso mesh naming
and Spine/Chest/Pelvis skin weights used by the runtime morph. Review fat/lean
walk, sit, groom and eating poses, not only the default model render. For future
mandatory weight puzzles, add reachable refill/workout routes and prove both
directions of the puzzle before making them part of the objective.
