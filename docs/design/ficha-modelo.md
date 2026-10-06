# Ficha de modelo

PRD-002 (ready): RF-1 a RF-15, RNF-1 a RNF-5; CA-1 a CA-18. Tokens: [`tokens.md`](tokens.md). Esquema:
`docs/architecture/data-model.md` (ADR-0008). Se apoya en lo ya especificado y no lo repite:

- La tarjeta de los modelos relacionados (RF-15): [`tarjeta-modelo.md`](tarjeta-modelo.md), sin cambios.
- `<title>`, márgenes y anchos de página, jerarquía de encabezados, estilo de enlaces y regla de «texto muy
  largo»: [`paginas-catalogo.md`](paginas-catalogo.md).
- Etiquetas de segmento y de tracción: [`filtros-catalogo.md`](filtros-catalogo.md).

Página estática, **sin JavaScript** (ADR-0003, RNF-1, CA-14): todo lo que se describe aquí, incluidas la
galería y el paso de tabla a bloques, va en el HTML servido y se resuelve con HTML y CSS. Componentes de
Bearnie (ADR-0005): Badge para las etiquetas, Card para los bloques de versión, Table para la tabla.

## URL y título (RF-1, RNF-1, CA-1, CA-14)

- URL `/marcas/{marca}/{modelo}/`, con la ruta de `data/raw/` (`data/raw/polestar/polestar-2.yaml` →
  `/marcas/polestar/polestar-2/`). La tarjeta del catálogo enlaza aquí.
- `h1` = `ficha.titulo`: «{marca} {modelo}» → «Cupra Tavascan» (`brand_name` + `model`).
- `<title>` = `pagina.tituloDocumento` con ese `h1`: «Cupra Tavascan · {sitio}». Es distinto en cada ficha
  porque marca + modelo es único.

## Estructura y orden de lectura

Orden del DOM = orden visual = orden de lectura (WCAG 1.3.2) en todas las anchuras.

1. Cabecera y navegación del sitio (fuera de esta especificación).
2. **Ruta** (RF-13): `<nav>` con los enlaces de vuelta.
3. `<main>`:
   1. **Cabecera de la ficha** (RF-2, RF-10, RF-14): `h1`, etiqueta de estado, segmento, enlace a la web de
      la marca; y la **imagen principal** (RF-12).
   2. **Versiones** (`h2`, RF-3 a RF-6, RF-8, RF-11): tabla o bloques, y debajo «Condiciones de las ofertas»
      si alguna versión tiene precio con oferta.
   3. **Datos del modelo** (`h2`, RF-5, RF-7): solo si hay `specs`.
   4. **Más imágenes** (`h2`, RF-12): solo si hay 2 o más imágenes con licencia.
   5. **Otros modelos del segmento** (`h2`, RF-15): solo si hay segmento y algún modelo que mostrar.
   6. **Fuentes** (`h2`, RF-9): siempre, al final.
4. Pie del sitio.

Encabezados: un `h1`; `h2` para cada bloque de `main`; `h3` para el nombre de versión en los bloques, para
«Condiciones de las ofertas» y para el modelo en las tarjetas relacionadas (como en `paginas-catalogo.md`).

### Wireframe

```
Móvil (320–767 px)                     Escritorio (≥ 1024 px)
┌──────────────────────────┐           ┌──────────────────────────────────────────────────────┐
│ Coches › Cupra › Tavascan│           │ Coches › Cupra › Tavascan                            │
│                          │           │ ┌────────────────────────┐  h1 Cupra Tavascan        │
│ h1 Cupra Tavascan        │           │ │                        │  SUV compacto ¹           │
│ [Próximamente · oct 2026]¹│          │ │     imagen principal   │  [Próximamente·oct 2026]¹ │
│ SUV compacto ²           │           │ │          16:9          │  Ver en la web de la marca│
│ Ver en la web de la marca│           │ └────────────────────────┘                           │
│ ┌──────────────────────┐ │           │ Foto: Alexander Migl…                                │
│ │  imagen principal    │ │           │                                                      │
│ └──────────────────────┘ │           │ Versiones                                            │
│ Foto: Alexander Migl…    │           │ Ordenadas por precio… Precios en España con IVA…     │
│                          │           │ ┌────────────┬────────────┬────────────┬────────────┐│
│ Versiones                │           │ │            │ Tavascan 58│ Tavascan VZ│ Endurance  ││
│ Ordenadas por precio…    │           │ ├────────────┼────────────┼────────────┼────────────┤│
│ ┌──────────────────────┐ │           │ │ Precio     │ 36.273 €   │ Precio por │ Precio por ││
│ │ h3 Tavascan (58 kWh…)│ │           │ │            │ [Con ofer.]│ confirmar  │ confirmar  ││
│ │ Precio               │ │           │ │            │ Fuente: …  │            │            ││
│ │ 36.273 € [Precio con │ │           │ │ Autonomía  │ 441 km ³   │ 533 km ³   │ 557 km ³   ││
│ │ oferta]              │ │           │ │ Batería    │ 58 kWh ³ … │ por confir.│ por confir.││
│ │ Fuente: cupra.com,   │ │           │ │ …          │            │            │            ││
│ │ 24 sep 2026          │ │           │ └────────────┴────────────┴────────────┴────────────┘│
│ │ Ver condiciones      │ │           │ h3 Condiciones de las ofertas                        │
│ │ Autonomía WLTP       │ │           │                                                      │
│ │ 441 km ³             │ │           │ Datos del modelo                                     │
│ │ …                    │ │           │ Más imágenes   ┌────┐ ┌────┐ ┌────┐                  │
│ └──────────────────────┘ │           │ Otros modelos del segmento SUV compacto              │
│ ┌──────────────────────┐ │           │ ┌──────┐ ┌──────┐ ┌──────┐                           │
│ │ h3 Tavascan VZ …     │ │           │ Fuentes                                              │
│ └──────────────────────┘ │           │ 1. cupra.com, consultado el 24 sep 2026: https://…   │
│ h3 Condiciones…          │           └──────────────────────────────────────────────────────┘
│ Datos del modelo         │
│ Más imágenes             │
│ Otros modelos…           │
│ Fuentes                  │
└──────────────────────────┘
```

