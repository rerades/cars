> **Borrador** (2026-09-27): primera versión del designer, cortada por presupuesto y escrita antes de
> ADR-0008. Los nombres de campo que cita son los antiguos; se rehace en la siguiente tarea.

# Tarjeta de modelo

PRD-001: RF-1, RF-7, RF-8, RF-9; CA-1, CA-8, CA-9, CA-10, CA-11. Tokens: `tokens.md`. Base: Card y Badge de
Bearnie (ADR-0005), sin JS: la tarjeta es HTML estático (RF-10, CA-12c). Se usa en `/coches`, en `/marcas/{marca}`
y en las demás páginas de RF-10. La ficha (PRD-002) no se especifica aquí.

## Estructura y jerarquía (RF-1)

```
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │  imagen 16:9 (o hueco), sin texto encima
│ │        [imagen]          │ │
│ └──────────────────────────┘ │
│ Foto: {atribución}           │  solo si la licencia la exige (text-small, ink-600)
│ CUPRA                        │  marca      text-small ink-600
│ Tavascan                     │  modelo     text-card-title, es el enlace a la ficha
│ [Próximamente · oct 2026]    │  etiqueta de estado, solo si no está a la venta
│ Desde 31.223 €  [Precio con  │  precio     text-price + etiqueta si es oferta
│                  oferta]     │
│ Hasta 557 km WLTP            │  autonomía  text-body
│ SUV                          │  segmento   text-body
└──────────────────────────────┘
```

Orden en el DOM = orden visual = orden de lectura: imagen, atribución, marca, modelo, estado, precio,
autonomía, segmento. Marca **antes** del modelo, porque así se lee «Cupra Tavascan».

| Campo (RF-1) | Origen | Formato |
|---|---|---|
| Marca | `brand` | Nombre propio con la capitalización de la marca (`cupra` en el YAML → «Cupra») |
| Modelo | `model` | Tal cual |
| Imagen | `images` con fuente y licencia (CA-10) | 16:9, `object-fit: cover`, `loading="lazy"` salvo las 2 primeras tarjetas (LCP, RNF-2) |
| Precio desde | mínimo de `price.value` entre las versiones con precio | `Desde 31.223 €`, número `es-ES`, sin decimales (solo redondeo de visualización) |
| Autonomía WLTP máxima | máximo de `wltp_km` entre versiones | `Hasta 557 km WLTP` |
| Segmento | ver «Datos que faltan» | Texto |

El bloque entero de la tarjeta es **un único enlace** a la ficha: el enlace envuelve el nombre del modelo y
se extiende sobre toda la tarjeta con un pseudo-elemento (no un `<a>` que envuelva todo, para que el lector no lea
la tarjeta entera como nombre del enlace). Una zona táctil, un tabulador por tarjeta. Sin botones dentro.
Hover: borde `brand-600` y nombre subrayado; no cambia de tamaño.

## Estados

| Estado | Qué se ve | Requisito |
|---|---|---|
| **Normal, PVP** | Como el wireframe, sin etiquetas | RF-1, CA-1 |
| **Próximamente con fecha** | Etiqueta `soon`: «Próximamente · {mes año}» (p. ej. «Próximamente · oct 2026»). Si la fecha solo es de trimestre, el texto que dé el dato | RF-7, CA-8 |
| **Próximamente sin fecha** | «Próximamente» a secas; no se inventa fecha | RF-7 |
| **Precio con oferta** | Etiqueta `deal` «Precio con oferta» junto al precio. Las condiciones **no** van en la tarjeta (van en la ficha, RF-9) | RF-9, CA-11 |
| **Sin precio** | En el lugar del precio: «Precio por confirmar» (`text-price`, `ink-600`; sin «Desde», sin etiqueta) | CA-9, RF-7 |
| **Sin autonomía** | «Autonomía por confirmar» en `ink-600` | RF-1 |
| **Sin segmento** | La línea de segmento **no se pinta** (no se deja hueco ni «–») | RF-1 |
| **Sin imagen o sin licencia** | Hueco `surface-muted` 16:9 con el nombre de la marca en `ink-600`; **sin atribución** ni imagen | RF-8, CA-10 |
| **Texto largo** | Marca y modelo: hasta 2 líneas y se parte (`overflow-wrap`); nunca se recorta con puntos suspensivos, la etiqueta baja de línea. Atribución: hasta 2 líneas. Las tarjetas de una fila igualan alto y el precio queda alineado abajo | — |
| **Requiere revisión** (`needs_review`) | No se avisa al visitante en la tarjeta | Pregunta 5 |

