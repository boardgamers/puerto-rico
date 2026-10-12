import { BUILDINGS } from "../engine/catalog.js";

// Keep the minimum payment visible. Extra payments matter only for Big Spender.
export function showBuildingPayment(player, move) {
  return (
    move.type !== "build" ||
    move.pay === undefined ||
    (BUILDINGS[move.id]?.size === 2 &&
      move.pay === player?.coins &&
      player.achievements?.some((c) => c.id === "bigSpender" && !c.completed))
  );
}
