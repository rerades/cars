# Páginas del catálogo

PRD-001: RF-1, RF-4, RF-6, RF-7, RF-10, RF-11, RF-12; CA-1, CA-4, CA-6, CA-12, CA-13. Historias #35, #38 y #39.
Tokens: `tokens.md`. Esta especificación cubre **la página entera**: título, texto de entrada, contador,
colocación de los bloques, estado vacío, orden de lectura y de foco, y el paso de móvil a escritorio.
Lo que va dentro de cada bloque ya está especificado y no se repite aquí:

- La tarjeta y la rejilla de tarjetas: [`tarjeta-modelo.md`](tarjeta-modelo.md).
- El panel de filtros, el orden, los chips, el estado vacío de `/coches`, la URL con query string y la
  regla de base sin JavaScript: [`filtros-catalogo.md`](filtros-catalogo.md).

## Tipos de página

| Tipo | URL | Criterio (RF-10) | Cuántas | Panel de filtros |
|---|---|---|---|---|
| Catálogo | `/coches` | Todos los modelos (CA-1) | 1 | Sí, solo con JS (`filtros-catalogo.md`) |
| Marca | `/marcas/{marca}` | Modelos de esa marca (RF-4, CA-4) | Una por marca con modelos (CA-12a) | No |
| Segmento | `/segmentos/{segmento}` | Modelos con ese `segment` (RF-11) | Una por segmento con modelos (CA-12a) | No |
| Tramo de precio | `/precio/…` (las tres de RF-10) | «Precio desde» en el tramo, con oferta incluida (RF-9) | 3, siempre (CA-12a) | No |
| Tramo de autonomía | `/autonomia/…` (las dos de RF-10) | Autonomía WLTP máxima en el tramo | 2, siempre (CA-12a) | No |

Todas las páginas muestran los modelos de los tres estados (a la venta, próximamente, descatalogado) que
cumplan su criterio, cada uno con su etiqueta (RF-7). Un modelo sin el dato que define la página no
aparece en ella: sin `segment`, en ninguna de segmento; sin precio, en ninguna de precio; sin autonomía, en
ninguna de autonomía (RF-12, CA-9, CA-15: la misma regla que al filtrar). En la de marca siempre aparece.

Las pregeneradas se sirven ordenadas por el orden por defecto de `/coches` («Novedad», RF-3,
`filtros-catalogo.md`), resuelto al construir: sin JS no hay selector de orden (CA-12c).

## Estructura común

Un mismo esqueleto para los cinco tipos; lo único que cambia es si hay columna de filtros.
Orden del DOM = orden visual = orden de lectura (WCAG 1.3.2, RNF-3), el mismo que fija
`filtros-catalogo.md`: encabezado → resumen → «Explorar» → filtros → orden → resultados.

1. **Enlace «Saltar a los resultados»** (`filtros-catalogo.md`, «Orden de foco»). Destino: el `h2` de resultados.
2. Cabecera y navegación del sitio (fuera de esta especificación).
3. `<main>`:
   1. **`h1`** — título de la página (ver «Títulos y textos de entrada»).
   2. **Texto de entrada** — un párrafo (`<p>`), justo debajo del `h1`.
   3. **Contador** — «{n} modelos» (`resumen.n`).
   4. **Franja «Explorar»** — `<nav>` con su `h2` (ver «Franja Explorar»).
   5. Solo en `/coches` y con JS: **panel de filtros** (`filtros-catalogo.md`).
   6. **Resultados** — `<section>` con `h2` «Modelos», el selector de orden y los chips (solo `/coches` con JS),
      y la lista de tarjetas (`tarjeta-modelo.md`), o el estado vacío en su lugar.
4. Pie del sitio (fuera de esta especificación).

### Jerarquía de encabezados
- `h1`: el título de la página. Uno solo.
- `h2`: «Explorar», «Filtros» (solo `/coches` con JS) y «Modelos».
- `h3`: los grupos de la franja «Explorar» y el nombre del modelo en cada tarjeta. Así se concreta el
  «`h2`/`h3` según página» de `tarjeta-modelo.md`: **en todas las páginas del catálogo la tarjeta usa `h3`**.
