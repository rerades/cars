/** Tests for the trust ladder events (ADR-0022, "Escalera"; PRD-007 CA-11 and CA-12). Run: pnpm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { stateMergeBlocker, STATE_BRANCH, type StatePr } from "../orchestrator.ts";
import { classify, escapedBy, nextEvents, trustAreas, trustState, type MergedPr, type TrustEvent } from "../trust.ts";

const AT = "2026-11-21T07:30:00.000Z";
const pr = (n: number, o: Partial<MergedPr> = {}): MergedPr => ({
  number: n, agent: "developer", mergedAt: `2026-10-${String(n).padStart(2, "0")}T07:30:00Z`, files: ["web/src/a.astro"],
  mergedBy: "human", changesLabels: [], redCi: null, escaped: null, humanCommits: [], ...o,
});

test("CA-11: cinco fusiones limpias seguidas suben al nivel 1; un defecto escapado lo baja", () => {
  const first = nextEvents([1, 2, 3, 4].map((n) => pr(n)), ["web/"], [], AT);
  assert.deepEqual(first.map((e) => e.type), ["clean", "clean", "clean", "clean"]);
  const fifth = nextEvents([pr(5)], ["web/"], first, AT);
  assert.deepEqual(fifth.map((e) => e.id), ["clean:web/:5", "up:web/:5"]);
  assert.match(fifth[1].reason, /#1 #2 #3 #4 #5/);
  const all = [...first, ...fifth];
  assert.deepEqual(trustState(all).get("developer|web/"), { agent: "developer", area: "web/", level: 1, streak: 0 });

  const bad = nextEvents([pr(6, { escaped: "#9 fix(web): broken card, cites #6" })], ["web/"], all, AT);
  assert.deepEqual(bad.map((e) => [e.type, e.reason]), [["unclean", "escaped defect"], ["down", "escaped defect"]]);
  assert.equal(bad[1].level, 0);
  assert.equal(trustState([...all, ...bad]).get("developer|web/")!.level, 0);
});

test("una unclean corta la racha y no hay segundo peldaño", () => {
  const evs = nextEvents([pr(1), pr(2), pr(3, { changesLabels: ["2026-10-03T06:40:00Z"] }), pr(4), pr(5), pr(6), pr(7)], ["web/"], [], AT);
  assert.equal(evs.filter((e) => e.type === "up").length, 0); // 2 + 4 cleans, never 5 in a row
  const more = nextEvents([8, 9, 10, 11, 12, 13, 14, 15, 16].map((n) => pr(n)), ["web/"], evs, AT);
  assert.equal(more.filter((e) => e.type === "up").length, 1); // level 1 is the top
});

test("las causas van en el orden de la ADR y las demás quedan como evidencia", () => {
  const c = classify(pr(1, { redCi: "https://ci/1", changesLabels: ["2026-10-01T06:40:00Z"], humanCommits: ["abc1234"] }));
  assert.equal(c.reason, "review:changes");
  assert.match(c.evidence!, /red CI: https:\/\/ci\/1; human commits: abc1234/);
  // Commits of a person count only when a person merged it; the factory never merges a PR it was helped with.
  assert.equal(classify(pr(1, { mergedBy: "factory", humanCommits: ["abc1234"] })).type, "clean");
});

test("cada PR genera evento solo para las áreas que toca, y la pasada es idempotente", () => {
  const p = pr(1, { files: ["web/a.ts", "docs/design/b.md"] });
  const once = nextEvents([p, pr(2, { files: ["data/raw/x.yaml"] })], ["web/"], [], AT);
  assert.deepEqual(once.map((e) => e.id), ["clean:web/:1"]);
  assert.deepEqual(nextEvents([p], ["web/"], once, AT), []);
});

test("CA-12: factory/, .claude/, .github/ y las ADR nunca son un área", () => {
  const cfg = { trust: { areas: ["web/", "factory/", ".claude/agents/", ".github/", "docs/architecture/adr/", "docs/", "data"] } };
  assert.deepEqual(trustAreas(cfg as never), ["web/"]);
  assert.deepEqual(trustAreas({} as never), []);
});

test("defecto escapado: un revert o un fix que cita la PR en sus 7 días (ADR-0019)", () => {
  const p = { number: 612, url: "https://github.com/o/r/pull/612", mergedAt: "2026-11-01T07:30:00Z" };
  const m = (number: number, title: string, mergedAt: string, body = "") => ({ number, title, body, mergedAt });
  assert.match(escapedBy(p, [m(661, "fix(web): card overflow", "2026-11-03T10:00:00Z", "Fixes a bug from #612.")]) ?? "", /#661/);
  assert.match(escapedBy(p, [m(662, 'Revert "feat(web): cards"', "2026-11-02T10:00:00Z", "Reverts rerades/cars#612")]) ?? "", /#662/);
  assert.equal(escapedBy(p, [m(663, "fix(web): x", "2026-11-09T10:00:00Z", "#612")]), null); // after 7 days
  assert.equal(escapedBy(p, [m(664, "feat(web): y", "2026-11-02T10:00:00Z", "#612")]), null); // not a fix
  assert.equal(escapedBy(p, [m(665, "fix(web): z", "2026-11-02T10:00:00Z", "#6120")]), null); // another PR
  assert.match(escapedBy(p, [m(666, "fix(web): w", "2026-11-02T10:00:00Z", p.url)]) ?? "", /#666/);
});

test("la PR de estado admite filas nuevas de ops/trust/ (enmienda de ADR-0013)", () => {
  const sp = (path: string, deletions = 0): StatePr => ({
    headRefName: STATE_BRANCH, headRefOid: "x", mergeable: "MERGEABLE", labels: [{ name: "automerge" }],
    statusCheckRollup: [{ status: "COMPLETED", conclusion: "SUCCESS" }], files: [{ path, deletions }],
  });
  assert.equal(stateMergeBlocker(sp("ops/trust/2026-11.jsonl"), false), null);
  assert.match(stateMergeBlocker(sp("ops/trust/2026-11.jsonl", 1), false) ?? "", /añadir filas/);
  assert.match(stateMergeBlocker(sp("ops/trust/x/y.jsonl"), false) ?? "", /añadir filas/);
});

test("el nivel se rehace entero desde los eventos", () => {
  const e = (type: TrustEvent["type"], pr: number): TrustEvent => ({ id: `${type}:web/:${pr}`, at: AT, type, agent: "developer", area: "web/", pr, reason: "r" });
  assert.deepEqual(trustState([e("clean", 1), e("up", 1), e("clean", 2), e("down", 3), e("down", 4)]).get("developer|web/"),
    { agent: "developer", area: "web/", level: 0, streak: 0 });
});
