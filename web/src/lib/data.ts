import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";

/**
 * Loader for `data/raw/<brand>/<model>.yaml`, following docs/architecture/data-model.md (ADR-0008).
 * One schema only: no legacy shapes are accepted. A file that lacks a required model-level key is
 * reported in `errors`; an invalid optional value is dropped and reported in `warnings`, so a page
 * never renders a value without source (ADR-0001) and never breaks on one.
 */

export type Tier = "T1" | "T2" | "T3";
export type Status = "on_sale" | "announced" | "discontinued";
export type Segment =
  | "urbano"
  | "compacto"
  | "berlina"
  | "familiar"
  | "suv_pequeno"
  | "suv_compacto"
  | "suv_grande"
  | "monovolumen"
  | "furgoneta"
  | "deportivo";
export type Drivetrain = "fwd" | "rwd" | "awd";

/** A value plus where it came from (data-model.md, section 2). */
export interface Sourced<T = unknown> {
  value: T;
  note?: string;
  source_id: string;
  url: string;
  retrieved: string;
  tier: Tier;
}

export interface Price extends Sourced<number> {
  unit: "EUR";
  price_kind: "pvp" | "financed";
  /** Present only when `price_kind` is `financed`. */
  price_terms?: string;
  price_terms_url?: string;
}

export interface Battery extends Sourced<number> {
  basis: "usable" | "gross" | "unknown";
}

export interface Version {
  name: string;
  battery_kwh: Battery | null;
  wltp_km: Sourced<number> | null;
  power_kw: Sourced<number> | null;
  drivetrain: Sourced<Drivetrain> | null;
  dc_max_kw: Sourced<number> | null;
  ac_max_kw: Sourced<number> | null;
  price: Price | null;
  /** Why `price` is null when the YAML did carry one; null if valid or simply absent. */
  price_issue: string | null;
}

/** Values the source publishes for the whole model, not per version. */
export interface Specs {
  wltp_max_km?: Sourced<number>;
  power_max_kw?: Sourced<number>;
  dc_max_kw?: Sourced<number>;
  ac_max_kw?: Sourced<number>;
  battery_kwh_options?: Sourced<number[]>;
  drivetrains?: Sourced<Drivetrain[]>;
}

/** Only images with a license are kept (CA-10). */
export interface ModelImage {
  url: string;
  source_id: string;
  retrieved: string;
  license: string;
  attribution: string | null;
}

export interface ModelRecord {
  /** Slug, equal to the folder name. */
  brand: string;
  /** Presentation name (`Cupra`). */
  brand_name: string;
  model: string;
  status: Sourced<Status>;
  /** Start of sales in Spain, or the expected date if announced. */
  launch: Sourced<string> | null;
  /** Null when no source classifies the model: the card says "por confirmar". */
  segment: Sourced<Segment> | null;
  needs_review: boolean;
  versions: Version[];
  specs: Specs;
  images: ModelImage[];
  open_questions: string[];
  /** Derived (section 5): cheapest version price, `financed` included. Null: "Precio por confirmar". */
  price_from: Price | null;
  /** Derived (section 5): highest `wltp_km` of the versions, else `specs.wltp_max_km`. */
  max_range_km: Sourced<number> | null;
  /** Derived (section 5): drivetrains of the versions, else `specs.drivetrains`. Order: fwd, rwd, awd. */
  drivetrains: Drivetrain[];
  /** Values dropped for failing the schema (ADR-0001, ADR-0008). */
  warnings: string[];
  /** File the record came from, relative to the data dir. */
  file: string;
}

export interface LoadResult {
  models: ModelRecord[];
  /** Files that could not be read or are invalid as a whole: the page shows the rest. */
  errors: { file: string; message: string }[];
}

export const DEFAULT_DATA_DIR = resolve(import.meta.dirname, "../../../data/raw");

const STATUSES: readonly Status[] = ["on_sale", "announced", "discontinued"];
const SEGMENTS: readonly Segment[] = [
  "urbano", "compacto", "berlina", "familiar", "suv_pequeno",
  "suv_compacto", "suv_grande", "monovolumen", "furgoneta", "deportivo",
];
const DRIVETRAINS: readonly Drivetrain[] = ["fwd", "rwd", "awd"];
const BASES = ["usable", "gross", "unknown"];
const SPEC_KEYS = ["wltp_max_km", "power_max_kw", "dc_max_kw", "ac_max_kw", "battery_kwh_options", "drivetrains"];

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isPos = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const isPosInt = (v: unknown): v is number => isPos(v) && Number.isInteger(v);
const isOneOf =
  <T extends string>(list: readonly T[]) =>
  (v: unknown): v is T =>
    typeof v === "string" && (list as readonly string[]).includes(v);
const isLaunch = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(v);

