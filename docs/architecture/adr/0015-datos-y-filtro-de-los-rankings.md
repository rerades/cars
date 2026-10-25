# ADR-0015 — Datos y filtro de los rankings (`/rankings/*`)

- **Estado:** aceptada (2026-10-15). Enmienda «Peso medido» (umbral de 50 KB con Brotli por JSON):
  aceptada (2026-10-25)
- **Fecha:** 2026-10-15

## Contexto
PRD-005 (`ready`) pide cinco rankings con filtros de segmento y de tramo de precio, y
`docs/design/rankings.md` deja fuera, a propósito, «cómo llegan los datos de las versiones al
navegador ni cómo se filtra». Lo que obliga a decidir:

- **El HTML lleva solo los 10 primeros sin filtrar** (**RNF-1**, **RF-13**, **CA-14**): cada ranking es
  una página pregenerada e indexable, y **CA-7** comprueba sobre el HTML construido que hay
  exactamente 10 entradas (o las que haya).
- **Los filtros renumeran sobre todas las versiones con la cifra** (**RF-8**, **RF-9**, **RF-10**): el
  filtro se aplica antes de numerar, así que el puesto 1 de «Más autonomía» filtrado por
  `suv_compacto` puede ser una versión que no está entre los 10 del HTML. El navegador necesita
  datos de versiones que el HTML no trae. Los filtros se resuelven en el navegador con query string,
  como PRD-001 RF-5, sin páginas por filtro (PRD-005, decisión 7).
- **La nota de RF-15 cambia con los filtros**: cuenta las versiones a la venta sin la cifra o con
  ella solo de T3 **dentro de los filtros aplicados** (**RF-15**, **CA-18**). El navegador necesita
  saber también el segmento y el tramo de las versiones que se quedan fuera.
- **Qué entra** (**RF-4**, **RF-6**, **RF-11**, **CA-10**): solo versiones de modelos `on_sale` y sin
  `needs_review`, con la cifra presente y de fuente T1 o T2. Valores idénticos a `data/raw/`
  (**RNF-6**, **CA-16**).
- **Qué necesita un puesto** (sección 6 de PRD-005 y `rankings.md`, «Qué lleva un puesto»):
  `brand`, slug, `brand_name`, `model`, `name`, `segment`, la cifra del ranking con `source_id`,
  `url`, `retrieved`, `tier` y `note`; `basis` en batería; `price_kind`, `price_terms` y
  `price_terms_url` en precio. Para filtrar, además, el segmento del modelo y el precio de la
  versión (**RF-9**: el tramo se aplica al precio de la versión, también en los rankings que no lo
  muestran).
- **LCP < 2,5 s en móvil 4G** (**RNF-2**). Catálogo actual: 41 ficheros en `data/raw/`, unas 80
  versiones (ADR-0014); horizonte de unos 300 modelos (~620 versiones), el mismo que usa ADR-0014.
- **Sin cookies ni almacenamiento del navegador** (**RNF-5**, **RF-12**, **CA-15**), comprobado con
  los specs de ADR-0006 como en ADR-0014.
- **Stack y precedentes:** sitio estático sin servidor (ADR-0003, ADR-0009); componentes de Bearnie
  (ADR-0005), que no aportan lógica de filtrado; `/coches/` filtra en el cliente con un `<script>`
  propio sin framework (`web/src/components/CatalogFilters.astro`, lógica en
  `web/src/lib/filter.ts`, con los 10 segmentos en `SEGMENTS`); el comparador pide JSON estáticos
  generados en el build (ADR-0014). En `/coches/` todas las tarjetas están en el HTML y el filtro
  las oculta; en un ranking eso no vale, porque el HTML solo puede llevar 10 puestos (CA-7).

## Opciones consideradas
### 1. Cómo llegan los datos al navegador
Estimación de peso (no medida; con las mismas cotas que ADR-0014): un dato con fuente en JSON
ocupa ~130 B sin `note` y ~200 B con ella; la identificación de una versión (`brand`, slug,
`brand_name`, `model`, `name`) más segmento y tramo, ~0,2 KB. Una entrada de ranking queda en
~0,4 KB; en el ranking de precio, con `price_terms` literal, puede llegar a ~1 KB.

