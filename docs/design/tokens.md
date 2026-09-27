# Tokens de diseño

Un solo tema, claro (ADR-0005: sin tema oscuro). Los nombres son variables de tema de Tailwind 4
(`@theme` en `web/src/styles/global.css`): `--color-ink-900` da `text-ink-900`, `bg-ink-900`, etc.
Los componentes citan el token, nunca el valor. Ámbito: tarjeta y filtros de PRD-001 (`tarjeta-modelo.md`,
`filtros-catalogo.md`), con los nombres de campo del esquema único de `docs/architecture/data-model.md`
(ADR-0008); se amplía cuando otra pantalla lo pida.

## Color

| Token | Valor | Uso |
|---|---|---|
| `--color-surface` | `#ffffff` | Fondo de página, tarjeta, campos |
| `--color-surface-muted` | `#f3f4f6` | Fondo del panel de filtros, hueco de imagen |
| `--color-ink-900` | `#111827` | Texto principal, título, precio |
| `--color-ink-600` | `#4b5563` | Texto secundario (marca, datos, atribución, ayudas, «por confirmar») |
| `--color-line` | `#6b7280` | Borde de controles (casillas, selectores, botones secundarios); trazo del icono de silueta |
| `--color-line-soft` | `#d1d5db` | Borde de tarjeta. **Solo decorativo**: nada depende de verlo |
| `--color-brand-600` | `#0b5cad` | Enlaces, foco, botón principal, control activo |
| `--color-brand-800` | `#084785` | Hover/pulsado del botón principal y de enlaces |
| `--color-on-brand` | `#ffffff` | Texto sobre `brand-600` / `brand-800` |
| `--color-soon-bg` / `--color-soon-fg` | `#111827` / `#ffffff` | Etiqueta «Próximamente» (`status: announced`) |
| `--color-deal-bg` / `--color-deal-fg` | `#fef3c7` / `#78350f` | Etiqueta «Precio con oferta» (`price_kind: financed`) |
| `--color-discontinued-bg` / `--color-discontinued-fg` | `#e5e7eb` / `#374151` | Etiqueta «Descatalogado» (`status: discontinued`, RF-7, CA-14) |

No hay color de error: los estados vacío y de dato ausente son informativos, se dicen con texto.
El significado nunca va solo en el color (WCAG 1.4.1): cada etiqueta lleva su texto.

## Contraste (WCAG 2.1 AA, RNF-3)

Calculado con la fórmula de luminancia relativa de WCAG. Los que llevan «≈» los he hecho a mano; **el
Desarrollador debe comprobarlos con una herramienta** y axe en CI (ADR-0006) es la red final.
Umbrales: texto normal ≥ 4,5; texto grande (≥ 24 px, o ≥ 18,66 px en negrita) y componentes de interfaz
o foco ≥ 3.

| Par (texto/elemento sobre fondo) | Ratio | Umbral | Resultado |
|---|---|---|---|
| `ink-900` sobre `surface` | 17,7 | 4,5 | Cumple |
| `ink-900` sobre `surface-muted` | ≈ 16,1 | 4,5 | Cumple |
| `ink-600` sobre `surface` | 7,56 | 4,5 | Cumple |
| `ink-600` sobre `surface-muted` | ≈ 6,9 | 4,5 | Cumple |
| `brand-600` sobre `surface` (enlace, foco) | ≈ 6,7 | 4,5 / 3 | Cumple |
| `brand-600` sobre `surface-muted` (foco en panel) | ≈ 6,1 | 3 | Cumple |
| `on-brand` sobre `brand-600` (botón) | ≈ 6,7 | 4,5 | Cumple |
| `on-brand` sobre `brand-800` (botón hover) | ≈ 9,3 | 4,5 | Cumple |
| `soon-fg` sobre `soon-bg` | 17,7 | 4,5 | Cumple |
| `deal-fg` sobre `deal-bg` | ≈ 8,1 | 4,5 | Cumple |
| `discontinued-fg` sobre `discontinued-bg` | ≈ 8,3 | 4,5 | Cumple |
| `line` sobre `surface` (borde de control) | 4,83 | 3 | Cumple |
| `line` sobre `surface-muted` (borde de control en panel) | ≈ 4,4 | 3 | Cumple (no vale para texto: no usarlo como texto) |
| `line-soft` sobre `surface` | ≈ 1,5 | — | No se exige: solo decora |

Regla: `line` no se usa nunca para texto.

## Tipografía

Pila del sistema, sin fuentes web: cero peticiones y cero salto de texto (RNF-2).
`--font-sans`: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Base 16 px. Los tamaños en `rem`
para que respeten el ajuste del navegador (WCAG 1.4.4); nada de `px` fijos en texto.

| Token | Tamaño / interlínea | Peso | Uso |
|---|---|---|---|
| `--text-title` | 1.5rem / 2rem | 700 | Título de página (`h1`) |
| `--text-card-title` | 1.125rem / 1.5rem | 600 | Modelo en la tarjeta (`h2`/`h3` según página) |
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

## Tamaño táctil y foco

- **Zona interactiva mínima 44 × 44 px** (más que los 24 px de WCAG 2.5.8, que es 2.2 y no exigible; se
  toma 44 por uso en móvil). Token: `--size-touch: 2.75rem`. Casillas y radios: la etiqueta entera es la zona.
- **Foco visible**: anillo de 3 px `brand-600` con separación de 2 px de `surface` (`outline`, no `box-shadow`,
  para que respete el modo de alto contraste). Nunca `outline: none` sin sustituto.
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
