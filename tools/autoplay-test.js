const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const captureScreenshot = require("./capture-screenshot");

const PORT = 4174;
const requestedSeed = Number(process.argv[2] ?? 424242);
const RUN_SEED = Number.isFinite(requestedSeed) ? Math.abs(Math.trunc(requestedSeed)) : 424242;
const GRID = 0.55;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function distance2D(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function routeLength(start, route) {
  let total = 0;
  let previous = start;
  for (const waypoint of route) {
    total += distance2D(previous, waypoint);
    previous = waypoint;
  }
  return total;
}

function makeBlockedTest(navigation, target) {
  const BOUNDS = navigation.bounds;
  const navigationHeight = target[1] > 2 && navigation.position[1] > 2 ? 2.7 : 0;
  const startingPlatform = navigation.grounded && navigation.position[1] > 0.2
    ? navigation.colliders.find((collider) => (
      navigation.position[0] >= collider.minX && navigation.position[0] <= collider.maxX
      && navigation.position[2] >= collider.minZ && navigation.position[2] <= collider.maxZ
      && Math.abs(collider.maxY - navigation.position[1]) < 0.12
    )) : null;
  const targetPlatform = navigation.colliders.find((collider) => (
    target[1] > 0.2
    && target[0] >= collider.minX
    && target[0] <= collider.maxX
    && target[2] >= collider.minZ
    && target[2] <= collider.maxZ
    && Math.abs(collider.maxY - target[1]) < 0.16
  ));

  return (x, z) => {
    if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return true;

    for (const collider of navigation.colliders) {
      if (collider === targetPlatform || collider === startingPlatform) continue;
      // Plan on the destination floor, not the cat's transient jump height.
      if (navigationHeight >= collider.maxY - 0.06 || navigationHeight + navigation.bodyHeight <= collider.minY + 0.03) continue;
      const clearance = navigation.radius + 0.18;
      if (
        x > collider.minX - clearance
        && x < collider.maxX + clearance
        && z > collider.minZ - clearance
        && z < collider.maxZ + clearance
      ) return true;
    }

    for (const hazard of navigation.hazards) {
      if (hazard.type === "spill") {
        const clearance = 0.62;
        if (
          x > hazard.minX - clearance
          && x < hazard.maxX + clearance
          && z > hazard.minZ - clearance
          && z < hazard.maxZ + clearance
        ) return true;
      } else if (Math.hypot(x - hazard.x, z - hazard.z) < hazard.length + 0.72) {
        return true;
      }
    }
    return false;
  };
}

function planRoute(navigation, target) {
  const BOUNDS = navigation.bounds;
  const columns = Math.floor((BOUNDS.maxX - BOUNDS.minX) / GRID) + 1;
  const rows = Math.floor((BOUNDS.maxZ - BOUNDS.minZ) / GRID) + 1;
  const toCell = ([x, , z]) => [
    Math.max(0, Math.min(columns - 1, Math.round((x - BOUNDS.minX) / GRID))),
    Math.max(0, Math.min(rows - 1, Math.round((z - BOUNDS.minZ) / GRID))),
  ];
  const toWorld = (column, row) => [BOUNDS.minX + column * GRID, 0, BOUNDS.minZ + row * GRID];
  const toIndex = (column, row) => row * columns + column;
  const [startColumn, startRow] = toCell(navigation.position);
  const [goalColumn, goalRow] = toCell(target);
  const startIndex = toIndex(startColumn, startRow);
  const goalIndex = toIndex(goalColumn, goalRow);
  const blockedAt = makeBlockedTest(navigation, target);
  const isBlocked = (column, row) => {
    if ((column === startColumn && row === startRow) || (column === goalColumn && row === goalRow)) return false;
    const [x, , z] = toWorld(column, row);
    return blockedAt(x, z);
  };

  const nodeCount = columns * rows;
  const scores = new Float64Array(nodeCount);
  scores.fill(Infinity);
  scores[startIndex] = 0;
  const origins = new Int32Array(nodeCount);
  origins.fill(-1);
  const closed = new Uint8Array(nodeCount);
  const open = [{ index: startIndex, column: startColumn, row: startRow, score: 0 }];
  const directions = [
    [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
    [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2],
  ];
  let found = false;

  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (open[i].score < open[best].score) best = i;
    }
    const current = open.splice(best, 1)[0];
    if (closed[current.index]) continue;
    closed[current.index] = 1;
    if (current.index === goalIndex) {
      found = true;
      break;
    }

    for (const [dx, dz, cost] of directions) {
      const column = current.column + dx;
      const row = current.row + dz;
      if (column < 0 || column >= columns || row < 0 || row >= rows || isBlocked(column, row)) continue;
      if (dx && dz && (isBlocked(current.column + dx, current.row) || isBlocked(current.column, current.row + dz))) continue;
      const index = toIndex(column, row);
      if (closed[index]) continue;
      const nextScore = scores[current.index] + cost;
      if (nextScore >= scores[index]) continue;
      scores[index] = nextScore;
      origins[index] = current.index;
      const heuristic = Math.hypot(goalColumn - column, goalRow - row);
      open.push({ index, column, row, score: nextScore + heuristic });
    }
  }

  if (!found) return [target];
  const cells = [];
  let cursor = goalIndex;
  while (cursor !== startIndex && cursor >= 0) {
    const row = Math.floor(cursor / columns);
    const column = cursor - row * columns;
    cells.push(toWorld(column, row));
    cursor = origins[cursor];
  }
  cells.reverse();

  const raw = [navigation.position, ...cells];
  const simplified = [];
  let anchor = 0;
  const lineIsClear = (a, b) => {
    const distance = distance2D(a, b);
    const samples = Math.max(1, Math.ceil(distance / 0.18));
    for (let i = 1; i < samples; i += 1) {
      const amount = i / samples;
      if (blockedAt(a[0] + (b[0] - a[0]) * amount, a[2] + (b[2] - a[2]) * amount)) return false;
    }
    return true;
  };
  while (anchor < raw.length - 1) {
    let next = raw.length - 1;
    while (next > anchor + 1 && !lineIsClear(raw[anchor], raw[next])) next -= 1;
    simplified.push(raw[next]);
    anchor = next;
  }
  if (!simplified.length || distance2D(simplified[simplified.length - 1], target) > 0.15) simplified.push(target);
  else simplified[simplified.length - 1] = target;
  return simplified;
}

