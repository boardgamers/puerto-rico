import test from "node:test";
import assert from "node:assert/strict";
import {
  imageUrl,
  mergePreferences,
  viewerLifecycle,
} from "../viewer/platform.js";

function fixture() {
  const calls = [];
  const ui = Object.fromEntries(
    [
      "render",
      "setEnabled",
      "setPlayer",
      "setAvatars",
      "setPreferences",
      "destroy",
    ].map((k) => [k, (v) => calls.push([k, v])]),
  );
  const ctx = Object.fromEntries(
    ["move", "fetchState", "fetchLog", "setReplayInfo"].map((k) => [
      k,
      (v) => {
        calls.push([k, v]);
        return true;
      },
    ]),
  );
  return { calls, viewer: viewerLifecycle(ctx, ui, {}) };
}
test("theme updates preserve player appearance and colorblind preference", () => {
  const bgs = {
    playerColors: ["#abcdef"],
    playerSymbols: ["star"],
    players: [{ pro: true }],
  };
  assert.deepEqual(
    mergePreferences({ bgs, colorBlind: true }, { dark: true }),
    { bgs, colorBlind: true, dark: true },
  );
  assert.equal(imageUrl("javascript:alert(1)"), "");
  assert.equal(
    imageUrl("https://example.org/avatar.png"),
    "https://example.org/avatar.png",
  );
});
test("replay renders only requested frames and returns to latest live state", () => {
  const { viewer, calls } = fixture();
  viewer.onState({ historyLength: 6 });
  viewer.onReplayStart();
  viewer.onReplayTo(3);
  viewer.onReplayTo(4);
  viewer.onLog({ start: 2, data: { frames: [{ stale: true }] } });
  assert.ok(!calls.some(([k, v]) => k === "render" && v.stale));
  viewer.onLog({ start: 3, data: { frames: [{ frame: 4 }] } });
  assert.deepEqual(calls.at(-1), ["render", { frame: 4 }]);
  viewer.onState({ historyLength: 7 });
  viewer.onReplayEnd();
  assert.deepEqual(calls.at(-1), ["render", { historyLength: 7 }]);
  viewer.onLog({ start: 3, data: { frames: [{ stale: true }] } });
  assert.deepEqual(calls.at(-1), ["fetchState", undefined]);
  assert.ok(!calls.some(([k, v]) => k === "render" && v.stale));
  viewer.destroy();
});
test("replay clamps after undo and analysis accepts host branch states and moves", async () => {
  const { viewer, calls } = fixture();
  viewer.onState({ historyLength: 8 });
  viewer.onReplayStart();
  viewer.onReplayTo(8);
  await assert.rejects(viewer.move({ type: "role" }));
  viewer.onState({ historyLength: 3 });
  assert.ok(calls.some(([k, v]) => k === "fetchLog" && v.start === 2));
  viewer.onReplayEnd();
  viewer.onState({ historyLength: 2, branch: "analysis" });
  const move = viewer.move({ type: "pass" });
  let settled = false;
  move.then(() => {
    settled = true;
  });
  viewer.onMoveResult({ ok: true });
  await Promise.resolve();
  assert.equal(
    settled,
    false,
    "acknowledgement must not restore stale controls",
  );
  viewer.onState({ historyLength: 3, branch: "analysis" });
  await move;
  viewer.onAvatars(["https://example.org/p.png"]);
  assert.deepEqual(calls.at(-1), ["setAvatars", ["https://example.org/p.png"]]);
  viewer.destroy();
});

test("live move logs refresh the authoritative state", () => {
  const { viewer, calls } = fixture();
  viewer.onState({ historyLength: 2 });
  viewer.onLog({ start: 2, data: { frames: [{ historyLength: 3 }] } });
  assert.deepEqual(calls.at(-1), ["fetchState", undefined]);
  viewer.destroy();
});
