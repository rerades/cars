/**
 * Deterministic evals run on what an agent wrote, before its branch is committed.
 * See docs/architecture/adr/0004-trazas-y-evals.md. Each check returns its failures.
 * validateData runs the same checks over all of data/ for the CI (ADR-0010).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { parse } from "yaml";
import { imageProblem } from "./fetch-image.ts";
import { norm } from "./verify-data.ts";

export interface EvalResult {
  passed: number;
  failed: string[];
}

interface Ctx {
  dir: string;
  files: string[];
  writePaths: string[];
  today: string; // YYYY-MM-DD
}

type Check = (ctx: Ctx) => string[];

/** One file per source, data/sources/<id>.yaml (data-model.md, section 8). */
const SOURCES = "data/sources";
const isSource = (f: string) => /^data\/sources\/[^/]+\.ya?ml$/.test(f);

/** Every source in the worktree by id, changed or not. A file that cannot be read adds none. */
function sources(ctx: Ctx): Map<string, Record<string, any>> {
  const dir = join(ctx.dir, SOURCES);
  const out = new Map<string, Record<string, any>>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    try {
      const s = parse(readFileSync(join(dir, f), "utf8"));
      if (typeof s?.id === "string") out.set(s.id, s);
    } catch {
      // the registry check reports it if the file changed
    }
  }
  return out;
}

const sourceIds = (ctx: Ctx) => new Set(sources(ctx).keys());

/** ADR-0017: a source with one of these kinds also needs name, terms_url and terms_checked. */
const LINK_KINDS = ["reviews", "tests"];
const isHttps = (v: unknown) => typeof v === "string" && /^https:\/\/[^\s/]+/.test(v);
const hostOf = (v: unknown) => {
  try {
    return new URL(String(v)).hostname;
  } catch {
    return undefined;
  }
};

/** Modified and new files in the worktree (deletions need no eval). */
export function changedFiles(dir: string): string[] {
  return execFileSync("git", ["ls-files", "-mo", "--exclude-standard"], { cwd: dir, encoding: "utf8" })
    .split("\n").filter(Boolean);
}

const isDay = (v: unknown, today: string) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && v <= today;

function readYaml(ctx: Ctx, file: string): { data?: any; error?: string } {
  try {
    return { data: parse(readFileSync(join(ctx.dir, file), "utf8")) };
  } catch (e) {
    return { error: `${file}: invalid YAML (${(e as Error).message.split("\n")[0]})` };
  }
}

/** The guard hook should already block this; the eval catches it if the hook ever fails. */
const writePaths: Check = (ctx) =>
  ctx.files
    .filter((f) => !ctx.writePaths.some((p) => f.startsWith(p)))
    .map((f) => `write_paths: ${f} is outside ${JSON.stringify(ctx.writePaths)}`);

/** ADR-0001: every changed source is one map whose id is its file name, with a tier, URLs and a real date. */
const registry: Check = (ctx) =>
  ctx.files.filter(isSource).flatMap((file) => {
    const { data: s, error } = readYaml(ctx, file);
    if (error) return [error];
    if (!s || typeof s !== "object" || Array.isArray(s)) return [`${file}: must be a map with one source`];
    const out: string[] = [];
    const name = file.slice(SOURCES.length + 1).replace(/\.ya?ml$/, "");
    if (s.id !== name) out.push(`${file}: id must be "${name}", the file name`);
    if (!["T1", "T2", "T3"].includes(s.tier)) out.push(`${file}: tier must be T1, T2 or T3`);
    if (!s.urls || !Object.keys(s.urls).length) out.push(`${file}: missing urls`);
    if (!isDay(s.last_verified, ctx.today)) out.push(`${file}: last_verified must be a past date`);
    if (Array.isArray(s.kind) && s.kind.some((k: unknown) => LINK_KINDS.includes(k as string))) {
      if (typeof s.name !== "string" || !s.name.trim()) out.push(`${file}: kind reviews or tests needs name`);
      if (!isHttps(s.terms_url)) out.push(`${file}: kind reviews or tests needs terms_url, an https URL`);
      if (!("terms_checked" in s)) out.push(`${file}: kind reviews or tests needs terms_checked`);
    }
    if ("terms_checked" in s && !isDay(s.terms_checked, ctx.today)) out.push(`${file}: terms_checked must be a past date`);
    return out;
  });

