import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
import { RELEASE } from "../release-config.js";
import { tokenSources, scoreContent } from "../viewer/score.js";
import { translator } from "../viewer/i18n.js";

function fixture() {
  const s = E.init(3, RELEASE.expansions, RELEASE.options, "score-ui");
  s.players[0].vp = 11;
  s.events = [
    { p: 0, round: 1, type: "ship", goods: { corn: 3 }, vp: 5 },
    { p: 0, round: 1, type: "smallWharf", goods: { corn: 1, sugar: 2 }, vp: 2 },
    { p: 0, round: 1, type: "festival", id: "farming", reward: { vp: 3 } },
    { p: 0, round: 2, type: "pass", phase: "produce", vp: 1 },
    { p: 0, round: 2, type: "build", id: "smallSugar", vp: 1, point: 1 },
    { p: 1, round: 2, type: "ship", goods: { corn: 9 }, vp: 9 },
  ];
  return s;
}

test("earned points reconcile shipping bonuses, festival rewards and spent tokens", () => {
  assert.deepEqual(tokenSources(fixture(), 0), [
    { id: "scoreShipping", points: 4 },
    { id: "scoreShippingBonus", points: 3 },
    { id: "farming", points: 3 },
    { id: "chapel", points: 1 },
    { id: "church", points: 1 },
    { id: "hiddenMarket", points: -1 },
  ]);
});

test("score details use the canonical score and count only completed achievements", () => {
  const s = fixture();
  s.players[0].buildings = [
    { id: "monument", w: 0, c: 0 },
    { id: "customsHouse", w: 1, c: 0 },
  ];
  s.players[0].reserve.c = 2;
  s.players[0].achievements = [
    { id: "bigSpender", completed: true },
    { id: "dealCloser", completed: false },
  ];
  const r = E.scoreBreakdown(s, 0);
  for (const locale of ["en", "fr"]) {
    const t = translator(locale);
    const html = scoreContent(E.stripSecret(s, 0), 0, t);
    assert.ok(html.includes(`aria-label="${r.total} ${t("vp")}"`));
    assert.ok(html.includes(t("scoreEstimateTotal")));
    assert.ok(html.includes(t("customsHouse")));
    assert.ok(!html.includes("Négociateur"));
    assert.ok(!html.includes("Deal Closer"));
  }
});

test("hidden VP totals are not reconstructed from public history", () => {
  const s = E.stripSecret(fixture(), 1);
  assert.deepEqual(tokenSources(s, 0), []);
  assert.equal(
    scoreContent(s, 0, translator("fr")),
    `<p>${translator("fr")("scoreHidden")}</p>`,
  );
});

test("incomplete history is labelled without inventing a source", () => {
  const s = fixture();
  s.events = [];
  assert.deepEqual(tokenSources(s, 0), [{ id: "scoreUnrecorded", points: 11 }]);
});

test("full games account for every earned token, including Puertoma rewards", () => {
  for (const options of [
    RELEASE.options,
    { ...RELEASE.options, puertoma: { humans: 1, difficulty: "normal" } },
  ]) {
    let s = E.init(3, RELEASE.expansions, options, "score-audit");
    while (!s.finished) s = E.moveAI(s);
    for (let p = 0; p < s.players.length; p++) {
      const sources = tokenSources(s, p);
      assert.ok(!sources.some((x) => x.id === "scoreUnrecorded"));
      assert.equal(
        sources.reduce((n, x) => n + x.points, 0),
        s.players[p].vp,
      );
      const html = scoreContent(E.stripSecret(s, p), p, translator("fr"));
      assert.ok(html.includes("Total final"));
      assert.ok(!html.includes("undefined"));
    }
  }
});
