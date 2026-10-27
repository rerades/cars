/**
 * Reads one page of a registered source and prints its text literally, so the Researcher can copy
 * fine print (price_terms) word for word. WebFetch hands back a model's summary, never the literal text.
 * Run by the Researcher: node factory/fetch-page.ts <url> [keyword ...]
 *   - With keywords: the paragraphs that contain any of them (case-insensitive), plus the next one.
 *   - Without: the whole page text, cut at MAX_TEXT characters.
 * Only hosts listed in the urls of a data/sources/*.yaml file, and only what robots.txt allows
 * (ADR-0001). Text rendered by scripts (configurators) is not in the HTML and will not show up.
 * Prints one JSON object and writes nothing. On failure it prints the cause and exits 1.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export const USER_AGENT = `siete3-factory/1.0 (https://siete3.com) node/${process.versions.node}`;
const SOURCES_DIR = join(import.meta.dirname, "../data/sources");
export const MAX_TEXT = 60_000;
const MAX_PARAGRAPH = 4_000;
const MAX_MATCHES = 30;
const TIMEOUT_MS = 20_000;

/** Hostnames of every url in data/sources/*.yaml, without "www.". */
export function registeredHosts(dir = SOURCES_DIR): Set<string> {
  const hosts = new Set<string>();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
    const urls = parse(readFileSync(join(dir, f), "utf8"))?.urls ?? {};
    for (const u of Object.values(urls)) {
      try { hosts.add(new URL(String(u)).hostname.replace(/^www\./, "")); } catch { /* not a url */ }
    }
  }
  return hosts;
}

/** A host is allowed if it is a registered host or a subdomain of one (micra.nissan.es → nissan.es). */
export const hostAllowed = (host: string, hosts: Set<string>) => {
  const h = host.replace(/^www\./, "");
  return [...hosts].some((r) => h === r || h.endsWith(`.${r}`));
};

/**
 * robots.txt check (RFC 9309): the group naming our agent, else "*"; longest matching rule wins,
 * Allow wins a tie. Supports "*" and "$" in paths.
 */
export function robotsAllows(robots: string, path: string, agent = "siete3-factory"): boolean {
  const groups: { agents: string[]; rules: [boolean, string][] }[] = [];
  let current: (typeof groups)[number] | undefined;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [key, value] = [m[1].toLowerCase(), m[2].trim()];
    if (key === "user-agent") {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current!.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      if (value) current.rules.push([key === "allow", value]);
      lastWasAgent = false;
    } else lastWasAgent = false;
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.toLowerCase().includes(a)));
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules);
  let best: [boolean, string] | undefined;
  for (const rule of rules) {
    const re = new RegExp("^" + rule[1].replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"));
    if (!re.test(path)) continue;
    if (!best || rule[1].length > best[1].length || (rule[1].length === best[1].length && rule[0])) best = rule;
  }
  return best ? best[0] : true;
}

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", euro: "€", ordm: "º", ordf: "ª",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
  iexcl: "¡", iquest: "¿", laquo: "«", raquo: "»", middot: "·", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", copy: "©", reg: "®", trade: "™", sup1: "¹", sup2: "²", sup3: "³",
};

const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d?);/gi, (all, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? all);

/** Visible text of an HTML page, one paragraph per line. */
export function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi, "")
      .replace(/<\/?(p|div|br|li|ul|ol|h[1-6]|tr|table|section|article|header|footer|aside|nav|main|dt|dd|blockquote)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Paragraphs containing any keyword, each followed by the next paragraph (notes often run on). */
export function excerpts(text: string, keywords: string[]): string[] {
  const lines = text.split("\n");
  const wanted = keywords.map((k) => k.toLowerCase());
  const picked = new Set<number>();
  lines.forEach((l, i) => {
    if (wanted.some((k) => l.toLowerCase().includes(k))) picked.add(i).add(i + 1);
  });
  return [...picked].filter((i) => i < lines.length).sort((a, b) => a - b).slice(0, MAX_MATCHES)
    .map((i) => lines[i].slice(0, MAX_PARAGRAPH));
}

/** Why a page is not read: outside the source registry (ADR-0001) or kept out by robots.txt. */
export class Refused extends Error {
  kind: "rejected" | "robots";
  constructor(message: string, kind: "rejected" | "robots") {
    super(message);
    this.kind = kind;
  }
}

/**
 * The status and full visible text of a page of a registered source, read under robots.txt. Throws
 * Refused when the rules forbid reading it, or the fetch error when there is no answer. Shared by
 * fetchPage (the Researcher) and the data verifier (ADR-0020), so both see the same text.
 */
export async function readPage(url: string, fetchImpl: typeof fetch = fetch, hosts = registeredHosts()) {
  const target = new URL(url);
  if (target.protocol !== "https:") throw new Refused("only https URLs", "rejected");
  if (!hostAllowed(target.hostname, hosts)) throw new Refused(`${target.hostname} is not in any data/sources/*.yaml`, "rejected");
  const init = () => ({ headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });

  const robots = await fetchImpl(new URL("/robots.txt", target), init());
  if (robots.status >= 500) throw new Refused(`robots.txt answered HTTP ${robots.status}: not reading the page`, "robots");
  if (robots.ok && !robotsAllows(await robots.text(), target.pathname + target.search)) {
    throw new Refused(`robots.txt of ${target.hostname} disallows ${target.pathname}`, "robots");
  }

  const res = await fetchImpl(target, init());
  if (!res.ok) {
    await res.body?.cancel();
    return { status: res.status, finalUrl: res.url || url, text: "" };
  }
  const finalUrl = res.url || url;
  if (!hostAllowed(new URL(finalUrl).hostname, hosts)) throw new Refused(`redirected to ${finalUrl}, not a registered source`, "rejected");
  return { status: res.status, finalUrl, text: htmlToText(await res.text()) };
}

export async function fetchPage(url: string, keywords: string[], fetchImpl: typeof fetch = fetch, hosts = registeredHosts(), today = new Date()) {
  const { status, finalUrl, text } = await readPage(url, fetchImpl, hosts);
  if (status < 200 || status > 299) throw new Error(`HTTP ${status} for ${url}`);
  const base = { url, final_url: finalUrl, retrieved: today.toISOString().slice(0, 10), chars: text.length };
  if (keywords.length) return { ...base, keywords, paragraphs: excerpts(text, keywords) };
  return { ...base, truncated: text.length > MAX_TEXT, text: text.slice(0, MAX_TEXT) };
}

if (import.meta.main) {
  const [url, ...keywords] = process.argv.slice(2);
  if (!url) {
    console.error("uso: node factory/fetch-page.ts <url> [palabra ...]   (p. ej. «PVP» «oferta válida»)");
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(await fetchPage(url, keywords), null, 1));
  } catch (e) {
    console.error(`lectura fallida: ${(e as Error).message}`);
    process.exit(1);
  }
}
