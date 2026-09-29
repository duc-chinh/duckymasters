/**
* ============================================================================
*  DuckyMasters — auction-adapter.js
* ============================================================================
*  Lecture de la sélection de cartes (page Collection) et appel de l'API de
*  mise aux enchères. Aucune logique d'affichage ici (voir auction-panel.js).
*
*  Résolution de l'id d'exemplaire pour chaque carte cochée, par ordre de
*  préférence :
*   1) tags posés par main-tagger.js (data-dm-card-id / data-dm-rarity) —
*      ⚠️ à confirmer : cet id doit correspondre à celui attendu par
*      POST /api/marketplace (même famille que auctionDetail.card_id).
*   2) repli : /api/my-collection + rapprochement par URL Wikipedia / titre
*      / rareté (repris du script d'origine), si (1) échoue pour une carte.
* ============================================================================
*/

(function (global) {
  const CFG = global.DuckyMasters.SITE_CONFIG;
  const SEL = CFG.selectors;
  const Adapter = global.DuckyMasters.Adapter;

  const MAX_ATTEMPS = 4;

  function qs(root, selector) {
    try {
      return root.querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  function qsa(root, selector) {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch (e) {
      return [];
    }
  }

  function normalizeText(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const AuctionAdapter = {
    /** Éléments racine des cartes actuellement cochées (icône de coche visible). */
    getSelectedCardNodes() {
      const icons = qsa(document, SEL.checkIconSelector);
      const roots = new Set();
      icons.forEach((icon) => {
        const root = this._climbToCardRoot(icon.closest("span") || icon);
        if (root) roots.add(root);
      });
      return [...roots];
    },

    /** Depuis l'icône cochée, remonte jusqu'au conteneur "carte" (titre + lien wikipedia). */
    _climbToCardRoot(start) {
      for (let node = start; node && node !== document.body; node = node.parentElement) {
        if (qs(node, SEL.cardTitleSelector) && qs(node, SEL.cardWikipediaLinkSelector)) return node;
      }
      return null;
    },

    /** {cardId, rarity, node} depuis les attributs posés par main-tagger.js, sur le nœud ou un de ses ancêtres/descendants. */
    getTaggedInfo(node) {
      const idAttr = SEL.cardIdAttribute;
      const rarityAttr = SEL.cardRarityAttribute;
      for (let n = node; n && n !== document.body; n = n.parentElement) {
        if (n.hasAttribute(idAttr)) {
          return { cardId: n.getAttribute(idAttr), rarity: n.getAttribute(rarityAttr) || null, taggedNode: n };
        }
      }

      const inner = node.querySelector(`[${idAttr}]`);
      if (inner) return { cardId: inner.getAttribute(idAttr), rarity: inner.getAttribute(rarityAttr) || null, taggedNode: inner };
      return null;
    },

    getDisplayTitle(node) {
      const el = qs(node, SEL.cardTitleSelector);
      return el ? normalizeText(el.textContent) : "";
    },

    getWikipediaUrl(node) {
      const el = qs(node, SEL.cardWikipediaLinkSelector);
      return el ? el.href : "";
    },

    /** Rareté lue dans une classe "glow-XXX" — repli si non taggée par main-tagger.js. */
    getGlowRarity(node) {
      const classes = qsa(node, "[class]")
        .map((e) => e.className)
        .join(" ");
      const m = classes.match(SEL.rarityGlowClassRegex);
      return m ? m[1].toUpperCase() : "";
    },

    /**
     * Résout les cartes cochées (limitées à CFG.auction.maxSelection) vers
     * [{ title, rarity, cardId, average, hasBadge, id }].
     * `cardId` reste null si aucune résolution (tag + repli) n'a fonctionné —
     * c'est à l'appelant (auction-panel.js) de le signaler à l'utilisateur.
     * average provient d'abord du badge déjà posé sur la carte ; s'il est
     * absent, un appel à l'API salesAverage est tenté (voir _resolveAveragesViaApi).
     * Il reste null si cet appel échoue ou si aucune vente n'est enregistrée
     * pour la rareté de la carte — l'appelant l'affiche alors comme vide.
     */
    async resolveSelectedCards() {
      Adapter.refreshTags();

      const allNodes = this.getSelectedCardNodes();
      const nodes = allNodes.slice(0, CFG.auction.maxSelection);
      const truncatedCount = Math.max(0, allNodes.length - nodes.length);

      const resolved = nodes.map((node) => {
        const tagged = this.getTaggedInfo(node);
        const title = this.getDisplayTitle(node);
        return {
          title: title || "Carte",
          rarity: (tagged && tagged.rarity) || this.getGlowRarity(node),
          cardId: tagged ? tagged.cardId : null,
          average: tagged && tagged.taggedNode ? Adapter.getAverageFromBadge(tagged.taggedNode) : null,
          hasBadge: tagged && tagged.taggedNode ? Adapter.hasBadge(tagged.taggedNode) : null,
          id: null,
        };
      });

      await this.resolveId(resolved);
      // Repli API pour les cartes sans badge (module "Prix moyen des cartes") jamais
      // lancé sur cette carte, ou badge effacé) : une requête par carte manquante,
      // au même endpoint / avec le même délai de politesse que runner.js.
      await this._resolveAveragesViaApi(resolved);

      return { items: resolved, truncatedCount };
    },
 
    async resolveId(items) {
      let collection = await this._fetchCollection();
      items.forEach((item) => {
        const sameCard = (e) => e.card_id === item.cardId && e.card.rarity === item.rarity;
        const match = collection.find((e) => sameCard(e));
        if (match) item.id = match.id;
      });
    },

    /**
     * Complète item.average pour les cartes résolues (cardId + rareté connus)
     * dont le badge n'a fourni aucune valeur. Une requête par carte manquante
     * (une réponse couvre toutes les raretés, mise en cache), en respectant
     * CFG.requestDelayMs entre deux appels. En cas d'échec d'une carte,
     * item.average reste null - l'appelant l'affiche alors comme vide.
     */
    async _resolveAveragesViaApi(items) {
      const targets = items.filter((it) => it.cardId && it.rarity && !it.hasBadge);
      if (!targets.length) return;

      // Nombre max de tentatives par carte en cas d'erreur TECHNIQUE (HTTP/réseau/JSON/invalde).
      // Une réponse 200 valide indiquant simplement "aucune vente pour cette rareté" n'est PAS
      // une erreur : elle n'est jamais retentée.

      const cache = new Map(); // cardId -> json (une réponse couvre toutes les raretés)
      for (const item of targets) {
        try {
          let json;
          if (cache.has(item.cardId)) {
            json = cache.get(item.cardId);
          } else {
            let lastError = null;
            for (let attempt = 1; attempt <= MAX_ATTEMPS; attempt++) {
              try {
                const res = await fetch(CFG.api.salesAverage.url(item.cardId), { credentials: "include" });
                const body = await res.json().catch(() => null);
                if (!res.ok || !body) throw new Error(`Sales HTTP ${res.status}`);
                json = body; // Succès HTTP + JSON valide : on sort
                break;
              } catch (e) {
                lastError = e;
              }
            }
            if (json === undefined) throw lastError || new Error("Sales: échec après plusieurs tentatives");
            cache.set(item.cardId, json);
          }
          item.average = CFG.api.salesAverage.parseAverage(json, item.rarity);
        } catch (e) {
          // item.average reste null ; échec silencieux, non bloquant pour l'ouverture du panneau.
        }
      }
    },

    async _fetchCollection() {
      const guessed = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .reverse()
        .find((n) => n.includes(CFG.api.myCollection.pathHint));
      const res = await fetch(guessed || CFG.api.myCollection.url(), { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Collection HTTP ${res.status}`);
      const json = await res.json();
      return CFG.api.myCollection.parseList(json);
    },

    /** Soumet une enchère pour une carte. Lève une erreur avec `.payload` (réponse JSON) en cas d'échec. */
    async createAuction({ cardId, baseAmount, durationMinutes }) {
      const res = await fetch(CFG.api.createAuction.url(), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CFG.api.createAuction.buildBody({ cardId, baseAmount, durationMinutes })),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.payload = json;
        throw err;
      }
      return CFG.api.createAuction.parseResult(json);
    },
  };

  global.DuckyMasters = global.DuckyMasters || {};
  global.DuckyMasters.AuctionAdapter = AuctionAdapter;
})(typeof window !== "undefined" ? window : self);