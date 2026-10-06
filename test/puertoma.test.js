import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
import * as P from "../engine/puertoma.js";
import { BUILDINGS as B, GOODS } from "../engine/catalog.js";
import { RELEASE } from "../release-config.js";
const fresh = (difficulty = "normal", expansions = []) =>
  E.init(
    3,
    expansions,
    { puertoma: { humans: 1, difficulty } },
    "puertoma-test",
  );
const tile = (id, w = 0, c = 0) => ({ id, w, c });
test("physical card orders, directed role links and secret abilities are deterministic", () => {
  const s = fresh();
  assert.equal(P.TIEBREAKERS.length, 8);
  for (const c of P.TIEBREAKERS) assert.equal(new Set(c).size, 7);
  assert(P.ADJACENCY.builder.includes("recruiter"));
  assert(!P.ADJACENCY.recruiter.includes("builder"));
  assert(P.ADJACENCY.trader.includes("smuggler"));
  assert(!P.ADJACENCY.recruiter.includes("smuggler"));
  assert.deepEqual(s, fresh());
  const publicState = E.stripSecret(s, 0);
  assert.equal(publicState.puertoma.deck, undefined);
  assert(
    publicState.players[1].puertoma.abilities.every((x) => x.id === undefined),
  );
  const before = structuredClone(s);
  E.legal(s, 1);
  assert.deepEqual(s, before);
});
test("production uses complete estate slots, and workers never move from old estates or VP area", () => {
  const s = fresh(),
    a = s.players[1];
  a.estates = [
    tile("corn"),
    tile("fruit", 1),
    tile("coffee", 2),
    tile("quarry"),
  ];
  a.reserve = { w: 2, c: 1 };
  a.puertoma.unused = { w: 3, c: 1 };
  const assigned = P.allocation(s, 1);
  assert.deepEqual(assigned.estates, [
    { w: 1, c: 0 },
    { w: 2, c: 0 },
    { w: 2, c: 1 },
    { w: 0, c: 0 },
  ]);
  a.estates.forEach((t, i) => Object.assign(t, assigned.estates[i]));
  assert.deepEqual(P.production(a), {
    corn: 1,
    fruit: 1,
    sugar: 0,
    tobacco: 0,
    coffee: 1,
  });
  assert.equal(P.registerDemand(a), 0);
  assert.deepEqual(a.puertoma.unused, { w: 3, c: 1 });
  a.estates = [tile("corn", 1)];
  a.reserve = { w: 2, c: 0 };
  assert.deepEqual(P.allocation(s, 1).unused, { w: 2, c: 0 });
});
test("Puertoma buildings ignore commercial powers, quarry discounts and production buildings", () => {
  const s = fresh(),
    a = s.players[1];
  s.role = "builder";
  s.owner = 1;
  a.coins = 10;
  a.estates = [tile("quarry", 1), tile("quarry", 1)];
  a.buildings = [{ ...tile("smallMarket"), level: 1 }];
  assert.equal(P.price(s, 1, "fireStation"), 9);
  a.puertoma.reserved = "fireStation";
  assert(P.buildings(s, 1).some((m) => m.id === "fireStation"));
  assert(!P.buildings(s, 1).some((m) => B[m.id].good));
  a.buildings.push({ ...tile("hacienda"), level: 1 });
  assert(!P.buildings(s, 1).some((m) => m.level === 1));
});
test("hard setup, storage ability and scoring use Puertoma rules", () => {
  const s = fresh("hard"),
    a = s.players[1];
  assert.equal(a.buildings[0].level, 1);
  assert.equal(s.players[2].buildings[0].level, 2);
  assert.equal(s.players[2].coins, 1);
  assert.equal(a.goods.corn, 1);
  assert.equal(s.players[2].goods.sugar, 1);
  assert(a.puertoma.abilities.find((x) => x.level === 1).active);
  assert(a.puertoma.reserved);
  a.goods = { corn: 3, fruit: 0, sugar: 4, tobacco: 0, coffee: 2 };
  assert.deepEqual(P.storage(a).goods, {
    corn: 0,
    fruit: 0,
    sugar: 0,
    tobacco: 0,
    coffee: 1,
  });
  a.puertoma.abilities.push({ id: "storage", active: true });
  assert.deepEqual(P.storage(a).goods, {
    corn: 0,
    fruit: 0,
    sugar: 1,
    tobacco: 0,
    coffee: 2,
  });
  a.estates = [tile("coffee", 3), tile("coffee", 3), tile("quarry")];
  a.buildings = [{ ...tile("fireStation"), level: 4 }];
  a.puertoma.unused = { w: 2, c: 1 };
  a.coins = 2;
  assert.deepEqual(P.score(a), {
    expanded: 6,
    unusedWorkers: 3,
    quarries: 3,
    activePairs: 2,
    wealth: 6,
  });
});
for (const difficulty of ["easy", "normal", "hard"])
  test(`${difficulty}: complete Special Edition solo game conserves supplies and replays`, () => {
    let s = fresh(difficulty, RELEASE.expansions);
    const initial = structuredClone(s);
    const sum = (xs) => xs.reduce((a, b) => a + b, 0);
    const workers = (s, k) =>
      s[k === "w" ? "workerSupply" : "citizenSupply"] +
      s.register[k] +
      (s.discardedPeople?.[k] ?? 0) +
      sum(
        s.players.map(
          (a) =>
            a.reserve[k] +
            (a.puertoma?.unused[k] ?? 0) +
            sum([...a.estates, ...a.buildings].map((t) => t[k])),
        ),
      );
    const goods = (s, g) =>
      s.supply[g] +
      sum(s.players.map((a) => a.goods[g])) +
      s.trade.filter((x) => x === g).length +
      sum(s.ships.map((x) => (x.good === g ? x.amount : 0))) +
      (s.privateCargo?.[g] ?? 0) +
      sum(
        s.festivals
          .filter((f) => f.claimed === undefined && !f.referenceGoods)
          .map((f) =>
            f.targets.goods.reduce((n, x, i) => n + (x === g ? 1 : 0), 0),
          ),
      );
    const totals = Object.fromEntries(GOODS.map((g) => [g, goods(s, g)]));
    const people = { w: workers(s, "w"), c: workers(s, "c") };
    let turns = 0;
    while (!s.finished && turns++ < 1500) {
      const before = structuredClone(s);
      E.legal(s, E.currentPlayer(s));
      assert.deepEqual(s, before);
      s = E.moveAI(s);
      for (const g of GOODS) {
        assert(s.supply[g] >= 0);
        assert.equal(goods(s, g), totals[g], g);
      }
      for (const k of ["w", "c"]) assert.equal(workers(s, k), people[k], k);
      for (const a of s.players.filter((p) => p.puertoma)) {
        for (const t of a.estates)
          assert(t.w + t.c <= (t.vpArea ? 0 : P.estateCapacity(t.id)));
        for (const l of [1, 2, 3, 4])
          assert(a.buildings.filter((b) => b.level === l).length <= 2);
      }
    }
    assert(s.finished);
    assert.deepEqual(E.replay(s), s);
    assert.deepEqual(initial, fresh(difficulty, RELEASE.expansions));
    for (let p = 0; p < 3; p++)
      assert(Number.isFinite(E.scoreBreakdown(s, p).total));
  });
