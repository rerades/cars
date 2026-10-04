# Tokens de diseño

Un solo tema, claro (ADR-0005: sin tema oscuro). Los nombres son variables de tema de Tailwind 4
(`@theme` en `web/src/styles/global.css`): `--color-ink-900` da `text-ink-900`, `bg-ink-900`, etc.
Los componentes citan el token, nunca el valor. Ámbito: tarjeta y filtros de PRD-001 (`tarjeta-modelo.md`,
`filtros-catalogo.md`), con los nombres de campo del esquema único de `docs/architecture/data-model.md`
(ADR-0008); se amplía cuando otra pantalla lo pida.

## Color

Junto a cada token, su luminancia relativa (L) y el par de texto/fondo con el que se usa, con su ratio
(tabla completa en «Contraste»).

| Token | Valor | L | Uso | Contraste del uso |
|---|---|---|---|---|
| `--color-surface` | `#ffffff` | 1,0000 | Fondo de página, tarjeta, campos, chips, botón secundario | — (fondo) |
| `--color-surface-muted` | `#f3f4f6` | 0,9041 | Fondo del panel de filtros, hueco de imagen | — (fondo) |
| `--color-ink-900` | `#111827` | 0,0092 | Texto principal, título, precio, texto de controles, chips y botón secundario, mensaje de error | 17,74 / 16,12 |
| `--color-ink-600` | `#4b5563` | 0,0889 | Texto secundario (marca, datos, atribución, ayudas, «por confirmar») | 7,56 / 6,87 |
| `--color-line` | `#6b7280` | 0,1672 | Borde de controles (casillas, radios, selectores, campos, chips, botón secundario); trazo del icono de silueta. **Nunca texto** | 4,83 / 4,39 (≥ 3, WCAG 1.4.11) |
| `--color-line-soft` | `#d1d5db` | 0,6626 | Borde de tarjeta. **Solo decorativo**: nada depende de verlo | 1,47 (no se exige) |
| `--color-brand-600` | `#0b5cad` | 0,1074 | Enlaces, anillo de foco, botón principal, casilla/radio marcados | 6,67 / 6,06 |
| `--color-brand-800` | `#084785` | 0,0625 | Hover/pulsado del botón principal y de enlaces | 9,33 / 8,48 |
| `--color-on-brand` | `#ffffff` | 1,0000 | Texto y marca de verificación sobre `brand-600` / `brand-800` | 6,67 / 9,33 |
| `--color-soon-bg` / `--color-soon-fg` | `#111827` / `#ffffff` | 0,0092 / 1,0000 | Etiqueta «Próximamente» (`status: announced`) | 17,74 |
| `--color-deal-bg` / `--color-deal-fg` | `#fef3c7` / `#78350f` | 0,8929 / 0,0657 | Etiqueta «Precio con oferta» (`price_kind: financed`) | 8,15 |
| `--color-discontinued-bg` / `--color-discontinued-fg` | `#e5e7eb` / `#374151` | 0,7981 / 0,0519 | Etiqueta «Descatalogado» (`status: discontinued`, RF-7, CA-14) | 8,32 |

(Primera cifra: sobre `surface`; segunda: sobre `surface-muted`.)

No hay color de error: los estados vacío y de dato ausente son informativos, y el error de rango de
precio se dice con texto en `ink-900` y `aria-invalid` (WCAG 3.3.1), no con un color.
El significado nunca va solo en el color (WCAG 1.4.1): cada etiqueta lleva su texto; el fondo de color
de una etiqueta es un refuerzo, no la señal (`deal-bg` sobre `surface` da 1,11 y `discontinued-bg` 1,24:
la forma de la etiqueta puede no verse, y no pasa nada porque el texto la nombra).

### Roles de color por control
Para que ningún control se pinte con valores sueltos:

| Control | Fondo | Texto | Borde | Marcado / activo |
|---|---|---|---|---|
| Botón principal | `brand-600` (hover `brand-800`) | `on-brand` | — | — |
| Botón secundario («Limpiar filtros» del panel) | `surface` | `ink-900` | `line` | — |
| Chip de filtro activo | `surface` | `ink-900` | `line` | — |
| Casilla y radio | `surface` | etiqueta `ink-900` | `line` | relleno `brand-600`, marca `on-brand` |
| Campo de texto / `<select>` | `surface` | `ink-900` | `line` | — |
| Enlace en texto («Explorar», «Saltar a los resultados») | — | `brand-600` (hover `brand-800`), **subrayado siempre** | — | — |

Los campos no usan *placeholder* como etiqueta; si alguno lo lleva como ejemplo, va en `ink-600` (7,56).

## Contraste (WCAG 2.1 AA, RNF-3)

