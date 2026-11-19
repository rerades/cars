# Rankings

PRD-005 (ready, P2): RF-1 a RF-15, RNF-1 a RNF-6; CA-1 a CA-18. Tokens: [`tokens.md`](tokens.md). Esquema:
`docs/architecture/data-model.md` (ADR-0008). Se apoya en lo ya especificado y no lo repite:

- `<title>`, márgenes y anchos de página, estilo de enlaces, regla de «texto muy largo» y estado vacío de
  página: [`paginas-catalogo.md`](paginas-catalogo.md).
- Formato de las cifras, «Precio con oferta», «Condiciones de las ofertas», base de la batería, `note`, nombre
  de la fuente (dominio de la `url`) y fechas: [`ficha-modelo.md`](ficha-modelo.md), sección «Versiones» y
  «Fuente y fecha».
- Etiquetas de segmento, controles nativos, URL con query string, valores no válidos y región viva:
  [`filtros-catalogo.md`](filtros-catalogo.md).

Página pregenerada por ranking (RF-13, RNF-1, CA-14): la lista sin filtros, con sus cifras y fuentes, va en el
HTML servido. Solo los filtros usan JavaScript (RF-8, RF-9) y sin él no se muestran. Componentes de Bearnie
(ADR-0005): Badge para «Precio con oferta», Empty para los estados vacíos, Button para «Quitar filtros».

Esta especificación **no decide** cómo llegan los datos de las versiones al navegador ni cómo se filtra: solo
qué se ve antes y después de filtrar.

## Dirección visual (2026-11-18)

Pasa la página a la dirección elegida ([`direccion.md`](direccion.md), «La elegida»; [`propuesta-a.md`](propuesta-a.md);
tokens en [`tokens.md`](tokens.md), «Dirección visual»). **No cambia el alcance**: mismos elementos, mismo orden del DOM,
mismos textos, mismas reglas de empate, filtros, estados y foco que las secciones de abajo. Cambia **cómo se ven**. Donde
una sección de abajo diga otra cosa de presentación (tamaños, `--width-ranking`, `--text-price`, «sin tarjeta ni caja»,
wireframe), manda esta.

Prototipos (ADR-0024): `web/design-proto/ranking-a.astro` (ranking de precio con datos reales: ofertas, empate en el 5,
«Segmento por confirmar», versiones de nombre largo) y `web/design-proto/explorar-a.astro` (cabecera de `/coches` y franja
«Explorar» con el grupo «Rankings»).

| | Móvil (390) | Escritorio (1280) |
|---|---|---|
| Ranking | [captura](refs/ranking-a-390.png) | [captura](refs/ranking-a-1280.png) |
| «Explorar» en `/coches` | [captura](refs/explorar-a-390.png) | [captura](refs/explorar-a-1280.png) |

Las capturas de ranking se cortan a 2400 px: la franja blanca final (nota de RF-15 y «Condiciones de las ofertas») queda
fuera de la imagen; su forma se describe abajo.

### Franjas (RF-1, RF-3, RF-13, RNF-3)

```
┌─ franja oscura ─────────────┐  logotipo · ruta · h1 · entrada · línea de orden · alcance
├─ franja clara ──────────────┤  filtros (solo con JS) o ranking.filtros.sinJs
├─ franja oscura ─────────────┤  h2 «Puestos» + resumen · la <ol> de puestos (la «pantalla»)
├─ franja blanca ─────────────┤  nota de RF-15 · «Condiciones de las ofertas» (solo precio)
└─────────────────────────────┘
```

- Alternan oscuro, claro, oscuro y blanco, como el catálogo (`paginas-catalogo.md`, «Dirección visual»). Las franjas
  oscuras son el ámbito `.band-dark` de `tokens.md`: los componentes no cambian de clase.
- Todas a todo el ancho; el contenido, en `.wrap` (`--width-page`, márgenes `1.25rem` en móvil y `2.5rem` desde `md`).
  **`--width-ranking` deja de usarse**: la lista ocupa el ancho de página, porque cada puesto es una fila de pantalla con
  la cifra en su propia columna, no una línea de lectura.
- La franja clara de los filtros existe también sin JS (lleva `ranking.filtros.sinJs`). En el vacío de página
  (ningún puesto) no hay filtros, como hoy: la franja clara no se pinta y la oscura de «Puestos» lleva el Empty.

### Cabecera (RF-1, RF-13)

- Ruta en `text-small`, «Coches» enlace `on-dark` subrayado (44 px de alto), el título en `on-dark-muted`.
- `h1` **ancho** (`.wide`: `--font-stretch-wide`, 800) a **`--text-screen`**, no a `--text-display`: los títulos de ranking
  son frases de hasta 52 caracteres («… con la carga más rápida en continua») y a `--text-display` una palabra como
  «eléctricos» no cabe en 280 px a 320 de ancho. Ancho máximo `18ch`; parte entre palabras (`.word`) y, si una palabra no
  cabe, con `overflow-wrap: anywhere`. Nunca se reduce más ni se recorta (CA-17).
- Entrada en `text-body`, `on-dark-muted`; línea de orden en `text-body`, peso 700, `on-dark`; alcance en `text-small`,
  `on-dark-muted`. Las tres a `--width-prose`.

### Filtros (RF-8, RF-9, RNF-1)

Los dos `<select>` nativos, con su etiqueta visible a la izquierda (`text-small`, 600). El select, con la forma de las
píldoras de la barra del catálogo: fondo `surface`, borde `line` (4,24 sobre `surface-muted`), `--radius-pill`, alto
`--size-touch`.
- **Móvil:** uno debajo de otro; etiqueta de ancho fijo (`5.5rem`) y select hasta el borde: a 320 px quedan 280 − 88 − 12
  = 180 px de select, donde caben «De 30.000 a 45.000 €» y «SUV compacto».
- **`md`+:** en una fila, select de al menos `14rem`.
- Sin chips, sin «Aplicar», sin panel: lo de «Filtros» de abajo sigue igual.

### El puesto como pantalla (RF-3, RF-2, RF-7, CA-2, CA-3)

