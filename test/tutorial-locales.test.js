import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { supportedLocales } from "../viewer/i18n.js";
const directory = new URL("../tutorial/locales/", import.meta.url);
const read = (locale) =>
  JSON.parse(readFileSync(new URL(`${locale}.json`, directory), "utf8"));
const tokens = (text) => (text.match(/\{[^}]+\}|%\w+%/g) ?? []).sort();
test("all BGS languages have complete tutorial copy with intact markers", () => {
  const english = read("en");
  assert.deepEqual(
    readdirSync(directory)
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.slice(0, -5))
      .sort(),
    [...supportedLocales].sort(),
  );
  for (const locale of supportedLocales) {
    const catalog = read(locale);
    assert.deepEqual(
      Object.keys(catalog).sort(),
      Object.keys(english).sort(),
      locale,
    );
    for (const [key, text] of Object.entries(catalog)) {
      assert.ok(typeof text === "string" && text.trim(), `${locale}: ${key}`);
      assert.deepEqual(tokens(text), tokens(english[key]), `${locale}: ${key}`);
    }
  }
});
