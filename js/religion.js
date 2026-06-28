import { ASPECTS, DOMAIN_LABEL, DRAWABLE_EPITHETS, EPITHETS, EPITHET_EFFECT, HARMONY, MIRACLES, RELIGION, TEMENOS, TIER_MULT, TIER_NAME, godUpkeep } from "./religionData.js";
import { CONFIG } from "./config.js";
import { GameState } from "./state.js";
import { applyStats, eventStakes, formatChanges, logChronicle, pick } from "./engine.js";
import { closeModal, openModal } from "./festival.js";
import { render, renderEpiphany, renderReligion } from "./render.js";

/* ===================================================================
   RELIGION ENGINE — Local Cults, Cultivation, Tiers, Jealousy & Myths
   =================================================================== */

/* ---------- small resource helpers (stats + macros) ---------- */
export function resAvail(key) {
  if (key === "piety")  return GameState.macros.eusebeia;
  if (key === "kleos")  return GameState.macros.kleos;
  if (key === "ergon")  return GameState.ergon;
  if (key === "muthos") return GameState.muthos;
  return GameState.stats[key] || 0;
}
/**
 * Scale a player COST bundle by the current era's stakes (grain exempt for the
 * first GRAIN_STAKE_EXEMPT_UNTIL turns), so essentially every purchase, offering
 * and decision grows costlier as the Polis matures and hoards. Positive costs,
 * floored at 1. (Damage bundles use engine.stakeScale instead.)
 */
export function stakeCost(cost) {
  const m = eventStakes(GameState.turn);
  if (m === 1) return cost;
  const grainExempt = GameState.turn < CONFIG.GRAIN_STAKE_EXEMPT_UNTIL;
  const out = {};
  for (const k in cost) {
    if (k === "priests") { out[k] = cost[k]; continue; }   // labour, not a stockpile
    const mult = (k === "grain" && grainExempt) ? 1 : m;
    out[k] = Math.max(1, Math.round(cost[k] * mult));
  }
  return out;
}
/** costText for the escalated (live) price of a cost bundle. */
export function costTextLive(cost) { return costText(stakeCost(cost)); }

export function canAfford(cost, opts) {
  const c = opts && opts.raw ? cost : stakeCost(cost);
  for (const k in c) {
    if (k === "priests") continue;            // labour, not a stockpile
    if (resAvail(k) < c[k]) return false;
  }
  return true;
}
export function spendObj(cost, opts) {
  const c = opts && opts.raw ? cost : stakeCost(cost);
  for (const k in c) {
    if (k === "priests") { GameState.priests += c[k]; continue; }
    if (k === "piety")  { GameState.macros.eusebeia = Math.max(0, GameState.macros.eusebeia - c[k]); continue; }
    if (k === "kleos")  { GameState.macros.kleos = Math.max(0, GameState.macros.kleos - c[k]); continue; }
    if (k === "ergon")  { GameState.ergon = Math.max(0, GameState.ergon - c[k]); continue; }
    if (k === "muthos") { GameState.muthos = Math.max(0, GameState.muthos - c[k]); continue; }
    applyStats({ [k]: -c[k] });
  }
}
/** Apply a {key: +/-n} bundle that may touch stats, macros, ergon/muthos. */
export function gainObj(g) {
  for (const k in g) {
    if (k === "piety")  { GameState.macros.eusebeia = Math.max(0, GameState.macros.eusebeia + g[k]); continue; }
    if (k === "kleos")  { GameState.macros.kleos = Math.max(0, GameState.macros.kleos + g[k]); continue; }
    if (k === "ergon")  { GameState.ergon = Math.max(0, GameState.ergon + g[k]); continue; }
    if (k === "muthos") { GameState.muthos = Math.max(0, GameState.muthos + g[k]); continue; }
    applyStats({ [k]: g[k] });
  }
}
export function costText(cost) {
  const ic = { grain: "🌾", cattle: "🐄", grapes: "🍇", olives: "🫒", timber: "🪵", clay: "🧱", piety: "🔥", kleos: "✦", ergon: "⚒", muthos: "📜", priests: "🧑‍🌾→⛪" };
  return Object.keys(cost).map(k => `${ic[k] || ""} ${cost[k]} ${k === "priests" ? "priests" : k}`).join(" · ");
}

