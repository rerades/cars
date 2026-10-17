import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { stringify } from "yaml";
import { acme } from "./fixtures.ts";

const WEB = join(import.meta.dirname, "..");

describe("/comparar/ built page (PRD-003, story #317)", () => {
  let root: string;
  let html: string;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "cars-web-"));
    const data = join(root, "data");
    mkdirSync(join(data, "acme"), { recursive: true });
    writeFileSync(join(data, "acme", "Volta.yaml"), stringify(acme()));
    execFileSync(join(WEB, "node_modules/.bin/astro"), ["build", "--outDir", join(root, "out")], {
      cwd: WEB,
      env: { ...process.env, CARS_DATA_DIR: data },
      stdio: "pipe",
    });
    html = readFileSync(join(root, "out/comparar/index.html"), "utf8");
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test("title, h1 and intro are in the served HTML", () => {
    assert.match(html, /<title>Comparar coches · siete3<\/title>/);
    assert.match(html, /<h1[^>]*>Comparar coches<\/h1>/);
    assert.match(html, /Hasta 3 versiones, una al lado de otra/);
  });

  test("CA-16: noindex and a canonical to /comparar/ without parameters, in the static head", () => {
    const head = html.slice(0, html.indexOf("</head>"));
    assert.match(head, /<meta name="robots" content="noindex"\s*\/?>/);
    const canonicals = [...head.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(canonicals, ["https://siete3.com/comparar/"]);
    assert.ok(!canonicals[0].includes("?"));
  });

  test("CA-19: without JavaScript the notice and the link to /coches are visible, not in <noscript>", () => {
    assert.doesNotMatch(html, /<noscript/i);
    const notice = html.match(/<div\b[^>]*data-no-js[^>]*>[\s\S]*?<\/div>/)?.[0];
    assert.ok(notice, "no [data-no-js] notice");
    assert.doesNotMatch(notice, /\bhidden\b/);
    assert.match(notice, /El comparador necesita JavaScript/);
    assert.match(notice, /<a\b[^>]*href="\/coches"[^>]*>\s*Ir al catálogo\s*<\/a>/);
  });

  test("the table section is hidden and its markup lives only in <template>", () => {
    assert.match(html, /<section\b[^>]*data-compare[^>]*\bhidden\b/);
    const withoutTemplates = html.replace(/<template\b[\s\S]*?<\/template>/gi, "");
    assert.doesNotMatch(withoutTemplates, /<table\b/i, "a table outside <template>");
    for (const name of ["table", "column", "field", "cell", "condition"]) {
      assert.match(html, new RegExp(`<template data-tpl="${name}"`), `template ${name}`);
    }
  });

  test("the module script ships and uses no browser storage (RNF-4)", () => {
    const srcs = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    const inline = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(srcs.length + inline.filter(Boolean).length > 0, "no script in the page");
    const code = [
      ...inline,
      ...srcs.map((s) => readFileSync(join(root, "out", s!.replace(/^\//, "")), "utf8")),
    ].join("\n");
    assert.match(code, /replaceState/);
    assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|document\.cookie|serviceWorker/);
  });

  test("status region at the end of main; messages container", () => {
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    assert.match(main, /data-messages="[^"]+"/);
    assert.match(main, /<div\b[^>]*role="status"[^>]*><\/div>\s*$/);
  });
});
