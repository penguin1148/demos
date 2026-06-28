import { GameState } from "./state.js";
import { godName } from "./religion.js";

/* ---------- Display metadata for resources ---------- */
export const STAT_META = {
  population: { icon: "👥", label: "Population", sub: "souls" },
  grain:      { icon: "🌾", label: "Grain",      sub: "food stores" },
  cattle:     { icon: "🐄", label: "Cattle",     sub: "wealth & trade" },
  olives:     { icon: "🫒", label: "Olives",     sub: "oil & hygiene" },
  grapes:     { icon: "🍇", label: "Grapes",     sub: "wine & ritual" },
  timber:     { icon: "🪵", label: "Timber",     sub: "building" },
  clay:       { icon: "🧱", label: "Clay",       sub: "building" },
  stone:      { icon: "🪨", label: "Stone",      sub: "masonry · from the Mines" },
};

/* ---------- Flavor: era-appropriate random events ---------- */
export const DAWN_EVENTS = [
  { text: "A bountiful harvest swells the granaries.",          stats: { grain: +24 } },
  { text: "The olive groves come into full bearing.",          stats: { olives: +10 } },
  { text: "The vines yield a heavy, sweet vintage.",           stats: { grapes: +9 } },
  { text: "A stand of oak is felled along the ridge.",         stats: { timber: +14 } },
  { text: "Diggers strike a rich seam of river clay.",         stats: { clay: +12 } },
  { text: "A fine calving season fattens the herds.",          stats: { cattle: +4 } },
  { text: "Wandering shepherds settle among your people.",     stats: { population: +6, cattle: +2 } },
  { text: "Drought withers the standing grain.",               stats: { grain: -18 } },
  { text: "Murrain takes hold; several cattle perish.",        stats: { cattle: -3 } },
  { text: "Raiders drive off beasts under cover of night.",    stats: { cattle: -2, grain: -6 } },
  { text: "A storm scatters the woodpiles and breaks kilns.",  stats: { timber: -8, clay: -5 } },
  { text: "A festival of wine strengthens the people's bonds.",stats: { grapes: -4, population: +3 } },
];

/*
 * Structural CRISES. Each falls within a DOMAIN; a consecrated god of that
 * domain shields the people automatically (the better the tier, the more it
 * averts), and Piety may still be spent to soften the blow further. `damage`
 * is the unshielded toll — deliberately harsh, so the early city scrambles to
 * name protective Daimones.
 */
export const CRISES = [
  { id: "blight", name: "Crop Blight", icon: "🐛", domain: "earth", pietyCost: 8,
    desc: "A grey rot creeps through the barley; the standing harvest withers in the field.",
    damage: { grain: -40 } },
  { id: "quake", name: "Earthquake Tremor", icon: "🌋", domain: "forge", pietyCost: 11,
    desc: "The earth shudders. Mud-brick walls crack and a storehouse spills into the dust.",
    damage: { clay: -14, timber: -12, population: -7 } },
  { id: "plague", name: "Fever in the Wells", icon: "🤒", domain: "hearth", pietyCost: 12,
    desc: "A sickness rises from the wells and spreads hut to hut, laying the people low.",
    damage: { population: -16 } },
  { id: "tempest", name: "Tempest from the Sea", icon: "⛈️", domain: "sea", pietyCost: 9,
    desc: "A violent storm batters the coast, scattering the flocks and soaking the grain.",
    damage: { cattle: -6, grain: -20 } },
  { id: "wolves", name: "Wolves from the Hills", icon: "🐺", domain: "wild", pietyCost: 7,
    desc: "A hard season drives gaunt wolves down from the high country, upon the herds.",
    damage: { cattle: -9, population: -3 } },
  { id: "drought", name: "The Withering Drought", icon: "☀️", domain: "sky", pietyCost: 9,
    desc: "No rain comes. The springs fail and the green burns away to dust.",
    damage: { grain: -22, grapes: -8, population: -3 } },
  { id: "strife", name: "Border Raiders", icon: "⚔️", domain: "war", pietyCost: 8,
    desc: "Spear-bands probe the marches, carrying off cattle and grain and leaving fear behind.",
    damage: { cattle: -7, grain: -12, population: -4 } },
];

