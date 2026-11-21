🏭 Veredicto: hay que cambiar antes de entrar — se actualiza `retrieved` en valores que la salida de `fetch-page.ts` adjunta no muestra; revisado `a2c1b189a87ccb78b1ee0012b4bafe483b6b7fa6`. CI en verde (test, web, a11y, changes).

**Criterios de aceptación** (tarea del refresco mensual, ADR-0010 punto 6)
- Releer valores y actualizar `retrieved`: parcial. Born/Raval/Tavascan se llamaron todos a su `price.url`. Los precios (36.795,59 / 32.072,74 / 37.151,49 €) coinciden con el texto legal de la salida y no cambian.
- Verificar fuentes (`last_verified`, status): cubierto, `cupra-es` y `cupra-press` con llamada en la traza.
- Precio caducado (punto 8): cubierto, las ofertas dicen «válida hasta el 31/10/2026» (hoy) y se deja nota para noviembre.
- Quitar de open_questions lo resuelto / no tocar `needs_review` / bitácora: cubierto.

**Hallazgos**
1. `data/raw/cupra/born.yaml`, `raval.yaml`: se fecha a 2026-10-31 lo que la salida no muestra con su número. Born: `battery_kwh_options` (el 79), `dc_max_kw` 183 y VZ `power_kw` 240 («326 CV»); la salida solo trae «CV», «kW» sueltos. Raval: `dc_max_kw` 105 y «~24 min» no aparecen. El agente sí dejó sin fecha la versión base de Raval y el segment de Tavascan por este motivo; el criterio no es el mismo en todo el PR. Hay que volver a la fecha anterior en esos campos, o releerlos con `fetch-page.ts` con las palabras clave exactas (183, 79, 326, 105).
2. `raval.yaml`: hay una pregunta abierta nueva sobre «Desde 26.000», bien tratada (no se guarda).

**Lo que no he podido comprobar**: la salida de la traza viene cortada («cut») en una de las llamadas a Tavascan, así que no descarto que haya más evidencia.
