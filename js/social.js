import { GameState } from "./state.js";
import { isGodHappy } from "./religion.js";
import { logChronicle } from "./engine.js";

/* ===================================================================
   SOCIAL ORDERS — three ranks whose Clout & Satisfaction set Discontent
   The engine reads the Labor of the Demos (job sliders) and the Tech Tree
   to shift each order's political weight and mood every year. At the close
   of the Dawn Era the orders harden into the factions of the Archaic age.
   =================================================================== */

/* Display metadata for each order (and the Archaic factions it becomes). */
export const SOCIAL_META = {
  oikosLords: { name: "Oikos Lords", sub: "Cattle-rich heads of the great households", accent: "#a8492c" },
  autourgoi:  { name: "Autourgoi",   sub: "Self-working smallholder farmers",          accent: "#6f7536" },
  akleroi:    { name: "Akleroi",     sub: "The landless — craftsmen & day-labourers",  accent: "#b07d2b" },
  // Archaic-era factions (after the Phoenician Alphabet closes the era).
  eupatridai: { name: "Eupatridai",  sub: "The well-born, who rule by birth and land",  accent: "#a8492c" },
  demos:      { name: "The Demos",   sub: "Smallholder and labourer, now one body",     accent: "#6f7536" },
};

/* Clout-growth thresholds: an order whose trades command more than this share
   of the people (in %) gains political weight each year. The Lords' rule is
   set by the spec (>10% herders); the others mirror it for their trade-groups. */
const CLOUT_THRESHOLD = Object.freeze({ oikosLords: 10, autourgoi: 45, akleroi: 20 });

/** A fresh set of the three Dawn-Era orders, at their starting balance. */
export function freshSocialClasses() {
  return {
    oikosLords: { clout: 50, satisfaction: 80 },
    autourgoi:  { clout: 35, satisfaction: 75 },
    akleroi:    { clout: 15, satisfaction: 70 },
  };
}

/** Share of the population (%) employed across the given trades this turn. */
function jobShare(...keys) {
  const jobs = GameState.jobs || {};
  const pop = Math.max(1, GameState.stats.population);
  return keys.reduce((n, k) => n + (jobs[k] || 0), 0) / pop * 100;
}

/** The Akleroi's labour share, widened by the crafts that new techs open up. */
function akleroiShare() {
  let p = jobShare("woodcutters", "potters");
  if (GameState.techs.mining) p += 5;   // Deep-Shaft Mining opens the miners' trade
  if (GameState.techs.naval)  p += 5;   // Naval Carpentry opens the ship-carpenters' trade
  return p;
}

/** Re-balance clout so the orders always partition exactly 100%. */
function normalizeClout(sc) {
  const total = Object.values(sc).reduce((n, c) => n + c.clout, 0) || 1;
  for (const k in sc) sc[k].clout = sc[k].clout / total * 100;
}

/**
 * Global Discontent from the current orders:
 *   100 − Σ(clout × satisfaction) / 100
 * With clout summing to 100 this yields 0 (all content) … 100 (all wretched).
 * Works for both the three Dawn orders and the merged Archaic factions.
 */
export function recomputeDiscontent() {
  const sc = GameState.socialClasses || {};
  const weighted = Object.values(sc).reduce((n, c) => n + c.clout * c.satisfaction, 0);
  GameState.globalDiscontent = Math.max(0, Math.min(100, Math.round(100 - weighted / 100)));
  return GameState.globalDiscontent;
}

/**
 * Per-turn social engine. Reads the labour sliders (job head-counts) and the
 * tech unlocks to shift Clout, and the harvest / seasons / gods to shift
 * Satisfaction, then renormalizes clout and recomputes Discontent.
 *
 * @param {number} grainBalance  this year's grain produced minus grain needed.
 */
export function tickSocialOrders(grainBalance) {
  const sc = GameState.socialClasses;
  if (!sc || GameState.archaicEra) return;   // factions are frozen once the era closes
  GameState.lastGrainBalance = grainBalance;

  // --- Clout: outsized labour in an order's trades earns it political weight ---
  if (jobShare("herders")                          > CLOUT_THRESHOLD.oikosLords) sc.oikosLords.clout += 0.5;
  if (jobShare("farmers", "oliveGrowers", "vintners") > CLOUT_THRESHOLD.autourgoi) sc.autourgoi.clout += 0.5;
  if (akleroiShare()                               > CLOUT_THRESHOLD.akleroi)    sc.akleroi.clout    += 0.5;
  normalizeClout(sc);

  // --- Satisfaction ---
  // Hunger falls hardest on those with the least: the landless, then smallholders.
  if (grainBalance <= 0) {
    sc.akleroi.satisfaction   -= 5;
    sc.autourgoi.satisfaction -= 2;
  } else {
    // Fat years ease mood gently back up.
    sc.akleroi.satisfaction   += 1;
    sc.autourgoi.satisfaction += 1;
  }
  // The Lords' authority is religious as much as economic: a Great Winter with
  // restless (or absent) gods compromises the standing of their patronage.
  const anyUnhappyGod = GameState.gods.some(g => !isGodHappy(g));
  if (GameState.winter > 0 && (anyUnhappyGod || GameState.gods.length === 0)) {
    sc.oikosLords.satisfaction -= 3;
  } else if (!anyUnhappyGod && GameState.winter === 0) {
    sc.oikosLords.satisfaction += 1;
  }

  for (const k in sc) sc[k].satisfaction = Math.max(0, Math.min(100, sc[k].satisfaction));

  recomputeDiscontent();
}

