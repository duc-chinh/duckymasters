/**
* ============================================================================
*  DuckyMasters — auction-panel.js
* ============================================================================
*  Panneau flottant (Shadow DOM) pour la mise aux enchères groupée, dans le
*  même thème visuel que bubble.js. Module purement UI : la soumission réelle
*  (appels API) est déléguée à opts.onSubmit — voir auction-entry.js.
* ============================================================================
*/
(function (global) {
  const HOST_ID = "duckymasters-auction-panel-host";
 
  const STYLE = `
    :host { all: initial; }
    .dm-root {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: 2147483647;
      width: 560px;
      max-width: calc(100vw - 24px);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #F7F4EC;
      box-shadow: 0 8px 24px rgba(0,0,0,0.28);
      border-radius: 14px;
      border: 1px solid rgba(247,244,236,0.14);
    }
    .dm-root.dm-dragging { box-shadow: 0 14px 34px rgba(0,0,0,0.4); }
    .dm-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: #173747;
      border-radius: 14px 14px 0 0;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    .dm-root.dm-dragging .dm-header { cursor: grabbing; }
    .dm-grip { color: #7C8B91; font-size: 12px; letter-spacing: -2px; line-height: 1; }
    .dm-emoji { font-size: 20px; line-height: 1; }
    .dm-title { font-size: 13px; font-weight: 600; letter-spacing: 0.2px; flex: 1; }
    .dm-body { background: #1F4356; padding: 12px 14px 14px; border-radius: 0 0 14px 14px; max-height: 70vh; overflow-y: auto; }
    .dm-hint { font-size: 11px; color: #B9C6CC; margin: 0 0 10px; line-height: 1.4; }
    .dm-hint.dm-hint--warn { color: #EF6461; }
    .dm-common {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px;
      padding: 10px;
      background: rgba(247,244,236,0.06);
      border-radius: 10px;
      margin-bottom: 10px;
      align-items: end;
    }
    .dm-field label { display: block; font-size: 11px; color: #B9C6CC; margin-bottom: 3px; }
    .dm-field input, .dm-field select {
      width: 100%;
      padding: 6px 7px;
      border-radius: 7px;
      border: 1px solid rgba(247,244,236,0.2);
      background: #10262F;
      color: #F7F4EC;
      font-size: 12px;
      box-sizing: border-box;
    }
    .dm-rows { border: 1px solid rgba(247,244,236,0.14); border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
    .dm-row {
      display: grid;
      grid-template-columns: 1fr 64px 92px;
      gap: 8px;
      align-items: center;
      padding: 9px 10px;
      border-bottom: 1px solid rgba(247,244,236,0.1);
      align-items: center;
    }
    .dm-row:last-child { border-bottom: none; }
    .dm-row.dm-row--invalid { opacity: 0.55; }
    .dm-row.title-block { min-width: 0;}
    .dm-row-title { font-size: 12px; font-weight: 600; }
    .dm-row-meta { font-size: 11px; color: #B9C6CC; margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .dm-avg-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 7px 2px 4px; border-radius: 999px;
      font: 600 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-variant-numeric: tabular-nums; white-space: nowrap;
      color: #F0A03C;
      background: rgba(20, 21, 20, 0.88);
      border: 1px solid rgba(240, 160, 60, 0.38);
    }
    .dm-avg-badge svg { width: 11px; height: 11px; flex: none; }
    .dm-avg-badge__label { font-size: 10px; font-weight: 500; opacity: .65; }
    .dm-avg-badge.is-empty { color: #DDDDDD; opacity: .75; border-color: rgba(255,255,255,.15); }
    .dm-row input[type="number"] {
      width: 100%;
      padding: 6px 7px;
      border-radius: 7px;
      border: 1px solid rgba(247,244,236,0.2);
      background: #10262F;
      color: #F7F3EC;
      font-size: 12px;
      text-align: right;
      box-sizing: border-box;
    }
    .dm-row select {
      width: 100%;
      padding: 6px 5px;
      border-radius: 7px;
      border: 1px solid rgba(247,244,236,0.2);
      background: #10262F;
      color: #F7F4EC;
      font-size: 11px;
      box-sizing: border-box;
    }
    .dm-badge-missing {
      display: inline-block;
      font-size: 10px;
      font-weight: 600;
      color: #EF6461;
      border: 1px solid rgba(239,100,97,0.4);
      border-radius: 999px;
      padding: 1px 7px;
      margin-top: 3px;
    }
    .dm-actions { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .dm-btn {
      cursor: pointer;
      border: 1px solid rgba(247,244,236,0.2);
      background: transparent;
      color: #F7F4EC;
      font-size: 12px;
      font-weight: 600;
      padding: 7px 12px;
      border-radius: 8px;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .dm-btn:hover:not(:disabled) { background: rgba(247,244,236,0.1); }
    .dm-btn:disabled { cursor: not-allowed; opacity: 0.5; }
    .dm-btn.dm-btn--primary { background: #F0A03C; color: #173747; border-color: #F0A03C; }
    .dm-btn.dm-btn--primary:hover:not(:disabled) { background: #e8952a; }
    .dm-btn.dm-btn--icon { flex: 0 0 auto; min-width: 30px; padding: 7px 9px; margin-left: auto; }
    .dm-results { margin-top: 12px; font-size: 12px; }
    .dm-result-block { border-radius: 8px; padding: 9px 10px; margin-top: 8px; line-height: 1.5; }
    .dm-result-block--ok { background: rgba(111,207,151,0.14); color: #E7E2D4; }
    .dm-result-block--error { background: rgba(239,100,97,0.14); color: #E7E2D4; }
    .dm-result-block b { display: block; margin-bottom: 4px; }
    .dm-result-block .dm-btn { margin-top: 8px; }
  `;
 
  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  /** Accord simple singulier/pluriel (0 ou 1 -> singulier, comme le fait déjà formatPrice() côté prix). */
  function pluralize(n, singular, plural) {
    return Math.abs(n) <= 1 ? singular : plural;
  }

  /** Formatage identique à celui du badge posé sur la carte (site-adapter.js: formatNumber). */
  function formatAverage(n) {
    return n.toLocaleString("fr-FR", { maximumFractionDigits: 2});    
  }

  const AVG_BADGE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" r="9"></circle><path d="M7.5 8.5 9.5 15.5 12 10 14.5 15.5 16.5 8.5"></path></svg>';

  /** Pastille identique au badge posé sur la carte (site-adapter.js: injectBadge) */
  function buildAverageBadgeText(average) {
    const badge = el("span", { class: "dm-avg-badge" + (average == null ? " is-empty" : "") });
    badge.innerHTML = AVG_BADGE_ICON +
      `<span class="dm-avg-badge__value">${average == null ? "—" : formatAverage(average)}</span>` +
      (average == null ? "" : `<span class="dm-avg-badge__label">moy.</span>`);
    return badge;
  }

  const AuctionPanel = {
    /**
     * @param {Array} items  Sortie de AuctionAdapter.resolveSelectedCards().
     * @param {object} opts  { durations: [{label, minutes}], onSubmit(rows), onClose }
     *   rows passé à onSubmit : [{ cardId, title, baseAmount, durationMinutes }]
     * @returns controller { setSubmitting, setResults, destroy }
     */
    mount(items, opts) {
      const existingHost = document.getElementById(HOST_ID);
      if (existingHost) existingHost.remove();
 
      const host = document.createElement("div");
      host.id = HOST_ID;
      const shadow = host.attachShadow({ mode: "open" });
 
      const styleTag = document.createElement("style");
      styleTag.textContent = STYLE;
      shadow.appendChild(styleTag);
 
      const root = el("div", { class: "dm-root" });

      const closeBtn = el("button", { class: "dm-btn dm-btn--icon", type: "button", text: "✕" });
      closeBtn.addEventListener("click", () => opts.onClose && opts.onClose());
 
      const header = el("div", { class: "dm-header", title: "Glisser pour déplacer" }, [
        el("div", { class: "dm-grip", text: "⠿" }),
        el("div", { class: "dm-emoji", text: "⚖️" }),
        el("div", { class: "dm-title", text: "Mise aux enchères groupée" }),
        closeBtn,
      ]);

      const validItems = items.filter((it) => it.cardId);
      const missingCount = items.length - validItems.length;

      const hintText = missingCount
        ? `${validItems.length} / ${items.length} ${pluralize(
          validItems.length, "carte associée", "cartes associées"
        )} à ${pluralize(
          validItems.length, "son", "leur"
        )} exemplaire de collection. ${missingCount} ${pluralize(
          missingCount, "carte non associée sera ignorée", "cartes non associées seront ignorées"
        )}.`
        : `${items.length} ${pluralize(items.length, "carte prête", "cartes prêtes")} pour la mise aux enchères.`;
      const hint = el("div", { class: "dm-hint" + (missingCount ? " dm-hint--warn" : ""), text: hintText });

      const totalSelectedCount = items.length + (opts.truncatedCount || 0);
      const truncationHint = opts.truncatedCount
        ? el("div", { class: "dm-hint dm-hint--warn", text:
              `⚠️ ${totalSelectedCount} cartes cochées : seules les ${items.length} premières sont traitées ici ` +
              `(limite configurée), ${opts.truncatedCount} ${pluralize(opts.truncatedCount, "carte ignorée", "cartes ignorées")}.`
            })
        : null;

      // Champs communs (prix + durée)
      const commonPriceInput = el("input", { type: "number", min: "1", placeholder: "Facultatif" });
      const durationSelect = el("select", {});
      (opts.durations || []).forEach((d) => {
        durationSelect.appendChild(el("option", { value: String(d.minutes), text: d.label }));
      });
      const applyBtn = el("button", { class: "dm-btn", type: "button", text: "Appliquer" });

      const commonRow = el("div", { class: "dm-common" }, [
        el("div", { class: "dm-field" }, [el("label", { text: "Prix commun" }), commonPriceInput]),
        el("div", { class: "dm-field" }, [el("label", { text: "Durée" }), durationSelect]),
        applyBtn,
      ]);

      // Une ligne par carte
      const priceInputs = []; // aligné sur `items` (null si carte non associée)
      const durationSelects = []; // aligné sur `items` (null si carte non associée)
      const rowsWrap = el("div", { class: "dm-rows" });
      items.forEach((item) => {
        const isValid = !!item.cardId;
        let priceInput = null;
        let durationSelectRow = null;
        
        // Toujours 3 cellules (titres / prix / durée), même vides, pour garder
        // les colonnes alignées entre toutes les lignes (dont "Non associée").
        let priceCell = el("div", {});
        let durationCell = el("div", {});

        if (isValid) {
          priceInput = el("input", { type: "number", min: "1", placeholder: "W" });
          priceCell.appendChild(priceInput);

          durationSelectRow = el("select", {});
          (opts.durations || []).forEach((d) => {
            durationSelectRow.appendChild(el("option", {value: String(d.minutes), text: d.label}));
          });
          durationSelectRow.value = durationSelect.value;

          durationCell.appendChild(durationSelectRow);
        }
        priceInputs.push(priceInput);
        durationSelects.push(durationSelectRow);

        const metaLine = el("div", { class: "dm-row-meta" });
        if (item.rarity) metaLine.appendChild(document.createTextNode(item.rarity + " - "));
        metaLine.appendChild(buildAverageBadgeText(item.average));
        const titleBlock = el("div", { class: "dm-row-title-block" }, [
          el("div", { class: "dm-row-title", text: item.title }),
          metaLine,
        ]);
        if (!isValid) titleBlock.appendChild(el("div", { class: "dm-badge-missing", text: "Non associée" }));

        rowsWrap.appendChild(el("div", { class: "dm-row" + (isValid ? "" : " dm-row--invalid") }, [titleBlock, priceCell, durationCell]));
      });

      applyBtn.addEventListener("click", () => {
        const v = commonPriceInput.value;
        priceInputs.forEach((input) => {
          if (input && v) input.value = v;
        });
        durationSelects.forEach((select) => {
          if (select) select.value = durationSelect.value;
        });
      });

      const submitBtn = el("button", { class: "dm-btn dm-btn--primary", type: "button", text: "Mettre aux enchères" });
      submitBtn.disabled = validItems.length === 0;
      const submitProgressEl = el("div", { class: "dm-hint", text: "" });
      const actions = el("div", { class: "dm-actions" }, [submitProgressEl, submitBtn]);

      const resultsWrap = el("div", { class: "dm-results" });

      submitBtn.addEventListener("click", () => {
        const rows = [];
        let invalidPrice = false;
        items.forEach((item, i) => {
          if (!item.cardId) return;
          const raw = priceInputs[i] ? priceInputs[i].value : "";
          const baseAmount = Number(raw);
          const durationMinutes = Number(durationSelects[i] ? durationSelects[i].value : durationSelect.value);
          if (!Number.isInteger(baseAmount) || baseAmount < 1) invalidPrice = true;
          rows.push({ cardId: item.id, title: item.title, baseAmount, durationMinutes });
        });

        if (invalidPrice) {
          resultsWrap.innerHTML = "";
          resultsWrap.appendChild(
            el("div", { class: "dm-result-block dm-result-block--error", text: "Indique un prix entier d'au moins 1 W pour chaque carte." })
          );
          return;
        }

        const summary = rows.map((r) => `• ${r.title} — ${r.baseAmount} W — ${r.durationMinutes} min`).join("\n");
        const confirmed = global.confirm(`Publier ${rows.length} ${pluralize(rows.length, "enchère", "enchères")} ?\n\n${summary}\n\nCette action est définitive.`);
        if (!confirmed) return;

        opts.onSubmit && opts.onSubmit(rows);
      });

      const body = el("div", { class: "dm-body" },
        [truncationHint, hint, commonRow, rowsWrap, actions, resultsWrap].filter(Boolean)
      );
      root.appendChild(header);
      root.appendChild(body);
      shadow.appendChild(root);
      document.documentElement.appendChild(host);

      // ---------------- Déplacement (identique au pattern de bubble.js) ----------------
      let drag = null;
      function place(x, y) {
        const maxX = Math.max(0, window.innerWidth - root.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - root.offsetHeight);
        root.style.left = Math.min(Math.max(0, x), maxX) + "px";
        root.style.top = Math.min(Math.max(0, y), maxY) + "px";
        root.style.transform = "none";
      }
      header.addEventListener("pointerdown", (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target === closeBtn) return;
        const rect = root.getBoundingClientRect();
        drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
        header.setPointerCapture(e.pointerId);
        root.classList.add("dm-dragging");
        place(rect.left, rect.top);
        e.preventDefault();
      });
      header.addEventListener("pointermove", (e) => {
        if (drag) place(e.clientX - drag.dx, e.clientY - drag.dy);
      });
      const endDrag = () => {
        drag = null;
        root.classList.remove("dm-dragging");
      };
      header.addEventListener("pointerup", endDrag);
      header.addEventListener("pointercancel", endDrag);
 
      return {
        setSubmitting(isSubmitting) {
          submitBtn.disabled = isSubmitting || validItems.length === 0;
          submitBtn.textContent = isSubmitting ? "Publication..." : "Mettre aux enchères";
          applyBtn.disabled = isSubmitting;
          if (isSubmitting) resultsWrap.querySelectorAll("button").forEach((b) => (b.disabled = true));
          if (!isSubmitting) submitProgressEl.textContent = "";
        },
        setSubmitProgress(processed, total) {
          submitProgressEl.textContent = total ? `Publication... ${processed} / ${total}` : "";
        },

        /** results: [{ title, ok, auctionId, error }] */
        setResults(results) {
          resultsWrap.innerHTML = "";
          const ok = results.filter((r) => r.ok);
          const failed = results.filter((r) => !r.ok);
          if (ok.length) {
            resultsWrap.appendChild(
              el("div", { class: "dm-result-block dm-result-block--ok" }, [
                el("b", { text: `${ok.length} ${pluralize(ok.length, "enchère créée", "enchères créées")}` }),
                ...ok.map((r) => el("div", { text: `✅ ${r.title} — ${r.auctionId || ""}` })),
              ])
            );
          }
          if (failed.length) {
            resultsWrap.appendChild(
              el("div", { class: "dm-result-block dm-result-block--error" }, [
                el("b", { text: `${failed.length} ${pluralize(failed.length, "erreur", "erreurs")}` }),
                ...failed.map((r) => el("div", { text: `❌ ${r.title} — ${r.error || ""}` })),
              ])
            );
          }
        },
        destroy() {
          location.reload();
          host.remove();
       },
      };
    },
  };

  global.DuckyMasters = global.DuckyMasters || {};
  global.DuckyMasters.AuctionPanel = AuctionPanel;
})(typeof window !== "undefined" ? window : self);