/** ADR-0001: a value without source, url, date and tier is not published, so it is not typed as Sourced. */
function hasSource(v: Record<string, unknown>): boolean {
  return (
    "value" in v &&
    isStr(v.source_id) &&
    isStr(v.url) &&
    typeof v.retrieved === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.retrieved) &&
    isOneOf(["T1", "T2", "T3"])(v.tier) &&
    (v.note === undefined || v.note === null || typeof v.note === "string")
  );
}

/**
 * Reads an optional Sourced field. Absent or null gives null silently; anything invalid gives null
 * and a warning. `extra` returns a reason to reject beyond the common shape and the value check.
 */
function readSourced<T, S extends Sourced<T> = Sourced<T>>(
  v: unknown,
  where: string,
  warnings: string[],
  check: (value: unknown) => value is T,
  extra?: (v: Record<string, unknown>) => string | null,
): S | null {
  if (v == null) return null;
  const reason = !isObj(v)
    ? "not a mapping"
    : !hasSource(v)
      ? "needs value, source_id, url, retrieved (YYYY-MM-DD) and tier"
      : !check(v.value)
        ? "invalid value"
        : (extra?.(v) ?? null);
  if (reason) {
    warnings.push(`${where}: dropped, ${reason}`);
    return null;
  }
  return v as unknown as S;
}

const isEnumList =
  <T extends string>(list: readonly T[]) =>
  (v: unknown): v is T[] =>
    Array.isArray(v) && v.every(isOneOf(list));
const isPosList = (v: unknown): v is number[] => Array.isArray(v) && v.every(isPos);

/** Returns the price if it meets the `Price` rules of the schema, else the reason it does not. */
function priceProblem(p: Record<string, unknown>): string | null {
  if (!hasSource(p) || !isPos(p.value)) return "needs positive numeric value, source_id, url, retrieved and tier";
  if (p.tier !== "T1") return "tier must be T1";
  if (p.unit !== "EUR") return "unit must be EUR";
  if (p.price_kind !== "pvp" && p.price_kind !== "financed") return "price_kind must be pvp or financed";
  const hasTerms = p.price_terms != null || p.price_terms_url != null;
  if (p.price_kind === "financed" && !(isStr(p.price_terms) && isStr(p.price_terms_url))) {
    return "financed needs price_terms and price_terms_url";
  }
  if (p.price_kind === "pvp" && hasTerms) return "pvp must not carry price_terms or price_terms_url";
  return null;
}

function readVersion(v: Record<string, unknown>, warnings: string[]): Version | null {
  if (!isStr(v.name)) {
    warnings.push("version without name: dropped");
    return null;
  }
  const name = v.name;
  const w = (field: string) => `${name}.${field}`;
  const priceInvalid = v.price != null && (!isObj(v.price) || priceProblem(v.price) !== null);
  if (priceInvalid) {
    const why = isObj(v.price) ? priceProblem(v.price) : "not a mapping";
    warnings.push(`${name}: price dropped (${why})`);
  }
  return {
    name,
    battery_kwh: readSourced<number, Battery>(v.battery_kwh, w("battery_kwh"), warnings, isPos, (b) =>
      BASES.includes(b.basis as string) ? null : "basis must be usable, gross or unknown",
    ),
    wltp_km: readSourced(v.wltp_km, w("wltp_km"), warnings, isPosInt),
    power_kw: readSourced(v.power_kw, w("power_kw"), warnings, isPos),
    drivetrain: readSourced(v.drivetrain, w("drivetrain"), warnings, isOneOf(DRIVETRAINS)),
    dc_max_kw: readSourced(v.dc_max_kw, w("dc_max_kw"), warnings, isPos),
    ac_max_kw: readSourced(v.ac_max_kw, w("ac_max_kw"), warnings, isPos),
    price: v.price != null && !priceInvalid ? (v.price as unknown as Price) : null,
    price_issue: priceInvalid ? "invalid price" : null,
  };
}

function readSpecs(block: unknown, warnings: string[]): Specs {
  if (block == null) return {};
  if (!isObj(block)) {
    warnings.push("specs: not a mapping");
    return {};
  }
  for (const k of Object.keys(block)) if (!SPEC_KEYS.includes(k)) warnings.push(`specs.${k}: unknown key, ignored`);
  const s: Specs = {};
  const put = <K extends keyof Specs>(k: K, val: Specs[K] | null) => {
    if (val) s[k] = val;
  };
  put("wltp_max_km", readSourced(block.wltp_max_km, "specs.wltp_max_km", warnings, isPosInt));
  put("power_max_kw", readSourced(block.power_max_kw, "specs.power_max_kw", warnings, isPos));
  put("dc_max_kw", readSourced(block.dc_max_kw, "specs.dc_max_kw", warnings, isPos));
  put("ac_max_kw", readSourced(block.ac_max_kw, "specs.ac_max_kw", warnings, isPos));
  put("battery_kwh_options", readSourced(block.battery_kwh_options, "specs.battery_kwh_options", warnings, isPosList));
  put("drivetrains", readSourced(block.drivetrains, "specs.drivetrains", warnings, isEnumList(DRIVETRAINS)));
  return s;
}

