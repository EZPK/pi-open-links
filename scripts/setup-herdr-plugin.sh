#!/usr/bin/env bash
# setup-herdr-plugin.sh — enregistre le plugin herdr de pi-open-links :
# Ctrl+clic sur un lien file://… (nom de fichier/dossier dans le chat pi)
# → ouvre dans un panneau (split) via scripts/open-file-panel.sh.
#
# IMPORTANT (validé dans le code source herdr 0.8.2, safe_web_url) : herdr
# 0.8.2 ne transmet aux plugins que des liens http(s) — un Ctrl+clic sur un
# file:// n'atteint PAS les plugins. Le fix #2942 (herdr ≥ 0.9.0) lève la
# limitation : le handler devient actif. Le lien reste utilisable sous 0.8.2
# par le CLIC SIMPLE, que Pi gère lui-même (xdg-open → association MIME →
# pi-open-links.desktop → le même script).
#
# Idempotent : peut être relancé. Reverser : ./scripts/setup-herdr-plugin.sh --undo
#
# Vérifier : herdr plugin list | grep pi-open-links

set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG="$(cd "$SRC/.." && pwd)"
PLUGIN_DIR="$PKG/herdr-plugin"
PLUGIN_ID="local.pi-open-links"

if ! command -v herdr >/dev/null 2>&1; then
  echo "info : herdr absent de PATH — rien à faire (pas de Ctrl+clic herdr)." >&2
  exit 0
fi

undo() {
  if herdr plugin list 2>/dev/null | grep -q "$PLUGIN_ID"; then
    herdr plugin unlink "$PLUGIN_ID"
    echo "Plugin $PLUGIN_ID délié."
  else
    echo "info : $PLUGIN_ID déjà absent."
  fi
  exit 0
}
[[ ${1:-} == "--undo" ]] && undo

[[ -f $PLUGIN_DIR/herdr-plugin.toml ]] || {
  echo "erreur : $PLUGIN_DIR/herdr-plugin.toml introuvable" >&2
  exit 1
}
[[ -x $PLUGIN_DIR/open-file.sh ]] || chmod +x "$PLUGIN_DIR/open-file.sh"

# Le plugin est-il déjà enregistré ? (link refuse s'il est déjà présent)
if herdr plugin list 2>/dev/null | grep -q "$PLUGIN_ID"; then
  herdr plugin enable "$PLUGIN_ID" 2>/dev/null || true
  echo "OK : $PLUGIN_ID déjà enregistré et activé."
else
  herdr plugin link "$PLUGIN_DIR"
  herdr plugin enable "$PLUGIN_ID" 2>/dev/null || true
  echo "OK : $PLUGIN_ID enregistré depuis $PLUGIN_DIR."
fi

cat <<'NOTE'

Ctrl+clic sur un nom de fichier/dossier du chat pi :
  - herdr ≥ 0.9.0 : actif tout de suite (fix #2942, file:// routé aux plugins).
  - herdr 0.8.2 : NON pris par le Ctrl+clic (safe_web_url bloque file://) ;
    utilisez le CLIC SIMPLE, géré par Pi (xdg-open → MIME → pi-open-links.desktop).

Après un changement de version/connexion du client herdr, relancez le client
(ou herdr server reload-config) pour recharger le registre des plugins.
NOTE
