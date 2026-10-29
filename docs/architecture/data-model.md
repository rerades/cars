---
status: accepted
updated: 2026-10-29
---

# Modelo de datos

Referencia del esquema de los ficheros `data/raw/<marca>/<modelo>.yaml`. La decisión y sus
alternativas están en [ADR-0008](adr/0008-esquema-unico-de-datos-raw.md) (propuesta): este
documento es vigente cuando esa ADR se acepte. Las reglas de fuente y de precio vienen de
[ADR-0001](adr/0001-fuentes-de-datos.md) y no se repiten aquí más que en su forma de campo.

```
Marca 1───* Modelo 1───* Versión
             │            │
             │            └── Precio (0..1, en España, con fecha y fuente)
             ├──* Review (enlace a un tercero; 0..1 versión)
             └──* Resultado de prueba (0..1 versión)
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
| `tier` | `T1` \| `T2` \| `T3` \| `E` | sí | El de la fuente en el registro. `E` solo en `segment` (abajo) |
| `note` | texto | no; **sí con `tier: E`** | Matiz del dato ("hasta 631 km, máximo de la gama") |

**Excepción editorial (`tier: E`, [ADR-0021](adr/0021-segmento-editorial.md), regla 8 de ADR-0001).**
Solo vale en `segment` (sección 3), nunca en otro campo, en `images`, `reviews` ni `test_results`.
Con `tier: E`: `source_id` es `editorial` (y `editorial` solo va con `E`); `url` es la de la PR que
introduce el valor; `retrieved` es la fecha de la decisión; `note` es obligatoria y no vacía. Lo
escribe solo una persona: ningún agente añade, cambia ni borra un valor `E`; el Researcher solo lo
sustituye por el de una fuente T1–T3 que clasifique el modelo (ADR-0021, punto 4).

Son los cuatro nombres que ya comprueba el eval de ADR-0004, sin cambios. Solo tres campos añaden
claves propias: `basis` en `battery_kwh`; `unit`, `price_kind`, `price_terms`,
`price_terms_url` y `page_name` en `price`; y `test`, `metric` y `version` en cada `test_results` (sección 3.1).

## 3. Nivel de modelo

| Campo | Tipo / valores | Obligatorio | Necesario para |
|---|---|---|---|
| `brand` | slug (`cupra`); igual al nombre de la carpeta | sí | RF-2, RF-4 |
| `brand_name` | texto de presentación (`Cupra`); igual en todos los ficheros de la carpeta | sí | RF-1 |
| `model` | texto de presentación (`Born`). El fichero es `<slug de model>.yaml` | sí | RF-1 |
| `status` | `Sourced`; `value`: `on_sale` \| `announced` \| `discontinued` | sí | RF-2, RF-7 |
| `launch` | `Sourced`; `value`: texto `"YYYY-MM"` o `"YYYY-MM-DD"` (inicio de venta en España) | no | RF-3 (novedad), RF-7 |
| `segment` | `Sourced`; `value`: `urbano` \| `compacto` \| `berlina` \| `familiar` \| `suv_pequeno` \| `suv_compacto` \| `suv_grande` \| `monovolumen` \| `furgoneta` \| `deportivo`. Único campo que admite `tier: E` (sección 2) | no (ver nota) | RF-1, RF-2, RF-10, RF-11 |
| `needs_review` | booleano | sí | ADR-0001, regla 3 |
| `specs` | mapa de valores agregados del modelo (abajo) | no | RF-1, RF-2 |
| `versions` | lista de versiones (sección 4); puede ir vacía si `announced` | sí | todo |
| `images` | lista de imágenes (forma abajo); `[]` si no hay ninguna con licencia válida | sí | RF-8, CA-10, CA-17 |
| `reviews` | lista de enlaces a reviews de terceros (sección 3.1); ausente o `[]` si no hay | no | PRD-006, RF-7 |
| `test_results` | lista de resultados de pruebas de organismos independientes (sección 3.1); ausente o `[]` | no | PRD-006, RF-9 |
| `open_questions` | lista de textos | no | — |

- `launch` es la fecha prevista si el estado es `announced` (ADR-0001, regla 4) y la de inicio de
  venta en España si es `on_sale`. **Inicio de venta** es la fecha desde la que se puede pedir el coche en
  España (apertura de pedidos o del configurador), que la fuente dé como tal. No lo son la fecha de
  publicación del artículo, una fecha sacada de la URL ni una previsión que nadie ha confirmado después.
  Sin una fecha así, `launch` se deja `null` y se anota en `open_questions`.
- `status: on_sale` exige que la fuente diga que el coche ya se puede pedir o ya se entrega en España.
  Si solo anuncia una fecha futura de venta o de entregas, sin pedidos abiertos, es `announced`. Si no se
  puede confirmar que se sigue vendiendo hoy (por ejemplo, la única fuente es un artículo de hace años) o
  qué versiones se venden hoy, el modelo lleva `needs_review: true`.
- **`segment` es opcional: un modelo sin él se publica con "por confirmar" (RF-12)**. Casi ninguna
  fuente de marca lo da de forma explícita. El Researcher lo rellena con la fuente que lo
  clasifique (puede ser T3, que ADR-0001 admite para confirmar datos) y, si no la hay, lo deja
  `null` y lo anota. Regla de asignación: el valor de la lista de RF-11 que use la fuente, **con ese término
  literal** («berlina», «SUV compacto»…); un SUV o crossover va a `suv_pequeno`, `suv_compacto` o
  `suv_grande` solo si la fuente lo presenta así o con una de las equivalencias de esta tabla cerrada, que es la
  única traducción permitida, con el tipo de carrocería y la letra de segmento **en la misma fuente** (decisión del 2026-10-26, PRD-001):

  | La fuente dice | `segment` |
  |---|---|
  | SUV o crossover + «segmento B» (o «B-SUV») | `suv_pequeno` |
  | SUV o crossover + «segmento C» (o «C-SUV»), o «crossover compacto» | `suv_compacto` |
  | SUV o crossover + «segmento D» o «segmento E» (o «D-SUV», «E-SUV») | `suv_grande` |

  La `note` cita la frase literal de la fuente. Cualquier otro término que no esté en la lista ni en
  la tabla («SUV mediano», «SUV» sin tamaño, «segmento D» sin carrocería) no se traduce por tamaño ni
  por parecido: `null` y anotado. Con una
  fuente T3 vale lo mismo (decisión del 2026-10-13). Sin segmento, la
  tarjeta dice "por confirmar" y el modelo no sale en ese filtro (RF-12).
- **Clasificación editorial (`tier: E`, [ADR-0021](adr/0021-segmento-editorial.md)).** Si tras la
  regla y la tabla anteriores ninguna fuente clasifica el modelo, **una persona** con permiso de
  fusión puede asignarle el segmento en una PR propia, con la forma de la sección 2:

  ```yaml
  segment:
    value: suv_compacto
    source_id: editorial
    url: "<URL de la PR que introduce el valor>"
    retrieved: 2026-10-27        # fecha de la decisión
    tier: E
    note: "Fuentes: acme-es lo llama «SUV» sin tamaño (URL, 2026-10-20). Longitud 4 420 mm (ficha técnica de acme-es, URL, 2026-10-20). Criterio: data-model.md, sección 3, regla E4."
  ```

  (Ejemplo ficticio, como el de la sección 7.)

  La entrada de `open_questions` que anotaba la falta de segmento se conserva. Un valor `E` no es
  permanente: el Researcher lo sustituye cuando una fuente T1–T3 clasifica el modelo según la regla y
  la tabla, y lo dice en la PR si el valor de la fuente es otro. Ningún agente escribe, cambia ni
  borra un `E`.

  **Criterio común de la clasificación editorial.** La `note` de cada valor `E` cita la regla aplicada
  (`E1`…`E7`) y los datos que la sostienen, cada uno con su fuente, URL y fecha. Las reglas se
  aplican **en este orden** y vale la primera que se cumple. Solo usan rasgos que una fuente publica
  (carrocería, puertas, plazas, versión de carga, longitud exterior); nunca el precio, la potencia, el
  parecido con otro modelo ni la impresión de quien clasifica. Si un dato que la regla necesita no lo
  publica ninguna fuente, esa regla no se cumple; si no se cumple ninguna, **no hay valor `E`**: el
  campo sigue `null` y anotado.

  | Regla | Se cumple si (según una fuente, con URL y fecha) | `segment` |
  |---|---|---|
  | E1 | Carrocería de 2 o 3 puertas (coupé, roadster, cabrio) y 4 plazas o menos | `deportivo` |
  | E2 | La marca vende del mismo modelo una versión de carga (sin asientos traseros, homologada como comercial) | `furgoneta` |
  | E3 | Puertas laterales traseras correderas, o tres filas de asientos, y ninguna fuente lo llama SUV ni crossover | `monovolumen` |
  | E4 | Alguna fuente lo llama SUV o crossover (sin tamaño, o con un tamaño que no está en la tabla): según su longitud exterior, menos de 4 350 mm → `suv_pequeno`; de 4 350 a 4 649 mm → `suv_compacto`; 4 650 mm o más → `suv_grande` | `suv_*` |
  | E5 | La marca vende la carrocería como familiar: la fuente la nombra «familiar», «ranchera», «estate», «wagon», «touring», «tourer», «sportswagon», «sports tourer» o «SW» | `familiar` |
  | E6 | Cuatro puertas con tapa de maletero que no incluye la luneta (tres volúmenes), o cualquier carrocería de 4 o 5 puertas de 4 650 mm o más que no cumpla E1–E5 | `berlina` |
  | E7 | Carrocería de 4 o 5 puertas que no cumple E1–E6: menos de 4 000 mm → `urbano`; de 4 000 a 4 649 mm → `compacto` | `urbano` \| `compacto` |

  - **Longitud:** la exterior en milímetros que publique la ficha técnica de la marca (T1) o, si no la
    publica, una fuente T2–T3; si dos fuentes difieren, la de nivel más alto (ADR-0001, regla 3). Si
    las versiones tienen longitudes distintas, la mayor. No hay campo de longitud en este esquema: va
    solo en la `note`.
  - **Los umbrales (4 000, 4 350 y 4 650 mm) son una convención de esta web**, no una norma ni la
    clasificación de nadie. No se han contrastado con datos de producto (el Arquitecto no los obtiene,
    ADR-0001). Cambiarlos es cambiar este documento, y los valores `E` ya asignados con el umbral
    anterior se revisan en la misma PR.
  - Lo que la fuente sí dice manda sobre el criterio: si una fuente llama al coche «berlina», se aplica
    la regla de arriba (valor de fuente), no E6.
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
  nada a terceros (RNF-5). La descarga la hace un script determinista que lanza el Researcher
  (ADR-0010, enmienda «Imágenes»); solo se guarda JPEG o PNG. Si la descarga falla, no se escribe la entrada: se anota en
  `open_questions` y la tarjeta muestra la silueta. Orden de fuentes de PRD-001, RF-8: Wikimedia
  Commons con licencia que permita uso comercial; sala de prensa solo con términos escritos que lo
  permitan. Sin imagen, la web muestra la silueta del segmento (CA-17).
- `specs` solo recoge lo que la fuente publica **para el modelo entero** y no por versión. Campos
  permitidos: `wltp_max_km`, `power_max_kw`, `dc_max_kw`, `ac_max_kw`, `battery_kwh_options`
  (lista de números) y `drivetrains` (lista de valores de tracción). `specs` no lleva `unit`.

### 3.1 Reviews y resultados de pruebas ([ADR-0017](adr/0017-esquema-de-las-reviews.md))

Las dos listas viven en el fichero de su modelo: no hay review sin modelo, y un modelo con
`needs_review: true` no publica las suyas (PRD-006, RF-4). Todo lo que hay en ellas es de un
tercero; no hay ningún campo para un texto propio, un resumen, una nota ni una traducción
(PRD-006, RF-6). Por eso `summary`, `excerpt`, `rating`, `text` y `outlet` son claves desconocidas.

**`reviews`**: un enlace a una review de un medio. No es un `Sourced`, porque no tiene `value`.

| Clave | Tipo | Obligatoria | Nota |
|---|---|---|---|
| `title` | texto | sí | Título **literal** de la pieza, en su idioma, sin traducir ni acortar (RF-6, RNF-4) |
| `url` | URL `https://` | sí | La URL exacta de la review, del dominio de la fuente |
| `source_id` | texto | sí | Fichero de `data/sources/` con `kind: [reviews]`; su `name` es el medio que ve el visitante |
| `retrieved` | `YYYY-MM-DD` | sí | Fecha en que se comprobó que la página existe y trata de este modelo; no futura |
| `tier` | `T2` \| `T3` | sí | El de la fuente en el registro. `T1` no: la web de la marca no es una review |
| `version` | texto | no | `name` de una versión de este fichero, si la review trata solo de esa; ausente = el modelo |

