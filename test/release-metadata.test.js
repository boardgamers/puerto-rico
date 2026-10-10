import test from "node:test";
import assert from "node:assert/strict";
import { releaseMetadata } from "../scripts/release-metadata.mjs";
import { supportedLocales } from "../viewer/i18n.js";

test("release metadata keeps title separate and prepares every manual locale overlay", async () => {
  const { metadata, translations } = await releaseMetadata();
  assert.deepEqual(metadata.displayTitle, {
    title: "Puerto Rico",
    subtitle: "1897 Special Edition",
  });
  assert.equal(metadata.label, "Puerto Rico");
  assert.deepEqual(
    Object.keys(translations).sort(),
    supportedLocales
      .filter((l) => l !== "en")
      .map((l) => l.split("-")[0])
      .sort(),
  );
  for (const overlay of Object.values(translations)) {
    assert.ok(overlay.description);
    assert.ok(overlay.rules);
    assert.equal(overlay.credits, metadata.credits);
    assert.deepEqual(Object.keys(overlay.optionTranslations).sort(), [
      "options.chooseBuildings",
      "options.showVP",
      "settings.autoForcedActions",
    ]);
  }
});