/* ---------- cult identity & maths ---------- */
export function isHarmonious(aspect, epithet) {
  return !!(epithet && HARMONY[aspect] && HARMONY[aspect].includes(epithet));
}
/* ---------- gods: identity, domains & maths ---------- */
export function getGod(id)   { return GameState.gods.find(g => g.id === id); }
export function godName(g)   { return `${ASPECTS[g.aspect].god} ${EPITHETS[g.epithet].name}`; }
export function godDomain(g) { return g.aspect; }
/** The best-tier consecrated god of a domain, or null. */
export function domainGod(domain) {
  let best = null;
  for (const g of GameState.gods) if (g.aspect === domain && (!best || g.tier > best.tier)) best = g;
  return best;
}
export function hasDiplomaticGod()  { return GameState.gods.some(g => (EPITHET_EFFECT[g.epithet] || {}).diplo); }
export function hasMartialGod()     { return GameState.gods.some(g => (EPITHET_EFFECT[g.epithet] || {}).martial || g.trait === "slayer"); }
export function hasAnyGod()         { return GameState.gods.length > 0; }
export function hasHarmoniousGod()  { return GameState.gods.some(g => g.harmonious); }
export function isGodHappy(g)       { return g.happiness >= RELIGION.HAPPY; }
/** How much of its blessing a god currently grants (sad gods withhold favour). */
export function happyFactor(g)      { return g.happiness >= RELIGION.HAPPY ? 1 : g.happiness >= 30 ? 0.5 : 0; }
/** Consecutive happy years still needed before this god may attempt its next ascent. */
export function ascendNeed(g)       { return g.tier >= 3 ? Infinity : RELIGION.ASCEND_TURNS[g.tier + 1]; }
export function canAscend(g)        { return g.tier < 3 && g.turnsHappy >= ascendNeed(g); }

/* ---------- the Divine Epiphany: a gift of cards ---------- */
export function grantEpiphany() {
  const a = pick(Object.keys(ASPECTS));
  const e = pick(DRAWABLE_EPITHETS);   // asphaleios is myth-only
  GameState.hand.aspects.push(a);
  GameState.hand.epithets.push(e);
  GameState.pendingEpiphany = true;
  GameState.lastGift = { aspect: a, epithet: e };
  logChronicle(
    `A Divine Epiphany seizes the people at the Hearth — they receive the Aspect of ${ASPECTS[a].name} ` +
    `and the Epithet ${EPITHETS[e].name}. Name them into a protective Daimon, or keep the cards.`,
    "system"
  );
  renderEpiphany();
  openModal("epiphany-modal");
}
export function ackEpiphany() {
  GameState.pendingEpiphany = false;
  closeModal("epiphany-modal");
  render();
}

/* ---------- founding bench: preview a pairing, then name a Daimon ---------- */
export function relPick(kind, id) {
  const sel = GameState.relSelect;
  if (kind === "aspect")  sel.aspect  = (sel.aspect  === id ? null : id);
  else                    sel.epithet = (sel.epithet === id ? null : id);
  renderReligion();
}
/** Name a new DAIMON (Tier 1) from a previewed Aspect+Epithet pairing. */
export function establishGod() {
  const sel = GameState.relSelect;
  if (!sel.aspect || !sel.epithet) {
    logChronicle("To name a god the people need both an Aspect (its domain) and an Epithet (its title).", "warning");
    renderReligion();
    return;
  }
  if (GameState.gods.length >= RELIGION.SLOTS) {
    logChronicle("The pantheon is full — no further god may be named until one is let go.", "warning");
    renderReligion();
    return;
  }
  if (GameState.gods.some(g => g.aspect === sel.aspect)) {
    logChronicle(`The people already worship a god of ${DOMAIN_LABEL[sel.aspect]}; a domain will not suffer two masters. Choose a different Aspect.`, "warning");
    renderReligion();
    return;
  }
  const cost = TEMENOS[1];
  if (!canAfford(cost)) {
    logChronicle(`The Daimon's shrine cannot be raised — ${costText(cost)} is needed.`, "warning");
    renderReligion();
    return;
  }
  const ai = GameState.hand.aspects.indexOf(sel.aspect);
  const ei = GameState.hand.epithets.indexOf(sel.epithet);
  if (ai < 0 || ei < 0) return;
  GameState.hand.aspects.splice(ai, 1);
  GameState.hand.epithets.splice(ei, 1);
  spendObj(cost);
  const g = {
    id: ++GameState.godSeq, aspect: sel.aspect, epithet: sel.epithet,
    harmonious: isHarmonious(sel.aspect, sel.epithet),
    tier: 1, happiness: RELIGION.HAPPY_START, turnsHappy: 0, trait: null,
  };
  GameState.gods.push(g);
  GameState.relSelect = { aspect: null, epithet: null };
  logChronicle(
    `A Daimon is named into being: ${godName(g)}, spirit of ${DOMAIN_LABEL[g.aspect]} — ` +
    (g.harmonious ? "a harmonious pairing whose favour runs strong." : "an ill-matched pairing whose favour is fickle.") +
    " It will shield the people against catastrophe in its domain.",
    g.harmonious ? "event" : "warning"
  );
  renderReligion(); render();
}
export function disbandGod(godId) {
  const g = getGod(godId); if (!g) return;
  GameState.gods = GameState.gods.filter(x => x.id !== godId);
  logChronicle(`The rites of ${godName(g)} are let go; the ${TIER_NAME[g.tier]}'s shrine falls silent.`, "warning");
  renderReligion(); render();
}

/* ---------- keeping a god happy ---------- */
export const OFFERINGS = {
  grain:  { cost: { grain: 8 },             happy: 8,  label: "Barley offering" },
  cattle: { cost: { cattle: 1, grapes: 1 }, happy: 16, label: "Cattle & wine" },
  piety:  { cost: { piety: 4 },             happy: 12, label: "Pour out Piety" },
};
export function makeOffering(godId, kind) {
  const g = getGod(godId); if (!g) return;
  const o = OFFERINGS[kind]; if (!o || !canAfford(o.cost)) return;
  spendObj(o.cost);
  g.happiness = Math.min(100, g.happiness + o.happy);
  logChronicle(`An offering gladdens ${godName(g)} (+${o.happy} happiness).`, "event");
  renderReligion(); render();
}

