#!/usr/bin/env bash
# open-file-panel.sh — ouvre un fichier (ou dossier) dans l'éditeur par
# défaut, dans un **panneau** : quand on est lancé depuis un pane herdr, elle
# crée un split à côté du pane courant et y lance l'éditeur (pas de nouvelle
# fenêtre, pas de plein écran) ; sinon (terminal sans herdr) elle retombe sur
# le lanceur Omarchy habituel (fenêtre du terminal).
#
# Usage : open-file-panel.sh <chemin|file://URI>
# Le chemin peut être un chemin local absolu ou une URI file:// (format émis
# par l'extension pi-open-links depuis un lien OSC 8).

set -euo pipefail

arg="${1:-}"
if [[ -z $arg ]]; then
  echo "usage : open-file-panel.sh <chemin|file://URI>" >&2
  exit 1
fi

# Normalise l'argument : file://host/… ou file:///… → /chemin local, puis
# décode les %xx (encodage par segment de l'extension).
case "$arg" in
  file://*) target="${arg#file://}"; target="${target#localhost}";;
  *) target="$arg";;
esac
if [[ $target == *%* ]]; then
  target="$(printf '%b' "${target//%/\\x}")"
fi

if [[ ! -e $target ]]; then
  notify-send -u low "Fichier introuvable" "$target" 2>/dev/null || true
  echo "introuvable : $target" >&2
  exit 1
fi

# --- Dans un pane herdr : ouvrir un panneau split à côté du pane appelant,
# l'éditeur rendu dedans via omarchy-launch-editor --inline (même choix
# d'éditeur que par défaut, sans nouvelle fenêtre).
if [[ ${HERDR_ENV:-0} == 1 && -n ${HERDR_SOCKET_PATH:-} ]] && command -v herdr >/dev/null 2>&1; then
  out="$(herdr pane split --current --direction right --ratio 0.45 2>&1)" \
    || { notify-send -u low "Split herdr impossible" "$out" 2>/dev/null || true; exit 1; }
  pane="$(printf '%s' "$out" | jq -r '.. | objects | .pane_id? // empty' 2>/dev/null | head -n1)"
  if [[ -z $pane ]]; then
    pane="$(printf '%s' "$out" | sed -n 's/.*"pane_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
  fi
  if [[ -z $pane ]]; then
    notify-send -u low "Panneau introuvable" "$out" 2>/dev/null || true
    echo "panneau introuvable : $out" >&2
    exit 1
  fi
  # Laisse le shell du panneau naître avant d'y taper la commande.
  sleep 0.3
  command="omarchy-launch-editor --inline $(printf '%q' "$target")"
  if ! herdr pane run "$pane" "$command"; then
    notify-send -u normal "Échec de l'ouverture dans le panneau" "$command" 2>/dev/null || true
    exit 1
  fi
  herdr pane rename "$pane" "éditeur: $(basename "$target")" >/dev/null 2>&1 || true
  exit 0
fi

# --- Pas de herdr : comportement Omarchy (fenêtre du terminal par défaut).
exec omarchy-launch-editor "$target"
