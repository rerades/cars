# Tarjeta de modelo

PRD-001: RF-1, RF-7, RF-8, RF-9, RF-11, RF-12; CA-1, CA-8, CA-9, CA-10, CA-11, CA-14, CA-15, CA-17. Tokens:
`tokens.md`. Esquema de datos: `docs/architecture/data-model.md` (ADR-0008). Base: Card y Badge de Bearnie
(ADR-0005), sin JS: la tarjeta es HTML estático (RF-10, CA-12c). Se usa en `/coches`, en `/marcas/{marca}`
y en las demás páginas de RF-10. La ficha (PRD-002) no se especifica aquí.

## Estructura y jerarquía (RF-1)

```
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │  imagen 16:9, o hueco con silueta (ver «Imagen»)
│ │        [imagen]          │ │
│ └──────────────────────────┘ │
│ Foto: {atribución}           │  solo si la imagen real lo exige (text-small, ink-600)
│ CUPRA                        │  marca      text-small ink-600
│ Tavascan                     │  modelo     text-card-title, es el enlace a la ficha
│ [Próximamente · oct 2026]    │  etiqueta de estado, solo si no es «a la venta» sin más
│ Desde 31.223 €  [Precio con  │  precio     text-price + etiqueta si es oferta
│                  oferta]     │
│ Hasta 557 km WLTP            │  autonomía  text-body
│ SUV compacto                 │  segmento   text-body
└──────────────────────────────┘
```

Orden en el DOM = orden visual = orden de lectura: imagen, atribución, marca, modelo, estado, precio,
autonomía, segmento. Marca **antes** del modelo, porque así se lee «Cupra Tavascan».

| Campo (RF-1) | Origen (`data-model.md`) | Formato |
|---|---|---|
| Marca | `brand_name` | Tal cual (ya es el nombre de presentación) |
| Modelo | `model` | Tal cual |
| Imagen | `images[0]` con `license`; si no hay ninguna, silueta (RF-8, CA-17) | 16:9, `object-fit: cover`, `loading="lazy"` salvo las 2 primeras tarjetas (LCP, RNF-2) |
| Precio desde | mínimo de `versions[].price.value` entre las versiones con `price` no nulo | `Desde 31.223 €`, número `es-ES`, sin decimales (solo redondeo de visualización) |
| Autonomía WLTP máxima | máximo de `versions[].wltp_km`; si ninguna versión lo trae, `specs.wltp_max_km` | `Hasta 557 km WLTP` |
| Segmento | `segment.value`; lista cerrada de RF-11 | Etiqueta española del valor (ver «Etiquetas de segmento» en `filtros-catalogo.md`), p. ej. `suv_compacto` → «SUV compacto» |

El bloque entero de la tarjeta es **un único enlace** a la ficha: el enlace envuelve el nombre del modelo y
se extiende sobre toda la tarjeta con un pseudo-elemento (no un `<a>` que envuelva todo, para que el lector no lea
la tarjeta entera como nombre del enlace). Una zona táctil, un tabulador por tarjeta. Sin botones dentro.
Hover: borde `brand-600` y nombre subrayado; no cambia de tamaño.

## Estados

| Estado | Qué se ve | Requisito |
|---|---|---|
| **A la venta (`status: on_sale`), PVP** | Como el wireframe, sin etiqueta de estado | RF-1, CA-1 |
| **Próximamente (`status: announced`) con `launch`** | Etiqueta `soon`: «Próximamente · {mes año}» a partir de `launch` (`YYYY-MM` → «oct 2026»). Si `launch` es `YYYY-MM-DD`, se muestra solo mes y año | RF-7, CA-8 |
| **Próximamente sin `launch`** | «Próximamente» a secas; no se inventa fecha | RF-7 |
| **Descatalogado (`status: discontinued`)** | Etiqueta `discontinued`: «Descatalogado», en el mismo lugar que «Próximamente». Un modelo lleva un único `status`: nunca las dos etiquetas juntas | RF-7, CA-14 |
| **Precio con oferta (`price_kind: financed`)** | Etiqueta `deal` «Precio con oferta» junto al precio. Las condiciones (`price_terms`) **no** van en la tarjeta (van en la ficha, RF-9) | RF-9, CA-11 |
| **Sin precio** (`price: null` en todas las versiones) | En el lugar del precio: «Precio por confirmar» (`text-price`, `ink-600`; sin «Desde», sin etiqueta) | CA-9, RF-12 |
| **Sin autonomía** | «Autonomía por confirmar» en `ink-600` | RF-12, CA-15 |
| **Sin segmento** | «Segmento por confirmar» en `ink-600`, en el mismo sitio que el segmento (no se oculta la línea: RF-12 pide mostrar el modelo igual, con el aviso) | RF-12, CA-15 |
| **Sin imagen con licencia** | Silueta del segmento (o genérica si tampoco hay segmento) en el hueco; ver «Imagen y silueta» | RF-8, CA-17 |
| **Texto largo** | Marca y modelo: hasta 2 líneas y se parte (`overflow-wrap`); nunca se recorta con puntos suspensivos, la etiqueta baja de línea. Atribución: hasta 2 líneas. Las tarjetas de una fila igualan alto y el precio queda alineado abajo | — |
| **Requiere revisión** (`needs_review`) | No se avisa al visitante en la tarjeta | Pregunta abierta 3 de `filtros-catalogo.md` |

