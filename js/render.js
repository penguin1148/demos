import { CIVIC, CONFIG, DEFAULT_ALLOC, GameStatus, JOBS, YIELD } from "./config.js";
import { ASPECTS, DOMAIN_LABEL, EPITHETS, EPITHET_EFFECT, MYTH_FLAVOR, MYTH_STORY, RELIGION, TEMENOS, TIER_MULT, TIER_NAME, TIER_SUB, godUpkeep } from "./religionData.js";
import { GameState } from "./state.js";
import { BUILDINGS, INTEGRATION_STAGES, PHOENICIAN_STORY, STAT_META, TECHS } from "./content.js";
import { assignJobs, formatChanges, formatYear } from "./engine.js";
import { DIVINE_AVERT, buildHearth, fundBard, resolveCatastrophe, resolveChoice, resolveCrisis, resolveGodEvent, scaleDamage } from "./culture.js";
import { researchTech, techAvailable } from "./tech.js";
import { buildStructure } from "./buildings.js";
import { phoenicianChoose, phoenicianResolve, phoenicianText, resolveMerchant } from "./merchants.js";
import { closeModal, openAdmin, openModal } from "./festival.js";
import { OFFERINGS, ackEpiphany, ascendNeed, canAfford, canAscend, costText, disbandGod, domainGod, establishGod, getGod, godName, hasDiplomaticGod, hasMartialGod, isGodHappy, isHarmonious, jealousyDrag, makeOffering, relPick } from "./religion.js";
import { beginAscension, mythChoose, mythFinalOdds, mythResolve, mythText, mythWithdraw } from "./myth.js";
import { attemptIntegration, bonusText, getHamlet, integrationCost, integrationUnrest } from "./synoikismos.js";
import { SOCIAL_META, describeSocialClass } from "./social.js";

/* ===================================================================
   RENDERING
   =================================================================== */

/** Repaint the HUD, resource panel, labour panel, map and civic views. */
export function render() {
  // Top bar
  document.getElementById("city-name").textContent = `by Penguin`;
  document.getElementById("hud-kleos").textContent    = GameState.macros.kleos;
  document.getElementById("hud-eusebeia").textContent = GameState.macros.eusebeia;
  const erg = document.getElementById("hud-ergon");   if (erg) erg.textContent = GameState.ergon;
  const mut = document.getElementById("hud-muthos");  if (mut) mut.textContent = GameState.muthos;
  const dis = document.getElementById("hud-discontent");
  dis.textContent = GameState.globalDiscontent;
  dis.style.color = GameState.globalDiscontent >= 40 ? "#e07a5f"
                  : GameState.globalDiscontent >= 20 ? "#d6a44a" : "#9bbf6a";
  document.getElementById("hud-year").textContent  = formatYear(GameState.year);
  document.getElementById("hud-turn").textContent  = GameState.turn;
  document.getElementById("hud-phase").textContent = GameState.phase;

  // Resource panel
  const body = document.getElementById("stats-body");
  body.innerHTML = "";
  for (const key in GameState.stats) {
    const meta = STAT_META[key] || { icon: "•", label: key, sub: "" };
    const delta = GameState.lastDeltas[key] || 0;

    let deltaClass = "zero", deltaText = "—";
    if (delta > 0) { deltaClass = "pos"; deltaText = `+${delta}`; }
    else if (delta < 0) { deltaClass = "neg"; deltaText = `${delta}`; }

    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML =
      `<span class="stat-name">` +
        `<span class="stat-icon">${meta.icon}</span>` +
        `<span><div>${meta.label}</div><div class="stat-sub">${meta.sub}</div></span>` +
      `</span>` +
      `<span class="stat-figures">` +
        `<span class="stat-val">${GameState.stats[key]}</span>` +
        `<span class="delta ${deltaClass}">${deltaText}</span>` +
      `</span>`;
    body.appendChild(row);
  }

  // Labour allocation panel.
  renderLabor();

  // Reveal the Ancestral Hearth on the hill once it has been kindled, and the
  // terraced field once Terraced Farming is researched.
  const hearth = document.getElementById("scene-hearth");
  if (hearth) hearth.style.display = GameState.hearthBuilt ? "" : "none";
  const terr = document.getElementById("scene-terraces");
  if (terr) terr.style.display = GameState.fieldRevealed ? "" : "none";
  const mines = document.getElementById("scene-mines");
  if (mines) mines.style.display = GameState.buildings.mines ? "" : "none";
  const docks = document.getElementById("scene-docks");
  if (docks) docks.style.display = GameState.buildings.docks ? "" : "none";

  // Map, civic and administration views.
  renderMap();
  renderCivic();
  renderAdmin();

  // Religion tools: the map button appears once the Hearth burns; refresh the
  // panel live whenever it is open.
  const relBtn = document.getElementById("open-religion");
  if (relBtn) {
    relBtn.style.display = GameState.hearthBuilt ? "" : "none";
    const handCount = GameState.hand.aspects.length + GameState.hand.epithets.length;
    const relBadge = document.getElementById("religion-badge");
    if (relBadge) relBadge.textContent = handCount;
  }
  if (!document.getElementById("religion-modal").hidden) renderReligion();
  if (!document.getElementById("tech-modal").hidden) renderTech();
  if (!document.getElementById("social-modal").hidden) renderSocial();

  // Control panel reflects the FSM and any pending demand.
  const btn = document.getElementById("end-turn-btn");
  const hint = document.getElementById("control-hint");
  if (GameState.status === GameStatus.ENDED) {
    btn.disabled = true;
    btn.textContent = "Era Complete";
    hint.textContent = GameState.stats.population <= 0
      ? "The Demos is no more. Refresh to begin anew."
      : "The Dawn Era has ended. A new age awaits in a future phase.";
  } else if (GameState.pendingCrisis || GameState.pendingFestival || GameState.pendingEpiphany || GameState.pendingMyth || GameState.pendingChoice || GameState.pendingPhoenician) {
    btn.disabled = true;
    btn.textContent = "End Turn";
    hint.textContent = GameState.pendingFestival ? "The Hekatomb Festival awaits your offerings."
      : GameState.pendingMyth  ? "A Mythic Cycle plays out — see it through before the year may turn."
      : GameState.pendingPhoenician ? "The Phoenician trader awaits your hospitality and judgement."
      : GameState.pendingChoice ? "An event demands your answer before the year may turn."
      : GameState.pendingEpiphany ? "A Divine Epiphany has gifted new cards — acknowledge the vision to continue."
      : "A crisis demands your answer before the year may turn.";
  } else {
    btn.disabled = false;
    btn.textContent = "End Turn";
    hint.textContent = GameState.winter > 0
      ? `A Great Winter grips the hills (${GameState.winter} ${GameState.winter === 1 ? "year" : "years"} left) — grain is eaten faster.`
      : "Advance the chronicle one year at a time.";
  }
}

