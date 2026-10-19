import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTutorial } from "@boardgamers/protocol/tutorial";
import * as engine from "../engine/index.js";
import { BUILDINGS, CRATES, ESTATES, GOODS } from "../engine/catalog.js";
import {
  chapters,
  chapterIds,
  expectedMove,
  tutorialOptions,
} from "../tutorial/scenarios.js";

const english = JSON.parse(
  readFileSync(new URL("../tutorial/locales/en.json", import.meta.url)),
);
const translate = (key) => {
  assert.equal(typeof english[key], "string", `Missing tutorial text ${key}`);
  return english[key];
};
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const clone = (x) => structuredClone(x);

function conserved(state) {
  const tiles = state.players.flatMap((p) => [...p.estates, ...p.buildings]);
  for (const good of GOODS) {
    assert.equal(
      state.supply[good] +
        sum(state.players.map((p) => p.goods[good])) +
        sum(
          state.ships
            .filter((ship) => ship.good === good)
            .map((ship) => ship.amount),
        ) +
        state.trade.filter((g) => g === good).length +
        (state.privateCargo?.[good] ?? 0) +
        sum(
          state.festivals
            .filter((f) => f.claimed === undefined)
            .map((f) => f.targets.goods.filter((g) => g === good).length),
        ),
      CRATES[good],
      `${state.tutorial.id}: ${good} crates are conserved`,
    );
    assert.equal(
      [...state.bag, ...state.offer, ...state.discard].filter((g) => g === good)
        .length +
        sum(
          state.players.map(
            (p) => p.estates.filter((e) => (e.source ?? e.id) === good).length,
          ),
        ) +
        sum(
          state.festivals
            .filter((f) => f.claimed === undefined)
            .map((f) => f.targets.estates.filter((g) => g === good).length),
        ),
      ESTATES[good],
      `${state.tutorial.id}: ${good} plantations are conserved`,
    );
  }
  for (const [kind, supply, total] of [
    ["w", "workerSupply", 58],
    ["c", "citizenSupply", state.expansions.includes("citizens") ? 20 : 0],
  ]) {
    assert.equal(
      state[supply] +
        state.register[kind] +
        sum(tiles.map((tile) => tile[kind])) +
        sum(state.players.map((p) => p.reserve[kind])) +
        (state.discardedPeople?.[kind] ?? 0),
      total,
    );
  }
  assert.equal(state.vpSupply + sum(state.players.map((p) => p.vp)), 75);
  for (const player of state.players) {
    assert(player.estates.length <= 12);
    assert(engine.citySize(player) <= 12);
    assert.equal(
      new Set(player.buildings.map((b) => b.id)).size,
      player.buildings.length,
    );
    for (const tile of player.estates)
      assert(tile.w + tile.c <= (tile.id === "forest" ? 0 : 1));
    for (const tile of player.buildings)
      assert(tile.w + tile.c <= BUILDINGS[tile.id].workers);
  }
  for (const [id, amount] of Object.entries(state.market)) {
    assert.equal(
      amount +
        state.players.reduce(
          (count, p) => count + p.buildings.filter((b) => b.id === id).length,
          0,
        ),
      BUILDINGS[id].copies,
    );
  }
  assert(
    Object.values(state.supply).every((n) => Number.isInteger(n) && n >= 0),
  );
  for (const ship of state.ships)
    assert(ship.amount >= 0 && ship.amount <= ship.capacity);
}

function playChapter(id) {
  const chapter = chapters[id];
  let state = chapter.initialState();
  const frames = [clone(state)];
  for (const step of chapter.steps) {
    conserved(state);
    assert.equal(engine.currentPlayer(state), 0);
    const move = expectedMove(state);
    assert.equal(step.validateMove(state, move), undefined);
    const before = clone(state);
    state = chapter.move(state, move);
    assert.deepEqual(before, frames.at(-1), "move leaves its input untouched");
    assert(step.complete(state));
    assert.equal(
      state.history.filter((h) => h.p === 0 && h.move.type !== "pass").length,
      state.tutorial.completed,
      "learner actions are scripted; redundant passes may resolve automatically",
    );
    frames.push(clone(state));
  }
  conserved(state);
  return frames;
}

