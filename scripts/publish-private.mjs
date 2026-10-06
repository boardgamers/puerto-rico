import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { packageEngine } from "./package-engine.mjs";

const defaults = JSON.parse(await readFile("bgs/game.json", "utf8"));
assert.equal(defaults.public, false);
const { tarball, version } = await packageEngine();
const token = (await readFile(`${homedir()}/.bgs`, "utf8")).trim();
const base = "https://admin.boardgamers.space/api/admin/gameinfo/puerto-rico";
async function api(path, method = "GET", body, binary = false) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body
        ? {
            "Content-Type": binary
              ? "application/octet-stream"
              : "application/json",
          }
        : {}),
    },
    body: body ? (binary ? body : JSON.stringify(body)) : undefined,
  });
  if (!response.ok)
    throw Error(
      `${method} ${path}: ${response.status} ${await response.text()}`,
    );
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
await api("/meta", "PUT", { unlisted: null });
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
assert.deepEqual(
  published.preferences
    .find((p) => p.name === "language")
    .items.map((p) => p.name),
  ["en", "fr"],
);
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
    languages: ["en", "fr"],
    viewer: uploaded.url,
  }),
);