/** Render the Labor panel: sliders to distribute citizens among the trades. */
export function renderLabor() {
  const body = document.getElementById("labor-body");
  if (!body) return;
  const alloc = GameState.jobAllocation;

  let rows = "";
  for (const key in JOBS) {
    const job = JOBS[key];
    rows +=
      `<div class="job-alloc">` +
        `<span class="ja-icon">${job.icon}</span>` +
        `<span class="ja-name">${job.name}<small>${job.yields}</small></span>` +
        `<input type="range" min="0" max="100" value="${alloc[key] || 0}" data-job="${key}" class="ja-range">` +
        `<span class="ja-count" id="ja-count-${key}"></span>` +
      `</div>`;
  }

  body.innerHTML =
    `<p class="admin-intro">Distribute your citizens among the trades. In these early years the ` +
    `<b>vast majority must farm</b>, or the granaries will run dry. Weights are relative; the head-counts ` +
    `update live and take effect from the next turn.</p>` +
    rows +
    `<div class="ja-balance" id="ja-balance"></div>` +
    `<div class="ja-foot"><span id="ja-total"></span>` +
      `<button class="map-btn" id="labor-reset">Reset to recommended</button></div>`;

  body.querySelectorAll(".ja-range").forEach(r => r.addEventListener("input", onLaborInput));
  document.getElementById("labor-reset").addEventListener("click", () => {
    GameState.jobAllocation = { ...DEFAULT_ALLOC };
    body.querySelectorAll(".ja-range").forEach(r =>
      { r.value = GameState.jobAllocation[r.getAttribute("data-job")] || 0; });
    GameState.jobs = assignJobs(GameState.stats.population);
    updateLaborReadout();
  });

  updateLaborReadout();
}

/** A labour slider moved: update the weight, recompute counts, refresh readouts. */
export function onLaborInput(e) {
  GameState.jobAllocation[e.target.getAttribute("data-job")] = +e.target.value;
  GameState.jobs = assignJobs(GameState.stats.population);
  updateLaborReadout();
}

/** Refresh the live head-counts, percentages and grain outlook (no slider rebuild). */
export function updateLaborReadout() {
  const pop = GameState.stats.population, alloc = GameState.jobAllocation;
  let total = 0;
  for (const key in JOBS) total += (alloc[key] || 0);
  if (total <= 0) total = 1;
  const counts = assignJobs(pop);

  for (const key in JOBS) {
    const el = document.getElementById(`ja-count-${key}`);
    if (el) el.innerHTML = `<b>${counts[key]}</b> · ${Math.round((alloc[key] || 0) / total * 100)}%`;
  }

  const grainProd = counts.farmers * YIELD.grain + (GameState.bonuses.grain || 0);
  const grainNeed = Math.ceil(pop * CONFIG.GRAIN_PER_CITIZEN);
  const bal = grainProd - grainNeed;
  const balEl = document.getElementById("ja-balance");
  if (balEl) {
    balEl.className = "ja-balance " + (bal >= 0 ? "good" : "bad");
    balEl.innerHTML = bal >= 0
      ? `🌾 Harvest outlook: <b>${grainProd}</b> grain grown vs <b>${grainNeed}</b> eaten — a surplus of +${bal}/yr.`
      : `⚠ Harvest outlook: <b>${grainProd}</b> grain grown vs <b>${grainNeed}</b> eaten — a shortfall of ${bal}/yr; famine looms.`;
  }
  const tot = document.getElementById("ja-total");
  if (tot) tot.textContent = `👥 ${pop} citizens`;
}

/** Render the interactive overlay (labels) atop the painted map scene. */
export function renderMap() {
  const overlay = document.getElementById("map-overlay");
  if (!overlay) return;
  overlay.innerHTML = "";

  // Civil-unrest banner.
  if (GameState.unrest > 0) {
    const banner = document.createElement("div");
    banner.id = "unrest-banner";
    banner.textContent =
      `⚠ Civil unrest — production reduced for ` +
      `${GameState.unrest} ${GameState.unrest === 1 ? "turn" : "turns"}`;
    overlay.appendChild(banner);
  }

  // The central Polis label (sits below the painted hilltop village).
  const polis = document.createElement("div");
  polis.className = "map-label polis";
  polis.style.left = "50%";
  polis.style.top  = "60%";
  polis.innerHTML =
    `<div class="ml-name">🏛️ ${GameState.cityName}</div>` +
    `<div class="ml-sub">${GameState.stats.population} souls</div>`;
  overlay.appendChild(polis);

  // Labels for the still-independent hamlets. Once a hamlet is integrated its
  // text box disappears, leaving only its physical huts painted on the land.
  GameState.hamlets.forEach(h => {
    if (h.absorbed) return;
    const m = document.createElement("div");
    m.className = "map-label hamlet";
    m.style.left = h.pos.left;
    m.style.top  = h.pos.top;
    m.innerHTML =
      `<div class="ml-name">${h.icon} ${h.name}</div>` +
      `<div class="ml-sub">${h.population} souls · click to unite</div>`;
    m.title = "Open Administration to unite this hamlet";
    m.addEventListener("click", openAdmin);
    overlay.appendChild(m);
  });

  // Update the Administration badge with the count of free hamlets.
  const badge = document.getElementById("admin-badge");
  if (badge) {
    const remaining = GameState.hamlets.filter(h => !h.absorbed).length;
    badge.textContent = remaining;
    badge.style.display = remaining ? "" : "none";
  }
}

