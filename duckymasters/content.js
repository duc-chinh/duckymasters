(() => {
  "use strict";

  if (window.__duckymastersLoaded) return;
  window.__duckymastersLoaded = true;

  const MAX_MARKET_REQUESTS = 20;
  const POSITION_KEY = "wmAveragePanelPosition";
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

  const state = { running: false, paused: false, blocked: false, marketLimited: false, queue: [], cache: new Map(), requests: 0, marketRequests: 0, done: 0, successful: 0, logs: [] };
  const isCollection = () => location.pathname.startsWith("/collection");
  const isMarket = () => location.pathname.startsWith("/marketplace");
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = element => Boolean(element && (element.offsetWidth || element.offsetHeight || element.getClientRects().length));
  const normaliseText = value => String(value || "").replace(/\s+/g, " ").trim();
  const normaliseUrl = value => { try { return decodeURIComponent(new URL(value).pathname).normalize("NFC").replace(/[’‘`]/g, "'").replace(/\/+$/, "").toLocaleLowerCase("fr-FR"); } catch { return String(value || ""); } };
  const collectionItems = data => Array.isArray(data) ? data : (data.items || data.collection || data.data || []);
  const formatAverage = value => { const number = Number(value); return Number.isFinite(number) ? `${number.toLocaleString("fr-FR")} W` : "— W"; };

  async function api(url) {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw Error(`HTTP ${response.status} — ${url}`);
    return response.json();
  }

  function cardHost(link) {
    return link.closest("a.card-frame, article, li, [class*='card'], [class*='glow-']") || link.parentElement;
  }

  function cardBadge(host) {
    let badge = host.querySelector(":scope > .wm-average-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "wm-average-badge";
      host.appendChild(badge);
    }
    return badge;
  }

  async function average(cardId, rarity) {
    const cacheKey = `${cardId}|${rarity}`;
    if (state.cache.has(cacheKey)) return state.cache.get(cacheKey);
    const promise = api(`/api/marketplace/cards/${encodeURIComponent(cardId)}/sales?scope=summary`)
      .then(data => formatAverage(data?.summary?.[String(rarity || "").toUpperCase()]?.average));
    state.cache.set(cacheKey, promise);
    try { return await promise; } finally { state.cache.delete(cacheKey); }
  }

  async function filteredCollectionJobs() {
    await delay(400);
    const raw = await api("/api/my-collection");
    const index = new Map(collectionItems(raw)
      .filter(item => item?.card?.wikipedia_url && item.card_id)
      .map(item => [normaliseUrl(item.card.wikipedia_url), item]));
    const seen = new Set();
    const jobs = [];
    const links = [...document.querySelectorAll('a[href*="wikipedia.org/wiki/"]')].filter(visible);

    for (const link of links) {
      const urlKey = normaliseUrl(link.href);
      if (!urlKey || seen.has(urlKey)) continue;
      seen.add(urlKey);
      const host = cardHost(link);
      if (!visible(host)) continue;
      const item = index.get(urlKey);
      if (!item?.card_id) continue;
      jobs.push({ host, id: item.card_id, rarity: item.card?.rarity || item.rarity });
    }
    return jobs;
  }

  async function runAverages() {
    if (!isCollection() || state.running) return;
    state.running = true;
    try {
      const jobs = await filteredCollectionJobs();
      for (const job of jobs) {
        const badge = cardBadge(job.host);
        badge.textContent = "Moy. : …";
        try { badge.textContent = `Moy. : ${await average(job.id, job.rarity)}`; }
        catch { badge.textContent = "Moy. : ? W"; }
      }
    } finally { state.running = false; }
  }

  function selectedCards() {
    const checks = [...document.querySelectorAll("span.pointer-events-none svg.lucide-check, span[aria-hidden=true] svg.lucide-check")];
    return [...new Set(checks.map(icon => {
      for (let element = icon.closest("span") || icon; element && element !== document.body; element = element.parentElement) {
        if (element.querySelector("h3") && element.querySelector('a[href*="wikipedia.org/wiki/"]')) return element;
      }
      return null;
    }).filter(Boolean))].filter(visible).slice(0, 5);
  }

  function createAuctionPanel() {
    document.querySelector(".dm-auction-panel")?.remove();
    const panel = document.body.appendChild(document.createElement("div"));
    panel.className = "dm-auction-panel";
    return panel;
  }

  async function prepareAuction() {
    if (!isCollection()) { alert("Ouvre Collection et sélectionne jusqu’à 5 cartes."); return; }
    const panel = createAuctionPanel();
    panel.innerHTML = '<div class="dm-auction-main">Lecture de la collection…</div>';
    await delay(400);
    const cards = selectedCards();
    if (!cards.length) { panel.remove(); alert("Aucune carte sélectionnée détectée."); return; }

    try {
      const items = collectionItems(await api("/api/my-collection"));
      const used = new Set();
      const rows = cards.map(node => {
        const link = node.querySelector('a[href*="wikipedia.org/wiki/"]');
        const urlKey = normaliseUrl(link?.href || "");
        const title = normaliseText(node.querySelector("h3")?.textContent);
        const item = items.find(candidate => !used.has(candidate.id) && normaliseUrl(candidate.card?.wikipedia_url) === urlKey)
          || items.find(candidate => !used.has(candidate.id) && normaliseText(candidate.card?.wikipedia_title) === title);
        if (item) used.add(item.id);
        return { title: item?.card?.wikipedia_title || title || "Carte non associée", rarity: item?.card?.rarity || item?.rarity || "?", id: item?.card_id || item?.card?.id || "" };
      });

      if (rows.some(row => !row.id)) throw Error("Association incomplète avec les données de collection actuelles.");
      renderAuction(panel, rows);
    } catch (error) {
      panel.innerHTML = `<div class="dm-auction-main dm-auction-error"><b>Erreur de préparation.</b><br>${escapeHtml(error.message)}<br><br><button class="dm-close">Fermer</button></div>`;
      panel.querySelector(".dm-close").onclick = () => panel.remove();
    }
  }

  function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); }

  function renderAuction(panel, rows) {
    panel.innerHTML = `<div class="dm-auction-head"><b>⚖ Préparation d’enchères</b><button class="dm-close" aria-label="Fermer">×</button></div><main class="dm-auction-main"><div style="margin-bottom:10px;color:#64748b"><b>${rows.length} / 5</b> cartes associées à leur exemplaire de collection.</div><section class="dm-auction-tools"><label>Prix commun<input class="dm-common" type="number" min="1" placeholder="Facultatif"></label><label>Durée<select class="dm-duration"><option value="10">10 min</option><option value="30">30 min</option><option value="60">1 h</option><option value="180">3 h</option><option value="360">6 h</option><option value="720">12 h</option></select></label><button class="dm-apply" style="align-self:end;background:#2563eb;color:#fff">Appliquer</button></section><section class="dm-auction-list">${rows.map(row => `<div class="dm-auction-row"><div><b>${escapeHtml(row.title)}</b><br><small>${escapeHtml(row.rarity)}</small></div><label>Prix<input class="dm-price" type="number" min="1" placeholder="W"></label></div>`).join("")}</section><div class="dm-auction-actions"><small style="color:#64748b">Prépare un récapitulatif ; la publication reste manuelle.</small><button class="dm-primary dm-prepare">Préparer le récapitulatif</button></div><div class="dm-auction-result"></div></main>`;
    panel.querySelector(".dm-close").onclick = () => panel.remove();
    panel.querySelector(".dm-apply").onclick = () => { const value = panel.querySelector(".dm-common").value; if (value) panel.querySelectorAll(".dm-price").forEach(input => input.value = value); };
    panel.querySelector(".dm-prepare").onclick = () => {
      const prices = [...panel.querySelectorAll(".dm-price")].map(input => Number(input.value));
      if (prices.some(price => !Number.isInteger(price) || price < 1)) { panel.querySelector(".dm-auction-result").innerHTML = '<div class="dm-auction-error"><b>Indique un prix entier d’au moins 1 W pour chaque carte.</b></div>'; return; }
      panel.querySelector(".dm-auction-result").innerHTML = `<div class="dm-auction-ok"><b>${rows.length} enchère(s) préparée(s)</b><br><br>${rows.map((row, index) => `• ${escapeHtml(row.title)} — ${prices[index]} W`).join("<br>")}<br><br><div class="dm-auction-warn">Publie manuellement les enchères dans WikiMasters.</div></div>`;
    };
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === "wm-average-start") runAverages();
    if (message?.type === "dm-auction-prepare") prepareAuction();
  });
})();
