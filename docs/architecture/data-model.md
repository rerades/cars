---
status: accepted
updated: 2026-10-06
---

# Modelo de datos

Referencia del esquema de los ficheros `data/raw/<marca>/<modelo>.yaml`. La decisión y sus
alternativas están en [ADR-0008](adr/0008-esquema-unico-de-datos-raw.md) (propuesta): este
documento es vigente cuando esa ADR se acepte. Las reglas de fuente y de precio vienen de
[ADR-0001](adr/0001-fuentes-de-datos.md) y no se repiten aquí más que en su forma de campo.

```
Marca 1───* Modelo 1───* Versión
                          │
                          └── Precio (0..1, en España, con fecha y fuente)
Cualquier valor ──> fuente (source_id, url, retrieved, tier)
```

Alcance del esquema: **solo mercado España**. Las versiones de un fichero son las que se venden (o
se anuncian) en España; no hay campo `market`. Otros mercados serían otra decisión.

## 1. Convenciones

- **Una unidad por campo, la del sufijo del nombre**: `_kw`, `_km`, `_kwh`. No se escribe `unit` en
  esos valores. Nada de CV: si una fuente solo da CV, ver la regla de conversión en la sección 5.
- Decimales con punto; números sin separador de miles.
- **Claves en inglés, `snake_case`. Valores enumerados en minúsculas, `snake_case`.**
- **Ausente = sin fuente.** Un campo opcional sin dato se omite o vale `null`; nunca se rellena con
  una estimación (ADR-0001, regla 7). Lo que falta se anota en `open_questions`.
- **Claves desconocidas = error.** Solo valen las de este documento; una clave nueva exige cambiar
  este documento primero.
- Un comentario `#` en la primera línea (agente, fuente, fecha) es libre y no se valida.

## 2. Valor con fuente (`Sourced`)

Todo dato de un coche va en este formato, en línea o en bloque:

| Clave | Tipo | Obligatoria | Nota |
|---|---|---|---|
| `value` | según el campo | sí | Tipo y unidad los fija el campo (secciones 3 y 4) |
| `source_id` | texto | sí | Debe existir en el registro: un fichero `data/sources/<source_id>.yaml` (sección 8) |
| `url` | URL | sí | La URL exacta donde se leyó |
| `retrieved` | `YYYY-MM-DD` | sí | Fecha de consulta; no futura |
| `tier` | `T1` \| `T2` \| `T3` | sí | El de la fuente en el registro |
| `note` | texto | no | Matiz del dato ("hasta 631 km, máximo de la gama") |

Son los cuatro nombres que ya comprueba el eval de ADR-0004, sin cambios. Solo dos campos añaden
claves propias: `basis` en `battery_kwh`, y `unit`, `price_kind`, `price_terms` y
`price_terms_url` en `price`.

## 3. Nivel de modelo

| Campo | Tipo / valores | Obligatorio | Necesario para |
|---|---|---|---|
| `brand` | slug (`cupra`); igual al nombre de la carpeta | sí | RF-2, RF-4 |
| `brand_name` | texto de presentación (`Cupra`); igual en todos los ficheros de la carpeta | sí | RF-1 |
| `model` | texto de presentación (`Born`). El fichero es `<slug de model>.yaml` | sí | RF-1 |
| `status` | `Sourced`; `value`: `on_sale` \| `announced` \| `discontinued` | sí | RF-2, RF-7 |
| `launch` | `Sourced`; `value`: texto `"YYYY-MM"` o `"YYYY-MM-DD"` (inicio de venta en España) | no | RF-3 (novedad), RF-7 |
| `segment` | `Sourced`; `value`: `urbano` \| `compacto` \| `berlina` \| `familiar` \| `suv_pequeno` \| `suv_compacto` \| `suv_grande` \| `monovolumen` \| `furgoneta` \| `deportivo` | no (ver nota) | RF-1, RF-2, RF-10, RF-11 |
| `needs_review` | booleano | sí | ADR-0001, regla 3 |
| `specs` | mapa de valores agregados del modelo (abajo) | no | RF-1, RF-2 |
| `versions` | lista de versiones (sección 4); puede ir vacía si `announced` | sí | todo |
| `images` | lista de imágenes (forma abajo); `[]` si no hay ninguna con licencia válida | sí | RF-8, CA-10, CA-17 |
| `open_questions` | lista de textos | no | — |

