# ADR-0008 — Esquema único para los YAML de `data/raw/`

- **Estado:** aceptada (2026-09-27)
- **Fecha:** 2026-09-27

## Contexto
`data/raw/<marca>/<modelo>.yaml` no tiene esquema: `docs/architecture/data-model.md` era un borrador
sin nombres de campo. Cada marca ha salido distinta (ficheros leídos el 2026-09-27):

| Aspecto | Cupra (`data/raw/cupra/*.yaml`) | Polestar (`data/raw/polestar/*.yaml`) |
|---|---|---|
| Marca | `brand: cupra` (slug) | `brand: Polestar` (nombre) |
| Estado | `status: {value, source_id, url, …}` | `status: on_sale` (texto, sin fuente) |
| Datos del modelo | bloque `model_level` | bloque `specs` |
| Autonomía | `wltp_max_km` (modelo), `wltp_km` (versión) | `wltp_range_max` (modelo) |
| Potencia | `power_cv` en CV (`born.yaml`) o `power_kw` (`tavascan.yaml`) | `power_max` en kW |
| Carga DC | `dc_max_kw` | `dc_charge_max` |
| Tracción | `drive` (`FWD`, `AWD`) por versión | `drivetrain: AWD (Dual Motor)` (`polestar-3.yaml`) |
| `unit` | solo en el precio | en cada valor |

`web/src/lib/data.ts` (`normalize`) aguanta las dos formas con parches: fusiona `model_level` y
`specs` y acepta `status` con o sin fuente. Hay 12 marcas pendientes de investigar y la tarea es
fijar el formato antes.

Lo que obliga a decidir:
- **RF-1** pide segmento en la tarjeta y **ninguna marca lo registra**. **RF-2** filtra por
  autonomía, precio, tracción, estado y segmento: deben ser comparables entre marcas (mismo nombre,
  unidad y valores). **RF-7** y **RF-9** necesitan `status` y `price_kind` uniformes. **RF-3**
  ordena por novedad y ningún fichero trae una fecha de lanzamiento.
- **ADR-0001, regla 2:** cada valor lleva `source_id`, `url`, `retrieved` y `tier`, y el eval de
  **ADR-0004** (`factory/evals.ts`, comprobación `rawData`) recorre todo objeto con `value` y exige
  esos cuatro nombres. Un traductor no puede perderlos.
- **Quién escribe:** los YAML no son copias del formato de una marca: los escribe el agente
  Researcher a partir de webs HTML (`.claude/agents/researcher.md`). La divergencia de la tabla es
  deriva del agente entre ejecuciones, no un formato externo.
- **Futuro:** podría haber lectores automáticos por marca. No existe ninguno hoy.

## Opciones consideradas
### A. Esquema único validado al escribir
El Researcher escribe siempre en un formato común, definido en `data-model.md`, y una comprobación
(en el mismo punto que los evals de ADR-0004) rechaza el fichero que no encaje, con el mismo efecto
que un eval fallido: la rama no abre PR.

### B. Puertos y adaptadores
Cada marca conserva su formato en `data/raw/` y un adaptador por marca lo traduce al esquema común
que lee la web.

### Por qué se descarta B (por ahora)
1. **No hay formato de marca que conservar.** B protege la forma original de la fuente, pero aquí el
   "formato de la marca" lo inventa el Researcher en cada ejecución. Los adaptadores traducirían
   deriva, no un contrato: cada cambio de humor del agente rompe un adaptador. Sería fijar un
   formato por marca (lo que A ya hace, una vez) y encima mantener la traducción.
2. **La fuente y la fecha son el punto débil de B.** ADR-0001 exige `source_id`, `url`, `retrieved` y
   `tier` en cada valor. Un adaptador tiene que llevar esa procedencia dato a dato por la traducción
   (por ejemplo, `power_cv` → `power_kw` sin perder de dónde salió). Cada adaptador es una nueva
   ocasión de perderla, y el eval de ADR-0004 solo la comprobaría en la entrada, no en la salida,
   salvo que se duplique. En A la procedencia es parte del esquema y se comprueba en un solo sitio.
