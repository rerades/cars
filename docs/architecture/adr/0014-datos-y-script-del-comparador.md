# ADR-0014 — Datos y script del comparador (`/comparar`)

- **Estado:** aceptada (2026-10-13); enmendada el 2026-10-22: las estimaciones de peso se sustituyen
  por las cifras medidas con datos reales en `web/tests/comparar-build.test.ts` (#571,
  2026-10-21). La decisión no cambia.
- **Fecha:** 2026-10-13

## Contexto
PRD-003 (`ready`) pide un comparador en `/comparar` y deja a una ADR cómo llegan los datos al
navegador (**RNF-6**). Lo que obliga a decidir:

- **Sitio estático sin servidor** (ADR-0003, ADR-0009): no hay quien resuelva una petición. La
  selección vive **solo en la URL** (**RF-10**, decisión 3) y no se pregeneran combinaciones
  (decisiones 4 y 5), así que una sola página `/comparar/` tiene que leer la query string y montar
  la tabla en el navegador con JavaScript (**RNF-6**).
- **Qué datos y de quién:** solo los campos de la sección 6 de PRD-003 (identificación, `status`,
  `launch`, campos de versión con `source_id`, `url`, `retrieved`, `tier` y `note`, y `price_kind`,
  `price_terms`, `price_terms_url`), y solo de los modelos comparables: `on_sale` o `announced` y sin
  `needs_review: true` (**RF-11**, PRD-001 RF-13). Nada de `open_questions`, `needs_review`,
  `specs` ni `images` (PRD-003, sección 6). Los valores, idénticos a `data/raw/` (**RNF-5**,
  **CA-18**).
- **Clave de cada versión:** las versiones no tienen id; se identifican por `brand`, el slug del
  modelo y `name` (PRD-003, sección 6). La forma en la URL la fija `docs/design/comparador.md`, que
  se escribe a la vez que esta ADR; aquí solo se exige que la clave sea estable.
- **LCP < 2,5 s en móvil 4G** (**RNF-2**), con el catálogo actual (41 ficheros en `data/raw/`, 39
  comparables hoy: `byd/atto-2` y `cupra/raval` tienen `needs_review: true`; unas 80 versiones) y
  con unos 300 modelos, cifra que da la tarea como horizonte.
- **Sin cookies ni almacenamiento del navegador** al cargar, añadir, quitar, cambiar y compartir
  (**RNF-4**, **RF-10**, **CA-12**), comprobado en la CI con lo que ya existe de ADR-0006
  (`web/e2e/storage.spec.ts`, `web/e2e/a11y.spec.ts`, Playwright sobre el build).
- **Sin JavaScript**, aviso y enlace a `/coches` (**RNF-6**, **CA-19**); **`noindex` y canonical a
  `/comparar` sin parámetros** con cualquier selección (**RF-14**, **CA-16**).
- **Pruebas del developer:** hoy son `node --test` sobre el HTML construido (`web/tests/`) más los
  dos specs de Playwright; nada prueba aún una página cuyo contenido monta JavaScript.
- **Precedente en el repositorio:** `/coches/` ya filtra y ordena en el cliente con un `<script>`
  propio de Astro, sin framework (`web/src/components/CatalogFilters.astro`), que importa la lógica
  pura de `web/src/lib/filter.ts` y `sort.ts`; esa lógica se prueba con `node --test`.

## Opciones consideradas
### 1. Cómo llegan los datos al navegador
**Peso medido** (enmienda del 2026-10-22). La prueba de peso de
`web/tests/comparar-build.test.ts` construyó el sitio con los datos reales el 2026-10-21 (#571;
entrada de la bitácora `docs/bitacora/2026-10/2026-10-21T0232-6b79808c.md`). Cifras sin comprimir:

| Fichero | Estimado al aceptar (2026-10-13) | Medido (2026-10-21) |
|---|---|---|
| `indice.json` | ~6 KB | **17 483 B** (82 modelos, ~213 B por modelo) |
| Mayor JSON de modelo | ≤ ~8 KB (5 versiones) | **22 257 B**, `porsche/taycan` (22 versiones, ~1 010 B por versión) |
| Todos los JSON de modelo | ~135 KB | **232 039 B** (82 ficheros, ~2 830 B por modelo de media) |