- `launch` es la fecha prevista si el estado es `announced` (ADR-0001, regla 4) y la de inicio de
  venta en España si es `on_sale`.
- **`segment` es obligatorio para publicar la tarjeta (RF-1), pero un fichero sin él es válido**:
  ninguna fuente de marca lo da de forma explícita. El Researcher lo rellena con la fuente que lo
  clasifique (puede ser T3, que ADR-0001 admite para confirmar datos) y, si no la hay, lo deja
  `null` y lo anota. Regla de asignación: el valor de la lista de RF-11 que use la fuente; un SUV o
  crossover va a `suv_pequeno`, `suv_compacto` o `suv_grande` según cómo lo presente. Sin segmento, la
  tarjeta dice "por confirmar" y el modelo no sale en ese filtro (RF-12).
- `status: discontinued` también se publica, con la etiqueta "Descatalogado" (RF-7).
- **Imagen** (forma de [ADR-0012](adr/0012-imagenes-de-los-modelos.md), aceptada; sustituye a la
  de ADR-0008, que tenía un solo `url`). Todas las claves son obligatorias:

  | Clave | Tipo | Nota |
  |---|---|---|
  | `file` | ruta relativa a la raíz del repo | `data/images/<brand>/<slug del modelo>/<nombre>.<ext>`; `<nombre>` en `[a-z0-9-]`. El fichero debe existir. Es lo único que lee el build |
  | `source_url` | URL | URL exacta del fichero descargado (en Commons, `https://upload.wikimedia.org/...`). Nunca se enlaza desde la web |
  | `page_url` | URL | Página que acredita autor y licencia (en Commons, `https://commons.wikimedia.org/wiki/File:...`; en prensa, la página de términos). Es el enlace de la atribución |
  | `source_id` | texto | Debe existir en el registro |
  | `retrieved` | `YYYY-MM-DD` | Fecha de descarga; no futura |
  | `license` | texto | Identificador (`CC-BY-SA-4.0`) o URL de los términos. Sin él no se publica (CA-10) |
  | `attribution` | texto o `null` | Texto que exige la licencia; se muestra con enlace a `page_url` |

  Se guarda una copia de 1280 px de ancho como máximo (en Commons, la miniatura estándar de 1280 px),
  en el formato en que llega; la web sirve variantes WebP generadas en el build. El visitante no pide
  nada a terceros (RNF-5). Si la descarga falla, no se escribe la entrada: se anota en
  `open_questions` y la tarjeta muestra la silueta. Orden de fuentes de PRD-001, RF-8: Wikimedia
  Commons con licencia que permita uso comercial; sala de prensa solo con términos escritos que lo
  permitan. Sin imagen, la web muestra la silueta del segmento (CA-17).
- `specs` solo recoge lo que la fuente publica **para el modelo entero** y no por versión. Campos
  permitidos: `wltp_max_km`, `power_max_kw`, `dc_max_kw`, `ac_max_kw`, `battery_kwh_options`
  (lista de números) y `drivetrains` (lista de valores de tracción). `specs` no lleva `unit`.

## 4. Nivel de versión

| Campo | Tipo / valores | Obligatorio | Necesario para |
|---|---|---|---|
| `name` | texto; único dentro del fichero | sí | RF-1 |
| `battery_kwh` | `Sourced`, número > 0; lleva además `basis`: `usable` \| `gross` \| `unknown` (obligatoria) | no | — |
| `wltp_km` | `Sourced`, entero > 0 | no | RF-1, RF-2, RF-3 |
| `power_kw` | `Sourced`, número > 0 | no | — |
| `drivetrain` | `Sourced`; `value`: `fwd` \| `rwd` \| `awd` | no | RF-2 |
| `dc_max_kw` | `Sourced`, número > 0 | no | — |
| `ac_max_kw` | `Sourced`, número > 0 | no | — |
| `price` | `Price` o `null` | **sí (clave obligatoria)** | RF-1, RF-2, RF-3, RF-9 |

