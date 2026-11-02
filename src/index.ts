// pi-open-links — extension Pi Agent. Rôle : rendre cliquables les chemins
// de fichiers, dossiers et URL affichés en clair dans le chat.
//
// 1. Transformateur markdown → liens OSC 8 : un clic ouvre le fichier dans
//    l'éditeur (omarchy-launch-editor sur Omarchy : éditeur par défaut,
//    fenêtre foot sur le bureau actif), le dossier dans le tree de
//    l'éditeur, l'URL dans le navigateur. Display-only : la session et le
//    contexte modèle ne sont pas modifiés.
// 2. Commande `/open <path>` pour ouvrir un fichier ou dossier directement
//    depuis le chat (résout ~ et les relatifs, refuse les absents).

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createMarkdownTransformer } from "./markdown";

// Ouverture Omarchy native : éditeur par défaut dans le terminal par défaut.
// Résolu via PATH (préfixe d'installation Omarchy variable, pas /usr/bin en
// dur) ; repli générique xdg-open sur un OS non-Omarchy.
function resolveLauncher(): string {
  const which = spawnSync("which", ["omarchy-launch-editor"], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  return "xdg-open";
}

function openInEditor(target: string): void {
  spawn(resolveLauncher(), [target], { stdio: "ignore", detached: true, cwd: "/" }).unref();
}

export default function (pi: ExtensionAPI) {
  // 1. Chemins/URL nus du chat → liens cliquables (checkExists : jamais de
  //    lien vers un fichier absent sur la machine). Les cibles locales sont
  //    en file:// : Pi ouvre lui-même les liens OSC 8 au simple clic via
  //    xdg-open (les associations MIME routent file:// vers l'éditeur).
  pi.registerMarkdownTransformer(createMarkdownTransformer());

  // 2. Commande directe pi → éditeur.
  pi.registerCommand("open", {
    description: "Ouvre un fichier (ou dossier) dans l'éditeur par défaut",
    handler: async (args: string, ctx) => {
      const raw = (args || "").trim();
      if (!raw) {
        ctx.ui.notify("Usage : /open <chemin>", "info");
        return;
      }
      const expanded = raw.startsWith("~/") ? `${homedir()}${raw.slice(1)}` : raw;
      const target = isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
      if (!existsSync(target)) {
        ctx.ui.notify(`Introuvable : ${target}`, "error");
        return;
      }
      openInEditor(target);
      ctx.ui.notify(`Ouvert : ${target}`, "info");
    },
  });
}
