/**
 * ============================================================================
 *  DuckyMasters — runner.js
 * ============================================================================
 *  Machine à états du module "Prix moyen des cartes".
 *  États : idle -> running -> (paused <-> running) -> done | stopped
 *
 *  - Pages Collection / Marché : traite les cartes affichées à l'écran (donc
 *    filtres, tri et onglet du site déjà appliqués), badge en surimpression.
 *  - Page d'une carte : id lu dans l'URL, résultat dans la bulle ET sur la carte.
 * ============================================================================
 */
(function (global) {
  const CFG = global.DuckyMasters.SITE_CONFIG;
  const Adapter = global.DuckyMasters.Adapter;

  const MAX_ITERATIONS_SAFETY = 20000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  class AveragePriceRunner {
    /** callbacks: onStateChange, onProgress({processed,total}), onLog, onMeta, onResult */
    constructor(callbacks) {
      this.callbacks = callbacks || {};
      this.state = "idle";
      this.pageType = Adapter.detectPageType();
      this._iterations = 0;
      this._cache = new Map(); // cardId -> réponse JSON (une réponse couvre toutes les raretés)
      this._scrollTop0 = null;
      this._runId = 0; // identifie la boucle active (évite deux boucles en parallèle)
    }

    _setState(state) {
      this.state = state;
      if (this.callbacks.onStateChange) this.callbacks.onStateChange(state);
    }

    _log(entry) {
      if (this.callbacks.onLog) this.callbacks.onLog({ ts: Date.now(), ...entry });
    }

    _reportProgress(processed, total) {
      if (this.callbacks.onProgress) this.callbacks.onProgress({ processed, total });
    }

    describeContext() {
      if (this.pageType === "carte") return "Carte au marché";
      if (this.pageType === "collection") return "Collection · filtres et tri du site respectés";
      return "Marché · onglet actuel";
    }

    async start({ restart = false } = {}) {
      if (this.state === "running") return;
      if (!this.pageType) {
        this._log({ type: "error", text: "Type de page non reconnu, script interrompu." });
        this._setState("stopped");
        return;
      }

      this._setState("running");
      if (this.callbacks.onMeta) this.callbacks.onMeta(this.describeContext());

      if (this.pageType === "carte") {
        await this._runSingleCard();
        return;
      }

      Adapter.refreshTags();
      if (restart) {
        Adapter.getCardNodes().forEach((n) => Adapter.clearBadge(n));
        this._cache.clear();
        this._log({ type: "info", text: "Recommencé : les valeurs déjà affichées ont été effacées." });
      }
      if (this._scrollTop0 === null) this._scrollTop0 = Adapter.getScrollTop();

      const found = Adapter.getCardNodes().length;
      this._log({
        type: "info",
        text: found ? `${found} carte(s) détectée(s) à l'écran.` : "Aucune carte détectée à l'écran pour l'instant.",
      });
      if (!found) {
        const diag = Adapter.readDiagnostics();
        if (diag) this._log({ type: "info", text: `Diagnostic : ${diag}` });
      }

      await this._runList();
    }

    pause() {
      if (this.state !== "running") return;
      this._setState("paused");
      this._log({ type: "info", text: "Script en pause — la carte en cours se termine puis s'arrête." });
    }

    /** Reprend à la 1ère carte sans valeur (la boucle cherche toujours "la prochaine sans badge"). */
    async continueRun() {
      if (this.state !== "paused") return;
      this._setState("running");
      this._log({ type: "info", text: "Reprise du script." });
      if (this.pageType === "carte") await this._runSingleCard();
      else {
        Adapter.refreshTags();
        await this._runList();
      }
    }

    async restart() {
      this._log({ type: "info", text: "Redémarrage demandé." });
      this.state = "idle"; // autorise start() même si on était "paused"
      await this.start({ restart: true });
    }

    stop() {
      this._setState("stopped");
      this._log({ type: "info", text: "Script arrêté." });
    }

    // ------------------------------------------------------------------
    // Page "carte au marché"
    // ------------------------------------------------------------------
    async _runSingleCard() {
      const auctionId = Adapter.getAuctionIdFromUrl();
      if (!auctionId) {
        this._log({ type: "error", text: "Identifiant d'enchère introuvable dans l'URL." });
        this._setState("stopped");
        return;
      }

      try {
        const detailUrl = CFG.api.auctionDetail.url(auctionId);
        this._log({ type: "request", text: `→ GET ${detailUrl}` });
        const t0 = Date.now();
        const res = await fetch(detailUrl, { credentials: "include" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this._log({ type: "response", text: `← ${res.status} (${Date.now() - t0} ms)` });

        const parsed = CFG.api.auctionDetail.parse(json);
        if (!parsed || !parsed.cardId) throw new Error("card_id/rareté illisibles dans la réponse.");

        const average = await this._fetchAverage(parsed.cardId, parsed.rarity);

        this.callbacks.onResult &&
          this.callbacks.onResult(
            average == null
              ? "Prix moyen : aucune vente enregistrée"
              : `Prix moyen : ${Adapter.formatPrice(average)}`
          );

        // Affichage directement sur la carte, si on la retrouve à l'écran.
        Adapter.refreshTags();
        const node = Adapter.getCardNodes().find((n) => Adapter.getCardId(n) === parsed.cardId);
        if (node) Adapter.injectBadge(node, { average, rarity: parsed.rarity });
        else this._log({ type: "info", text: "Carte non repérée à l'écran : résultat affiché dans la bulle uniquement." });

        this._reportProgress(1, 1);
        this._setState("done");
      } catch (err) {
        this._log({ type: "error", text: `Échec : ${err.message}` });
        this.callbacks.onResult && this.callbacks.onResult("Prix moyen : indisponible");
        this._setState("stopped");
      }
    }

    // ------------------------------------------------------------------
    // Pages "collection" / "marche"
    // ------------------------------------------------------------------
    async _runList() {
      const myRun = ++this._runId;
      const active = () => this.state === "running" && myRun === this._runId;

      while (active()) {
        if (++this._iterations > MAX_ITERATIONS_SAFETY) {
          this._log({ type: "error", text: "Garde-fou atteint, arrêt du script par sécurité." });
          this._setState("stopped");
          return;
        }

        let nodes = Adapter.getCardNodes();
        this._reportProgress(nodes.filter((n) => Adapter.hasBadge(n)).length, nodes.length);
        let next = nodes.find((n) => !Adapter.hasBadge(n));

        if (!next) {
          // Peut-être des cartes re-rendues par le site depuis le dernier marquage.
          Adapter.refreshTags();
          nodes = Adapter.getCardNodes();
          next = nodes.find((n) => !Adapter.hasBadge(n));
        }

        if (!next) {
          const grew = await Adapter.loadMoreCards(nodes.length);
          if (!active()) return;
          if (grew) {
            this._log({ type: "info", text: "Nouvelles cartes chargées, poursuite du script." });
            continue;
          }
          this._finishList(nodes.length);
          return;
        }

        const cardId = Adapter.getCardId(next);
        const rarity = Adapter.getCardRarity(next);
        if (!cardId || !rarity) {
          this._log({ type: "error", text: "Carte sans id ou sans rareté détectable, ignorée." });
          Adapter.injectBadge(next, { average: null, rarity });
          continue;
        }

        try {
          const average = await this._fetchAverage(cardId, rarity);
          Adapter.injectBadge(next, { average, rarity });
        } catch (err) {
          this._log({ type: "error", text: `Échec pour la carte ${cardId} : ${err.message}` });
          Adapter.injectBadge(next, { average: null, rarity });
        }

        await sleep(CFG.requestDelayMs);
      }
    }

    _finishList(total) {
      if (total === 0) {
        this._log({
          type: "error",
          text: "Aucune carte détectée. Envoie-moi le diagnostic ci-dessus et le HTML d'une carte (voir README).",
        });
        this._setState("stopped");
        return;
      }
      if (this._scrollTop0 !== null) Adapter.setScrollTop(this._scrollTop0);
      this._reportProgress(total, total);
      this._log({ type: "info", text: "Toutes les cartes affichées ont été traitées." });
      this._setState("done");
    }

    /** Prix moyen d'une carte pour une rareté (une réponse par carte, mise en cache). */
    async _fetchAverage(cardId, rarity) {
      if (this._cache.has(cardId)) {
        this._log({ type: "info", text: `↺ carte ${cardId} déjà interrogée (cache)` });
        return CFG.api.salesAverage.parseAverage(this._cache.get(cardId), rarity);
      }

      const url = CFG.api.salesAverage.url(cardId);
      this._log({ type: "request", text: `→ GET ${url}` });
      const t0 = Date.now();
      const res = await fetch(url, { credentials: "include" });
      const ms = Date.now() - t0;
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        this._log({ type: "error", text: `← ${res.status} ${res.statusText} (${ms} ms) — carte ${cardId}` });
        throw new Error(`HTTP ${res.status}`);
      }
      this._log({ type: "response", text: `← ${res.status} (${ms} ms) — carte ${cardId} [${rarity}]` });

      this._cache.set(cardId, json);
      return CFG.api.salesAverage.parseAverage(json, rarity);
    }
  }

  global.DuckyMasters.AveragePriceRunner = AveragePriceRunner;
})(typeof window !== "undefined" ? window : self);
