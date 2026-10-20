# Ficha de modelo

PRD-002 (ready): RF-1 a RF-16, RNF-1 a RNF-5; CA-1 a CA-19. El bloque «Reviews» (RF-16) aplica además
PRD-006 (ready): RF-1 a RF-10, RNF-1 a RNF-5, CA-1 a CA-9. Tokens: [`tokens.md`](tokens.md). Esquema:
`docs/architecture/data-model.md` (ADR-0008; reviews y resultados de pruebas en su sección 3.1, ADR-0017). Se apoya en lo ya especificado y no lo repite:

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
   6. **Fuentes** (`h2`, RF-9): siempre que haya algún dato con nota; cierra los datos de la ficha.
   7. **Reviews** (`h2`, RF-16; PRD-006): solo si hay alguna review o resultado de prueba. Es el último
      bloque de `main`, después de «Fuentes» (CA-19).
4. Pie del sitio.

Encabezados: un `h1`; `h2` para cada bloque de `main`; `h3` para el nombre de versión en los bloques, para
«Condiciones de las ofertas», para el modelo en las tarjetas relacionadas (como en `paginas-catalogo.md`) y
para las dos sublistas de «Reviews» cuando aparecen las dos.

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
│ h3 Condiciones…          │           │                                                      │
│ Datos del modelo         │           │ Reviews                                              │
│ Más imágenes             │           │ Título literal de la review (enlace)                 │
│ Otros modelos…           │           │ Medio · dominio · consultado el 20 sep 2026          │
│ Fuentes                  │           └──────────────────────────────────────────────────────┘
│ Reviews ⁴                │
└──────────────────────────┘
```

(⁴ «Reviews» solo existe si el modelo tiene alguna review o resultado de prueba; ver «Reviews».)

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
- **«Comparar»** (PRD-003, RF-7): enlace de texto en su propia línea, después de «Ver en la web de la marca»,
  solo si el modelo es comparable (`on_sale` o `announced` y con versiones). Destino, aspecto y texto:
  [`comparador.md`](comparador.md), «La acción "Comparar"». En el orden de foco va justo después de «Ver en la
  web de la marca».
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
Último bloque de los datos de la ficha; solo «Reviews», si existe, va detrás (RF-16). Sus notas cubren solo
los datos de la ficha: las reviews y los resultados de pruebas llevan su origen junto a cada entrada y no
tienen número. `h2` `ficha.fuentes.titulo` «Fuentes»; debajo, `ficha.fuentes.entrada` (`text-small`,
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

## Reviews (PRD-002 RF-16, CA-19; PRD-006 RF-1 a RF-10, CA-1 a CA-9)

Bloque con los datos de `reviews` y `test_results` del fichero del modelo (`data-model.md`, sección 3.1;
ADR-0017). Todo lo que contiene es de un tercero y va en el HTML servido, sin JavaScript (PRD-006, RNF-1).
Cómo llegan los datos al build no es de este documento.

### Cuándo existe y dónde va (RF-16, CA-19; PRD-006 RF-10, CA-9)
- **Último bloque de `main`**, después de «Otros modelos del segmento» y de «Fuentes». No hay ninguna otra
  página ni URL de reviews (CA-9): ni ancla de navegación propia en la cabecera ni enlace «Ver todas».
- **Solo existe si hay al menos una entrada publicable** en `reviews` o en `test_results`. Un modelo sin
  ninguna **no muestra el bloque**: ni `h2` ni texto (decisión de diseño que PRD-002, RF-16 deja abierta).
  Motivos: es lo que ya hace la ficha con los bloques opcionales («Más imágenes», «Otros modelos del
  segmento»); con la cobertura inicial (PRD-006, sección 2: aún sin fuentes registradas) casi todas las
  fichas acabarían con un aviso vacío al pie, que no da información sobre el coche; y un texto como «Aún no
  hay reviews» podría leerse como un juicio sobre el modelo. «Versiones» sí muestra su vacío porque es el
  contenido central de la ficha (RF-11); este bloque no.
- Modelo con `needs_review: true`: no hay ficha, así que tampoco bloque (PRD-006 RF-4, CA-4).

### Título y estructura
- `<section aria-labelledby>` con `h2` `ficha.reviews.titulo`: **«Reviews»** (el nombre del área en la visión
  y en PRD-006). `--text-section`, `ink-900`, como los demás `h2`.
- Dos sublistas posibles, cada una con su línea de entrada:
  - **Resultados de pruebas** (`test_results`, PRD-006 RF-9), primero: es dato con fuente (T2) y la ficha
    pone lo concreto antes que lo demás (como «Versiones» antes que «Datos del modelo»).
  - **Reviews de medios** (`reviews`, PRD-006 RF-7), después.
- **Si solo hay una de las dos** (hoy siempre: la lista de `metric` está vacía y cualquier `test_results` falla
  la validación), no hay `h3`: la línea de entrada de esa sublista va directamente bajo el `h2`.
- **Si hay las dos**, cada una lleva su `h3` (`ficha.reviews.pruebasTitulo` «Resultados de pruebas»,
  `ficha.reviews.mediosTitulo` «Reviews de medios»), `--text-card-title`, `ink-900`, y su entrada debajo.
- Líneas de entrada, `text-small`, `ink-600`, ancho `--width-prose`:
  - `ficha.reviews.mediosEntrada`: «Enlaces a pruebas de este modelo publicadas por otros medios. Llevan a
    su web, con el título original y en el idioma en que se publicaron, sin traducir ni resumir.» (PRD-006
    RF-6, RF-7, RNF-4).
  - `ficha.reviews.pruebasEntrada`: «Resultados publicados por organismos de pruebas independientes, con el
    nombre de la prueba tal como lo publican.» (PRD-006 RF-9).
- Cada sublista es una `<ul>` (el orden es de presentación, no un ranking: PRD-006 RF-5, sin «mejor»).
  Entradas separadas `4` y con una línea `line-soft` entre ellas (decorativa). Sin Card: son enlaces en una
  lista, no bloques de datos comparables. Una columna, ancho máximo `--width-prose`, en todas las anchuras.

### Cada enlace a una review (PRD-006 RF-1, RF-5, RF-7, CA-1, CA-5, CA-6)

```
Acme Volta 80 AWD: probamos el SUV eléctrico de 520 km    ← enlace a url; text-body, peso 600, brand-600
Motor Ejemplo · motor.example · consultado el 20 sep 2026  ← text-small, ink-600
Sobre la versión Volta 80 AWD                              ← solo si hay version; text-small, ink-600
```
(Datos del ejemplo ficticio de `data-model.md`, sección 3.1.)

Orden dentro de la entrada y por qué:
1. **Título** (`title`), literal, como texto del enlace `<a href="{url}">`: es lo que identifica la pieza
   (RF-7) y lo que se pulsa. Ni comillas, ni recorte, ni «…», ni traducción (ADR-0017: literal y sin acortar;
   RF-6). `text-body`, peso 600, `brand-600`, subrayado, hover `brand-800`. Se abre en la misma pestaña, como
   «Ver en la web de la marca» (sin `target="_blank"`).
2. **Quién lo firma, adónde lleva y cuándo se consultó**, en una sola línea `ficha.reviews.origen`:
   «{medio} · {dominio} · consultado el {fecha}».
   - `{medio}`: el `name` de `data/sources/{source_id}.yaml` (ADR-0017, decisión 4), tal cual.
   - `{dominio}`: el host de `url` sin `www.` («motor.example», «videos.motor.example»), con la misma regla que
     «Nombre de la fuente». Es la señal visible de que el enlace sale de la web y a cuál (RNF-4, RF-5).
   - `{fecha}`: `retrieved` con mes corto («20 sep 2026», «Fechas»). Rotulada como consulta, no como
     publicación: el esquema no guarda la fecha de publicación y no se puede dar a entender que la tiene.
3. **Versión**, si la entrada trae `version`: `ficha.reviews.version` «Sobre la versión {version}», con el
   `name` literal. En texto, no en Badge ni en color (PRD-006 RNF-3): las etiquetas Badge de la ficha son de
   estado y de oferta, y una más competiría con ellas. Sin `version`, la review es del modelo y no se añade
   nada (no hace falta «Sobre el modelo»: el bloque ya está en su ficha).

No hay extracto, resumen, puntuación, estrellas, «recomendado», logotipo del medio ni miniatura de la pieza
(PRD-006 RF-6, RF-7, CA-6; sin «mejor» ni insignias). Ningún enlace es de compra ni lleva el aspecto de un
botón (RF-5, CA-5).

**El enlace se entiende fuera de contexto** (WCAG 2.4.4; listas de enlaces del lector): el título literal
puede no nombrar el modelo ni el medio («Primera prueba»). Por eso el enlace lleva, tras el título, texto
oculto visualmente `ficha.reviews.enlaceSr`: «(review de {medio} sobre {marca} {modelo}, en otra web)». El
nombre accesible queda «Primera prueba (review de Motor Ejemplo sobre Acme Volta, en otra web)».

### Cada resultado de prueba (PRD-006 RF-1, RF-9, CA-1, CA-2, CA-8)

La lista de `metric` de `data-model.md` está vacía: aquí solo se fija la forma general. No se inventa ninguna
métrica ni su rótulo.

```
{Rótulo de la métrica}: {valor} {unidad}                    ← text-body, ink-900
{test}                                                       ← text-small, ink-600, literal
Fuente: {organismo}, {fecha}                                 ← text-small, ink-600; {organismo} enlaza a url
Sobre la versión {version}                                   ← solo si hay version
{note}                                                       ← solo si la trae, literal
```

- **Dato y unidad:** `{Rótulo de la métrica}` sale de una clave `ficha.pruebas.metrica.{metric}`, que se crea
  cuando la métrica entre en `data-model.md` (no antes). `{valor}` con formato `es-ES` y la unidad que fija el
  sufijo del nombre de la métrica con las claves `ficha.unidad.*` existentes (o una nueva junto a la métrica).
  Una métrica sin rótulo definido no se pinta (no se muestra el identificador `snake_case`).
- **`test`:** el nombre literal de la prueba o protocolo, sin traducir (RF-6, RNF-4).
- **Origen junto al dato**, como el precio: `ficha.pruebas.fuente` «Fuente: {organismo}, {fecha}»; `{organismo}`
  es el `name` del registro y es el enlace a `url`, con texto oculto `ficha.pruebas.fuenteSr` «(resultado de
  {test} para {marca} {modelo}, en otra web)». El enlace va en línea con el texto (excepción «en línea» del
  tamaño táctil) con la zona de pulsación ampliada a 24 × 24 px, como las marcas de nota.
- **`version`** como en las reviews; **`note`** debajo, literal, `text-small`, `ink-600` (como RF-8 de PRD-002).
- Un `dl` por resultado: `dt` el rótulo de la métrica, `dd` el valor; las líneas siguientes en el `dd`.

### Nivel de la fuente
Ninguna entrada del bloque lleva «fuente no oficial»: todas son de un tercero por construcción (ADR-0017), el
nombre del medio u organismo está escrito en cada una y la línea de entrada lo dice. Esa marca distingue, en
los datos de la ficha, un valor que no viene de la marca de uno que sí; aquí no hay valor de la marca con el
que confundirlo. Pregunta 7.

### Orden de las entradas (preguntas abiertas de ADR-0017)
Se resuelve al construir; no hay control para cambiarlo.
1. Primero las entradas **sin `version`** (del modelo entero); después, las de cada versión, **en el orden
   del bloque «Versiones»** (RF-3), para que el visitante encuentre las de una versión juntas y en el mismo
   orden que arriba.
2. Dentro de cada grupo, por `{medio}` (u `{organismo}`) en orden alfabético español (`Intl.Collator('es')`),
   y a igual medio, en el orden del fichero. Es un orden neutro: no sugiere que un medio sea mejor ni más
   reciente (PRD-006, fuera de alcance: sin «mejor»).
3. No se ordena por `retrieved`: es la fecha de consulta, no la de publicación, y ordenar por ella haría
   pasar por «más reciente» lo que solo se comprobó más tarde.

**Sin máximo** de entradas por modelo ni por medio: todas van en el HTML servido y visibles (sin `<details>`
ni «ver más», que esconderían el origen de lo que hay detrás). Con la cobertura prevista (PRD-006, P2), un
tope sería arbitrario. Pregunta 6.

### Idioma de los títulos (PRD-006 RNF-4; WCAG 3.1.2)
El esquema no guarda el idioma del enlace (ADR-0017, pregunta abierta). Mientras no lo guarde:
- El aviso de idioma va **una vez, en la línea de entrada** de la sublista (`ficha.reviews.mediosEntrada`), no
  en cada enlace: decir «en inglés» en una entrada concreta exigiría deducir el idioma del título, y eso es
  inventar un dato.
- No se pone atributo `lang` en el título: no se sabe cuál es. Esto deja sin cumplir WCAG 3.1.2 (idioma de las
  partes, nivel AA) cuando un título está en otro idioma: el lector lo pronunciará con la voz española.
  Pregunta 5.

### Disposición
Igual en móvil y escritorio: una columna dentro del ancho de página, limitada a `--width-prose`. A 320 px, el
título, el dominio y el nombre de la versión parten línea (`overflow-wrap: anywhere`) y nada se recorta: sin
scroll horizontal (PRD-006 RNF-3). La línea de origen puede ocupar dos o tres líneas; los separadores «·»
(`ficha.lista.separador`) van con espacio fino no separable delante para no quedar al principio de línea.
Zona táctil: el enlace de título es un bloque propio (no está dentro de una frase), así que su caja tiene al
menos `--size-touch` de alto (relleno vertical si el título ocupa una sola línea).

### Estados del bloque
| Situación | Qué se ve | Requisito |
|---|---|---|
| Sin `reviews` ni `test_results` (o las dos `[]`) | No hay bloque | PRD-002 RF-16; PRD-006 RF-10 |
| Solo `reviews` (el caso de hoy) | `h2`, entrada de medios, lista; sin `h3` | PRD-006 RF-7 |
| Solo `test_results` | `h2`, entrada de pruebas, lista; sin `h3` | PRD-006 RF-9 |
| Las dos | `h2`; `h3` «Resultados de pruebas» y su lista; `h3` «Reviews de medios» y su lista | PRD-006 RF-7, RF-9 |
| Review de una versión | «Sobre la versión {version}» en texto | PRD-006 sección 6 |
| Título muy largo o en otro idioma | Literal, completo, parte línea; sin `lang` (pregunta 5) | PRD-006 RF-6, RNF-4 |
| Varias reviews del mismo medio | Todas, ordenadas como arriba; sin tope | Pregunta 6 |
| `retrieved` antiguo o fuente `broken` | Se muestra igual, con su fecha visible: el visitante ve cuándo se comprobó | PRD-006 RF-1; pregunta 8 |
| Métrica sin rótulo definido | Ese resultado no se pinta | PRD-006 RF-2 |
| Modelo `needs_review: true` | No hay ficha | PRD-006 RF-4, CA-4 |
| Cargando / error | No hay: va en el HTML generado | PRD-006 RNF-1 |

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
| Sin reviews ni resultados de pruebas | No hay bloque «Reviews»; la ficha acaba en «Fuentes» | RF-16 |
| Con reviews o resultados | Bloque «Reviews» al final, detrás de «Fuentes» (estados propios en «Reviews») | RF-16, CA-19 |
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
8. «Reviews»: en los resultados de pruebas, el enlace del organismo de cada uno; en las reviews de medios,
   el enlace del título de cada una. Una parada por entrada, en el orden de «Orden de las entradas».

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
7. Si hay reviews (ejemplo ficticio de `data-model.md`): «Reviews, encabezado nivel 2.» La línea de entrada.
   «Lista, 2 elementos.» «Acme Volta, primera prueba (review de Motor Ejemplo sobre Acme Volta, en otra web),
   enlace.» «Motor Ejemplo · motor.example · consultado el 20 sep 2026.» Y en la segunda: «… Sobre la versión
   Volta 80 AWD.»

Landmarks: `nav` de la ruta y `main`. Por encabezados se llega directo a «Versiones», «Datos del modelo»,
«Más imágenes», «Otros modelos del segmento», «Fuentes» y «Reviews». Las etiquetas se leen como texto («Precio con
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
| `ficha.reviews.titulo` | Reviews |
| `ficha.reviews.mediosTitulo` | Reviews de medios |
| `ficha.reviews.pruebasTitulo` | Resultados de pruebas |
| `ficha.reviews.mediosEntrada` | Enlaces a pruebas de este modelo publicadas por otros medios. Llevan a su web, con el título original y en el idioma en que se publicaron, sin traducir ni resumir. |
| `ficha.reviews.pruebasEntrada` | Resultados publicados por organismos de pruebas independientes, con el nombre de la prueba tal como lo publican. |
| `ficha.reviews.origen` | {medio} · {dominio} · consultado el {fecha} |
| `ficha.reviews.version` | Sobre la versión {version} |
| `ficha.reviews.enlaceSr` | (review de {medio} sobre {marca} {modelo}, en otra web) |
| `ficha.pruebas.fuente` | Fuente: {organismo}, {fecha} |
| `ficha.pruebas.fuenteSr` | (resultado de {test} para {marca} {modelo}, en otra web) |
| `ficha.pruebas.metrica.{metric}` | Se define con cada métrica de `data-model.md`; hoy ninguna |
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

El bloque «Reviews» **no añade tokens**: usa `--text-section`, `--text-card-title`, `--text-body`,
`--text-small`, `--width-prose`, `--size-touch`, `line-soft` y estos pares, todos sobre `surface` y ya
calculados en `tokens.md`: `ink-900` (17,74:1), `ink-600` (7,56:1), `brand-600` (6,67:1) y `brand-800` en
hover (9,33:1); todos cumplen 4,5:1. Los enlaces se distinguen por el subrayado, no solo por el color.

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

Abiertas (bloque «Reviews», 2026-10-21). El diseño de arriba funciona sin responderlas:
5. **Idioma de cada enlace (`lang`).** Sin un campo de idioma en `reviews` (ADR-0017 lo deja abierto), un
   título en otro idioma no puede llevar `lang` y la página incumple WCAG 3.1.2 (AA, ADR-0006) para ese
   título. ¿Se añade `lang` al esquema (decisión de Arquitectura)? Con él, el título llevaría su `lang` y la
   línea de origen podría decir «en inglés» por entrada; el aviso general de la entrada seguiría valiendo.
6. **Máximo de entradas.** Se ha diseñado sin tope. ¿Quiere Producto un máximo por modelo o por medio cuando
   haya cobertura (ADR-0017)? Si lo hay, hay que decidir también qué se descarta, porque no se puede esconder
   tras un control sin JS que oculte el origen.
7. **«Fuente no oficial» en el bloque.** Se ha omitido porque todo es de terceros y lleva su firma. ¿Lo
   confirma Producto, o se quiere la marca de RF-9 también aquí?
8. **Enlaces de fuentes `broken` o con `retrieved` de más de 45 días.** Hoy se muestran (el validador solo
   avisa). ¿Debe el build dejar de publicar los de una fuente `broken`? No lo dice ningún RF.
9. **Fecha de publicación.** Con ella se podría ordenar por novedad y mostrarla junto a la de consulta
   (ADR-0017, pregunta abierta). Hasta entonces el orden es alfabético por medio.

Preguntas originales:

1. **Nombre de la fuente.** El registro no tiene nombre de presentación; aquí se usa el dominio de la `url`.
   ¿Basta, o se añade un campo de nombre al registro (cambio fuera del alcance de diseño)?
2. **Enlace de cada imagen a su página de origen** (`images[].url`, p. ej. la ficha de Commons). RF-12 solo pide
   la atribución; no se especifica sin confirmarlo.
3. **Enlace a la página del segmento** desde «Otros modelos del segmento» (`/segmentos/{segmento}`). Sumaría un
   enlace interno, pero RF-15 no lo pide.
4. **Meta descripción** de la ficha: como en `paginas-catalogo.md`, Pregunta 4; no se especifica.
