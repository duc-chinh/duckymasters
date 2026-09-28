/**
 * ============================================================================
 *  DuckyMasters — main-tagger.js   (s'exécute dans le "MAIN world" de la page)
 * ============================================================================
 *  Les pages Collection / Marché sont dessinées par React. Plutôt que de
 *  deviner des noms de classes CSS, on lit les données que React attache à
 *  chaque élément (props du composant "carte") pour retrouver :
 *      - l'id de la carte      -> attribut  data-dm-card-id
 *      - sa rareté             -> attribut  data-dm-rarity
 *  posés sur l'élément racine de chaque carte affichée.
 *
 *  Les attributs DOM sont visibles depuis le script isolé de l'extension
 *  (site-adapter.js), qui les lit simplement. Il déclenche un nouveau
 *  marquage en envoyant l'évènement "duckymasters:tag".
 *
 *  Seules des clés de props (jamais de valeurs) sont exposées dans
 *  data-dm-diag, uniquement pour diagnostiquer un échec de détection.
 * ============================================================================
 */
(function () {
  if (window.__duckyMastersTagger) return;

  const ID_ATTR = "data-dm-card-id";
  const RARITY_ATTR = "data-dm-rarity";
  const DIAG_ATTR = "data-dm-diag";
  const MAX_CLIMB = 30;

  function isObj(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v) && !v.$$typeof;
  }

  /** Reconnaît un objet "carte" (entrée de collection, enchère, ou carte seule). */
  function readItem(o) {
    if (!isObj(o)) return null;
    const card = isObj(o.card) ? o.card : null;
    const rarity = (card && card.rarity) || o.snapshot_rarity || o.rarity;

    if (card && typeof card.id === "string" && rarity) {
      return { cardId: typeof o.card_id === "string" ? o.card_id : card.id, rarity: String(rarity) };
    }
    if (typeof o.card_id === "string" && rarity) {
      return { cardId: o.card_id, rarity: String(rarity) };
    }
    if (typeof o.id === "string" && typeof o.rarity === "string" && ("atk" in o || "def" in o)) {
      return { cardId: o.id, rarity: o.rarity };
    }
    return null;
  }

  /** Cherche un objet carte dans les props : au niveau 0, puis 1 (ex: {item}, {auction}). */
  function readFromProps(props) {
    if (!isObj(props)) return null;
    const direct = readItem(props);
    if (direct) return direct;
    for (const k in props) {
      if (k === "children") continue;
      const hit = readItem(props[k]);
      if (hit) return hit;
    }
    return null;
  }

  function fiberOf(el) {
    const keys = Object.keys(el);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].indexOf("__reactFiber$") === 0) return el[keys[i]];
    }
    return null;
  }

  /** Premier élément DOM rendu par un composant React (descend dans ses enfants). */
  function topHostElement(fiber) {
    let f = fiber;
    while (f) {
      const n = f.stateNode;
      if (n && n.nodeType === 1) return n;
      f = f.child;
    }
    return null;
  }

  /**
   * Depuis un élément, remonte les composants React parents et garde le plus
   * externe qui porte cette même carte (= le composant "carte" entier, pas
   * seulement son image). S'arrête si on croise une autre carte.
   */
  function resolve(el) {
    let f = fiberOf(el);
    let best = null;
    let hops = 0;
    while (f && hops++ < MAX_CLIMB) {
      const hit = readFromProps(f.memoizedProps);
      if (hit) {
        if (best && hit.cardId !== best.hit.cardId) break;
        best = { fiber: f, hit };
      }
      f = f.return;
    }
    return best;
  }

  function typeName(f) {
    const t = f.type;
    return typeof t === "string" ? t : (t && (t.displayName || t.name)) || "?";
  }

  function diagnose(scope, scanned, tagged) {
    const chain = [];
    const img = scope.querySelector("img");
    if (img) {
      let f = fiberOf(img);
      let i = 0;
      while (f && i++ < 10) {
        const props = f.memoizedProps;
        const entry = { type: typeName(f), keys: props && typeof props === "object" ? Object.keys(props).slice(0, 12) : [] };
        if (props && typeof props === "object") {
          const nested = {};
          Object.keys(props).slice(0, 12).forEach((k) => {
            if (k !== "children" && isObj(props[k])) nested[k] = Object.keys(props[k]).slice(0, 12);
          });
          if (Object.keys(nested).length) entry.nested = nested;
        }
        chain.push(entry);
        f = f.return;
      }
    }
    document.documentElement.setAttribute(DIAG_ATTR, JSON.stringify({ scanned, tagged, imgChain: chain }));
  }

  function tagAll() {
    const scope = document.querySelector("main") || document.body;
    const found = new Map(); // élément racine -> {cardId, rarity}
    const all = scope.querySelectorAll("*");
    let scanned = 0;

    for (let i = 0; i < all.length; i++) {
      scanned++;
      const r = resolve(all[i]);
      if (!r) continue;
      const host = topHostElement(r.fiber);
      if (!host || host === scope || !scope.contains(host)) continue;
      if (!found.has(host)) found.set(host, r.hit);
    }

    let tagged = 0;
    found.forEach((hit, host) => {
      // On ne garde que l'élément le plus externe si un parent est déjà une carte.
      let nested = false;
      for (let p = host.parentElement; p && p !== scope; p = p.parentElement) {
        if (found.has(p)) {
          nested = true;
          break;
        }
      }
      if (nested) {
        host.removeAttribute(ID_ATTR);
        host.removeAttribute(RARITY_ATTR);
        return;
      }
      host.setAttribute(ID_ATTR, hit.cardId);
      host.setAttribute(RARITY_ATTR, hit.rarity);
      tagged++;
    });

    diagnose(scope, scanned, tagged);
    return tagged;
  }

  document.addEventListener("duckymasters:tag", function () {
    try {
      tagAll();
    } catch (e) {
      document.documentElement.setAttribute(DIAG_ATTR, JSON.stringify({ error: String(e && e.message) }));
    }
  });

  window.__duckyMastersTagger = { tagAll, readItem, readFromProps, resolve };
})();
