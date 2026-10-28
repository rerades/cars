import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { stringify } from "yaml";
import { buildSite } from "./build-site.ts";
import { sourced } from "../tests/fixtures.ts";

/**
 * A small site built from test data (CARS_DATA_DIR) and served by a tiny static server, for the
 * ranking specs (ADR-0015, detail 6). The data is made so every filter case of PRD-005 has an answer:
 *
 * autonomy ranking (wltp_km), unfiltered: Beta Max 700 (no segment, T2), Alpha Uno 500, Alpha Dos 450,
 * Alpha Tres 400, Gamma Mini 300; left out: Alpha Sin (no figure), Alpha T3 (T3 figure), Gamma Sin.
 * Prices: Alpha Uno 30,000, Alpha Dos 30,001 (financed), Alpha Tres 45,000, Beta Max 20,000,
 * Gamma Mini none.
 */

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

export const RANKING_SLUGS = [
  "mas-baratos",
  "mas-autonomia",
  "mas-bateria",
  "mas-potencia",
  "carga-mas-rapida-en-continua",
] as const;

export const TERMS = "PVP financiando de 30.001 €. Crédito mínimo de 10.000 € con permanencia de 48 meses.";
export const TERMS_URL = "https://www.acme.example/es/alpha/ofertas";

const price = (value: number, extra: Record<string, unknown> = {}) => ({
  ...sourced(value, { unit: "EUR", price_kind: "pvp" }),
  ...extra,
});

function model(brand: string, brandName: string, name: string, segment: string | null, versions: unknown[]) {
  return {
    brand,
    brand_name: brandName,
    model: name,
    status: sourced("on_sale"),
    ...(segment ? { segment: sourced(segment) } : {}),
    needs_review: false,
    versions,
    images: [],
  };
}

/** The YAML documents by `brand/Model` file. */
export function testModels(): Record<string, unknown> {
  return {
    "alfa/Alpha": model("alfa", "Alfa", "Alpha", "suv_compacto", [
      { name: "Alpha Uno", wltp_km: sourced(500), price: price(30000) },
      {
        name: "Alpha Dos",
        wltp_km: sourced(450),
        price: price(30001, { price_kind: "financed", price_terms: TERMS, price_terms_url: TERMS_URL }),
      },
      { name: "Alpha Tres", wltp_km: sourced(400), price: price(45000) },
      { name: "Alpha Sin", price: price(31000) },
      { name: "Alpha T3", wltp_km: sourced(380, { tier: "T3" }), price: price(32000) },
    ]),
    "beta/Beta": model("beta", "Beta", "Beta", null, [
      { name: "Beta Max", wltp_km: sourced(700, { tier: "T2" }), price: price(20000) },
    ]),
    "gamma/Gamma": model("gamma", "Gamma", "Gamma", "urbano", [
      { name: "Gamma Mini", wltp_km: sourced(300), price: null },
      { name: "Gamma Sin", price: null },
    ]),
  };
}

export interface RankingsSite {
  url: string;
  out: string;
  close(): void;
}

/** Builds the test-data site and serves it on a free local port. Call from a `beforeAll`. */
export async function startRankingsSite(): Promise<RankingsSite> {
  const tmp = mkdtempSync(join(tmpdir(), "cars-rankings-e2e-"));
  const data = join(tmp, "data");
  const out = join(tmp, "out");
  for (const [file, doc] of Object.entries(testModels())) {
    mkdirSync(join(data, file.split("/")[0]!), { recursive: true });
    writeFileSync(join(data, `${file}.yaml`), stringify(doc));
  }
  buildSite(out, { CARS_DATA_DIR: data, CARS_IMAGES_DIR: join(tmp, "images") });

  const server: Server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
    let file = join(out, path);
    if (!file.startsWith(out)) return void res.writeHead(403).end();
    try {
      if (statSync(file).isDirectory()) file = join(file, "index.html");
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const addr = server.address();
  return {
    url: `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`,
    out,
    close() {
      server.close();
      rmSync(tmp, { recursive: true, force: true });
    },
  };
}