Las estimaciones originales partían de 39 modelos comparables, ~80 versiones y un máximo de 5
versiones por modelo, con ~1,5 KB por versión y ~0,4 KB de cabecera por modelo.

**De dónde sale la diferencia.** Leyendo `projectModel()` y `projectVersion()` en
`web/src/lib/compare.ts` y los endpoints `web/src/pages/comparar/datos/[marca]/[modelo].json.ts` e
`indice.json.ts` (`JSON.stringify` sin espacios), y contando a mano una versión de
`data/raw/porsche/taycan.yaml` (cálculo en bytes UTF-8, no medición):

- **El tamaño por dato está dentro de lo estimado; lo que se desvió es el número de versiones y de
  modelos.** Una versión del Taycan ocupa ~1 KB, *menos* que los ~1,5 KB supuestos, porque
  `battery_kwh`, `dc_max_kw` y `ac_max_kw` salen como `null` (~55 B entre los tres). El catálogo
  comparable pasó de 39 a 82 modelos (×2,1), y el Taycan reúne 22 versiones (berlina, Sport Turismo
  y Cross Turismo en un solo fichero) frente a las 5 que se tomaron como peor caso. En los ficheros
  de hoy, los 82 modelos comparables suman unas 254 versiones (~3,1 por modelo, no ~2); es un
  recuento con `grep` del 2026-10-22 que puede no coincidir exactamente con el build del día 21.
- **Lo que pesa dentro de cada dato:** `note` va en casi todos (en el Taycan, en 3 de los 4 campos
  presentes) y el Researcher repite el mismo texto largo en cada versión: la nota del precio («PVP
  recomendado península y Baleares, con transporte, IVA e IEDMT; precio desde») son ~80 B por versión
  y las de autonomía y potencia, 45–65 B. La `url` (54 B en el Taycan, idéntica en todos los datos del
  fichero) y las claves fijas (`"source_id"`, `"retrieved"`, `"tier"`… ~75 B por dato) completan
  los ~150–210 B por dato. `price` añade `price_kind`, `price_terms` y `price_terms_url` aunque los
  dos últimos sean `null` (~60 B): ~290 B el precio entero. La estimación del 2026-10-13 suponía
  `note` como excepción y la mayoría de campos a `null`; con los datos reales la nota es la norma.
- **Índice:** ~213 B por modelo frente a ~150 B. Los siete nombres de clave (`brand`, `slug`,
  `brand_name`, `model`, `status`, `versions`, `default_version`) se repiten en cada entrada (~75 B),
  `default_version` repite uno de los nombres de `versions`, y hay más versiones por modelo con
  nombres largos (p. ej. «Taycan Turbo GT con Paquete Weissach»).

**Proyección a 300 modelos** con las medias medidas (supone que los modelos nuevos se parecen a
los de hoy; un catálogo con más fichas tipo Taycan la sube):

- Índice: 300 × ~213 B ≈ **~64 KB** (antes ~45 KB).
- Todos los JSON de modelo juntos: 300 × ~2 830 B ≈ **~850 KB** (antes ~1 MB por otra vía de
  cálculo; la cifra es del mismo orden).
- JSON de un modelo: **no depende del catálogo**, sino de sus versiones (~1 KB por versión con los
  campos que hoy publica el Researcher). Peor caso de una tabla de 3 columnas con tres modelos del
  tamaño del Taycan: ~67 KB sin comprimir.

Lo que viaja comprimido no se ha medido. Brotli debería reducir mucho estos ficheros, porque
`url`, `source_id`, claves y notas se repiten, pero es una impresión: no hay cifra.

- **Datos incrustados en el HTML de `/comparar/`:** descartada. Todos los modelos viajarían en
  cada visita aunque se comparen 2: **232 039 B medidos hoy** y ~850 KB con 300 modelos (proyección
  de arriba). Engorda el documento que contiene el propio elemento LCP y retrasa el primer pintado
  en 4G; crece sin tope con el catálogo.
