# Propuesta B · «Cifra»

**Idea.** El número es la imagen (PRD-002, RF-18). Una sola familia, Archivo, en sus dos extremos: nombres muy anchos
(`font-stretch: 125%`) y cifras muy estrechas (62 %), que caben enormes en móvil. En el catálogo cada modelo es una fila
entera; en la ficha, bloques de cifras con la foto como un bloque más. Un único color, «voltio»: una vez por pantalla.

| | Móvil | Escritorio |
|---|---|---|
| Catálogo | [390](refs/catalogo-b-390.png) | [1280](refs/catalogo-b-1280.png) |
| Ficha | [390](refs/ficha-b-390.png) | [1280](refs/ficha-b-1280.png) |

**Fotos malas.** No se tratan: se quitan de delante. A tamaño medio, detrás de las cifras, una foto de feria (Cupra Raval)
pesa poco y una buena (Renault 5) luce sin más. Sin foto, la silueta en un hueco blanco del mismo tamaño: la fila no cambia.

**«Por confirmar».** Dos líneas apiladas que ocupan la altura de la cifra, en `ink-600`: la retícula no salta (RF-11).
Fuente y fecha siguen junto al precio, y el resto con su `[n]` (RF-9); la atribución, bajo la foto (ADR-0012).

**Menú (RF-17, CA-21).** Píldora fija abajo, solo anclas. Marca la sección con `:target`, sin JavaScript, y si son muchas
secciones se desplaza en horizontal. La captura de página entera la pinta a 900 px, sobre la foto: es el borde inferior de
la primera pantalla, no su sitio en la página.

**Tokens** (`web/design-proto/propuesta-b.css`). Nuevos: `--color-volt`, `--radius-block` (1,5 rem), `--text-cifra-{xl,l,m,s}`,
`--text-nombre-{xl,l}`. `--font-sans` pasa a Archivo. Cambian de valor:

| Par | Valores | Ratio (mínimo) |
|---|---|---|
| `ink-900` sobre `surface` / `surface-muted` / `volt` | `#0f100d` / `#ffffff`, `#f2f2ee`, `#d6f54a` | 19,07 / 17,00 / 15,46 (4,5) |
| `ink-600` sobre `surface` / `surface-muted` / `volt` | `#55574f` | 7,34 / 6,54 / 5,95 (4,5) |
| `brand-800` (hover) sobre `surface` / `surface-muted` | `#3f4138` | 10,38 / 9,25 (4,5) |
| `line` sobre `surface` / `surface-muted` | `#75776e` | 4,55 / 4,05 (3) |
| Menú: `surface` y foco `volt` sobre `ink-900`; activo `ink-900` sobre `volt` | | 19,07; 15,46; 15,46 (4,5 / 3) |

`line-soft` (`#deded8`) solo decora. `brand-600` pasa a `#0f100d`: enlaces y foco en tinta, siempre subrayados. Ratios a mano.

**Lo que se pierde o cambia.**
- En móvil la foto es pequeña (unos 150 × 85 px): cuando lleguen fotos buenas, seguirá sin lucirlas. Es la que menos gana con ellas.
- La ficha pone las cifras antes que la foto y sustituye la tabla de versiones por filas: si se elige, hay que cambiar el orden
  de `ficha-modelo.md`. Cada fila se compara peor que una tabla cuando hay muchas versiones (Taycan tiene más de veinte).
- Cifras tan grandes llenan la pantalla: caben pocos modelos a la vista. Catálogo menos denso que C.
- Textos nuevos del menú: «Cifras», «Datos» y «Secciones de la ficha» (`aria-label`).