**`test_results`**: un dato de un organismo de pruebas independiente. Es un `Sourced` (sección 2)
con tres claves más:

| Clave | Tipo | Obligatoria | Nota |
|---|---|---|---|
| `test` | texto | sí | Nombre literal de la prueba o del protocolo, como lo publica el organismo |
| `metric` | valor de la lista de abajo | sí | Fija el tipo, la unidad (en el nombre, `_km`, `_kwh`…; sin `unit`) y el rango de `value` |
| `version` | texto | no | `name` de una versión de este fichero si el organismo probó esa; ausente = el modelo |

Su `tier` es `T2` y su `source_id` es una fuente con `kind: [tests]`.

**Lista de `metric`: vacía.** Ningún documento sabe todavía qué publica cada organismo. La primera PR
del Researcher que registre un organismo propone sus métricas en `notes` de la fuente, y una persona las
añade aquí, con su tipo, unidad y rango, y en `METRICS` de `factory/evals.ts`, antes o en la misma PR.
Hasta entonces, cualquier `test_results` no vacío falla.

Ejemplo (ficticio, como el de la sección 7). Se añade al fichero de `acme/volta.yaml`, y la fuente
`motorejemplo-es` es un medio inventado:

```yaml
reviews:
  - title: "Acme Volta 80 AWD: probamos el SUV eléctrico de 520 km"
    url: "https://www.motor.example/pruebas/acme-volta-80-awd"
    source_id: motorejemplo-es
    retrieved: 2026-09-20
    tier: T3
    version: Volta 80 AWD
  - title: "Acme Volta, primera prueba"
    url: "https://videos.motor.example/acme-volta"
    source_id: motorejemplo-es
    retrieved: 2026-09-20
    tier: T3
```