/** ADR-0001 rule 2: every value carries source_id (from the registry), url, retrieved and tier. */
const rawData: Check = (ctx) => {
  const files = ctx.files.filter((f) => f.startsWith("data/raw/") && /\.ya?ml$/.test(f));
  if (!files.length) return [];
  const ids = sourceIds(ctx);
  return files.flatMap((file) => {
    const { data, error } = readYaml(ctx, file);
    if (error) return [error];
    const out: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`));
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if ("value" in o) {
        const at = `${file}: ${path || "."}`;
        for (const k of ["source_id", "url", "retrieved", "tier"]) if (!o[k]) out.push(`${at}: missing ${k}`);
        if (o.source_id && !ids.has(String(o.source_id))) out.push(`${at}: source_id ${o.source_id} is not in the registry`);
        if (o.retrieved && !isDay(o.retrieved, ctx.today)) out.push(`${at}: retrieved must be a past date`);
      }
      for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k);
    };
    walk(data, "");
    return out;
  });
};

// ADR-0008 schema, as written in docs/architecture/data-model.md. Change that document first.
const SEGMENTS = ["urbano", "compacto", "berlina", "familiar", "suv_pequeno", "suv_compacto", "suv_grande",
  "monovolumen", "furgoneta", "deportivo"];
const STATUSES = ["on_sale", "announced", "discontinued"];
const DRIVES = ["fwd", "rwd", "awd"];
const SOURCED = ["value", "source_id", "url", "retrieved", "tier", "note"];
const MODEL = ["brand", "brand_name", "model", "status", "launch", "segment", "needs_review", "specs", "versions",
  "images", "reviews", "test_results", "open_questions"];
const MODEL_REQUIRED = ["brand", "brand_name", "model", "status", "needs_review", "versions", "images"];
const VERSION = ["name", "battery_kwh", "wltp_km", "power_kw", "drivetrain", "dc_max_kw", "ac_max_kw", "price"];
const SPECS = ["wltp_max_km", "power_max_kw", "dc_max_kw", "ac_max_kw", "battery_kwh_options", "drivetrains"];
const IMAGE = ["file", "source_url", "page_url", "source_id", "retrieved", "license", "attribution"];
/** ADR-0010, point 14: the pre-ADR-0012 key, accepted only until the migration; it fails here, in the factory eval. */
const OLD_IMAGE_KEY = "url";
/** Marks the old-shape failure, which validateData turns into a warning (ADR-0010, point 14.1). */
const OLD_SHAPE = "old shape (url)";
/** ADR-0017: a link to a third-party review (not a Sourced: it has no value). */
const REVIEW = ["title", "url", "source_id", "retrieved", "tier", "version"];
/** ADR-0017: what a test result adds to a Sourced. */
const TEST_RESULT = ["test", "metric", "version"];
/**
 * ADR-0017: the closed list of test metrics of data-model.md, name -> check of `value`. Empty until
 * a person adds the first one, so any test result fails until then.
 */
const METRICS: Record<string, (v: unknown) => boolean> = {};

const positive = (v: unknown) => typeof v === "number" && v > 0;
const positiveInt = (v: unknown) => Number.isInteger(v) && (v as number) > 0;
const oneOf = (list: string[]) => (v: unknown) => list.includes(v as string);
const listOf = (ok: (v: unknown) => boolean) => (v: unknown) => Array.isArray(v) && v.length > 0 && v.every(ok);

/** ADR-0008: every data/raw file has the one shape data-model.md defines. */
const rawShape: Check = (ctx) => {
  const files = ctx.files.filter((f) => f.startsWith("data/raw/") && /\.ya?ml$/.test(f));
  if (!files.length) return [];
  const srcs = sources(ctx);
  const ids = new Set(srcs.keys());
  return files.flatMap((file) => {
    const { data, error } = readYaml(ctx, file);
    if (error) return [];  // rawData already reports it
    const out: string[] = [];
    const fail = (msg: string) => out.push(`${file}: ${msg}`);
    const obj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
    const keys = (o: Record<string, any>, allowed: string[], at: string) => {
      for (const k of Object.keys(o)) if (!allowed.includes(k)) fail(`${at}${k}: unknown key`);
    };
    /** A Sourced value; its source fields are rawData's job, here only keys and the value. */
    const sourced = (v: unknown, at: string, ok: (x: unknown) => boolean, extra: string[] = []) => {
      if (v === undefined || v === null) return;
      if (!obj(v) || !("value" in v)) return fail(`${at}: must be a sourced value`);
      keys(v, [...SOURCED, ...extra], `${at}.`);
      if (!ok(v.value)) fail(`${at}: invalid value ${JSON.stringify(v.value)}`);
    };

    const parts = file.split("/");
    if (parts.length !== 4) fail("path must be data/raw/<brand>/<model>.yaml");
    if (!obj(data)) return [...out, `${file}: must be a map`];
    keys(data, MODEL, "");
    for (const k of MODEL_REQUIRED) if (!(k in data)) fail(`${k}: missing`);
    if (data.brand !== parts[2]) fail(`brand must be the folder name (${parts[2]})`);

    sourced(data.status, "status", oneOf(STATUSES));
    if (data.status === null) fail("status: missing");
    sourced(data.launch, "launch", (v) => typeof v === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(v));
    sourced(data.segment, "segment", oneOf(SEGMENTS));
    if (typeof data.needs_review !== "boolean") fail("needs_review: must be true or false");

    if (obj(data.specs)) {
      keys(data.specs, SPECS, "specs.");
      for (const k of ["wltp_max_km"]) sourced(data.specs[k], `specs.${k}`, positiveInt);
      for (const k of ["power_max_kw", "dc_max_kw", "ac_max_kw"]) sourced(data.specs[k], `specs.${k}`, positive);
      sourced(data.specs.battery_kwh_options, "specs.battery_kwh_options", listOf(positive));
      sourced(data.specs.drivetrains, "specs.drivetrains", listOf(oneOf(DRIVES)));
    } else if (data.specs != null) fail("specs: must be a map");

    const versions = Array.isArray(data.versions) ? data.versions : [];
    if (data.versions !== undefined && !Array.isArray(data.versions)) fail("versions: must be a list");
    if (data.status?.value === "on_sale" && !versions.length) fail("versions: on_sale needs at least one");
    const names = new Set<string>();
    versions.forEach((v: unknown, i: number) => {
      const at = `versions[${i}]`;
      if (!obj(v)) return fail(`${at}: must be a map`);
      keys(v, VERSION, `${at}.`);
      if (!v.name) fail(`${at}.name: missing`);
      else if (names.has(v.name)) fail(`${at}.name: repeated (${v.name})`);
      names.add(v.name);
      sourced(v.battery_kwh, `${at}.battery_kwh`, positive, ["basis"]);
      if (obj(v.battery_kwh) && !["usable", "gross", "unknown"].includes(v.battery_kwh.basis)) {
        fail(`${at}.battery_kwh.basis: must be usable, gross or unknown`);
      }
      sourced(v.wltp_km, `${at}.wltp_km`, positiveInt);
      for (const k of ["power_kw", "dc_max_kw", "ac_max_kw"]) sourced(v[k], `${at}.${k}`, positive);
      sourced(v.drivetrain, `${at}.drivetrain`, oneOf(DRIVES));
      if (!("price" in v)) return fail(`${at}.price: missing (write null if there is none)`);
      const p = v.price;
      sourced(p, `${at}.price`, positive, ["unit", "price_kind", "price_terms", "price_terms_url", "page_name"]);
      if (!obj(p)) return;
      if ("page_name" in p && (typeof p.page_name !== "string" || !norm(p.page_name) || norm(p.page_name) === norm(String(v.name)))) {
        fail(`${at}.price.page_name: must be text other than the version name`);
      }
      if (p.unit !== "EUR") fail(`${at}.price.unit: must be EUR`);
      if (p.tier !== "T1") fail(`${at}.price.tier: must be T1`);
      if (p.price_kind === "financed") {
        if (!p.price_terms || !p.price_terms_url) fail(`${at}.price: financed needs price_terms and price_terms_url`);
      } else if (p.price_kind === "pvp") {
        if ("price_terms" in p || "price_terms_url" in p) fail(`${at}.price: pvp must not have price_terms`);
      } else fail(`${at}.price.price_kind: must be pvp or financed`);
    });

    const wltp = versions.map((v: any) => v?.wltp_km?.value).filter(positiveInt);
    const specMax = data.specs?.wltp_max_km?.value;
    if (wltp.length && specMax !== undefined && specMax !== Math.max(...wltp)) {
      fail(`specs.wltp_max_km (${specMax}) must match the versions' maximum (${Math.max(...wltp)})`);
    }

    if (!Array.isArray(data.images)) fail("images: must be a list");
    else data.images.forEach((img: unknown, i: number) => {
      const at = `images[${i}]`;
      if (!obj(img)) return fail(`${at}: must be a map`);
      keys(img, [...IMAGE, OLD_IMAGE_KEY], `${at}.`);
      if (OLD_IMAGE_KEY in img) {
        if (["file", "source_url", "page_url"].some((k) => k in img)) return fail(`${at}: url cannot be mixed with file, source_url and page_url`);
        return fail(`${at}: ${OLD_SHAPE}; download it with factory/fetch-image.ts and write file, source_url and page_url (ADR-0010, point 13)`);
      }
      for (const k of ["file", "source_url", "page_url", "source_id", "retrieved", "license"]) if (!img[k]) fail(`${at}.${k}: missing`);
      if (!("attribution" in img)) fail(`${at}.attribution: missing (write null if the license asks for none)`);
      if (img.file) {
        const dir = `data/images/${parts[2]}/${parts[3]?.replace(/\.ya?ml$/, "")}/`;
        const path = join(ctx.dir, String(img.file));
        if (!String(img.file).startsWith(dir) || !/^[a-z0-9-]+\.(jpe?g|png)$/.test(String(img.file).slice(dir.length))) {
          fail(`${at}.file: must be ${dir}<name>.jpg|png, name in [a-z0-9-]`);
        } else if (!existsSync(path)) fail(`${at}.file: ${img.file} does not exist`);
        else {
          const problem = imageProblem(readFileSync(path), String(img.file));
          if (problem) fail(`${at}.file: ${problem}`);
        }
      }
      if (img.source_id && !ids.has(img.source_id)) fail(`${at}: source_id ${img.source_id} is not in the registry`);
      if (img.retrieved && !isDay(img.retrieved, ctx.today)) fail(`${at}.retrieved: must be a past date`);
    });

    // ADR-0017: links to reviews and test results, each from a registered source of its kind
    const list = (key: string): unknown[] => {
      if (data[key] === undefined) return [];
      if (Array.isArray(data[key])) return data[key];
      fail(`${key}: must be a list`);
      return [];
    };
    /** What both lists check against the registry: kind, presentation keys, tier and the URL's host. */
    const cited = (e: Record<string, any>, at: string, kind: string, tiers: string[]) => {
      // A missing tier or url is already reported, by the list or by rawData.
      if (e.tier && !tiers.includes(e.tier)) fail(`${at}.tier: must be ${tiers.join(" or ")}`);
      if (e.url && !isHttps(e.url)) fail(`${at}.url: must be an https URL`);
      const src = srcs.get(e.source_id);
      if (!src) return; // reported as not in the registry
      if (!Array.isArray(src.kind) || !src.kind.includes(kind)) fail(`${at}: source ${e.source_id} needs kind ${kind}`);
      if (!src.name || !src.terms_url || !src.terms_checked) {
        fail(`${at}: source ${e.source_id} needs name, terms_url and terms_checked`);
      }
      if (e.tier && e.tier !== src.tier) fail(`${at}.tier: must be the source's (${src.tier})`);
      // A medium's link points to that medium (RF-5): its host is one of the source's, or a subdomain.
      const host = hostOf(e.url);
      const bases = Object.values(src.urls ?? {}).flat().map((u) => hostOf(u)?.replace(/^www\./, ""));
      if (host && !bases.some((b) => b && (host === b || host.endsWith(`.${b}`)))) {
        fail(`${at}.url: host ${host} is not one of the source's urls`);
      }
      if ("version" in e && !names.has(e.version)) fail(`${at}.version: ${e.version} is not a version of this file`);
    };

    const urls = new Set<string>();
    list("reviews").forEach((e, i) => {
      const at = `reviews[${i}]`;
      if (!obj(e)) return fail(`${at}: must be a map`);
      keys(e, REVIEW, `${at}.`);
      for (const k of ["title", "url", "source_id", "retrieved", "tier"]) if (!e[k]) fail(`${at}.${k}: missing`);
      if (e.retrieved && !isDay(e.retrieved, ctx.today)) fail(`${at}.retrieved: must be a past date`);
      if (e.source_id && !ids.has(e.source_id)) fail(`${at}: source_id ${e.source_id} is not in the registry`);
      cited(e, at, "reviews", ["T2", "T3"]);
      if (urls.has(e.url)) fail(`${at}.url: repeated (${e.url})`);
      urls.add(e.url);
    });

    const tests = new Set<string>();
    list("test_results").forEach((e, i) => {
      const at = `test_results[${i}]`;
      if (!obj(e)) return fail(`${at}: must be a map`);
      // Source fields and dates are rawData's job, as for any Sourced value.
      sourced(e, at, (v) => !(e.metric in METRICS) || METRICS[e.metric](v), TEST_RESULT);
      for (const k of ["test", "metric"]) if (!e[k]) fail(`${at}.${k}: missing`);
      if (e.metric && !(e.metric in METRICS)) fail(`${at}.metric: ${e.metric} is not in the list of data-model.md`);
      cited(e, at, "tests", ["T2"]);
      const key = JSON.stringify([e.source_id, e.test, e.metric, e.version ?? null]);
      if (tests.has(key)) fail(`${at}: repeated (same source_id, test, metric and version)`);
      tests.add(key);
    });

    // brand_name must match the other files of the brand, changed or not
    const folder = join(ctx.dir, "data", "raw", parts[2]);
    for (const other of existsSync(folder) ? readdirSync(folder) : []) {
      const rel = `data/raw/${parts[2]}/${other}`;
      if (rel === file || !/\.ya?ml$/.test(other)) continue;
      const name = readYaml(ctx, rel).data?.brand_name;
      if (name !== undefined && name !== data.brand_name) {
        fail(`brand_name "${data.brand_name}" differs from ${other} ("${name}")`);
        break;
      }
    }
    return out;
  });
};

