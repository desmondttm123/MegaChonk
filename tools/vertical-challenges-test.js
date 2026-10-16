const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errors = [];
const results = [];

(async () => {
  const server = spawn("python", ["-m", "http.server", "4176", "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore", windowsHide: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await sleep(500);
    await page.goto("http://127.0.0.1:4176", { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__megaChonk?.state.ready, null, { timeout: 30000 });
    await page.evaluate(() => { window.__megaChonk.regenerate(424242); window.__megaChonk.start(); });
    await page.waitForFunction(() => !window.__megaChonk.state.transitioning);
    const snapshot = () => page.evaluate(() => window.__megaChonk.snapshot());
    const place = (position) => page.evaluate((p) => {
      const { character, state } = window.__megaChonk;
      character.root.position.fromArray(p);
      character.velocity.set(0, 0, 0);
      character.verticalVelocity = 0;
      state.grounded = true;
      state.sitting = false;
      state.forcedAction = null;
      state.actionTime = 0;
      state.idleTime = 0;
    }, position);
    async function walkTo(target, timeout = 10000) {
      const start = Date.now();
      await page.keyboard.down("w");
      try {
        while (Date.now() - start < timeout) {
          const s = await snapshot();
          if (Math.hypot(s.position[0] - target[0], s.position[2] - target[2]) < 0.20 && Math.abs(s.position[1] - target[1]) < 0.18) return s;
          await page.evaluate(([x, , z]) => window.__megaChonk.aimAt(x, z), target);
          await sleep(50);
        }
        throw new Error(`Could not walk to ${target}: ${JSON.stringify(await snapshot())}`);
      } finally {
        await page.keyboard.up("w");
        await sleep(250);
      }
    }
    async function leapTo(target) {
      await page.evaluate(([x, , z]) => window.__megaChonk.aimAt(x, z), target);
      await page.keyboard.down("Shift");
      await page.keyboard.down("w");
      await sleep(100);
      await page.keyboard.press("Space");
      const started = Date.now();
      while (Date.now() - started < 2500) {
        const s = await snapshot();
        if (Math.hypot(s.position[0] - target[0], s.position[2] - target[2]) < 0.65) break;
        await sleep(25);
      }
      await page.keyboard.up("w");
      await page.keyboard.up("Shift");
      await page.waitForFunction(() => window.__megaChonk.state.grounded, null, { timeout: 3500 });
      const s = await snapshot();
      if (Math.abs(s.position[1] - target[1]) > 0.1 || Math.hypot(s.position[0] - target[0], s.position[2] - target[2]) > 1.0) throw new Error(`Missed descending shelf ${target}: ${JSON.stringify(s)}`);
      await sleep(150);
      return s.position;
    }
    for (const level of [0, 1, 2]) {
      await page.evaluate((index) => { window.__megaChonk.loadLevel(index); window.__megaChonk.setCondition(62, 48); }, level);
      const nav = await page.evaluate(() => window.__megaChonk.navigation());
      const route = nav.verticalRoutes[0];
      await place(route.stairs.entry);
      const before = await snapshot();
      const top = await walkTo(route.stairs.top);
      if (top.position[1] < 2.65 || !top.grounded || top.jumpImpulse <= 0) errors.push(`Level ${level + 1}: invalid stair ascent`);
      if (top.position[1] > 2.8) errors.push(`Level ${level + 1}: stair height invalid`);
      await page.screenshot({ path: path.join(root, "assets", "previews", `mega-chonk-upstairs-${level + 1}.png`) });
      const bottom = await walkTo(route.stairs.entry);
      const navAfter = await page.evaluate(() => window.__megaChonk.navigation());
      if (navAfter.jumps !== nav.jumps || bottom.position[1] > 0.2) errors.push(`Level ${level + 1}: invalid stair descent`);
      results.push({ level: level + 1, ascent: top.position, descent: bottom.position, mealsUpstairs: nav.foods.filter((food) => food.position[1] > 2).length, startedAt: before.position });
    }
    await page.evaluate(() => { window.__megaChonk.loadLevel(0); window.__megaChonk.setCondition(5, 95); });
    await place([-7.5, 0, 0.5]);
    const limitedStairs = await walkTo([-7.5, 2.7, -8.5], 20000);
    if (limitedStairs.jumpAllowed || limitedStairs.position[1] < 2.65) errors.push("Stairs are not usable when too hungry/heavy to jump");
    await page.evaluate(() => { window.__megaChonk.loadLevel(0); window.__megaChonk.setCondition(62, 48); });
    const route = (await page.evaluate(() => window.__megaChonk.navigation())).verticalRoutes[0];
    const normal = await snapshot();
    await place([4.5, 2.7, -9]);
    await sleep(300);
    await page.evaluate(() => window.__megaChonk.aimAt(4.5, -2.9));
    await page.keyboard.down("w");
    await sleep(220);
    const eatingInterrupted = await snapshot();
    await page.keyboard.up("w");
    if (eatingInterrupted.forcedAction === "Bite" || eatingInterrupted.position[2] < -8.90) errors.push("Movement did not interrupt automatic eating");
    await place([4.5, 2.7, -9.8]);
    await page.evaluate(() => window.__megaChonk.aimAt(4.5, -2.9));
    await page.keyboard.down("Shift");
    await page.keyboard.down("w");
    await page.waitForFunction(() => window.__megaChonk.character.root.position.z > -8.4, null, { timeout: 3000 });
    await page.keyboard.press("Space");
    await sleep(850);
    await page.keyboard.up("w");
    await page.keyboard.up("Shift");
    await page.waitForFunction(() => window.__megaChonk.state.grounded, null, { timeout: 3000 });
    const unboostedLanding = await snapshot();
    if (unboostedLanding.position[1] > 2) errors.push("The catnip shortcut did not require its boost");
    await place([4.5, 2.7, -9]);
    await page.waitForFunction(() => window.__megaChonk.state.catnipTime > 16, null, { timeout: 5000 });
    await sleep(700);
    const boosted = await snapshot();
    if (boosted.jumpImpulse < normal.jumpImpulse * 1.17 || boosted.speedBoost !== 1.32) errors.push("Catnip did not apply both boosts");
    if (boosted.foodsRemaining !== normal.foodsRemaining) errors.push("Optional catnip changed mandatory objectives");
    if (!(await page.locator("#boost-status").isVisible())) errors.push("Missing catnip countdown");
    await place([4.5, 2.7, -9.8]);
    await page.evaluate(() => window.__megaChonk.aimAt(4.5, -2.9));
    await page.keyboard.down("Shift");
    await page.keyboard.down("w");
    await page.waitForFunction(() => window.__megaChonk.character.root.position.z > -8.4, null, { timeout: 3000 });
    await page.keyboard.press("Space");
    await page.waitForFunction(() => window.__megaChonk.character.root.position.z > -3.8, null, { timeout: 3000 });
    await page.keyboard.up("w");
    await page.keyboard.up("Shift");
    await page.waitForFunction(() => window.__megaChonk.state.grounded, null, { timeout: 3000 });
    const landing = await snapshot();
    if (landing.position[1] < 2.65 || Math.abs(landing.position[0] - 4.5) > 0.5 || landing.position[2] < -4 || landing.position[2] > -1.8) errors.push(`Missed boosted perch: ${JSON.stringify(landing)}`);
    await page.screenshot({ path: path.join(root, "assets", "previews", "mega-chonk-catnip-leap.png") });
    await sleep(2000);
    const shelfLandings = [];
    for (const target of [[8.7, 1.95, 0.1], [8.7, 1.2, 2.7], [8.3, 0.55, 4.8]]) shelfLandings.push(await leapTo(target));
    await page.evaluate(() => window.__megaChonk.setCondition(60, 95));
    if ((await snapshot()).jumpAllowed) errors.push("Catnip bypassed the heavy jump restriction");
    await page.evaluate(() => { window.__megaChonk.setCondition(5, 48); });
    if ((await snapshot()).jumpAllowed) errors.push("Catnip bypassed the hunger jump restriction");
    await page.evaluate(() => { window.__megaChonk.setCondition(62, 48); window.__megaChonk.state.catnipTime = 0.05; });
    await sleep(250);
    if ((await snapshot()).speedBoost !== 1 || await page.locator("#boost-status").isVisible()) errors.push("Boost failed to expire");
    await place([2, 0, -10]);
    await page.evaluate(() => window.__megaChonk.state.catnipTime = 10);
    await page.keyboard.press("Space");
    let highest = 0;
    for (let i = 0; i < 24; i += 1) { highest = Math.max(highest, (await snapshot()).position[1]); await sleep(40); }
    if (highest > 1.4 || (await snapshot()).position[1] > 0.1) errors.push(`Jump passed through gallery underside: ${highest}`);
    console.log(JSON.stringify({ results, limitedStairs: limitedStairs.position, normal, unboostedLanding, boosted, landing, shelfLandings, undersideMaxHeight: highest, errors }, null, 2));
    if (errors.length) throw new Error(errors.join("\n"));
    console.log("Vertical challenges passed");
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
