import { translatePlatformMetadata } from "./translate-platform-metadata.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { publishCmsRules } from "./publish-cms.mjs";
import { releaseMetadata } from "./release-metadata.mjs";
import { supportedLocales } from "../viewer/i18n.js";
import { packageEngine } from "./package-engine.mjs";

const defaults = JSON.parse(await readFile("bgs/game.json", "utf8"));
assert.equal(defaults.public, false);
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
if (existing?.public)
  throw Error("The private publisher cannot replace a public version.");
await mkdir(".local/release", { recursive: true });
await writeFile(
  `.local/release/before-${Date.now()}.json`,
  JSON.stringify(
    {
      version: existing,
      metadata: await api("/meta"),
    },
    null,
    2,
  ),
);
if (!existing) await api("/1", "PUT", defaults);
const engine = await api("/1/engine", "POST", await readFile(tarball), true);
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
// Listed in the beta catalog; the actual playable version stays private.
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
await api("/icon", "PUT", { mode: "pictogram" });
await translatePlatformMetadata(token, metadata);
const translationsPending = false;
const access = await api("/beta-users");
if (!access.some((u) => u.username === "coyotte508"))
  await api("/beta-users", "POST", { usernameOrEmail: "coyotte508" });
const published = await api("/1"),
  meta = await api("/meta");
assert.equal(published.public, false);
assert.deepEqual(published.players, defaults.players);
assert.ok(!meta.unlisted);
assert.equal(published.engine.package.version, version);
assert.equal(published.viewer.url, uploaded.url);
assert.equal(meta.displayTitle.title, metadata.displayTitle.title);
assert.equal(meta.displayTitle.subtitle, metadata.displayTitle.subtitle);
assert.equal(meta.iconMode, "pictogram");
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