Cada `<li>` es una fila de la franja oscura, separada por una línea fina `line-soft` (decorativa). **Todos los puestos
iguales**: mismo tamaño, color y fondo del 1 al 10 (RF-2, CA-2). Sin alternar fondos entre puestos, sin podio.

```
Móvil (320–1023 px)                      Escritorio (≥ 1024 px)
──────────────────────────────           ───────────────────────────────────────────────────────────────
5      Renault                           5        Renault                                21.974 €
empate Renault 4 E‑Tech                  empate   Renault 4 E‑Tech eléctrico             Precio
       eléctrico                                  evolution 120 CV autonomía urbana      [Precio con oferta]
       evolution 120 CV autonomía…                Urbano                                 Fuente: renault.es, 1 nov 2026
       Urbano                                                                            Ver condiciones de la oferta
       ───────────────────               ───────────────────────────────────────────────────────────────
       21.974 €
       Precio
       [Precio con oferta]
       Fuente: renault.es, 1 nov 2026
       Ver condiciones de la oferta
──────────────────────────────
```

- **Rejilla.** Móvil: `--width-rank-number` (3 rem) | contenido, separación `0.75rem`. Desde `lg`: `--width-rank-number`
  (6 rem) | contenido | `--width-rank-figure` (22 rem), separación `2rem`, filas `auto 1fr`. La cifra ocupa las dos filas
  de la tercera columna, así **todas las cifras quedan alineadas** en vertical y se comparan de un vistazo. Relleno
  vertical `1.5rem` (móvil) y `1.75rem` (`lg`).
- **Número de puesto** (dentro del `h3`, con `ranking.puesto.sr` oculto, como abajo): cifra **estrecha**
  (`--font-stretch-narrow`, 700, `tabular-nums`, interlínea 0,82) a `--text-rank-number`, en `ink-600` (en la franja,
  `on-dark-muted`): se ve, pero no compite con el valor. «empate» debajo, `text-small`, peso 400.
- **Marca y modelo** (el enlace del `h3`): la marca en `text-body`, 600, en su línea; el modelo **ancho** (`.wide`) a
  `--text-version`. Los dos en `ink-900` (`on-dark`) y **subrayados palabra a palabra** (el subrayado va en cada `.word`,
  no en los espacios entre ellas: con el subrayado en el enlace, en Archivo ancha salían guiones bajos sueltos entre
  palabras). En la franja oscura el subrayado es lo que distingue el enlace del texto (WCAG 1.4.1); hover `brand-800`
  (`signal`, 14,56).
- **Versión** `text-body` y **segmento** `text-small` debajo; «Segmento por confirmar» en `ink-600`.
- **Valor: componente Cifra** (`web/design-proto/a/Cifra.astro`, el de la ficha), tamaño **`l`** (`--text-figure-l`),
  dentro de un `<dl>` propio. En móvil va debajo del segmento, con una línea fina encima (como las cifras de la pantalla
  del catálogo); en `lg`, en la tercera columna, sin línea.
  - `dt` (etiqueta, debajo del número en pantalla, **antes** en el DOM): `ficha.campo.precio` / `.autonomia` /
    `.bateria` / `.potencia` / `.cargaCc` («Precio», «Autonomía WLTP», «Batería», «Potencia», «Carga máxima en CC»).
  - `dd`: número estrecho y unidad pequeña y ancha («21.974 €», «628 km», «77,5 kWh», «150 kW»). La Cifra separa la unidad
    por el último espacio, así que el texto que recibe es solo número y unidad.
  - **Base de la batería** (RF-3, decisión 9): va en la etiqueta, pegada al número: «Batería · útil», «Batería · bruta»,
    «Batería · sin especificar si es útil o bruta». El lector la oye antes de la cifra («Batería · útil, 77,5 kWh») y
    nunca se separa de ella. Sustituye a «misma línea y mismo tamaño» de «La cifra»: el `dd` de la Cifra solo admite
    número y unidad.
  - `dd.cifra__detalle` (debajo de la etiqueta, `text-small`, `ink-600`): por este orden, el Badge `deal` «Precio con
    oferta» (solo `financed`), «Fuente: {dominio}, {fecha}» (+ «· fuente no oficial» si T2), la `note` y «Ver condiciones
    de la oferta» (44 px de alto). El dominio es el enlace, subrayado, con su zona de 24 px.
  - Una cifra de ranking nunca es «por confirmar»: sin cifra no hay puesto (RF-6). El estado `cifra__falta` de la Cifra no
    se usa aquí.
- **Sin foto ni silueta** (decisión 4, se mantiene). En esta dirección la imagen manda en el catálogo y en la ficha; en
  el ranking manda la cifra. Además, una pantalla con buena foto junto a otra con silueta haría que dos puestos no se
  vieran igual (CA-2), y diez fotos pesan (RNF-2). La «pantalla» la hacen la franja oscura, el nombre ancho y la cifra
  enorme.
- **A 320 px** (CA-17): 320 − 2 × 20 = 280 px; 48 de número + 12 = 220 px de contenido. La cifra más ancha posible,
  «150.000 €» a 52 px estrecha, mide unos 175 px; el modelo ancho parte entre palabras. Sin scroll horizontal.

### Lista y resumen

- `h2` «Puestos» **ancho**, a `--text-block`, con el resumen (`text-body`, `on-dark-muted`) a su derecha en la misma
  línea base, que baja de línea si no cabe. El resumen sigue siendo la única región viva.
- Vacío de página y vacío filtrado: dentro de la franja oscura, en lugar de la `<ol>`, con los textos y el enlace o el
  Button de «Estados». El Button principal en franja oscura usa los colores reasignados: fondo `on-dark`, texto
  `ink-950` (18,86).

### Franja blanca final (RF-15, RF-5)

Nota de RF-15 (`text-small`, `ink-600`, 7,53) y, en el ranking de precio con ofertas, «Condiciones de las ofertas» con su
`h2` ancho a `--text-block` y las entradas de `RankingTerms` sin cambios (`brand-600` sobre `surface`, 7,59).

### Foco

Anillo de `tokens.md`; en la franja oscura, `on-dark` (18,86 sobre `ink-950`). Orden sin cambios («Orden de foco»).

### Lo que cambia para el Desarrollador

