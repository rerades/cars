/**
 * Uploads the confirmed cases of factory/datasets/<dataset>/ to a Langfuse dataset (ADR-0016,
 * decision 1). Idempotent: items are upserted on an id derived from the case id, and an item
 * whose case left the repository (or is no longer confirmed) is archived, never deleted.
 *
 *   node factory/dataset-sync.ts reviewer
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { api, KEYS_FILE, loadKeys, type Keys } from "./langfuse.ts";
import { REPO } from "./orchestrator.ts";

export interface Case {
  case_id: string;
  pr: number;
  reviewed_sha: string;
  base_sha: string;
  issue: number | null;
  synthetic: boolean;
  confirmed: boolean;
  expected: {
    label: string;
    findings: string[];
    ca: { id: string; covered: boolean | null }[];
    not_findings?: string[];
  };
}

export const datasetDir = (dataset: string) => join(REPO, "factory", "datasets", dataset);
/** Item ids are unique across the Langfuse project, so they carry the dataset name. */
export const itemId = (dataset: string, caseId: string) => `${dataset}-${caseId}`;

/** Every case of the dataset, confirmed or not, sorted by id. */
export function readCases(dataset: string, dir = datasetDir(dataset)): (Case & { dir: string })[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "case.yaml")))
    .map((d) => ({ ...(parse(readFileSync(join(dir, d.name, "case.yaml"), "utf8")) as Case), dir: join(dir, d.name) }))
    .sort((a, b) => a.case_id.localeCompare(b.case_id));
}

/** A confirmed case must say what a good review leaves; anything missing is a reason to skip it. */
export function caseProblem(c: Case): string | null {
  if (!c.confirmed) return "sin confirmar";
  if (!["review:ok", "review:changes", "review:needs-human", "review:error"].includes(c.expected?.label)) return "etiqueta esperada no válida";
  if ((c.expected.ca ?? []).some((x) => typeof x.covered !== "boolean")) return "algún CA sin covered: true/false";
  return null;
}

export const toItem = (dataset: string, c: Case) => ({
  datasetName: dataset,
  id: itemId(dataset, c.case_id),
  input: { pr: c.pr, reviewed_sha: c.reviewed_sha, base_sha: c.base_sha, issue: c.issue },
  expectedOutput: c.expected,
  metadata: { case_id: c.case_id, synthetic: c.synthetic },
  status: "ACTIVE",
});

/** The Langfuse dataset id, creating the dataset the first time. */
export async function ensureDataset(keys: Keys, dataset: string): Promise<string> {
  try {
    return (await api(keys, `/api/public/v2/datasets/${encodeURIComponent(dataset)}`)).id;
  } catch (e) {
    if (!/HTTP 404/.test((e as Error).message)) throw e;
    return (await api(keys, "/api/public/v2/datasets", { name: dataset, description: `ADR-0016: casos de factory/datasets/${dataset}/` })).id;
  }
}

async function remoteItems(keys: Keys, dataset: string): Promise<Record<string, any>[]> {
  const out: Record<string, any>[] = [];
  for (let page = 1; ; page++) {
    const res = await api(keys, `/api/public/dataset-items?datasetName=${encodeURIComponent(dataset)}&page=${page}&limit=50`);
    out.push(...(res?.data ?? []));
    if (page >= (res?.meta?.totalPages ?? 0)) return out;
  }
}

export async function sync(keys: Keys, dataset: string): Promise<string[]> {
  const log: string[] = [];
  await ensureDataset(keys, dataset);
  const wanted = new Set<string>();
  for (const c of readCases(dataset)) {
    const problem = caseProblem(c);
    if (problem) {
      log.push(`${c.case_id}: se omite (${problem})`);
      continue;
    }
    await api(keys, "/api/public/dataset-items", toItem(dataset, c)); // one by one: the datasets API allows 100/min
    wanted.add(itemId(dataset, c.case_id));
    log.push(`${c.case_id}: subido`);
  }
  for (const item of await remoteItems(keys, dataset)) {
    if (wanted.has(item.id) || item.status === "ARCHIVED") continue;
    await api(keys, "/api/public/dataset-items", {
      datasetName: dataset, id: item.id, input: item.input, expectedOutput: item.expectedOutput,
      metadata: item.metadata, status: "ARCHIVED",
    });
    log.push(`${item.id}: archivado`);
  }
  return log;
}

if (import.meta.main) {
  const dataset = process.argv[2];
  const keys = loadKeys();
  if (!dataset) {
    console.error("uso: node factory/dataset-sync.ts <dataset>");
    process.exitCode = 2;
  } else if (!keys) {
    console.error(`faltan las claves en ${KEYS_FILE} (ver factory/README.md)`);
    process.exitCode = 2;
  } else {
    for (const line of await sync(keys, dataset)) console.log(line);
  }
}
