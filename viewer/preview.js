import * as engine from "../engine/index.js";
import { RELEASE } from "../release-config.js";
import { mountGame } from "./ui.js";
const KEY = "puerto-rico-preview-v1";
const params = new URLSearchParams(location.search);
let state,
  undo = [],
  generation = 0,
  dark = matchMedia("(prefers-color-scheme: dark)").matches;
function newGame() {
  let s = engine.init(
    3,
    RELEASE.expansions,
    RELEASE.options,
    `preview-${Date.now()}`,
  );
  s.players.forEach((p, i) => (p.name = ["Vous", "Isabel", "Rafael"][i]));
  while (s.tasks[0]?.kind === "draft") s = engine.moveAI(s);
  return s;
}
try {
  state = JSON.parse(localStorage.getItem(KEY));
  if (state?.version !== 1 || !state.config) state = null;
} catch {}
state ??= newGame();
const ui = mountGame(document.getElementById("game"), {
  async onMove(move) {
    undo.push(structuredClone(state));
    state = engine.move(state, move, 0);
    display();
    setTimeout(opponents, 180);
  },
  localControls(command) {
    if (command === "undo" && undo.length) {
      generation++;
      state = undo.pop();
      display();
    }
    if (command === "opponents") opponents();
    if (command === "reset") {
      generation++;
      undo = [];
      state = newGame();
      display();
    }
    if (command === "dark") {
      dark = !dark;
      ui.setPreferences({
        locale: params.get("locale") ?? navigator.language,
        dark,
      });
    }
  },
});
ui.setPreferences({ locale: params.get("locale") ?? navigator.language, dark });
ui.setPlayer(0);
function display() {
  localStorage.setItem(KEY, JSON.stringify(state));
  ui.render(engine.stripSecret(state, 0));
}
let running = false;
async function opponents() {
  if (running) return;
  running = true;
  const token = generation;
  try {
    while (
      !engine.ended(state) &&
      engine.currentPlayer(state) !== 0 &&
      generation === token
    ) {
      state = engine.moveAI(state);
      display();
      await new Promise((r) => setTimeout(r, 220));
    }
  } finally {
    running = false;
  }
}
display();
opponents();
// Only the standalone local sandbox exposes these hooks, never the BGS bundle.
window.prPreview = {
  getState: () => structuredClone(state),
  setState(s) {
    generation++;
    state = structuredClone(s);
    display();
  },
  playAI() {
    state = engine.moveAI(state);
    display();
  },
  engine,
  ui,
};
