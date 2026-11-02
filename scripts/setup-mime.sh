#!/usr/bin/env bash
# Associe les types texte MIME à nvim-term.desktop (ouverture par défaut
# dans neovim via omarchy-launch-editor), et les dossiers (inode/directory)
# aussi : un clic sur un répertoire ouvre neovim/netrw au lieu de Nautilus.
# Idempotent : peut être relancé.
#
# Usage : ./scripts/setup-mime.sh
# Vérification :
#   xdg-mime query default "$(xdg-mime query filetype fichier.ts)"  -> nvim-term.desktop
#   xdg-mime query default inode/directory                          -> nvim-term.desktop
#
# Effet de bord assumé : `xdg-open /dossier` (ex. `xdg-open .`) ouvre neovim
# partout, plus Nautilus. Nautilus ne navigue pas via xdg-open (intact).
# Reverser : xdg-mime default org.gnome.Nautilus.desktop inode/directory.

set -euo pipefail

ENTRY="nvim-term.desktop"
DESKTOP="$HOME/.local/share/applications/$ENTRY"
TYPES="text/javascript application/javascript text/x-script.python text/x-python text/x-python3 application/x-python-code text/x-shellscript text/x-sh application/x-sh text/x-ruby application/x-ruby text/x-perl application/x-perl text/yaml text/x-yaml application/yaml text/toml text/x-toml application/toml text/x-lua text/x-php text/x-go text/rust text/x-rust text/css text/x-sql"

if [[ ! -f $DESKTOP ]]; then
  echo "erreur : $ENTRY introuvable dans ~/.local/share/applications/" >&2
  echo "Capturé par Omarchy ? Lister : ls ~/.local/share/applications/ | grep nvim" >&2
  exit 1
fi

# inode/directory doit figurer dans le MimeType= de l'entrée pour que
# xdg-open la choisisse pour un dossier. Ajout idempotent.
if ! grep -q "inode/directory" "$DESKTOP"; then
  sed -i 's|MimeType=.*|&inode/directory;|' "$DESKTOP"
  update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

xdg-mime default "$ENTRY" $TYPES
xdg-mime default "$ENTRY" inode/directory

printf 'OK : %s par défaut pour %s types texte + inode/directory (dossiers → nvim)\n' \
  "$ENTRY" "$(wc -w <<<"$TYPES")"