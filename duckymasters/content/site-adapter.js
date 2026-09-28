/**
 * ============================================================================
 *  DuckyMasters — site-adapter.js
 * ============================================================================
 *  Lecture / écriture de la page WikiMasters (aucune logique métier ici).
 * ============================================================================
 */
(function (global) {
  const CFG = global.DuckyMasters.SITE_CONFIG;
  const BADGE_ATTR = "data-duckymasters-avg";
  const BADGE_CLASS = "duckymasters-badge";
  const STYLE_ID = "duckymasters-badge-style";

  // Icône "wikibidou" (celle de la boutique du site), en SVG statique.
  const COIN_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9"></circle>' +
    '<path d="M7.5 8.5 9.5 15.5 12 10 14.5 15.5 16.5 8.5"></path></svg>';

  // Style proposé : pastille sombre translucide aux couleurs du thème du site
  // (variables CSS du site avec valeurs de secours), posée en surimpression
  // dans un coin de la carte, sans bloquer les clics.
  const BADGE_CSS = `
    .${BADGE_CLASS} {
      position: absolute; z-index: 20;
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px 3px 5px; border-radius: 999px;
      font: 600 11px/1 var(--font-body, Inter, system-ui, sans-serif);
      font-variant-numeric: tabular-nums; white-space: nowrap;
      color: var(--color-accent, #f0a03c);
      background: color-mix(in srgb, var(--color-surface, #141514) 88%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-accent, #f0a03c) 38%, transparent);
      -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
      box-shadow: 0 1px 4px rgba(0,0,0,.35);
      pointer-events: none;
    }
    .${BADGE_CLASS} svg { width: 12px; height: 12px; flex: none; }
    .${BADGE_CLASS} .dm-badge__label { font-size: 10px; font-weight: 500; opacity: .65; }
    .${BADGE_CLASS}.is-empty {
      color: var(--color-foreground, #ddd); opacity: .75;
      border-color: var(--color-border, rgba(255,255,255,.15));
    }
    .${BADGE_CLASS}--bottom-left  { left: 6px;  bottom: 6px; }
    .${BADGE_CLASS}--bottom-right { right: 6px; bottom: 6px; }
    .${BADGE_CLASS}--top-left     { left: 6px;  top: 6px; }
    .${BADGE_CLASS}--top-right    { right: 6px; top: 6px; }
  `;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function qs(root, selector) {
    if (!selector) return null;
    try {
      return root.querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  function qsa(root, selector) {
    if (!selector) return [];
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch (e) {
      return [];
    }
  }

  function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function ensureBadgeStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = BADGE_CSS;
    document.head.appendChild(style);
  }

  function formatNumber(n) {
    return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  }

  const Adapter = {
    detectPageType() {
      for (const [key, def] of Object.entries(CFG.pages)) {
        try {
          if (def.test(global.location)) return key;
        } catch (e) {
          /* ignore */
        }
      }
      return null;
    },

    isOnWikiMasters() {
      const host = global.location.hostname;
      return CFG.hostPatterns.some((h) => host === h || host.endsWith(`.${h}`));
    },

    /** "11 wikibidous" (singulier pour 0 et 1, comme en français). */
    formatPrice(average) {
      const unit = average < 2 ? CFG.currency.singular : CFG.currency.plural;
      return `${formatNumber(average)} ${unit}`;
    },

    /** Demande à main-tagger.js (MAIN world) de (re)marquer les cartes affichées. */
    refreshTags() {
      document.dispatchEvent(new CustomEvent("duckymasters:tag"));
    },

    /** Résumé de diagnostic (clés de props uniquement) si la détection échoue. */
    readDiagnostics() {
      const raw = document.documentElement.getAttribute("data-dm-diag");
      return raw ? raw.slice(0, 700) : null;
    },

    /** Cartes actuellement affichées (= filtres, tri et onglet du site déjà appliqués). */
    getCardNodes() {
      const tagged = qsa(document, `[${CFG.selectors.cardIdAttribute}]`);
      if (tagged.length) return tagged;
      return qsa(document, CFG.selectors.manualCardItem);
    },

    getCardId(node) {
      const attr = CFG.selectors.cardIdAttribute;
      if (node.hasAttribute(attr)) return node.getAttribute(attr);
      const manual = CFG.selectors.manualIdAttribute;
      return manual && node.hasAttribute(manual) ? node.getAttribute(manual) : null;
    },

    getCardRarity(node) {
      const attr = CFG.selectors.cardRarityAttribute;
      if (node.hasAttribute(attr)) return node.getAttribute(attr);
      const el = qs(node, CFG.selectors.manualRaritySelector);
      return el ? (el.textContent || "").trim() || null : null;
    },

    /** ex: /marketplace/3b4d01b2-... -> "3b4d01b2-..." */
    getAuctionIdFromUrl() {
      const m = global.location.pathname.match(/^\/marketplace\/([^/]+)\/?$/);
      return m ? m[1] : null;
    },

    hasBadge(node) {
      return node.hasAttribute(BADGE_ATTR);
    },

    clearBadge(node) {
      node.removeAttribute(BADGE_ATTR);
      const existing = node.querySelector(`.${BADGE_CLASS}`);
      if (existing) existing.remove();
    },

    /** Pose (ou met à jour) la pastille de prix moyen en surimpression sur la carte. */
    injectBadge(node, { average, rarity }) {
      ensureBadgeStyle();
      if (getComputedStyle(node).position === "static") node.style.position = "relative";

      let badge = node.querySelector(`.${BADGE_CLASS}`);
      if (!badge) {
        badge = document.createElement("div");
        badge.innerHTML = COIN_SVG + '<span class="dm-badge__value"></span><span class="dm-badge__label">moy.</span>';
        node.appendChild(badge);
      }
      badge.className = `${BADGE_CLASS} ${BADGE_CLASS}--${CFG.badge.position}`;

      const value = badge.querySelector(".dm-badge__value");
      const label = badge.querySelector(".dm-badge__label");
      if (average == null) {
        badge.classList.add("is-empty");
        value.textContent = "—";
        label.textContent = "";
        badge.title = `Aucune vente enregistrée${rarity ? ` pour la rareté ${rarity}` : ""}`;
      } else {
        value.textContent = formatNumber(average);
        label.textContent = "moy.";
        badge.title = `Prix moyen de vente : ${this.formatPrice(average)}${rarity ? ` (rareté ${rarity})` : ""}`;
      }
      node.setAttribute(BADGE_ATTR, average == null ? "n/a" : String(average));
    },

    getScrollTop() {
      const s = qs(document, CFG.selectors.scrollContainer) || document.scrollingElement;
      return s ? s.scrollTop : 0;
    },

    setScrollTop(y) {
      const s = qs(document, CFG.selectors.scrollContainer) || document.scrollingElement;
      if (s) s.scrollTop = y;
    },

    /**
     * Tente de charger d'autres cartes : clic sur un bouton "Voir plus/Suivant"
     * s'il existe, sinon défilement de la zone principale (scroll infini).
     * Renvoie true dès que de nouvelles cartes apparaissent.
     */
    async loadMoreCards(previousCount) {
      const { mode, loadMoreTextRegex, waitAfterTriggerMs, maxStaleAttempts } = CFG.pagination;
      if (mode === "none") return false;

      const scroller = qs(document, CFG.selectors.scrollContainer) || document.scrollingElement;
      let re = null;
      try {
        re = new RegExp(loadMoreTextRegex, "i");
      } catch (e) {
        /* regex invalide : on ignore les boutons */
      }

      for (let attempt = 0; attempt < maxStaleAttempts; attempt++) {
        const btn = re
          ? qsa(scroller || document, "button, a[role='button']").find(
              (b) => !b.disabled && isVisible(b) && re.test((b.textContent || "").trim())
            )
          : null;

        if (btn) {
          btn.click();
        } else if (scroller) {
          // Petit va-et-vient pour re-déclencher un observateur de scroll infini.
          scroller.scrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight - 250);
          await sleep(60);
          scroller.scrollTop = scroller.scrollHeight;
        }

        await sleep(waitAfterTriggerMs);
        this.refreshTags();
        if (this.getCardNodes().length > previousCount) return true;
      }
      return false;
    },
  };

  global.DuckyMasters.Adapter = Adapter;
})(typeof window !== "undefined" ? window : self);