const CHECKS: Record<string, Check[]> = {
  researcher: [registry, rawData, rawShape],
};

export function runEvals(agent: string, dir: string, files: string[], paths: string[], today: string): EvalResult {
  const ctx = { dir, files, writePaths: paths, today };
  const results = [writePaths, ...(CHECKS[agent] ?? [])].map((check) => check(ctx));
  return { passed: results.filter((r) => !r.length).length, failed: results.flat() };
}

// --------------------------------------------------------------------------- whole-data validation

/** ADR-0010, point 5: a price or a source not re-read for longer than this only warns. */
export const STALE_DAYS = 45;
const DAY_MS = 86_400_000;

export interface DataWarning {
  file: string;
  message: string;
  /** Age warning: its brand is "overdue" for the monthly refresh. */
  stale: boolean;
}

export interface DataReport {
  checked: number;
  errors: string[];
  warnings: DataWarning[];
}

/** Repo-relative YAML files under `sub`, at any depth (rawShape reports a wrong depth). */
function yamlFiles(dir: string, sub: string): string[] {
  const root = join(dir, sub);
  if (!existsSync(root)) return [];
  return (readdirSync(root, { recursive: true }) as string[])
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => `${sub}/${f.split(sep).join("/")}`)
    .sort();
}

/** ADR-0010, point 5 (plus 14): what only warns. Never used by the factory eval to reject. */
function dataWarnings(ctx: Ctx): DataWarning[] {
  const out: DataWarning[] = [];
  const days = (d: unknown) =>
    typeof d === "string" && !isNaN(Date.parse(d)) ? (Date.parse(ctx.today) - Date.parse(d)) / DAY_MS : 0;
  const unusable = new Map<string, string>();
  for (const file of ctx.files.filter(isSource)) {
    const s = readYaml(ctx, file).data;
    if (!s || typeof s !== "object") continue;
    if (s.status === "broken" || s.status === "deprecated") unusable.set(s.id, s.status);
    if (days(s.last_verified) > STALE_DAYS) {
      out.push({ file, message: `${file}: last_verified ${s.last_verified} is older than ${STALE_DAYS} days`, stale: true });
    }
  }

  const cited = new Set<string>();
  for (const file of ctx.files.filter((f) => f.startsWith("data/raw/"))) {
    const data = readYaml(ctx, file).data;
    if (!data || typeof data !== "object") continue;
    const warn = (message: string, stale = false) => out.push({ file, message: `${file}: ${message}`, stale });
    if (data.needs_review === true) warn("needs_review is true: not published until a person clears it (RF-13)");
    (Array.isArray(data.versions) ? data.versions : []).forEach((v: any, i: number) => {
      const r = v?.price?.retrieved;
      if (days(r) > STALE_DAYS) warn(`versions[${i}].price.retrieved ${r} is older than ${STALE_DAYS} days`, true);
    });
    // ADR-0017, points 9 to 11
    for (const key of ["reviews", "test_results"]) {
      const list = Array.isArray(data[key]) ? data[key] : [];
      if (list.length && data.needs_review === true) warn(`${key}: the model has needs_review, so they are not published`);
      list.forEach((e: any, i: number) => {
        if (days(e?.retrieved) > STALE_DAYS) warn(`${key}[${i}].retrieved ${e.retrieved} is older than ${STALE_DAYS} days`, true);
        if (typeof e?.url === "string" && e.url.includes("?")) warn(`${key}[${i}].url has a query string: check it is not tracking or affiliate`);
      });
    }
    for (const img of Array.isArray(data.images) ? data.images : []) if (img?.file) cited.add(String(img.file));
    const walk = (node: unknown, path: string) => {
      if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`));
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      const status = typeof o.source_id === "string" ? unusable.get(o.source_id) : undefined;
      if (status) warn(`${path || "."}: source ${o.source_id} is ${status} in the registry`);
      for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k);
    };
    walk(data, "");
  }

  // The Researcher cannot delete files (ADR-0010, point 14): an orphan image only warns.
  const images = join(ctx.dir, "data", "images");
  if (existsSync(images)) {
    for (const f of readdirSync(images, { recursive: true }) as string[]) {
      const rel = `data/images/${f.split(sep).join("/")}`;
      if (rel.split("/").pop()!.startsWith(".") || !statSync(join(images, f)).isFile() || cited.has(rel)) continue;
      out.push({ file: rel, message: `${rel}: not cited by any data/raw file`, stale: false });
    }
  }
  return out;
}

/**
 * ADR-0010, point 1: the researcher checks over every data/raw/ file and every source, for the CI.
 * Errors make the CI red; the old image shape and the point 5 findings are warnings.
 */
export function validateData(dir: string, today: string): DataReport {
  const files = [...yamlFiles(dir, "data/raw"), ...yamlFiles(dir, SOURCES)];
  const ctx: Ctx = { dir, files, writePaths: [], today };
  const errors: string[] = [];
  const warnings: DataWarning[] = [];
  for (const f of [registry, rawData, rawShape].flatMap((check) => check(ctx))) {
    if (f.includes(`: ${OLD_SHAPE};`)) warnings.push({ file: f.slice(0, f.indexOf(":")), message: f, stale: false });
    else errors.push(f);
  }
  warnings.push(...dataWarnings(ctx));
  return { checked: files.length, errors, warnings };
}