- `RankingPlace.astro`: la rejilla de tres columnas en `lg`, el número estrecho, marca y modelo como arriba, y la cifra con
  la Cifra que se lleve a `web/src/components/` desde la ficha (la misma, no una copia). `PlaceView` necesita el valor
  **sin la base** y la base aparte (hoy `figure` llega como «58 kWh, útil»); el prototipo lo parte por la coma solo para
  enseñarlo.
- La `<template>` del filtro clona el mismo marcado: la Cifra tiene que poder rellenarse con `textContent` (número y
  unidad en sus dos `span`).
- `[ranking].astro`: las cuatro franjas, `h1` a `--text-screen`, quitar `max-w-(--width-ranking)`.

## Grupo «Rankings» en la franja «Explorar» (PRD-001 RF-14, CA-19)

Ver [captura 390](refs/explorar-a-390.png) y [captura 1280](refs/explorar-a-1280.png). En la dirección elegida, «Explorar»
es una **franja blanca** entre la cabecera oscura y la barra de filtros clara de `/coches`, con su `h2` ancho a
`--text-block`. Cada grupo es una fila separada por una línea fina `line-soft`; el `h3` en `text-small`, 700, mayúsculas
por CSS (`text-transform`, el texto sigue siendo «Rankings») y espaciado `0.04em`; los enlaces en `text-body`, `brand-600`
(7,59 sobre `surface`), subrayados, 44 px de alto, separados `1.25rem`.
- **«Rankings» es el quinto grupo, el último**, con el mismo estilo exacto que los otros cuatro: ni color, ni icono, ni
  caja propia. Sus cinco enlaces, en el orden de RF-1.
- **Móvil:** `h3` encima y enlaces en línea que parten línea. **`md`+:** `h3` en la columna `--width-explore-label`
  (8 rem) y los enlaces a la derecha, una fila por grupo.
- A 390 px «Carga más rápida en continua» cabe en una línea; si no cupiera, el enlace parte (`overflow-wrap: anywhere`).

## Los cinco rankings: URL, título y entrada (RF-1, RF-13, CA-1, CA-12)

URL bajo `/rankings/`, con un nombre legible en español y sin parámetros, como las de tramo de
`paginas-catalogo.md` (`/precio/hasta-30000-euros`). No hay página `/rankings` (ver Pregunta 1).

| Ranking (RF-1) | URL | Campo · sentido | Prefijo de claves |
|---|---|---|---|
| Más baratos | `/rankings/mas-baratos` | `price.value` · ascendente | `ranking.precio.*` |
| Más autonomía | `/rankings/mas-autonomia` | `wltp_km` · descendente | `ranking.autonomia.*` |
| Más batería | `/rankings/mas-bateria` | `battery_kwh` · descendente | `ranking.bateria.*` |
| Más potencia | `/rankings/mas-potencia` | `power_kw` · descendente | `ranking.potencia.*` |
| Carga más rápida en continua | `/rankings/carga-mas-rapida-en-continua` | `dc_max_kw` · descendente | `ranking.cargaCc.*` |

- `h1` = `ranking.{x}.titulo`; `<title>` = `pagina.tituloDocumento` con ese `h1` («Coches eléctricos con más
  autonomía · siete3»).
- Canonical: `<link rel="canonical">` a la URL de la página del ranking, sin query string, en el HTML servido; sin `noindex`
  (RF-13, decisión 7, CA-12). Igual que `/coches`.
- Los textos son distintos entre sí y de los de `paginas-catalogo.md` (CA-12): ninguno empieza como «Coches
  eléctricos hasta…», «… de más de…» ni repite las entradas de tramo o de segmento. El Desarrollador lo
  comprueba en el build junto con la prueba de CA-12b de PRD-001.

| Clave | `titulo` (`h1`) | `entrada` |
|---|---|---|
| `ranking.precio` | Coches eléctricos más baratos | Las versiones de coches eléctricos a la venta en España con el precio más bajo. Precio publicado por la marca, con IVA y sin descontar ayudas; si es una oferta, lo verás marcado como «Precio con oferta». |
| `ranking.autonomia` | Coches eléctricos con más autonomía | Las versiones de coches eléctricos a la venta en España con más autonomía homologada WLTP. Es la cifra de homologación que publica la marca, no la de uso real. |
| `ranking.bateria` | Coches eléctricos con más batería | Las versiones de coches eléctricos a la venta en España con la batería de más capacidad. Cada cifra dice si la marca publica la capacidad útil, la bruta o no lo especifica. |
| `ranking.potencia` | Coches eléctricos con más potencia | Las versiones de coches eléctricos a la venta en España con más potencia, en kilovatios, según la marca. |
| `ranking.cargaCc` | Coches eléctricos con la carga más rápida en continua | Las versiones de coches eléctricos a la venta en España que admiten más potencia de carga en corriente continua. Es la potencia máxima que publica la marca, no un tiempo de carga. |

Reglas de las entradas (las de `paginas-catalogo.md`): una o dos frases, `text-body`, `ink-900`, ancho
`--width-prose`; sin cifras de coches; sin «mejor», «recomendado» ni juicios (RF-2, CA-2). La de batería
anticipa la base que cada puesto dice (sección 6 de PRD-005, decisión 9).

### Línea de orden (RF-1, CA-1)
Justo debajo de la entrada, un párrafo `text-body`, `ink-900`, peso 600, que nombra el campo y el sentido. Es
el texto de RF-1 y va siempre en el HTML, también en el estado vacío (RNF-1):

| Clave | Texto |
|---|---|
| `ranking.precio.orden` | Ordenadas por precio, de menor a mayor. |
| `ranking.autonomia.orden` | Ordenadas por autonomía WLTP, de mayor a menor. |
| `ranking.bateria.orden` | Ordenadas por capacidad de batería, de mayor a menor. |
| `ranking.potencia.orden` | Ordenadas por potencia, de mayor a menor. |
| `ranking.cargaCc.orden` | Ordenadas por potencia máxima de carga en continua, de mayor a menor. |

Debajo, en `text-small`, `ink-600`, la frase común `ranking.alcance`: «Solo entran versiones de modelos a la
venta, con la cifra publicada por una fuente oficial o no oficial verificable. Como máximo, 10 puestos.»
(RF-4, RF-6, RF-7, RF-11).

