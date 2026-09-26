import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";

/** A value plus where it came from (ADR-0001). Every field keeps this metadata. */
export interface Sourced<T = unknown> {
  value: T;
  unit?: string;
  note?: string;
  source_id: string;
  url: string;
  retrieved: string;
  tier?: string;
}

export interface Price extends Sourced<number> {
  price_kind: "pvp" | "financed";
  price_terms?: string;
  price_terms_url?: string;
}

/** Raw YAML has no fixed field list per version; known keys are typed, the rest pass through. */
export interface Version {
  name: string;
  price: Price | null;
  [field: string]: unknown;
}

export interface ModelRecord {
  brand: string;
  model: string;
  /** Cupra sources the status; Polestar gives a bare string. Both normalize to this. */
  status: { value: string; source?: Sourced<string> };
  needs_review: boolean;
  versions: Version[];
  /** Sourced values that apply to the whole model (`model_level` in Cupra, `specs` in Polestar). */
  specs: Record<string, Sourced>;
  open_questions: string[];
  /** File the record came from, relative to the data dir. */
  file: string;
}

export interface LoadResult {
  models: ModelRecord[];
  /** Files that could not be read or lacked brand/model: the page shows the rest. */
  errors: { file: string; message: string }[];
}

export const DEFAULT_DATA_DIR = resolve(process.cwd(), "../data/raw");

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isSourced = (v: unknown): v is Sourced => isObj(v) && "value" in v && "source_id" in v;

export function normalize(raw: unknown, file: string): ModelRecord {
  if (!isObj(raw)) throw new Error("not a YAML mapping");
  if (typeof raw.brand !== "string" || typeof raw.model !== "string") {
    throw new Error("missing brand or model");
  }
  const st = raw.status;
  const status = isSourced(st)
    ? { value: String(st.value), source: st as Sourced<string> }
    : { value: typeof st === "string" ? st : "unknown" };
  const specs: Record<string, Sourced> = {};
  for (const block of [raw.model_level, raw.specs]) {
    if (!isObj(block)) continue;
    for (const [k, v] of Object.entries(block)) if (isSourced(v)) specs[k] = v;
  }
  const versions = (Array.isArray(raw.versions) ? raw.versions : [])
    .filter(isObj)
    .map((v) => ({ ...v, name: String(v.name ?? ""), price: isSourced(v.price) ? (v.price as Price) : null }));
  return {
    brand: raw.brand,
    model: raw.model,
    status,
    needs_review: raw.needs_review === true,
    versions,
    specs,
    open_questions: Array.isArray(raw.open_questions) ? raw.open_questions.map(String) : [],
    file,
  };
}

/** Reads every `<dir>/<brand>/*.yaml`, sorted by brand then model. Never throws on bad files. */
export function loadModels(dir: string = DEFAULT_DATA_DIR): LoadResult {
  const models: ModelRecord[] = [];
  const errors: LoadResult["errors"] = [];
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
  models.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  return { models, errors };
}