(Los «¹ ² ³» del dibujo son las notas numeradas de RF-9; en pantalla se pintan como «[1]», ver «Fuente y
fecha».)

## Ruta: enlaces de vuelta (RF-13, CA-13)

- `<nav aria-label>` con `ficha.ruta.nombre` («Ruta de navegación»), antes del `h1`. Una `<ol>` de tres
  elementos: «Coches» → `/coches` (`ficha.ruta.coches`), `{marca}` (`brand_name`) → `/marcas/{marca}`, y
  `{modelo}` como texto, no enlace, con `aria-current="page"`.
- Separador «›» generado por CSS y oculto al lector (`aria-hidden` o `content` con texto alternativo vacío).
- `text-small`; enlaces `brand-600` subrayados, hover `brand-800`; el modelo actual, `ink-600`. Cada enlace con
  `--size-touch` de alto (relleno vertical). Parte línea en 320 px si la marca o el modelo son largos.

## Cabecera de la ficha (RF-2, RF-10, RF-14)

Orden: `h1` → etiqueta de estado (si la hay) → segmento → enlace «Ver en la web de la marca» → imagen
principal con su atribución.

| Elemento | Origen | Presentación | Requisito |
|---|---|---|---|
| Título | `brand_name`, `model` | `h1`, `--text-title`, `ink-900` | RF-2, CA-1 |
| Estado `announced` con `launch` | `status`, `launch` | Badge `soon`: «Próximamente · oct 2026» (`ficha.estado.proximamenteFecha`). `launch` `YYYY-MM` o `YYYY-MM-DD` → solo mes corto y año | RF-10, CA-10 |
| Estado `announced` sin `launch` | `status` | Badge `soon`: «Próximamente», sin fecha | RF-10, CA-10 |
| Estado `discontinued` | `status` | Badge `discontinued`: «Descatalogado» | RF-10, CA-10 |
| Estado `on_sale` | `status` | Sin etiqueta y sin nota | RF-10, CA-10 |
| Segmento | `segment.value` | Rótulo «Segmento» + etiqueta española (`filtros-catalogo.md`): «SUV compacto». `text-body`, `ink-900` | RF-2, CA-2 |
| Sin segmento | — | «Segmento por confirmar», `ink-600`, sin nota | RF-2, CA-2 |
| Web de la marca | `status.url` | Enlace de texto (abajo) | RF-14, CA-16 |

- Una sola etiqueta de estado: `status` es un único valor (CA-10).
- Estado y segmento se presentan como `dl` de dos filas con rótulos «Estado» y «Segmento»; el de estado solo
  existe si hay etiqueta (en `on_sale` la fila no se pinta). En pantalla los rótulos `dt` van ocultos solo
  visualmente para el estado (el badge ya se explica) y visibles para el segmento.
- Notas de fuente: tras el badge va la nota de `status` y, si `launch` está, la de `launch` (una sola si
  comparten fuente, URL y fecha, ver «Agrupación»). Tras el segmento, la de `segment`. Si el dato trae `note`,
  se muestra debajo, tal cual (RF-8), por ejemplo la del segmento de Tavascan: «la web lo presenta como 'SUV
  Coupé 100 % Eléctrico'».
- **«Ver en la web de la marca»** (`ficha.webMarca`): enlace `<a>` normal a `status.url`, `text-body`,
  `brand-600`, subrayado, hover `brand-800`. **No** es un botón: sin fondo, sin borde, sin icono de carrito ni
  de flecha destacada (CA-16; la web no vende, visión). Se abre en la misma pestaña (no se fuerza
  `target="_blank"`). Zona táctil `--size-touch` de alto. Lleva texto oculto visualmente
  `ficha.webMarcaSr`: «(web de {marca}, sitio externo)» para que el lector sepa adónde va.
- La fecha del estado y del segmento no se ve aquí: va en su nota del bloque «Fuentes» (RF-9). Solo el precio
  enseña la fecha junto al valor.

### Imagen principal (RF-12, RNF-2)

- `images[0]` entre las que tienen `license`. Hueco 16:9, `--radius-card`, `object-fit: cover`. Es el
  candidato a LCP: **sin** `loading="lazy"`, con `fetchpriority="high"` y ancho y alto declarados.
