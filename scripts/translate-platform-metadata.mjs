import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { supportedLocales } from "../viewer/i18n.js";

// Only catalog prose and host setup labels go through the platform translation service.
// Viewer, engine, tutorials and CMS rules retain their authored translations.
export async function translatePlatformMetadata(
  token,
  metadata,
  locales = supportedLocales,
) {
  const base = "https://admin.boardgamers.space/api/admin/gameinfo/puerto-rico";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const source = Object.fromEntries(
    ["description", "rules", "credits"]
      .filter((k) => metadata[k])
      .map((k) => [k, metadata[k]]),
  );
  const hash = createHash("sha256")
    .update(JSON.stringify(source))
    .digest("hex")
    .slice(0, 16);
  async function read() {
    const response = await fetch(`${base}/meta`, { headers });
    if (!response.ok) throw Error(`Metadata read: ${response.status}`);
    return response.json();
  }
  let current = await read();
  for (const locale of locales.filter((l) => l !== "en")) {
    const lang = locale.split("-")[0];
    if (current.translations?.[lang]?.translatedFrom?.hash === hash) continue;
    const response = await fetch(`${base}/meta/translate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ targetLang: lang }),
    });
    if (!response.ok)
      throw Error(`Platform metadata translation ${lang}: ${response.status}`);
    current = await read();
    assert.equal(
      current.translations?.[lang]?.translatedFrom?.hash,
      hash,
      lang,
    );
    console.log(`Platform metadata translated: ${locale}`);
  }
  return current;
}
