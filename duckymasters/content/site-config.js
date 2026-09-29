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
    
      // ⚠️ Sélection multiple (page Collection) — utilisés par auction-adapter.js.
      // Icône affichée sur une carte cochée via la sélection native du site.
      checkIconSelector: "span.pointer-events-none svg.lucide-check, span[aria-hidden='true'] svg.lucide-check",
      cardTitleSelector: "h3",
      cardWikipediaLinkSelector: "a[href*='wikipedia.org/wiki/']",
      // Rareté encodée dans une classe CSS type "glow-UR" (repli si non taggée par main-tagger.js).
      rarityGlowClassRegex: /\bglow-([\w-]+)/i,
    },

    // ------------------------------------------------------------------
    // ✅ Chargement de cartes supplémentaires (réponses vérifiées)
    // ------------------------------------------------------------------
    // "auto"  : clique un bouton du type "Voir plus / Suivant" s'il existe,
    //           sinon fait défiler la zone principale (scroll infini).
    // "none"  : ne traite que les cartes déjà affichées (aucun scroll, aucun clic).
    pagination: {
      mode: "none",
      loadMoreTextRegex: "(voir|charger|afficher|montrer)\\s+(plus|davantage)|suivant|load more",
      waitAfterTriggerMs: 900,
      maxStaleAttempts: 3, // tentatives sans nouvelle carte avant de conclure "terminé"
    },
    
    // ------------------------------------------------------------------
    // Mise aux enchères groupée (page Collection) — ⚠️ à confirmer
    // ------------------------------------------------------------------
    auction: {
      // Nombre de cartes traitées simultanément. Choix arbitraire du script
      // d'origine, pas de contrainte du site — ajuster librement.
      maxSelection: 5,
      durations: [
        { label: "10 min", minutes: 10},
        { label: "30 min", minutes: 30},
        { label: "1 h", minutes: 60},
        { label: "3 h", minutes: 180},
        { label: "6 h", minutes: 360},
        { label: "12 h", minutes: 720},
      ],
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

      // Repli uniquement : utilisé si une carte cochée n'est pas retrouvée
      // via les tags de main-tagger.js (vois auction-adapter.js).
      myCollection: {
        pathHint: "/api/my-collection",
        url: () => "/api/my-collection",
        parseList: (json) => (json && (json.collection || json)) || [],
      },

      // Création d'une enchère
      createAuction: {
        url: () => "/api/marketplace",
        buildBody: ({ cardId, baseAmount, durationMinutes }) => ({
          card_id: cardId,
          base_amount: baseAmount,
          duration_minutes: durationMinutes,
        }),
        parseResult: (json) => ({ auctionId: json && json.auction_id}),
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
