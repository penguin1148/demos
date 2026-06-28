import { CONFIG, GameStatus, HEKATOMB, JOBS, YIELD } from "./config.js";
import { RELIGION, TIER_NAME } from "./religionData.js";
import { GameState } from "./state.js";
import { DAWN_EVENTS, STAT_META } from "./content.js";
import { triggerCatastrophe, triggerChoiceEvent, triggerCrisis, triggerGodEvent } from "./culture.js";
import { beginPhoenician, triggerMerchant } from "./merchants.js";
import { openFestival } from "./festival.js";
import { applyGodPerks, godName, grantEpiphany, tickGods } from "./religion.js";
import { render, renderLogEntry } from "./render.js";
import { tickSocialOrders } from "./social.js";

/* ===================================================================
   ENGINE LOGIC
   =================================================================== */

/** Convert internal year value to a display string (e.g. "900 BC"). */
export function formatYear(y) {
  return y > 0 ? `${y} BC` : `${Math.abs(y) + 1} AD`;
}

/** Pick a random element from an array. */
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/**
 * The escalating stakes multiplier for the given turn. Event costs and damages
 * are scaled by this so a hoarded surplus still feels them as the era matures.
 * (Tiers defined in CONFIG.EVENT_STAKES; 1× before the first threshold.)
 */
export function eventStakes(turn = GameState.turn) {
  for (const tier of CONFIG.EVENT_STAKES) if (turn >= tier.fromTurn) return tier.mult;
  return 1;
}

/** Scale a DAMAGE/stat bundle by the current era's stakes, with grain exempt for
 *  the first GRAIN_STAKE_EXEMPT_UNTIL turns. (Sign-preserving; for event tolls.) */
export function stakeScale(bundle, turn = GameState.turn) {
  const m = eventStakes(turn);
  if (m === 1) return { ...bundle };
  const grainExempt = turn < CONFIG.GRAIN_STAKE_EXEMPT_UNTIL;
  const out = {};
  for (const k in bundle) {
    const v = bundle[k];
    if (typeof v !== "number" || v === 0) { out[k] = v; continue; }
    const mult = (k === "grain" && grainExempt) ? 1 : m;
    const s = Math.round(v * mult);
    out[k] = s !== 0 ? s : (v > 0 ? 1 : -1);
  }
  return out;
}

/** Format a stat-change object as readable text, e.g. "−30 Grain, −6 Population". */
export function formatChanges(obj) {
  const parts = Object.keys(obj).map(k => {
    const v = obj[k];
    const label = STAT_META[k] ? STAT_META[k].label : k;
    return `${v >= 0 ? "+" : "−"}${Math.abs(v)} ${label}`;
  });
  return parts.join(", ");
}

/**
 * Append an entry to the chronicle and (if mounted) the log panel.
 * @param {string} text  The message body.
 * @param {string} kind  "system" | "turn" | "event" | "warning"
 */
export function logChronicle(text, kind = "turn") {
  const entry = { year: GameState.year, text, kind };
  GameState.chronicle.push(entry);
  renderLogEntry(entry);
}

/**
 * Apply a set of stat changes, clamping at zero, and record net deltas.
 * @param {Object} changes  e.g. { grain: +10, population: -2 }
 */
export function applyStats(changes) {
  for (const key in changes) {
    if (!(key in GameState.stats)) continue;
    const before = GameState.stats[key];
    const after = Math.max(0, before + changes[key]);
    GameState.stats[key] = after;
    GameState.lastDeltas[key] = (GameState.lastDeltas[key] || 0) + (after - before);
  }
}

/** Divide the population among the trades according to the player's weights. */
export function assignJobs(population) {
  const w = GameState.jobAllocation;
  let total = 0;
  for (const key in JOBS) total += (w[key] || 0);
  if (total <= 0) total = 1;
  // Citizens given over to full-time priesthood no longer work the land.
  const workforce = Math.max(0, population - (GameState.priests || 0));
  const counts = {};
  for (const key in JOBS) counts[key] = Math.round(workforce * (w[key] || 0) / total);
  return counts;
}

/**
 * Process the deterministic part of a timeline tick:
 * passive production from labour, grain consumption / starvation,
 * surplus-driven population growth, then the cultural systems
 * (altar piety and Kleos-driven migration).
 */