- `alt` = `ficha.imagen.alt`: «{marca} {modelo}, imagen 1 de {n}». No se describe el contenido de la foto
  porque no hay dato que lo diga (ADR-0001); el `alt` no puede inventarlo.
- Si `attribution` no es `null`: debajo, `figcaption` con «Foto: {attribution}» (`ficha.imagen.atribucion`),
  `text-small`, `ink-600` sobre `surface`, el texto del dato tal cual. Si es `null`, no hay pie.
- **Sin imagen con licencia**: el mismo hueco 16:9 en `surface-muted` con la silueta del segmento, o la
  genérica si no hay segmento, centrada, de lado `--size-segment-icon-lg` (token nuevo; el de la tarjeta, 48 px,
  se pierde en un hueco de este tamaño). Decorativa (`aria-hidden`), sin pie, sin texto. Ninguna imagen de la
  marca en su lugar (CA-12).

### Disposición de la cabecera
- **Móvil y `md`:** todo en una columna; la imagen a todo el ancho del contenido, después del enlace a la web.
- **`lg`:** dos columnas, texto a la izquierda (5/12) e imagen a la derecha (7/12), separadas `8`, alineadas
  arriba. El orden del DOM (texto, luego imagen) es el visual de izquierda a derecha.

## Versiones (RF-3 a RF-6, RF-8, RF-11)

`<section aria-labelledby>` con `h2` «Versiones» (`ficha.versiones.titulo`). Debajo, una línea `text-small`
`ink-600` (`ficha.versiones.entrada`): «Ordenadas por precio, de menor a mayor. Precios en España con IVA y
sin ayudas.» (RF-3, RF-4).

### Orden y unicidad (RF-3, CA-3)
- Por `price.value` ascendente (incluye `financed`). Las de `price: null` van al final, en el orden del fichero.
- A igual precio, el orden del fichero.
- Un `name` aparece una sola vez (el esquema ya lo garantiza; la ficha no deduplica ni fusiona).
- El orden se resuelve al construir; no hay control para cambiarlo.

### Campos y formato (RF-4 a RF-6)
Mismo orden de filas en la tabla y de líneas en los bloques:

| # | Rótulo (`ficha.campo.*`) | Origen | Formato | Sin dato |
|---|---|---|---|---|
| 1 | Precio | `price` | «36.273 €»: número `es-ES`, sin decimales (redondeo solo de visualización, como la tarjeta); `--text-price`, `ink-900` | «Precio por confirmar», `text-body`, `ink-600` |
| 2 | Autonomía WLTP | `wltp_km` | «441 km» | «por confirmar» |
| 3 | Batería | `battery_kwh` + `basis` | «58 kWh, útil» · «80 kWh, bruta» · «58 kWh, sin especificar si es útil o bruta» (`ficha.bateria.*`). Decimales `es-ES` tal cual («77,5 kWh») | «por confirmar» |
| 4 | Potencia | `power_kw` | «140 kW» | «por confirmar» |
| 5 | Tracción | `drivetrain` | Delantera / Trasera / Total (`fwd` / `rwd` / `awd`, etiquetas de `filtros-catalogo.md`) | «por confirmar» |
| 6 | Carga máxima en CC | `dc_max_kw` | «135 kW» | «por confirmar» |
| 7 | Carga máxima en CA | `ac_max_kw` | «11 kW» | «por confirmar» |

- **«por confirmar»** (`ficha.porConfirmar`): `ink-600`, sin nota de fuente (no hay dato del que citarla). La
  fila nunca se oculta, aunque todas las versiones carezcan del dato (RF-6, CA-6), y nunca se rellena con el
  valor de `specs`: ese valor va en «Datos del modelo» (RF-5, RF-7, CA-5, CA-7).
- **`note`** (RF-8, CA-8): debajo del valor, en su misma celda o línea, `text-small`, `ink-600`, el texto
  idéntico al del fichero, sin comillas ni prefijo («publicado: 190 CV»; «la web no indica si es útil o bruta»).
- Cada valor con dato lleva su nota de fuente detrás (ver «Fuente y fecha»), salvo el precio, que lleva la
  fuente visible.

### El precio, en detalle (RF-4, RF-9, CA-4, CA-9)

```
Último precio publicado          ← solo si status = discontinued (text-small, ink-600)
36.273 €  [Precio con oferta]    ← text-price + Badge deal, solo si financed
Fuente: cupra.com, 24 sep 2026   ← text-small, ink-600; «cupra.com» es enlace a price.url
Ver condiciones de la oferta     ← solo si financed; enlace interno a sus condiciones
```

- **PVP** (`price_kind: pvp`): valor y fuente; sin etiqueta.
- **Con oferta** (`financed`): Badge `deal` «Precio con oferta» (`ficha.precio.oferta`) junto al valor; si no
  cabe, baja de línea. Debajo de la fuente, el enlace «Ver condiciones de la oferta» (`ficha.precio.verCondiciones`)
  a `#condiciones-{n}` del bloque «Condiciones de las ofertas».
