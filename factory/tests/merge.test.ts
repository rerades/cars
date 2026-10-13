/** Tests for the auto-merge rule of agent PRs (ADR-0011). Run: npm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { REPO } from "../orchestrator.ts";
import { agentMergeBlocker, citedImages, type AgentPr } from "../merge.ts";

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