Combinaciones: «Próximamente» + «Precio con oferta» + con precio son compatibles; Próximamente sin precio muestra
«Precio por confirmar». Las dos etiquetas no dependen del color: llevan texto.

Cuando el precio mínimo lo da una versión con oferta pero otras versiones tienen PVP, manda la versión que da el
mínimo: si es oferta, lleva la etiqueta (RF-9: «siempre con su etiqueta»).

### Imagen y atribución (RF-8, CA-10)
- Solo se pinta una imagen que tenga fuente y licencia registradas. Sin ellas, el hueco.
- Si la licencia exige atribución, el texto va **debajo** de la imagen, no encima (el contraste sobre foto no es
  medible): `text-small`, `ink-600` sobre `surface` (7,56). La redacción la fija la licencia; plantilla: «Foto: {titular}».
- `alt=""`: la imagen es decorativa porque el nombre del modelo ya está a su lado; evita que el lector lo repita.
  El hueco sin imagen tampoco se lee (`aria-hidden`).
- Ancho y alto declarados en la imagen para evitar saltos de diseño.

## Lector de pantalla
El enlace se lee «Cupra Tavascan», y el resto de la tarjeta se lee como texto contiguo. Las etiquetas se leen tal
cual («Precio con oferta»). Para que el precio y la autonomía tengan contexto, cada dato va en una lista de
descripción (`dl`) con su rótulo visible u oculto solo visualmente: «Precio desde», «Autonomía WLTP máxima»,
«Segmento». Cada tarjeta es un `<li>` de una lista cuyo nombre es «Modelos» y que anuncia el número de elementos.

## Rejilla
Móvil: 1 columna. `md`: 2. `lg`: 3. Sin scroll horizontal a 320 px (WCAG 1.4.10).

## Datos que faltan de verdad (`data/raw/`, 6 modelos: 3 Cupra, 3 Polestar)
- **Segmento: ningún YAML lo trae.** Hoy **ninguna tarjeta** tendría segmento (RF-1, CA-1 incumplibles, y RF-10
  no puede generar páginas de segmento). Es un dato que falta, no un caso raro. Pregunta 1.
- **Imágenes: ninguna.** Cupra `images: []` y sin licencia (`registry.yaml`, `image_license` vacío en las fuentes vistas);
  Polestar no tiene clave. Hoy **todas** las tarjetas llevan el hueco.
- **Precio: los seis modelos son `financed`**; no hay ningún PVP limpio. Hoy **todas** las tarjetas llevan «Precio con
  oferta». Visualmente conviene que la etiqueta sea pequeña, pero no se esconde (RF-9).
- **Sin precio a nivel de versión:** Raval (3 de 4), Born VZ, Tavascan Endurance y VZ. Se ignoran para el «desde».
- **Autonomía:** en Cupra es `wltp_km` por versión; en Polestar es `wltp_range` (versión) o `wltp_range_max` (modelo, p. ej. «hasta 659 km»
  en el 2) y en Polestar 4 falta el Dual Motor. La tarjeta debe recibir un solo valor ya normalizado; con nombres de
  campo distintos, el catálogo mostraría «Autonomía por confirmar» aunque el dato exista.
- **Próximamente:** ningún modelo tiene `status` de anunciado. El Raval está `on_sale`, pero una versión base es «Próximamente»: la
  tarjeta es del **modelo**, así que va como a la venta (pregunta 4). No hay fecha prevista en ningún YAML: aún no existe la fuente de la fecha.
- **Tracción:** solo Tavascan (FWD/AWD por versión) y Polestar 3 (`drivetrain`, a nivel de modelo). Ver `filtros-catalogo.md`.
