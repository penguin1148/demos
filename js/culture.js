import { CIVIC, GameStatus } from "./config.js";
import { DOMAIN_LABEL, RELIGION, TIER_NAME } from "./religionData.js";
import { GameState } from "./state.js";
import { CATASTROPHES, CHOICE_EVENTS, CRISES, GOD_EVENTS } from "./content.js";
import { collapse, eventStakes, formatChanges, logChronicle, pick, scaleBundle } from "./engine.js";
import { afterAction } from "./merchants.js";
import { closeModal, openModal } from "./festival.js";
import { canAfford, domainGod, gainObj, getGod, godName, grantEpiphany, spendObj } from "./religion.js";
import { render, renderChoice, renderCrisis } from "./render.js";

/* ===================================================================
   CULTURE & RELIGION — Civic Investments and Crises
   =================================================================== */

/** Spend resources outside the turn loop (clamped, no delta tracking). */
export function spend(changes) {
  for (const key in changes) {
    if (!(key in GameState.stats)) continue;
    GameState.stats[key] = Math.max(0, GameState.stats[key] + changes[key]);
  }
}

/** Civic Investment: fund a travelling bard, raising Kleos at once. */
export function fundBard() {
  if (GameState.status !== GameStatus.PLAYING || GameState.pendingCrisis || GameState.pendingFestival || GameState.pendingEpiphany || GameState.pendingMyth || GameState.pendingChoice || GameState.pendingPhoenician) return;
  const c = CIVIC.bard;
  if (GameState.stats.grain < c.grain || GameState.stats.cattle < c.cattle) {
    logChronicle("There is too little to provision a travelling bard.", "warning");
    afterAction();
    return;
  }
  spend({ grain: -c.grain, cattle: -c.cattle });
  GameState.macros.kleos += c.kleos;
  logChronicle(
    `An aoidos sings the deeds of ${GameState.cityName} in far-off halls; ` +
    `its renown grows (+${c.kleos} Kleos).`,
    "event"
  );
  afterAction();
}

/** Civic Investment: raise the Ancestral Hearth (one-time; unlocks the Epiphany). */
export function buildHearth() {
  if (GameState.status !== GameStatus.PLAYING || GameState.pendingCrisis || GameState.pendingFestival || GameState.pendingEpiphany || GameState.pendingMyth || GameState.pendingChoice || GameState.pendingPhoenician) return;
  if (GameState.hearthBuilt) return;
  const c = CIVIC.hearth;
  if (GameState.stats.timber < c.timber || GameState.stats.clay < c.clay || GameState.stats.cattle < c.cattle) {
    logChronicle("The people lack the timber, clay and cattle to raise the Ancestral Hearth.", "warning");
    afterAction();
    return;
  }
  spend({ timber: -c.timber, clay: -c.clay, cattle: -c.cattle });
  GameState.hearthBuilt = true;
  GameState.hearthTurn = GameState.turn;
  logChronicle(
    `The Ancestral Hearth is kindled within a grove upon the hill. Its undying flame opens the people ` +
    `to Divine Epiphany — every ${RELIGION.EPIPHANY_INTERVAL} years a vision grants an Aspect and an Epithet, ` +
    `from which protective Daimones may be named and, over decades, raised to Heroes and Olympians.`,
    "system"
  );
  // The first vision comes at once, so the people may raise their first Daimon.
  grantEpiphany();
}

/* Fraction of a crisis's toll that a domain god of the given tier averts. */
export const DIVINE_AVERT = { 1: 0.45, 2: 0.72, 3: 0.95 };
/** Scale a damage bundle by an averted fraction (rounding toward zero damage). */
export function scaleDamage(dmg, avert) {
  const out = {};
  for (const k in dmg) { const v = Math.ceil(dmg[k] * (1 - avert)); if (v) out[k] = v; }
  return out;
}

/** Copy an event option, scaling only the resources it costs the player. */
function scaleOption(opt, mult) {
  return opt.cost ? { ...opt, cost: scaleBundle(opt.cost, mult) } : opt;
}

/** Roll an ordinary domain crisis and present it for the player's response. The
 *  unshielded toll (and the Piety needed to soften it) scale with the era's stakes. */
export function triggerCrisis() {
  const base = pick(CRISES);
  const m = eventStakes();
  const crisis = { ...base, damage: scaleBundle(base.damage, m), pietyCost: Math.max(1, Math.round(base.pietyCost * m)) };
  GameState.pendingCrisis = crisis;
  logChronicle(`A crisis befalls the Polis: ${crisis.name}!`, "warning");
  renderCrisis();
  openModal("crisis-modal");
}

/**
 * Resolve the pending crisis. A god of the crisis's domain shields the people
 * automatically (scaled by tier); the player may also spend Piety to soften it
 * further, or simply endure.
 * @param {boolean} invoke  true to spend Piety for extra mitigation.
 */