- **Todas las versiones en el HTML, ocultas hasta filtrar:** descartada. Rompe **CA-7** y **CA-14**
  tal como están escritos (el HTML tendría más de 10 entradas), mete en el índice de los buscadores
  contenido oculto que no es el ranking, y el marcado completo de un puesto (enlaces, fuente,
  condiciones) pesa más que su JSON: ~80 puestos hoy, ~620 a 300 modelos, en el mismo documento
  que contiene el elemento LCP, descargado por todo visitante aunque no filtre.
- **Los datos en el HTML como `<script type="application/json">`:** descartada. No choca con CA-7,
  pero el peso (~30 KB hoy, ~250 KB a 300 modelos sin comprimir; el doble en precio) va en el
  documento del LCP de cada visita, también de quien no filtra y de los buscadores, y no se cachea
  entre visitas. Hoy valdría; deja de valer cuando crece el catálogo.
- **Reutilizar los datos del comparador de ADR-0014:** descartada.
  - El JSON por modelo de ADR-0014 lleva una **lista blanca** fijada por PRD-003, sección 6, que no
    incluye `segment`: habría que ampliar el contrato del comparador por una necesidad de otro PRD,
    y cualquier cambio en uno afecta al otro.
  - Para filtrar hay que tener **todas** las versiones, así que el navegador pediría todos los
    ficheros de modelo: 39 peticiones hoy, ~300 en el horizonte, y ~135 KB hoy / ~1 MB a 300
    modelos (cifras de ADR-0014), con los 7 campos de cada versión cuando el ranking usa uno.
  - Publica modelos `announced`, que el ranking excluye (RF-11): el filtro de RF-11 dejaría de
    vivir solo en el build.
  - El índice ligero de ADR-0014 no lleva cifras: no sirve por sí solo.
- **Un único JSON con las versiones y las cinco cifras, compartido por los cinco rankings:**
  descartada. Se cachearía entre rankings, pero cada ranking descarga cinco cifras con fuente para
  usar una: ~1 KB por versión, ~80 KB hoy y ~600 KB a 300 modelos sin comprimir.
- **El resultado de cada combinación de filtros precalculado en el build:** descartada. Con 10
  segmentos más «Todos» y 3 tramos más «Cualquiera» son 44 combinaciones por ranking; el cliente
  solo elegiría una lista. Repite las mismas versiones en muchas combinaciones, ata el formato a
  los filtros de hoy (un filtro más multiplica las combinaciones) y deja la lógica de RF-8 y RF-9
  solo en el build, cuando PRD-001 RF-5 y PRD-005 RF-8 la sitúan en el navegador y **CA-8** y
  **CA-9** se verifican «sobre la lógica de filtrado y en el navegador».
- **Un JSON por ranking, generado en el build, con las versiones que pueden dar puesto y las claves
  de filtro de las que se quedan fuera** (elegida): solo la cifra de ese ranking; ~30 KB hoy y
  ~250 KB a 300 modelos sin comprimir (el de precio, hasta el doble); se pide **solo si hay que
  filtrar**, así que no compite con el LCP de la página, que ya está en el HTML.
- **Un servicio o función en el servidor:** descartada; no hay servidor (ADR-0003, ADR-0009).

### 2. Cuándo se pide el JSON
- **Siempre, al cargar la página:** descartada. Quien no filtra (el caso de la entrada desde
  `/coches`, que es la lista de los 10) descarga datos que no usa, y la petición compite con el
  resto de la carga en 4G.
- **Con `<link rel="prefetch">` en el HTML:** descartada por la misma razón, y porque el
  navegador decide cuándo lo pide.
- **Solo cuando hace falta** (elegida): al cargar, si la query string trae un filtro válido; si no,
  en la primera interacción con un select (foco o cambio).

