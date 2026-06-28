/* ===================================================================
   RELIGION — the Divine Epiphany, where a god is named into being
   =================================================================== */

/*
 * The slow-burn religion engine. Once the Ancestral Hearth burns, a Divine
 * Epiphany every few years hands the people ONE Aspect and ONE Epithet card.
 * Cards are not named into gods at once: they sit in a fluid, unaligned
 * "Local Cult" that grows in Devotion the longer it is kept and fed. Only
 * when a cult is consecrated (locked) is its power frozen — the tier it has
 * reached by then is the tier it keeps for the rest of the era.
 */
/*
 * Religion is now a slow ascent. A god is named at once as a humble DAIMON
 * (Tier 1, a local domain-spirit) — cheap, and the people's first shield against
 * catastrophe. A Daimon kept HAPPY for ASCEND_TURNS years becomes ready to face
 * a multi-scene Mythic Cycle; surviving it raises it to a HEROS, and a second,
 * harder cycle later raises a Heros to an OLYMPIAN. There is no shortcut to three
 * Olympians: each ascent costs decades of upkeep and a survived story.
 */
export const RELIGION = Object.freeze({
  EPIPHANY_INTERVAL: 6,   // turns between Divine Epiphanies (shortened ~1.25× for the turn=1.25yr scale)
  SLOTS:             3,   // pantheon capacity (consecrated gods)
  HAPPY:             60,  // happiness at/above which a god counts as "happy" this year
  HAPPY_START:       72,  // happiness a freshly-named Daimon begins with
  HAPPY_GAIN:        5,   // happiness regained per year when upkeep is met
  HAPPY_LOSS:        18,  // happiness lost per year when upkeep is unmet
  // Phthonos — the jealousy of advancing gods. Each OTHER god of Heros rank or
  // above drags this god's happiness down every year, so keeping two great gods
  // content is a strain and three is all but impossible. This is the chief brake
  // on a runaway pantheon: realistically one Olympian, maybe two, by 750 BC.
  JEALOUSY_DRAG:     4,
  ASCEND_TURNS: { 2: 18, 3: 32 },   // consecutive happy turns before a Mythic Cycle (shortened ~1.25× for the new turn scale)
});

/* The Temenos — the sacred precinct dedicated when a god is named or ascends.
   A Daimon's shrine is cheap so the people may shield themselves early; a Heros
   demands a walled precinct; an Olympian a great temple of cut stone and a
   standing priesthood — a historic undertaking. */
export const TEMENOS = Object.freeze({
  1: { timber: 6, clay: 4 },                                        // Daimon — a roadside shrine (early & cheap)
  2: { timber: 30, clay: 26, cattle: 10 },                          // Heros — a walled hero-shrine
  3: { timber: 80, clay: 110, cattle: 50, stone: 40, priests: 12 }, // Olympian — a great stone temple & priesthood
});

/* Per-year upkeep a consecrated god demands to be kept happy, by tier. The cost
   of greatness climbs steeply — a single Olympian eats a real share of the city's
   grain and herds, and a second pushes the granaries to the brink. */
export function godUpkeep(tier) {
  if (tier >= 3) return { grain: 12, cattle: 3, grapes: 2 };
  if (tier >= 2) return { grain: 5, cattle: 1, grapes: 1 };
  return { grain: 1 };                                              // a Daimon is content with little
}

export const TIER_MULT  = Object.freeze({ 1: 0.45, 2: 1.1, 3: 2.6 });
export const TIER_NAME  = Object.freeze({ 1: "Daimon", 2: "Heros", 3: "Olympian" });
export const TIER_SUB   = Object.freeze({ 1: "Local Spirit", 2: "Legendary Cult", 3: "Pan-Hellenic Deity" });

/* Each Aspect rules a DOMAIN. A god of that domain (even a Daimon) shields the
   people when catastrophe strikes within it — the better the tier, the more it
   averts. This is the early game's chief reason to name gods quickly. */
export const DOMAIN_LABEL = Object.freeze({
  sky: "the storm-sky", sea: "the sea", earth: "the soil", hearth: "hearth & health",
  forge: "fire & stone", wild: "the wilds", vine: "the vine", war: "war & strife",
});