- **Descatalogado con precio**: encima del valor, «Último precio publicado» (`ficha.precio.ultimo`), en texto,
  no en color (RNF-3). Compatible con «Precio con oferta».
- **Sin precio**: «Precio por confirmar» (`ficha.precio.porConfirmar`); sin fuente, sin etiqueta, sin «Último
  precio publicado».
- **Fuente junto al valor** (`ficha.precio.fuente`): «Fuente: {fuente}, {fecha}». `{fuente}` es el nombre
  corto de la fuente (ver «Nombre de la fuente») y es el enlace a `price.url`; `{fecha}` es `retrieved` con
  mes corto («24 sep 2026»). Texto oculto visualmente en el enlace: «(consultado el {fecha})» no hace falta,
  porque la fecha va en el mismo párrafo. El precio no remite a «Fuentes»: ya lleva fuente y fecha visibles.
  Si el precio trae `note`, va debajo de la fuente, como cualquier otra nota.
- `tier` de un precio siempre es T1 (`data-model.md`, regla 5), así que el precio nunca lleva «fuente no
  oficial»; si un día llegase otro, se aplicaría la misma regla que al resto.

### Condiciones de las ofertas (RF-4, CA-4)

El texto literal de `price_terms` puede ser muy largo (el de Tavascan ronda los 1.500 caracteres): dentro de una
columna de tabla rompería la comparación. Por eso **va una sola vez, fuera de la tabla y de los bloques**,
justo debajo de ellos y dentro de la sección «Versiones», siempre visible (sin `<details>`: CA-4 pide verlo).

```
h3 Condiciones de las ofertas
   Tavascan (58 kWh, 140 kW)                   ← text-body, peso 600; id="condiciones-1"
   Oferta para un Cupra Tavascan 58kWh…        ← price_terms literal, text-small, ink-900, ancho --width-prose
   Ver las condiciones en la web de la marca   ← enlace a price_terms_url
```

- `h3` `ficha.condiciones.titulo`. Una entrada por versión con `financed`, en el orden de las versiones; cada
  una con el nombre de la versión, el texto literal (respetando sus saltos de párrafo si los trae; sin
  recortar ni resumir) y el enlace `ficha.condiciones.enlace` a `price_terms_url`.
- `ink-900` (no `ink-600`) porque es texto largo que se lee entero.
- El destino del ancla lleva `tabindex="-1"` para que el foco llegue al pulsar «Ver condiciones de la oferta».
- Si ninguna versión es `financed`, el bloque no existe.

### Pantallas anchas: tabla comparativa (`lg`, ≥ 1024 px; RF-3, CA-3)

- `<table>` con `<caption>` oculta visualmente: `ficha.versiones.caption` «Versiones de {marca} {modelo},
  ordenadas por precio».
- Primera fila: celda vacía (`<td>`) y una `<th scope="col">` por versión con su `name`. Primera columna:
  `<th scope="row">` con los rótulos de la tabla de campos. Una columna por versión, una fila por campo.
- Columna de rótulos de ancho `--width-version-label`; columnas de versión de al menos `--width-version-col`
  y como mucho `--width-version-col-max`, para que con 1 o 2 versiones la tabla no se estire hasta el borde.
- Celdas alineadas arriba y a la izquierda (también los números: el rótulo de unidad va en la cifra).
- Fila de encabezado y columna de rótulos en `surface-muted` con `ink-900`; celdas en `surface`. Separación
  entre filas con `line-soft` (decorativa: rótulos y orden ya dan la estructura). Relleno de celda `3`.
- **Más de 5 versiones** (hoy ninguna: el máximo son 4, Raval): la tabla se parte en tablas consecutivas de
  hasta 5 columnas, en el mismo orden, cada una repitiendo la columna de rótulos y con caption
  `ficha.versiones.captionParte` «… (versiones {desde} a {hasta} de {total})». Así no hay scroll horizontal a
  ninguna anchura.
- Un modelo con una sola versión también se muestra como tabla (una columna), por coherencia con RF-3.

### Móvil y `md`: bloques apilados (< 1024 px; RF-3, RNF-3, CA-3)

- `<ol>` de bloques (Card de Bearnie), uno por versión, en el mismo orden. Móvil: una columna. `md`: dos
  columnas; el orden se lee por filas (1-2, 3-4), que es el orden del DOM.
- Cada bloque: `h3` con el `name` (`--text-card-title`), y un `dl` con los siete campos en el orden de la tabla;
  `dt` (`text-small`, `ink-600`) **encima** de su `dd` (`text-body`, `ink-900`), nunca en dos columnas: a 320 px
  el contenido útil es de 256 px (320 − 2×16 de margen − 2×16 de relleno) y una columna de rótulos lo
  estrangularía.
- Relleno `4`, separación entre campos `3`, entre bloques `4`. Borde `line-soft` y `--radius-card`.
- Nombres largos, notas y la fuente parten línea (`overflow-wrap: anywhere`); nada se recorta con «…».

