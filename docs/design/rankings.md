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
- La acción «Comparar»: [`comparador.md`](comparador.md), «La acción "Comparar"» y «Forma de la URL».

Página pregenerada por ranking (RF-13, RNF-1, CA-14): la lista sin filtros, con sus cifras y fuentes, va en el
HTML servido. Solo los filtros usan JavaScript (RF-8, RF-9) y sin él no se muestran. Componentes de Bearnie
(ADR-0005): Badge para «Precio con oferta», Empty para los estados vacíos, Button para «Quitar filtros».

Esta especificación **no decide** cómo llegan los datos de las versiones al navegador ni cómo se filtra: solo
qué se ve antes y después de filtrar.

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
- Canonical: `<link rel="canonical">` a la URL de la tabla, sin query string, en el HTML servido; sin `noindex`
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
│ ┌───┬──────────────────┐ │           │ │    │ Comparar                                │     │
│ │ 1 │ h3 Polestar      │ │           │ ├────┼─────────────────────────────────────────┤     │
│ │   │ Polestar 3       │ │           │ │ 2  │ h3 Cupra Tavascan                       │     │
│ │   │ Long range Dual… │ │           │ │empa│ Endurance · SUV compacto                │     │
│ │   │ SUV grande       │ │           │ │te  │ 557 km                                  │     │
│ │   │ 628 km           │ │           │ │    │ Fuente: cupra.com, 24 sep 2026          │     │
│ │   │ Fuente: polestar.│ │           │ ├────┼─────────────────────────────────────────┤     │
│ │   │ com, 22 sep 2026 │ │           │ │ 2  │ …                                       │     │
│ │   │ Comparar         │ │           │ │ 4  │ …                                       │     │
│ ├───┼──────────────────┤ │           │ └────┴─────────────────────────────────────────┘     │
│ │ 2 │ …                │ │           │ 3 versiones a la venta se han quedado fuera…         │
│ └───┴──────────────────┘ │           │ Condiciones de las ofertas                           │
│ 3 versiones a la venta…  │           └──────────────────────────────────────────────────────┘
│ Condiciones de las ofer… │
└──────────────────────────┘
```
(Las cifras y versiones del dibujo son ilustrativas, no datos.)

## Lista de puestos (RF-3, RF-7, RNF-3, CA-3, CA-7)

**Una `<ol>`, no una tabla.** Un puesto puede llevar etiqueta, nota, condiciones y fuente: en tabla habría que
duplicarla en bloques para 320 px, como la ficha. Una lista apilada cabe a cualquier anchura con una sola
presentación y el lector la anuncia como «lista, 10 elementos» (RNF-3).

- `<ol aria-labelledby>` con el `h2` «Puestos». `list-style: none` y `role="list"` explícito (Safari quita la
  semántica de lista cuando no hay viñeta). Cada `<li>` lleva `value="{puesto}"`, así que la numeración nativa
  coincide con la visible también en los empates (1, 2, 2, 4).
- Ancho máximo de la lista `--width-ranking` (nuevo, 48 rem): es una lista de lectura, no una rejilla; a todo
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
| 1 | Número de puesto | posición (RF-7) | `--text-rank-number`, `ink-900`, en la columna izquierda, alineado arriba. Texto oculto visualmente antes: «Puesto» (`ranking.puesto.sr`) | RF-3, RF-7, CA-3 |
| 2 | Marca y modelo | `brand_name`, `model` | `h3`, `--text-card-title`, `ink-900`; el texto entero es un enlace a `/marcas/{marca}/{modelo}/` (`brand-600`, subrayado, hover `brand-800`) | RF-3, CA-3 |
| 3 | Versión | `versions[].name` | `text-body`, `ink-900`, literal | RF-3, CA-3 |
| 4 | Segmento | `segment.value` | `text-small`, `ink-600`, con el rótulo oculto visualmente «Segmento:» y la etiqueta de `filtros-catalogo.md`. Sin segmento: «Segmento por confirmar» (`ficha.segmento.porConfirmar`) | Decisión 4 |
| 5 | Cifra del ranking | el campo de RF-1 | Ver «La cifra» | RF-3, RF-4, RF-5 |
| 6 | Fuente y fecha | `source_id`, `url`, `retrieved`, `tier` | Ver «La cifra» | RF-4, CA-4 |
| 7 | «Comparar» | — | Enlace de texto de `comparador.md` | RF-14 |

**Decisión 4: segmento sí, imagen no.**
- **Segmento**: es texto, pesa cero bytes y da el contexto que el filtro de segmento (RF-8) usa; quien ve
  «Polestar 3» junto a «Cupra Born» entiende que no compiten en lo mismo. Es un dato del modelo pero **no es una
  cifra**, así que no choca con RF-3.
- **Sin imagen ni silueta**: diez imágenes harían de la lista una página pesada (RNF-2, LCP < 2,5 s en 4G) y
  quitarían ancho a 320 px, donde la columna útil ya es de 228 px. La imagen está a un enlace, en la ficha.
- **Ninguna cifra de modelo** («precio desde», «autonomía máxima») ni otra cifra de la versión: solo la del
  ranking (RF-3). En el ranking de precio no se enseña la autonomía y en el de autonomía no se enseña el precio.
- **Sin etiqueta de estado**: todas las versiones son de modelos `on_sale` (RF-11, CA-3).
- **«Comparar»**: todas las versiones son de modelos a la venta con versiones, así que todas son comparables
  (`comparador.md`). Enlace a `/comparar/?v={marca}/{modelo}/{name}`, con la versión del puesto y no la
  versión por defecto del modelo. Texto visible «Comparar» (`comparar.accion`); nombre accesible con
  `ranking.compararSr`: «Comparar {marca} {modelo} {versión} con otros coches». Ver Pregunta 2.
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
- Bajo el número de cada puesto empatado, la palabra «empate» (`ranking.puesto.empate`), `text-small`,
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
| `ranking.fuera.n` | {n} versiones a la venta se han quedado fuera por no tener {dato} publicado con fuente verificable. |
| `ranking.fuera.uno` | 1 versión a la venta se ha quedado fuera por no tener {dato} publicado con fuente verificable. |
| `ranking.fuera.ninguna` | Ninguna versión a la venta se ha quedado fuera por falta de {dato}. |
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
  que el de `/coches`; el de precio, valores legibles (se proponen los slugs de las páginas de tramo:
  `hasta-30000-euros`, `de-30000-a-45000-euros`, `mas-de-45000-euros`). Un valor no válido se ignora sin aviso
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
| Cargando / error | No hay: la lista va en el HTML; si el script falla, queda la lista sin filtrar | RNF-1 |

### Vacío de página: ninguna versión con el dato (RF-7, CA-7)
En lugar de la `<ol>` (no hay lista vacía), bajo el `h2` «Puestos», el patrón de `paginas-catalogo.md`, «Estado
vacío de página» (Empty de Bearnie, sin caja, sin `role="status"`):

```
Puestos
Ninguna versión
Todavía no hay ninguna versión a la venta con {dato} publicado.   ← ranking.vacio.texto, text-body ink-900
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
5. Por puesto, en orden: enlace del modelo → enlace de la fuente → «Ver condiciones de la oferta» (si la hay) →
   «Comparar».
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
   compacto.» «557 km.» «Fuente: cupra.com, enlace, 24 sep 2026.» «Comparar Cupra Tavascan Endurance con otros
   coches, enlace.»
