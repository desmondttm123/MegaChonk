const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const captureScreenshot = require("./capture-screenshot");

(async () => {
  const root = path.resolve(__dirname, "..");
  const server = spawn("python", ["-m", "http.server", "4178", "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore", windowsHide: true });
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (error) => errors.push(error.message));
    await new Promise((resolve) => setTimeout(resolve, 500));
    await page.goto("http://127.0.0.1:4178", { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__megaChonk?.state.ready, null, { timeout: 30000 });
    const report = await page.evaluate(async () => {
      const { overlaps, footprint, findFloorRoute } = await import("/course-generator.js");
      const game = window.__megaChonk;
      const results = [];
      for (let sample = 0; sample < 30; sample += 1) {
        const seed = sample === 0 ? 424242 : 100003 + sample * 7919;
        for (let level = 0; level < 3; level += 1) {
          game.state.runSeed = seed;
          game.loadLevel(level);
          const nav = game.navigation();
          const { obstacles, routes, corridorWidth } = nav.generation;
          const fail = (message) => { throw new Error(`Seed ${seed}, room ${level + 1}: ${message}`); };
          if (nav.house.width < 45 || nav.house.depth < 40 || nav.catScale > 0.90) fail("House/cat scale regression");
          if (nav.foods.length !== level + 3 || !nav.foods.some((food) => food.position[1] === 2.7)) fail("Missing objectives");
          const counts = Object.fromEntries(["bridge", "vacuum", "hurdle", "clutter"].map((type) => [type, obstacles.filter((item) => item.type === type).length]));
          if (counts.bridge < 1 || counts.vacuum < 1 || counts.hurdle < 3 || counts.clutter < 18) fail(`Underfilled course ${JSON.stringify(counts)}`);
          const corridor = routes.flat().map(([x, , z]) => footprint(x, z, corridorWidth));
          for (const [index, obstacle] of obstacles.entries()) {
            if (corridor.some((area) => overlaps(obstacle.area, area))) fail("Generated obstacle blocks a reserved route");
            if (obstacles.slice(index + 1).some((other) => overlaps(obstacle.area, other.area))) fail("Obstacles overlap");
          }
          // Re-plan against actual generated collision and full swept hazard envelopes.
          const boxes = [...nav.colliders, ...nav.hazards.map((hazard) => hazard.type === "spill"
            ? { ...hazard, minY: 0, maxY: 2 }
            : { ...footprint(hazard.x, hazard.z, (hazard.length + 0.65) * 2), minY: 0, maxY: 2 })];
          const targets = [...nav.foods.filter((food) => food.position[1] < 2).map((food) => food.position), nav.verticalRoutes[0].stairs.entry, nav.goal.position];
          for (const target of targets) if (!findFloorRoute(nav.position, target, nav.bounds, boxes, nav.bodyHeight)) fail(`No safe route to ${target}`);
          const signature = JSON.stringify(obstacles);
          game.regenerate(seed);
          if (JSON.stringify(game.navigation().generation.obstacles) !== signature) fail("Seed is not deterministic");
          results.push({ seed, level: level + 1, counts, routes: routes.length, signature: game.snapshot().layoutSignature });
        }
      }
      return results;
    });
    await page.evaluate(() => { window.__megaChonk.regenerate(424242); window.__megaChonk.loadLevel(0); window.__megaChonk.start(); });
    await page.waitForFunction(() => !window.__megaChonk.state.transitioning);
    await page.evaluate(() => {
      const game = window.__megaChonk;
      const platform = game.navigation().colliders.find((box) => box.name === "MovingFootstool");
      game.character.root.position.set((platform.minX + platform.maxX) / 2, platform.maxY, (platform.minZ + platform.maxZ) / 2);
      game.character.velocity.set(0, 0, 0);
      game.character.verticalVelocity = 0;
      game.state.grounded = true;
    });
    const ride = [];
    for (let sample = 0; sample < 30; sample += 1) {
      await page.waitForTimeout(50);
      ride.push(await page.evaluate(() => {
        const nav = window.__megaChonk.navigation();
        const platform = nav.colliders.find((box) => box.name === "MovingFootstool");
        return { x: nav.position[0], offset: Math.abs(nav.position[0] - (platform.minX + platform.maxX) / 2), grounded: nav.grounded, y: nav.position[1], top: platform.maxY };
      }));
    }
    if (Math.max(...ride.map((sample) => sample.x)) - Math.min(...ride.map((sample) => sample.x)) < 0.2
      || ride.some((sample) => sample.offset > 0.1 || !sample.grounded || Math.abs(sample.y - sample.top) > 0.02)) throw new Error("Generated moving platform failed to carry the cat");
    await page.evaluate(() => { window.__megaChonk.state.started = false; });
    for (const level of [0, 1, 2]) {
      await page.evaluate((level) => { window.__megaChonk.regenerate(424242); window.__megaChonk.loadLevel(level); }, level);
      await page.waitForTimeout(150);
      await captureScreenshot(page, { path: path.join(root, "assets", "previews", `mega-chonk-generated-room-${level + 1}.png`) });
    }
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(JSON.stringify({ layoutsChecked: report.length, movingPlatformRide: true, firstThree: report.slice(0, 3), last: report.at(-1), errors }, null, 2));
    console.log("Seeded house generation passed");
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
