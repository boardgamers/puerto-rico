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
    return { name: t.fr ? "Objectif secret" : "Secret Achievement", text: "" };
  if (!t.fr) return c;
  const objectives = {
    spendAll: "Construire un bâtiment étendu en dépensant toutes vos pièces.",
    goodsPair: `Posséder au moins ${c.amount} caisses de ${(c.goods ?? []).map(t).join(" et ")} au total, dont au moins une de chaque.`,
    dispatch: `Placer la dernière caisse de ${t(c.good)} sur un navire de charge et le remplir.`,
    closeTrade:
      "Vendre la quatrième marchandise au comptoir en ayant choisi le Marchand.",
    shipTypes:
      "Charger au moins 3 marchandises différentes durant une même phase de Capitaine.",
    buildingWorkers:
      "Avoir au moins 12 ouvriers ou citoyens sur vos bâtiments.",
    fillShip: "Remplir un navire de charge vide en une seule action.",
    estateWorkers:
      "Avoir au moins 9 ouvriers ou citoyens sur vos tuiles de campagne.",
    produce: "Produire au moins 7 caisses durant une même phase d’Artisan.",
    productionSet:
      "Posséder au moins un bâtiment de production de sucre, de tabac et de café.",
    expanded: "Posséder au moins 2 bâtiments étendus.",
    developed:
      "Avoir au maximum 2 espaces libres dans la campagne et 2 espaces libres dans la ville.",
    estates: "Posséder 12 tuiles de campagne.",
    cheapExpanded:
      "Construire un bâtiment étendu en payant au maximum 6 pièces.",
    goods: "Posséder au moins 7 caisses d’une même marchandise.",
    store:
      "Conserver au moins 2 marchandises différentes à la fin d’une phase de Capitaine.",
    commercial: "Posséder au moins 7 bâtiments commerciaux ordinaires.",
    shipAmount:
      "Charger au moins 5 caisses d’une même marchandise en une seule action.",
    captainPoints: "Gagner au moins 7 PV durant une même phase de Capitaine.",
    tradeCoins: "Vendre une marchandise au comptoir pour au moins 6 pièces.",
    productionCount:
      "Posséder au moins 3 bâtiments de production de fruits et/ou de sucre.",
  };
  return { ...c, name: names[id], text: objectives[c.goal] };
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
    "Store all of the best Good and one other Crate.",
    "Conserver toutes les caisses de la meilleure marchandise et une autre caisse.",
  ],
  buildCoin: [
    "+1 Coin when able to build.",
    "+1 pièce lorsqu’une construction est possible.",
  ],
  produceCrate: [
    "+1 Crate of the best produced Good after production.",
    "+1 caisse de la meilleure marchandise produite après la production.",
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
    "+1 Crate matching a new Estate.",
    "+1 caisse correspondant à la plantation choisie.",
  ],
  goodsPoints: [
    "+1 VP per Goods type before storage.",
    "+1 PV par type de marchandise avant le stockage.",
  ],
  discardPoints: [
    "Discard up to 2 of the worst Good for 1 VP each before storage.",
    "Défausser jusqu’à 2 caisses de la moins bonne marchandise pour 1 PV chacune avant le stockage.",
  ],
  recruitCoins: [
    "+1 Coin per Worker gained during recruitment.",
    "+1 pièce par ouvrier gagné durant le recrutement.",
  ],
};