for (const id of chapterIds) {
  test(`tutorial ${id}: legal complete walkthrough, conservation and deterministic replay`, () => {
    const first = playChapter(id);
    assert.deepEqual(playChapter(id), first);
    const options = tutorialOptions(id, translate);
    assert.equal(
      options.steps.length,
      chapters[id].steps.length + (id === "basics" ? 2 : 0),
    );
    assert(
      options.steps
        .filter((s) => !["intro", "round"].includes(s.id))
        .every(
          (s) => s.complete && s.validateMove && s.title && s.text && s.hint,
        ),
    );
    for (const state of first) {
      const view = engine.stripSecret(state, 0);
      assert.equal(view.history, undefined);
      assert.equal(view.random, undefined);
      assert.equal(view.config, undefined);
      assert.equal(view.bag, undefined);
      assert(view.players.slice(1).every((p) => p.vp === null));
    }
  });

  test(`tutorial ${id}: rejects off-lesson moves; retry, previous and stored replay use actual moves`, async () => {
    const memory = new Map();
    const storage = {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
    };
    const options = { ...tutorialOptions(id, translate), storage };
    const tutorial = await createTutorial(options);
    if (id === "basics") {
      const introState = clone(tutorial.snapshot.state);
      assert.equal(tutorial.snapshot.canContinue, true);
      assert.equal(await tutorial.continue(), true);
      assert.equal(await tutorial.continue(), true);
      assert.deepEqual(tutorial.snapshot.state, introState);
    }
    for (let index = 0; index < chapters[id].steps.length; index++) {
      const before = clone(tutorial.snapshot.state);
      const stepBefore = tutorial.snapshot.step;
      const wrong =
        expectedMove(before).type === "pass"
          ? { type: "role", id: "builder" }
          : { type: "pass" };
      assert.equal(await tutorial.play(wrong), false);
      assert.equal(tutorial.snapshot.error, translate("tutorial.error.move"));
      assert.equal(tutorial.snapshot.step, stepBefore);
      assert.deepEqual(tutorial.snapshot.state, before);
      assert.throws(
        () => chapters[id].move(before, wrong),
        /tutorial.error.move/,
      );
      await tutorial.restartStep();
      assert.deepEqual(tutorial.snapshot.state, before);
      assert.equal(await tutorial.play(expectedMove(before)), true);
      const after = clone(tutorial.snapshot.state);
      await tutorial.previousStep();
      assert.deepEqual(tutorial.snapshot.state, before);
      assert.equal(await tutorial.play(expectedMove(before)), true);
      assert.deepEqual(tutorial.snapshot.state, after);
    }
    assert(tutorial.snapshot.completed);
    const restored = await createTutorial(options);
    assert(restored.snapshot.completed);
    assert.deepEqual(restored.snapshot.state, tutorial.snapshot.state);
    assert.deepEqual(
      JSON.parse([...memory.values()][0]).history.length,
      options.steps.length,
    );
    await restored.restart();
    assert.deepEqual(restored.snapshot.state, chapters[id].initialState());
    tutorial.destroy();
    restored.destroy();
  });
}

test("basics demonstrates accumulated role coins, production, privilege and unchosen role income", () => {
  const [start, role, produced, bonus, sold] = playChapter("basics");
  assert.equal(role.players[0].coins, start.players[0].coins + 2);
  assert.equal(produced.players[0].goods.corn, 1);
  assert.equal(produced.players[0].goods.fruit, 1);
  assert.equal(bonus.players[0].goods.fruit, 2);
  assert.equal(bonus.round, start.round + 1);
  assert.equal(bonus.governor, (start.governor + 1) % start.players.length);
  assert.equal(bonus.roles.find((r) => r.id === "builder").coins, 1);
  assert.equal(bonus.roles.find((r) => r.id === "craftsman").coins, 0);
  assert.equal(sold.players[0].coins, bonus.players[0].coins + 1);
});

test("shipping enforces single-type ships, mandatory loading and base storage", () => {
  const [, role, storage, ended] = playChapter("shipping");
  assert(!engine.legal(role).some((move) => move.type === "pass"));
  assert(!engine.legal(role).some((move) => move.good === "coffee"));
  assert.throws(() => engine.move(role, { type: "pass" }, 0));
  assert.throws(() =>
    engine.move(role, { type: "ship", ship: 1, good: "coffee" }, 0),
  );
  assert.equal(storage.ships[0].amount, 4);
  assert.equal(storage.players[0].vp, 3);
  assert.equal(storage.tasks[0].kind, "store");
  assert(storage.history.some((h) => h.p === 0 && h.move.type === "pass"));
  assert.throws(() =>
    engine.move(
      storage,
      { type: "store", types: [], goods: { ...storage.players[0].goods } },
      0,
    ),
  );
  assert.equal(ended.players[0].goods.coffee, 1);
  assert.equal(sum(Object.values(ended.players[0].goods)), 1);
  assert.equal(ended.ships[0].amount, 0);
  assert.equal(ended.ships[1].amount, 4);
});

test("citizens work like workers but change Chapel and Notary effects", () => {
  const [, assigned, produced, built] = playChapter("citizens");
  assert.equal(produced.players[0].vp, assigned.players[0].vp + 1);
  assert.equal(engine.cost(produced, 0, "cityHall"), 8);
  assert.equal(built.players[0].coins, 2);
  const alternate = clone(assigned);
  for (const tile of [
    ...alternate.players[0].estates,
    ...alternate.players[0].buildings,
  ]) {
    const tmp = tile.w;
    tile.w = tile.c;
    tile.c = tmp;
  }
  assert.deepEqual(
    engine.production(alternate.players[0]),
    engine.production(assigned.players[0]),
  );
  assert.equal(engine.cost(alternate, 0, "cityHall"), 10);
  assert.equal(engine.cost(alternate, 0, "smallMarket"), 0);
  const workerChapel = engine.move(alternate, expectedMove(assigned), 0);
  assert.equal(workerChapel.players[0].coins, assigned.players[0].coins + 1);
  assert.equal(workerChapel.players[0].vp, assigned.players[0].vp);
});

test("coffee shortage is real: raid frees supply and objective completion returns reserved markers", () => {
  const [start, , raid, completed] = playChapter("coffee");
  assert.equal(start.supply.coffee, 0);
  assert.equal(start.ships[2].capacity, 6);
  assert.equal(start.ships[2].amount, 5);
  assert.equal(
    start.festivals.reduce(
      (n, f) => n + f.targets.goods.filter((g) => g === "coffee").length,
      0,
    ),
    4,
  );
  assert.equal(raid.players[0].goods.coffee, 3);
  assert.equal(raid.supply.coffee, 2);
  assert.equal(raid.ships[2].amount, 0);
  assert.equal(raid.ships[2].good, null);
  assert.equal(completed.players[0].goods.coffee, 5);
  assert.equal(completed.festivals.find((f) => f.id === "cocktail").claimed, 0);
  assert.equal(completed.supply.coffee, 2);
  assert.equal(completed.players[0].coins, start.players[0].coins + 3);
  assert.equal(
    completed.festivals.filter((f) => f.claimed === undefined).length,
    2,
  );
});
