import { CONFIG, HEKATOMB } from "./config.js";
import { GameState } from "./state.js";
import { collapse, endEra, formatYear, logChronicle } from "./engine.js";
import { spend } from "./culture.js";
import { render, renderAdmin, renderCivic } from "./render.js";

/* ===================================================================
   THE HEKATOMB — a seasonal festival minigame every tenth turn
   =================================================================== */

/** Begin the festival: reset the allocation and open the (blocking) modal. */
export function openFestival() {
  GameState.pendingFestival = true;
  GameState.festivalAlloc = { cattle: 0, grapes: 0, grain: 0 };
  logChronicle(
    `The year ${formatYear(GameState.year)} brings the Hekatomb Festival — ` +
    `the people gather to honour the gods.`,
    "system"
  );
  renderFestival();
  openModal("festival-modal");
}

/** Build the festival modal: three sliders feeding the three sacrificial pools. */
export function renderFestival() {
  const body = document.getElementById("festival-body");
  if (!body) return;
  const s = GameState.stats, a = GameState.festivalAlloc;

  // Keep any prior allocation within current stock.
  a.cattle = Math.min(a.cattle, s.cattle);
  a.grapes = Math.min(a.grapes, s.grapes);
  a.grain  = Math.min(a.grain,  s.grain);

  body.innerHTML =
    `<p class="fest-intro">Every tenth year the Polis offers a great sacrifice — a hekatomb. ` +
    `Allocate your stores between the altar, the feast, and the winter granary. ` +
    `Whatever you keep will carry your people through the coming decade.</p>` +

    `<div class="fest-pool">` +
      `<div class="fp-title">🔥 The Altar Pool</div>` +
      `<div class="fp-desc">Cattle sacrificed upon the altar bring an immense surge of Piety (Eusebeia).</div>` +
      `<div class="fest-row"><label>🐄 Cattle to altar</label>` +
        `<input type="range" id="fest-cattle" min="0" max="${s.cattle}" value="${a.cattle}">` +
        `<span class="fest-val" id="fest-cattle-val"></span></div>` +
      `<div class="fest-gain" id="fest-altar-gain"></div>` +
    `</div>` +

    `<div class="fest-pool">` +
      `<div class="fp-title">🍷 The Feast Pool</div>` +
      `<div class="fp-desc">Wine and grain spent on a public feast bring a surge of Kleos — and renew the ` +
        `people's spirit, resetting all accumulated discontent.</div>` +
      `<div class="fest-row"><label>🍇 Wine (grapes)</label>` +
        `<input type="range" id="fest-grapes" min="0" max="${s.grapes}" value="${a.grapes}">` +
        `<span class="fest-val" id="fest-grapes-val"></span></div>` +
      `<div class="fest-row"><label>🌾 Grain</label>` +
        `<input type="range" id="fest-grain" min="0" max="${s.grain}" value="${a.grain}">` +
        `<span class="fest-val" id="fest-grain-val"></span></div>` +
      `<div class="fest-gain" id="fest-feast-gain"></div>` +
    `</div>` +

    `<div class="fest-pool fest-granary">` +
      `<div class="fp-title">🌾 The Winter Granary</div>` +
      `<div class="fp-desc">Whatever is not sacrificed remains in your stores against the coming decade.</div>` +
      `<div class="fest-leftover" id="fest-leftover"></div>` +
    `</div>` +

    `<div class="fest-warn" id="fest-warn"></div>` +
    `<div class="fest-confirm">` +
      `<button class="action-btn diplomatic" id="fest-confirm">` +
        `<span class="ab-title">🍷 Pour Libations &amp; End Festival</span>` +
        `<span class="ab-cost" id="fest-confirm-sub"></span>` +
      `</button>` +
    `</div>`;

  ["fest-cattle", "fest-grapes", "fest-grain"].forEach(id =>
    document.getElementById(id).addEventListener("input", onFestivalInput));
  document.getElementById("fest-confirm").addEventListener("click", confirmFestival);

  updateFestivalPreview();
}

/** Read the sliders into the allocation, then refresh the live preview. */
export function onFestivalInput() {
  const a = GameState.festivalAlloc;
  a.cattle = +document.getElementById("fest-cattle").value;
  a.grapes = +document.getElementById("fest-grapes").value;
  a.grain  = +document.getElementById("fest-grain").value;
  updateFestivalPreview();
}

