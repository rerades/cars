/**
 * Weekly check of every URL that data/ cites (PRD-007 RF-11, CA-15). No model, writes nothing.
 * Run by the weekly workflow: node factory/check-urls.ts > report.md
 *   - broken: 404 or 410, or the host does not resolve, after one retry.
 *   - not checkable: 401, 403, 429, 5xx, timeout, any other error, or robots.txt disallows it.
 * Same agent and robots.txt rules as fetch-page.ts; at most one request per second per host.
 * Prints a Markdown issue body whose first line is `<!-- fuentes-rotas: broken=N ... -->`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "yaml";
import { robotsAllows, USER_AGENT } from "./fetch-page.ts";

const ROOT = join(import.meta.dirname, "..");
const DIRS = [join(ROOT, "data/raw"), join(ROOT, "data/sources")];
const TIMEOUT_MS = 20_000;
const HOST_GAP_MS = 1_000;
const PARALLEL_HOSTS = 8;
const MAX_LIST = 300; // keeps the issue body under GitHub's 65,536 characters

export type Verdict = { kind: "ok" } | { kind: "broken" | "unchecked"; why: string };

/** Every string value of the YAML files that is a whole http(s) URL, with the files that cite it. */
export function collectUrls(dirs = DIRS, root = ROOT): Map<string, string[]> {
  const found = new Map<string, Set<string>>();
  const walk = (v: unknown, file: string) => {
    if (typeof v === "string") {
      if (/^https?:\/\/\S+$/.test(v)) (found.get(v) ?? found.set(v, new Set()).get(v)!).add(file);
    } else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x, file);
  };
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".yaml") ? [join(dir, e.name)] : []);
  for (const dir of dirs) for (const f of files(dir)) walk(parse(readFileSync(f, "utf8")), relative(root, f));
  return new Map([...found].map(([u, s]) => [u, [...s].sort()]));
}

/** What one answer means. Only 404, 410 and an unknown host count as broken (RF-11). */
export function classify(res: { status: number } | Error): Verdict {
  if (res instanceof Error) {
    const code = (res.cause as { code?: string } | undefined)?.code;
    if (code === "ENOTFOUND") return { kind: "broken", why: "el host no resuelve" };
    return { kind: "unchecked", why: res.name === "TimeoutError" ? "tiempo agotado" : `error: ${code ?? res.message}` };
  }
  if (res.status === 404 || res.status === 410) return { kind: "broken", why: `HTTP ${res.status}` };
  if (res.status < 400) return { kind: "ok" };
  return { kind: "unchecked", why: `HTTP ${res.status}` };
}

type Deps = { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> };

/** Checks the URLs of one host one after another, a second apart, honouring its robots.txt. */
async function checkHost(urls: string[], { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }: Deps) {
  const headers = { "User-Agent": USER_AGENT };
  const get = async (url: string | URL) => {
    try {
      const res = await fetchImpl(url, { headers, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
      return res;
    } catch (e) {
      return e as Error;
    }
  };
  let robots = "";
  const r = await get(new URL("/robots.txt", urls[0]));
  if (!(r instanceof Error) && r.ok) robots = await r.text();
  else if (!(r instanceof Error)) await r.body?.cancel();
  const out = new Map<string, Verdict>();
  for (const url of urls) {
    const u = new URL(url);
    if (!robotsAllows(robots, u.pathname + u.search)) {
      out.set(url, { kind: "unchecked", why: "robots.txt no lo permite" });
      continue;
    }
    let verdict: Verdict = { kind: "ok" };
    for (let attempt = 0; attempt < 2; attempt++) {
      await sleep(HOST_GAP_MS);
      const res = await get(url);
      if (!(res instanceof Error)) await res.body?.cancel();
      verdict = classify(res);
      if (verdict.kind !== "broken") break; // only a broken answer earns the retry
    }
    out.set(url, verdict);
  }
  return out;
}

export async function checkAll(urls: Iterable<string>, deps: Deps = {}): Promise<Map<string, Verdict>> {
  const byHost = new Map<string, string[]>();
  for (const u of urls) {
    const host = new URL(u).host;
    (byHost.get(host) ?? byHost.set(host, []).get(host)!).push(u);
  }
  const queue = [...byHost.values()];
  const all = new Map<string, Verdict>();
  const worker = async () => {
    for (let group = queue.shift(); group; group = queue.shift()) for (const [u, v] of await checkHost(group, deps)) all.set(u, v);
  };
  await Promise.all(Array.from({ length: PARALLEL_HOSTS }, worker));
  return all;
}

/** The issue body: broken URLs with the files that cite them, then the ones that could not be checked. */
export function report(verdicts: Map<string, Verdict>, cited: Map<string, string[]>, today = new Date()): string {
  const of = (kind: string) => [...verdicts].filter(([, v]) => v.kind === kind).sort(([a], [b]) => a.localeCompare(b)) as [string, { why: string }][];
  const broken = of("broken");
  const unchecked = of("unchecked");
  const line = ([u, v]: [string, { why: string }]) => `- ${u} — ${v.why} — ${(cited.get(u) ?? []).map((f) => `\`${f}\``).join(", ")}`;
  const list = (rows: [string, { why: string }][]) =>
    rows.slice(0, MAX_LIST).map(line).concat(rows.length > MAX_LIST ? [`- … y ${rows.length - MAX_LIST} más`] : []);
  return [
    `<!-- fuentes-rotas: broken=${broken.length} unchecked=${unchecked.length} checked=${verdicts.size} -->`,
    `Comprobación semanal de las URL de \`data/\` (PRD-007 RF-11), ${today.toISOString().slice(0, 10)}: ` +
      `${verdicts.size} URL, ${broken.length} rotas y ${unchecked.length} sin comprobar.`,
    "",
    `## Rotas (${broken.length})`,
    ...(broken.length ? list(broken) : ["Ninguna."]),
    "",
    `<details><summary>No comprobables (${unchecked.length}): bloqueo de bots, caída pasajera o robots.txt</summary>`,
    "",
    ...list(unchecked),
    "",
    "</details>",
  ].join("\n");
}

if (import.meta.main) {
  const cited = collectUrls();
  console.log(report(await checkAll(cited.keys()), cited));
}
