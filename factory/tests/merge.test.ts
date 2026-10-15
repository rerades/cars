/** Tests for the auto-merge rule of agent PRs (ADR-0011). Run: npm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { REPO } from "../orchestrator.ts";
import { agentMergeBlocker, citedImages, citedSources, newSourceBlocker, type AgentPr } from "../merge.ts";

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
  assert.notEqual(agentMergeBlocker(modified, cited, false, new Map([[SRC, null]])), null);
  const unchecked = { ...green, files: [{ path: SRC, changeType: "ADDED" }] };
  assert.notEqual(agentMergeBlocker(unchecked, cited, false), null);
  assert.notEqual(agentMergeBlocker(unchecked, cited, false, new Map([[SRC, "no es T1"]])), null);
});

test("citedSources lee los source_id de data/raw en un commit", () => {
  const sources = citedSources("HEAD", REPO);
  assert.ok(sources.size > 0);
});
