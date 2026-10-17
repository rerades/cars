import type { Sourced, Version } from "./data.ts";
import { formatDecimal, formatNumber } from "./format.ts";
import { t, type MessageKey } from "./i18n.ts";

/** One technical row of a version (RF-5, RF-6): label, the datum (for source and note) and its text; null text = no data. */
export interface VersionField {
  key: string;
  label: string;
  datum: Sourced | null;
  text: string | null;
}

/**
 * The fields of a version after the price, in the order of docs/design/ficha-modelo.md, "Campos y formato".
 * Nothing is estimated or filled from `specs`: a missing datum stays null (shown as «por confirmar»).
 */
export function versionFields(v: Version): VersionField[] {
  const field = <T>(key: string, label: MessageKey, datum: Sourced<T> | null, fmt: (value: T) => string): VersionField => ({
    key,
    label: t(label),
    datum,
    text: datum ? fmt(datum.value) : null,
  });
  return [
    field("wltp_km", "ficha.campo.autonomia", v.wltp_km, (n) => t("ficha.unidad.km", { n: formatNumber(n) })),
    field("battery_kwh", "ficha.campo.bateria", v.battery_kwh, (n) =>
      t(`ficha.bateria.${v.battery_kwh!.basis}` as MessageKey, { kwh: formatDecimal(n) }),
    ),
    field("power_kw", "ficha.campo.potencia", v.power_kw, (n) => t("ficha.unidad.kw", { n: formatDecimal(n) })),
    field("drivetrain", "ficha.campo.traccion", v.drivetrain, (d) => t(`traccion.${d}` as MessageKey)),
    field("dc_max_kw", "ficha.campo.cargaCc", v.dc_max_kw, (n) => t("ficha.unidad.kw", { n: formatDecimal(n) })),
    field("ac_max_kw", "ficha.campo.cargaCa", v.ac_max_kw, (n) => t("ficha.unidad.kw", { n: formatDecimal(n) })),
  ];
}