## Estructura y orden de lectura

Orden del DOM = orden visual = orden de lectura (WCAG 1.3.2) en todas las anchuras.

1. Enlace «Saltar a los resultados» (`pagina.saltar`), al `h2` de la lista.
2. Cabecera y navegación del sitio (fuera de esta especificación).
3. **Ruta** (`<nav>`, como en la ficha): «Coches» → `/coches`, y el título del ranking como texto con
   `aria-current="page"`. Es el camino de vuelta al catálogo que pide CA-13.
4. `<main>`:
   1. **Cabecera**: `h1`, entrada, línea de orden, `ranking.alcance` (RF-1, RF-13).
   2. **Filtros** (solo con JS; RF-8, RF-9). Sin JS, en su lugar, el texto `ranking.filtros.sinJs`.
   3. **Lista** (`<section aria-labelledby>`, `h2` `ranking.lista.titulo` «Puestos»): la línea de resumen, la
      `<ol>` de puestos o el estado vacío (RF-3, RF-7).
   4. **Versiones que se quedan fuera** (RF-15): un párrafo, siempre, justo debajo de la lista.
   5. **Condiciones de las ofertas** (`h2`, RF-5): solo si algún puesto mostrado tiene precio con oferta.
5. Pie del sitio.

Encabezados: un `h1`; `h2` «Puestos» y «Condiciones de las ofertas» (y «Filtrar» oculto solo visualmente, con
JS); `h3` por puesto. Sin bloque «Fuentes» al final: cada cifra lleva su fuente visible junto al valor (RF-4).

### Wireframe

(Anterior a la dirección visual: vale el orden, no la forma. La forma, en «Dirección visual».)

```
Móvil (320–767 px)                     Escritorio (≥ 1024 px)
┌──────────────────────────┐           ┌──────────────────────────────────────────────────────┐
│ Coches › Coches eléctri… │           │ Coches › Coches eléctricos con más autonomía         │
│ h1 Coches eléctricos con │           │ h1 Coches eléctricos con más autonomía               │
│    más autonomía         │           │ Las versiones de coches eléctricos a la venta…       │
│ Las versiones de coches… │           │ Ordenadas por autonomía WLTP, de mayor a menor.      │
│ Ordenadas por autonomía  │           │ Solo entran versiones de modelos a la venta…         │
│ WLTP, de mayor a menor.  │           │                                                      │
│ Solo entran versiones…   │           │ Segmento [Todos      ▾]   Precio [Cualquiera    ▾]  │
│                          │           │                                                      │
│ Segmento                 │           │ Puestos                                              │
│ [Todos               ▾]  │           │ 10 versiones                                         │
│ Precio                   │           │ ┌────┬─────────────────────────────────────────┐     │
│ [Cualquiera          ▾]  │           │ │ 1  │ h3 Polestar Polestar 3                  │     │
│                          │           │ │    │ Long range Dual motor · SUV grande      │     │
│ Puestos                  │           │ │    │ 628 km                                  │     │
│ 10 versiones             │           │ │    │ Fuente: polestar.com, 22 sep 2026       │     │
│ ┌───┬──────────────────┐ │           │ │    │                                         │     │
│ │ 1 │ h3 Polestar      │ │           │ ├────┼─────────────────────────────────────────┤     │
│ │   │ Polestar 3       │ │           │ │ 2  │ h3 Cupra Tavascan                       │     │
│ │   │ Long range Dual… │ │           │ │empa│ Endurance · SUV compacto                │     │
│ │   │ SUV grande       │ │           │ │te  │ 557 km                                  │     │
│ │   │ 628 km           │ │           │ │    │ Fuente: cupra.com, 24 sep 2026          │     │
│ │   │ Fuente: polestar.│ │           │ ├────┼─────────────────────────────────────────┤     │
│ │   │ com, 22 sep 2026 │ │           │ │ 2  │ …                                       │     │
│ │   │                  │ │           │ │ 4  │ …                                       │     │
│ ├───┼──────────────────┤ │           │ └────┴─────────────────────────────────────────┘     │
│ │ 2 │ …                │ │           │ 3 versiones a la venta se han quedado fuera…         │
│ └───┴──────────────────┘ │           │                                                      │
│ 3 versiones a la venta…  │           └──────────────────────────────────────────────────────┘
└──────────────────────────┘
```
(Las cifras y versiones del dibujo son ilustrativas, no datos. «Condiciones de las ofertas» no sale porque solo existe en el ranking de precio.)

## Lista de puestos (RF-3, RF-7, RNF-3, CA-3, CA-7)

**Una `<ol>`, no una tabla.** Un puesto puede llevar etiqueta, nota, condiciones y fuente: en tabla habría que
duplicarla en bloques para 320 px, como la ficha. Una lista apilada cabe a cualquier anchura con una sola
presentación y el lector la anuncia como «lista, 10 elementos» (RNF-3).

- `<ol aria-labelledby>` con el `h2` «Puestos». `list-style: none` y `role="list"` explícito (Safari quita la
  semántica de lista cuando no hay viñeta). Cada `<li>` lleva `value="{puesto}"`, así que la numeración nativa
  coincide con la visible también en los empates (1, 2, 2, 4).
- (Sustituido por «Dirección visual»: ancho de página, rejilla de tres columnas en `lg`, número estrecho y Cifra.)
  ~~Ancho máximo de la lista `--width-ranking` (nuevo, 48 rem)~~: es una lista de lectura, no una rejilla; a todo
  `--width-page` las líneas quedarían demasiado separadas del número.
- Cada puesto, dos columnas en todas las anchuras: número (`--width-rank-number`, nuevo, 3 rem) y contenido
  (el resto), separadas `3`. Separación entre puestos con borde inferior `line-soft` (decorativo) y relleno
  vertical `4`. Sin tarjeta ni caja: el orden lo da la lista.
- A 320 px: 320 − 2×16 de margen = 288 px; 48 de número + 12 de separación dejan 228 px de contenido. Todo
  parte línea (`overflow-wrap: anywhere`); nada se recorta ni hay scroll horizontal (CA-17).

### Qué lleva un puesto (RF-3, decisión 4)