`price: null` significa "hay versión pero ninguna T1 publica precio" (ADR-0001, regla 1). La clave
se escribe siempre para distinguir "no hay precio" de "no se miró".

### Precio (`Price`)

`Sourced` más:

| Clave | Valores | Obligatoria |
|---|---|---|
| `value` | número > 0; PVP en España con IVA, **sin ayudas** | sí |
| `unit` | `EUR` | sí |
| `price_kind` | `pvp` \| `financed` | sí, siempre |
| `price_terms` | texto literal de las condiciones | sí si `financed`; prohibida si `pvp` |
| `price_terms_url` | URL donde aparecen las condiciones | sí si `financed`; prohibida si `pvp` |

`tier` de un precio debe ser `T1` (ADR-0001, regla 1).

## 5. Cómo se derivan los datos del catálogo

- **Precio desde** = mínimo de `versions[].price.value` (incluye `financed`, RF-9). Sin ninguno:
  "Precio por confirmar".
- **Autonomía máxima** = máximo de `versions[].wltp_km`; si ninguna versión lo trae, `specs.wltp_max_km`.
  Si están los dos y no coinciden, el fichero no es válido.
- **Tracción del modelo** = conjunto de `versions[].drivetrain`; si ninguna, `specs.drivetrains`.
- **Estado y segmento** salen del nivel de modelo.
- **CV.** Si la fuente publica solo CV, se guarda `power_kw` = CV × 0,7355 redondeado al entero y
  `note: "publicado: 190 CV"`. Si publica ambos, vale el kW de la fuente.

## 6. Reglas comprobables

Lo que una comprobación automática tendrá que rechazar (la comprobación es trabajo posterior):

1. La ruta es `data/raw/<brand>/<slug>.yaml`, con `brand` igual a la carpeta.
2. Todas las claves obligatorias están y no hay claves fuera de este documento.
3. Todo `Sourced` cumple la sección 2; `source_id` está en el registro; `retrieved` no es futura.
4. Los valores enumerados están en su lista; los números son > 0 y `wltp_km` es entero.
5. `price`: `price_kind` presente; `financed` con `price_terms` y `price_terms_url`; `pvp` sin ellos;
   `unit: EUR`; `tier: T1`.
6. Los `name` de versión no se repiten. `status: on_sale` exige al menos una versión.
7. `brand_name` es igual en todos los ficheros de la misma carpeta.
8. `specs.wltp_max_km` coincide con el máximo de las versiones cuando las dos existen.
9. `unit` aparece solo en `price`; `basis` solo en `battery_kwh`.
10. Cada entrada de `images` tiene `file`, `source_url`, `page_url`, `source_id`, `retrieved`,
    `license` y `attribution`; no tiene `url`; `file` existe, está bajo
    `data/images/<brand>/<slug>/` y es una imagen (ADR-0012).

## 7. Ejemplo completo

Ficticio (marca `acme`, fuente `acme-es`): sirve para ilustrar la forma, no es un dato de producto y
`acme-es` no está en el registro real.

```yaml
# Researcher — Acme Volta (ejemplo ficticio). Fuente: acme-es (T1). Consultado 2026-09-20.
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
```

Un modelo anunciado se escribe igual, con `status.value: announced`, `launch` con la fecha prevista
(si la hay), `versions: []` o versiones con `price: null`.

## 8. Registro de fuentes (`data/sources/<id>.yaml`)

