# @ezpk/pi-open-links

Extension [Pi Agent](https://pi-docs.xyz/) : les **fichiers**, **dossiers** et
**URL** affichés en clair dans le chat deviennent des hyperliens cliquables —
sans rien envelopper à la main à chaque réponse.

| Affiché dans le chat | Clic |
|---|---|
| `https://…` | navigateur par défaut |
| `/chemin/vers/fichier` | éditeur (neovim sur Omarchy, ou votre éditeur par défaut) |
| `~/chemin` | éditeur (`file://$HOME/…`) |
| répertoire / dossier | tree de l'éditeur (neovim/netrw sur Omarchy) |

C'est un package **Pi** : installation en une commande, découverte dans la
[galerie Pi](https://pi.dev/packages).

## Installation

```bash
# Depuis un dépôt git (recommandé) :
pi install git:github.com/EZPK/pi-open-links@v1.1.0

# Depuis npm :
pi install npm:@ezpk/pi-open-links@1.1.0

# Local (développement) :
pi install /chemin/vers/pi-open-links
```

Puis `/reload` dans pi. Désactiver : `pi remove pi-open-links` (ou la source
utilisée).

## Ce que fait l'extension

1. **Transformateur markdown display-only** : dans chaque rendu de chat, les
   chemins de fichiers (`/absolu`, `~/maison`) et URL nus deviennent des liens
   OSC 8, toujours sous forme d'URI `file://` pour les cibles locales (un
   chemin nu n'est pas une URI valide et est ignoré par les multiplexeurs).
   Ni la session ni le contexte modèle ne sont modifiés.
2. **Commande `/open <chemin>`** : ouvre un fichier ou un dossier directement
   depuis le chat (résout `~` et les chemins relatifs, refuse les absents).

Le contenu du **code inline** (`` `…` ``) est linkifié aussi (un chemin ou une
URL en backticks reste cliquable) ; les **blocs de code** (fences), les
liens/autoliens markdown existants et les dates (`2026/11/02`) sont laissés
intacts.

### Pourquoi l'URL ouvre le navigateur et le fichier l'éditeur ?

Pi ouvre lui-même les liens OSC 8 via `xdg-open`. Le navigateur gère les URL.
Pour qu'un **fichier** (ou dossier) aboutisse dans un éditeur et pas dans le
navigateur, l'association de types MIME de la machine doit router les types
`text/*` (et `inode/directory`) vers une entrée qui lance votre éditeur.

- **Omarchy** : zéro config — `omarchy-launch-editor` respecte votre éditeur
  par défaut (`omarchy default editor nvim`), fenêtre dans le terminal par
  défaut. Le script `scripts/setup-mime.sh` crée/répare les associations
  `nvim-term.desktop` (types texte + dossiers), en idempotent.
- **Ouvrir dans un panneau (et non dans une fenêtre plein écran)** : sous
  herdr, `scripts/setup-open-panel.sh` remplace ces associations par
  `pi-open-links.desktop`, qui exécute `scripts/open-file-panel.sh` : le lien
  ouvre un **split herdr** à côté du pane pi (`herdr pane split` + `herdr pane
  run omarchy-launch-editor --inline <chemin>`). En dehors de herdr, même
  script retombe sur `omarchy-launch-editor` (fenêtre). Reverser :
  `./scripts/setup-open-panel.sh --undo`.
- **Autre Linux** : `scripts/setup-mime.sh` documente le mécanisme ; créez une
  entrée `.desktop` qui lance votre éditeur (via `xdg-terminal-exec` ou un
  terminal fixe) et associez-y les types MIME avec `xdg-mime default`.
- **Sans association** : `xdg-open` retombe sur le navigateur pour les
  fichiers — le texte reste lisible, rien n'est cassé.

### Pi ouvre lui-même les liens au simple clic

Pi gère le clic **simple** (gauche, sans modificateur) sur un hyperlien OSC 8
rendu dans le chat : release sans glissement → `xdg-open(<cible>)`. Aucun
modificateur n'est nécessaire dans Pi ; le hint « Ctrl+click to open » que Pi
affiche ne concerne que ses URL de partage/authentification, pas le transcript.

- `https://…` → navigateur.
- `file:///chemin` → `xdg-open` → associations MIME → éditeur.

### Cas particulier : pi sous herdr (multiplexeur)

1. **Pi doit émettre des hyperliens OSC 8.** Le détecteur de capacité de Pi ne
   reconnaît pas herdr quand `TERM_PROGRAM=herdr` n'est pas posé (selon la
   version de herdr, seul `HERDR_ENV=1` est exporté). Mettez
   `terminal.hyperlinks: true` dans les réglages de Pi
   (`~/.pi/agent/settings.json`) ou exportez `PI_HYPERLINKS=1`, sinon Pi
   n'émet aucun lien cliquable.
2. **Deux gestes, deux acteurs** — vérifié dans les sources herdr 0.8.2 :

   | Geste | Acteur | herdr 0.8.2 | herdr ≥ 0.9.0 |
   |---|---|---|---|
   | **Clic simple** (sans modif.) | Pi lui-même (`xdg-open`) | ✓ | ✓ |
   | **Ctrl+clic** | herdr → plugin `^file://` (panneau) | ✗ (herdr ignore `file://` : `safe_web_url` n'accepte que http/https avant même de consulter les plugins) | ✓ (#2942) |

   herdr 0.8.2 transmet bien les clics simples aux panes qui demandent la
   souris (Pi), et Pi ouvre le lien lui-même. Le **clic simple** est donc le
   geste à utiliser sous 0.8.2. Le **Ctrl+clic** ne fonctionne qu'à partir
   de herdr 0.9.0, via le plugin fourni par ce package (voir ci-dessous).

   Un clic doit presser et relâcher sur **exactement la même cellule** : un
   micro-glissement avant le relâchement est interprété comme une sélection
   par Pi, pas comme un clic.
3. **Plugin herdr Ctrl+clic (facultatif).** `scripts/setup-herdr-plugin.sh`
   enregistre `herdr-plugin/`, un plugin `link_handler` `^file://` qui ouvre
   le fichier/dossier dans un **panneau** (même `open-file-panel.sh` que le
   clic simple) :

   ```bash
   ./scripts/setup-herdr-plugin.sh            # lien + activation, idempotent
   herdr plugin list | grep pi-open-links     # vérification
   ./scripts/setup-herdr-plugin.sh --undo     # reverser
   ```

   Rien à faire si un autre plugin couvre déjà `^file://` (ex. `local.open-file`
   pour Claude Code) — seul le premier match est invoqué, et le comportement
   est le même (ouvrir le fichier).
4. **Redémarrez pi après une mise à jour du package** (`/reload` ne recharge
   pas le code des extensions déjà chargées dans la session en cours). Les
   changements de l'extension ne s'appliquent qu'à un nouveau lancement de
   pi.

Vérifier une association :

```bash
xdg-mime query default "$(xdg-mime query filetype chemin/vers/fichier.ts)"
# → nvim-term.desktop  (Omarchy)
```

## Options du transformateur

`linkifyFilePaths(markdown, options)` (exporté depuis `src/markdown.ts`) :

```ts
{
  urls?: boolean;          // URL nues https://…  (défaut true)
  absolutePaths?: boolean; // /absolu            (défaut true)
  tildePaths?: boolean;    // ~/maison           (défaut true)
  checkExists?: boolean;   // ne lie que les chemins locaux existants (défaut false)
}
```

L'extension utilise `checkExists: true` : un lien ne doit jamais ouvrir un
fichier absent sur la machine.

## Limites assumées

- **Chemins contenant des espaces** (ex. `/home/user/Ma Synchro/x.txt`) :
  tronqués au premier espace, donc jamais liés fidèlement. avec
  `checkExists` (actif) le fragment partiel, inexistant, est refusé : le texte
  reste intact au lieu d'un lien cassé.
- **Chemins mono-segments** (`/tmp`, `/etc`…) et **commandes slash**
  (`/reload`, `/skill:…`) : non liés (même entre backticks).
- **Code inline** : quand son contenu devient un lien, les backticks sont
  retirés (le markdown ne permet pas un lien *dans* un span de code) ;
  visuellement c'est un lien normal, plus du code.
- **Sous herdr** : le **Ctrl+clic** n'ouvre les `file://` que sur herdr ≥ 0.9.0
  (fix #2942) avec un plugin `link_handler` `^file://` (fourni par ce package,
  `scripts/setup-herdr-plugin.sh`) ; sous herdr 0.8.2, herdr ignore `file://`
  (`safe_web_url`, vérifié en source) — utilisez le simple clic, géré par Pi
  lui-même, qui fonctionne à toutes les versions.
- **Display-only** : l'extension n'ouvre rien elle-même ; c'est Pi qui traite
  le clic (`xdg-open`). Même niveau de confiance que de taper le chemin soi-même.

## Développement

```bash
npm test                                  # unités du transformateur (Node ≥ 22.6)
pi -e ./pi-open-links                      # essai one-shot sans l'installer
pi install ./pi-open-links && pi list      # installation locale
```

## Licence

MIT — voir `LICENSE`.