/* Domain flavour woven into the multi-scene Mythic Cycle for each Aspect. */
export const MYTH_FLAVOR = Object.freeze({
  sky:    { foe: "a tempest-eagle of black cloud",     place: "the lightning-struck peak", icon: "🌩️" },
  sea:    { foe: "a serpent risen from the deep",      place: "the storm-wracked shore",   icon: "🐉" },
  earth:  { foe: "a grey blight-wyrm in the furrows",  place: "the failing fields",        icon: "🐛" },
  hearth: { foe: "a fire-thief spirit",                place: "the darkened hearth-hall",  icon: "🔥" },
  forge:  { foe: "a molten daemon of the kiln",        place: "the roaring forge",         icon: "🌋" },
  wild:   { foe: "the Great Boar of the marches",      place: "the deep wood",             icon: "🐗" },
  vine:   { foe: "a raving madness of the vine",       place: "the reeling hills",         icon: "🍷" },
  war:    { foe: "a host of bronze-clad raiders",      place: "the bloodied marches",      icon: "⚔️" },
});

/* The Mythic Cycle — a short, branching TEXT STORY a god must survive to ascend.
   Scenes branch by the resources the player can muster; the final scene resolves
   by `odds` (prepared paths are likelier). Substitutions: {foe} {place} {god} {city}. */
export const MYTH_STORY = [
  { id: 0, title: "The Summons",
    text: "In {place}, {foe} rises against the people of {city}. The cult of {god} must answer the omen, or be forgotten by the generations to come.",
    options: [
      { label: "Raise a war-band and march to meet it", cost: { cattle: 6, grain: 12 }, resolve: 3, to: 1 },
      { label: "Seek a sign with sacrifice at the altar", cost: { piety: 14 }, resolve: 3, to: 2 },
      { label: "Send a lone champion, trusting to glory", cost: { kleos: 18 }, resolve: 2, to: 3 },
    ] },
  { id: 1, title: "The Muster",
    text: "Your warriors mass at the edge of {place}. {foe} is cunning, and the levies are afraid.",
    options: [
      { label: "Press the assault with full supplies", cost: { grain: 14, cattle: 4 }, resolve: 4, to: 4 },
      { label: "Fall back and lay a patient ambush", cost: {}, resolve: 1, to: 5 },
    ] },
  { id: 2, title: "The Omen",
    text: "The altar-smoke twists into a shape only the eldest priestess can read. She names a price for the god's favour.",
    options: [
      { label: "Heed the omen; fast and purify three days", cost: { grain: 10 }, resolve: 4, to: 4 },
      { label: "Defy the omen and strike at once", cost: {}, resolve: 0, to: 5 },
    ] },
  { id: 3, title: "The Champion",
    text: "Your champion walks alone toward {foe}, the hopes of {city} upon their shoulders.",
    options: [
      { label: "Arm them with the city's finest bronze", cost: { timber: 10, cattle: 3 }, resolve: 4, to: 4 },
      { label: "Let them go with only their courage", cost: {}, resolve: 1, to: 5 },
    ] },
  { id: 4, title: "The Reckoning", final: true, odds: 0.78,
    text: "Prepared, resolute and well-led, the people of {city} close upon {foe} for the final reckoning. Even so, the outcome rests with the god — and the god is not yet sure of them." },
  { id: 5, title: "The Reckoning", final: true, odds: 0.38,
    text: "Half-ready and short of supply, the people must still face {foe}. It will be a desperate, bloody thing, and many may not return." },
];

/* MIRACLES — a happy Heros/Olympian may be invoked (for Piety, on a cooldown) to
   bend fate in its domain: it averts the soonest looming threat there, or — if
   none looms — grants a domain bounty. Keyed by Aspect/domain. */
export const MIRACLES = Object.freeze({
  sky:    { name: "Stay the Storm",    bounty: { grain: 14 } },
  sea:    { name: "Calm the Waters",   bounty: { grain: 12, cattle: 4 } },
  earth:  { name: "Quicken the Soil",  bounty: { grain: 18 } },
  hearth: { name: "Purify the Wells",  bounty: { piety: 14 } },
  forge:  { name: "Steady the Stone",  bounty: { clay: 16, stone: 8 } },
  wild:   { name: "Turn the Beasts",   bounty: { cattle: 8 } },
  vine:   { name: "Bless the Vintage", bounty: { grapes: 12, kleos: 4 } },
  war:    { name: "Rout the Raiders",  bounty: { kleos: 8, cattle: 5 } },
});

