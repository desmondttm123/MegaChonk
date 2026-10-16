const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

// Replace completed images atomically; Windows image indexers may lock old PNGs.
module.exports = async function captureScreenshot(page, { path: destination, ...options }) {
  const temporary = path.join(path.dirname(destination), `capture-${randomUUID()}.png`);
  try {
    await fs.writeFile(temporary, await page.screenshot({ ...options, type: "png" }));
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fs.rename(temporary, destination);
        break;
      } catch (error) {
        if (attempt >= 19) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  } finally {
    await fs.unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
};