- La lista de tarjetas toma su nombre del `h2` «Modelos» (`aria-labelledby`), que es el nombre «Modelos» que pide
  `tarjeta-modelo.md`.

### Contador (RF-10, CA-12)
- Texto `resumen.n`: «6 modelos», «1 modelo», «Ningún modelo». `text-body`, `ink-600`.
- **Pregeneradas:** es un `<p>` normal, ya escrito en el HTML con el número de su criterio. Sin `role="status"`:
  no cambia nunca, y anunciarlo al cargar sería ruido.
- **`/coches`:** es la línea `role="status"` de `filtros-catalogo.md` («Resumen y avisos»); sin JS muestra el total.
- Va antes de la franja «Explorar», pegado al texto de entrada, para que quien lee sepa cuántos modelos hay antes
  de decidir si explora otra página.

### Títulos y `<title>` (RF-10, CA-12b)
- El `h1` es el título propio de cada página.
- El `<title>` del documento es `pagina.tituloDocumento`: «{h1} · {sitio}». El nombre del sitio no está decidido
  y va en su propia clave (`sitio.nombre`). Como el `h1` ya es distinto en cada página, el `<title>` también lo es.

## Títulos y textos de entrada (RF-10, CA-12b, RNF-4)

Cada página tiene título y texto propios. Cuando una clave lleva variables (`{marca}`, `{segmento}`), el
resultado es distinto en cada página porque la variable lo es; los tramos y los segmentos llevan texto escrito
uno a uno. **CA-12b se comprueba sobre el texto ya compuesto**: el Desarrollador puede probarlo en el build
comparando los `h1` y los párrafos de entrada de todas las páginas pregeneradas.

Reglas para el texto de entrada:
- Una o dos frases, en `text-body` `ink-900`, con ancho máximo `--width-prose` para que la línea se lea bien.
- Dice qué hay en la página y con qué criterio, sin afirmar nada sobre coches concretos (ADR-0001: nada se
  inventa). No lleva cifras de datos salvo las del propio criterio.
- Las de precio recuerdan que el precio es sin ayudas y que el precio con oferta cuenta, con su etiqueta
  (PRD-001 §6, RF-9). Las de precio y autonomía dicen que los modelos sin el dato no aparecen (RF-12).

### `/coches`
| Clave | Texto |
|---|---|
| `pagina.coches.titulo` | Coches eléctricos |
| `pagina.coches.entrada` | Todos los modelos eléctricos del mercado español: los que están a la venta, los anunciados y los descatalogados. Precio de la marca en España sin ayudas y autonomía WLTP. |

### Marca (`/marcas/{marca}`, RF-4)
`{marca}` es `brand_name` (el nombre de presentación, `tarjeta-modelo.md`).

| Clave | Texto |
|---|---|
| `pagina.marca.titulo` | Coches eléctricos {marca} |
| `pagina.marca.entrada` | Los modelos eléctricos de {marca} en España, a la venta, anunciados y descatalogados, con su precio desde sin ayudas y su autonomía WLTP. |

### Segmento (`/segmentos/{segmento}`, RF-11)
Un título y una entrada por cada valor de RF-11, escritos uno a uno para que el plural suene natural. Solo se
usan los de los segmentos que tengan página (con modelos).

| Valor | `pagina.segmento.{valor}.titulo` | `pagina.segmento.{valor}.entrada` |
|---|---|---|
| `urbano` | Coches eléctricos urbanos | Eléctricos pequeños, pensados sobre todo para moverse por ciudad. |
| `compacto` | Compactos eléctricos | Eléctricos de tamaño medio con carrocería de turismo, para ciudad y carretera. |
| `berlina` | Berlinas eléctricas | Eléctricos con carrocería de berlina, de tres volúmenes o de maletero largo. |
| `familiar` | Familiares eléctricos | Eléctricos con carrocería familiar, con más espacio de carga detrás de los asientos. |
| `suv_pequeno` | SUV pequeños eléctricos | SUV eléctricos de tamaño reducido, con la altura de un SUV y medidas de urbano. |
| `suv_compacto` | SUV compactos eléctricos | SUV eléctricos de tamaño medio, entre el SUV pequeño y el grande. |
| `suv_grande` | SUV grandes eléctricos | SUV eléctricos de gran tamaño, con más espacio para pasajeros y equipaje. |
| `monovolumen` | Monovolúmenes eléctricos | Eléctricos con carrocería de monovolumen, pensados para aprovechar el espacio interior. |
| `furgoneta` | Furgonetas eléctricas | Furgonetas y combis eléctricas para pasajeros. |
| `deportivo` | Deportivos eléctricos | Eléctricos de carácter deportivo, donde prima la prestación. |