/** Render the Civic Investments modal body. */
export function renderCivic() {
  const body = document.getElementById("civic-body");
  if (!body) return;

  const b = CIVIC.bard, hc = CIVIC.hearth;
  const ended    = GameState.status !== GameStatus.PLAYING || !!GameState.pendingCrisis || !!GameState.pendingFestival || !!GameState.pendingEpiphany || !!GameState.pendingMyth || !!GameState.pendingChoice || !!GameState.pendingPhoenician;
  const canBard  = GameState.stats.grain >= b.grain && GameState.stats.cattle >= b.cattle;
  const canHearth = !GameState.hearthBuilt &&
    GameState.stats.timber >= hc.timber && GameState.stats.clay >= hc.clay && GameState.stats.cattle >= hc.cattle;
  const locked = GameState.gods;

  body.innerHTML =
    `<p class="admin-intro">Before written law binds them, your people are held together by shared ` +
    `glory and shared gods. Fund renown to draw newcomers, and kindle the Ancestral Hearth to open your people to the gods.</p>` +

    `<div class="hamlet-card">` +
      `<div class="hc-head"><span class="hc-name">🎻 Fund an Aoidos</span><span class="hc-pop">Renown · Kleos</span></div>` +
      `<div class="hc-desc">A travelling bard carries the deeds of your Polis to distant halls, ` +
        `drawing wandering folk toward your gates.</div>` +
      `<div class="hc-asset">Effect: <b>+${b.kleos} Kleos</b> at once — higher Kleos lures more migrants</div>` +
      `<div class="hamlet-actions">` +
        `<button class="action-btn diplomatic" id="civic-bard" ${(!canBard || ended) ? "disabled" : ""}>` +
          `<span class="ab-title">🎻 Fund the Aoidos</span>` +
          `<span class="ab-cost">🌾 ${b.grain} grain · 🐄 ${b.cattle} cattle</span>` +
        `</button>` +
      `</div>` +
    `</div>` +

    `<div class="hamlet-card">` +
      `<div class="hc-head"><span class="hc-name">🪵 Ancestral Hearth</span><span class="hc-pop">Religion · Gods</span></div>` +
      `<div class="hc-desc">A humble hearth-shrine upon the hill. It opens your people to the ` +
        `<b>Divine Epiphany</b> — every ${RELIGION.EPIPHANY_INTERVAL} years a vision gifts an Aspect and an Epithet, ` +
        `from which protective <b>Daimones</b> are named and, over decades, raised to Heroes and Olympians.</div>` +
      `<div class="hc-asset">Effect: <b>opens the path of the gods</b> — kindle it EARLY, then manage gods in the ⛩ Gods &amp; Temple panel</div>` +
      `<div class="hamlet-actions">` +
        (GameState.hearthBuilt
          ? `<div class="civic-built">✓ The Ancestral Hearth burns — open ⛩ Gods &amp; Temple to name and tend your gods.</div>`
          : `<button class="action-btn" id="civic-hearth" ${(!canHearth || ended) ? "disabled" : ""}>` +
              `<span class="ab-title">🪵 Kindle the Hearth</span>` +
              `<span class="ab-cost">🪵 ${hc.timber} timber · 🧱 ${hc.clay} clay · 🐄 ${hc.cattle} cattle — built once</span>` +
            `</button>`) +
      `</div>` +
    `</div>` +

    civicBuildingCard("mines", ended) +
    civicBuildingCard("docks", ended) +

    `<div class="hamlet-card">` +
      `<div class="hc-head"><span class="hc-name">⛩️ The Pantheon</span>` +
        `<span class="hc-pop">${locked.length} / ${RELIGION.SLOTS} gods</span></div>` +
      `<div class="hc-desc">The gods your people have named, their tier and standing blessing. ` +
        `Name and raise them in the ⛩ Gods &amp; Temple panel.</div>` +
      `<div class="pantheon-list">` +
        (locked.length
          ? locked.map(g =>
              `<div class="pan-row ${g.harmonious ? "harmonious" : "confused"}">` +
                `<span class="pan-god">${ASPECTS[g.aspect].icon} ${godName(g)} <i>· ${TIER_NAME[g.tier]}</i></span>` +
                `<span class="pan-blessing">${blessingLine(g.epithet, g.tier, g.harmonious, g.trait)}</span>` +
              `</div>`).join("")
          : `<div class="pan-row empty"><span class="pan-god">No gods named</span>` +
            `<span class="pan-blessing">${GameState.hearthBuilt ? "name a Daimon to begin" : "kindle the Ancestral Hearth first"}</span></div>`) +
      `</div>` +
    `</div>`;

  const bardBtn = document.getElementById("civic-bard");
  if (bardBtn) bardBtn.addEventListener("click", fundBard);
  const hearthBtn = document.getElementById("civic-hearth");
  if (hearthBtn) hearthBtn.addEventListener("click", buildHearth);
  body.querySelectorAll("[data-build]").forEach(b => b.addEventListener("click", () => buildStructure(b.dataset.build)));
}

/** A Civic card for a building, shown once its technology is known. */
export function civicBuildingCard(id, ended) {
  const b = BUILDINGS[id];
  if (!GameState.techs[b.tech] && !GameState.buildings[id]) return "";   // hidden until the tech is learned
  const h = getHamlet(b.hamlet);
  const hamletIn = !!(h && h.absorbed);
  const built = GameState.buildings[id];
  const afford = canAfford(b.cost);
  let action;
  if (built) action = `<div class="civic-built">✓ ${b.name} stand${id === "docks" ? "" : "s"} — ${b.effect}</div>`;
  else if (!hamletIn) action = `<div class="rc-hint">🔒 Requires absorbing <b>${h ? h.name : b.hamlet}</b> through synoikismos.</div>`;
  else action = `<button class="action-btn" data-build="${id}" ${(!afford || ended) ? "disabled" : ""}>` +
                  `<span class="ab-title">${b.icon} Raise ${b.name}</span>` +
                  `<span class="ab-cost">${costText(b.cost)}${afford ? "" : " — not enough"}</span></button>`;
  return `<div class="hamlet-card">` +
    `<div class="hc-head"><span class="hc-name">${b.icon} ${b.name}</span><span class="hc-pop">Building</span></div>` +
    `<div class="hc-desc">${b.desc}</div>` +
    `<div class="hc-asset">Effect: ${b.effect}</div>` +
    `<div class="hamlet-actions">${action}</div>` +
  `</div>`;
}

/** Render the Divine Epiphany modal: draw the hand and wire the shrine. */
/* ---------- Divine Epiphany: the card-grant notice ---------- */
export function renderEpiphany() {
  const body = document.getElementById("epiphany-body");
  const g = GameState.lastGift;
  if (!body || !g) return;
  const a = ASPECTS[g.aspect], e = EPITHETS[g.epithet];
  body.innerHTML =
    `<p class="admin-intro">A vision seizes the people at the Hearth. They are gifted one <b>Aspect</b> and one ` +
    `<b>Epithet</b>. Nothing is named yet — raise them into a Local Cult and cultivate it over the years, or keep ` +
    `the cards for later. The longer a cult is nurtured before you consecrate it, the mightier the god it becomes.</p>` +
    `<div class="deck">` +
      `<div class="god-card aspect"><div class="gc-icon">${a.icon}</div><div class="gc-name">${a.name}</div>` +
        `<div class="gc-sub">Aspect · ${a.sub}</div><div class="gc-desc">${a.desc}</div></div>` +
      `<div class="god-card epithet"><div class="gc-icon">${e.icon}</div><div class="gc-name">${e.name}</div>` +
        `<div class="gc-sub">Epithet · ${e.sub}</div><div class="gc-desc">${e.desc}</div></div>` +
    `</div>` +
    `<div class="epiphany-actions">` +
      `<button class="action-btn diplomatic" id="ep-tend"><span class="ab-title">⛩️ Tend the Cults</span>` +
        `<span class="ab-cost">Open the Temenos to raise or feed a cult</span></button>` +
      `<button class="action-btn" id="ep-ack"><span class="ab-title">📜 Keep the Cards</span>` +
        `<span class="ab-cost">Set them aside for now</span></button>` +
    `</div>`;
  document.getElementById("ep-tend").addEventListener("click", () => { ackEpiphany(); openReligion(); });
  document.getElementById("ep-ack").addEventListener("click", ackEpiphany);
}

