import { PLAYER_SYMBOLS } from "@boardgamers/protocol/player-symbols";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import * as E from "../engine/index.js";
import * as hosted from "../bgs/engine.js";
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
    const resourceCards = structuredClone(original);
    resourceCards.players[0].goods.corn = 2;
    resourceCards.players[1].goods.sugar = 3;
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(resourceCards, 0),
    );
    assert.equal(
      await page
        .locator('.player-strip [data-player="0"] .player-card-goods')
        .innerText(),
      "2",
    );
    assert.equal(
      await page
        .locator('.player-strip [data-player="1"] .player-card-goods')
        .innerText(),
      "3",
    );
    assert.equal(
      await page
        .locator('.player-strip [data-player="2"] .player-card-goods')
        .count(),
      0,
    );
    assert.equal(await page.locator(".player-board .inventory").count(), 0);
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(original, 0),
    );
    await page.evaluate(() =>
      host.emit("preferences", {
        locale: "fr",
        colorBlind: true,
        bgs: {
          players: [],
          playerColors: [],
          playerSymbols: ["star", "hexagon", "cross"],
        },
      }),
    );
    const firstMarker = page.locator(".player-marker-shaped svg path").first();
    assert.equal(await firstMarker.getAttribute("d"), PLAYER_SYMBOLS.star.path);
    await page.evaluate(() =>
      host.emit("preferences", {
        locale: "fr",
        colorBlind: true,
        bgs: {
          players: [],
          playerColors: [],
          playerSymbols: ["diamond", "hexagon", "cross"],
        },
      }),
    );
    assert.equal(
      await firstMarker.getAttribute("d"),
      PLAYER_SYMBOLS.diamond.path,
    );
    await page.evaluate(() =>
      host.emit("preferences", { locale: "fr", colorBlind: false }),
    );
    assert.equal(await page.locator(".player-marker-shaped").count(), 0);
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
    assert.equal(await overflow(), false, `No page overflow at ${width}`);
    const craftsman = page.locator('[data-role-id="craftsman"]');
    assert.equal(await craftsman.locator(".role-warning").count(), 1);
    await craftsman.click();
    assert.equal(await page.locator("[data-confirm-role]").count(), 1);
    assert.deepEqual(await page.evaluate(() => played), []);
    await page.locator(".modal-body [data-close]").click();
    assert.deepEqual(await page.evaluate(() => played), []);
    await craftsman.click();
    // A newer game state invalidates an open warning; it must not send a stale choice.
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(E.move(original, { type: "role", id: "planter" }, 0), 0),
    );
    assert.equal(await page.locator("dialog[open]").count(), 0);
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(original, 0),
    );
    await craftsman.click();
    await page.locator("[data-confirm-role]").click();
    assert.deepEqual(await page.evaluate(() => played), [
      { type: "role", id: "craftsman" },
    ]);
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(original, 0),
    );
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
    s.players[0].estates = [
      { id: "corn", w: 0, c: 0 },
      { id: "fruit", w: 0, c: 0 },
    ];
    s.players[0].buildings = [];
    s.players[0].reserve = { w: 1, c: 0 };
    await page.evaluate((s) => host.emit("state", s), E.stripSecret(s, 0));
    await page.locator("[data-confirm-assign]").waitFor({ state: "visible" });
    assert.equal(
      await page.locator("[data-slot].w").count(),
      0,
      "new workers are not preassigned",
    );
    assert.equal(
      await page.locator("[data-confirm-assign]").isEnabled(),
      false,
    );
    await page.locator('[data-slot="e0:0"]').click();
    assert.equal(await page.locator('[data-slot="e1:0"]').isEnabled(), false);
    assert.equal(await page.locator('[data-slot="e1:0"]').innerText(), "·");
    await page.locator('[data-slot="e0:0"]').click();
    assert.equal(await page.locator('[data-slot="e1:0"]').isEnabled(), true);
    await page.locator('[data-slot="e1:0"]').click();
    assert.equal(await page.locator('[data-slot="e0:0"]').isEnabled(), false);
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
    await page.waitForTimeout(60);
    assert.equal(
      await page.locator(".player-summary").isVisible(),
      false,
      "summary does not duplicate resources at the top",
    );
    const disabled = page.locator(".offer:disabled").first();
    const box = await disabled.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(120);
    assert.ok((await page.evaluate(() => scrollY)) > 0);
    await page.evaluate(() => {
      const inventory = document.querySelector(
        ".player-strip [data-player='0']",
      );
      scrollTo(0, scrollY + inventory.getBoundingClientRect().bottom + 20);
    });
    await page.waitForTimeout(60);
    const summaryBox = await page.locator(".player-summary").boundingBox();
    assert.ok(
      Math.abs(summaryBox.y) < 1,
      "player summary remains at viewport top",
    );
    assert.ok(summaryBox.height < 80, "player summary stays compact on mobile");
    assert.equal(
      await page
        .locator('.player-summary [aria-label^="Pièces :"]')
        .getAttribute("aria-label"),
      `Pièces : ${original.players[0].coins}`,
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(60);
    assert.equal(
      await page.locator(".player-summary").isVisible(),
      false,
      "summary hides again on return to the top",
    );
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
    // Achievement selection sends a real legal move; opponents see card backs.
    let solo = hosted.init(1, [], {}, "browser-solo");
    await page.evaluate((s) => host.emit("state", s), E.stripSecret(solo, 0));
    assert.equal(await page.locator(".achievement-choices button").count(), 6);
    await page.locator(".achievement-choices button").first().click();
    const card = await page.evaluate(() => played.at(-1));
    assert.equal(card.type, "achievementChoose");
    solo = hosted.move(solo, card, 0);
    while (["achievementChoose", "draft"].includes(solo.tasks[0]?.kind))
      solo = hosted.moveAI(solo);
    await page.evaluate((s) => host.emit("state", s), E.stripSecret(solo, 0));
    assert.equal(await page.locator(".achievement-card").count(), 4);
    assert.equal(await overflow(), false, `Achievement layout at ${width}`);
    await page.locator('[data-player="1"]').click();
    assert.equal(await page.locator(".puertoma-board").count(), 1);
    assert.equal(
      await page
        .locator(".puertoma-board")
        .innerText()
        .then((x) => x.includes("Capacité cachée")),
      true,
    );
    assert.equal(await overflow(), false, `Puertoma layout at ${width}`);
    await page.screenshot({
      path: `.local/qa/${width}-puertoma.png`,
      fullPage: true,
    });
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(original, 0),
    );
    assert.equal(await page.locator(".achievement-card").count(), 4);
    assert.equal(
      await page
        .locator(".achievements")
        .innerText()
        .then((x) => x.includes("Objectif secret")),
      true,
    );
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
