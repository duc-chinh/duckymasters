# DuckyMasters 🦆

Extension Chrome (Manifest V3) avec des scripts pour WikiMasters.
Module actuel : **Prix moyen des cartes** — *Affiche le prix moyen des cartes sur la page.*

## Installation (mode développeur)

1. `chrome://extensions` → activer **Mode développeur**.
2. **Charger l'extension non empaquetée** → choisir le dossier `DuckyMasters/`
   (dézipper l'archive d'abord ; après une mise à jour, cliquer ⟳ sur la carte de l'extension).
3. Clic sur l'icône canard → menu des scripts.

## Ce que fait le module

| Page | Comportement |
|---|---|
| `/collection` | Badge « prix moyen » sur chaque carte affichée (filtres et tri du site respectés). |
| `/marketplace` | Idem pour les cartes de **l'onglet affiché**. |
| `/marketplace/:id` | Résultat sur la carte (si repérée) **et** dans la bulle. |

- Unité : le **wikibidou**.
- Le prix est une moyenne **par rareté** (`summary.UR.average`) : une carte en UR n'est pas
  comparée aux ventes de la même carte en C.
- Bulle déplaçable (glisser l'en-tête), position mémorisée. Boutons Pause / Continuer /
  Recommencer / Console / ✕ comme demandé.

## Style du badge (proposition)

Pastille sombre translucide aux couleurs du thème du site (`--color-accent`, `--color-surface`),
posée **en surimpression dans le coin bas-gauche** de la carte : `(icône wikibidou) 11 moy.`
Elle ne bloque pas les clics. Sans vente enregistrée : `—` grisé. Info-bulle au survol avec le
détail (« Prix moyen de vente : 11 wikibidous (rareté UR) »).
Changer le coin : `badge.position` dans `content/site-config.js`
(`bottom-left`, `bottom-right`, `top-left`, `top-right`). Le style est dans `content/site-adapter.js`.

## Comment les cartes sont détectées

Le site est en Next.js/React : les cartes n'existent pas dans le HTML de départ, elles sont
dessinées après coup. `content/main-tagger.js` lit donc les données que React attache à chaque
carte (id + rareté) et les écrit en attributs `data-dm-card-id` / `data-dm-rarity`. Aucun nom de
classe CSS n'est nécessaire, et ce qui est à l'écran (filtres, tri, onglet) fait foi.

## Si aucune carte n'est détectée

La console de la bulle affichera « Aucune carte détectée » + une ligne **Diagnostic**.
Envoie-moi cette ligne, ainsi que le HTML d'une carte **récupéré ainsi** (pas avec Ctrl+U,
qui donne la page avant affichage, sans cartes) :

1. Ouvre `/collection`, attends que les cartes soient affichées.
2. Clic droit sur une carte → **Inspecter**.
3. Dans l'onglet **Elements**, remonte (flèche ↑ dans l'arbre) jusqu'à ce que la surbrillance
   bleue entoure **une carte entière**.
4. Clic droit sur cette ligne → **Copy → Copy outerHTML**, et colle-le moi.

## Fichiers

- `popup/` — menu au clic sur l'icône.
- `content/site-config.js` — toute la connaissance du site (endpoints ✅, options).
- `content/main-tagger.js` — détection des cartes (s'exécute dans la page).
- `content/site-adapter.js` — lecture/écriture du DOM, badge, défilement.
- `content/runner.js` — machine à états, requêtes, cache (1 requête par carte distincte).
- `content/bubble.js` — bulle (Shadow DOM), déplacement, console.
