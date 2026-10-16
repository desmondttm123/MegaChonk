const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const assert = require("assert/strict");
const captureScreenshot = require("./capture-screenshot");

const root = path.resolve(__dirname, "..");
const target = process.argv[2] || "http://127.0.0.1:4180/";

(async () => {
  const server = process.argv[2] ? null : spawn("python", ["-m", "http.server", "4180", "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore", windowsHide: true });
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await context.addInitScript(() => {
      window.__pointerLockRequests = 0;
      HTMLCanvasElement.prototype.requestPointerLock = () => { window.__pointerLockRequests += 1; throw new Error("Pointer lock is unavailable on this phone"); };
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    if (server) await page.waitForTimeout(500);
    await page.goto(target, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__megaChonk?.state.ready, null, { timeout: 60000 });
    assert.equal(await page.getAttribute("#touch-toggle", "aria-pressed"), "true", "Phone should default to touch controls");
    assert.equal(await page.locator("#touch-controls").isVisible(), false, "Controls must not cover the boot screen");
    const client = await context.newCDPSession(page);
    const points = new Map();
    async function send(type, contacts = [...points.values()]) {
      await client.send("Input.dispatchTouchEvent", { type, touchPoints: contacts.map((point) => ({ ...point, radiusX: 6, radiusY: 6, force: 1 })) });
    }
    async function down(id, x, y) { points.set(id, { id, x, y }); await send("touchStart"); }
    async function move(id, x, y) { points.set(id, { id, x, y }); await send("touchMove"); }
    async function up(id) { const ended = points.get(id); points.delete(id); await send("touchEnd", [ended]); }
    async function cancel() { points.clear(); await send("touchCancel"); }
    async function center(selector) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box, `Missing ${selector}`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width };
    }
    async function tap(selector, id = 9) {
      const point = await center(selector);
      await down(id, point.x, point.y);
      await up(id);
    }
    const snapshot = () => page.evaluate(() => ({ ...window.__megaChonk.snapshot(), touch: window.__megaChonk.touchSnapshot(), speed: window.__megaChonk.character.velocity.length() }));
    async function assertStopped(message) {
      await page.waitForTimeout(650);
      const result = await snapshot();
      assert.equal(result.touch.x, 0, message);
      assert.equal(result.touch.z, 0, message);
      assert.equal(result.touch.pointers.length, 0, message);
      assert.ok(result.speed < 0.04, `${message}: cat is still moving`);
      return result;
    }
    const bootLayouts = [];
    for (const size of [{ width: 844, height: 390 }, { width: 568, height: 320 }, { width: 320, height: 568 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(80);
      const children = await page.locator("#boot").evaluate((boot) => [...boot.children].filter((element) => getComputedStyle(element).display !== "none").map((element) => { const b = element.getBoundingClientRect(); return { name: element.id || element.className || element.tagName, x: b.x, y: b.y, width: b.width, height: b.height }; }));
      for (const child of children) assert.ok(child.x >= 0 && child.y >= 0 && child.x + child.width <= size.width + 1 && child.y + child.height <= size.height - 30, `Offscreen boot content at ${size.width}x${size.height}: ${JSON.stringify(child)}`);
      bootLayouts.push(size);
    }
    await tap("#enter-game");
    await page.waitForFunction(() => window.__megaChonk.touchSnapshot().playing);
    await page.evaluate(() => window.__megaChonk.regenerate(424242));
    const initial = await snapshot();
    let stick = await center("#move-stick");
    await down(1, stick.x, stick.y - 2);
    await page.waitForTimeout(250);
    assert.equal((await snapshot()).touch.z, 0, "Joystick dead zone should ignore resting-thumb noise");
    await up(1);
    await down(1, stick.x, stick.y);
    await move(1, stick.x, stick.y - stick.width * 0.34);
    await page.waitForTimeout(1000);
    const walking = await snapshot();
    assert.ok(walking.position[2] < initial.position[2] - 1.5, "Joystick forward movement is inverted or unresponsive");
    assert.ok(walking.activeAnimation.startsWith("Walk"));
    assert.ok(walking.satiety < initial.satiety, "Touch movement must drain satiety");
    await tap('[data-touch-action="trot"]');
    await page.waitForTimeout(500);
    const trotting = await snapshot();
    assert.ok(trotting.touch.trotting && trotting.speed > walking.speed * 1.25, `Trot toggle does not increase speed: ${JSON.stringify({ walk: walking.speed, trot: trotting.speed, touch: trotting.touch, action: trotting.forcedAction })}`);

    const beforeLook = await page.evaluate(() => window.__megaChonk.cameraSnapshot());
    await down(2, 265, 330);
    for (let step = 1; step <= 8; step += 1) { await move(2, 265 + step * 7, 330 - step * 3); await page.waitForTimeout(18); }
    await page.waitForTimeout(150);
    const afterLook = await page.evaluate(() => window.__megaChonk.cameraSnapshot());
    assert.ok(afterLook.yaw < beforeLook.yaw - 0.15 && Math.abs(afterLook.yaw - beforeLook.yaw) < 0.5, "Touch camera drag is lost, inverted, or violent");
    assert.ok(afterLook.pitch < beforeLook.pitch, "Vertical camera swipe is inverted");
    assert.deepEqual((await snapshot()).touch.pointers.sort(), ["look", "move"]);
    const jumpPoint = await center('[data-touch-action="jump"]');
    await down(3, jumpPoint.x, jumpPoint.y);
    assert.equal((await snapshot()).touch.pointers.length, 3, "Joystick/look/jump must support three simultaneous touches");
    await up(3);
    await page.waitForTimeout(170);
    const jumping = await snapshot();
    assert.ok(!jumping.grounded && jumping.position[1] > 0.15, "Touch jump failed while moving/looking");
    await up(2);
    await move(1, stick.x + 150, stick.y - 150);
    await page.waitForTimeout(80);
    const captured = (await snapshot()).touch;
    assert.ok(captured.x > 0.6, `Joystick lost capture outside its base: ${JSON.stringify(captured)}`);
    await up(1);
    await page.waitForFunction(() => window.__megaChonk.state.grounded);
    await assertStopped("Lifting the thumb must stop movement");
    const beforeFlick = await page.evaluate(() => window.__megaChonk.state.yaw);
    await down(2, 265, 330);
    await move(2, 277, 330);
    await up(2);
    await page.waitForTimeout(250);
    const flickYaw = await page.evaluate(() => window.__megaChonk.state.yaw);
    assert.ok(flickYaw < beforeFlick - 0.04 && flickYaw > beforeFlick - 0.10, "A quick released camera swipe must not lose its final input");

    await tap('[data-touch-action="sit"]');
    await page.waitForTimeout(180);
    assert.ok((await snapshot()).sitting, "Sit button failed");
    await down(1, stick.x, stick.y - 40);
    await page.waitForTimeout(180);
    assert.equal((await snapshot()).sitting, false, "Movement must interrupt sitting");
    await up(1);
    await assertStopped("Sit interruption cleanup");
    for (const [button, action] of [["claw", "Claw"], ["bite", "Bite"]]) {
      await tap(`[data-touch-action="${button}"]`);
      await page.waitForTimeout(100);
      assert.equal((await snapshot()).forcedAction, action, `${action} button failed`);
      await page.waitForTimeout(850);
    }
    await page.evaluate(() => { window.__megaChonk.state.idleTime = 5.1; });
    await page.waitForTimeout(100);
    assert.ok((await snapshot()).activeAnimation.startsWith("Groom"));
    await down(1, stick.x, stick.y - 40);
    await page.waitForTimeout(200);
    assert.ok((await snapshot()).activeAnimation.startsWith("Walk"), "Joystick did not interrupt grooming");
    await cancel();
    await assertStopped("Touch cancellation must clear movement and pointers");
    await page.evaluate(() => {
      const game = window.__megaChonk;
      const food = game.navigation().foods.find((food) => food.position[1] === 0);
      game.character.root.position.fromArray(food.position);
      game.character.velocity.set(0, 0, 0);
      game.character.verticalVelocity = 0;
      game.state.grounded = true;
      game.state.forcedAction = null;
      game.state.actionTime = 0;
    });
    await page.waitForFunction(() => window.__megaChonk.state.eatingTime > 0.1);
    await down(1, stick.x, stick.y - 15);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__megaChonk.state.eatingTime), 0, "Small analog movement must immediately interrupt eating");
    await cancel();
    await page.evaluate(() => window.__megaChonk.regenerate(424242));
    await page.waitForTimeout(50);

    const layouts = [];
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(180);
      const layout = await page.evaluate(() => {
        const elements = [document.querySelector("#move-stick"), ...document.querySelectorAll(".touch-actions button"), document.querySelector("#touch-toggle"), document.querySelector(".status-panel"), document.querySelector(".objective-panel"), document.querySelector(".ability-panel"), document.querySelector("#equipment-status")];
        return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollY, controls: elements.map((element) => { const b = element.getBoundingClientRect(); return { name: element.id || element.dataset.touchAction || element.className, x: b.x, y: b.y, width: b.width, height: b.height }; }) };
      });
      assert.equal(layout.width, size.width, "Mobile viewport must not expand beyond the device width");
      assert.ok(layout.scrollWidth <= size.width && layout.scrollY === 0, "Touch gestures must not scroll/overflow the page");
      for (const control of layout.controls) assert.ok(control.x >= 0 && control.y >= 0 && control.x + control.width <= size.width + 1 && control.y + control.height <= size.height + 1, `Offscreen control: ${JSON.stringify(control)}`);
      for (const [index, a] of layout.controls.entries()) for (const b of layout.controls.slice(index + 1)) {
        assert.ok(!(a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1 && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1), `Overlapping controls at ${size.width}x${size.height}: ${a.name} / ${b.name}`);
      }
      layouts.push({ width: layout.width, height: layout.height });
      if (size.width === 390 || size.width === 844) await captureScreenshot(page, { path: path.join(root, "assets", "previews", `mega-chonk-mobile-${size.width === 390 ? "portrait" : "landscape"}.png`) });
    }
    stick = await center("#move-stick");
    await down(1, stick.x, stick.y - 35);
    await down(2, 380, 140);
    await move(2, 400, 150);
    await page.setViewportSize({ width: 390, height: 844 });
    await assertStopped("Rotation must release all touch input");
    await cancel();
    stick = await center("#move-stick");
    await down(1, stick.x, stick.y - 35);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await assertStopped("Switching away must clear held input");
    await cancel();
    await tap("#touch-toggle");
    assert.equal(await page.locator("#touch-controls").isVisible(), false);
    await tap("#touch-toggle");
    assert.equal(await page.locator("#touch-controls").isVisible(), true, "Manual touch toggle must work in both directions");
    for (const [satiety, chonk] of [[5, 48], [62, 95]]) {
      await page.evaluate(([satiety, chonk]) => window.__megaChonk.setCondition(satiety, chonk), [satiety, chonk]);
      const before = (await snapshot()).jumps;
      await tap('[data-touch-action="jump"]');
      await page.waitForTimeout(150);
      assert.equal((await snapshot()).jumps, before, "Touch jump bypassed hunger/weight limits");
    }
    await page.evaluate(() => { window.__megaChonk.state.level = 2; window.__megaChonk.completeLevel(); });
    await page.waitForFunction(() => window.__megaChonk.state.stage === "boss" && !window.__megaChonk.state.transitioning);
    assert.equal(await page.locator("#boss-panel").isVisible(), true, "Third room must lead to the vacuum encounter");
    await page.waitForTimeout(650);
    for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(200);
      const bounds = await page.evaluate(() => [document.querySelector(".status-panel"), document.querySelector("#boss-panel"), document.querySelector("#equipment-status"), document.querySelector(".ability-panel"), document.querySelector("#move-stick"), document.querySelector("#touch-toggle"), ...document.querySelectorAll(".touch-actions button")].map((el) => {
        const b = el.getBoundingClientRect(); return { name: el.id || el.className || el.dataset.touchAction, x: b.x, y: b.y, right: b.right, bottom: b.bottom };
      }));
      for (const b of bounds) assert.ok(b.x >= 0 && b.y >= 0 && b.right <= size.width + 1 && b.bottom <= size.height + 1, `Boss UI offscreen: ${JSON.stringify(b)}`);
      for (const [index, a] of bounds.entries()) for (const b of bounds.slice(index + 1)) assert.ok(!(a.x < b.right - 1 && a.right > b.x + 1 && a.y < b.bottom - 1 && a.bottom > b.y + 1), `Boss controls overlap at ${size.width}x${size.height}: ${a.name}/${b.name}`);
      if (size.width === 390 || size.width === 844) await captureScreenshot(page, { path: path.join(root, "assets/previews", `mega-chonk-boss-mobile-${size.width === 390 ? "portrait" : "landscape"}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      const game = window.__megaChonk;
      game.bossScenario({ phase: "inhale", lives: 1 });
      game.character.root.position.set(0, 0, 0.3);
      game.state.invulnerable = 0;
    });
    await page.waitForFunction(() => window.__megaChonk.state.bossRetry);
    assert.equal(await page.locator("#touch-controls").isVisible(), false, "Fight loss must release/hide virtual gameplay input");
    await page.locator("#boss-retry").waitFor({ state: "visible" });
    await tap("#retry-boss");
    await page.waitForFunction(() => window.__megaChonk.touchSnapshot().playing);
    assert.equal((await snapshot()).adventure.boss.lives, 9);
    await page.evaluate(() => {
      const game = window.__megaChonk;
      game.bossScenario({ phase: "recover", health: 1 });
      game.character.root.position.set(0, 0, -4.3);
      game.character.heading = 0;
      game.character.root.rotation.y = 0;
    });
    await tap('[data-touch-action="claw"]');
    await page.waitForFunction(() => window.__megaChonk.state.gameComplete);
    assert.equal(await page.locator("#touch-controls").isVisible(), false);
    await tap("#restart-game");
    await page.waitForFunction(() => window.__megaChonk.touchSnapshot().playing);
    assert.equal((await snapshot()).level, 0);
    assert.equal(await page.evaluate(() => window.__pointerLockRequests), 0, "Mobile gameplay must never request pointer lock");
    assert.equal(await page.evaluate(() => document.pointerLockElement), null);
    assert.deepEqual(errors, []);
    await context.close();
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desktop.goto(target, { waitUntil: "networkidle" });
    await desktop.waitForFunction(() => window.__megaChonk?.state.ready);
    assert.equal((await desktop.evaluate(() => window.__megaChonk.touchSnapshot())).enabled, false);
    await desktop.click("#touch-toggle");
    await desktop.click("#enter-game");
    await desktop.waitForFunction(() => window.__megaChonk.touchSnapshot().playing);
    assert.equal(await desktop.evaluate(() => document.pointerLockElement), null, "Optional virtual controls should work without pointer lock on desktop too");
    await desktop.click("#touch-toggle");
    await desktop.click("#game", { position: { x: 720, y: 450 } });
    await desktop.waitForFunction(() => document.pointerLockElement?.id === "game");
    const desktopBefore = await desktop.evaluate(() => window.__megaChonk.character.root.position.z);
    await desktop.keyboard.down("w");
    await desktop.waitForTimeout(600);
    await desktop.keyboard.up("w");
    assert.ok(await desktop.evaluate(() => window.__megaChonk.character.root.position.z) < desktopBefore - 0.5, "Switching back to desktop input must restore keyboard play");
    console.log(JSON.stringify({ target, bootLayouts, layouts, walkingSpeed: walking.speed, trottingSpeed: trotting.speed, cameraDelta: afterLook.yaw - beforeLook.yaw, simultaneousTouches: 3, pointerLockRequests: 0, desktopToggle: true, errors }, null, 2));
    console.log("Mobile touch controls passed");
  } finally {
    if (browser) await browser.close();
    server?.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