/* ---------- The Temenos: cult cultivation & the pantheon ---------- */
export function openReligion() { renderReligion(); openModal("religion-modal"); }

/** Per-turn blessing description for a cult at a given tier. */
export function blessingLine(epithet, tier, harmonious, trait) {
  const mult = TIER_MULT[tier] * (harmonious ? 1 : 0.45);
  const R = (n) => Math.round(n * mult);
  const eff = EPITHET_EFFECT[epithet] || {};
  const parts = [];
  if (eff.grain) parts.push(`+${R(eff.grain * (trait === "bounty" ? 1.6 : 1))} Grain`);
  if (eff.timber || eff.clay || eff.olives) {
    const seg = [];
    if (eff.timber) seg.push(`+${R(eff.timber)} Timber`);
    if (eff.clay)   seg.push(`+${R(eff.clay)} Clay`);
    if (eff.olives) seg.push(`+${R(eff.olives)} Olives`);
    parts.push(seg.join(", "));
  }
  if (eff.cattle) parts.push(`+${R(eff.cattle)} Cattle`);
  if (eff.kleos)  parts.push(`+${R(eff.kleos)} Kleos`);
  if (eff.calm)   parts.push(`−${R(eff.calm * (trait === "slayer" ? 2 : 1))} Discontent, steadies unrest`);
  const tail = [];
  if (eff.diplo)   tail.push("eases negotiation");
  if (eff.martial) tail.push("eases conquest");
  let s = parts.length ? parts.join(" · ") + " / turn" : "";
  if (tail.length) s += (s ? " · " : "") + tail.join(" · ");
  return s || "a standing blessing";
}
export function traitLabel(trait) {
  return trait === "slayer" ? "⚔ Monster-Slayer"
       : trait === "bounty" ? "🌿 Bringer of Bounty"
       : trait === "warden" ? "🕯 Warden of Health" : "";
}

export function renderReligion() {
  const body = document.getElementById("religion-body");
  if (!body) return;
  const hand = GameState.hand;
  const gods = GameState.gods;
  const slotsLeft = RELIGION.SLOTS - gods.length;

  let html =
    `<p class="admin-intro">A god is named at once as a humble <b>Daimon</b> — a domain-spirit that shields the people ` +
    `against catastrophe in its sphere. Keep a god <b>happy</b> (fed its yearly upkeep) for ${RELIGION.ASCEND_TURNS[2]} years and it ` +
    `becomes ready to face a <b>Mythic Cycle</b>; survive that story and it ascends to a <b>Heros</b>, and a second, harder cycle ` +
    `later raises a Heros to an <b>Olympian</b>. There is no shortcut — each ascent is the work of decades.</p>`;

  if (GameState.winter > 0)
    html += `<div class="rel-banner cold">❄ A Great Winter grips the hills — grain is scarce and the gods go hungrier.</div>`;

  // ---- Founding bench: name a Daimon (needs BOTH cards; preview harmony) ----
  const sel = GameState.relSelect || { aspect: null, epithet: null };
  if (sel.aspect && hand.aspects.indexOf(sel.aspect) < 0) sel.aspect = null;
  if (sel.epithet && hand.epithets.indexOf(sel.epithet) < 0) sel.epithet = null;
  html += `<div class="deck-label">The founding bench — ${hand.aspects.length} Aspects · ${hand.epithets.length} Epithets in hand</div>`;
  if (hand.aspects.length === 0 && hand.epithets.length === 0) {
    html += `<p class="rel-empty">No cards in hand. A Divine Epiphany will gift more in the years to come.</p>`;
  } else {
    html += `<div class="rel-hand">`;
    const aC = {}; hand.aspects.forEach(id => aC[id] = (aC[id] || 0) + 1);
    const eC = {}; hand.epithets.forEach(id => eC[id] = (eC[id] || 0) + 1);
    Object.keys(aC).forEach(id =>
      html += `<button class="rel-card aspect${sel.aspect === id ? " sel" : ""}" data-pick-aspect="${id}">` +
              `<span class="rc-ic">${ASPECTS[id].icon}</span><span class="rc-nm">${ASPECTS[id].name}${aC[id] > 1 ? ` ×${aC[id]}` : ""}</span></button>`);
    Object.keys(eC).forEach(id =>
      html += `<button class="rel-card epithet${sel.epithet === id ? " sel" : ""}" data-pick-epithet="${id}">` +
              `<span class="rc-ic">${EPITHETS[id].icon}</span><span class="rc-nm">${EPITHETS[id].name}${eC[id] > 1 ? ` ×${eC[id]}` : ""}</span></button>`);
    html += `</div>`;
    let preview, cls = "";
    const aspectTaken = sel.aspect && GameState.gods.some(g => g.aspect === sel.aspect);
    if (!sel.aspect || !sel.epithet) {
      preview = "Select <b>one Aspect</b> (its domain) and <b>one Epithet</b> (its title) to name a Daimon.";
    } else if (aspectTaken) {
      cls = "mismatch";
      preview = `A god of <b>${DOMAIN_LABEL[sel.aspect]}</b> is already worshipped — a domain will not suffer two masters. Choose a different Aspect.`;
    } else {
      const harm = isHarmonious(sel.aspect, sel.epithet);
      cls = harm ? "match" : "mismatch";
      preview = `${ASPECTS[sel.aspect].god} ${EPITHETS[sel.epithet].name}, spirit of ${DOMAIN_LABEL[sel.aspect]} — ` +
        (harm ? `✦ <b>Harmonious</b>: its favour will run strong.` : `≈ <b>Ill-matched</b>: a confused god of feeble favour.`);
    }
    html += `<div class="bench-preview ${cls}">${preview}</div>`;
    const can = sel.aspect && sel.epithet && !aspectTaken && slotsLeft > 0 && canAfford(TEMENOS[1]);
    html += `<div class="cult-actions">` +
      `<button class="mini-btn lock${can ? "" : " off"}" id="rel-establish" ${can ? "" : "disabled"}>⛩️ Name a Daimon — ${costText(TEMENOS[1])}${slotsLeft > 0 ? "" : " · pantheon full"}</button>` +
      `<button class="mini-btn" id="rel-clearsel">Clear</button>` +
    `</div>`;
  }

  // ---- The Pantheon: gods, happiness, ascension ----
  html += `<div class="deck-label">The Pantheon — ${gods.length} / ${RELIGION.SLOTS} gods</div>`;
  if (gods.length === 0) html += `<p class="rel-empty">No gods yet named. Name a Daimon above to shield your people.</p>`;
  gods.forEach(g => {
    const up = godUpkeep(g.tier);
    const happy = isGodHappy(g);
    const need = ascendNeed(g);
    const pct = Math.max(0, Math.min(100, g.happiness));
    html += `<div class="cult-card locked tier${g.tier}">`;
    html += `<div class="hc-head"><span class="hc-name">${ASPECTS[g.aspect].icon} ${godName(g)}</span>` +
            `<span class="hc-pop">${TIER_NAME[g.tier]} · ${TIER_SUB[g.tier]}</span></div>`;
    html += `<div class="cult-meta">Domain: <b>${DOMAIN_LABEL[g.aspect]}</b> — shields against catastrophe here` +
            (g.harmonious ? " · ✦ harmonious" : " · ≈ ill-matched") + (g.trait ? ` · ${traitLabel(g.trait)}` : "") + `</div>`;
    // happiness — a clean labelled line above a thin bar (with the "happy" mark)
    const drag = jealousyDrag(g);
    html += `<div class="happy-line"><span>${happy ? "😊" : "😟"} Happiness <b>${Math.round(g.happiness)}</b>/100</span>` +
            `<span class="happy-up">upkeep ${costText(up)}/yr${drag ? ` · ⚡Phthonos −${drag}/yr` : ""}</span></div>`;
    html += `<div class="happy-bar"><div class="happy-fill${happy ? "" : " sad"}" style="width:${pct}%"></div>` +
            `<span class="happy-mark" style="left:${RELIGION.HAPPY}%" title="happy threshold"></span></div>`;
    html += `<div class="hc-asset">Blessing: ${blessingLine(g.epithet, g.tier, g.harmonious, g.trait)}${happy ? "" : " <i>(withheld while unhappy)</i>"}</div>`;
    // ascension progress / button
    if (g.tier < 3) {
      if (canAscend(g)) {
        html += `<div class="ascend-ready">★ Ready to ascend to <b>${TIER_NAME[g.tier + 1]}</b> — the people will face a Mythic Cycle.</div>`;
      } else {
        html += `<div class="cult-meta">Toward ${TIER_NAME[g.tier + 1]}: <b>${g.turnsHappy} / ${need}</b> happy years` +
                (g.tier === 2 ? " (then a harder cycle)" : "") + `</div>`;
      }
    } else {
      html += `<div class="ascend-ready" style="color:var(--ochre)">🏛 An Olympian — its legacy will carry into the Archaic Era.</div>`;
    }
    html += `<div class="cult-actions">`;
    for (const k in OFFERINGS) {
      const o = OFFERINGS[k]; const ok = canAfford(o.cost);
      html += `<button class="mini-btn${ok ? "" : " off"}" data-offer="${g.id}" data-kind="${k}" ${ok ? "" : "disabled"}>${o.label} (${costText(o.cost)} → +${o.happy}😊)</button>`;
    }
    if (canAscend(g))
      html += `<button class="mini-btn lock" data-ascend="${g.id}">⚔ Begin the Mythic Cycle → ${TIER_NAME[g.tier + 1]}</button>`;
    html += `<button class="mini-btn danger" data-disband="${g.id}">Disband</button>`;
    html += `</div></div>`;
  });

  body.innerHTML = html;
  body.querySelectorAll("[data-pick-aspect]").forEach(b => b.addEventListener("click", () => relPick("aspect", b.dataset.pickAspect)));
  body.querySelectorAll("[data-pick-epithet]").forEach(b => b.addEventListener("click", () => relPick("epithet", b.dataset.pickEpithet)));
  const est = document.getElementById("rel-establish"); if (est) est.addEventListener("click", establishGod);
  const clr = document.getElementById("rel-clearsel"); if (clr) clr.addEventListener("click", () => { GameState.relSelect = { aspect: null, epithet: null }; renderReligion(); });
  body.querySelectorAll("[data-offer]").forEach(b => b.addEventListener("click", () => makeOffering(+b.dataset.offer, b.dataset.kind)));
  body.querySelectorAll("[data-ascend]").forEach(b => b.addEventListener("click", () => beginAscension(+b.dataset.ascend)));
  body.querySelectorAll("[data-disband]").forEach(b => b.addEventListener("click", () => disbandGod(+b.dataset.disband)));
}

