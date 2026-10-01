import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
import { RELEASE } from "../release-config.js";
import { journalContent } from "../viewer/journal.js";
import { translator } from "../viewer/i18n.js";
const text = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

test("preview setup is explained once, while real player draft decisions stay visible", () => {
  let state = E.init(3, RELEASE.expansions, RELEASE.options, "journal");
  while (state.tasks[0].kind === "draft") state = E.moveAI(state);
  const fr = translator("fr");
  const preview = text(journalContent(state, fr, { automatedSetup: true }));
  assert.match(preview, /marché des bâtiments a été préparé automatiquement/);
  assert.match(preview, /Aucun coup joué/);
  assert.doesNotMatch(preview, /Ajout au marché commun/);
  const hosted = text(journalContent(state, fr));
  assert.match(hosted, /Ajout au marché commun/);
  assert.doesNotMatch(hosted, /automatiquement|Aucun coup joué/);
  for (const event of state.events.filter((e) => e.type === "draft")) {
    assert.ok(hosted.includes(fr(event.id)));
  }
});

test("journal tells what was sold, earned, built, shipped and lost in both languages", () => {
  const state = {
    players: [{ name: '<img src=x onerror="alert(1)">' }],
    events: [
      { type: "round", round: 1 },
      { type: "role", p: 0, id: "trader", coins: 2 },
      { type: "trade", p: 0, good: "coffee", coins: 5 },
      { type: "build", p: 0, id: "smallSugar", coins: -1 },
      {
        type: "ship",
        p: 0,
        goods: { sugar: 3 },
        vp: 4,
        shipCapacity: 4,
        shipLoad: 3,
      },
      { type: "store", p: 0, goods: { coffee: 1 }, lost: { corn: 2 } },
    ],
  };
  for (const locale of ["en", "fr"]) {
    const t = translator(locale);
    const html = journalContent(state, t);
    const log = text(html);
    assert.ok(log.includes(t("smallSugar")));
    assert.ok(log.includes(t("journalTrade")));
    assert.ok(log.includes(t("journalLost")));
    assert.match(html, new RegExp(`title="${t("coffee")}"`));
    assert.match(log, /\+5/);
    assert.match(log, /-1/);
    assert.match(log, /3\/4/);
    assert.match(log, /\+4/);
    assert.ok(!html.includes("<img"));
    assert.ok(html.includes("&lt;img"));
  }
});

test("worker allocation logs retain destinations even if estates change later", () => {
  let state = E.init(3, [], {}, "allocation");
  state.players[0].estates = [{ id: "sugar", w: 0, c: 0 }];
  state.players[0].buildings = [{ id: "smallSugar", w: 0, c: 0 }];
  state.players[0].reserve = { w: 2, c: 0 };
  state.role = "recruiter";
  state.tasks = [{ kind: "assign", p: 0 }];
  state = E.move(
    state,
    { type: "assign", estates: [{ w: 1, c: 0 }], buildings: [{ w: 1, c: 0 }] },
    0,
  );
  const event = state.events.find((e) => e.type === "assign");
  assert.deepEqual(
    event.allocation.map((x) => x.id),
    ["sugar", "smallSugar"],
  );
  state.players[0].estates = [];
  const log = text(journalContent(state, translator("fr")));
  assert.match(log, /Sucre/);
  assert.match(log, /Petite sucrerie/);
});
