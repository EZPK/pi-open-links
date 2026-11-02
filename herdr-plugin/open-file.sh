#!/usr/bin/env bash
# Handler herdr « Ctrl+clic sur file:// » de pi-open-links.
#
# Reçoit l'URI cliquée via HERDR_PLUGIN_CLICKED_URL (ou $1 en repli), la
# normalise (file://host/… → /chemin, décodage %xx), vérifie que le fichier
# existe et la transmet au même script que le panneau clic simple :
# scripts/open-file-panel.sh — split herdr si on est dans herdr, fenêtre du
# terminal Omarchy sinon.
#
# NOTE EFFET DE DÉCOR : ce handler ne tire que si herdr accepte de remonter
# des cibles file:// au Ctrl+clic (≥ 0.9.0, fix #2942). Sous herdr 0.8.2,
# herdr ignore les file:// avant même de consulter les plugins ; le clic
# SIMPLE (géré par Pi via xdg-open) reste le seul geste disponible, et il
# n'a pas besoin de ce plugin.

set -euo pipefail

# HERDR_PLUGIN_ROOT = dossier du plugin (herdr-plugin/ du package), le
# dossier scripts/ est son voisin dans l'arborescence du package.
PKG_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
PANEL="$PKG_DIR/scripts/open-file-panel.sh"

url="${HERDR_PLUGIN_CLICKED_URL:-${1:-}}"
if [[ -z $url || $url != file://* ]]; then
  notify-send -u low "pi-open-links" "Lien non reconnu : ${url:-<vide>}" 2>/dev/null || true
  exit 1
fi

[[ -x $PANEL ]] || PANEL="$(command -v open-file-panel.sh || true)"
if [[ ! -x $PANEL ]]; then
  notify-send -u normal "pi-open-links" "open-file-panel.sh introuvable ($PKG_DIR/scripts)" 2>/dev/null || true
  exit 1
fi

exec "$PANEL" "$url"