/*
 * CATASTROPHES — rare, era-defining disasters. Without a god of the relevant
 * domain the toll is ruinous (often fatal); WITH one, the deity's intervention
 * is dramatised and the city survives. Resolved through the choice modal.
 */
export const CATASTROPHES = [
  { id: "deluge", name: "The Great Deluge", icon: "🌊", domain: "sea",
    desc: "The sea heaves up and walks inland, swallowing the lower fields and the fishing-shores whole.",
    saved: "The waters rear up — and break against an unseen hand. {god} holds back the flood, and the people scramble to high ground.",
    doomed: "No god of the sea answers. The deluge takes the lower town entire.",
    damage: { population: -28, grain: -40, cattle: -10 }, savedDamage: { grain: -14, cattle: -3 } },
  { id: "conflagration", name: "The Sky-Fire", icon: "🌩️", domain: "sky",
    desc: "The storm-sky splits and fire walks the rooftops; a firestorm races through the thatch.",
    saved: "The bolts curve away at the last — {god} turns the sky's wrath aside, and only the granary roofs burn.",
    doomed: "The heavens show no mercy; the Polis burns from end to end.",
    damage: { population: -24, timber: -30, grain: -24 }, savedDamage: { timber: -12, grain: -8 } },
  { id: "pestilence", name: "The Black Pestilence", icon: "💀", domain: "hearth",
    desc: "A killing sickness sweeps the hearths; the dead are carried out faster than graves can be dug.",
    saved: "{god} keeps the hearth-fires pure; the sick are tended and most recover.",
    doomed: "No hearth-god guards the wells. The pestilence rages unchecked.",
    damage: { population: -34 }, savedDamage: { population: -9 } },
  { id: "earthquake", name: "The World-Shaking", icon: "🏔️", domain: "forge",
    desc: "The ground convulses for a day and a night; whole hillsides slide and the springs run black.",
    saved: "{god} steadies the deep stone; walls crack but hold, and the people are dug free.",
    doomed: "The earth opens. Half of what your fathers built is swallowed.",
    damage: { population: -26, clay: -40, timber: -24 }, savedDamage: { clay: -16, population: -6 } },
  { id: "famine", name: "The Seven Lean Years", icon: "🌾", domain: "earth",
    desc: "Year on year the harvest fails; the granaries echo and the children grow thin.",
    saved: "{god} quickens the dying seed; a meagre but saving harvest is wrung from the dust.",
    doomed: "The soil gives nothing. The long famine hollows the city.",
    damage: { population: -30, grain: -50, cattle: -8 }, savedDamage: { grain: -18, population: -6 } },
];

/*
 * Respond-able FLAVOUR EVENTS — small forks the player answers in a modal. Each
 * has two options with costs/outcomes; choosing wisely shapes the city.
 */
