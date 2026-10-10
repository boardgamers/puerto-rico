import { normalizeLocale } from "../viewer/i18n.js";
import en from "./locales/en.json" with { type: "json" };
import de from "./locales/de.json" with { type: "json" };
import fr from "./locales/fr.json" with { type: "json" };
import pl from "./locales/pl.json" with { type: "json" };
import ro from "./locales/ro.json" with { type: "json" };
import el from "./locales/el.json" with { type: "json" };
import hi from "./locales/hi.json" with { type: "json" };
import ru from "./locales/ru.json" with { type: "json" };
import da from "./locales/da.json" with { type: "json" };
import pt_BR from "./locales/pt-BR.json" with { type: "json" };
import ko from "./locales/ko.json" with { type: "json" };
import zh_TW from "./locales/zh-TW.json" with { type: "json" };
import vi from "./locales/vi.json" with { type: "json" };
import it from "./locales/it.json" with { type: "json" };
import nl from "./locales/nl.json" with { type: "json" };
import fa from "./locales/fa.json" with { type: "json" };

export const tutorialCatalogs = {
  en: en,
  de: de,
  fr: fr,
  pl: pl,
  ro: ro,
  el: el,
  hi: hi,
  ru: ru,
  da: da,
  "pt-BR": pt_BR,
  ko: ko,
  "zh-TW": zh_TW,
  vi: vi,
  it: it,
  nl: nl,
  fa: fa,
};
export function tutorialTranslator(locale = "en") {
  const normalized = normalizeLocale(locale);
  const catalog = tutorialCatalogs[normalized] ?? en;
  const t = (key) => catalog[key] ?? en[key] ?? key;
  t.locale = normalized;
  return t;
}