### Las dos presentaciones en el HTML
La tabla y los bloques van **los dos** en el HTML servido (no hay JS que los genere) y CSS muestra uno según la
anchura (`hidden` / `lg:block`, `lg:hidden`). El oculto usa `display: none`, así que no se lee ni recibe foco:
no hay duplicados para el lector ni para el teclado. Requisitos para el Desarrollador:
- Ningún `id` dentro de la tabla ni de los bloques (estarían repetidos); las anclas viven fuera
  (`#condiciones-{n}`, `#fuente-{n}`).
- Los dos se generan de la misma lista ordenada y con la misma numeración de notas.
- El test de CA-3 mira las dos: a 1280 px, la tabla visible; a 320 px, los bloques, sin scroll horizontal.

### Sin versiones (RF-11, CA-11)
Si `versions: []`, en lugar de tabla y bloques: un párrafo `text-body`, `ink-900`, `ficha.versiones.vacio`:
«{marca} todavía no ha publicado las versiones de este modelo.» Sin caja ni icono (Empty de Bearnie, sin
acción). La sección y su `h2` se mantienen: el visitante ve que el apartado existe y por qué está vacío. Se omite
`ficha.versiones.entrada` (no hay nada que ordenar). Si hay `specs`, «Datos del modelo» sigue debajo con lo que
haya.

### Versiones sin precio (RF-11)
Cada una dice «Precio por confirmar» en su sitio. No se añade un aviso general: el texto ya está en cada versión.

## Datos del modelo (RF-5, RF-7, CA-5, CA-7)

Solo si `specs` tiene algún campo. `<section aria-labelledby>`, `h2` `ficha.modelo.titulo` «Datos del modelo»,
y debajo `ficha.modelo.entrada` (`text-small`, `ink-600`): «La marca publica estos datos para el modelo entero,
no para cada versión.» Así queda rotulado «del modelo» y separado de las versiones.

`dl` en una columna (móvil) o en dos columnas de pares (`md`+), ancho máximo `--width-prose`:

| Rótulo (`ficha.modelo.*`) | Campo | Formato |
|---|---|---|
| Autonomía WLTP máxima del modelo | `wltp_max_km` | «557 km» |
| Potencia máxima del modelo | `power_max_kw` | «250 kW» |
| Carga máxima en CC | `dc_max_kw` | «135 kW» |
| Carga máxima en CA | `ac_max_kw` | «11 kW» |
| Capacidades de batería | `battery_kwh_options` | «58 kWh · 77 kWh», en el orden del fichero; sin base, porque `specs` no la lleva |
| Tracciones | `drivetrains` | «Delantera · Total», etiquetas de `filtros-catalogo.md` |

- Solo se pintan las filas que `specs` trae: un campo ausente de `specs` no es un dato que falte en la ficha (la
  versión ya dice «por confirmar»), y repetir «por confirmar» aquí sería ruido.
- Cada valor lleva su nota de fuente y, si la trae, su `note` debajo (Tavascan: «10-80 % en 29 min»).
- Va después de las versiones porque es el dato de menor precisión: primero lo concreto, luego lo agregado.

## Más imágenes (RF-12, CA-12)

- Solo si hay **2 o más** imágenes con `license`. `h2` `ficha.imagenes.titulo` «Más imágenes».
- Las imágenes 2 a 6 (las primeras 6 con licencia en el orden del fichero; la 7.ª y siguientes no se pintan).
  `<ul>` de `<figure>`; cada una 16:9, `object-fit: cover`, `loading="lazy"`, ancho y alto declarados.
- Rejilla: 1 columna en móvil, 2 en `md`, 3 en `lg`; separación `4` / `6`.
- Sin JavaScript y sin ampliación: todas visibles a la vez, sin carrusel, sin miniaturas que cambien la
  principal (eso pediría JS o `:target`, que ensucia el historial). Las 6 están en el HTML servido (CA-12).
- `alt` `ficha.imagen.alt` con su número: «Cupra Tavascan, imagen 3 de 6». `figcaption` con la atribución si
  existe, como en la principal.
- Las imágenes no son enlaces ni paradas de foco.

## Otros modelos del segmento (RF-15, CA-17)

- Solo si el modelo tiene `segment` **y** hay al menos un modelo publicado del mismo segmento y de otra marca.
  Sin segmento, o sin candidatos, la sección no existe (ni su `h2`).
- `h2` `ficha.relacionados.titulo`: «Otros modelos del segmento {segmento}» («… SUV compacto»).
- Hasta 3, ordenados por la distancia entre su «precio desde» y el del modelo de la ficha; los que no tienen
  precio, al final. Si el modelo de la ficha no tiene precio, todos los candidatos están a la misma distancia:
  orden del catálogo por defecto («Novedad», `filtros-catalogo.md`). Empate: el mismo orden por defecto.
- **La tarjeta es la de `tarjeta-modelo.md`, sin cambios** (`h3`, un enlace por tarjeta, etiquetas, silueta).
  Rejilla: 1 / 2 / 3 columnas. La lista toma su nombre del `h2` (`aria-labelledby`). Imagen de la tarjeta con
  `loading="lazy"` siempre (aquí no son LCP).

## Fuente y fecha (RF-9, CA-9)

### Qué lleva nota
Cada dato **mostrado** con valor: `status` (solo si hay etiqueta), `launch`, `segment`, cada campo de cada
versión salvo el precio, y cada valor de `specs`. No llevan nota los «por confirmar» (no hay dato). El precio
lleva su fuente visible (ver «El precio»). Las imágenes llevan su atribución (RF-12), no una nota.

