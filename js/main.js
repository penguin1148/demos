import { CONFIG, DEFAULT_ALLOC, GameStatus } from "./config.js";
import { GameState } from "./state.js";
import { HAMLETS } from "./content.js";
import { assignJobs, formatYear, logChronicle, nextTurn } from "./engine.js";
import { closeModal, openAdmin, openCivic, openLabor } from "./festival.js";
import { openReligion, openTech, render } from "./render.js";

/* ===================================================================
   BOOTSTRAP
   =================================================================== */

export function initGame() {
  GameState.status = GameStatus.PLAYING;   // FSM: BOOT -> PLAYING
  GameState.jobAllocation = { ...DEFAULT_ALLOC };
  GameState.jobs = assignJobs(GameState.stats.population);

  // Seed the runtime hamlets from config (deep copy so config stays pristine).
  GameState.hamlets = HAMLETS.map(h => ({ ...h, absorbed: false, stage: 0, cooldownUntil: -1 }));
  GameState.bonuses = {};
  GameState.priests = 0;
  GameState.unrest = 0;
  GameState.hearthBuilt = false;
  GameState.hearthTurn = -1;
  GameState.pendingEpiphany = false;
  GameState.hand = { aspects: [], epithets: [] };
  GameState.relSelect = { aspect: null, epithet: null };
  GameState.gods = [];
  GameState.godSeq = 0;
  GameState.winter = 0;
  GameState.pendingMyth = null;
  GameState.pendingChoice = null;
  GameState.pendingPhoenician = null;
  GameState.pendingCrisis = null;
  GameState.pendingFestival = false;
  GameState.festivalAlloc = { cattle: 0, grapes: 0, grain: 0 };
  GameState.unhappiness = 0;
  GameState.macros = { kleos: 0, eusebeia: 0 };
  // Knowledge / research economy.
  GameState.ergon = 0; GameState.muthos = 0;
  GameState.lastErgon = 0; GameState.lastMuthos = 0;
  GameState.techs = {};
  GameState.research = { halted: false, reason: "" };
  GameState.fieldRevealed = false;
  GameState.alphabetWin = false;
  GameState.alphabetUnlocked = false;
  GameState.techBonus = { grain: 0, grapes: 0, clay: 0, timber: 0, stone: 0 };
  GameState.ergonMult = 1; GameState.muthosMult = 1;
  GameState.buildings = { mines: false, docks: false };
  GameState.minesTurn = -1; GameState.docksTurn = -1;
  GameState.merchantSeq = 0;
  GameState.phoenicianFailTurn = -99;

  render();
  logChronicle(
    `In the year ${formatYear(CONFIG.START_YEAR)}, a scattering of families ` +
    `founds the settlement of ${GameState.cityName} upon the dry hills.`,
    "system"
  );
  logChronicle("Farmers sow grain, herders tend cattle, and the kilns are lit. The early years are lean — a single failed harvest or unguarded disaster can spell famine.", "system");
  logChronicle(
    "Kindle the Ancestral Hearth EARLY (Civic Investments): its visions let you name protective Daimones — gods of a domain who shield the people when catastrophe strikes there. Keep a Daimon happy for 20 years and it may face a Mythic Cycle to ascend to a Heros, and later an Olympian.",
    "system"
  );
  logChronicle(
    "Two currents of knowledge — ⚒ Ergon from labour and 📜 Muthos from culture — feed the Tree of Knowledge. Research it toward Terraced Farming, Mining, Naval Carpentry and at last the Phoenician Alphabet, which crowns the era.",
    "system"
  );
  logChronicle("Every tenth year the people hold the Hekatomb; nearby hamlets may join through synoikismos.", "system");
  logChronicle("The Dawn Era begins. Press “End Turn” to let the years unfold.", "system");

  // End Turn.
  document.getElementById("end-turn-btn").addEventListener("click", nextTurn);

  // Map tools: open the Labor, Civic, Cults and Administration modals.
  document.getElementById("open-labor").addEventListener("click", openLabor);
  document.getElementById("open-tech").addEventListener("click", openTech);
  document.getElementById("open-civic").addEventListener("click", openCivic);
  document.getElementById("open-religion").addEventListener("click", openReligion);
  document.getElementById("open-admin").addEventListener("click", openAdmin);

  // Chronicle enlarge / shrink toggle.
  document.getElementById("chron-enlarge").addEventListener("click", () => {
    const vp = document.getElementById("viewport");
    vp.classList.toggle("chron-lg");
    document.getElementById("chron-enlarge").textContent =
      vp.classList.contains("chron-lg") ? "⤡ Shrink" : "⤢ Enlarge";
  });

  // Modal close buttons.
  document.querySelectorAll(".modal-close").forEach(btn =>
    btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close"))));

  // Backdrop clicks dismiss modals — except the crisis and festival modals,
  // which must be resolved before play resumes.
  const blocking = ["crisis-modal", "festival-modal", "epiphany-modal", "myth-modal", "choice-modal", "phoenician-modal"];
  document.querySelectorAll(".modal-backdrop").forEach(back =>
    back.addEventListener("click", e => {
      if (e.target === back && !blocking.includes(back.id)) back.hidden = true;
    }));
}

window.addEventListener("DOMContentLoaded", initGame);
