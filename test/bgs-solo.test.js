import test from "node:test";
import assert from "node:assert/strict";
import * as host from "../bgs/engine.js";
import * as game from "../engine/index.js";
import { RELEASE } from "../release-config.js";
import { readFileSync } from "node:fs";

test("platform advertises 1–5 players; one participant gets two normal Puertomas", () => {
  const metadata = JSON.parse(
    readFileSync(new URL("../bgs/game.json", import.meta.url)),
  );
  assert.deepEqual(metadata.players, [1, 2, 3, 4, 5]);
  const s = host.init(1, [], {}, "host-solo");
  assert.equal(s.players.length, 3);
  assert.deepEqual(
    s.players.slice(1).map((p) => p.name),
    ["Puertoma 1", "Puertoma 2"],
  );
  assert(s.players.slice(1).every((p) => p.bot && p.puertoma));
  assert.equal(s.puertoma.difficulty, "normal");
  assert.equal(host.currentPlayer(s), 0);
  assert.equal(host.scores(s).length, 1);
  assert.equal(host.rankings(s).length, 1);
  assert.equal(s.tasks[0].kind, "achievementChoose");
  assert.equal(game.stripSecret(s, 0).players[0].achievementOffer.length, 6);
  assert.throws(() => host.moveAI(s, 1));
  assert.throws(() => host.setPlayerMetaData(s, 1, { name: "Human" }));
});
test("a hosted solo game always returns to the human and fully replays virtual turns", () => {
  let s = host.init(1, [], {}, "host-solo-complete");
  s = host.setPlayerMetaData(s, 0, { name: "Alice" });
  const initial = structuredClone(s);
  let actions = 0;
  while (!host.ended(s) && actions++ < 1500) {
    assert.equal(host.currentPlayer(s), 0);
    assert(host.legal(s, 0).length);
    const input = s,
      before = structuredClone(s),
      m = game.chooseAI(s, 0);
    s = host.move(s, m, 0);
    assert.deepEqual(input, before);
    if (actions === 10) assert.deepEqual(before, host.replay(before));
    assert.equal(host.scores(s).length, 1);
  }
  assert(host.ended(s));
  assert(s.history.some((h) => h.p === 1));
  assert(s.history.some((h) => h.p === 2));
  assert.deepEqual(host.replay(s), s);
  const botPosition = s.history.findIndex((h) => h.p === 1) + 1;
  const sandbox = host.createAnalysis(s, { to: botPosition });
  assert.equal(host.currentPlayer(sandbox), 0);
  assert(sandbox.players.slice(1).every((p) => p.bot));
  assert.equal(host.scores(sandbox).length, 1);
  assert.deepEqual(host.rankings(s), [game.rankings(s)[0]]);
  const all = game.stripSecret(s, 0);
  assert.equal(all.results.length, 3);
  const frame = host.logSlice(s, { player: 0, start: 0, end: 0 }).frames[0];
  assert.equal(frame.players.length, 3);
  assert.equal(frame.players[0].name, "Alice");
  assert.equal(frame.puertoma.deck, undefined);
  assert.deepEqual(initial, host.replay(initial));
});
test("multiplayer creation and moves keep the existing human rules and result counts", () => {
  for (const n of [2, 3, 4, 5]) {
    const s = host.init(n, [], {}, `host-multi-${n}`);
    assert.deepEqual(
      s,
      game.init(n, RELEASE.expansions, RELEASE.options, `host-multi-${n}`),
    );
    assert.equal(s.puertoma, undefined);
    assert.equal(host.scores(s).length, n);
    assert.equal(host.rankings(s).length, n);
    assert.deepEqual(host.moveAI(s), game.moveAI(s));
  }
});
test("older multiplayer saves still use their original configuration", () => {
  let s = game.init(3, ["smuggler"], {}, "old-save");
  s = game.moveAI(s);
  assert.deepEqual(host.moveAI(s), game.moveAI(s));
  assert.equal(host.scores(s).length, 3);
});
