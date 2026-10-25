/** Tests for the weekly URL check (PRD-007 RF-11, CA-15). Run: pnpm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkAll, classify, collectUrls, report } from "../check-urls.ts";

test("collectUrls: every whole URL string in data/raw and data/sources, with the files citing it", () => {
  const root = mkdtempSync(join(tmpdir(), "check-urls-"));
  try {
    mkdirSync(join(root, "raw/acme"), { recursive: true });
    mkdirSync(join(root, "sources"));
    writeFileSync(join(root, "raw/acme/volta.yaml"), [
      "status: {value: on_sale, url: \"https://acme.example/volta\"}",
      "versions:",
      "  - price: {value: 1, price_terms: \"ver https://acme.example/legal\", price_terms_url: \"https://acme.example/ofertas\"}",
      "images:",
      "  - {source_url: \"https://upload.example/a.jpg\", page_url: \"https://commons.example/File:a\"}",
    ].join("\n"));
    writeFileSync(join(root, "sources/acme-es.yaml"), "id: acme-es\nurls: {home: \"https://acme.example/volta\"}\n");
    const urls = collectUrls([join(root, "raw"), join(root, "sources")], root);
    assert.deepEqual([...urls.keys()].sort(), [
      "https://acme.example/ofertas", "https://acme.example/volta", "https://commons.example/File:a", "https://upload.example/a.jpg",
    ]);
    assert.deepEqual(urls.get("https://acme.example/volta"), ["raw/acme/volta.yaml", "sources/acme-es.yaml"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("classify: only 404, 410 and an unknown host are broken", () => {
  assert.equal(classify({ status: 200 }).kind, "ok");
  assert.equal(classify({ status: 404 }).kind, "broken");
  assert.equal(classify({ status: 410 }).kind, "broken");
  for (const status of [401, 403, 429, 500, 503, 400]) assert.equal(classify({ status }).kind, "unchecked", String(status));
  assert.equal(classify(new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } })).kind, "broken");
  assert.deepEqual(classify(Object.assign(new Error("t"), { name: "TimeoutError" })), { kind: "unchecked", why: "tiempo agotado" });
  assert.equal(classify(new TypeError("fetch failed", { cause: { code: "ECONNRESET" } })).kind, "unchecked");
});

test("checkAll + report (CA-15): 404 is broken after one retry, 403 and robots.txt are not checkable", async () => {
  const calls: string[] = [];
  const fake = (async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://gone.example/")) throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
    if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow: /privado");
    const status = url.endsWith("/borrada") ? 404 : url.endsWith("/bots") ? 403 : 200;
    return new Response("x", { status });
  }) as typeof fetch;
  const urls = ["https://a.example/ok", "https://a.example/borrada", "https://a.example/bots", "https://a.example/privado/x", "https://gone.example/p"];
  const verdicts = await checkAll(urls, { fetchImpl: fake, sleep: async () => {} });

  assert.equal(verdicts.get("https://a.example/ok")!.kind, "ok");
  assert.equal(verdicts.get("https://a.example/borrada")!.kind, "broken");
  assert.equal(calls.filter((c) => c === "https://a.example/borrada").length, 2, "retried once");
  assert.equal(calls.filter((c) => c === "https://a.example/bots").length, 1, "no retry when not broken");
  assert.equal(verdicts.get("https://a.example/bots")!.kind, "unchecked");
  assert.deepEqual(verdicts.get("https://a.example/privado/x"), { kind: "unchecked", why: "robots.txt no lo permite" });
  assert.ok(!calls.includes("https://a.example/privado/x"), "a disallowed URL is never requested");
  assert.equal(verdicts.get("https://gone.example/p")!.kind, "broken");

  const body = report(verdicts, new Map([["https://a.example/borrada", ["data/raw/acme/volta.yaml"]]]), new Date("2026-10-26"));
  assert.equal(body.split("\n")[0], "<!-- fuentes-rotas: broken=2 unchecked=2 checked=5 -->");
  assert.match(body, /## Rotas \(2\)\n- https:\/\/a\.example\/borrada — HTTP 404 — `data\/raw\/acme\/volta\.yaml`/);
  const [rotas, resto] = body.split("<details>");
  assert.doesNotMatch(rotas, /a\.example\/bots/, "403 is not listed as broken");
  assert.match(resto, /a\.example\/bots — HTTP 403/);

  const clean = report(new Map([["https://a.example/ok", { kind: "ok" }]]), new Map());
  assert.match(clean, /broken=0/);
  assert.match(clean, /## Rotas \(0\)\nNinguna\./);
});