```yaml
# data/sources/motorejemplo-es.yaml — Researcher. Esquema: docs/architecture/data-model.md, sección 8.
id: motorejemplo-es
brand: (varias; medio del motor)
name: Motor Ejemplo
tier: T3
market: ES
kind: [reviews]
urls:
  home: https://www.motor.example/
terms_url: https://www.motor.example/aviso-legal
terms_checked: 2026-09-20
image_license: ""
notes: >
  Ejemplo de la forma; no es un medio real.
last_verified: 2026-09-20
status: active
```

El host de cada `url` tiene que ser el de alguna URL de `urls` de su fuente, sin el `www.` inicial, o
un subdominio suyo: `videos.motor.example` vale con `https://www.motor.example/`. Un medio que
publica en otro dominio necesita ese dominio en sus `urls`.

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
| `page_name` | nombre de la versión tal como lo escribe la página de `url`, copiado literal | no; solo si la página nombra la versión junto al precio y no es ya su `name` (ADR-0020, enmienda «Nombre de la versión en la página») |

`tier` de un precio debe ser `T1` (ADR-0001, regla 1).

**Qué importe se guarda en un `financed`** (decisión del 2026-10-25): si las condiciones dan un
precio al contado («precio al contado», «PVP al contado», «precio contado») además del precio
financiando, `value` es **el de contado**, aunque también lleve promoción. Es lo que paga quien no
pide el préstamo. Solo si no hay precio al contado se guarda el precio financiando. El otro importe
puede ir en `note`. Así, «Precio desde» (sección 5) compara el mismo tipo de importe en todas las
marcas.

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
   `tier: E` solo en `segment`, y entonces con `source_id: editorial` y `note` no vacía;
   `source_id: editorial` solo con `tier: E` (ADR-0021, punto 4). En el eval de las ejecuciones de
   agentes, además, falla toda ejecución que añada, cambie o borre un `segment` con `tier: E`
   respecto a `main`, salvo que lo sustituya por un valor T1–T3 (PRD-001, CA-21). La fusión
   automática no acepta un diff que añada o cambie un `tier: E` (ADR-0011, enmienda de ADR-0021).
