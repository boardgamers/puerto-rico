import { readFile } from "node:fs/promises";
import { rulesPageUrl } from "./rules-pages.mjs";
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
    const lessons = JSON.parse(
      await readFile(
        new URL(`../tutorial/locales/${locale}.json`, import.meta.url),
        "utf8",
      ),
    );
    const tutorialLabels = {};
    for (const chapter of source.tutorial?.chapters ?? []) {
      for (const field of ["title", "description"]) {
        const text = lessons[`tutorial.${chapter.id}.${field}`];
        if (!text)
          throw Error(`Missing ${locale} tutorial.${chapter.id}.${field}`);
        tutorialLabels[`tutorial.chapters.${chapter.id}.${field}`] = text;
      }
    }
    translations[locale.split("-")[0]] = {
      description: `${catalog["metadata.description"]} ${catalog.ruleTiming}`,
      rules: `[${catalog.rules}](${rulesPageUrl})`,
      credits: source.credits,
      optionTranslations: {
        ...tutorialLabels,
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
      tags: source.tags,
      unlisted: null,
    },
    translations,
  };
}
