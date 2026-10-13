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
      : '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><div id="game"></div><script src="/viewer.js"></script>',
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
    await page.locator('.offer[data-plantation-info="quarry"]').click();
    assert.match(await page.locator(".modal-body").innerText(), /carrière/i);
    assert.equal(await page.evaluate(() => played.length), 0);
    await page.keyboard.press("Escape");
    assert.deepEqual(await page.locator(".round-order").allTextContents(), [
      "1",
      "2",
      "3",
    ]);
    await page.evaluate(
      (s) => host.emit("state", { ...s, governor: 1 }),
      E.stripSecret(original, 0),
    );
    assert.deepEqual(await page.locator(".round-order").allTextContents(), [
      "3",
      "1",
      "2",
    ]);
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(original, 0),
    );
    const thumbnail = await page.evaluate(
      () =>
        new Promise((resolve) => {
          host.on("thumbnail:ready", resolve);
          host.emit("thumbnail:render", { width: 600, height: 400 });
        }),
    );
    assert.equal(thumbnail.supported, true);
    const portBounds = await page.locator(".port").boundingBox();
    for (const key of ["x", "y", "width", "height"])
      assert.ok(
        Math.abs(thumbnail.bounds[key] - portBounds[key]) < 1,
        "thumbnail captures only the harbour",
      );
    await page.evaluate(() => scrollTo(0, 0));
    const outer = await page.locator(".pr-game").boundingBox();
    assert.equal(outer.x, 0, "no document side margin");
    assert.equal(
      await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).marginTop),
      "0px",
    );
    if (width <= 760)
      assert.equal(
        await page
          .locator(".pr-game")
          .evaluate((el) => getComputedStyle(el).paddingLeft),
        "8px",
      );
    if (width <= 760) {
      assert.equal(
        await page.locator(".production-overview").getAttribute("open"),
        null,
      );
      assert.equal(
        await page.locator(".festival-section").getAttribute("open"),
        null,
      );
      await page.locator('[data-section="production"]').click();
    }
    for (const output of [0, 1, 2]) {
      const production = structuredClone(original);
      production.tasks = [{ kind: "produce", p: 0 }];
      production.role = "craftsman";
      production.players[0].buildings = [];
      production.players[0].estates = output
        ? Array.from({ length: output }, () => ({ id: "corn", w: 1, c: 0 }))
        : [{ id: "fruit", w: 1, c: 0 }];
      await page.evaluate(
        (s) => {
          played.length = 0;
          host.emit("state", s);
        },
        E.stripSecret(production, 0),
      );
      const dock = page.locator(".action-dock");
      assert.equal(
        await dock.getByRole("button", { name: "Passer", exact: true }).count(),
        1,
      );
      const produce = dock.getByRole("button", { name: /Produire/ });
      assert.equal(await produce.count(), output ? 1 : 0);
      if (!output) {
        await dock.getByRole("button", { name: "Passer", exact: true }).click();
        assert.deepEqual(await page.evaluate(() => played), [{ type: "pass" }]);
      } else {
        await produce.click();
        assert.equal(await page.locator(".cargo-form").count(), 0);
        assert.equal(await page.evaluate(() => played[0].goods.corn), output);
        if (output === 2) {
          await page.evaluate(
            (s) => {
              played.length = 0;
              host.emit("state", s);
            },
            E.stripSecret(production, 0),
          );
          await dock.locator("[data-custom-production]").click();
          assert.equal(await page.locator(".cargo-form").count(), 1);
          await page.locator('.cargo-form input[name="corn"]').fill("1");
          await page.locator('.cargo-form button[type="submit"]').click();
          assert.equal(await page.evaluate(() => played[0].goods.corn), 1);
        }
      }
      await page.evaluate(
        (s) => host.emit("state", s),
        E.stripSecret(original, 0),
      );
    }
    await page.evaluate(() => {
      played.length = 0;
    });
    for (const first of ["w", "c"]) {
      const allocation = E.stripSecret(original, 0);
      allocation.historyLength += first === "w" ? 100 : 101;
      allocation.roleHistoryStart = allocation.historyLength;
      allocation.tasks = [{ kind: "assign", p: 0 }];
      allocation.players[0].reserve = { w: 1, c: 1 };
      allocation.players[0].estates = ["corn", "fruit", "sugar"].map((id) => ({
        id,
        w: 0,
        c: 0,
      }));
      allocation.players[0].buildings = [];
      await page.evaluate((s) => host.emit("state", s), allocation);
      await page.locator(".action-dock [data-actions]").click();
      await page.locator(`.pr-modal [data-tool="${first}"]`).click();
      await page.locator('.pr-modal [data-slot="e0:0"]').click();
      const other = first === "w" ? "c" : "w";
      assert.equal(
        await page
          .locator(`.pr-modal [data-tool="${other}"]`)
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await page.locator('.pr-modal [data-slot="e1:0"]').isEnabled(),
        true,
      );
      await page.locator('.pr-modal [data-slot="e1:0"]').click();
      assert.equal(
        await page.locator(`.pr-modal [data-slot="e1:0"].${other}`).count(),
        1,
      );
      assert.equal(
        await page.locator('.pr-modal [data-slot="e2:0"]').isEnabled(),
        false,
      );
      await page.locator('.pr-modal [data-slot="e0:0"]').click();
      assert.equal(
        await page
          .locator(`.pr-modal [data-tool="${first}"]`)
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await page.locator('.pr-modal [data-slot="e2:0"]').isEnabled(),
        true,
      );
      await page.keyboard.press("Escape");
    }
    const resourceCards = structuredClone(original);
    resourceCards.players[0].goods.corn = 2;
    resourceCards.players[0].reserve = { w: 2, c: 1 };
    resourceCards.players[1].goods.sugar = 3;
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(resourceCards, 0),
    );
    assert.deepEqual(
      await page
        .locator('.player-strip [data-player="0"] .player-card-reserve .metric')
        .allTextContents(),
      ["2", "1"],
      "unassigned workers and citizens are visible separately from goods",
    );
    assert.equal(
      await page
        .locator('.player-strip [data-player="0"] .player-card-goods .metric')
        .innerText(),
      "2",
    );
    if (width >= 768) {
      const reserveBox = await page
        .locator('.player-strip [data-player="0"] .player-card-reserve')
        .boundingBox();
      const goodsBox = await page
        .locator('.player-strip [data-player="0"] .player-card-goods')
        .boundingBox();
      assert.equal(reserveBox.y, goodsBox.y, "reserve shares the stock row");
    }
    assert.equal(
      await page
        .locator('.player-strip [data-player="1"] .player-card-goods .metric')
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
    const scoreState = structuredClone(resourceCards);
    scoreState.players[0].vp = 4;
    scoreState.players[0].buildings = [{ id: "smallSugar", w: 0, c: 0 }];
    scoreState.events.push({
      type: "ship",
      p: 0,
      round: 1,
      goods: { corn: 3 },
      vp: 4,
    });
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(scoreState, 0),
    );
    assert.equal(
      await page.locator('.player-strip [data-score="1"]').count(),
      0,
    );
    await page.locator('[data-player="1"] .player-name').click();
    await page.locator('.player-strip [data-score="0"]').press("Enter");
    assert.equal(await page.locator(".score-detail").count(), 1);
    assert.match(
      await page.locator(".score-detail").innerText(),
      /Marchandises expédiées/,
    );
    assert.match(
      await page.locator(".score-detail").innerText(),
      /Bonus d’expédition/,
    );
    assert.match(
      await page.locator(".score-detail").innerText(),
      /Petite sucrerie/,
    );
    assert.equal(
      await page.locator('[data-player="1"].selected').count(),
      1,
      "opening VP details does not switch boards",
    );
    assert.deepEqual(await page.evaluate(() => played), []);
    const total = E.scoreBreakdown(scoreState, 0).total;
    assert.equal(
      await page
        .locator(".score-total .score-value")
        .getAttribute("aria-label"),
      `${total} Points de victoire`,
    );
    await page.locator(".score-history summary").click();
    scoreState.players[0].vp++;
    scoreState.events.push({
      type: "produce",
      p: 0,
      round: 2,
      goods: {},
      vp: 1,
    });
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(scoreState, 0),
    );
    assert.match(await page.locator(".score-detail").innerText(), /Chapelle/);
    assert.equal(await page.locator(".score-history").getAttribute("open"), "");
    assert.equal(
      await page
        .locator(".pr-modal")
        .evaluate((el) => el.scrollWidth > el.clientWidth),
      false,
    );
    await page.screenshot({ path: `.local/qa/${width}-score-detail.png` });
    await page.keyboard.press("Escape");
    await page.locator('[data-player="0"] .player-name').click();
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
    await page.locator(".action-dock [data-actions]").click();
    assert.ok(await page.locator(".role-picker .role").count() > 0);
    assert.ok(await page.locator(".role-choice-warning").count() > 0);
    assert.equal(await page.locator(".recruitment-shares > span").count(), original.players.length);
    assert.equal(
      await page.locator('.role-picker [data-role-id="recruiter"]').innerHTML(),
      await page.locator('.shared-board [data-role-id="recruiter"]').innerHTML(),
      "role picker reuses board role cards",
    );
    assert.equal(await overflow(), false);
    await page.screenshot({ path: `.local/qa/${width}-role-picker.png` });
    await page.keyboard.press("Escape");
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
    await page.locator(".action-dock [data-actions]").click();
    await page
      .locator(
        `.pr-modal [data-move="${encodeURIComponent(JSON.stringify(m))}"]`,
      )
      .click();
    assert.deepEqual(await page.evaluate(() => played.at(-1)), m);
    let s = E.move(original, m, 0);
    while (s.tasks[0].kind !== "recruit") s = E.moveAI(s);
    await page.evaluate((s) => host.emit("state", s), E.stripSecret(s, 0));
    await page.evaluate(() => scrollTo(0, 0));
    assert.equal(
      await page
        .locator('.role[aria-current="step"]')
        .getAttribute("data-role-id"),
      "recruiter",
    );
    assert.match(await page.locator(".role.current").innerText(), /En cours/);
    const betweenRoles = structuredClone(s);
    betweenRoles.tasks = [{ kind: "role", p: 1 }];
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(betweenRoles, 0),
    );
    assert.equal(
      await page.locator('.role[aria-current="step"]').count(),
      0,
      "last role is not marked current during the next role choice",
    );
    await page.evaluate((s) => host.emit("state", s), E.stripSecret(s, 0));
    const recruitButtons = page.locator(
      ".action-dock [data-move]:not(.dock-undo)",
    );
    assert.equal(await recruitButtons.count(), 2);
    for (const button of await recruitButtons.all()) {
      const bounds = await button.boundingBox();
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 845);
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    }
    await page.screenshot({ path: `.local/qa/${width}-recruitment-dock.png` });
    await page.locator('.action-dock button[aria-label$="Citoyens"]').click();
    assert.deepEqual(await page.evaluate(() => played.at(-1)), {
      type: "recruit",
      kind: "c",
    });
    assert.equal(
      await page.evaluate(() => scrollY),
      0,
      "recruit from the dock without page scrolling",
    );
    s = E.move(s, { type: "recruit", kind: "c" }, 0);
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
    const reserveCount = page.locator(
      '.player-strip [data-player="0"] .player-card-reserve .metric',
    );
    assert.equal(await reserveCount.innerText(), "1");
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
    assert.equal(
      await reserveCount.innerText(),
      "0",
      "the card follows the draft allocation",
    );
    assert.equal(
      await page
        .locator('[data-production-good="corn"] .production-output')
        .innerText(),
      "1",
      "preview includes an assigned corn worker before confirmation",
    );
    assert.equal(await page.locator('[data-slot="e1:0"]').isEnabled(), false);
    assert.equal(await page.locator('[data-slot="e1:0"]').innerText(), "·");
    await page.locator('[data-slot="e0:0"]').click();
    assert.equal(
      await reserveCount.innerText(),
      "1",
      "removing a worker returns it to the displayed reserve",
    );
    assert.equal(
      await page
        .locator('[data-production-good="corn"] .production-output')
        .innerText(),
      "0",
      "removing the worker updates production immediately",
    );
    assert.equal(await page.locator('[data-slot="e1:0"]').isEnabled(), true);
    await page.locator('[data-slot="e1:0"]').click();
    assert.equal(
      await page
        .locator('[data-production-good="fruit"] .production-output')
        .innerText(),
      "0",
    );
    assert.match(
      await page
        .locator('[data-production-good="fruit"] .production-status')
        .innerText(),
      /Construisez le bâtiment/,
      "fruit still needs a production building",
    );
    const beforeToggle = await page.evaluate(() => played.length);
    assert.equal(await page.locator("[data-production-help]").count(), 0);
    for (let toggle = 0; toggle < 2; toggle++) {
      const caret = await page.locator(".production-toggle").boundingBox();
      const heading = await page
        .locator(".production-overview h3")
        .boundingBox();
      assert.equal(caret.height, 40);
      assert.ok(
        Math.abs(caret.y + caret.height / 2 - heading.y - heading.height / 2) <
          1,
      );
      await page.locator('[data-section="production"]').click();
    }
    assert.equal(await page.evaluate(() => played.length), beforeToggle);
    assert.equal(await page.locator('[data-slot="e0:0"]').isEnabled(), false);
    // The dock opens the spatial editor without scrolling through objectives.
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator(".action-dock [data-actions]").click();
    assert.equal(
      await page.locator(".placement-editor .achievements").count(),
      0,
    );
    assert.equal(
      await page.locator('.pr-modal [data-slot="e1:0"].w').count(),
      1,
    );
    await page.locator('.pr-modal [data-slot="e1:0"]').click();
    assert.equal(
      await page.locator(".pr-modal [data-confirm-assign]").isEnabled(),
      false,
    );
    await page.locator('.pr-modal [data-slot="e0:0"]').click();
    assert.equal(
      await page.locator(".pr-modal [data-confirm-assign]").isEnabled(),
      true,
    );
    await page.screenshot({ path: `.local/qa/${width}-placement-dialog.png` });
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => scrollY), 0);
    await page.locator(".action-dock [data-actions]").click();
    assert.equal(
      await page.locator('.pr-modal [data-slot="e0:0"].w').count(),
      1,
      "draft survives closing the editor",
    );
    const placedWorkers = await page
      .locator(".player-board .worker-slot")
      .evaluateAll((slots) => slots.map((slot) => slot.className));
    await page.locator(".pr-modal [data-confirm-assign]").click();
    assert.deepEqual(
      await page
        .locator(".player-board .worker-slot")
        .evaluateAll((slots) => slots.map((slot) => slot.className)),
      placedWorkers,
      "submitted workers stay visible while awaiting the platform",
    );
    await page.evaluate(() => host.emit("move:result", { ok: true }));
    assert.deepEqual(
      await page
        .locator(".player-board .worker-slot")
        .evaluateAll((slots) => slots.map((slot) => slot.className)),
      placedWorkers,
      "acknowledgement does not revert the placement",
    );
    const allocation = await page.evaluate(() => played.at(-1));
    assert.equal(allocation.type, "assign");
    s = E.move(s, allocation, 0);
    await page.evaluate((s) => host.emit("state", s), E.stripSecret(s, 0));
    await page.screenshot({
      path: `.local/qa/${width}-board.png`,
      fullPage: true,
    });
    const buildingChoice = E.move(original, { type: "role", id: "builder" }, 0);
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(buildingChoice, 0),
    );
    const passBounds = await page.locator(".dock-pass").boundingBox();
    assert.ok(
      Math.abs(
        width - passBounds.x - passBounds.width - (width <= 760 ? 9 : 16),
      ) < 1,
      "dock buttons align to the viewport edge",
    );
    await page.locator(".action-dock [data-market]").click();
    const productionCard = page.locator(
      '.pr-modal .bcard[data-building="smallFruit"]',
    );
    assert.equal(await productionCard.locator(".staffed-icon").count(), 2);
    assert.match(await productionCard.innerText(), /PRODUCTION/i);
    assert.equal(await overflow(), false, `Building choice at ${width}`);
    await page.screenshot({ path: `.local/qa/${width}-market.png` });
    await productionCard.click();
    assert.match(
      await page.locator(".modal-body").innerText(),
      /Produire une marchandise nécessite deux ouvriers/,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await productionCard.isVisible(),
      true,
      "closing details returns to the market",
    );
    const lastBuilding = page.locator(".pr-modal .bcard").last();
    await lastBuilding.scrollIntoViewIfNeeded();
    const marketScroll = await page
      .locator(".modal-body")
      .evaluate((el) => el.scrollTop);
    const lastBuildingId = await lastBuilding.getAttribute("data-building");
    await lastBuilding.click();
    await page.locator(".pr-modal > header [data-close]").click();
    assert.equal(
      await page.locator(".modal-body").evaluate((el) => el.scrollTop),
      marketScroll,
      "market scroll survives detail close",
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.building),
      lastBuildingId,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator(".pr-modal").isVisible(),
      false,
      "closing the market returns to the board",
    );
    const ownedView = E.stripSecret(buildingChoice, 0);
    const ownedMove = ownedView.legal.find((m) => m.type === "build");
    ownedView.players[0].buildings.push({ id: ownedMove.id, w: 0, c: 0 });
    ownedView.legal = ownedView.legal.filter(
      (m) => m.type !== "build" || m.id !== ownedMove.id,
    );
    await page.evaluate((s) => host.emit("state", s), ownedView);
    await page.locator(".action-dock [data-market]").click();
    const ownedCard = page.locator(
      `.pr-modal [data-building="${ownedMove.id}"]`,
    );
    assert.match(await ownedCard.getAttribute("class"), /unavailable/);
    await ownedCard.click();
    assert.equal(await page.locator(".pr-modal [data-move]").count(), 0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(buildingChoice, 0),
    );
    await page.locator(".action-dock [data-market]").click();
    const buyMove = E.stripSecret(buildingChoice, 0).legal.find(
      (m) => m.type === "build",
    );
    const moveCount = await page.evaluate(() => played.length);
    await page.locator(`.pr-modal [data-building="${buyMove.id}"]`).click();
    assert.equal(
      await page.evaluate(() => played.length),
      moveCount,
      "inspecting a building does not buy it",
    );
    await page
      .locator(
        `.pr-modal [data-move="${encodeURIComponent(JSON.stringify(buyMove))}"]`,
      )
      .click();
    assert.deepEqual(
      await page.evaluate(() => played.at(-1)),
      buyMove,
      "buy from the building details",
    );
    const planting = E.move(original, { type: "role", id: "planter" }, 0);
    const plantingView = E.stripSecret(planting, 0);
    await page.evaluate((s) => host.emit("state", s), plantingView);
    await page.evaluate(() => scrollTo(0, 0));
    assert.equal(
      await page.locator(".dock-controls button").last().getAttribute("class"),
      "move quiet dock-pass",
    );
    await page.locator(".action-dock [data-actions]").click();
    const plantMove = plantingView.legal.find((m) => m.type === "plant");
    await page
      .locator(
        `.pr-modal [data-move="${encodeURIComponent(JSON.stringify(plantMove))}"]`,
      )
      .click();
    assert.deepEqual(await page.evaluate(() => played.at(-1)), plantMove);
    assert.equal(await page.evaluate(() => scrollY), 0);
    await page.locator(".action-dock [data-actions]").click();
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(original, 0),
    );
    assert.equal(
      await page.locator("dialog[open]").count(),
      0,
      "a new phase closes stale action choices",
    );
    const storage = structuredClone(original);
    storage.tasks = [{ kind: "store", p: 0 }];
    storage.role = "captain";
    storage.players[0].buildings = [];
    storage.players[0].goods = {
      corn: 2,
      fruit: 1,
      sugar: 0,
      tobacco: 0,
      coffee: 0,
    };
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(storage, 0),
    );
    await page.locator(".action-dock [data-actions]").click();
    await page
      .locator('.pr-modal [data-qty="corn:1"]')
      .click({ clickCount: 2 });
    assert.equal(
      await page.locator(".pr-modal [data-confirm-store]").isEnabled(),
      false,
    );
    await page
      .locator('.pr-modal [data-qty="corn:-1"]')
      .click({ clickCount: 2 });
    await page.locator('.pr-modal [data-qty="fruit:1"]').click();
    assert.equal(
      await page.locator(".pr-modal [data-confirm-store]").isEnabled(),
      true,
    );
    assert.equal(await overflow(), false, `Storage editor at ${width}`);
    await page.locator(".pr-modal [data-confirm-store]").click();
    assert.deepEqual(await page.evaluate(() => played.at(-1).goods), {
      corn: 0,
      fruit: 1,
      sugar: 0,
      tobacco: 0,
      coffee: 0,
    });
    await page.evaluate((s) => host.emit("state", s), E.stripSecret(s, 0));
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
    await page.evaluate((s) => host.emit("state", s), full);
    for (let i = 0; i < full.players.length; i++) {
      const counter = page.locator(`.player-strip [data-score="${i}"]`);
      assert.ok((await counter.getAttribute("aria-label")).endsWith(`: ${E.scoreBreakdown(full, i).total}`));
    }
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
    await page.locator('.scores [data-score="1"]').last().click();
    assert.match(await page.locator(".score-total").innerText(), /Total final/);
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
    const disabled = page.locator(".offer[data-plantation-info]").first();
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
    assert.equal(summaryBox.x, 0, "summary starts at the viewport edge");
    assert.equal(summaryBox.width, width, "summary spans the full viewport");
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
      window.chatReads = [];
      host.on("chat:read", (m) => chatReads.push(m));
      host.emit("chat:state", {
        enabled: true,
        canSend: true,
        mentions: [],
        readState: { userId: "self", lastReadAt: 0 },
      });
      host.emit(
        "chat:messages",
        Array.from({ length: 70 }, (_, i) => ({
          _id: `${(1700000000 + i).toString(16)}0000000000000000`,
          authorId: "other",
          type: "text",
          author: "Isabel",
          playerIndex: 1,
          text: `Message ${i}: plenty of chat history to scroll.`,
          createdAt: new Date(1700000000000 + i * 1000).toISOString(),
        })),
      );
    });
    await page.waitForTimeout(600);
    assert.deepEqual(
      await page.evaluate(() => chatReads),
      [],
      "closed chat does not mark messages read",
    );
    assert.equal(await page.locator(".chat-unread").innerText(), "70");
    await page.locator('[data-panel="chat"]').click();
    await page.waitForTimeout(100);
    await page.evaluate(() =>
      host.emit("preferences", {
        colorBlind: true,
        bgs: {
          players: [],
          playerColors: ["#112233", "#abcdef"],
          playerSymbols: ["star", "diamond"],
        },
      }),
    );
    const author = page.locator(".pr-chat .chat-author").first();
    assert.equal(
      await author.evaluate((el) => getComputedStyle(el).color),
      "rgb(171, 205, 239)",
    );
    assert.equal(await author.locator(".player-marker").count(), 0);
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
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      chatReads.length = 0;
      host.emit("chat:messages", [
        {
          _id: "700000000000000000000001",
          type: "text",
          author: "Isabel",
          authorId: "other",
          playerIndex: 1,
          text: "New message while closed",
        },
      ]);
    });
    await page.waitForTimeout(600);
    assert.deepEqual(
      await page.evaluate(() => chatReads),
      [],
      "new messages stay unread while closed",
    );
    assert.equal(await page.locator(".chat-unread").innerText(), "1");
    await page.locator('[data-panel="chat"]').click();
    await page.waitForTimeout(900);
    assert.equal(await page.locator(".chat-unread").isVisible(), false);
    assert.deepEqual(await page.evaluate(() => chatReads), [
      { messageId: "700000000000000000000001" },
    ]);
    await page.keyboard.press("Escape");
    // Achievement selection sends a real legal move; opponents see card backs.
    let solo = hosted.init(1, [], {}, "browser-solo");
    await page.evaluate((s) => host.emit("state", s), E.stripSecret(solo, 0));
    await page.locator(".action-dock [data-actions]").click();
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
    await page.locator("[data-production-compare]").click();
    assert.equal(await page.locator(".production-comparison tbody").count(), 3);
    assert.equal(await overflow(), false, `Production comparison at ${width}`);
    await page.screenshot({
      path: `.local/qa/${width}-production-comparison.png`,
    });
    await page.keyboard.press("Escape");
    let parallel = E.init(3, [], {}, "browser-parallel");
    parallel = E.move(parallel, { type: "role", id: "recruiter" }, 0);
    parallel = E.move(parallel, { type: "recruitBonus" }, 0);
    parallel.players[2].estates.push({ id: "sugar", w: 0, c: 0 });
    await page.evaluate(
      (s) => {
        host.emit("player", { index: 2 });
        host.emit("state", s);
      },
      E.stripSecret(parallel, 2),
    );
    await page.locator(".action-dock [data-actions]").click();
    await page.locator('.pr-modal [data-slot="e1:0"]').click();
    parallel = E.move(
      parallel,
      { type: "assign", ...E.autoAssignment(parallel, 0) },
      0,
    );
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(parallel, 2),
    );
    assert.equal(
      await page.locator('.pr-modal [data-slot="e1:0"].w').count(),
      1,
      "another placement preserves our draft and editor",
    );
    await page.keyboard.press("Escape");
    await page.screenshot({ path: `.local/qa/${width}-placement-dock.png` });
    if (width <= 760) {
      const bar = await page.locator(".action-dock").boundingBox();
      assert.ok(bar.height < 115, "mobile placement bar stays within two rows");
      await page.locator(".action-dock [data-actions]").click();
    }
    await page
      .locator(
        `${width <= 760 ? ".pr-modal" : ".action-dock"} [data-move="%7B%22type%22%3A%22orderedPlacement%22%7D"]`,
      )
      .click();
    assert.equal(
      await page.evaluate(() => played.at(-1).type),
      "orderedPlacement",
    );
    parallel = E.move(parallel, { type: "orderedPlacement" }, 2);
    await page.evaluate(
      (s) => host.emit("state", s),
      E.stripSecret(parallel, 2),
    );
    assert.equal(
      await page.locator(".action-dock [data-actions]").count(),
      0,
      "ordered request waits for earlier player",
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
