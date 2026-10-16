# Artist Guide: Improving The Mega Chonk Cat

Yes: an artist can sculpt a better cat, improve its coat and face, and replace
its animations in Blender. They do not need to write gameplay code. A developer
should help integrate changes to the skeleton, material system, or asset format.

**A beautiful still render is not a game asset replacement.** The browser renders
an animated GLB in real time; PNG previews alone do not change the playable cat.
This guide describes both the art work and the game-ready handoff.

## Quick Start

1. Read [project memory](../MEMORY.md), then open `assets/models/turkish-van-game-cat.blend` in Blender. This is the active character, not the v2/v3 experiments or sitting STL.
2. Use **Save As** to make a working copy, for example `assets/models/artist-work/face-pass/cat-source.blend`. Do not overwrite the canonical files while experimenting. An artist without Git can deliver this working folder to a maintainer.
3. Start with a rig-preserving pass: improve the muzzle, cheeks, eye sockets, shoulders, forelegs, paws, coat, and silhouette. Inspect the cat from gameplay distance as well as close-up.
4. Keep the existing skeleton, skinning, names, scale, origin, and all seven animation actions unless a replacement has been agreed with the developer.
5. Preview the actions one at a time and check paws, eyelids, whiskers, muzzle, and tail for clipping. Make front, side, rear, three-quarter, face, and motion previews.
6. Export an animated candidate GLB using the settings below, not just an image or an STL.
7. Deliver the editable source, GLB, texture files, previews, license notes, and a short handoff. A maintainer tests it in the actual game before replacing the canonical model.

