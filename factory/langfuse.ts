/**
 * Sends each run to Langfuse Cloud as an OTLP trace, and its evals as a score. See ADR-0004.
 *
 * Keys live in .secrets/langfuse.env (LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY and optionally
 * LANGFUSE_BASE_URL). They are parsed into a local object, never into process.env, so agents
 * never inherit them. Without the file, nothing is sent.
 *
 * Backfill: node factory/langfuse.ts [YYYY-MM]   # every run of that month (default: current)
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { loadConfig, nowInTz, readLedger, REPO, TRACE_DIR, type Row } from "./orchestrator.ts";

export const KEYS_FILE = join(REPO, ".secrets", "langfuse.env");
const EU = "https://cloud.langfuse.com";
const MAX = 4000; // chars per input/output: enough to read, small enough to stay in the free tier

export interface Keys {
  publicKey: string;
  secretKey: string;
  baseUrl: string;
}

export function loadKeys(path = KEYS_FILE): Keys | null {
  if (!existsSync(path)) return null;
  const env = parseEnv(readFileSync(path, "utf8"));
  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) return null;
  return {
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    secretKey: env.LANGFUSE_SECRET_KEY,
    baseUrl: (env.LANGFUSE_BASE_URL || EU).replace(/\/$/, ""),
  };
}

// --------------------------------------------------------------------------- OTLP

type Event = Record<string, any>;
type Attr = { key: string; value: Record<string, unknown> };

/** Deterministic ids: re-sending a run produces the same trace, not a copy. */
const hex = (seed: string, len: number) => createHash("sha256").update(seed).digest("hex").slice(0, len);
export const traceId = (runId: string) => hex(runId, 32);

const nanos = (iso: unknown) => String(BigInt(Date.parse(String(iso))) * 1_000_000n);
const text = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v ?? "")).slice(0, MAX);

function attrs(o: Record<string, unknown>): Attr[] {
  return Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([key, v]) => ({
      key,
      value: Array.isArray(v)
        ? { arrayValue: { values: v.map((s) => ({ stringValue: String(s) })) } }
        : { stringValue: String(v) },
    }));
}

interface Span {
  key: string;
  name: string;
  start: unknown;
  end: unknown;
  parent?: string;
  error?: boolean;
  attributes: Record<string, unknown>;
}

const events = (stdout: string): Event[] =>
  stdout.split("\n").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });

/**
 * Root `agent` span for the run, one `generation` per model call (stream-json splits a message
 * into several events that share message.id) and one `tool` span per tool call.
 */
export function toSpans(record: Row, stdout: string): Span[] {
  const runId = String(record.run_id);
  const spans: Span[] = [{
    key: "root", name: String(record.agent), start: record.started, end: record.ended ?? record.started,
    error: record.outcome !== "success",
    attributes: {
      "langfuse.observation.type": "agent",
      "langfuse.observation.input": text(record.task),
      "langfuse.observation.output": text(record.result),
      "langfuse.observation.metadata.outcome": record.outcome,
      "langfuse.observation.metadata.cost_usd": record.cost_usd,
      "langfuse.observation.metadata.cost_kind": record.cost_kind,
      "langfuse.observation.metadata.turns": record.turns,
      "langfuse.observation.metadata.branch": record.branch,
      "langfuse.observation.metadata.pr": record.pr,
      "langfuse.observation.metadata.evals": record.evals ? JSON.stringify(record.evals) : undefined,
    },
  }];

  const gens = new Map<string, Span>();
  const outputs = new Map<Span, unknown[]>(); // text and tool calls of each model call
  const tools = new Map<string, Span>();
  let last: unknown = record.started; // a model call starts when the previous event ended
  for (const e of events(stdout)) {
    if (!e.timestamp) continue;
    const content: Event[] = Array.isArray(e.message?.content) ? e.message.content : [];
    if (e.type === "assistant" && e.message?.id) {
      let gen = gens.get(e.message.id);
      if (!gen) {
        const u = e.message.usage ?? {};
        gen = {
          key: `gen:${e.message.id}`, name: "llm", start: last, end: e.timestamp, parent: "root",
          attributes: {
            "langfuse.observation.type": "generation",
            "langfuse.observation.model.name": e.message.model,
            "langfuse.observation.usage_details": JSON.stringify({
              input: u.input_tokens || 0, output: u.output_tokens || 0,
              cache_read_input_tokens: u.cache_read_input_tokens || 0,
              cache_creation_input_tokens: u.cache_creation_input_tokens || 0,
            }),
          },
        };
        gens.set(e.message.id, gen);
        outputs.set(gen, []);
        spans.push(gen);
      }
      gen.end = e.timestamp;
      for (const c of content) {
        if (c.type === "text" || c.type === "tool_use") outputs.get(gen)!.push(c);
        if (c.type === "tool_use") {
          const tool: Span = {
            key: `tool:${c.id}`, name: c.name, start: e.timestamp, end: e.timestamp, parent: "root",
            attributes: { "langfuse.observation.type": "tool", "langfuse.observation.input": text(c.input) },
          };
          tools.set(c.id, tool);
          spans.push(tool);
        }
      }
    }
    if (e.type === "user") {
      for (const c of content) {
        const tool = c.type === "tool_result" && tools.get(c.tool_use_id);
        if (!tool) continue;
        tool.end = e.timestamp;
        tool.error = !!c.is_error;
        tool.attributes["langfuse.observation.output"] = text(c.content);
      }
    }
    last = e.timestamp;
  }
  for (const [gen, out] of outputs) gen.attributes["langfuse.observation.output"] = text(out);
  const spanId = (key: string) => hex(`${runId}:${key}`, 16);
  return spans.map((s) => ({ ...s, key: spanId(s.key), parent: s.parent && spanId(s.parent) }));
}

