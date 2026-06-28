/* ===================================================================
   DEMOS — CORE ENGINE
   A central Game State Object driven by a strict Finite State Machine.
   Phase 1: survival economy, synoikismos, and the early cultural/
   religious systems (Kleos & Eusebeia) that bind the people.
   =================================================================== */

/* ---------- Configuration / Constants ---------- */
export const CONFIG = Object.freeze({
  START_YEAR:        900,   // 900 BC
  END_YEAR:          750,   // 750 BC — end of the Dawn Era
  YEARS_PER_TURN:    1,
  PHASE_NAME:        "The Dawn Era",
  // Base grain each citizen eats per turn. Early survival is meant to bite:
  // farming alone barely breaks even, so a single bad year or unshielded
  // catastrophe can spell famine — pushing players to name protective gods fast.
  GRAIN_PER_CITIZEN: 0.85,

  // Synoikismos — drawing neighbouring hamlets into the Polis is no quick
  // conquest but a long event-chain of overtures, mixing aggression and
  // negotiation. A hamlet rests between stages, so unification is the work of
  // many decades and only feasibly completed around turns 70-100.
  INTEGRATION_GAP: 8,    // years a hamlet "considers" between stages of its chain
  UNREST_TURNS:  4,      // turns of civil unrest after a heavy-handed overture
  UNREST_FACTOR: 0.5,    // production multiplier while unrest lasts

  // Hazards. Ordinary crises are common and bite harder when no god of their
  // domain shields the people; rarer CATASTROPHES can gut an unshielded city.
  CRISIS_CHANCE:       0.20,   // chance per turn of an ordinary domain crisis
  CHOICE_EVENT_CHANCE: 0.14,   // chance per turn of a respond-able flavour event
  CATASTROPHE_CHANCE:  0.07,   // chance per turn of a catastrophe (needs a domain god)
  GOD_EVENT_CHANCE:    0.16,   // chance per turn of a happiness fork upon one god
  MERCHANT_CHANCE:     0.22,   // chance per turn a foreign merchant visits (once Docks are built)
});

/* The FSM states the game can occupy. */
export const GameStatus = Object.freeze({
  BOOT:    "BOOT",     // before initialization
  PLAYING: "PLAYING",  // accepting turns
  ENDED:   "ENDED",    // era complete (or settlement collapsed)
});

/*
 * Fixed early-game job assignments. Each turn the population is divided
 * among these trades by these ratios, and each worker passively yields
 * resources. Ratios are intentionally fixed for the Dawn Era; future
 * phases will let the player reassign labour.
 */
export const JOBS = Object.freeze({
  farmers:      { icon: "🌾", name: "Farmers",     yields: "grain"  },
  herders:      { icon: "🐄", name: "Herders",     yields: "cattle" },
  woodcutters:  { icon: "🪓", name: "Woodcutters", yields: "timber" },
  potters:      { icon: "🏺", name: "Potters",     yields: "clay"   },
  oliveGrowers: { icon: "🫒", name: "Olive Tenders", yields: "olives" },
  vintners:     { icon: "🍇", name: "Vintners",    yields: "grapes" },
});

/*
 * Default labour allocation, as relative weights the player may re-balance
 * from the Labor panel. The early city must keep the vast majority of its
 * people farming — drop farmers much below ~40% and the granaries run dry.
 */
export const DEFAULT_ALLOC = Object.freeze({
  farmers: 56, herders: 8, woodcutters: 14, potters: 11, oliveGrowers: 6, vintners: 5,
});

/* Yield per worker, per turn, for the resource that job produces. */
export const YIELD = Object.freeze({
  grain:  2,
  cattle: 0.15,   // cattle accrue slowly (rounded down)
  timber: 1,
  clay:   1,
  olives: 1,
  grapes: 1,
});

/* Civic Investments — cultural & religious actions. */
export const CIVIC = Object.freeze({
  bard:   { grain: 8, cattle: 2, kleos: 6 },           // Fund an Aoidos: +Kleos at once
  hearth: { timber: 22, clay: 16, cattle: 5 },         // Ancestral Hearth: a humble shrine, kindled EARLY so the people may name protective gods in time
});

/* The Hekatomb — a great sacrifice held every tenth turn. */
export const HEKATOMB = Object.freeze({
  INTERVAL:       10,    // a festival every 10th turn
  pietyPerCattle: 5,     // Altar Pool: cattle -> Piety (a massive surge)
  kleosPerGrape:  2,     // Feast Pool: wine -> Kleos
  kleosPerGrain:  0.4,   // Feast Pool: grain -> Kleos
});
