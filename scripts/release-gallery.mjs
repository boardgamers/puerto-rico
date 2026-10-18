import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import * as E from "../engine/index.js";
import { RELEASE } from "../release-config.js";
const server = createServer(async (req, res) => {
  res.setHeader(
    "Content-Type",
    req.url === "/viewer.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/viewer.js"
      ? await readFile("dist/viewer.js")
      : '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="game"></div><script src="/viewer.js"></script>',
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch();
const errors = [],
  checks = [];
await mkdir(".local/release/gallery", { recursive: true });
let state = E.init(3, RELEASE.expansions, RELEASE.options, "release-gallery");
for (let n = 0; n < 1000 && !state.finished; n++) {
  if (state.round >= 6 && state.tasks[0]?.kind === "build") break;
  state = E.moveAI(state);
}
assert(!state.finished);
const seat = state.tasks[0].p;
try {
  for (const [width, height] of [
    [1440, 1000],
    [390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      hasTouch: width < 700,
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(
      ({ state, seat }) => {
        window.host = puertorico.launch("#game");
        host.emit("player", { index: seat });
        host.emit("preferences", { locale: "en", sound: false });
        host.emit("state", state);
      },
      { state: E.stripSecret(state, seat), seat },
    );
    await page.locator(".player-strip").waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `.local/release/gallery/${width === 1440 ? "board" : "mobile"}.png`,
    });
    checks.push({
      width,
      diagnostics: await page.evaluate(() => puertorico.diagnostics()),
    });
    if (width === 1440) {
      await page.locator(".action-dock [data-market]").click();
      await page.screenshot({ path: ".local/release/gallery/buildings.png" });
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      window.chatRequests = 0;
      host.on("chat:open", () => chatRequests++);
      host.emit("preferences", {
        locale: "en",
        sound: false,
        platformChat: true,
      });
    });
    await page.locator('[data-panel="chat"]').click();
    assert.equal(await page.evaluate(() => chatRequests), 1);
    assert.equal(await page.locator(".pr-chat[open]").count(), 0);
    await page.evaluate(() => host.emit("preferences", { analysis: true }));
    assert.equal(await page.locator('[data-panel="chat"]').count(), 0);
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    ".local/release/gallery/checks.json",
    JSON.stringify({ errors, checks }, null, 2),
  );
} finally {
  await browser.close();
  server.close();
}
