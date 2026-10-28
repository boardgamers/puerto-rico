import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
function recruit() {
  let s = E.init(3, [], {}, "parallel");
  s = E.move(s, { type: "role", id: "recruiter" }, 0);
  return E.move(s, { type: "recruitBonus" }, 0);
}
test("forced recruitment finishes without a preference and placements may arrive in any order", () => {
  let s = recruit();
  assert.deepEqual(E.currentPlayers(s), [0, 1, 2]);
  assert.equal(E.stripSecret(s, 2).tasks[0].p, 2);
  s = E.move(s, { type: "assign", ...E.autoAssignment(s, 2) }, 2);
  assert.deepEqual(E.currentPlayers(s), [0, 1]);
  assert.throws(() =>
    E.move(s, { type: "assign", ...E.autoAssignment(s, 2) }, 2),
  );
  s = E.move(s, { type: "assign", ...E.autoAssignment(s, 0) }, 0);
  s = E.move(s, { type: "assign", ...E.autoAssignment(s, 1) }, 1);
  assert.deepEqual(E.replay(s), s);
});
test("only an unforced later player may request ordered remaining placement", () => {
  let s = recruit();
  assert.ok(!E.legal(s, 2).some((m) => m.type === "orderedPlacement"));
  s.players[2].estates.push({ id: "sugar", w: 0, c: 0 });
  assert.ok(E.legal(s, 2).some((m) => m.type === "orderedPlacement"));
  s = E.move(s, { type: "orderedPlacement" }, 2);
  assert.deepEqual(E.currentPlayers(s), [0]);
  assert.throws(() =>
    E.move(s, { type: "assign", ...E.autoAssignment(s, 2) }, 2),
  );
  s = E.move(s, { type: "assign", ...E.autoAssignment(s, 0) }, 0);
  assert.deepEqual(E.currentPlayers(s), [1]);
  s = E.move(s, { type: "assign", ...E.autoAssignment(s, 1) }, 1);
  assert.deepEqual(E.currentPlayers(s), [2]);
});
test("Smuggler selection can be undone before handing control away, without growing history", () => {
  const start = E.init(3, ["smuggler"], {}, "undo-smuggler");
  let s = E.move(start, { type: "role", id: "smuggler" }, 0);
  assert.equal(E.canUndo(s, 0), true);
  assert.equal(E.canUndo(s, 1), false);
  for (let i = 0; i < 10; i++) {
    s = E.move(s, { type: "undo" }, 0);
    assert.deepEqual(s, start);
    s = E.move(s, { type: "role", id: "smuggler" }, 0);
    assert.equal(s.history.length, 1);
  }
});

test("production and storage automation are opt-in and storage never chooses which goods to discard", () => {
  let s = E.init(3, [], {}, "automatic-goods");
  s.production = s.players.map(() => ({
    corn: 0,
    fruit: 0,
    sugar: 0,
    tobacco: 0,
    coffee: 0,
  }));
  s.role = "craftsman";
  s.owner = 0;
  s.tasks = [
    { kind: "produce", p: 0 },
    { kind: "role", p: 1 },
  ];
  s.players[0].estates = [{ id: "corn", w: 1, c: 0 }];
  assert.equal(E.resolveForcedActions(s).tasks[0].kind, "produce");
  s = E.setPlayerSettings(s, 0, { autoProduce: true });
  const produced = E.resolveForcedActions(s);
  assert.equal(produced.players[0].goods.corn, s.players[0].goods.corn + 1);
  assert.equal(produced.tasks[0].kind, "role");
  s.tasks = [
    { kind: "store", p: 0 },
    { kind: "role", p: 1 },
  ];
  s.players[0].goods = { corn: 1, fruit: 0, sugar: 0, tobacco: 0, coffee: 0 };
  assert.equal(E.resolveForcedActions(s).tasks[0].kind, "store");
  s = E.setPlayerSettings(s, 0, { autoStore: true });
  assert.equal(E.playerSettings(s, 0).autoProduce, true);
  assert.equal(E.resolveForcedActions(s).tasks[0].kind, "role");
  s.players[0].goods.fruit = 1;
  assert.equal(E.resolveForcedActions(s).tasks[0].kind, "store");
});

