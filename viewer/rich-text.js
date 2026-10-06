import { icon, scoreToken } from "./icons.js";

const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// Explicit markers keep translated prose readable and plain tooltips free of HTML.
const symbols = {
  vp: [
    "vp",
    ["victory point", "victory points"],
    ["point de victoire", "points de victoire"],
  ],
  coin: ["coin", ["coin", "coins"], ["pièce", "pièces"]],
  crate: ["crate", ["good", "goods"], ["marchandise", "marchandises"]],
  worker: ["worker", ["worker", "workers"], ["ouvrier", "ouvriers"]],
  citizen: ["citizen", ["citizen", "citizens"], ["citoyen", "citoyens"]],
  estate: ["estate", ["estate", "estates"], ["domaine", "domaines"]],
  expanded: [
    "expandedBuilding",
    ["expanded building", "expanded buildings"],
    ["bâtiment étendu", "bâtiments étendus"],
  ],
  quarry: ["quarry", ["quarry", "quarries"], ["carrière", "carrières"]],
  forest: ["forest", ["forest", "forests"], ["forêt", "forêts"]],
  corn: ["corn", ["corn", "corn"], ["maïs", "maïs"]],
  fruit: ["fruit", ["fruit", "fruit"], ["fruits", "fruits"]],
  sugar: ["sugar", ["sugar", "sugar"], ["sucre", "sucre"]],
  tobacco: ["tobacco", ["tobacco", "tobacco"], ["tabac", "tabac"]],
  coffee: ["coffee", ["coffee", "coffee"], ["café", "café"]],
  ship: ["ship", ["ship", "ships"], ["bateau", "bateaux"]],
  planter: ["planter", ["Planter", "Planter"], ["Planteur", "Planteur"]],
  recruiter: [
    "recruiter",
    ["Recruiter", "Recruiter"],
    ["Recruteur", "Recruteur"],
  ],
  builder: ["builder", ["Builder", "Builder"], ["Bâtisseur", "Bâtisseur"]],
  craftsman: ["craftsman", ["Craftsman", "Craftsman"], ["Artisan", "Artisan"]],
  trader: ["trader", ["Trader", "Trader"], ["Marchand", "Marchand"]],
  captain: ["captain", ["Captain", "Captain"], ["Capitaine", "Capitaine"]],
};
const plurals = {
  points: "vp",
  coins: "coin",
  crates: "crate",
  workers: "worker",
  citizens: "citizen",
  estates: "estate",
  expandedbuildings: "expanded",
  quarries: "quarry",
  forests: "forest",
  ships: "ship",
};

function format(message, fr, html) {
  const text = String(message);
  if (!text.includes("{")) return html ? escape(text) : text;
  let result = "",
    end = 0;
  for (const match of text.matchAll(
    /\{([a-z]+)(?::([+−-]?\d+(?:\/\d+)*))?\}/g,
  )) {
    const [marker, key, amount] = match;
    const entry = symbols[plurals[key] ?? key];
    if (!entry) continue;
    const [id, en, french] = entry;
    const plural =
      amount === undefined
        ? !!plurals[key]
        : Math.abs(Number(amount.replace("−", "-"))) !== 1;
    const label = `${amount === undefined ? "" : `${amount} `}${(fr ? french : en)[plural ? 1 : 0]}`;
    const hint =
      id === "expandedBuilding"
        ? `${label} · ${fr ? "2 cases de ville par bâtiment" : "2 city spaces per building"}`
        : label;
    const before = text.slice(end, match.index);
    result += html ? escape(before) : before;
    if (html) {
      const visual =
        id === "vp"
          ? (amount ?? "1")
              .split("/")
              .map((n) => scoreToken(n, 24))
              .join('<span class="symbol-separator">/</span>')
          : `${amount === undefined ? "" : `<b>${escape(amount)}</b>`}${icon(id, 22)}${["crate", "expandedBuilding"].includes(id) ? `<span class="symbol-word">${escape((fr ? french : en)[plural ? 1 : 0])}</span>` : ""}`;
      result += `<span class="inline-symbol${amount?.includes("/") ? " symbol-range" : ""}" role="img" aria-label="${escape(hint)}" title="${escape(hint)}"><span aria-hidden="true">${visual}</span></span>`;
    } else result += label;
    end = match.index + marker.length;
  }
  return result + (html ? escape(text.slice(end)) : text.slice(end));
}
export const plainText = (message, fr = false) => format(message, fr, false);
export const richText = (message, fr = false) => format(message, fr, true);
