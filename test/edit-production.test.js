import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
import * as host from "../bgs/engine.js";
function fixture() {
  let s = E.init(3, [], {}, "production-edit");
  s = E.move(s, { type: "role", id: "recruiter" }, 0);
  s = E.move(s, { type: "recruitBonus" }, 0);
  while (s.tasks[0].kind === "assign") {
    const p = E.currentPlayer(s);
    s = E.move(s, { type: "assign", ...E.autoAssignment(s, p) }, p);
  }
  s = E.move(s, { type: "role", id: "trader" }, 1);
  while (s.tasks[0].kind !== "role")
    s = E.move(s, { type: "pass" }, E.currentPlayer(s));
  return E.move(s, { type: "role", id: "craftsman" }, 2);
}
const produce = (s, p) =>
  E.move(
    s,
    E.legal(s, p).find((m) => m.type === "produce"),
    p,
  );
test("early production can be edited without retracting another producer's choice", () => {
  const start = fixture();
  let s = produce(start, 1);
  s = produce(s, 0);
  assert.equal(E.canUndo(s, 1), false);
  assert.equal(E.canEditProduction(s, 1), true);
  const edited = E.move(s, { type: "editProduction" }, 1);
  assert.deepEqual(edited.players[0], s.players[0]);
  assert.deepEqual(edited.players[1], start.players[1]);
  assert.equal(edited.history.length, s.history.length - 1);
  assert.deepEqual(E.replay(edited), edited);
});
test("early Craftsman bonus is editable and re-confirmation adds no time", () => {
  let s = produce(fixture(), 2);
  s = host.move(s, { type: "produceBonus", good: "corn" }, 2);
  s = produce(s, 0);
  assert.equal(E.canUndo(s, 2), false);
  assert.equal(E.canEditProduction(s, 2), true);
  const edited = host.move(s, { type: "editProduction" }, 2);
  assert.equal(host.isLiveUpdate(edited), true);
  assert.deepEqual(edited.players[0], s.players[0]);
  assert.equal(E.stripSecret(edited, 2).tasks[0].kind, "produceBonus");
  const confirmed = host.move(
    edited,
    { type: "produceBonus", good: "corn" },
    2,
  );
  assert.equal(host.isLiveUpdate(confirmed), true);
  const finished = produce(confirmed, 1);
  assert.equal(E.canEditProduction(finished, 2), false);
  assert.throws(() => E.move(finished, { type: "editProduction" }, 2));
});
