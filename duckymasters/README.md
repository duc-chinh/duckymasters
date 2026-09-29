# 🦆 DuckyMasters

**DuckyMasters** est une extension Chrome (Manifest V3) qui regroupe des scripts pratiques pour le site [WikiMasters](https://wiki-masters.com). Elle s'utilise depuis une petite fenêtre (popup) qui propose, selon la page ouverte, les scripts disponibles.

> ⚠️ Projet non officiel, sans lien avec WikiMasters. Il s'appuie sur la structure actuelle du site et sur ses endpoints internes : une évolution du site peut casser certaines fonctions (voir [Configuration](#configuration-et-personnalisation)).

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Guide d'utilisation](#guide-dutilisation)
  - [Lancer un script](#lancer-un-script)
  - [📊 Prix moyen des cartes](#-prix-moyen-des-cartes)
  - [⚖️ Mise aux enchères groupée](#️-mise-aux-enchères-groupée)
- [Dépannage](#dépannage)
- [Configuration et personnalisation](#configuration-et-personnalisation)
- [Structure du projet](#structure-du-projet)
- [Fonctionnement technique](#fonctionnement-technique)
- [Permissions et confidentialité](#permissions-et-confidentialité)
- [Ajouter un nouveau script](#ajouter-un-nouveau-script)

---

## Fonctionnalités

| Script | Pages concernées | Ce qu'il fait |
|---|---|---|
| 📊 **Prix moyen des cartes** | Collection, Marché, page d'une carte | Affiche sur chaque carte un badge indiquant son prix moyen de vente, pour sa rareté. |
| ⚖️ **Mise aux enchères groupée** | Collection | Met aux enchères, en une seule opération, les cartes cochées dans la collection (jusqu'à 5 à la fois par défaut). |

---

## Installation

L'extension n'est pas (encore) publiée sur le Chrome Web Store : on la charge en mode développeur.

1. **Récupérer le dossier** du projet (`duckymasters/`) sur votre ordinateur. Il doit contenir `manifest.json`, ainsi que les dossiers `content/`, `popup/` et `icons/`.
2. Ouvrir Chrome et aller à l'adresse `chrome://extensions`.
3. Activer le **Mode développeur** (interrupteur en haut à droite).
4. Cliquer sur **Charger l'extension non empaquetée**, puis sélectionner le dossier `duckymasters/` (celui qui contient `manifest.json`).
5. *(Recommandé)* Cliquer sur l'icône puzzle 🧩 de la barre d'outils de Chrome, puis sur l'épingle 📌 à côté de **DuckyMasters** pour l'avoir toujours sous la main.

> 💡 L'extension déclare des icônes dans `icons/` (`icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`). Si ce dossier est absent, Chrome refusera de charger l'extension : assurez-vous qu'il est bien présent.

**Mise à jour :** après avoir modifié un fichier, retournez sur `chrome://extensions` et cliquez sur le bouton 🔄 de la carte DuckyMasters, puis rechargez l'onglet WikiMasters.

---

## Guide d'utilisation

### Lancer un script

1. Connectez-vous à WikiMasters et ouvrez l'une des pages prises en charge :
   - **Collection** : `wiki-masters.com/collection`
   - **Marché** : `wiki-masters.com/marketplace`
   - **Page d'une carte** : `wiki-masters.com/marketplace/<identifiant>`
2. Cliquez sur l'icône **DuckyMasters** dans la barre d'outils.
3. Cliquez sur le script souhaité. La popup se ferme et le script démarre sur la page.

La popup grise les scripts qui ne s'appliquent pas à la page courante et affiche un message d'état :

- *« Ouvre WikiMasters (Collection, Marché, ou une carte)… »* → vous n'êtes pas sur le site.
- *« Cette page WikiMasters n'est pas encore prise en charge… »* → vous êtes sur le site, mais sur une page sans script associé.

Un script ne se lance qu'une fois par page : si son panneau est déjà ouvert, un second clic ne fait rien. Fermez le panneau (✕) pour pouvoir le relancer.

---

### 📊 Prix moyen des cartes

**Pages :** Collection, Marché, page d'une carte.

Une bulle flottante 🦆 apparaît et le calcul démarre automatiquement.

**Ce qui est traité :**

- **Collection et Marché** : toutes les cartes *actuellement affichées à l'écran*. Vos filtres, votre tri et l'onglet actif sur le site sont donc respectés. Le script ne fait ni défilement automatique ni clic sur « voir plus » : seules les cartes déjà chargées sont traitées. Pour en traiter davantage, chargez-les d'abord sur le site, puis relancez.
- **Page d'une carte** : le prix moyen est affiché dans la bulle *et* sur la carte si elle est visible à l'écran.

**La bulle :**

- Le **titre** et le **contexte** (page analysée).
- Un **état** : *en cours*, *en pause*, *terminé*, *arrêté*.
- Une **barre de progression** (`cartes traitées / total`).
- Une **Console** (bouton dédié) qui affiche le journal des requêtes, réponses et erreurs.
- La bulle se **déplace par glisser-déposer** grâce à sa barre de titre.

**Les boutons selon l'état :**

| État | Boutons | Effet |
|---|---|---|
| En cours | **Pause** | Met en pause : la carte en cours se termine, puis le script s'arrête. |
| En pause | **Continuer** | Reprend à la première carte sans valeur. |
| En pause | **Recommencer** | Efface les badges déjà affichés et repart de zéro. |
| Terminé / Arrêté | **Lancer** | Relance sans rien effacer : seules les cartes sans valeur ou en erreur sont retentées. |
| Toujours | **Console**, **✕** | Affiche/masque le journal ; ferme la bulle (et arrête le script). |

**Lire les badges posés sur les cartes :**

| Badge | Signification |
|---|---|
| Un nombre avec « moy. » | Prix moyen de vente pour la rareté de cette carte (en wikibidous). |
| Un tiret « — » | Aucune vente enregistrée pour cette rareté. |
| `ERR 429`, `ERR 500`, etc. | La requête a échoué (code HTTP de l'erreur). Passer la souris dessus donne le détail. Cliquez sur **Lancer** pour retenter. |

Le prix moyen est calculé **par rareté** : une même carte peut avoir une moyenne différente selon qu'il s'agit d'un exemplaire de telle ou telle rareté.

---

### ⚖️ Mise aux enchères groupée

**Page :** Collection uniquement.

> ⚠️ **Cette action publie de vraies enchères sur votre compte et elle est définitive.** Relisez toujours le récapitulatif avant de valider.

**Pas à pas :**

1. Sur la page **Collection**, **cochez** les cartes à mettre aux enchères en utilisant la sélection native du site. Par défaut, seules **5 cartes** maximum sont traitées à la fois ; les suivantes sont ignorées (un avertissement s'affiche).
2. Ouvrez la popup DuckyMasters et cliquez sur **Mise aux enchères groupée**.
3. Un panneau centré s'ouvre (déplaçable par sa barre de titre). Il indique combien de cartes ont été correctement associées à un exemplaire de votre collection. Les cartes **« Non associée »** apparaissent grisées et sont **ignorées** à l'envoi.
4. Pour chaque carte, l'extension affiche sa rareté et son **prix moyen** (badge « moy. ») pour vous aider à fixer un prix.
5. Renseignez le **prix de départ** (en **W**, entier ≥ 1) et la **durée** pour chaque carte. Pour aller plus vite, utilisez la zone du haut : saisissez un **prix commun** et une **durée**, puis cliquez sur **Appliquer** pour les recopier sur toutes les lignes.
6. Cliquez sur **Mettre aux enchères**. Une fenêtre de confirmation résume chaque enchère (carte — prix — durée). Validez pour publier.
7. Les enchères sont envoyées **une par une**, avec un court délai entre chaque. Une progression s'affiche, puis un bilan indiquant les enchères créées et celles en échec (avec le détail de l'erreur).

**Durées disponibles :** 10 min · 30 min · 1 h · 3 h · 6 h · 12 h.

**Messages courants :**

- *« Aucune carte sélectionnée détectée. »* → cochez au moins une carte avant de lancer le script.
- *« Indique un prix entier d'au moins 1 W pour chaque carte. »* → un prix est vide, décimal ou inférieur à 1.
- *« Impossible de lire la sélection… »* → la collection n'a pas pu être lue ; rechargez la page et réessayez.

---

## Dépannage

| Problème | Piste de solution |
|---|---|
| Les scripts sont grisés dans la popup | Vérifiez que vous êtes sur `wiki-masters.com`, sur une page Collection, Marché ou carte. |
| « Impossible de lancer le script » | Rechargez l'onglet WikiMasters puis réessayez. Vérifiez aussi que l'extension est bien activée. |
| « Aucune carte détectée à l'écran » | Attendez la fin du chargement de la page, puis cliquez sur **Lancer**. La console affiche un diagnostic utile en cas de problème persistant. |
| Beaucoup de badges `ERR …` | Le serveur limite peut-être le débit ou est indisponible. Attendez un peu, puis cliquez sur **Lancer** pour ne retenter que les cartes en erreur. |
| Une carte apparaît « Non associée » | L'extension n'a pas pu relier la carte cochée à un exemplaire de votre collection. Lancez d'abord **Prix moyen des cartes** sur la page (il pose les repères internes sur les cartes), rechargez si besoin, puis réessayez. |
| Plus rien ne fonctionne après une mise à jour du site | Les sélecteurs CSS ou les endpoints ont sans doute changé : voir la section suivante. |

---

## Configuration et personnalisation

Toute la connaissance du site WikiMasters est concentrée dans **`content/site-config.js`**. C'est le seul fichier à modifier en cas de changement côté site. Quelques réglages utiles :

| Réglage | Emplacement | Rôle |
|---|---|---|
| `hostPatterns` | racine | Domaines sur lesquels l'extension est active. |
| `pages` | racine | Expressions qui reconnaissent les pages Collection / Marché / carte. |
| `auction.maxSelection` | `auction` | Nombre maximal de cartes traitées par mise aux enchères groupée (5 par défaut). |
| `auction.durations` | `auction` | Durées proposées dans le panneau d'enchères. |
| `requestDelayMs` | racine | Délai entre deux requêtes, par politesse envers le serveur (250 ms par défaut). |
| `badge.position` | racine | Position du badge sur les cartes : `bottom-left`, `bottom-right`, `top-left` ou `top-right`. |
| `pagination.mode` | `pagination` | `"none"` (défaut) ne traite que les cartes affichées ; `"auto"` clique sur « Voir plus » ou fait défiler la page pour charger la suite. |
| `selectors.manual*` | `selectors` | Sélecteurs de secours, à renseigner manuellement uniquement si la détection automatique des cartes échoue. |

Les endpoints de l'API du site utilisés par l'extension y sont également listés (`api.salesAverage`, `api.createAuction`, `api.myCollection`, `api.auctionDetail`).

---

## Structure du projet

```
duckymasters/
├── manifest.json               # Déclaration de l'extension (MV3)
├── icons/                      # Icônes 16, 32, 48 et 128 px
├── popup/
│   ├── popup.html              # Interface de la popup
│   ├── popup.css               # Styles de la popup
│   └── popup.js                # Liste des scripts + injection dans la page
└── content/
    ├── site-config.js          # Configuration du site (sélecteurs, API, réglages)
    ├── site-adapter.js         # Accès au DOM des cartes, pose et lecture des badges
    ├── main-tagger.js          # Lit les données React des cartes (monde « MAIN »)
    │
    │   ── Module « Prix moyen des cartes » ──
    ├── runner.js               # Machine à états (idle → running ↔ paused → done/stopped)
    ├── bubble.js               # Bulle flottante (progression, console, boutons)
    ├── entry.js                # Point d'entrée du module
    │
    │   ── Module « Mise aux enchères groupée » ──
    ├── auction-adapter.js      # Lecture de la sélection + appels API
    ├── auction-panel.js        # Panneau flottant (interface)
    └── auction-entry.js        # Point d'entrée du module
```

---

## Fonctionnement technique

- **Injection à la demande.** Aucun script ne tourne en permanence : au clic dans la popup, l'extension injecte les fichiers nécessaires dans l'onglet actif via `chrome.scripting.executeScript`. Le fichier `main-tagger.js` est injecté dans le *monde principal* de la page (accès aux données React), les autres dans le monde isolé de l'extension.
- **Repérage des cartes.** Les pages étant dessinées par React, `main-tagger.js` lit les propriétés de chaque carte pour en déduire son identifiant et sa rareté, puis les expose via les attributs `data-dm-card-id` et `data-dm-rarity`. Le reste de l'extension lit simplement ces attributs.
- **Prix moyen.** Une requête `GET /api/marketplace/cards/<id>/sales?scope=summary` par carte (réponse mise en cache, car elle couvre toutes les raretés), avec un délai entre chaque appel. En cas d'erreur technique, le panneau d'enchères retente jusqu'à 4 fois.
- **Création d'enchères.** `POST /api/marketplace` avec l'exemplaire de la carte, le prix de départ et la durée. L'identifiant d'exemplaire est retrouvé via `/api/my-collection`.
- **Interface isolée.** La bulle et le panneau utilisent un *Shadow DOM* : leurs styles n'interfèrent pas avec ceux du site, et inversement.
- **Sécurité.** Les requêtes réutilisent votre session déjà ouverte sur le site (cookies), rien n'est envoyé à un serveur tiers.

---

## Permissions et confidentialité

| Permission | Pourquoi |
|---|---|
| `activeTab` | Agir sur l'onglet courant uniquement, lorsque vous cliquez sur l'extension. |
| `scripting` | Injecter les scripts dans la page WikiMasters. |
| `storage` | Déclarée dans le manifeste ; le code fourni ne s'en sert pas pour l'instant. |

L'extension ne collecte aucune donnée personnelle et ne communique qu'avec WikiMasters, depuis votre navigateur, avec votre session existante.

---

## Ajouter un nouveau script

1. Créez vos fichiers dans `content/` (par exemple `mon-script-entry.js`) en vous appuyant sur `SITE_CONFIG` et sur les modules existants (`site-adapter.js`…).
2. Dans `popup/popup.js`, ajoutez une entrée au tableau `SCRIPTS` :

```js
{
  id: "mon-script",
  emoji: "✨",
  title: "Mon script",
  description: "Ce que fait mon script.",
  appliesTo: ["collection", "marche", "carte"], // pages concernées
  mainFiles: [],                                // fichiers à injecter dans le monde MAIN (facultatif)
  files: [
    "content/site-config.js",
    "content/site-adapter.js",
    "content/mon-script-entry.js"
  ]
}
```

3. Rechargez l'extension sur `chrome://extensions` : le nouveau script apparaît dans la popup.

---

## Licence

Aucune licence n'est précisée pour le moment. À compléter selon vos souhaits (MIT, usage privé, etc.).
