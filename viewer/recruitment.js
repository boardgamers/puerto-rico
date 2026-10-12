// Distribution from the work register, before optional building/role bonuses.
export function recruitmentShares(state, chooser) {
  const total = state.register.w + state.register.c;
  const n = state.players.length;
  return state.players.map(
    (_, i) =>
      Math.floor(total / n) + ((i - chooser + n) % n < total % n ? 1 : 0),
  );
}

export function recruitmentBonus(state, chooser) {
  const publishing = state.players[chooser].buildings.some(
    (b) => b.id === "publishingHouse" && b.w + b.c > 0,
  );
  return Math.min(state.workerSupply, publishing ? 2 : 1);
}
