import { BUILDINGS as B, GOODS } from "./catalog.js";

// All 30 physical cards, transcribed by an owner; see docs/sources.md.
// Leading Producer includes the publisher's June 2026 correction.
export const ACHIEVEMENTS = [
  {
    id: "bigSpender",
    name: "Big Spender",
    vp: 5,
    goal: "spendAll",
    text: "Build an expanded Building by paying all your Coins.",
  },
  {
    id: "caramelPopcorn",
    name: "Caramel Popcorn Inventor",
    vp: 4,
    goal: "goodsPair",
    goods: ["corn", "sugar"],
    amount: 8,
    text: "Have at least 8 Crates of Corn and Sugar combined, including at least one of each.",
  },
  {
    id: "coffeeDispatcher",
    name: "Coffee Dispatcher",
    vp: 5,
    goal: "dispatch",
    good: "coffee",
    text: "Dispatch a Cargo Ship containing Coffee.",
  },
  {
    id: "confectionerySupplier",
    name: "Confectionery Supplier",
    vp: 4,
    goal: "goodsPair",
    goods: ["fruit", "sugar"],
    amount: 7,
    text: "Have at least 7 Crates of Fruit and Sugar combined, including at least one of each.",
  },
  {
    id: "cornDispatcher",
    name: "Corn Dispatcher",
    vp: 3,
    goal: "dispatch",
    good: "corn",
    text: "Dispatch a Cargo Ship containing Corn.",
  },
  {
    id: "dealCloser",
    name: "Deal Closer",
    vp: 4,
    goal: "closeTrade",
    text: "Sell the last Good to the Trading House as the Trader.",
  },
  {
    id: "dockTycoon",
    name: "Dock Tycoon",
    vp: 5,
    goal: "shipTypes",
    text: "Load at least 3 different Goods during one Captain phase.",
  },
  {
    id: "fruitDispatcher",
    name: "Fruit Dispatcher",
    vp: 3,
    goal: "dispatch",
    good: "fruit",
    text: "Dispatch a Cargo Ship containing Fruit.",
  },
  {
    id: "headAdministrator",
    name: "Head Administrator",
    vp: 6,
    goal: "buildingWorkers",
    text: "Have at least 12 Workers placed on Buildings.",
  },
  {
    id: "independentShipper",
    name: "Independent Shipper",
    vp: 4,
    goal: "fillShip",
    text: "Fully load a Cargo Ship in one action, from empty to full.",
  },
  {
    id: "leadingEmployer",
    name: "Leading Employer",
    vp: 6,
    goal: "estateWorkers",
    text: "Have at least 9 Workers on Countryside tiles.",
  },
  {
    id: "leadingProducer",
    name: "Leading Producer",
    vp: 6,
    goal: "produce",
    text: "Produce at least 7 Crates during one Craftsman phase.",
  },
  {
    id: "luxuryCropTrader",
    name: "Luxury Crop Trader",
    vp: 4,
    goal: "goodsPair",
    goods: ["coffee", "tobacco"],
    amount: 5,
    text: "Have at least 5 Crates of Coffee and Tobacco combined, including at least one of each.",
  },
  {
    id: "luxuryGoodsProvider",
    name: "Luxury Goods Provider",
    vp: 5,
    goal: "productionSet",
    text: "Have at least 1 Sugar, 1 Tobacco, and 1 Coffee Production Building.",
  },
  {
    id: "majorInvestor",
    name: "Major Investor",
    vp: 7,
    goal: "expanded",
    text: "Have at least 2 expanded Buildings.",
  },
  {
    id: "majorLandowner",
    name: "Major Landowner",
    vp: 7,
    goal: "developed",
    text: "Have a maximum of 2 empty Countryside spaces and 2 empty Building spaces.",
  },
  {
    id: "masterAgronomist",
    name: "Master Agronomist",
    vp: 5,
    goal: "estates",
    text: "Have 12 Countryside tiles.",
  },
  {
    id: "masterArchitect",
    name: "Master Architect",
    vp: 3,
    goal: "cheapExpanded",
    text: "Build an expanded Building paying a maximum of 6 Coins.",
  },
  {
    id: "masterCollector",
    name: "Master Collector",
    vp: 7,
    goal: "goods",
    text: "Have at least 7 Crates of one Good.",
  },
  {
    id: "pastryMaker",
    name: "Pastry Maker",
    vp: 4,
    goal: "goodsPair",
    goods: ["corn", "fruit"],
    amount: 9,
    text: "Have at least 9 Crates of Corn and Fruit combined, including at least one of each.",
  },
  {
    id: "prudentMerchant",
    name: "Prudent Merchant",
    vp: 4,
    goal: "store",
    text: "Store at least 2 different Goods at the end of a Captain phase.",
  },
  {
    id: "seniorBureaucrat",
    name: "Senior Bureaucrat",
    vp: 7,
    goal: "commercial",
    text: "Have at least 7 regular Commercial Buildings.",
  },
  {
    id: "specialisedShipper",
    name: "Specialised Shipper",
    vp: 5,
    goal: "shipAmount",
    text: "Load at least 5 Crates of the same Good at once.",
  },
  {
    id: "sugarDispatcher",
    name: "Sugar Dispatcher",
    vp: 4,
    goal: "dispatch",
    good: "sugar",
    text: "Dispatch a Cargo Ship containing Sugar.",
  },
  {
    id: "tavernSupplier",
    name: "Tavern Supplier",
    vp: 4,
    goal: "goodsPair",
    goods: ["coffee", "sugar"],
    amount: 6,
    text: "Have at least 6 Crates of Coffee and Sugar combined, including at least one of each.",
  },
  {
    id: "tobaccoDispatcher",
    name: "Tobacco Dispatcher",
    vp: 5,
    goal: "dispatch",
    good: "tobacco",
    text: "Dispatch a Cargo Ship containing Tobacco.",
  },
  {
    id: "tobaccoFruitBroker",
    name: "Tobacco & Fruit Broker",
    vp: 4,
    goal: "goodsPair",
    goods: ["fruit", "tobacco"],
    amount: 6,
    text: "Have at least 6 Crates of Fruit and Tobacco combined, including at least one of each.",
  },
  {
    id: "tradeStrategist",
    name: "Trade Strategist",
    vp: 7,
    goal: "captainPoints",
    text: "Gain 7 or more VP during one Captain phase.",
  },
  {
    id: "tradeTycoon",
    name: "Trade Tycoon",
    vp: 4,
    goal: "tradeCoins",
    text: "Sell a Good to the Trading House for at least 6 Coins.",
  },
  {
    id: "tropicalProduceMagnate",
    name: "Tropical Produce Magnate",
    vp: 4,
    goal: "productionCount",
    text: "Have at least 3 Fruit and/or Sugar Production Buildings.",
  },
];
export const CARDS = Object.fromEntries(ACHIEVEMENTS.map((c) => [c.id, c]));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export function fulfilled(s, p, id, e = {}) {
  const a = s.players[p],
    c = CARDS[id];
  const size = sum(a.buildings.map((b) => B[b.id].size));
  const expanded = e.type === "build" && B[e.id]?.size === 2;
  const cargo = e.type === "ship" && Number.isInteger(e.ship);
  switch (c.goal) {
    case "spendAll":
      return expanded && e.paid === e.beforeCoins;
    case "goodsPair":
      return (
        c.goods.every((g) => a.goods[g] > 0) &&
        sum(c.goods.map((g) => a.goods[g])) >= c.amount
      );
    case "dispatch":
      return cargo && e.good === c.good && e.shipLoad === e.shipCapacity;
    case "closeTrade":
      return (
        e.type === "trade" &&
        !e.outpost &&
        s.owner === p &&
        s.trade.length === 4
      );
    case "shipTypes":
      return (
        s.role === "captain" &&
        GOODS.filter((g) => s.shipped?.[p]?.[g] > 0).length >= 3
      );
    case "buildingWorkers":
      return sum(a.buildings.map((b) => b.w + b.c)) >= 12;
    case "fillShip":
      return cargo && e.goods?.[e.good] === e.shipCapacity;
    case "estateWorkers":
      return sum(a.estates.map((t) => t.w + t.c)) >= 9;
    case "produce":
      return (
        s.role === "craftsman" &&
        sum(Object.values(s.production?.[p] ?? {})) >= 7
      );
    case "productionSet":
      return ["sugar", "tobacco", "coffee"].every((g) =>
        a.buildings.some((b) => B[b.id].good === g),
      );
    case "expanded":
      return a.buildings.filter((b) => B[b.id].size === 2).length >= 2;
    case "developed":
      return a.estates.length >= 10 && size >= 10;
    case "estates":
      return a.estates.length >= 12;
    case "cheapExpanded":
      return expanded && e.paid <= 6;
    case "goods":
      return GOODS.some((g) => a.goods[g] >= 7);
    case "store":
      return (
        e.type === "store" && GOODS.filter((g) => a.goods[g] > 0).length >= 2
      );
    case "commercial":
      return (
        a.buildings.filter((b) => !B[b.id].good && B[b.id].size === 1).length >=
        7
      );
    case "shipAmount":
      return (
        ["ship", "smallWharf"].includes(e.type) &&
        Object.values(e.goods ?? {}).some((n) => n >= 5)
      );
    case "captainPoints":
      return s.role === "captain" && (s.phaseVP?.[p] ?? 0) >= 7;
    case "tradeCoins":
      return e.type === "trade" && !e.outpost && e.coins >= 6;
    case "productionCount":
      return (
        a.buildings.filter((b) => ["fruit", "sugar"].includes(B[b.id].good))
          .length >= 3
      );
    default:
      throw Error(`Unknown Achievement ${id}`);
  }
}
export function points(a) {
  return sum(
    (a.achievements ?? [])
      .filter((c) => c.completed)
      .map((c) => CARDS[c.id].vp),
  );
}
export function incompletePoints(s) {
  return sum(
    s.players
      .filter((a) => !a.puertoma)
      .flatMap((a) =>
        (a.achievements ?? [])
          .filter((c) => !c.completed)
          .map((c) => CARDS[c.id].vp),
      ),
  );
}