En este orden del DOM, en la columna de contenido salvo el número:

| # | Elemento | Origen | Presentación | Requisito |
|---|---|---|---|---|
| 1 | Número de puesto | posición (RF-7) | `--text-rank-number`, `ink-900`, dentro del `h3`, antes del enlace y fuera de él, precedido del texto oculto visualmente «Puesto» (`ranking.puesto.sr`). El `h3` ocupa las dos columnas con `grid-template-columns: subgrid`, así que el número se ve en la columna izquierda, alineado arriba | RF-3, RF-7, CA-3 |
| 2 | Marca y modelo | `brand_name`, `model` | `h3`, `--text-card-title`, `ink-900`; el texto entero es un enlace a `/marcas/{marca}/{modelo}/` (`brand-600`, subrayado, hover `brand-800`) | RF-3, CA-3 |
| 3 | Versión | `versions[].name` | `text-body`, `ink-900`, literal | RF-3, CA-3 |
| 4 | Segmento | `segment.value` | `text-small`, `ink-600`, con el rótulo oculto visualmente «Segmento:» y la etiqueta de `filtros-catalogo.md`. Sin segmento: «Segmento por confirmar» (`ficha.segmento.porConfirmar`) | Decisión 4 |
| 5 | Cifra del ranking | el campo de RF-1 | Ver «La cifra» | RF-3, RF-4, RF-5 |
| 6 | Fuente y fecha | `source_id`, `url`, `retrieved`, `tier` | Ver «La cifra» | RF-4, CA-4 |

**Decisión 4: segmento sí, imagen no.**
- **Segmento**: es texto, pesa cero bytes y da el contexto que el filtro de segmento (RF-8) usa; quien ve
  «Polestar 3» junto a «Cupra Born» entiende que no compiten en lo mismo. Es un dato del modelo pero **no es una
  cifra**, así que no choca con RF-3.
- **Sin imagen ni silueta**: diez imágenes harían de la lista una página pesada (RNF-2, LCP < 2,5 s en 4G) y
  quitarían ancho a 320 px, donde la columna útil ya es de 228 px. La imagen está a un enlace, en la ficha.
- **Ninguna cifra de modelo** («precio desde», «autonomía máxima») ni otra cifra de la versión: solo la del
  ranking (RF-3). En el ranking de precio no se enseña la autonomía y en el de autonomía no se enseña el precio.
- **Sin etiqueta de estado**: todas las versiones son de modelos `on_sale` (RF-11, CA-3).
- **Sin «Comparar»**: PRD-003 solo lo ofrece desde la tarjeta y la ficha (RF-6, RF-7), y la ficha está a un
  enlace. Ver Pregunta 2.
- **Nada más**: ni enlace de compra, ni «Ver en la web de la marca», ni insignias, medallas, colores de podio o
  tamaños distintos para los tres primeros (RF-2, RF-14, sección 8 de PRD-005, CA-2, CA-13). El puesto 1 se pinta
  exactamente igual que el 10.

### La cifra, su fuente y su fecha (RF-2, RF-4, RF-5, CA-4, CA-5, CA-16)

Formato de `ficha-modelo.md`, «Campos y formato» y «El precio, en detalle», con la fuente **visible junto al
valor** en todos los rankings (no solo en el de precio: RF-4 lo pide para cada cifra, y aquí no hay bloque
«Fuentes» al que remitir).

```
36.273 €  [Precio con oferta]          ← --text-price, ink-900 + Badge deal (solo financed)
Fuente: cupra.com, 24 sep 2026          ← text-small, ink-600; «cupra.com» enlaza a la url del dato
Ver condiciones de la oferta            ← solo financed; ancla a «Condiciones de las ofertas»
publicado: 190 CV                       ← note, si la trae; text-small, ink-600, literal
```

| Ranking | Valor (`--text-price`, `ink-900`) | Claves |
|---|---|---|
| Precio | «36.273 €»: `es-ES`, sin decimales; Badge `deal` «Precio con oferta» si `financed` | `ficha.unidad.eur`, `ficha.precio.oferta` |
| Autonomía | «441 km» | `ficha.unidad.km` |
| Batería | «58 kWh, útil» · «80 kWh, bruta» · «58 kWh, sin especificar si es útil o bruta» | `ficha.bateria.usable` / `.gross` / `.unknown` |
| Potencia | «140 kW» | `ficha.unidad.kw` |
| Carga en continua | «135 kW» | `ficha.unidad.kw` |

- La cifra es el valor del fichero tal cual; decimales con coma `es-ES` («77,5 kWh»). El precio se redondea solo
  al mostrar, como la tarjeta y la ficha (CA-16).
- **Base de la batería** (sección 6, decisión 9): siempre pegada a la cifra, en la misma línea y el mismo tamaño,
  porque cambia el significado del número. Las tres bases se ordenan juntas; dos cifras iguales con base
  distinta empatan (RF-7: la cifra es la misma).
- **Fuente** (`ranking.fuente`): «Fuente: {fuente}, {fecha}». `{fuente}` es el dominio de la `url` sin `www.`
  (`ficha-modelo.md`, «Nombre de la fuente») y es el enlace a la `url`; `{fecha}` es `retrieved` en mes corto
  («24 sep 2026», `fecha.*`). Zona táctil ampliada a 24 × 24 px como las marcas de nota de la ficha (enlace en
  línea).
- **T2**: tras la fecha, «· fuente no oficial» (`ranking.noOficial`), en texto `ink-600`, nunca solo con color
  (RNF-3, CA-17). **T1**: nada (CA-4). **T3**: la versión no está en la lista (RF-4, RF-6).
- **Precio con oferta** (RF-5, CA-5): el Badge `deal` va junto al valor y baja de línea si no cabe. Debajo de
  la fuente, «Ver condiciones de la oferta» (`ficha.precio.verCondiciones`), enlace interno a su entrada en
  «Condiciones de las ofertas». Un `pvp` no lleva etiqueta. Ambos se ordenan por `price.value`.
- **`note`**: debajo de la fuente, `text-small`, `ink-600`, literal, sin comillas (como la ficha, RF-2).

### Empates (RF-7, CA-7)

