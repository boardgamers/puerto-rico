import test from "node:test";
import assert from "node:assert/strict";
import * as host from "../bgs/engine.js";
import * as game from "../engine/index.js";
test("VP visibility is opt-in, including for spectators, without exposing secret cards", () => {
  for (const option of [undefined, false, true, "true"]) {
    const s = host.init(3, [], { showVP: option }, "vp-visibility");
    s.players[1].vp = 12;
    for (const viewer of [0, undefined]) {
      const view = game.stripSecret(s, viewer);
      assert.equal(view.players[1].vp, option === true ? 12 : null);
      assert(view.players[1].achievements.every((c) => c.hidden));
      assert.equal(s.players[1].vp, 12);
    }
    assert.equal(game.stripSecret(s, 1).players[1].vp, 12);
  }
});
test("visible VP setup is preserved through replay and secret defaults remain off", () => {
  const s = host.init(3, [], { showVP: true }, "vp-replay");
  assert.equal(game.replay(s).options.showVP, true);
  assert(
    game
      .logSlice(s, { player: 0 })
      .frames.every((frame) =>
        frame.players.every((p) => Number.isFinite(p.vp)),
      ),
  );
  assert.equal(host.init(3, [], {}, "vp-default").options.showVP, false);
});