4. Los valores enumerados están en su lista; los números son > 0 y `wltp_km` es entero.
5. `price`: `price_kind` presente; `financed` con `price_terms` y `price_terms_url`; `pvp` sin ellos;
   `unit: EUR`; `tier: T1`. `page_name`, si está, no es vacío ni igual al `name` de su versión
   (sin distinguir mayúsculas, guiones ni espacios repetidos).
6. Los `name` de versión no se repiten. `status: on_sale` exige al menos una versión.
7. `brand_name` es igual en todos los ficheros de la misma carpeta.
8. `specs.wltp_max_km` coincide con el máximo de las versiones cuando las dos existen.
9. `unit` aparece solo en `price`; `basis` solo en `battery_kwh`.
10. Cada entrada de `images` tiene `file`, `source_url`, `page_url`, `source_id`, `retrieved`,
    `license` y `attribution`; no tiene `url`; `file` existe, está bajo
    `data/images/<brand>/<slug>/` y es una imagen (ADR-0012): JPEG o PNG por la firma de sus
    primeros bytes, con la extensión que corresponde (`.jpg`/`.jpeg` o `.png`), de 1280 px de
    ancho como máximo, leído de su cabecera (ADR-0010, enmienda «Imágenes», punto 11), y de 2 MB
    como máximo (ADR-0011, enmienda «Imágenes», punto 10).
    **Transición** (ADR-0010, punto 14): hasta que se migren las imágenes actuales, una entrada con
    solo la forma antigua (`url`, sin `file`, `source_url` ni `page_url`) es aviso en la validación
    de todo `data/raw/` y fallo en el eval de la factoría sobre los ficheros que toca la ejecución;
    mezclar `url` con las claves nuevas es siempre fallo. Tras la migración, `url` es clave
    desconocida (regla 2). Un fichero de `data/images/` que ningún YAML cita es aviso, no fallo.
