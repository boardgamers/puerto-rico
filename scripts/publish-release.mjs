import { translatePlatformMetadata } from "./translate-platform-metadata.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { publishCmsRules } from "./publish-cms.mjs";
import { releaseMetadata } from "./release-metadata.mjs";
import { supportedLocales } from "../viewer/i18n.js";
import { packageEngine } from "./package-engine.mjs";

if (process.env.BGS_ENGINE_ONLY && process.env.BGS_ENGINE_ONLY !== "1")
  throw Error("BGS_ENGINE_ONLY must be 1 or unset");
const engineOnly = process.env.BGS_ENGINE_ONLY === "1";
const expectedManifest = engineOnly
  ? (await import("../dist/engine.js")).achievementDefinitions()
  : null;
if (engineOnly) {
  const { achievementManifestSchema } = await import(
    "@boardgamers/protocol/achievements"
  );
  achievementManifestSchema.parse(expectedManifest);
}
const defaults = JSON.parse(await readFile("bgs/game.json", "utf8"));
assert.equal(defaults.public, true);
const { tarball, version } = await packageEngine();
const token = (await readFile(`${homedir()}/.bgs`, "utf8")).trim();
const base = "https://admin.boardgamers.space/api/admin/gameinfo/puerto-rico";
async function api(
  path,
  method = "GET",
  body,
  binary = false,
  contentType = "application/octet-stream",
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body
        ? {
            "Content-Type": binary ? contentType : "application/json",
          }
        : {}),
    },
    body: body ? (binary ? body : JSON.stringify(body)) : undefined,
  });
  if (!response.ok) {
    const error = Error(`${method} ${path}: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
const versions = await api("/versions");
const existing = versions.some((v) => v.version === 1) ? await api("/1") : null;
if (!existing?.public)
  throw Error("The release publisher requires an already public version.");
const existingMeta = await api("/meta");
if (engineOnly) assert.equal(existing.engine.entryPoint, "dist/engine.js");
await mkdir(".local/release", { recursive: true });
await writeFile(
  `.local/release/before-${Date.now()}.json`,
  JSON.stringify(
    {
      version: existing,
      metadata: existingMeta,
    },
    null,
    2,
  ),
);
if (!existing) await api("/1", "PUT", defaults);
const engine = await api("/1/engine", "POST", await readFile(tarball), true);
// Badge-only releases must not overwrite independently managed live metadata or
// replace a viewer that does not need the engine change.
if (engineOnly) {
  const expected = expectedManifest;
  let published;
  for (let attempt = 0; attempt < 60; attempt++) {
    published = await api("/1");
    if (
      isDeepStrictEqual(published.engine?.package, engine.engine.package) &&
      isDeepStrictEqual(published.achievementManifest, expected)
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  assert.equal(published.engine.package.version, version);
  assert.deepEqual(published.engine.package, engine.engine.package);
  const downloaded = await fetch(published.engine.package.url);
  assert.ok(downloaded.ok);
  assert.deepEqual(
    Buffer.from(await downloaded.arrayBuffer()),
    await readFile(tarball),
  );
  assert.deepEqual(published.achievementManifest, expected);
  assert.equal(published.public, true);
  assert.deepEqual(published.viewer, existing.viewer);
  // Engine upload owns only engine metadata and the installer-generated manifest.
  for (const key of Object.keys(defaults)) {
    if (key !== "engine") assert.deepEqual(published[key], existing[key], key);
  }
  const meta = await api("/meta");
  assert.ok(!meta.unlisted);
  for (const key of new Set([
    ...Object.keys(existingMeta),
    ...Object.keys(meta),
  ])) {
    if (!["updatedAt", "bots", "replay"].includes(key))
      assert.deepEqual(meta[key], existingMeta[key], `metadata.${key}`);
  }
  await writeFile(
    ".local/release/published.json",
    JSON.stringify(published, null, 2),
  );
  console.log(
    JSON.stringify({
      engineOnly: true,
      public: published.public,
      listed: !meta.unlisted,
      engine: published.engine.package,
      achievementRevision: expected.revision,
      achievementCount: expected.achievements.length,
      viewer: published.viewer.url,
    }),
  );
  process.exit(0);
}
const bytes = await readFile("dist/viewer.js");
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
const uploaded = await api(
  `/1/viewer/file?filename=viewer.js&bundle=${hash(bytes).slice(0, 24)}`,
  "POST",
  bytes,
  true,
);
await api("/1", "PUT", {
  ...defaults,
  engine: { ...engine.engine, entryPoint: "dist/engine.js" },
  viewer: { ...defaults.viewer, url: uploaded.url, scriptBytes: bytes.length },
});
// Keep the released game listed in the catalog.
const { metadata } = await releaseMetadata();
await publishCmsRules(token);
await api("/meta", "PUT", metadata);
await api(
  "/assets/pictogram?name=Puerto%20Rico",
  "PUT",
  await readFile("bgs/assets/pictogram.svg"),
  true,
  "image/svg+xml",
);
await translatePlatformMetadata(token, metadata);
const translationsPending = false;
const published = await api("/1"),
  meta = await api("/meta");
assert.equal(published.public, true);
assert.deepEqual(published.players, defaults.players);
assert.ok(!meta.unlisted);
assert.equal(published.engine.package.version, version);
assert.equal(published.viewer.url, uploaded.url);
assert.equal(meta.displayTitle.title, metadata.displayTitle.title);
assert.equal(meta.displayTitle.subtitle, metadata.displayTitle.subtitle);
assert.ok(meta.assets?.pictogram?.url);
const pictogram = await fetch(meta.assets.pictogram.url);
assert.ok(pictogram.ok, `Pictogram CDN ${pictogram.status}`);
assert.equal(
  (await pictogram.arrayBuffer()).byteLength,
  meta.assets.pictogram.size,
);
assert.deepEqual(published.preferences, defaults.preferences);
assert.deepEqual(published.settings, defaults.settings);
assert.deepEqual(published.tutorial, defaults.tutorial);
const downloaded = await fetch(uploaded.url);
assert.ok(downloaded.ok, `CDN ${downloaded.status}`);
assert.equal(hash(Buffer.from(await downloaded.arrayBuffer())), hash(bytes));
await writeFile(
  ".local/release/published.json",
  JSON.stringify(published, null, 2),
);
console.log(
  JSON.stringify({
    private: !published.public,
    listed: !meta.unlisted,
    status: meta.status,
    engine: published.engine.package.version,
    languages: supportedLocales,
    translationsPending,
    pictogram: meta.assets.pictogram.url,
    viewer: uploaded.url,
  }),
);
