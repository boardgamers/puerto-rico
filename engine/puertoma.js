import { BUILDINGS as B, GOODS } from "./catalog.js";

// Card orders transcribed from the eight physical tiebreaker cards; terminology
// is mapped to the Special Edition (Mayor→Recruiter, Settler→Planter).
export const TIEBREAKERS = [
  [
    "builder",
    "recruiter",
    "craftsman",
    "trader",
    "captain",
    "planter",
    "adventurer",
  ],
  [
    "captain",
    "trader",
    "recruiter",
    "builder",
    "planter",
    "adventurer",
    "craftsman",
  ],
  [
    "trader",
    "craftsman",
    "recruiter",
    "builder",
    "adventurer",
    "planter",
    "captain",
  ],
  [
    "craftsman",
    "builder",
    "recruiter",
    "adventurer",
    "trader",
    "captain",
    "planter",
  ],
  [
    "recruiter",
    "builder",
    "adventurer",
    "captain",
    "craftsman",
    "trader",
    "planter",
  ],
  [
    "builder",
    "adventurer",
    "recruiter",
    "trader",
    "captain",
    "craftsman",
    "planter",
  ],
  [
    "adventurer",
    "builder",
    "recruiter",
    "captain",
    "trader",
    "craftsman",
    "planter",
  ],
  [
    "builder",
    "captain",
    "recruiter",
    "trader",
    "craftsman",
    "planter",
    "adventurer",
  ],
];
export const ADJACENCY = {
  builder: ["adventurer", "planter", "trader", "recruiter"],
  planter: ["adventurer", "builder", "recruiter"],
  adventurer: ["builder", "planter"],
  trader: ["builder", "craftsman", "captain", "smuggler"],
  recruiter: ["trader", "craftsman"],
  craftsman: ["trader", "captain", "smuggler"],
  captain: ["trader", "craftsman", "builder", "planter", "smuggler"],
  smuggler: ["captain", "craftsman", "trader", "builder", "planter"],
};
export const ABILITIES = {
  1: ["tradeDuplicate", "tradeCoin", "buildWorker"],
  2: ["storage", "buildCoin", "produceCrate"],
  3: ["produceCoins", "recruitWorker", "plantCrate"],
  4: ["goodsPoints", "discardPoints", "recruitCoins"],
};
const total = (t) => t.w + t.c;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const counts = () => Object.fromEntries(GOODS.map((g) => [g, 0]));
export const estateCapacity = (id) =>
  ({ corn: 1, fruit: 2, sugar: 2, tobacco: 3, coffee: 3 })[id] ?? 0;
export const level = (id) => (B[id].size === 2 ? 4 : B[id].vp);
export const ability = (a, id) =>
  a.puertoma?.abilities.some((x) => x.id === id && x.active);
export const estateActive = (t) =>
  !t.vpArea && estateCapacity(t.id) > 0 && total(t) === estateCapacity(t.id);
export function production(a) {
  const out = counts();
  a.estates.forEach((t) => {
    if (estateActive(t)) out[t.id]++;
  });
  return out;
}
export function emptyEstateSpaces(a) {
  return sum(
    a.estates.map((t) =>
      Math.max(0, (t.vpArea ? 0 : estateCapacity(t.id)) - total(t)),
    ),
  );
}
export function registerDemand(a) {
  return Math.max(
    0,
    ...a.estates.map((t) => (t.vpArea ? 0 : estateCapacity(t.id)) - total(t)),
  );
}
export function price(s, p, id) {
  let base = B[id].cost;
  if (s.options.costSwap) {
    if (id === "factory") base = 8;
    if (id === "school") base = 7;
  }
  return Math.max(0, base - Number(s.role === "builder" && s.owner === p));
}
export const buildingOrder = (x, y) =>
  B[x].cost - B[y].cost || x.localeCompare(y);