/** Show the resulting Piety/Kleos gains, the granary remainder, and warnings. */
export function updateFestivalPreview() {
  const s = GameState.stats, a = GameState.festivalAlloc;
  const piety = a.cattle * HEKATOMB.pietyPerCattle;
  const kleos = Math.round(a.grapes * HEKATOMB.kleosPerGrape + a.grain * HEKATOMB.kleosPerGrain);
  const feastOffered = (a.grapes + a.grain) > 0;

  document.getElementById("fest-cattle-val").textContent = `${a.cattle} / ${s.cattle}`;
  document.getElementById("fest-grapes-val").textContent = `${a.grapes} / ${s.grapes}`;
  document.getElementById("fest-grain-val").textContent  = `${a.grain} / ${s.grain}`;

  document.getElementById("fest-altar-gain").textContent = a.cattle > 0
    ? `→ +${piety} Piety`
    : "→ the altar stands empty (the gods are slighted)";
  document.getElementById("fest-feast-gain").textContent = feastOffered
    ? `→ +${kleos} Kleos · discontent reset to 0`
    : "→ no feast is held (the people grow resentful)";

  document.getElementById("fest-leftover").innerHTML =
    `<span>🐄 <b>${s.cattle - a.cattle}</b> cattle</span>` +
    `<span>🍇 <b>${s.grapes - a.grapes}</b> grapes</span>` +
    `<span>🌾 <b>${s.grain - a.grain}</b> grain</span>`;

  const leftGrain = s.grain - a.grain;
  const yearlyNeed = Math.ceil(s.population * CONFIG.GRAIN_PER_CITIZEN);
  document.getElementById("fest-warn").textContent =
    leftGrain < yearlyNeed
      ? "⚠ Little grain remains — the granary may not hold against famine."
      : "";
}

/**
 * Validate the allocation, apply the surges/penalties, then close the
 * festival and resume normal play.
 */
export function confirmFestival() {
  if (!GameState.pendingFestival) return;
  const s = GameState.stats, a = GameState.festivalAlloc;

  // Validate: clamp each pool to what is actually in store.
  a.cattle = Math.max(0, Math.min(a.cattle, s.cattle));
  a.grapes = Math.max(0, Math.min(a.grapes, s.grapes));
  a.grain  = Math.max(0, Math.min(a.grain,  s.grain));

  const pietyGain = a.cattle * HEKATOMB.pietyPerCattle;
  const kleosGain = Math.round(a.grapes * HEKATOMB.kleosPerGrape + a.grain * HEKATOMB.kleosPerGrain);
  const feastOffered = (a.grapes + a.grain) > 0;

  spend({ cattle: -a.cattle, grapes: -a.grapes, grain: -a.grain });
  GameState.macros.eusebeia += pietyGain;
  GameState.macros.kleos    += kleosGain;

  logChronicle(
    `The Hekatomb is offered: ${a.cattle} cattle, ${a.grapes} measures of wine and ` +
    `${a.grain} of grain laid before the gods.`,
    "event"
  );

  // Altar pool — piety, or a penalty for an empty altar.
  if (pietyGain > 0) {
    logChronicle(`Sacred smoke billows from the altar; the people's piety surges (+${pietyGain} Eusebeia).`, "event");
  } else {
    GameState.unhappiness += 3;
    logChronicle("The altar stood empty through the festival; the gods take note of the slight.", "warning");
  }

  // Feast pool — kleos and a reset of discontent, or a penalty for no feast.
  if (feastOffered) {
    const before = GameState.unhappiness;
    GameState.unhappiness = 0;
    logChronicle(
      `The feast renews the bonds of the Demos; renown spreads (+${kleosGain} Kleos)` +
      `${before > 0 ? `, and discontent is quelled (${before} → 0)` : ""}.`,
      "event"
    );
  } else {
    GameState.unhappiness += 5;
    logChronicle("No feast was held; the people feel slighted, and discontent festers.", "warning");
  }

  GameState.pendingFestival = false;
  closeModal("festival-modal");

  // The festival may fall on the final year of the era.
  if (GameState.stats.population <= 0) collapse();
  else if (GameState.year <= CONFIG.END_YEAR) endEra();
  render();
}

/* ---------- Modal controls ---------- */
export function openModal(id)  { document.getElementById(id).hidden = false; }
export function closeModal(id) { document.getElementById(id).hidden = true; }

export function openLabor() { render(); openModal("labor-modal"); }
export function openCivic() { renderCivic(); openModal("civic-modal"); }
export function openAdmin() { renderAdmin(); openModal("admin-modal"); }
