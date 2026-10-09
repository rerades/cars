/** Tests for the IDAE reader (ADR-0001, T2 homologation data). Run: pnpm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchIdae, optionValue, PAGE } from "../fetch-idae.ts";

const HTML = `<form name="form" method="post"><input type="hidden" name="_token" value="tok123">
<select class="form-control" name="motorizacion"><option value="">* Cualquiera</option><option value="6">Eléctricos puros</option></select>
<select class="form-control" name="marca"><option value="">* Cualquiera</option><option value="133">Tata</option><option value="134">TESLA</option></select></form>`;
const IMG = '<img src="https://coches.idae.es/img/clasificacion/S.gif">';
const ROWS = [
  ["TESLA Model 3 Highland Premium Tracción Trasera - 750km", IMG, "Eléctricos puros", "M1", 2186, "12.6", "235.0", "750.0", "77.0", 608835],
  ["TESLA  Model X Gran autonomía", IMG, "Eléctricos puros", "M1", 3040, "21.5", "421.0", "561.0", "100.0", 548398],
];

test("optionValue encuentra la opción por su texto, sin distinguir mayúsculas", () => {
  assert.equal(optionValue(HTML, "marca", "tesla"), "134");
  assert.equal(optionValue(HTML, "motorizacion", "eléctricos puros"), "6");
  assert.equal(optionValue(HTML, "marca", "Acme"), null);
});

test("pide el listado con token, cookie y filtros, y devuelve las versiones", async () => {
  let sent: { body: URLSearchParams; headers: Record<string, string> } | undefined;
  const fake = (async (url: string, init?: RequestInit) => {
    if (url === PAGE) return new Response(HTML, { headers: [["Set-Cookie", "laravel_session=abc; path=/"]] });
    sent = { body: init!.body as URLSearchParams, headers: init!.headers as Record<string, string> };
    return Response.json({ recordsFiltered: 2, data: ROWS });
  }) as typeof fetch;

  const out = await fetchIdae("TESLA", fake, new Date("2026-10-09T10:00:00Z"));
  assert.equal(sent!.headers.Cookie, "laravel_session=abc");
  assert.equal(sent!.body.get("_token"), "tok123");
  const filtros = new URLSearchParams(sent!.body.get("filtros")!);
  assert.equal(filtros.get("marca"), "134");
  assert.equal(filtros.get("motorizacion"), "6");
  assert.equal(out.retrieved, "2026-10-09");
  assert.deepEqual(out.versions[0], { id: 608835, name: "Model 3 Highland Premium Tracción Trasera - 750km", mtma_kg: 2186,
    consumption_kwh_100km: 12.6, power_kw: 235, wltp_km: 750, battery_kwh: 77 });
  assert.equal(out.versions[1].name, "Model X Gran autonomía");
});

test("falla si el listado viene incompleto o la marca no existe", async () => {
  const fake = (rows: unknown[], total: number) => (async (url: string) =>
    url === PAGE ? new Response(HTML) : Response.json({ recordsFiltered: total, data: rows })) as typeof fetch;
  await assert.rejects(fetchIdae("TESLA", fake(ROWS, 3)), /only 2 of 3/);
  await assert.rejects(fetchIdae("Acme", fake(ROWS, 2)), /no brand "Acme"/);
});
