// Tests du transformateur markdown (chemins/URL → liens cliquables).
// Lancement : node --test markdown.test.ts   (Node ≥ 22.6, type-stripping)

import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { createMarkdownTransformer, linkifyFilePaths } from "./markdown.ts";

const HOME = homedir();

test("URL nue devient un lien, ponctuation dehors", () => {
  assert.equal(
    linkifyFilePaths("voir https://pi.dev/x."),
    "voir [https://pi.dev/x](https://pi.dev/x)."
  );
});

test("chemin absolu devient un lien file://", () => {
  assert.equal(
    linkifyFilePaths("fichier /etc/hostname ici"),
    "fichier [/etc/hostname](file:///etc/hostname) ici"
  );
});

test("chemin ~/ devient un lien file:// vers la maison", () => {
  assert.equal(
    linkifyFilePaths("~/.config/foo.txt"),
    `[~/.config/foo.txt](file://${HOME}/.config/foo.txt)`
  );
});

test("date numérique (2026/11/02) n'est pas un lien", () => {
  assert.equal(linkifyFilePaths("le 2026/11/02"), "le 2026/11/02");
});

test("bloc de code fence intact", () => {
  const src = "```\n/etc/passwd\ncat /etc/hostname\n```\n";
  assert.equal(linkifyFilePaths(src), src);
});

test("lien markdown existant intouché", () => {
  assert.equal(linkifyFilePaths("[site](https://pi.dev)"), "[site](https://pi.dev)");
});

test("autolien <…> intouché", () => {
  assert.equal(linkifyFilePaths("<https://pi.dev>"), "<https://pi.dev>");
});

test("ponctuation exclamative rejetée hors lien", () => {
  assert.equal(linkifyFilePaths("/etc/fstab !"), "[/etc/fstab](file:///etc/fstab) !");
});

test("chemin trop court ignoré", () => {
  assert.equal(linkifyFilePaths("le /a dit"), "le /a dit");
});

test("option absolutePaths=false désactive", () => {
  assert.equal(
    linkifyFilePaths("/etc/hostname", { absolutePaths: false }),
    "/etc/hostname"
  );
});

test("double occurrence traitée en un passage, sans nesting", () => {
  assert.equal(
    linkifyFilePaths("/etc/hostname /etc/fstab"),
    "[/etc/hostname](file:///etc/hostname) [/etc/fstab](file:///etc/fstab)"
  );
});

test("chemin court dans une liste bullet", () => {
  assert.equal(
    linkifyFilePaths("- ~/.config/foo"),
    `- [~/.config/foo](file://${HOME}/.config/foo)`
  );
});

test("commande slash /reload n'est pas un lien", () => {
  assert.equal(linkifyFilePaths("1. Tape `/reload`"), "1. Tape `/reload`");
});

test("commande slash avec arg /skill:egm-review n'est pas un lien", () => {
  assert.equal(linkifyFilePaths("/skill:egm-review"), "/skill:egm-review");
});

test("chemin mono-segment /tmp n'est pas lié, /tmp/x.txt l'est", () => {
  assert.equal(linkifyFilePaths("/tmp"), "/tmp");
  assert.equal(
    linkifyFilePaths("/tmp/x.txt"),
    "[/tmp/x.txt](file:///tmp/x.txt)"
  );
});

test("code inline : le chemin entre backticks devient un lien", () => {
  assert.equal(
    linkifyFilePaths("echo `/etc/passwd`"),
    "echo [/etc/passwd](file:///etc/passwd)"
  );
});

test("code inline : l'URL entre backticks devient un lien", () => {
  assert.equal(
    linkifyFilePaths("voir `https://example.com/x` ici"),
    "voir [https://example.com/x](https://example.com/x) ici"
  );
});

test("code inline : ~/ entre backticks devient un lien file://", () => {
  assert.equal(
    linkifyFilePaths("fichier `~/.bashrc`"),
    `fichier [~/.bashrc](file://${HOME}/.bashrc)`
  );
});

test("code inline sans chemin reste intact", () => {
  const src = "la commande `echo bonjour` fonctionne";
  assert.equal(linkifyFilePaths(src), src);
});

test("tilde seul n'est pas un lien", () => {
  assert.equal(linkifyFilePaths("je rentre ~"), "je rentre ~");
});

test("chemin avec espaces : fragments inexistants non liés (checkExists)", () => {
  const src = `${HOME}/Ma Synchro/x.txt`;
  // `${HOME}/Ma` et `/x.txt` n'existent pas : aucun lien partiel ne sort.
  assert.equal(linkifyFilePaths(src, { checkExists: true }), src);
});

test("checkExists lie un chemin existant et refuse un chemin absent", () => {
  assert.equal(
    linkifyFilePaths("/etc/hostname", { checkExists: true }),
    "[/etc/hostname](file:///etc/hostname)"
  );
  const absent = "/etc/aucun-fichier-xyz-exemple";
  assert.equal(linkifyFilePaths(absent, { checkExists: true }), absent);
});

test("checkExists n'a pas d'effet sans option ni sur les URL", () => {
  assert.equal(
    linkifyFilePaths("/etc/aucun-fichier-xyz-exemple"),
    "[/etc/aucun-fichier-xyz-exemple](file:///etc/aucun-fichier-xyz-exemple)"
  );
  assert.equal(
    linkifyFilePaths("voir https://example.com/x", { checkExists: true }),
    "voir [https://example.com/x](https://example.com/x)"
  );
});

test("caractère # encodé dans la cible file://", () => {
  // Le '#', sinon avalé comme fragment, est encodé %23 dans l'URI.
  assert.equal(
    linkifyFilePaths("rapport /tmp/a#b.md"),
    "rapport [/tmp/a#b.md](file:///tmp/a%23b.md)"
  );
});



test("createMarkdownTransformer active checkExists", () => {
  const transform = createMarkdownTransformer();
  const absent = "/etc/aucun-fichier-xyz-exemple";
  assert.equal(transform(absent), absent);
  assert.equal(transform("/etc/hostname"), "[/etc/hostname](file:///etc/hostname)");
});
