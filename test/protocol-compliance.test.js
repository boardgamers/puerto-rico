import test from "node:test";
import assert from "node:assert/strict";
import { inspectEngine } from "@boardgamers/protocol/engine";
import * as E from "../engine/index.js";
import * as host from "../bgs/engine.js";
import { tokenSources } from "../viewer/score.js";

function passiveMove(s) {
  const moves = E.legal(s);
  return (
    moves.find((m) => m.type === "pass") ??
    moves.find(
      (m) =>
        m.type === "role" &&
        ["settler", "craftsman", "trader", "builder"].includes(m.id),
    ) ??
    moves[0]
  );
}

test("BGS required engine methods and history boundaries conform to the protocol", () => {
  assert.equal(inspectEngine(host).compatible, true);
  let s = host.init(3, [], {}, "protocol-boundaries");
  for (let i = 0; i < 12; i++) s = host.moveAI(s);
  const before = structuredClone(s);
  const count = host.logLength(s);
  const frames = host.logSlice(s, {
    player: 0,
    start: count - 3,
    end: count - 1,
  }).frames;
  assert.equal(frames.length, 3);
  for (let i = 0; i < frames.length; i++)
    assert.deepEqual(
      frames[i],
      host.stripSecret(host.replay(s, { to: count - 2 + i }), 0),
    );
  assert.deepEqual(host.replay(s), s);
  assert.deepEqual(host.logSlice(s, { start: count, end: count }).frames, []);
  for (const to of [0, -1, count + 1, NaN, 1.5])
    assert.throws(() => host.replay(s, { to }), { name: "InvalidMoveError" });
  assert.throws(() => host.logSlice(s, { start: 0.5 }));
  assert.deepEqual(s, before);
});

test("historical views keep private state out of player and spectator payloads", () => {
  const s = host.init(3, [], {}, "protocol-privacy");
  for (const player of [undefined, 0, 1]) {
    const view = host.logSlice(s, { player, start: host.logLength(s) - 1 })
      .frames[0];
    for (const field of ["history", "config", "random", "bag", "discard"])
      assert.equal(view[field], undefined);
    view.players.forEach((p, seat) => {
      if (seat === player) return;
      assert.equal(p.vp, null);
      assert((p.achievements ?? []).every((c) => c.completed || c.hidden));
      assert((p.achievementOffer ?? []).every((c) => c === null));
    });
  }
  assert.equal(host.canLaunchAnalysisMode(s), false);
});

test("analysis forks disable live automation and undo does not retain abandoned branches", () => {
  let s = E.init(3, [], {}, "analysis-branch");
  s = E.setPlayerSettings(s, 0, { autoForcedActions: true });
  s = E.dropPlayer(s, 1);
  for (let i = 0; i < 8; i++) s = E.move(s, passiveMove(s), E.currentPlayer(s));
  const before = structuredClone(s);
  const to = E.logLength(s) - 3;
  const analysis = E.createAnalysis(s, { to, sourceEnded: true });
  assert.equal(E.logLength(analysis), to);
  assert(
    analysis.players.every((p) => !p.bot && !p.settings.autoForcedActions),
  );
  for (let i = 0; i < 100; i++) {
    const branch = E.move(
      analysis,
      passiveMove(analysis),
      E.currentPlayer(analysis),
    );
    assert.equal(E.logLength(branch), to + 1);
    assert.deepEqual(E.replay(branch, { to }), analysis);
  }
  assert.deepEqual(s, before);
});

test("long pass sequences keep the journal bounded without losing deterministic full replay", () => {
  let s = E.init(3, [], {}, "bounded-journal");
  const initial = structuredClone(s);
  // Include early scoring to verify evicted rows retain their attribution.
  // This isolated fixture tests eviction; replay is verified on real states below.
  const fixture = structuredClone(s);
  fixture.events = Array.from({ length: E.JOURNAL_LIMIT }, (_, i) => ({
    type: "ship",
    p: 0,
    round: 1,
    goods: { corn: 1 },
    vp: 2,
  }));
  fixture.players[0].vp = E.JOURNAL_LIMIT * 2;
  const evicted = E.move(fixture, passiveMove(fixture), 0);
  assert.equal(evicted.events.length, E.JOURNAL_LIMIT);
  assert(evicted.eventSummary[0].scoreShipping > 0);
  assert.deepEqual(tokenSources(evicted, 0), [
    { id: "scoreShipping", points: E.JOURNAL_LIMIT },
    { id: "scoreShippingBonus", points: E.JOURNAL_LIMIT },
  ]);
  assert.equal(
    evicted.eventSummary[0].scoreShipping,
    evicted.eventSummary[0].scoreShippingBonus,
  );
  for (let i = 0; i < 450; i++) {
    s = E.move(s, passiveMove(s), E.currentPlayer(s));
    assert(s.events.length <= E.JOURNAL_LIMIT);
  }
  assert.equal(E.logLength(s), 451);
  assert.equal(s.events.length, E.JOURNAL_LIMIT);
  assert.deepEqual(E.replay(s), s);
  assert.deepEqual(E.replay(s, { to: 1 }), initial);
});

test("untrusted oversized moves and invalid seats cannot be retained in the game log", () => {
  const s = E.init(3, [], {}, "protocol-payload");
  const before = structuredClone(s);
  assert.throws(
    () => E.move(s, { ...E.legal(s)[0], unused: "x".repeat(8192) }, 0),
    /too large/,
  );
  for (const p of [-1, 0.5, 3, undefined]) {
    assert.throws(
      () => E.setPlayerMetaData(s, p, { name: "x" }),
      /Invalid player/,
    );
    assert.throws(() => E.dropPlayer(s, p), /Invalid player/);
    assert.throws(() => E.move(s, E.legal(s)[0], p), /Invalid player/);
  }
  assert.deepEqual(s, before);
});

test("lifetime score aggregates follow the same privacy setting as VP counters", () => {
  const s = E.init(3, [], {}, "score-summary-privacy");
  s.eventSummary = { 0: { scoreShipping: 12 }, 1: { scoreShipping: 9 } };
  assert.deepEqual(E.stripSecret(s, 0).eventSummary, {
    0: { scoreShipping: 12 },
  });
  assert.deepEqual(E.stripSecret(s).eventSummary, {});
  s.options.showVP = true;
  assert.deepEqual(E.stripSecret(s).eventSummary, s.eventSummary);
  s.options.showVP = false;
  s.finished = true;
  assert.deepEqual(E.stripSecret(s).eventSummary, s.eventSummary);
});

test("host settings changes never resolve virtual opponents or advance a replay boundary", () => {
  let s = host.init(1, [], {}, "host-settings-boundary");
  for (let i = 0; E.currentPlayer(s) === 0 && i < 100; i++) s = E.moveAI(s);
  assert.notEqual(E.currentPlayer(s), 0);
  assert.equal(E.ended(s), false);
  const before = structuredClone(s);
  const next = host.setPlayerSettings(s, 0, { autoForcedActions: true });
  const expected = structuredClone(s);
  expected.players[0].settings = { autoForcedActions: true };
  assert.deepEqual(next, expected);
  assert.deepEqual(s, before);
});
