// Deterministic, non-ending fixture; no server/sandbox queue time is included.
import { performance } from "node:perf_hooks";
import * as E from "../engine/index.js";

let s = E.init(3, [], {}, "bounded-journal");
for (let i = 0; i < 450; i++) {
  const moves = E.legal(s);
  const m =
    moves.find((m) => m.type === "pass") ??
    moves.find(
      (m) =>
        m.type === "role" &&
        ["settler", "craftsman", "trader", "builder"].includes(m.id),
    ) ??
    moves[0];
  s = E.move(s, m, E.currentPlayer(s));
}
const player = s.history[448].p;
console.log(
  `Node ${process.version}; ${s.history.length} moves / ${E.logLength(s)} frames; seat ${player}`,
);
const cases = {
  replay: () => E.replay(s),
  lateTwoFrames: () => E.logSlice(s, { player, start: 449, end: 450 }),
  latestFrame: () => E.logSlice(s, { player, start: 450 }),
  setPlayerMetaData: () =>
    E.setPlayerMetaData(s, player, { name: "Benchmark" }),
};
for (const [name, run] of Object.entries(cases)) {
  run();
  const samples = Array.from({ length: 5 }, () => {
    const start = performance.now();
    run();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  console.log(
    `${name}: median ${samples[2].toFixed(2)} ms (range ${samples[0].toFixed(2)}–${samples[4].toFixed(2)})`,
  );
}
