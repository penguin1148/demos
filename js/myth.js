import { MYTH_FLAVOR, MYTH_STORY, TIER_NAME, TIER_SUB } from "./religionData.js";
import { GameState } from "./state.js";
import { collapse, formatChanges, logChronicle } from "./engine.js";
import { closeModal, openModal } from "./festival.js";
import { ascendNeed, canAfford, canAscend, gainObj, getGod, godName, spendObj } from "./religion.js";
import { render, renderMyth } from "./render.js";

/* ===================================================================
   THE MYTHIC CYCLE — a survived text story that raises a god a tier
   =================================================================== */
export function beginAscension(godId) {
  const g = getGod(godId);
  if (!g || !canAscend(g)) return;
  if (GameState.pendingMyth || GameState.pendingCrisis || GameState.pendingChoice || GameState.pendingFestival) return;
  GameState.pendingMyth = { godId: g.id, scene: 0, target: g.tier + 1 };
  const fl = MYTH_FLAVOR[g.aspect];
  logChronicle(`A Mythic Cycle opens around ${godName(g)} — ${fl.foe} stirs, and the god must prove itself to ascend to ${TIER_NAME[g.tier + 1]}.`, "system");
  closeModal("religion-modal");
  renderMyth();
  openModal("myth-modal");
}
/** Substitute story placeholders for the active myth. */
export function mythText(str, g) {
  const fl = MYTH_FLAVOR[g.aspect];
  return str.replace(/{foe}/g, fl.foe).replace(/{place}/g, fl.place)
            .replace(/{god}/g, godName(g)).replace(/{city}/g, GameState.cityName);
}
export function mythChoose(optIndex) {
  const pm = GameState.pendingMyth; if (!pm) return;
  const scene = MYTH_STORY[pm.scene];
  const opt = scene.options[optIndex];
  if (!opt) return;
  if (opt.cost && Object.keys(opt.cost).length && !canAfford(opt.cost)) return;
  if (opt.cost) spendObj(opt.cost);
  pm.scene = opt.to;
  renderMyth();
}
export function mythWithdraw() {
  const pm = GameState.pendingMyth; if (!pm) return;
  const g = getGod(pm.godId);
  if (g) { g.turnsHappy = Math.floor(ascendNeed(g) / 2); }
  GameState.pendingMyth = null;
  closeModal("myth-modal");
  logChronicle(`The people judge themselves unready; the Mythic Cycle of ${g ? godName(g) : "the god"} passes for now.`, "warning");
  render();
}
/** Resolve a final scene — the god lives or the foe ravages the city. */
/** Effective odds of a final scene, harder for the Olympian bid. */
export function mythFinalOdds(scene, target) {
  return scene.odds * (target === 3 ? 0.82 : 1);
}
export function mythResolve() {
  const pm = GameState.pendingMyth; if (!pm) return;
  const scene = MYTH_STORY[pm.scene];
  const g = getGod(pm.godId);
  if (!g || !scene || !scene.final) return;
  const won = Math.random() < mythFinalOdds(scene, pm.target);
  GameState.pendingMyth = null;
  closeModal("myth-modal");
  const fl = MYTH_FLAVOR[g.aspect];
  if (won) {
    g.tier = pm.target;
    g.happiness = Math.max(g.happiness, 80);
    g.turnsHappy = 0;
    if (!g.trait) g.trait = "slayer";                       // the god that slew the foe
    if (g.tier === 3) { GameState.priests += 10; }          // an Olympian's standing priesthood
    logChronicle(
      `${fl.foe.replace(/^a |^an |^the /i, "The ")} is overcome! ${godName(g)} ascends to ${TIER_NAME[g.tier]} — ${TIER_SUB[g.tier]}` +
      (g.tier === 3 ? `, and an Olympian legacy is sealed that will carry into the Archaic Era.` : `.`),
      "event"
    );
  } else {
    // The foe is not overcome: it ravages the domain. A failed bid for OLYMPUS is
    // catastrophic — the god is cast down to a Daimon, all its Heros-standing lost.
    const heavy = pm.target === 3;
    const toll = heavy
      ? (g.aspect === "sea" ? { population: -16, grain: -30, cattle: -8 }
                            : { population: -18, grain: -28 })
      : (g.aspect === "earth" ? { grain: -24, population: -6 }
         : g.aspect === "sea" ? { cattle: -6, grain: -16, population: -5 }
         : g.aspect === "hearth" ? { population: -10 }
         : { population: -8, grain: -12 });
    gainObj(toll);
    g.turnsHappy = 0;
    g.happiness = Math.max(0, g.happiness - (heavy ? 40 : 24));
    if (heavy) {
      g.tier = 1;                                           // cast down from Heros to Daimon
      logChronicle(`Disaster — the bid for Olympus FAILS. ${fl.foe} ravages the land (${formatChanges(toll)}) and ${godName(g)} is cast down from Heros to a humble Daimon, decades of devotion undone.`, "warning");
    } else {
      logChronicle(`The reckoning fails — ${fl.foe} is not overcome. ${formatChanges(toll)}. ${godName(g)} is shamed, but may try again in years to come.`, "warning");
    }
  }
  if (GameState.stats.population <= 0) collapse();
  render();
}