export function processTick() {
  const s = GameState.stats;

  // --- Labour: assign jobs and produce resources passively ---
  const jobs = assignJobs(s.population);
  GameState.jobs = jobs;

  // Base production from labour.
  const prod = {
    grain:  jobs.farmers      * YIELD.grain,
    timber: jobs.woodcutters  * YIELD.timber,
    clay:   jobs.potters      * YIELD.clay,
    olives: jobs.oliveGrowers * YIELD.olives,
    grapes: jobs.vintners     * YIELD.grapes,
    cattle: Math.floor(jobs.herders * YIELD.cattle),
  };

  // Permanent bonuses from hamlets absorbed via synoikismos.
  for (const key in GameState.bonuses) {
    prod[key] = (prod[key] || 0) + GameState.bonuses[key];
  }
  // Standing bonuses from researched technologies (Terraced Farming, etc.).
  for (const key in GameState.techBonus) {
    if (GameState.techBonus[key]) prod[key] = (prod[key] || 0) + GameState.techBonus[key];
  }

  // Global scarcity throttle on generation (grain cut more gently than the rest).
  for (const key in prod) {
    const scarcity = key === "grain" ? CONFIG.GRAIN_PRODUCTION_MULT : CONFIG.PRODUCTION_MULT;
    prod[key] = prod[key] * scarcity;
  }

  // Civil unrest (from a failed annexation) throttles all production.
  const factor = GameState.unrest > 0 ? CONFIG.UNREST_FACTOR : 1;
  for (const key in prod) prod[key] = Math.floor(prod[key] * factor);

  const grainProduced = prod.grain;   // grain grown this turn (for the growth model)
  applyStats(prod);

  if (GameState.unrest > 0) {
    logChronicle(
      `Civil unrest grips the Polis — production falters ` +
      `(${GameState.unrest} ${GameState.unrest === 1 ? "turn" : "turns"} remaining).`,
      "warning"
    );
    GameState.unrest -= 1;
  }

  // --- Consumption: every citizen eats grain (more so in a Great Winter) ---
  const coldMult = GameState.winter > 0 ? 1.25 : 1;
  const needed = Math.ceil(s.population * CONFIG.GRAIN_PER_CITIZEN * coldMult);

  let starving = false;
  if (s.grain >= needed) {
    // The settlement is fed; a sustainable per-turn surplus supports growth.
    applyStats({ grain: -needed });
    const turnSurplus = grainProduced - needed;   // what this year's harvest spared

    let growth = Math.max(0, Math.floor(turnSurplus / 25));
    if (s.olives > 0) growth += 1;                              // health & hygiene
    if (s.grapes > 0 && GameState.turn % 2 === 0) growth += 1;  // festivals & births
    growth -= Math.floor(GameState.unhappiness / 8);            // discontent dampens growth
    growth = Math.max(0, Math.min(growth, 6));                  // modest absolute cap (no runaway)

    if (growth > 0) {
      applyStats({ population: +growth });
      logChronicle(`The people prosper; ${growth} new souls join the Demos.`, "turn");
    }
  } else {
    // Granaries run dry — STARVATION.
    const deficit = needed - s.grain;
    applyStats({ grain: -s.grain });   // empty the granary
    const starved = Math.min(s.population, Math.max(1, Math.ceil(deficit)));
    applyStats({ population: -starved });
    logChronicle(
      `⚠ The granaries lie empty — famine claims ${starved} ${starved === 1 ? "soul" : "souls"}.`,
      "warning"
    );
    GameState.unhappiness += 3;   // hunger breeds discontent
    starving = true;
  }

  // Grain cannot be hoarded forever in this early era — surplus beyond a few
  // years' supply spoils in the storage pits, keeping famine a real threat.
  const grainCap = Math.max(120, needed * 5);
  if (GameState.stats.grain > grainCap) {
    applyStats({ grain: -(GameState.stats.grain - grainCap) });
  }

  // --- Religion: gods take their upkeep, grow happy or sour, and bless the city ---
  tickGods();
  applyGodPerks();

  // --- Social Orders: this year's labour split and harvest reshape each rank's
  //     Clout & Satisfaction, and with them the Polis's Discontent. ---
  tickSocialOrders(grainProduced - needed);

  // --- Knowledge: workers generate Ergon, cultural life generates Muthos.
  //     A starving or crisis-stricken people invent nothing this year. ---
  const halt = starving || !!GameState.pendingCrisis;
  GameState.research.halted = halt;
  GameState.research.reason = starving ? "famine" : GameState.pendingCrisis ? "crisis" : "";
  if (!halt) {
    const workforce = Math.max(0, s.population - (GameState.priests || 0));
    const ergonGain  = Math.max(1, Math.round(workforce * 0.06 * GameState.ergonMult));
    const happyGods  = GameState.gods.filter(g => g.happiness >= RELIGION.HAPPY).length;
    const muthosGain = Math.round((1 + happyGods + GameState.macros.kleos * 0.04) * GameState.muthosMult);
    GameState.ergon  += ergonGain;
    GameState.muthos += muthosGain;
    GameState.lastErgon = ergonGain; GameState.lastMuthos = muthosGain;
  } else {
    GameState.lastErgon = 0; GameState.lastMuthos = 0;
  }

  // --- Renown: high Kleos draws wandering migrants; glory then fades ---
  const kleos = GameState.macros.kleos;
  if (kleos > 0) {
    const chance = Math.min(0.55, 0.04 + kleos / 400);
    if (Math.random() < chance) {
      const migrants = 2 + Math.floor(kleos / 40) + Math.floor(Math.random() * 3);
      applyStats({ population: +migrants });
      logChronicle(
        `Drawn by the renown of ${GameState.cityName}, ${migrants} wandering folk settle among you.`,
        "event"
      );
    }
    GameState.macros.kleos = Math.max(0, kleos - 1);   // glory slowly fades
  }

  // --- Civic mood: deep discontent drives families away; it then settles ---
  if (GameState.unhappiness >= 15) {
    const leavers = Math.min(GameState.stats.population, 2 + Math.floor((GameState.unhappiness - 15) / 5));
    applyStats({ population: -leavers });
    logChronicle(
      `Discontent festers; ${leavers} disillusioned ${leavers === 1 ? "soul leaves" : "souls leave"} the Demos.`,
      "warning"
    );
  }
  if (GameState.unhappiness > 0) GameState.unhappiness = Math.max(0, GameState.unhappiness - 1);
}