A cada entrada se le añade la frase común `pagina.segmento.coletilla`: «Solo aparecen los modelos cuyo segmento
está confirmado.» (RF-12).

### Tramos de precio (RF-10)
| URL | `titulo` | `entrada` |
|---|---|---|
| `/precio/hasta-30000-euros` (`pagina.precio.hasta30000.*`) | Coches eléctricos hasta 30.000 € | Modelos eléctricos cuyo precio desde en España no pasa de 30.000 €, sin descontar ayudas. |
| `/precio/de-30000-a-45000-euros` (`pagina.precio.de30000a45000.*`) | Coches eléctricos de 30.000 a 45.000 € | Modelos eléctricos cuyo precio desde en España está entre 30.000 y 45.000 €, sin descontar ayudas. |
| `/precio/mas-de-45000-euros` (`pagina.precio.masDe45000.*`) | Coches eléctricos de más de 45.000 € | Modelos eléctricos cuyo precio desde en España supera los 45.000 €, sin descontar ayudas. |

Coletilla común `pagina.precio.coletilla`: «Si el precio es de una oferta de la marca, lo verás marcado como
«Precio con oferta». Los modelos sin precio confirmado no aparecen aquí.» (RF-9, RF-12, CA-9).

### Tramos de autonomía (RF-10)
| URL | `titulo` | `entrada` |
|---|---|---|
| `/autonomia/mas-de-400-km` (`pagina.autonomia.masDe400.*`) | Coches eléctricos con más de 400 km de autonomía | Modelos eléctricos con al menos una versión que supera los 400 km de autonomía WLTP. |
| `/autonomia/mas-de-500-km` (`pagina.autonomia.masDe500.*`) | Coches eléctricos con más de 500 km de autonomía | Modelos eléctricos con al menos una versión que supera los 500 km de autonomía WLTP. |

Coletilla común `pagina.autonomia.coletilla`: «Es la cifra homologada WLTP, no la de uso real. Los modelos sin
autonomía confirmada no aparecen aquí.» (RF-12, CA-15).

«Al menos una versión» sigue la regla de CA-2 (`filtros-catalogo.md`). Los límites exactos de cada tramo son la
Pregunta 1.

### Texto muy largo
- `h1` con una marca de nombre largo: parte línea (`overflow-wrap: anywhere`), nunca se recorta ni se reduce el
  tamaño. A 320 px no provoca scroll horizontal (WCAG 1.4.10).
- Texto de entrada: fluye en tantas líneas como haga falta dentro de `--width-prose`.

## Franja «Explorar» (RF-10)

La franja existe porque las pregeneradas no tienen filtros (`filtros-catalogo.md`, «Regla de base»); aquí se
fija su forma y su lugar.

```
Explorar                                         ← h2 (text-section)
Marcas        Cupra · Polestar                   ← h3 (text-group) + lista de enlaces
Segmentos     SUV compacto · Berlina · …         ← solo si hay alguna página de segmento
Precio        Hasta 30.000 € · De 30.000 a 45.000 € · Más de 45.000 €
Autonomía     Más de 400 km · Más de 500 km
Todos los coches                                 ← enlace a /coches (no aparece en /coches)
```

- Es un `<nav aria-labelledby>` que apunta a su `h2` «Explorar» (`explorar.titulo`), para que el lector la
  distinga de la navegación del sitio.
- Cuatro grupos, en este orden: Marcas, Segmentos, Precio, Autonomía. Cada uno con su `h3` y una `<ul>` de enlaces.
- **Solo enlaza páginas que existen** (CA-12a): las marcas y los segmentos con modelos, y los cinco tramos. Un grupo
  sin ningún enlace no se pinta, ni su `h3` (hoy, el de Segmentos: ningún modelo tiene `segment`,
  `tarjeta-modelo.md`).
