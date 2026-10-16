# Adventure System

## Ownership

- `jump-rules.js` is the shared source of truth for pace, jump impulse, gravity, and conservative generation checks. Do not tune a second independent jump formula in the generator.
- `adventure-rules.js` contains browser-independent run equipment and a boss state machine. `BOSS_DEFINITIONS` controls health/lives, ranges, cones, turning, and timed phases. `BOSS_ATTACKS` maps an attack ID to effects; `BOSS_WEAK_POINTS` maps a vulnerability ID to hit conditions, without Three.js operations.
- `adventure-world.js` builds original procedural vacuum/mouse/pickup geometry, runs optional enemy patrols/pounces, collects items, and resolves animation-impact attacks. It owns no imported animal assets.
- `game.js` integrates campaign gates, character physics/animations, death/respawn, boss retry/completion, and desktop/touch HUDs. `bossScenario` is an isolated test hook, not evidence of a played campaign.

The editable cat GLB/Blender source is unchanged. Visible equipment is attached to
the neck bone at runtime; it does not regenerate or replace the rig.

## Equipment And Death Decisions

There are two auto-equipped slots: collar and pendant (`charm` in code). Each
room supplies one of each at its room tier, in reachable protected floor areas.
Only stronger equipment replaces a slot. Collars grant 3/6/9 percent pace;
pendants grant two damage per claw instead of one and reduce moving hunger drain
by 10/20/30 percent. Bonuses do not bypass starving/heavy jump blocks.

Equipment persists through room changes for one in-memory run. Browser reload or
Run again starts fresh. Combat death removes the pendant and retains the collar.
Claimed pickups do not reappear just because a pendant was lost. Ordinary wet-paw
or rotating-hazard checkpoint bumps are deliberately not combat deaths.

Each room spawns 1/2/3 clockwork mice in optional patrol areas. A mouse warns for
0.9 seconds, lunges toward the previously marked position, then rests. Claws and
bites must face a nearby target; the third room's mice take two base hits.
Every defeated mouse drops either a fish snack (+6 satiety, no chonk) or a
room-tier pendant. Kills/pickup IDs prevent duplicate rewards on regeneration.

## Vacuum Encounter

The third required-meal gate enters a clear arena in the house, not a fourth
random obstacle room. The vacuum has eight health and nine lives for the cat.

1. Track: turn at a bounded rate toward the cat.
2. Warn: lock heading and show an amber cone for 1.15 seconds.
3. Inhale: show a red cone for two seconds. Only the front cone pulls; close exposure for 0.24 seconds costs one life. A cat above intake height is not caught.
4. Recover: hold heading for 4.2 seconds; circle behind and claw the green filter.

Rear claws work in any active phase if within 2.65 units, below 0.8 height,
behind the boss, and facing it. Front/side armor and bites cannot damage it.
Input has a cooldown and resolves once at the animation's impact delay, with an
additional boss hit cooldown. The boss turns more frequently below half health.

Each suction death drops the pendant and respawns safely with a short grace
period. Boss damage persists across the remaining lives. The ninth loss opens a
retry screen and disables gameplay input. Retry resets boss health/lives, keeps
the collar, and does not replay rooms. Victory grants 250 XP. The player can win
with eight base claws and no equipment; collecting accessories is not required.
Entering/respawning in the arena brings satiety into the 45-75 band and caps chonk
at 72 so the encounter cannot start in a condition-based movement soft lock.
Encounter AI and attack timers pause when the document is hidden/unfocused.

## Fair Generation

Hurdle heights and bridge approaches must pass `assessJump`, which includes
height/range safety margins for acceleration, capsule width, discrete physics,
and takeoff timing. The conservative planning cat has 38 satiety and 75 chonk,
without collar, pendant, or catnip. Hurdles reserve a 1.8-unit run-up and 1.4-unit
landing lane. Large swept hazards are placed before smaller objects to avoid
fragmenting the available safe area. Enemy patrol envelopes and equipment
targets participate in route protection.

This does not promise that a starving or maximally heavy cat can jump: those
blocks are intentional. Mandatory floor corridors and stairs remain clear.
The optional balcony leap still needs catnip; it is not an ordinary hurdle.

## Adding Another Boss

Add a definition with timed phases, an attack-handler ID for each attacking
phase, and a distinct visual builder. Handlers receive boss/player state and
delta, then return effects for the world integration to apply. Keep new damage
and vulnerability conditions in the rules layer rather than UI/input handlers.
If a new boss has different weak points, register a policy in `BOSS_WEAK_POINTS`
and select it with the definition's `weakPoint` ID instead of changing the
vacuum's rear-claw contract. Connect its campaign gate
and HUD, and test it with no equipment as well as equipped builds.

Required checks: rules unit test, adventure integration, 90-layout generation,
vertical challenges, mobile layouts/actions, smoke/camera, both complete
keyboard autoplay seeds, and runtime-only Pages packaging. Tests that place the
cat or set boss phases are scenario checks; only the keyboard boss driver and
campaign autoplay establish control-driven completion.

The user authorized publication on 2026-10-17. See [adventure verification](adventure-verification.md)
for release status and evidence. Physical-phone/Safari testing remains separate
from Chromium phone emulation.