Combinaciones: «Próximamente» + «Precio con oferta» + con precio son compatibles; «Descatalogado» +
«Precio con oferta» también (un modelo descatalogado puede conservar su precio de catálogo). Próximamente
sin precio muestra «Precio por confirmar». Ninguna etiqueta ni aviso depende del color: todos llevan texto.

Cuando el precio mínimo lo da una versión con oferta pero otras versiones tienen PVP, manda la versión que
da el mínimo: si es oferta, lleva la etiqueta (RF-9: «siempre con su etiqueta»).

### Imagen y silueta, sin imagen (RF-8, CA-10, CA-17)
- Solo se pinta una imagen de `images[0]` que tenga `license` (`data-model.md`): por el orden de fuentes
  de RF-8, primero Wikimedia Commons con licencia de uso comercial explícita, y si no hay, la sala de
  prensa de la marca con términos escritos. Sin ninguna de las dos, la tarjeta no usa ninguna imagen ajena.
- Si la imagen trae `attribution`, el texto va **debajo** de la imagen, no encima (el contraste sobre foto
  no es medible): `text-small`, `ink-600` sobre `surface` (7,56). La redacción es la que trae el dato, tal
  cual; plantilla si hace falta anteponer algo: «Foto: {attribution}».
- `alt=""` en la imagen real: es decorativa porque el nombre del modelo ya está a su lado; evita que el
  lector lo repita.
- **Sin imagen con licencia**, el hueco 16:9 `surface-muted` lleva el icono de silueta del segmento del
  modelo, centrado, del tamaño `--size-segment-icon` (`tokens.md`). Si además falta el segmento, lleva una
  silueta genérica de coche, en el mismo sitio y del mismo tamaño. Los dibujos están en
  [`siluetas/`](siluetas/), uno por fichero `{segment.value}.svg` —`urbano`, `compacto`, `berlina`,
  `familiar`, `suv_pequeno`, `suv_compacto`, `suv_grande`, `monovolumen`, `furgoneta`, `deportivo`— y
  `generica.svg` sin segmento; reglas de uso en `tokens.md`, «Silueta de segmento». Trazo en
  `--color-line` vía `currentColor`. El icono es decorativo (`aria-hidden`), sin atribución ni texto
  dentro del hueco.
- Ancho y alto del hueco declarados igual que los de una imagen real, para no mover el resto de la tarjeta.

## Lector de pantalla
El enlace se lee «Cupra Tavascan», y el resto de la tarjeta se lee como texto contiguo. Las etiquetas se leen tal
cual («Precio con oferta», «Descatalogado»). Para que el precio, la autonomía y el segmento tengan contexto,
cada dato va en una lista de descripción (`dl`) con su rótulo visible u oculto solo visualmente: «Precio
desde», «Autonomía WLTP máxima», «Segmento». Cada tarjeta es un `<li>` de una lista cuyo nombre es «Modelos»
y que anuncia el número de elementos.

## Rejilla
Móvil: 1 columna. `md`: 2. `lg`: 3. Sin scroll horizontal a 320 px (WCAG 1.4.10).

## Esquema y datos reales hoy

La tarjeta lee del esquema único de `data-model.md`: `segment`, `status` (`on_sale` | `announced` |
`discontinued`) y `launch` a nivel de modelo; `wltp_km`, `drivetrain` y `price` a nivel de versión, con
`specs.wltp_max_km` y `specs.drivetrains` cuando la fuente solo publica el dato del modelo entero. Nombres y
unidades ya son los mismos entre marcas: la tarjeta no necesita normalizar nada.

Migrar `data/raw/cupra/*.yaml` y `data/raw/polestar/*.yaml` a este esquema queda fuera de esta ADR
(ADR-0008, «Fuera de esta decisión») y es trabajo del Desarrollador. Hasta que se migren, los 6 modelos
reales (3 Cupra, 3 Polestar) no tienen `segment` ni ninguna imagen con `license`: hoy sus tarjetas muestran
«Segmento por confirmar» y la silueta genérica. Con el esquema ya fijado esto es el estado normal de dato
ausente (RF-12), no un caso especial de diseño.

- **Segmento:** ninguno de los 6 ficheros lo trae todavía; en cuanto el Researcher lo rellene (RF-11), la
  tarjeta muestra la etiqueta española del valor.
- **Imágenes:** los 6 ficheros tienen `images: []`; hasta que haya una con `license`, la silueta.
- **Precio:** los 6 son `financed` (ninguna T1 publica PVP limpio); todas las tarjetas llevan «Precio con
  oferta», sin escondérsela (RF-9).
- **Autonomía:** una vez migrada, sale de `wltp_km` por versión o de `specs.wltp_max_km` si la marca solo
  publica el dato del modelo entero (caso de Polestar hoy).
- **Novedad y «Próximamente»:** salen de `launch`. Ningún fichero actual lo trae aún; cuando lo tenga, ordena
  por novedad (RF-3, CA-16 — ver `filtros-catalogo.md`) y da la fecha de «Próximamente» (RF-7).
- **Estado:** es un solo valor por modelo (`data-model.md`); ya no hay ambigüedad entre una versión
  «próximamente» y un modelo «a la venta» — el Researcher fija un único `status` para el modelo entero a
  partir de la fuente.
- **Tracción:** no es un campo de la tarjeta (RF-1 no la pide); es un filtro, ver `filtros-catalogo.md`.
- **Requiere revisión (`needs_review`):** sigue sin avisarse al visitante en la tarjeta (pregunta abierta en
  `filtros-catalogo.md`).