- Textos de los enlaces: la marca es `brand_name`; el segmento, su etiqueta de RF-11 (`filtros-catalogo.md`,
  «Etiquetas de segmento»); los tramos, `explorar.precio.*` y `explorar.autonomia.*` (ver «Copy»). Los grupos se
  ordenan: marcas y segmentos alfabéticamente por la etiqueta; los tramos, de menor a mayor.
- **Página actual**: su enlace se queda en la lista con `aria-current="page"`, en `ink-900`, peso 600 y sin
  subrayado, para que se vea dónde se está sin depender solo del color (lleva también el cambio de peso y la falta
  de subrayado).
- Enlaces: `text-body`, `brand-600`, subrayados; hover `brand-800`. Zona táctil mínima `--size-touch` de alto
  cada uno (relleno vertical), separados `2` en horizontal y `1` en vertical al partir línea.
- Fondo `surface`, sin caja: es navegación secundaria y no debe competir con las tarjetas.

Disposición:
- **Móvil (< 768 px):** grupos uno debajo de otro; en cada uno, el `h3` encima y los enlaces en línea, que
  parten línea. Separación entre grupos `4`.
- **`md` en adelante:** cada grupo en una fila, `h3` a la izquierda con ancho fijo `--width-explore-label` y
  enlaces a su derecha. Separación entre grupos `2`.

## Disposición

`--width-page` es el ancho máximo del contenido, centrado. Márgenes laterales: `4` en móvil, `6` en `md`, `8` en
`lg`. Separaciones verticales: `2` entre `h1` y texto de entrada; `3` entre entrada y contador; `8` entre bloques
(contador → «Explorar» → resultados).

### Pregeneradas (marca, segmento, tramo)

