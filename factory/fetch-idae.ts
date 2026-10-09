/**
 * Reads the battery-electric versions of one brand from the IDAE vehicle database (coches.idae.es),
 * which lists the WLTP homologation data of the cars sold in Spain: a T2 source (ADR-0001).
 * Run by the Researcher: node factory/fetch-idae.ts <brand as IDAE writes it, e.g. TESLA>
 * The results come from a POST with a CSRF token, which WebFetch cannot send; robots.txt allows
 * everything. Prints one JSON object (source_url, retrieved, brand, versions) and writes nothing.
 * On failure it prints the cause and exits 1.
 */

export const PAGE = "https://coches.idae.es/base-datos/marca-y-modelo";
const AJAX = "https://coches.idae.es/ajax";
const USER_AGENT = `siete3-factory/1.0 (https://siete3.com) node/${process.versions.node}`;
const BEV_LABEL = "eléctricos puros";

export interface IdaeVersion {
  id: number;
  name: string; // as IDAE writes it, brand prefix removed
  mtma_kg: number | null; // maximum authorised mass, not kerb weight
  consumption_kwh_100km: number | null;
  power_kw: number | null;
  wltp_km: number | null;
  battery_kwh: number | null; // IDAE does not say whether usable or gross
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").trim();

/** Value of the <option> in <select name="..."> whose label matches, case-insensitive. */
export function optionValue(html: string, select: string, label: string): string | null {
  const block = html.match(new RegExp(`<select[^>]*name="${select}"[^>]*>([\\s\\S]*?)</select>`))?.[1] ?? "";
  for (const [, value, text] of block.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)</g)) {
    if (decode(text).toLowerCase() === label.toLowerCase()) return value;
  }
  return null;
}

const num = (v: unknown) => (v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** One row of the "elec" table: name, label image, fuel, category, mass, consumption, kW, km, kWh, id. */
export function toVersion(row: unknown[], brand: string): IdaeVersion {
  const name = decode(String(row[0])).replace(/\s+/g, " ");
  const prefix = `${brand.toLowerCase()} `;
  return {
    id: Number(row[row.length - 1]),
    name: name.toLowerCase().startsWith(prefix) ? name.slice(prefix.length) : name,
    mtma_kg: num(row[4]),
    consumption_kwh_100km: num(row[5]),
    power_kw: num(row[6]),
    wltp_km: num(row[7]),
    battery_kwh: num(row[8]),
  };
}

/** Laravel session cookies from the response, as one Cookie header. */
const cookies = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

export async function fetchIdae(brand: string, fetchImpl: typeof fetch = fetch, today = new Date()) {
  const page = await fetchImpl(PAGE, { headers: { "User-Agent": USER_AGENT } });
  if (!page.ok) throw new Error(`HTTP ${page.status} for ${PAGE}`);
  const html = await page.text();
  const token = html.match(/name="_token" value="([^"]+)"/)?.[1];
  if (!token) throw new Error("no CSRF token in the search page");
  const marca = optionValue(html, "marca", brand);
  if (!marca) throw new Error(`IDAE has no brand "${brand}"`);
  const motorizacion = optionValue(html, "motorizacion", BEV_LABEL);
  if (!motorizacion) throw new Error(`no "${BEV_LABEL}" option in the search page`);

  const filtros = new URLSearchParams({ _token: token, tipo: "marca-y-modelo", motorizacion, categoria: "", segmento: "", marca, modelo: "" });
  const body = new URLSearchParams({
    _token: token, campo: "listado", ciclo: "elec", filtros: filtros.toString(),
    draw: "1", start: "0", length: "1000", "order[0][column]": "0", "order[0][dir]": "asc",
  });
  const res = await fetchImpl(AJAX, {
    method: "POST",
    body,
    headers: { "User-Agent": USER_AGENT, Cookie: cookies(page), "X-Requested-With": "XMLHttpRequest" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${AJAX}`);
  const data: any = await res.json();
  if (!Array.isArray(data?.data)) throw new Error("unexpected answer from the IDAE listing");
  if (data.recordsFiltered > data.data.length) throw new Error(`only ${data.data.length} of ${data.recordsFiltered} rows`);
  return {
    source_url: PAGE,
    retrieved: today.toISOString().slice(0, 10),
    brand,
    versions: data.data.map((r: unknown[]) => toVersion(r, brand)),
  };
}

if (import.meta.main) {
  const brand = process.argv.slice(2).join(" ");
  if (!brand) {
    console.error("uso: node factory/fetch-idae.ts <marca como la escribe el IDAE, p. ej. TESLA>");
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(await fetchIdae(brand), null, 1));
  } catch (e) {
    console.error(`consulta fallida: ${(e as Error).message}`);
    process.exit(1);
  }
}
