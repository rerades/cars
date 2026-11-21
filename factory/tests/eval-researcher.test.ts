/** Tests for the Researcher evals (ADR-0026, decisions 2 and 3). Run: pnpm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { FetchCall } from "../dataset-capture.ts";
import { offlineConfig, researcherCaseProblem, researcherCompare, researcherScores, type ResearcherCase } from "../eval-researcher.ts";
import type { CaseResult, Summary } from "../eval-run.ts";
import { replay, replayGuard, type ReplayEntry } from "../fetch-replay.ts";
import { REPO } from "../orchestrator.ts";

const URL_ = "https://www.acme.es/volta";
const page = (paragraphs: string[], url = URL_) => JSON.stringify({ url, final_url: url, retrieved: "2026-10-31", chars: 999, keywords: ["x"], paragraphs });
const frozen: FetchCall[] = [
  { tool: "fetch-page", args: [URL_, "PVP"], exit: 0, output: page(["Volta Pro", "PVP 39.990 €", "Autonomía 512 km", "Oferta válida hasta el 30/11/2026."]) },
  { tool: "fetch-idae", args: ["ACME"], exit: 0, output: '{"rows":[1]}' },
  { tool: "fetch-image", args: ["acme", "volta"], exit: 1, output: "HTTP 404" },
];

test("el reproductor responde lo congelado, filtra con las palabras nuevas y no lee lo que el original no leyó", () => {
  const a = replay("fetch-page", [URL_, "512"], frozen);
  assert.equal(a.code, 0);
  assert.deepEqual(JSON.parse(a.stdout).paragraphs, ["Autonomía 512 km", "Oferta válida hasta el 30/11/2026."]);
  assert.equal(JSON.parse(a.stdout).retrieved, "2026-10-31");
  assert.match(JSON.parse(replay("fetch-page", [URL_], frozen).stdout).text, /PVP 39.990/);
  assert.equal(replay("fetch-page", ["https://www.acme.es/otra", "PVP"], frozen).code, 1);
  assert.equal(replay("fetch-idae", ["ACME"], frozen).stdout, '{"rows":[1]}');
  assert.deepEqual(replay("fetch-image", ["acme", "volta"], frozen), { stdout: "", stderr: "HTTP 404", code: 1 });
  assert.equal(replay("fetch-idae", ["OTRA"], frozen).code, 1);
});

test("el desvío solo actúa al ejecutar el script dentro de un caso; sus exports siguen", () => {
  const dir = mkdtempSync(join(tmpdir(), "replay-"));
  try {
    writeFileSync(join(dir, "01.json"), JSON.stringify(frozen[1]));
    const script = join(dir, "fetch-idae.ts");
    writeFileSync(script, replayGuard("fetch-idae", join(REPO, "factory", "fetch-replay.ts")) +
      `export const PAGE = "x";\nif (import.meta.main) console.log("real");\n`);
    const log = join(dir, "log.jsonl");
    const run = (env: Record<string, string>) => spawnSync("node", [script, "ACME"], { encoding: "utf8", env: { ...process.env, ...env } });
    assert.equal(run({ FETCH_REPLAY_DIR: dir, FETCH_REPLAY_LOG: log }).stdout.trim(), '{"rows":[1]}');
    assert.equal(JSON.parse(readFileSync(log, "utf8")).tool, "fetch-idae");
    assert.equal(run({}).stdout.trim(), "real");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const src = (value: unknown, retrieved: string, extra: Record<string, unknown> = {}) => ({ value, source_id: "acme-es", url: URL_, retrieved, tier: "T1", ...extra });
const doc = (o: { price?: unknown; wltp?: unknown; power?: unknown }) => ({
  brand: "acme", model: "Volta",
  specs: { wltp_max_km: o.wltp },
  versions: [{ name: "Volta Pro", power_kw: o.power, price: o.price }],
});
const kase: ResearcherCase = {
  case_id: "pr-0001", pr: 1, run_id: "r", baseRefOid: "x", date: "2026-10-31", task: "t", confirmed: true, rules: ["dates", "price_proof"],
  expected: { "data/raw/acme/volta.yaml": { "versions[Volta Pro].price": { value: 39990, price_kind: "pvp", date: "fresh" }, "versions[Volta Pro].power_kw": { date: "kept" } } },
  fetch: [], dir: "",
};
const F = "data/raw/acme/volta.yaml";
const call = (args: string[], paragraphs: string[]): ReplayEntry => ({ tool: "fetch-page", args, code: 0, stdout: page(paragraphs), stderr: "" });

test("puntúa fechas con lectura, prueba del precio, valores esperados y campos que se quedan (decisión 3)", () => {
  const base = new Map([[F, doc({ price: src(38990, "2026-10-01", { unit: "EUR", price_kind: "pvp" }), wltp: src(512, "2026-10-01"), power: src(150, "2026-10-01") })]]);
  const good = new Map([[F, doc({ price: src(39990, "2026-10-31", { unit: "EUR", price_kind: "pvp" }), wltp: src(512, "2026-10-31"), power: src(150, "2026-10-01") })]]);
  const calls = [call([URL_, "39.990", "Volta Pro", "512"], ["Volta Pro", "PVP 39.990 €", "Autonomía 512 km"])];
  const ok = researcherScores(kase, base, good, calls, []);
  assert.deepEqual({ ...ok.scores }, {
    schema: 1, dates: 1, dates_unread: 0, price_proof: 1, price_found: 1, price_kind: 1, cash_amount: 1,
    price_terms_literal: null, page_name_literal: null, expired_offer: 1, value_match: 1, open_questions_ok: null,
  }, ok.notes.join("\n"));

  // The PR #806 mistake: power_kw dated without a read that shows 150, and a kept field moved.
  const bad = new Map([[F, doc({ price: src(39990, "2026-10-31", { unit: "EUR", price_kind: "pvp" }), wltp: src(512, "2026-10-31"), power: src(150, "2026-10-31") })]]);
  const b = researcherScores(kase, base, bad, calls, []);
  assert.equal(b.scores.dates_unread, 1);
  assert.ok(Number(b.scores.dates) < 1);
  assert.ok(b.notes.some((n) => /power_kw.*sin lectura/.test(n)));
  assert.ok(b.notes.some((n) => /tenía que quedarse/.test(n)));

  // Without the price among the keywords there is no price_proof; a schema failure zeroes the rest.
  assert.equal(researcherScores(kase, base, good, [call([URL_, "Autonomía"], ["Volta Pro", "PVP 39.990 €", "Autonomía 512 km"])], []).scores.price_proof, 0);
  const s = researcherScores(kase, base, good, calls, ["data/raw/acme/volta.yaml: bad"]).scores;
  assert.equal(s.schema, 0);
  assert.equal(s.dates, 0);
});

test("una oferta financed vencida en la fecha del caso puntúa 0 en expired_offer", () => {
  const terms = "Oferta válida hasta el 30/09/2026.";
  const head = new Map([[F, doc({ price: src(39990, "2026-10-31", { unit: "EUR", price_kind: "financed", price_terms: terms, price_terms_url: URL_ }) })]]);
  const r = researcherScores(kase, new Map([[F, null]]), head, [call([URL_, "39.990", "Volta Pro"], ["Volta Pro 39.990 €", terms])], []);
  assert.equal(r.scores.expired_offer, 0);
  assert.equal(r.scores.price_terms_literal, 1);
});

test("un caso sin confirmar, sin expected o con una lectura cambiada no corre", () => {
  const root = mkdtempSync(join(tmpdir(), "fetchroot-"));
  try {
    mkdirSync(join(root, "pr-0001", "fetch"), { recursive: true });
    writeFileSync(join(root, "pr-0001", "fetch", "01.json"), "a");
    const sha = createHash("sha256").update("a").digest("hex");
    assert.equal(researcherCaseProblem({ ...kase, confirmed: false }, root), "sin confirmar");
    assert.equal(researcherCaseProblem({ ...kase, expected: null }, root), "sin expected");
    assert.match(researcherCaseProblem({ ...kase, rules: ["nope"] }, root) ?? "", /desconocidas/);
    assert.equal(researcherCaseProblem({ ...kase, fetch: [{ file: "01.json", sha256: sha }] }, root), null);
    assert.match(researcherCaseProblem({ ...kase, fetch: [{ file: "01.json", sha256: "0" }] }, root) ?? "", /sha256/);
    assert.match(researcherCaseProblem({ ...kase, fetch: [{ file: "02.json", sha256: sha }] }, root) ?? "", /falta/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("aprobación: schema y fechas sin lectura en cada caso, sin bajar las reglas del caso, coste +25 % como mucho", () => {
  const res = (scores: Record<string, number | null>, usd = 0.5): CaseResult =>
    ({ case_id: "pr-0001", pr: 1, expected_label: "", labels: [], scores: scores as unknown as CaseResult["scores"], agent_usd: usd, judge_usd: 0, turns: 10, units: 0, notes: [] });
  const sum = (r: CaseResult, started = "2026-11-21T08:00:00+01:00"): Summary => ({
    experiment: "e", agent: "researcher", model: "m", prompt_sha: "p", dataset_sha: "d", judge_model: "", rubric_sha: "",
    started, ended: started, complete: true, stopped: null, cases: [r], totals: { usd_avg: r.agent_usd },
  });
  const rules = new Map([["pr-0001", ["dates", "price_proof"]]]);
  const base = sum(res({ schema: 1, dates: 0.8, dates_unread: 1, price_proof: 1 }));
  assert.deepEqual(researcherCompare(base, sum(res({ schema: 1, dates: 1, dates_unread: 0, price_proof: 1 })), rules), { approved: true, reasons: [] });
  const worse = researcherCompare(base, sum(res({ schema: 1, dates: 1, dates_unread: 1, price_proof: 0.5 }, 0.7)), rules);
  assert.equal(worse.approved, false);
  assert.equal(worse.reasons.length, 3); // dates without a read, price_proof down, cost +40 %
});

test("en un caso el Researcher no tiene WebSearch ni WebFetch (decisión 2.3)", () => {
  const cfg = offlineConfig({ agents: { researcher: { allowed_tools: ["WebSearch", "WebFetch", "Bash(node factory/fetch-page.ts:*)"] } } });
  assert.deepEqual(cfg.agents!.researcher!.allowed_tools, ["Bash(node factory/fetch-page.ts:*)"]);
  assert.deepEqual(cfg.agents!.researcher!.denied_tools, ["WebSearch", "WebFetch"]);
});