3. **Coste lineal en marcas.** 12 marcas esperando son 12 adaptadores, cada uno con sus pruebas, y
   un cambio de campo de la web toca los 12. En A toca un documento y una migración.
4. **La ventaja de B es real solo con lectores automáticos**, que no existen. Entonces el
   adaptador vale la pena en el borde de entrada: leer la web de una marca y emitir el esquema
   común. Eso es compatible con A (el lector es un productor más y su salida pasa por la misma
   comprobación); B como capa entre `data/raw/` y la web sería la parte innecesaria.

## Decisión
**Un esquema único para `data/raw/<marca>/<modelo>.yaml`, definido en `docs/architecture/data-model.md`,
que el Researcher escribe siempre y que una comprobación automática rechaza si no se cumple.**

Detalle (la referencia completa, con el ejemplo válido, está en `data-model.md`):

- **Nivel de modelo:** `brand` (slug = carpeta), `brand_name`, `model`, `status` (con fuente),
  `launch` y `segment` (con fuente, opcionales), `needs_review`, `specs`, `versions`, `images`,
  `open_questions`. Un solo bloque `specs` para lo que la fuente publica del modelo entero; se
  eliminan `model_level` y el `specs` heterogéneo de hoy.
- **Nivel de versión:** `name`, `battery_kwh` (con `basis: usable|gross|unknown`), `wltp_km`,
  `power_kw`, `drivetrain`, `dc_max_kw`, `ac_max_kw` y `price` (clave obligatoria, puede ser `null`).
- **Unidades:** la unidad va en el nombre (`_kw`, `_km`, `_kwh`) y no se escribe `unit`, salvo en
  `price` (`EUR`). Sin CV: si solo hay CV, se convierte a kW y la nota conserva el dato publicado.
- **Valores permitidos:** `status`: `on_sale | announced | discontinued`. `drivetrain`:
  `fwd | rwd | awd`. `segment`: `urbano | compacto | berlina | familiar | suv_pequeno | suv_compacto | suv_grande |
  monovolumen | furgoneta | deportivo` (PRD-001, RF-11; se amplía cambiando el PRD y `data-model.md`). Minúsculas y `snake_case`.
- **Valor con fuente:** `value`, `source_id`, `url`, `retrieved`, `tier`, más `note` opcional.
  **Precio:** ese formato más `unit`, `price_kind` (siempre), y `price_terms` y `price_terms_url`
  obligatorias si `financed` y prohibidas si `pvp`. Ambos son ADR-0001 tal cual.
- **Obligatorios:** `brand`, `brand_name`, `model`, `status`, `needs_review`, `versions`, `images`;
  por versión `name` y `price`. El resto es opcional: ausente o `null` significa "sin fuente", nunca
  una estimación (ADR-0001, regla 7).
- **Segmento (RF-1):** campo nuevo de modelo, con fuente. Un fichero sin segmento es válido pero su
  tarjeta queda incompleta; se anota en `open_questions`. Tracción, autonomía, precio y estado
  (RF-2) tienen un solo nombre y una sola unidad.
- **Autonomía y tracción del modelo** se derivan de las versiones; `specs.wltp_max_km` y
  `specs.drivetrains` solo cuando la fuente no da versión por versión (caso Polestar).
- **`launch`:** fecha de inicio de venta en España (`YYYY-MM`), con fuente. Ordena por novedad
  (RF-3) y da la fecha prevista de un modelo `announced` (RF-7).
- **`brand_name`** va en cada fichero y la comprobación exige que sea igual en toda la carpeta.
- **CV a kW:** se acepta. `power_kw` = CV × 0,7355, redondeado a entero, con la fuente del dato en
  CV y `note: "publicado: 204 CV"`. Es un cambio de unidad exacto, no una estimación (ADR-0001, regla 7).
