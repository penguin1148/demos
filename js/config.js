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
  YEARS_PER_TURN:    1.25,  // each Dawn-Era turn spans 1.25 years (year counter rounds)
  PHASE_NAME:        "The Dawn Era",
  // Base grain each citizen eats per turn. Early survival is meant to bite:
  // farming alone barely breaks even, so a single bad year or unshielded
  // catastrophe can spell famine — pushing players to name protective gods fast.
  GRAIN_PER_CITIZEN: 0.85,

  // Global throttle on passive resource generation, to curb the late-game
  // hoarding that made events feel trivial. Grain is throttled more gently so
  // bare subsistence stays viable.
  PRODUCTION_MULT:       0.8,    // non-grain trades (timber, clay, olives, grapes, cattle)
  GRAIN_PRODUCTION_MULT: 0.95,   // grain (food) — cut only lightly, to keep subsistence viable

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

  // Escalating STAKES. The costs and damages of essentially every event,
  // decision and purchase are multiplied by these as the era wears on, so a
  // mature, resource-hoarding Polis still feels them. Tiers are checked high
  // turn → low; below the first threshold the multiplier is 1×. (The era now
  // runs ~120 turns at 1.25 years each, so the steep tiers bite near the end.)
  EVENT_STAKES: [
    { fromTurn: 100, mult: 6.0 },
    { fromTurn: 75,  mult: 4.0 },
    { fromTurn: 50,  mult: 2.5 },
    { fromTurn: 25,  mult: 1.6 },
  ],
  // Grain costs/damages are exempt from the escalation for the first 50 turns,
  // so early subsistence stays survivable while everything else ramps up.
  GRAIN_STAKE_EXEMPT_UNTIL: 50,

  // Yield fraction earned by workers crammed past a trade's work-site capacity.
  OVERCAP_FACTOR: 0.3,

  // THREAT-FORECAST CLOCK. Dangers (domain crises and catastrophes) are no
  // longer rolled the instant they strike: they are scheduled a few years ahead
  // as visible omens, so the player can prepare (name a domain god, stockpile,
  // brace). These tune how many threats loom and how much warning each gives.
  THREAT_HORIZON:      3,      // most threats allowed pending (on the horizon) at once
  THREAT_SCHEDULE_CHANCE: 0.34, // chance per turn of scheduling a new threat (while below the horizon)
  THREAT_CAT_WEIGHT:   0.18,   // fraction of scheduled threats that are catastrophes (rest are crises)
  CRISIS_LEAD:    [2, 4],      // [min,max] turns of warning before a crisis strikes
  CATASTROPHE_LEAD: [3, 6],    // [min,max] turns of warning before a catastrophe strikes
});

/* The FSM states the game can occupy. */
export const GameStatus = Object.freeze({
  BOOT:    "BOOT",     // before initialization
  PLAYING: "PLAYING",  // accepting turns
  ENDED:   "ENDED",    // era complete (or settlement collapsed)
});

/*
 * The trades, each tied to a resource and a finite number of WORK-SITES
 * (`capacity`): tillable plots, grazing runs, clay faces, etc. Workers up to a
 * trade's capacity yield in full; any beyond it crowd the same ground and yield
 * only OVERCAP_FACTOR of normal. Capacity is expanded by tech, buildings and
 * absorbed hamlets — so a growing city must open new ground, not just reassign.
 */
export const JOBS = Object.freeze({
  farmers:      { icon: "🌾", name: "Farmers",       yields: "grain",  capacity: 64, site: "tillable plots" },
  herders:      { icon: "🐄", name: "Herders",       yields: "cattle", capacity: 26, site: "grazing runs"   },
  woodcutters:  { icon: "🪓", name: "Woodcutters",   yields: "timber", capacity: 30, site: "wood-lots"      },
  potters:      { icon: "🏺", name: "Potters",       yields: "clay",   capacity: 24, site: "clay faces"     },
  oliveGrowers: { icon: "🫒", name: "Olive Tenders", yields: "olives", capacity: 20, site: "olive terraces" },
  vintners:     { icon: "🍇", name: "Vintners",      yields: "grapes", capacity: 18, site: "vine rows"      },
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
