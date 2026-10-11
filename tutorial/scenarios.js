import * as engine from "../engine/index.js";
import { GOODS, FESTIVALS } from "../engine/catalog.js";

const clone = (value) => structuredClone(value);
const goods = (amounts = {}) =>
  Object.fromEntries(GOODS.map((id) => [id, amounts[id] ?? 0]));
const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};

function position(id, expansions = [], preferredBuildings = []) {
  let state = engine.init(3, expansions, {}, `tutorial:${id}:1`);
  while (state.tasks[0]?.kind === "draft") {
    const legal = engine.legal(state);
    const move =
      preferredBuildings
        .map((id) => legal.find((m) => m.id === id))
        .find(Boolean) ?? legal[0];
    state = engine.move(state, move, engine.currentPlayer(state));
  }
  state.players.forEach((player, index) => {
    player.name = ["You", "Isabel", "Rafael"][index];
    player.settings = { autoForcedActions: false };
    player.bot = false;
  });
  state.events = [];
  state.history = [];
  delete state.eventSummary;
  state.tutorial = { id, completed: 0 };
  return state;
}

function staff(state, tile, w = 1, c = 0) {
  requireValue(
    state.workerSupply >= w && state.citizenSupply >= c,
    "Tutorial people supply exhausted",
  );
  tile.w += w;
  tile.c += c;
  state.workerSupply -= w;
  state.citizenSupply -= c;
}
function plantation(state, id, w = 0, c = 0) {
  const source = [state.bag, state.offer, state.discard].find((list) =>
    list.includes(id),
  );
  requireValue(source, `Missing tutorial plantation: ${id}`);
  source.splice(source.indexOf(id), 1);
  const tile = { id, w: 0, c: 0 };
  state.players[0].estates.push(tile);
  staff(state, tile, w, c);
  return tile;
}
function building(state, id, w = 0, c = 0) {
  requireValue(state.market[id] > 0, `Missing tutorial building: ${id}`);
  state.market[id]--;
  const tile = { id, w: 0, c: 0 };
  state.players[0].buildings.push(tile);
  staff(state, tile, w, c);
  return tile;
}
function takeGoods(state, target, amounts) {
  for (const [good, amount] of Object.entries(amounts)) {
    requireValue(
      state.supply[good] >= amount,
      `Tutorial supply exhausted: ${good}`,
    );
    state.supply[good] -= amount;
    target[good] += amount;
  }
}
function cargo(state, ship, good, amount) {
  requireValue(amount <= state.ships[ship].capacity, "Tutorial ship overflow");
  const taken = goods();
  takeGoods(state, taken, { [good]: amount });
  Object.assign(state.ships[ship], { good, amount });
}
function festival(state, id, markers) {
  const card = clone(FESTIVALS.find((card) => card.id === id));
  card.targets = { goods: [...markers], estates: [], building: null };
  for (const good of markers) takeGoods(state, goods(), { [good]: 1 });
  state.festivals.push(card);
}

function basics() {
  const state = position("basics");
  staff(state, state.players[0].estates[0]);
  plantation(state, "corn", 1);
  building(state, "smallFruit", 1);
  // A prepared late-round position: players 1 and 2 already chose their roles.
  state.governor = 1;
  state.choices = 2;
  state.chooser = 0;
  state.roles.find((role) => role.id === "planter").taken = 1;
  state.roles.find((role) => role.id === "recruiter").taken = 2;
  state.roles.find((role) => role.id === "craftsman").coins = 2;
  return state;
}
function shipping() {
  const state = position("shipping");
  takeGoods(state, state.players[0].goods, { fruit: 3, coffee: 2 });
  cargo(state, 0, "fruit", 2);
  cargo(state, 1, "sugar", 4);
  cargo(state, 2, "tobacco", 4);
  return state;
}
function citizens() {
  const state = position(
    "citizens",
    ["citizens"],
    ["chapel", "notary", "cityHall"],
  );
  plantation(state, "corn");
  building(state, "smallFruit");
  building(state, "chapel");
  building(state, "notary");
  state.workerSupply += state.register.w;
  state.citizenSupply += state.register.c;
  state.register = { w: 0, c: 0 };
  staff(state, state.players[0].reserve, 3, 2);
  for (const player of state.players.slice(1)) staff(state, player.reserve, 1);
  state.players[0].coins = 10;
  state.role = "recruiter";
  state.owner = 0;
  state.choices = 1;
  state.chooser = 1;
  state.roles.find((role) => role.id === "recruiter").taken = 0;
  state.tasks = [
    ...state.players.map((_, p) => ({ kind: "assign", p })),
    { kind: "phaseEnd" },
  ];
  return state;
}
function coffee() {
  const state = position("coffee", ["smuggler"]);
  state.expansions.push("festival", "festival-cards");
  plantation(state, "coffee", 1);
  plantation(state, "coffee", 1);
  plantation(state, "corn", 1);
  building(state, "coffeeRoaster", 2);
  festival(state, "cocktail", ["coffee", "coffee", "corn"]);
  festival(state, "weightOff", ["coffee"]);
  festival(state, "grandSendoff", ["coffee"]);
  cargo(state, 2, "coffee", 5);
  return state;
}

const equals = (a, b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => equals(a[key], b[key]))
  );
};
const production = (amounts) => ({ type: "produce", goods: goods(amounts) });
const lesson = (id, target, expected) => ({ id, target, expected });

