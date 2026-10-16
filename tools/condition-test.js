const assert = require("assert/strict");
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const captureScreenshot = require("./capture-screenshot");
const root = path.resolve(__dirname, "..");

(async () => {
  const live = process.argv[2];
  const server = live ? null : spawn("python", ["-m", "http.server", "4182", "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore", windowsHide: true });
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.waitForTimeout(500);
    await page.goto(live || "http://127.0.0.1:4182", { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__megaChonk?.state.ready);
    await page.evaluate(() => { localStorage.removeItem("megachonk.snack-points.v1"); window.__megaChonk.regenerate(424242); window.__megaChonk.start(); });
    await page.waitForFunction(() => !window.__megaChonk.state.transitioning);
    const snap = () => page.evaluate(() => window.__megaChonk.snapshot());
    const place = (p, satiety = 58, chonk = 48) => page.evaluate(({ p, satiety, chonk }) => {
      const g = window.__megaChonk, { character: c, state: s } = g;
      c.root.position.fromArray(p); c.velocity.set(0, 0, 0); c.verticalVelocity = 0;
      s.grounded = true; s.forcedAction = null; s.actionTime = 0; s.sitting = false; s.jumpBuffer = 0;
      g.setCondition(satiety, chonk);
    }, { p, satiety, chonk });
    const walk = async (x, z, ms) => {
      await page.evaluate(([x, z]) => window.__megaChonk.aimAt(x, z), [x, z]);
      await page.keyboard.down("w"); await page.waitForTimeout(ms); await page.keyboard.up("w");
      await page.waitForTimeout(220);
      return snap();
    };
    const nav = await page.evaluate(() => window.__megaChonk.navigation());
    const snack = nav.snacks.find((food) => food.label === "CREAM BITES");
    await place(snack.position);
    await page.waitForFunction(() => window.__megaChonk.snapshot().eatingTime > 0.1);
    const samples = [];
    for (let i = 0; i < 10; i++) {
      samples.push(await page.evaluate(() => {
        const g = window.__megaChonk;
        return { ...g.snapshot(), head: g.character.model.getObjectByName("Head").quaternion.toArray() };
      }));
      await page.waitForTimeout(65);
    }
    assert.ok(samples.every((s) => s.activeAnimation === "EatLoop" && !s.forcedAction), "Eating must stay in a repeating animation, not a clamped combat bite");
    assert.ok(new Set(samples.map((s) => s.head.map((v) => v.toFixed(4)).join())).size > 7, "Head/jaw motion must keep interpolating during eating");
    const partial = await snap();
    assert.ok(partial.chonk > 48.5 && partial.chonk < 57, "Fat must arrive with partial bites, not only on completion");
    await page.evaluate(([x, , z]) => window.__megaChonk.aimAt(x - 2, z), snack.position);
    await page.keyboard.down("w"); await page.waitForTimeout(200);
    assert.notEqual((await snap()).activeAnimation, "EatLoop", "Movement must immediately interrupt eating");
    await page.keyboard.up("w");
    await page.evaluate((p) => {
      const c = window.__megaChonk.character;
      c.root.position.fromArray(p); c.velocity.set(0, 0, 0);
    }, snack.position);
    await page.waitForFunction(() => window.__megaChonk.snapshot().snacks === 1);
    const fed = await snap();
    assert.equal(fed.eaten, 0); assert.equal(fed.foodsRemaining, 3);
    assert.equal(fed.snackPoints, 25);
    assert.ok(fed.chonk > 56.7 && fed.chonk <= 57.01, "Resuming a partially eaten snack must not duplicate fat");
    await page.waitForTimeout(500); assert.equal((await snap()).snackPoints, 25);
    const secondSnack = nav.snacks.find((food) => food.label === "SALMON PUFFS");
    await page.evaluate((p) => { const c = window.__megaChonk.character; c.root.position.fromArray(p); c.velocity.set(0, 0, 0); }, secondSnack.position);
    await page.waitForFunction(() => window.__megaChonk.snapshot().snacks === 2);
    assert.ok((await snap()).chonk >= 65.5, "Two rich snacks must build enough mass for the plate from starting weight");
    await walk(11, 10.3, 700);
    await page.waitForTimeout(850);
    assert.equal((await snap()).bodyTrials.nooks[1].latched, true, "Naturally gained snack weight must activate the plate");
    console.log("Smooth eating, interruption, partial nutrition, optional points and objective separation passed");

    await place([-11, 0, 10.4], 58, 80);
    const blocked = await walk(-11, 6.6, 1600);
    assert.ok(blocked.position[2] > 8.9, "Fat cat must not pass the slim filter");
    assert.equal(blocked.bodyTrials.nooks[0].open, false);
    await place([-11, 0, 10.4], 58, 59.8);
    const entered = await walk(-11, 6.6, 1100);
    assert.ok(entered.position[2] < 8.4, "Lean cat should fit through the opening");
    await page.waitForFunction(() => window.__megaChonk.snapshot().snacks === 3);
    assert.ok((await snap()).chonk > 60, "Stash should fatten its occupant across the entry threshold");
    const escaped = await walk(-11, 10.7, 1550);
    assert.ok(escaped.position[2] > 9.4, "Reward must never trap a now-fat cat inside");
    await page.evaluate(() => window.__megaChonk.loadLevel(0));
    await place([11, 0, 10.3], 58, 48);
    await page.waitForTimeout(850);
    assert.equal((await snap()).bodyTrials.nooks[1].latched, false, "Light cats cannot press the weight plate");
    await place([11, 0, 10.3], 58, 65);
    await page.waitForTimeout(850);
    assert.equal((await snap()).bodyTrials.nooks[1].latched, true);
    await place([11, 0, 10.3], 58, 48);
    assert.equal((await snap()).bodyTrials.nooks[1].latched, true, "The weight gate must remain safely latched after trimming");
    console.log("Physical slim passage, fat-blocked entry, safe exit and heavy pressure plate passed");

    await place([4.3, 0, 15.3], 58, 72);
    await page.evaluate(() => { const g = window.__megaChonk; g.aimAt(4.3, 14.3); g.character.heading = Math.PI; });
    await page.keyboard.press("f"); await page.waitForTimeout(400);
    assert.ok((await snap()).chonk < 68.1, "Clawing the scratch post must trim four chonk");
    const lean = (await page.evaluate(() => window.__megaChonk.navigation())).snacks.find((food) => food.nutrition === "lean");
    await place(lean.position, 20, 68);
    await page.waitForFunction(() => window.__megaChonk.snapshot().satiety > 33);
    assert.equal((await snap()).chonk, 68);
    await page.waitForTimeout(500);
    const leanAfter = await page.evaluate(() => window.__megaChonk.navigation().snacks.find((food) => food.nutrition === "lean"));
    assert.ok(!leanAfter.active && leanAfter.cooldown > 25);

    async function jump(chonk) {
      await place([-4, 0, 16.8], 58, chonk);
      await page.evaluate(() => window.__megaChonk.aimAt(8, 16.8));
      await page.keyboard.down("Shift"); await page.keyboard.down("w"); await page.waitForTimeout(450);
      await page.keyboard.press("Space");
      await page.waitForFunction(() => !window.__megaChonk.state.grounded);
      const start = await snap();
      await page.waitForFunction(() => window.__megaChonk.state.grounded);
      const end = await snap();
      await page.keyboard.up("w"); await page.keyboard.up("Shift");
      return { distance: end.position[0] - start.position[0], impulse: start.jumpImpulse };
    }
    const normalJump = await jump(48), heavyJump = await jump(84);
    assert.ok(normalJump.distance > 4.5, `Healthy sprint jump should be longer: ${JSON.stringify(normalJump)}`);
    assert.ok(normalJump.distance > heavyJump.distance * 1.6, "Weight must measurably reduce actual jump range");
    for (const [weight, name] of [[35, "lean"], [95, "heavy"]]) {
      await place([0, 0, 15.2], 58, weight);
      await page.evaluate(() => { window.__megaChonk.character.heading = 2.35; window.__megaChonk.character.root.rotation.y = 2.35; });
      await page.waitForTimeout(1000);
      assert.equal((await snap()).bodyMorph.meshes, 1);
      assert.ok(name === "lean" ? (await snap()).bodyMorph.influence < 0.02 : (await snap()).bodyMorph.influence > 0.88);
      await captureScreenshot(page, { path: path.join(root, `assets/previews/mega-chonk-condition-${name}.png`) });
    }

    const charm = (await snap()).adventure.items.find((item) => item.kind === "charm");
    await place([charm.x, 0, charm.z]); await page.waitForTimeout(150);
    assert.ok((await snap()).adventure.charm);
    await place([0, 0, 16.8], 0, 48);
    await page.evaluate(() => { const s = window.__megaChonk.state; s.recoveryTime = 0; s.invulnerable = 0; });
    await page.waitForFunction(() => window.__megaChonk.snapshot().roomLives === 8, null, { timeout: 12000 });
    const recovered = await snap();
    assert.ok(recovered.satiety > 54); assert.equal(recovered.adventure.charm, null);
    await page.waitForTimeout(1000); assert.equal((await snap()).roomLives, 8, "Recovery must prevent a repeated starvation death loop");
    await page.evaluate(() => { const s = window.__megaChonk.state; s.roomLives = 1; s.satiety = 0; s.recoveryTime = 0; s.invulnerable = 0; });
    await page.waitForFunction(() => window.__megaChonk.state.transitioning, null, { timeout: 12000 });
    await page.locator("#retry-room").click();
    assert.equal((await snap()).roomLives, 9);
    await page.waitForFunction(() => window.__megaChonk.navigation().snacks.find((food) => food.nutrition === "lean").active, null, { timeout: 40000 });
    const points = (await snap()).snackPoints;
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__megaChonk?.state.ready);
    assert.equal((await snap()).snackPoints, points, "Snack points must survive browser reloads");
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ normalJump, heavyJump, pointsSaved: points, starvation: "life spent, charm lost, safe recovery, nine-life retry", errors }, null, 2));
    console.log("Condition integration passed");
  } finally {
    await browser?.close(); server?.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
