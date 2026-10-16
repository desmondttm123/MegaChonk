const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const assert = require("assert/strict");

(async () => {
  const root = path.resolve(__dirname, "..");
  const remote = process.argv[2];
  const server = remote ? null : spawn("python", ["-m", "http.server", "4179", "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore", windowsHide: true });
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (error) => errors.push(error.message));
    if (server) await new Promise((resolve) => setTimeout(resolve, 500));
    await page.goto(remote || "http://127.0.0.1:4179", { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__megaChonk?.state.ready, null, { timeout: 60000 });
    const enter = await page.locator("#enter-game").boundingBox();
    const unitChecks = await page.evaluate(async () => {
      const { MouseLookController } = await import(new URL("camera-controls.js", location.href).href);
      const fail = (message) => { throw new Error(message); };
      const sums = [];
      for (const fps of [30, 60, 144]) {
        const look = new MouseLookController();
        look.setLocked(true, 0);
        look.addMovement(400, 300, 20);
        if (look.consume(1 / fps).yaw !== 0) fail("Lock-entry cursor warp was accepted");
        let yaw = 0;
        let pitch = 0;
        for (let frame = 0; frame < fps; frame += 1) {
          look.addMovement(120 / fps, 30 / fps, 200 + frame * 1000 / fps);
          const step = look.consume(1 / fps);
          yaw += step.yaw;
          pitch += step.pitch;
          if (Math.abs(step.yaw) > 4.2 / fps + 1e-8) fail("Yaw rate limit exceeded");
        }
        for (let frame = 0; frame < fps; frame += 1) {
          const step = look.consume(1 / fps);
          yaw += step.yaw;
          pitch += step.pitch;
        }
        if (Math.abs(yaw + 120 * 0.00145) > 1e-7 || Math.abs(pitch - 30 * 0.0011) > 1e-7) fail(`Mouse input depends on FPS: ${fps}`);
        sums.push({ fps, yaw, pitch });
      }
      const look = new MouseLookController();
      look.setLocked(true, 0);
      look.addMovement(1, 0, 200);
      for (const [x, y] of [[NaN, 0], [Infinity, 1], [1, -Infinity], [12000, -9000]]) look.addMovement(x, y, 201);
      if (look.consume(1 / 60).yaw !== 0 || look.rejectedSamples !== 4) fail("Invalid mouse input was not rejected");
      let burstYaw = 0;
      for (let frame = 0; frame < 60; frame += 1) {
        if (frame < 20) for (let event = 0; event < 1000; event += 1) look.addMovement(2, 1, 300 + frame * 16.67);
        const step = look.consume(1 / 60);
        if (Math.abs(step.yaw) > 4.2 / 60 + 1e-8 || Math.abs(step.pitch) > 2.4 / 60 + 1e-8) fail("Burst input exceeded turn-rate limits");
        burstYaw += step.yaw;
      }
      if (Math.abs(look.consume(1 / 60).yaw) > 1e-7) fail("A mouse-input backlog continued spinning after release");
      look.addMovement(30, 20, 2000);
      look.setLocked(false, 2001);
      if (look.consume(1 / 60).yaw !== 0) fail("Unlock did not clear queued input");
      look.setLocked(true, 3000);
      look.addMovement(200, 200, 3101);
      if (look.consume(1 / 60).yaw !== 0) fail("Relock accepted the first cursor-warp sample");
      return { frameRates: sums, invalidSamples: 4, burstYaw };
    });
    await page.click("#enter-game");
    await page.waitForFunction(() => document.pointerLockElement?.id === "game" && !window.__megaChonk.state.transitioning);
    const spike = await page.evaluate(() => {
      const { state } = window.__megaChonk;
      const before = state.yaw;
      document.dispatchEvent(new MouseEvent("mousemove", { movementX: 12000, movementY: -9000 }));
      return { before, after: state.yaw, pitch: state.pitch };
    });
    await page.waitForTimeout(300);
    const afterSpike = await page.evaluate(() => window.__megaChonk.state.yaw);
    assert.ok(Math.abs(afterSpike - spike.before) < 0.01, "An invalid mouse delta violently rotates the camera");

    const dispatch = (x, y) => page.evaluate(({ x, y }) => {
      document.dispatchEvent(new MouseEvent("mousemove", { movementX: x, movementY: y }));
    }, { x, y });
    await dispatch(1, 0);
    await page.waitForTimeout(150);
    const smallBefore = await page.evaluate(() => window.__megaChonk.cameraSnapshot());
    await dispatch(4, 2);
    await page.waitForTimeout(300);
    const smallAfter = await page.evaluate(() => window.__megaChonk.cameraSnapshot());
    assert.ok(Math.abs(smallAfter.yaw - smallBefore.yaw + 0.0058) < 0.0002, "Small horizontal mouse motion is lost or amplified");
    assert.ok(Math.abs(smallAfter.pitch - smallBefore.pitch - 0.0022) < 0.0002, "Small vertical mouse motion is lost or amplified");

    await page.mouse.move(enter.x + enter.width / 2 + 4, enter.y + enter.height / 2 + 2, { steps: 4 });
    await page.waitForTimeout(300);
    const native = await page.evaluate(() => window.__megaChonk.cameraSnapshot());
    assert.ok(Math.abs(native.yaw - smallAfter.yaw) > 0.0001 && Math.abs(native.yaw - smallAfter.yaw) < 0.03, "Native pointer-locked mouse motion is not small and responsive");

    const burst = await page.evaluate(async () => {
      const game = window.__megaChonk;
      const before = game.cameraSnapshot();
      for (let event = 0; event < 1000; event += 1) document.dispatchEvent(new MouseEvent("mousemove", { movementX: 2, movementY: 1 }));
      const frames = [before];
      for (let frame = 0; frame < 30; frame += 1) {
        await new Promise(requestAnimationFrame);
        frames.push(game.cameraSnapshot());
      }
      return { totalYaw: frames.at(-1).yaw - before.yaw, maxStep: Math.max(...frames.slice(1).map((sample, index) => Math.abs(sample.yaw - frames[index].yaw))), tail: Math.abs(frames.at(-1).yaw - frames.at(-6).yaw) };
    });
    assert.ok(burst.maxStep <= 4.2 * 0.033 + 0.001 && Math.abs(burst.totalYaw) < 0.15 && burst.tail < 0.0001, "Event bursts cause a jump or leave queued camera spin");

    const beforeBlur = await page.evaluate(() => {
      const before = window.__megaChonk.state.yaw;
      document.dispatchEvent(new MouseEvent("mousemove", { movementX: 30, movementY: 20 }));
      window.dispatchEvent(new Event("blur"));
      document.dispatchEvent(new MouseEvent("mousemove", { movementX: 100, movementY: 100 }));
      return before;
    });
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__megaChonk.state.yaw), beforeBlur, "Blur leaves queued mouse motion or accepts background input");
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new MouseEvent("mousemove", { movementX: 400, movementY: 300 }));
    });
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__megaChonk.state.yaw), beforeBlur, "Focus recovery accepts a cursor warp");
    await dispatch(4, 2);
    await page.waitForTimeout(250);
    assert.ok(Math.abs(await page.evaluate(() => window.__megaChonk.state.yaw) - beforeBlur + 0.0058) < 0.0002, "Mouse look fails to resume after focus recovery");

    await page.evaluate(() => document.exitPointerLock());
    await page.waitForFunction(() => document.pointerLockElement === null);
    await page.waitForTimeout(150);
    const unlocked = await page.evaluate(() => window.__megaChonk.state.yaw);
    await dispatch(250, 100);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.__megaChonk.state.yaw), unlocked, "Unlocked mouse movement rotates the camera");
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page.evaluate(() => document.addEventListener("pointerlockchange", () => {
        if (document.pointerLockElement) document.dispatchEvent(new MouseEvent("mousemove", { movementX: 400, movementY: -300 }));
      }, { once: true }));
      await page.click("#game", { position: { x: 720, y: 450 } });
      await page.waitForFunction(() => document.pointerLockElement?.id === "game");
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => window.__megaChonk.state.yaw), unlocked, "Capturing the mouse jumps to a different heading");
      await page.evaluate(() => document.exitPointerLock());
      await page.waitForFunction(() => document.pointerLockElement === null);
    }

    const collision = await page.evaluate(async () => {
      const game = window.__megaChonk;
      game.state.started = false;
      game.regenerate(424242);
      game.loadLevel(0);
      game.character.root.position.set(-15.1, 0, 3.8);
      game.state.pitch = 0.08;
      const samples = [];
      for (let index = 0; index <= 80; index += 1) {
        game.state.yaw = -1.2 + index * 0.02;
        await new Promise(requestAnimationFrame);
        samples.push(game.cameraSnapshot());
      }
      let pair;
      for (let index = 1; index < samples.length; index += 1) {
        const a = samples[index - 1];
        const b = samples[index];
        if (Math.abs(a.desiredDistance - b.desiredDistance) > 0.6) { pair = a.desiredDistance < b.desiredDistance ? [a, b] : [b, a]; break; }
      }
      if (!pair) throw new Error("Collision test did not cross a furniture corner");
      game.state.yaw = pair[0].yaw;
      for (let frame = 0; frame < 60; frame += 1) await new Promise(requestAnimationFrame);
      const distances = [game.cameraSnapshot().distance];
      game.state.yaw = pair[1].yaw;
      for (let frame = 0; frame < 60; frame += 1) {
        await new Promise(requestAnimationFrame);
        distances.push(game.cameraSnapshot().distance);
      }
      return { orbitChange: Math.abs(pair[1].yaw - pair[0].yaw), obstructionDistance: pair[0].desiredDistance, clearDistance: pair[1].desiredDistance, maxOutwardStep: Math.max(...distances.slice(1).map((distance, index) => distance - distances[index])), finalDistance: distances.at(-1) };
    });
    assert.ok(collision.maxOutwardStep < 0.33 && collision.finalDistance > collision.clearDistance - 0.15, "Camera snaps outward at a furniture corner or fails to recover");
    console.log(JSON.stringify({ url: page.url(), unitChecks, spike, smallMotion: { yaw: smallAfter.yaw - smallBefore.yaw, pitch: smallAfter.pitch - smallBefore.pitch }, nativeMouseDelta: native.yaw - smallAfter.yaw, burst, focusRecovery: true, pointerLockCycles: 3, collision, errors }, null, 2));
    assert.deepEqual(errors, []);
    console.log("Camera controls passed");
  } finally {
    if (browser) await browser.close();
    server?.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