test("Builder selection can be undone before purchase", () => {
  const s = E.init(3, [], {}, "undo-builder");
  const chosen = E.move(s, { type: "role", id: "builder" }, 0);
  assert.equal(E.canUndo(chosen, 0), true);
  assert.deepEqual(E.move(chosen, { type: "undo" }, 0), s);
});

test("BGS supports undo after choosing every available role, without a clock increment", async () => {
  const host = await import("../bgs/engine.js");
  const start = host.init(3, [], {}, "undo-all-roles");
  for (const role of host.legal(start, 0).filter((m) => m.type === "role")) {
    const chosen = host.move(start, role, 0);
    assert.equal(host.canUndo(chosen, 0), true, role.id);
    const undone = host.move(chosen, { type: "undo" }, 0);
    assert.equal(host.isLiveUpdate(undone), true);
    assert.equal(host.stripSecret(undone, 0).liveUndo, undefined);
    const { liveUndo, ...position } = undone;
    assert.deepEqual(position, start, role.id);
    assert.equal(host.isLiveUpdate(host.move(undone, role, 0)), false);
  }
});

test("BGS currentPlayer exposes every simultaneous placement seat", async () => {
  const host = await import("../bgs/engine.js");
  const s = recruit();
  assert.deepEqual(host.currentPlayer(s), [0, 1, 2]);
});

test("a later seat can withdraw its placement without undoing another seat", () => {
  const start = recruit();
  let s = E.move(start, { type: "assign", ...E.autoAssignment(start, 1) }, 1);
  s = E.move(s, { type: "assign", ...E.autoAssignment(s, 2) }, 2);
  assert.equal(E.canUndo(s, 1), true);
  assert.equal(E.canMoveOutOfTurn(s, { type: "undo" }, 1), true);
  const restored = E.move(s, { type: "undo" }, 1);
  assert.deepEqual(restored.players[1], start.players[1]);
  assert.deepEqual(restored.players[2], s.players[2]);
  assert.deepEqual(E.currentPlayers(restored), [0, 1]);
  assert.equal(restored.history.length, s.history.length - 1);
  assert.deepEqual(E.replay(restored), restored);
  assert.equal(E.canUndo(restored, 1), false);
  const firstDone = E.move(
    restored,
    { type: "assign", ...E.autoAssignment(restored, 0) },
    0,
  );
  assert.equal(E.canUndo(firstDone, 2), true, "seat 1 still precedes seat 2");
  const finished = E.move(
    firstDone,
    { type: "assign", ...E.autoAssignment(firstDone, 1) },
    1,
  );
  assert.equal(E.canUndo(finished, 2), false);
});

test("an earlier seat cannot withdraw after only later seats remain", () => {
  const start = recruit();
  const s = E.move(start, { type: "assign", ...E.autoAssignment(start, 0) }, 0);
  assert.equal(E.canUndo(s, 0), false);
  assert.equal(E.canMoveOutOfTurn(s, { type: "undo" }, 0), false);
  assert.throws(() => E.move(s, { type: "undo" }, 0));
});

test("withdrawing and re-confirming placement do not award another clock increment", async () => {
  const host = await import("../bgs/engine.js");
  let s = recruit();
  for (let i = 0; i < 3; i++) {
    s = host.move(s, { type: "assign", ...E.autoAssignment(s, 2) }, 2);
    assert.equal(host.isLiveUpdate(s), i > 0);
    s = host.move(s, { type: "undo" }, 2);
    assert.equal(host.isLiveUpdate(s), true);
    assert.deepEqual(s.undoResubmitSeats, [2]);
    assert.equal(host.stripSecret(s, 2).undoResubmitSeats, undefined);
  }
  assert.equal(s.history.length, recruit().history.length);
});

test("placement undo never retracts a revealed achievement or Festival reward", () => {
  const start = recruit();
  const s = E.move(start, { type: "assign", ...E.autoAssignment(start, 2) }, 2);
  s.players[2].achievements = [{ id: "revealed", completed: true }];
  assert.equal(E.canUndo(s, 2), false);
  s.players[2].achievements = [];
  s.festivals = [{ id: "claimed", claimed: 2 }];
  assert.equal(E.canUndo(s, 2), false);
});
