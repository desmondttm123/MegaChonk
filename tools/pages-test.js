const { chromium } = require("playwright");
const { createServer } = require("http");
const fs = require("fs");
const path = require("path");
const captureScreenshot = require("./capture-screenshot");
const { createHash } = require("crypto");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const target = process.argv[2] || "http://127.0.0.1:4177/MegaChonk/";
const remote = Boolean(process.argv[2]);
const hash = (data) => createHash("sha256").update(data).digest("hex");

(async () => {
  let server;
  let browser;
  const errors = [];
  try {
    if (!remote) {
      const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary", ".md": "text/plain" };
      server = createServer((request, response) => {
        const pathname = decodeURIComponent(new URL(request.url, target).pathname);
        if (!pathname.startsWith("/MegaChonk/")) { response.writeHead(404).end(); return; }
        const file = path.resolve(dist, pathname.slice("/MegaChonk/".length) || "index.html");
        if (!file.startsWith(dist + path.sep)) { response.writeHead(403).end(); return; }
        fs.readFile(file, (error, data) => {
          if (error) { response.writeHead(404).end(); return; }
          response.writeHead(200, { "Content-Type": types[path.extname(file)] || "text/plain", "Cache-Control": "no-store" }).end(data);
        });
      });
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(4177, "127.0.0.1", resolve); });
      const files = JSON.parse(fs.readFileSync(path.join(dist, "build-manifest.json"))).files;
      if (Object.keys(files).some((file) => /\.(blend|fbx|stl|obj)$|assets\/sprites\//i.test(file))) throw new Error("Deployment contains development-only assets");
    }
    browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let modelBytes;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on("response", (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
      // Chromium can evict a large response body before CDP reads it. Handle
      // that rejection immediately; verify the served asset explicitly below.
      if (response.url().endsWith("/turkish-van-game-cat.glb")) modelBytes = response.body().catch(() => null);
    });
    await page.goto(target, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForFunction(() => window.__megaChonk?.state.ready, null, { timeout: 60000 });
    const manifestResponse = await page.request.get(new URL("build-manifest.json", target).href);
    if (!manifestResponse.ok()) throw new Error("Build manifest is not accessible");
    const manifest = await manifestResponse.json();
    const modelPath = "assets/models/turkish-van-game-cat.glb";
    let servedModel = await modelBytes;
    if (!servedModel) {
      const response = await page.request.get(new URL(modelPath, target).href);
      if (!response.ok()) throw new Error("Hosted model is not accessible");
      servedModel = await response.body();
    }
    const actualHash = hash(servedModel);
    if (actualHash !== manifest.files[modelPath].sha256 || actualHash !== hash(fs.readFileSync(path.join(root, modelPath)))) throw new Error("Hosted cat does not match the current local model");
    const credits = await page.request.get(new URL("credits.html", target).href);
    if (!credits.ok() || !(await credits.text()).includes("Jonas Dichelle")) throw new Error("Missing public attribution");
    const levels = [];
    for (const level of [0, 1, 2]) {
      const result = await page.evaluate((index) => { window.__megaChonk.loadLevel(index); return window.__megaChonk.snapshot(); }, level);
      if (result.foodsRemaining !== [3, 4, 5][level] || result.upstairsHeight !== 2.7) throw new Error(`Broken hosted level ${level + 1}`);
      if (result.catScale !== 0.84 || result.house.width !== 46 || result.house.depth !== 42 || result.generatedObstacles < 25) throw new Error(`Stale house generation on hosted level ${level + 1}`);
      levels.push({ level: level + 1, meals: result.foodsRemaining, upstairs: result.upstairsHeight });
    }
    await page.evaluate(() => { window.__megaChonk.loadLevel(0); window.__megaChonk.state.yaw = 0; });
    await page.click("#enter-game");
    await page.waitForFunction(() => !window.__megaChonk.state.transitioning);
    const before = await page.evaluate(() => window.__megaChonk.snapshot());
    await page.keyboard.down("w");
    await page.waitForTimeout(600);
    await page.keyboard.up("w");
    await page.waitForTimeout(300);
    const moved = await page.evaluate(() => window.__megaChonk.snapshot());
    if (moved.position[2] >= before.position[2] - 0.5) throw new Error("Hosted WASD movement did not work");
    await page.keyboard.press("Space");
    await page.waitForTimeout(170);
    const airborne = await page.evaluate(() => window.__megaChonk.snapshot());
    if (airborne.grounded || airborne.position[1] < 0.1) throw new Error("Hosted jumping did not work");
    await page.waitForFunction(() => window.__megaChonk.state.grounded);
    await captureScreenshot(page, { path: path.join(root, "assets", "previews", remote ? "mega-chonk-hosted.png" : "mega-chonk-pages.png") });
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(JSON.stringify({ url: target, revision: manifest.revision, files: Object.keys(manifest.files).length, modelSha256: actualHash, triangles: moved.triangles, levels, movement: true, jumping: true, errors }, null, 2));
    console.log("Pages deployment test passed");
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
