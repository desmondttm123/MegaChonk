const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

(async () => {
  const root = path.resolve(__dirname, "..");
  const server = spawn("python", ["-m", "http.server", "4173", "--bind", "127.0.0.1"], {
    cwd: root,
    stdio: "ignore",
    windowsHide: true,
  });
  const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const browser = await chromium.launch({ headless: true, executablePath: edge });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console:${message.text()}`);
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__megaChonk?.state?.ready === true, null, { timeout: 30000 });
    await page.waitForTimeout(120);
    const modelVisual = await page.evaluate(() => ({
      ...window.__megaChonk.snapshot(),
      coatSelectors: document.querySelectorAll("[data-coat]").length,
      modelName: window.__megaChonk.character.model?.name,
      bodyMaterial: (() => {
        let result = null;
        window.__megaChonk.character.model?.traverse((object) => {
          if (result || !object.isMesh || object.geometry.attributes.position.count < 50000) return;
          const material = Array.isArray(object.material) ? object.material[0] : object.material;
          result = {
            name: material?.name,
            type: material?.type,
            wireframe: material?.wireframe,
            flatShading: material?.flatShading,
            vertexColors: material?.vertexColors,
            hasNormalMap: Boolean(material?.normalMap),
            hasBumpMap: Boolean(material?.bumpMap),
            hasVertexNormals: Boolean(object.geometry.attributes.normal),
            hasVertexColors: Boolean(object.geometry.attributes.color),
            positionCount: object.geometry.attributes.position.count,
            indexed: Boolean(object.geometry.index),
            brownPawVertices: (() => {
              const colors = object.geometry.attributes.color;
              const positions = object.geometry.attributes.position;
              let invalid = 0;
              for (let index = 0; index < positions.count; index += 1) {
                if (positions.getY(index) < 0.12 && colors.getY(index) < 0.4) invalid += 1;
              }
              return invalid;
            })(),
          };
        });
        return result;
      })(),
    }));

    const levelChecks = [];
    for (const level of [0, 1, 2]) {
      levelChecks.push(await page.evaluate((index) => {
        window.__megaChonk.loadLevel(index);
        return window.__megaChonk.snapshot();
      }, level));
    }
    await page.evaluate(() => window.__megaChonk.regenerate(111111));
    const layoutA = await page.evaluate(() => window.__megaChonk.snapshot().layoutSignature);
    await page.evaluate(() => window.__megaChonk.regenerate(222222));
    const layoutB = await page.evaluate(() => window.__megaChonk.snapshot().layoutSignature);
    await page.evaluate(() => {
      window.__megaChonk.loadLevel(0);
      window.__megaChonk.setCondition(62, 48);
      window.__megaChonk.start();
    });
    await page.waitForFunction(() => window.__megaChonk.state.transitioning === false, null, { timeout: 5000 });

    const before = await page.evaluate(() => window.__megaChonk.snapshot());
    await page.keyboard.down("w");
    await page.waitForTimeout(1100);
    const during = await page.evaluate(() => window.__megaChonk.snapshot());
    await page.keyboard.up("w");
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => window.__megaChonk.snapshot());

    await page.keyboard.press("Space");
    await page.waitForTimeout(180);
    const jumping = await page.evaluate(() => window.__megaChonk.snapshot());
    await page.waitForFunction(() => window.__megaChonk.state.grounded === true, null, { timeout: 3000 });

    await page.keyboard.press("q");
    await page.waitForTimeout(420);
    const sitting = await page.evaluate(() => window.__megaChonk.snapshot());
    await page.keyboard.press("q");
    await page.waitForTimeout(260);

    await page.keyboard.press("f");
    await page.waitForTimeout(140);
    const clawing = await page.evaluate(() => window.__megaChonk.snapshot());
    await page.waitForTimeout(850);
    await page.keyboard.press("e");
    await page.waitForTimeout(140);
    const biting = await page.evaluate(() => window.__megaChonk.snapshot());
    await page.waitForTimeout(800);

    await page.evaluate(() => window.__megaChonk.setCondition(60, 95));
    const heavyBefore = await page.evaluate(() => window.__megaChonk.snapshot());
    await page.keyboard.press("Space");
    await page.waitForTimeout(180);
    const heavyBlocked = await page.evaluate(() => window.__megaChonk.snapshot());
    await page.evaluate(() => window.__megaChonk.setCondition(5, 50));
    await page.keyboard.press("Space");
    await page.waitForTimeout(180);
    const hungryBlocked = await page.evaluate(() => window.__megaChonk.snapshot());

    await page.evaluate(() => {
      window.__megaChonk.setCondition(62, 48);
      window.__megaChonk.state.idleTime = 0;
      window.__megaChonk.state.forcedAction = null;
      window.__megaChonk.state.actionTime = 0;
    });
    await page.waitForTimeout(5300);
    const groomed = await page.evaluate(() => window.__megaChonk.snapshot());
    await page.screenshot({
      path: path.join(root, "assets", "previews", "mega-chonk-gameplay.png"),
    });
    await page.keyboard.down("w");
    await page.waitForTimeout(220);
    const groomInterrupted = await page.evaluate(() => window.__megaChonk.snapshot());
    await page.keyboard.up("w");
    for (const level of [1, 2]) {
      await page.evaluate((index) => window.__megaChonk.loadLevel(index), level);
      await page.waitForTimeout(650);
      await page.screenshot({
        path: path.join(root, "assets", "previews", `mega-chonk-level-${level + 1}.png`),
      });
    }
    const moved = Math.hypot(after.position[0] - before.position[0], after.position[2] - before.position[2]);
    if (moved < 0.4) errors.push(`movement:cat only moved ${moved.toFixed(3)} units`);
    if (after.position[2] >= before.position[2] - 0.35) errors.push(`movement:W should move away from the camera toward -Z, got ${before.position[2].toFixed(3)} -> ${after.position[2].toFixed(3)}`);
    if (!during.activeAnimation?.startsWith("Walk")) errors.push(`animation:expected Walk, got ${during.activeAnimation}`);
    if (!jumping.activeAnimation?.startsWith("Jump") || jumping.position[1] < 0.12 || jumping.grounded) {
      errors.push(`jump:expected airborne Jump above 0.12, got ${JSON.stringify(jumping)}`);
    }
    if (!sitting.activeAnimation?.startsWith("Sit") || !sitting.sitting) errors.push(`animation:expected Sit, got ${sitting.activeAnimation}`);
    if (!clawing.activeAnimation?.startsWith("Claw")) errors.push(`animation:expected Claw, got ${clawing.activeAnimation}`);
    if (!biting.activeAnimation?.startsWith("Bite")) errors.push(`animation:expected Bite, got ${biting.activeAnimation}`);
    if (!groomed.activeAnimation?.startsWith("Groom")) errors.push(`animation:expected Groom after idle timeout, got ${groomed.activeAnimation}`);
    if (!groomInterrupted.activeAnimation?.startsWith("Walk")) errors.push(`animation:movement failed to interrupt Groom, got ${groomInterrupted.activeAnimation}`);
    if (after.satiety >= before.satiety) errors.push("satiety:movement did not drain satiety");
    if (modelVisual.visualMode !== "skinned-mesh") errors.push(`visual:unexpected mode ${modelVisual.visualMode}`);
    if (modelVisual.triangles < 175000) errors.push(`visual:expected high-density cat mesh, got ${modelVisual.triangles} triangles`);
    if (modelVisual.animationClips !== 7) errors.push(`visual:expected 7 skeletal clips, got ${modelVisual.animationClips}`);
    if (modelVisual.skinnedMeshes < 1) errors.push("visual:model has no skinned meshes");
    if (modelVisual.bodyMaterial.brownPawVertices !== 0) errors.push(`visual:exported coat colors are scrambled on ${modelVisual.bodyMaterial.brownPawVertices} paw vertices`);
    if (modelVisual.coat !== "van" || modelVisual.coatSelectors !== 0) errors.push("visual:Turkish Van was not the sole runtime coat");
    if (modelVisual.modelName !== "TurkishVanSkinnedRig") errors.push(`visual:missing skinned runtime model, got ${modelVisual.modelName}`);
    if (Math.abs(heavyBlocked.position[1] - heavyBefore.position[1]) > 0.03 || heavyBlocked.jumpAllowed) errors.push("jump:heavy condition did not block the leap");
    if (hungryBlocked.position[1] > 0.03 || hungryBlocked.jumpAllowed) errors.push("jump:hunger condition did not block the leap");
    if (layoutA === layoutB) errors.push("generation:different seeds produced the same collider layout");
    const expectedFoods = [3, 4, 5];
    for (let i = 0; i < levelChecks.length; i += 1) {
      const level = levelChecks[i];
      if (level.level !== i || level.foodsRemaining !== expectedFoods[i]) errors.push(`level:${i + 1} generated incorrect objectives`);
      if (level.movingPlatforms < 1 || level.hazards < 2 || level.colliders < 10) errors.push(`level:${i + 1} lacks obstacle systems`);
    }
    for (const action of ["Idle", "Walk", "Groom", "Jump", "Sit", "Claw", "Bite"]) {
      if (!before.availableActions.includes(action)) errors.push(`animation:missing ${action} clip`);
    }
    console.log(JSON.stringify({
      modelVisual,
      levelChecks,
      randomLayoutsDiffer: layoutA !== layoutB,
      before,
      during,
      after,
      jumping,
      sitting,
      clawing,
      biting,
      heavyBlocked,
      hungryBlocked,
      groomed,
      moved: Number(moved.toFixed(3)),
    }, null, 2));
  } finally {
    await browser.close();
    server.kill();
  }

  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log("ok");
})();
