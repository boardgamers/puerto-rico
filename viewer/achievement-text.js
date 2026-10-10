import { plainText, richText } from "./rich-text.js";
import { CARDS } from "../engine/achievements.js";
export function achievementText(id, t) {
  const c = CARDS[id];
  if (!c) return { name: t("secretAchievement"), text: "", html: "" };
  const message = t
    .raw(`achievementGoal.${c.goal}`)
    .replaceAll("%amount%", c.amount ?? "")
    .replaceAll("{%goods%}", (c.goods ?? []).map((g) => `{${g}}`).join(" / "))
    .replaceAll("%good%", c.good ?? "");
  return {
    ...c,
    name: t(`achievementName.${id}`),
    text: plainText(message, t.catalog),
    html: richText(message, t.catalog),
  };
}
