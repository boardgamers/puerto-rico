import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
function fixture() {
  const s = E.init(3, [], {}, "bonus-draft");
  s.tasks = [
    { kind: "bonusAssign", p: 0, remaining: 2 },
    { kind: "role", p: 1 },
  ];
  s.players[0].reserve.w = 2;
  s.players[0].estates = [
    { id: "corn", w: 1, c: 0 },
    { id: "fruit", w: 0, c: 0 },
  ];
  s.players[0].buildings = [{ id: "smallSugar", w: 0, c: 0 }];
  return s;
}
test("bonus placement submits all workers in one move and keeps existing workers fixed", () => {
  const s = fixture();
  const next = E.move(s, { type: "bonusAssignAll", targets: ["e1", "b0"] }, 0);
  assert.equal(next.history.length, s.history.length + 1);
  assert.equal(next.players[0].estates[0].w, 1);
  assert.equal(next.players[0].estates[1].w, 1);
  assert.equal(next.players[0].buildings[0].w, 1);
  assert.equal(next.players[0].reserve.w, 0);
  assert.equal(next.tasks[0].p, 1);
  for (const targets of [["e0", "b0"], ["e1", "e1"], ["e1"], []])
    assert.throws(() => E.move(s, { type: "bonusAssignAll", targets }, 0));
  assert.equal(s.players[0].reserve.w, 2);
});
test("bonus workers without available slots stay in reserve", () => {
  const s = fixture();
  s.players[0].buildings[0].w = 1;
  const next = E.move(s, { type: "bonusAssignAll", targets: ["e1"] }, 0);
  assert.equal(next.players[0].reserve.w, 1);
  assert.equal(next.tasks[0].p, 1);
});
