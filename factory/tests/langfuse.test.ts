/** Tests for the Langfuse export (no network). Run: npm test */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { evalScore, exportRun, loadKeys, toOtlp, toSpans, traceId } from "../langfuse.ts";

const record = {
  run_id: "20260923-010005-219b9a", agent: "researcher", task: "Verifica Cupra",
  started: "2026-09-23T01:00:05+02:00", ended: "2026-09-23T01:01:09+02:00",
  outcome: "success", cost_usd: 0.23, turns: 2, result: "RESULTADO: ok",
  evals: { passed: 3, failed: [] as string[] },
};

const msg = (id: string, ts: string, content: object[]) => JSON.stringify({
  type: "assistant", timestamp: ts,
  message: { id, model: "claude-sonnet-5", usage: { input_tokens: 10, output_tokens: 5 }, content },
});
const stream = [
  JSON.stringify({ type: "system", subtype: "init" }),
  msg("m1", "2026-09-22T23:00:10.000Z", [{ type: "text", text: "Miro la web" }]),
  msg("m1", "2026-09-22T23:00:11.000Z", [{ type: "tool_use", id: "t1", name: "WebFetch", input: { url: "https://x" } }]),
  JSON.stringify({ type: "user", timestamp: "2026-09-22T23:00:15.000Z",
    message: { content: [{ type: "tool_result", tool_use_id: "t1", is_error: true, content: "403" }] } }),
  msg("m2", "2026-09-22T23:00:20.000Z", [{ type: "text", text: "RESULTADO: ok" }]),
  JSON.stringify({ type: "result", subtype: "success" }),
].join("\n");

describe("langfuse", () => {
  test("una generación por mensaje y un span por herramienta, colgando de la raíz", () => {
    const spans = toSpans(record, stream);
    const type = (s: { attributes: Record<string, unknown> }) => s.attributes["langfuse.observation.type"];
    assert.deepEqual(spans.map(type), ["agent", "generation", "tool", "generation"]);
    const [root, gen1, tool, gen2] = spans;
    assert.ok(spans.slice(1).every((s) => s.parent === root.key));
    assert.equal(root.parent, undefined);
    // the first call starts with the run; the next one when the tool result came back
    assert.equal(gen1.start, record.started);
    assert.equal(gen1.end, "2026-09-22T23:00:11.000Z");
    assert.equal(gen2.start, "2026-09-22T23:00:15.000Z");
    assert.equal(tool.end, "2026-09-22T23:00:15.000Z");
    assert.equal(tool.error, true);
    assert.equal(tool.attributes["langfuse.observation.output"], "403");
    assert.match(String(gen1.attributes["langfuse.observation.output"]), /Miro la web.*WebFetch/);
  });

  test("ids deterministas: reenviar no duplica", () => {
    assert.match(traceId(record.run_id), /^[0-9a-f]{32}$/);
    assert.deepEqual(toOtlp(record, stream), toOtlp(record, stream));
    const span = toOtlp(record, stream).resourceSpans[0].scopeSpans[0].spans[0];
    assert.match(span.spanId, /^[0-9a-f]{16}$/);
    assert.equal(span.startTimeUnixNano, String(Date.parse(record.started) * 1e6));
    assert.ok(span.attributes.some((a) => a.key === "langfuse.trace.name"));
  });

  test("sin traza local se envía solo la raíz", () => {
    assert.equal(toSpans(record, "").length, 1);
  });

  test("los evals van como score booleano", () => {
    assert.equal(evalScore(record)?.value, 1);
    assert.equal(evalScore({ ...record, evals: { passed: 1, failed: ["x"] } })?.value, 0);
    assert.equal(evalScore({ ...record, evals: undefined }), null);
  });

  test("sin fichero de claves no envía nada", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lf-"));
    assert.equal(loadKeys(join(dir, "nope.env")), null);
    writeFileSync(join(dir, "a.env"), "LANGFUSE_PUBLIC_KEY=pk\nLANGFUSE_SECRET_KEY=sk\n", "utf8");
    assert.deepEqual(loadKeys(join(dir, "a.env")), { publicKey: "pk", secretKey: "sk", baseUrl: "https://cloud.langfuse.com" });
    assert.equal(await exportRun(record, null), null);
    rmSync(dir, { recursive: true, force: true });
  });
});
