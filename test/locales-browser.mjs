import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "playwright";
import * as engine from "../bgs/engine.js";
import { supportedLocales, translator } from "../viewer/i18n.js";

const server = createServer(async (req, res) => {
  if (req.url === "/avatar.svg") {
    res.setHeader("Content-Type", "image/svg+xml");
    res.end(await readFile("bgs/assets/pictogram.svg"));
    return;
  }
  res.setHeader(
    "Content-Type",
    req.url === "/viewer.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/viewer.js"
      ? await readFile("dist/viewer.js")
      : '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style><div id="game"></div><script src="/viewer.js"></script>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch();
const errors = [];
let state = engine.init(5, [], {}, "locale-mobile");
const playerNames = [
  "María Fernanda de la Cruz",
  "Alexandria Montgomery-Wellington",
  "Nguyễn Thị Minh Phương",
  "نام طولانی بازیکن چهارم",
  'Long player name <&> "five"',
];
state.players.forEach((player, seat) => {
  player.name = playerNames[seat];
});
state.players[4].goods.corn = 1;
state = engine.stripSecret(state, 0);
const page = await browser.newPage({
  viewport: { width: 320, height: 640 },
  hasTouch: true,
});
page.setDefaultTimeout(10000);
page.on("pageerror", (error) => errors.push(error.message));
try {
  await mkdir(".local/qa", { recursive: true });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate((s) => {
    window.host = puertorico.launch("#game");
    window.played = [];
    host.on("move", (move) => played.push(move));
    host.emit("player", { index: 0 });
    host.emit("avatars", ["/avatar.svg", "/avatar.svg"]);
    host.emit("preferences", {
      bgs: {
        players: [{ pro: true }],
        playerColors: ["#7654AB"],
        playerSymbols: ["star", "hexagon", "cross", "diamond", "circle"],
        supporterBadge: {
          url: location.origin + "/avatar.svg",
          label: "Supporter",
        },
      },
    });
    host.emit("state", s);
  }, state);
  assert.equal(await page.locator(".player-avatar").count(), 2);
  assert.equal(await page.locator(".supporter-badge").count(), 1);
  await page.evaluate(() => host.emit("theme", { dark: true }));
  assert.equal(
    await page.locator(".supporter-badge").count(),
    1,
    "theme change preserves supporter identity",
  );
  assert.ok(
    (
      await page.locator(".player-marker").first().getAttribute("style")
    ).includes("#7654AB"),
  );
  const fits = async (label) => {
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )
    ) {
      console.log(
        label,
        await page.evaluate(() =>
          [...document.querySelectorAll(".pr-game *")]
            .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
            .slice(0, 12)
            .map((el) => ({
              tag: el.tagName,
              class: el.className,
              right: el.getBoundingClientRect().right,
              width: el.getBoundingClientRect().width,
            })),
        ),
      );
      await page.screenshot({ path: ".local/qa/overflow.png" });
    }

    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      label,
    );
    const dialog = page.locator("dialog[open]");
    if (await dialog.count())
      assert.equal(
        await dialog.evaluate((el) => el.scrollWidth > el.clientWidth + 1),
        false,
        `${label}: dialog width`,
      );
  };
  const boardTabs = page.locator(".board-player-tabs");
  const boardTab = (seat) =>
    boardTabs.locator(`button[data-board-player="${seat}"]`);
  const tabFullyVisible = (tab) =>
    tab.evaluate((button) => {
      const row = button.parentElement;
      const rowBounds = row.getBoundingClientRect();
      const tabBounds = button.getBoundingClientRect();
      const left = rowBounds.left + row.clientLeft;
      return (
        tabBounds.left >= left - 1 &&
        tabBounds.right <= left + row.clientWidth + 1
      );
    });
  for (const locale of supportedLocales) {
    await page.evaluate((locale) => {
      host.emit("preferences", { locale, colorBlind: true });
      scrollTo(0, 0);
    }, locale);
    const t = translator(locale);
    assert.equal(await page.locator(".pr-game").getAttribute("lang"), locale);
    assert.equal(
      await page.locator(".pr-game").getAttribute("dir"),
      locale === "fa" ? "rtl" : "ltr",
    );
    await fits(`${locale}: five-player board`);
    assert.equal(await boardTabs.getAttribute("role"), "group");
    assert.equal(await boardTabs.getAttribute("aria-label"), t("players"));
    assert.equal(await boardTabs.getByRole("button").count(), 5);
    assert.equal(await boardTab(0).getAttribute("aria-pressed"), "true");
    assert.ok(
      await boardTabs.evaluate((row) => row.scrollWidth > row.clientWidth),
      `${locale}: five long names scroll within the tab row`,
    );
    const rowBox = await boardTabs.boundingBox();
    for (let seat = 0; seat < playerNames.length; seat++) {
      const tab = boardTab(seat);
      assert.equal(await tab.getAttribute("title"), playerNames[seat]);
      assert.equal(
        await tab.locator(":scope > span:last-child").textContent(),
        playerNames[seat],
      );
      assert.equal(await tab.locator(".player-marker").count(), 1);
      const tabBox = await tab.boundingBox();
      assert.ok(tabBox.height >= 44, `${locale}: touch-sized player tab`);
      assert.ok(tabBox.width >= 88, `${locale}: player name remains readable`);
      const clearance = rowBox.y + rowBox.height - tabBox.y - tabBox.height;
      assert.ok(
        clearance >= 2 - 1 && clearance <= 7,
        `${locale}: compact scrollbar clearance below the tab border`,
      );
    }
    await boardTab(4).click();
    assert.equal(await boardTab(4).getAttribute("aria-pressed"), "true");
    assert.equal(await boardTabs.locator('[aria-pressed="true"]').count(), 1);
    assert.equal(
      await page.locator(".player-board").getAttribute("aria-label"),
      state.players[4].name,
    );
    assert.equal(
      await page.locator('.player-strip [data-player="4"].selected').count(),
      1,
    );
    assert.equal(await page.locator(".board-player-goods .metric").count(), 5);
    assert.ok(
      await tabFullyVisible(boardTab(4)),
      `${locale}: selected fifth tab is fully visible`,
    );
    // Force the selected tab offscreen and return to the page top. Rendering
    // must reveal it within the row without bringing the board into view.
    await boardTabs.evaluate((row) => {
      row.scrollLeft = 0;
      scrollTo(0, 0);
    });
    assert.equal(await tabFullyVisible(boardTab(4)), false);
    const beforeRender = await page.evaluate(() => scrollY);
    state.players[4].goods.corn++;
    await page.evaluate((s) => host.emit("state", s), state);
    assert.ok(
      await tabFullyVisible(boardTab(4)),
      `${locale}: rendering reveals the selected fifth tab`,
    );
    assert.ok(
      Math.abs((await page.evaluate(() => scrollY)) - beforeRender) < 2,
      `${locale}: rendering the selected tab never scrolls the page`,
    );
    assert.equal(await boardTab(4).getAttribute("aria-pressed"), "true");
    assert.equal(
      await page.locator(".board-player-goods .metric").first().innerText(),
      String(state.players[4].goods.corn),
    );
    await fits(`${locale}: long selected player name`);
    await boardTab(0).click();
    assert.deepEqual(await page.evaluate(() => played), []);
    for (const selector of [".festival-section", ".production-overview"]) {
      assert.equal(
        await page.locator(selector).getAttribute("open"),
        null,
        `${locale}: compact mobile panel`,
      );
      assert.ok(
        (await page.locator(selector).boundingBox()).height < 110,
        `${locale}: compact summary height`,
      );
    }

    const dock = await page.locator(".action-dock").boundingBox();
    assert.ok(
      dock.y >= 0 && dock.y + dock.height <= 641,
      `${locale}: action dock fits screen`,
    );
    assert.ok(dock.height < 200, `${locale}: action dock stays compact`);
    assert.equal(await page.locator("[data-production-help]").count(), 0);
    await page.locator("[data-market]").first().click();
    await page.locator(".pr-modal [data-building]").first().click();
    await fits(`${locale}: building help`);
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator(".pr-modal .market-grid").isVisible(),
      true,
    );
    await page.keyboard.press("Escape");
    await page.screenshot({ path: `.local/qa/locale-${locale}.png` });
  }

  const festival = page.locator(".festival-section");
  const compactHeight = (await festival.boundingBox()).height;
  await page.locator('[data-section="festival"]').click();
  assert.ok(
    (await festival.boundingBox()).height > compactHeight + 100,
    "collapsed objectives save substantial space",
  );
  await page.evaluate((s) => host.emit("state", s), state);
  assert.equal(
    await festival.getAttribute("open"),
    "",
    "panel choice survives state updates",
  );
  await page.locator('[data-section="festival"]').click();
  // Real touch gestures, including starting over a disabled control, use native
  // page scrolling rather than a pointer handler which can trap mobile users.
  await page.evaluate(() => {
    host.emit("preferences", { locale: "fr" });
    scrollTo(0, 0);
  });
  const session = await page.context().newCDPSession(page);
  const swipe = async (x, y, dx, dy) => {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 8; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + (dx * step) / 8, y: y + (dy * step) / 8 }],
      });
      await page.waitForTimeout(20);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(100);
  };
  for (const locale of ["fr", "fa"]) {
    await page.evaluate((locale) => {
      host.emit("preferences", { locale });
      const row = document.querySelector(".board-player-tabs");
      row.scrollLeft = 0;
      scrollTo(0, scrollY + row.getBoundingClientRect().top - 260);
    }, locale);
    await page.waitForTimeout(100);
    const rowBox = await boardTabs.boundingBox();
    const beforeSwipe = await page.evaluate(() => ({
      y: scrollY,
      left: document.querySelector(".board-player-tabs").scrollLeft,
      selected: document.querySelector(
        '.board-player-tabs [aria-pressed="true"]',
      ).dataset.boardPlayer,
      moves: played.length,
    }));
    const rtl = locale === "fa";
    await swipe(
      rowBox.x + (rtl ? 20 : rowBox.width - 20),
      rowBox.y + rowBox.height / 2,
      (rowBox.width - 40) * (rtl ? 1 : -1),
      0,
    );
    assert.ok(
      Math.abs(
        (await boardTabs.evaluate((row) => row.scrollLeft)) - beforeSwipe.left,
      ) > 40,
      `${locale}: a native horizontal swipe scrolls the player tabs`,
    );
    assert.equal(
      await boardTabs
        .locator('[aria-pressed="true"]')
        .getAttribute("data-board-player"),
      beforeSwipe.selected,
      `${locale}: swiping does not select a different board`,
    );
    assert.equal(await page.evaluate(() => played.length), beforeSwipe.moves);
    assert.ok(
      Math.abs((await page.evaluate(() => scrollY)) - beforeSwipe.y) < 2,
      `${locale}: horizontal swiping does not move the page vertically`,
    );
    await fits(`${locale}: horizontally scrolled tabs`);
    await page.waitForTimeout(200);
    const beforeVerticalSwipe = await page.evaluate(() => scrollY);
    await swipe(
      rowBox.x + rowBox.width / 2,
      rowBox.y + rowBox.height / 2,
      0,
      -160,
    );
    assert.ok(
      (await page.evaluate(() => scrollY)) > beforeVerticalSwipe,
      `${locale}: player tabs still allow native vertical page scrolling`,
    );
    assert.equal(
      await boardTabs
        .locator('[aria-pressed="true"]')
        .getAttribute("data-board-player"),
      beforeSwipe.selected,
    );
    assert.equal(await page.evaluate(() => played.length), beforeSwipe.moves);
  }
  await page.evaluate(() => {
    host.emit("preferences", { locale: "fr" });
    scrollTo(0, 0);
  });
  const disabled = page.locator(".offer[data-plantation-info]").first();
  await disabled.scrollIntoViewIfNeeded();
  const box = await disabled.boundingBox();
  const before = await page.evaluate(() => scrollY);
  await swipe(
    box.x + box.width / 2,
    Math.min(540, box.y + box.height / 2),
    0,
    -180,
  );
  assert.ok(
    (await page.evaluate(() => scrollY)) > before,
    "touch scroll starting on disabled control",
  );
  await page.locator('[data-panel="rules"]').click();
  const body = page.locator(".pr-modal .modal-body");
  await body.evaluate((el) => (el.scrollTop = 0));
  const modalBox = await body.boundingBox();
  await swipe(
    modalBox.x + modalBox.width / 2,
    modalBox.y + modalBox.height * 0.8,
    0,
    -modalBox.height * 0.5,
  );
  assert.ok(
    (await body.evaluate((el) => el.scrollTop)) > 0,
    "native touch scroll inside help",
  );
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 568, height: 320 });
  await page.locator('[data-panel="rules"]').click();
  await fits("mobile landscape help");
  const close = await page.locator(".pr-modal [data-close]").boundingBox();
  assert.ok(
    close.y >= 0 && close.y + close.height <= 321,
    "landscape dialog close stays reachable",
  );
  assert.deepEqual(errors, []);
  console.log(
    `All ${supportedLocales.length} locales fit 320px; touch scrolling and landscape dialogs verified.`,
  );
} finally {
  await browser.close();
  server.close();
}