### 3. Cómo se monta la parte interactiva
- **Isla de Astro con un framework (Preact, Svelte, React):** descartada por lo mismo que en
  ADR-0014: dependencia y runtime nuevos para dos `<select>` y una lista de 10.
- **Web Component propio:** descartada; no aporta nada sobre un `<script>` de módulo y no existe el
  patrón en el repositorio.
- **`<script>` propio de Astro sin framework, con la lógica en `web/src/lib/`** (elegida): el patrón
  de `CatalogFilters.astro` y de ADR-0014.

### 4. Quién ordena y numera
- **El build numera la lista del HTML con una función y el script con otra:** descartada. Empates,
  orden alfabético y corte en el décimo (RF-7) se implementarían dos veces y podrían divergir.
- **Una sola función pura que ordena, filtra, numera y cuenta los que se quedan fuera, usada por el
  build y por el script** (elegida).

## Decisión
**El build genera un JSON estático por ranking con las versiones que pueden dar puesto y las claves
de filtro de las que se quedan fuera; un `<script>` propio sin framework lo pide solo cuando hay que
filtrar y monta la lista con la misma función pura que numera el HTML, sin almacenamiento del
navegador.**

Detalles:

1. **Datos (RF-4, RF-6, RF-11, RF-15, RNF-6).**
   - Endpoints estáticos de Astro con `getStaticPaths()`, el mismo mecanismo que ADR-0014. Ruta:
     `/rankings/datos/{ranking}.json`, con `{ranking}` igual al último tramo de la URL de la página
     (`mas-baratos`, `mas-autonomia`, `mas-bateria`, `mas-potencia`,
     `carga-mas-rapida-en-continua`; `rankings.md`). Cinco ficheros, ni uno más (RF-1).
   - **`entries[]`**: una por versión que puede dar puesto en ese ranking: modelo `on_sale`, sin
     `needs_review`, con la cifra presente y de `tier` T1 o T2. Lleva **solo**: `brand`, slug,
     `brand_name`, `model`, `name`, `segment` (o `null`), el tramo de precio de la versión (o
     `null` si no tiene precio) y el dato del ranking con `value`, `source_id`, `url`,
     `retrieved`, `tier` y `note`, más `basis` en batería y `price_kind`, `price_terms` y
     `price_terms_url` en precio. Lista blanca, como ADR-0014. Ausente → `null`.
   - **El tramo, no la cifra del precio, en los rankings que no son de precio**: el tramo
     (`hasta-30000-euros`, `de-30000-a-45000-euros`, `mas-de-45000-euros`, los valores de URL que
     propone `rankings.md`) se calcula en el build con los bordes de PRD-001 RF-10, en una función compartida con
     el catálogo: `PRICE_BANDS` de `web/src/lib/catalog.ts`, que ya tiene esos bordes y esos slugs (corregido al aceptar; la propuesta la buscaba en `filter.ts`). Así no se publica una cifra de precio sin su fuente en un
     ranking que no la muestra.
   - **`out[]`**: una por versión `on_sale` publicada **sin** la cifra o con ella solo de T3 (RF-15),
     con **solo** `segment` y tramo, sin identificación ni cifras. Basta para contar «se han quedado
     fuera» dentro de los filtros y no publica nada que la página no diga.
   - El filtro de RF-11 y el de T3 viven en el build: lo que no puede dar puesto no está en
     `entries`.
   - Mismo origen siempre (ADR-0012): ninguna petición a terceros.
2. **Una sola lógica (RF-7, RF-8, RF-9, RF-10).**
   - Un módulo puro en `web/src/lib/` (p. ej. `ranking.ts`), sin nada de Node, con una función que
     recibe `entries`, `out`, el campo y el sentido de RF-1 y los filtros, y devuelve los ≤ 10
     puestos numerados (empates 1, 2, 2, 4; orden alfabético de marca, modelo y `name`; corte en el
     décimo) y el número de los que se quedan fuera.
   - El build construye `entries` y `out` y llama a esa función **sin filtros** para pintar el HTML;
     el script llama a la misma función **con filtros** sobre el JSON. La lista del HTML y la del
     JSON sin filtros no pueden divergir.
   - Lectura y escritura de la query string: los parámetros y valores de `rankings.md`: `segmento`,
     el mismo de `/coches` (reutilizando `filter.ts`), y `precio` con el slug del tramo de
     `PRICE_BANDS` (decidido al aceptar). Valor no válido, ignorado. `history.replaceState`, como el catálogo.
   - El `id` de cada entrada de «Condiciones de las ofertas» se deriva de la terna (`brand`, slug,
     `name`) con una función compartida, no del puesto (`rankings.md`).
