import test from "node:test";
import assert from "node:assert/strict";
import * as host from "../bgs/engine.js";
import * as game from "../engine/index.js";
import { BUILDINGS, GOODS, ROLES } from "../engine/catalog.js";
import {
  achievementManifestSchema,
  achievementResultsSchema,
} from "@boardgamers/protocol/achievements";

function finish(s, move = game.moveAI) {
  for (let n = 0; !s.finished && n < 3000; n++) s = move(s);
  assert.equal(s.finished, true);
  return s;
}
// Actual legal games, not a fabricated finished flag. Boundary tests clone these.
const completed = finish(host.init(3, [], {}, "badge-fixture"));
const solo = finish(host.init(1, [], {}, "badge-solo"), host.moveAI);
const has = (s, id, seat = 0) =>
  host
    .achievements(s)
    .find((r) => r.seat === seat)
    ?.earned.includes(id) ?? false;

test("official schemas, stable manifest, real completed fixtures, replay and purity", () => {
  const manifest = host.achievementDefinitions();
  achievementManifestSchema.parse(manifest);
  assert.equal(manifest.revision, 1);
  assert.equal(manifest.achievements.length, 14);
  assert(
    !manifest.achievements.some(({ id }) =>
      ["puertoma-easy", "puertoma-hard"].includes(id),
    ),
  );
  for (const s of [completed, solo]) {
    const before = structuredClone(s);
    const results = host.achievements(s);
    achievementResultsSchema(manifest, s === solo ? 1 : 3).parse(results);
    assert.deepEqual(host.achievements(s), results);
    assert.deepEqual(host.achievements(game.replay(s)), results);
    assert.deepEqual(s, before);
  }
  manifest.achievements.length = 0;
  assert.equal(host.achievementDefinitions().achievements.length, 14);
});

test("all means this seat's entire nonempty active set, not the table or the deck", () => {
  const s = structuredClone(completed);
  s.festivals.forEach((f) => (f.claimed = 0));
  s.players[0].achievements.forEach((c) => (c.completed = true));
  assert(has(s, "all-festival-objectives"));
  assert(has(s, "all-personal-achievements"));
  assert(!has(s, "all-festival-objectives", 1));
  s.festivals[0].claimed = 1;
  s.players[0].achievements[0].completed = false;
  assert(!has(s, "all-festival-objectives"));
  assert(!has(s, "all-personal-achievements"));
  assert(has(s, "festival-claim"));
  assert(has(s, "personal-achievement"));
  delete s.festivals[0].claimed;
  assert(!has(s, "all-festival-objectives"));
  s.festivals = [];
  s.players[0].achievements = [];
  assert(!has(s, "all-festival-objectives"));
  assert(!has(s, "all-personal-achievements"));
});

test("disabled variants never award objective badges, even with stale completed data", () => {
  const s = structuredClone(completed);
  s.festivals.forEach((f) => (f.claimed = 0));
  s.players[0].achievements.forEach((c) => (c.completed = true));
  s.expansions = [];
  for (const id of [
    "all-festival-objectives",
    "all-personal-achievements",
    "festival-claim",
    "personal-achievement",
  ])
    assert(!has(s, id));
  for (const expansion of ["festival", "festival-cards"]) {
    s.expansions = [expansion];
    assert(has(s, "all-festival-objectives"));
  }
});

test("only naturally finished games; analysis marker survives moves and replay", () => {
  assert.deepEqual(host.achievements(host.init(3, [], {}, "live")), []);
  for (const patch of [
    { finished: false },
    { endReason: "cancelled" },
    { tasks: [{ kind: "role" }] },
    { tutorial: {} },
    { practice: true },
    { cancelled: true },
    { canceled: true },
    { analysis: true },
  ])
    assert.deepEqual(host.achievements({ ...completed, ...patch }), []);
  const analysis = host.createAnalysis(completed);
  assert.deepEqual(host.achievements(analysis), []);
  assert.deepEqual(host.achievements(game.replay(analysis)), []);
  const branch = game.createAnalysis(completed, { to: 1 });
  const advanced = game.moveAI(branch);
  assert.equal(advanced.analysis, true);
  assert.equal(game.replay(advanced).analysis, true);
});

