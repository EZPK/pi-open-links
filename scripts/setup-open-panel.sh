#!/usr/bin/env bash
# setup-open-panel.sh — branche « pi-open-links » : quand on clique un lien de
# fichier/dossier dans le chat pi, xdg-open part vers l'entrée .desktop
# pi-open-links.desktop, qui exécute scripts/open-file-panel.sh :
#   - depuis un pane herdr  → ouverture dans un panneau (split à côté de pi),
#   - sinon                 → fenêtre du terminal (lanceur Omarchy habituel).
#
# Idempotent : peut être relancé. Reverser (revenir au lanceur Omarchy
# nvim-term.desktop) : ./scripts/setup-open-panel.sh --undo
#
# Vérifier :
#   xdg-mime query default "$(xdg-mime query filetype fichier.ts)"  → pi-open-links.desktop
#   xdg-mime query default inode/directory                          → pi-open-links.desktop

set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCHER="$SRC/open-file-panel.sh"
ENTRY="pi-open-links.desktop"
DESKTOP="$HOME/.local/share/applications/$ENTRY"
PREV="nvim-term.desktop"   # entrée Omarchy capturée par setup-mime.sh

TYPES="text/plain text/html text/css text/javascript application/javascript \
text/x-script.python text/x-python text/x-python3 application/x-python-code \
text/x-shellscript text/x-sh application/x-sh text/ruby text/x-ruby \
application/x-ruby text/perl text/x-perl application/x-perl text/x-tcl \
text/x-tex text/markdown text/x-markdown application/json text/xml \
application/xml application/x-yaml text/yaml text/x-yaml text/toml \
text/x-toml application/toml text/x-lua text/x-php text/x-go text/rust \
text/x-rust text/x-c text/x-c++ text/x-c++hdr text/x-c++src text/x-makefile \
application/x-shellscript text/x-sql inode/directory"

if [[ ${1:-} == "--undo" ]]; then
  [[ -f $DESKTOP ]] && rm -f "$DESKTOP"
  update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
  xdg-mime default "$PREV" $TYPES
  printf 'Restauré : %s pour %s types + dossiers (lanceur Omarchy)\n' "$PREV" "$(wc -w <<<"$TYPES")"
  exit 0
fi

[[ -x $LAUNCHER ]] || chmod +x "$LAUNCHER"
[[ -f $LAUNCHER ]] || { echo "erreur : $LAUNCHER introuvable" >&2; exit 1; }

cat > "$DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=Ouvrir dans l'éditeur (panneau si herdr)
GenericName=Éditeur de texte
Comment=Liens pi-open-links : éditeur dans un panneau herdr, sinon fenêtre terminal
TryExec=$LAUNCHER
Exec=$LAUNCHER %F
Terminal=false
NoDisplay=true
Icon=nvim
Categories=Utility;TextEditor;Development;
MimeType=$TYPES;
EOF

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
xdg-mime default "$ENTRY" $TYPES

printf 'OK : %s (via %s) par défaut pour %s types texte + dossiers\n' \
  "$ENTRY" "$LAUNCHER" "$(wc -w <<<"$TYPES")"
