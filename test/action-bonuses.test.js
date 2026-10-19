import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
import { actionVictoryPoints } from "../viewer/action-bonuses.js";
import { RELEASE } from "../release-config.js";

function fixture(role) {
  let s = E.init(
    3,
    RELEASE.expansions,
    { ...RELEASE.options, chooseBuildings: false },
    "action-rewards",
  );
  while (s.tasks[0].kind !== "role") s = E.moveAI(s);
  s = E.move(s, { type: "role", id: role }, E.currentPlayer(s));
  s.festivals = [];
  s.players.forEach((p) => {
    p.achievements = [];
  });
  return s;
}
function verify(s, move) {
  const preview = actionVictoryPoints(s, 0, move);
  const after = E.move(s, move, 0);
  assert.equal(preview, after.players[0].vp - s.players[0].vp);
  return after;
}
test("shipping previews match engine totals, including first-shipment privileges and private ships", () => {
  const s = fixture("captain");
  s.tasks = [{ kind: "ship", p: 0 }];
  s.players[0].goods.corn = 5;
  s.players[0].buildings = [
    "harbor",
    "publishingHouse",
    "wharf",
    "smallWharf",
  ].map((id) => ({ id, w: 1, c: 0 }));
  s.ships[0].good = "corn";
  s.ships[0].amount = 1;
  verify(s, { type: "ship", ship: 0, good: "corn" });
  verify(s, { type: "ship", ship: "wharf", good: "corn" });
  const goods = { ...s.players[0].goods, corn: 3 };
  verify(s, { type: "smallWharf", goods });
  s.captainBonus = true;
  verify(s, { type: "ship", ship: 0, good: "corn" });
});
test("plunder awards VP and returns goods to supply without adding them to the player", () => {
  const s = fixture("smuggler");
  s.trade = ["corn", "coffee", "fruit"];
  const after = verify(s, { type: "plunder" });
  assert.deepEqual(after.players[0].goods, s.players[0].goods);
  for (const good of s.trade)
    assert.equal(after.supply[good], s.supply[good] + 1);
  assert.deepEqual(after.trade, []);
});
test("Chapel preview covers both production and passing", () => {
  const s = fixture("craftsman");
  s.players[0].estates = [{ id: "corn", w: 1, c: 0 }];
  s.players[0].buildings = [{ id: "chapel", w: 0, c: 1 }];
  const move = E.legal(s).find((m) => m.type === "produce" && !m.decline);
  verify(s, move);
  verify(s, { type: "pass" });
});
test("Church, Pension Office, Park Authority and Assembly Hall show their immediate points", () => {
  const s = fixture("builder");
  s.players[0].coins = 20;
  s.players[0].buildings = [{ id: "church", w: 1, c: 0 }];
  s.market.cityHall = 1;
  verify(s, { type: "build", id: "cityHall" });
  s.tasks = [{ kind: "park", p: 0 }];
  s.players[0].buildings.push({ id: "parkAuthority", w: 0, c: 1 });
  s.players[0].estates = [];
  verify(s, { type: "parkReward" });
  s.tasks = [{ kind: "assembly", p: 0 }];
  s.players[0].goods = { corn: 3, fruit: 4, sugar: 1, tobacco: 0, coffee: 2 };
  verify(s, { type: "assembly" });
  s.tasks = [{ kind: "pension", p: 0, used: [], remaining: 1 }];
  verify(s, { type: "pension", good: "corn" });
});
test("action previews include Festival VP earned by production, shipping and plantations", () => {
  const festival = (goal, targets) => ({ id: "twins", goal, targets: { goods: [], estates: [], ...targets }, reward: { vp: 3 }, amount: 1 });
  const produced = fixture("craftsman");
  produced.players[0].estates = [{ id: "corn", w: 1, c: 0 }];
  produced.festivals = [festival("produce", { goods: ["corn"] })];
  verify(produced, E.legal(produced).find((m) => m.type === "produce" && !m.decline));
  const shipped = fixture("captain");
  shipped.tasks = [{ kind: "ship", p: 0 }];
  shipped.players[0].goods.corn = 2;
  shipped.festivals = [festival("ship", { goods: ["corn"] })];
  verify(shipped, { type: "ship", good: "corn", ship: 0 });
  const planted = fixture("planter");
  planted.players[0].estates = [];
  planted.offer = ["fruit"];
  planted.festivals = [festival("estates", { estates: ["fruit"] })];
  verify(planted, { type: "plant", id: "fruit" });
});