test("solo outcomes explicitly compare both virtual opponents including tie breakers", () => {
  for (const difficulty of ["easy", "normal", "hard"]) {
    const s = structuredClone(solo);
    s.puertoma.difficulty = difficulty;
    s.players[0].vp = 1000;
    assert.equal(host.achievements(s).length, 1);
    assert.equal(host.achievements(s)[0].outcome, "win");
    assert.equal(has(s, "puertoma-normal"), difficulty === "normal");
    assert(!has(s, "puertoma-easy"));
    assert(!has(s, "puertoma-hard"));
    achievementResultsSchema(host.achievementDefinitions(), 1).parse(
      host.achievements(s),
    );
    assert(!has(s, "island-victory"));
    s.players[1].vp = 2000;
    assert.equal(host.achievements(s)[0].outcome, "loss");
    assert(!has(s, `puertoma-${difficulty}`));
    assert(has(s, "seventy-points")); // Nonwin feats remain independent.
  }
  const s = structuredClone(solo);
  s.players.forEach((p) => {
    p.vp = 0;
    p.buildings = []; // Remove VP-dependent Customs House bonus before fixing a tie.
    p.coins = 0;
    p.goods = {};
  });
  const values = game.scores(s);
  s.players.forEach((p, i) => (p.vp = 100 - values[i]));
  assert.deepEqual(game.scores(s), [100, 100, 100]);
  assert.deepEqual(
    s.players.map((_, seat) => game.scoreBreakdown(s, seat).tie),
    [0, 0, 0],
  );
  assert.equal(host.achievements(s)[0].outcome, "draw");
  assert(!has(s, "puertoma-normal"));
  s.players[0].coins = 1;
  assert.equal(host.achievements(s)[0].outcome, "win");
});

test("multiplayer outcomes and nonwinning badges are seat-local", () => {
  const s = structuredClone(completed);
  s.players.forEach((p) => {
    p.buildings = [];
    p.estates = [];
    p.reserve = { w: 0, c: 0 };
    p.achievements = [];
    p.vp = 70;
    p.coins = 0;
    p.goods = {};
  });
  assert.deepEqual(
    host.achievements(s).map((r) => r.outcome),
    ["draw", "draw", "draw"],
  );
  assert(!has(s, "island-victory"));
  s.players[1].coins = 1;
  assert.deepEqual(
    host.achievements(s).map((r) => r.outcome),
    ["loss", "win", "loss"],
  );
  assert(has(s, "island-victory", 1));
  assert(has(s, "seventy-points", 0));
  assert(!has(s, "puertoma-normal", 1));
});

test("score, city, island, building, crop, treasury and role boundaries", () => {
  const s = structuredClone(completed),
    a = s.players[0];
  a.buildings = [];
  a.estates = [];
  a.reserve = { w: 0, c: 0 };
  a.achievements = [];
  for (const [points, expected] of [
    [49, []],
    [50, ["fifty-points"]],
    [69, ["fifty-points"]],
    [70, ["fifty-points", "seventy-points"]],
  ]) {
    a.vp = points;
    for (const id of ["fifty-points", "seventy-points"])
      assert.equal(has(s, id), expected.includes(id));
  }
  a.coins = 19;
  assert(!has(s, "twenty-coins"));
  a.coins = 20;
  assert(has(s, "twenty-coins"));
  const large = Object.values(BUILDINGS).filter((b) => b.size === 2);
  a.buildings = large.slice(0, 1).map((b) => ({ id: b.id, w: 0, c: 0 }));
  assert(!has(s, "expanded-city"));
  a.buildings = large.slice(0, 6).map((b) => ({ id: b.id, w: 0, c: 0 }));
  assert(has(s, "expanded-city"));
  assert(has(s, "full-city"));
  a.buildings.pop();
  assert(!has(s, "full-city"));
  a.estates = GOODS.map((id) => ({ id, w: 0, c: 0 }));
  assert(has(s, "five-crop-estates"));
  a.estates.pop();
  assert(!has(s, "five-crop-estates"));
  a.estates = Array.from({ length: 11 }, () => ({ id: "corn", w: 0, c: 0 }));
  assert(!has(s, "full-island"));
  a.estates.push({ id: "corn", w: 0, c: 0 });
  assert(has(s, "full-island"));
  s.history = ROLES.map((id) => ({ p: 0, move: { type: "role", id } }));
  assert(has(s, "six-core-roles"));
  s.history.pop();
  assert(!has(s, "six-core-roles"));
});
