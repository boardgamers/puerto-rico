import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
function state(supply = 10) {
  const s = E.init(3, [], {}, "recruit-bonus");
  s.role = "recruiter";
  s.owner = 0;
  s.players[0].buildings.push({ id: "publishingHouse", w: 1, c: 0 });
  s.tasks = [
    { kind: "recruitBonus", p: 0, remaining: 2 },
    { kind: "assign", p: 0 },
    { kind: "assign", p: 1 },
  ];
  s.workerSupply = supply;
  return s;
}
test("Publishing House bonus workers are claimed in one move and logged together", () => {
  const s = state(),
    before = s.players[0].reserve.w;
  const m = E.legal(s, 0).find((m) => m.type === "recruitBonus");
  assert.deepEqual(m, { type: "recruitBonus", amount: 2 });
  const next = E.move(s, m, 0);
  assert.equal(next.players[0].reserve.w, before + 2);
  assert.equal(next.workerSupply, s.workerSupply - 2);
  assert.equal(next.history.length, s.history.length + 1);
  assert.equal(
    next.events.findLast((e) => e.type === "recruitBonus").amount,
    2,
  );
  assert.ok(!next.tasks.some((t) => t.kind === "recruitBonus"));
  assert.throws(() => E.move(s, { type: "recruitBonus", amount: 3 }, 0));
});
test("bonus claims respect supply and old one-worker submissions remain valid", () => {
  const s = state();
  const first = E.move(s, { type: "recruitBonus" }, 0);
  assert.equal(first.players[0].reserve.w, s.players[0].reserve.w + 1);
  assert.equal(first.tasks[0].remaining, 1);
  const second = E.move(first, { type: "recruitBonus" }, 0);
  assert.equal(second.players[0].reserve.w, s.players[0].reserve.w + 2);
  const low = state(1);
  assert.deepEqual(
    E.legal(low, 0).find((m) => m.type === "recruitBonus"),
    { type: "recruitBonus" },
  );
  const result = E.move(low, { type: "recruitBonus" }, 0);
  assert.equal(result.workerSupply, 0);
  assert.equal(result.players[0].reserve.w, low.players[0].reserve.w + 1);
});
