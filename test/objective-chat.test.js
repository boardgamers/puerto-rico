import test from "node:test";
import assert from "node:assert/strict";
import * as host from "../bgs/engine.js";
test("BGS announces only newly completed public objectives and drains messages once", () => {
  let s = host.init(3, [], {}, "objective-chat");
  let notices = [];
  for (let i = 0; !host.ended(s) && i < 2000; i++) {
    s = host.moveAI(s);
    const result = host.messages(s);
    notices.push(...result.messages);
    s = result.data;
    assert.deepEqual(host.messages(s).messages, []);
    assert.equal(host.stripSecret(s, 0).pendingMessages, undefined);
  }
  assert.ok(host.ended(s));
  const completed =
    s.players.reduce(
      (n, p) => n + (p.achievements ?? []).filter((c) => c.completed).length,
      0,
    ) + s.festivals.filter((f) => f.claimed !== undefined).length;
  assert.ok(completed > 0);
  assert.equal(notices.length, completed);
  assert.deepEqual(host.messages(host.replay(s)).messages, []);
});
