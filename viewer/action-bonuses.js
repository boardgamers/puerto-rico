import { active, completedFestivals } from "../engine/index.js";
import { BUILDINGS } from "../engine/catalog.js";

// Immediate building bonuses formerly offered as "without bonus" alternatives.
export function actionBonuses(state, seat, move) {
  const player = state.players[seat];
  if (!player) return [];
  const bonuses = [];
  const add = (building, vp = 0, coins = 0) => {
    if (active(player, building) && !move.decline?.includes(building))
      bonuses.push({ building, vp, coins });
  };
  if (
    state.tasks[0]?.kind === "produce" &&
    ["produce", "pass"].includes(move.type)
  ) {
    const citizen = player.buildings.find((b) => b.id === "chapel")?.c > 0;
    add("chapel", citizen ? 1 : 0, citizen ? 0 : 1);
  }
  if (move.type === "build" && BUILDINGS[move.id]?.vp >= 2)
    add("church", BUILDINGS[move.id].size === 2 ? 2 : 1);
  if (["ship", "smallWharf"].includes(move.type)) {
    add("harbor", 1);
    // The regular Captain privilege already gives 1 VP; this is its extra VP.
    if (seat === state.owner && !state.captainBonus) add("publishingHouse", 1);
  }
  return bonuses;
}

export function actionVictoryPoints(state, seat, move) {
  const player = state.players[seat];
  let points = actionBonuses(state, seat, move).reduce((n, b) => n + b.vp, 0);
  if (move.type === "ship") {
    points +=
      move.ship === "wharf"
        ? player.goods[move.good]
        : Math.min(
            player.goods[move.good],
            state.ships[move.ship].capacity - state.ships[move.ship].amount,
          );
  }
  if (move.type === "smallWharf")
    points += Math.floor(
      Object.values(move.goods).reduce((a, b) => a + b, 0) / 2,
    );
  if (
    ["ship", "smallWharf"].includes(move.type) &&
    seat === state.owner &&
    !state.captainBonus
  )
    points++;
  if (move.type === "plunder") points += state.trade.length;
  if (move.type === "pension") points++;
  if (move.type === "parkReward") points += 2;
  if (move.type === "assembly")
    points += Object.values(player.goods).reduce(
      (n, amount) => n + Math.floor(amount / 2),
      0,
    );
  return points + festivalRewards(state, seat, move).vp;
}

// Forecast only public, deterministic outcomes; never inspect future plantation draws.
export function festivalRewards(state, seat, move) {
  const rewards = { vp: 0, coins: 0, workers: 0 };
  if (!state.festivals?.length) return rewards;
  const preview = { ...state };
  let event;
  if (move.type === "build") event = { type: "build", id: move.id };
  if (["produce", "produceBonus"].includes(move.type)) {
    const goods = move.type === "produce" ? move.goods : { [move.good]: 1 };
    preview.production = (
      state.production ??
      state.players.map(() =>
        Object.fromEntries(
          Object.keys(playerGoods(state, seat)).map((g) => [g, 0]),
        ),
      )
    ).map((out, i) =>
      i === seat
        ? Object.fromEntries(
            Object.entries(out).map(([g, n]) => [g, n + (goods[g] ?? 0)]),
          )
        : out,
    );
    event = { type: "produce" };
  }
  if (move.type === "trade" && !move.outpost) {
    preview.trade = [...state.trade, move.good];
    event = { type: "trade", good: move.good };
  }
  if (["plant", "forest"].includes(move.type)) {
    const id = move.forest
      ? "forest"
      : move.type === "plant"
        ? move.id
        : state.tasks[0].id;
    preview.players = state.players.map((p, i) =>
      i === seat ? { ...p, estates: [...p.estates, { id }] } : p,
    );
    event = { type: "estates" };
  }
  if (["ship", "smallWharf"].includes(move.type)) {
    const ship = Number.isInteger(move.ship) ? state.ships[move.ship] : null;
    const amount =
      move.type === "ship"
        ? Math.min(
            state.players[seat].goods[move.good],
            ship ? ship.capacity - ship.amount : Infinity,
          )
        : 0;
    const goods =
      move.type === "smallWharf" ? move.goods : { [move.good]: amount };
    preview.shipped = (
      state.shipped ??
      state.players.map(() =>
        Object.fromEntries(
          Object.keys(playerGoods(state, seat)).map((g) => [g, 0]),
        ),
      )
    ).map((out, i) =>
      i === seat
        ? Object.fromEntries(
            Object.entries(out).map(([g, n]) => [g, n + (goods[g] ?? 0)]),
          )
        : out,
    );
    event = {
      type: "ship",
      good: move.good,
      full: !!ship && ship.amount + amount === ship.capacity,
      capacity: ship?.capacity ?? null,
    };
  }
  if (event)
    for (const f of completedFestivals(preview, seat, event)) {
      for (const key of Object.keys(rewards))
        rewards[key] += f.reward[key] ?? 0;
    }
  rewards.workers = Math.min(rewards.workers, state.workerSupply ?? 0);
  return rewards;
}

function playerGoods(state, seat) {
  return state.players[seat].goods;
}
