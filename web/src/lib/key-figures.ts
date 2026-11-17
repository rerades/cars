import type { Sourced, Specs, Version } from "./data.ts";

/** Highest value among the versions' data, keeping the datum itself (it carries its source). */
function highest<T extends Sourced<number>>(data: (T | null | undefined)[]): T | null {
  let best: T | null = null;
  for (const d of data) if (d && (!best || d.value > best.value)) best = d;
  return best;
}

/**
 * The datum behind each key figure of the model page's first screen (docs/design/ficha-modelo.md,
 * «Cifras clave»). Price and range come already derived by `ModelRecord` (price_from, max_range_km).
 * Power: `specs.power_max_kw`, else the highest `power_kw`. Battery: the highest `battery_kwh` of the
 * versions (its `basis` is not shown here: open question 11). A missing datum is null («por confirmar»).
 */
export function powerFigure(versions: Version[], specs: Specs): Sourced<number> | null {
  return specs.power_max_kw ?? highest(versions.map((v) => v.power_kw));
}

export function batteryFigure(versions: Version[]): Sourced<number> | null {
  return highest(versions.map((v) => v.battery_kwh));
}
