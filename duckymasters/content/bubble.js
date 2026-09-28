/**
 * ============================================================================
 *  DuckyMasters — bubble.js
 * ============================================================================
 *  Widget flottant en bas à droite de la page, isolé du site hôte via un
 *  Shadow DOM (les styles de WikiMasters ne peuvent pas déteindre dessus,
 *  et inversement).
 * ============================================================================
 */
(function (global) {
  const HOST_ID = "duckymasters-bubble-host";
  const MAX_LOG_ENTRIES = 300;

  const STYLE = `
    :host { all: initial; }
    .dm-root {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483647;
      width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #F7F4EC;
      box-shadow: 0 8px 24px rgba(0,0,0,0.28);
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid rgba(247,244,236,0.14);
    }
    .dm-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: #173747;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    .dm-root.dm-dragging { box-shadow: 0 14px 34px rgba(0,0,0,0.4); }
    .dm-root.dm-dragging .dm-header { cursor: grabbing; }
    .dm-grip { color: #7C8B91; font-size: 12px; letter-spacing: -2px; line-height: 1; }
    .dm-emoji { font-size: 20px; line-height: 1; }
    .dm-titles { min-width: 0; flex: 1; }
    .dm-title { font-size: 13px; font-weight: 600; letter-spacing: 0.2px; }
    .dm-meta {
      font-size: 11px;
      color: #B9C6CC;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dm-body { background: #1F4356; padding: 12px 14px 10px; }
    .dm-progress-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #E7E2D4;
      margin-bottom: 10px;
    }
    .dm-progress-track {
      flex: 1;
      height: 6px;
      background: rgba(247,244,236,0.14);
      border-radius: 999px;
      overflow: hidden;
    }
    .dm-progress-fill {
      height: 100%;
      width: 0%;
      background: #F0A03C;
      transition: width 0.25s ease;
    }
    .dm-progress-count { flex-shrink: 0; font-variant-numeric: tabular-nums; }
    .dm-result {
      display: none;
      font-size: 14px;
      font-weight: 700;
      color: #F7F4EC;
      padding: 2px 0 10px;
    }
    .dm-result.dm-result--show { display: block; }
    .dm-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .dm-btn {
      flex: 1;
      min-width: 64px;
      cursor: pointer;
      border: 1px solid rgba(247,244,236,0.2);
      background: transparent;
      color: #F7F4EC;
      font-size: 12px;
      font-weight: 600;
      padding: 7px 8px;
      border-radius: 8px;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .dm-btn:hover { background: rgba(247,244,236,0.1); }
    .dm-btn.dm-btn--primary { background: #F0A03C; color: #173747; border-color: #F0A03C; }
    .dm-btn.dm-btn--primary:hover { background: #e8952a; }
    .dm-btn.dm-btn--icon { flex: 0 0 auto; min-width: 30px; padding: 7px 9px; }
    .dm-btn.dm-btn--active { background: rgba(247,244,236,0.16); }
    .dm-console {
      display: none;
      margin-top: 10px;
      max-height: 190px;
      overflow-y: auto;
      background: #10262F;
      border-radius: 8px;
      padding: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      line-height: 1.5;
    }
    .dm-console.dm-console--open { display: block; }
    .dm-log-line { display: flex; gap: 6px; padding: 1px 0; }
    .dm-log-dot { flex: 0 0 auto; margin-top: 5px; width: 6px; height: 6px; border-radius: 50%; }
    .dm-log-dot--request { background: #9FB4BD; }
    .dm-log-dot--response { background: #6FCF97; }
    .dm-log-dot--error { background: #EF6461; }
    .dm-log-dot--info { background: #F0A03C; }
    .dm-log-time { color: #7C8B91; flex: 0 0 auto; }
    .dm-log-text { color: #E7E2D4; word-break: break-word; }
    .dm-state-pill {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(247,244,236,0.12);
      color: #E7E2D4;
      flex: 0 0 auto;
    }
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

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString("fr-FR", { hour12: false });
  }

  const Bubble = {
    /**
     * @param {object} opts { title, onPause, onContinue, onRestart, onClose }
     * @returns controller
     */
    mount(opts) {
      const existingHost = document.getElementById(HOST_ID);
      if (existingHost) existingHost.remove();

      const host = document.createElement("div");
      host.id = HOST_ID;
      const shadow = host.attachShadow({ mode: "open" });

      const styleTag = document.createElement("style");
      styleTag.textContent = STYLE;
      shadow.appendChild(styleTag);

      const root = el("div", { class: "dm-root" });

      // Header
      const titleEl = el("div", { class: "dm-title", text: opts.title || "DuckyMasters" });
      const metaEl = el("div", { class: "dm-meta", text: "" });
      const statePill = el("span", { class: "dm-state-pill", text: "en cours" });
      const header = el("div", { class: "dm-header", title: "Glisser pour déplacer" }, [
        el("div", { class: "dm-grip", text: "⋮⋮" }),
        el("div", { class: "dm-emoji", text: "🦆" }),
        el("div", { class: "dm-titles" }, [titleEl, metaEl]),
        statePill,
      ]);

      // Résultat unique (page "carte au marché" — remplace la barre de progression)
      const resultEl = el("div", { class: "dm-result", text: "" });

      // Progress
      const fillEl = el("div", { class: "dm-progress-fill" });
      const countEl = el("div", { class: "dm-progress-count", text: "0 / 0" });
      const progressRow = el("div", { class: "dm-progress-row" }, [
        el("div", { class: "dm-progress-track" }, [fillEl]),
        countEl,
      ]);

      // Actions (rebuilt on state change)
      const actionsRow = el("div", { class: "dm-actions" });

      // Console panel
      const consolePanel = el("div", { class: "dm-console" });

      const body = el("div", { class: "dm-body" }, [resultEl, progressRow, actionsRow, consolePanel]);
      root.appendChild(header);
      root.appendChild(body);
      shadow.appendChild(root);
      document.documentElement.appendChild(host);

      let consoleOpen = false;
      let logCount = 0;

      // ---------------- Déplacement de la fenêtre ----------------
      const POS_KEY = "duckymasters.bubblePos";
      let drag = null;
      let moved = false; // true dès que la bulle a été positionnée en left/top

      function place(x, y) {
        const maxX = Math.max(0, window.innerWidth - root.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - root.offsetHeight);
        root.style.left = Math.min(Math.max(0, x), maxX) + "px";
        root.style.top = Math.min(Math.max(0, y), maxY) + "px";
        root.style.right = "auto";
        root.style.bottom = "auto";
        moved = true;
      }

      function savePosition() {
        try {
          chrome.storage.local.set({ [POS_KEY]: { x: parseFloat(root.style.left), y: parseFloat(root.style.top) } });
        } catch (e) {
          /* stockage indisponible : on ignore */
        }
      }

      header.addEventListener("pointerdown", (e) => {
        if (e.button !== undefined && e.button !== 0) return;
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
        if (!drag) return;
        drag = null;
        root.classList.remove("dm-dragging");
        savePosition();
      };
      header.addEventListener("pointerup", endDrag);
      header.addEventListener("pointercancel", endDrag);

      // Garde la bulle dans l'écran quand la fenêtre ou la bulle (console ouverte) change de taille.
      const keepInside = () => {
        if (moved) place(parseFloat(root.style.left), parseFloat(root.style.top));
      };
      window.addEventListener("resize", keepInside);
      if (typeof ResizeObserver !== "undefined") new ResizeObserver(keepInside).observe(root);

      // Retrouve la dernière position choisie.
      try {
        chrome.storage.local.get(POS_KEY, (res) => {
          const pos = res && res[POS_KEY];
          if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) place(pos.x, pos.y);
        });
      } catch (e) {
        /* stockage indisponible : position par défaut */
      }

      function renderActions(state) {
        actionsRow.innerHTML = "";
        const consoleBtn = el("button", {
          class: "dm-btn dm-btn--icon" + (consoleOpen ? " dm-btn--active" : ""),
          type: "button",
          text: "Console",
        });
        consoleBtn.addEventListener("click", () => {
          consoleOpen = !consoleOpen;
          consolePanel.classList.toggle("dm-console--open", consoleOpen);
          renderActions(state);
          if (consoleOpen) consolePanel.scrollTop = consolePanel.scrollHeight;
        });

        const closeBtn = el("button", { class: "dm-btn dm-btn--icon", type: "button", text: "✕" });
        closeBtn.addEventListener("click", () => opts.onClose && opts.onClose());

        if (state === "paused") {
          const continueBtn = el("button", {
            class: "dm-btn dm-btn--primary",
            type: "button",
            text: "Continuer",
          });
          continueBtn.addEventListener("click", () => opts.onContinue && opts.onContinue());
          const restartBtn = el("button", { class: "dm-btn", type: "button", text: "Recommencer" });
          restartBtn.addEventListener("click", () => opts.onRestart && opts.onRestart());
          actionsRow.append(continueBtn, restartBtn, consoleBtn, closeBtn);
        } else {
          const pauseBtn = el("button", { class: "dm-btn", type: "button", text: "Pause" });
          pauseBtn.disabled = state === "done" || state === "stopped";
          pauseBtn.style.opacity = pauseBtn.disabled ? "0.5" : "1";
          pauseBtn.addEventListener("click", () => opts.onPause && opts.onPause());
          actionsRow.append(pauseBtn, consoleBtn, closeBtn);
        }
      }

      const STATE_LABELS = {
        running: "en cours",
        paused: "en pause",
        done: "terminé",
        stopped: "arrêté",
        idle: "prêt",
      };

      renderActions("running");

      return {
        setMeta(text) {
          metaEl.textContent = text;
          metaEl.title = text;
        },
        setProgress(processed, total) {
          countEl.textContent = `${processed} / ${total}`;
          const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
          fillEl.style.width = pct + "%";
        },
        /** Affiche un résultat unique (page carte) à la place de la barre de progression. */
        setResult(text) {
          resultEl.textContent = text;
          resultEl.classList.add("dm-result--show");
          progressRow.style.display = "none";
        },
        setState(state) {
          statePill.textContent = STATE_LABELS[state] || state;
          renderActions(state);
        },
        appendLog(entry) {
          logCount++;
          const line = el("div", { class: "dm-log-line" }, [
            el("div", { class: `dm-log-dot dm-log-dot--${entry.type || "info"}` }),
            el("div", { class: "dm-log-time", text: formatTime(entry.ts) }),
            el("div", { class: "dm-log-text", text: entry.text }),
          ]);
          consolePanel.appendChild(line);
          if (logCount > MAX_LOG_ENTRIES) {
            consolePanel.removeChild(consolePanel.firstChild);
          }
          if (consoleOpen) consolePanel.scrollTop = consolePanel.scrollHeight;
        },
        destroy() {
          window.removeEventListener("resize", keepInside);
          host.remove();
        },
      };
    },
  };

  global.DuckyMasters = global.DuckyMasters || {};
  global.DuckyMasters.Bubble = Bubble;
})(typeof window !== "undefined" ? window : self);
