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

/** Every source id in the worktree, changed or not. A file that cannot be read adds none. */
function sourceIds(ctx: Ctx): Set<string> {
  const dir = join(ctx.dir, SOURCES);
  if (!existsSync(dir)) return new Set();
  const ids = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => {
    try {
      return parse(readFileSync(join(dir, f), "utf8"))?.id;
    } catch {
      return undefined; // the registry check reports it if the file changed
    }
  });
  return new Set(ids.filter((id): id is string => typeof id === "string"));
}

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
  "images", "open_questions"];
const MODEL_REQUIRED = ["brand", "brand_name", "model", "status", "needs_review", "versions", "images"];
const VERSION = ["name", "battery_kwh", "wltp_km", "power_kw", "drivetrain", "dc_max_kw", "ac_max_kw", "price"];
const SPECS = ["wltp_max_km", "power_max_kw", "dc_max_kw", "ac_max_kw", "battery_kwh_options", "drivetrains"];
const IMAGE = ["file", "source_url", "page_url", "source_id", "retrieved", "license", "attribution"];
/** ADR-0010, point 14: the pre-ADR-0012 key, accepted only until the migration; it fails here, in the factory eval. */
const OLD_IMAGE_KEY = "url";
/** Marks the old-shape failure, which validateData turns into a warning (ADR-0010, point 14.1). */
const OLD_SHAPE = "old shape (url)";

const positive = (v: unknown) => typeof v === "number" && v > 0;
const positiveInt = (v: unknown) => Number.isInteger(v) && (v as number) > 0;
const oneOf = (list: string[]) => (v: unknown) => list.includes(v as string);
const listOf = (ok: (v: unknown) => boolean) => (v: unknown) => Array.isArray(v) && v.length > 0 && v.every(ok);

/** ADR-0008: every data/raw file has the one shape data-model.md defines. */
const rawShape: Check = (ctx) => {
  const files = ctx.files.filter((f) => f.startsWith("data/raw/") && /\.ya?ml$/.test(f));
  if (!files.length) return [];
  const ids = sourceIds(ctx);
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
      sourced(p, `${at}.price`, positive, ["unit", "price_kind", "price_terms", "price_terms_url"]);
      if (!obj(p)) return;
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
