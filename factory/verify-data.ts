/**
 * Data verifier of PRD-007 RF-8 (ADR-0020 and its amendments «Versión y unidad» and «Nombre de la
 * versión en la página»): code without a
 * model, the last rule of the merge pass (merge.ts). For a data PR it reads again, with the rules of
 * fetch-page.ts, the pages cited by the new or changed values and looks for each number (and each
 * price_terms) in the visible text. A value that is not there sends the PR to a person.
 */
import { classify } from "./check-urls.ts";
import { PAGE as IDAE_PAGE } from "./fetch-idae.ts";
import { readPage, Refused, registeredHosts } from "./fetch-page.ts";

export const MAX_URLS = 10;
export const ANCHOR_LINES = 3;
const HOST_GAP_MS = 1_000;
const MAX_QUOTE = 300;
const JS_HINT = "si la página pinta el valor con JavaScript, no está en el HTML; compruébalo en el navegador";

/** A value to look for in its page. */
export interface Item {
  file: string;
  path: string;
  field: string;
  value: number | string;
  url: string;
  kind: "number" | "terms";
  /** The version that owns a versions[].price, and the names of every version of the file. */
  version?: string;
  names?: string[];
  /** [version name, price.page_name] of the versions that have one (amendment «Nombre de la versión en la página»). */
  pageNames?: [string, string][];
}
export interface Unverifiable { file: string; path: string; value: unknown }
export interface Changes { items: Item[]; unverifiable: Unverifiable[] }

type Status = "found" | "missing" | "other" | "unanchored" | "no_unit";
export interface Finding { item: Item; status: Status; detail: string[] }
export interface UrlResult {
  url: string;
  kind: "read" | "broken" | "rejected" | "unchecked";
  why: string;
  chars: number;
  items: Item[];
  findings: Finding[];
}
export interface Verification {
  blocking: boolean;
  urls: UrlResult[];
  outOfSample: Item[];
  unverifiable: Unverifiable[];
}

type Node = Record<string, unknown>;
const isObj = (v: unknown): v is Node => !!v && typeof v === "object" && !Array.isArray(v);
const isSourced = (v: unknown): v is Node => isObj(v) && "value" in v && typeof v.url === "string";

/** Every Sourced of a YAML by a stable path; list entries are keyed by name (versions) or by content. */
type Anchor = { names: string[]; pageNames: [string, string][] };
function sourcedByPath(doc: unknown): Map<string, { node: Node; field: string; version?: string; anchor?: Anchor }> {
  const out = new Map<string, { node: Node; field: string; version?: string; anchor?: Anchor }>();
  const versions = (isObj(doc) && Array.isArray(doc.versions) ? doc.versions : []).map((v) => (isObj(v) ? v : {}));
  const anchor: Anchor = {
    names: versions.map((v) => String(v.name ?? "")),
    pageNames: versions.flatMap((v) => (isObj(v.price) && typeof v.price.page_name === "string" ? [[String(v.name), v.price.page_name] as [string, string]] : [])),
  };
  const walk = (v: unknown, path: string, field: string, version?: string) => {
    if (isSourced(v)) out.set(path, { node: v, field, version, anchor: version === undefined ? undefined : anchor });
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        const e = (x ?? {}) as Node;
        const key = e.name ?? (e.metric ? `${e.test}|${e.metric}|${e.version ?? ""}` : i);
        walk(x, `${path}[${key}]`, field, path === "versions" ? String(e.name) : version);
      });
    } else if (isObj(v)) {
      for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, k, version);
    }
  };
  walk(doc, "", "");
  return out;
}

