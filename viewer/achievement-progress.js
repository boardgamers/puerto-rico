import { CARDS } from "../engine/achievements.js";
import { BUILDINGS as B, GOODS } from "../engine/catalog.js";
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export function achievementProgress(s, p, card) {
  const c = CARDS[card.id];
  if (!c || card.hidden) return [];
  const a = s.players[p];
  const row = (kind, value, target) => ({
    kind,
    value: card.completed ? target : Math.min(value, target),
    target,
  });
  switch (c.goal) {
    case "goodsPair":
      return [
        row("crate", sum(c.goods.map((g) => a.goods[g])), c.amount),
        ...c.goods.map((g) => row(g, a.goods[g], 1)),
      ];
    case "buildingWorkers":
      return [row("worker", sum(a.buildings.map((b) => b.w + b.c)), 12)];
    case "estateWorkers":
      return [row("worker", sum(a.estates.map((e) => e.w + e.c)), 9)];
    case "productionSet":
      return ["sugar", "tobacco", "coffee"].map((g) =>
        row(
          `workshop-${g}`,
          Number(a.buildings.some((b) => B[b.id].good === g)),
          1,
        ),
      );
    case "expanded":
      return [
        row(
          "expandedBuilding",
          a.buildings.filter((b) => B[b.id].size === 2).length,
          2,
        ),
      ];
    case "developed":
      return [
        row("planter", a.estates.length, 10),
        row("building", sum(a.buildings.map((b) => B[b.id].size)), 10),
      ];
    case "estates":
      return [row("planter", a.estates.length, 12)];
    case "goods":
      return [row("crate", Math.max(...GOODS.map((g) => a.goods[g])), 7)];
    case "commercial":
      return [
        row(
          "building",
          a.buildings.filter((b) => !B[b.id].good && B[b.id].size === 1).length,
          7,
        ),
      ];
    case "productionCount":
      return [
        row(
          "building",
          a.buildings.filter((b) => ["fruit", "sugar"].includes(B[b.id].good))
            .length,
          3,
        ),
      ];
    case "produce":
      return [
        row(
          "craftsman",
          s.role === "craftsman"
            ? sum(Object.values(s.production?.[p] ?? {}))
            : 0,
          7,
        ),
      ];
    case "shipTypes":
      return [
        row(
          "captain",
          s.role === "captain"
            ? GOODS.filter((g) => s.shipped?.[p]?.[g] > 0).length
            : 0,
          3,
        ),
      ];
    case "captainPoints":
      return [
        row("captain", s.role === "captain" ? (s.phaseVP?.[p] ?? 0) : 0, 7),
      ];
    // These must be achieved by a specific action, not accumulated holdings.
    default:
      return [row("check", 0, 1)];
  }
}