El registro de fuentes de [ADR-0001](adr/0001-fuentes-de-datos.md) es **un fichero por fuente**:
`data/sources/<id>.yaml`. Sustituye a la lista única `data/sources/registry.yaml` (#164, 2026-10-06).
Este apartado es la referencia del esquema que hasta ahora vivía en la cabecera de ese fichero; la
cabecera desaparece con él.

### 8.1 Por qué, y por qué aquí y no en una ADR

- **El problema (#164).** Todas las PR del Researcher que dan de alta una marca añaden su entrada al
  final de la misma lista, así que chocan entre sí al fusionarse aunque las fuentes sean distintas.
  El 2026-10-05 chocaron #159, #162, #142 y #160. Con un fichero por fuente, dos PR solo chocan si
  tocan la misma fuente, que es un conflicto real.
- **Alternativas descartadas.**
  - *Mantener la lista y ordenar las entradas por `id`:* reduce los choques pero no los elimina; dos
    altas contiguas en el orden vuelven a tocar las mismas líneas.
  - *Un driver de fusión `union` en `.gitattributes`:* no lo he comprobado en esta ejecución para
    las fusiones que hace GitHub, y aunque funcionase, unir líneas a ciegas en un YAML puede dejar
    una lista mal formada sin conflicto visible. Descartado.
  - *Un fichero por marca (`data/sources/<marca>.yaml`):* una marca tiene varias fuentes (`cupra-es`,
    `cupra-press`) y el `source_id` dejaría de coincidir con el nombre del fichero. Sin ventaja sobre
    un fichero por fuente.
- **No hace falta ADR-0014 ni enmendar ADR-0008.** Lo que decide ADR-0001 (que hay un registro
  versionado, que lo mantiene el Researcher, qué es T1/T2/T3) no cambia; cambia cómo se guarda en
  disco, que es materia de este documento, como la ruta de `data/raw/`. ADR-0008 trata solo de
  `data/raw/` y no nombra el registro. ADR-0004 habla del «registro de fuentes» sin ruta y sigue
  valiendo. **ADR-0001 sí se toca**, solo en la ruta que cita en su Decisión, con una nota de
  enmienda fechada que remite aquí.

### 8.2 Forma de cada fichero

- **Ruta:** `data/sources/<id>.yaml`, con el nombre del fichero (sin `.yaml`) **igual** a su `id`.
  `id` en kebab-case, `[a-z0-9-]`, con la forma `<marca>-<país|press|eu>` que ya se usaba.
- **Contenido:** un mapa YAML con **una sola fuente**, con las mismas claves que tenía cada entrada
  de la lista. Sin envoltorio `sources:` y sin guion de lista.
- **Solo fuentes en la carpeta:** `data/sources/` contiene únicamente ficheros de fuente. El mapa de
  marcas por registrar sale a `data/candidatas.yaml` y pierde la lista «Ya registradas» de su
  cabecera: las registradas son los ficheros de `data/sources/` (decidido el 2026-10-06, ver 8.7).
  Así un alta no toca ningún fichero compartido. Quien lea el registro lee todos los
  `data/sources/*.yaml`.

| Clave | Tipo / valores | Obligatoria | Nota |
|---|---|---|---|
| `id` | texto kebab-case | sí | Igual al nombre del fichero. Es el `source_id` de los datos |
| `brand` | texto de presentación (`Cupra`) | sí en la práctica | La cabecera antigua no la marcaba obligatoria; ver preguntas abiertas |
| `tier` | `T1` \| `T2` \| `T3` | sí | ADR-0001 |
| `market` | `ES` \| `EU` \| código de país (`FR`, `DE`…) \| `global` | — | |
| `kind` | lista de `prices` \| `specs` \| `images` \| `announcements` | — | |
| `urls` | mapa nombre → URL, al menos una | sí | Nombres de la cabecera antigua: `models`, `prices` (lista o configurador), `press` (sala de prensa). Las entradas reales usan además `home`, `news`, `legal`; la lista de nombres no está cerrada |
| `image_license` | texto; `""` si no hay licencia registrada | — | Términos de uso de imágenes y atribución exigida. Vacío = no se publican imágenes de esa fuente (ADR-0001, regla 5) |
| `notes` | texto | — | |
| `last_verified` | `YYYY-MM-DD` | sí | No futura |
| `status` | `active` \| `broken` \| `deprecated` | — | |

«Obligatoria: sí» es lo que hoy comprueba el eval de ADR-0004 (`id`, `tier`, `urls`,
`last_verified`), más la igualdad entre `id` y nombre de fichero, que es nueva. «—» es lo que la
cabecera antigua describía sin exigir; esta sección no lo endurece.

Ejemplo (ficticio, como el de la sección 7; `acme-es` no es una fuente real):

```yaml
# data/sources/acme-es.yaml — Researcher. Esquema: docs/architecture/data-model.md, sección 8.
id: acme-es
brand: Acme
tier: T1
market: ES
kind: [prices, specs, announcements]
urls:
  models: https://www.acme.example/es/volta
  prices: https://www.acme.example/es/volta/precios
image_license: ""
notes: >
  Ejemplo de la forma; no es un dato de producto.
last_verified: 2026-09-20
status: active
```

### 8.3 Reglas comprobables del registro

1. Cada `data/sources/*.yaml` es YAML válido y es un mapa (no una lista).
2. `id` existe y es igual al nombre del fichero sin `.yaml`. Como el sistema de ficheros no admite
   dos ficheros con el mismo nombre, esto garantiza que no hay `id` repetidos.
3. `tier` es `T1`, `T2` o `T3`; `urls` tiene al menos una entrada; `last_verified` es una fecha no
   futura.
4. Todo `source_id` de `data/raw/` (valores e `images`) tiene su fichero `data/sources/<source_id>.yaml`.

### 8.4 Qué cambia y quién lo hace

**El Desarrollador, en una sola PR** (cambio de la factoría, junto con la partición del registro):

- `factory/evals.ts`:
  - Quitar la constante `REGISTRY` (`data/sources/registry.yaml`).
  - El check `registry` deja de mirar si cambió `registry.yaml` y comprueba cada fichero cambiado
    que cumpla `data/sources/*.yaml`, con las reglas 1-3 de 8.3. Los mensajes
    citan la ruta del fichero (`data/sources/cupra-es.yaml: tier must be T1, T2 or T3`).
  - `rawData` y `rawShape` (hoy cada uno lee el registro por su cuenta, líneas 72 y 119) construyen,
    con una sola función compartida, el conjunto de `id` leyendo **todos** los `data/sources/*.yaml`
    del worktree (no solo los cambiados). Un fichero de fuente que no se
    pueda leer no aporta `id` y no rompe la lectura de los demás (su error ya lo da el check
    `registry` si cambió).
- `factory/tests/evals.test.ts`: pasar los casos que hoy usan `data/sources/registry.yaml` a ficheros
  por fuente, y añadir al menos: un `id` que no coincide con el nombre del fichero (falla); un fichero
  con una lista en vez de un mapa (falla); un `source_id` de `data/raw/` sin fichero en
  `data/sources/` falla (criterio de hecho de #164); y un `source_id` cuyo fichero existe pero no ha
  cambiado en la rama pasa. Y la prueba del criterio de hecho de #164: en un repo git de verdad, dos
  ramas que dan de alta fuentes distintas se rebasan una sobre otra sin conflicto (como la de
  `factory/tests/bitacora.test.ts`).
- **Mover `data/sources/candidatas.yaml` a `data/candidatas.yaml`** y quitar de su cabecera la lista
  «Ya registradas», en la misma PR.
- **Partir `data/sources/registry.yaml`** en un fichero por entrada, copiando el contenido tal cual
  (sin cambiar ningún valor), y borrar `registry.yaml`. Lo hace quien cambia `evals.ts` y en la
  **misma PR**: si el registro se parte antes que el eval, `rawData` no encuentra ningún `id` y todo
  `data/raw/` falla; si el eval cambia antes, no encuentra ninguna fuente. No lo hace el Researcher:
  es un movimiento mecánico, no obtiene datos (ADR-0001), y tiene que ir junto a un cambio en
  `factory/`.

Ojo: el agente desarrollador tiene `write_paths: [web/, docs/bitacora/]` en
`factory/budgets.yaml`, así que como agente no puede escribir ni en `factory/` ni en `data/`. Esta PR
la hace una persona, o el Desarrollador en una sesión sin `FACTORY_AGENT`, como los demás cambios de
`factory/`.

**Antes de esa PR** (orden sugerido en #164): fusionar o cerrar las PR del Researcher abiertas que
tocan `registry.yaml` (#142, #160); si no, al rebasar tendrán que mover su entrada a un fichero a mano.

**Fuera de `docs/architecture/`, en la misma PR o justo después** (no los toca el Arquitecto):

- `.claude/agents/researcher.md`: los pasos que leen y escriben `data/sources/registry.yaml` pasan a
  «leer `data/sources/*.yaml`» y «crear o editar `data/sources/<id>.yaml`». Es `.claude/`: lo cambia
  una persona.
- `data/README.md` y la cabecera de `data/candidatas.yaml` («nada de aquí es T1 hasta que se
  registre en `registry.yaml`»): las rutas nuevas.
- `docs/product/prd/PRD-001-catalogo-modelos.md` y `PRD-002-ficha-modelo.md`: la ruta nueva (Producto).
- `docs/design/ficha-modelo.md`: cita `registry.yaml` al hablar del nombre de presentación de la
  fuente (Diseño).

### 8.5 Fusión automática (ADR-0011)

**La regla no cambia.** ADR-0011 solo fusiona sin persona las PR cuyo diff está entero en `data/raw/`
y `docs/bitacora/`. `data/sources/registry.yaml` ya estaba fuera de esa lista y `data/sources/<id>.yaml`
también lo está: una PR que da de alta o modifica una fuente sigue esperando a una persona, y con ella
toda la PR, aunque traiga también ficheros de `data/raw/`. Lo que cambia es que esas PR ya no chocan
entre sí al fusionarse. El responsable decidió que no entra (2026-10-06): dar de alta una fuente T1 es una
decisión de confianza.

### 8.6 Consecuencias

- Dos PR que dan de alta fuentes distintas no chocan en el registro. `candidatas.yaml`, que habría
  sido el nuevo punto de choque por su lista «Ya registradas», sale de la carpeta y pierde esa lista,
  así que un alta no lo toca.
- El esquema del registro deja de verse al abrir el fichero; cada fichero puede llevar un comentario
  en la primera línea que remita aquí (como en el ejemplo), pero no se valida.
- **Borrar una fuente no lo detecta el eval.** `changedFiles` ignora los borrados, y la regla 4 de 8.3
  solo se comprueba en los ficheros de `data/raw/` que cambian. Una PR que borra
  `data/sources/x.yaml` mientras un dato sin tocar sigue citando `x` pasa el eval. Lo cubrirá la
  validación completa de `data/raw/` en la CI (ADR-0010, pendiente); hasta entonces, un borrado en
  `data/sources/` lo revisa una persona (ya lo hace: está fuera de la lista de ADR-0011).

### 8.7 Preguntas abiertas

Resueltas por el responsable al aceptar este diseño (2026-10-06, #171):
- ~~¿Se endurece el esquema del registro?~~ No por ahora: se valida lo de hoy.
- ~~¿Sale `candidatas.yaml` de `data/sources/`?~~ Sí, a `data/candidatas.yaml`, y sin la lista «Ya
  registradas» (ver 8.2 y 8.4).
- ~~¿Entra `data/sources/` en la lista de rutas de fusión automática de ADR-0011?~~ No: una fuente
  nueva la revisa una persona (8.5).
- `autonomia-marcas`: se deja como está; `candidatas.yaml` no se valida como dato.

Pregunta original sobre `autonomia-marcas`:
- `candidatas.yaml` cita un `source_id` `autonomia-marcas` (T3) que no tiene entrada en
  `registry.yaml` (comprobado el 2026-10-06; hay 13 entradas, de `cupra-es` a `wikimedia-commons`).
  No rompe nada porque `candidatas.yaml` no se valida como dato, pero al partir el registro no habrá
  `data/sources/autonomia-marcas.yaml`. ¿Se registra como fuente T3 o se deja como está?
