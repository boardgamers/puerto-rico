import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { tutorialCatalogs } from "../tutorial/i18n.js";
import { chapters, expectedMove } from "../tutorial/scenarios.js";
const server = createServer(async (req, res) => {
  res.setHeader(
    "Content-Type",
    req.url === "/viewer.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/viewer.js"
      ? await readFile(process.env.TUTORIAL_VIEWER ?? "dist/viewer.js")
      : '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="game"></div><script src="/viewer.js"></script>',
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch();
const errors = [];
await mkdir(".local/qa", { recursive: true });
async function moveButton(page, move) {
  const find = () =>
    page.evaluate((m) => {
      document
        .querySelectorAll("[data-qa-move]")
        .forEach((n) => n.removeAttribute("data-qa-move"));
      const stable = (v) =>
        v && typeof v === "object"
          ? JSON.stringify(
              Object.fromEntries(
                Object.keys(v)
                  .sort()
                  .map((k) => [k, stable(v[k])]),
              ),
            )
          : JSON.stringify(v);
      const dialog = document.querySelector("dialog[open]");
      const root = dialog ?? document;
      const button = [...root.querySelectorAll("[data-move]")].find(
        (n) =>
          !n.disabled &&
          n.getClientRects().length &&
          stable(JSON.parse(decodeURIComponent(n.dataset.move))) === stable(m),
      );
      if (button) button.dataset.qaMove = "true";
      return !!button;
    }, move);
  if (!(await find())) {
    await page.locator(".action-dock [data-actions]").click();
    assert.ok(await find(), `No UI control for ${JSON.stringify(move)}`);
  }
  await page.locator("[data-qa-move]").click();
  if (await page.locator("[data-confirm-role]").isVisible())
    await page.locator("[data-confirm-role]").click();
}
async function play(page, move) {
  if (move.type === "assign") {
    await page.locator(".action-dock [data-actions]").click();
    const modal = page.locator(".pr-modal");
    while (await modal.locator(".worker-slot.w,.worker-slot.c").count())
      await modal.locator(".worker-slot.w,.worker-slot.c").first().click();
    for (const [type, tiles] of [
      ["e", move.estates],
      ["b", move.buildings],
    ])
      for (let i = 0; i < tiles.length; i++) {
        let slot = 0;
        for (const kind of ["c", "w"])
          for (let n = 0; n < tiles[i][kind]; n++) {
            await modal.locator(`[data-tool="${kind}"]`).click();
            await modal.locator(`[data-slot="${type}${i}:${slot++}"]`).click();
          }
      }
    await modal.locator("[data-confirm-assign]").click();
  } else if (move.type === "store") {
    await page.locator(".action-dock [data-actions]").click();
    for (const good of Object.keys(move.goods)) {
      const plus = page.locator(`.pr-modal [data-qty="${good}:1"]`);
      if (!(await plus.count())) continue;
      const current = () =>
        plus
          .locator("..")
          .locator("b")
          .innerText()
          .then((x) => Number(x.split("/")[0].trim()));
      while ((await current()) > move.goods[good])
        await page.locator(`.pr-modal [data-qty="${good}:-1"]`).click();
      while ((await current()) < move.goods[good]) await plus.click();
    }
    await page.locator(".pr-modal [data-confirm-store]").click();
  } else if (move.type === "build") {
    await page.locator(".action-dock [data-market]").click();
    await page.locator(`.pr-modal [data-building="${move.id}"]`).click();
    await moveButton(page, move);
  } else {
    await moveButton(page, move);
    if (
      move.type === "produce" &&
      (await page.locator(".cargo-form").isVisible())
    ) {
      for (const input of await page.locator(".cargo-form input").all())
        await input.fill(
          String(move.goods[await input.getAttribute("name")] ?? 0),
        );
      await page.locator('.cargo-form button[type="submit"]').click();
    }
  }
}
try {
  for (const width of [390, 1440])
    for (const id of Object.keys(chapters)) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        hasTouch: true,
      });
      page.setDefaultTimeout(10000);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.evaluate(
        async ({ id, locale }) => {
          window.progress = [];
          await puertorico.launchTutorial("#game", {
            chapter: id,
            locale,
            onProgress: (p) => progress.push(p),
            nextChapter: {
              title: "Next",
              open: () => (window.nextOpened = true),
              onVisibilityChange: (v) => (window.nextVisible = v),
            },
          });
        },
        { id, locale: width === 390 ? "fr" : "en" },
      );
      let state = chapters[id].initialState();
      while (
        await page.locator('[data-tutorial-control="continue"]').isVisible()
      )
        await page.locator('[data-tutorial-control="continue"]').click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `${id} overflow ${width}`,
      );
      await page.screenshot({ path: `.local/qa/tutorial-${id}-${width}.png` });
      for (let index = 0; index < chapters[id].steps.length; index++) {
        const before = await page.evaluate(() => progress.at(-1).step);
        const move = expectedMove(state);
        await play(page, move);
        await page.waitForFunction(
          (step) => progress.at(-1).step > step,
          before,
        );
        state = chapters[id].move(state, move);
        assert.equal(
          await page.locator(".tutorial-error").isVisible(),
          false,
          `${id} step ${index}`,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          `${id} step ${index} overflow`,
        );
        if (index === 0) {
          // Reload reconstructs the accepted engine move from local saved actions.
          const step = await page.evaluate(() => progress.at(-1).step);
          await page.reload();
          await page.evaluate(
            async ({ id, locale }) => {
              window.progress = [];
              await puertorico.launchTutorial("#game", {
                chapter: id,
                locale,
                onProgress: (p) => progress.push(p),
                nextChapter: {
                  title: "Next",
                  open: () => (window.nextOpened = true),
                  onVisibilityChange: (v) => (window.nextVisible = v),
                },
              });
            },
            { id, locale: width === 390 ? "fr" : "en" },
          );
          assert.equal(
            await page.evaluate(() => progress.at(-1).step),
            step,
            `${id} reload`,
          );
          await page.locator('[data-tutorial-control="retry"]').click();
          assert.equal(
            await page.evaluate(() => progress.at(-1).step),
            step,
            `${id} retry`,
          );
        }
      }
      assert.equal(
        await page.evaluate(() => progress.at(-1).completed),
        true,
        id,
      );
      await page.locator('[data-tutorial-control="next"]').click();
      assert.equal(await page.evaluate(() => nextOpened), true);
      await page.locator('[data-tutorial-control="restart"]').click();
      assert.equal(await page.evaluate(() => progress.at(-1).step), 0);
      await page.evaluate(() => puertorico.launch("#game"));
      assert.equal(
        await page.locator(".pr-tutorial").count(),
        0,
        "game launch cleans up tutorial",
      );
      await page.close();
      console.log(`${id} tutorial: UI, reload, retry, completion ${width}px`);
    }
  const page = await browser.newPage({
    viewport: { width: 320, height: 640 },
    hasTouch: true,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  for (const [locale, catalog] of Object.entries(tutorialCatalogs)) {
    await page.evaluate(async (locale) => {
      await puertorico.launchTutorial("#game", { chapter: "citizens", locale });
    }, locale);
    assert.equal(
      await page.locator(".pr-tutorial-guide > summary strong").innerText(),
      catalog["tutorial.citizens.assign.title"],
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      `${locale} tutorial overflow`,
    );
    await page.locator("[data-tutorial-control=showArea]").click();
    await page.locator(".pr-tutorial-guide > summary").click();
    assert.equal(
      await page.locator(".tutorial-guide-body").isVisible(),
      false,
      `${locale} guide collapses`,
    );
    if (locale === "fa")
      assert.equal(
        await page.locator(".pr-tutorial").getAttribute("dir"),
        "rtl",
      );
  }
  await page.close();
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  server.close();
}