Calculado con la fórmula de luminancia relativa de WCAG 2.1 (linealización sRGB con umbral 0,04045 y
exponente 2,4; ratio = (L1 + 0,05) / (L2 + 0,05)). Se ha hecho a mano, con cuatro decimales en L: margen
de ±0,02 en la ratio, sin que ningún par quede cerca de su umbral salvo los señalados. **El Desarrollador
lo comprueba con una herramienta** y axe en CI (ADR-0006) es la red final.
Umbrales: texto normal ≥ 4,5 (WCAG 1.4.3); texto grande (≥ 24 px, o ≥ 18,66 px en negrita) ≥ 3;
componentes de interfaz y foco ≥ 3 frente a lo que tienen al lado (WCAG 1.4.11).

| Par (texto/elemento sobre fondo) | Ratio | Umbral | Resultado |
|---|---|---|---|
| `ink-900` sobre `surface` | 17,74 | 4,5 | Cumple |
| `ink-900` sobre `surface-muted` | 16,12 | 4,5 | Cumple |
| `ink-600` sobre `surface` | 7,56 | 4,5 | Cumple |
| `ink-600` sobre `surface-muted` | 6,87 | 4,5 | Cumple |
| `brand-600` sobre `surface` (enlace, foco, casilla marcada) | 6,67 | 4,5 / 3 | Cumple |
| `brand-600` sobre `surface-muted` (foco y casilla marcada en panel) | 6,06 | 3 | Cumple |
| `brand-800` sobre `surface` (enlace en hover) | 9,33 | 4,5 | Cumple |
| `brand-800` sobre `surface-muted` | 8,48 | 4,5 | Cumple |
| `on-brand` sobre `brand-600` (botón, marca de casilla) | 6,67 | 4,5 | Cumple |
| `on-brand` sobre `brand-800` (botón hover) | 9,33 | 4,5 | Cumple |
| `soon-fg` sobre `soon-bg` | 17,74 | 4,5 | Cumple |
| `deal-fg` sobre `deal-bg` | 8,15 | 4,5 | Cumple |
| `discontinued-fg` sobre `discontinued-bg` | 8,32 | 4,5 | Cumple |
| `line` sobre `surface` (borde de control) | 4,83 | 3 | Cumple |
| `line` sobre `surface-muted` (borde de control en panel) | 4,39 | 3 | Cumple como borde; **no vale para texto** (< 4,5) |
| `line-soft` sobre `surface` | 1,47 | — | No se exige: solo decora |
| `brand-600` frente a `ink-900` (enlace dentro de texto) | 2,66 | 3 | **No cumple** como única distinción → los enlaces en texto van **subrayados** (WCAG 1.4.1, técnica G183/F73) |
| `deal-bg` sobre `surface` | 1,11 | — | No se exige: la etiqueta se identifica por su texto |
| `discontinued-bg` sobre `surface` | 1,24 | — | Ídem |

Reglas: `line` no se usa nunca para texto. Un enlace que va entre texto se subraya siempre, no solo en
hover. Ningún texto usa un par que no esté en esta tabla; si una pantalla nueva lo necesita, se calcula
aquí antes.

## Tipografía

Pila del sistema, sin fuentes web: cero peticiones y cero salto de texto (RNF-2).
`--font-sans`: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Base 16 px. Los tamaños en `rem`
para que respeten el ajuste del navegador (WCAG 1.4.4); nada de `px` fijos en texto.

| Token | Tamaño / interlínea | Peso | Uso |
|---|---|---|---|
| `--text-title` | 1.5rem / 2rem | 700 | Título de página (`h1`) |
| `--text-section` | 1.125rem / 1.5rem | 700 | Encabezados de sección (`h2`: «Explorar», «Filtros», «Modelos»; `paginas-catalogo.md`) |
| `--text-card-title` | 1.125rem / 1.5rem | 600 | Modelo en la tarjeta (`h3` en todas las páginas del catálogo, `paginas-catalogo.md`) |
| `--text-group` | 1rem / 1.5rem | 600 | Título de grupo de la franja «Explorar» (`h3`) |
| `--text-price` | 1.25rem / 1.75rem | 700 | Precio desde |
| `--text-body` | 1rem / 1.5rem | 400 | Texto general, controles, botones |
| `--text-small` | 0.875rem / 1.25rem | 400 | Marca, datos, ayudas, atribución |
| `--text-badge` | 0.875rem / 1.25rem | 600 | Etiquetas |

Mínimo absoluto 14 px (0,875 rem): ningún texto por debajo.

## Espaciado

