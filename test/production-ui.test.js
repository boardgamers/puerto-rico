import test from "node:test";
import assert from "node:assert/strict";
import { productionLines } from "../viewer/production.js";
import { translator } from "../viewer/i18n.js";
import { richText, plainText } from "../viewer/rich-text.js";
import { icon } from "../viewer/icons.js";
const supply = { corn: 10, fruit: 11, sugar: 11, tobacco: 9, coffee: 9 };
const tile = (id, w = 0, c = 0) => ({ id, w, c });
const player = (estates, buildings = []) => ({ estates, buildings });

test("fruit plantation and production building each require staff", () => {
  const p = player([tile("fruit", 1), tile("fruit")]);
  assert.equal(productionLines(p, supply)[0].issue, "needWorkshop");
  p.buildings.push(tile("smallFruit"));
  assert.equal(productionLines(p, supply)[0].issue, "staffWorkshop");
  p.buildings[0].w = 1;
  assert.equal(productionLines(p, supply)[0].available, 1);
  p.estates[1].w = 1;
  assert.equal(productionLines(p, supply)[0].capacity, 1);
  p.estates.forEach((e) => (e.w = 0));
  assert.equal(productionLines(p, supply)[0].issue, "staffPlantation");
});
test("building alone cannot produce; corn requires no production building", () => {
  assert.equal(
    productionLines(player([], [tile("smallFruit", 1)]), supply)[0].issue,
    "needPlantation",
  );
  const line = productionLines(player([tile("corn", 1)]), supply)[0];
  assert.equal(line.available, 1);
  assert.equal(line.issue, "productionReady");
});
test("capacity includes occupied Canal and citizen workers, while output respects supply", () => {
  const p = player(
    [tile("fruit", 1), tile("fruit", 0, 1)],
    [tile("largeFruit", 2), tile("canal", 1)],
  );
  const line = productionLines(p, { ...supply, fruit: 1 })[0];
  assert.equal(line.capacity, 3);
  assert.equal(line.available, 1);
  assert.equal(line.issue, "limitedSupply");
  assert.equal(line.farms, 2);
});
test("empty and Puertoma boards do not get human production explanations", () => {
  assert.deepEqual(productionLines(player([]), supply), []);
  assert.deepEqual(
    productionLines({ ...player([]), puertoma: {} }, supply),
    [],
  );
});
test("generic goods have readable names and field/workshop silhouettes are distinct", () => {
  assert.equal(plainText("{crate:2}", true), "2 marchandises");
  assert.match(richText("{crate:1}", true), /symbol-word.*marchandise/);
  assert.notEqual(icon("field-fruit"), icon("fruit"));
  assert.notEqual(icon("workshop-fruit"), icon("fruit"));
  assert.match(translator("fr").roleAction("craftsman"), /plantations/);
});
