import test from "node:test";
import assert from "node:assert/strict";
import * as e from "../engine/index.js";
import { BUILDINGS as B, GOODS, CRATES, ESTATES } from "../engine/catalog.js";
const empty = () => Object.fromEntries(GOODS.map((g) => [g, 0]));
const tile = (id, w = 1, c = 0) => ({ id, w, c });
function phase(role, owner = 0) {
  let s = e.init(3, [], {}, "fixture");
  s = e.move(s, { type: "role", id: role }, owner);
  return s;
}
function invariant(s) {
  for (const g of GOODS) {
    const total =
      s.supply[g] +
      s.players.reduce((n, p) => n + p.goods[g], 0) +
      s.trade.filter((x) => x === g).length +
      s.ships.reduce((n, sh) => n + (sh.good === g ? sh.amount : 0), 0) +
      (s.privateCargo?.[g] ?? 0) +
      s.festivals
        .filter((f) => f.claimed === undefined)
        .reduce((n, f) => n + f.targets.goods.filter((x) => x === g).length, 0);
    assert.equal(
      total,
      CRATES[g] - (s.players.length === 2 ? 2 : 0),
      `Conserve ${g}, ${s.role}`,
    );
    const estates =
      s.bag.filter((x) => x === g).length +
      s.discard.filter((x) => x === g).length +
      s.offer.filter((x) => x === g).length +
      s.players.reduce(
        (n, p) => n + p.estates.filter((t) => (t.source ?? t.id) === g).length,
        0,
      ) +
      s.festivals
        .filter((f) => f.claimed === undefined)
        .reduce(
          (n, f) => n + f.targets.estates.filter((x) => x === g).length,
          0,
        ) +
      (s.tasks[0]?.kind === "forest" && s.tasks[0].id === g ? 1 : 0);
    assert.equal(
      estates,
      ESTATES[g] - (s.players.length === 2 ? 3 : 0),
      `Conserve ${g} estates`,
    );
  }
  const workerTotal =
    s.workerSupply +
    s.register.w +
    (s.discardedPeople?.w ?? 0) +
    s.players.reduce(
      (n, p) =>
        n +
        p.reserve.w +
        [...p.estates, ...p.buildings].reduce((v, t) => v + t.w, 0),
      0,
    );
  const citizenTotal =
    s.citizenSupply +
    s.register.c +
    (s.discardedPeople?.c ?? 0) +
    s.players.reduce(
      (n, p) =>
        n +
        p.reserve.c +
        [...p.estates, ...p.buildings].reduce((v, t) => v + t.c, 0),
      0,
    );
  assert.equal(workerTotal, { 2: 42, 3: 58, 4: 79, 5: 100 }[s.players.length]);
  assert.equal(citizenTotal, s.expansions.includes("citizens") ? 20 : 0);
  for (const p of s.players) {
    assert.ok(p.coins >= 0);
    assert.ok(e.citySize(p) <= 12);
    assert.ok(p.estates.length <= 12);
    for (const t of p.buildings) assert.ok(t.w + t.c <= B[t.id].workers);
    for (const t of p.estates)
      assert.ok(t.w + t.c <= (t.id === "forest" ? 0 : 1));
  }
}
test("setup and secret state are deterministic", () => {
  const s = e.init(5, ["citizens"], {}, "same");
  assert.deepEqual(s, e.init(5, ["citizens"], {}, "same"));
  assert.notDeepEqual(s.bag, e.init(5, ["citizens"], {}, "different").bag);
  const spectator = e.stripSecret(s);
  assert.equal(spectator.random, undefined);
  assert.equal(spectator.config, undefined);
  assert.equal(spectator.bag, undefined);
  assert.deepEqual(spectator.legal, []);
  assert.ok(spectator.players.every((p) => p.vp === null));
  assert.equal(e.stripSecret(s, 1).players[1].vp, 0);
});
test("moves are immutable and enforce seat and legal prices", () => {
  const s = phase("builder");
  const before = structuredClone(s);
  assert.throws(() => e.move(s, { type: "build", id: "cityHall" }, 0), {
    name: "InvalidMoveError",
  });
  assert.throws(() => e.move(s, { type: "pass" }, 1));
  assert.deepEqual(s, before);
  const result = e.move(s, { type: "build", id: "smallFruit" }, 0);
  assert.equal(result.players[0].coins, 2);
  assert.equal(result.players[0].buildings[0].w, 0);
  assert.deepEqual(s, before);
});
test("production requires both estate and matching factory workers", () => {
  const p = {
    estates: [
      tile("corn"),
      tile("corn", 0),
      tile("fruit"),
      tile("fruit"),
      tile("fruit"),
    ],
    buildings: [tile("largeFruit", 2)],
  };
  assert.deepEqual(e.production(p), {
    corn: 1,
    fruit: 2,
    sugar: 0,
    tobacco: 0,
    coffee: 0,
  });
});
test("mandatory shipping uses a matching ship, or an empty one maximizing that good", () => {
  const s = phase("captain");
  s.players[0].goods = { ...empty(), corn: 5, coffee: 2 };
  assert.deepEqual(
    e
      .shipping(s, 0)
      .filter((m) => m.good === "corn")
      .map((m) => m.ship),
    [1, 2],
  );
  s.ships[0] = { capacity: 4, good: "corn", amount: 4 };
  assert.equal(
    e.shipping(s, 0).some((m) => m.good === "corn"),
    false,
  );
  assert.equal(
    e.legal(s).some((m) => m.type === "pass"),
    false,
  );
});
test("Captain privilege applies once per phase and ships unload after storage", () => {
  let s = phase("captain");
  s.players[0].goods = { ...empty(), corn: 4, sugar: 1 };
  s.ships[1] = { capacity: 5, good: "sugar", amount: 3 };
  s = e.move(s, { type: "ship", ship: 0, good: "corn" }, 0);
  assert.equal(s.players[0].vp, 5);
  assert.equal(s.ships[0].amount, 4);
  s = e.move(s, { type: "pass" }, 1);
  s = e.move(s, { type: "pass" }, 2);
  s = e.move(s, { type: "ship", ship: 1, good: "sugar" }, 0);
  assert.equal(s.players[0].vp, 6);
});
test("storage covers whole types plus one crate; quantities cannot be forged", () => {
  let s = phase("captain");
  s.players[0].goods = { ...empty(), corn: 4, sugar: 3, coffee: 2 };
  s.players[0].buildings = [tile("smallWarehouse")];
  s.tasks = [{ kind: "store", p: 0 }, { kind: "phaseEnd" }];
  assert.throws(() =>
    e.move(
      s,
      { type: "store", types: ["corn", "sugar"], goods: s.players[0].goods },
      0,
    ),
  );
  assert.throws(() =>
    e.move(
      s,
      { type: "store", types: ["corn"], goods: { ...empty(), corn: -1 } },
      0,
    ),
  );
  s = e.move(
    s,
    {
      type: "store",
      types: ["corn"],
      goods: { ...empty(), corn: 4, coffee: 1 },
    },
    0,
  );
  assert.deepEqual(s.players[0].goods, { ...empty(), corn: 4, coffee: 1 });
});
test("workers must fill all usable slots and cannot be duplicated", () => {
  let s = phase("recruiter");
  s.tasks = [{ kind: "assign", p: 0 }, { kind: "phaseEnd" }];
  s.players[0].reserve = { w: 2, c: 1 };
  s.players[0].buildings = [tile("smallFruit", 0)];
  assert.throws(() =>
    e.move(
      s,
      {
        type: "assign",
        estates: [{ w: 0, c: 0 }],
        buildings: [{ w: 0, c: 0 }],
      },
      0,
    ),
  );
  assert.throws(() =>
    e.move(
      s,
      {
        type: "assign",
        estates: [{ w: 1, c: 0 }],
        buildings: [{ w: 2, c: 0 }],
      },
      0,
    ),
  );
  s = e.move(
    s,
    { type: "assign", estates: [{ w: 1, c: 0 }], buildings: [{ w: 0, c: 1 }] },
    0,
  );
  assert.deepEqual(s.players[0].reserve, { w: 1, c: 0 });
});
test("quarry discounts are capped by building column and stack with privilege", () => {
  const s = phase("builder");
  s.players[0].estates = Array.from({ length: 5 }, () => tile("quarry"));
  assert.equal(e.cost(s, 0, "smallWarehouse"), 1);
  assert.equal(e.cost(s, 0, "wharf"), 5);
  assert.equal(e.cost(s, 0, "monument"), 5);
});
test("official errata: filling a city ends the round, not the Builder phase", () => {
  let s = phase("builder");
  s.players[0].coins = 30;
  s.players[0].buildings = [
    "smallFruit",
    "smallSugar",
    "largeFruit",
    "largeSugar",
    "tobaccoStorage",
    "coffeeRoaster",
    "smallMarket",
    "buildersYard",
    "hacienda",
    "hospital",
    "office",
  ].map((id) => tile(id, 0));
  s = e.move(s, { type: "build", id: "factory" }, 0);
  assert.equal(s.endReason, "city");
  assert.equal(e.ended(s), false);
  assert.equal(e.currentPlayer(s), 1);
  while (!s.finished) s = e.moveAI(s);
  assert.equal(s.round, 1);
  assert.equal(s.choices, 3);
});
test("official errata: VP depletion outside Captain also finishes the round", () => {
  let s = phase("builder");
  s.vpSupply = 1;
  s.players[0].coins = 20;
  s.players[0].buildings = [tile("church")];
  s.market.hospital = 2;
  s = e.move(s, { type: "build", id: "hospital" }, 0);
  assert.equal(s.endReason, "points");
  assert.equal(s.finished, false);
  while (!s.finished) s = e.moveAI(s);
  assert.equal(s.round, 1);
});
test("citizens replace a worker in the register and do not cause worker-endgame", () => {
  const s = e.init(3, ["citizens"]);
  assert.equal(s.register.w, 2);
  assert.equal(s.register.c, 1);
  assert.equal(s.workerSupply, 56);
  assert.equal(s.citizenSupply, 19);
});
test("hidden market only pays an actual shortfall and does not sacrifice its sole worker", () => {
  const s = phase("builder");
  s.players[0].coins = 0;
  s.players[0].buildings = [tile("hiddenMarket")];
  s.players[0].goods.corn = 1;
  s.players[0].vp = 1;
  const moves = e.buildOptions(s, 0).filter((m) => m.id === "smallWarehouse");
  assert.ok(moves.length);
  assert.ok(moves.every((m) => !m.worker));
  const after = e.move(s, moves[0], 0);
  assert.equal(after.players[0].coins, 0);
  assert.ok(e.active(after.players[0], "hiddenMarket"));
  assert.equal(after.players[0].vp, 0);
});
test("small wharf accepts mixed partial cargo; bonuses count per shipment", () => {
  let s = phase("captain");
  s.players[0].buildings = [tile("smallWharf"), tile("harbor")];
  s.players[0].goods = { ...empty(), corn: 3, coffee: 2 };
  s = e.move(
    s,
    { type: "smallWharf", goods: { ...empty(), corn: 2, coffee: 1 } },
    0,
  );
  assert.equal(s.players[0].vp, 3);
  assert.equal(s.players[0].goods.corn, 1);
  assert.equal(s.players[0].goods.coffee, 1);
});
test("captured role executes at round end if nobody selected it", () => {
  let s = e.init(3, ["smuggler"]);
  s.choices = 2;
  s = e.move(s, { type: "role", id: "smuggler" }, 0);
  s = e.move(s, { type: "capture", id: "builder" }, 0);
  assert.equal(s.role, "builder");
  assert.equal(s.owner, 0);
  assert.equal(s.round, 1);
  assert.equal(s.choices, 3);
});
test("smuggler cannot be reselected by its token holder", () => {
  const s = e.init(3, ["smuggler"]);
  s.smuggler = 0;
  assert.ok(!e.legal(s).some((m) => m.id === "smuggler"));
  assert.throws(() => e.move(s, { type: "role", id: "smuggler" }, 0));
});
test("public metadata does not enable HTML or change game mechanics", () => {
  const s = e.init(3);
  const renamed = e.setPlayerMetaData(s, 0, {
    name: "<script>alert(1)</script>",
  });
  assert.equal(renamed.players[0].name, "<script>alert(1)</script>");
  assert.deepEqual(e.scores(renamed), e.scores(s));
});
test("Bohío can move workers out of turn without consuming the active turn", () => {
  const s = e.init(3);
  s.players[1].buildings = [tile("bohio", 1), tile("smallFruit", 0)];
  const m = { type: "bohio", kind: "w", target: "b1" };
  assert.equal(e.canMoveOutOfTurn(s, m, 1), true);
  const after = e.move(s, m, 1);
  assert.equal(e.currentPlayer(after), 0);
  assert.equal(after.players[1].buildings[0].w, 0);
  assert.equal(after.players[1].buildings[1].w, 1);
  assert.throws(() => e.move(s, { type: "role", id: "builder" }, 1));
});
test("School worker is optional and goes only on the newly built building", () => {
  let s = phase("builder");
  s.players[0].coins = 20;
  s.players[0].buildings = [tile("school")];
  s = e.move(s, { type: "build", id: "smallFruit" }, 0);
  assert.equal(s.tasks[0].kind, "school");
  assert.equal(s.players[0].buildings[1].w, 0);
  const passed = e.move(s, { type: "pass" }, 0);
  assert.equal(passed.players[0].buildings[1].w, 0);
  const used = e.move(s, { type: "school" }, 0);
  assert.equal(used.players[0].buildings[1].w, 1);
  assert.equal(used.workerSupply, s.workerSupply - 1);
});
test("Poaching lets the smuggler choose surplus citizens to discard", () => {
  let s = e.init(3, ["smuggler", "citizens"]);
  s.tasks = [{ kind: "role", p: 0 }];
  s.register = { w: 4, c: 1 };
  s = e.move(s, { type: "role", id: "smuggler" }, 0);
  s = e.move(s, { type: "poach" }, 0);
  s = e.move(s, { type: "pass" }, 0);
  assert.equal(s.tasks[0].kind, "poachDiscard");
  s = e.move(s, { type: "discardWorker", kind: "c" }, 0);
  assert.equal(s.register.c, 0);
  s = e.move(s, { type: "discardWorker", kind: "w" }, 0);
  assert.equal(s.register.w, 3);
});
test("all twelve Festival activities can be drawn and reserve their components", () => {
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const s = e.init(3, ["festival-cards"], {}, `fest-${i}`);
    invariant(s);
    for (const f of s.festivals) seen.add(f.id);
  }
  assert.equal(seen.size, 12);
});
test("a Festival objective never locks away the only purchasable copy of its building", () => {
  for (const n of [2, 3])
    for (let i = 0; i < 12; i++) {
      const s = e.init(n, ["festival-cards"], {}, `marker-${i}`);
      for (const f of s.festivals)
        if (f.targets.building) assert.ok(s.market[f.targets.building] > 0);
    }
});
test("Church and Harbor points can be declined to avoid ending the game early", () => {
  let s = phase("builder");
  s.players[0].coins = 20;
  s.players[0].buildings = [tile("church")];
  s.vpSupply = 1;
  s = e.move(s, { type: "build", id: "hospital", decline: ["church"] }, 0);
  assert.equal(s.endReason, null);
  assert.equal(s.players[0].vp, 0);
  let c = phase("captain");
  c.players[0].goods.corn = 1;
  c.players[0].buildings = [tile("harbor")];
  c.vpSupply = 3;
  c = e.move(
    c,
    { type: "ship", ship: 0, good: "corn", decline: ["harbor"] },
    0,
  );
  assert.equal(c.players[0].vp, 2);
  assert.equal(c.endReason, null);
});
test("Chapel VP can be declined independently of production", () => {
  let s = phase("craftsman");
  s.players[0].buildings = [tile("chapel", 0, 1)];
  s.players[0].estates = [tile("corn")];
  s.vpSupply = 1;
  s = e.move(
    s,
    { type: "produce", goods: { ...empty(), corn: 1 }, decline: ["chapel"] },
    0,
  );
  assert.equal(s.players[0].goods.corn, 1);
  assert.equal(s.players[0].vp, 0);
  assert.equal(s.endReason, null);
});
test("invalid bonus opt-outs cannot bypass mandatory Captain points", () => {
  const s = phase("captain");
  s.players[0].goods.corn = 1;
  s.players[0].buildings = [tile("smallWharf")];
  assert.throws(() =>
    e.move(
      s,
      {
        type: "smallWharf",
        goods: { ...empty(), corn: 1 },
        decline: ["captain"],
      },
      0,
    ),
  );
});
test("replay restores each playable boundary and log slices omit secrets", () => {
  let s = e.init(3, ["smuggler"], {}, "replay");
  const states = [s];
  for (let i = 0; i < 35; i++) {
    s = e.moveAI(s);
    states.push(s);
  }
  for (const i of [1, 5, 13, 36])
    assert.deepEqual(e.replay(s, { to: i }), states[i - 1]);
  const slice = e.logSlice(s, { player: 0, start: 5, end: 5 });
  assert.equal(slice.frames.length, 1);
  assert.equal(slice.frames[0].history, undefined);
  assert.equal(slice.frames[0].players[1].vp, null);
});
for (const n of [2, 3, 4, 5])
  for (const expansions of [
    [],
    ["new-buildings"],
    ["citizens"],
    ["smuggler", "festival"],
    ["new-buildings", "citizens", "smuggler", "festival-cards"],
  ])
    test(`${n} players / ${expansions.join("+") || "base"}: complete game, finite supplies, deterministic replay`, () => {
      let s = e.init(n, expansions, {}, `full-${n}`);
      invariant(s);
      let moves = 0;
      while (!e.ended(s) && moves++ < 1500) {
        s = e.moveAI(s);
        invariant(s);
      }
      assert.ok(e.ended(s), "Bots finish a legal game");
      assert.deepEqual(e.replay(s), s);
      assert.equal(e.currentPlayer(s), undefined);
      assert.equal(e.rankings(s).length, n);
    });
