import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { rulesPages, rulesPageName } from "./rules-pages.mjs";

export async function publishCmsRules(token) {
  const pages = rulesPages();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const backup = {};
  const base = `https://admin.boardgamers.space/api/admin/page/${encodeURIComponent(rulesPageName)}`;
  // Keep the prior authored pages recoverable before replacing any language.
  for (const lang of Object.keys(pages)) {
    const response = await fetch(`${base}/${lang}`, { headers });
    if (!response.ok && response.status !== 404)
      throw Error(`CMS read ${lang}: ${response.status}`);
    backup[lang] = response.ok ? await response.json() : null;
  }
  await mkdir(".local/release", { recursive: true });
  await writeFile(
    `.local/release/cms-before-${Date.now()}.json`,
    JSON.stringify(backup, null, 2),
  );
  for (const [lang, page] of Object.entries(pages)) {
    const response = await fetch(`${base}/${lang}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(page),
    });
    if (!response.ok) throw Error(`CMS write ${lang}: ${response.status}`);
    const read = await fetch(`${base}/${lang}`, { headers });
    if (!read.ok) throw Error(`CMS verify ${lang}: ${read.status}`);
    const saved = await read.json();
    assert.equal(saved.title, page.title);
    assert.equal(saved.content, page.content);
  }
  return Object.keys(pages);
}
