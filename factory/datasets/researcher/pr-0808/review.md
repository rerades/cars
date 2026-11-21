🏭 Veredicto: hay que cambiar antes de entrar — criterio inconsistente entre P2 y P4 con el mismo tipo de oferta, y una `price_terms_url` sin leer; revisado `a3d5a7d22162964b981d87e60ff1c64db29e3f29`. CI en verde.

**Criterios de aceptación** (refresco ADR-0010 punto 6)
- Releer y actualizar `retrieved`: cubierto, hay llamada a la `price.url` de P2, P3 y P4 (y a la reseña de motorpasion y media.polestar).
- Fuentes verificadas (`last_verified`): cubierto, `polestar-es` y `polestar-press`.
- Precio caducado (punto 8): P2 y P3 pasan a `null` porque su oferta venció el 30/09/2026: correcto.
- Quitar de open_questions lo resuelto, no tocar `needs_review`, bitácora: cubierto.

**Hallazgos**
1. `polestar-2.yaml`: la propia nota dice que la ficha conserva un ejemplo de financiación válido hasta 31/12/2026 con «PVP: 41.900 €» y «Precio financiando: 40.932 €». En P4 ese mismo tipo de ejemplo se acepta como `financed` (49.900 €); en P2 se descarta. O vale en ambos o en ninguno: explicar la diferencia en `open_questions` o volver a guardar el precio de P2 con esa oferta.
2. `polestar-4.yaml`: `price_terms_url` pasa a `/es/polestar-4-models/polestar-4-coupe/`, que ninguna llamada de la traza ha leído (solo `/es/polestar-4/`). Dejar la URL leída, o leer la nueva con `fetch-page.ts`.
3. `polestar-4.yaml`: el texto de Canarias (42.240 €) se incorpora a `price_terms`; correcto y literal, sin objeción.

**Lo que no he podido comprobar**: el contenido íntegro de las salidas de `fetch-page.ts` (solo he visto las llamadas), así que no he cotejado los textos legales literalmente.
