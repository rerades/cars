# ADR-0014 — Datos y script del comparador (`/comparar`)

- **Estado:** aceptada (2026-10-13)
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
Estimación de peso (no medida; calculada a partir del esquema de `data-model.md`): un dato con
fuente en JSON ocupa ~130 B sin `note` y ~200 B con ella (la `url` es casi todo); una versión con los
7 campos y las condiciones de precio, ~1,5 KB; la cabecera de un modelo (`brand`, `brand_name`,
`model`, slug, `status`, `launch`), ~0,4 KB. Son cotas altas: hoy la mayoría de campos son `null`.

- **Datos incrustados en el HTML de `/comparar/`:** descartada. Todos los modelos viajarían en
  cada visita aunque se comparen 2: ~135 KB sin comprimir hoy (39 × 0,4 + 80 × 1,5) y ~1 MB con 300
  modelos (~620 versiones a la media actual de ~2 por modelo). Engorda el documento que contiene el
  propio elemento LCP y retrasa el primer pintado en 4G; crece sin tope con el catálogo.
- **Un único JSON generado en el build con todos los modelos comparables:** descartada por el
  mismo número: ~135 KB hoy, ~1 MB a 300 modelos, descargado entero para pintar 2 o 3 columnas, y
  la tabla (que será el elemento LCP una vez montada) espera a esa descarga. Hoy valdría; deja de
  valer justo cuando el catálogo crece, y cambiarlo después obliga a rehacer el script.
- **Un JSON por modelo comparable y un índice ligero** (elegida): la tabla solo pide los ficheros
  de los ≤ 3 modelos citados, en paralelo: ≤ ~8 KB cada uno en el peor caso actual (5 versiones).
  El índice (marca, nombre de marca, modelo, slug, estado y nombres de versión, ~150 B por modelo)
  solo hace falta para «añadir» (**RF-9**): ~6 KB hoy, ~45 KB con 300 modelos, y no bloquea la tabla.
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
     estimaciones de arriba.
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
- **Las cifras de peso son estimaciones**, no mediciones; la prueba de peso del build las tiene
  que confirmar. Son cifras sin comprimir: Render sirve el sitio con Brotli (`content-encoding: br`
  en `https://siete3.com/coches/`, comprobado el 2026-10-13), así que lo que viaja es bastante
  menos, porque las `url` se repiten.
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
