import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { loadModels, loadSources, normalize, type SourceRegistry } from "../src/lib/data.ts";
import { acme } from "./fixtures.ts";

/** PRD-006 / ADR-0017: #595 (reading `reviews`) and #596 (link with data/sources). Fictional outlet, as in data-model.md 3.1. */

const review = (extra: Record<string, unknown> = {}) => ({
  title: "Acme Volta 80 AWD: probamos el SUV eléctrico de 520 km",
  url: "https://www.motor.example/pruebas/acme-volta-80-awd",
  source_id: "motorejemplo-es",
  retrieved: "2026-09-20",
  tier: "T3",
  version: "Volta 80 AWD",
  ...extra,
});
const without = (key: string) => {
  const r: Record<string, unknown> = review();
  delete r[key];
  return r;
};
const source = (extra: Record<string, unknown> = {}) => ({
  id: "motorejemplo-es",
  brand: "(varias; medio del motor)",
  name: "Motor Ejemplo",
  tier: "T3",
  market: "ES",
  kind: ["reviews"],
  urls: { home: "https://www.motor.example/" },
  terms_url: "https://www.motor.example/aviso-legal",
  terms_checked: "2026-09-20",
  last_verified: "2026-09-20",
  ...extra,
});

function sourcesDir(files: Record<string, Record<string, unknown>>): string {
  const dir = mkdtempSync(join(tmpdir(), "sources-"));
  for (const [id, doc] of Object.entries(files)) writeFileSync(join(dir, `${id}.yaml`), stringify(doc));
  return dir;
}
const registry = (extra: Record<string, unknown> = {}): SourceRegistry =>
  loadSources(sourcesDir({ "motorejemplo-es": source(extra) }));

const withReviews = (list: unknown) => ({ ...acme(), reviews: list });
const norm = (list: unknown) => normalize(withReviews(list), "acme/volta.yaml", undefined, null);
const link = (list: unknown, reg: SourceRegistry = registry()) =>
  normalize(withReviews(list), "acme/volta.yaml", undefined, reg);

// --- #595: reading the list ---------------------------------------------------------------------

test("#595: a valid review is kept as written, with and without version", () => {
  const m = norm([review(), without("version")]);
  assert.deepEqual(m.warnings, []);
  assert.equal(m.reviews.length, 2);
  assert.deepEqual(
    { ...m.reviews[0], outlet: undefined },
    { ...review(), outlet: undefined },
  );
  assert.equal("version" in m.reviews[1], false);
});

test("#595: reviews absent, null or [] give an empty list without warnings", () => {
  assert.deepEqual(normalize(acme(), "acme/volta.yaml").reviews, []);
  assert.deepEqual(norm(null).reviews, []);
  const m = norm([]);
  assert.deepEqual(m.reviews, []);
  assert.deepEqual(m.warnings, []);
});

for (const key of ["title", "url", "source_id", "retrieved", "tier"]) {
  test(`#595: a review without ${key} is dropped with a warning, the valid one stays`, () => {
    const m = norm([without(key), review({ title: "Otra" })]);
    assert.deepEqual(m.reviews.map((r) => r.title), ["Otra"]);
    assert.equal(m.warnings.length, 1);
    assert.match(m.warnings[0], /reviews\[0\]: dropped/);
  });
}

test("#595: url that is not https://, tier T1, bad date and empty title are dropped", () => {
  const m = norm([
    review({ url: "http://www.motor.example/x" }),
    review({ url: "www.motor.example/x" }),
    review({ tier: "T1" }),
    review({ retrieved: "ayer" }),
    review({ title: "  " }),
  ]);
  assert.deepEqual(m.reviews, []);
  assert.equal(m.warnings.length, 5);
});

test("#595: a version that is not the name of a version of the file is dropped", () => {
  const m = norm([review({ version: "Volta 99" })]);
  assert.deepEqual(m.reviews, []);
  assert.match(m.warnings[0], /version/);
});

for (const key of ["summary", "excerpt", "rating", "text", "outlet"]) {
  test(`#595: unknown key ${key} drops the review`, () => {
    const m = norm([review({ [key]: "x" })]);
    assert.deepEqual(m.reviews, []);
    assert.match(m.warnings[0], new RegExp(`unknown key ${key}`));
  });
}

test("#595: reviews that is not a list is ignored with a warning", () => {
  const m = norm("nada");
  assert.deepEqual(m.reviews, []);
  assert.deepEqual(m.warnings, ["reviews: not a list"]);
});

