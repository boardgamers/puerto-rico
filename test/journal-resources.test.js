import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../engine/index.js";
import { RELEASE } from "../release-config.js";
import { GOODS } from "../engine/catalog.js";
import { journalContent } from "../viewer/journal.js";
import { translator } from "../viewer/i18n.js";

function ready(seed = "journal-resources") {
  let s = E.init(3, RELEASE.expansions, RELEASE.options, seed);
  while (s.tasks[0].kind === "draft") s = E.moveAI(s);
  return s;
}
test("captured-role payment records the recipient, amount and source", () => {
  let s = ready();
  s.captured = { id: "builder", p: 1 };
  const before = s.players[1].coins;
  s = E.move(s, { type: "role", id: "builder" }, 0);
  assert.equal(s.players[1].coins, before + 3);
  const e = s.events.find(
    (e) => e.type === "income" && e.source === "smuggler",
  );
  assert.equal(e.p, 1);
  assert.equal(e.coins, 3);
  assert.equal(e.capturedRole, "builder");
  const html = journalContent({ ...s, events: [e] }, translator("en"));
  assert.match(html, /Smuggler/);
  assert.match(html, /Builder/);
  assert.match(html, /\+3/);
});
test("Lighthouse Captain privilege is recorded once", () => {
  let s = ready();
  s.players[0].buildings.push({ id: "lighthouse", w: 1, c: 0 });
  const before = s.players[0].coins;
  s = E.move(s, { type: "role", id: "captain" }, 0);
  assert.equal(s.players[0].coins, before + 1);
  assert.equal(
    s.events.filter((e) => e.type === "income" && e.source === "lighthouse")
      .length,
    1,
  );
});

for (const seed of ["ledger-one", "ledger-two", "ledger-three"])
  test(`resource changes reconcile with journal events: ${seed}`, () => {
    let s = ready(seed),
      turn = 0;
    while (!s.finished && turn++ < 3000) {
      // Keep only this move's events for accounting; the game still uses its history.
      s.events = [];
      const before = s;
      s = E.moveAI(s);
      for (let p = 0; p < s.players.length; p++) {
        const events = s.events.filter((e) => e.p === p);
        const coins = events.reduce(
          (n, e) => n + (e.coins ?? 0) + (e.reward?.coins ?? 0),
          0,
        );
        const vp = events.reduce(
          (n, e) =>
            n +
            (e.vp ?? 0) +
            (e.reward?.vp ?? 0) -
            (e.type === "build" ? (e.point ?? 0) : 0),
          0,
        );
        assert.equal(
          s.players[p].coins - before.players[p].coins,
          coins,
          `coins: turn ${turn}, seat ${p}, ${JSON.stringify(events)}`,
        );
        assert.equal(
          s.players[p].vp - before.players[p].vp,
          vp,
          `VP: turn ${turn}, seat ${p}, ${JSON.stringify(events)}`,
        );
        for (const kind of ["w", "c"]) {
          const count = (a) =>
            a.reserve[kind] +
            [...a.estates, ...a.buildings].reduce((n, x) => n + x[kind], 0);
          const delta = events.reduce((n, e) => {
            if (
              [
                "hospital",
                "school",
                "recruitBonus",
                "recruit",
                "villa",
                "poachWorker",
              ].includes(e.type) &&
              (e.kind ?? "w") === kind
            )
              n += e.amount ?? 1;
            if (kind === "w")
              n +=
                (e.reward?.workers ?? 0) +
                (e.type === "puertomaBonus" ? (e.workers ?? 0) : 0);
            if (e.type === "build" && e.worker?.kind === kind) n--;
            return n;
          }, 0);
          assert.equal(
            count(s.players[p]) - count(before.players[p]),
            delta,
            `people ${kind}: turn ${turn}, seat ${p}, ${JSON.stringify(events)}`,
          );
        }
        for (const good of GOODS) {
          const delta = events.reduce((n, e) => {
            if (["produce", "puertomaBonus"].includes(e.type))
              n += e.goods?.[good] ?? 0;
            if (e.type === "produceBonus" && e.good === good) n++;
            if (e.type === "raid" && e.good === good) n += e.amount;
            if (
              ["trade", "pension", "build"].includes(e.type) &&
              e.good === good
            )
              n--;
            if (["ship", "smallWharf"].includes(e.type))
              n -= e.goods?.[good] ?? 0;
            if (e.type === "store") n -= e.lost?.[good] ?? 0;
            return n;
          }, 0);
          assert.equal(
            s.players[p].goods[good] - before.players[p].goods[good],
            delta,
            `${good}: turn ${turn}, seat ${p}, ${JSON.stringify(events)}`,
          );
        }
      }
    }
    assert.ok(s.finished);
  });