export const CHOICE_EVENTS = [
  { id: "wanderers", icon: "🚶", name: "Wandering Folk at the Gate",
    desc: "A ragged band of wanderers asks leave to settle. They are hungry mouths now, but hands and children later.",
    a: { label: "Take them in", cost: { grain: 12 }, gain: { population: 10 }, log: "The wanderers are taken in; ten souls join the Demos." },
    b: { label: "Turn them away", gain: { kleos: -2 }, log: "The gates stay shut; the wanderers move on, and the tale shames your name a little." } },
  { id: "oracle", icon: "🔮", name: "A Wandering Seer",
    desc: "A seer offers to read the entrails and counsel the Polis — for a price in cattle.",
    a: { label: "Pay the seer", cost: { cattle: 3 }, gain: { piety: 10, muthos: 8 }, log: "The seer's words steady the people; Piety and lore grow." },
    b: { label: "Send her on her way", gain: {}, log: "The seer is refused; the people wonder what was left unsaid." } },
  { id: "feud", icon: "🗡️", name: "A Blood-Feud", domainCalm: true,
    desc: "Two great households fall to feuding over a grazing-right, and the quarrel threatens to split the town.",
    a: { label: "Mediate a settlement", cost: { grain: 8, cattle: 2 }, gain: {}, calm: 4, log: "Gifts and patient words knit the feud closed." },
    b: { label: "Let them settle it themselves", gain: {}, unrest: 2, log: "The feud festers; blood is spilt and discontent rises." } },
  { id: "vein", icon: "⛏️", name: "A Rich Clay-Vein", domain: "forge",
    desc: "Diggers strike a deep seam of fine potter's clay — but it lies under a slope that could give way.",
    a: { label: "Work it hard (shore it up)", cost: { timber: 6 }, gain: { clay: 26, ergon: 10 }, log: "Shored and worked, the vein yields a fortune in clay." },
    b: { label: "Work it cautiously", gain: { clay: 10 }, log: "A careful, modest digging brings clay without risk." } },
  { id: "bard", icon: "🎶", name: "A Famous Aoidos Passes Through",
    desc: "A renowned singer offers to compose an epic of your city's founding — if you feast his company.",
    a: { label: "Feast him richly", cost: { grapes: 6, cattle: 4 }, gain: { kleos: 10, muthos: 12 }, log: "The aoidos sings your deeds in far halls; renown and lore swell." },
    b: { label: "Offer only bread and water", gain: { muthos: 2 }, log: "The singer departs unimpressed, with only a short song for your trouble." } },
  { id: "comet", icon: "☄️", name: "An Omen in the Sky", domain: "sky",
    desc: "A hairy star burns across the night. The people are afraid; the priests argue over its meaning.",
    a: { label: "Proclaim it a blessing (lead the rites)", cost: { piety: 6 }, gain: { muthos: 10 }, calm: 3, log: "Declared a blessing, the omen becomes a festival; fear turns to wonder." },
    b: { label: "Say nothing and wait", gain: {}, unrest: 1, log: "Left unread, the omen gnaws at the people's nerves." } },
];

/*
 * GOD EVENTS — forks that fall upon ONE consecrated god, swinging its happiness
 * hard. They make keeping a god content an active, high-stakes affair: a refused
 * demand or a poached congregation can wipe out a long happy streak in a year.
 * `happy` is the happiness delta applied to the targeted god.
 */
export const GOD_EVENTS = [
  { id: "demand", icon: "🔥", name: "A God's Demand",
    desc: g => `The priests of ${godName(g)} proclaim that the god demands a great offering — meat and grain upon the altar — or it will turn its face from the people.`,
    a: { label: "Lay the great offering", cost: { cattle: 4, grain: 8 }, happy: 14, log: g => `The altar of ${godName(g)} runs red; the god is well pleased.` },
    b: { label: "Refuse — the city cannot spare it", happy: -28, log: g => `The demand of ${godName(g)} is refused; the god sulks and its favour collapses.` } },
  { id: "rival", icon: "🌀", name: "A Rival Cult",
    desc: g => `A charismatic foreign mystagogue draws crowds away from ${godName(g)}, whispering that older gods are stronger.`,
    a: { label: "Outshine them with festival", cost: { grapes: 8, piety: 6 }, happy: 10, log: g => `A dazzling festival wins the people back to ${godName(g)}.` },
    b: { label: "Ignore the upstart", happy: -22, log: g => `The rival cult swells; ${godName(g)} feels the loss of its worshippers.` } },
  { id: "quarrel", icon: "🗣️", name: "A Quarrel in the Priesthood",
    desc: g => `The priests of ${godName(g)} fall to bitter feuding over precedence, and the rites grow slovenly.`,
    a: { label: "Buy peace with gifts", cost: { grain: 10, cattle: 2 }, happy: 8, log: g => `The priests of ${godName(g)} are reconciled, and the rites restored.` },
    b: { label: "Let them sort it out", happy: -16, unrest: 1, log: g => `The feud festers; the worship of ${godName(g)} suffers and the people mutter.` } },
  { id: "miracle", icon: "✨", name: "A Miracle Witnessed", good: true,
    desc: g => `Shepherds swear they saw ${godName(g)} walk the hills at dusk, and a sick child rose up healed. The whole city is aglow.`,
    a: { label: "Proclaim the miracle far and wide", happy: 16, gain: { muthos: 10, kleos: 4 }, log: g => `The miracle of ${godName(g)} is sung in every hall; the god's favour blazes.` },
    b: { label: "Keep it a quiet wonder", happy: 8, gain: { piety: 6 }, log: g => `The wonder is kept close, but the faithful of ${godName(g)} are heartened.` } },
];