export function resolveCrisis(invoke) {
  const c = GameState.pendingCrisis;
  if (!c) return;
  const god = domainGod(c.domain);
  let dmg = { ...c.damage };
  let note = "";

  if (god) {
    dmg = scaleDamage(dmg, DIVINE_AVERT[god.tier]);
    note = `${godName(god)}, ${TIER_NAME[god.tier]} of ${DOMAIN_LABEL[c.domain]}, shields the people. `;
  }
  if (invoke && GameState.macros.eusebeia >= c.pietyCost) {
    GameState.macros.eusebeia -= c.pietyCost;
    dmg = scaleDamage(dmg, 0.5);
    note += "Piety poured out softens the blow further. ";
  } else if (!god) {
    GameState.unhappiness += 2;   // an unshielded crisis sours the people
  }

  gainObj(dmg);
  logChronicle(
    (note || "No god of this domain answers; ") +
    (Object.keys(dmg).length ? `the ${c.name} costs ${formatChanges(dmg)}.` : `the ${c.name} is turned aside entirely.`),
    god ? "event" : "warning"
  );

  GameState.pendingCrisis = null;
  closeModal("crisis-modal");
  if (GameState.stats.population <= 0 && GameState.status === GameStatus.PLAYING) collapse();
  render();
}

/* ---------- Catastrophes & respond-able flavour events (shared modal) ---------- */
export function triggerCatastrophe() {
  const base = pick(CATASTROPHES);
  const m = eventStakes();
  const cat = { ...base, damage: scaleBundle(base.damage, m), savedDamage: scaleBundle(base.savedDamage, m) };
  const god = domainGod(cat.domain);
  GameState.pendingChoice = { kind: "catastrophe", ev: cat, godId: god ? god.id : null };
  logChronicle(`⚠ CATASTROPHE — ${cat.name} falls upon ${GameState.cityName}!`, "warning");
  renderChoice();
  openModal("choice-modal");
}
export function resolveCatastrophe() {
  const pc = GameState.pendingChoice; if (!pc || pc.kind !== "catastrophe") return;
  const cat = pc.ev;
  const god = pc.godId != null ? getGod(pc.godId) : null;
  if (god) {
    gainObj(cat.savedDamage);
    logChronicle(`${mythlessSub(cat.saved, god)} (${formatChanges(cat.savedDamage)})`, "event");
  } else {
    gainObj(cat.damage);
    GameState.unhappiness += 4;
    logChronicle(`${cat.doomed} ${formatChanges(cat.damage)}.`, "warning");
  }
  GameState.pendingChoice = null;
  closeModal("choice-modal");
  if (GameState.stats.population <= 0 && GameState.status === GameStatus.PLAYING) collapse();
  render();
}
/** Substitute {god} in a catastrophe's "saved" line. */
export function mythlessSub(str, god) { return str.replace(/{god}/g, godName(god)); }

export function triggerChoiceEvent() {
  const base = pick(CHOICE_EVENTS);
  const m = eventStakes();
  const ev = { ...base, a: scaleOption(base.a, m), b: scaleOption(base.b, m) };
  GameState.pendingChoice = { kind: "event", ev };
  logChronicle(`The people bring a matter before you: ${ev.name}.`, "system");
  renderChoice();
  openModal("choice-modal");
}
export function resolveChoice(which) {
  const pc = GameState.pendingChoice; if (!pc || pc.kind !== "event") return;
  const ev = pc.ev;
  const opt = ev[which];
  if (opt.cost && !canAfford(opt.cost)) return;
  if (opt.cost) spendObj(opt.cost);
  if (opt.gain) gainObj(opt.gain);
  if (opt.unrest) GameState.unrest = Math.max(GameState.unrest, opt.unrest);
  if (opt.calm) GameState.unhappiness = Math.max(0, GameState.unhappiness - opt.calm);
  logChronicle(opt.log, "event");
  GameState.pendingChoice = null;
  closeModal("choice-modal");
  if (GameState.stats.population <= 0 && GameState.status === GameStatus.PLAYING) collapse();
  render();
}

/* ---------- god-targeted happiness events ---------- */
export function triggerGodEvent() {
  if (GameState.gods.length === 0) return;
  const g = pick(GameState.gods);
  const base = pick(GOD_EVENTS);
  const m = eventStakes();
  const ev = { ...base, a: scaleOption(base.a, m), b: scaleOption(base.b, m) };
  GameState.pendingChoice = { kind: "godevent", ev, godId: g.id };
  logChronicle(`A matter touches the worship of ${godName(g)}: ${ev.name}.`, "system");
  renderChoice();
  openModal("choice-modal");
}
export function resolveGodEvent(which) {
  const pc = GameState.pendingChoice; if (!pc || pc.kind !== "godevent") return;
  const ev = pc.ev, g = getGod(pc.godId);
  if (!g) { GameState.pendingChoice = null; closeModal("choice-modal"); render(); return; }
  const opt = ev[which];
  if (opt.cost && !canAfford(opt.cost)) return;
  if (opt.cost) spendObj(opt.cost);
  if (opt.gain) gainObj(opt.gain);
  if (opt.unrest) GameState.unrest = Math.max(GameState.unrest, opt.unrest);
  g.happiness = Math.max(0, Math.min(100, g.happiness + (opt.happy || 0)));
  if (g.happiness < RELIGION.HAPPY) g.turnsHappy = 0;   // a sour year breaks the ascension streak
  logChronicle(typeof opt.log === "function" ? opt.log(g) : opt.log, opt.happy < 0 ? "warning" : "event");
  GameState.pendingChoice = null;
  closeModal("choice-modal");
  render();
}
