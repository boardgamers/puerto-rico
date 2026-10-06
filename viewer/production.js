import { BUILDINGS, GOODS } from "../engine/catalog.js";
import { production } from "../engine/index.js";

// Explain the engine's capacity without simulating a production action.
export function productionLines(player, supply) {
  if (player.puertoma) return [];
  const capacity = production(player);
  return GOODS.flatMap((good) => {
    const estates = player.estates.filter((e) => e.id === good);
    const buildings = player.buildings.filter(
      (b) => BUILDINGS[b.id].good === good,
    );
    if (!estates.length && !buildings.length) return [];
    const farms = estates.reduce((n, e) => n + e.w + e.c, 0);
    const workshops = buildings.reduce((n, b) => n + b.w + b.c, 0);
    const available = Math.min(capacity[good], supply[good]);
    const issue = !estates.length
      ? "needPlantation"
      : !farms
        ? "staffPlantation"
        : good !== "corn" && !buildings.length
          ? "needWorkshop"
          : good !== "corn" && !workshops
            ? "staffWorkshop"
            : available < capacity[good]
              ? "limitedSupply"
              : "productionReady";
    return [
      {
        good,
        farms,
        farmCount: estates.length,
        workshops,
        workshopCount: buildings.reduce(
          (n, b) => n + BUILDINGS[b.id].workers,
          0,
        ),
        capacity: capacity[good],
        available,
        issue,
      },
    ];
  });
}
