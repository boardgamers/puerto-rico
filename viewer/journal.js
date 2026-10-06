import { achievementText, abilityTexts } from "./achievement-text.js";
import { GOODS } from "../engine/catalog.js";
import { icon, scoreToken } from "./icons.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function journalContent(state, t, { automatedSetup = false } = {}) {
  const metric = (id, n, signed = false) =>
    id === "vp"
      ? `<span class="metric" role="img" title="${esc(t("vp"))}" aria-label="${esc(t("vp"))} : ${signed && n > 0 ? "+" : ""}${esc(n)}">${scoreToken(`${signed && n > 0 ? "+" : ""}${n}`)}</span>`
      : `<span class="metric" title="${esc(t(id === "coin" ? "coins" : id === "worker" ? "workers" : id === "citizen" ? "citizens" : id))}">${icon(id, 20)}<b>${signed && n > 0 ? "+" : ""}${esc(n)}</b></span>`;
  const goods = (items = {}) =>
    GOODS.filter((g) => items[g])
      .map((g) => metric(g, items[g]))
      .join("");
  const people = (x = {}) =>
    `${x.w ? metric("worker", x.w) : ""}${x.c ? metric("citizen", x.c) : ""}`;
  const reward = (x = {}) =>
    `${x.coins !== undefined ? metric("coin", x.coins, true) : ""}${x.vp ? metric("vp", x.vp, true) : ""}${x.workers ? metric("worker", x.workers, true) : ""}`;
  const name = (id) => esc(t(id));
  const target = (e) => (e.targetId ? ` → ${name(e.targetId)}` : "");
  const row = (e, html, css = "") =>
    `<li class="${css}"><strong class="journal-player">${e.p === null || e.p === undefined ? "" : esc(state.players[e.p].name)}</strong><div class="journal-content">${html}</div></li>`;
  const drafts = state.events.filter((e) => e.type === "draft");
  const moves = state.events.filter(
    (e) => !["round", "draft"].includes(e.type),
  );
  let setup = "";
  if (drafts.length) {
    setup = `<li class="round-divider">${t("journalSetup")}</li>`;
    setup += automatedSetup
      ? `<li class="journal-setup"><p>${t("journalPreviewSetup")}</p><button data-market>${icon("building", 20)}${t("market")}</button></li>`
      : drafts
          .map((e) =>
            row(
              e,
              `${t("journalDraft")} <button class="journal-building" data-building="${e.id}">${icon("building", 18)}${name(e.id)}</button>`,
            ),
          )
          .join("");
  }
  const entries = state.events
    .filter((e) => e.type !== "draft")
    .map((e) => {
      if (e.type === "round")
        return `<li class="round-divider">${t("round")} ${e.round}</li>`;
      if (e.type === "role")
        return row(
          e,
          `${icon(e.id.startsWith("adventurer") ? "adventurer" : e.id, 24)}<strong>${t("journalChooses")} ${name(e.id)}</strong>${e.coins ? metric("coin", e.coins, true) : ""}`,
          "phase-divider",
        );
      if (e.type === "end")
        return `<li class="round-divider">${t("finished")} · ${t({ city: "journalEndCity", points: "journalEndPoints", workers: "journalEndWorkers" }[e.reason])}</li>`;
      let text = "";
      switch (e.type) {
        case "achievement":
          text = `${t("achievements")} · ${esc(achievementText(e.id, t).name)} ${icon("check", 20)}`;
          break;
        case "puertomaBonus":
          text = `${t("ability")} · ${esc(abilityTexts[e.id][t.fr ? 1 : 0])} ${goods(e.goods)} ${e.workers ? metric("worker", e.workers, true) : ""}`;
          break;
        case "puertomaAbility":
          text = `${t("ability")} ${e.level} · ${esc(abilityTexts[e.id][t.fr ? 1 : 0])}`;
          break;
        case "income":
          text = t("journalGains");
          break;
        case "estate":
          text = `${t(e.id === "quarry" ? "journalQuarry" : e.id === "forest" ? "journalForest" : "journalEstate")} ${icon(e.id, 22)} ${name(e.id)}`;
          break;
        case "build":
          text = `${t("journalBuild")} <button class="journal-building" data-building="${e.id}">${icon("building", 20)}${name(e.id)}</button>${e.good ? ` − ${metric(e.good, 1)}` : ""}${e.worker ? ` − ${metric(e.worker.kind === "c" ? "citizen" : "worker", 1)}` : ""}${e.point ? ` − ${metric("vp", e.point)}` : ""}`;
          break;
        case "produce":
          text = goods(e.goods)
            ? `${t("journalProduce")} ${goods(e.goods)}`
            : t("journalNothing");
          break;
        case "produceBonus":
          text = `${t("journalBonus")} ${metric(e.good, 1)}`;
          break;
        case "trade":
          text = `${t("journalTrade")} ${metric(e.good, 1)}${e.outpost ? ` · ${t("merchantOutpost")}` : ""} →`;
          break;
        case "ship":
        case "smallWharf":
          text = `${t("journalShip")} ${goods(e.goods)}${e.ship === "wharf" || e.type === "smallWharf" ? ` · ${t(e.type === "smallWharf" ? "smallWharfShip" : "wharfShip")}` : e.shipCapacity ? ` <small>${icon("ship", 18)} ${e.shipLoad}/${e.shipCapacity}</small>` : ""} →`;
          break;
        case "store":
          text = `${t("journalStore")} ${goods(e.goods) || t("journalNoGoods")}${goods(e.lost) ? `<span class="journal-loss">${t("journalLost")} ${goods(e.lost)}</span>` : ""}`;
          break;
        case "assign": {
          const totals = [...e.estates, ...e.buildings].reduce(
            (n, x) => ({ w: n.w + x.w, c: n.c + x.c }),
            { w: 0, c: 0 },
          );
          text = `${t("journalAssign")} ${people(totals)}${e.allocation?.length ? `<div class="journal-allocation">${e.allocation.map((x) => `<span>${name(x.id)} ${people(x)}</span>`).join("")}${people(e.reserve) ? `<span>${t("reserve")} ${people(e.reserve)}</span>` : ""}</div>` : ""}`;
          break;
        }
        case "hospital":
        case "school":
        case "recruitBonus":
        case "recruit":
        case "villa":
        case "bonusAssign":
        case "poachWorker":
          text = `${t("journalRecruit")} ${metric(e.kind === "c" ? "citizen" : "worker", 1)}${target(e)}`;
          break;
        case "bohio":
          text = `${t("journalMoveWorker")} ${metric(e.kind === "c" ? "citizen" : "worker", 1)}${target(e)}`;
          break;
        case "festival":
          text = `${t("journalFestival")} ${icon("festival", 22)} ${name(e.id)} → ${reward(e.reward)}`;
          break;
        case "raid":
          text = `${t("journalRaid")} ${e.good ? metric(e.good, e.amount) : esc(e.amount)}`;
          break;
        case "plunder":
          text = t("journalPlunder");
          break;
        case "capture":
          text = `${t("journalCapture")} ${icon(e.id, 22)} ${name(e.id)}`;
          break;
        case "poach":
          text = t("journalPoach");
          break;
        case "discardWorker":
          text = `${t("journalDiscardWorker")} ${metric(e.kind === "c" ? "citizen" : "worker", 1)}`;
          break;
        case "park":
        case "zoneSell":
          text = `${t("journalRemove")} ${e.estateId ? `${icon(e.estateId, 20)} ${name(e.estateId)}` : t("countryside")}`;
          break;
        case "zoneBuy":
          text = t("journalBuyEstate");
          break;
        case "hacienda":
          text = t("journalDraw");
          break;
        case "forest":
          return ""; // The resulting estate has its own entry.
        case "pension":
          text = `${t("pensionOffice")} · ${metric(e.good, 1)} →`;
          break;
        case "parkReward":
          text = `${t("parkAuthority")} →`;
          break;
        case "assembly":
          text = `${t("assemblyHall")} →`;
          break;
        case "pass":
          text = `${t("journalPass")}${e.role ? ` · ${name(e.role)}` : ""}`;
          break;
        default:
          text = name(e.type);
      }
      const declined = e.decline?.length
        ? `<small>${t("withoutBonus")} · ${e.decline.map(name).join(", ")}</small>`
        : "";
      return row(e, `${text} ${reward(e)}${declined}`);
    })
    .join("");
  return `<ol class="journal-list">${setup}${entries}${!moves.length && (automatedSetup || !drafts.length) ? `<li class="journal-empty">${t("journalEmpty")}</li>` : ""}</ol>`;
}