### Marca de nota
- Detrás del valor (o del badge), un enlace «[1]» (`ficha.nota.marca`) a `#fuente-1`, `text-small`, `brand-600`,
  subrayado. Nombre accesible `ficha.nota.sr`: «Fuente 1» (el texto «Fuente» va oculto visualmente; los
  corchetes, `aria-hidden`).
- Si el dato no es T1, detrás de la marca: «fuente no oficial» (`ficha.nota.noOficial`), `text-small`,
  `ink-600`, en texto (no color, RNF-3). T1 no lleva nada (CA-9).
- Las marcas van en línea con el texto: son enlaces dentro de una frase y quedan fuera del mínimo de 44 px
  (excepción «en línea»). Aun así, su zona de pulsación se amplía a 24 × 24 px con relleno, sin mover el texto.

### Agrupación y numeración
- Una nota por cada combinación distinta de `source_id` + `url` + `retrieved` + `tier`. Todos los datos que la
  comparten llevan el mismo número (en Tavascan, casi todo es una sola nota).
- Números por orden de primera aparición en este recorrido fijo: cabecera (estado, `launch`, segmento) →
  versiones en su orden y, dentro de cada una, los campos en el orden de la tabla de campos → «Datos del modelo»
  en su orden. El recorrido es el de los bloques; la tabla usa los mismos números (en ella pueden no aparecer en
  orden creciente de izquierda a derecha, y es aceptable: el número identifica la fuente, no la posición).

### Bloque «Fuentes»
Último bloque de `main`. `h2` `ficha.fuentes.titulo` «Fuentes»; debajo, `ficha.fuentes.entrada` (`text-small`,
`ink-600`): «Dónde se ha leído cada dato y cuándo. El precio lleva su fuente junto a la cifra.»

`<ol>` con un `<li id="fuente-{n}" tabindex="-1">` por nota:

```
1. cupra.com, consultado el 24 sep 2026.
   https://www.cupra.com/es-es/coches/tavascan
2. wikipedia.org, consultado el 28 sep 2026. Fuente no oficial.
   https://es.wikipedia.org/wiki/…
```
(La nota 2 es ilustrativa: hoy ningún dato mostrado en la ficha es T3; solo las imágenes de Commons, que no
llevan nota.)

- `ficha.fuentes.item`: «{fuente}, consultado el {fecha}.»; si no es T1, se añade `ficha.fuentes.noOficial`
  «Fuente no oficial.». Debajo, la `url` completa como texto del enlace (precisa y comprobable), `brand-600`,
  subrayada, `overflow-wrap: anywhere` para que a 320 px no desborde.
- `text-small`, `ink-900` el texto, para que la fecha se lea bien.
- Al llegar por la marca de nota, el `li` recibe el foco (anillo de `tokens.md`) y el lector lo lee. Para volver,
  el atrás del navegador (el salto a `#fuente-n` crea una entrada de historial). Sin enlaces de vuelta: con
  una nota compartida por muchos datos no hay un único sitio al que volver.
- El bloque no tiene estado vacío: toda ficha muestra al menos el segmento, una versión o algún dato de modelo
  con fuente; si una ficha no mostrase ningún dato con nota (anunciado, sin versiones, sin segmento, sin
  `specs`), el bloque no se pinta.

### Nombre de la fuente
El registro de fuentes (`data/sources/<id>.yaml`) no tiene un nombre de presentación por fuente, y `source_id` («cupra-es») no está
escrito para el visitante. La ficha usa como `{fuente}` el **dominio de la `url` del dato**, sin `www.`
(«cupra.com», «commons.wikimedia.org»): sale del dato y no se inventa. Pregunta 1.

### Fechas
`retrieved` y `launch` con mes corto español: «24 sep 2026», «oct 2026» (`fecha.mes.1` a `.12`: ene, feb, mar,
abr, may, jun, jul, ago, sep, oct, nov, dic). Mismo formato que la tarjeta (CA-10).

## Estados

