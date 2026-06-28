import { CONFIG } from "./config.js";
import { GameState } from "./state.js";
import { CATASTROPHES, CRISES } from "./content.js";
import { DOMAIN_LABEL } from "./religionData.js";
import { logChronicle, pick } from "./engine.js";
import { triggerCatastropheFor, triggerCrisisFor } from "./culture.js";
import { domainGod } from "./religion.js";

/* ===================================================================
   THREAT-FORECAST CLOCK
   Dangers are no longer rolled the instant they strike. They are posted to a
   visible horizon a few years ahead as omens, so the player can read the board
   and prepare — above all by naming a god of the threatened domain. When a
   threat's appointed year arrives it strikes through the usual crisis flow.
   =================================================================== */

/** How many years off a pending threat is, for read-outs. */
export function threatYearsOff(t) {
  return Math.max(1, Math.round((t.due - GameState.turn) * CONFIG.YEARS_PER_TURN));
}

/** The consecrated god (if any) that will shield a threat's domain. */
export function threatGuardian(t) {
  return domainGod(t.domain);
}

/** Pending threats, soonest first — for the forecast strip & coverage panel. */
export function forecast() {
  return [...GameState.threats].sort((a, b) => a.due - b.due);
}

/** Post a new omen to the horizon (most turns, while below the horizon cap). */
export function scheduleThreats() {
  if (GameState.threats.length >= CONFIG.THREAT_HORIZON) return;
  if (GameState.turn < 6) return;                                   // a grace period to find footing
  if (Math.random() >= CONFIG.THREAT_SCHEDULE_CHANCE) return;

  const isCat = GameState.turn >= 16 && Math.random() < CONFIG.THREAT_CAT_WEIGHT;
  const pool  = isCat ? CATASTROPHES : CRISES;
  // Prefer a danger not already looming, for variety.
  let ev = pick(pool);
  for (let i = 0; i < 4 && GameState.threats.some(t => t.id === ev.id); i++) ev = pick(pool);
  if (GameState.threats.some(t => t.id === ev.id)) return;

  const lead = isCat ? CONFIG.CATASTROPHE_LEAD : CONFIG.CRISIS_LEAD;
  const due  = GameState.turn + lead[0] + Math.floor(Math.random() * (lead[1] - lead[0] + 1));
  GameState.threats.push({ type: isCat ? "catastrophe" : "crisis", id: ev.id, name: ev.name, icon: ev.icon, domain: ev.domain, due });

  const guarded = domainGod(ev.domain);
  logChronicle(
    `☍ Omen — ${ev.icon} ${ev.name} (${DOMAIN_LABEL[ev.domain]}) gathers on the horizon, ` +
    `some ${threatYearsOff(GameState.threats[GameState.threats.length - 1])} years hence` +
    (isCat ? ", a CATASTROPHE in the making" : "") + ". " +
    (guarded ? "A god of that domain stands ready." : "No god of that domain yet guards the people."),
    "warning"
  );
}

/** Strike any threat whose year has come. Fires at most one per turn (the most
 *  severe / soonest); any others also due are deferred a year. Returns true if a
 *  blocking crisis/catastrophe modal was opened. */
export function fireDueThreats() {
  const due = GameState.threats.filter(t => t.due <= GameState.turn);
  if (!due.length) return false;

  // Catastrophes take precedence, then the soonest.
  due.sort((a, b) => (a.type !== b.type ? (a.type === "catastrophe" ? -1 : 1) : a.due - b.due));
  const t = due[0];
  GameState.threats = GameState.threats.filter(x => x !== t);
  // Defer any other threats also due this year by one turn, so only one strikes.
  GameState.threats.forEach(x => { if (x.due <= GameState.turn) x.due = GameState.turn + 1; });

  if (t.type === "catastrophe") triggerCatastropheFor(t.id);
  else                          triggerCrisisFor(t.id);
  return true;
}
