import { CONFIG } from "./config.js";
import { GameState } from "./state.js";
import { logChronicle, pick } from "./engine.js";

/* ===================================================================
   CLIMATE — multi-year weather phases
   Rotating spells that favour some trades and punish others (and shift how much
   grain is eaten), so the best labour allocation changes every few years and the
   player must keep re-reading the fields. Each phase announces itself and runs a
   handful of turns. (Great Winters remain a separate, sharper recurring event.)
   =================================================================== */

/* yield: per-trade output multipliers (omitted = 1). grainNeed: food-need mult. */
export const CLIMATE_PHASES = {
  fair: {
    name: "Fair Years", icon: "🌤️",
    blurb: "Kind, even weather — no trade is favoured over another.",
    yield: {}, grainNeed: 1.0,
  },
  wet: {
    name: "Wet Years", icon: "🌧️",
    blurb: "Rain swells the grain and the vines, but bogs the clay-pits and sodden the herds.",
    yield: { farmers: 1.2, vintners: 1.15, woodcutters: 1.1, potters: 0.85, herders: 0.9 },
    grainNeed: 1.0,
  },
  dry: {
    name: "Dry Years", icon: "☀️",
    blurb: "Parched fields, but the olives love it, the herds range far, and the clay digs easily.",
    yield: { farmers: 0.82, vintners: 0.9, oliveGrowers: 1.3, herders: 1.2, potters: 1.15 },
    grainNeed: 1.0,
  },
  cold: {
    name: "Bitter Years", icon: "🌫️",
    blurb: "A long chill — grain comes thin and more is eaten, but the woodcutters fare well.",
    yield: { farmers: 0.78, oliveGrowers: 0.6, vintners: 0.7, woodcutters: 1.2, herders: 0.9 },
    grainNeed: 1.12,
  },
};

const PHASE_IDS = Object.keys(CLIMATE_PHASES);

/** The active climate phase definition. */
export function currentClimate() {
  return CLIMATE_PHASES[GameState.climate.id] || CLIMATE_PHASES.fair;
}

/** A trade's current climate yield multiplier. */
export function climateYield(jobKey) {
  return currentClimate().yield[jobKey] ?? 1;
}

/** The current climate's grain-need multiplier. */
export function climateGrainNeed() {
  return currentClimate().grainNeed ?? 1;
}

/** Advance the climate: when the current phase elapses, turn to a new one
 *  (never the same twice running) and announce it. */
export function tickClimate() {
  if (GameState.turn < GameState.climate.until) return;
  const [lo, hi] = CONFIG.CLIMATE_PHASE_LEN;
  const len = lo + Math.floor(Math.random() * (hi - lo + 1));
  let next = pick(PHASE_IDS);
  for (let i = 0; i < 4 && next === GameState.climate.id; i++) next = pick(PHASE_IDS);
  GameState.climate = { id: next, until: GameState.turn + len };
  const c = CLIMATE_PHASES[next];
  logChronicle(`${c.icon} The seasons turn — ${c.name} settle over the land. ${c.blurb}`, "system");
}
