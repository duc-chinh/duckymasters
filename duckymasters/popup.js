const status = document.getElementById("status");

async function send(type, successMessage) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://www.wiki-masters.com/")) {
    status.textContent = "Ouvre une page WikiMasters dans cet onglet.";
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type });
    status.textContent = successMessage;
  } catch (_) {
    status.textContent = "Commande envoyée.";
  }
}

document.getElementById("averages").onclick = () => send("wm-average-start", "Calcul des moyennes lancé.");
document.getElementById("auction").onclick = () => send("dm-auction-prepare", "Préparation des enchères ouverte.");
