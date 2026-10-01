import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import * as E from "../engine/index.js";
import { RELEASE } from "../release-config.js";
const server = createServer(async (req, res) => {
  res.setHeader(
    "Content-Type",
    req.url.endsWith(".js") ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/viewer.js"
      ? await readFile(new URL("../dist/viewer.js", import.meta.url))
      : '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style><div id="game"></div><script src="/viewer.js"></script>',
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
await mkdir(".local/qa", { recursive: true });
let original = E.init(3, RELEASE.expansions, RELEASE.options, "browser");
while (original.tasks[0].kind === "draft") original = E.moveAI(original);
const full = (() => {
  let s = original;
  while (!s.finished) s = E.moveAI(s);
  return s;
})();
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.evaluate(
      (s) => {
        window.host = puertorico.launch("#game");
        window.played = [];
        host.on("move", (m) => played.push(m));
        host.emit("player", { index: 0 });
        host.emit("preferences", { locale: "fr" });
        host.emit("state", s);
      },
      E.stripSecret(original, 0),
    );
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
    assert.equal(await overflow(), false, `No page overflow at ${width}`);
    await page.locator('[data-panel="rules"]').click();
    assert.equal(await page.locator("dialog[open]").count(), 1);
    await page.keyboard.press("Escape");
    await page.locator('[data-panel="journal"]').click();
    await page.keyboard.press("Escape");
    const m = { type: "role", id: "recruiter" };
    await page
      .locator(`[data-move="${encodeURIComponent(JSON.stringify(m))}"]`)
      .click();
    assert.deepEqual(await page.evaluate(() => played.at(-1)), m);
    let s = E.move(original, m, 0);
    while (s.tasks[0].kind !== "assign") s = E.moveAI(s);
    s.tasks[0].p = 0;
    await page.evaluate((s) => host.emit("state", s), E.stripSecret(s, 0));
    await page.locator("[data-confirm-assign]").waitFor({ state: "visible" });
    assert.ok(await page.locator("[data-slot]").count());
    await page.locator("[data-confirm-assign]").click();
    const allocation = await page.evaluate(() => played.at(-1));
    assert.equal(allocation.type, "assign");
    s = E.move(s, allocation, 0);
    await page.evaluate((s) => host.emit("state", s), E.stripSecret(s, 0));
    await page.screenshot({
      path: `.local/qa/${width}-board.png`,
      fullPage: true,
    });
    // Identical state notifications preserve the SVG/board nodes instead of redrawing them.
    await page.evaluate(
      (s) => {
        window.shipNode = document.querySelector(".ship-art");
        host.emit("state", s);
      },
      E.stripSecret(s, 0),
    );
    assert.ok(
      await page.evaluate(
        () => shipNode === document.querySelector(".ship-art"),
      ),
    );
    // Journal and final scoring remain scrollable even on the smallest viewport.
    await page.evaluate((s) => host.emit("state", s), E.stripSecret(full, 0));
    await page.locator('[data-panel="journal"]').click();
    const log = page.locator(".pr-modal .modal-body");
    await log.evaluate((el) => (el.scrollTop = 0));
    await log.hover();
    await page.mouse.wheel(0, 520);
    await page.waitForTimeout(120);
    assert.ok((await log.evaluate((el) => el.scrollTop)) > 0);
    await page.keyboard.press("Escape");
    await page.locator("[data-scores]").click();
    assert.equal(await overflow(), false);
    assert.ok((await page.locator(".scores article").count()) === 3);
    await page.keyboard.press("Escape");
    // Scroll starts on disabled controls without interception.
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(original, 0),
    );
    await page.evaluate(() => scrollTo(0, 0));
    const disabled = page.locator(".offer:disabled").first();
    const box = await disabled.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(120);
    assert.ok((await page.evaluate(() => scrollY)) > 0);
    // Chat uses the platform's messages and a scrolling native viewport.
    await page.evaluate(() => {
      host.emit("chat:state", { enabled: true, canSend: true, mentions: [] });
      host.emit(
        "chat:messages",
        Array.from({ length: 70 }, (_, i) => ({
          _id: `message-${i}`,
          type: "text",
          author: "Isabel",
          playerIndex: 1,
          text: `Message ${i}: plenty of chat history to scroll.`,
          createdAt: new Date(1700000000000 + i * 1000).toISOString(),
        })),
      );
    });
    await page.locator('[data-panel="chat"]').click();
    await page.waitForTimeout(100);
    const chat = page.locator('.pr-chat [role="log"]');
    assert.ok(await chat.evaluate((el) => el.scrollHeight > el.clientHeight));
    await chat.evaluate((el) => (el.scrollTop = 0));
    await chat.hover();
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(150);
    assert.ok((await chat.evaluate((el) => el.scrollTop)) > 0);
    const composer = await page.locator(".chat-composer").boundingBox();
    assert.ok(composer.y + composer.height <= 844);
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, [], `No browser errors at ${width}`);
    console.log(
      `Browser ${width}px: actions, allocation, layout, journal, chat and scrolling OK`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
