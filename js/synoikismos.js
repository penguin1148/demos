import { CONFIG, GameStatus } from "./config.js";
import { GameState } from "./state.js";
import { INTEGRATION_STAGES, STAT_META } from "./content.js";
import { logChronicle } from "./engine.js";
import { afterAction } from "./merchants.js";
import { canAfford, costText, hasAnyGod, hasDiplomaticGod, hasHarmoniousGod, hasMartialGod, spendObj } from "./religion.js";
import { renderAdmin } from "./render.js";

/* ===================================================================
   SYNOIKISMOS — uniting neighbouring hamlets into the Polis
   =================================================================== */

/** Look up a runtime hamlet by id. */
export function getHamlet(id) {
  return GameState.hamlets.find(h => h.id === id);
}

/** Human-readable description of a bonus, e.g. "+8 Grain, +6 Clay / turn". */
export function bonusText(bonus) {
  return Object.keys(bonus)
    .map(k => `+${bonus[k]} ${STAT_META[k] ? STAT_META[k].label : k}`)
    .join(", ") + " / turn";
}

/**
 * Fold an absorbed hamlet into the Polis: its people join the city pool
 * and its unique asset becomes a permanent per-turn generation bonus.
 */
export function absorbHamlet(h) {
  h.absorbed = true;
  GameState.stats.population += h.population;   // join the main city pool
  for (const key in h.asset.bonus) {
    GameState.bonuses[key] = (GameState.bonuses[key] || 0) + h.asset.bonus[key];
  }
  logChronicle(
    `${h.name} joins ${GameState.cityName} through synoikismos — ${h.population} souls ` +
    `and their gift of ${h.asset.label} now enrich the Polis.`,
    "system"
  );
}

/* ---------- religion's reach helpers are defined above (hasMartialGod etc.) ---------- */

/** Resolve a stage's overture cost, eased by a fitting pantheon. */
export function integrationCost(stage, kind) {
  const base = stage[kind].cost;
  const cost = {};
  let factor = 1;
  if (kind === "talk") {
    if (hasDiplomaticGod()) factor *= 0.7;             // Xenios/Boulaios gods smooth negotiation
    if (stage.faith) factor *= hasHarmoniousGod() ? 0.6 : (hasAnyGod() ? 1 : 1.6);
  } else {
    if (hasMartialGod()) factor *= 0.7;                // Polemios gods / Slayer cults ease conquest
  }
  for (const k in base) cost[k] = Math.max(1, Math.round(base[k] * factor));
  return cost;
}
/** Civil unrest a forceful overture stirs, softened by a martial god. */
export function integrationUnrest(stage) {
  const u = stage.force.unrest || 0;
  return hasMartialGod() ? Math.ceil(u / 2) : u;
}

/**
 * Take one overture toward a hamlet's integration. Each lands a single stage of
 * its event-chain, after which the hamlet rests (CONFIG.INTEGRATION_GAP years)
 * before the next stage opens. Force breeds unrest; talk drains social goods.
 */
export function attemptIntegration(id, kind) {
  if (GameState.status !== GameStatus.PLAYING || GameState.pendingCrisis || GameState.pendingFestival || GameState.pendingEpiphany || GameState.pendingMyth || GameState.pendingChoice || GameState.pendingPhoenician) return;
  const h = getHamlet(id);
  if (!h || h.absorbed) return;

  if (GameState.turn < h.cooldownUntil) {
    logChronicle(`The people of ${h.name} are still weighing your last overture — give them time before the next.`, "warning");
    afterAction();
    return;
  }
  const stage = INTEGRATION_STAGES[h.stage];
  if (!stage) return;
  const cost = integrationCost(stage, kind);
  if (!canAfford(cost)) {
    logChronicle(`The overture to ${h.name} (${stage.name}) cannot be mounted — ${costText(cost)} is needed.`, "warning");
    renderAdmin();
    return;
  }
  spendObj(cost);

  if (kind === "force") {
    const u = integrationUnrest(stage);
    if (u > 0) { GameState.unrest = Math.max(GameState.unrest, u); GameState.unhappiness += 2; }
    logChronicle(`A heavy-handed overture toward ${h.name} — “${stage.name}” — is pressed by force${u ? `; resentment stirs civil unrest for ${u} years.` : "."}`, "warning");
  } else {
    logChronicle(`A patient, generous overture toward ${h.name} — “${stage.name}” — wins ground through negotiation.`, "event");
  }

  h.stage += 1;
  h.cooldownUntil = GameState.turn + CONFIG.INTEGRATION_GAP;
  if (h.stage >= INTEGRATION_STAGES.length) {
    absorbHamlet(h);
  } else {
    logChronicle(`${h.name}: ${h.stage} of ${INTEGRATION_STAGES.length} stages of synoikismos complete. The people withdraw to consider what comes next.`, "system");
  }
  afterAction();
}
