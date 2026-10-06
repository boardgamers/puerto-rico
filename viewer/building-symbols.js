import { BUILDINGS as B } from "../engine/catalog.js";
import { icon, scoreToken } from "./icons.js";
const esc = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const quantity = (id, n) =>
  id === "vp"
    ? scoreToken(n, 28)
    : `<span class="effect-quantity">${icon(id, 24)}<b>${n}</b></span>`;
const arrow = () => icon("arrow", 18);
const row = (...parts) => `<span class="effect-row">${parts.join("")}</span>`;
const staffed = (id) =>
  `<span class="staffed-icon">${icon(id, 28)}${icon("worker", 15)}</span>`;

export const buildingSprite = (id) =>
  B[id]?.size === 2
    ? "expandedBuilding"
    : B[id]?.good && B[id].good !== "tailor"
      ? `workshop-${B[id].good}`
      : ["smallWarehouse", "largeWarehouse", "storehouse"].includes(id)
        ? "storage"
        : "building";

export function buildingSymbols(id, t) {
  const caption = (key) =>
    `<small class="effect-caption">${t.html(key)}</small>`;
  const b = B[id];
  const full =
    b.good && b.good !== "tailor"
      ? `${t("productionCapacity")} : ${b.workers} ${t(b.good)}. ${t("matchingWorkers")}`
      : t.effect(id);
  let visual;
  if (b.good && b.good !== "tailor")
    visual =
      row(
        staffed(`field-${b.good}`),
        "<b>+</b>",
        staffed(`workshop-${b.good}`),
        arrow(),
        icon(b.good, 26),
      ) +
      `<small class="effect-caption">${t("productionCapacity")} : <b>${b.workers}</b></small>` +
      caption("bothStaffed");
  else
    switch (id) {
      case "smallMarket":
      case "largeMarket":
        visual = row(
          icon("trader"),
          arrow(),
          quantity("coin", id === "smallMarket" ? "+1" : "+2"),
        );
        break;
      case "buildersYard":
        visual = row(icon("planter"), arrow(), icon("quarry", 28));
        break;
      case "hacienda":
        visual =
          row(icon("planter"), quantity("estate", "+1")) + caption("drawn");
        break;
      case "smallWarehouse":
      case "largeWarehouse":
        visual =
          row(
            icon("storage", 28),
            `<b>${id === "smallWarehouse" ? "1" : "2"} ${t(id === "smallWarehouse" ? "wholeType" : "types")}</b>`,
          ) + row(quantity("crate", "+1"));
        break;
      case "hospital":
        visual = row(
          `<span class="effect-options">${icon("estate")}/${icon("quarry")}</span>`,
          arrow(),
          quantity("worker", "+1"),
        );
        break;
      case "school":
        visual = row(icon("builder"), arrow(), quantity("worker", "+1"));
        break;
      case "harbor":
        visual = row(icon("ship"), arrow(), quantity("vp", "+1"));
        break;
      case "wharf":
        visual =
          row(icon("ship", 28), `<b>1 ${t("wholeType")}</b>`) +
          caption("oncePerCaptain");
        break;
      case "customsHouse":
        visual = row(
          icon("scoring", 20),
          quantity("vp", 4),
          arrow(),
          quantity("vp", "+1"),
        );
        break;
      case "cityHall":
        visual =
          row(
            icon("scoring", 20),
            icon("building"),
            arrow(),
            quantity("vp", "+1"),
          ) + caption("commercialOnly");
        break;
      case "canal":
        visual =
          row(quantity("fruit", "+1"), quantity("sugar", "+1")) +
          caption("largeProductionOnly");
        break;
      case "lumberyard":
        visual =
          row(icon("estate"), arrow(), icon("forest")) +
          row(quantity("forest", 2), arrow(), quantity("coin", "−1"));
        break;
      case "hiddenMarket":
        visual =
          caption("ifShortOfCash") +
          row(
            `<span class="effect-options">${icon("worker")}/${icon("crate")}/${icon("vp")}</span>`,
            arrow(),
            quantity("coin", 1),
          ) +
          caption("oneOfEachMax");
        break;
      case "storehouse":
        visual = row(icon("storage", 28), quantity("crate", "+3"));
        break;
      case "bohio":
        visual = row(icon("worker"), arrow(), icon("space", 28));
        break;
      case "merchantOutpost":
        visual =
          row(icon("trader"), icon("crate"), arrow(), icon("coin")) +
          caption("directSale");
        break;
      case "smallWharf":
        visual =
          row(quantity("crate", 2), arrow(), quantity("vp", 1)) +
          caption("mixedOncePerCaptain");
        break;
      case "publishingHouse":
        visual =
          row(icon("retrigger", 27), `<b>${t("privilege")}</b>`) +
          row(icon("planter"), quantity("estate", "+1"));
        break;
      case "assemblyHall":
        visual =
          caption("captainStart") +
          row(quantity("crate", 2), arrow(), quantity("vp", "+1")) +
          caption("sameType");
        break;
      case "monument":
        visual = row(icon("scoring"), icon("noWorker", 28));
        break;
      case "chapel":
        visual =
          row(
            icon("craftsman", 20),
            icon("worker"),
            arrow(),
            quantity("coin", "+1"),
          ) +
          row(
            icon("craftsman", 20),
            icon("citizen"),
            arrow(),
            quantity("vp", "+1"),
          );
        break;
      case "notary":
        visual =
          row(icon("worker"), icon("building"), quantity("coin", "−1")) +
          row(
            icon("citizen"),
            icon("expandedBuilding"),
            quantity("coin", "−2"),
          );
        break;
      case "villa":
        visual =
          row(icon("recruiter"), arrow(), quantity("citizen", "+1")) +
          caption("workerIfEmpty");
        break;
      case "tailorShop":
        visual = row(
          icon("craftsman", 20),
          icon("citizen"),
          arrow(),
          quantity("coin", "+1"),
        );
        break;
      case "townSquare":
        visual = row(
          icon("scoring", 20),
          icon("citizen"),
          arrow(),
          quantity("vp", "+1"),
        );
        break;
      default:
        return t.effectHtml(id);
    }
  return `<span class="building-symbols" role="img" aria-label="${esc(full)}" title="${esc(full)}"><span aria-hidden="true">${visual}</span></span>`;
}
