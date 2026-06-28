import { GameStatus } from "./config.js";
import { GameState } from "./state.js";
import { TECHS } from "./content.js";
import { endEra, logChronicle } from "./engine.js";
import { closeModal } from "./festival.js";
import { canAfford, spendObj } from "./religion.js";
import { render, renderTech } from "./render.js";
import { transitionToArchaicEra } from "./social.js";

/* ===================================================================
   THE TECH TREE — Ergon + Muthos research
   =================================================================== */
export function techAvailable(id) {
  if (GameState.techs[id]) return false;
  const t = TECHS[id];
  if (t.needsPhoenician && !GameState.alphabetUnlocked) return false;   // won only by the Phoenician negotiation
  return t.req.every(r => GameState.techs[r]);
}
export function researchTech(id) {
  const t = TECHS[id];
  if (!t || GameState.techs[id] || !techAvailable(id)) return;
  if (GameState.status !== GameStatus.PLAYING) return;
  if (!canAfford(t.cost)) { renderTech(); return; }
  spendObj(t.cost);
  GameState.techs[id] = true;
  if (t.apply) t.apply();
  logChronicle(`The Polis masters ${t.name}. ${t.effect}`, "system");
  if (t.endsEra) {
    GameState.alphabetWin = true;
    transitionToArchaicEra();   // herding lords → Eupatridai; farmers + landless → the Demos; retire Labor sliders
    closeModal("tech-modal");
    endEra();
    render();
    return;
  }
  renderTech(); render();
}
