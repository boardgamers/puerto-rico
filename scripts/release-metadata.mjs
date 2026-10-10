import { readFile } from "node:fs/promises";
import { supportedLocales } from "../viewer/i18n.js";

export async function releaseMetadata() {
  const source = JSON.parse(
    await readFile(new URL("../bgs/game.json", import.meta.url), "utf8"),
  );
  const translations = {};
  for (const locale of supportedLocales) {
    if (locale === "en") continue;
    const catalog = JSON.parse(
      await readFile(
        new URL(`../viewer/locales/${locale}.json`, import.meta.url),
        "utf8",
      ),
    );
    for (const key of [
      "description",
      "rules",
      "chooseBuildings",
      "showVP",
      "autoForcedActions",
    ])
      if (!catalog[`metadata.${key}`])
        throw Error(`Missing ${locale} metadata.${key}`);
    translations[locale.split("-")[0]] = {
      description: catalog["metadata.description"],
      rules: catalog["metadata.rules"],
      credits: source.credits,
      optionTranslations: {
        "options.chooseBuildings": catalog["metadata.chooseBuildings"],
        "options.showVP": catalog["metadata.showVP"],
        "settings.autoForcedActions": catalog["metadata.autoForcedActions"],
      },
    };
  }
  return {
    metadata: {
      label: source.label,
      displayTitle: { title: "Puerto Rico", subtitle: "1897 Special Edition" },
      description: source.description,
      rules: source.rules,
      credits: source.credits,
      links: source.links,
      unlisted: null,
    },
    translations,
  };
}
