import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
import * as A from "../engine/achievements.js";
import { BUILDINGS as B, GOODS } from "../engine/catalog.js";
const tile = (id, w = 0, c = 0) => ({ id, w, c });
const fresh = () => E.init(3, ["achievements"], {}, "achievement-test");
test("the deck has exactly 30 unique, sourced cards and each objective accepts its boundary", () => {
  assert.equal(A.ACHIEVEMENTS.length, 30);
  assert.equal(Object.keys(A.CARDS).length, 30);
  for (const card of A.ACHIEVEMENTS) {
    const s = fresh(),
      p = s.players[0];
    let e = {};
    assert.equal(A.fulfilled(s, 0, card.id, e), false, card.id + " initially");
    switch (card.goal) {
      case "spendAll":
        e = { type: "build", id: "fireStation", paid: 10, beforeCoins: 10 };
        break;
      case "goodsPair":
        p.goods[card.goods[0]] = card.amount - 1;
        p.goods[card.goods[1]] = 1;
        break;
      case "dispatch":
        e = {
          type: "ship",
          ship: 0,
          good: card.good,
          shipLoad: 4,
          shipCapacity: 4,
        };
        break;
      case "closeTrade":
        s.owner = 0;
        s.trade = ["corn", "fruit", "sugar", "coffee"];
        e = { type: "trade" };
        break;
      case "shipTypes":
        s.role = "captain";
        s.shipped = [{ corn: 1, fruit: 1, sugar: 1 }];
        break;
      case "buildingWorkers":
        p.buildings = [
          tile("largeFruit", 3),
          tile("largeSugar", 3),
          tile("tobaccoStorage", 3),
          tile("coffeeRoaster", 2, 1),
        ];
        break;
      case "fillShip":
        e = {
          type: "ship",
          ship: 0,
          good: "corn",
          goods: { corn: 4 },
          shipCapacity: 4,
        };
        break;
      case "estateWorkers":
        p.estates = Array.from({ length: 9 }, () => tile("corn", 1));
        break;
      case "produce":
        s.role = "craftsman";
        s.production = [{ corn: 7 }];
        break;
      case "productionSet":
        p.buildings = ["smallSugar", "tobaccoStorage", "coffeeRoaster"].map(
          (id) => tile(id),
        );
        break;
      case "expanded":
        p.buildings = ["fireStation", "cityHall"].map((id) => tile(id));
        break;
      case "developed":
        p.estates = Array.from({ length: 10 }, () => tile("corn"));
        p.buildings = Array.from({ length: 5 }, () => tile("fireStation"));
        break;
      case "estates":
        p.estates = Array.from({ length: 12 }, () => tile("corn"));
        break;
      case "cheapExpanded":
        e = { type: "build", id: "fireStation", paid: 6 };
        break;
      case "goods":
        p.goods.corn = 7;
        break;
      case "store":
        p.goods.corn = 1;
        p.goods.fruit = 1;
        e = { type: "store" };
        break;
      case "commercial":
        p.buildings = Object.keys(B)
          .filter((id) => !B[id].good && B[id].size === 1)
          .slice(0, 7)
          .map((id) => tile(id));
        break;
      case "shipAmount":
        e = { type: "ship", ship: "wharf", goods: { corn: 5 } };
        break;
      case "captainPoints":
        s.role = "captain";
        s.phaseVP = [7];
        break;
      case "tradeCoins":
        e = { type: "trade", coins: 6 };
        break;
      case "productionCount":
        p.buildings = ["smallFruit", "largeFruit", "smallSugar"].map((id) =>
          tile(id),
        );
        break;
      default:
        assert.fail(card.goal);
    }
    assert.equal(A.fulfilled(s, 0, card.id, e), true, card.id + " at boundary");
  }
});
test("dispatch, empty-to-full loading, private ships and phase totals remain distinct", () => {
  const s = fresh();
  s.role = "captain";
  const e = {
    type: "ship",
    ship: 0,
    good: "coffee",
    goods: { coffee: 1 },
    shipCapacity: 4,
    shipLoad: 4,
  };
  assert.equal(A.fulfilled(s, 0, "coffeeDispatcher", e), true);
  assert.equal(A.fulfilled(s, 0, "independentShipper", e), false);
  assert.equal(
    A.fulfilled(s, 0, "coffeeDispatcher", { ...e, ship: "wharf" }),
    false,
  );
  s.shipped = [{ corn: 1, fruit: 1, sugar: 1 }];
  s.production = [{ corn: 7 }];
  s.phaseVP = [7];
  assert.equal(A.fulfilled(s, 0, "dockTycoon"), true);
  assert.equal(A.fulfilled(s, 0, "leadingProducer"), false);
  s.role = "trader";
  assert.equal(A.fulfilled(s, 0, "dockTycoon"), false);
  assert.equal(A.fulfilled(s, 0, "tradeStrategist"), false);
  assert.equal(
    A.fulfilled(s, 0, "dealCloser", { type: "trade", outpost: true }),
    false,
  );
});
test("dealing and drafting keep opponents objectives out of states, logs and events", () => {
  for (const options of [
    {},
    { achievementDraft: true },
    { puertoma: { humans: 1 } },
  ]) {
    let s = E.init(3, ["achievements"], options, "secret-deck");
    const observer = E.stripSecret(s, 1);
    const initial =
      s.players[0].achievementOffer ??
      s.players[0].achievements.map((c) => c.id);
    for (const id of initial)
      assert.equal(JSON.stringify(observer).includes(id), false);
    while (["achievementChoose", "achievementDraft"].includes(s.tasks[0]?.kind))
      s = E.moveAI(s);
    for (const p of s.players.filter((p) => !p.puertoma))
      assert.equal(p.achievements.length, 4);
    assert.equal(
      s.events.some((e) =>
        ["achievementChoose", "achievementDraft"].includes(e.type),
      ),
      false,
    );
    assert.deepEqual(E.replay(s), s);
  }
});
test("completing a card reveals it and scores only at game end without VP tokens", () => {
  let s = fresh();
  s.players[0].achievements = [{ id: "masterCollector", completed: false }];
  s.players[0].goods.corn = 7;
  const before = s.vpSupply;
  s = E.move(s, { type: "role", id: "planter" }, 0);
  assert.equal(s.players[0].achievements[0].completed, true);
  assert.equal(s.vpSupply, before);
  assert.equal(E.scoreBreakdown(s, 0).bonus.achievements, 7);
  assert.equal(
    E.stripSecret(s, 1).players[0].achievements[0].id,
    "masterCollector",
  );
});
test("Big Spender can decline discounts, while arbitrary overpayment is rejected", () => {
  let s = fresh();
  s.players[0].coins = 10;
  s.players[0].estates = Array.from({ length: 4 }, () => tile("quarry", 1));
  s.players[0].achievements = [
    { id: "bigSpender", completed: false },
    { id: "masterArchitect", completed: false },
  ];
  s = E.move(s, { type: "role", id: "builder" }, 0);
  assert.equal(E.cost(s, 0, "fireStation"), 5);
  assert(E.legal(s, 0).some((m) => m.id === "fireStation" && m.pay === 10));
  assert.throws(() =>
    E.move(s, { type: "build", id: "fireStation", pay: 11 }, 0),
  );
  const r = E.move(s, { type: "build", id: "fireStation", pay: 10 }, 0);
  assert.equal(r.players[0].coins, 0);
  assert.equal(r.players[0].achievements[0].completed, true);
  assert.equal(r.players[0].achievements[1].completed, false);
});
test("Puertoma scores every humans incomplete cards, never the completed cards", () => {
  const s = E.init(
    3,
    ["achievements"],
    { puertoma: { humans: 1 } },
    "solo-achievements",
  );
  s.players[0].achievements = [
    { id: "masterCollector", completed: true },
    { id: "bigSpender", completed: false },
  ];
  assert.equal(E.scoreBreakdown(s, 0).bonus.achievements, 0);
  assert.equal(E.scoreBreakdown(s, 1).bonus.achievements, 5);
  assert.equal(E.scoreBreakdown(s, 2).bonus.achievements, 5);
});
