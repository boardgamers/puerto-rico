import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";

function fixture(tasks) {
  const s = E.init(3, [], {}, "forced-actions");
  s.players.forEach((p) => (p.settings = { autoForcedActions: true }));
  s.production = s.players.map(() => ({
    corn: 0,
    fruit: 0,
    sugar: 0,
    tobacco: 0,
    coffee: 0,
  }));
  s.shipped = structuredClone(s.production);
  s.tasks = [{ kind: "recruitBonus", p: 0, remaining: 1 }, ...tasks];
  return s;
}
const start = (s) => E.move(s, { type: "pass" }, 0);
const boundary = { kind: "role", p: 0 };

test("single-type recruitment distributes automatically, preserving turn order and journal", () => {
  const s = fixture([{ kind: "recruit", p: 1 }, boundary]);
  s.register = { w: 4, c: 0 };
  const before = s.players.map((p) => p.reserve.w);
  const r = start(s);
  assert.equal(r.tasks[0].kind, "role");
  assert.deepEqual(
    r.players.map((p, i) => p.reserve.w - before[i]),
    [1, 2, 1],
  );
  assert.deepEqual(
    r.history.slice(-4).map((h) => h.p),
    [1, 2, 0, 1],
  );
  assert.equal(s.register.w, 4);
});

test("mixed recruitment and optional recruiter privilege remain choices", () => {
  const s = fixture([{ kind: "recruit", p: 0 }, boundary]);
  assert(E.legal(s).some((m) => m.type === "recruitBonus"));
  assert(E.legal(s).some((m) => m.type === "pass"));
  s.register = { w: 1, c: 1 };
  const r = start(s);
  assert.equal(r.tasks[0].kind, "recruit");
  assert.equal(E.legal(r).length, 2);
});

test("empty trade, production, assignment and storage need no confirmation", () => {
  const s = fixture(
    ["trade", "produce", "assign", "store"]
      .map((kind) => ({ kind, p: 0 }))
      .concat(boundary),
  );
  s.players[0].reserve = { w: 0, c: 0 };
  s.players[0].estates.forEach((e) => {
    e.w = 0;
    e.c = 0;
  });
  const r = start(s);
  assert.equal(r.tasks[0].kind, "role");
  assert.deepEqual(
    r.history.slice(1).map((h) => h.move.type),
    ["pass", "produce", "assign"],
  );
});

test("suggested assignment, production and storage do not hide custom choices", () => {
  for (const kind of ["assign", "produce", "store"]) {
    const s = fixture([{ kind, p: 0 }, boundary]);
    s.players[0].estates = [
      { id: "corn", w: 1, c: 0 },
      { id: "fruit", w: 0, c: 0 },
    ];
    s.players[0].goods.corn = 2;
    const r = start(s);
    assert.equal(r.tasks[0].kind, kind);
  }
});

test("an optional Chapel point is kept even with no production", () => {
  const s = fixture([{ kind: "produce", p: 0 }, boundary]);
  s.players[0].estates = [];
  s.players[0].buildings = [{ id: "chapel", w: 0, c: 1 }];
  const r = start(s);
  assert.equal(r.tasks[0].kind, "produce");
  assert(E.legal(r).some((m) => m.decline?.includes("chapel")));
});

test("a forced public shipment executes but an optional Harbor point keeps the choice", () => {
  for (const harbor of [false, true]) {
    const s = fixture([{ kind: "ship", p: 0 }, boundary]);
    s.role = "captain";
    s.owner = 0;
    s.shipPasses = 0;
    s.ships = [
      { capacity: 4, good: "corn", amount: 2 },
      { capacity: 5, good: "sugar", amount: 5 },
      { capacity: 6, good: "coffee", amount: 6 },
    ];
    s.players[0].goods.corn = 1;
    if (harbor) s.players[0].buildings = [{ id: "harbor", w: 1, c: 0 }];
    const r = start(s);
    if (harbor) {
      assert.equal(r.tasks[0].kind, "ship");
      assert.equal(r.players[0].goods.corn, 1);
    } else {
      assert.equal(r.players[0].goods.corn, 0);
      assert(r.history.some((h) => h.move.type === "ship"));
    }
  }
});

