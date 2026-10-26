import assert from "node:assert/strict";
import { test } from "node:test";
import { buildingEffects } from "../viewer/building-effects.js";
const goods = { corn: 0, fruit: 0, sugar: 0, tobacco: 0, coffee: 0 };
function fixture() {
  const p = {
    reserve: { w: 1, c: 2 },
    vp: 5,
    goods: { ...goods },
    estates: [
      ...Array.from({ length: 4 }, () => ({ id: "fruit", w: 1, c: 0 })),
      { id: "sugar", w: 1, c: 0 },
    ],
    buildings: [
      { id: "smallFruit", w: 1, c: 0 },
      { id: "largeFruit", w: 2, c: 0 },
      { id: "largeSugar", w: 1, c: 0 },
      { id: "canal", w: 1, c: 0 },
      { id: "townSquare", w: 0, c: 0 },
      { id: "hiddenMarket", w: 1, c: 0 },
    ],
  };
  return {
    players: [p],
    expansions: [],
    options: {},
    supply: { corn: 10, fruit: 10, sugar: 10, tobacco: 10, coffee: 10 },
  };
}
test("production is allocated once across depots and Canal is separate", () => {
  const s = fixture();
  let b = buildingEffects(s, 0);
  assert.equal(b[0].items[0].value, 1);
  assert.equal(b[1].items[0].value, 2);
  assert.deepEqual(
    b[3].items.map((x) => [x.icon, x.value]),
    [
      ["fruit", 1],
      ["sugar", 1],
    ],
  );
  s.supply.fruit = 2;
  b = buildingEffects(s, 0);
  assert.equal(b[0].items[0].value + b[1].items[0].value, 2);
  assert.equal(b[3].items[0].value, 0);
});
test("unstaffed score bonus is dimmed, without changing printed points or citizen count", () => {
  const s = fixture();
  assert.deepEqual(buildingEffects(s, 0)[4], {
    enabled: false,
    items: [{ icon: "vp", value: 2, sign: "+" }],
  });
  s.players[0].buildings[4].w = 1;
  assert.equal(buildingEffects(s, 0)[4].enabled, true);
  assert.equal(buildingEffects(s, 0)[4].items[0].value, 2);
});
test("Hidden Market counts usable payment categories and protects its own worker", () => {
  const s = fixture();
  assert.equal(buildingEffects(s, 0)[5].items[0].value, 2);
  s.players[0].goods.fruit = 1;
  assert.equal(buildingEffects(s, 0)[5].items[0].value, 3);
  s.players[0].reserve = { w: 0, c: 0 };
  s.players[0].estates = [];
  s.players[0].buildings = s.players[0].buildings.slice(5);
  assert.equal(buildingEffects(s, 0)[0].items[0].value, 2);
  s.players[0].vp = null;
  assert.equal(buildingEffects(s, 0)[0].items[0].value, "?");
});
test("empty production building shows available potential but stays inactive", () => {
  const s = fixture();
  s.players[0].buildings[1].w = 0;
  const b = buildingEffects(s, 0);
  assert.equal(b[1].enabled, false);
  assert.equal(b[1].items[0].value, 3);
  assert.equal(b[3].items[0].value, 0);
});
