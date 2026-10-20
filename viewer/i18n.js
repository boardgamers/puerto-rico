import { plainText, richText } from "./rich-text.js";
import en from "./locales/en.json" with { type: "json" };
import fr from "./locales/fr.json" with { type: "json" };
import ko from "./locales/ko.json" with { type: "json" };
import pl from "./locales/pl.json" with { type: "json" };
import vi from "./locales/vi.json" with { type: "json" };
import da from "./locales/da.json" with { type: "json" };
import ru from "./locales/ru.json" with { type: "json" };
import nl from "./locales/nl.json" with { type: "json" };
import it from "./locales/it.json" with { type: "json" };
import fa from "./locales/fa.json" with { type: "json" };
import pt_BR from "./locales/pt-BR.json" with { type: "json" };
import de from "./locales/de.json" with { type: "json" };
import zh_CN from "./locales/zh-CN.json" with { type: "json" };
import zh_TW from "./locales/zh-TW.json" with { type: "json" };
import ro from "./locales/ro.json" with { type: "json" };
import hi from "./locales/hi.json" with { type: "json" };
import el from "./locales/el.json" with { type: "json" };
export const catalogs = {
  el,
  ro,
  hi,
  ko: ko,
  pl: pl,
  vi: vi,
  da: da,
  ru: ru,
  nl: nl,
  en: en,
  it: it,
  fa: fa,
  "pt-BR": pt_BR,
  fr: fr,
  de: de,
  "zh-TW": zh_TW,
  "zh-CN": zh_CN,
};
export const supportedLocales = [
  "en",
  "de",
  "fr",
  "pl",
  "ro",
  "el",
  "hi",
  "ru",
  "da",
  "pt-BR",
  "ko",
  "zh-TW",
  "zh-CN",
  "vi",
  "it",
  "nl",
  "fa",
];
export function normalizeLocale(locale = "en") {
  locale = String(locale).replaceAll("_", "-").toLowerCase();
  const exact = supportedLocales.find(
    (x) => x.toLowerCase() === String(locale).toLowerCase(),
  );
  return (
    exact ??
    (/^zh-(?:tw|hk|mo|hant)(?:-|$)/.test(locale) ? "zh-TW" : undefined) ??
    (/^zh(?:-|$)/.test(locale) ? "zh-CN" : undefined) ??
    { pt: "pt-BR" }[String(locale).split("-")[0]] ??
    supportedLocales.find((x) => x === String(locale).split("-")[0]) ??
    "en"
  );
}
export function translator(locale = "en") {
  locale = normalizeLocale(locale);
  const catalog = catalogs[locale] ?? en;
  const raw = (key) => catalog[key] ?? en[key] ?? key;
  const optional = (key) => catalog[key] ?? en[key] ?? "";
  const roleId = (id) => (id === "adventurer2" ? "adventurer" : id);
  const t = (key) => plainText(raw(key), catalog);
  t.html = (key) => richText(raw(key), catalog);
  for (const group of ["effect", "roleAction", "rolePrivilege"]) {
    t[group] = (id) =>
      plainText(
        optional(`${group}.${group === "effect" ? id : roleId(id)}`),
        catalog,
      );
    t[`${group}Html`] = (id) =>
      richText(
        optional(`${group}.${group === "effect" ? id : roleId(id)}`),
        catalog,
      );
  }
  t.raw = raw;
  t.catalog = catalog;
  t.locale = locale;
  t.fr = locale === "fr";
  return t;
}