/*
 * THE TECH TREE — an independent research economy. Each year, labour generates
 * ⚒ ERGON (practical know-how) and cultural life generates 📜 MUTHOS (lore &
 * story). A technology is researched once both are stockpiled to its cost and
 * its prerequisites are met. Research income HALTS in any year of starvation or
 * an unresolved crisis — a frightened, hungry people invent nothing.
 *
 *   Terraced Farming → ┬→ Deep-Shaft Mining ┐
 *                      └→ Naval Carpentry  ─┴→ The Phoenician Alphabet (ends the era)
 */
export const TECHS = {
  terraced: {
    name: "Terraced Farming", icon: "🌾", req: [], cost: { ergon: 55, muthos: 15 },
    col: 0, row: 1,
    desc: "Stone-walled terraces climb the hillside, banking soil and water against the dry years.",
    effect: "+4 Grain and +2 Wine each year, and a green terraced field rises at the foot of the hill.",
    apply() { GameState.techBonus.grain += 4; GameState.techBonus.grapes += 2; GameState.fieldRevealed = true; },
  },
  mining: {
    name: "Deep-Shaft Mining", icon: "⛏️", req: ["terraced"], cost: { ergon: 120, muthos: 35 },
    col: 1, row: 0,
    desc: "Timbered shafts sink deep after potter's clay and building-stone, and harden the people to heavy labour.",
    effect: "+5 Clay each year and Ergon generation is raised by a quarter.",
    apply() { GameState.techBonus.clay += 5; GameState.ergonMult += 0.25; },
  },
  naval: {
    name: "Naval Carpentry", icon: "⛵", req: ["terraced"], cost: { ergon: 110, muthos: 55 },
    col: 1, row: 2,
    desc: "Mortise-and-tenon hulls open the sea-roads, bringing a richer catch and tales of far shores.",
    effect: "+4 Grain (the catch) each year and Muthos generation is raised by a third.",
    apply() { GameState.techBonus.grain += 4; GameState.muthosMult += 0.34; },
  },
  alphabet: {
    name: "The Phoenician Alphabet", icon: "📜", req: ["mining", "naval"], cost: { ergon: 170, muthos: 260, stone: 30 },
    endsEra: true, needsPhoenician: true,
    desc: "The twenty-two letters won from the Phoenician trader; the Polis learns to write its laws, its debts and its gods.",
    effect: "The Dawn Era closes in a blaze of memory — the Polis enters history. (Completes the era.)",
    apply() { /* handled specially: ends the era */ },
  },
};

/*
 * BUILDINGS — raised in the Civic panel once their technology is known AND the
 * matching hamlet has joined the Polis. They appear on the map.
 */
