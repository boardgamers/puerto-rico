import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
import * as host from "../bgs/engine.js";
function fixture() {
  const s = E.init(3, [], {}, "parallel-output");
  s.role = "craftsman";
  s.owner = 0;
  s.tasks = [0, 1, 2].map((p) => ({ kind: "produce", p }));
  s.tasks.push(
    { kind: "produceBonus", p: 0, remaining: 1 },
    { kind: "phaseEnd" },
  );
  s.production = s.players.map(() => ({
    corn: 0,
    fruit: 0,
    sugar: 0,
    tobacco: 0,
    coffee: 0,
  }));
  s.players.forEach((p) => {
    p.estates = [{ id: "corn", w: 1, c: 0 }];
    p.buildings = [];
  });
  s.festivals = [];
  return s;
}
const produce = (s, p) =>
  E.move(
    s,
    E.legal(s, p).find((m) => m.type === "produce"),
    p,
  );
test("production and the chooser's bonus can run concurrently without changing outcomes", () => {
  const start = fixture();
  assert.deepEqual(E.currentPlayers(start), [0, 1, 2]);
  assert.deepEqual(host.currentPlayer(start), [0, 1, 2]);
  let early = produce(start, 0);
  assert.deepEqual(E.currentPlayers(early), [1, 2, 0]);
  assert.equal(E.stripSecret(early, 0).tasks[0].kind, "produceBonus");
  early = E.move(early, { type: "produceBonus", good: "corn" }, 0);
  early = produce(early, 2);
  early = produce(early, 1);
  let ordered = produce(start, 0);
  ordered = produce(ordered, 1);
  ordered = produce(ordered, 2);
  ordered = E.move(ordered, { type: "produceBonus", good: "corn" }, 0);
  assert.deepEqual(early.players, ordered.players);
  assert.deepEqual(early.supply, ordered.supply);
  assert.deepEqual(early.tasks, ordered.tasks);
});
test("scarce goods keep production and bonuses in order, including two bonus goods", () => {
  let s = fixture();
  s.supply.corn = 3;
  assert.deepEqual(E.currentPlayers(s), [0]);
  s = produce(s, 0);
  assert.deepEqual(E.currentPlayers(s), [1]);
  assert.throws(() => E.move(s, { type: "produceBonus", good: "corn" }, 0));
  s = fixture();
  s.tasks[3].remaining = 2;
  s.supply.corn = 4;
  assert.deepEqual(E.currentPlayers(s), [0]);
  s.supply.corn = 5;
  assert.deepEqual(E.currentPlayers(s), [0, 1, 2]);
  assert.equal(
    E.legal(s, 0).some((m) => m.type === "produceBonus"),
    false,
  );
});
test("potential Festival completion keeps the entire production phase ordered", () => {
  const s = fixture();
  s.festivals = [
    {
      id: "crop",
      goal: "produce",
      amount: 2,
      targets: { goods: ["corn"], estates: [] },
      reward: { workers: 1 },
    },
  ];
  assert.deepEqual(
    E.currentPlayers(s),
    [0],
    "chooser's bonus could complete it",
  );
  s.festivals[0].targets.goods = ["coffee"];
  assert.deepEqual(
    E.currentPlayers(s),
    [0, 1, 2],
    "unreachable objectives do not block parallelism",
  );
  s.festivals[0].targets.goods = ["corn"];
  s.festivals[0].amount = 1;
  assert.deepEqual(
    E.currentPlayers(s),
    [0],
    "competing producers must resolve in order",
  );
  s.festivals[0].claimed = 2;
  assert.deepEqual(E.currentPlayers(s), [0, 1, 2]);
});
test("a pending Festival bonus worker placement is a barrier", () => {
  const s = fixture();
  s.tasks.unshift({ kind: "bonusAssign", p: 0, remaining: 1 });
  assert.deepEqual(E.currentPlayers(s), [0]);
  assert.equal(
    E.legal(s, 1).some((m) => m.type === "produce"),
    false,
  );
});

test("out-of-order Craftsman actions replay from an ordinary game history", () => {
  let s = E.init(3, [], {}, "replay-parallel-craftsman");
  s = E.move(s, { type: "role", id: "recruiter" }, 0);
  s = E.move(s, { type: "recruitBonus" }, 0);
  while (s.tasks[0].kind === "assign") {
    const p = E.currentPlayer(s);
    s = E.move(s, { type: "assign", ...E.autoAssignment(s, p) }, p);
  }
  const owner = E.currentPlayer(s);
  s = E.move(s, { type: "role", id: "craftsman" }, owner);
  for (let i = 0; i < 10 && s.tasks[0].kind !== "role"; i++) {
    const p = E.currentPlayers(s).at(-1);
    s = E.move(s, E.legal(s, p)[0], p);
  }
  assert.equal(s.tasks[0].kind, "role");
  assert.deepEqual(E.replay(s), s);
});

test("early bonus choices do not repeat normal-production Chapel effects", () => {
  let s = fixture();
  s.players[0].buildings = [{ id: "chapel", c: 1, w: 0 }];
  s = produce(s, 0);
  assert.equal(
    E.legal(s, 0).some((m) => m.decline?.includes("chapel")),
    false,
  );
  const points = s.players[0].vp;
  s = E.move(s, { type: "produceBonus", good: "corn" }, 0);
  assert.equal(s.players[0].vp, points);
});
