import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileOf, urlOf } from "../scripts/design-shot.ts";

const WEB = resolve(import.meta.dirname, "..");
const SLUG = "prueba-de-fuga";
const PROTO = join(WEB, "design-proto", `${SLUG}.astro`);
const MARKER = "#a1b2c3";

function build(env: Record<string, string>): string {
  const out = mkdtempSync(join(tmpdir(), "cars-proto-"));
  execFileSync("pnpm", ["exec", "astro", "build", "--outDir", out], {
    cwd: WEB,
    env: { ...process.env, ...env },
    stdio: "pipe",
  });
  return out;
}

// ADR-0024: a prototype overrides tokens for itself. If its styles reached the published site,
// a proposal would repaint production.
test("a prototype is built only with DESIGN_PROTO=1, and its page and styles never get published", () => {
  writeFileSync(PROTO, `<style is:global>:root { --color-brand-600: ${MARKER}; }</style><p>Prototipo</p>`);
  try {
    const published = build({ DESIGN_PROTO: "" });
    assert.equal(existsSync(join(published, "proto")), false, "the published site has /proto/");
    const files = readdirSync(published, { recursive: true, encoding: "utf8" }).filter((f) => /\.(html|css|js)$/.test(f));
    for (const f of files) {
      assert.ok(!readFileSync(join(published, f), "utf8").includes(MARKER), `prototype styles leaked into ${f}`);
    }
    const withProto = build({ DESIGN_PROTO: "1" });
    assert.ok(existsSync(join(withProto, "proto", SLUG, "index.html")), "the prototype is not built");
  } finally {
    rmSync(PROTO, { force: true });
  }
});

test("targets of design-shot: pages and prototypes", () => {
  assert.equal(urlOf("catalogo-a"), "/proto/catalogo-a/");
  assert.equal(urlOf("/coches/"), "/coches/");
  assert.equal(fileOf("catalogo-a", 390), "catalogo-a-390.png");
  assert.equal(fileOf("/marcas/tesla/", 1280), "marcas-tesla-1280.png");
  assert.equal(fileOf("/", 390), "portada-390.png");
});
