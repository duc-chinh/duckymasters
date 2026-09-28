/**
 * ============================================================================
 *  DuckyMasters — site-config.js
 * ============================================================================
 *  Toute la connaissance du site WikiMasters vit ici.
 *   ✅ CONFIRMÉ   : vérifié (DevTools / HTML fournis).
 *   ⚠️ À CONFIRMER : hypothèse, à valider au premier test.
 * ============================================================================
 */
(function (global) {
  const SITE_CONFIG = {
    // ✅ Portée
    hostPatterns: ["wiki-masters.com", "www.wiki-masters.com"],

    // ✅ Type de page
    pages: {
      collection: { test: (loc) => /^\/collection\/?$/.test(loc.pathname) },
      marche: { test: (loc) => /^\/marketplace\/?$/.test(loc.pathname) },
      // ex: /marketplace/3b4d01b2-ee38-447d-8d36-aacca46da507
      carte: { test: (loc) => /^\/marketplace\/[^/]+\/?$/.test(loc.pathname) },
    },

    // ------------------------------------------------------------------
    // DOM
    // ------------------------------------------------------------------
    selectors: {
      // ✅ Zone qui défile (vu dans le HTML fourni : <main class="... overflow-y-auto">)
      scrollContainer: "main",

      // Posés automatiquement par content/main-tagger.js (lecture des données
      // React de chaque carte affichée). Ne pas modifier.
      cardIdAttribute: "data-dm-card-id",
      cardRarityAttribute: "data-dm-rarity",

      // ⚠️ SECOURS MANUEL — utilisés uniquement si la détection automatique
      // ne trouve aucune carte. À remplir à partir du HTML d'une carte
      // (voir README). Laisser vide sinon.
      manualCardItem: "", // sélecteur CSS d'une carte, ex: ".card-item"
      manualIdAttribute: "", // attribut portant l'id de carte, ex: "data-id"
      manualRaritySelector: "", // sous-élément affichant la rareté, ex: ".rarity"
    },

    // ------------------------------------------------------------------
    // Chargement de cartes supplémentaires (⚠️ à confirmer)
    // ------------------------------------------------------------------
    // "auto"  : clique un bouton du type "Voir plus / Suivant" s'il existe,
    //           sinon fait défiler la zone principale (scroll infini).
    // "none"  : ne traite que les cartes déjà affichées.
    pagination: {
      mode: "auto",
      loadMoreTextRegex: "(voir|charger|afficher|montrer)\\s+(plus|davantage)|suivant|load more",
      waitAfterTriggerMs: 900,
      maxStaleAttempts: 3, // tentatives sans nouvelle carte avant de conclure "terminé"
    },

    // ------------------------------------------------------------------
    // ✅ API (endpoints + réponses vérifiés)
    // ------------------------------------------------------------------
    api: {
      // Détail d'une enchère — sert sur la page "carte" (id lu dans l'URL).
      auctionDetail: {
        url: (auctionId) => `/api/marketplace/${encodeURIComponent(auctionId)}`,
        parse: (json) => {
          const auction = json && json.auction;
          if (!auction) return null;
          return {
            cardId: auction.card_id,
            rarity: (auction.card && auction.card.rarity) || auction.snapshot_rarity || null,
          };
        },
      },

      // Prix moyen — { summary: { UR: { average: 11 } } }, moyenne PAR rareté.
      salesAverage: {
        url: (cardId) => `/api/marketplace/cards/${encodeURIComponent(cardId)}/sales?scope=summary`,
        parseAverage: (json, rarity) => {
          const bucket = json && json.summary && rarity ? json.summary[rarity] : null;
          return bucket && typeof bucket.average === "number" ? bucket.average : null;
        },
      },
    },

    // ✅ Unité du prix
    currency: { singular: "wikibidou", plural: "wikibidous" },

    // Badge posé sur les cartes : "bottom-left" | "bottom-right" | "top-left" | "top-right"
    badge: { position: "bottom-left" },

    // Délai entre deux requêtes (politesse envers le serveur)
    requestDelayMs: 250,
  };

  global.DuckyMasters = global.DuckyMasters || {};
  global.DuckyMasters.SITE_CONFIG = SITE_CONFIG;
})(typeof window !== "undefined" ? window : self);