- **`images`:** la forma queda fijada (`url`, `source_id`, `retrieved`, `license`, `attribution`),
  pero el Researcher deja `images: []` hasta que PRD-001 resuelva la licencia de las imágenes.
- **Fuera de esta decisión:** la comprobación automática, la migración de Cupra y Polestar, la
  retirada de los parches de `web/src/lib/data.ts`, el cambio de `.claude/agents/researcher.md` y
  el mercado (solo España).

## Consecuencias
**Buenas**
- Un solo formato para leer, filtrar y validar: la web puede quitar los parches de `normalize`.
- La procedencia no se traduce, así que no se puede perder al pasar de un formato a otro; el eval de
  ADR-0004 sigue valiendo tal cual.
- Coste constante al añadir marcas: el Researcher aprende un formato, no doce.

**Malas (las que se olvidan)**
- **Hasta que exista la comprobación, esta ADR no impide nada.** Sin ella la deriva puede seguir en
  las 12 marcas nuevas. La comprobación y el ajuste de `researcher.md` (que hoy dice "carga AC/DC" y
  "potencia" sin nombres) son trabajo posterior y quien lo haga debe ser el mismo cambio que
  migra los seis ficheros actuales.
- **Rechazar cuesta una ejecución.** Si el agente escribe mal, el eval falla y la rama no abre PR:
  se paga la ejecución y el presupuesto de ADR-0002 para nada. Si el agente falla con frecuencia,
  habrá que dar el esquema como ejemplo en el prompt o añadir un paso de autocorrección.
- **Rigidez:** una clave nueva o un valor nuevo de `segment` obliga a cambiar `data-model.md`, la
  comprobación y los ficheros existentes. Es el precio de tener un solo formato.
- **`segment` es una clasificación, no un dato medido.** Ninguna marca lo da de forma explícita, y
  ADR-0001 habla de "no estimar". La regla (fuente que lo clasifique, T3 admitido, si no `null`)
  puede dejar modelos sin segmento: se muestran con "por confirmar" y no salen en su filtro ni en
  las páginas de segmento (PRD-001, RF-12).
- **`power_kw` desde CV es una conversión**, no un dato publicado. Se acepta con la nota del valor
  original, para que se pueda comprobar contra la fuente.
- **`brand_name` se repite en cada fichero de una marca.** La comprobación impide que diverja.
- **B no queda muerta:** si aparecen lectores automáticos por marca, cada uno debe emitir este
  esquema y pasar la misma comprobación. Si el volumen de marcas crece y el esquema se queda
  pequeño, esta ADR se revisa, no se rodea con adaptadores.

## Preguntas resueltas (2026-09-27)
Las decidió el responsable del producto. Las que tocan el alcance están en PRD-001 (sección 8).
1. **Segmento:** una sola lista de mercado, con SUV pequeño, compacto y grande como segmentos
   (PRD-001, RF-11). Vale una fuente T3. Descartados dos campos (tamaño y carrocería) y A–E solo.
2. **Novedad:** `launch`, la fecha de inicio de venta en España (RF-3, CA-16).
3. **`discontinued`:** se muestra con la etiqueta "Descatalogado" y es un valor más del filtro de
   estado (RF-7, CA-14).
4. **Datos ausentes:** el modelo se muestra con "por confirmar" y no sale al filtrar por ese campo
   (RF-12, CA-15).
5. **Nombre de marca:** `brand_name` en cada fichero, igual en toda la carpeta. Descartado un fichero
   de marcas aparte: un fichero más que cruzar para un solo campo.
6. **Imágenes:** forma fijada en `data-model.md`; `images: []` hasta resolver la licencia en PRD-001.
7. **CV a kW:** se acepta la conversión, con la nota del valor publicado.