(async () => {
  const root = path.resolve(__dirname, "..");
  const server = spawn("python", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
    cwd: root,
    stdio: "ignore",
    windowsHide: true,
  });
  const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  let browser;
  let page;
  const browserErrors = [];
  const levelRuns = [];

  async function navigation() {
    return page.evaluate(() => window.__megaChonk.navigation());
  }

  async function releaseMovement() {
    if (!page) return;
    await page.keyboard.up("w").catch(() => {});
    await page.keyboard.up("Shift").catch(() => {});
  }

  async function driveTo(target, options = {}) {
    let initial = await navigation();
    const stairs = initial.verticalRoutes[0]?.stairs;
    if (!options.routeStage && stairs) {
      const ascending = target[1] > 2 && initial.position[1] < 2;
      const descending = target[1] < 1 && initial.position[1] > 2;
      if (ascending || descending) {
        const stages = ascending ? [stairs.entry, stairs.top] : [stairs.top, stairs.entry];
        for (const [index, waypoint] of stages.entries()) {
          const result = await driveTo(waypoint, {
            level: options.level, routeStage: true,
            direct: descending || index === 1, stairs: true, timeout: 25000, tolerance: 0.38,
          });
          if (!result.reached) return result;
        }
      }
    }
    const startedAt = Date.now();
    const expectedLevel = options.level;
    const targetIndex = options.foodIndex;
    let nav = await navigation();
    let route = options.direct ? [target] : planRoute(nav, target);
    let waypointIndex = 0;
    let lastPlan = Date.now();
    let lastJump = 0;
    let lastMotionAt = Date.now();
    let lastMotionPosition = nav.position;
    let lastBonks = nav.bonks;
    let shiftHeld = false;
    await page.keyboard.down("w");

    while (Date.now() - startedAt < (options.timeout ?? 30000)) {
      nav = await navigation();
      if (nav.gameComplete || nav.level !== expectedLevel || nav.transitioning) {
        await releaseMovement();
        return { reached: true, navigation: nav, route };
      }
      if (targetIndex !== undefined && !nav.foods.some((food) => food.index === targetIndex)) {
        await releaseMovement();
        return { reached: true, navigation: nav, route };
      }

      const targetDistance = distance2D(nav.position, target);
      const correctHeight = Math.abs(nav.position[1] - target[1]) < 0.34;
      if (targetDistance < (options.tolerance ?? 0.62) && correctHeight && nav.grounded) {
        await releaseMovement();
        return { reached: true, navigation: nav, route };
      }

      if (nav.bonks !== lastBonks || Date.now() - lastPlan > 4200) {
        route = options.direct ? [target] : planRoute(nav, target);
        waypointIndex = 0;
        lastPlan = Date.now();
        lastBonks = nav.bonks;
      }
      while (waypointIndex < route.length - 1 && distance2D(nav.position, route[waypointIndex]) < 0.48) waypointIndex += 1;
      const waypoint = route[Math.min(waypointIndex, route.length - 1)] ?? target;
      await page.evaluate(([x, z]) => window.__megaChonk.aimAt(x, z), [waypoint[0], waypoint[2]]);

      const shouldTrot = targetDistance > 2.4;
      if (shouldTrot !== shiftHeld) {
        shiftHeld = shouldTrot;
        if (shiftHeld) await page.keyboard.down("Shift");
        else await page.keyboard.up("Shift");
      }

      if (distance2D(nav.position, lastMotionPosition) > 0.16) {
        lastMotionPosition = nav.position;
        lastMotionAt = Date.now();
      }
      const stalled = Date.now() - lastMotionAt > 550;
      const platformApproach = target[1] > 0.2 && target[1] < 2 && targetDistance < 3.1;
      if (!options.stairs && nav.grounded && Date.now() - lastJump > 580 && (stalled || platformApproach)) {
        await page.keyboard.press("Space");
        lastJump = Date.now();
        if (stalled) lastMotionAt = Date.now();
      }
      await sleep(85);
    }

    await releaseMovement();
    return { reached: false, navigation: nav, route };
  }

  try {
    await sleep(800);
    browser = await chromium.launch({ headless: true, executablePath: edge });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (error) => browserErrors.push(`pageerror:${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console:${message.text()}`);
    });
    await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__megaChonk?.state?.ready === true, null, { timeout: 30000 });
    await page.evaluate((seed) => window.__megaChonk.regenerate(seed), RUN_SEED);
    await page.click("#enter-game");
    await page.waitForFunction(() => window.__megaChonk.state.transitioning === false, null, { timeout: 5000 });

    const overallStart = Date.now();
    while (Date.now() - overallStart < 480000) {
      let nav = await navigation();
      if (nav.gameComplete) break;
      if (nav.transitioning) {
        await releaseMovement();
        await page.waitForFunction(() => !window.__megaChonk.state.transitioning || window.__megaChonk.state.gameComplete, null, { timeout: 6000 });
        continue;
      }

      const level = nav.level;
      const levelRun = { level: level + 1, meals: [], startBonks: nav.bonks, startJumps: nav.jumps };
      levelRuns.push(levelRun);
      console.log(`[autoplay] Level ${level + 1} started with ${nav.foods.length} meals`);

      while (nav.level === level && nav.foods.length && !nav.gameComplete) {
        const candidates = nav.foods.map((food) => {
          const route = planRoute(nav, food.position);
          return { food, route, distance: routeLength(nav.position, route) + (food.position[1] > 2 && nav.position[1] < 2 ? 20 : 0) };
        }).sort((a, b) => a.distance - b.distance);
        const selected = candidates[0];
        console.log(`[autoplay] Routing to ${selected.food.label} (${selected.distance.toFixed(1)}m planned)`);
        let consumed = false;
        for (let attempt = 1; attempt <= 3 && !consumed; attempt += 1) {
          const result = await driveTo(selected.food.position, {
            level,
            foodIndex: selected.food.index,
            timeout: 28000,
          });
          if (!result.reached) {
            throw new Error(`Could not reach ${selected.food.label} on level ${level + 1}: ${JSON.stringify(result.navigation)}`);
          }
          await releaseMovement();
          try {
            await page.waitForFunction(
              (foodIndex) => !window.__megaChonk.navigation().foods.some((food) => food.index === foodIndex),
              selected.food.index,
              { timeout: 3400 },
            );
            consumed = true;
          } catch {
            if (attempt === 3) {
              const failed = await navigation();
              throw new Error(`Reached but could not eat ${selected.food.label}: ${JSON.stringify(failed)}`);
            }
            await page.keyboard.press("Space");
            await sleep(550);
          }
        }
        levelRun.meals.push(selected.food.label);
        nav = await navigation();
        console.log(`[autoplay] Ate ${selected.food.label}; ${nav.foods.length} remain`);
      }

      nav = await navigation();
      if (nav.gameComplete || nav.level !== level) continue;
      if (!nav.goal?.active) throw new Error(`Goal did not unlock on level ${level + 1}`);
      console.log(`[autoplay] All meals found; routing to level ${level + 1} gate`);
      const gateResult = await driveTo(nav.goal.position, { level, timeout: 32000, tolerance: 0.78 });
      if (!gateResult.reached) throw new Error(`Could not reach the gate on level ${level + 1}: ${JSON.stringify(gateResult.navigation)}`);
      await releaseMovement();
      await page.waitForFunction(
        (previousLevel) => window.__megaChonk.state.gameComplete || window.__megaChonk.state.level !== previousLevel,
        level,
        { timeout: 7000 },
      );
      const afterLevel = await navigation();
      levelRun.bonks = afterLevel.bonks - levelRun.startBonks;
      levelRun.jumps = afterLevel.jumps - levelRun.startJumps;
      console.log(`[autoplay] Level ${level + 1} cleared with ${levelRun.jumps} jumps and ${levelRun.bonks} bonks`);
    }

    await page.waitForFunction(() => window.__megaChonk.state.gameComplete === true, null, { timeout: 8000 });
    await page.waitForFunction(() => !document.querySelector("#completion-screen").classList.contains("is-hidden"), null, { timeout: 2000 });
    await sleep(250);
    const finalSnapshot = await page.evaluate(() => window.__megaChonk.snapshot());
    const finalNavigation = await navigation();
    const completionText = await page.locator("#completion-stats").textContent();
    await captureScreenshot(page, {
      path: path.join(root, "assets", "previews", RUN_SEED === 424242 ? "mega-chonk-complete.png" : `mega-chonk-complete-${RUN_SEED}.png`),
    });

    if (finalSnapshot.eaten !== 12) browserErrors.push(`progression:expected 12 meals, got ${finalSnapshot.eaten}`);
    if (finalSnapshot.level !== 2) browserErrors.push(`progression:expected final level index 2, got ${finalSnapshot.level}`);
    if (finalSnapshot.xp < 600) browserErrors.push(`progression:expected at least 600 XP, got ${finalSnapshot.xp}`);
    if (finalSnapshot.jumps < 3) browserErrors.push(`movement:expected platform jumps, got ${finalSnapshot.jumps}`);
    if (levelRuns.length !== 3) browserErrors.push(`progression:expected 3 level runs, got ${levelRuns.length}`);
    if (!completionText?.includes("12 meals")) browserErrors.push(`completion:stats were not rendered correctly: ${completionText}`);
    console.log(JSON.stringify({ seed: RUN_SEED, levelRuns, finalSnapshot, completed: finalNavigation.gameComplete, completionText }, null, 2));
  } catch (error) {
    if (page) {
      await releaseMovement();
      await captureScreenshot(page, {
        path: path.join(root, "assets", "previews", `mega-chonk-autoplay-failure-${RUN_SEED}.png`),
      }).catch(() => {});
    }
    browserErrors.push(`autoplay:${error.stack || error.message}`);
  } finally {
    await releaseMovement();
    if (browser) await browser.close();
    server.kill();
  }

  if (browserErrors.length) {
    console.error(browserErrors.join("\n"));
    process.exit(1);
  }
  console.log("autoplay ok");
})();