/** The Sourced values of `head` that are new or changed their value or url against `base` (ADR-0020). */
export function changedItems(file: string, base: unknown, head: unknown): Changes {
  const before = sourcedByPath(base);
  const items: Item[] = [];
  const unverifiable: Unverifiable[] = [];
  for (const [path, { node, field, version, anchor: a }] of sourcedByPath(head)) {
    const old = before.get(path)?.node;
    if (!old || old.value !== node.value || old.url !== node.url) {
      const anchor = field === "price" && version !== undefined && a ? { version, names: a.names, pageNames: a.pageNames } : {};
      if (typeof node.value === "number") items.push({ file, path, field, value: node.value, url: String(node.url), kind: "number", ...anchor });
      else unverifiable.push({ file, path, value: node.value });
    }
    if (typeof node.price_terms === "string" && typeof node.price_terms_url === "string" && (!old || old.price_terms !== node.price_terms)) {
      items.push({ file, path: `${path}.price_terms`, field: "price_terms", value: node.price_terms, url: node.price_terms_url, kind: "terms" });
    }
  }
  return { items, unverifiable };
}

const SPACES = /[\s   ]+/g;

/** The spellings of a number in a Spanish page (ADR-0020, «Cómo se busca»), not inside other figures. */
export function numberPattern(v: number): RegExp {
  const [int, dec = ""] = String(v).split(".");
  const group = (sep: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const ints = int.length > 3 ? `(?:${int}|${group("\\.")}|${group(" ")})` : int;
  const decs = dec ? `[.,]${dec}0*` : "(?:[.,]0+)?";
  return new RegExp(`(?<!\\d)(?<!\\d[.,])${ints}${decs}(?![.,]?\\d)`, "g");
}

/** The unit a short number needs (amendment, point 10), from the suffix of its field. */
function unitPattern(field: string): string | null {
  if (field.endsWith("_kwh")) return "kwh";
  if (field.endsWith("_kw")) return "kw(?!h)";
  if (field.endsWith("_km")) return "km";
  return null;
}

export const norm = (s: string) => s.toLowerCase().replace(/[-–—]/g, " ").replace(SPACES, " ").trim();
const quote = (s: string) => `«${s.length > MAX_QUOTE ? `${s.slice(0, MAX_QUOTE)}…` : s}»`;

/** The version names in a paragraph; when one contains another, the longest wins (point 9). */
export function namesIn(line: string, names: string[]): string[] {
  let rest = norm(line);
  const found: string[] = [];
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    const n = norm(name);
    if (!n) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "gu");
    if (re.test(rest)) {
      found.push(name);
      rest = rest.replace(re, (m) => "\0".repeat(m.length));
    }
  }
  return found;
}

/** Looks for one value in the paragraphs of its page. */
export function check(item: Item, lines: string[]): Finding {
  if (item.kind === "terms") {
    const want = item.value.toString().replace(SPACES, " ").trim();
    const found = lines.join(" ").replace(SPACES, " ").includes(want);
    return { item, status: found ? "found" : "missing", detail: [] };
  }
  const re = numberPattern(Number(item.value));
  const hits: { line: number; end: number }[] = [];
  lines.forEach((l, i) => {
    const text = l.replace(SPACES, " ");
    for (const m of text.matchAll(re)) hits.push({ line: i, end: m.index + m[0].length });
  });
  if (!hits.length) {
    // The closest paragraphs: those with a number of the same size (38.990 for 39990).
    const size = String(Math.trunc(Number(item.value))).length;
    const sameSize = (l: string) => (l.replace(SPACES, " ").match(/\d{1,3}(?:[. ]\d{3})+|\d+/g) ?? []).some((n) => n.replace(/\D/g, "").length === size);
    const near = lines.filter(sameSize).slice(0, 3).map(quote);
    return { item, status: "missing", detail: near.length ? near : ["ninguno"] };
  }
  if (item.version !== undefined) {
    // A paragraph names a version by its name or its price.page_name; a text that is both gives two owners.
    const names = item.names ?? [];
    const pages = item.pageNames ?? [];
    const versionsOf = (n: string) => [...(names.includes(n) ? [n] : []), ...pages.filter(([, p]) => p === n).map(([v]) => v)];
    const named = lines.map((l) => namesIn(l, [...new Set([...names, ...pages.map(([, p]) => p)])]).flatMap(versionsOf));
    const owners = (i: number) => {
      if (named[i].length) return named[i];
      for (let j = i - 1; j >= Math.max(0, i - ANCHOR_LINES); j--) if (named[j].length) return named[j];
      return [];
    };
    let other: { line: number; owner: string } | undefined;
    for (const h of hits) {
      const o = owners(h.line);
      if (o.includes(item.version)) return { item, status: "found", detail: [] };
      if (o.length && !other) other = { line: h.line, owner: o[0] };
    }
    if (!other) return { item, status: "unanchored", detail: [] };
    const own = named.findIndex((n) => n.includes(item.version!));
    return {
      item,
      status: "other",
      detail: [
        `aparece bajo «${other.owner}»: ${quote(lines[other.line])}`,
        own < 0 ? "la página no nombra esta versión" : `la versión está en: ${quote(lines[own])}`,
      ],
    };
  }
  const digits = String(item.value).replace(/\D/g, "").length;
  if (digits > 2) return { item, status: "found", detail: [] };
  const unit = unitPattern(item.field);
  const withUnit = unit && hits.some((h) => new RegExp(`^ ?${unit}(?![a-z])`, "i").test(lines[h.line].replace(SPACES, " ").slice(h.end)));
  return { item, status: withUnit ? "found" : "no_unit", detail: [] };
}

