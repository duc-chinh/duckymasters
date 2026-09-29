/**
 * ============================================================================
 *  DuckyMasters — entry.js
 * ============================================================================
 *  Dernier fichier injecté par le popup (chrome.scripting.executeScript).
 *  Empêche une double injection et démarre le module "Prix moyen des cartes".
 * ============================================================================
 */
(function () {
  if (document.getElementById("duckymasters-bubble-host")) {
    // Une bulle DuckyMasters est déjà active sur cette page : on ne relance rien.
    return;
  }

  const NS = window.DuckyMasters;
  let bubble;
  let runner;

  bubble = NS.Bubble.mount({
    title: "Prix moyen des cartes",
    onPause: () => runner.pause(),
    onContinue: () => runner.continueRun(),
    onRestart: () => runner.restart(),
    onRelaunch: () => runner.relaunch(),
    onClose: () => {
      runner.stop();
      bubble.destroy();
    },
  });

  runner = new NS.AveragePriceRunner({
    onStateChange: (state) => bubble.setState(state),
    onProgress: ({ processed, total }) => bubble.setProgress(processed, total),
    onLog: (entry) => bubble.appendLog(entry),
    onMeta: (text) => bubble.setMeta(text),
    onResult: (text) => bubble.setResult(text),
  });

  bubble.setMeta(runner.describeContext());
  runner.start();
})();
