import { crc32, deflateSync } from "node:zlib";
import { parse } from "yaml";

/**
 * The complete example of docs/architecture/data-model.md, section 7 (fictional brand `acme`).
 * Tests use this instead of the real YAML in data/, which are being migrated to the schema.
 */
export const ACME_YAML = `# Researcher — Acme Volta (ejemplo ficticio). Fuente: acme-es (T1). Consultado 2026-09-20.
brand: acme
brand_name: Acme
model: Volta
status: {value: on_sale, source_id: acme-es, url: "https://www.acme.example/es/volta", retrieved: 2026-09-20, tier: T1}
launch: {value: "2025-03", note: "inicio de venta en España", source_id: acme-es, url: "https://www.acme.example/es/prensa/volta", retrieved: 2026-09-20, tier: T1}
segment: {value: suv_compacto, note: "la web lo presenta como SUV compacto", source_id: acme-es, url: "https://www.acme.example/es/volta", retrieved: 2026-09-20, tier: T1}
needs_review: false
specs:
  wltp_max_km: {value: 520, note: "hasta 520 km", source_id: acme-es, url: "https://www.acme.example/es/volta", retrieved: 2026-09-20, tier: T1}
  dc_max_kw: {value: 150, source_id: acme-es, url: "https://www.acme.example/es/volta", retrieved: 2026-09-20, tier: T1}
versions:
  - name: Volta 60
    battery_kwh: {value: 60, basis: usable, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    wltp_km: {value: 470, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    power_kw: {value: 150, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    drivetrain: {value: rwd, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    price:
      value: 39990
      unit: EUR
      price_kind: pvp
      source_id: acme-es
      url: "https://www.acme.example/es/volta/precios"
      retrieved: 2026-09-20
      tier: T1
  - name: Volta 80 AWD
    battery_kwh: {value: 80, basis: gross, note: "la ficha da la capacidad bruta", source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    wltp_km: {value: 520, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    power_kw: {value: 220, note: "publicado: 299 CV", source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    drivetrain: {value: awd, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    dc_max_kw: {value: 150, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    price:
      value: 47500
      unit: EUR
      price_kind: financed
      price_terms: "PVP recomendado financiando en Península y Baleares de 47.500 € (IVA, transporte y descuento de marca incluidos). Crédito mínimo de 10.000 € con permanencia de 48 meses."
      price_terms_url: "https://www.acme.example/es/volta/ofertas"
      source_id: acme-es
      url: "https://www.acme.example/es/volta/ofertas"
      retrieved: 2026-09-20
      tier: T1
  - name: Volta GT
    wltp_km: {value: 490, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    drivetrain: {value: awd, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    price: null   # ninguna fuente T1 publica precio para esta versión
images: []   # sin licencia registrada
open_questions:
  - "Volta GT: potencia y batería no publicadas en la ficha."
`;

/** A valid 32x18 grey PNG (no dependency: zlib builds the chunks). */
export function pngBytes(): Buffer {
  const w = 32;
  const h = 18;
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 128)]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** An `images` entry in the shape of data-model.md; override or delete keys per test. */
export const imageEntry = (extra: Record<string, unknown> = {}) => ({
  file: "data/images/acme/volta/front.png",
  source_url: "https://upload.wikimedia.org/acme/front.png",
  page_url: "https://commons.wikimedia.org/wiki/File:Acme_Volta.png",
  source_id: "wikimedia-commons",
  retrieved: "2026-09-20",
  license: "CC-BY-SA-4.0",
  attribution: "Foto: A. Author, CC BY-SA 4.0",
  ...extra,
});

/** A fresh, mutable parse of the example. */
export const acme = (): Record<string, any> => parse(ACME_YAML);

/** A Sourced object in the shape the schema requires. */
export const sourced = (value: unknown, extra: Record<string, unknown> = {}) => ({
  value,
  source_id: "acme-es",
  url: "https://www.acme.example/es/x",
  retrieved: "2026-09-20",
  tier: "T1",
  ...extra,
});