```
1    Polestar Polestar 3 …        628 km
2    Cupra Tavascan, Endurance    557 km
empate
2    Kia EV6 …                    557 km
empate
4    …
```

- Mismo número en las versiones con la misma cifra; dentro del empate, orden alfabético de marca, modelo y
  `name`; el siguiente puesto salta (1, 2, 2, 4). La numeración la resuelve el build (y el filtro, con JS); el
  diseño solo la pinta.
- Bajo el número de cada puesto empatado, dentro del `h3` como él, la palabra «empate» (`ranking.puesto.empate`), `text-small`,
  `ink-600`. Así el puesto compartido se entiende sin comparar números a ojo y sin color. El lector oye «Puesto
  2, empate». A 320 px «empate» cabe en los 48 px de la columna en `text-small`; si una traducción no cabe,
  parte línea.
- Si un empate cruza el décimo puesto, solo entran los primeros por orden alfabético (RF-7, decisión 11), sin
  aviso aparte: la nota de RF-15 cuenta solo las versiones sin dato, no las que tienen dato y no caben.

### Menos de 10 versiones (RF-7, CA-7)
Se muestran las que haya, sin filas de relleno ni huecos numerados. La línea de resumen dice cuántas.

### Línea de resumen
Entre el `h2` «Puestos» y la lista: `ranking.resumen` «10 versiones» / «1 versión» / «Ninguna versión»,
`text-body`, `ink-600`. Sin JS es un `<p>` ya escrito; con JS es la **única** región viva de la página
(`role="status"`, `aria-live="polite"`) y se actualiza al filtrar sin mover el foco (WCAG 4.1.3), como el
resumen de `filtros-catalogo.md`.

## Versiones que se quedan fuera (RF-15, CA-18)

Un párrafo bajo la lista, siempre (también en los estados vacíos), `text-small`, `ink-600`, ancho
`--width-prose`. Cuenta las versiones publicadas y a la venta, **dentro de los filtros aplicados**, que no tienen
la cifra o la tienen solo de fuente T3. El número lo calcula el build o el filtro; el diseño fija el texto:

| Clave | Texto |
|---|---|
| `ranking.fuera.n` | {n} versiones a la venta se han quedado fuera por no tener publicado {dato} con fuente verificable. |
| `ranking.fuera.uno` | 1 versión a la venta se ha quedado fuera por no tener publicado {dato} con fuente verificable. |
| `ranking.fuera.ninguna` | Ninguna versión a la venta se ha quedado fuera: todas tienen publicado {dato}. |
| `ranking.{x}.dato` | precio: «el precio» · autonomía: «la autonomía WLTP» · batería: «la capacidad de batería» · potencia: «la potencia» · carga: «la potencia de carga en continua» |

«Publicado con fuente verificable» cubre a la vez el dato ausente y el dato solo T3 (CA-18 pide contarlos
juntos), sin explicar el sistema de niveles. No se dice cuáles son esas versiones (RF-15 pide el número).

## Filtros de segmento y de precio (RF-8, RF-9, RF-10, RNF-1, CA-8, CA-9, CA-11)

Dos `<select>` nativos con `<label>` visible, en una fila (`md`+) o uno debajo de otro (móvil), entre la
cabecera y la lista. Se reutiliza el patrón del selector de orden de `filtros-catalogo.md` (control nativo,
etiqueta visible asociada con `for`, `--size-touch`, borde `line`), **no** el panel con disclosure: con dos
controles no hace falta abrir ni cerrar nada. Ver Pregunta 3 sobre la selección de varios segmentos.

| Control | Etiqueta | Opciones | Regla |
|---|---|---|---|
| Segmento | «Segmento» (`filtros.segmento`) | «Todos» (`ranking.filtros.todos`, por defecto) y los segmentos de RF-11 que tengan alguna versión en este ranking, con la etiqueta de `filtros-catalogo.md`, en orden alfabético | Una versión de un modelo sin segmento sale al elegir uno (RF-8, CA-8). Si ninguna versión del ranking tiene segmento, el control no se pinta |
| Precio | «Precio» (`filtros.precio`) | «Cualquiera» (`ranking.filtros.cualquiera`, por defecto), «Hasta 30.000 €», «De 30.000 a 45.000 €», «Más de 45.000 €» (`explorar.precio.*`) | Sobre el precio de la versión, bordes de PRD-001 RF-10 (RF-9, CA-9); una versión sin precio sale al elegir un tramo. También en el ranking de precio (RF-10) |

- **Envoltorio**: `<div role="group" aria-labelledby>` con un `h2` oculto solo visualmente, «Filtrar»
  (`ranking.filtros.titulo`). No es un `<form>` y no envía nada (RF-12, CA-11).
- **Al cambiar** un select, la lista se recalcula al momento y se numera de 1 a 10 **dentro del resultado** (RF-8);
  cambian el resumen (región viva), la nota de RF-15 y las «Condiciones de las ofertas». El foco se queda en el
  select. Sin botón «Aplicar».
- **URL**: la query string refleja los filtros y abrirla los reproduce, sustituyendo la entrada de historial
  como en `/coches` (`filtros-catalogo.md`, «URL»). El parámetro de segmento usa el **mismo nombre y valores**
  que el de `/coches`; el de precio se llama `precio` y lleva el slug del tramo (`hasta-30000-euros`,
  `de-30000-a-45000-euros`, `mas-de-45000-euros`, los de `PRICE_BANDS`; ADR-0015, 2026-10-15). Ejemplo:
  `?segmento=suv_compacto&precio=hasta-30000-euros`. Un valor no válido se ignora sin aviso
  (`filtros-catalogo.md`, Pregunta 4). El canonical no cambia (RF-13).
- **Sin JavaScript** (RNF-1): los dos controles **no existen** en el HTML servido (los inserta el script) y en
  su lugar se ve `ranking.filtros.sinJs`, `text-small`, `ink-600`, dentro de `<noscript>`. Abrir una URL con
  query string sin JS muestra el ranking sin filtrar, que es lo que dice su canonical.
- **Sin chips ni «Limpiar filtros» permanente**: los dos valores elegidos ya se ven en sus select. Solo el
  estado vacío filtrado ofrece «Quitar filtros».

## Estados

