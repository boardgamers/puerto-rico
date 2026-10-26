import assert from "node:assert/strict";
import { chromium } from "playwright";
import * as E from "../engine/index.js";
import { RELEASE } from "../release-config.js";

const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const outer = await browser.newPage({ viewport: { width, height: 844 } });
    await outer.setContent(
      `<iframe style="width:100%;height:800px" sandbox="allow-scripts allow-same-origin" srcdoc="&lt;div id='game'&gt;&lt;/div&gt;"></iframe>`,
    );
    const frame = outer.frames()[1];
    await frame.addScriptTag({ path: "dist/viewer.js" });
    const s = E.init(3, RELEASE.expansions, RELEASE.options, "cargo-form");
    s.role = "captain";
    s.owner = 1;
    s.tasks = [{ kind: "ship", p: 0 }, { kind: "phaseEnd" }];
    s.usedWharves = [];
    s.ships.forEach((ship, i) => {
      ship.good = ["corn", "fruit", "sugar"][i];
      ship.amount = ship.capacity;
    });
    s.players[0].buildings = [{ id: "smallWharf", w: 1, c: 0 }];
    s.players[0].goods = { corn: 1, fruit: 4, sugar: 0, tobacco: 0, coffee: 0 };
    const errors = [];
    outer.on("pageerror", (e) => errors.push(e.message));
    await frame.evaluate(() => {
      window.host = puertorico.launch("#game");
      window.played = [];
      host.on("move", (m) => {
        played.push(m);
        host.emit("moveResult", { ok: true });
      });
      host.emit("player", { index: 0 });
    });
    const reset = async () =>
      frame.evaluate(
        (state) => {
          played.length = 0;
          host.emit("state", state);
        },
        E.stripSecret(s, 0),
      );
    await reset();
    await frame
      .locator(".action-dock [data-move]")
      .filter({ hasText: "Mixed cargo" })
      .click();
    await frame.locator('input[name="fruit"]').fill("3");
    await frame.locator("[data-cargo-confirm]").click();
    assert.deepEqual(await frame.evaluate(() => played), [
      {
        type: "smallWharf",
        goods: { corn: 1, fruit: 3, sugar: 0, tobacco: 0, coffee: 0 },
      },
    ]);
    await frame.evaluate(() => document.querySelector("dialog[open]").close());
    await reset();
    await frame
      .locator(".action-dock [data-move]")
      .filter({ hasText: "Mixed cargo" })
      .click();
    await frame.locator('input[name="fruit"]').fill("5");
    await frame.locator("[data-cargo-confirm]").click();
    assert.equal(
      await frame.evaluate(() => played.length),
      0,
      "reject quantities above stock",
    );
    await frame.locator('input[name="fruit"]').fill("0");
    await frame.locator('input[name="corn"]').fill("0");
    assert.equal(
      await frame.locator("[data-cargo-confirm]").isDisabled(),
      true,
    );
    await frame.locator('input[name="fruit"]').fill("2");
    await frame.locator('input[name="fruit"]').press("Enter");
    assert.equal(await frame.evaluate(() => played[0].goods.fruit), 2);
    await frame.evaluate(() => document.querySelector("dialog[open]").close());
    s.role = "craftsman";
    s.tasks = [{ kind: "produce", p: 0 }, { kind: "phaseEnd" }];
    s.players[0].estates = [
      { id: "corn", w: 1, c: 0 },
      { id: "corn", w: 1, c: 0 },
    ];
    await reset();
    await frame.locator("[data-custom-production]").click();
    await frame.locator('input[name="corn"]').fill("1");
    await frame.locator("[data-cargo-confirm]").click();
    assert.equal(await frame.evaluate(() => played[0].type), "produce");
    assert.equal(await frame.evaluate(() => played[0].goods.corn), 1);
    assert.deepEqual(errors, []);
    await outer.close();
    console.log(`${width}: sandboxed cargo and production confirmation passed`);
  }
} finally {
  await browser.close();
}