/** At most MAX_URLS distinct URLs: those with a price or price_terms first, then by URL (ADR-0020, «La muestra»). */
export function sample(items: Item[]): { urls: Map<string, Item[]>; outOfSample: Item[] } {
  const byUrl = new Map<string, Item[]>();
  for (const it of items) (byUrl.get(it.url) ?? byUrl.set(it.url, []).get(it.url)!).push(it);
  const pricey = (u: string) => byUrl.get(u)!.some((it) => it.field === "price" || it.field === "price_terms");
  const order = [...byUrl.keys()].sort((a, b) => Number(pricey(b)) - Number(pricey(a)) || a.localeCompare(b));
  return {
    urls: new Map(order.slice(0, MAX_URLS).map((u) => [u, byUrl.get(u)!])),
    outOfSample: order.slice(MAX_URLS).flatMap((u) => byUrl.get(u)!),
  };
}

export type VerifyDeps = { fetchImpl?: typeof fetch; hosts?: Set<string>; sleep?: (ms: number) => Promise<void> };

/** Reads the sampled pages and checks their values. Blocks on missing, other version, broken or rejected. */
export async function verify(changes: Changes, deps: VerifyDeps = {}): Promise<Verification> {
  const { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = deps;
  const { urls, outOfSample } = sample(changes.items);
  const hosts = urls.size ? (deps.hosts ?? registeredHosts()) : new Set<string>();
  const seen = new Set<string>();
  const results: UrlResult[] = [];
  for (const [url, items] of urls) {
    if (url === IDAE_PAGE) {
      // ponytail: IDAE answers a POST query (fetch-idae.ts), so its page never holds the values; re-running the query is the upgrade.
      results.push({ url, kind: "unchecked", why: "datos de una consulta de fetch-idae.ts, no están en la página", chars: 0, items, findings: [] });
      continue;
    }
    let host = "";
    try {
      host = new URL(url).host;
    } catch {
      results.push({ url, kind: "rejected", why: "no es una URL", chars: 0, items, findings: [] });
      continue;
    }
    // ponytail: the gap is between pages of a host; readPage asks robots.txt and the page back to back.
    if (seen.has(host)) await sleep(HOST_GAP_MS);
    seen.add(host);
    let page: { status: number; text: string };
    try {
      page = await readPage(url, fetchImpl, hosts);
    } catch (e) {
      const why = (e as Error).message;
      if (e instanceof Refused) results.push({ url, kind: e.kind === "rejected" ? "rejected" : "unchecked", why, chars: 0, items, findings: [] });
      else {
        const v = classify(e as Error);
        results.push({ url, kind: v.kind === "broken" ? "broken" : "unchecked", why: v.kind === "ok" ? why : v.why, chars: 0, items, findings: [] });
      }
      continue;
    }
    const v = classify(page);
    if (v.kind !== "ok") {
      results.push({ url, kind: v.kind, why: v.why, chars: 0, items, findings: [] });
      continue;
    }
    const lines = page.text.split("\n");
    results.push({ url, kind: "read", why: `HTTP ${page.status}`, chars: page.text.length, items, findings: items.map((it) => check(it, lines)) });
  }
  const blocking = results.some((r) => r.kind === "broken" || r.kind === "rejected" ||
    r.findings.some((f) => f.status === "missing" || f.status === "other"));
  return { blocking, urls: results, outOfSample, unverifiable: changes.unverifiable };
}

/** The counts that go to the merge comment and to the `verify` field of ops/merges/ (point 12). */
export function summary(v: Verification) {
  const findings = v.urls.flatMap((r) => r.findings);
  const count = (s: Status) => findings.filter((f) => f.status === s).length;
  return {
    urls: v.urls.filter((r) => r.kind === "read").length,
    found: count("found"),
    unanchored: count("unanchored"),
    no_unit: count("no_unit"),
    unchecked: v.urls.filter((r) => r.kind === "unchecked").length,
    out_of_sample: v.outOfSample.length,
    unverifiable: v.unverifiable.length,
  };
}

const where = (it: Item) => `\`${it.file}\` \`${it.path}\` = ${it.kind === "terms" ? quote(String(it.value)) : `\`${it.value}\``}`;

/** The comment of a PR that the verifier sends to a person (ADR-0020, «Qué deja»). */
export function report(v: Verification): string {
  const out: string[] = ["**Verificador de datos (RF-8, ADR-0020)**", ""];
  for (const r of v.urls) {
    if (r.kind === "broken" || r.kind === "rejected") {
      out.push(`- ${r.url} — ${r.kind === "broken" ? "rota" : "rechazada por las reglas de fetch-page.ts"} (${r.why}). Valores que la citan:`);
      for (const it of r.items) out.push(`  - ${where(it)}`);
    }
    for (const f of r.findings) {
      if (f.status === "other") {
        out.push(`- No coincide (otra versión): ${where(f.item)} en ${r.url} (${r.why}).`, ...f.detail.map((d) => `  - ${d}`));
      } else if (f.status === "missing") {
        out.push(`- No coincide: ${where(f.item)} no está en ${r.url} (${r.why}, ${r.chars} caracteres de texto; ${JS_HINT}).`);
        if (f.item.kind === "number") out.push(`  - Párrafos más parecidos: ${f.detail.join(" · ")}`);
      }
    }
  }
  const rest: [string, string[]][] = [
    ["No comprobables", v.urls.filter((r) => r.kind === "unchecked").map((r) => `${r.url} (${r.why})`)],
    ["Encontrados sin versión", v.urls.flatMap((r) => r.findings.filter((f) => f.status === "unanchored").map((f) => `${where(f.item)} en ${r.url}`))],
    ["Sin unidad", v.urls.flatMap((r) => r.findings.filter((f) => f.status === "no_unit").map((f) => `${where(f.item)} en ${r.url}`))],
    ["No verificables por código", v.unverifiable.map((u) => `\`${u.file}\` \`${u.path}\` = \`${u.value}\``)],
    ["Fuera de la muestra", v.outOfSample.map((it) => `${where(it)} en ${it.url}`)],
  ];
  for (const [title, rows] of rest) if (rows.length) out.push("", `${title} (${rows.length}):`, ...rows.map((r) => `- ${r}`));
  return out.join("\n");
}