11. `reviews` y `test_results` (sección 3.1, ADR-0017), si están, son listas, y cada entrada tiene sus
    claves obligatorias y ninguna más. Su `source_id` está en el registro, y esa fuente tiene en
    `kind` `reviews` (para `reviews`) o `tests` (para `test_results`), más `name`, `terms_url` y
    `terms_checked`. Su `tier` es el de la fuente: `T2` o `T3` en `reviews`, `T2` en `test_results`.
    Su `url` es `https://` y su host es el de una URL de la fuente o un subdominio suyo. `retrieved`
    no es futura. `version`, si está, es el `name` de una versión del mismo fichero. No hay dos
    `reviews` con la misma `url` ni dos `test_results` con la misma `source_id`, `test`, `metric` y
    `version`. `metric` está en la lista de la sección 3.1 y `value` cumple su tipo y rango.
    Solo avisan, como en ADR-0010: un `retrieved` de más de 45 días, una fuente `broken`, una `url`
    con parámetros (`?…`, que pueden ser de seguimiento o de afiliación) y un modelo con
    `needs_review: true` que tiene reviews o resultados.

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
| `tier` | `T1` \| `T2` \| `T3` \| `E` | sí | ADR-0001. `E` solo en `editorial.yaml` (abajo) |
| `market` | `ES` \| `EU` \| código de país (`FR`, `DE`…) \| `global` | — | |
| `kind` | lista de `prices` \| `specs` \| `images` \| `announcements` \| `reviews` \| `tests` | — | `reviews`: medio cuyas reviews se enlazan; `tests`: organismo de pruebas (ADR-0017) |
| `name` | texto de presentación del medio u organismo (`Motor Ejemplo`) | sí si `kind` tiene `reviews` o `tests` | Lo que ve el visitante junto al enlace (PRD-006, RF-7) |
| `terms_url` | URL `https://` | sí si `kind` tiene `reviews` o `tests` | Página de términos o de reutilización que se leyó (PRD-006, RF-8 y CA-7) |
| `terms_checked` | `YYYY-MM-DD` | sí si `kind` tiene `reviews` o `tests` | Fecha en que se leyeron; no futura. Si permiten enlazar lo decide la regla 6 de ADR-0001 |
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

