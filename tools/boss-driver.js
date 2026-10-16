const assert = require("assert/strict");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Navigate and attack using keyboard input. Only aimAt changes camera direction;
// this driver never teleports the cat or changes boss health/phases/equipment.
module.exports = async function defeatVacuum(page, timeout = 120000) {
  const start = Date.now();
  let attacks = 0;
  await page.keyboard.down("Shift");
  try {
    while (Date.now() - start < timeout) {
      const s = await page.evaluate(() => ({ ...window.__megaChonk.snapshot(), transitioning: window.__megaChonk.state.transitioning, cooldown: window.__megaChonk.state.attackCooldown }));
      const boss = s.adventure.boss;
      if (s.adventure.bossDefeated) return { attacks, lives: boss.lives, health: boss.health, seconds: Math.round((Date.now() - start) / 1000) };
      assert.ok(boss && boss.status !== "retry", `Boss run exhausted nine lives: ${JSON.stringify(s)}`);
      if (s.transitioning || s.forcedAction) { await page.keyboard.up("w"); await wait(60); continue; }
      const dx = s.position[0] - boss.x, dz = s.position[2] - boss.z;
      const radius = Math.hypot(dx, dz), angle = Math.atan2(dx, dz);
      const error = wrap(boss.yaw + Math.PI - angle);
      if (Math.abs(error) < 0.65 && radius < 2.7 && s.cooldown === 0) {
        await page.evaluate(([x, z]) => window.__megaChonk.aimAt(x, z), [boss.x, boss.z]);
        await page.keyboard.down("w");
        await wait(110);
        await page.keyboard.up("w");
        await wait(90);
        await page.keyboard.press("f");
        attacks++;
        await wait(240);
      } else {
        const nextAngle = angle + Math.max(-0.65, Math.min(0.65, error));
        const nextRadius = Math.abs(error) > 0.8 ? Math.max(2.4, Math.min(radius, 5.2)) : 2.25;
        const target = [boss.x + Math.sin(nextAngle) * nextRadius, boss.z + Math.cos(nextAngle) * nextRadius];
        await page.evaluate(([x, z]) => window.__megaChonk.aimAt(x, z), target);
        await page.keyboard.down("w");
        await wait(70);
      }
    }
    throw new Error(`Boss keyboard autoplay timed out: ${JSON.stringify(await page.evaluate(() => window.__megaChonk.snapshot()))}`);
  } finally {
    await page.keyboard.up("w");
    await page.keyboard.up("Shift");
  }
};