const definitions = {
  basics: {
    initialState: basics,
    opponentRole: () => "trader",
    steps: [
      lesson("role", "roles", () => ({ type: "role", id: "craftsman" })),
      lesson("produce", "actions", () => production({ fruit: 1, corn: 1 })),
      lesson("bonus", "actions", () => ({
        type: "produceBonus",
        good: "fruit",
      })),
      lesson("sell", "actions", () => ({ type: "trade", good: "fruit" })),
    ],
  },
  shipping: {
    initialState: shipping,
    steps: [
      lesson("role", "roles", () => ({ type: "role", id: "captain" })),
      lesson("load", "harbor", () => ({
        type: "ship",
        ship: 0,
        good: "fruit",
      })),
      lesson("store", "actions", () => ({
        type: "store",
        types: [],
        goods: goods({ coffee: 1 }),
      })),
    ],
  },
  citizens: {
    initialState: citizens,
    opponentRole: (state) => (state.choices === 1 ? "craftsman" : "builder"),
    steps: [
      lesson("assign", "city", (state) => ({
        type: "assign",
        estates: state.players[0].estates.map(() => ({ w: 1, c: 0 })),
        buildings: state.players[0].buildings.map((tile) =>
          tile.id === "smallFruit" ? { w: 1, c: 0 } : { w: 0, c: 1 },
        ),
      })),
      lesson("produce", "actions", () => production({ fruit: 1, corn: 1 })),
      lesson("build", "city", () => ({ type: "build", id: "cityHall" })),
    ],
  },
  coffee: {
    initialState: coffee,
    opponentRole: () => "craftsman",
    steps: [
      lesson("role", "roles", () => ({ type: "role", id: "smuggler" })),
      lesson("raid", "harbor", () => ({ type: "raid", ship: 2, amount: 3 })),
      lesson("produce", "actions", () => production({ coffee: 2, corn: 1 })),
    ],
  },
};

function allowed(step, state, move) {
  if (!move || typeof move !== "object") return false;
  const clean = clone(move);
  if (Array.isArray(clean.decline) && !clean.decline.length)
    delete clean.decline;
  return equals(step.expected(state), clean);
}
function scriptOpponents(state, definition) {
  let next = state;
  for (let guard = 0; guard < 100; guard++) {
    const player = engine.currentPlayer(next);
    if (player === 0 || engine.ended(next)) return next;
    const choices = engine.legal(next, player);
    const move =
      next.tasks[0]?.kind === "role"
        ? choices.find((move) => move.id === definition.opponentRole?.(next))
        : (choices.find((move) => move.type === "pass") ?? choices[0]);
    requireValue(move, "Tutorial opponent has no scripted legal move");
    next = engine.move(next, move, player);
  }
  throw new Error("Tutorial opponent loop");
}

export const chapters = Object.fromEntries(
  Object.entries(definitions).map(([id, definition]) => {
    const steps = definition.steps.map((step, index) => ({
      id: step.id,
      titleKey: `tutorial.${id}.${step.id}.title`,
      textKey: `tutorial.${id}.${step.id}.text`,
      hintKey: `tutorial.${id}.${step.id}.hint`,
      target: step.target,
      complete: (state) => state.tutorial.completed > index,
      validateMove: (state, move) =>
        allowed(step, state, move) ? undefined : "tutorial.error.move",
    }));
    return [
      id,
      {
        id,
        version: id === "shipping" ? 2 : 1,
        titleKey: `tutorial.${id}.title`,
        descriptionKey: `tutorial.${id}.description`,
        initialState: definition.initialState,
        steps,
        move(state, move) {
          requireValue(state.tutorial?.id === id, "Wrong tutorial chapter");
          const index = state.tutorial.completed;
          const step = definition.steps[index];
          requireValue(
            step && allowed(step, state, move),
            "tutorial.error.move",
          );
          let next = engine.move(state, move, 0);
          next.tutorial.completed++;
          if (next.tutorial.completed < steps.length)
            next = scriptOpponents(next, definition);
          return next;
        },
      },
    ];
  }),
);

export const chapterIds = Object.keys(chapters);
export function expectedMove(state) {
  const definition = definitions[state.tutorial?.id];
  const step = definition?.steps[state.tutorial.completed];
  return step ? clone(step.expected(state)) : undefined;
}
export function tutorialOptions(id, translate) {
  const chapter = chapters[id];
  requireValue(chapter, `Unknown tutorial chapter: ${id}`);
  return {
    game: "puerto-rico",
    id,
    version: chapter.version,
    initialState: chapter.initialState,
    move: chapter.move,
    steps: [
      ...(id === "basics"
        ? [
            {
              id: "intro",
              title: translate("tutorial.basics.intro.title"),
              text: translate("tutorial.basics.intro.text"),
            },
          ]
        : []),
      ...chapter.steps.map(
        ({ titleKey, textKey, hintKey, validateMove, ...step }) => ({
          ...step,
          title: translate(titleKey),
          text: translate(textKey),
          hint: translate(hintKey),
          validateMove: (state, move) => {
            const key = validateMove(state, move);
            return key ? translate(key) : undefined;
          },
        }),
      ),
    ],
    completion: {
      title: translate(`tutorial.${id}.complete.title`),
      text: translate(`tutorial.${id}.complete.text`),
    },
  };
}
