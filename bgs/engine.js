export * from "../engine/index.js";
import * as game from "../engine/index.js";
import { RELEASE } from "../release-config.js";

const solo = (s) => s.options.hostedSolo === true;
function checkSeat(s, p) {
  if (solo(s) && p !== 0)
    throw Error(
      "Puertomas are automatic opponents, not platform participants.",
    );
}
function opponents(s) {
  // BGS has one participant. Resolve the virtual opponents on the server before
  // returning, so the platform never waits for a nonexistent participant.
  let moves = 0;
  while (
    !game.ended(s) &&
    ((s.tasks[0]?.kind === "draft" && !s.options.chooseBuildings) ||
      (solo(s) && game.currentPlayer(s) !== 0))
  ) {
    if (++moves > 1000)
      throw Error("Puertoma turns did not return to the human player.");
    s = game.moveAI(s);
  }
  return s;
}
export function init(players, _expansions, suppliedOptions, seed) {
  const baseOptions = {
    ...RELEASE.options,
    chooseBuildings: suppliedOptions?.chooseBuildings === true,
    showVP: suppliedOptions?.showVP === true,
  };
  const options =
    players === 1
      ? {
          ...baseOptions,
          hostedSolo: true,
          puertoma: { humans: 1, difficulty: "normal" },
        }
      : baseOptions;
  const s = game.init(
    players === 1 ? 3 : players,
    RELEASE.expansions,
    options,
    seed,
  );
  if (players === 1)
    s.players.slice(1).forEach((p, i) => (p.name = `Puertoma ${i + 1}`));
  return opponents(s);
}
export function move(s, m, p) {
  checkSeat(s, p);
  return opponents(game.move(s, m, p));
}
export function moveAI(s, p = game.currentPlayer(s)) {
  checkSeat(s, p);
  return opponents(game.moveAI(s, p));
}
export function dropPlayer(s, p) {
  checkSeat(s, p);
  return game.dropPlayer(s, p);
}
export function setPlayerSettings(s, p, settings) {
  checkSeat(s, p);
  return game.setPlayerSettings(s, p, settings);
}
export function setPlayerMetaData(s, p, data) {
  checkSeat(s, p);
  return game.setPlayerMetaData(s, p, data);
}
export function scores(s) {
  const result = game.scores(s);
  return solo(s) ? result.slice(0, 1) : result;
}
export function rankings(s) {
  // The human's rank still compares against both Puertomas, while BGS receives
  // exactly one result per registered participant.
  const result = game.rankings(s);
  return solo(s) ? result.slice(0, 1) : result;
}

export function createAnalysis(s, options) {
  const copy = game.createAnalysis(s, options);
  if (solo(copy)) copy.players.slice(1).forEach((p) => (p.bot = true));
  return opponents(copy);
}
