# Contributing To Mega Chonk

Start with [AGENTS.md](AGENTS.md) and [MEMORY.md](MEMORY.md). The memory explains
where the previous contributor stopped; this document explains how to work here.

## Local Setup

The game has no Node build step, runtime npm dependencies, or backend. Use a
modern desktop browser with WebGL 2 and Python for a local HTTP server:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`, or use `start-game.bat` on Windows. Do not open
`index.html` through `file://`; module/model loading needs HTTP.

Browser verification additionally requires Node.js, a resolvable `playwright`
package, and Microsoft Edge. Existing tests use the executable path
`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
Other platforms need an intentional launcher adjustment; do not silently skip
browser tests or claim they passed. There is no `npm test` script/package manifest.

If Node/Playwright are supplied by an external tool environment, use its Node
executable and set `NODE_PATH` to its `node_modules` directory as needed. The
original workstation used a Codex-bundled runtime; locate the current installation
rather than committing a machine-specific runtime hash. Do not commit credentials
or `node_modules/` to make testing work.

## Checks

PowerShell syntax checks and deployment build:

```powershell
foreach ($file in 'game.js', 'course-generator.js', 'camera-controls.js', 'touch-controls.js') {
  Get-Content -Raw $file | node --input-type=module --check
  if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $file" }
}
python tools/build_pages.py
```

Browser test commands, run from the repository root:

```powershell
node tools/smoke-test.js
node tools/camera-controls-test.js
node tools/mobile-controls-test.js
node tools/generation-test.js
node tools/vertical-challenges-test.js
node tools/visual-cat-test.js
node tools/autoplay-test.js 424242
node tools/autoplay-test.js 765432
node tools/pages-test.js
```

| Change | Required relevant checks |
| --- | --- |
| Gameplay, physics, progression, eating | Smoke, vertical challenges, full autoplay |
| Mouse/input/follow camera | Camera controls, smoke, Pages |
| Touch controls or mobile layout | Mobile controls, camera controls, smoke, Pages; autoplay if shared movement changes |
| Random layouts or house/cat scale | Generation, smoke, vertical challenges, both autoplay seeds, visual review |
| Cat geometry/materials/rig/animation | Blender re-import verification, smoke, visual inspection; vertical/autoplay if movement bounds change |
| Packaging/imports/deployment | Syntax, runtime-only build, local Pages test, then live checks when release is authorized |
| Documentation only | Check paths, commands, current-source consistency, Markdown links, and diff; no need to regenerate assets or replay unchanged gameplay |

Test servers use ports 4173-4180 and are started/stopped by the scripts. Stop a
manually launched server on a conflicting port first. Test captures are written
under `assets/previews/`; inspect changed images before staging them. Use
`tools/capture-screenshot.js` for captures to handle transient Windows PNG locks.

The bot's scenario helpers are for testing, not proof that a human route works.
Full autoplay must traverse required objectives using controls. Record the seed
when reporting a generated-layout failure.

The mobile suite uses browser-dispatched multi-touch events in an emulated
Chromium phone, not physical iOS/Android hardware or Safari. Inspect its portrait
and landscape captures and retain physical-device testing as a separate check.

## Character Work

Artists: read the [artist cat guide](docs/artist-cat-guide.md) first. It explains
rig-preserving improvements, full replacements, manual-source ownership, texture
integration, animation/export settings, and what to deliver. Do not regenerate
over an artist's hand-edited source.

The active pipeline is `tools/generate_stray_style_cat.py`, not the archived v2/v3
generators. Run it separately from any interactive Blender scene:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 3.4\blender.exe' --background --factory-startup --python-exit-code 1 --python tools/generate_stray_style_cat.py
```

It regenerates the canonical Blender/GLB and inspection renders, then re-imports
the GLB to check density, skinning, and clips. Review the face, forelegs, floor
contact, and animation poses visually; increasing mesh density alone does not
verify quality. Preserve POINT-domain vertex colors and source attribution.
The standalone printable sitting model has a separate generator.

## Release And Handoff

1. Review `git diff` and `git status`; stage only the intended contribution.
2. Update `MEMORY.md` with what changed, what was tested, what remains, and any decisions.
3. Commit/push only when authorized. Pushing `main` deploys the game automatically.
4. Check the Actions result and deployed `build-manifest.json`; a pushed commit is not proof of successful deployment.
5. For an authorized release, verify the relevant live behavior as well as packaging:

```powershell
node tools/pages-test.js https://desmondttm123.github.io/MegaChonk/
node tools/camera-controls-test.js https://desmondttm123.github.io/MegaChonk/
node tools/mobile-controls-test.js https://desmondttm123.github.io/MegaChonk/
```

The Pages test compares the served cat's SHA-256 against the local asset. Run it
against the intended checkout. Report tests skipped or unavailable, not just
successful checks. Never commit `dist/`, logs, Blender backups, dependencies,
tokens, or credentials. Do not change repository/Pages settings merely to finish
an unrelated task.
