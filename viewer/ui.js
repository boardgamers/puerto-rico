import morphdom from "morphdom";
import { mountChat } from "@boardgamers/protocol/chat/dom";
import { BUILDINGS as B, GOODS } from "../engine/catalog.js";
import {
  autoAssignment,
  autoStorage,
  cost,
  production,
  citySize,
} from "../engine/index.js";
import { translator } from "./i18n.js";
import { icon, scoreToken } from "./icons.js";
import { journalContent } from "./journal.js";
import { buildingSymbols } from "./building-symbols.js";
import { richText } from "./rich-text.js";
import { town } from "./town.js";
import css from "./style.css";

const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const encode = (m) => esc(encodeURIComponent(JSON.stringify(m)));
const playerColors = ["#316f9a", "#a35625", "#795694", "#477347", "#a14564"];
const playerMeeple =
  '<path d="M9 4a3 3 0 0 1 6 0v2l7 4-3 4-3-2 3 10h-6l-1-6-1 6H5l3-10-3 2-3-4 7-4Z"/>';
const playerShapes = [
  '<circle cx="12" cy="12" r="10"/>',
  '<path d="M12 2 23 21H1Z"/>',
  '<rect x="3" y="3" width="18" height="18" rx="1"/>',
  '<path d="m12 1 11 11-11 11L1 12Z"/>',
  '<path d="M8 2h8v6h6v8h-6v6H8v-6H2V8h6Z"/>',
];
const spriteFor = (id) =>
  B[id]?.good && B[id].good !== "tailor" ? B[id].good : "building";
