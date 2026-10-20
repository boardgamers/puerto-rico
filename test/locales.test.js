import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import {
  catalogs,
  normalizeLocale,
  supportedLocales,
  translator,
} from "../viewer/i18n.js";
import { achievementText } from "../viewer/achievement-text.js";
import { CARDS } from "../engine/achievements.js";
const dir = new URL("../viewer/locales/", import.meta.url);
// Existing French copy deliberately uses different pictogram phrasing in these entries.
const frenchMarkerVariants = {
  warnProductionSetup: ["{corn}", "{crate}"],
  warnTradeGoods: ["{crate}"],
  warnShipGoods: ["{crate}"],
  ruleGoal: ["{coins}", "{coins}"],
  ruleProduction: ["{corn}", "{crate:1}", "{sugar}", "{worker}"],
  ruleCitizens: ["{citizens}", "{citizen}", "{vp:1}", "{workers}", "{worker}"],
  ruleEndWorkers: ["{workers}"],
  ruleEndCitizens: ["{workers}"],
  "effect.smallWarehouse": ["{crate}"],
  "effect.largeWarehouse": ["{crate}"],
  "effect.wharf": ["{captain}"],
  "effect.notary": [
    "{citizen}",
    "{coin:−1}",
    "{coin:−2}",
    "{expandedbuildings}",
    "{worker}",
  ],
  "effect.pensionOffice": ["{citizens}", "{vp:1}"],
};
const markers = (text) => (text.match(/\{[^}]+\}|%\w+%/g) ?? []).sort();

test("locale normalization accepts regional and case variants", () => {
  for (const [input, expected] of [
    ["FR-fr", "fr"],
    ["en-US", "en"],
    ["pt", "pt-BR"],
    ["PT_br", "pt-BR"],
    ["zh-Hant", "zh-TW"],
    ["zh-HK", "zh-TW"],
    ["zh", "zh-CN"],
    ["zh-Hans-SG", "zh-CN"],
    ["ZH_cn", "zh-CN"],
    ["zh-SG", "zh-CN"],
    ["fa-IR", "fa"],
    ["unknown", "en"],
  ])
    assert.equal(normalizeLocale(input), expected);
});
test("every BGS locale is registered with a complete translation catalog", () => {
  assert.deepEqual(Object.keys(catalogs).sort(), [...supportedLocales].sort());
  for (const locale of supportedLocales) {
    const catalog = catalogs[locale];
    assert.deepEqual(
      Object.keys(catalog).sort(),
      Object.keys(catalogs.en).sort(),
      locale,
    );
    for (const [key, value] of Object.entries(catalog))
      assert.ok(typeof value === "string" && value.trim(), `${locale}: ${key}`);
  }
});
test("translation catalogs preserve all numeric icon and interpolation markers", () => {
  for (const file of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const catalog = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
    for (const [key, value] of Object.entries(catalog))
      assert.deepEqual(
        markers(value),
        file === "fr.json" && frenchMarkerVariants[key]
          ? [...frenchMarkerVariants[key]].sort()
          : markers(catalogs.en[key]),
        `${file}: ${key}`,
      );
  }
});
test("translated achievement text expands parameters and accessible symbol labels", () => {
  for (const locale of Object.keys(catalogs)) {
    const t = translator(locale);
    for (const id of Object.keys(CARDS)) {
      const card = achievementText(id, t);
      assert.ok(
        !/\{%|%\w+%|achievementGoal\./.test(card.text),
        `${locale}: ${id}`,
      );
      assert.ok(!/\{[^}]+\}/.test(card.html), `${locale}: ${id}`);
      assert.ok(card.name && card.text);
    }
    assert.equal(t.rolePrivilege("adventurer"), "");
    assert.equal(t.rolePrivilegeHtml("adventurer"), "");
    assert.ok(!t.html("roleAction.captain").includes("undefined"));
  }
});
