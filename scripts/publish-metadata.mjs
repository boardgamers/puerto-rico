import { translatePlatformMetadata } from "./translate-platform-metadata.mjs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import assert from "node:assert/strict";
import { releaseMetadata } from "./release-metadata.mjs";
import { publishCmsRules } from "./publish-cms.mjs";

const token = (await readFile(`${homedir()}/.bgs`, "utf8")).trim();
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};
const base = "https://admin.boardgamers.space/api/admin/gameinfo/puerto-rico";
async function api(path, body) {
  const response = await fetch(base + path, {
    method: body ? "PUT" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw Object.assign(Error(`${path}: ${response.status}`), {
      status: response.status,
    });
  return response.json();
}
const before = await api("/meta");
await mkdir(".local/release", { recursive: true });
await writeFile(
  `.local/release/metadata-before-${Date.now()}.json`,
  JSON.stringify(before, null, 2),
);
const languages = await publishCmsRules(token);
const { metadata } = await releaseMetadata();
await api("/meta", metadata);
await translatePlatformMetadata(token, metadata);
const translationsPending = false;
const saved = await api("/meta");
for (const [key, value] of Object.entries(metadata)) {
  if (value !== null) assert.deepEqual(saved[key], value, key);
}
assert.equal(saved.iconMode, before.iconMode);
console.log(
  JSON.stringify({
    rulesPage: "https://boardgamers.space/page/puerto-rico/rules",
    languages,
    tags: saved.tags,
    translationsPending,
  }),
);
