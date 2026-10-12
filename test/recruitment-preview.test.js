import test from "node:test";
import assert from "node:assert/strict";
import { recruitmentShares, recruitmentBonus } from "../viewer/recruitment.js";

test("recruitment preview distributes the mixed register starting at the chooser", () => {
  const state = {
    players: Array.from({ length: 3 }, () => ({ buildings: [] })),
    register: { w: 3, c: 2 },
    workerSupply: 10,
  };
  assert.deepEqual(recruitmentShares(state, 1), [1, 2, 2]);
  assert.equal(recruitmentBonus(state, 1), 1);
  state.players[1].buildings.push({ id: "publishingHouse", w: 1, c: 0 });
  assert.equal(recruitmentBonus(state, 1), 2);
  state.workerSupply = 1;
  assert.equal(recruitmentBonus(state, 1), 1);
  state.workerSupply = 0;
  assert.equal(recruitmentBonus(state, 1), 0);
  state.register = { w: 0, c: 0 };
  assert.deepEqual(recruitmentShares(state, 1), [0, 0, 0]);
});