export function mountGame(
  target,
  { onMove, chat, onOpenPlayer, localControls, automatedSetup = false } = {},
) {
  const shell = document.createElement("div");
  shell.className = "pr-game";
  shell.innerHTML = `<style>${css}</style><div class="pr-content"></div><dialog class="pr-modal"><header><h2></h2><button type="button" class="icon-button" data-close aria-label="Close">${icon("close")}</button></header><div class="modal-body"></div></dialog><dialog class="pr-chat"><header><h2>Chat</h2><button type="button" class="icon-button" data-close aria-label="Close">${icon("close")}</button></header><div class="chat-mount"></div></dialog><p class="pr-error" role="alert" hidden></p>`;
  target.append(shell);
  const content = shell.querySelector(".pr-content"),
    modal = shell.querySelector(".pr-modal"),
    chatDialog = shell.querySelector(".pr-chat"),
    body = modal.querySelector(".modal-body"),
    error = shell.querySelector(".pr-error");
  let state,
    seat = 0,
    view = 0,
    t = translator("en"),
    preferences = {},
    enabled = true,
    pending = false,
    draft = null,
    draftKey = "",
    tool = "w",
    lastFocus,
    modalMode = "",
    roleConfirmation = null,
    scrollLog = 0;
  const metric = (id, n) =>
    id === "vp"
      ? `<span class="metric" role="img" title="${esc(t("vp"))}" aria-label="${esc(t("vp"))} : ${esc(n)}">${scoreToken(n)}</span>`
      : `<span class="metric">${icon(id, 20)}<b>${esc(n)}</b></span>`;
  const goodsRow = (goods) =>
    GOODS.filter((g) => goods[g])
      .map((g) => metric(g, goods[g]))
      .join("");
  const playerMarker = (i, decorative = false) => {
    const colorBlind = preferences.colorBlind === true;
    const shape = colorBlind
      ? playerShapes[i % playerShapes.length]
      : playerMeeple;
    return `<span class="player-marker${colorBlind ? " player-marker-shaped" : ""}" style="--player-color:${playerColors[i % playerColors.length]}" ${decorative ? 'aria-hidden="true"' : `role="img" aria-label="${esc(state.players[i].name)}"`} title="${esc(state.players[i].name)}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="#ffffffbb" stroke-width="1.5" stroke-linejoin="round">${shape}</svg></span>`;
  };
  const pointsBadge = (n) =>
    `<span class="points-badge" role="img" title="${esc(t("printedPoints"))} : ${n}" aria-label="${esc(t("printedPoints"))} : ${n}">${scoreToken(n, 28)}</span>`;
  let chatView;
  function configureChat() {
    if (!chat) return;
    chatView?.destroy();
    chatView = mountChat(shell.querySelector(".chat-mount"), {
      chat,
      openPlayer: onOpenPlayer,
      styles: true,
      labels: {
        title: t("chat"),
        message: t("message"),
        placeholder: t("messagePlaceholder"),
        send: t("send"),
        sending: t("sending"),
        empty: t("noMessages"),
        edited: t.fr ? "modifié" : "edited",
        game: t.fr ? "Jeu" : "Game",
        suggestions: t.fr ? "Joueurs" : "Players",
        unread: (n) => `${n}`,
        date: (d) => d.toLocaleDateString(t.fr ? "fr" : "en"),
        status: (s) => s.reason || (s.canSend ? "" : t("readOnly")),
      },
    });
    const chatBody = document.createElement("div");
    chatBody.className = "chat-body";
    for (const child of [...chatView.element.children])
      if (!child.matches("summary,style")) chatBody.append(child);
    chatView.element.append(chatBody);
    chatDialog.querySelector("h2").textContent = t("chat");
  }
  configureChat();
  const allowed = () => enabled && !pending && seat === state?.tasks[0]?.p;
  const moveButton = (m, label, pictogram, classes = "", description = "") => {
    const hint =
      description +
      (description && m.decline?.length
        ? ` · ${t("withoutBonus")} : ${m.decline.map((id) => t(id)).join(", ")}`
        : "");
    return `<button type="button" class="move ${classes}" data-move="${encode(m)}" ${hint ? `title="${esc(hint)}" aria-label="${esc(hint)}"` : ""} ${allowed() || (enabled && !pending && m.type === "bohio") ? "" : "disabled"}>${pictogram ? icon(pictogram, 26) : ""}<span>${label}${m.decline?.length ? `<small>${t("withoutBonus")} · ${m.decline.map((id) => t(id)).join(", ")}</small>` : ""}</span></button>`;
  };
  function show(title, html, mode = "") {
    lastFocus = document.activeElement;
    modalMode = mode;
    modal.querySelector("h2").textContent = title;
    body.innerHTML = html;
    body.scrollTop = 0;
    if (!modal.open) modal.showModal();
    modal.querySelector("[data-close]").focus();
  }
  function hide(d) {
    d.close();
    if (d === modal) roleConfirmation = null;
    if (d === chatDialog) chat?.setOpen(false);
    lastFocus?.focus?.();
  }
  function draftInit() {
    const task = state.tasks[0],
      key = `${state.historyLength}:${task?.kind}:${task?.p}`;
    if (key === draftKey) return;
    draftKey = key;
    draft = null;
    if (enabled && seat === task?.p && task?.kind === "assign")
      draft = autoAssignment(state, seat);
    if (enabled && seat === task?.p && task?.kind === "store")
      draft = autoStorage(state, seat);
  }
  const currentName = () => state.players[state.tasks[0]?.p]?.name ?? "";
  function title() {
    if (state.finished) return t("finished");
    if (!allowed()) return `${t("waiting")} ${esc(currentName())}`;
    const task = state.tasks[0];
    return t(
      {
        role: "chooseRole",
        draft: "chooseDraft",
        plant: "choosePlant",
        build: "chooseBuild",
        recruit: "chooseRecruit",
        assign: "assign",
        produce: "produce",
        produceBonus: "produceBonus",
        trade: "trade",
        ship: "ship",
        store: "store",
        hacienda: "haciendaHint",
        forest: "forestHint",
        hospital: "hospitalHint",
        school: "schoolWorker",
        bonusAssign: "bonusAssign",
        recruitBonus: "recruitBonus",
        villa: "villaHint",
        park: "park",
        pension: "pension",
        smuggle: "smuggler",
        poach: "poach",
        poachDiscard: "discardWorker",
        assembly: "assemblyHall",
      }[task.kind] ?? task.kind,
    );
  }
  function moveLabel(m) {
    switch (m.type) {
      case "plant":
        return `${t(m.id)}${m.forest ? ` → ${t("forest")}` : ""}`;
      case "forest":
        return t(m.forest ? "forest" : state.tasks[0].id);
      case "hacienda":
      case "recruitBonus":
      case "villa":
      case "school":
        return t("claim");
      case "discardWorker":
        return t(m.kind === "c" ? "citizens" : "workers");
      case "recruit":
        return t(m.kind === "c" ? "citizens" : "workers");
      case "produce":
        return goodsRow(m.goods) || t("pass");
      case "produceBonus":
        return t(m.good);
      case "trade":
        return `${t(m.good)} ${metric("coin", GOODS.indexOf(m.good) + (seat === state.owner ? (has("publishingHouse") ? 2 : 1) : 0) + (m.outpost ? 0 : (has("smallMarket") ? 1 : 0) + (has("largeMarket") ? 2 : 0)))}${m.outpost ? ` · ${t("outpost")}` : ""}`;
      case "ship":
        return `${t(m.good)} ${m.ship === "wharf" ? t("wharfShip") : `→ ${state.ships[m.ship].capacity}`} <b>×${m.ship === "wharf" ? state.players[seat].goods[m.good] : Math.min(state.players[seat].goods[m.good], state.ships[m.ship].capacity - state.ships[m.ship].amount)}</b>`;
      case "smallWharf":
        return t("smallWharfShip");
      case "hospital":
      case "bonusAssign":
      case "poachWorker":
      case "bohio":
        return targetLabel(m.target);
      case "pension":
        return `${t(m.good)} → ${metric("vp", 1)}`;
      case "park":
      case "zoneSell":
        return `${t(m.type === "park" ? "park" : "zoneSell")} · ${t(state.players[seat].estates[m.estate].id)}`;
      case "raid":
        return `${t("raid")} · ${state.ships[m.ship].capacity} ${metric(state.ships[m.ship].good, m.amount)}`;
      case "capture":
        return `${t("capture")} · ${t(m.id)}`;
      default:
        return t(m.type);
    }
  }
  function targetLabel(key) {
    if (key === "reserve") return t("reserve");
    const collection = key[0] === "e" ? "estates" : "buildings";
    return t(state.players[seat][collection][Number(key.slice(1))]?.id);
  }
  function has(id) {
    return state.players[seat]?.buildings.some(
      (b) => b.id === id && b.w + b.c > 0,
    );
  }
  function compactAction(m) {
    const arrow = icon("arrow", 20);
    switch (m.type) {
      case "trade": {
        const value =
          GOODS.indexOf(m.good) +
          (seat === state.owner ? (has("publishingHouse") ? 2 : 1) : 0) +
          (m.outpost
            ? 0
            : (has("smallMarket") ? 1 : 0) + (has("largeMarket") ? 2 : 0));
        return [
          `${metric(m.good, 1)}${arrow}${metric("coin", value)}${m.outpost ? `<small>${t("outpost")}</small>` : ""}`,
          `${t("trade")} : ${t(m.good)} → ${value} ${t("coins")}${m.outpost ? ` · ${t("outpost")}` : ""}`,
        ];
      }
      case "ship": {
        const ownShip = m.ship === "wharf";
        const ship = ownShip ? null : state.ships[m.ship];
        const amount = Math.min(
          state.players[seat].goods[m.good],
          ownShip ? Infinity : ship.capacity - ship.amount,
        );
        return [
          `${metric(m.good, amount)}${arrow}${ownShip ? `${icon("ship", 27)}<small>${t("wharfShip")}</small>` : metric("ship", `${ship.amount}/${ship.capacity}`)}`,
          `${t("ship")} : ${amount} ${t(m.good)} → ${ownShip ? t("wharfShip") : `${t("journalShipCapacity")} ${ship.capacity} (${ship.amount}/${ship.capacity})`}`,
        ];
      }
      case "produceBonus":
        return [metric(m.good, "+1"), `${t("produceBonus")} : ${t(m.good)}`];
      case "recruit":
      case "discardWorker": {
        const person = m.kind === "c" ? "citizen" : "worker";
        return [
          metric(person, m.type === "recruit" ? "+1" : "−1"),
          `${t(m.type === "recruit" ? "chooseRecruit" : "discardWorker")} : ${t(m.kind === "c" ? "citizens" : "workers")}`,
        ];
      }
      case "pension":
        return [
          `${metric(m.good, 1)}${arrow}${metric("vp", 1)}`,
          `${t("pensionOffice")} : ${t(m.good)} → 1 ${t("vp")}`,
        ];
      default:
        return null;
    }
  }
  function actionPanel() {
    if (!allowed()) return "";
    const task = state.tasks[0],
      moves = state.legal.filter(
        (m) => m.type !== "bohio" && (m.type !== "pass" || m.decline?.length),
      );
    if (task.kind === "assign")
      return `<div class="assignment-tools" role="group" aria-label="${esc(t("workers"))}">${["w", "c", "erase"].map((k) => `<button data-tool="${k}" class="${tool === k ? "selected" : ""}" aria-pressed="${tool === k}" aria-label="${esc(t(k === "erase" ? "erase" : k === "w" ? "workers" : "citizens"))}" title="${esc(t(k === "erase" ? "erase" : k === "w" ? "workers" : "citizens"))}">${icon(k === "w" ? "worker" : k === "c" ? "citizen" : "erase")}${k === "erase" ? "" : remaining()[k]}</button>`).join("")}<button class="icon-button" data-auto title="${esc(t("autoAssign"))}" aria-label="${esc(t("autoAssign"))}">${icon("autoAssign")}</button><span>${t("workerTool")}</span></div>`;
    if (task.kind === "store") return storageEditor();
    if (["role", "draft", "build", "plant"].includes(task.kind)) return "";
    return `<div class="action-choices">${moves
      .map((m) => {
        const compact = compactAction(m);
        return compact
          ? moveButton(m, compact[0], null, "compact-action", compact[1])
          : moveButton(
              m,
              moveLabel(m),
              m.good ??
                {
                  recruit: m.kind === "c" ? "citizen" : "worker",
                  produce: "craftsman",
                  hacienda: "planter",
                  villa: "citizen",
                  recruitBonus: "worker",
                  raid: "smuggler",
                  plunder: "smuggler",
                  poach: "recruiter",
                  capture: m.id,
                  forest: m.forest ? "forest" : task.id,
                }[m.type],
            );
      })
      .join("")}</div>`;
  }
  function remaining() {
    const a = state.players[seat];
    let w = a.reserve.w,
      c = a.reserve.c;
    for (const x of [...a.estates, ...a.buildings]) {
      w += x.w;
      c += x.c;
    }
    for (const x of [...draft.estates, ...draft.buildings]) {
      w -= x.w;
      c -= x.c;
    }
    return { w, c };
  }
  function storageEditor() {
    const slots =
      (has("smallWarehouse") ? 1 : 0) + (has("largeWarehouse") ? 2 : 0);
    return `<div class="storage-editor"><p>${t("storageHint")}</p>${GOODS.filter(
      (g) => state.players[seat].goods[g],
    )
      .map(
        (g) =>
          `<div>${icon(g, 28)}<strong>${t(g)}</strong>${slots ? `<button data-storetype="${g}" class="${draft.types.includes(g) ? "selected" : ""}" aria-pressed="${draft.types.includes(g)}" title="${esc(t("totalStorage"))}" aria-label="${esc(t("totalStorage"))}">${icon("storage", 24)}</button>` : ""}<button class="icon-button" data-qty="${g}:-1" aria-label="${esc(t("minus"))}">${icon("minus")}</button><b>${draft.goods[g]} / ${state.players[seat].goods[g]}</b><button class="icon-button" data-qty="${g}:1" aria-label="${esc(t("plus"))}">${icon("plus")}</button></div>`,
      )
      .join("")}</div>`;
  }
  function peopleSlots(key, x, n = 1) {
    const editable =
        allowed() && state.tasks[0].kind === "assign" && view === seat,
      values = editable
        ? draft[key[0] === "e" ? "estates" : "buildings"][Number(key.slice(1))]
        : x;
    return `<div class="worker-slots">${Array.from({ length: n }, (_, i) => {
      const k = i < values.c ? "c" : i < values.c + values.w ? "w" : null;
      return editable
        ? `<button class="worker-slot ${k ?? ""}" data-slot="${key}:${i}" aria-label="${esc(`${t(k === "c" ? "citizens" : k === "w" ? "workers" : "empty")} · ${t(x.id)}`)}">${k ? icon(k === "c" ? "citizen" : "worker", 20) : "+"}</button>`
        : `<span class="worker-slot ${k ?? ""}">${k ? icon(k === "c" ? "citizen" : "worker", 20) : "·"}</span>`;
    }).join("")}</div>`;
  }
  function playerBoard() {
    const a = state.players[view];
    return `<section class="player-board panel" id="own-board"><header><h2>${playerMarker(view, true)}${esc(a.name)}</h2><div>${metric("coin", a.coins)}${metric("vp", a.vp ?? "?")}${metric("worker", a.reserve.w)}${a.reserve.c ? metric("citizen", a.reserve.c) : ""}</div></header><div class="inventory">${GOODS.map((g) => metric(g, a.goods[g])).join("")}</div><h3>${t("countryside")} <small>${a.estates.length}/12</small></h3><div class="estates">${a.estates.map((x, i) => `<article class="estate ${x.id}" title="${esc(t(x.id))}">${icon(x.id, 31)}${x.id !== "forest" ? peopleSlots(`e${i}`, x) : ""}</article>`).join("")}${Array.from({ length: Math.max(0, 12 - a.estates.length) }, () => '<span class="estate empty-estate"></span>').join("")}</div><h3>${t("city")} <small>${citySize(a)}/12</small></h3><div class="city-grid">${a.buildings.map((x, i) => `<article class="owned-building ${B[x.id].size === 2 ? "expanded" : ""}"><button type="button" data-building="${x.id}" class="building-face" title="${esc(t.effect(x.id))}">${icon(spriteFor(x.id), 28)}<span>${t(x.id)}</span>${pointsBadge(B[x.id].vp)}</button>${peopleSlots(`b${i}`, x, B[x.id].workers)}</article>`).join("")}${a.buildings.length ? "" : `<div class="empty-city">${town}<span>${t("emptyCity")}</span></div>`}</div><button class="mobile-market-launch" data-market>${icon("building")} ${t("market")}</button></section>`;
  }
  function shipGraphic(sh) {
    return `<svg class="ship-art" viewBox="0 0 200 112" aria-hidden="true"><path fill="#edf0d4" stroke="#b6a37b" d="M96 6v58H42Zm10 9v49h43Z"/><path fill="#80614b" d="m12 66 17 31q75 22 143-3l18-28Z"/><path fill="none" stroke="#d7ac75" stroke-width="3" d="m28 77 144 0m-70-74v65"/>${Array.from({ length: sh.capacity }, (_, i) => `<rect x="${22 + i * (155 / sh.capacity)}" y="72" width="${Math.min(18, 140 / sh.capacity)}" height="17" rx="2" fill="${i < sh.amount ? "#e6c06f" : "#483e38"}" stroke="#bfa587"/>`).join("")}<path d="M5 105q20-10 40 0t40 0t40 0t40 0t30 0" fill="none" stroke="#9bbebc" stroke-width="2"/></svg>`;
  }
  function sharedBoard() {
    const acting = allowed(),
      task = state.tasks[0];
    return `<section class="shared-board"><div class="roles">${state.roles
      .map((r) => {
        const m = state.legal.find((m) => m.type === "role" && m.id === r.id),
          selected = r.taken !== null,
          warning = m && acting ? state.roleWarnings?.[r.id] : null;
        return `<button data-role-id="${r.id}" class="role ${selected ? "taken" : ""} ${m ? "available" : ""}" ${selected ? `title="${esc(t(r.id))} · ${esc(state.players[r.taken].name)}"` : warning ? `title="${esc(t(warning.reason))}" aria-label="${esc(t(r.id))} — ${esc(t(warning.reason))}"` : ""} ${m && acting ? `data-move="${encode(m)}"` : `data-role="${r.id}"`}>${warning ? `<span class="role-warning" aria-hidden="true">${icon("warning", 15)}</span>` : ""}<span class="role-icon">${icon(r.id === "adventurer2" ? "adventurer" : r.id, 32)}${r.coins ? `<span class="coin-badge">${r.coins}</span>` : ""}</span><b>${t(r.id)}</b>${selected ? playerMarker(r.taken) : ""}</button>`;
      })
      .join(
        "",
      )}<button type="button" class="role role-help" data-roles-help title="${esc(t("rolesHelp"))}" aria-label="${esc(t("rolesHelp"))}">${icon("help", 32)}</button></div><div class="port panel"><header><h2>${t("harborTitle")}</h2><div>${metric("vp", Math.max(0, state.vpSupply))}${metric("worker", state.register.w)}${state.register.c ? metric("citizen", state.register.c) : ""}</div></header><div class="ships">${state.ships.map((sh, i) => `<article class="ship ${sh.amount === sh.capacity ? "full" : ""}">${shipGraphic(sh)}<div>${sh.good ? icon(sh.good, 25) : icon("ship", 25)}<b>${sh.amount}<small> / ${sh.capacity}</small></b></div></article>`).join("")}</div><div class="trade-row"><span>${t("tradingHouse")}</span>${Array.from({ length: 4 }, (_, i) => `<span class="trade-slot">${state.trade[i] ? icon(state.trade[i], 26) : "·"}</span>`).join("")}</div><div class="estate-offer">${state.offer
      .map((id, i) => {
        const m = state.legal.find(
          (m) => m.type === "plant" && m.id === id && !m.forest,
        );
        return `<button class="offer ${id}" ${m && acting ? `data-move="${encode(m)}"` : "disabled"} title="${esc(t(id))}">${icon(id, 28)}</button>`;
      })
      .join("")}${(() => {
      const m = state.legal.find(
        (m) => m.type === "plant" && m.id === "quarry",
      );
      return `<button class="offer quarry" ${m && acting ? `data-move="${encode(m)}"` : "disabled"} title="${esc(t("quarry"))}">${icon("quarry", 28)}<small>${state.quarries}</small></button>`;
    })()}${acting && task.kind === "plant" && state.legal.some((m) => m.forest) ? `<button data-forests>${icon("forest")} ${t("forest")}</button>` : ""}</div></div>${state.festivals.length ? `<section class="festival-strip">${state.festivals.map((f, i) => `<button data-festival="${i}" class="festival ${f.claimed !== undefined ? "claimed" : ""}">${icon(f.claimed !== undefined ? "check" : "festival", 20)}<span>${t(f.id)}</span><span class="festival-target">${[...f.targets.goods, ...f.targets.estates].map((g) => icon(g, 22)).join("")}${f.targets.building ? icon("building", 22) : ""}</span></button>`).join("")}</section>` : ""}</section>`;
  }
  function buildingSlots(b) {
    return `<span class="capacity-slots" title="${esc(`${t("workerSpaces")} : ${b.workers}`)}" aria-label="${esc(`${t("workerSpaces")} : ${b.workers}`)}">${Array.from({ length: b.workers }, () => `<span>${icon("worker", 17)}</span>`).join("")}</span>`;
  }
  function buildingEffect(id, html = false) {
    const b = B[id];
    return b.good && b.good !== "tailor"
      ? html
        ? richText(`${t("produce")} : {${b.good}}.`, t.fr)
        : `${t("produce")} : ${t(b.good)}.`
      : html
        ? t.effectHtml(id)
        : t.effect(id);
  }
  function market() {
    const task = state.tasks[0],
      isDraft = task?.kind === "draft",
      ids = isDraft
        ? [
            ...new Set(
              state.legal.filter((m) => m.type === "draft").map((m) => m.id),
            ),
            ...Object.keys(state.market),
          ]
        : Object.keys(state.market);
    return `<section class="building-market panel"><header><h2>${isDraft ? t("chooseDraft") : t("market")}</h2><span>${icon("building")}</span></header><div class="market-grid">${ids
      .sort((a, b) => B[a].cost - B[b].cost || a.localeCompare(b))
      .map((id) => {
        const b = B[id],
          m = state.legal.find(
            (m) =>
              (isDraft ? m.type === "draft" : m.type === "build") &&
              m.id === id,
          ),
          n = state.market[id] ?? (state.players.length === 2 ? 1 : b.copies);
        const price =
          !isDraft && task?.kind === "build" && Number.isInteger(seat)
            ? cost(state, seat, id)
            : b.cost;
        const stock =
          n === 0
            ? t("soldOut")
            : `${n} ${t(n === 1 ? "stockAvailableOne" : "stockAvailable")}`;
        return `<button class="bcard ${b.good ? "production" : "commercial"} ${m && allowed() ? "affordable" : ""} ${!n ? "sold-out" : ""}" data-building="${id}" ${!n && !m ? 'aria-disabled="true"' : ""}>
          <span class="bcard-title">${icon(spriteFor(id), 30)}<strong>${t(id)}</strong></span>
          <span class="bcard-cost" title="${esc(`${t("cost")} : ${price}`)}" aria-label="${esc(`${t("cost")} : ${price}`)}">${metric("coin", price)}</span>
          <span class="bcard-effect">${buildingSymbols(id, t)}</span>
          <span class="bcard-stats">${pointsBadge(b.vp)}${buildingSlots(b)}</span>
          <span class="bcard-stock">${b.size === 2 ? `<span class="city-footprint" title="${esc(t("twoCitySpaces"))}" aria-label="${esc(t("twoCitySpaces"))}">${icon("citySpace", 22)}</span>` : ""}<span>${stock}</span></span>
        </button>`;
      })
      .join("")}</div></section>`;
  }
  function bottom() {
    if (state.finished)
      return `<div class="action-dock"><strong>${t("finished")}</strong><button class="primary" data-scores>${t("finalScore")}</button></div>`;
    const can = allowed(),
      task = state.tasks[0],
      pass = state.legal.find((m) => m.type === "pass");
    let confirm = "";
    if (can && ["build", "draft"].includes(task.kind))
      confirm = `<button class="primary" data-market>${icon("building")} ${t("market")}</button>`;
    if (can && task.kind === "assign") {
      const rest = remaining(),
        a = state.players[seat],
        capacity =
          a.estates.filter((e) => e.id !== "forest").length +
          sum(a.buildings.map((b) => B[b.id].workers)),
        assigned = sum(
          [...draft.estates, ...draft.buildings].map((x) => x.w + x.c),
        ),
        valid = assigned === Math.min(capacity, assigned + rest.w + rest.c);
      confirm = `<button class="primary" data-confirm-assign ${valid ? "" : "disabled"}>${icon("check")} ${t("confirm")}</button>`;
    }
    if (can && task.kind === "store") {
      const n = sum(
        GOODS.filter((g) => !draft.types.includes(g)).map(
          (g) => draft.goods[g],
        ),
      );
      confirm = `<button class="primary" data-confirm-store ${n <= 1 + (has("storehouse") ? 3 : 0) ? "" : "disabled"}>${icon("check")} ${t("confirm")}</button>`;
    }
    const special =
      enabled && !pending && state.legal.some((m) => m.type === "bohio")
        ? `<button class="icon-button" data-bohio title="${esc(t("bohioMove"))}">${icon("worker")}</button>`
        : "";
    return `<div class="action-dock"><div>${icon(task?.kind === "role" ? "governor" : (state.role ?? "building"), 26)}<strong>${title()}</strong></div>${special}${pass && can ? moveButton(pass, t(task?.kind === "trade" && task.acted ? "finish" : "pass"), "pass", "quiet") : ""}${confirm}</div>`;
  }
  function render(s) {
    if (s) state = s;
    if (!state) return;
    if (
      roleConfirmation &&
      (!enabled ||
        seat !== roleConfirmation.seat ||
        state.historyLength !== roleConfirmation.historyLength ||
        !state.legal.some(
          (m) => m.type === "role" && m.id === roleConfirmation.move.id,
        ))
    )
      hide(modal);
    view = Math.min(view, state.players.length - 1);
    draftInit();
    shell.classList.toggle(
      "is-building",
      allowed() && ["build", "draft"].includes(state.tasks[0]?.kind),
    );
    const html = `<div class="pr-content"><header class="game-header"><div class="wordmark"><span>PUERTO RICO</span><small>1897 · Special Edition</small></div><span class="round-indicator">${t("round")} <b>${state.round}</b></span><nav>${["rules", "journal", ...(chat ? ["chat"] : [])].map((id) => `<button class="icon-button" data-panel="${id}" title="${esc(t(id))}" aria-label="${esc(t(id))}">${icon(id)}</button>`).join("")}</nav></header><div class="player-strip">${state.players.map((p, i) => `<button data-player="${i}" class="player-tab ${i === view ? "selected" : ""} ${i === state.tasks[0]?.p ? "turn" : ""}"><span class="player-name">${playerMarker(i, true)}${i === state.governor ? icon("governor", 18) : ""}${esc(p.name)}</span><span>${metric("coin", p.coins)}${metric("vp", p.vp ?? "?")}</span></button>`).join("")}</div>${localControls ? `<div class="local-controls"><span>${t("local")}</span><button data-local="undo" title="${esc(t("undo"))}" aria-label="${esc(t("undo"))}">${icon("undo", 18)}</button><button data-local="opponents" title="${esc(t("opponents"))}" aria-label="${esc(t("opponents"))}">${icon("pass", 18)}</button><button data-local="reset" title="${esc(t("newGame"))}" aria-label="${esc(t("newGame"))}">${icon("reset", 18)}</button><button data-local="dark" title="Light / dark" aria-label="Light / dark">${icon("dark", 18)}</button></div>` : ""}<div class="board-layout">${sharedBoard()}${playerBoard()}<section class="action-panel" aria-live="polite">${allowed() && !["role", "draft", "build", "plant"].includes(state.tasks[0]?.kind) ? `<h2>${title()}</h2>` : ""}${actionPanel()}</section>${market()}</div>${bottom()}</div>`;
    morphdom(content, html, {
      childrenOnly: true,
      onBeforeElUpdated(from, to) {
        return !from.isEqualNode(to);
      },
    });
    if (modal.open && modalMode === "journal") {
      scrollLog = body.scrollTop;
      body.innerHTML = journal();
      body.scrollTop = scrollLog;
    }
  }
  function roleReference(id) {
    const solo = id === "smuggler" || id.startsWith("adventurer");
    const privilege = t.rolePrivilege(id);
    return `<article class="role-reference"><h3>${icon(id.startsWith("adventurer") ? "adventurer" : id, 32)}${t(id)}</h3><div><small>${t(solo ? "chooserOnly" : "everyone")}</small><p>${t.roleActionHtml(id)}</p></div>${privilege ? `<div class="role-privilege"><small>${t(solo ? "roleNote" : "privilege")}</small><p>${t.rolePrivilegeHtml(id)}</p></div>` : ""}</article>`;
  }
  function confirmRole(m) {
    const warning = state.roleWarnings?.[m.id];
    if (!warning) return false;
    show(
      t("roleWarningTitle"),
      `
      <div class="role-warning-heading">${icon(m.id, 36)}<strong>${t(m.id)}</strong></div>
      <p>${t.html(warning.reason)}</p>
      ${warning.coins ? `<p class="role-warning-gain">${t("roleCoinsStill")} ${metric("coin", warning.coins)}</p>` : ""}
      ${warning.bonuses.length ? `<div class="role-warning-bonuses"><small>${t("roleBonusesStill")}</small>${warning.bonuses.map((b) => `<div>${t(b.building)} ${b.coins ? metric("coin", b.coins) : ""}${b.vp ? metric("vp", b.vp) : ""}</div>`).join("")}</div>` : ""}
      ${m.id !== "smuggler" ? `<p class="role-warning-note">${t("roleWarningOthers")}</p>` : ""}
      <div class="action-choices"><button type="button" class="primary" data-close>${t("chooseAnotherRole")}</button><button type="button" data-confirm-role>${t("chooseRoleAnyway")}</button></div>
    `,
      "role-warning",
    );
    roleConfirmation = { move: m, seat, historyLength: state.historyLength };
    body.querySelector("[data-close]").focus();
    return true;
  }
  function rolesHelp() {
    const roles = [
      ...new Set(
        state.roles.map(({ id }) => (id === "adventurer2" ? "adventurer" : id)),
      ),
    ];
    return `<p class="roles-help-intro">${t("rolesHelpIntro")}</p><div class="role-reference-list">${roles.map(roleReference).join("")}</div>`;
  }
  function journal() {
    return journalContent(state, t, { automatedSetup });
  }
  function buildingInfo(id) {
    const b = B[id],
      moves = state.legal.filter(
        (m) => ["build", "draft"].includes(m.type) && m.id === id,
      );
    show(
      t(id),
      `<div class="building-detail">${icon(spriteFor(id), 56)}<div class="building-detail-stats"><span><small>${t("cost")}</small>${metric("coin", b.cost)}</span><span><small>${t("printedPoints")}</small>${metric("vp", b.vp)}</span><span><small>${t("workerSpaces")}</small>${buildingSlots(b)}</span></div></div><p>${buildingEffect(id, true)}</p>${b.size === 2 ? `<p>${t("twoCitySpaces")}</p>` : ""}${moves.length && allowed() ? `<div class="action-choices">${moves.map((m) => moveButton(m, `${t(m.type === "draft" ? "selected" : "builder")} ${metric("coin", m.type === "draft" ? b.cost : cost(state, seat, id))}${m.worker ? ` − ${icon(m.worker.kind === "c" ? "citizen" : "worker")} ${targetLabel(m.worker.key)}` : ""}${m.good ? ` − ${icon(m.good)}` : ""}${m.point ? ` − ${metric("vp", 1)}` : ""}`, "check", "primary")).join("")}</div>` : ""}`,
    );
  }
  function festivalInfo(i) {
    const f = state.festivals[i],
      goals = {
        produce: t("produce"),
        estates: t("countryside"),
        farmProduce: `${t("countryside")} + ${t("produce")}`,
        build: t("builder"),
        tradeFull: `${t("trade")} · 4 / 4`,
        ship: t("ship"),
        dispatchBig: `${t("dispatch")} · ${Math.max(...state.ships.map((s) => s.capacity))}`,
        dispatchSmall: `${t("dispatch")} · ${Math.min(...state.ships.map((s) => s.capacity))}`,
      };
    show(
      t(f.id),
      `<p>${goals[f.goal]}</p><div class="festival-details">${f.targets.estates.map((g) => metric(g, f.amount ?? 1)).join("")}${f.targets.goods.map((g, j) => metric(g, f.amounts?.[j] ?? f.amount ?? 1)).join("")}${f.targets.building ? t(f.targets.building) : ""}</div><h3>${t("reward")}</h3><div>${f.reward.coins ? metric("coin", f.reward.coins) : ""}${f.reward.vp ? metric("vp", f.reward.vp) : ""}${f.reward.workers ? metric("worker", f.reward.workers) : ""}</div>${f.claimed !== undefined ? `<p>${t("claimed")} ${esc(state.players[f.claimed].name)}</p>` : ""}`,
    );
  }
  function scores() {
    show(
      t("finalScore"),
      `<div class="scores">${(state.results ?? [])
        .map(
          (r, i) =>
            `<article><header><h3>${esc(state.players[i].name)}</h3>${metric("vp", r.total)}</header><p>${t("tokens")} <b>${r.tokens}</b></p><p>${t("market")} <b>${r.buildings}</b></p><p>${t("citizens")} <b>${r.citizens}</b></p>${Object.entries(
              r.bonus,
            )
              .map(([id, n]) => `<p>${t(id)} <b>${n}</b></p>`)
              .join("")}<p>${t("tie")} <b>${r.tie}</b></p></article>`,
        )
        .join("")}</div>`,
    );
  }
  function howToPlay() {
    const hasExpansion = (id) => state.expansions.includes(id);
    const smuggler = hasExpansion("smuggler");
    const adventurer = state.roles.some((r) => r.id.startsWith("adventurer"));
    const citizens = hasExpansion("citizens");
    const section = (pictogram, title, content) =>
      `<section><h3>${icon(pictogram)}${t(title)}</h3>${content}</section>`;
    const paragraph = (key) => `<p>${t.html(key)}</p>`;
    const roundSteps = [
      ["ruleChooseTitle", t.html("ruleChoose")],
      ["ruleFollowTitle", t.html("ruleFollow")],
      [
        "ruleNextTitle",
        t.html(state.players.length === 2 ? "ruleNextTwo" : "ruleNext"),
      ],
      [
        "ruleResetTitle",
        `${t.html("ruleReset")}${smuggler ? ` ${t.html("ruleSmugglerCoin")}` : ""}`,
      ],
    ];
    const chain = [
      ["planter", "rulePlantStep"],
      ["builder", "ruleBuildStep"],
      ["recruiter", "ruleRecruitStep"],
      ["craftsman", "ruleProduceStep"],
    ];
    const extras = [
      citizens ? section("citizen", "citizens", paragraph("ruleCitizens")) : "",
      smuggler
        ? section("smuggler", "smuggler", paragraph("ruleSmuggler"))
        : "",
      adventurer
        ? section("adventurer", "adventurer", paragraph("ruleAdventurer"))
        : "",
      state.festivals.length
        ? section("festival", "festival", paragraph("ruleFestival"))
        : "",
    ].join("");
    return `<div class="rules-content">
      ${section("vp", "ruleGoalTitle", paragraph("ruleGoal"))}
      ${section("governor", "ruleRoundTitle", `<ol class="rules-round">${roundSteps.map(([title, text]) => `<li><strong>${t(title)}</strong><p>${text}</p></li>`).join("")}</ol>${paragraph(smuggler || adventurer ? "ruleOptional" : "ruleOptionalBase")}`)}
      ${section("sugar", "ruleProductionTitle", `${paragraph("ruleProductionIntro")}<ol class="rules-chain">${chain.map(([role, text]) => `<li>${icon(role, 28)}<div><strong>${t(role)}</strong><p>${t.html(text)}</p></div></li>`).join("")}</ol>${paragraph("ruleProduction")}${paragraph("ruleActivation")}`)}
      ${section("ship", "ruleGoodsTitle", `<div class="rules-goods"><div><h4>${icon("coin")}${t("ruleSellTitle")}</h4>${paragraph("ruleSell")}</div><div><h4>${icon("vp")}${t("ruleShipTitle")}</h4>${paragraph("ruleShip")}</div></div>${paragraph("ruleShipLimits")}`)}
      <aside class="rules-tip"><strong>${t("ruleTimingTitle")}</strong>${paragraph("ruleTiming")}</aside>
      ${extras ? `<div class="rules-edition"><h3>${t("ruleEditionTitle")}</h3>${extras}</div>` : ""}
      <p class="rules-reference">${t(hasExpansion("new-buildings") || citizens ? "ruleDraft" : "ruleDetails")}</p>
      ${section("vp", "ruleEndTitle", `${paragraph("ruleEnd")}${paragraph(citizens ? "ruleEndCitizens" : "ruleEndWorkers")}${paragraph("ruleScore")}${citizens ? paragraph("ruleScoreCitizens") : ""}`)}
    </div>`;
  }
  async function send(m) {
    if (
      !allowed() &&
      !(
        enabled &&
        !pending &&
        m.type === "bohio" &&
        state.legal.some((x) => JSON.stringify(x) === JSON.stringify(m))
      )
    )
      return;
    pending = true;
    error.hidden = true;
    render();
    try {
      await onMove(m);
      if (modal.open && modalMode !== "journal") hide(modal);
    } catch (err) {
      error.textContent = err.message || t("error");
      error.hidden = false;
    } finally {
      pending = false;
      render();
    }
  }
  function click(event) {
    const el = event.target.closest("button");
    if (!el || el.disabled) return;
    if (el.hasAttribute("data-close")) {
      hide(el.closest("dialog"));
      return;
    }
    if (el.dataset.panel) {
      if (el.dataset.panel === "chat") {
        lastFocus = el;
        chatDialog.showModal();
        chat?.setOpen(true);
        return;
      }
      if (el.dataset.panel === "journal") {
        show(t("journal"), journal(), "journal");
        body.scrollTop = body.scrollHeight;
        return;
      }
      show(t("rules"), howToPlay(), "rules");
      return;
    }
    if (el.hasAttribute("data-roles-help")) {
      show(t("rolesHelp"), rolesHelp(), "roles");
      return;
    }
    if (el.dataset.role) {
      show(t(el.dataset.role), roleReference(el.dataset.role));
      return;
    }
    if (el.dataset.building) {
      buildingInfo(el.dataset.building);
      return;
    }
    if (el.hasAttribute("data-market")) {
      show(t("market"), market(), "market");
      return;
    }
    if (el.dataset.festival !== undefined) {
      festivalInfo(Number(el.dataset.festival));
      return;
    }
    if (el.dataset.player !== undefined) {
      view = Number(el.dataset.player);
      render();
      return;
    }
    if (el.dataset.local) {
      localControls?.(el.dataset.local);
      return;
    }
    if (el.hasAttribute("data-scores")) {
      scores();
      return;
    }
    if (
      !allowed() &&
      !el.hasAttribute("data-bohio") &&
      !(
        el.dataset.move &&
        JSON.parse(decodeURIComponent(el.dataset.move)).type === "bohio"
      )
    )
      return;
    if (el.hasAttribute("data-confirm-role")) {
      const confirmation = roleConfirmation;
      if (
        !confirmation ||
        confirmation.historyLength !== state.historyLength ||
        confirmation.seat !== seat
      )
        return;
      hide(modal);
      send(confirmation.move);
      return;
    }
    if (el.dataset.move) {
      const m = JSON.parse(decodeURIComponent(el.dataset.move));
      if (m.type === "role" && confirmRole(m)) return;
      if (["smallWharf", "produce"].includes(m.type)) {
        cargoDialog(m);
        return;
      }
      send(m);
      return;
    }
    if (el.hasAttribute("data-bohio")) {
      show(
        t("bohioMove"),
        `<div class="action-choices">${state.legal
          .filter((m) => m.type === "bohio")
          .map((m) =>
            moveButton(m, moveLabel(m), m.kind === "c" ? "citizen" : "worker"),
          )
          .join("")}</div>`,
      );
      return;
    }
    if (el.hasAttribute("data-forests")) {
      show(
        t("forest"),
        `<div class="action-choices">${state.legal
          .filter((m) => m.forest)
          .map((m) => moveButton(m, moveLabel(m), m.id))
          .join("")}</div>`,
      );
      return;
    }
    if (el.hasAttribute("data-confirm-assign")) {
      send({ type: "assign", ...draft });
      return;
    }
    if (el.hasAttribute("data-confirm-store")) {
      send({ type: "store", ...draft });
      return;
    }
    if (el.hasAttribute("data-auto")) {
      draft = autoAssignment(state, seat);
      render();
      return;
    }
    if (el.dataset.tool) {
      tool = el.dataset.tool;
      render();
      return;
    }
    if (el.dataset.slot) {
      const [key, ix] = el.dataset.slot.split(":"),
        x =
          draft[key[0] === "e" ? "estates" : "buildings"][Number(key.slice(1))],
        index = Number(ix);
      const occupied = index < x.c ? "c" : index < x.c + x.w ? "w" : null;
      if (occupied) x[occupied]--;
      else if (tool !== "erase" && remaining()[tool] > 0) x[tool]++;
      render();
      return;
    }
    if (el.dataset.qty) {
      const [g, n] = el.dataset.qty.split(":");
      draft.goods[g] = Math.max(
        0,
        Math.min(state.players[seat].goods[g], draft.goods[g] + Number(n)),
      );
      render();
      return;
    }
    if (el.dataset.storetype) {
      const g = el.dataset.storetype;
      if (draft.types.includes(g))
        draft.types = draft.types.filter((x) => x !== g);
      else if (
        draft.types.length <
        (has("smallWarehouse") ? 1 : 0) + (has("largeWarehouse") ? 2 : 0)
      ) {
        draft.types.push(g);
        draft.goods[g] = state.players[seat].goods[g];
      }
      render();
    }
  }
  function cargoDialog(m) {
    show(
      t(m.type === "produce" ? "produce" : "smallWharfShip"),
      `<form class="cargo-form"><p>${t("selectQty")}</p>${GOODS.filter(
        (g) => m.goods[g],
      )
        .map(
          (g) =>
            `<label>${icon(g, 26)}${t(g)}<input type="number" min="0" max="${m.goods[g]}" value="${m.goods[g]}" name="${g}" inputmode="numeric"></label>`,
        )
        .join(
          "",
        )}<button type="submit" class="primary">${t("confirm")}</button></form>`,
    );
    body.querySelector("form").onsubmit = (ev) => {
      ev.preventDefault();
      const data = new FormData(ev.currentTarget),
        goods = Object.fromEntries(
          GOODS.map((g) => [g, Number(data.get(g) ?? 0)]),
        );
      if (m.type === "produce" || sum(Object.values(goods)))
        send({ ...m, goods });
    };
  }
  function onCancel(ev) {
    ev.preventDefault();
    hide(ev.target);
  }
  shell.addEventListener("click", click);
  modal.addEventListener("cancel", onCancel);
  chatDialog.addEventListener("cancel", onCancel);
  return {
    render,
    setPlayer(p) {
      seat = p;
      view = p ?? 0;
      draftKey = "";
      render();
    },
    setEnabled(value) {
      enabled = value;
      render();
    },
    setPreferences(p) {
      const previousLocale = t.fr;
      preferences = { ...preferences, ...p };
      t = translator(preferences.locale ?? preferences.language ?? "en");
      if (previousLocale !== t.fr) configureChat();
      for (const b of shell.querySelectorAll("[data-close]"))
        b.setAttribute("aria-label", t("close"));
      shell.classList.toggle(
        "dark",
        preferences.dark ?? preferences.theme === "dark",
      );
      render();
    },
    destroy() {
      shell.removeEventListener("click", click);
      chatView?.destroy();
      shell.remove();
    },
  };
}
