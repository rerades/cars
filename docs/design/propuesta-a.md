# Propuesta A · «Pantalla»: manda la imagen

Responde a [`direccion.md`](direccion.md). Fuente: **Manrope**. Prototipos: `web/design-proto/catalogo-a.astro`, `ficha-a.astro` y
`pantalla.css` (tokens y tratamiento común).

| | Móvil (390) | Escritorio (1280) |
|---|---|---|
| Catálogo | [captura](refs/catalogo-a-390.png) | [captura](refs/catalogo-a-1280.png) |
| Ficha | [captura](refs/ficha-a-390.png) | [captura](refs/ficha-a-1280.png) |

**Idea.** Cada modelo es una pantalla a todo el ancho, no una tarjeta en retícula: el nombre enorme encima y dos cifras
debajo. En la ficha, foto y cifras llenan la primera pantalla, y las franjas siguen alternando blanco, oscuro y claro
(RF-18). El menú inferior es una píldora sólida (RF-17).

**Fotos malas.** Un mismo tratamiento para todas: menos saturación y brillo, un tono frío común y una viñeta que se come
la calle o la feria. En escritorio, la foto del catálogo ocupa el 70 % de la franja y se funde con ella: se ve el coche
entero. **Sin foto:** la franja pasa a clara, con la silueta del segmento grande y fina (ADR-0012). La página gana un
contraste, no un hueco.

**Tokens.** Una franja oscura es un ámbito que reasigna `ink-900`, `ink-600` y `brand-600`: los componentes no cambian.

| Token | Valor | Par | Contraste |
|---|---|---|---|
| `ink-950`, `ink-900` | `#0b1217` | `on-dark` `#ffffff` sobre él | 18,9:1 |
| `on-dark-muted` | `#b9c4ca` | sobre `ink-950` | 10,6:1 |
| `signal`, `soon-bg` | `#c6f24e` | `ink-950` sobre él (activo, «Próximamente») | 14,6:1 |
| `surface-muted` | `#eef1ee` | `ink-900` sobre él | 16,6:1 |
| `ink-600` | `#4a5660` | sobre `surface-muted` / blanco | 6,6:1 / 7,5:1 |
| `brand-600` | `#0a5c6e` | sobre `surface-muted` / blanco | 6,7:1 / 7,6:1 |
| `brand-800` | `#07414e` | sobre `surface-muted` / blanco | 9,8:1 / 11,2:1 |
| velo de texto | `ink-950` al 72 % o más | blanco / `on-dark-muted` sobre el píxel más claro posible | 9,1:1 / 5,1:1 |

Calculados a mano con la fórmula WCAG. El peor caso del velo es un píxel blanco tras `brightness(.86)`. Nuevos, también:
`text-display`, `text-screen`, `text-figure`, `menu-clearance`, `radius-pill`. Zonas táctiles: `--spacing-touch`.

**Copy nuevo.** `cifra.porConfirmar` «Por confirmar»; `ficha.cifras` «Cifras clave»; `ficha.menu.nombre` «Secciones de la
página»; `ficha.menu.{cifras,versiones,datos,fuentes}`.

**Lo que se pierde.**
- Densidad: en móvil caben unas tres pantallas por vista, y comparar de un vistazo cuesta más que en una retícula.
- Las fotos oscurecidas no enseñan bien el color del coche, y la identidad depende de que lleguen fotos mejores.
- Los filtros pasan del panel lateral a una barra superior: `filtros-catalogo.md` tendría que cambiar si gana esta.
- Peso: fotos a todo el ancho y una fuente más, por medir con `web/e2e/lcp.spec.ts` (RNF-2).
- Sin JavaScript, el menú no marca la sección en la que estás: el prototipo marca la primera a mano. Marcarla al hacer
  scroll sería una mejora progresiva (RF-17 solo pide las anclas).
