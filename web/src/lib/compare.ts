import type { ModelRecord, Sourced, Version } from "./data.ts";

/**
 * Comparator logic (PRD-003, ADR-0014). Pure and browser-safe: it must not import `node:fs` or
 * anything from Node. Type-only imports from data.ts are erased, so nothing of the loader ships.
 */

/** RF-11: published, on sale or announced, and with at least one version. */
export function isComparable(m: {
  needs_review?: boolean;
  status: { value: string };
  versions: readonly unknown[];
}): boolean {
  return (
    m.needs_review !== true &&
    (m.status.value === "on_sale" || m.status.value === "announced") &&
    m.versions.length > 0
  );
}

/**
 * RF-8: the version with the lowest price (`financed` included); on a tie, the first in the file.
 * With no prices at all, the first version. Null only for an empty list.
 */
export function defaultVersion<V extends { price?: { value: number } | null }>(versions: readonly V[]): V | null {
  let best: V | null = null;
  for (const v of versions) if (v.price && (!best || v.price.value < best.price!.value)) best = v;
  return best ?? versions[0] ?? null;
}

/** A sourced datum as published: always the six keys, `note` null when absent (RF-3). */
export interface PublishedDatum<T = unknown> {
  value: T;
  source_id: string;
  url: string;
  retrieved: string;
  tier: string;
  note: string | null;
}
export interface PublishedBattery extends PublishedDatum<number> {
  basis: string;
}
export interface PublishedPrice extends PublishedDatum<number> {
  price_kind: string;
  price_terms: string | null;
  price_terms_url: string | null;
}
export interface PublishedVersion {
  name: string;
  price: PublishedPrice | null;
  wltp_km: PublishedDatum<number> | null;
  battery_kwh: PublishedBattery | null;
  power_kw: PublishedDatum<number> | null;
  drivetrain: PublishedDatum<string> | null;
  dc_max_kw: PublishedDatum<number> | null;
  ac_max_kw: PublishedDatum<number> | null;
}
export interface PublishedModel {
  brand: string;
  slug: string;
  brand_name: string;
  model: string;
  status: PublishedDatum<string>;
  launch: PublishedDatum<string> | null;
  versions: PublishedVersion[];
}

const datum = <T>(s: Sourced<T> | null | undefined): PublishedDatum<T> | null =>
  s == null
    ? null
    : { value: s.value, source_id: s.source_id, url: s.url, retrieved: s.retrieved, tier: s.tier, note: s.note ?? null };

function projectVersion(v: Version): PublishedVersion {
  const price = v.price
    ? {
        ...datum(v.price)!,
        price_kind: v.price.price_kind,
        price_terms: v.price.price_terms ?? null,
        price_terms_url: v.price.price_terms_url ?? null,
      }
    : null;
  const battery = v.battery_kwh ? { ...datum(v.battery_kwh)!, basis: v.battery_kwh.basis } : null;
  return {
    name: v.name,
    price,
    wltp_km: datum(v.wltp_km),
    battery_kwh: battery,
    power_kw: datum(v.power_kw),
    drivetrain: datum(v.drivetrain),
    dc_max_kw: datum(v.dc_max_kw),
    ac_max_kw: datum(v.ac_max_kw),
  };
}

/**
 * Allow-list projection of a model for `/comparar/datos/{brand}/{model}.json` (PRD-003, section 6).
 * Fields are listed one by one: a new schema field is not published until a PRD asks for it.
 * `slug` is the model's file name, the same `{modelo}` the model page uses.
 */
export function projectModel(
  m: Pick<ModelRecord, "brand" | "brand_name" | "model" | "status" | "launch" | "versions">,
  slug: string,
): PublishedModel {
  return {
    brand: m.brand,
    slug,
    brand_name: m.brand_name,
    model: m.model,
    status: datum(m.status)!,
    launch: datum(m.launch),
    versions: m.versions.map(projectVersion),
  };
}
