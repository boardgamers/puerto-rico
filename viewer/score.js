import { eventPoints, scoreBreakdown } from "../engine/index.js";
import { BUILDINGS as B } from "../engine/catalog.js";
import { achievementText } from "./achievement-text.js";
import { journalContent } from "./journal.js";
import { icon, scoreToken } from "./icons.js";
import { buildingSprite } from "./building-symbols.js";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const sum = (values) => values.reduce((a, b) => a + b, 0);

// Use recorded rewards, rather than today's buildings, to explain past gains.
export function tokenSources(state, player) {
  if (!Number.isFinite(state.players[player]?.vp)) return [];
  const sources = new Map(Object.entries(state.eventSummary?.[player] ?? {}));
  const add = (id, points) => {
    if (points) sources.set(id, (sources.get(id) ?? 0) + points);
  };
  for (const e of state.events ?? []) {
    if (e.p !== player) continue;
    for (const [id, points] of Object.entries(eventPoints(e))) add(id, points);
  }
  const unrecorded = state.players[player].vp - sum([...sources.values()]);
  add("scoreUnrecorded", unrecorded);
  return [...sources].map(([id, points]) => ({ id, points }));
}

export function scoreContent(state, player, t) {
  const a = state.players[player];
  if (!a || !Number.isFinite(a.vp)) return `<p>${t("scoreHidden")}</p>`;
  const score = state.results?.[player] ?? scoreBreakdown(state, player);
  const points = (n) =>
    `<span class="score-value" aria-label="${n} ${esc(t("vp"))}">${scoreToken(n, 28)}</span>`;
  const row = (label, n, hint = "") =>
    `<li><div class="score-label">${label}${hint ? `<div class="score-hint">${hint}</div>` : ""}</div>${points(n)}</li>`;
  const label = (id) =>
    esc(t(t.catalog[`ability.${id}`] ? `ability.${id}` : id));
  const sources = tokenSources(state, player);
  const history = [];
  let round;
  for (const e of state.events ?? []) {
    if (
      e.p !== player ||
      !(e.vp || e.reward?.vp || (e.type === "build" && e.point))
    )
      continue;
    if (e.round !== round) {
      round = e.round;
      history.push({ type: "round", round });
    }
    history.push(e);
  }
  const buildings = a.buildings
    .map((b) =>
      row(`${icon(buildingSprite(b.id), 16)} ${esc(t(b.id))}`, B[b.id].vp),
    )
    .join("");
  const completed = (a.achievements ?? []).filter((c) => c.completed);
  const bonuses = Object.entries(score.bonus)
    .map(([id, n]) => {
      const detail =
        id === "achievements"
          ? state.puertoma
            ? t("scoreSoloAchievements")
            : completed
                .map((c) => {
                  const card = achievementText(c.id, t);
                  return `${esc(card.name)} · ${card.vp} ${t("vpShort")}`;
                })
                .join("<br>") || t("scoreNoAchievements")
          : B[id]
            ? t.effectHtml(id)
            : "";
      return row(label(id), n, detail);
    })
    .join("");
  return `<div class="score-detail">
    <section><header><h3>${t("scoreEarned")}</h3>${points(score.tokens)}</header>
      ${state.finished ? "" : `<p class="score-note">${t("scoreCounterHint")}</p>`}
      ${sources.length ? `<ul class="score-lines">${sources.map(({ id, points: n }) => row(label(id), n, id === "scoreShippingBonus" ? t("scoreShippingBonusHint") : id === "hiddenMarket" ? t("scoreSpent") : "")).join("")}</ul>` : `<p class="score-note">${t("scoreNoTokens")}</p>`}
      ${history.length ? `<details class="score-history"><summary>${t("scoreHistory")}</summary>${journalContent({ ...state, events: history }, t)}</details>` : ""}
    </section>
    <section><header><h3>${t("scoreEndGame")}</h3>${points(score.total - score.tokens)}</header>
      <p class="score-note">${t(state.finished ? "scoreFinalHint" : "scoreEstimateHint")}</p>
      <ul class="score-lines">
        ${row(esc(t("scoreBuildings")), score.buildings, buildings ? `<ul class="score-building-list">${buildings}</ul>` : "")}
        ${state.expansions.includes("citizens") ? row(`${icon("citizen", 18)} ${t("citizens")}`, score.citizens, t("scoreCitizensHint")) : ""}
        ${bonuses}
      </ul>
    </section>
    <footer class="score-total"><strong>${t(state.finished ? "scoreFinalTotal" : "scoreEstimateTotal")}</strong>${points(score.total)}</footer>
  </div>`;
}