/* ---------- Mythic Cycle modal (multi-scene text story) ---------- */
export function renderMyth() {
  const body = document.getElementById("myth-body");
  const pm = GameState.pendingMyth;
  if (!body || !pm) return;
  const g = getGod(pm.godId);
  if (!g) { GameState.pendingMyth = null; closeModal("myth-modal"); render(); return; }
  const scene = MYTH_STORY[pm.scene];
  const fl = MYTH_FLAVOR[g.aspect];

  let html =
    `<div class="crisis-head"><span class="crisis-icon">${fl.icon}</span>` +
      `<span class="crisis-name">${scene.title}</span></div>` +
    `<div class="myth-sub">The Mythic Cycle of ${godName(g)} — to ascend to ${TIER_NAME[pm.target]}</div>` +
    `<p class="crisis-desc myth-story">${mythText(scene.text, g)}</p>`;

  if (scene.final) {
    const odds = Math.round(mythFinalOdds(scene, pm.target) * 100);
    const stakes = pm.target === 3
      ? "Win, and an OLYMPIAN is born; fail, and the foe ravages the land and the god is CAST DOWN to a Daimon — all its progress lost."
      : "Win and the god ascends to Heros; fail and the foe ravages the land.";
    html += `<div class="crisis-threat">The reckoning is at hand — the odds of victory are <b>${odds}%</b>. ${pm.target === 3 ? "<b>An Olympian bid is perilous.</b>" : ""}</div>` +
      `<div class="crisis-actions">` +
        `<button class="action-btn diplomatic" id="myth-face"><span class="ab-title">⚔ Face ${fl.foe}</span>` +
        `<span class="ab-cost">${stakes}</span></button>` +
      `</div>`;
  } else {
    html += `<div class="crisis-actions">`;
    scene.options.forEach((o, i) => {
      const free = !o.cost || Object.keys(o.cost).length === 0;
      const ok = free || canAfford(o.cost);
      html += `<button class="action-btn" data-opt="${i}" ${ok ? "" : "disabled"}>` +
        `<span class="ab-title">${o.label}</span>` +
        `<span class="ab-cost">${free ? "no cost" : costText(o.cost) + (ok ? "" : " — not enough")}</span></button>`;
    });
    html += `</div>`;
    if (pm.scene === 0)
      html += `<div class="crisis-actions" style="margin-top:8px"><button class="action-btn" id="myth-withdraw">` +
        `<span class="ab-title">🌫 Withdraw — the city is not ready</span><span class="ab-cost">Wait, and attempt the cycle later</span></button></div>`;
  }
  body.innerHTML = html;
  if (scene.final) {
    document.getElementById("myth-face").addEventListener("click", mythResolve);
  } else {
    body.querySelectorAll("[data-opt]").forEach(b => b.addEventListener("click", () => mythChoose(+b.dataset.opt)));
    const wd = document.getElementById("myth-withdraw"); if (wd) wd.addEventListener("click", mythWithdraw);
  }
}

