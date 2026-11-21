/** Tests for freezing Researcher cases (ADR-0026, decision 1). Run: pnpm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchCalls, shellWords } from "../dataset-capture.ts";

test("shellWords separa con comillas y rechaza tuberías, cadenas y redirecciones", () => {
  assert.deepEqual(shellWords(`node factory/fetch-page.ts "https://x.es/a b" "36.795" PVP 'Oferta válida'`),
    ["node", "factory/fetch-page.ts", "https://x.es/a b", "36.795", "PVP", "Oferta válida"]);
  assert.deepEqual(shellWords(`node factory/fetch-page.ts https://x.es/\\"q`), ["node", "factory/fetch-page.ts", 'https://x.es/"q']);
  for (const cmd of ["node factory/fetch-idae.ts TESLA | head", "a && b", "a; b", "a > f", "echo $X", `"open`]) assert.equal(shellWords(cmd), null);
});

test("fetchCalls congela cada llamada simple con su salida y aparta las compuestas", () => {
  const ev = (type: string, content: unknown[]) => JSON.stringify({ type, message: { content } });
  const trace = [
    ev("assistant", [{ type: "tool_use", id: "a", name: "Bash", input: { command: "node factory/fetch-page.ts https://x.es PVP" } }]),
    ev("user", [{ type: "tool_result", tool_use_id: "a", content: [{ type: "text", text: '{"paragraphs":["PVP 1"]}' }] }]),
    ev("assistant", [{ type: "tool_use", id: "b", name: "Bash", input: { command: "node factory/fetch-idae.ts TESLA | head -c 10" } }]),
    ev("user", [{ type: "tool_result", tool_use_id: "b", content: "trimmed" }]),
    ev("assistant", [{ type: "tool_use", id: "c", name: "Bash", input: { command: "node factory/fetch-image.ts acme volta" } }]),
    ev("user", [{ type: "tool_result", tool_use_id: "c", content: "boom", is_error: true }]),
    ev("assistant", [{ type: "tool_use", id: "d", name: "Read", input: { file_path: "factory/fetch-page.ts" } }]),
    "not json",
  ].join("\n");
  const { calls, skipped } = fetchCalls(trace);
  assert.deepEqual(calls, [
    { tool: "fetch-page", args: ["https://x.es", "PVP"], exit: 0, output: '{"paragraphs":["PVP 1"]}' },
    { tool: "fetch-image", args: ["acme", "volta"], exit: 1, output: "boom" },
  ]);
  assert.deepEqual(skipped, ["node factory/fetch-idae.ts TESLA | head -c 10"]);
});
