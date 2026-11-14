// Test the exact retained upload candidate, without repacking or uploading it.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import * as source from "../bgs/engine.js";
import {
  achievementManifestSchema,
  achievementResultsSchema,
} from "@boardgamers/protocol/achievements";
const tarball = resolve(
  process.argv[2] || ".local/release/boardgamers-puerto-rico-0.3.20.tgz",
);
const dir = await mkdtemp(join(tmpdir(), "puerto-rico-art-check-"));
try {
  execFileSync("tar", ["-xzf", tarball, "-C", dir]);
  assert.deepEqual(
    await readFile(join(dir, "package/dist/engine.js")),
    await readFile("dist/engine.js"),
  );
  const packed = await import(
    pathToFileURL(join(dir, "package/dist/engine.js"))
  );
  const manifest = packed.achievementDefinitions();
  achievementManifestSchema.parse(manifest);
  assert.deepEqual(manifest, source.achievementDefinitions());
  for (const players of [1, 2, 3, 4, 5]) {
    let state = packed.init(players, [], {}, `art-packed-${players}`);
    for (let i = 0; !packed.ended(state) && i < 6000; i++)
      state = packed.moveAI(state);
    assert(packed.ended(state));
    const results = packed.achievements(state);
    achievementResultsSchema(manifest, players).parse(results);
    assert.deepEqual(results, source.achievements(state));
    assert.deepEqual(results, packed.achievements(packed.replay(state)));
  }
  console.log(
    JSON.stringify(
      {
        tarball,
        sha256: createHash("sha256")
          .update(await readFile(tarball))
          .digest("hex"),
        revision: manifest.revision,
        players:
          "1–5: completed games, schema, source parity and replay passed",
      },
      null,
      2,
    ),
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