/* ---------- The Phoenician negotiation (multi-scene) ---------- */
export function renderPhoenician() {
  const body = document.getElementById("phoenician-body");
  const pp = GameState.pendingPhoenician;
  if (!body || !pp) return;
  const scene = PHOENICIAN_STORY[pp.scene];
  const rapTag = pp.rapport >= 4 ? "warm" : pp.rapport <= 0 ? "cold" : "guarded";

  let html =
    `<div class="crisis-head"><span class="crisis-icon">⚓</span><span class="crisis-name">${scene.title}</span></div>` +
    `<div class="myth-sub">Hiram the Phoenician — rapport so far: ${pp.rapport} (${rapTag})</div>` +
    `<p class="crisis-desc myth-story">${phoenicianText(scene.text)}</p>`;

  if (scene.final) {
    const ok = pp.rapport >= scene.need;
    html += `<div class="crisis-threat" style="border-color:${ok ? "var(--good)" : "var(--bad)"};color:var(--ink)">` +
      `He needs to feel a rapport of <b>${scene.need}</b> to stay and teach. You have built <b>${pp.rapport}</b> — ` +
      (ok ? "he trusts you." : "it may not be enough.") + `</div>` +
      `<div class="crisis-actions"><button class="action-btn diplomatic" id="phoen-end">` +
      `<span class="ab-title">📜 Hear his decision</span><span class="ab-cost">Success unlocks the Phoenician Alphabet to research</span></button></div>`;
  } else {
    html += `<div class="crisis-actions">`;
    scene.options.forEach((o, i) => {
      const free = !o.cost || Object.keys(o.cost).length === 0;
      const can = free || canAfford(o.cost);
      const rap = o.rapport >= 0 ? `+${o.rapport}` : `${o.rapport}`;
      html += `<button class="action-btn" data-popt="${i}" ${can ? "" : "disabled"}>` +
        `<span class="ab-title">${o.label}</span>` +
        `<span class="ab-cost">${free ? "no cost" : costText(o.cost)}${can ? "" : " — not enough"} · rapport ${rap}</span></button>`;
    });
    html += `</div>`;
  }
  body.innerHTML = html;
  if (scene.final) {
    document.getElementById("phoen-end").addEventListener("click", phoenicianResolve);
  } else {
    body.querySelectorAll("[data-popt]").forEach(b => b.addEventListener("click", () => phoenicianChoose(+b.dataset.popt)));
  }
}

/* ---------- Catastrophe / flavour-event modal ---------- */
export function renderChoice() {
  const body = document.getElementById("choice-body");
  const pc = GameState.pendingChoice;
  if (!body || !pc) return;
  const ev = pc.ev;

  if (pc.kind === "catastrophe") {
    const god = pc.godId != null ? getGod(pc.godId) : null;
    body.innerHTML =
      `<div class="crisis-head"><span class="crisis-icon">${ev.icon}</span><span class="crisis-name">${ev.name}</span></div>` +
      `<p class="crisis-desc">${ev.desc}</p>` +
      (god
        ? `<div class="crisis-threat" style="border-color:var(--good);color:var(--ink)">🛡 ${godName(god)}, ${TIER_NAME[god.tier]} of ${DOMAIN_LABEL[ev.domain]}, stands between the people and ruin. The toll will be only <b>${formatChanges(ev.savedDamage)}</b>.</div>`
        : `<div class="crisis-threat">No god of <b>${DOMAIN_LABEL[ev.domain]}</b> guards the people. The toll will be <b>${formatChanges(ev.damage)}</b> — name such a god, and next time you may be spared.</div>`) +
      `<div class="crisis-actions"><button class="action-btn ${god ? "diplomatic" : ""}" id="choice-cat">` +
        `<span class="ab-title">${god ? "🙏 Trust in the god" : "🛡 Endure the catastrophe"}</span></button></div>`;
    document.getElementById("choice-cat").addEventListener("click", resolveCatastrophe);
    return;
  }

  if (pc.kind === "godevent") {
    const god = getGod(pc.godId);
    const desc = typeof ev.desc === "function" ? ev.desc(god) : ev.desc;
    const canA = !ev.a.cost || canAfford(ev.a.cost);
    const lbl = (o) => `${o.label}${o.happy != null ? `  ·  ${o.happy >= 0 ? "+" : ""}${o.happy}😊` : ""}`;
    body.innerHTML =
      `<div class="crisis-head"><span class="crisis-icon">${ev.icon}</span><span class="crisis-name">${ev.name}</span></div>` +
      `<p class="crisis-desc">${desc}</p>` +
      `<div class="crisis-actions">` +
        `<button class="action-btn diplomatic" id="choice-a" ${canA ? "" : "disabled"}>` +
          `<span class="ab-title">${lbl(ev.a)}</span><span class="ab-cost">${canA ? "" : "not enough"}</span></button>` +
        `<button class="action-btn" id="choice-b"><span class="ab-title">${lbl(ev.b)}</span></button>` +
      `</div>`;
    document.getElementById("choice-a").addEventListener("click", () => resolveGodEvent("a"));
    document.getElementById("choice-b").addEventListener("click", () => resolveGodEvent("b"));
    return;
  }

  if (pc.kind === "merchant") {
    const t = pc.trade;
    const can = canAfford(t.give);
    body.innerHTML =
      `<div class="crisis-head"><span class="crisis-icon">⛵</span><span class="crisis-name">A Foreign Merchant</span></div>` +
      `<p class="crisis-desc">At the docks, ${t.who} lays out their wares and proposes a barter.</p>` +
      `<div class="crisis-threat" style="border-color:var(--ochre);color:var(--ink)">They will give <b>${costText(t.get)}</b> for your <b>${costText(t.give)}</b>.</div>` +
      `<div class="crisis-actions">` +
        `<button class="action-btn diplomatic" id="merch-yes" ${can ? "" : "disabled"}>` +
          `<span class="ab-title">🤝 Strike the bargain</span><span class="ab-cost">${can ? "" : "you lack the goods"}</span></button>` +
        `<button class="action-btn" id="merch-no"><span class="ab-title">🚫 Decline</span></button>` +
      `</div>`;
    document.getElementById("merch-yes").addEventListener("click", () => resolveMerchant(true));
    document.getElementById("merch-no").addEventListener("click", () => resolveMerchant(false));
    return;
  }

  // respond-able flavour event
  const canA = !ev.a.cost || canAfford(ev.a.cost);
  const canB = !ev.b.cost || canAfford(ev.b.cost);
  body.innerHTML =
    `<div class="crisis-head"><span class="crisis-icon">${ev.icon}</span><span class="crisis-name">${ev.name}</span></div>` +
    `<p class="crisis-desc">${ev.desc}</p>` +
    `<div class="crisis-actions">` +
      `<button class="action-btn diplomatic" id="choice-a" ${canA ? "" : "disabled"}>` +
        `<span class="ab-title">${ev.a.label}</span><span class="ab-cost">${canA ? "" : "not enough"}</span></button>` +
      `<button class="action-btn" id="choice-b" ${canB ? "" : "disabled"}>` +
        `<span class="ab-title">${ev.b.label}</span></button>` +
    `</div>`;
  document.getElementById("choice-a").addEventListener("click", () => resolveChoice("a"));
  document.getElementById("choice-b").addEventListener("click", () => resolveChoice("b"));
}