/**
 * THE CORE TURN FUNCTION.
 * Advances state, processes the timeline tick, rolls events and crises,
 * and writes feedback to the Chronicle. Guards against running outside
 * the PLAYING state, or while a crisis awaits a decision.
 */
export function nextTurn() {
  if (GameState.status !== GameStatus.PLAYING) return;
  if (GameState.pendingCrisis || GameState.pendingFestival || GameState.pendingEpiphany || GameState.pendingMyth || GameState.pendingChoice || GameState.pendingPhoenician) return;   // must be answered first

  // --- 1. Advance the clock ---
  GameState.turn += 1;
  // Year is detached from the turn count: each turn spans CONFIG.YEARS_PER_TURN
  // years, rounded to the nearest year for the BC counter.
  GameState.year = CONFIG.START_YEAR - Math.round(GameState.turn * CONFIG.YEARS_PER_TURN);
  GameState.lastDeltas = {};                  // reset net-change tracking

  logChronicle(`Turn ${GameState.turn} begins. The year is ${formatYear(GameState.year)}.`, "turn");

  // --- 1a. The seasons: a five-year Great Winter recurs across the era ---
  const w = GameState.turn % 30;
  const wasWinter = GameState.winter > 0;
  GameState.winter = (w >= 1 && w <= 5) ? (6 - w) : 0;
  if (GameState.winter > 0 && !wasWinter)
    logChronicle("A Great Winter closes upon the hills; the cold deepens and grain is eaten faster.", "warning");

  // --- 1b. Every tenth year: the Hekatomb Festival replaces the normal tick ---
  if (GameState.turn % HEKATOMB.INTERVAL === 0) {
    openFestival();
    render();
    return;
  }

  // --- 2. Deterministic production / consumption tick ---
  processTick();
  let blocked = !!GameState.pendingMyth;

  // --- 3. Stochastic historical flavour (~45% chance) ---
  if (!blocked && Math.random() < 0.45) {
    const ev = pick(DAWN_EVENTS);
    // Misfortunes escalate with the era's stakes (grain-exempt early); boons stay modest.
    const neg = {}, pos = {};
    for (const k in ev.stats) (ev.stats[k] < 0 ? neg : pos)[k] = ev.stats[k];
    applyStats({ ...pos, ...stakeScale(neg) });
    logChronicle(ev.text, "event");
  }

  // --- 4. A rare CATASTROPHE — ruinous without a god of its domain (rises after the early years) ---
  const catChance = CONFIG.CATASTROPHE_CHANCE * (GameState.turn < 20 ? 0.4 : 1);
  if (!blocked && Math.random() < catChance) {
    triggerCatastrophe();
    blocked = true;
  }

  // --- 4a. An ordinary domain crisis (mitigated by a matching god) ---
  if (!blocked && Math.random() < CONFIG.CRISIS_CHANCE) {
    triggerCrisis();
    blocked = true;
  }

  // --- 4b. A respond-able flavour event the player answers ---
  if (!blocked && Math.random() < CONFIG.CHOICE_EVENT_CHANCE) {
    triggerChoiceEvent();
    blocked = true;
  }

  // --- 4b-ii. A happiness fork upon one of the gods ---
  if (!blocked && GameState.gods.length > 0 && Math.random() < CONFIG.GOD_EVENT_CHANCE) {
    triggerGodEvent();
    blocked = true;
  }

  // --- 4b-iii. The Phoenician negotiation, or a passing foreign merchant (Docks) ---
  if (!blocked && GameState.buildings.docks) {
    const phoenReady = !GameState.techs.alphabet && !GameState.alphabetUnlocked &&
      GameState.turn - GameState.docksTurn >= 12 &&
      GameState.turn - GameState.phoenicianFailTurn >= 20;   // a generation must pass after a failed courtship
    if (phoenReady && Math.random() < 0.10) {
      beginPhoenician();
      blocked = true;
    } else if (Math.random() < CONFIG.MERCHANT_CHANCE) {
      triggerMerchant();
      blocked = true;
    }
  }

  // --- 4c. A Divine Epiphany every few years once the Hearth burns ---
  if (!blocked && GameState.hearthBuilt &&
      GameState.turn > GameState.hearthTurn &&
      (GameState.turn - GameState.hearthTurn) % RELIGION.EPIPHANY_INTERVAL === 0) {
    grantEpiphany();
  }

  // --- 5. FSM transitions: collapse or era completion ---
  if (GameState.stats.population <= 0) {
    collapse();
  } else if (GameState.year <= CONFIG.END_YEAR) {
    endEra();
  }

  // --- 6. Repaint UI (crisis modal, if any, was already opened) ---
  render();
}

