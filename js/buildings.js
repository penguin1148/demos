import { GameStatus } from "./config.js";
import { GameState } from "./state.js";
import { BUILDINGS } from "./content.js";
import { logChronicle } from "./engine.js";
import { afterAction } from "./merchants.js";
import { canAfford, costTextLive, spendObj } from "./religion.js";
import { getHamlet } from "./synoikismos.js";
import { renderCivic } from "./render.js";

/* ===================================================================
   BUILDINGS — the Mines and the Docks
   =================================================================== */
export function canBuild(id) {
  const b = BUILDINGS[id];
  if (!b || GameState.buildings[id]) return false;
  if (!GameState.techs[b.tech]) return false;
  const h = getHamlet(b.hamlet);
  return !!(h && h.absorbed);
}
export function buildStructure(id) {
  const b = BUILDINGS[id];
  if (!b || GameState.status !== GameStatus.PLAYING) return;
  if (!canBuild(id)) return;
  if (!canAfford(b.cost)) { logChronicle(`${b.name} cannot yet be raised — ${costTextLive(b.cost)} is needed.`, "warning"); renderCivic(); return; }
  spendObj(b.cost);
  GameState.buildings[id] = true;
  if (id === "mines") { GameState.techBonus.stone += 4; GameState.minesTurn = GameState.turn;
    GameState.capacityBonus.potters = (GameState.capacityBonus.potters || 0) + 14; }   // worked faces & adits
  if (id === "docks") { GameState.docksTurn = GameState.turn;
    GameState.capacityBonus.farmers = (GameState.capacityBonus.farmers || 0) + 16; }    // a fishing fleet feeds more

  logChronicle(`The Polis raises ${b.name}. ${b.effect.replace(/<\/?b>/g, "")}`, "system");
  afterAction();
}