/* ---------- The Tech Tree (Knowledge) modal ---------- */
export function openTech() { renderTech(); openModal("tech-modal"); }
export function renderTech() {
  const body = document.getElementById("tech-body");
  if (!body) return;
  const r = GameState.research;

  let html =
    `<p class="admin-intro">Two currents of knowledge drive invention: <b>⚒ Ergon</b>, the practical know-how of labour, ` +
    `and <b>📜 Muthos</b>, the lore and story of cultural life. A technology is mastered once both are stockpiled to its ` +
    `cost and its forerunners are known. <b>Research halts entirely</b> in any year of famine or unresolved crisis.</p>`;

  html += `<div class="tech-banks">` +
    `<div class="tech-bank ergon"><span class="tb-ic">⚒</span><span class="tb-val">${GameState.ergon}</span>` +
      `<span class="tb-lbl">Ergon${r.halted ? "" : ` · +${GameState.lastErgon || 0}/yr`}</span></div>` +
    `<div class="tech-bank muthos"><span class="tb-ic">📜</span><span class="tb-val">${GameState.muthos}</span>` +
      `<span class="tb-lbl">Muthos${r.halted ? "" : ` · +${GameState.lastMuthos || 0}/yr`}</span></div>` +
    `</div>`;
  if (r.halted)
    html += `<div class="rel-banner jealous">⚠ Research is halted this year — ${r.reason === "famine" ? "the people starve" : "a crisis grips the Polis"} and no new knowledge takes root.</div>`;

  // The tree flows top → bottom: Terraced, then Mining + Naval side by side,
  // then the Phoenician Alphabet at the foot.
  const layout = {
    terraced: "grid-column:1 / span 2; grid-row:1",
    mining:   "grid-column:1; grid-row:2",
    naval:    "grid-column:2; grid-row:2",
    alphabet: "grid-column:1 / span 2; grid-row:3",
  };
  html += `<div class="tech-tree vertical">`;
  ["terraced", "mining", "naval", "alphabet"].forEach(id => {
    const t = TECHS[id];
    const done = !!GameState.techs[id];
    const avail = techAvailable(id);
    const afford = canAfford(t.cost);
    const state = done ? "done" : avail ? (afford ? "ready" : "avail") : "locked";
    let lockMsg;
    if (id === "alphabet") {
      const needTech = t.req.filter(rq => !GameState.techs[rq]).map(rq => TECHS[rq].name);
      lockMsg = needTech.length ? `🔒 Requires ${needTech.join(" & ")}`
        : (!GameState.alphabetUnlocked ? `🔒 Requires the Phoenician's gift of letters — build the Docks and win Hiram's trust` : "");
    } else {
      lockMsg = `🔒 Requires ${t.req.map(rq => TECHS[rq].name).join(" & ")}`;
    }
    html += `<div class="tech-node st-${state}" style="${layout[id]}">` +
      `<div class="tn-head"><span class="tn-ic">${t.icon}</span><span class="tn-name">${t.name}</span></div>` +
      `<div class="tn-desc">${t.desc}</div>` +
      `<div class="tn-eff">${t.effect}</div>` +
      (done
        ? `<div class="tn-state done">✓ Mastered</div>`
        : avail
          ? `<button class="mini-btn lock${afford ? "" : " off"}" data-tech="${id}" ${afford ? "" : "disabled"}>Research — ${costText(t.cost)}</button>`
          : `<div class="tn-state locked">${lockMsg}</div>`) +
      `</div>`;
  });
  // downward connector arrows
  html += `<div class="tech-arrow d1">↓</div><div class="tech-arrow d2">↓</div>` +
          `<div class="tech-arrow d3">↓</div><div class="tech-arrow d4">↓</div>`;
  html += `</div>`;

  body.innerHTML = html;
  body.querySelectorAll("[data-tech]").forEach(b => b.addEventListener("click", () => researchTech(b.dataset.tech)));
}

/** Render the pending crisis into the (non-dismissable) crisis modal. */
export function renderCrisis() {
  const c = GameState.pendingCrisis;
  const body = document.getElementById("crisis-body");
  if (!c || !body) return;

  const god = domainGod(c.domain);
  const shielded = god ? scaleDamage(c.damage, DIVINE_AVERT[god.tier]) : c.damage;
  const canInvoke = GameState.macros.eusebeia >= c.pietyCost;
  const invokeDmg = scaleDamage(shielded, 0.5);

  body.innerHTML =
    `<div class="crisis-head"><span class="crisis-icon">${c.icon}</span>` +
      `<span class="crisis-name">${c.name}</span></div>` +
    `<p class="crisis-desc">${c.desc}</p>` +
    (god
      ? `<div class="crisis-threat" style="border-color:var(--good);color:var(--ink)">🛡 ${godName(god)}, ${TIER_NAME[god.tier]} of ${DOMAIN_LABEL[c.domain]}, shields the people — the toll is reduced to <b>${Object.keys(shielded).length ? formatChanges(shielded) : "nothing"}</b>.</div>`
      : `<div class="crisis-threat">No god of <b>${DOMAIN_LABEL[c.domain]}</b> answers. Unchecked, this costs <b>${formatChanges(c.damage)}</b>.</div>`) +
    `<div class="crisis-actions">` +
      `<button class="action-btn diplomatic" id="crisis-invoke" ${canInvoke ? "" : "disabled"}>` +
        `<span class="ab-title">🙏 Invoke Divine Favor</span>` +
        `<span class="ab-cost">` +
          (canInvoke
            ? `Spend 🔥 ${c.pietyCost} Piety — toll softened to ${Object.keys(invokeDmg).length ? formatChanges(invokeDmg) : "nothing"}`
            : `Requires 🔥 ${c.pietyCost} Piety (you have ${GameState.macros.eusebeia})`) +
        `</span>` +
      `</button>` +
      `<button class="action-btn" id="crisis-endure">` +
        `<span class="ab-title">${god ? "🛡 Trust your god" : "🛡 Endure the Crisis"}</span>` +
        `<span class="ab-cost">Bear the toll: ${Object.keys(shielded).length ? formatChanges(shielded) : "nothing"}</span>` +
      `</button>` +
    `</div>`;

  document.getElementById("crisis-invoke").addEventListener("click", () => resolveCrisis(true));
  document.getElementById("crisis-endure").addEventListener("click", () => resolveCrisis(false));
}

