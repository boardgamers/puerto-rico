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
const { metadata, translations } = await releaseMetadata();
await api("/meta", metadata);
let translationsPending = false;
for (const [lang, overlay] of Object.entries(translations)) {
  try {
    await api(`/meta/translations/${lang}`, overlay);
  } catch (error) {
    if (error.status !== 404) throw error;
    translationsPending = true;
    break;
  }
}
await writeFile(
  ".local/release/manual-translations.json",
  JSON.stringify(translations, null, 2),
);
const saved = await api("/meta");
for (const [key, value] of Object.entries(metadata)) {
  if (value !== null) assert.deepEqual(saved[key], value, key);
}
if (!translationsPending)
  for (const [lang, overlay] of Object.entries(translations)) {
    for (const key of ["description", "rules", "credits"])
      assert.equal(saved.translations?.[lang]?.[key], overlay[key]);
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