- **Un único JSON generado en el build con todos los modelos comparables:** descartada por el
  mismo número: ~232 KB hoy, ~850 KB a 300 modelos, descargado entero para pintar 2 o 3 columnas, y
  la tabla (que será el elemento LCP una vez montada) espera a esa descarga. Con las cifras medidas
  ya no «valdría hoy», como se dijo al aceptar: hoy es casi el doble de lo estimado.
- **Un JSON por modelo comparable y un índice ligero** (elegida): la tabla solo pide los ficheros
  de los ≤ 3 modelos citados, en paralelo: **22 257 B el mayor hoy** (`porsche/taycan`, 22
  versiones), ~2,8 KB de media. El índice (marca, nombre de marca, modelo, slug, estado, nombres de
  versión y versión por defecto) solo hace falta para «añadir» (**RF-9**): **17 483 B hoy**, ~64 KB
  con 300 modelos, y no bloquea la tabla.
- **Pregenerar todas las combinaciones:** descartada por el PRD (decisión 5).
- **Un servicio o función en el servidor:** descartada; no hay servidor (ADR-0003, ADR-0009).

### 2. Cómo se monta la parte interactiva
- **Isla de Astro con un framework (Preact, Svelte, React):** descartada. Añade una dependencia y
  su runtime al JavaScript de la página (contra **RNF-2**) para una tabla de ≤ 3 columnas, y la
  hidratación no aporta nada: no hay HTML de la selección que hidratar, porque la selección no se
  conoce en el build. El catálogo ya resolvió lo mismo sin framework.
- **Web Component propio:** descartada por ahora. No da nada que no dé un `<script>` de módulo
  sobre una única página, y añade un patrón que no existe en el repositorio.
- **`<script>` propio de Astro sin framework, con la lógica en `web/src/lib/`** (elegida): mismo
  patrón que `CatalogFilters.astro`, sin dependencias nuevas.

### 3. Sin almacenamiento y cómo se comprueba
- **Solo revisión de código:** descartada; RNF-4 ya tiene una prueba automática en el resto del
  sitio y el comparador es la página con más JavaScript.
- **Ampliar los specs de ADR-0006 con el comparador** (elegida), más una comprobación estática del
  JavaScript construido.

### 4. Qué ve quien no tiene JavaScript
- **Solo `<noscript>`:** descartada. Si el JavaScript está activado pero no llega o falla (red
  móvil), la página quedaría en blanco y sin salida.
- **Aviso en el HTML, visible por defecto, que oculta el script al arrancar** (elegida): el mismo
  patrón que `[data-no-js]` del catálogo; cubre «sin JavaScript» y «el JavaScript no cargó».

### 5. Cómo se prueba
- **Solo `node --test` sobre el HTML:** insuficiente; la tabla no está en el HTML.
- **Simular el DOM en `node --test` (jsdom o similar):** descartada; dependencia nueva para algo que
  Playwright, ya instalado (ADR-0006), hace con un navegador real.
- **Lógica pura con `node --test`, ficheros del build con `node --test` y la interacción con
  Playwright** (elegida).

## Decisión
**El build genera un JSON estático por modelo comparable y un índice ligero; `/comparar/` es una
página estática con un `<script>` propio sin framework que lee la URL, pide solo los JSON de los
modelos citados y monta la tabla, sin almacenamiento del navegador.**

Detalles:

