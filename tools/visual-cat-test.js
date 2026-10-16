const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const captureScreenshot = require("./capture-screenshot");

const root = path.resolve(__dirname, "..");
const preview = (name) => path.join(root, "assets", "previews", `cat-inspection-${name}.png`);

(async () => {
  const server = spawn("python", ["-m", "http.server", "4175", "--bind", "127.0.0.1"], {
    cwd: root, stdio: "ignore", windowsHide: true,
  });
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.goto("http://127.0.0.1:4175", { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__megaChonk?.state.ready, null, { timeout: 30000 });
    await page.evaluate(() => window.__megaChonk.start());
    await page.waitForFunction(() => document.querySelector("#level-transition").classList.contains("is-hidden"));
    await page.evaluate(() => { window.__megaChonk.state.started = false; });

    const pose = async (name, fraction, yaw = 1.1) => {
      await page.evaluate(({ name, fraction, yaw }) => {
        const { character, state } = window.__megaChonk;
        state.yaw = yaw;
        character.mixer.stopAllAction();
        const action = character.actions[name];
        action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
        action.time = action.getClip().duration * fraction;
        action.paused = true;
        character.currentAction = action;
      }, { name, fraction, yaw });
      await page.waitForTimeout(300);
    };

    const floorBounds = async () => page.evaluate(async () => {
      const THREE = await import("/vendor/three/build/three.module.js");
      const point = new THREE.Vector3();
      let minimum = Infinity;
      let maximum = -Infinity;
      window.__megaChonk.character.model.traverse((mesh) => {
        if (!mesh.isSkinnedMesh || mesh.geometry.attributes.position.count < 50000) return;
        mesh.updateMatrixWorld(true);
        mesh.skeleton.update();
        for (let index = 0; index < mesh.geometry.attributes.position.count; index += 17) {
          mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld);
          minimum = Math.min(minimum, point.y);
          maximum = Math.max(maximum, point.y);
        }
      });
      return { minimum, maximum };
    });

    for (const [name, yaw] of [["rear", 0], ["side", Math.PI / 2], ["front", Math.PI], ["three-quarter", 2.3]]) {
      await pose("Idle", 0.35, yaw);
      await captureScreenshot(page, { path: preview(name) });
    }
    await pose("Idle", 113 / 239, Math.PI);
    const nightEyes = await page.evaluate(() => {
      const result = [];
      window.__megaChonk.character.model.traverse((mesh) => {
        if (!/^Eye[._]?[LR]$/.test(mesh.name)) return;
        const colors = mesh.geometry.attributes.color;
        const positions = mesh.geometry.attributes.position;
        let dark = 0;
        let minY = Infinity;
        let maxY = -Infinity;
        for (let index = 0; index < colors.count; index += 1) {
          if (Math.max(colors.getX(index), colors.getY(index), colors.getZ(index)) < 0.015) dark += 1;
          minY = Math.min(minY, positions.getY(index));
          maxY = Math.max(maxY, positions.getY(index));
        }
        result.push({ name: mesh.name, darkFraction: dark / colors.count, apertureHeight: maxY - minY });
      });
      return result;
    });
    if (nightEyes.length !== 2 || nightEyes.some((eye) => eye.darkFraction < 0.65 || eye.apertureHeight < 0.040)) errors.push(`Night eye regression: ${JSON.stringify(nightEyes)}`);
    const eyelids = await page.evaluate(() => {
      const result = [];
      window.__megaChonk.character.model.traverse((object) => {
        if (object.isBone && /Eyelid/.test(object.name)) result.push({ name: object.name, scale: object.scale.toArray() });
      });
      return result;
    });
    if (eyelids.length !== 2 || eyelids.some((bone) => Math.min(...bone.scale) > 0.15)) errors.push(`Missing skeletal blink: ${JSON.stringify(eyelids)}`);
    await captureScreenshot(page, { path: preview("blink") });
    const contacts = [];
    for (const name of ["Idle", "Walk", "Sit", "Groom"]) {
      const fractions = name === "Sit" ? [0, 0.25, 0.60, 0.95] : [0.05, 0.25, 0.5, 0.75, 0.95];
      for (const fraction of fractions) {
        await pose(name, fraction, 2.3);
        const bounds = await floorBounds();
        contacts.push({ name, fraction, ...bounds });
        if (bounds.minimum < -0.02) errors.push(`${name} at ${fraction}: mesh sinks below floor by ${(-bounds.minimum).toFixed(3)} units`);
        if (bounds.maximum > 2.4 || !Number.isFinite(bounds.maximum)) errors.push(`${name}: invalid body bounds ${JSON.stringify(bounds)}`);
      }
      await captureScreenshot(page, { path: preview(name.toLowerCase()) });
    }
    await pose("Walk", 0.1, 0);
    await page.evaluate(() => { window.__megaChonk.character.actions.Walk.paused = false; });
    const performance = await page.evaluate(() => new Promise((resolve) => {
      const intervals = [];
      let previous;
      function sample(time) {
        if (previous !== undefined) intervals.push(time - previous);
        previous = time;
        if (intervals.length < 120) requestAnimationFrame(sample);
        else {
          intervals.sort((a, b) => a - b);
          resolve({ medianFps: Number((1000 / intervals[60]).toFixed(1)), p95FrameMs: Number(intervals[114].toFixed(1)) });
        }
      }
      requestAnimationFrame(sample);
    }));
    console.log(JSON.stringify({ snapshot: await page.evaluate(() => window.__megaChonk.snapshot()), nightEyes, eyelids, contacts, performance, errors }, null, 2));
    if (errors.length) throw new Error(errors.join("\n"));
    console.log("Visual cat inspection passed");
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
