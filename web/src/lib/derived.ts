import type { Drivetrain, ModelRecord, Segment, Status } from "./data.ts";

/**
 * Derived view of one model (PRD-001 section 6, data-model.md section 5). Pure and UI-free:
 * cards, filters, sorting and generated pages read this and nothing else. It carries no display
 * text (RNF-4): the UI maps `kind` and `toConfirm` to its own strings.
 */
export interface ModelSummary {
  brand: string;
  model: string;
  /** Cheapest price of the versions, `financed` included; null means "price to be confirmed". */
  priceFrom: {
    value: number;
    /** `pvp` is a list price; `financed` is an offer price (RF-9). */
    kind: "pvp" | "financed";
    financed: boolean;
    terms: string | null;
    termsUrl: string | null;
    sourceUrl: string;
    retrieved: string;
  } | null;
  /** True when there is no price at all. */
  priceToConfirm: boolean;
  maxRangeKm: number | null;
  segment: Segment | null;
  drivetrains: Drivetrain[];
  status: Status;
  /** Start of sales in Spain, or the expected date if announced; "YYYY-MM" or "YYYY-MM-DD". */
  launch: string | null;
}

export function summarize(m: ModelRecord): ModelSummary {
  const p = m.price_from;
  return {
    brand: m.brand,
    model: m.model,
    priceFrom: p
      ? {
          value: p.value,
          kind: p.price_kind,
          financed: p.price_kind === "financed",
          terms: p.price_terms ?? null,
          termsUrl: p.price_terms_url ?? null,
          sourceUrl: p.url,
          retrieved: p.retrieved,
        }
      : null,
    priceToConfirm: p === null,
    maxRangeKm: m.max_range_km?.value ?? null,
    segment: m.segment?.value ?? null,
    drivetrains: m.drivetrains,
    status: m.status.value,
    launch: m.launch?.value ?? null,
  };
}