**La fuente editorial (`data/sources/editorial.yaml`, [ADR-0021](adr/0021-segmento-editorial.md),
punto 3).** Es la única fuente con `tier: E` y la única cuyo `id` no tiene la forma
`<marca>-<país|press|eu>`. **La crea una persona**, no el Researcher, y una PR que la toque no se
fusiona sola (ADR-0011, enmienda de ADR-0021). Forma:

```yaml
# data/sources/editorial.yaml — una persona. Esquema: docs/architecture/data-model.md, sección 8.
id: editorial
name: Clasificación editorial
tier: E
urls:
  adr: <URL de docs/architecture/adr/0021-segmento-editorial.md en el repositorio>
notes: >
  Segmento asignado por una persona cuando ninguna fuente lo clasifica (ADR-0021). Criterio común:
  docs/architecture/data-model.md, sección 3.
last_verified: <fecha en que se crea o se revisa>
```

Sin `brand`, `market`, `kind`, `image_license` ni `status`: no es un tercero, no tiene términos ni
imágenes, y no se rompe. `last_verified` sigue siendo obligatoria para que la regla 3 de 8.3 sea la
misma para todas las fuentes, pero no genera aviso de antigüedad (8.3, regla 6).

### 8.3 Reglas comprobables del registro

1. Cada `data/sources/*.yaml` es YAML válido y es un mapa (no una lista).
2. `id` existe y es igual al nombre del fichero sin `.yaml`. Como el sistema de ficheros no admite
   dos ficheros con el mismo nombre, esto garantiza que no hay `id` repetidos.
3. `tier` es `T1`, `T2` o `T3`, o `E` solo si el fichero es `editorial.yaml` (que tiene que llevar
   `E`); `urls` tiene al menos una entrada; `last_verified` es una fecha no futura.
4. Todo `source_id` de `data/raw/` (valores, `images`, `reviews` y `test_results`) tiene su fichero `data/sources/<source_id>.yaml`.
5. Una fuente con `reviews` o `tests` en `kind` tiene `name`, `terms_url` (`https://`) y
   `terms_checked`; `terms_checked`, en cualquier fuente que la tenga, es una fecha no futura (ADR-0017).
6. Avisos de antigüedad de ADR-0010 (punto 5) y los valores `E` (ADR-0021, pregunta 5): la fuente
   `editorial` no avisa por `last_verified` de más de 45 días ni cuenta para marcar una marca como
   vencida. El aviso de `retrieved` de ADR-0010 es solo de precios, que nunca son `E`, así que un
   `segment` `E` no avisa por su fecha. Si un día ese aviso se amplía a otros campos, los `E` quedan
   fuera.

### 8.4 Qué cambia y quién lo hace

**Hecho el 2026-10-06** (#164), en una sola PR, tal como se describe aquí, incluida la prueba de dos
ramas rebasadas sin conflicto (`factory/tests/evals.test.ts`).

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
