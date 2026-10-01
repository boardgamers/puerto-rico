export * from "../engine/index.js";
import { init as create } from "../engine/index.js";
import { RELEASE } from "../release-config.js";
export function init(players, _expansions, _options, seed) {
  return create(players, RELEASE.expansions, RELEASE.options, seed);
}