test("automatic steps replay exactly, including intermediate log frames", () => {
  let s = E.init(3, [], {}, "forced-replay");
  s.players.forEach((p) => (p.settings = { autoForcedActions: true }));
  s = E.move(s, { type: "role", id: "recruiter" }, 0);
  s = E.move(s, { type: "recruitBonus" }, 0);
  assert(s.history.some((h) => h.move.type === "recruit"));
  assert.deepEqual(E.replay(s), s);
  for (let to = 1; to <= E.logLength(s); to++) {
    assert.equal(E.replay(s, to).history.length, to - 1);
  }
  assert.equal(E.logSlice(s, { player: 0 }).frames.length, E.logLength(s));
});

test("surplus discard resolves only when the remaining people are interchangeable", () => {
  for (const mixed of [false, true]) {
    const s = fixture([{ kind: "poachDiscard", p: 0 }, boundary]);
    s.register = { w: 5, c: mixed ? 1 : 0 };
    s.discardedPeople = { w: 0, c: 0 };
    const r = start(s);
    assert.equal(r.tasks[0].kind, mixed ? "poachDiscard" : "role");
    if (!mixed) assert.equal(r.register.w, 3);
  }
});

test("Bohío alternatives prevent automatically passing a blocked trade", () => {
  const s = fixture([{ kind: "trade", p: 0 }, boundary]);
  s.players[0].buildings = [{ id: "bohio", w: 1, c: 0 }];
  s.players[0].estates = [{ id: "corn", w: 0, c: 0 }];
  const r = start(s);
  assert.equal(r.tasks[0].kind, "trade");
  assert(E.legal(r).some((m) => m.type === "bohio"));
});

test("interchangeable plantation placements are automatic, strategic alternatives remain", () => {
  for (const variant of [
    "single",
    "same",
    "different",
    "mixedPeople",
    "building",
  ]) {
    const s = fixture([{ kind: "assign", p: 0 }, boundary]);
    s.players[0].estates = [{ id: "corn", w: 0, c: 0 }];
    if (variant !== "single")
      s.players[0].estates.push({
        id: variant === "different" ? "fruit" : "corn",
        w: 0,
        c: 0,
      });
    s.players[0].reserve = { w: 1, c: variant === "mixedPeople" ? 1 : 0 };
    if (variant === "building")
      s.players[0].buildings = [{ id: "smallMarket", w: 0, c: 0 }];
    const r = start(s);
    assert.equal(
      r.tasks[0].kind,
      ["single", "same"].includes(variant) ? "role" : "assign",
    );
    if (["single", "same"].includes(variant))
      assert.equal(
        r.players[0].estates.reduce((n, e) => n + e.w, 0),
        1,
      );
  }
});

test("forced actions default off, including states with the old global option", () => {
  const s = fixture([{ kind: "trade", p: 0 }, boundary]);
  s.players.forEach((p) => delete p.settings);
  s.options.autoForcedActions = true;
  assert.deepEqual(E.playerSettings(s, 0), { autoForcedActions: false });
  assert.equal(start(s).tasks[0].kind, "trade");
});

test("settings only persist preferences; ordinary moves resolve opted-in forced actions", () => {
  const s = fixture([
    { kind: "trade", p: 0 },
    { kind: "trade", p: 0 },
    { kind: "trade", p: 1 },
    boundary,
  ]);
  s.players.forEach((p) => delete p.settings);
  const waiting = start(s);
  const optedIn = E.setPlayerSettings(waiting, 0, { autoForcedActions: true });
  const expected = structuredClone(waiting);
  expected.players[0].settings = { autoForcedActions: true };
  assert.deepEqual(optedIn, expected);
  assert.equal(waiting.players[0].settings, undefined);
  const advanced = E.move(optedIn, { type: "pass" }, 0);
  assert.equal(advanced.tasks[0].p, 1);
  assert.equal(advanced.tasks[0].kind, "trade");
  assert.equal(advanced.history.length, optedIn.history.length + 2);
  assert.deepEqual(optedIn, expected);
  assert.deepEqual(E.playerSettings(optedIn, 1), { autoForcedActions: false });
  const off = E.setPlayerSettings(optedIn, 0, { autoForcedActions: false });
  assert.equal(E.playerSettings(off, 0).autoForcedActions, false);
  assert.equal(
    E.playerSettings(
      E.setPlayerSettings(off, 0, { autoForcedActions: "true" }),
      0,
    ).autoForcedActions,
    false,
  );
  assert.throws(() => E.setPlayerSettings(off, -1, {}));
});

