/** Tests for the literal page reader (ADR-0001: registered sources, robots.txt). Run: pnpm test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { excerpts, fetchPage, hostAllowed, htmlToText, registeredHosts, robotsAllows } from "../fetch-page.ts";

const LOTUS = `User-agent: *
Disallow: */configurator/eletre*
Disallow: /*?*direct_url=
Disallow: /en-BZ*
Sitemap: https://www.lotuscars.com/en/sitemap.xml`;

test("robotsAllows: reglas con comodines, la más larga gana y Allow gana el empate", () => {
  assert.equal(robotsAllows(LOTUS, "/es-ES/eletre"), true);
  assert.equal(robotsAllows(LOTUS, "/es-ES/configurator/eletre/r"), false);
  assert.equal(robotsAllows(LOTUS, "/es-ES/x?a=1&direct_url=y"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow:", "/todo"), true);
  const mixed = "User-agent: *\nDisallow: /\n\nUser-agent: siete3-factory\nDisallow: /privado\nAllow: /privado/precios";
  assert.equal(robotsAllows(mixed, "/modelos"), true, "our own group replaces *");
  assert.equal(robotsAllows(mixed, "/privado/x"), false);
  assert.equal(robotsAllows(mixed, "/privado/precios"), true);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /a$", "/a"), false);
  assert.equal(robotsAllows("User-agent: *\nDisallow: /a$", "/ab"), true);
});

test("hostAllowed: el host registrado y sus subdominios, sin www", () => {
  const hosts = new Set(["nissan.es", "skoda.es"]);
  assert.equal(hostAllowed("www.skoda.es", hosts), true);
  assert.equal(hostAllowed("micra.nissan.es", hosts), true);
  assert.equal(hostAllowed("notskoda.es", hosts), false);
  assert.ok(registeredHosts().has("skoda.es"), "reads data/sources/");
});

test("htmlToText deja el texto visible, un párrafo por línea y las entidades decodificadas", () => {
  const html = `<html><head><title>t</title></head><body><script>var p="99.999 €"</script>
    <p>PVP recomendado: 37.128,70&nbsp;&euro; <sup>1</sup></p><!-- oculto --><div>Oferta v&aacute;lida&#160;hasta &#x31;0/2026</div></body></html>`;
  assert.equal(htmlToText(html), "PVP recomendado: 37.128,70 € 1\nOferta válida hasta 10/2026");
});

test("excerpts da los párrafos con la palabra y el siguiente, sin repetir", () => {
  const text = "Inicio\n1. PVP recomendado 30.000 €\nOferta válida hasta el 31/10\nOtra cosa\npvp final";
  assert.deepEqual(excerpts(text, ["PVP"]), ["1. PVP recomendado 30.000 €", "Oferta válida hasta el 31/10", "pvp final"]);
});

test("fetchPage respeta robots.txt, los hosts registrados y las redirecciones", async () => {
  const hosts = new Set(["skoda.es"]);
  const fake = (robots: string | number, page = "<p>PVP 1 €</p>", finalUrl = "") => (async (u: URL) => {
    if (u.pathname === "/robots.txt") return typeof robots === "number" ? new Response("", { status: robots }) : new Response(robots);
    const res = new Response(page);
    if (finalUrl) Object.defineProperty(res, "url", { value: finalUrl });
    return res;
  }) as unknown as typeof fetch;
  const url = "https://www.skoda.es/modelos/enyaq";

  const out: any = await fetchPage(url, ["pvp"], fake(404), hosts, new Date("2026-10-23T08:00:00Z"));
  assert.deepEqual(out.paragraphs, ["PVP 1 €"]);
  assert.equal(out.retrieved, "2026-10-23");
  assert.equal(((await fetchPage(url, [], fake("User-agent: *\nDisallow:"), hosts)) as any).text, "PVP 1 €");
  await assert.rejects(fetchPage(url, [], fake("User-agent: *\nDisallow: /modelos"), hosts), /disallows/);
  await assert.rejects(fetchPage(url, [], fake(503), hosts), /robots.txt answered HTTP 503/);
  await assert.rejects(fetchPage("https://example.com/", [], fake(404), hosts), /not in any data\/sources/);
  await assert.rejects(fetchPage("http://www.skoda.es/", [], fake(404), hosts), /only https/);
  await assert.rejects(fetchPage(url, [], fake(404, "", "https://evil.example/x"), hosts), /redirected/);
});