export function buildings(s, p) {
  const a = s.players[p];
  const bonus = Number(ability(a, "buildCoin"));
  const built = (l) =>
    a.buildings.filter((b) => (b.level ?? level(b.id)) === l).length;

  const targets = s.festivals
    .filter((f) => f.claimed === undefined)
    .map((f) => f.targets.building);
  return Object.keys(s.market)
    .sort(buildingOrder)
    .flatMap((id) => {
      const b = B[id],
        natural = level(id);
      if (
        !s.market[id] ||
        b.good ||
        a.buildings.some((x) => x.id === id) ||
        price(s, p, id) > a.coins + bonus
      )
        return [];
      let slot = natural;
      if (targets.includes(id)) while (slot <= 4 && built(slot) >= 2) slot++;
      if (slot > 4 || built(slot) >= 2) return [];
      if (
        slot > natural &&
        !Object.keys(s.market).some(
          (other) =>
            s.market[other] &&
            !B[other].good &&
            level(other) === slot &&
            price(s, p, other) <= a.coins + bonus,
        )
      )
        return [];
      if (natural === 4 && (a.puertoma.reserved !== id || !a.buildings.length))
        return [];
      return [{ type: "build", id, level: slot }];
    });
}
function festivalEstates(s) {
  return [
    ...new Set(
      s.festivals
        .filter((f) => f.claimed === undefined)
        .flatMap((f) => f.targets.estates),
    ),
  ];
}
function festivalGoods(s) {
  return [
    ...new Set(
      s.festivals
        .filter((f) => f.claimed === undefined)
        .flatMap((f) => f.targets.goods),
    ),
  ];
}
export function allocation(s, p, draw) {
  const a = s.players[p];
  // Existing workers stay in their slots; unused workers already in the VP area
  // never return to production. Only newly gained workers are in reserve.
  const estates = a.estates.map((t) => ({ w: t.w, c: t.c }));
  let w = a.reserve.w,
    c = a.reserve.c;
  while (w + c) {
    const choices = a.estates
      .map((t, i) => ({
        i,
        id: t.id,
        empty: (t.vpArea ? 0 : estateCapacity(t.id)) - total(estates[i]),
      }))
      .filter((t) => t.empty > 0);
    if (!choices.length) break;
    const desired = festivalGoods(s);
    const matches = choices.filter((x) => desired.includes(x.id));
    let selected;
    if (matches.length)
      selected =
        matches.length === 1
          ? matches[0]
          : matches[
              ((draw?.() ?? s.puertoma.lastCard ?? 1) - 1) % matches.length
            ];
    else
      selected = choices.sort(
        (x, y) =>
          x.empty - y.empty ||
          GOODS.indexOf(y.id) - GOODS.indexOf(x.id) ||
          x.i - y.i,
      )[0];
    const t = estates[selected.i];
    for (let n = 0; n < selected.empty && w + c; n++) {
      if (c) {
        t.c++;
        c--;
      } else {
        t.w++;
        w--;
      }
    }
  }
  return {
    estates,
    buildings: a.buildings.map(() => ({ w: 0, c: 0 })),
    unused: { w, c },
  };
}
export function storage(a) {
  const types = ability(a, "storage")
    ? [...GOODS]
        .reverse()
        .filter((g) => a.goods[g])
        .slice(0, 1)
    : [];
  const goods = counts();
  types.forEach((g) => (goods[g] = a.goods[g]));
  const one = [...GOODS]
    .reverse()
    .find((g) => a.goods[g] && !types.includes(g));
  if (one) goods[one] = 1;
  return { types, goods };
}
function goodTrade(s, p) {
  const a = s.players[p];
  return GOODS.filter(
    (g) =>
      a.goods[g] &&
      s.trade.length < 4 &&
      (!s.trade.includes(g) || ability(a, "tradeDuplicate")) &&
      GOODS.indexOf(g) +
        Number(s.owner === p) +
        Number(ability(a, "tradeCoin")) >=
        1,
  );
}
function plantOptions(s, p) {
  const a = s.players[p],
    desired = festivalEstates(s);
  const ids = [...new Set(s.offer)].filter(
    (id) =>
      a.estates.filter((t) => t.id === id && !t.vpArea).length < 2 ||
      desired.includes(id),
  );
  return [
    ...ids.map((id) => ({ type: "plant", id })),
    ...(s.quarries ? [{ type: "plant", id: "quarry" }] : []),
  ];
}
function profitable(s, p, id, api) {
  const preview = {
    ...s,
    role: id,
    owner: p,
    players: s.players.map((a, i) =>
      i === p
        ? { ...a, coins: a.coins + s.roles.find((r) => r.id === id).coins }
        : a,
    ),
  };
  const a = preview.players[p];
  if (id === "builder") return buildings(preview, p).length > 0;
  if (id === "planter") return plantOptions(preview, p).length > 0;
  if (id === "recruiter") return emptyEstateSpaces(a) > 0;
  if (id === "craftsman")
    return GOODS.some((g) => production(a)[g] && !a.goods[g] && s.supply[g]);
  if (id === "trader") return goodTrade(preview, p).length > 0;
  if (id === "captain") return api.shipping(preview, p).length > 0;
  if (id === "smuggler") return smuggleOptions(preview, p).length > 0;
  return id.startsWith("adventurer");
}
function smuggleOptions(s, p) {
  const a = s.players[p],
    out = [];
  const surplus = total(s.register) - s.players.length;
  if (surplus > 0 && emptyEstateSpaces(a) > 0)
    out.push({
      type: "poach",
      gain: Math.min(3, surplus, emptyEstateSpaces(a)),
      priority: 3,
    });
  if (s.trade.length)
    out.push({ type: "plunder", gain: s.trade.length, priority: 2 });
  const raids = s.ships
    .map((sh, ship) => ({ sh, ship }))
    .filter((x) => x.sh.amount)
    .sort(
      (x, y) =>
        Number(!production(a)[y.sh.good]) - Number(!production(a)[x.sh.good]) ||
        y.sh.amount - x.sh.amount ||
        GOODS.indexOf(y.sh.good) - GOODS.indexOf(x.sh.good),
    );
  if (raids.length) {
    const { sh, ship } = raids[0];
    out.push({
      type: "raid",
      ship,
      amount: Math.min(3, sh.amount),
      gain: Math.min(3, sh.amount),
      priority: 1,
    });
  }
  return out;
}
// Select against a private clone so repeated legal/state queries never consume
// randomness. The exact number of card draws is committed when the move executes.
export function choice(state, t, api) {
  const s = structuredClone(state),
    p = t.p,
    a = s.players[p];
  let draws = 0;
  const card = () => {
    draws++;
    return api.draw(s);
  };
  const pick = (xs) => (xs.length === 1 ? xs[0] : xs[(card() - 1) % xs.length]);
  let m = { type: "pass" };
  switch (t.kind) {
    case "draft":
      m = {
        type: "draft",
        id: pick(
          api
            .marketChoices(s)
            .map((b) => b.id)
            .sort(buildingOrder),
        ),
      };
      break;
    case "role": {
      let roles = s.roles.filter(
        (r) =>
          r.taken === null &&
          (r.id !== "smuggler" || s.smuggler !== p) &&
          profitable(s, p, r.id, api),
      );
      // If no action is profitable, still choose an available legal Role to keep
      // play progressing; profitability is advice, not an extra end condition.
      if (!roles.length)
        roles = s.roles.filter(
          (r) => r.taken === null && (r.id !== "smuggler" || s.smuggler !== p),
        );
      const adjacent = roles.filter((r) =>
        ADJACENCY[s.puertoma.tracker].includes(r.id.replace(/2$/, "")),
      );
      if (adjacent.length) roles = adjacent;
      const most = Math.max(
        ...roles.map((r) => (r.id === "smuggler" ? 2 : r.coins)),
      );
      roles = roles.filter((r) => (r.id === "smuggler" ? 2 : r.coins) === most);
      let selected = roles.find((r) => r.id === "smuggler");
      if (!selected)
        selected =
          roles.length === 1
            ? roles[0]
            : TIEBREAKERS[card() - 1].flatMap((id) =>
                roles.filter((r) => r.id.replace(/2$/, "") === id),
              )[0];
      m = { type: "role", id: selected.id };
      break;
    }
    case "plant": {
      const choices = plantOptions(s, p),
        desired = festivalEstates(s);
      let pool = choices.filter((m) => desired.includes(m.id));
      if (pool.length) m = pick(pool);
      else {
        pool = choices.filter(
          (m) =>
            festivalGoods(s).includes(m.id) &&
            !a.estates.some((e) => e.id === m.id),
        );
        if (pool.length) m = pick(pool);
        else
          m =
            choices
              .filter((m) => m.id !== "quarry")
              .sort(
                (x, y) =>
                  Number(a.estates.some((e) => e.id === y.id)) -
                    Number(a.estates.some((e) => e.id === x.id)) ||
                  GOODS.indexOf(y.id) - GOODS.indexOf(x.id),
              )[0] ??
            choices[0] ??
            m;
      }
      break;
    }
    case "build": {
      const choices = buildings(s, p);
      const desired = s.festivals
        .filter((f) => f.claimed === undefined)
        .map((f) => f.targets.building);
      let pool = choices.filter((m) => desired.includes(m.id));
      if (pool.length) {
        const min = Math.min(...pool.map((m) => price(s, p, m.id)));
        pool = pool.filter((m) => price(s, p, m.id) === min);
      } else {
        const highest = Math.max(0, ...choices.map((m) => m.level));
        pool = choices.filter((m) => m.level === highest);
      }
      if (pool.length) m = pick(pool);
      break;
    }
    case "recruitBonus":
      if (s.workerSupply) m = { type: "recruitBonus" };
      break;
    case "recruit":
      m = { type: "recruit", kind: s.register.c ? "c" : "w" };
      break;
    case "assign":
      m = { type: "assign", ...allocation(s, p, card) };
      break;
    case "bonusAssign": {
      const next = allocation(s, p);
      const i = next.estates.findIndex((e, i) => e.w > a.estates[i].w);
      if (i >= 0) m = { type: "bonusAssign", target: `e${i}` };
      break;
    }
    case "produce":
      m = {
        type: "produce",
        goods: Object.fromEntries(
          GOODS.map((g) => [g, Math.min(production(a)[g], s.supply[g])]),
        ),
      };
      break;
    case "produceBonus": {
      const good = [...GOODS]
        .reverse()
        .find((g) => s.production[p][g] && s.supply[g]);
      if (good) m = { type: "produceBonus", good };
      break;
    }
    case "trade": {
      const goods = t.acted ? [] : goodTrade(s, p);
      const festival = s.festivals.find(
        (f) =>
          f.claimed === undefined &&
          f.goal === "tradeFull" &&
          s.trade.length === 3 &&
          goods.includes(f.targets.goods[0]),
      );
      const good = festival?.targets.goods[0] ?? goods.at(-1);
      if (good) m = { type: "trade", good };
      break;
    }
    case "ship": {
      const moves = api.shipping(s, p).filter((m) => Number.isInteger(m.ship));
      const ceremony = moves.filter((m) =>
        s.festivals.some(
          (f) =>
            f.claimed === undefined &&
            ["dispatchBig", "dispatchSmall"].includes(f.goal) &&
            f.targets.goods[0] === m.good &&
            s.ships[m.ship].capacity ===
              (f.goal === "dispatchBig"
                ? Math.max(...s.ships.map((x) => x.capacity))
                : Math.min(...s.ships.map((x) => x.capacity))) &&
            a.goods[m.good] >=
              s.ships[m.ship].capacity - s.ships[m.ship].amount,
        ),
      );
      const pool = ceremony.length ? ceremony : moves;
      m =
        pool.sort(
          (x, y) =>
            Math.min(
              a.goods[y.good],
              s.ships[y.ship].capacity - s.ships[y.ship].amount,
            ) -
              Math.min(
                a.goods[x.good],
                s.ships[x.ship].capacity - s.ships[x.ship].amount,
              ) ||
            GOODS.indexOf(x.good) - GOODS.indexOf(y.good) ||
            s.ships[x.ship].capacity - s.ships[y.ship].capacity,
        )[0] ?? m;
      break;
    }
    case "store":
      m = { type: "store", ...storage(a) };
      break;
    case "smuggle": {
      const options = smuggleOptions(s, p).sort(
        (x, y) =>
          y.gain - x.gain ||
          y.priority - x.priority ||
          Number(!production(a)[s.ships[y.ship]?.good]) -
            Number(!production(a)[s.ships[x.ship]?.good]) ||
          (s.ships[y.ship]?.amount ?? 0) - (s.ships[x.ship]?.amount ?? 0) ||
          GOODS.indexOf(s.ships[y.ship]?.good) -
            GOODS.indexOf(s.ships[x.ship]?.good),
      );
      const selected = options[0];
      if (selected) {
        const { gain, priority, ...move } = selected;
        m = move;
      }
      break;
    }
    case "poach": {
      const kind = s.register.c ? "c" : "w";
      const next = allocation(
        {
          ...s,
          players: s.players.map((x, i) =>
            i === p
              ? {
                  ...x,
                  reserve: { w: Number(kind === "w"), c: Number(kind === "c") },
                }
              : x,
          ),
        },
        p,
        card,
      );
      const i = next.estates.findIndex(
        (e, i) => total(e) > total(a.estates[i]),
      );
      if (i >= 0) m = { type: "poachWorker", kind, target: `e${i}` };
      break;
    }
    case "poachDiscard":
      m = { type: "discardWorker", kind: s.register.w ? "w" : "c" };
      break;
  }
  return draws ? { ...m, puertomaDraws: draws } : m;
}
export function score(a) {
  const out = production(a);
  const bonus = {
    expanded: a.buildings.filter((b) => B[b.id].size === 2).length * 6,
    unusedWorkers: total(a.puertoma.unused),
    quarries: a.estates.filter((t) => t.id === "quarry" || t.vpArea).length * 3,
    activePairs: GOODS.filter((g) => out[g] >= 2).length * 2,
    wealth: Math.ceil((a.coins + sum(Object.values(a.goods))) / 2),
  };
  return bonus;
}
