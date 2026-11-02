# pi-open-links

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
pi install git:github.com/EZPK/pi-open-links@v1.0.0

# Depuis npm :
pi install npm:pi-open-links@1.0.0

# Local (développement) :
pi install /chemin/vers/pi-open-links
```

Puis `/reload` dans pi. Désactiver : `pi remove pi-open-links` (ou la source
utilisée).

## Ce que fait l'extension

1. **Transformateur markdown display-only** : dans chaque rendu de chat, les
   chemins de fichiers (`/absolu`, `~/maison`) et URL nus deviennent des liens
   OSC 8. Ni la session ni le contexte modèle ne sont modifiés.
2. **Commande `/open <chemin>`** : ouvre un fichier ou un dossier directement
   depuis le chat (résout `~` et les chemins relatifs, refuse les absents).

Blocs de code (fences), code inline (`` `…` ``), liens/autoliens markdown
existants et dates (`2026/11/02`) sont laissés intacts.

### Pourquoi l'URL ouvre le navigateur et le fichier l'éditeur ?

Pi ouvre lui-même les liens OSC 8 via `xdg-open`. Le navigateur gère les URL.
Pour qu'un **fichier** (ou dossier) aboutisse dans un éditeur et pas dans le
navigateur, l'association de types MIME de la machine doit router les types
`text/*` (et `inode/directory`) vers une entrée qui lance votre éditeur.

- **Omarchy** : zéro config — `omarchy-launch-editor` respecte votre éditeur
  par défaut (`omarchy default editor nvim`), fenêtre dans le terminal par
  défaut. Le script `scripts/setup-mime.sh` crée/répare les associations
  `nvim-term.desktop` (types texte + dossiers), en idempotent.
- **Autre Linux** : `scripts/setup-mime.sh` documente le mécanisme ; créez une
  entrée `.desktop` qui lance votre éditeur (via `xdg-terminal-exec` ou un
  terminal fixe) et associez-y les types MIME avec `xdg-mime default`.
- **Sans association** : `xdg-open` retombe sur le navigateur pour les
  fichiers — le texte reste lisible, rien n'est cassé.

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
  (`/reload`, `/skill:…`) : non liés.
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