| Situación | Qué se ve | Requisito |
|---|---|---|
| A la venta, con versiones y precios | Todo lo descrito; sin etiqueta de estado | RF-2, RF-10 |
| Próximamente con `launch` / sin `launch` | Badge «Próximamente · oct 2026» / «Próximamente» | RF-10, CA-10 |
| Descatalogado | Badge «Descatalogado»; los precios llevan «Último precio publicado» | RF-4, RF-10, CA-4 |
| Sin segmento | «Segmento por confirmar»; silueta genérica; sin «Otros modelos del segmento» | RF-2, RF-12, RF-15 |
| Sin versiones | Texto `ficha.versiones.vacio` en la sección «Versiones» | RF-11, CA-11 |
| Versiones sin precio | «Precio por confirmar» en cada una, al final del orden | RF-3, RF-4, RF-11 |
| Ninguna versión con autonomía y `specs.wltp_max_km` | Fila «Autonomía WLTP» con «por confirmar» en cada versión; la cifra en «Datos del modelo», rotulada del modelo | RF-5, CA-5 |
| Campo sin dato en una versión | «por confirmar» | RF-6, CA-6 |
| Precio con oferta | Badge, fuente, «Ver condiciones de la oferta» y el texto literal en «Condiciones de las ofertas» | RF-4, CA-4 |
| Dato no T1 | «fuente no oficial» junto a la marca de nota y en su entrada de «Fuentes» | RF-9, CA-9 |
| Sin imagen con licencia | Silueta en el hueco principal; sin «Más imágenes» | RF-12, CA-12 |
| 1 imagen / 2–6 / más de 6 | Solo la principal / principal + «Más imágenes» / las 6 primeras | RF-12, CA-12 |
| Sin `specs` | No hay «Datos del modelo» | RF-7 |
| Sin candidatos relacionados | No hay «Otros modelos del segmento» | RF-15 |
| `open_questions` | **No se muestra nunca**, en ningún bloque ni atributo | Sección 6, CA-18 |
| `needs_review: true` | No hay ficha (no se genera la página) | Sección 6, decisión 5 |
| Texto muy largo | `h1`, nombres de versión, notas, `price_terms`, atribuciones y URL parten línea (`overflow-wrap: anywhere`); nunca se recortan ni se reduce la letra. Sin scroll horizontal a 320 px | RNF-3 |
| Cargando / error | No hay: todo va en el HTML generado | RNF-1 |

## Orden de foco

1. Enlace de salto y navegación del sitio (fuera de esta especificación).
2. Ruta: «Coches», «{marca}».
3. Cabecera: marcas de nota del estado/`launch` y del segmento; «Ver en la web de la marca».
4. Versiones (solo la presentación visible): en la **tabla**, fila a fila y de izquierda a derecha (fila de
   precio: enlace de fuente y «Ver condiciones de la oferta» de cada versión; luego las marcas de nota de cada
   fila); en los **bloques**, versión a versión y campo a campo. Después, los enlaces «Ver las condiciones en la
   web de la marca».
5. «Datos del modelo»: marcas de nota.
6. «Otros modelos del segmento»: una parada por tarjeta.
7. «Fuentes»: el enlace de cada nota.

Las imágenes, los `h2` y los textos no son paradas de foco. Los destinos de ancla (`#condiciones-{n}`,
`#fuente-{n}`) tienen `tabindex="-1"`: reciben el foco al saltar a ellos y muestran el anillo, pero no son
paradas al tabular.

## Lector de pantalla

Recorrido de Tavascan, de arriba abajo:
1. «Ruta de navegación, navegación.» «Coches, enlace.» «Cupra, enlace.» «Tavascan, página actual.»
2. «Cupra Tavascan, encabezado nivel 1.» «Segmento: SUV compacto, Fuente 1, enlace.» La nota del segmento.
   «Ver en la web de la marca (web de Cupra, sitio externo), enlace.»
3. «Figura. Cupra Tavascan, imagen 1 de 1. Foto: Alexander Migl…»
4. «Versiones, encabezado nivel 2.» En la tabla, cada celda se anuncia con sus encabezados: «Tavascan VZ, Precio,
   Precio por confirmar». En los bloques: «Tavascan VZ, encabezado nivel 3», y «Precio: Precio por confirmar».
5. «Condiciones de las ofertas, encabezado nivel 3.» …
6. «Fuentes, encabezado nivel 2.» «Lista, 1 elemento.» «cupra.com, consultado el 24 sep 2026…»

Landmarks: `nav` de la ruta y `main`. Por encabezados se llega directo a «Versiones», «Datos del modelo»,
«Más imágenes», «Otros modelos del segmento» y «Fuentes». Las etiquetas se leen como texto («Precio con
oferta», «Descatalogado»); nada depende del color.

## Copy (RNF-4: claves para i18n, sin textos fijos en los componentes)

