import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
import * as host from "../bgs/engine.js";

test("completed choices remain undoable until another player acts or new information is revealed", () => {
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
      if (E.canUndo(after, p)) {
        const m = after.history.at(-1).move;
        covered.add(m.type);
        assert.equal(E.canMoveOutOfTurn(after, { type: "undo" }, p), true);
        assert.deepEqual(E.move(after, { type: "undo" }, p), s);
        if (!E.currentPlayers(after).includes(p)) {
          const undone = host.move(after, { type: "undo" }, p);
          assert.equal(host.isLiveUpdate(undone), true);
          const redone = host.move(undone, m, p);
          assert.equal(
            host.isLiveUpdate(redone),
            true,
            `${m.type} must not credit time twice`,
          );
          if (!after.finished) {
            const next = E.moveAI(after);
            if (next.history.at(-1).p !== p)
              assert.equal(E.canUndo(next, p), false);
          }
        }
      } else if (
        s.random !== after.random ||
        JSON.stringify(s.bag) !== JSON.stringify(after.bag)
      )
        blockedDraw = true;
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