3. **Parte interactiva.**
   - Un componente `.astro` con un `<script>` de módulo, como `CatalogFilters.astro`. **Sin
     dependencias nuevas.**
   - Los controles no están en el HTML servido (`rankings.md`): van en un `<template>` que el
     script clona. El marcado del puesto, del vacío filtrado y de una entrada de condiciones,
     también en `<template>`, generados por el mismo componente que pinta la lista del HTML; el
     script los rellena con `textContent` y atributos, nunca con `innerHTML` de datos.
   - Formato de cifras, fecha, dominio de la fuente y etiquetas: las funciones que ya usan la
     ficha y la tarjeta (la misma obligación que ADR-0014, detalle 2). Textos desde `i18n.ts` en
     `data-messages` (RNF-4).
   - Arranque: si la query string trae un filtro válido, pide el JSON al cargar; si no, en el
     primer `focus` o `change` de un select. Mientras llega, queda la lista del HTML.
   - Si el JSON no llega, la lista que se ve **nunca** contradice a los selects: el select vuelve a
     su valor anterior, la lista no cambia y la región viva lo dice (`rankings.md`, «Estados»;
     decidido al aceptar). El siguiente cambio de un select vuelve a pedir el JSON.
4. **Sin almacenamiento (RNF-5, CA-15).** Igual que ADR-0014: el script no usa `localStorage`,
   `sessionStorage`, `indexedDB`, Cache API, service workers ni `document.cookie`.
   - `web/e2e/storage.spec.ts`: casos para un ranking sin filtros, con filtros en la URL y después
     de cambiar los dos selects, con `checkNoStorage`; y que la única petición de datos es a
     `/rankings/datos/`.
   - La prueba `node --test` de ADR-0014 que busca esos identificadores en los `.js` del build cubre
     también este script; no hace falta otra.
5. **SEO (RF-13, CA-12).** `web/public/robots.txt` añade `Disallow: /rankings/datos/` junto al de
   `/comparar/datos/` (ADR-0014). El canonical y la ausencia de `noindex` son los de `rankings.md`;
   el script no toca el `<head>`.
6. **Pruebas.**
   - `node --test` de la función pura: CA-7 (10, 3 y 0 puestos; empate en el segundo; empate que
     cruza el décimo), CA-8, CA-9 con 30.000, 30.001 y 45.000 €, CA-18 con filtros y sin ellos, y
     la ida y vuelta de la query string.
   - `node --test` sobre el build con datos de prueba (`CARS_DATA_DIR`): hay exactamente cinco JSON;
     ninguna entrada de `announced`, `discontinued`, `needs_review` ni T3 (CA-4, CA-10); cada valor
     idéntico al YAML (CA-16); ningún campo fuera de la lista blanca; `out[]` sin cifras; la lista
     del HTML es igual a la función aplicada al JSON sin filtros; `robots.txt` lleva la línea. Y una
     prueba que **mide e imprime el peso** de los cinco JSON con los datos reales, para comprobar las
     estimaciones.
   - Playwright: un spec de los rankings con datos de prueba (construido y servido como
     `storage.spec.ts`) que cubre CA-8, CA-9, el vacío filtrado y «Quitar filtros», la nota de
     RF-15 al filtrar, abrir una URL con filtros y que **no** se pide el JSON al cargar sin filtros;
     CA-14 con `javaScriptEnabled: false`; un ranking con un filtro aplicado en `a11y.spec.ts`.