/** OTLP/HTTP JSON body. Trace-level attributes go on every span so Langfuse v4 can filter by them. */
export function toOtlp(record: Row, stdout: string) {
  const runId = String(record.run_id);
  const traceAttrs = {
    "langfuse.trace.name": record.agent,
    "langfuse.trace.tags": [record.agent, record.outcome],
    "langfuse.trace.metadata.run_id": runId,
    "langfuse.environment": "factory",
  };
  const spans = toSpans(record, stdout).map((s) => ({
    traceId: traceId(runId),
    spanId: s.key,
    ...(s.parent ? { parentSpanId: s.parent } : {}),
    name: s.name,
    kind: 1,
    startTimeUnixNano: nanos(s.start),
    endTimeUnixNano: nanos(s.end),
    attributes: attrs({ ...traceAttrs, ...s.attributes }),
    status: { code: s.error ? 2 : 1 },
  }));
  return {
    resourceSpans: [{
      resource: { attributes: attrs({ "service.name": "dark-factory" }) },
      scopeSpans: [{ scope: { name: "factory/langfuse.ts" }, spans }],
    }],
  };
}

/** Evals as a BOOLEAN score on the trace; the id makes re-sending update it, not duplicate it. */
export function evalScore(record: Row) {
  const evals = record.evals as { passed: number; failed: string[] } | undefined;
  if (!evals) return null;
  return {
    id: `${record.run_id}-evals`,
    traceId: traceId(String(record.run_id)),
    name: "evals",
    value: evals.failed.length ? 0 : 1,
    dataType: "BOOLEAN",
    comment: evals.failed.length ? evals.failed.join("\n").slice(0, 2000) : `${evals.passed} checks passed`,
  };
}

// --------------------------------------------------------------------------- envío

async function post(keys: Keys, path: string, body: unknown): Promise<void> {
  const res = await fetch(keys.baseUrl + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${keys.publicKey}:${keys.secretKey}`).toString("base64"),
      "x-langfuse-ingestion-version": "4",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

/**
 * Sends one run. Returns a line for the CLI, or null without keys. Never throws: observability
 * must not break a run.
 */
export async function exportRun(record: Row, keys = loadKeys()): Promise<string | null> {
  if (!keys || !record.run_id) return null;
  const tracePath = join(TRACE_DIR, `${record.run_id}.jsonl`);
  const stdout = existsSync(tracePath) ? readFileSync(tracePath, "utf8") : "";
  try {
    await post(keys, "/api/public/otel/v1/traces", toOtlp(record, stdout));
    const score = evalScore(record);
    if (score) await post(keys, "/api/public/scores", score);
    return `langfuse: ${record.run_id} enviado`;
  } catch (e) {
    return `langfuse: ${record.run_id} no se pudo enviar (${(e as Error).message})`;
  }
}

if (import.meta.main) {
  const month = process.argv[2] || nowInTz(loadConfig()).day.slice(0, 7);
  const keys = loadKeys();
  if (!keys) {
    console.error(`faltan las claves en ${KEYS_FILE} (ver factory/README.md)`);
    process.exitCode = 2;
  } else {
    for (const row of readLedger(month)) console.log(await exportRun(row, keys));
  }
}