| Situación | Qué se ve | Requisito |
|---|---|---|
| Ranking con 10 o más versiones con cifra | 10 puestos, numerados con los saltos de empate | RF-7, CA-7 |
| De 1 a 9 versiones | Esas, sin relleno; resumen «{n} versiones» | RF-7, CA-7 |
| **Cero versiones, sin filtros** | Vacío de página (abajo), con enlace a `/coches` | RF-7, CA-7 |
| **Cero versiones con filtros** | Vacío filtrado (abajo), con «Quitar filtros» | RF-8, RF-9 |
| Empate | Mismo número, «empate» bajo él, orden alfabético | RF-7, CA-7 |
| Precio con oferta | Badge, fuente, «Ver condiciones de la oferta» y texto literal en su bloque | RF-5, CA-5 |
| Cifra T2 | «· fuente no oficial» tras la fecha | RF-4, CA-4 |
| Cifra T3, ausente o `null` | La versión no aparece; cuenta en la nota de RF-15 | RF-4, RF-6, CA-4, CA-6, CA-18 |
| Modelo sin segmento | «Segmento por confirmar»; sale al filtrar por segmento | RF-8, CA-8 |
| Versión sin precio en otro ranking | Aparece si tiene la cifra; sale al filtrar por tramo | RF-9, CA-9 |
| `announced`, `discontinued`, `needs_review` | No aparecen ni cuentan en RF-15 | RF-11, CA-10 |
| `note` | Bajo la fuente, literal | RF-2 |
| Sin JS | Lista completa sin filtrar; `ranking.filtros.sinJs` en lugar de los controles | RNF-1, CA-14 |
| Texto muy largo | Marca, modelo, versión, `note`, `price_terms` y dominio parten línea (`overflow-wrap: anywhere`); nunca se recortan ni se reduce la letra; sin scroll horizontal a 320 px | RNF-3, CA-17 |
| Cargando | Sin indicador: mientras llegan los datos del filtro (ADR-0015) se ve la lista del HTML | RNF-1 |
| Error al filtrar | Si los datos del filtro no llegan, el select que se acaba de cambiar vuelve a su valor anterior, la lista no cambia y la región viva (`ranking.resumen`) dice `ranking.filtros.error`. El foco se queda en el select. El siguiente cambio vuelve a intentarlo. La lista nunca contradice a los selects (ADR-0015) | RNF-1 |
| Si el script falla | Queda la lista del HTML sin filtrar | RNF-1 |

### Vacío de página: ninguna versión con el dato (RF-7, CA-7)
En lugar de la `<ol>` (no hay lista vacía), bajo el `h2` «Puestos», el patrón de `paginas-catalogo.md`, «Estado
vacío de página» (Empty de Bearnie, sin caja, sin `role="status"`):

```
Puestos
Ninguna versión
Todavía no hay ninguna versión a la venta que tenga publicado {dato}.   ← ranking.vacio.texto, text-body ink-900
Ver todos los coches                                             ← vacio.pagina.enlace → /coches, 44 px
{n} versiones a la venta se han quedado fuera…  (nota de RF-15)
```

### Vacío filtrado (RF-8, RF-9)
Solo en el navegador. Los select siguen visibles. En lugar de la lista: `ranking.vacioFiltros.texto`
«Ninguna versión cumple los filtros.» y un Button principal «Quitar filtros» (`ranking.filtros.quitar`,
`on-brand` sobre `brand-600`, 44 px). Al pulsarlo, los dos select vuelven a «Todos» / «Cualquiera», la URL
vuelve a la del ranking sin query string y el foco pasa al `h2` «Puestos» (`tabindex="-1"`), porque el botón
desaparece (WCAG 2.4.3). El resumen anuncia «Ninguna versión» antes; no hay segunda región viva.

## Condiciones de las ofertas (RF-5, CA-5)

Mismo bloque que la ficha («Condiciones de las ofertas»), pero con `h2` porque aquí es un bloque de `main`:
`ficha.condiciones.titulo`. Una entrada por puesto **mostrado** con precio `financed`, en el orden de la lista:
«{marca} {modelo}, {versión}» (`text-body`, peso 600, destino del ancla con `tabindex="-1"`), el texto literal de
`price_terms` (`text-small`, `ink-900`, `--width-prose`, sin recortar) y el enlace
`ficha.condiciones.enlace` a `price_terms_url`. Si ningún puesto mostrado es `financed`, el bloque no existe.
Con filtros, se rehace con los puestos que quedan; los `id` de las anclas no dependen del puesto, para que no
apunten a otra versión al refiltrar.

Solo existe en el ranking de precio, el único que muestra el precio (RF-3). En los otros cuatro no hay precio
en pantalla ni condiciones.

## Orden de foco

1. «Saltar a los resultados».
2. Navegación del sitio.
3. Ruta: «Coches».
4. Con JS: select «Segmento», select «Precio».
5. Por puesto, en orden: enlace del modelo → enlace de la fuente → «Ver condiciones de la oferta» (si la hay).
6. En el vacío de página, «Ver todos los coches»; en el vacío filtrado, «Quitar filtros».
7. «Condiciones de las ofertas»: el enlace de cada entrada.

El número de puesto, la versión, el segmento, la cifra y los `h2` no son paradas. Anillo de foco de `tokens.md`.

## Lector de pantalla

Recorrido de «Más autonomía», de arriba abajo:
1. «Ruta de navegación, navegación.» «Coches, enlace.» «Coches eléctricos con más autonomía, página actual.»
2. «Coches eléctricos con más autonomía, encabezado nivel 1.» Entrada. «Ordenadas por autonomía WLTP, de mayor
   a menor.» Alcance.
3. (Con JS) «Filtrar, grupo.» «Segmento, Todos, botón emergente.» «Precio, Cualquiera, botón emergente.»
4. «Puestos, encabezado nivel 2.» «10 versiones.» «Puestos, lista, 10 elementos.»
5. Cada puesto: «Puesto 2, empate, Cupra Tavascan, enlace, encabezado nivel 3.» «Endurance.» «Segmento: SUV
   compacto.» «557 km.» «Fuente: cupra.com, enlace, 24 sep 2026.»
6. La nota de RF-15.

