/** PreToolUse/PostToolUse: registra cada acción del agente en ops/actions/<run_id>.jsonl. */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MAX = 300;

function main(): void {
  const runId = process.env.FACTORY_RUN_ID;
  if (!runId) return;
  let event;
  try {
    event = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return;
  }

  const outDir = process.env.FACTORY_LOG_DIR || join(process.env.FACTORY_REPO || ".", "ops", "actions");
  mkdirSync(outDir, { recursive: true });
  const record = {
    ts: new Date().toISOString().slice(0, 19) + "+00:00",
    run_id: runId,
    agent: process.env.FACTORY_AGENT,
    event: event.hook_event_name,
    tool: event.tool_name,
    input: JSON.stringify(event.tool_input ?? {}).slice(0, MAX),
  };
  appendFileSync(join(outDir, `${runId}.jsonl`), JSON.stringify(record) + "\n", "utf8");
}

main();
