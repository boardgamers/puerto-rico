import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { achievementDefinitions } from "../bgs/achievements.js";
import { achievementManifestSchema } from "@boardgamers/protocol/achievements";
const hash = (s) => createHash("sha256").update(s).digest("hex");
const read = (p) => readFileSync(new URL(p, import.meta.url));

test("14 original assets cover precisely the unchanged platform ID set", () => {
  const expected = [
    "island-victory",
    "puertoma-normal",
    "all-festival-objectives",
    "all-personal-achievements",
    "festival-claim",
    "personal-achievement",
    "fifty-points",
    "seventy-points",
    "full-city",
    "full-island",
    "expanded-city",
    "five-crop-estates",
    "twenty-coins",
    "six-core-roles",
  ];
  const manifest = achievementDefinitions();
  achievementManifestSchema.parse(manifest);
  assert.equal(manifest.revision, 2);
  assert.deepEqual(
    manifest.achievements.map((a) => a.id),
    expected,
  );
  const art = JSON.parse(read("../art/achievements/manifest.json"));
  assert.equal(
    art.generatorSha256,
    hash(read("../scripts/achievement-art.py")),
  );
  assert.equal(art.engineVersion, JSON.parse(read("../package.json")).version);
  assert.deepEqual(
    art.assets.map((a) => a.id),
    expected,
  );
  assert.equal(new Set(art.assets.map((a) => a.pngSha256)).size, 14);
  for (const [i, a] of art.assets.entries()) {
    assert.deepEqual(manifest.achievements[i].icon, {
      type: "asset",
      key: a.key,
    });
    assert.equal(a.key, `achievement-${a.id}`);
    const svg = read(`../art/achievements/${a.svg}`);
    const png = read(`../art/achievements/${a.png}`);
    assert.equal(hash(svg), a.svgSha256);
    assert.equal(hash(png), a.pngSha256);
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert(!/href=|<image|<script/.test(svg.toString()));
  }
});

test("art-only release keeps evaluator byte-identical to canonical 0.3.19", () => {
  const source = read("../bgs/achievements.js").toString();
  assert.equal(
    hash(source.slice(source.indexOf("export function achievements(s)"))),
    "120c9fd4101ec589e4edbe7acf31e46f6924eadd538e1ad88093250cdcfbc563",
  );
});
