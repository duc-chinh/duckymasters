(function () {
  const CFG = window.DuckyMasters.SITE_CONFIG;

  // Liste des scripts proposés par l'extension. Pour en ajouter un plus tard,
  // il suffit d'ajouter une entrée ici + les fichiers correspondants dans /content.
  const SCRIPTS = [
    {
      id: "average-price",
      emoji: "📊",
      title: "Prix moyen des cartes",
      description: "Affiche le prix moyen des cartes sur la page.",
      appliesTo: ["collection", "marche", "carte"],
      // Exécuté d'abord dans le contexte de la page (lecture des données React des cartes).
      mainFiles: ["content/main-tagger.js"],
      files: [
        "content/site-config.js",
        "content/site-adapter.js",
        "content/runner.js",
        "content/bubble.js",
        "content/entry.js",
      ],
    },
  ];

  const statusEl = document.getElementById("dm-status");
  const listEl = document.getElementById("dm-script-list");

  function isWikiMastersHost(hostname) {
    return CFG.hostPatterns.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  }

  function detectPageType(urlLike) {
    for (const [key, def] of Object.entries(CFG.pages)) {
      try {
        if (def.test(urlLike)) return key;
      } catch (e) {
        /* ignore */
      }
    }
    return null;
  }

  function showStatus(text) {
    statusEl.textContent = text;
    statusEl.hidden = false;
  }

  function renderScripts({ onWikiMasters, pageType }) {
    listEl.innerHTML = "";
    SCRIPTS.forEach((script) => {
      const enabled = onWikiMasters && pageType && script.appliesTo.includes(pageType);
      const btn = document.createElement("button");
      btn.className = "dm-script";
      btn.disabled = !enabled;
      btn.innerHTML = `
        <span class="dm-script__emoji">${script.emoji}</span>
        <span>
          <div class="dm-script__title">${script.title}</div>
          <div class="dm-script__desc">${script.description}</div>
        </span>
      `;
      btn.addEventListener("click", () => runScript(script));
      listEl.appendChild(btn);
    });
  }

  async function runScript(script) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    try {
      if (script.mainFiles && script.mainFiles.length) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          files: script.mainFiles,
        });
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: script.files,
      });
      window.close();
    } catch (err) {
      showStatus(`Impossible de lancer le script : ${err.message}`);
    }
  }

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let url;
    try {
      url = new URL(tab.url);
    } catch (e) {
      url = null;
    }

    if (!url) {
      showStatus("Ouvre un onglet WikiMasters pour utiliser DuckyMasters.");
      renderScripts({ onWikiMasters: false, pageType: null });
      return;
    }

    const onWikiMasters = isWikiMastersHost(url.hostname);
    const pageType = onWikiMasters ? detectPageType(url) : null;

    if (!onWikiMasters) {
      showStatus("Ouvre WikiMasters (Collection, Marché, ou une carte) pour lancer un script.");
    } else if (!pageType) {
      showStatus("Cette page WikiMasters n'est pas encore prise en charge par un script.");
    }

    renderScripts({ onWikiMasters, pageType });
  }

  init();
})();