/** Render the Administration (Synoikismos) modal body. */
export function renderAdmin() {
  const body = document.getElementById("admin-body");
  if (!body) return;

  const remaining = GameState.hamlets.filter(h => !h.absorbed);
  if (remaining.length === 0) {
    body.innerHTML =
      `<div class="admin-done">⚖ Synoikismos complete — every neighbouring ` +
      `hamlet has joined ${GameState.cityName}.</div>`;
    return;
  }

  const ended = GameState.status !== GameStatus.PLAYING || !!GameState.pendingCrisis || !!GameState.pendingFestival || !!GameState.pendingEpiphany || !!GameState.pendingMyth || !!GameState.pendingChoice || !!GameState.pendingPhoenician;
  const total = INTEGRATION_STAGES.length;

  let html =
    `<p class="admin-intro">Each hamlet is drawn into the Polis through a long chain of overtures — ${total} stages, ` +
    `with the people resting ${CONFIG.INTEGRATION_GAP} years between each. Every stage may be pressed by <b>force</b> ` +
    `(cheap in goods, dear in cattle and grain, and it breeds <b>civil unrest</b>) or by <b>negotiation</b> (costly in wine, ` +
    `oil, Kleos and Piety). Your gods tip the scales: <i>Xenios/Boulaios</i> ease talks, <i>Polemios</i> & monster-slayers ` +
    `ease force, and a harmonious god makes the Sacred Bond cheap. A first union is the work of decades.</p>` +
    (hasDiplomaticGod() || hasMartialGod()
      ? `<div class="rel-banner jealous" style="background:rgba(91,122,44,.12);border-color:var(--good);color:var(--ink)">` +
        `${hasDiplomaticGod() ? "✦ A god of hospitality eases your negotiations. " : ""}` +
        `${hasMartialGod() ? "⚔ A martial god steels your warriors and softens the unrest of conquest." : ""}</div>`
      : "");

  remaining.forEach(h => {
    const resting = GameState.turn < h.cooldownUntil;
    const wait = h.cooldownUntil - GameState.turn;
    const stage = INTEGRATION_STAGES[h.stage];

    // progress track
    let track = "";
    for (let i = 0; i < total; i++)
      track += `<span class="stage-pip ${i < h.stage ? "done" : i === h.stage ? "now" : ""}">${i < h.stage ? "●" : "○"}</span>`;

    html +=
      `<div class="hamlet-card">` +
        `<div class="hc-head">` +
          `<span class="hc-name">${h.icon} ${h.name}</span>` +
          `<span class="hc-pop">${h.population} souls · stage ${h.stage} / ${total}</span>` +
        `</div>` +
        `<div class="hc-desc">${h.desc}</div>` +
        `<div class="hc-asset">Asset once absorbed: <b>${bonusText(h.asset.bonus)}</b></div>` +
        `<div class="stage-track">${track} <b>${stage.name}</b></div>` +
        `<div class="cult-meta">${stage.desc.replace("{name}", h.name)}</div>`;

    if (resting) {
      html += `<div class="hc-asset" style="color:var(--ink-soft)">⏳ The people of ${h.name} consider your last overture — ${wait} ${wait === 1 ? "year" : "years"} until the next stage.</div>`;
    } else {
      const tCost = integrationCost(stage, "talk");
      const fCost = integrationCost(stage, "force");
      const fUnrest = integrationUnrest(stage);
      const canT = canAfford(tCost), canF = canAfford(fCost);
      html +=
        `<div class="hamlet-actions">` +
          `<button class="action-btn diplomatic" data-talk="${h.id}" ${(!canT || ended) ? "disabled" : ""}>` +
            `<span class="ab-title">🕊 ${stage.talk.label}</span>` +
            `<span class="ab-cost">${costText(tCost)}${canT ? "" : " — not enough"}</span>` +
          `</button>` +
          `<button class="action-btn" data-force="${h.id}" ${(!canF || ended) ? "disabled" : ""}>` +
            `<span class="ab-title">⚔ ${stage.force.label}</span>` +
            `<span class="ab-cost">${costText(fCost)}${fUnrest ? ` · +${fUnrest} unrest` : ""}${canF ? "" : " — not enough"}</span>` +
          `</button>` +
        `</div>`;
    }
    html += `</div>`;
  });

  body.innerHTML = html;

  body.querySelectorAll("[data-talk]").forEach(btn =>
    btn.addEventListener("click", () => attemptIntegration(btn.getAttribute("data-talk"), "talk")));
  body.querySelectorAll("[data-force]").forEach(btn =>
    btn.addEventListener("click", () => attemptIntegration(btn.getAttribute("data-force"), "force")));
}

/* ---------- The Social Orders panel ---------- */
export function openSocial() { renderSocial(); openModal("social-modal"); }

/** Render the Social Orders modal: each order's Clout %, Satisfaction, drivers. */
export function renderSocial() {
  const body = document.getElementById("social-body");
  if (!body) return;
  const sc = GameState.socialClasses;

  let html =
    `<p class="admin-intro">The Polis is no single people but an order of ranks. Each <b>order</b> holds a share of ` +
    `political <b>Clout</b> (always summing to 100%) and a measure of <b>Satisfaction</b> (0–100); together they set the ` +
    `city's <b>Discontent</b>. Re-balance the <b>Labor of the Demos</b> and master new crafts to reshape who holds sway.</p>`;

  const dC = GameState.globalDiscontent;
  const dClass = dC >= 40 ? "hot" : dC >= 20 ? "warm" : "cool";
  html += `<div class="social-discontent ${dClass}">Global Discontent <b>${dC}</b><span>/100</span></div>`;

  for (const key in sc) {
    const c = sc[key];
    const meta = SOCIAL_META[key] || { name: key, sub: "", accent: "#a8492c" };
    const clout = Math.round(c.clout);
    const sat = Math.round(c.satisfaction);
    const satSad = sat >= 60 ? "" : " sad";
    html +=
      `<div class="social-card" style="border-left-color:${meta.accent}">` +
        `<div class="social-head">` +
          `<span class="social-name" style="color:${meta.accent}">${meta.name}</span>` +
          `<span class="social-sub">${meta.sub}</span>` +
        `</div>` +
        `<div class="happy-line"><span>⚖ Clout</span><b>${clout}%</b></div>` +
        `<div class="happy-bar"><div class="happy-fill" style="width:${clout}%;background:${meta.accent}"></div></div>` +
        `<div class="happy-line"><span>😊 Satisfaction</span><b>${sat}</b>/100</div>` +
        `<div class="happy-bar"><div class="happy-fill${satSad}" style="width:${sat}%"></div></div>` +
        `<div class="social-driver">${describeSocialClass(key)}</div>` +
      `</div>`;
  }

  body.innerHTML = html;
}

/** Append a single chronicle entry to the log panel and scroll into view. */
export function renderLogEntry(entry) {
  const log = document.getElementById("chronicle-log");
  const cls = entry.kind === "event"   ? " log-event"
            : entry.kind === "system"  ? " log-system"
            : entry.kind === "warning" ? " log-warning" : "";
  const el = document.createElement("div");
  el.className = "log-entry" + cls;
  el.innerHTML =
    `<span class="log-year">${formatYear(entry.year)}</span>` +
    `<span class="log-text">${entry.text}</span>`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}
