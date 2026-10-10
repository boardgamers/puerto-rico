import test from "node:test";
import assert from "node:assert/strict";
import { achievementProgress as progress } from "../viewer/achievement-progress.js";
const state = () => ({
  players: [
    {
      goods: { corn: 0, fruit: 0, sugar: 0, tobacco: 0, coffee: 5 },
      estates: [],
      buildings: [],
    },
  ],
  role: "craftsman",
  production: [{ coffee: 3 }],
  phaseVP: [5],
});
test("paired goods expose the missing second type even when the total is reached", () => {
  assert.deepEqual(
    progress(state(), 0, { id: "luxuryCropTrader" }).map((r) => [
      r.value,
      r.target,
    ]),
    [
      [5, 5],
      [1, 1],
      [0, 1],
    ],
  );
});
test("phase progress resets outside its phase and completed cards stay completed", () => {
  const s = state();
  assert.equal(progress(s, 0, { id: "leadingProducer" })[0].value, 3);
  s.role = "builder";
  assert.equal(progress(s, 0, { id: "leadingProducer" })[0].value, 0);
  assert.equal(
    progress(s, 0, { id: "leadingProducer", completed: true })[0].value,
    7,
  );
});
test("action objectives cannot be fulfilled by stock alone and hidden cards expose nothing", () => {
  assert.equal(progress(state(), 0, { id: "coffeeDispatcher" })[0].value, 0);
  assert.deepEqual(progress(state(), 0, { hidden: true }), []);
});
