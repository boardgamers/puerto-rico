import * as P from "./puertoma.js";
import * as A from "./achievements.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  GOODS,
  ESTATES,
  CRATES,
  ROLES,
  BUILDINGS as B,
  MARKET_SLOTS,
  EXPANSIONS,
  FESTIVALS,
} from "./catalog.js";

export const hashSeed = true;
const clone = (x) => structuredClone(x);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const counts = (n = 0) => Object.fromEntries(GOODS.map((g) => [g, n]));
const assert = (ok, message = "Illegal move") => {
  if (!ok)
    throw Object.assign(new Error(message), { name: "InvalidMoveError" });
};
const integer = (x) => Number.isSafeInteger(x) && x >= 0;
const order = (s, p = s.owner) =>
  s.players.map((_, i) => (p + i) % s.players.length);
const total = (tile) => tile.w + tile.c;
const building = (p, id) => p.buildings.find((b) => b.id === id);
export const active = (p, id) =>
  !p.puertoma && !!building(p, id) && total(building(p, id)) > 0;
const citizen = (p, id) => (building(p, id)?.c ?? 0) > 0;
export const citySize = (p) => sum(p.buildings.map((b) => B[b.id].size));
const citizens = (p) =>
  p.reserve.c +
  (p.puertoma?.unused.c ?? 0) +
  sum([...p.estates, ...p.buildings].map((t) => t.c));
const people = (p) =>
  p.reserve.w +
  p.reserve.c +
  (p.puertoma ? total(p.puertoma.unused) : 0) +
  sum([...p.estates, ...p.buildings].map(total));
const spaces = (p) =>
  p.estates.filter((t) => t.id !== "forest").length +
  sum(p.buildings.map((t) => B[t.id].workers));
const freeSpaces = (p) =>
  p.puertoma
    ? P.emptyEstateSpaces(p)
    : spaces(p) - (people(p) - total(p.reserve));