/** A short note on what is currently driving an order's mood up or down. */
export function describeSocialClass(key) {
  const sc = GameState.socialClasses[key];
  if (!sc) return "";

  if (GameState.archaicEra) {
    return key === "eupatridai"
      ? "The well-born lords now rule by birth and broad estates; their primacy passes into the Archaic age."
      : "Farmer and labourer, fused into one body, will press for an ever-greater voice in the ages to come.";
  }

  const grainShort = (GameState.lastGrainBalance ?? 1) <= 0;
  const parts = [];

  if (key === "oikosLords") {
    const p = jobShare("herders");
    parts.push(p > CLOUT_THRESHOLD.oikosLords
      ? `Herding wealth (${p.toFixed(0)}% of the people) swells their clout.`
      : `Too few herders (${p.toFixed(0)}%) — their grip on power slips.`);
    const anyUnhappy = GameState.gods.some(g => !isGodHappy(g));
    if (GameState.winter > 0 && (anyUnhappy || GameState.gods.length === 0))
      parts.push("A Great Winter and restless gods shake their sacred authority.");
    else if (!anyUnhappy && GameState.gods.length)
      parts.push("Their patronage of contented gods keeps them honoured.");
  } else if (key === "autourgoi") {
    const p = jobShare("farmers", "oliveGrowers", "vintners");
    parts.push(p > CLOUT_THRESHOLD.autourgoi
      ? `The land teems with smallholders (${p.toFixed(0)}%), and their voice grows.`
      : `Fewer hands on the land (${p.toFixed(0)}%) blunt their influence.`);
    parts.push(grainShort ? "Thin harvests gnaw at their contentment." : "Steady harvests keep them content.");
  } else if (key === "akleroi") {
    const p = akleroiShare();
    parts.push(p > CLOUT_THRESHOLD.akleroi
      ? `Crafts and labour (${p.toFixed(0)}%) lend the landless rare weight.`
      : `Scarce craft-work (${p.toFixed(0)}%) leaves them near voiceless.`);
    parts.push(grainShort ? "Owning no land, famine cuts them deepest." : "Full granaries ease their hardship.");
  }

  return parts.join(" ");
}

/**
 * THE ERA TRANSITION. Triggered when the Phoenician Alphabet is mastered.
 * The herding lords become the Eupatridai; smallholders and the landless are
 * merged into a single political body, the Demos. The Labor sliders — an
 * instrument of the Dawn Era — are retired.
 */
export function transitionToArchaicEra() {
  if (GameState.archaicEra) return;
  const sc = GameState.socialClasses;

  const dClout = sc.autourgoi.clout + sc.akleroi.clout;
  const dSat = dClout > 0
    ? (sc.autourgoi.clout * sc.autourgoi.satisfaction + sc.akleroi.clout * sc.akleroi.satisfaction) / dClout
    : (sc.autourgoi.satisfaction + sc.akleroi.satisfaction) / 2;

  GameState.socialClasses = {
    eupatridai: { clout: sc.oikosLords.clout, satisfaction: sc.oikosLords.satisfaction },
    demos:      { clout: dClout, satisfaction: Math.round(dSat) },
  };
  GameState.archaicEra = true;
  recomputeDiscontent();

  // Retire the Labor of the Demos — its sliders belong to the Dawn Era.
  const laborBtn = document.getElementById("open-labor");
  if (laborBtn) { laborBtn.disabled = true; laborBtn.style.display = "none"; }
  const laborModal = document.getElementById("labor-modal");
  if (laborModal) laborModal.hidden = true;

  logChronicle(
    "With the gift of letters the Dawn Era closes and the old orders harden: the herding lords " +
    "become the Eupatridai, while smallholder and landless alike are now reckoned as one — the Demos.",
    "system"
  );
}
