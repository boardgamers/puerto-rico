import { BUILDINGS as B, GOODS } from "../engine/catalog.js";
import { production, scoreBreakdown } from "../engine/index.js";
const total = (x) => (x.w ?? 0) + (x.c ?? 0);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const scoring = new Set([
  "fireStation",
  "residence",
  "fortress",
  "customsHouse",
  "cityHall",
  "cathedral",
  "townSquare",
]);

// These are current capacities/bonuses, not rewards already earned.
export function buildingEffects(state, seat, player = state.players[seat]) {
  if (player.puertoma) return [];
  const farms = Object.fromEntries(
    GOODS.map((g) => [
      g,
      sum(player.estates.filter((e) => e.id === g).map(total)),
    ]),
  );
  const remaining = Object.fromEntries(
    GOODS.map((g) => [g, Math.min(farms[g], state.supply[g])]),
  );
  const citizens =
    (player.reserve.c ?? 0) +
    sum([...player.estates, ...player.buildings].map((x) => x.c ?? 0));
  const capacity = production(player);
  const available = Object.fromEntries(
    GOODS.map((g) => [g, Math.min(capacity[g], state.supply[g])]),
  );
  const allocated = new Map();
  player.buildings.forEach((b, i) => {
    const g = B[b.id].good;
    if (GOODS.includes(g) && total(b)) {
      const n = Math.min(remaining[g], total(b));
      allocated.set(i, n);
      remaining[g] -= n;
    }
  });
  return player.buildings.map((b, i) => {
    const enabled = total(b) > 0;
    const items = [];
    const add = (icon, value, sign = "+") => items.push({ icon, value, sign });
    const g = B[b.id].good;
    if (GOODS.includes(g))
      add(
        g,
        enabled ? allocated.get(i) : Math.min(remaining[g], B[b.id].workers),
      );
    else if (scoring.has(b.id)) {
      if (b.id === "customsHouse" && player.vp == null) add("vp", "?");
      else {
        const preview = {
          ...player,
          buildings: player.buildings.map((x, j) =>
            j === i ? { ...x, w: enabled ? x.w : 1 } : x,
          ),
        };
        const s = {
          ...state,
          players: state.players.map((p, j) => (j === seat ? preview : p)),
        };
        let n = scoreBreakdown(s, seat).bonus[b.id] ?? 0;
        if (b.id === "fortress")
          n = Math.floor(
            (total(player.reserve) +
              sum([...player.estates, ...player.buildings].map(total))) /
              3,
          );
        add("vp", n);
      }
    } else if (b.id === "canal") {
      for (const [good, id] of [
        ["fruit", "largeFruit"],
        ["sugar", "largeSugar"],
      ]) {
        const large = player.buildings.find((x) => x.id === id);
        if (!large) continue;
        const base = Math.min(
          farms[good],
          sum(player.buildings.filter((x) => B[x.id].good === good).map(total)),
        );
        add(
          good,
          total(large) > 0 && base > 0 && state.supply[good] > base ? 1 : 0,
        );
      }
    } else if (b.id === "hiddenMarket") {
      const worker =
        total(player.reserve) +
          sum(player.estates.map(total)) +
          sum(player.buildings.filter((x) => x !== b).map(total)) >
        0;
      const goods = GOODS.some((g) => player.goods[g] > 0);
      add(
        "coin",
        player.vp == null
          ? "?"
          : Number(worker) + Number(goods) + Number(player.vp > 0),
        "−",
      );
    } else if (b.id === "smallMarket") add("coin", 1);
    else if (b.id === "largeMarket") add("coin", 2);
    else if (b.id === "harbor") add("vp", 1);
    else if (b.id === "chapel") add(b.c ? "vp" : "coin", 1);
    else if (b.id === "tailorShop")
      add("coin", Math.min(citizens, state.options.tailorLimit ? 3 : Infinity));
    else if (b.id === "factory")
      add(
        "coin",
        [0, 0, 1, 2, 3, 5][GOODS.filter((g) => available[g] > 0).length],
      );
    else if (b.id === "distillery")
      add(
        "coin",
        Math.max(
          0,
          ...GOODS.filter((g) => g !== "corn").map((g) => available[g] - 1),
        ),
      );
    else if (b.id === "lumberyard")
      add(
        "coin",
        Math.floor(player.estates.filter((e) => e.id === "forest").length / 2),
        "−",
      );
    else if (b.id === "notary") add("coin", b.c ? 2 : 1, "−");
    else if (b.id === "assemblyHall")
      add("vp", sum(GOODS.map((g) => Math.floor(player.goods[g] / 2))));
    return { enabled, items };
  });
}