/* The Aspect deck — the untamed forces the dark-age Greeks feared or relied on. */
export const ASPECTS = {
  sky:    { name: "The Sky",    sub: "Cloud-Gatherer",   god: "Zeus",       icon: "🌩️", desc: "Weather, lightning and rainfall." },
  sea:    { name: "The Sea",    sub: "Earth-Shaker",     god: "Poseidon",   icon: "🌊", desc: "Coastlines, fishing and seafaring." },
  earth:  { name: "The Earth",  sub: "Grain-Bringer",    god: "Demeter",    icon: "🌾", desc: "Soil, crops and the turning of decay." },
  hearth: { name: "The Hearth", sub: "Home-Keeper",      god: "Hestia",     icon: "🔥", desc: "The village flame, family and health." },
  forge:  { name: "The Forge",  sub: "Smith-of-Fire",    god: "Hephaistos", icon: "🔨", desc: "Fire tamed to craft — kiln, tool and bronze." },
  wild:   { name: "The Wild",   sub: "Mistress of Beasts", god: "Artemis",  icon: "🏹", desc: "Forest, hunt and the untamed marches." },
  vine:   { name: "The Vine",   sub: "Loosener of Care",  god: "Dionysos",  icon: "🍷", desc: "Wine, revel and the wild rebirth of spring." },
  war:    { name: "The War",    sub: "Sacker of Cities",  god: "Ares",      icon: "⚔️", desc: "Battle-lust, strife and the bronze spear." },
};

/* The Epithet deck — titles naming the god's work for this town. */
export const EPITHETS = {
  soter:      { name: "Soter",      sub: "The Protector",          icon: "🛡️", desc: "Defensive favour; calms citizen panic." },
  georgos:    { name: "Georgos",    sub: "The Farmer",             icon: "🌱", desc: "Swells the standing grain." },
  agoraia:    { name: "Agoraia",    sub: "Overseer of Markets",    icon: "⚖️", desc: "Improves barter — timber, clay and oil." },
  xenios:     { name: "Xenios",     sub: "The Host",               icon: "🤝", desc: "Aids diplomacy and attracts bards (Kleos)." },
  nomios:     { name: "Nomios",     sub: "The Herdsman",           icon: "🐂", desc: "Fattens the herds; cattle multiply." },
  polemios:   { name: "Polemios",   sub: "The Warlike",            icon: "🗡️", desc: "Hardens the people for war; eases conquest, wards raiders." },
  ktesios:    { name: "Ktesios",    sub: "Guardian of Stores",     icon: "🏺", desc: "Watches the storeroom — grain and clay are kept." },
  boulaios:   { name: "Boulaios",   sub: "Of the Council",         icon: "🗣️", desc: "Wise counsel; renown grows and tempers cool." },
  // Rare — never drawn; only forged through a Mythic Cycle.
  asphaleios: { name: "Asphaleios", sub: "Securer of Foundations", icon: "🪨", desc: "Calms the people and stays the earth — earthquakes never strike." },
};

/* The drawable Epithets (asphaleios is myth-only). */
export const DRAWABLE_EPITHETS = ["soter", "georgos", "agoraia", "xenios", "nomios", "polemios", "ktesios", "boulaios"];

/* A consecrated god's standing per-turn blessing, by Epithet (at the Heros /
   Tier-2 baseline). The tier multiplier and happiness scale these; harmony and
   myth-won traits modulate them. `diplo`/`martial` ease hamlet integration.
   Single source of truth for applyOnePerk() and blessingLine(). */
export const EPITHET_EFFECT = Object.freeze({
  georgos:    { grain: 6 },
  agoraia:    { timber: 3, clay: 3, olives: 2 },
  xenios:     { kleos: 3, diplo: true },
  soter:      { calm: 2 },
  nomios:     { cattle: 2 },
  polemios:   { calm: 1, martial: true, ward: ["wolves"] },
  ktesios:    { grain: 3, clay: 2 },
  boulaios:   { kleos: 2, calm: 1, diplo: true },
  asphaleios: { calm: 2, ward: ["quake"] },
});
export const WARD_NAME = Object.freeze({ quake: "earthquakes", plague: "plague", blight: "blight", wolves: "raiders & wolves", tempest: "sea-storms" });

/* Harmonious Aspect→Epithet pairings yield strong, steady gods; any other
   pairing makes a "confused" deity of feeble, erratic blessings. Many aspects
   harmonise with several epithets, and most epithets suit several aspects, so
   there are many viable gods to chase. */
export const HARMONY = {
  sky:    ["soter", "xenios", "boulaios", "polemios"],
  sea:    ["soter", "agoraia", "nomios", "asphaleios"],
  earth:  ["georgos", "agoraia", "ktesios", "nomios"],
  hearth: ["soter", "xenios", "boulaios", "asphaleios"],
  forge:  ["agoraia", "ktesios", "polemios"],
  wild:   ["soter", "nomios", "polemios", "ktesios"],
  vine:   ["xenios", "georgos", "boulaios"],
  war:    ["polemios", "soter", "nomios"],
};