Por encabezados se salta a cada puesto («Puesto 1, Polestar Polestar 3»): el número va **dentro** del `h3`,
fuera del enlace (ver «Qué lleva un puesto»). Ninguna etiqueta depende del color: «Precio con oferta», «fuente no oficial» y «empate» son
texto (RNF-3, CA-17).

## Entrada desde `/coches` (PRD-001 RF-14, CA-19)

Un grupo nuevo, **«Rankings»**, en la franja «Explorar» de `/coches`, después de «Autonomía»: un `h3` y una
`<ul>` con un enlace de texto a cada ranking, en el orden de RF-1. Es HTML estático, visible sin JS, y sigue
las reglas de estilo, zona táctil y disposición de la franja. Solo en `/coches` (RF-14 no lo pide en las demás
páginas del catálogo; Pregunta 4). Cambio enlazado anotado en [`paginas-catalogo.md`](paginas-catalogo.md),
«Franja Explorar».

| Clave | Texto |
|---|---|
| `explorar.rankings` | Rankings |
| `explorar.ranking.precio` / `.autonomia` / `.bateria` / `.potencia` / `.cargaCc` | Más baratos / Más autonomía / Más batería / Más potencia / Carga más rápida en continua |

Desde un ranking **no** se enlaza a los demás rankings: CA-13 limita los enlaces a fichas, catálogo y fuentes
(y «Comparar», que aquí no se usa). Se vuelve por la ruta («Coches») y desde allí se elige otro.

## Copy (RNF-4: claves para i18n, sin textos fijos en los componentes)

Además de las de las tablas anteriores (`ranking.{x}.titulo`, `.entrada`, `.orden`, `.dato`, `ranking.fuera.*`,
`explorar.ranking*`):

| Clave | Texto |
|---|---|
| `ranking.alcance` | Solo entran versiones de modelos a la venta, con la cifra publicada por una fuente oficial o no oficial verificable. Como máximo, 10 puestos. |
| `ranking.ruta.nombre` | Ruta de navegación (mismo texto que `ficha.ruta.nombre`) |
| `ranking.lista.titulo` | Puestos |
| `ranking.resumen` | {n} versiones / 1 versión / Ninguna versión |
| `ranking.puesto.sr` | Puesto |
| `ranking.puesto.empate` | empate |
| `ranking.segmento.sr` | Segmento: |
| `ranking.fuente` | Fuente: {fuente}, {fecha} (mismo texto que `ficha.precio.fuente`) |
| `ranking.noOficial` | · fuente no oficial |
| `ranking.filtros.titulo` | Filtrar |
| `ranking.filtros.todos` | Todos |
| `ranking.filtros.cualquiera` | Cualquiera |
| `ranking.filtros.quitar` | Quitar filtros |
| `ranking.filtros.sinJs` | Para filtrar el ranking por segmento o por precio hace falta activar JavaScript. |
| `ranking.filtros.error` | No se ha podido filtrar. Vuelve a intentarlo. |
| `ranking.vacio.texto` | Todavía no hay ninguna versión a la venta que tenga publicado {dato}. |
| `ranking.vacioFiltros.texto` | Ninguna versión cumple los filtros. |

Reutilizadas sin cambios: `pagina.tituloDocumento`, `pagina.saltar`, `ficha.unidad.*`, `ficha.bateria.*`,
`ficha.precio.oferta`, `ficha.precio.verCondiciones`, `ficha.condiciones.*`, `ficha.segmento.porConfirmar`,
`filtros.segmento`, `filtros.precio`, `explorar.precio.*`, las etiquetas de segmento,
`vacio.pagina.enlace`, `fecha.*`. Si dos claves dan el mismo texto, el Desarrollador puede usar una sola.

## Tokens que usa

**Con la dirección visual (2026-11-18):** además de los de `tokens.md`, «Dirección visual» (`ink-950`, `on-dark`,
`on-dark-muted`, `surface-muted`, `signal`, `--font-stretch-wide`, `--font-stretch-narrow`, `--text-screen`,
`--text-block`, `--text-version`, `--text-figure-l`, `--radius-pill`), cambian tres: `--text-rank-number` pasa a
`clamp(2.75rem, 4.4vw, 4rem)` en anchura estrecha; `--width-rank-number` pasa a 6 rem desde `lg`; nuevo
`--width-rank-figure` (22 rem). `--width-ranking` y `--text-price` dejan de usarse aquí. Pares nuevos: ninguno sin
calcular; los de la página están en «Dirección visual» y en `tokens.md`. Lo de abajo es la versión anterior.

Color: `surface`, `ink-900`, `ink-600`, `line`, `line-soft`, `brand-600`, `brand-800`, `on-brand`, `deal-*`.
Tipografía: `--text-title`, `--text-section`, `--text-card-title`, `--text-price`, `--text-body`, `--text-small`,
`--text-badge`. Medidas: `--width-page`, `--width-prose`, `--size-touch`.

**Nuevos** (añadidos en `tokens.md`): `--width-ranking` (48 rem), `--width-rank-number` (3 rem),
`--text-rank-number` (1.5rem / 2rem, 700). **No hay colores nuevos** ni pares nuevos: todos los usados están
calculados en `tokens.md` (`ink-900` 17,74, `ink-600` 7,56, `brand-600` 6,67, `brand-800` 9,33 sobre `surface`;
`deal-fg` sobre `deal-bg` 8,15; `on-brand` sobre `brand-600` 6,67; `line` 4,83 como borde de select).

## Preguntas abiertas para Producto

Resueltas por el responsable del producto el 2026-10-14, al revisar la PR #311:

1. ~~**Página índice `/rankings`.**~~ No hay: la entrada es la franja de `/coches` (decisión 8) y `/rankings` da 404.
2. ~~**«Comparar» desde un puesto.**~~ No: el puesto enlaza a la ficha y desde ella se compara. PRD-003 no cambia.
3. ~~**Uno o varios segmentos a la vez.**~~ Uno, con un `<select>`, como dicen RF-8 y CA-8.
4. ~~**Enlaces a los rankings en las demás páginas del catálogo.**~~ Solo en `/coches` (PRD-001, RF-14).
5. ~~**Empate cortado en el puesto 10.**~~ Sin aviso, como dice RF-7.