test("#595 CA-4: a needs_review model is not published, so neither are its reviews", () => {
  const root = mkdtempSync(join(tmpdir(), "data-"));
  mkdirSync(join(root, "acme"));
  const doc = { ...withReviews([review()]), needs_review: true };
  writeFileSync(join(root, "acme/volta.yaml"), stringify(doc));
  writeFileSync(join(root, "acme/ok.yaml"), stringify({ ...withReviews([review()]), model: "Ok" }));
  const r = loadModels(root, sourcesDir({ "motorejemplo-es": source() }));
  assert.deepEqual(r.models.map((m) => m.model), ["Ok"]);
  assert.equal(r.models.flatMap((m) => m.reviews).length, 1);
});

test("#595 CA-2: every kept review carries source_id, url, retrieved and tier", () => {
  for (const r of link([review(), without("version")]).reviews) {
    for (const k of ["source_id", "url", "retrieved", "tier"] as const) assert.ok(r[k], k);
  }
});

// --- #596: link with data/sources ---------------------------------------------------------------

test("#596: a valid source gives the outlet name and keeps the review", () => {
  const m = link([review()]);
  assert.deepEqual(m.warnings, []);
  assert.equal(m.reviews[0].outlet, "Motor Ejemplo");
});

test("#596: a subdomain of the source domain is accepted (data-model.md 3.1)", () => {
  const m = link([review({ url: "https://videos.motor.example/acme-volta" })]);
  assert.equal(m.reviews.length, 1);
});

test("#596 CA-7: a source missing from data/sources/ drops the review", () => {
  const m = link([review()], loadSources(sourcesDir({})));
  assert.deepEqual(m.reviews, []);
  assert.match(m.warnings[0], /not in data\/sources/);
});

test("#596 CA-7: a source without terms_checked or terms_url drops the review", () => {
  for (const missing of ["terms_checked", "terms_url"]) {
    const src: Record<string, unknown> = source();
    delete src[missing];
    const m = link([review()], loadSources(sourcesDir({ "motorejemplo-es": src })));
    assert.deepEqual(m.reviews, [], missing);
    assert.match(m.warnings[0], /terms/);
  }
});

test("#596: a source without name drops the review", () => {
  const src: Record<string, unknown> = source();
  delete src.name;
  const m = link([review()], loadSources(sourcesDir({ "motorejemplo-es": src })));
  assert.deepEqual(m.reviews, []);
});

test("#596: a source whose kind has no reviews drops the review", () => {
  const m = link([review()], registry({ kind: ["announcements", "tests"] }));
  assert.deepEqual(m.reviews, []);
  assert.match(m.warnings[0], /kind reviews/);
});

test("#596: a tier that differs from the source's drops the review", () => {
  const m = link([review({ tier: "T2" })]);
  assert.deepEqual(m.reviews, []);
  assert.match(m.warnings[0], /tier/);
});

test("#596 CA-1: a url on another domain drops the review", () => {
  const m = link([
    review({ url: "https://otro.example/acme-volta" }),
    review({ url: "https://notmotor.example/acme-volta" }),
  ]);
  assert.deepEqual(m.reviews, []);
  assert.equal(m.warnings.length, 2);
});

test("#596 CA-1: every linked review has outlet, exact url and retrieved date", () => {
  for (const r of link([review(), without("version")]).reviews) {
    assert.ok(r.outlet);
    assert.ok(r.url.startsWith("https://"));
    assert.match(r.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("#596: loadSources ignores files whose id differs from the file name and non-mappings", () => {
  const dir = sourcesDir({ "motorejemplo-es": source({ id: "otro" }) });
  writeFileSync(join(dir, "lista.yaml"), "- a\n- b\n");
  assert.equal(loadSources(dir).size, 0);
  assert.equal(loadSources(join(dir, "no-existe")).size, 0);
});

test("#596: the real reviews in data/ load against the real registry without dropped reviews", () => {
  const { models, errors } = loadModels();
  assert.deepEqual(errors, []);
  const withRev = models.filter((m) => m.reviews.length > 0);
  assert.ok(withRev.length >= 1);
  for (const m of models) {
    assert.deepEqual(m.warnings.filter((w) => w.startsWith("reviews")), [], m.file);
    for (const r of m.reviews) assert.ok(r.outlet, `${m.file}: ${r.source_id}`);
  }
});
