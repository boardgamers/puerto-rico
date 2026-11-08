import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
function fixture(remaining = 3) {
  const s = E.init(3, ["smuggler", "citizens"], {}, "poach-draft");
  s.tasks = [
    { kind: "poach", p: 0, remaining },
    { kind: "role", p: 1 },
  ];
  s.register = { w: 5, c: 3 };
  s.discardedPeople = { w: 0, c: 0 };
  s.players[0].estates = [
    { id: "corn", w: 1, c: 0 },
    { id: "fruit", w: 0, c: 0 },
    { id: "forest", w: 0, c: 0 },
  ];
  s.players[0].buildings = [{ id: "largeSugar", w: 0, c: 1 }];
  return s;
}
const w = (target) => ({ kind: "w", target });
const c = (target) => ({ kind: "c", target });
const move = (s, placements) => E.move(s, { type: "poachAll", placements }, 0);
test("poach batch is atomic, keeps incumbents, and leaves mixed surplus discard separate", () => {
  const s = fixture();
  const n = move(s, [c("e1"), w("b0"), c("b0")]);
  assert.equal(n.history.length, s.history.length + 1);
  assert.deepEqual(n.register, { w: 4, c: 1 });
  assert.deepEqual(n.players[0].buildings[0], { id: "largeSugar", w: 1, c: 2 });
  assert.equal(n.players[0].estates[0].w, 1);
  assert.equal(n.tasks[0].kind, "poachDiscard");
  assert.deepEqual(n.discardedPeople, { w: 0, c: 0 });
  assert.equal(n.events.filter((e) => e.type === "poachWorker").length, 3);
});
test("poach may stop early or take none; legacy individual placement still works", () => {
  for (const placements of [[], [w("e1")]]) {
    const n = move(fixture(), placements);
    assert.equal(n.tasks[0].kind, "poachDiscard");
  }
  const s = E.move(fixture(), { type: "poachWorker", ...w("e1") }, 0);
  assert.equal(s.tasks[0].remaining, 2);
  assert.equal(move(s, [c("b0")]).tasks[0].kind, "poachDiscard");
});
test("poach rejects malformed, over-cap, unavailable, occupied and overflowing drafts without mutation", () => {
  const s = fixture();
  for (const placements of [
    null,
    {},
    [null],
    [{ kind: "x", target: "e1" }],
    [w("reserve")],
    [w("e99")],
    [w("e2")],
    [w("e0")],
    [w("e1"), c("e1")],
    [w("b0"), w("b0"), w("b0")],
    [w("e1"), w("b0"), w("b0"), w("b0")],
  ]) {
    const before = structuredClone(s);
    assert.throws(() => move(s, placements));
    assert.deepEqual(s, before);
  }
  assert.throws(() => move(fixture(1), [w("e1"), w("b0")]));
  s.register = { w: 7, c: 1 };
  assert.throws(() => move(s, [c("e1"), c("b0")]));
  s.register = { w: 2, c: 2 };
  assert.throws(() => move(s, [w("e1"), c("b0")]));
  const n = move(s, [c("e1")]);
  assert.equal(n.tasks[0].kind, "role");
  assert.deepEqual(n.register, { w: 2, c: 1 });
});