6. La nota de RF-15.

Por encabezados se salta a cada puesto («Puesto 1, Polestar Polestar 3»): el número va **dentro** del `h3`,
fuera del enlace. Ninguna etiqueta depende del color: «Precio con oferta», «fuente no oficial» y «empate» son
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

Desde un ranking **no** se enlaza a los demás rankings: CA-13 limita los enlaces a fichas, catálogo, fuentes y
«Comparar». Se vuelve por la ruta («Coches») y desde allí se elige otro.

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
| `ranking.compararSr` | {marca} {modelo} {versión} con otros coches (tras «Comparar») |
| `ranking.filtros.titulo` | Filtrar |
| `ranking.filtros.todos` | Todos |
| `ranking.filtros.cualquiera` | Cualquiera |
| `ranking.filtros.quitar` | Quitar filtros |
| `ranking.filtros.sinJs` | Para filtrar el ranking por segmento o por precio hace falta activar JavaScript. |
| `ranking.vacio.texto` | Todavía no hay ninguna versión a la venta con {dato} publicado. |
| `ranking.vacioFiltros.texto` | Ninguna versión cumple los filtros. |

Reutilizadas sin cambios: `pagina.tituloDocumento`, `pagina.saltar`, `ficha.unidad.*`, `ficha.bateria.*`,
`ficha.precio.oferta`, `ficha.precio.verCondiciones`, `ficha.condiciones.*`, `ficha.segmento.porConfirmar`,
`filtros.segmento`, `filtros.precio`, `explorar.precio.*`, las etiquetas de segmento, `comparar.accion`,
`vacio.pagina.enlace`, `fecha.*`. Si dos claves dan el mismo texto, el Desarrollador puede usar una sola.

## Tokens que usa

Color: `surface`, `ink-900`, `ink-600`, `line`, `line-soft`, `brand-600`, `brand-800`, `on-brand`, `deal-*`.
Tipografía: `--text-title`, `--text-section`, `--text-card-title`, `--text-price`, `--text-body`, `--text-small`,
`--text-badge`. Medidas: `--width-page`, `--width-prose`, `--size-touch`.

**Nuevos** (añadidos en `tokens.md`): `--width-ranking` (48 rem), `--width-rank-number` (3 rem),
`--text-rank-number` (1.5rem / 2rem, 700). **No hay colores nuevos** ni pares nuevos: todos los usados están
calculados en `tokens.md` (`ink-900` 17,74, `ink-600` 7,56, `brand-600` 6,67, `brand-800` 9,33 sobre `surface`;
`deal-fg` sobre `deal-bg` 8,15; `on-brand` sobre `brand-600` 6,67; `line` 4,83 como borde de select).

## Preguntas abiertas para Producto

1. **Página índice `/rankings`.** No se especifica: PRD-005 no la pide y la entrada es la franja de `/coches`
   (decisión 8). Las URL quedan bajo `/rankings/` por si un día se decide; mientras, `/rankings` no existe (404).
2. **«Comparar» desde un puesto.** RF-14 lo permite «si PRD-003 lo permite para esa versión», pero PRD-003 solo
   enumera la tarjeta y la ficha como puntos de entrada (RF-6, RF-7). Se ha especificado con la versión del
   puesto; si Producto no lo quiere, se quita sin tocar nada más.
3. **Uno o varios segmentos a la vez.** En `/coches` el segmento es de selección múltiple; RF-8 y CA-8 hablan de
   «un segmento». Se propone un único segmento (select). Si se quieren varios, pasa a casillas como en el
   catálogo y vuelve el panel.
4. **Enlaces a los rankings en las demás páginas del catálogo** (marca, segmento, tramos). RF-14 solo los pide en
   `/coches`; extenderlos a toda la franja «Explorar» sería un cambio de PRD-001.
5. **Empate cortado en el puesto 10.** RF-7 deja fuera sin aviso a las versiones empatadas que no caben; ¿se
   quiere decir «y {n} más con la misma cifra»? No se especifica sin confirmarlo.