| Clave | Texto |
|---|---|
| `ficha.titulo` | {marca} {modelo} |
| `ficha.ruta.nombre` | Ruta de navegación |
| `ficha.ruta.coches` | Coches |
| `ficha.estado.rotulo` | Estado |
| `ficha.estado.proximamente` | Próximamente |
| `ficha.estado.proximamenteFecha` | Próximamente · {fecha} |
| `ficha.estado.descatalogado` | Descatalogado |
| `ficha.segmento.rotulo` | Segmento |
| `ficha.segmento.porConfirmar` | Segmento por confirmar |
| `ficha.webMarca` | Ver en la web de la marca |
| `ficha.webMarcaSr` | (web de {marca}, sitio externo) |
| `ficha.imagen.alt` | {marca} {modelo}, imagen {n} de {total} |
| `ficha.imagen.atribucion` | Foto: {atribucion} |
| `ficha.versiones.titulo` | Versiones |
| `ficha.versiones.entrada` | Ordenadas por precio, de menor a mayor. Precios en España con IVA y sin ayudas. |
| `ficha.versiones.caption` | Versiones de {marca} {modelo}, ordenadas por precio |
| `ficha.versiones.captionParte` | Versiones de {marca} {modelo}, ordenadas por precio (versiones {desde} a {hasta} de {total}) |
| `ficha.versiones.vacio` | {marca} todavía no ha publicado las versiones de este modelo. |
| `ficha.campo.precio` / `.autonomia` / `.bateria` / `.potencia` / `.traccion` / `.cargaCc` / `.cargaCa` | Precio / Autonomía WLTP / Batería / Potencia / Tracción / Carga máxima en CC / Carga máxima en CA |
| `ficha.porConfirmar` | por confirmar |
| `ficha.bateria.usable` / `.gross` / `.unknown` | {kwh} kWh, útil / {kwh} kWh, bruta / {kwh} kWh, sin especificar si es útil o bruta |
| `ficha.unidad.km` / `.kw` / `.kwh` / `.eur` | {n} km / {n} kW / {n} kWh / {n} € |
| `ficha.precio.oferta` | Precio con oferta |
| `ficha.precio.ultimo` | Último precio publicado |
| `ficha.precio.porConfirmar` | Precio por confirmar |
| `ficha.precio.fuente` | Fuente: {fuente}, {fecha} |
| `ficha.precio.verCondiciones` | Ver condiciones de la oferta |
| `ficha.condiciones.titulo` | Condiciones de las ofertas |
| `ficha.condiciones.enlace` | Ver las condiciones en la web de la marca |
| `ficha.modelo.titulo` | Datos del modelo |
| `ficha.modelo.entrada` | La marca publica estos datos para el modelo entero, no para cada versión. |
| `ficha.modelo.autonomia` / `.potencia` / `.cargaCc` / `.cargaCa` / `.baterias` / `.tracciones` | Autonomía WLTP máxima del modelo / Potencia máxima del modelo / Carga máxima en CC / Carga máxima en CA / Capacidades de batería / Tracciones |
| `ficha.lista.separador` | · |
| `ficha.imagenes.titulo` | Más imágenes |
| `ficha.relacionados.titulo` | Otros modelos del segmento {segmento} |
| `ficha.nota.marca` | [{n}] |
| `ficha.nota.sr` | Fuente {n} |
| `ficha.nota.noOficial` | fuente no oficial |
| `ficha.fuentes.titulo` | Fuentes |
| `ficha.fuentes.entrada` | Dónde se ha leído cada dato y cuándo. El precio lleva su fuente junto a la cifra. |
| `ficha.fuentes.item` | {fuente}, consultado el {fecha}. |
| `ficha.fuentes.noOficial` | Fuente no oficial. |
| `fecha.mes.1` … `fecha.mes.12` | ene, feb, mar, abr, may, jun, jul, ago, sep, oct, nov, dic |
| `fecha.mesAno` / `fecha.diaMesAno` | {mes} {ano} / {dia} {mes} {ano} |

Las etiquetas de segmento y de tracción son las claves ya definidas en `filtros-catalogo.md`; no se duplican.
Si la tarjeta ya tiene claves equivalentes para «Próximamente», «Descatalogado» y «Precio con oferta», el
Desarrollador reutiliza esas y no crea las de `ficha.*` (mismo texto).

## Tokens que usa

Color: `surface`, `surface-muted`, `ink-900`, `ink-600`, `line-soft`, `brand-600`, `brand-800`, `soon-*`,
`discontinued-*`, `deal-*`. Tipografía: `--text-title`, `--text-section`, `--text-card-title`, `--text-price`,
`--text-body`, `--text-small`, `--text-badge`. Medidas: `--width-page`, `--width-prose`, `--size-touch`,
`--radius-card`.

**Nuevos** (añadidos en `tokens.md`): `--size-segment-icon-lg`, `--width-version-label`, `--width-version-col`,
`--width-version-col-max`. **No hay colores nuevos**; los pares usados ya están calculados en `tokens.md`.

## Preguntas abiertas para Producto

Respondidas el 2026-10-06 por delegación del responsable (se dejan las preguntas originales debajo):
1. ~~Nombre de la fuente~~: basta el dominio de la `url`, que sale del dato y no se inventa; no se añade campo al
   registro (ningún PRD lo pide).
2. ~~Enlace de cada imagen a su página de origen~~: sí, y ya lo fija ADR-0012 (aceptada, punto 6): la atribución
   enlaza a `page_url`.
3. ~~Enlace a la página del segmento~~: no. RF-15 no lo pide; añadirlo sería un cambio de alcance y pasaría
   primero por el PRD.
4. ~~Meta descripción~~: no por ahora. Ni PRD-001 ni PRD-002 la piden, y se decidirá una vez para todas las
   páginas (la misma pregunta sigue abierta en `paginas-catalogo.md`).

Preguntas originales:

1. **Nombre de la fuente.** El registro no tiene nombre de presentación; aquí se usa el dominio de la `url`.
   ¿Basta, o se añade un campo de nombre al registro (cambio fuera del alcance de diseño)?
2. **Enlace de cada imagen a su página de origen** (`images[].url`, p. ej. la ficha de Commons). RF-12 solo pide
   la atribución; no se especifica sin confirmarlo.
3. **Enlace a la página del segmento** desde «Otros modelos del segmento» (`/segmentos/{segmento}`). Sumaría un
   enlace interno, pero RF-15 no lo pide.
4. **Meta descripción** de la ficha: como en `paginas-catalogo.md`, Pregunta 4; no se especifica.
