import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";

test("undo never restores an earlier turn after a completed action", () => {
  let s = E.init(3, ["smuggler"], {}, "undo-handoffs");
  const covered = new Set();
  let blockedDraw = false;
  for (let i = 0; i < 350 && !s.finished; i++) {
    const p = E.currentPlayer(s);
    const after = E.moveAI(s);
    if (
      after.history.length === s.history.length + 1 &&
      JSON.stringify(s.bag) !== JSON.stringify(after.bag)
    ) {
      assert.equal(
        E.canUndo(after, p),
        false,
        "drawing from a shuffled bag reveals information",
      );
      if (s.random === after.random) blockedDraw = true;
    }
    if (
      !covered.has(after.history.at(-1)?.move.type) &&
      after.history.length === s.history.length + 1 &&
      E.currentPlayer(after) !== p
    ) {
      const type = after.history.at(-1).move.type;
      if (
        JSON.stringify(E.currentPlayers(s).slice().sort()) !==
        JSON.stringify(E.currentPlayers(after).slice().sort())
      ) {
        covered.add(type);
        assert.equal(
          E.canUndo(after, p),
          false,
          `${type} cannot change active players`,
        );
        assert.throws(() => E.move(after, { type: "undo" }, p));
      }
    }

    s = after;
  }
  for (const type of [
    "plant",
    "produce",
    "produceBonus",
    "build",
    "ship",
    "store",
    "hospital",
    "pass",
  ])
    assert.ok(covered.has(type), `covered ${type}`);
  assert.equal(blockedDraw, true, "plantation draws still prevent undo");
});
