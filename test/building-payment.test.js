import test from "node:test";
import assert from "node:assert/strict";
import { showBuildingPayment } from "../viewer/building-payment.js";

test("higher prices appear only when they complete an unfinished Big Spender", () => {
  const player = {
    coins: 10,
    achievements: [{ id: "bigSpender", completed: false }],
  };
  const move = { type: "build", id: "fireStation", pay: 10 };
  assert.equal(showBuildingPayment(player, move), true);
  assert.equal(showBuildingPayment(player, { ...move, pay: 9 }), false);
  assert.equal(
    showBuildingPayment(player, { ...move, id: "smallFruit" }),
    false,
  );
  assert.equal(
    showBuildingPayment({ ...player, achievements: [] }, move),
    false,
  );
  assert.equal(
    showBuildingPayment(
      { ...player, achievements: [{ id: "bigSpender", completed: true }] },
      move,
    ),
    false,
  );
  assert.equal(
    showBuildingPayment(player, { type: "build", id: "fireStation" }),
    true,
  );
});

test("historical quarry overpayments remain replayable but cannot be submitted now", async () => {
  const E = await import("../engine/index.js");
  let s = E.init(3, [], {}, "historic-payment");
  for (let n = 0; n < 200 && !s.finished; n++) {
    const p = E.currentPlayer(s);
    if (s.tasks[0].kind === "build") {
      const legal = E.legal(s, p);
      const old = E.buildOptions(s, p, true).find(
        (m) =>
          m.pay && !legal.some((x) => JSON.stringify(m) === JSON.stringify(x)),
      );
      if (old) {
        assert.throws(() => E.move(s, old, p));
        const saved = { ...s, history: [...s.history, { p, move: old }] };
        const replayed = E.replay(saved);
        assert.equal(replayed.players[p].coins, s.players[p].coins - old.pay);
        assert.ok(replayed.players[p].buildings.some((b) => b.id === old.id));
        assert.equal(
          E.logSlice(saved, { player: p }).frames.length,
          E.logLength(saved),
        );
        return;
      }
    }
    s = E.moveAI(s, p);
  }
  assert.fail("Expected a historical quarry payment fixture");
});
