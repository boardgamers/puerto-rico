import { supportedLocales, translator } from "../viewer/i18n.js";

// BGS discovers game help by this exact <game>:rules CMS name.
export const rulesPageName = "puerto-rico:rules";
export const rulesPageUrl = "/page/puerto-rico/rules";
const rulebook =
  "https://awakenrealms.com/images/download/puerto-rico/EN/EN_PR_Rulebook_210x285mm_bleed3mm%20%5B44%20pages%5D.pdf";
const errata =
  "https://awakenrealms.com/images/download/puerto-rico/EN/PR_Others_Errata_297x210mm_bleed3mm.pdf";

// Reuse the human-authored, reviewed rules translations, not translation APIs.
// Leave individual building effects and component counts to the board itself.
export function rulesPages() {
  return Object.fromEntries(
    supportedLocales.map((locale) => {
      const t = translator(locale);
      const section = (title, ...paragraphs) =>
        `## ${t(title)}\n\n${paragraphs.join("\n\n")}`;
      const roles = [
        "planter",
        "recruiter",
        "builder",
        "craftsman",
        "trader",
        "captain",
        "adventurer",
        "smuggler",
      ];
      const content = [
        `# Puerto Rico — ${t("rules")}`,
        section("ruleGoalTitle", t("ruleGoal")),
        section(
          "ruleRoundTitle",
          [t("ruleChoose"), t("ruleFollow"), t("ruleNext")].join(" "),
          `**2 ${t("players").toLocaleLowerCase(locale)}:** ${t("ruleNextTwo")}`,
          `${t("ruleReset")} ${t("ruleSmugglerCoin")}`,
          t("ruleOptional"),
        ),
        roles
          .map(
            (role) =>
              `- **${t(role)}:** ${t.roleAction(role)}${t.rolePrivilege(role) ? ` **${t("privilege")}:** ${t.rolePrivilege(role)}` : ""}`,
          )
          .join("\n"),
        section("recruiter", t("ruleWorkerPool")),
        section("smuggler", t("smugglerPoachHelp")),
        section(
          "ruleProductionTitle",
          t("productionIntro"),
          t("productionPair"),
          t("ruleActivation"),
        ),
        section(
          "ruleGoodsTitle",
          `**${t("ruleSellTitle")}:** ${t("ruleSell")}`,
          `**${t("ruleShipTitle")}:** ${t("ruleShip")} ${t("ruleShipLimits")}`,
        ),
        section(
          "ruleEditionTitle",
          t("ruleCitizens"),
          `${t("ruleFestival")} ${t("festivalReservedHelp")}`,
          t("achievementHelp"),
        ),
        section(
          "ruleEndTitle",
          `${t("ruleEnd")} ${t("ruleEndCitizens")}`,
          `${t("ruleScore")} ${t("ruleScoreCitizens")}`,
        ),
        `## ${t("puertoma")}\n\n${t("puertomaHelp")}`,
        `[${t("rules")} (PDF · EN)](${rulebook}) · [Errata (EN)](${errata})`,
      ].join("\n\n");
      return [
        locale.split("-")[0],
        { title: `Puerto Rico — ${t("rules")}`, content },
      ];
    }),
  );
}
