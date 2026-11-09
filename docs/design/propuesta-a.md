# Propuesta A · «Pantalla»: manda la imagen (dirección elegida)

Es la dirección elegida en [`direccion.md`](direccion.md), «La elegida»: **A con la tipografía y el bloque de versión de
B**. Fuente: **Archivo**, en dos anchuras. Prototipos: `web/design-proto/catalogo-a.astro`, `ficha-a.astro`, `pantalla.css`
(tokens y tratamiento común) y `a/Cifra.astro` (la cifra de B, reproducida). Tokens finales en [`tokens.md`](tokens.md),
«Dirección visual».

| | Móvil (390) | Escritorio (1280) |
|---|---|---|
| Catálogo | [captura](refs/catalogo-a-390.png) | [captura](refs/catalogo-a-1280.png) |
| Ficha | [captura](refs/ficha-a-390.png) | [captura](refs/ficha-a-1280.png) |

**Idea.** Cada modelo es una pantalla a todo el ancho, no una tarjeta en retícula: el nombre enorme encima y dos cifras
debajo. En la ficha, foto y cifras llenan la primera pantalla, y las franjas siguen alternando blanco, oscuro y claro
(RF-18). El menú inferior es una píldora sólida (RF-17).

**Tipografía (de B).** Una familia, dos extremos: nombres y titulares **anchos** (`font-stretch: 125%`, peso 800) y
cifras **estrechas** (62 %, peso 700, `tabular-nums`), con la unidad más pequeña y ancha al lado («446 km»). El texto
corrido, al 100 %. La cifra estrecha deja que el número sea enorme también en móvil: dos por fila a 390 px.

**La cifra.** Número arriba, etiqueta pequeña debajo; en el DOM, `dt` antes que `dd`, para que el lector oiga primero la
etiqueta (RF-18). Su fuente o su marca de nota van con la etiqueta. **«Por confirmar»** ocupa el sitio del número en dos
líneas estrechas que llenan su misma altura: ninguna fila salta y no queda un hueco.

**Versiones (de B).** Cada versión es un bloque, separado por una línea fina, bajo una regla gruesa en `ink-900`:
1. El nombre de la versión, ancho.
2. Autonomía WLTP y precio en cifra estrecha, uno al lado del otro, con su etiqueta, su fuente, «Precio con oferta» y el
   enlace a las condiciones.
3. Una tabla de dos columnas, etiqueta a la izquierda y valor a la derecha: batería, potencia, tracción, carga en CC y en
   CA. «Por confirmar» va en el sitio del valor (`VersionField`, sin cambios).

En móvil, las tres partes se apilan; desde `lg`, van en tres columnas (3 : 5 : 4). Sustituye a la tabla de escritorio y a
la lista apilada de móvil de la primera versión de A: el mismo bloque sirve en las dos. Se toma de B solo eso: ni el
relleno «voltio» ni las tarjetas redondeadas.

**Fotos malas.** Un mismo tratamiento para todas: menos saturación y brillo, un tono frío común y una viñeta que se come
la calle o la feria. En escritorio, la foto del catálogo ocupa el 70 % de la franja y se funde con ella: se ve el coche
entero. **Sin foto:** la franja pasa a clara, con la silueta del segmento grande y fina (ADR-0012).

**Tokens.** Una franja oscura es un ámbito que reasigna `ink-900`, `ink-600` y `brand-600`: los componentes no cambian.
Colores y contrastes, sin cambios respecto a la primera versión de A; tamaños y anchuras nuevos en `tokens.md`.

**Copy nuevo.** `ficha.cifras` «Cifras clave»; `ficha.menu.nombre` «Secciones de la página»;
`ficha.menu.{cifras,versiones,datos,fuentes}`. «Por confirmar» usa la clave que ya existe, `ficha.porConfirmar`, con la
primera letra en mayúscula por CSS.

**Lo que se pierde.**
- Densidad: en móvil caben unas tres pantallas por vista, y comparar de un vistazo cuesta más que en una retícula.
- Las fotos oscurecidas no enseñan bien el color del coche, y la identidad depende de que lleguen fotos mejores.
- Los filtros pasan del panel lateral a una barra superior: `filtros-catalogo.md` tendrá que cambiar.
- En escritorio, las versiones ya no se comparan en columnas, una al lado de otra: se leen de arriba abajo. Comparar es
  cosa del comparador (PRD-003).
- Peso: fotos a todo el ancho y Archivo variable (90 kB en `woff2`, con los dos ejes), por medir con `web/e2e/lcp.spec.ts` (RNF-2).
- Sin JavaScript, el menú no marca la sección en la que estás: el prototipo marca la primera a mano. Marcarla al hacer
  scroll sería una mejora progresiva (RF-17 solo pide las anclas).
