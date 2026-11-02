// Markdown transformer — rend cliquables (hyperliens OSC 8) les chemins de
// fichiers et les URL nus affichés par Pi dans le chat, sans avoir à les
// envelopper à la main dans chaque réponse.
//
// Display-only : l'extension ne modifie ni la session ni le contexte modèle,
// seulement ce que Pi rend à l'écran. Voir pi.registerMarkdownTransformer().
//
// Règles :
//  - URL nues  https://…          →  [url](url)
//  - chemins absolus  /foo/bar    →  [/foo/bar](/foo/bar)   (xdg-open local)
//  - chemins maison  ~/foo         →  [~/foo](file://$HOME/foo)
//  - blocs de code (fences), code inline (`…`), liens/autoliens markdown
//    existants : intouchés.
//  - dates « 2026/11/02 » : pas un chemin → non liées.
//
// Limite assumée : un chemin contenant des espaces (ex. « Ma Synchro/ ») est
// tronqué au premier espace et ne peut pas être lié fidèlement. Avec
// checkExists (activé par l'extension), le fragment partiel, qui n'existe pas
// sur disque, est refusé : le texte reste intact plutôt que d'émettre un lien
// cassé.

import { existsSync } from "node:fs";
import { homedir } from "node:os";

// Caractères qui délimitent un candidat (espace, HTML, quotes, crochets…).
const EXCLUDED = "\\s<>()\\[\\]{}'\"`\\u0000-\\u001F";

// Une seule alternance en un seul passage : chaque texte traité n'est pas
// re-scanné, donc les liens produits ne sont jamais re-nestés.
const CANDIDATE_RE = new RegExp(
  `(https?://[^${EXCLUDED}]+|~/[^${EXCLUDED}]+|/[^${EXCLUDED}]+)`,
  "g"
);

// « 2026/11/02 » : une date, pas un chemin.
const DATE_LIKE = /^\/\d+(\/\d+)*\/?$/;

// Un vrai chemin de fichier a une profondeur (plusieurs segments) ou une
// extension (point dans un segment). Une commande slash — /reload,
// /skill:egm-review, /model — n'est ni l'un ni l'autre.
function looksLikeFilePath(token: string): boolean {
  if (DATE_LIKE.test(token)) return false;
  const body = token.startsWith("/") ? token.slice(1) : token;
  if (body.includes("\u0002")) return false;
  const hasDepth = body.includes("/");
  const hasExtension = body.includes(".");
  const looksCommand = /^[A-Za-z0-9:-]{1,40}$/.test(body);
  return (hasDepth || hasExtension) && !looksCommand;
}

// Bascules : permet de désactiver facilement un cas depuis les tests.
// checkExists (défaut : false, pureté du transformateur) refuse de lier un
// chemin local (absolu ou ~/) inexistant sur disque ; l'extension l'active
// pour ne jamais ouvrir un mauvais fichier.
export interface LinkifyOptions {
  urls?: boolean;
  absolutePaths?: boolean;
  tildePaths?: boolean;
  checkExists?: boolean;
}

const DEFAULT_OPTS: LinkifyOptions = {
  urls: true,
  absolutePaths: true,
  tildePaths: true,
  checkExists: false,
};

// Retire la ponctuation fermante d'un candidat pour la laisser hors du lien.
function trimTail(token: string): string {
  return token.replace(/[.,;:!?)\]}"'»]+$/, "");
}

// Même source de vérité que /nvim (index.ts) : node:os.homedir().
function expandHome(path: string): string {
  const home = homedir();
  return path === "~" ? home : `${home}${path.slice(1)}`;
}

function splitToken(raw: string): { token: string; tail: string } {
  const token = trimTail(raw);
  return { token, tail: raw.slice(token.length) };
}

export function linkifyFilePaths(markdown: string, options: LinkifyOptions = {}): string {
  const opts = { ...DEFAULT_OPTS, ...options };
  if (!opts.urls && !opts.absolutePaths && !opts.tildePaths) return markdown;

  // Protège d'abord ce qui ne doit jamais être retouché, sous marqueurs
  // \u0002…\u0002 (hors de l'alphabet des chemins).
  const placeholders = new Map<string, string>();
  let id = 0;
  const protect = (s: string): string => {
    const key = `\u0002QCL${id++}\u0002`;
    placeholders.set(key, s);
    return key;
  };

  const text = markdown
    .replace(/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)/g, protect)
    .replace(/`[^`\n]+`/g, protect)
    .replace(/!?\[[^\]]*\]\([^)\n]+\)/g, protect)
    .replace(/<[^\s<>]+>/g, protect);

  const linked = text.replace(CANDIDATE_RE, (raw) => {
    const { token, tail } = splitToken(raw);
    if (token.length < 4 || token.includes(" ") || DATE_LIKE.test(token)) {
      return raw;
    }

    let href = "";
    if (opts.urls && /^https?:\/\//.test(token)) {
      href = token;
    } else if (opts.tildePaths && token.startsWith("~/")) {
      const home = expandHome(token);
      if (home) href = `file://${home}`;
    } else if (opts.absolutePaths && token.startsWith("/") && looksLikeFilePath(token)) {
      href = token;
    }
    // checkExists : un chemin local inexistant (fragment tronqué par un
    // espace, fichier pas encore créé) n'est pas lié — cohérent avec /nvim.
    // Les URL http(s) ne sont jamais soumises au test d'existence local.
    const isLocalTarget = href.startsWith("/") || href.startsWith("file://");
    if (href && isLocalTarget && opts.checkExists && !existsSync(stripAnchor(href))) {
      href = "";
    }
    return href ? `[${token}](${href})${tail}` : raw;
  });

  return linked.replace(/\u0002QCL\d+\u0002/g, (key) => placeholders.get(key) ?? "");
}

// Compatible avec pi.registerMarkdownTransformer.
// L'extension active checkExists : un lien ne doit jamais ouvrir un fichier
// qui n'existe pas sur cette machine.
export function createMarkdownTransformer(): (markdown: string) => string {
  return (markdown: string) => linkifyFilePaths(markdown, { checkExists: true });
}

// Cible `file://…` ou nue, éventuellement porteuse d'un fragment `#` : sans
// objet côté disque, on le retire avant le test d'existence.
function stripAnchor(target: string): string {
  return target.replace(/^file:\/\//, "").split("#")[0];
}