/* ---------- miracles: a happy great god bends fate in its domain ---------- */
/** Piety a god's miracle costs (scales with tier). */
export function miracleCost(g) { return CONFIG.MIRACLE_PIETY_PER_TIER * g.tier; }
/** Whether a god may work a miracle right now. */
export function canInvokeMiracle(g) {
  return !!MIRACLES[g.aspect] && g.tier >= 2 && isGodHappy(g) &&
    GameState.turn >= (g.miracleUntil || 0) && GameState.macros.eusebeia >= miracleCost(g);
}
/** Invoke a god's miracle: avert the soonest looming threat in its domain, or —
 *  if none looms — grant a domain bounty. Costs Piety and sets a cooldown. */
export function invokeMiracle(godId) {
  const g = getGod(godId);
  if (!g || !canInvokeMiracle(g)) return;
  GameState.macros.eusebeia -= miracleCost(g);
  g.miracleUntil = GameState.turn + CONFIG.MIRACLE_COOLDOWN;
  const m = MIRACLES[g.aspect];
  const target = GameState.threats.filter(t => t.domain === g.aspect).sort((a, b) => a.due - b.due)[0];
  if (target) {
    GameState.threats = GameState.threats.filter(t => t !== target);
    logChronicle(`✨ ${godName(g)} works a miracle — ${m.name} — turning aside the coming ${target.name} before it can strike!`, "event");
  } else {
    gainObj(m.bounty);
    logChronicle(`✨ ${godName(g)} works a miracle — ${m.name} (${formatChanges(m.bounty)}).`, "event");
  }
  renderReligion(); render();
}

/* ---------- per-year life of the gods: upkeep, happiness, ascent-readiness ---------- */
/** Phthonos: yearly happiness drag on a god from OTHER great (tier>=2) gods. */
export function jealousyDrag(g) {
  const rivals = GameState.gods.filter(o => o !== g && o.tier >= 2).length;
  return rivals * RELIGION.JEALOUSY_DRAG;
}
export function tickGods() {
  for (const g of GameState.gods) {
    const up = godUpkeep(g.tier);
    const drag = jealousyDrag(g);
    if (canAfford(up, { raw: true })) {        // passive upkeep is exempt from stakes escalation
      spendObj(up, { raw: true });
      g.happiness = Math.min(100, g.happiness + RELIGION.HAPPY_GAIN - drag);
      if (drag > 0 && g.happiness < RELIGION.HAPPY && GameState.turn % 4 === 0)
        logChronicle(`${godName(g)} grows jealous of the other great gods — even well fed, its favour slips (Phthonos).`, "warning");
    } else {
      g.happiness = Math.max(0, g.happiness - RELIGION.HAPPY_LOSS - drag);
      GameState.unhappiness += 1;
      if (GameState.turn % 3 === 0)
        logChronicle(`${godName(g)} goes unfed; its favour wanes and the people grow uneasy.`, "warning");
    }
    g.happiness = Math.max(0, Math.min(100, g.happiness));
    if (isGodHappy(g)) g.turnsHappy += 1; else g.turnsHappy = 0;
    if (g.tier < 3 && g.turnsHappy === ascendNeed(g))
      logChronicle(`${godName(g)} has been honoured ${g.turnsHappy} years unbroken — it is ready to face a Mythic Cycle and ascend to ${TIER_NAME[g.tier + 1]}.`, "system");
  }
}
/* ---------- per-year blessings ---------- */
export function applyGodPerks() {
  for (const g of GameState.gods) applyOnePerk(g);
}
export function applyOnePerk(g) {
  const factor = happyFactor(g);
  if (factor <= 0) return;
  const mult = TIER_MULT[g.tier] * (g.harmonious ? 1 : 0.45) * factor;
  const R = (n) => Math.round(n * mult);
  const eff = EPITHET_EFFECT[g.epithet] || {};
  const stat = {};
  if (eff.grain)  stat.grain  = R(eff.grain * (g.trait === "bounty" ? 1.6 : 1));
  if (eff.timber) stat.timber = R(eff.timber);
  if (eff.clay)   stat.clay   = R(eff.clay);
  if (eff.olives) stat.olives = R(eff.olives);
  if (eff.cattle) stat.cattle = R(eff.cattle);
  if (Object.keys(stat).length) applyStats(stat);
  if (eff.kleos) GameState.macros.kleos += R(eff.kleos);
  if (eff.calm) {
    const calm = R(eff.calm * (g.trait === "slayer" ? 2 : 1));
    if (GameState.unhappiness > 0) GameState.unhappiness = Math.max(0, GameState.unhappiness - calm);
    if (GameState.unrest > 0) GameState.unrest = Math.max(0, GameState.unrest - 1);
  }
}