/** FSM transition: PLAYING -> ENDED (successful close of the era). */
export function endEra() {
  if (GameState.status === GameStatus.ENDED) return;
  GameState.status = GameStatus.ENDED;
  if (GameState.alphabetWin) {
    logChronicle(
      `In the year ${formatYear(GameState.year)}, with the Phoenician letters mastered, the Polis writes down its laws, ` +
      `its gods and its deeds. The Dawn Era closes in triumph — ${GameState.cityName} steps out of legend and into history.`,
      "event"
    );
  } else {
    logChronicle(
      `The Dawn Era draws to a close. After ${GameState.turn} years, ${GameState.cityName} stands ready for the age to come.`,
      "system"
    );
  }
  const pantheon = GameState.gods;
  if (pantheon.length) {
    const olympians = pantheon.filter(g => g.tier === 3);
    logChronicle(
      `The pantheon passes into the Archaic Era: ${pantheon.map(g => `${godName(g)} (${TIER_NAME[g.tier]})`).join(", ")}.` +
      (olympians.length
        ? ` ${olympians.map(g => godName(g)).join(" and ")} ascend as true Olympian${olympians.length > 1 ? "s" : ""}, whose cults will shape the age to come.`
        : ` No god was raised to Olympian heights — the deities of Demos remain local powers.`),
      olympians.length ? "event" : "system"
    );
  } else {
    logChronicle("No gods were ever named; Demos enters the Archaic Era without a pantheon of its own.", "warning");
  }
}

/** FSM transition: PLAYING -> ENDED (the settlement has died out). */
export function collapse() {
  GameState.status = GameStatus.ENDED;
  logChronicle(
    `The last hearths of ${GameState.cityName} grow cold. The settlement is abandoned.`,
    "warning"
  );
}