Escala de 4 px (la de Tailwind, `--spacing: 0.25rem`); solo se usan estos pasos:
`1` (4), `2` (8), `3` (12), `4` (16), `6` (24), `8` (32).
- Relleno interior de tarjeta: `4`. Separación entre elementos dentro de la tarjeta: `2`. Entre imagen y texto: `3`.
- Separación entre tarjetas: `4` en móvil, `6` en escritorio.
- Relleno del panel de filtros: `4`. Separación entre grupos de filtros: `6`; dentro de un grupo, `2`.

## Anchos de página (`paginas-catalogo.md`)

Van en `@theme` como `--container-*` si el Desarrollador prefiere las utilidades `max-w-*` de Tailwind 4; el
nombre de diseño es este.

| Token | Valor | Uso |
|---|---|---|
| `--width-page` | `80rem` | Ancho máximo del contenido de la página, centrado |
| `--width-prose` | `40rem` | Ancho máximo del texto de entrada, para que la línea se lea bien |
| `--width-filters` | `16rem` | Columna del panel de filtros en `lg` (el valor que ya fijaba `filtros-catalogo.md`) |
| `--width-explore-label` | `8rem` | Columna del título de cada grupo de «Explorar» desde `md` |

Márgenes laterales de página: paso `4` en móvil, `6` en `md`, `8` en `lg`. Entre bloques de página: `8`.

## Tamaño táctil y foco

- **Zona interactiva mínima 44 × 44 px.** WCAG 2.1 AA no fija tamaño (el 2.5.5 de 44 px es AAA y el 2.5.8
  de 24 px es de 2.2); se toma 44 como decisión de diseño por el uso en móvil. Token: `--size-touch: 2.75rem`,
  aplicado como `min-height` (y `min-width` en botones de icono), **nunca como `height` fija**, para que el texto
  pueda crecer (WCAG 1.4.4) y aguantar el espaciado de texto ampliado (WCAG 1.4.12). Se aplica a: botones,
  chips, `<select>`, campos, cada fila de casilla o radio (la etiqueta entera es la zona), cada enlace de
  «Explorar» (bloque con relleno), «Saltar a los resultados» y la tarjeta entera.
- **Foco visible (WCAG 2.4.7)**: anillo `outline` de `--size-focus-ring: 3px` en `brand-600` con
  `--size-focus-offset: 2px` de separación (`outline-offset`), no `box-shadow`, para que se conserve en modo de
  colores forzados. Contraste del anillo: 6,67 sobre `surface`, 6,06 sobre `surface-muted` (≥ 3, WCAG 1.4.11).
  Sobre el botón principal (`brand-600`) el anillo se distingue gracias a la separación, que deja ver el fondo
  de la página. Solo con `:focus-visible`; nunca `outline: none` sin sustituto.
- **Sin contenido en hover**: no hay *tooltips* ni nada que aparezca solo al pasar el ratón (evita WCAG 1.4.13).
- **Radios**: `--radius-card: 0.5rem`, `--radius-control: 0.375rem`, etiquetas `9999px`.
- **Movimiento**: sin animaciones necesarias. Si hay transición, se anula con `prefers-reduced-motion`.

## Silueta de segmento (RF-8, CA-17)

Cuando un modelo no tiene ninguna imagen con `license` válida (`data-model.md`), el hueco 16:9 de la
tarjeta (`tarjeta-modelo.md`) en `surface-muted` no queda vacío: lleva un icono de silueta, cuadrado y
centrado en ambos ejes del hueco.

| Token | Valor | Uso |
|---|---|---|
| `--size-segment-icon` | `3rem` (48 px) | Lado del icono de silueta dentro del hueco 16:9, en cualquier anchura de tarjeta |

El dibujo de cada silueta —una por cada uno de los diez segmentos de RF-11, más una genérica de coche
para cuando tampoco hay segmento— **no se especifica en este documento**: queda para una tarea de diseño
aparte. El icono es decorativo (`aria-hidden`, sin `alt`): su trazo puede usar `--color-line`, sin
necesidad de contraste mínimo.

## Breakpoints
Los de Tailwind: móvil por defecto; `md` = 768 px; `lg` = 1024 px. Diseño móvil primero.

## Pendientes (no se deciden en diseño)
1. **Verificar las ratios con herramienta.** Están calculadas a mano (sin ejecutar nada en esta revisión);
   el Desarrollador las confirma y axe en CI (ADR-0006) las vigila. Ninguna está a menos de 0,4 de su umbral.
2. **Modo de colores forzados** (Windows): las etiquetas pierden su fondo y el borde de tarjeta pasa a
   `CanvasText`; se espera que siga legible porque todo se dice con texto, pero hay que probarlo en un
   navegador real, no se puede comprobar en papel.
3. **Silueta de segmento**: su dibujo sigue pendiente de una tarea aparte; es decorativa y no tiene requisito
   de contraste.