### Peso medido (enmienda del 2026-10-25, aceptada)

**Cada JSON de `/rankings/datos/` debe pesar 50 KB o menos comprimido con Brotli. Por ahora no se
recorta nada: con los datos de hoy, el más grande pesa 5 KB.**

Contexto propio de la enmienda: la prueba de peso de la historia #447 (#653) dio 270 KB y el
Revisor lo leyó como si fuera un solo ranking, nueve veces la estimación. En realidad es **la suma
de los cinco** sin comprimir. Medido el 2026-10-25 sobre `main`, con 145 ficheros de modelo:

| Ranking | Sin comprimir | gzip -9 | Brotli | Puestos (`entries`) | Fuera (`out`) |
|---|---|---|---|---|---|
| `mas-potencia` | 68,6 KB | 5,2 KB | 4,4 KB | 207 | 41 |
| `mas-autonomia` | 64,5 KB | 6,0 KB | 5,0 KB | 179 | 69 |
| `mas-bateria` | 57,2 KB | 4,5 KB | 3,9 KB | 159 | 89 |
| `mas-baratos` | 53,2 KB | 5,6 KB | 4,8 KB | 85 | 163 |
| `carga-mas-rapida-en-continua` | 20,1 KB | 1,6 KB | 1,4 KB | 37 | 211 |

- **La estimación por entrada se cumple.** Sale a ~0,3 KB por puesto; la ADR calculaba ~0,4 KB.
  Lo que ha cambiado es el catálogo: los ~30 KB eran para ~80 puestos, y hoy hay hasta 207.
- **Lo que viaja es lo comprimido.** `siete3.com` sirve estos ficheros con
  `content-encoding: br` (comprobado el 2026-10-25 en `/rankings/datos/mas-potencia.json`).
- **Los `price_terms` no son el problema.** En `mas-baratos` suman ~14 KB sin comprimir y ~2 KB
  con gzip. Además, el puesto los pinta, así que no se pueden quitar del JSON sin quitarlos de la
  página.
- **Cuánto pesará a 300 modelos.** Si los ficheros crecen igual que los puestos (de ~250
  versiones hoy a las ~620 del horizonte, ×2,5), el mayor quedará en ~170 KB sin comprimir y unos
  12–13 KB con Brotli. Es una proyección, no una medida.

7. **Umbral de peso.** La prueba de peso de la Decisión, punto 6, deja de solo imprimir. Pasa a
   comprobar que cada uno de los cinco JSON del build con los datos reales pesa **50 KB o menos
   comprimido con Brotli** (`zlib.brotliCompressSync` de Node, con sus opciones por defecto).
   Sigue imprimiendo el peso sin comprimir y el comprimido de cada uno.
   - **Por qué 50 KB:** deja unas cuatro veces de margen sobre la proyección a 300 modelos. A
     10 Mbit/s, 50 KB son unos 40 ms de descarga, y el JSON solo se pide al filtrar, nunca para el
     LCP (RNF-2).
   - **Si un JSON pasa del umbral:** la prueba falla en la CI de la PR que lo hace crecer, y una
     persona decide si sube el umbral o aplica la palanca de «Malas o a vigilar» (solo las
     versiones que entran en el top 10 de alguna combinación de filtros). Ningún agente sube el
     umbral por su cuenta.
   - Cambiar la prueba es trabajo del Desarrollador (`web/tests/rankings-datos.test.ts`), como
     tarea propia después de aceptar esta enmienda. No bloquea la #376.

## Consecuencias
**Buenas**
- La página que se indexa y la que ve quien no filtra es solo HTML: el LCP no depende del JSON ni
  del script (RNF-1, RNF-2).
- Lo que se descarga para filtrar es una sola petición, con una sola cifra por versión y sin nada
  que la página no pueda enseñar.
- Una sola función numera el HTML y el filtro: empates y cortes iguales en los dos lados, y CA-7,
  CA-8 y CA-9 se prueban sin navegador.