export const BUILDINGS = {
  mines: {
    name: "The Mines", icon: "⛏️", tech: "mining", hamlet: "foothill",
    cost: { timber: 32, clay: 26 },
    desc: "Timbered shafts driven deep into the mountain after the Foothill Clan's good grey stone.",
    effect: "Opens the quarrying of <b>Stone</b> (+4 / year) — masonry essential to great temples and lasting works.",
  },
  docks: {
    name: "The Docks", icon: "⚓", tech: "naval", hamlet: "coastal",
    cost: { timber: 38, clay: 18 },
    desc: "Wooden piers run out into the bay, where the Coastal folk moor deep-keeled ships.",
    effect: "<b>Foreign merchants</b> begin to call — trade with them, and in time a Phoenician may bring the alphabet.",
  },
};

/* Wares a passing foreign merchant will barter (once the Docks are built). */
export const MERCHANT_TRADES = [
  { who: "a Cretan oil-merchant",       give: { olives: 10 }, get: { grain: 26 } },
  { who: "a Thessalian cattle-drover",  give: { grain: 22 },  get: { cattle: 5 } },
  { who: "an Egyptian scribe",          give: { stone: 8 },   get: { muthos: 20 } },
  { who: "a Cypriot copper-smith",      give: { grapes: 12 }, get: { ergon: 22 } },
  { who: "an island wine-trader",       give: { cattle: 4 },  get: { olives: 16, grapes: 8 } },
  { who: "a Rhodian potter",            give: { clay: 16 },   get: { stone: 10 } },
];

/* The Phoenician — a lengthy negotiation. Good, generous and honest choices
   build RAPPORT; reach the threshold and Hiram stays the winter to teach the
   alphabet (unlocking the tech). Substitution: {city}. */
export const PHOENICIAN_STORY = [
  { id: 0, title: "The Stranger from Tyre",
    text: "A deep-keeled ship of cedar moors at the docks of {city}. From it steps Hiram, a Phoenician master-trader robed in sea-purple, bearing strange marks scratched on clay — not pictures, but the very sounds of speech caught in signs. He has crossed the whole sea; he will not part with such a secret cheaply, and marks well how a stranger is received.",
    options: [
      { label: "Receive him with a months-long lavish feast", cost: { grapes: 44, cattle: 16, olives: 20 }, rapport: 3, to: 1 },
      { label: "Heap his ship with stone, oil and wine as guest-gifts", cost: { stone: 40, olives: 34, grapes: 18 }, rapport: 3, to: 1 },
      { label: "Give a plain but honest welcome", cost: {}, rapport: 1, to: 1 },
    ] },
  { id: 1, title: "The Bargain",
    text: "Hiram spreads his wares — tin, glass beads, the precious purple dye — and drives a shrewd bargain over a whole season. He is weighing whether your people are worth a lifetime's friendship, or merely a single season's easy profit.",
    options: [
      { label: "Trade lavishly, always to his advantage", cost: { grain: 70, stone: 24, cattle: 8 }, rapport: 3, to: 2 },
      { label: "Drive a hard but fair bargain", cost: {}, rapport: 1, to: 2 },
      { label: "Cheat him with light measures", cost: {}, rapport: -4, to: 2 },
    ] },
  { id: 2, title: "The Test of Trust",
    text: "A winter storm strands Hiram's ship for the season. Worse, a sailor of his is accused of theft in your market — wrongly, you suspect. Hiram says nothing, but watches to learn what justice a foreigner may hope for in {city}.",
    options: [
      { label: "Judge fairly and clear his man", cost: {}, rapport: 3, to: 3 },
      { label: "Ransom him and pay weregild besides", cost: { cattle: 20, grain: 30 }, rapport: 2, to: 3 },
      { label: "Side with your own, guilt or no", cost: {}, rapport: -5, to: 3 },
    ] },
  { id: 3, title: "The Reckoning of Letters", final: true, need: 8,
    text: "His ship repaired and the winter deep, Hiram must decide. Only if he has come to <b>truly</b> trust the people of {city} will he sit through the long dark teaching your scribes the twenty-two letters — the gift that lets a city write. If not, he sails with the first fair wind, and the secret sails with him; and a courtship so costly is not soon repeated." },
];

