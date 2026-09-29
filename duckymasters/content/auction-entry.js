/**
* ============================================================================
*  DuckyMasters — auction-entry.js
* ============================================================================
*  Dernier fichier injecté par le popup (chrome.scripting.executeScript).
*  Empêche une double injection et démarre le module "Mise aux enchères
*  groupée" : lit la sélection courante (page Collection), affiche le
*  panneau, et soumet séquentiellement les enchères avec un délai entre
*  chaque requête (politesse envers le serveur — même réglage que le module
*  "Prix moyen des cartes").
* ============================================================================
*/
(function () {
  const PANEL_HOST_ID = "duckymasters-auction-panel-host";
  if (document.getElementById(PANEL_HOST_ID)) {
    // Un panneau d'enchères DuckyMasters est déjà actif sur cette page.
    return;
  }

  const NS = window.DuckyMasters;
  const CFG = NS.SITE_CONFIG;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Soumet `rows` séquentiellement. `previousResults` (optionnel) : les entrées
   * dont le cardId est dans `rows` sont remplacées par le nouveau résultat (cas
   * d'une relance sur échecs); les autres sont conservées.
   */
  async function submitRows(rows, panel) {
    panel.setSubmitting(true);
    const results = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      for(j = 0; j < 3; j++) {
        try {
          const { auctionId } = await NS.AuctionAdapter.createAuction({
            cardId: row.cardId,
            baseAmount: row.baseAmount,
            durationMinutes: row.durationMinutes,
          });
          results.push({ cardId: row.cardId, title: row.title, ok: true, auctionId });
          break;
        } catch (err) {
            const detail = (err && err.payload && JSON.stringify(err.payload)) || (err && err.message) || "Erreur inconnue";
            results.push({ cardId: row.cardId, title: row.title, ok: false, error: detail, row });
        }
      }
      panel.setSubmitProgress(i + 1, rows.length);
      if (i < rows.length - 1) await sleep(CFG.requestDelayMs);
    }

    panel.setSubmitting(false);
    panel.setResults(results);
    return results;
  }

  async function init() {
    
    let resolution;
    try {
      resolution = await NS.AuctionAdapter.resolveSelectedCards();
    } catch (err) {
      alert("Impossible de lire la sélection : " + (err && err.message));
      return;
    }

    const { items, truncatedCount } = resolution;

    if (!items.length) {
      alert("Aucune carte sélectionnée détectée.");
      return;
    }

    let panel;
    panel = NS.AuctionPanel.mount(items, {
      durations: CFG.auction.durations,
      truncatedCount,
      onSubmit: async (rows) => {
        await submitRows(rows, panel);
      },
      onClose: () => panel.destroy(),
    });
  }
  
  init();
})();