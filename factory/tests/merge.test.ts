/** Tests for the auto-merge rule of agent PRs (ADR-0011). Run: npm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { REPO } from "../orchestrator.ts";
import { agentMergeBlocker, changedSourceBlocker, citedImages, citedSources, newSourceBlocker, resolvedTree, reviewedCommit, type AgentPr } from "../merge.ts";

const SHA = "c0408f2cdf580da62be602b07a22dccd7d41b1cb";
const IMG = "data/images/acme/volta/frontal.jpg";
const green: AgentPr = {
  number: 1, url: "u", headRefName: "agent/researcher/20261012-053007-c376c7", headRefOid: SHA,
  mergeable: "MERGEABLE", createdAt: "2026-10-12T05:30:00Z",
  labels: [{ name: "review:ok" }],
  statusCheckRollup: [{ name: "test", status: "COMPLETED", conclusion: "SUCCESS" },
    { name: "a11y", status: "COMPLETED", conclusion: "SKIPPED" }],
  files: [{ path: "data/raw/acme/volta.yaml", changeType: "MODIFIED" }, { path: IMG, changeType: "ADDED" },
    { path: "docs/bitacora/2026-10/x.md", changeType: "ADDED" }],
  comments: [{ body: "🏭 Veredicto: hay que cambiar algo. Revisado el SHA 401ef8c" },
    { body: `🏭 Veredicto: puede entrar. Revisado el SHA ${SHA}; CI en verde.` }],
};
const cited = new Set([IMG]);

test("se fusiona sola si cumple todas las reglas de ADR-0011", () => {
  assert.equal(agentMergeBlocker(green, cited, false), null);
  assert.equal(agentMergeBlocker({ ...green, mergeable: "UNKNOWN" }, cited, false), null);
});

test("cualquier otra cosa espera a una persona", () => {
  const cases: [Partial<AgentPr>, boolean, Set<string>?][] = [
    [{}, true],
    [{ headRefName: "docs/x" }, false],
    [{ labels: [] }, false],
    [{ labels: [{ name: "review:ok" }, { name: "review:needs-human" }] }, false],
    [{ labels: [{ name: "review:ok" }, { name: "merger:needs-human" }] }, false],
    [{ labels: [{ name: "review:ok" }, { name: "merger:unreviewed" }] }, false],
    [{ comments: [] }, false],
    [{ comments: [green.comments[1], { body: "🏭 Veredicto: revisado el SHA 401ef8c" }] }, false],
    [{ headRefOid: "f".repeat(40) }, false],
    [{ mergeable: "CONFLICTING" }, false],
    [{ statusCheckRollup: [] }, false],
    [{ statusCheckRollup: [{ status: "IN_PROGRESS" }] }, false],
    [{ statusCheckRollup: [{ status: "COMPLETED", conclusion: "FAILURE" }] }, false],
    [{ files: [] }, false],
    [{ files: [{ path: "data/raw/acme/volta.yaml", changeType: "DELETED" }] }, false],
    [{ files: [{ path: "data/raw/acme/volta2.yaml", changeType: "RENAMED" }] }, false],
    [{ files: [{ path: "data/sources/acme-es.yaml", changeType: "ADDED" }] }, false],
    [{ files: [{ path: "factory/run.ts", changeType: "MODIFIED" }] }, false],
    [{}, false, new Set()],
  ];
  for (const [change, stopped, set] of cases) {
    assert.notEqual(agentMergeBlocker({ ...green, ...change }, set ?? cited, stopped), null, JSON.stringify(change));
  }
});

test("citedImages lee los file de images de data/raw en un commit", () => {
  const images = citedImages("HEAD", REPO);
  assert.ok(images.size > 0);
  for (const f of images) assert.match(f, /^data\/images\//);
});

const SRC = "data/sources/acme-es.yaml";
const acme = {
  id: "acme-es", brand: "Acme", tier: "T1", image_license: "",
  urls: { home: "https://www.acme.es/", prices: "https://ofertas.acme.es/precios" },
};
const candidates = { candidates: [{ brand: "ÁCME", web_es: "https://www.acme.es" }] };
const ids = new Set(["acme-es"]);

test("una fuente nueva T1 de una marca candidata, citada y en su dominio, entra sola", () => {
  assert.equal(newSourceBlocker(acme, ids, candidates), null);
  const pr = { ...green, files: [...green.files, { path: SRC, changeType: "ADDED" }] };
  assert.equal(agentMergeBlocker(pr, cited, false, new Map([[SRC, null]])), null);
});

test("cualquier otra fuente espera a una persona", () => {
  const cases: [unknown, Set<string>?, unknown?][] = [
    [{ ...acme, tier: "T3" }],
    [{ ...acme, image_license: "CC BY 4.0" }],
    [acme, new Set()],
    [{ ...acme, brand: "Otra" }],
    [acme, ids, { candidates: [{ brand: "Acme", web_es: null }] }],
    [{ ...acme, urls: {} }],
    [{ ...acme, urls: { home: "https://acme.es.evil.com/" } }],
    [{ ...acme, urls: { home: "https://notacme.es/" } }],
    [{ ...acme, urls: { home: "no es una url" } }],
    [null],
  ];
  for (const [source, set, cands] of cases) {
    assert.notEqual(newSourceBlocker(source, set ?? ids, cands ?? candidates), null, JSON.stringify(source));
  }
  const modified = { ...green, files: [{ path: SRC, changeType: "MODIFIED" }] };
  assert.notEqual(agentMergeBlocker(modified, cited, false), null);
  assert.notEqual(agentMergeBlocker(modified, cited, false, new Map([[SRC, "cambia tier"]])), null);
  const unchecked = { ...green, files: [{ path: SRC, changeType: "ADDED" }] };
  assert.notEqual(agentMergeBlocker(unchecked, cited, false), null);
  assert.notEqual(agentMergeBlocker(unchecked, cited, false, new Map([[SRC, "no es T1"]])), null);
});

test("citedSources lee los source_id de data/raw en un commit", () => {
  const sources = citedSources("HEAD", REPO);
  assert.ok(sources.size > 0);
});

test("un cambio de fuente que solo añade URL en sus hosts entra solo", () => {
  const before = { ...acme, tier: "T3", notes: "a", last_verified: "2026-10-14" };
  const after = { ...before, notes: "b", last_verified: "2026-10-15",
    urls: { ...before.urls, nuevo: "https://www.acme.es/otro" } };
  assert.equal(changedSourceBlocker(before, after), null);
  const pr = { ...green, files: [{ path: SRC, changeType: "MODIFIED" }] };
  assert.equal(agentMergeBlocker(pr, cited, false, new Map([[SRC, null]])), null);
  const cases = [
    { ...after, tier: "T1" },
    { ...after, image_license: "CC BY 4.0" },
    { ...after, brand: "Otra" },
    { ...after, status: "inactive" },
    { ...after, urls: { home: before.urls.home } },
    { ...after, urls: { ...after.urls, home: "https://www.acme.es/cambiada" } },
    { ...after, urls: { ...after.urls, otra: "https://acme.es/" } },
    { ...after, urls: { ...after.urls, otra: "no es una url" } },
  ];
  for (const c of cases) assert.notEqual(changedSourceBlocker(before, c), null, JSON.stringify(c));
});

test("resolvedTree only resolves last_verified conflicts in data/sources/, to the later date (point 15)", () => {
  const repo = mkdtempSync(join(tmpdir(), "merge-dates-"));
  const g = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t",
    "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args], { cwd: repo, encoding: "utf8" }).trim();
  const commit = (files: Record<string, string>) => {
    for (const [f, text] of Object.entries(files)) {
      mkdirSync(join(repo, dirname(f)), { recursive: true });
      writeFileSync(join(repo, f), text);
    }
    g("add", "-A");
    g("commit", "-q", "-m", "x");
    return g("rev-parse", "HEAD");
  };
  const src = (date: string, notes = "a") => `id: motor-es\nnotes: ${notes}\nlast_verified: ${date}\nstatus: active\n`;
  try {
    g("init", "-q", "-b", "trunk");
    const base = commit({ "data/sources/motor-es.yaml": src("2026-10-13"), "data/raw/x.yaml": "a: 1\n" });
    const main = commit({ "data/sources/motor-es.yaml": src("2026-11-03") });
    g("checkout", "-q", "-b", "pr", base);
    const head = commit({ "data/sources/motor-es.yaml": src("2026-11-01"), "data/raw/x.yaml": "a: 2\n" });

    const tree = resolvedTree(head, main, repo);
    assert.ok(tree);
    assert.equal(g("show", `${tree}:data/sources/motor-es.yaml`), src("2026-11-03").trim());
    assert.equal(g("show", `${tree}:data/raw/x.yaml`), "a: 2");

    // The update commit is accepted as reviewed only while its tree is the rebuilt one.
    const update = g("commit-tree", tree!, "-p", head, "-p", main, "-m", "m");
    assert.equal(reviewedCommit(update, `SHA ${head}`, main, repo), head);
    const forged = g("commit-tree", `${head}^{tree}`, "-p", head, "-p", main, "-m", "m");
    assert.equal(reviewedCommit(forged, `SHA ${head}`, main, repo), forged);

    // Any other conflict, in data/sources/ or elsewhere, is left for a person.
    g("checkout", "-q", "-b", "other", base);
    const notes = commit({ "data/sources/motor-es.yaml": src("2026-11-01", "b") });
    g("checkout", "-q", "trunk");
    const main2 = commit({ "data/sources/motor-es.yaml": src("2026-11-04", "c") });
    assert.equal(resolvedTree(notes, main2, repo), null);
    g("checkout", "-q", "-b", "raw", main);
    const raw = commit({ "data/raw/x.yaml": "a: 3\n" });
    assert.equal(resolvedTree(head, raw, repo), null);
    assert.equal(resolvedTree(head, head, repo), null); // no conflict, nothing to resolve
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