```
Móvil (< 768 px)                 Escritorio (≥ 1024 px)
┌─────────────────────────┐      ┌─────────────────────────────────────────────┐
│ Saltar a los resultados │      │ h1 Coches eléctricos Cupra                  │
│ h1 Coches eléctricos    │      │ Los modelos eléctricos de Cupra en España…  │
│    Cupra                │      │ 3 modelos                                   │
│ Los modelos eléctricos  │      │                                             │
│ de Cupra en España…     │      │ Explorar                                    │
│ 3 modelos               │      │ Marcas     Cupra · Polestar                 │
│                         │      │ Precio     Hasta 30.000 € · …               │
│ Explorar                │      │ Autonomía  Más de 400 km · …                │
│ Marcas                  │      │ Todos los coches                            │
│ Cupra · Polestar        │      │                                             │
│ Precio                  │      │ Modelos                                     │
│ Hasta 30.000 € · …      │      │ ┌──────┐ ┌──────┐ ┌──────┐                  │
│ Autonomía               │      │ │ card │ │ card │ │ card │                  │
│ Más de 400 km · …       │      │ └──────┘ └──────┘ └──────┘                  │
│ Todos los coches        │      └─────────────────────────────────────────────┘
│                         │
│ Modelos                 │
│ ┌─────────────────────┐ │
│ │ card                │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

Una sola columna de contenido; la rejilla de tarjetas ocupa todo el ancho (1 / 2 / 3 columnas según
`tarjeta-modelo.md`, «Rejilla»).

### `/coches`

```
Móvil (< 768 px)                 Escritorio (≥ 1024 px)
┌─────────────────────────┐      ┌─────────────────────────────────────────────┐
│ h1 Coches eléctricos    │      │ h1 Coches eléctricos                        │
│ Todos los modelos…      │      │ Todos los modelos eléctricos del mercado…   │
│ 6 modelos               │      │ 6 modelos                                   │
│ Explorar (…)            │      │ Explorar (…)                                │
│ [Filtros (2)]           │      ├──────────────┬──────────────────────────────┤
│ (panel si está abierto) │      │ Filtros      │ Modelos    Ordenar por [▾]   │
│ Modelos                 │      │ Marca …      │ [Cupra ×] [Más de 400 ×]     │
│ Ordenar por [▾]         │      │ Segmento …   │ ┌──────┐ ┌──────┐ ┌──────┐   │
│ [Cupra ×] [Más de 400 ×]│      │ …            │ │ card │ │ card │ │ card │   │
│ ┌─────────────────────┐ │      │ [Limpiar]    │ └──────┘ └──────┘ └──────┘   │
│ │ card                │ │      │              │                              │
│ └─────────────────────┘ │      └──────────────┴──────────────────────────────┘
└─────────────────────────┘
```

- Cabecera (`h1`, entrada, contador) y franja «Explorar» a todo el ancho; debajo, en `lg`, dos columnas: filtros
  (`--width-filters`) y resultados (el resto), separadas `8`. La rejilla de resultados cabe en 3 columnas a
  1024 px con el panel al lado; si no cabe, baja a 2 (`tarjeta-modelo.md` fija el máximo, no el mínimo).
- La fila de resultados lleva el `h2` «Modelos» a la izquierda y el selector de orden a la derecha; en DOM, el `h2`
  antes que el selector, igual que se ve. Debajo, los chips; debajo, la lista.
- **Esto precisa el wireframe de `filtros-catalogo.md`**: el contador va bajo el texto de entrada (antes de
  «Explorar», como dice su orden del DOM) y no en la fila del selector de orden. Así el orden visual coincide con
  el del DOM en todas las anchuras.
- En móvil y `md`, una sola columna: botón «Filtros (n)» tras «Explorar»; el `h2` «Modelos» y el selector de orden
  arriba de los resultados, uno debajo del otro.
- **Sin JS**: no hay columna de filtros ni selector ni chips; la página queda como una pregenerada, con el texto
  `filtros.sinJs` debajo del contador (`filtros-catalogo.md`).

## Estados

| Situación | Qué se ve | Requisito |
|---|---|---|
| Pregenerada con modelos | Estructura común, contador con su número | RF-10, CA-12c |
| **Tramo sin modelos** (precio o autonomía) | La página existe igual (CA-12a: una por tramo, siempre). En lugar de la lista, el estado vacío de página (abajo). Contador «Ningún modelo». La franja «Explorar» sigue | RF-10, CA-12a |
| Marca o segmento sin modelos | No hay página (CA-12a) y no hay enlace a ella en «Explorar» | CA-12a |
| `/coches` con filtros sin resultados | El estado vacío de `filtros-catalogo.md` (con «Limpiar filtros») | RF-6, CA-6 |
| `/coches` con el catálogo vacío (sin ningún modelo) | El estado vacío de página, sin «Limpiar filtros» (no hay filtro que limpiar) | RF-6 |
| Modelos con datos ausentes | Aparecen según las reglas de «Tipos de página»; la tarjeta dice «por confirmar» | RF-12, CA-15 |
| Sin JS | Pregeneradas: iguales (no usan JS). `/coches`: ver «Disposición» | RF-10, CA-12c |
| Cargando | No hay: todo el contenido va en el HTML | RF-10 |

### Estado vacío de página (tramo sin modelos)
Distinto del de filtros: aquí no hay filtros que limpiar, así que no lleva el botón de RF-6; lleva un camino de
salida para no dejar al visitante en un callejón. Componente Empty de Bearnie, en el lugar de la lista, bajo el
`h2` «Modelos», en `surface` y sin caja.

```
Modelos
Ahora mismo no hay ningún modelo en este tramo.     ← text-body ink-900
Ver todos los coches                                 ← enlace a /coches, brand-600, 44 px de alto
```

Es texto estático: sin `role="status"` (no aparece como reacción a nada). Claves `vacio.pagina.texto` y
`vacio.pagina.enlace`.

## Orden de foco

Pregeneradas:
1. «Saltar a los resultados».
2. Navegación del sitio.
3. Enlaces de «Explorar», grupo a grupo y de izquierda a derecha; al final, «Todos los coches».
4. Tarjetas, una parada por tarjeta (`tarjeta-modelo.md`). En el estado vacío, el enlace «Ver todos los coches».

`/coches`: el de `filtros-catalogo.md`, «Orden de foco». El `h1`, el texto de entrada, el contador y los `h2` no son
paradas de foco; el `h2` «Modelos» lleva `tabindex="-1"` solo para recibir el foco del salto y de «Limpiar
filtros», y entonces se le ve el anillo de foco de `tokens.md`.

## Lector de pantalla

Lo que oye alguien que recorre una página de marca de arriba abajo:
1. «Coches eléctricos Cupra, encabezado nivel 1.»
2. El texto de entrada. «3 modelos.»
3. «Explorar, navegación.» «Explorar, encabezado nivel 2.» Cada grupo, «Marcas, encabezado nivel 3», «lista, 2
   elementos», «Cupra, enlace, página actual», «Polestar, enlace»…
4. «Modelos, encabezado nivel 2.» «Modelos, lista, 3 elementos.» Cada tarjeta, como dice `tarjeta-modelo.md`.

Landmarks: `main` (contenido), `nav` «Explorar», y en `/coches` con JS la región del panel de filtros
(`filtros-catalogo.md`). Por encabezados se salta directo a «Explorar», «Filtros» o «Modelos».

## Copy (RNF-4: claves para i18n, sin textos fijos en los componentes)

Además de las claves de los apartados de títulos y entradas:

| Clave | Texto |
|---|---|
| `sitio.nombre` | (sin decidir; ver Pregunta 3) |
| `pagina.tituloDocumento` | {titulo} · {sitio} |
| `pagina.saltar` | Saltar a los resultados |
| `resultados.titulo` | Modelos |
| `explorar.titulo` | Explorar (ya en `filtros-catalogo.md`) |
| `explorar.marcas` / `.segmentos` / `.precio` / `.autonomia` | Marcas / Segmentos / Precio / Autonomía |
| `explorar.precio.hasta30000` / `.de30000a45000` / `.masDe45000` | Hasta 30.000 € / De 30.000 a 45.000 € / Más de 45.000 € |
| `explorar.autonomia.masDe400` / `.masDe500` | Más de 400 km / Más de 500 km |
| `explorar.todos` | Todos los coches |
| `vacio.pagina.texto` | Ahora mismo no hay ningún modelo en este tramo. |
| `vacio.pagina.enlace` | Ver todos los coches |
| `vacio.catalogo.texto` | Todavía no hay ningún modelo en el catálogo. |

Las cifras de los textos (30.000 €, 400 km) se escriben con formato `es-ES`; si un día cambian los tramos
(PRD-001 §8 lo permite), cambian en las claves, no en los componentes.

## Tokens que usa

Color: `surface`, `ink-900`, `ink-600`, `brand-600`, `brand-800`. Tipografía: `--text-title` (`h1`),
`--text-section` (`h2`), `--text-group` (`h3` de «Explorar»), `--text-body`. Medidas: `--width-page`,
`--width-prose`, `--width-filters`, `--width-explore-label`, `--size-touch`. Los nuevos están en `tokens.md`.
No hay pares de color nuevos: todos los usados ya están calculados allí.

## Preguntas abiertas para Producto

1. **Límites de los tramos.** Un modelo de 30.000 € exactos, ¿va en «hasta 30.000 €», en «de 30.000 a 45.000 €» o
   en las dos? Y en autonomía, RF-10 dice «más de 400 km» y CA-2 «≥ 400 km»: ¿un modelo de 400 km exactos entra en
   `/autonomia/mas-de-400-km`? Aquí los textos dicen «supera» y «no pasa de», que es lo literal de RF-10; si se
   decide otra cosa, cambian las claves.
2. **`/coches` sin query string**, ¿es indexable? No está en la lista de RF-10 y CA-12d solo excluye las
   combinaciones de filtros. No se especifica aquí `noindex` para ella.
3. **Nombre del sitio** para el `<title>`: no está en la visión ni en el PRD.
4. **Meta descripción** de cada página: RF-10 pide título y texto propios, no una meta descripción. ¿Se reutiliza
   el texto de entrada? No se especifica sin confirmarlo.
5. **Marca y segmento** llevan texto con variable (marca) o escrito uno a uno (segmento). ¿Basta para «texto
   introductorio no repetido» de CA-12b, o se quiere un texto escrito a mano para cada marca? Esto último pediría
   un dato nuevo por marca que el esquema no tiene.
