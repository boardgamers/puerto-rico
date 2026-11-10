import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";

// Only the current frame carries edit affordances; older views are read-only.
function historicalView(state, player, current = false) {
  const view = E.stripSecret(state, player);
  if (!current) {
    view.canEditPlacement = false;
    view.canEditProduction = false;
  }
  return view;
}

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test("replay and log frames own their data and preserve live metadata at every boundary", () => {
  let s = E.init(3, [], {}, "replay-ownership");
  for (let i = 0; i < 40; i++) s = E.moveAI(s);
  s = E.setPlayerMetaData(s, 0, { name: "Renamed" });
  s = E.dropPlayer(s, 1);
  s = E.setPlayerSettings(s, 2, { autoForcedActions: true, autoStore: true });
  const before = structuredClone(s);
  freeze(s);
  const n = E.logLength(s);
  const replayed = E.replay(s);
  assert.deepEqual(replayed, s);
  const frames = E.logSlice(s, { player: 0, start: n - 3, end: n + 5 }).frames;
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(
      frames[i],
      historicalView(E.replay(s, n - 2 + i), 0, i === 2),
    );
    assert.equal(frames[i].players[0].name, "Renamed");
    assert.equal(frames[i].players[1].bot, true);
    assert.deepEqual(frames[i].players[2].settings, s.players[2].settings);
    for (const key of ["history", "config", "random", "bag", "discard"])
      assert.equal(frames[i][key], undefined);
  }
  const untouchedFrame = structuredClone(frames[1]);
  frames[0].players[0].name = "Mutated view";
  frames[0].players[2].settings.autoStore = false;
  frames[0].events.splice(0);
  assert.deepEqual(frames[1], untouchedFrame);
  replayed.history[0].move.type = "mutated";
  replayed.history.push({ p: 0, move: { type: "bad" } });
  replayed.players[2].settings.autoStore = false;
  replayed.config.options.mutated = true;
  assert.deepEqual(s, before);
  assert.deepEqual(E.replay(s), before);

  // Ordinary public moves must not reuse the private replay optimization.
  const initial = freeze(E.init(3, [], {}, "public-move-ownership"));
  const chosen = freeze(E.move(initial, { type: "role", id: "builder" }, 0));
  const after = E.move(chosen, { type: "pass" }, 0);
  after.history[0].move.id = "mutated";
  assert.equal(chosen.history[0].move.id, "builder");
  const undone = E.move(chosen, { type: "undo" }, 0);
  assert.deepEqual(E.currentPlayers(undone), E.currentPlayers(chosen));
  undone.players[0].name = "Independent undo";
  assert.notEqual(initial.players[0].name, undone.players[0].name);
});