function readImages(raw: unknown, warnings: string[]): ModelImage[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    warnings.push("images: not a list");
    return [];
  }
  const out: ModelImage[] = [];
  raw.forEach((img, i) => {
    if (!isObj(img) || !isStr(img.url) || !isStr(img.source_id) || typeof img.retrieved !== "string") {
      warnings.push(`images[${i}]: dropped, needs url, source_id and retrieved`);
    } else if (!isStr(img.license)) {
      warnings.push(`images[${i}]: dropped, no license (CA-10)`); // no license, no publication
    } else {
      out.push({
        url: img.url,
        source_id: img.source_id,
        retrieved: img.retrieved,
        license: img.license,
        attribution: isStr(img.attribution) ? img.attribution : null,
      });
    }
  });
  return out;
}

/** Section 5: minimum over `versions[].price.value`, `financed` included (RF-9). */
function derivePriceFrom(versions: Version[]): Price | null {
  let best: Price | null = null;
  for (const { price } of versions) if (price && (!best || price.value < best.value)) best = price;
  return best;
}

/** Section 5: maximum of the versions; if none has it, the model-level value. Two disagreeing sources make the file invalid. */
function deriveMaxRange(versions: Version[], specs: Specs): Sourced<number> | null {
  let best: Sourced<number> | null = null;
  for (const { wltp_km } of versions) if (wltp_km && (!best || wltp_km.value > best.value)) best = wltp_km;
  const model = specs.wltp_max_km ?? null;
  if (best && model && best.value !== model.value) {
    throw new Error(`specs.wltp_max_km (${model.value}) differs from the maximum of the versions (${best.value})`);
  }
  return best ?? model;
}

/** Section 5: set of the versions' drivetrains; if none has it, `specs.drivetrains`. */
function deriveDrivetrains(versions: Version[], specs: Specs): Drivetrain[] {
  const fromVersions = new Set(versions.flatMap((v) => (v.drivetrain ? [v.drivetrain.value] : [])));
  const set = fromVersions.size > 0 ? fromVersions : new Set(specs.drivetrains?.value ?? []);
  return DRIVETRAINS.filter((d) => set.has(d));
}

export function normalize(raw: unknown, file: string): ModelRecord {
  if (!isObj(raw)) throw new Error("not a YAML mapping");
  if (!isStr(raw.brand) || !isStr(raw.model)) throw new Error("missing brand or model");
  if (!isStr(raw.brand_name)) throw new Error("missing brand_name");
  const warnings: string[] = [];
  const status = readSourced(raw.status, "status", warnings, isOneOf(STATUSES));
  if (!status) throw new Error(`invalid or missing status: ${warnings.pop() ?? "required"}`);
  if (raw.versions != null && !Array.isArray(raw.versions)) warnings.push("versions: not a list");
  const versions = (Array.isArray(raw.versions) ? raw.versions : [])
    .filter(isObj)
    .flatMap((v) => readVersion(v, warnings) ?? []);
  const specs = readSpecs(raw.specs, warnings);
  return {
    brand: raw.brand,
    brand_name: raw.brand_name,
    model: raw.model,
    status,
    launch: readSourced(raw.launch, "launch", warnings, isLaunch),
    segment: readSourced(raw.segment, "segment", warnings, isOneOf(SEGMENTS)),
    needs_review: raw.needs_review === true,
    versions,
    specs,
    images: readImages(raw.images, warnings),
    open_questions: Array.isArray(raw.open_questions) ? raw.open_questions.map(String) : [],
    price_from: derivePriceFrom(versions),
    max_range_km: deriveMaxRange(versions, specs),
    drivetrains: deriveDrivetrains(versions, specs),
    warnings,
    file,
  };
}

/** Reads every `<dir>/<brand>/*.yaml`, sorted by brand then model. Never throws on bad files. */
export function loadModels(dir: string = DEFAULT_DATA_DIR): LoadResult {
  const models: ModelRecord[] = [];
  const errors: LoadResult["errors"] = [];
  try {
    for (const brandDir of readdirSync(dir, { withFileTypes: true })) {
      if (!brandDir.isDirectory()) continue;
      for (const f of readdirSync(join(dir, brandDir.name)).filter((n) => n.endsWith(".yaml")).sort()) {
        const file = `${brandDir.name}/${f}`;
        try {
          models.push(normalize(parse(readFileSync(join(dir, file), "utf8")), file));
        } catch (e) {
          errors.push({ file, message: (e as Error).message });
        }
      }
    }
  } catch (e) {
    errors.push({ file: ".", message: (e as Error).message });
  }
  models.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  return { models, errors };
}