test("empty storage skips without opting in, but nonempty storage still waits", () => {
  for (const goods of [0, 1, 2]) {
    const s = fixture([{ kind: "store", p: 0 }, boundary]);
    s.players.forEach((p) => delete p.settings);
    s.players[0].goods.corn = goods;
    const r = start(s);
    assert.equal(r.tasks[0].kind, goods ? "store" : "role");
    assert.equal(r.players[0].goods.corn, goods);
    assert.equal(r.history.length, s.history.length + 1);
  }
});

test("an already waiting empty storage step normalizes without changing the input", () => {
  const s = fixture([{ kind: "store", p: 0 }, boundary]);
  s.tasks.shift();
  s.players.forEach((p) => delete p.settings);
  const r = E.resolveForcedActions(s);
  assert.equal(r.tasks[0].kind, "role");
  assert.equal(s.tasks[0].kind, "store");
  assert.deepEqual(r.history, s.history);
});

test("Captain keeps each first turn but skips later pass-only turns without opting in", () => {
  let s = E.init(3, [], {}, "captain-repeat-pass");
  s.players[0].goods.corn = 1;
  s.players[0].goods.sugar = 1;
  s = E.move(s, { type: "role", id: "captain" }, 0);
  s = E.move(
    s,
    E.legal(s).find((m) => m.type === "ship" && m.good === "corn"),
    0,
  );
  assert.equal(E.currentPlayer(s), 1);
  assert.deepEqual(E.legal(s), [{ type: "pass" }]);
  s = E.move(s, { type: "pass" }, 1);
  assert.equal(E.currentPlayer(s), 2);
  s = E.move(s, { type: "pass" }, 2);
  assert.equal(E.currentPlayer(s), 0);
  s = E.move(
    s,
    E.legal(s).find((m) => m.type === "ship" && m.good === "sugar"),
    0,
  );
  assert.equal(s.tasks[0].kind, "role");
  assert.deepEqual(
    s.history.slice(-3).map((h) => [h.p, h.move.type]),
    [
      [1, "pass"],
      [2, "pass"],
      [0, "pass"],
    ],
  );
});

test("empty Captain first pass remains manual, including the role chooser", () => {
  let s = E.init(3, [], {}, "captain-first-pass");
  s = E.move(s, { type: "role", id: "captain" }, 0);
  for (let p = 0; p < 3; p++) {
    assert.equal(E.currentPlayer(s), p);
    assert.equal(s.tasks[0].kind, "ship");
    s = E.move(s, { type: "pass" }, p);
  }
  assert.equal(s.tasks[0].kind, "role");
  assert.deepEqual(E.replay(s), s);
});

test("Trader skips its redundant finish but keeps the next player's first pass", () => {
  let s = E.init(3, [], {}, "trader-repeat-pass");
  s.players[0].goods.corn = 1;
  s = E.move(s, { type: "role", id: "trader" }, 0);
  s = E.move(
    s,
    E.legal(s).find((m) => m.type === "trade"),
    0,
  );
  assert.equal(E.currentPlayer(s), 1);
  assert.deepEqual(
    s.history.slice(-2).map((h) => h.move.type),
    ["trade", "pass"],
  );
  assert.deepEqual(E.legal(s), [{ type: "pass" }]);
});

test("a new role resets acknowledgement and Bohío alternatives remain manual", () => {
  let s = E.init(3, [], {}, "role-pass-boundary");
  s = E.move(s, { type: "role", id: "trader" }, 0);
  s = E.move(s, { type: "pass" }, 0);
  s = E.move(s, { type: "pass" }, 1);
  s = E.move(s, { type: "pass" }, 2);
  s = E.move(s, { type: "role", id: "captain" }, E.currentPlayer(s));
  assert.equal(s.tasks[0].kind, "ship");
  const p = E.currentPlayer(s);
  s.players[p].buildings = [{ id: "bohio", w: 1, c: 0 }];
  s.players[p].estates = [{ id: "corn", w: 0, c: 0 }];
  s.history.push({ p, move: { type: "pass" } });
  const resolved = E.resolveForcedActions(s);
  assert.equal(resolved.history.length, s.history.length);
  assert(E.legal(resolved).some((m) => m.type === "bohio"));
});
