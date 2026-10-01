import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
const fresh = () => E.init(3, [], {}, "role-warnings");
const tile = (id, w = 1, c = 0) => ({ id, w, c });

test("initial warnings are advisory, private to the chooser and do not mutate state", () => {
  const s = fresh(),
    before = structuredClone(s),
    w = E.roleWarnings(s, 0);
  assert.deepEqual(Object.keys(w).sort(), ["captain", "craftsman", "trader"]);
  assert.equal(
    E.move(s, { type: "role", id: "craftsman" }, 0).role,
    "craftsman",
  );
  assert.deepEqual(s, before);
  assert.deepEqual(E.stripSecret(s, 0).roleWarnings, w);
  assert.deepEqual(E.stripSecret(s, 1).roleWarnings, {});
  assert.deepEqual(E.stripSecret(s).roleWarnings, {});
});
test("production checks occupancy, the corn exception and depleted supply", () => {
  const s = fresh(),
    p = s.players[0];
  p.estates = [tile("fruit")];
  p.buildings = [tile("smallFruit", 0)];
  assert.equal(E.roleWarnings(s, 0).craftsman.reason, "warnProductionSetup");
  p.buildings[0].w = 1;
  assert.equal(E.roleWarnings(s, 0).craftsman, undefined);
  s.supply.fruit = 0;
  assert.equal(E.roleWarnings(s, 0).craftsman.reason, "warnProductionSupply");
  p.estates = [tile("corn")];
  p.buildings = [];
  assert.equal(E.roleWarnings(s, 0).craftsman, undefined);
});
test("production-independent rewards match the actual gains even when passing", () => {
  const s = fresh(),
    p = s.players[0];
  s.roles.find((r) => r.id === "craftsman").coins = 3;
  p.buildings = [tile("chapel", 0, 1), tile("tailorShop")];
  const w = E.roleWarnings(s, 0).craftsman;
  assert.equal(w.coins, 3);
  assert.deepEqual(w.bonuses, [
    { building: "chapel", vp: 1 },
    { building: "tailorShop", coins: 1 },
  ]);
  let next = E.move(s, { type: "role", id: "craftsman" }, 0);
  next = E.move(next, { type: "pass" }, 0);
  assert.equal(next.players[0].coins - p.coins, 4);
  assert.equal(next.players[0].vp - p.vp, 1);
});
test("Builder includes incoming coins, privilege, and alternative payment methods", () => {
  const s = fresh(),
    p = s.players[0];
  s.market = { largeSugar: 1 };
  p.coins = 0;
  assert.equal(E.roleWarnings(s, 0).builder.reason, "warnBuildMoney");
  s.roles.find((r) => r.id === "builder").coins = 3;
  assert.equal(E.roleWarnings(s, 0).builder, undefined);
  s.roles.find((r) => r.id === "builder").coins = 0;
  p.buildings = [tile("hiddenMarket")];
  p.reserve.w = 1;
  p.goods.corn = 1;
  p.vp = 1;
  assert.equal(E.roleWarnings(s, 0).builder, undefined);
  p.buildings.push(tile("largeSugar"));
  assert.equal(E.roleWarnings(s, 0).builder.reason, "warnBuildSpace");
});
test("Trader respects the Office, Outpost and Zoning Office", () => {
  const s = fresh(),
    p = s.players[0];
  p.goods.corn = 1;
  s.trade = ["corn"];
  assert.equal(E.roleWarnings(s, 0).trader.reason, "warnTradeTypes");
  p.buildings = [tile("office")];
  assert.equal(E.roleWarnings(s, 0).trader, undefined);
  s.trade = ["corn", "fruit", "sugar", "coffee"];
  assert.equal(E.roleWarnings(s, 0).trader.reason, "warnTradeFull");
  p.buildings = [tile("merchantOutpost")];
  assert.equal(E.roleWarnings(s, 0).trader, undefined);
  p.goods.corn = 0;
  p.buildings = [tile("zoningOffice")];
  assert.equal(E.roleWarnings(s, 0).trader, undefined);
});
test("Captain resets private ship use and respects alternate scoring actions", () => {
  const s = fresh(),
    p = s.players[0];
  p.goods.corn = 2;
  s.ships.forEach((sh, i) => {
    sh.good = ["corn", "fruit", "sugar"][i];
    sh.amount = sh.capacity;
  });
  assert.equal(E.roleWarnings(s, 0).captain.reason, "warnShipSpace");
  p.buildings = [tile("wharf")];
  s.usedWharves = ["0:wharf"];
  assert.equal(E.roleWarnings(s, 0).captain, undefined);
  p.buildings = [tile("assemblyHall")];
  assert.equal(E.roleWarnings(s, 0).captain, undefined);
  p.goods.corn = 1;
  p.buildings = [tile("pensionOffice", 0, 1)];
  assert.equal(E.roleWarnings(s, 0).captain, undefined);
  p.goods.corn = 0;
  p.buildings = [tile("lighthouse")];
  assert.deepEqual(E.roleWarnings(s, 0).captain.bonuses, [
    { building: "lighthouse", coins: 1 },
  ]);
});
test("full countryside and empty recruitment supply allow building powers and reassignment", () => {
  const s = fresh(),
    p = s.players[0];
  p.estates = Array.from({ length: 12 }, () => tile("fruit", 0));
  assert.equal(E.roleWarnings(s, 0).planter.reason, "warnPlantSpace");
  p.buildings = [tile("parkAuthority")];
  assert.equal(E.roleWarnings(s, 0).planter, undefined);
  p.buildings = [];
  s.register = { w: 0, c: 0 };
  s.workerSupply = 0;
  assert.equal(E.roleWarnings(s, 0).recruiter.reason, "warnRecruitSupply");
  p.reserve.w = 1;
  assert.equal(E.roleWarnings(s, 0).recruiter, undefined);
});
test("Smuggler can capture roles on an empty board, Adventurer still earns money", () => {
  const s = E.init(4, ["smuggler"], {}, "warnings");
  assert.equal(E.roleWarnings(s, 0).smuggler, undefined);
  assert.equal(E.roleWarnings(s, 0).adventurer, undefined);
});