1. **Datos (RNF-6, RF-11, RNF-5).**
   - Endpoints estáticos de Astro con `getStaticPaths()`, que en un sitio estático se ejecutan en el
     build y producen ficheros ([docs de Astro, «Endpoints»](https://docs.astro.build/en/guides/endpoints/),
     consultado el 2026-10-13: «In statically-generated sites, your custom endpoints are called at
     build time to produce static files»). Rutas: `/comparar/datos/{marca}/{modelo}.json`, con el
     mismo `{marca}` y `{modelo}` que la ficha (`/marcas/{marca}/{modelo}/`), e
     `/comparar/datos/indice.json`.
   - **Solo se genera fichero para los modelos comparables** (RF-11). Una versión de un modelo
     excluido o inexistente da 404 y el script la trata como «no se ha podido incluir»: el filtro de
     RF-11 vive en un único sitio, el build, y los datos excluidos no se publican.
   - Cada fichero de modelo lleva **solo** la sección 6 de PRD-003: `brand`, slug, `brand_name`,
     `model`, `status`, `launch` y `versions[]` con `name` y los 7 campos (`price` con `price_kind`,
     `price_terms`, `price_terms_url`), cada uno con su `value`, `source_id`, `url`, `retrieved`,
     `tier` y `note` tal como están en `data/raw/`. Ausente → `null` (RF-3). Lista blanca de campos,
     no lista negra: un campo nuevo del esquema no se publica hasta que un PRD lo pida.
   - Si `source_id` necesita el nombre legible de la fuente para RF-4, el fichero lleva también ese
     nombre desde el registro de fuentes; no se inventa ninguno.
   - El índice lleva por modelo: `brand`, slug, `brand_name`, `model`, `status`, los `name` de sus
     versiones en el orden del fichero y el `name` de la versión por defecto de **RF-8** (la de
     precio más bajo; si ninguna tiene precio, la primera), calculada en el build con la misma
     función que el script usa en el cliente. No lleva cifras.
   - La clave de una versión es la terna (`brand`, slug, `name`); el script resuelve `name` dentro
     del fichero del modelo por igualdad exacta. Cómo se codifica en la URL lo fija el diseño.
   - Mismo origen siempre (ADR-0012): ninguna petición a terceros.
2. **Parte interactiva.**
   - Un componente `.astro` con un `<script>` de módulo (procesado y empaquetado por Astro), como
     `CatalogFilters.astro`. **Sin dependencias nuevas.**
   - La lógica que no toca el DOM va en `web/src/lib/` (p. ej. `compare.ts`): leer y escribir la
     selección en la URL, validar contra RF-11 (repetidas, más de 3, inexistentes), elegir la
     versión por defecto (RF-8) y preparar las celdas («por confirmar», «Precio con oferta»,
     «fuente no oficial» si `tier` ≠ T1). El formato de cifras y las etiquetas reutilizan las
     funciones que ya usan la tarjeta y la ficha; por eso esos módulos no pueden importar
     `node:fs` ni nada de Node (lo que lea ficheros se queda en `data.ts`).
   - Los textos llegan al script desde `i18n.ts` en un atributo `data-messages`, como en el
     catálogo (RNF-3). El marcado de columna y celda está en `<template>` del HTML; el script lo
     clona y rellena con `textContent` y atributos, nunca con `innerHTML` de datos.
   - Al cambiar la selección, `history.replaceState` con la nueva query string (como el
     catálogo): la URL es el único estado.
   - Orden de arranque: el script lee la URL y pide los ≤ 3 JSON de modelo a la vez; el índice se
     pide aparte y solo condiciona el control de añadir.
3. **Sin almacenamiento (RNF-4, CA-12).** El script no usa `localStorage`, `sessionStorage`,
   `indexedDB`, Cache API, service workers ni `document.cookie`. Se comprueba así:
   - `web/e2e/storage.spec.ts`: casos nuevos para `/comparar/` sin selección y con una selección,
     y después de añadir, quitar y cambiar de versión, con la misma `checkNoStorage` (cookies,
     `localStorage`, `sessionStorage` y peticiones solo al propio origen). Comprobar además que las
     únicas peticiones de datos son a `/comparar/datos/`.
   - Una prueba `node --test` que busca en los `.js` del build los identificadores `localStorage`,
     `sessionStorage`, `indexedDB`, `caches`, `serviceWorker` y `document.cookie` y falla si
     aparecen. Es barata y atrapa el caso que el navegador no ejercita.
4. **Sin JavaScript (RNF-6, CA-19) y SEO (RF-14, CA-16).**
   - El HTML de `/comparar/` es el mismo para cualquier query string (es un único fichero). Trae
     visible el aviso de que el comparador necesita JavaScript y el enlace a `/coches/`; el script
     lo oculta al arrancar. No hay tabla vacía en el HTML (RF-12).
   - `<meta name="robots" content="noindex">` y `<link rel="canonical">` absoluto a
     `https://siete3.com/comparar/` (con barra final, como el resto de canónicas del sitio) van en
     el `<head>` estático. El script **no toca** el `<head>`. Como el fichero es único, el canonical
     es el mismo con cualquier selección.
   - Las acciones «Comparar» de tarjeta y ficha (RF-6, RF-7) son `<a href>` generados en el build,
     solo en modelos comparables.
   - `web/public/robots.txt` excluye los datos del comparador con `Disallow: /comparar/datos/`
     (decisión del 2026-10-13 al aceptar esta ADR). Hoy el sitio no tiene `robots.txt`: se crea
     con ese único `Disallow` bajo `User-agent: *`, sin bloquear nada más. Una prueba `node --test`
     comprueba que el build lo lleva.
5. **Pruebas.**
   - `node --test` de la lógica pura de `web/src/lib/compare.ts` (RF-8, RF-11, ida y vuelta de la
     URL, celdas por confirmar, etiquetas).
   - `node --test` sobre el build con datos de prueba (`CARS_DATA_DIR`, como `filters.test.ts`):
     hay JSON para cada modelo comparable y **no** para `needs_review`, `discontinued` ni los
     excluidos; cada valor es idéntico al del YAML (CA-18); ningún campo fuera de la lista blanca;
     el HTML de `/comparar/` lleva `noindex`, el canonical y el aviso sin JavaScript; las tarjetas
     y fichas comparables llevan el enlace y las excluidas no. Y una prueba que **mide el peso**
     del índice y del mayor JSON de modelo con los datos reales y lo imprime, para comprobar las
     estimaciones de arriba. (Enmienda del 2026-10-22: ya las comprobó, #571; las cifras medidas
     están en «Opciones consideradas». Si se convierte en alarma, ver Consecuencias.)
   - Playwright (`web/e2e/`) para lo que solo existe con JavaScript: un spec nuevo del comparador
     con datos de prueba (construido a un directorio temporal y servido como hace
     `storage.spec.ts`) que cubre CA-1 a CA-4, CA-6, CA-9 a CA-15 y CA-17; CA-19 con
     `javaScriptEnabled: false`; y `/comparar/` con una selección añadida a `a11y.spec.ts`,
     esperando a que la tabla esté montada.

## Consecuencias
**Buenas**
- Lo que viaja crece con lo que se compara (≤ 3 ficheros pequeños), no con el catálogo; el índice
  es lo único que crece y no bloquea la tabla.
- RF-11 se cumple por construcción: lo que no es comparable no se publica.
- Sin dependencias nuevas y con el mismo patrón que el catálogo; la lógica se prueba sin navegador.
- RNF-4 queda vigilado por dos lados: navegador (Playwright) y texto del JavaScript construido.

**Malas o a vigilar**
- **El peso real es entre 1,7 y 2,9 veces el estimado** (enmienda del 2026-10-22, #571): índice 17 483 B
  (estimado ~6 KB), mayor modelo `porsche/taycan` 22 257 B (estimado ~8 KB), todos los JSON de
  modelo 232 039 B (estimado ~135 KB). La causa es el número de modelos y, sobre todo, de versiones
  por modelo, más notas en casi todos los datos (ver «Opciones consideradas»), no un error en el
  tamaño de cada dato. **La decisión sigue valiendo y sale reforzada**: las dos alternativas
  descartadas (todo incrustado o un único JSON) cargarían hoy ~232 KB en cada visita, y la elegida
  carga ≤ 3 ficheros cuyo tamaño no depende del catálogo. Son cifras sin comprimir: Render sirve el
  sitio con Brotli (`content-encoding: br` en `https://siete3.com/coches/`, comprobado el
  2026-10-13); el peso comprimido no se ha medido.
- **El JSON de un modelo crece sin tope con sus versiones.** El Taycan pasó de un peor caso
  supuesto de 5 versiones a 22, y nada impide que un fichero tenga más (el Researcher decide si las
  carrocerías van juntas o separadas). Con 3 modelos así, la tabla espera a ~67 KB sin comprimir.
  Hoy no parece un problema para **RNF-2**, pero es una impresión: RNF-2 sigue sin medirse en la
  página montada.
- **Hace falta una alarma en la prueba de peso; hoy solo imprime.** La prueba de
  `web/tests/comparar-build.test.ts` no tiene umbral, y su mensaje aún cita las estimaciones
  antiguas («index ~6 KB, model <= ~8 KB, all ~135 KB»). Sin umbral, nadie se entera de que el
  índice o un modelo se disparan hasta que alguien lee la salida. Propuesta, **pendiente de que la
  acepte una persona y se encole al developer** (esta ADR no toca `web/`): que la prueba falle si
  `indice.json` supera **64 KB** (la proyección a 300 modelos: superarla antes significa que el
  catálogo o los nombres crecen más de lo previsto) o si un JSON de modelo supera **32 KB** (~1,5 ×
  el Taycan, unas 30 versiones), y que el mensaje cite las cifras medidas en vez de las estimadas.
  Los umbrales son razonados, no medidos contra RNF-2; si se mide el LCP de la página montada,
  deben salir de esa medición. El total de todos los JSON no necesita umbral: no lo descarga nadie
  entero.
- **Las notas repetidas son la mayor parte del peso evitable**, pero recortarlas o deduplicarlas
  es cosa del esquema de datos y del PRD, no de esta ADR: el fichero publica la `note` tal cual
  (RF-5, CA-18).
- **El LCP de `/comparar/` depende de una cadena de peticiones**: HTML → script → JSON de modelo →
  pintado. Son ~3 viajes de ida y vuelta en 4G antes de que aparezca la tabla. Creo que cabe en
  2,5 s porque los ficheros son pequeños, pero es una impresión: hay que medir RNF-2 en la página
  montada con una selección de 3, no en el HTML vacío. Si no cabe, la primera palanca es servir
  el script en línea; no se decide aquí.
- **Más ficheros en el build** (uno por modelo comparable más el índice) y una ruta pública
  `/comparar/datos/` que cualquiera puede leer. No hay nada privado en ella (son los mismos datos
  con fuente de las fichas), pero es una superficie más. `robots.txt` la excluye (punto 4), lo que
  evita que la rastreen los buscadores que lo respetan, aunque no impide que alguien la lea.
- **Un modelo que deja de ser comparable rompe enlaces compartidos**: su JSON desaparece en el
  siguiente build y la versión se ignora con aviso (RF-11). Es lo que pide el PRD, pero quien
  abra un enlace antiguo verá menos columnas.
- **Renombrar una versión (`name`) o cambiar el slug del modelo rompe los enlaces compartidos**:
  la clave es estable mientras el Researcher no cambie esos valores, y nada lo impide hoy.
- **Formato duplicado en riesgo**: si la tarjeta o la ficha formatean cifras en código que solo
  corre en el build, el comparador podría mostrar el mismo dato de otra forma. La decisión obliga
  a compartir esas funciones; si hoy dependen de Node, hay que separarlas primero.
- **La CI se alarga**: un spec nuevo de Playwright con un build propio de datos de prueba (el de
  `storage.spec.ts` ya tarda; su `beforeAll` tiene 240 s de margen).
- **`/comparar/` sin JavaScript no compara nada**: es lo que acepta RNF-6.

**Preguntas abiertas**
- ~~¿Sirve Render el static site comprimido?~~ Sí: Brotli, comprobado en las cabeceras de
  `siete3.com` el 2026-10-13.
- ~~¿Se excluye `/comparar/datos/` en `robots.txt`?~~ Sí, decidido al aceptar la ADR (punto 4).
- ¿Debe la factoría avisar cuando un cambio de `name` o de slug rompa claves de comparación
  compartidas? No lo pide ningún PRD.
- La codificación de la terna en la URL: `docs/design/comparador.md`.
- ¿Se aceptan los umbrales de la prueba de peso (índice 64 KB, modelo 32 KB) y se encola el cambio
  al developer? Ver Consecuencias (enmienda del 2026-10-22).
- ¿Cuánto pesan comprimidos con Brotli el índice y el JSON del Taycan? No se ha medido.