test("production abilities run once at phase end and do not require production buildings", () => {
  let s = fresh(),
    a = s.players[1];
  a.estates = [tile("corn", 1), tile("coffee", 3)];
  a.puertoma.abilities = [
    { id: "produceCrate", active: true },
    { id: "produceCoins", active: true },
  ];
  const coins = a.coins;
  s = E.move(s, { type: "role", id: "craftsman" }, 0);
  while (s.role === "craftsman") s = E.moveAI(s);
  assert.equal(s.players[1].goods.corn, 1);
  assert.equal(s.players[1].goods.coffee, 2);
  assert.equal(s.players[1].coins, coins + 2);
  assert.equal(
    s.events.filter(
      (e) => e.p === 1 && e.type === "puertomaBonus" && e.id === "produceCrate",
    ).length,
    1,
  );
});
test("recruitment abilities count only workers from this Recruiter phase", () => {
  let s = fresh();
  s.players[1].puertoma.abilities = [
    { id: "recruitWorker", active: true },
    { id: "recruitCoins", active: true },
  ];
  s.players[1].puertoma.recruited = 99;
  const coins = s.players[1].coins;
  s = E.move(s, { type: "role", id: "recruiter" }, 0);
  while (s.role === "recruiter") s = E.moveAI(s);
  assert.equal(s.players[1].coins, coins + 2);
  assert.equal(s.players[1].puertoma.recruited, 0);
});
test("goods scoring abilities resolve before storage and can trigger round-end VP depletion", () => {
  let s = fresh();
  s.players[1].goods.corn = 2;
  s.players[1].goods.coffee = 1;
  s.players[1].puertoma.abilities = [
    { id: "goodsPoints", active: true },
    { id: "discardPoints", active: true },
  ];
  s.ships.forEach((sh) => {
    sh.good = "sugar";
    sh.amount = sh.capacity;
  });
  s.vpSupply = 1;
  s = E.move(s, { type: "role", id: "captain" }, 0);
  while (s.role === "captain" && !s.finished) s = E.moveAI(s);
  assert.equal(s.players[1].vp, 4);
  assert.equal(s.players[1].goods.corn, 0);
  assert.equal(s.players[1].goods.coffee, 1);
  assert.equal(s.endReason, "points");
});
test("Capture the Role is disabled for humans in a Puertoma game", () => {
  let s = fresh("normal", ["smuggler"]);
  s = E.move(s, { type: "role", id: "smuggler" }, 0);
  assert(!E.legal(s, 0).some((m) => m.type === "capture"));
});