function rng(s) {
  // Hash-chain generator: state is server-only and fully deterministic.
  s.random = Array.from(sha256(new TextEncoder().encode(s.random)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return parseInt(s.random.slice(0, 8), 16) / 4294967296;
}
function shuffle(s, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng(s) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
function drawEstate(s) {
  if (!s.bag.length) {
    s.bag = shuffle(s, s.discard);
    s.discard = [];
  }
  return s.bag.pop();
}
function refillEstates(s) {
  for (let i = 0; i < s.players.length + 1; i++) {
    const id = drawEstate(s);
    if (id) s.offer.push(id);
  }
}
function event(s, type, p, info = {}) {
  s.events.push({ round: s.round, role: s.role, type, p, ...info });
}
function vp(s, p, n) {
  if (n <= 0) return;
  s.players[p].vp += n;
  if (s.phaseVP) s.phaseVP[p] += n;
  s.vpSupply -= n;
  if (s.vpSupply <= 0) s.endReason ??= "points";
}
function gainPerson(s, p, kind = "w", register = false) {
  const key = kind === "c" ? "citizenSupply" : "workerSupply";
  if (s[key] > 0) {
    s[key]--;
    s.players[p].reserve[kind]++;
    return true;
  }
  if (register && s.register[kind] > 0) {
    s.register[kind]--;
    s.players[p].reserve[kind]++;
    return true;
  }
  return false;
}
function fillRegister(s) {
  const amount = Math.max(
    s.players.length,
    sum(
      s.players.map((p) =>
        p.puertoma
          ? P.registerDemand(p)
          : sum(p.buildings.map((b) => B[b.id].workers - total(b))),
      ),
    ),
  );
  const nc = s.expansions.includes("citizens") && s.citizenSupply > 0 ? 1 : 0;
  s.register.c = nc;
  s.citizenSupply -= nc;
  const nw = Math.min(amount - nc, s.workerSupply);
  s.register.w = nw;
  s.workerSupply -= nw;
  if (nw + nc < amount && !s.expansions.includes("citizens"))
    s.endReason ??= "workers";
}
function marketChoices(s) {
  const chosen = Object.keys(s.market);
  return Object.values(B).filter(
    (b) =>
      !chosen.includes(b.id) &&
      (!b.good || b.good === "tailor") &&
      (b.expansion === "base" || s.expansions.includes(b.expansion)) &&
      chosen.filter(
        (id) =>
          (!B[id].good || B[id].good === "tailor") && B[id].cost === b.cost,
      ).length < MARKET_SLOTS[b.cost],
  );
}
function setupFestival(s) {
  if (
    !s.expansions.includes("festival") &&
    !s.expansions.includes("festival-cards")
  )
    return;
  const cards = s.expansions.includes("festival-cards")
    ? shuffle(
        s,
        clone(FESTIVALS.filter((f) => !s.puertoma || f.goal !== "ship")),
      ).slice(0, 3)
    : ["connoisseur", "cocktail", "pioneer"].map((id) =>
        clone(FESTIVALS.find((f) => f.id === id)),
      );
  for (const f of cards) {
    f.targets = { goods: [], estates: [], building: null };
    for (let i = 0; i < (f.goods ?? 0); i++) {
      const pool = GOODS.flatMap((g) =>
        Array(
          Math.max(0, 3 - f.targets.goods.filter((x) => x === g).length),
        ).fill(g),
      );
      const g = pool[Math.floor(rng(s) * pool.length)];
      f.targets.goods.push(g);
      s.supply[g]--;
    }
    for (let i = 0; i < (f.estates ?? 0); i++) {
      const pool = GOODS.filter((g) => s.bag.includes(g));
      const g = pool[Math.floor(rng(s) * pool.length)];
      f.targets.estates.push(g);
      s.bag.splice(s.bag.indexOf(g), 1);
    }
    if (f.building) {
      const choices = Object.keys(s.market).filter(
        (id) =>
          !B[id].good &&
          (f.building === 4 ? B[id].size === 2 : B[id].vp === f.building) &&
          s.market[id] > 0,
      );
      const id = choices[Math.floor(rng(s) * choices.length)];
      f.targets.building = id;
      // A unique expanded building cannot be removed as its own objective marker.
      // Use a reference marker when reserving a physical copy would make the goal impossible.
      // This unresolved rulebook corner case is tracked in docs/sources.md before release.
      f.buildingReserved = s.market[id] > 1;
      if (f.buildingReserved) s.market[id]--;
    }
    s.festivals.push(f);
  }
}
export function init(n, expansions = [], options = {}, seed = "puerto-rico") {
  assert(
    Number.isInteger(n) && n >= 2 && n <= 5,
    "Puerto Rico supports 2–5 players",
  );
  assert(
    Array.isArray(expansions) &&
      expansions.every((x) => EXPANSIONS.includes(x)),
    "Unsupported expansion",
  );
  const s = {
    version: 1,
    config: {
      n,
      expansions: [...new Set(expansions)],
      options: clone(options),
      seed: String(seed),
    },
    random: String(seed),
    expansions: [...new Set(expansions)],
    options: clone(options),
    round: 1,
    governor: 0,
    chooser: 0,
    owner: 0,
    role: null,
    roles: ROLES.map((id) => ({ id, coins: 0, taken: null })),
    choices: 0,
    players: [],
    bag: [],
    discard: [],
    offer: [],
    quarries: n === 2 ? 5 : 8,
    workerSupply: { 2: 42, 3: 58, 4: 79, 5: 100 }[n],
    citizenSupply: expansions.includes("citizens") ? 20 : 0,
    register: { w: 0, c: 0 },
    vpSupply: { 2: 65, 3: 75, 4: 100, 5: 126 }[n],
    supply: Object.fromEntries(
      GOODS.map((g) => [g, CRATES[g] - (n === 2 ? 2 : 0)]),
    ),
    market: {},
    ships: (n === 2 ? [4, 6] : [n + 1, n + 2, n + 3]).map((capacity) => ({
      capacity,
      good: null,
      amount: 0,
    })),
    trade: [],
    tasks: [],
    festivals: [],
    events: [],
    history: [],
    smuggler: null,
    captured: null,
    endReason: null,
    finished: false,
  };
  if (n === 2 || n >= 4)
    s.roles.push({ id: "adventurer", coins: 0, taken: null });
  if (n === 5) s.roles.push({ id: "adventurer2", coins: 0, taken: null });
  if (expansions.includes("smuggler"))
    s.roles.push({ id: "smuggler", coins: 0, taken: null });
  for (const g of GOODS)
    s.bag.push(...Array(ESTATES[g] - (n === 2 ? 3 : 0)).fill(g));
  for (let i = 0; i < n; i++) {
    const id = i < (n === 2 ? 1 : n === 5 ? 3 : 2) ? "fruit" : "corn";
    s.bag.splice(s.bag.indexOf(id), 1);
    s.players.push({
      name: `Player ${i + 1}`,
      coins:
        (n === 2 ? 3 : n - 1) -
        (options.alternativeStart && id === "corn" ? 1 : 0),
      vp: 0,
      goods: counts(),
      estates: [{ id, w: 0, c: 0 }],
      buildings: [],
      reserve: { w: 0, c: 0 },
      bot: false,
    });
  }
  s.bag = shuffle(s, s.bag);
  const choose = expansions.some((x) =>
    ["new-buildings", "citizens"].includes(x),
  );
  for (const b of Object.values(B))
    if (b.expansion === "base" && (!choose || b.good))
      s.market[b.id] = n === 2 ? (b.good ? 2 : 1) : b.copies;
  if (options.puertoma) setupPuertoma(s, options.puertoma);
  fillRegister(s);
  if (choose) s.tasks = [{ kind: "draft", p: 0 }];
  else {
    finishPuertomaSetup(s);
    setupFestival(s);
    refillEstates(s);
    s.tasks = [{ kind: "role", p: 0 }];
  }
  setupAchievements(s);
  event(s, "round", 0);
  return s;
}
export function production(p) {
  if (p.puertoma) return P.production(p);
  const out = counts();
  for (const g of GOODS) {
    const farms = sum(p.estates.filter((t) => t.id === g).map(total));
    const slots = sum(p.buildings.filter((t) => B[t.id].good === g).map(total));
    out[g] = g === "corn" ? farms : Math.min(farms, slots);
  }
  if (active(p, "canal"))
    for (const [g, id] of [
      ["fruit", "largeFruit"],
      ["sugar", "largeSugar"],
    ])
      if (out[g] && active(p, id)) out[g]++;
  return out;
}
export function cost(s, p, id, move = {}) {
  if (s.players[p].puertoma) return P.price(s, p, id);
  const a = s.players[p],
    b = B[id];
  let base = b.cost;
  if (s.options.costSwap) {
    if (id === "factory") base = 8;
    if (id === "school") base = 7;
  }
  let discount = Math.min(
    sum(a.estates.filter((t) => t.id === "quarry").map(total)),
    b.size === 2 ? 4 : b.vp,
  );
  if (s.owner === p && s.role === "builder")
    discount += active(a, "publishingHouse") ? 2 : 1;
  if (active(a, "lumberyard"))
    discount += Math.floor(
      a.estates.filter((t) => t.id === "forest").length / 2,
    );
  if (active(a, "notary"))
    discount += citizen(a, "notary")
      ? b.size === 2
        ? 2
        : 0
      : b.size === 1
        ? 1
        : 0;
  return move.pay ?? Math.max(0, base - discount);
}
function buildingPayments(s, p, id) {
  const a = s.players[p],
    b = B[id];
  const base =
    s.options.costSwap && id === "factory"
      ? 8
      : s.options.costSwap && id === "school"
        ? 7
        : b.cost;
  const quarries = Math.min(
    sum(a.estates.filter((t) => t.id === "quarry").map(total)),
    b.size === 2 ? 4 : b.vp,
  );
  const privilege =
    s.owner === p && s.role === "builder"
      ? active(a, "publishingHouse")
        ? 2
        : 1
      : 0;
  const lumber = active(a, "lumberyard")
    ? Math.floor(a.estates.filter((t) => t.id === "forest").length / 2)
    : 0;
  const notary = active(a, "notary")
    ? citizen(a, "notary")
      ? b.size === 2
        ? 2
        : 0
      : b.size === 1
        ? 1
        : 0
    : 0;
  let reductions = Array.from({ length: quarries + 1 }, (_, i) => i);
  for (const bonus of [privilege, lumber, notary])
    if (bonus)
      reductions = [...new Set(reductions.flatMap((n) => [n, n + bonus]))];
  return [...new Set(reductions.map((n) => Math.max(0, base - n)))].sort(
    (a, b) => a - b,
  );
}
function tileRef(a, key) {
  if (key === "reserve") return a.reserve;
  const m = /^([eb])(\d+)$/.exec(key ?? "");
  return m ? (m[1] === "e" ? a.estates : a.buildings)[Number(m[2])] : null;
}
function workerSources(a) {
  return [
    ["reserve", a.reserve],
    ...a.estates.map((t, i) => [`e${i}`, t]),
    ...a.buildings.map((t, i) => [`b${i}`, t]),
  ].flatMap(([key, t]) =>
    ["w", "c"]
      .filter((k) => t[k] > 0 && !(t.id === "hiddenMarket" && total(t) === 1))
      .map((kind) => ({ key, kind })),
  );
}
export function buildOptions(s, p) {
  if (s.players[p].puertoma) return P.buildings(s, p);
  const a = s.players[p],
    out = [];
  for (const [id, n] of Object.entries(s.market)) {
    const b = B[id];
    if (!n || building(a, id) || citySize(a) + b.size > 12) continue;
    if (
      s.options.pairingRestrictions &&
      [
        ["villa", "tailorShop"],
        ["hacienda", "lumberyard"],
      ].some(
        (pair) =>
          pair.includes(id) && pair.some((x) => x !== id && building(a, x)),
      )
    )
      continue;
    const short = cost(s, p, id) - a.coins;
    if (short <= 0) {
      out.push({ type: "build", id });
      // Quarry reductions and role Advantages may be declined (rulebook pp. 9, 12).
      // Explicit higher Coin payments let Big Spender use this legal choice.
      for (const pay of buildingPayments(s, p, id))
        if (pay > cost(s, p, id) && pay <= a.coins)
          out.push({ type: "build", id, pay });
      continue;
    }
    if (short > 3 || !active(a, "hiddenMarket")) continue;
    for (const worker of [null, ...workerSources(a)])
      for (const good of [null, ...GOODS.filter((g) => a.goods[g])])
        for (const point of [0, ...(a.vp ? [1] : [])])
          if (Number(!!worker) + Number(!!good) + point === short)
            out.push({ type: "build", id, worker, good, point });
  }
  return out;
}
function tasksFor(s, role, p) {
  const all = order(s, p),
    tasks = [];
  if (role === "planter") {
    for (const i of all) {
      if (active(s.players[i], "hacienda"))
        tasks.push({ kind: "hacienda", p: i });
      tasks.push({ kind: "plant", p: i });
      if (active(s.players[i], "hospital"))
        tasks.push({ kind: "hospital", p: i });
    }
    if (active(s.players[p], "publishingHouse"))
      tasks.push({ kind: "plant", p, second: true });
    for (const i of all)
      if (active(s.players[i], "parkAuthority"))
        tasks.push({ kind: "park", p: i });
  } else if (role === "recruiter") {
    for (const i of all)
      if (active(s.players[i], "villa")) tasks.push({ kind: "villa", p: i });
    tasks.push(
      {
        kind: "recruitBonus",
        p,
        remaining: active(s.players[p], "publishingHouse") ? 2 : 1,
      },
      { kind: "recruit", p },
    );
    for (const i of all) tasks.push({ kind: "assign", p: i });
  } else if (role === "builder")
    for (const i of all) tasks.push({ kind: "build", p: i });
  else if (role === "craftsman") {
    for (const i of all) tasks.push({ kind: "produce", p: i });
    tasks.push({
      kind: "produceBonus",
      p,
      remaining: active(s.players[p], "publishingHouse") ? 2 : 1,
    });
  } else if (role === "trader")
    for (const i of all)
      tasks.push({ kind: "trade", p: i, acted: false, zoneUsed: false });
  else if (role === "captain") {
    for (const i of all) tasks.push({ kind: "captainStart", p: i });
    tasks.push({ kind: "ship", p });
  } else if (role === "smuggler") tasks.push({ kind: "smuggle", p });
  return [...tasks, { kind: "phaseEnd" }];
}
function startRole(s, id, p, captured = false) {
  const role = s.roles.find((r) => r.id === id);
  assert(role && role.taken === null);
  if (!captured) {
    s.choices++;
    s.chooser = (p + 1) % s.players.length;
  }
  s.players[p].coins += role.coins;
  const coins = role.coins;
  role.coins = 0;
  role.taken = p;
  if (s.captured?.id === id && !captured) s.players[s.captured.p].coins += 3;
  if (s.captured?.id === id) s.captured = null;
  s.role = id.startsWith("adventurer") ? "adventurer" : id;
  s.owner = p;
  s.phaseVP = s.players.map(() => 0);
  if (s.role === "recruiter")
    for (const a of s.players) if (a.puertoma) a.puertoma.recruited = 0;
  s.production = s.players.map(() => counts());
  s.shipped = s.players.map(() => counts());
  s.planted = s.players.map(() => []);
  s.usedWharves = [];
  s.privateCargo = counts();
  s.captainBonus = false;
  s.shipPasses = 0;
  event(s, "role", p, { id, coins });
  if (s.role === "adventurer") {
    const n = active(s.players[p], "publishingHouse") ? 2 : 1;
    s.players[p].coins += n;
    event(s, "income", p, { coins: n });
  }
  if (s.role === "smuggler") s.smuggler = p;
  s.tasks = tasksFor(s, s.role, p);
}
function finishRound(s) {
  if (s.endReason) {
    s.finished = true;
    s.tasks = [];
    event(s, "end", null, { reason: s.endReason });
    return;
  }
  for (const r of s.roles) {
    if (r.taken === null && r.id !== "smuggler") r.coins++;
    r.taken = null;
  }
  s.round++;
  s.governor = (s.governor + 1) % s.players.length;
  s.chooser = s.governor;
  s.choices = 0;
  s.role = null;
  s.captured = null;
  s.tasks = [{ kind: "role", p: s.governor }];
  event(s, "round", s.governor);
}
function finishPhase(s) {
  if (s.role === "planter") {
    s.discard.push(...s.offer);
    s.offer = [];
    refillEstates(s);
  }
  finishPuertomaPhase(s);
  if (s.role === "recruiter") fillRegister(s);
  if (s.role === "trader" && s.trade.length === 4) {
    for (const g of s.trade) s.supply[g]++;
    s.trade = [];
  }
  if (s.role === "craftsman")
    for (const i of order(s)) {
      const p = s.players[i],
        out = s.production[i];
      let coins = 0;
      if (active(p, "factory"))
        coins += [0, 0, 1, 2, 3, 5][GOODS.filter((g) => out[g] > 0).length];
      if (active(p, "distillery"))
        coins += Math.max(
          0,
          ...GOODS.filter((g) => g !== "corn").map((g) => out[g] - 1),
        );
      p.coins += coins;
      if (coins) event(s, "income", i, { coins });
    }
  if (s.role === "captain") {
    for (const sh of s.ships)
      if (sh.amount === sh.capacity) {
        s.supply[sh.good] += sh.amount;
        sh.good = null;
        sh.amount = 0;
      }
    for (const g of GOODS) s.supply[g] += s.privateCargo[g];
    s.privateCargo = counts();
  }
  if (s.choices >= (s.players.length === 2 ? 6 : s.players.length)) {
    if (s.captured) {
      const { id, p } = s.captured;
      startRole(s, id, p, true);
    } else finishRound(s);
  } else s.tasks = [{ kind: "role", p: s.chooser }];
}
function addEstate(s, p, id, forest = false) {
  const a = s.players[p];
  assert(a.estates.length < 12);
  const t = { id: forest ? "forest" : id, w: 0, c: 0 };
  if (forest) t.source = id;
  a.estates.push(t);
  s.planted[p].push(a.estates.length - 1);
  event(s, "estate", p, { id: t.id });
  checkFestival(s, p, { type: "estates" });
}
function matched(values, have, amount = 1, amounts = null) {
  const need = {};
  for (let i = 0; i < values.length; i++)
    need[values[i]] = (need[values[i]] ?? 0) + (amounts?.[i] ?? amount);
  return Object.entries(need).every(([k, v]) => (have[k] ?? 0) >= v);
}
function checkFestival(s, p, e) {
  const a = s.players[p],
    est = {};
  for (const t of a.estates) est[t.id] = (est[t.id] ?? 0) + 1;
  for (const f of s.festivals) {
    if (f.claimed !== undefined) continue;
    const t = f.targets;
    let ok = false;
    if (f.goal === "estates") ok = matched(t.estates, est, f.amount);
    if (f.goal === "build") ok = e.type === "build" && e.id === t.building;
    if (f.goal === "produce")
      ok = e.type === "produce" && matched(t.goods, s.production[p], f.amount);
    if (f.goal === "farmProduce")
      ok =
        e.type === "produce" &&
        matched(t.goods, s.production[p]) &&
        matched(t.estates, est);
    if (f.goal === "tradeFull")
      ok = e.type === "trade" && s.trade.length === 4 && t.goods[0] === e.good;
    if (f.goal === "ship")
      ok = e.type === "ship" && matched(t.goods, s.shipped[p], 1, f.amounts);
    if (f.goal === "dispatchBig" || f.goal === "dispatchSmall")
      ok =
        e.type === "ship" &&
        e.full &&
        t.goods[0] === e.good &&
        e.capacity ===
          (f.goal === "dispatchBig"
            ? Math.max(...s.ships.map((x) => x.capacity))
            : Math.min(...s.ships.map((x) => x.capacity)));
    if (!ok) continue;
    f.claimed = p;
    for (const g of t.goods) s.supply[g]++;
    s.bag.push(...t.estates);
    if (t.building && f.buildingReserved) s.market[t.building]++;
    a.coins += f.reward.coins ?? 0;
    vp(s, p, f.reward.vp ?? 0);
    let nw = 0;
    for (let k = 0; k < (f.reward.workers ?? 0); k++)
      if (gainPerson(s, p)) nw++;
    if (nw) {
      if (a.puertoma) allocatePuertoma(s, p);
      else s.tasks.unshift({ kind: "bonusAssign", p, remaining: nw });
    }
    event(s, "festival", p, { id: f.id, reward: { ...f.reward, workers: nw } });
  }
}
export function shipping(s, p) {
  const a = s.players[p],
    out = [];
  for (const g of GOODS) {
    if (!a.goods[g]) continue;
    const match = s.ships.findIndex((x) => x.good === g);
    const empty = s.ships
      .map((sh, i) => ({ ...sh, i }))
      .filter((sh) => !sh.good);
    const max = Math.max(
      0,
      ...empty.map((sh) => Math.min(a.goods[g], sh.capacity)),
    );
    const choices =
      match >= 0
        ? [match]
        : empty
            .filter((sh) => Math.min(a.goods[g], sh.capacity) === max)
            .map((sh) => sh.i);
    for (const ship of choices)
      if (s.ships[ship].amount < s.ships[ship].capacity)
        out.push({ type: "ship", ship, good: g });
  }
  if (active(a, "wharf") && !s.usedWharves.includes(`${p}:wharf`))
    for (const good of GOODS.filter((g) => a.goods[g]))
      out.push({ type: "ship", ship: "wharf", good });
  if (
    active(a, "smallWharf") &&
    !s.usedWharves.includes(`${p}:smallWharf`) &&
    sum(Object.values(a.goods))
  )
    out.push({ type: "smallWharf", goods: clone(a.goods) });
  return out;
}
function phaseLegal(s, t) {
  const p = t.p,
    a = s.players[p];
  if (a.puertoma) return [P.choice(s, t, puertomaAPI)];
  const pass = { type: "pass" };
  switch (t.kind) {
    case "achievementChoose":
    case "achievementDraft":
      return a.achievementOffer.map((id) => ({ type: t.kind, id }));
    case "role":
      return s.roles
        .filter(
          (r) => r.taken === null && (r.id !== "smuggler" || s.smuggler !== p),
        )
        .map((r) => ({ type: "role", id: r.id }));
    case "draft":
      return marketChoices(s).map((b) => ({ type: "draft", id: b.id }));
    case "plant":
      return [
        ...(a.estates.length < 12
          ? [...new Set(s.offer)].flatMap((id) => [
              { type: "plant", id },
              ...(active(a, "lumberyard")
                ? [{ type: "plant", id, forest: true }]
                : []),
            ])
          : []),
        ...(a.estates.length < 12 &&
        s.quarries > 0 &&
        ((p === s.owner && !t.second) || active(a, "buildersYard"))
          ? [{ type: "plant", id: "quarry" }]
          : []),
        pass,
      ];
    case "hacienda":
      return [
        ...(a.estates.length < 12 && (s.bag.length || s.discard.length)
          ? [{ type: "hacienda" }]
          : []),
        pass,
      ];
    case "forest":
      return [
        { type: "forest", forest: false },
        { type: "forest", forest: true },
      ];
    case "hospital":
      return [
        ...(s.workerSupply + s.register.w > 0
          ? s.planted[p]
              .filter(
                (i) => a.estates[i].id !== "forest" && !total(a.estates[i]),
              )
              .map((i) => ({ type: "hospital", target: `e${i}` }))
          : []),
        ...(s.planted[p].length &&
        !s.planted[p].some((i) => a.estates[i].id !== "forest") &&
        s.workerSupply + s.register.w > 0
          ? [{ type: "hospital", target: "reserve" }]
          : []),
        pass,
      ];
    case "school":
      return [
        ...(s.workerSupply + s.register.w > 0 &&
        total(a.buildings[t.building]) < B[a.buildings[t.building].id].workers
          ? [{ type: "school" }]
          : []),
        pass,
      ];
    case "park":
      return [
        ...(!citizen(a, "parkAuthority")
          ? a.estates.flatMap((e, i) =>
              e.id !== "quarry" ? [{ type: "park", estate: i }] : [],
            )
          : s.players.every(
                (other, i) =>
                  i === p || other.estates.length > a.estates.length,
              )
            ? [{ type: "parkReward" }]
            : []),
        pass,
      ];
    case "assembly":
      return [{ type: "assembly" }, pass];
    case "recruitBonus":
      return [...(s.workerSupply > 0 ? [{ type: "recruitBonus" }] : []), pass];
    case "villa":
      return [
        ...(s.citizenSupply + s.workerSupply > 0 ? [{ type: "villa" }] : []),
        pass,
      ];
    case "recruit":
      return ["w", "c"]
        .filter((kind) => s.register[kind] > 0)
        .map((kind) => ({ type: "recruit", kind }));
    case "assign":
      return [{ type: "assign", ...autoAssignment(s, p) }];
    case "bonusAssign":
      return [
        ...destinations(a).map((target) => ({ type: "bonusAssign", target })),
        pass,
      ];
    case "build":
      return [...buildOptions(s, p), pass];
    case "produce":
      return [
        {
          type: "produce",
          goods: Object.fromEntries(
            GOODS.map((g) => [g, Math.min(production(a)[g], s.supply[g])]),
          ),
        },
        pass,
      ];
    case "produceBonus":
      return [
        ...GOODS.filter((g) => s.production[p][g] > 0 && s.supply[g] > 0).map(
          (good) => ({ type: "produceBonus", good }),
        ),
        pass,
      ];
    case "trade": {
      const moves = [];
      if (!t.acted)
        for (const good of GOODS.filter((g) => a.goods[g])) {
          if (
            s.trade.length < 4 &&
            (!s.trade.includes(good) || active(a, "office"))
          )
            moves.push({ type: "trade", good });
          if (active(a, "merchantOutpost"))
            moves.push({ type: "trade", good, outpost: true });
        }
      if (!t.zoneUsed && active(a, "zoningOffice")) {
        if (citizen(a, "zoningOffice"))
          moves.push(
            ...a.estates.flatMap((e, estate) =>
              GOODS.includes(e.id) ? [{ type: "zoneSell", estate }] : [],
            ),
          );
        else if (
          a.coins &&
          a.estates.length < 12 &&
          (s.bag.length || s.discard.length)
        )
          moves.push({ type: "zoneBuy" });
      }
      return [...moves, pass];
    }
    case "pension":
      return [
        ...(t.remaining
          ? GOODS.filter((g) => a.goods[g] && !t.used.includes(g)).map(
              (good) => ({ type: "pension", good }),
            )
          : []),
        pass,
      ];
    case "ship":
      return [
        ...shipping(s, p),
        ...(!shipping(s, p).some((m) => Number.isInteger(m.ship))
          ? [pass]
          : []),
      ];
    case "store":
      return [{ type: "store", ...autoStorage(s, p) }];
    case "smuggle": {
      const out = s.ships.flatMap((sh, ship) =>
        sh.amount
          ? [{ type: "raid", ship, amount: Math.min(3, sh.amount) }]
          : [],
      );
      if (s.trade.length) out.push({ type: "plunder" });
      if (total(s.register) > s.players.length) out.push({ type: "poach" });
      out.push(
        ...s.roles
          .filter((r) => !s.puertoma && r.taken === null && r.id !== "smuggler")
          .map((r) => ({ type: "capture", id: r.id })),
      );
      return [...out, pass];
    }
    case "poach":
      return [
        ...["w", "c"]
          .filter((kind) => s.register[kind] > 0)
          .flatMap((kind) =>
            destinations(a).map((target) => ({
              type: "poachWorker",
              kind,
              target,
            })),
          ),
        pass,
      ];
    case "poachDiscard":
      return ["w", "c"]
        .filter((kind) => s.register[kind] > 0)
        .map((kind) => ({ type: "discardWorker", kind }));
    default:
      return [];
  }
}
function destinations(a) {
  return [
    ...a.estates.flatMap((t, i) =>
      t.id !== "forest" && !total(t) ? [`e${i}`] : [],
    ),
    ...a.buildings.flatMap((t, i) =>
      total(t) < B[t.id].workers ? [`b${i}`] : [],
    ),
  ];
}
function optionalPoints(s, p, m) {
  const a = s.players[p],
    out = [];
  if (m.type === "build" && active(a, "church") && B[m.id].vp >= 2)
    out.push("church");
  if (["ship", "smallWharf"].includes(m.type)) {
    if (active(a, "harbor")) out.push("harbor");
    if (p === s.owner && !s.captainBonus && active(a, "publishingHouse"))
      out.push("publishingHouse");
  }
  if (
    s.tasks[0]?.kind === "produce" &&
    ["produce", "pass"].includes(m.type) &&
    citizen(a, "chapel")
  )
    out.push("chapel");
  return out;
}
export function legal(s, p = currentPlayer(s)) {
  if (s.finished || !s.tasks.length || !s.players[p]) return [];
  const t = s.tasks[0],
    a = s.players[p],
    moves =
      t.p === p
        ? phaseLegal(s, t).flatMap((m) => {
            const bonuses = optionalPoints(s, p, m),
              variants = [m];
            for (let bits = 1; bits < 1 << bonuses.length; bits++)
              variants.push({
                ...m,
                decline: bonuses.filter((_, i) => bits & (1 << i)),
              });
            return variants;
          })
        : [];
  if ((t.kind !== "assign" || t.p !== p) && active(a, "bohio")) {
    const from = building(a, "bohio");
    for (const kind of ["w", "c"])
      if (from[kind])
        for (const target of destinations(a))
          if (tileRef(a, target) !== from)
            moves.push({ type: "bohio", kind, target });
  }
  return moves;
}
// Advice is computed before secrets are stripped, using the same action checks
// as play. It never simulates a move, draws a tile, or changes the position.
export function roleWarnings(s, p) {
  if (s.finished || s.tasks[0]?.kind !== "role" || s.tasks[0].p !== p)
    return {};
  const warnings = {};
  for (const choice of phaseLegal(s, s.tasks[0])) {
    const id = choice.id,
      role = s.roles.find((r) => r.id === id);
    const a = { ...s.players[p], coins: s.players[p].coins + role.coins };
    const preview = {
      ...s,
      role: id,
      owner: p,
      usedWharves: [],
      players: s.players.map((other, i) => (i === p ? a : other)),
    };
    const can = (kind) =>
      phaseLegal(preview, { kind, p, acted: false, zoneUsed: false }).some(
        (m) => m.type !== "pass",
      );
    let reason;
    const bonuses = [];
    if (id === "craftsman") {
      const potential = production(a);
      if (!GOODS.some((g) => potential[g] > 0 && s.supply[g] > 0)) {
        reason = GOODS.some((g) => potential[g] > 0)
          ? "warnProductionSupply"
          : "warnProductionSetup";
        if (active(a, "chapel"))
          bonuses.push({
            building: "chapel",
            [citizen(a, "chapel") ? "vp" : "coins"]: 1,
          });
        if (active(a, "tailorShop") && citizens(a))
          bonuses.push({
            building: "tailorShop",
            coins: Math.min(citizens(a), s.options.tailorLimit ? 3 : Infinity),
          });
      }
    } else if (id === "builder" && !buildOptions(preview, p).length) {
      const funded = {
        ...preview,
        players: preview.players.map((other, i) =>
          i === p ? { ...a, coins: Number.MAX_SAFE_INTEGER } : other,
        ),
      };
      reason = buildOptions(funded, p).length
        ? "warnBuildMoney"
        : "warnBuildSpace";
    } else if (id === "trader" && !can("trade")) {
      reason = !GOODS.some((g) => a.goods[g])
        ? "warnTradeGoods"
        : s.trade.length >= 4
          ? "warnTradeFull"
          : "warnTradeTypes";
    } else if (id === "captain" && !shipping(preview, p).length) {
      // These buildings offer genuine actions before loading, so don't warn
      // that the role has no available action when one of them can be used.
      const bonusAction =
        (active(a, "assemblyHall") && GOODS.some((g) => a.goods[g] >= 2)) ||
        (active(a, "pensionOffice") &&
          citizens(a) &&
          GOODS.some((g) => a.goods[g]));
      if (!bonusAction) {
        reason = GOODS.some((g) => a.goods[g])
          ? "warnShipSpace"
          : "warnShipGoods";
        if (active(a, "lighthouse"))
          bonuses.push({ building: "lighthouse", coins: 1 });
      }
    } else if (
      id === "planter" &&
      !can("plant") &&
      !(active(a, "hacienda") && can("hacienda")) &&
      !(active(a, "parkAuthority") && can("park"))
    ) {
      reason = a.estates.length >= 12 ? "warnPlantSpace" : "warnPlantSupply";
    } else if (
      id === "recruiter" &&
      !total(s.register) &&
      !s.workerSupply &&
      !(active(a, "villa") && s.citizenSupply) &&
      !(people(a) && spaces(a))
    ) {
      reason = "warnRecruitSupply";
    } else if (id === "smuggler" && !can("smuggle")) {
      reason = "warnSmugglerTargets";
    }
    if (reason) warnings[id] = { reason, coins: role.coins, bonuses };
  }
  return warnings;
}
function settle(s) {
  for (let guard = 0; guard < 200; guard++) {
    if (s.finished || !s.tasks.length) return;
    const t = s.tasks[0],
      a = s.players[t.p];
    if (t.kind === "bonusAssign" && a.puertoma) {
      allocatePuertoma(s, t.p);
      s.tasks.shift();
      continue;
    }
    if (t.kind === "phaseEnd") {
      s.tasks.shift();
      finishPhase(s);
      continue;
    }
    if (t.kind === "recruit" && !total(s.register)) {
      s.tasks.shift();
      continue;
    }
    if (t.kind === "captainStart") {
      s.tasks.shift();
      if (t.p === s.owner && active(a, "lighthouse")) a.coins++;
      if (active(a, "pensionOffice") && citizens(a))
        s.tasks.unshift({
          kind: "pension",
          p: t.p,
          remaining: citizens(a),
          used: [],
        });
      if (active(a, "assemblyHall") && GOODS.some((g) => a.goods[g] >= 2))
        s.tasks.unshift({ kind: "assembly", p: t.p });
      continue;
    }
    if (
      [
        "hacienda",
        "hospital",
        "school",
        "park",
        "villa",
        "recruitBonus",
        "produceBonus",
        "pension",
      ].includes(t.kind)
    ) {
      const choices = legal(s, t.p);
      if (choices.length === 1 && choices[0].type === "pass") {
        s.tasks.shift();
        continue;
      }
    }
    if (
      t.kind === "bonusAssign" &&
      (!t.remaining || !a.reserve.w || !freeSpaces(a))
    ) {
      s.tasks.shift();
      continue;
    }
    if (t.kind === "poach" && (!t.remaining || !freeSpaces(a))) {
      endPoach(s, t);
      continue;
    }
    if (t.kind === "poachDiscard" && total(s.register) <= s.players.length) {
      s.tasks.shift();
      continue;
    }
    return;
  }
  throw Error("Phase transition loop");
}
function endPoach(s, t) {
  // The smuggler chooses which citizens/workers remain available to the next Recruiter.
  s.tasks[0] = { kind: "poachDiscard", p: t.p };
}
export function autoAssignment(s, p) {
  if (s.players[p].puertoma) return P.allocation(s, p);
  const a = s.players[p],
    estates = a.estates.map(() => ({ w: 0, c: 0 })),
    buildings = a.buildings.map(() => ({ w: 0, c: 0 }));
  let c = citizens(a),
    w = people(a) - c;
  const put = (slot, preferC = false) => {
    const k = preferC && c ? "c" : w ? "w" : c ? "c" : null;
    if (k) {
      slot[k]++;
      if (k === "w") w--;
      else c--;
    }
    return !!k;
  };
  for (const id of [
    "villa",
    "chapel",
    "notary",
    "publishingHouse",
    "school",
    "hospital",
    "factory",
    "harbor",
    "wharf",
    "smallWarehouse",
    "largeWarehouse",
  ]) {
    const i = a.buildings.findIndex((t) => t.id === id);
    if (i >= 0) put(buildings[i], ["chapel", "notary"].includes(id));
  }
  for (const g of GOODS) {
    const farms = a.estates
      .map((t, i) => ({ t, i }))
      .filter((x) => x.t.id === g);
    for (const { i } of farms) {
      if (g === "corn") {
        put(estates[i]);
        continue;
      }
      const bi = a.buildings.findIndex(
        (t, j) => B[t.id].good === g && total(buildings[j]) < B[t.id].workers,
      );
      if (bi >= 0 && w + c >= 2) {
        put(estates[i]);
        put(buildings[bi]);
      }
    }
  }
  for (let i = 0; i < a.buildings.length; i++)
    while (total(buildings[i]) < B[a.buildings[i].id].workers && w + c)
      put(buildings[i]);
  for (let i = 0; i < a.estates.length; i++)
    if (a.estates[i].id !== "forest" && !total(estates[i])) put(estates[i]);
  return { estates, buildings };
}
export function autoStorage(s, p) {
  if (s.players[p].puertoma) return P.storage(s.players[p]);
  const a = s.players[p],
    slots =
      (active(a, "smallWarehouse") ? 1 : 0) +
      (active(a, "largeWarehouse") ? 2 : 0);
  const types = GOODS.filter((g) => a.goods[g])
    .sort(
      (g, h) => a.goods[h] - a.goods[g] || GOODS.indexOf(h) - GOODS.indexOf(g),
    )
    .slice(0, slots);
  const keep = counts();
  for (const g of types) keep[g] = a.goods[g];
  let remaining = 1 + (active(a, "storehouse") ? 3 : 0);
  for (const g of [...GOODS].reverse())
    if (!types.includes(g)) {
      keep[g] = Math.min(remaining, a.goods[g]);
      remaining -= keep[g];
    }
  return { types, goods: keep };
}
function validateVector(vector, limit) {
  assert(vector && typeof vector === "object" && !Array.isArray(vector));
  for (const g of GOODS)
    assert(
      integer(vector[g]) && vector[g] <= limit[g],
      `Invalid ${g} quantity`,
    );
  assert(Object.keys(vector).every((g) => GOODS.includes(g)));
}
function sameMove(a, b) {
  const normalize = (x) =>
    x && typeof x === "object"
      ? Object.fromEntries(
          Object.entries(x)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, normalize(v)]),
        )
      : x;
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
export function move(state, m, p) {
  assert(m && typeof m === "object" && !Array.isArray(m));
  assert(
    !state.finished &&
      (state.tasks[0]?.p === p || canMoveOutOfTurn(state, m, p)),
    "It is not your turn",
  );
  const s = clone(state),
    t = s.tasks[0],
    a = s.players[p],
    extra = { phase: t.kind, beforeCoins: s.players[p].coins };
  if (a.puertoma) {
    assert(sameMove(P.choice(s, t, puertomaAPI), m));
    for (let i = 0; i < (m.puertomaDraws ?? 0); i++) drawPuertoma(s);
    applyPuertoma(s, t, m);
    s.history.push({ p, move: clone(m) });
    checkAchievements(s, p, { ...m });
    settle(s);
    checkAllAchievements(s);
    return s;
  }
  const custom = {
    assign: "assign",
    produce: "produce",
    store: "store",
    smallWharf: "ship",
    raid: "smuggle",
  };
  if (custom[m.type]) {
    assert(t.kind === custom[m.type]);
    if (m.decline !== undefined)
      assert(
        Array.isArray(m.decline) &&
          new Set(m.decline).size === m.decline.length &&
          m.decline.every((id) => optionalPoints(s, p, m).includes(id)),
      );
  } else assert(legal(s, p).some((x) => sameMove(x, m)));
  if (m.target)
    extra.targetId =
      m.target === "reserve" ? "reserve" : tileRef(a, m.target).id;
  if (Number.isInteger(m.estate)) extra.estateId = a.estates[m.estate]?.id;
  const declined = (id) => m.decline?.includes(id);
  if (t.kind === "produce" && ["produce", "pass"].includes(m.type)) {
    if (active(a, "chapel")) {
      if (citizen(a, "chapel")) {
        if (!declined("chapel")) {
          vp(s, p, 1);
          extra.vp = 1;
        }
      } else {
        a.coins++;
        extra.coins = 1;
      }
    }
    if (active(a, "tailorShop")) {
      const coins = Math.min(citizens(a), s.options.tailorLimit ? 3 : Infinity);
      a.coins += coins;
      extra.coins = (extra.coins ?? 0) + coins;
    }
  }
  const next = () => s.tasks.shift();
  switch (m.type) {
    case "achievementChoose":
    case "achievementDraft":
      selectAchievement(s, t, m);
      break;
    case "role":
      startRole(s, m.id, p);
      break;
    case "draft":
      s.market[m.id] = s.players.length === 2 ? 1 : B[m.id].copies;
      next();
      if (marketChoices(s).length)
        s.tasks.unshift({ kind: "draft", p: (p + 1) % s.players.length });
      else {
        finishPuertomaSetup(s);
        setupFestival(s);
        refillEstates(s);
        s.tasks = [{ kind: "role", p: s.governor }];
      }
      break;
    case "plant": {
      if (m.id === "quarry") s.quarries--;
      else s.offer.splice(s.offer.indexOf(m.id), 1);
      next();
      addEstate(s, p, m.id, m.forest);
      break;
    }
    case "hacienda":
    case "zoneBuy": {
      if (m.type === "hacienda") next();
      else {
        a.coins--;
        extra.coins = -1;
        t.zoneUsed = true;
      }
      const id = drawEstate(s);
      if (active(a, "lumberyard")) s.tasks.unshift({ kind: "forest", p, id });
      else addEstate(s, p, id);
      break;
    }
    case "forest":
      next();
      addEstate(s, p, t.id, m.forest);
      break;
    case "hospital": {
      assert(gainPerson(s, p, "w", true));
      if (m.target !== "reserve") {
        a.reserve.w--;
        tileRef(a, m.target).w++;
      }
      next();
      break;
    }
    case "school":
      assert(gainPerson(s, p, "w", true));
      a.reserve.w--;
      a.buildings[t.building].w++;
      extra.targetId = a.buildings[t.building].id;
      next();
      break;
    case "park":
    case "zoneSell": {
      const [e] = a.estates.splice(m.estate, 1);
      a.reserve.w += e.w;
      a.reserve.c += e.c;
      s.discard.push(e.source ?? e.id);
      if (m.type === "park") next();
      else {
        a.coins++;
        extra.coins = 1;
        t.zoneUsed = true;
      }
      break;
    }
    case "villa":
      extra.kind = s.citizenSupply ? "c" : "w";
      assert(gainPerson(s, p, s.citizenSupply ? "c" : "w"));
      next();
      break;
    case "recruitBonus":
      assert(gainPerson(s, p));
      if (--t.remaining === 0) next();
      break;
    case "recruit":
      s.register[m.kind]--;
      a.reserve[m.kind]++;
      t.p = (p + 1) % s.players.length;
      break;
    case "assign": {
      assert(
        Array.isArray(m.estates) &&
          m.estates.length === a.estates.length &&
          Array.isArray(m.buildings) &&
          m.buildings.length === a.buildings.length,
        "Allocate all worker slots",
      );
      let nw = 0,
        nc = 0;
      for (const [key, slots] of [
        ["estates", m.estates],
        ["buildings", m.buildings],
      ])
        for (let i = 0; i < slots.length; i++) {
          const x = slots[i];
          assert(x && integer(x.w) && integer(x.c));
          assert(
            total(x) <=
              (key === "estates"
                ? a[key][i].id === "forest"
                  ? 0
                  : 1
                : B[a[key][i].id].workers),
          );
          nw += x.w;
          nc += x.c;
        }
      const availableC = citizens(a),
        availableW = people(a) - availableC;
      assert(
        nw <= availableW &&
          nc <= availableC &&
          nw + nc === Math.min(spaces(a), availableC + availableW),
        "Fill available slots before keeping workers in reserve",
      );
      for (const key of ["estates", "buildings"])
        a[key].forEach((x, i) =>
          Object.assign(x, { w: m[key][i].w, c: m[key][i].c }),
        );
      a.reserve = { w: availableW - nw, c: availableC - nc };
      extra.allocation = [...a.estates, ...a.buildings]
        .filter((x) => x.w + x.c > 0)
        .map(({ id, w, c }) => ({ id, w, c }));
      extra.reserve = { ...a.reserve };
      next();
      break;
    }
    case "bonusAssign":
      a.reserve.w--;
      tileRef(a, m.target).w++;
      if (--t.remaining === 0) next();
      break;
    case "bohio":
      building(a, "bohio")[m.kind]--;
      tileRef(a, m.target)[m.kind]++;
      break;
    case "parkReward":
      vp(s, p, 2);
      extra.vp = 2;
      next();
      break;
    case "assembly":
      extra.vp = sum(GOODS.map((g) => Math.floor(a.goods[g] / 2)));
      vp(s, p, extra.vp);
      next();
      break;
    case "build": {
      const price = cost(s, p, m.id, m),
        paid = Math.min(price, a.coins),
        school = active(a, "school"),
        church = active(a, "church");
      a.coins -= paid;
      if (m.worker) {
        tileRef(a, m.worker.key)[m.worker.kind]--;
        s[m.worker.kind === "w" ? "workerSupply" : "citizenSupply"]++;
      }
      if (m.good) {
        a.goods[m.good]--;
        s.supply[m.good]++;
      }
      if (m.point) {
        a.vp--;
        s.vpSupply++;
      }
      s.market[m.id]--;
      const b = { id: m.id, w: 0, c: 0 };
      a.buildings.push(b);
      if (church && !declined("church")) {
        extra.vp = B[m.id].size === 2 ? 2 : B[m.id].vp >= 2 ? 1 : 0;
        vp(s, p, extra.vp);
      }
      if (citySize(a) === 12) s.endReason ??= "city";
      next();
      if (school)
        s.tasks.unshift({
          kind: "school",
          p,
          building: a.buildings.length - 1,
        });
      extra.coins = -paid;
      extra.paid = paid;
      updateReservations(s, m.id);
      checkFestival(s, p, { type: "build", id: m.id });
      break;
    }
    case "produce": {
      const max = Object.fromEntries(
        GOODS.map((g) => [g, Math.min(production(a)[g], s.supply[g])]),
      );
      validateVector(m.goods, max);
      for (const g of GOODS) {
        a.goods[g] += m.goods[g];
        s.supply[g] -= m.goods[g];
        s.production[p][g] += m.goods[g];
      }
      next();
      checkFestival(s, p, { type: "produce" });
      break;
    }
    case "produceBonus":
      a.goods[m.good]++;
      s.supply[m.good]--;
      s.production[p][m.good]++;
      if (--t.remaining === 0) next();
      checkFestival(s, p, { type: "produce" });
      break;
    case "trade": {
      a.goods[m.good]--;
      if (m.outpost) s.supply[m.good]++;
      else s.trade.push(m.good);
      const coins =
        GOODS.indexOf(m.good) +
        (s.owner === p ? (active(a, "publishingHouse") ? 2 : 1) : 0) +
        (m.outpost
          ? 0
          : (active(a, "smallMarket") ? 1 : 0) +
            (active(a, "largeMarket") ? 2 : 0));
      a.coins += coins;
      t.acted = true;
      extra.coins = coins;
      if (!m.outpost) checkFestival(s, p, { type: "trade", good: m.good });
      break;
    }
    case "pension":
      a.goods[m.good]--;
      s.supply[m.good]++;
      vp(s, p, 1);
      extra.vp = 1;
      t.used.push(m.good);
      if (--t.remaining === 0) next();
      break;
    case "ship":
    case "smallWharf": {
      const cargo = counts();
      let points = 0,
        full = false,
        capacity = null;
      if (m.type === "smallWharf") {
        assert(
          active(a, "smallWharf") && !s.usedWharves.includes(`${p}:smallWharf`),
        );
        validateVector(m.goods, a.goods);
        assert(sum(Object.values(m.goods)) > 0);
        Object.assign(cargo, m.goods);
        points = Math.floor(sum(Object.values(cargo)) / 2);
        s.usedWharves.push(`${p}:smallWharf`);
      } else if (m.ship === "wharf") {
        cargo[m.good] = a.goods[m.good];
        points = cargo[m.good];
        s.usedWharves.push(`${p}:wharf`);
      } else {
        const ship = s.ships[m.ship];
        cargo[m.good] = Math.min(a.goods[m.good], ship.capacity - ship.amount);
        ship.good = m.good;
        ship.amount += cargo[m.good];
        points = cargo[m.good];
        full = ship.amount === ship.capacity;
        capacity = ship.capacity;
        extra.shipCapacity = capacity;
        extra.shipLoad = ship.amount;
      }
      for (const g of GOODS) {
        a.goods[g] -= cargo[g];
        s.shipped[p][g] += cargo[g];
        if (!Number.isInteger(m.ship)) s.privateCargo[g] += cargo[g];
      }
      if (active(a, "harbor") && !declined("harbor")) points++;
      if (p === s.owner && !s.captainBonus) {
        s.captainBonus = true;
        points +=
          active(a, "publishingHouse") && !declined("publishingHouse") ? 2 : 1;
      }
      vp(s, p, points);
      if (active(a, "lighthouse")) {
        a.coins++;
        extra.coins = 1;
      }
      extra.goods = cargo;
      extra.vp = points;
      t.p = (p + 1) % s.players.length;
      s.shipPasses = 0;
      checkFestival(s, p, { type: "ship", good: m.good, capacity, full });
      break;
    }
    case "store": {
      assert(
        Array.isArray(m.types) &&
          new Set(m.types).size === m.types.length &&
          m.types.every((g) => GOODS.includes(g)),
      );
      const slots =
        (active(a, "smallWarehouse") ? 1 : 0) +
        (active(a, "largeWarehouse") ? 2 : 0);
      assert(m.types.length <= slots);
      validateVector(m.goods, a.goods);
      assert(
        sum(GOODS.filter((g) => !m.types.includes(g)).map((g) => m.goods[g])) <=
          1 + (active(a, "storehouse") ? 3 : 0),
      );
      extra.lost = counts();
      for (const g of GOODS) {
        extra.lost[g] = a.goods[g] - m.goods[g];
        s.supply[g] += extra.lost[g];
        a.goods[g] = m.goods[g];
      }
      next();
      break;
    }
    case "raid": {
      assert(Number.isInteger(m.ship) && s.ships[m.ship]);
      const ship = s.ships[m.ship];
      assert(
        integer(m.amount) &&
          m.amount <= Math.min(3, ship.amount) &&
          ship.amount > 0,
      );
      const good = ship.good;
      extra.good = good;
      extra.shipCapacity = ship.capacity;
      a.goods[good] += m.amount;
      s.supply[good] += ship.amount - m.amount;
      ship.good = null;
      ship.amount = 0;
      next();
      break;
    }
    case "plunder":
      extra.vp = s.trade.length;
      vp(s, p, extra.vp);
      for (const g of s.trade) s.supply[g]++;
      s.trade = [];
      next();
      break;
    case "poach":
      s.discardedPeople ??= { w: 0, c: 0 };
      s.tasks[0] = {
        kind: "poach",
        p,
        remaining: Math.min(3, total(s.register) - s.players.length),
      };
      break;
    case "poachWorker":
      s.register[m.kind]--;
      tileRef(a, m.target)[m.kind]++;
      t.remaining--;
      break;
    case "discardWorker":
      s.register[m.kind]--;
      s.discardedPeople[m.kind]++;
      break;
    case "capture":
      s.captured = { id: m.id, p };
      extra.coins = s.roles.find((r) => r.id === m.id).coins;
      a.coins += s.roles.find((r) => r.id === m.id).coins;
      s.roles.find((r) => r.id === m.id).coins = 0;
      next();
      break;
    case "pass":
      if (t.kind === "ship") {
        s.shipPasses++;
        if (s.shipPasses >= s.players.length) {
          next();
          beforePuertomaStorage(s);
          s.tasks.unshift(...order(s).map((p) => ({ kind: "store", p })));
        } else t.p = (p + 1) % s.players.length;
      } else if (t.kind === "poach") endPoach(s, t);
      else next();
      break;
    default:
      assert(false);
  }
  if (!["role", "plant"].includes(m.type))
    if (!["achievementChoose", "achievementDraft"].includes(m.type))
      event(s, m.type, p, { ...m, ...extra });
  s.history.push({ p, move: clone(m) });
  checkAchievements(s, p, { ...m, ...extra });
  settle(s);
  checkAllAchievements(s);
  return s;
}
export function currentPlayer(s) {
  return s.finished ? undefined : s.tasks[0]?.p;
}
export function canMoveOutOfTurn(s, m, p) {
  return m?.type === "bohio" && legal(s, p).some((x) => sameMove(x, m));
}
export function ended(s) {
  return s.finished;
}
export function scoreBreakdown(s, p) {
  const a = s.players[p],
    bonus = a.puertoma ? P.score(a) : {};
  if (s.expansions.includes("achievements"))
    bonus.achievements = s.puertoma
      ? a.puertoma
        ? A.incompletePoints(s)
        : 0
      : A.points(a);
  if (active(a, "fireStation"))
    bonus.fireStation = sum(
      a.buildings
        .filter((b) => B[b.id].good)
        .map((b) => (b.id.startsWith("small") ? 1 : 2)),
    );
  if (active(a, "residence"))
    bonus.residence = a.estates.length ? Math.max(4, a.estates.length - 5) : 0;
  if (active(a, "fortress")) bonus.fortress = Math.floor(people(a) / 3);
  if (active(a, "customsHouse")) bonus.customsHouse = Math.floor(a.vp / 4);
  if (active(a, "cityHall"))
    bonus.cityHall = a.buildings.filter((b) => !B[b.id].good).length;
  if (active(a, "cathedral")) {
    const ct = {};
    a.estates.forEach((e) => (ct[e.id] = (ct[e.id] ?? 0) + 1));
    const sets = sum(Object.values(ct).map((n) => Math.floor(n / 3)));
    bonus.cathedral = (sets * (sets + 1)) / 2;
  }
  if (active(a, "townSquare")) bonus.townSquare = citizens(a);
  const printed = sum(a.buildings.map((b) => B[b.id].vp)),
    c = citizens(a),
    token = a.vp;
  return {
    tokens: token,
    buildings: printed,
    citizens: c,
    bonus,
    total: token + printed + c + sum(Object.values(bonus)),
    tie: a.coins + sum(Object.values(a.goods)),
  };
}
export function scores(s) {
  return s.players.map((_, p) => scoreBreakdown(s, p).total);
}
export function rankings(s) {
  const values = s.players.map((_, p) => scoreBreakdown(s, p));
  return values.map(
    (v) =>
      1 +
      values.filter(
        (w) => w.total > v.total || (w.total === v.total && w.tie > v.tie),
      ).length,
  );
}
export function stripSecret(state, p) {
  const s = clone(state);
  delete s.random;
  delete s.config;
  delete s.history;
  s.bagCount = s.bag.length;
  delete s.bag;
  delete s.discard;
  if (s.puertoma) {
    delete s.puertoma.deck;
    delete s.puertoma.discard;
    for (const a of s.players)
      if (a.puertoma)
        a.puertoma.abilities = a.puertoma.abilities.map((x) =>
          s.finished || x.active ? x : { level: x.level, active: false },
        );
  }
  for (let i = 0; i < s.players.length; i++)
    if (i !== p && !s.finished) {
      s.players[i].vp = null;
      if (s.players[i].achievements)
        s.players[i].achievements = s.players[i].achievements.map((c) =>
          c.completed ? { id: c.id, completed: true } : { hidden: true },
        );
      if (s.players[i].achievementOffer)
        s.players[i].achievementOffer = s.players[i].achievementOffer.map(
          () => null,
        );
    }
  // Logs contain only public moves; historical earned points are public even though totals are concealed.
  s.legal = Number.isInteger(p) ? legal(state, p) : [];
  s.roleWarnings = Number.isInteger(p) ? roleWarnings(state, p) : {};
  s.historyLength = logLength(state);
  if (s.finished) s.results = s.players.map((_, i) => scoreBreakdown(state, i));
  return s;
}
export function logLength(s) {
  return s.history.length + 1;
}
export function replay(s, options = {}) {
  const to =
    typeof options === "number" ? options : (options.to ?? logLength(s));
  assert(integer(to) && to >= 1 && to <= logLength(s));
  const c = s.config;
  let r = init(c.n, c.expansions, c.options, c.seed);
  for (const h of s.history.slice(0, to - 1)) r = move(r, h.move, h.p);
  r.players.forEach((p, i) => {
    p.name = s.players[i].name;
    p.bot = s.players[i].bot;
  });
  return r;
}
export function logSlice(
  s,
  { player, start = 0, end = logLength(s) - 1 } = {},
) {
  const frames = [];
  if (start > Math.min(end, logLength(s) - 1)) return { frames };
  let position = replay(s, Math.max(1, start + 1));
  for (let i = Math.max(0, start); i <= Math.min(end, logLength(s) - 1); i++) {
    frames.push(stripSecret(position, player));
    const h = s.history[i];
    if (h && i < end) position = move(position, h.move, h.p);
  }
  return { frames };
}
export function setPlayerMetaData(s, p, data) {
  const n = clone(s);
  if (typeof data?.name === "string")
    n.players[p].name = data.name.slice(0, 80);
  return n;
}
export function dropPlayer(s, p) {
  const n = clone(s);
  n.players[p].bot = true;
  return n;
}
export function round(s) {
  return s.round;
}
export function canLaunchAnalysisMode(s) {
  return s.finished;
}
export function createAnalysis(s, { to }) {
  const n = replay(s, to);
  n.players.forEach((p) => (p.bot = false));
  return n;
}

export function chooseAI(s, p = currentPlayer(s)) {
  const list = legal(s, p),
    a = s.players[p];
  if (!list.length) return null;
  const rate = (m) => {
    if (m.type === "pass") return -100;
    if (m.type === "bohio") return -90;
    if (m.type === "role") {
      const coin = s.roles.find((r) => r.id === m.id).coins;
      let n = 0;
      if (m.id === "builder")
        n = buildOptions({ ...s, owner: p, role: "builder" }, p).length ? 4 : 0;
      if (m.id === "planter")
        n = a.estates.length < 5 ? 5 : a.estates.length < 10 ? 2 : 0;
      if (m.id === "recruiter") n = freeSpaces(a) > 1 ? 6 : 1;
      if (m.id === "craftsman")
        n =
          sum(Object.values(production(a))) && !sum(Object.values(a.goods))
            ? 7
            : 1;
      if (m.id === "trader")
        n = GOODS.some(
          (g) => a.goods[g] && s.trade.length < 4 && !s.trade.includes(g),
        )
          ? 6
          : 0;
      if (m.id === "captain") n = sum(Object.values(a.goods)) >= 3 ? 8 : 0;
      if (m.id.startsWith("adventurer")) n = 2;
      if (m.id === "smuggler") n = 3;
      return n + coin * 1.8;
    }
    if (m.type === "plant") {
      if (m.forest) return 1;
      const ct = a.estates.filter((e) => e.id === m.id).length;
      if (m.id === "quarry") return ct < 2 ? 8 : 1;
      const capacity = sum(
        a.buildings
          .filter((b) => B[b.id].good === m.id)
          .map((b) => B[b.id].workers),
      );
      return (m.id === "corn" ? 5 : capacity > ct ? 9 : 3) - ct;
    }
    if (m.type === "build") {
      const b = B[m.id];
      const farms = a.estates.filter((e) => e.id === b.good).length;
      const capacity = sum(
        a.buildings
          .filter((x) => B[x.id].good === b.good)
          .map((x) => B[x.id].workers),
      );
      if (b.good && farms > capacity) return 20 + (farms - capacity) * 2;
      if (b.size === 2) return s.round > 6 ? 15 : 2;
      const weight = {
        smallMarket: 8,
        hospital: 12,
        school: 10,
        factory: 9,
        harbor: 10,
        wharf: 10,
        smallWarehouse: 6,
        buildersYard: 5,
        hacienda: 5,
        villa: 12,
        publishingHouse: 10,
        canal: 6,
        chapel: 8,
      };
      return (weight[m.id] ?? 4) - cost(s, p, m.id) * 0.2;
    }
    if (m.type === "trade")
      return GOODS.indexOf(m.good) * 2 + (m.outpost ? -1 : 1);
    if (m.type === "ship")
      return m.ship === "wharf"
        ? a.goods[m.good] - 0.1
        : Math.min(
            a.goods[m.good],
            s.ships[m.ship].capacity - s.ships[m.ship].amount,
          );
    if (m.type === "smallWharf") return sum(Object.values(a.goods)) / 2;
    if (m.type === "recruit") return m.kind === "c" ? 2 : 1;
    if (m.type === "zoneSell" || m.type === "park") return -101;
    if (m.type === "draft") return B[m.id].expansion === "base" ? 1 : 2;
    if (m.type === "forest") return m.forest ? -1 : 1;
    return 1;
  };
  return [...list].sort((x, y) => rate(y) - rate(x))[0];
}
export function moveAI(s, p = currentPlayer(s)) {
  return move(s, chooseAI(s, p), p);
}

function drawPuertoma(s) {
  if (!s.puertoma.deck.length) {
    s.puertoma.deck = shuffle(s, s.puertoma.discard);
    s.puertoma.discard = [];
  }
  const card = s.puertoma.deck.pop();
  s.puertoma.discard.push(card);
  s.puertoma.lastCard = card;
  return card;
}
const puertomaAPI = { draw: drawPuertoma, marketChoices, shipping };
function setupPuertoma(s, config) {
  assert(
    config && typeof config === "object",
    "Puertoma configuration requires a human count and difficulty",
  );
  const humans = config.humans ?? 1,
    difficulty = config.difficulty ?? "normal";
  assert(
    integer(humans) &&
      humans >= 1 &&
      s.players.length - humans >= 1 &&
      s.players.length - humans <= 2,
    "Use one or two Puertomas after the human seats",
  );
  assert(
    ["easy", "normal", "hard"].includes(difficulty),
    "Unsupported Puertoma difficulty",
  );
  s.puertoma = {
    humans,
    difficulty,
    tracker: "builder",
    deck: shuffle(s, [1, 2, 3, 4, 5, 6, 7, 8]),
    discard: [],
    lastCard: null,
    setup: false,
  };
  for (let p = humans; p < s.players.length; p++) {
    s.players[p].bot = true;
    s.players[p].puertoma = {
      unused: { w: 0, c: 0 },
      reserved: null,
      abilities: [1, 2, 3, 4].map((level) => ({
        level,
        id: P.ABILITIES[level][Math.floor(rng(s) * 3)],
        active: difficulty === "hard" && level === 1,
      })),
      recruited: 0,
    };
  }
}
function finishPuertomaSetup(s) {
  if (!s.puertoma || s.puertoma.setup) return;
  s.puertoma.setup = true;
  if (s.puertoma.difficulty !== "hard") return;
  for (let p = s.puertoma.humans; p < s.players.length; p++) {
    const a = s.players[p],
      n = p - s.puertoma.humans;
    const choices = Object.keys(s.market).filter(
      (id) => s.market[id] && !B[id].good && P.level(id) === (n === 0 ? 1 : 2),
    );
    assert(choices.length, "No commercial building for Hard Puertoma setup");
    choices.sort(P.buildingOrder);
    const id = choices[(drawPuertoma(s) - 1) % choices.length];
    s.market[id]--;
    a.buildings.push({ id, w: 0, c: 0, level: P.level(id) });
    reserveExpanded(s, p);
    if (n === 0) {
      gainPerson(s, p);
      allocatePuertoma(s, p);
    } else a.coins = 1;
    const good = n === 0 ? "corn" : "sugar";
    if (s.supply[good]) {
      s.supply[good]--;
      a.goods[good]++;
    }
  }
}
function allocatePuertoma(s, p) {
  const a = s.players[p],
    assigned = P.allocation(s, p, () => drawPuertoma(s));
  a.estates.forEach((t, i) => Object.assign(t, assigned.estates[i]));
  a.puertoma.unused.w += assigned.unused.w;
  a.puertoma.unused.c += assigned.unused.c;
  a.reserve = { w: 0, c: 0 };
}
function reserveExpanded(s, p) {
  const a = s.players[p];
  const taken = s.players
    .filter((x) => x.puertoma)
    .map((x) => x.puertoma.reserved);
  const choices = Object.keys(s.market).filter(
    (id) =>
      s.market[id] &&
      B[id].size === 2 &&
      !taken.includes(id) &&
      !a.buildings.some((b) => b.id === id),
  );
  choices.sort(P.buildingOrder);
  a.puertoma.reserved = choices.length
    ? choices[(drawPuertoma(s) - 1) % choices.length]
    : null;
}
function updateReservations(s, id) {
  if (!s.puertoma) return;
  for (let p = s.puertoma.humans; p < s.players.length; p++)
    if (s.players[p].puertoma.reserved === id) {
      s.players[p].puertoma.reserved = null;
      reserveExpanded(s, p);
    }
}
function trackPuertoma(s, role) {
  if (P.ADJACENCY[s.puertoma.tracker]?.includes(role))
    s.puertoma.tracker = role;
}
function gainPuertomaWorker(s, p) {
  if (gainPerson(s, p)) {
    s.players[p].puertoma.recruited++;
    return true;
  }
  return false;
}
function beforePuertomaStorage(s) {
  if (!s.puertoma) return;
  for (let p = s.puertoma.humans; p < s.players.length; p++) {
    const a = s.players[p];
    if (P.ability(a, "goodsPoints")) {
      const points = GOODS.filter((g) => a.goods[g]).length;
      vp(s, p, points);
      if (points)
        event(s, "puertomaBonus", p, { id: "goodsPoints", vp: points });
    }
    if (P.ability(a, "discardPoints")) {
      const good = GOODS.find((g) => a.goods[g]);
      if (good) {
        const n = Math.min(2, a.goods[good]);
        a.goods[good] -= n;
        s.supply[good] += n;
        vp(s, p, n);
        event(s, "puertomaBonus", p, {
          id: "discardPoints",
          vp: n,
          goods: { [good]: -n },
        });
      }
    }
  }
}
function finishPuertomaPhase(s) {
  if (!s.puertoma) return;
  for (let p = s.puertoma.humans; p < s.players.length; p++) {
    const a = s.players[p];
    if (s.role === "craftsman") {
      if (P.ability(a, "produceCrate")) {
        const good = [...GOODS]
          .reverse()
          .find((g) => s.production[p][g] && s.supply[g]);
        if (good) {
          s.supply[good]--;
          a.goods[good]++;
          s.production[p][good]++;
          event(s, "puertomaBonus", p, {
            id: "produceCrate",
            goods: { [good]: 1 },
          });
          checkFestival(s, p, { type: "produce" });
        }
      }
      if (P.ability(a, "produceCoins")) {
        const coins = GOODS.filter((g) => s.production[p][g]).length;
        a.coins += coins;
        if (coins) event(s, "puertomaBonus", p, { id: "produceCoins", coins });
      }
    }
    if (s.role === "recruiter") {
      if (P.ability(a, "recruitWorker")) {
        if (gainPuertomaWorker(s, p))
          event(s, "puertomaBonus", p, { id: "recruitWorker", workers: 1 });
        allocatePuertoma(s, p);
      }
      if (P.ability(a, "recruitCoins")) {
        const coins = a.puertoma.recruited;
        a.coins += coins;
        if (coins) event(s, "puertomaBonus", p, { id: "recruitCoins", coins });
      }
      a.puertoma.recruited = 0;
    }
  }
}
function applyPuertoma(s, t, m) {
  const p = t.p,
    a = s.players[p],
    next = () => s.tasks.shift(),
    extra = { phase: t.kind };
  switch (m.type) {
    case "role":
      startRole(s, m.id, p);
      if (s.role === "adventurer") trackPuertoma(s, "adventurer");
      return;
    case "draft":
      s.market[m.id] = s.players.length === 2 ? 1 : B[m.id].copies;
      next();
      if (marketChoices(s).length)
        s.tasks.unshift({ kind: "draft", p: (p + 1) % s.players.length });
      else {
        finishPuertomaSetup(s);
        setupFestival(s);
        refillEstates(s);
        s.tasks = [{ kind: "role", p: s.governor }];
      }
      break;
    case "plant": {
      if (m.id === "quarry") s.quarries--;
      else s.offer.splice(s.offer.indexOf(m.id), 1);
      next();
      const vpArea =
        m.id !== "quarry" &&
        a.estates.filter((e) => e.id === m.id && !e.vpArea).length >= 2;
      a.estates.push({
        id: m.id,
        w: 0,
        c: 0,
        ...(vpArea ? { vpArea: true } : {}),
      });
      s.planted[p].push(a.estates.length - 1);
      if (P.ability(a, "plantCrate") && s.supply[m.id]) {
        s.supply[m.id]--;
        a.goods[m.id]++;
        event(s, "puertomaBonus", p, {
          id: "plantCrate",
          goods: { [m.id]: 1 },
        });
      }
      event(s, "estate", p, { id: m.id });
      checkFestival(s, p, { type: "estates" });
      trackPuertoma(s, "planter");
      break;
    }
    case "build": {
      const buildWorker = P.ability(a, "buildWorker");
      const bonus = Number(P.ability(a, "buildCoin"));
      a.coins += bonus - P.price(s, p, m.id);
      s.market[m.id]--;
      a.buildings.push({ id: m.id, w: 0, c: 0, level: m.level });
      const count = a.buildings.filter((b) => b.level === m.level).length;
      const unlocked = a.puertoma.abilities.filter((x) => x.active).length;
      const target = a.puertoma.abilities.find((x) => x.level === m.level);
      if (
        target &&
        !target.active &&
        (m.level === 4 || count === 2) &&
        !(s.puertoma.difficulty === "easy" && unlocked >= 2)
      ) {
        target.active = true;
        event(s, "puertomaAbility", p, { id: target.id, level: m.level });
      }
      if (
        [1, 2, 3, 4].every(
          (l) => a.buildings.filter((b) => b.level === l).length === 2,
        )
      )
        s.endReason ??= "city";
      next();
      if (buildWorker) {
        if (gainPuertomaWorker(s, p))
          event(s, "puertomaBonus", p, { id: "buildWorker", workers: 1 });
        allocatePuertoma(s, p);
      }
      updateReservations(s, m.id);
      if (
        !a.puertoma.reserved &&
        a.buildings.filter((b) => B[b.id].size === 2).length < 2
      )
        reserveExpanded(s, p);
      extra.coins = bonus - P.price(s, p, m.id);
      checkFestival(s, p, { type: "build", id: m.id });
      trackPuertoma(s, "builder");
      break;
    }
    case "recruitBonus":
      gainPuertomaWorker(s, p);
      if (--t.remaining === 0) next();
      trackPuertoma(s, "recruiter");
      break;
    case "recruit":
      s.register[m.kind]--;
      a.reserve[m.kind]++;
      a.puertoma.recruited++;
      t.p = (p + 1) % s.players.length;
      trackPuertoma(s, "recruiter");
      break;
    case "assign":
      a.estates.forEach((estate, i) => Object.assign(estate, m.estates[i]));
      a.puertoma.unused.w += m.unused.w;
      a.puertoma.unused.c += m.unused.c;
      a.reserve = { w: 0, c: 0 };
      next();
      break;
    case "produce":
      for (const g of GOODS) {
        a.goods[g] += m.goods[g];
        s.supply[g] -= m.goods[g];
        s.production[p][g] += m.goods[g];
      }
      next();
      checkFestival(s, p, { type: "produce" });
      if (sum(Object.values(m.goods))) trackPuertoma(s, "craftsman");
      break;
    case "produceBonus":
      a.goods[m.good]++;
      s.supply[m.good]--;
      s.production[p][m.good]++;
      if (--t.remaining === 0) next();
      checkFestival(s, p, { type: "produce" });
      break;
    case "trade": {
      a.goods[m.good]--;
      s.trade.push(m.good);
      const coins =
        GOODS.indexOf(m.good) +
        Number(s.owner === p) +
        Number(P.ability(a, "tradeCoin"));
      a.coins += coins;
      t.acted = true;
      extra.coins = coins;
      checkFestival(s, p, { type: "trade", good: m.good });
      trackPuertoma(s, "trader");
      break;
    }
    case "ship": {
      const ship = s.ships[m.ship],
        n = Math.min(a.goods[m.good], ship.capacity - ship.amount);
      a.goods[m.good] -= n;
      ship.good = m.good;
      ship.amount += n;
      s.shipped[p][m.good] += n;
      const advantage = p === s.owner && !s.captainBonus;
      if (advantage) s.captainBonus = true;
      vp(s, p, n + Number(advantage));
      extra.vp = n + Number(advantage);
      extra.goods = { ...counts(), [m.good]: n };
      extra.shipCapacity = ship.capacity;
      extra.shipLoad = ship.amount;
      t.p = (p + 1) % s.players.length;
      s.shipPasses = 0;
      checkFestival(s, p, {
        type: "ship",
        good: m.good,
        capacity: ship.capacity,
        full: ship.amount === ship.capacity,
      });
      trackPuertoma(s, "captain");
      break;
    }
    case "store":
      for (const g of GOODS) {
        s.supply[g] += a.goods[g] - m.goods[g];
        a.goods[g] = m.goods[g];
      }
      next();
      break;
    case "raid": {
      const ship = s.ships[m.ship];
      a.goods[ship.good] += m.amount;
      s.supply[ship.good] += ship.amount - m.amount;
      extra.good = ship.good;
      extra.shipCapacity = ship.capacity;
      ship.good = null;
      ship.amount = 0;
      next();
      trackPuertoma(s, "smuggler");
      break;
    }
    case "plunder":
      vp(s, p, s.trade.length);
      extra.vp = s.trade.length;
      s.trade.forEach((g) => s.supply[g]++);
      s.trade = [];
      next();
      trackPuertoma(s, "smuggler");
      break;
    case "poach":
      s.discardedPeople ??= { w: 0, c: 0 };
      s.tasks[0] = {
        kind: "poach",
        p,
        remaining: Math.min(3, total(s.register) - s.players.length),
      };
      trackPuertoma(s, "smuggler");
      break;
    case "poachWorker":
      s.register[m.kind]--;
      tileRef(a, m.target)[m.kind]++;
      t.remaining--;
      break;
    case "discardWorker":
      s.register[m.kind]--;
      s.discardedPeople[m.kind]++;
      break;
    case "pass":
      if (t.kind === "ship") {
        s.shipPasses++;
        if (s.shipPasses >= s.players.length) {
          next();
          beforePuertomaStorage(s);
          s.tasks.unshift(...order(s).map((p) => ({ kind: "store", p })));
        } else t.p = (p + 1) % s.players.length;
      } else if (t.kind === "poach") endPoach(s, t);
      else next();
      break;
    default:
      assert(false, "Unknown Puertoma action");
  }
  event(s, m.type, p, { ...m, ...extra });
}

function setupAchievements(s) {
  if (!s.expansions.includes("achievements")) return;
  const cards = shuffle(
    s,
    A.ACHIEVEMENTS.map((c) => c.id),
  );
  for (const a of s.players) {
    if (a.puertoma) continue;
    a.achievements = [];
    if (s.puertoma) a.achievementOffer = cards.splice(0, 6);
    else if (s.options.achievementDraft)
      a.achievementOffer = cards.splice(0, 4);
    else
      a.achievements = cards
        .splice(0, 4)
        .map((id) => ({ id, completed: false }));
  }
  if (s.puertoma || s.options.achievementDraft) {
    s.setupAfterAchievements = s.tasks;
    s.tasks = [
      { kind: s.puertoma ? "achievementChoose" : "achievementDraft", p: 0 },
    ];
  }
}
function selectAchievement(s, t, m) {
  const a = s.players[t.p];
  a.achievementOffer.splice(a.achievementOffer.indexOf(m.id), 1);
  a.achievements.push({ id: m.id, completed: false });
  const humans = s.puertoma?.humans ?? s.players.length;
  if (t.kind === "achievementChoose") {
    if (a.achievements.length < 4) return;
    delete a.achievementOffer;
    if (t.p + 1 < humans) {
      t.p++;
      return;
    }
  } else {
    if (t.p + 1 < humans) {
      t.p++;
      return;
    }
    const offers = s.players.map((a) => a.achievementOffer);
    if (a.achievements.length < 4) {
      for (let i = 0; i < humans; i++)
        s.players[i].achievementOffer = offers[(i - 1 + humans) % humans];
      t.p = 0;
      return;
    }
    s.players.forEach((a) => delete a.achievementOffer);
  }
  s.tasks = s.setupAfterAchievements;
  delete s.setupAfterAchievements;
}
function checkAchievements(s, p, e = {}) {
  const a = s.players[p];
  for (const c of a.achievements ?? []) {
    if (!c.completed && A.fulfilled(s, p, c.id, e)) {
      c.completed = true;
      c.round = s.round;
      // No VP tokens are withdrawn: card points are counted only at game end.
      event(s, "achievement", p, { id: c.id });
    }
  }
}
function checkAllAchievements(s) {
  s.players.forEach((_, p) => checkAchievements(s, p));
}
