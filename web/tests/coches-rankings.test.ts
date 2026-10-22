import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { es } from "../src/lib/i18n.ts";
import { RANKINGS } from "../src/lib/rankings.ts";

describe("entry to the rankings from /coches (#375, PRD-001 RF-14, CA-19)", () => {
  let out: string;
  let coches: string;
  let nav: string;
  const read = (path: string) => readFileSync(join(out, path, "index.html"), "utf8");
  const group = () => /<h3[^>]*>Rankings<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/.exec(nav)?.[1] ?? "";

  before(() => {
    out = mkdtempSync(join(tmpdir(), "cars-coches-rankings-"));
    const env = { ...process.env };
    delete env.CARS_DATA_DIR;
    execFileSync("pnpm", ["exec", "astro", "build", "--outDir", out], {
      cwd: resolve(import.meta.dirname, ".."),
      env,
      stdio: "pipe",
    });
    coches = read("coches");
    nav = /<nav[^>]*aria-labelledby="explorar"[\s\S]*?<\/nav>/.exec(coches)![0];
  });
  after(() => rmSync(out, { recursive: true, force: true }));

  test("CA-19: a link to each of the five rankings in the HTML, none of them needing JavaScript", () => {
    const links = [...group().matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>\s*([^<]*?)\s*<\/a>/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(
      links,
      RANKINGS.map((r) => [`${r.url}/`, es[`explorar.ranking.${r.id}` as keyof typeof es]]),
    );
    assert.deepEqual(
      links.map((l) => l[1]),
      ["Más baratos", "Más autonomía", "Más batería", "Más potencia", "Carga más rápida en continua"],
    );
  });

  test("CA-19: every link resolves to a page that exists in the build", () => {
    for (const r of RANKINGS) assert.ok(existsSync(join(out, r.url, "index.html")), r.url);
    assert.match(group(), /href="\/rankings\/mas-baratos\/"/);
  });

  test("the group goes after Autonomía, with an h3, inside the Explorar nav", () => {
    const h3s = [...nav.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
    assert.equal(h3s.at(-1), "Rankings");
    assert.equal(h3s.at(-2), "Autonomía");
    assert.ok(nav.indexOf("Rankings") < coches.indexOf('id="resultados"'));
  });

  test("only on /coches: the home page and the other catalog pages do not carry it", () => {
    assert.doesNotMatch(read("."), /rankings\//);
    for (const dir of ["marcas", "segmentos", "precio", "autonomia"]) {
      for (const sub of readdirSync(join(out, dir))) {
        const p = join(out, dir, sub, "index.html");
        if (existsSync(p)) assert.doesNotMatch(readFileSync(p, "utf8"), /href="\/rankings\//, `${dir}/${sub}`);
      }
    }
  });
});
