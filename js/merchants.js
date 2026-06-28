import { GameState } from "./state.js";
import { MERCHANT_TRADES, PHOENICIAN_STORY } from "./content.js";
import { logChronicle, pick } from "./engine.js";
import { closeModal, openModal } from "./festival.js";
import { canAfford, costText, costTextLive, gainObj, spendObj } from "./religion.js";
import { render, renderChoice, renderPhoenician } from "./render.js";

/* ===================================================================
   FOREIGN MERCHANTS & THE PHOENICIAN (Docks)
   =================================================================== */
export function triggerMerchant() {
  const t = pick(MERCHANT_TRADES);
  GameState.merchantSeq += 1;
  GameState.pendingChoice = { kind: "merchant", trade: t };
  logChronicle(`A foreign ship puts in at the docks — ${t.who} comes to barter.`, "event");
  renderChoice();
  openModal("choice-modal");
}
export function resolveMerchant(accept) {
  const pc = GameState.pendingChoice; if (!pc || pc.kind !== "merchant") return;
  const t = pc.trade;
  if (accept) {
    if (!canAfford(t.give)) return;
    spendObj(t.give); gainObj(t.get);
    logChronicle(`A bargain is struck with ${t.who}: ${costTextLive(t.give)} for ${costText(t.get)}.`, "event");
  } else {
    logChronicle(`${t.who.replace(/^a |^an /i, "The ")} is sent on their way without a deal.`, "system");
  }
  GameState.pendingChoice = null;
  closeModal("choice-modal");
  render();
}

export function beginPhoenician() {
  GameState.pendingPhoenician = { scene: 0, rapport: 0 };
  logChronicle("A Phoenician trader of Tyre, Hiram, steps ashore bearing the secret of letters. A long courtship of trust begins.", "system");
  renderPhoenician();
  openModal("phoenician-modal");
}
export function phoenicianText(str) { return str.replace(/{city}/g, GameState.cityName); }
export function phoenicianChoose(i) {
  const pp = GameState.pendingPhoenician; if (!pp) return;
  const scene = PHOENICIAN_STORY[pp.scene];
  const opt = scene.options[i]; if (!opt) return;
  if (opt.cost && Object.keys(opt.cost).length && !canAfford(opt.cost)) return;
  if (opt.cost) spendObj(opt.cost);
  pp.rapport += opt.rapport;
  pp.scene = opt.to;
  renderPhoenician();
}
export function phoenicianResolve() {
  const pp = GameState.pendingPhoenician; if (!pp) return;
  const scene = PHOENICIAN_STORY[pp.scene];
  if (!scene.final) return;
  const won = pp.rapport >= scene.need;
  GameState.pendingPhoenician = null;
  closeModal("phoenician-modal");
  if (won) {
    GameState.alphabetUnlocked = true;
    logChronicle("Hiram stays the winter and teaches your scribes the twenty-two letters. The Phoenician Alphabet may now be researched at last — though mastering it will be the work of a generation.", "event");
  } else {
    // A costly courtship spurned: the goods are already spent, the people are
    // shamed, and no Phoenician will risk the journey again for many years.
    GameState.phoenicianFailTurn = GameState.turn;
    GameState.macros.kleos = Math.max(0, GameState.macros.kleos - 8);
    GameState.unhappiness += 4;
    logChronicle("Hiram judges the friendship too thin; he sails with the first fair wind, the secret of letters with him. The lavish courtship is wasted and the people feel the shame of it — no other Phoenician will chance the long crossing for a generation.", "warning");
  }
  render();
}

/** Repaint everything after an administrative / civic action. */
export function afterAction() {
  render();
}