- RF-11 y el descarte de T3 se cumplen por construcción: lo que no da puesto no se publica.
- Sin dependencias nuevas; mismo patrón que el catálogo y el comparador. El comparador y los
  rankings no comparten contrato de datos, así que uno puede cambiar sin romper al otro.

**Malas o a vigilar**
- **Las cifras de peso son estimaciones**, no mediciones; la prueba de peso del build las tiene que
  confirmar. Medidas el 2026-10-25: 20–69 KB por ranking sin comprimir y 1,4–5 KB con Brotli
  (enmienda «Peso medido»). Son sin comprimir; Render sirve con Brotli (comprobado el 2026-10-13, ADR-0014) y las
  `url` se repiten mucho, pero el JSON **crece con el catálogo**: a 300 modelos, ~250 KB por
  ranking, y el de precio más, por los `price_terms` literales. Si pesa demasiado, la palanca es
  publicar solo las versiones que entran en el top 10 de alguna de las 44 combinaciones de filtros,
  calculadas en el build con la misma función; no se decide aquí, y la cota que da (≤ 440
  entradas) no es mucho menor que el horizonte de ~620 versiones.
- **Hay que esperar al JSON la primera vez que se filtra**: en 4G, un viaje de ida y vuelta más
  la descarga tras el primer cambio de select. El primer `focus` adelanta la petición, pero con
  teclado o con lector de pantalla puede no haber margen. Es una impresión, no una medida.
- **Abrir una URL con filtros cambia la lista después de pintarla**: el HTML trae los 10 sin
  filtrar y el script los sustituye al llegar el JSON. Puede contar como desplazamiento de
  maquetación y mover el elemento LCP de esa visita. Hay que medir RNF-2 también con una URL con
  filtros, no solo con la página limpia.
- **Error de red al filtrar**: `rankings.md` dice que no hay estado de carga ni de error porque la
  lista va en el HTML, pero con esta decisión el visitante puede cambiar un select y que el JSON no
  llegue. La ADR solo exige que la lista nunca contradiga a los selects; qué se ve (volver los
  selects a su valor anterior, un aviso, quitar los controles) lo tiene que decidir el diseño.
- **El tramo de precio se calcula en el build**, no se lee del fichero: si cambian los bordes de
  PRD-001 RF-10, cambian los cinco JSON y el catálogo a la vez, con la misma función. Si alguien
  duplica los bordes, divergen.
- **Cinco ficheros más y una ruta pública `/rankings/datos/`**: no hay nada privado (son los datos
  con fuente de las fichas), `robots.txt` la excluye, pero cualquiera puede leerla.
- **El `<template>` con el marcado del puesto viaja en el HTML** de cada ranking, también para quien
  no filtra; es poco, pero suma al documento del LCP.
- **La CI se alarga**: otro spec de Playwright con su propio build de datos de prueba.

**Preguntas abiertas**
- ~~Qué se ve si el JSON no llega después de cambiar un select: diseño (`docs/design/rankings.md`).~~
  Resuelta al aceptar (2026-10-15): el select vuelve a su valor anterior, la lista no cambia y la
  región viva avisa (`ranking.filtros.error`); el siguiente cambio reintenta.
- ~~Nombre y valores del parámetro de precio en la URL: `rankings.md` los **propone**; los fija el
  diseño, no esta ADR.~~ Resuelta al aceptar (2026-10-15): `precio`, con los slugs de
  `PRICE_BANDS` (`hasta-30000-euros`, `de-30000-a-45000-euros`, `mas-de-45000-euros`). No es
  `precio_min`/`precio_max` de `/coches` porque el ranking filtra por tramo, no por rango en euros.
- ~~Si la medida de peso del build supera lo aceptable, ¿se aplica el recorte por combinaciones? No
  hay un umbral en ningún PRD; RNF-2 solo fija el LCP.~~ Resuelta por la enmienda «Peso medido»
  (2026-10-25): el umbral es de 50 KB con Brotli por JSON y hoy no se recorta nada. El recorte por
  combinaciones solo se aplica si una persona lo decide cuando la prueba falle.
