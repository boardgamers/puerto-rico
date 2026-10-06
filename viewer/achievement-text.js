import { plainText, richText } from "./rich-text.js";
import { CARDS } from "../engine/achievements.js";
const names = {
  bigSpender: "Grand dépensier",
  caramelPopcorn: "Inventeur du popcorn au caramel",
  coffeeDispatcher: "Expéditeur de café",
  confectionerySupplier: "Fournisseur de confiseries",
  cornDispatcher: "Expéditeur de maïs",
  dealCloser: "Négociateur",
  dockTycoon: "Magnat des quais",
  fruitDispatcher: "Expéditeur de fruits",
  headAdministrator: "Administrateur en chef",
  independentShipper: "Expéditeur indépendant",
  leadingEmployer: "Grand employeur",
  leadingProducer: "Grand producteur",
  luxuryCropTrader: "Marchand de cultures de luxe",
  luxuryGoodsProvider: "Fournisseur de produits de luxe",
  majorInvestor: "Grand investisseur",
  majorLandowner: "Grand propriétaire",
  masterAgronomist: "Maître agronome",
  masterArchitect: "Maître architecte",
  masterCollector: "Grand collectionneur",
  pastryMaker: "Pâtissier",
  prudentMerchant: "Marchand prudent",
  seniorBureaucrat: "Haut fonctionnaire",
  specialisedShipper: "Expéditeur spécialisé",
  sugarDispatcher: "Expéditeur de sucre",
  tavernSupplier: "Fournisseur de taverne",
  tobaccoDispatcher: "Expéditeur de tabac",
  tobaccoFruitBroker: "Courtier en tabac et fruits",
  tradeStrategist: "Stratège commercial",
  tradeTycoon: "Magnat du commerce",
  tropicalProduceMagnate: "Magnat des cultures tropicales",
};
export function achievementText(id, t) {
  const c = CARDS[id];
  if (!c)
    return {
      name: t.fr ? "Objectif secret" : "Secret Achievement",
      text: "",
      html: "",
    };
  const english = {
    spendAll: "Build an expanded Building by paying all your {coins}.",
    goodsPair: `Have at least ${c.amount} ${(c.goods ?? []).map((g) => `{${g}}`).join(" / ")} combined, including at least one of each.`,
    dispatch: `Place the last {crate} of {${c.good}} on a cargo ship to fill it.`,
    closeTrade: "Sell the fourth Good to the Trading House as the {trader}.",
    shipTypes: "Load at least 3 different Goods during one {captain} phase.",
    buildingWorkers:
      "Have at least 12 {workers} or {citizens} placed on Buildings.",
    fillShip: "Fully load a cargo ship in one action, from empty to full.",
    estateWorkers:
      "Have at least 9 {workers} or {citizens} on Countryside tiles.",
    produce: "Produce at least {crate:7} during one {craftsman} phase.",
    productionSet:
      "Have at least 1 {sugar}, 1 {tobacco}, and 1 {coffee} Production Building.",
    cheapExpanded: "Build an expanded Building paying a maximum of {coin:6}.",
    goods: "Have at least {crate:7} of one type.",
    store: "Store at least 2 different Goods at the end of a {captain} phase.",
    shipAmount: "Load at least {crate:5} of the same type at once.",
    captainPoints: "Gain at least {vp:7} during one {captain} phase.",
    tradeCoins: "Sell a Good to the Trading House for at least {coin:6}.",
    productionCount:
      "Have at least 3 {fruit} and/or {sugar} Production Buildings.",
  };
  const objectives = {
    spendAll: "Construire un bâtiment étendu en dépensant toutes vos {coins}.",
    goodsPair: `Posséder au moins ${c.amount} ${(c.goods ?? []).map((g) => `{${g}}`).join(" / ")} au total, dont au moins une de chaque.`,
    dispatch: `Placer la dernière {crate} de {${c.good}} sur un navire de charge et le remplir.`,
    closeTrade:
      "Vendre la quatrième marchandise au comptoir en ayant choisi le {trader}.",
    shipTypes:
      "Charger au moins 3 marchandises différentes durant une même phase de {captain}.",
    buildingWorkers:
      "Avoir au moins 12 {workers} ou {citizens} sur vos bâtiments.",
    fillShip: "Remplir un navire de charge vide en une seule action.",
    estateWorkers:
      "Avoir au moins 9 {workers} ou {citizens} sur vos tuiles de campagne.",
    produce: "Produire au moins {crate:7} durant une même phase {craftsman}.",
    productionSet:
      "Posséder au moins un bâtiment de production de {sugar}, de {tobacco} et de {coffee}.",
    expanded: "Posséder au moins 2 bâtiments étendus.",
    developed:
      "Avoir au maximum 2 espaces libres dans la campagne et 2 espaces libres dans la ville.",
    estates: "Posséder 12 tuiles de campagne.",
    cheapExpanded:
      "Construire un bâtiment étendu en payant au maximum {coin:6}.",
    goods: "Posséder au moins {crate:7} d’un même type.",
    store:
      "Conserver au moins 2 marchandises différentes à la fin d’une phase de {captain}.",
    commercial: "Posséder au moins 7 bâtiments commerciaux ordinaires.",
    shipAmount:
      "Charger au moins {crate:5} d’un même type en une seule action.",
    captainPoints: "Gagner au moins {vp:7} durant une même phase de {captain}.",
    tradeCoins: "Vendre une marchandise au comptoir pour au moins {coin:6}.",
    productionCount:
      "Posséder au moins 3 bâtiments de production de {fruit} et/ou de {sugar}.",
  };
  const message = t.fr ? objectives[c.goal] : (english[c.goal] ?? c.text);
  return {
    ...c,
    name: t.fr ? names[id] : c.name,
    text: plainText(message, t.fr),
    html: richText(message, t.fr),
  };
}
export const abilityTexts = {
  tradeDuplicate: [
    "May sell a duplicate Good.",
    "Peut vendre une marchandise déjà au comptoir.",
  ],
  tradeCoin: ["+1 Coin per sale.", "+1 pièce par vente."],
  buildWorker: [
    "+1 Worker after building.",
    "+1 ouvrier après une construction.",
  ],
  storage: [
    "Store all goods of the best type and one other good.",
    "Conserver toutes les marchandises du meilleur type et une marchandise supplémentaire.",
  ],
  buildCoin: [
    "+1 Coin when able to build.",
    "+1 pièce lorsqu’une construction est possible.",
  ],
  produceCrate: [
    "+1 good of the best type produced after production.",
    "+1 marchandise du meilleur type produit après la production.",
  ],
  produceCoins: [
    "+1 Coin per produced Goods type.",
    "+1 pièce par type de marchandise produit.",
  ],
  recruitWorker: [
    "+1 Worker after recruitment.",
    "+1 ouvrier après le recrutement.",
  ],
  plantCrate: [
    "+1 good matching the chosen plantation.",
    "+1 marchandise correspondant à la plantation choisie.",
  ],
  goodsPoints: [
    "+1 VP per Goods type before storage.",
    "+1 PV par type de marchandise avant le stockage.",
  ],
  discardPoints: [
    "Discard up to 2 of the worst Good for 1 VP each before storage.",
    "Défausser jusqu’à 2 marchandises du moins bon type pour 1 PV chacune avant le stockage.",
  ],
  recruitCoins: [
    "+1 Coin per Worker gained during recruitment.",
    "+1 pièce par ouvrier gagné durant le recrutement.",
  ],
};