**Do not run `tools/generate_stray_style_cat.py` over hand-edited work.** It builds
from the original FBX, reconstructs the rig/face/materials/actions, and overwrites
the canonical `.blend`, `.glb`, and previews. It does not load your edited Blender
file. See [source ownership](#source-ownership) before integrating manual art.

## Art Direction

- Believable domestic-cat anatomy, not a toy, chibi figure, or low-poly placeholder.
- Turkish Van only for now: mostly white, warm brown ears/crown and tail, restrained brown body patches, white paws.
- Large dark night pupils with a small iris rim and restrained highlights; keep eyelids seated in the sockets and able to blink.
- Natural shoulder/foreleg motion, recognizable paws, a readable muzzle, and a flexible tail. Improve proportions and deformation before adding subdivision.
- Subtle breathing, ear/head movement, tail motion, and weight shifts when idle. Grooming must remain readable and interruptible.
- Stray is a visual/control reference, not an asset source. Do not extract its models, animations, textures, or audio.

The old [asset brief](cat-asset-brief.md) is historical. The current character and
runtime contract below take precedence over its early polygon/animation targets.

## Choose The Scope

| Work | Artist responsibility | Integration impact |
| --- | --- | --- |
| Beauty renders only | Lighting, pose, camera, offline fur; deliver images | Promotional/reference images only; no change to the playable cat |
| Existing-rig improvement | Sculpt with topology/weights intact; refine vertex colors, face, deformation, or existing actions | Lowest-risk route; still needs export and in-game review |
| Retopology or new mesh | Rebuild topology/UVs; transfer and repaint weights; validate every action | Not automatic; update vertex colors, skinning, bounds, and mesh-specific tests |
| New skeleton/animation system | Retarget or rebuild all seven clips and maintain an explicit action mapping | Developer collaboration required; not a drop-in mesh swap |
| Baked textures or fur cards | Supply UVs/maps and a lightweight real-time representation | Developer reviews material handling, skinning, transparency, performance, and packaging |

For sculpting, use the armature's **Rest Position** to inspect/edit the undeformed
mesh; return to **Pose Position** to review motion. Do not apply the Armature
modifier, apply a posed deformation as the new rest mesh, or change the rig's
rest pose just to make one animation frame look better. Retopology/remeshing needs
explicit weight/color/UV transfer and deformation cleanup, not just auto-weights.

## Current Character Contract

| Item | Preserve or coordinate explicitly |
| --- | --- |
| Body object | `MegaChonk.TurkishVan.Body` |
| Armature | `MegaChonk.AnatomicalRig` |
| Skinning | One working armature; normalized weights, at most four influences per vertex for the current pipeline |
| Skeleton | Keep existing hierarchy/rest transforms; includes Root, torso/head/jaw/tongue, Ear/Eyelid, Scapula, Front/Hind limb chains, Tail.1 through Tail.6 |
| Face | Eye.L/R, eyelid meshes, eye highlights, nose, tongue, muzzle lines, whiskers; attach moving details to the correct bones |
| Coat colors | `VanCoat`, POINT-domain FLOAT_COLOR on the current body; `Iris` on the eyes |
| Main material | `TurkishVan.Fur`; see the runtime override warning below |
| Coordinates | Blender +Z is up, cat faces -Y; GLB is exported +Y-up. Keep the existing orientation rather than rotating it to compensate for controls |
| Origin/scale | Preserve the existing ground-relative origin and unit transforms. In the saved Idle frame 1, the character is about 0.97 Blender units high before the game's 0.84 scale |
| Current baseline | 193,136 exported triangles, 24 skinned meshes, one armature; approximately 10 MB GLB |

Reference the existing file for bone names and transforms; do not rebuild the rig
from the abbreviations in this table. Keep root motion in place: gameplay moves
the character and applies jump physics. An exported forward-moving walk or a
second animated jump trajectory can cause sliding or double motion.

The current runtime capsule is radius 0.24, height 0.76 at cat scale 0.84.
Noticeably changing body length, paw reach, or height requires a developer to
review collision, camera, food reach, and jump/landing behavior, not just rescale
the mesh visually. Do not move the Root bone to the floor; preserve its existing
offset and the asset origin.

## Animation Handoff

The source scene is 60 FPS. Keep these exact action names for a straightforward
replacement; the current loader matches clip names by case-insensitive substring,
so duplicate or ambiguous names can select the wrong clip.

| Action | Current frame range | Browser behavior |
| --- | --- | --- |
| Idle | 1-240 | Loops; breathing, blinking, head/ears/tail |
| Walk | 1-49 | Loops; playback rate follows movement speed |
| Groom | 1-240 | Loops after five idle seconds; movement cancels it |
| Sit | 1-78 | Plays once and holds the final sitting pose |
| Jump | 1-56 | Plays once; travel/height come from gameplay physics |
| Claw | 1-44 | Plays once |
| Bite | 1-40 | Plays once; also used while eating |

Durations can change with review; these are the existing ranges, not a demand to
duplicate every keyframe. Keep loop boundaries clean, four-foot contact readable,
and transitions into/out of seated and grooming poses plausible. Bake supported
pose-bone animation from any authoring controls; do not require live Blender IK,
constraints, simulations, or drivers to run inside the browser.

In the saved source, all seven NLA tracks are muted and **Idle** is the active
action. To inspect another action, leave the other tracks muted and choose that
action in the Action Editor. Inspect one action at a time; unmuting overlapping
tracks for normal playback can combine unrelated poses.

## Materials And Fur

**Runtime gotcha:** `loadCat()` in `game.js` replaces a material named
`TurkishVan.Fur` with a Three.js physical material using vertex colors and a
generated bump map. It does not preserve an artist's custom image maps or exact
roughness/shader nodes. A texture can look excellent in Blender and disappear in
the game for this reason. Renaming the material alone is not a complete integration.

For the lowest-risk pass, keep the existing POINT-domain vertex-color workflow.
For a texture-based upgrade, coordinate a loader/material change with a developer
and include all image dependencies. Avoid accidentally multiplying a fully baked
coat texture by an already-brown vertex-color coat a second time. Blender-only
procedural node networks are not a portable game material: bake their useful
detail into supported PBR maps and verify the GLB, not just the beauty render.
See the official [glTF material workflow](https://docs.blender.org/manual/en/3.3/addons/import_export/scene_gltf2.html#materials).

Use a separate high-resolution sculpt for fine detail and bake to a measured
runtime budget. The current 193k triangles are a reference, not a reason to export
millions of polygons. Smaller well-authored geometry can be better, but current
tests assume the existing density, vertex colors, eye mesh names, and eyelid rig.
Any deliberate replacement must update those assumptions while preserving real
quality checks; do not merely lower thresholds until tests pass.

Hair particles, hair curves, Cycles lighting, and simulation caches are authoring
or offline-render features, not this game's live fur system. Deliver baked detail
and, if agreed, skinned lightweight mesh fur/cards; check transparency cost and
deformation in the browser. Non-mesh data needs export-compatible treatment, as
described in the official [glTF mesh export notes](https://docs.blender.org/manual/en/3.3/addons/import_export/scene_gltf2.html#meshes).

## Export A Candidate GLB

These settings match the existing Blender 3.4 export path. Newer Blender versions
may label or organize animation options differently; record the version used and
verify separate clips after export instead of assuming compatibility.

1. Save the editable working `.blend` first. Export to a candidate such as `cat-candidate.glb`, not immediately over the production model.
2. Select the armature and **all** intended skinned cat meshes, including face details. Exclude `Preview.Ground`, `Preview.Camera`, preview lights, reference objects, and high-poly sculpt duplicates.
3. Choose **File > Export > glTF 2.0**, format **glTF Binary (.glb)**, and enable **Selected Objects**. Export materials, vertex colors, skinning, and normals; keep **+Y Up** enabled.
4. Enable animations and **Group by NLA Track**. Retain one named NLA track/strip per required action; clear the active action assignment in the Action Editor without deleting its action. For this source's export setup, unmute the seven tracks for export and remove any Solo isolation.
5. Match the existing pipeline's animation sampling: sample every frame, include the intended frame ranges, and bake the evaluated bone transforms. Keep the seven tracks independent; do not export a single combined scene animation.
6. Keep the skinned mesh/armature modifier relationship intact. The current generator uses `export_apply=False`; do not flatten/apply the armature to produce a static cat. Resolve non-exportable modifiers on a working copy, not by destructively baking the rig.
7. Use uncompressed GLB for the initial handoff; the current loader has no Draco/KTX2 decoder setup. Embed image dependencies in the GLB and retain editable texture sources separately.
8. Re-import the GLB into a new, separate Blender scene. Confirm all seven distinct clips, correct pose/orientation/scale, attached face details, and the expected materials. Restore the working source's track mute/action settings before further editing.

Track grouping is essential: exporting only the active action does not deliver
the complete animation set. The official [Blender glTF animation export guide](https://docs.blender.org/manual/en/3.3/addons/import_export/scene_gltf2.html#animation)
explains action/NLA grouping. The repo's `export_model()` in
`tools/generate_stray_style_cat.py` is the exact existing 3.4 settings reference;
do not call its `main()` to export a hand-edited file.

## Delivery And Review

Include these in an artist handoff folder or pull request:

- Editable `.blend`, with the artist's work intact and its Blender version recorded.
- Candidate animated `.glb`, with triangle count, file size, action names, and dimensions.
- Original/baked texture images and any external dependencies; pack or supply what the source needs to reopen without missing files.
- Front/side/rear/three-quarter and face previews; short walk, idle, groom, sit, jump, claw, and bite playblasts. Use neutral inspection lighting in addition to beauty lighting.
- A note identifying material, topology, rig, scale, or clip changes; known clipping/deformation issues; licenses/credits for every added resource.
- A clear source/export ownership note using the template below. No screenshots-only substitution for the playable asset.

Before replacing the canonical `.blend`/`.glb`, a maintainer should run the smoke
and visual tests, review the model in actual game lighting, and run vertical/full
autoplay tests if size or movement behavior changed. See [contributor checks](../CONTRIBUTING.md#checks).
Review paw contact, shoulder bends, eye/socket intersections, tail/haunch collisions,
white/brown color placement, all loop transitions, and performance at gameplay
distance. A GLB loading successfully is not visual acceptance.

## Source Ownership

An artist's hand sculpt does not have to be rewritten as Python to be valuable.
It does need an authoritative source and a repeatable way to export it.

- **Procedural contribution:** change the active generator and regenerate source, GLB, and previews together.
- **Manual art contribution:** keep the artist-authored `.blend` and export recipe/tool as the agreed source of truth. Before acceptance, the maintainer must document/adapt the export path so nobody regenerates from the old FBX and erases the art. Record the switch in `MEMORY.md` and update the old generator's instructions/entry point as appropriate.
- The original from-scratch generator remains authoritative until a manual contribution is reviewed and its replacement workflow is explicitly accepted. This guide does not silently switch pipelines.

Suggested handoff note:

```text
Task / artist:
Blender version:
Authoritative source file:
Export method and settings:
Procedural pipeline retained, or manual workflow proposed:
Changed geometry / materials / rig / actions / scale:
GLB triangles / bytes / action names:
Textures and dependencies:
License / attribution additions:
Tests and visual review performed:
Known issues and integration help needed:
```

## Common Problems

| Symptom | First checks |
| --- | --- |
| Great Blender render, unchanged game | A render is not the runtime model; confirm the GLB was integrated, then inspect the fur material override and browser cache |
| Only Idle exported | Other actions must be assigned to named NLA tracks and exported as separate clips |
| Poses are mixed together | Review track mute/Solo states, active-action assignment, and NLA grouping |
| Face details float or detach | Check inclusion in the export selection and correct armature modifier/weights |
| Coat scrambles | Preserve POINT-domain vertex colors for the Blender 3.4 path; inspect the exported/re-imported asset |
| Cat slides, faces backward, or sinks | Check origin, axes, skinning, root motion, bounds, and foot targets; do not compensate with inverted controls |
| Better model fails a test | Identify a genuine regression versus an old mesh-specific assumption; coordinate a meaningful test update |
| New GLB appears stale | Reload the local browser; for a release, confirm the deployed revision and model hash before blaming the art |

Keep current source/license attribution when modifying the existing mesh. A new
original/licensed model needs its own provenance review; editing this cat does not
remove the original author's credit. Do not publish or push to `main` without
authorization: it automatically deploys the website.