/*
 * SYNOIKISMOS — the surrounding independent hamlets that may be unified
 * into the Polis. Each controls a unique resource asset that, once
 * absorbed, is permanently folded into the city's turn generation.
 *
 *  pos   — placement of the interactive label on the map (percent).
 *  asset — { label, bonus } added to GameState.bonuses on absorption.
 *
 * Integration is no quick conquest: every hamlet is drawn in through the
 * shared event-chain below (INTEGRATION_STAGES), one stage at a time, with a
 * rest between each. Each stage offers an aggressive and a negotiated path —
 * the player mixes them according to their stores and how their religion is
 * faring.
 */
export const HAMLETS = [
  {
    id: "foothill", name: "The Foothill Clan", icon: "⛰️",
    population: 30, pos: { top: "52%", left: "14%" },
    desc: "Hardy highlanders who fell timber and quarry stone from the upland forests.",
    asset: { label: "timber from the high forests", bonus: { timber: +6 } },
  },
  {
    id: "coastal", name: "The Coastal Fishermen", icon: "🌊",
    population: 25, pos: { top: "84%", left: "69%" },
    desc: "Fisherfolk whose nets bring a steady catch to feed the growing city.",
    asset: { label: "a steady catch that swells the food stores", bonus: { grain: +8 } },
  },
  {
    id: "river", name: "The River Valley Tribe", icon: "🏞️",
    population: 40, pos: { top: "85%", left: "28%" },
    desc: "Potters and farmers of the fertile river bend, rich in clay and grain.",
    asset: { label: "clay and grain from the river bend", bonus: { clay: +6, grain: +3 } },
  },
];

/*
 * The integration event-chain. A hamlet advances through these stages one at a
 * time, resting CONFIG.INTEGRATION_GAP years between each. Every stage offers
 * a `force` overture (cheap in social goods but costly in cattle/grain, and it
 * breeds civil unrest) and a `talk` overture (costly in wine, oil, Kleos and
 * Piety, but peaceful). A consecrated pantheon eases whichever path it favours.
 * The `faith` stage is far cheaper if you have a harmonious god — and dear if
 * you have none. Costs and gaps make a first union realistic only ~turn 70-100.
 */
export const INTEGRATION_STAGES = [
  { key: "contact", name: "First Contact",
    desc: "Outriders and heralds test the will of {name}.",
    talk:  { label: "Send envoys bearing gifts",   cost: { grapes: 14, olives: 8, kleos: 10 } },
    force: { label: "Make a show of arms",          cost: { cattle: 6, grain: 14 }, unrest: 2 } },
  { key: "elders", name: "Win the Elders",
    desc: "The elders of {name} weigh whether your Polis is worth the joining.",
    talk:  { label: "Feast and flatter the elders", cost: { grapes: 22, cattle: 6, olives: 10 } },
    force: { label: "Seize their best grazing land", cost: { cattle: 8, grain: 20 }, unrest: 4 } },
  { key: "sacred", name: "The Sacred Bond", faith: true,
    desc: "Only a shared rite can truly knit {name} to your gods — and a god of your own makes it far easier.",
    talk:  { label: "Hold a joint sacrifice",       cost: { piety: 16, cattle: 8 } },
    force: { label: "Cow their priests into silence", cost: { cattle: 10, timber: 16 }, unrest: 5 } },
  { key: "house", name: "Bind the Households",
    desc: "Blood and bargain must weave your peoples together.",
    talk:  { label: "Arrange marriage alliances",   cost: { olives: 16, grapes: 18, kleos: 18 } },
    force: { label: "Take noble children as hostages", cost: { cattle: 12, grain: 24 }, unrest: 6 } },
  { key: "oath", name: "The Synoikismos Oath",
    desc: "The final oath that makes {name} forever part of the Polis.",
    talk:  { label: "Swear the confederate oath",   cost: { kleos: 26, piety: 18, grapes: 20 } },
    force: { label: "Compel the final submission",   cost: { cattle: 18, grain: 32 }, unrest: 7 } },
];
