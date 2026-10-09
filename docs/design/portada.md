# Portada (`/`)

PRD-004: RF-1 a RF-8, RNF-1 a RNF-5; CA-1 a CA-10. Depende de PRD-001 (RF-10, RF-13) y PRD-002 (RF-1).
Tokens: `tokens.md`. Esta especificación cubre **la página entera**: título, texto de entrada, contador, franja
«Explorar», estado vacío, orden de lectura y de foco, y el paso de móvil a escritorio.

Lo que ya está especificado no se repite ni se rediseña aquí:

- La franja «Explorar»: [`paginas-catalogo.md`](paginas-catalogo.md), «Franja Explorar». La portada **la reutiliza
  tal cual** (RF-3, CA-3): mismo componente, mismos grupos, mismo orden, mismos textos y mismas reglas de qué se
  pinta.
- Márgenes, anchos y escala tipográfica: [`paginas-catalogo.md`](paginas-catalogo.md), «Disposición», y
  [`tokens.md`](tokens.md).

La portada es una puerta de entrada (PRD-004 §1): dice qué es la web y lleva al catálogo. No tiene tarjetas ni
ningún dato de coche (RF-5, CA-5), así que no hay atribución de fuentes que diseñar.

## Lo que la portada no tiene (PRD-004 §3 y §8)

Para que nadie lo añada «por completar»: no hay bloque de novedades ni destacados (decisión 2), ni fecha global de
actualización (decisión 3), ni cifras agregadas como «precio medio» o «autonomía máxima» (decisión 4, RF-5), ni
buscador (decisión 5, RF-8), ni formularios, campos, botones de envío, suscripción o contacto (RF-8, CA-8), ni el
aviso «No se pudieron leer N ficheros» (decisión 6, RF-5, CA-5: va al log del build). Tampoco precio, autonomía,
estado, versiones ni `source_id` de ningún modelo (RF-5, CA-5). El borrador actual de `web/src/pages/index.astro`
enseña todo eso y se sustituye entero.

## Estructura

Orden del DOM = orden visual = orden de lectura (WCAG 1.3.2, RNF-3).

1. Cabecera y navegación del sitio (fuera de esta especificación, igual que en `paginas-catalogo.md`).
2. `<main>`:
   1. **`h1`** — el nombre de la web, `sitio.nombre` («siete3») (RF-1, CA-1).
   2. **Texto de entrada** — un párrafo (`<p>`), justo debajo del `h1` (RF-1, RF-7).
   3. **Contador** — «{n} modelos en el catálogo» (`portada.contador`) (RF-1, RF-2).
   4. **Franja «Explorar»** — el `<nav>` de `paginas-catalogo.md` con su `h2`, incluido «Todos los coches» (RF-3).
3. Pie del sitio (fuera de esta especificación).

Sin modelos publicados, 3 y 4 se sustituyen por el aviso de estado vacío (ver «Estados», RF-6).

**Sin enlace «Saltar a los resultados».** En el catálogo apunta al `h2` «Modelos», que en la portada no existe.
Aquí el contenido empieza en el `h1`, justo después de la cabecera, y la franja «Explorar» es un landmark `nav` con
nombre y un `h2`: con eso basta para saltar bloques (WCAG 2.4.1, técnicas ARIA11 y H69; RNF-3). Si la cabecera del
sitio lleva un «Saltar al contenido» común, se aplica aquí igual; no es de esta especificación.

### Jerarquía de encabezados (RNF-3)
- `h1`: «siete3». **Uno solo** (CA-1).
- `h2`: «Explorar» (`explorar.titulo`). Es el único `h2` de la página.
- `h3`: los grupos de la franja (Marcas, Segmentos, Precio, Autonomía).
- Sin saltos de nivel. En el estado vacío solo hay `h1`: el aviso es un párrafo, no un encabezado.

### Contador (RF-1, RF-2, CA-2)
- Cuenta los modelos que tienen tarjeta en `/coches`, de los tres estados, sin los de `needs_review: true`
  (PRD-001, RF-13). **Debe salir del mismo cálculo** que la lista de `/coches`, no de un recuento propio, para que
  CA-2 («coincide con el número de tarjetas de `/coches`») no pueda romperse.
- Texto `portada.contador`, con plural: «36 modelos en el catálogo», «1 modelo en el catálogo». Número en formato
  `es-ES` (con punto de miles si algún día pasa de 999).
- No lleva fuente ni fecha: es un recuento del propio catálogo, no un dato de un coche (RF-2).
- Es un `<p>` normal ya escrito en el HTML (RNF-1, CA-9), `text-body`, `ink-600`, igual que el de las páginas del
  catálogo. Sin `role="status"`: no cambia nunca.
- **No es un enlace**: el camino a `/coches` ya es «Todos los coches» en la franja; un segundo enlace al mismo sitio
  sería una parada de foco repetida.
- Con 0 modelos **no se pinta** (RF-6, CA-6): ni «0 modelos» ni «Ningún modelo». Lo sustituye el aviso.
- Diferencia con `resumen.n` de `paginas-catalogo.md` («6 modelos»): en la portada no hay lista debajo a la que
  el número se refiera, así que dice de qué es el número («en el catálogo»).

### Franja «Explorar» (RF-3, CA-3)
Exactamente la de `paginas-catalogo.md`. Lo único propio de la portada:

- **«Todos los coches» sí aparece** (en `/coches` no aparece porque es la página actual). Enlaza a `/coches`
  (RF-3, CA-3).
- **Ningún enlace lleva `aria-current`**: la portada no es ninguna de las páginas enlazadas.
- Si ningún modelo publicado tiene `segment`, el grupo «Segmentos» no se pinta (regla ya fijada en
  `paginas-catalogo.md`). Marcas, Precio y Autonomía siempre están si
  hay al menos un modelo: las marcas porque cada modelo tiene la suya, los tramos porque sus cinco páginas existen
  siempre (PRD-001, CA-12a).
- Con 0 modelos **la franja no se pinta entera**, ni su `h2` ni «Todos los coches» (RF-6, CA-6: «no hay franja
  Explorar»).

Rutas que garantiza (RF-4, CA-4, objetivo de PRD-004 §2):
- Cualquier página del catálogo: 1 interacción (un enlace de la franja).
- Cualquier ficha: 2 interacciones, portada → «Marcas» → `/marcas/{marca}` → tarjeta → ficha.
- Todo sin JavaScript: son enlaces `<a href>`.

## Disposición

Mismos márgenes y anchos que `paginas-catalogo.md`: contenido centrado con ancho máximo `--width-page`; márgenes
laterales `4` en móvil, `6` en `md`, `8` en `lg`. Una sola columna en todas las anchuras. Separaciones verticales:
`2` entre `h1` y texto de entrada; `3` entre entrada y contador; `8` entre contador y «Explorar».

Las cifras y marcas del wireframe son de ejemplo (`data/raw/` tiene hoy modelos de diez marcas); en el build salen
del catálogo.

```
Móvil (320–767 px)               Escritorio (≥ 1024 px)
┌─────────────────────────┐      ┌─────────────────────────────────────────────┐
│ [cabecera del sitio]    │      │ [cabecera del sitio]                        │
│                         │      │                                             │
│ h1 siete3               │      │ h1 siete3                                   │
│ Una referencia de los   │      │ Una referencia de los coches eléctricos     │
│ coches eléctricos que   │      │ que se venden en Europa, con foco en        │
│ se venden en Europa,…   │      │ España. Para cada modelo, el precio…        │
│ 36 modelos en el        │      │ 36 modelos en el catálogo                   │
│ catálogo                │      │                                             │
│                         │      │ Explorar                                    │
│ Explorar                │      │ Marcas     BMW · BYD · Cupra · Hyundai · …  │
│ Marcas                  │      │ Precio     Hasta 30.000 € · …               │
│ BMW · BYD · Cupra ·     │      │ Autonomía  Más de 400 km · Más de 500 km    │
│ Hyundai · Kia · …       │      │ Todos los coches                            │
│ Precio                  │      │                                             │
│ Hasta 30.000 € · …      │      │ [pie del sitio]                             │
│ Autonomía               │      └─────────────────────────────────────────────┘
│ Más de 400 km · …       │
│ Todos los coches        │
│                         │
│ [pie del sitio]         │
└─────────────────────────┘
```

- El texto de entrada, como en el catálogo: `text-body`, `ink-900`, ancho máximo `--width-prose`.
- La franja pasa de grupos apilados (móvil) a filas con el `h3` en `--width-explore-label` (`md` en adelante), como
  ya dice `paginas-catalogo.md`.
- **320 px sin scroll horizontal (WCAG 1.4.10, RNF-3):** quedan 288 px útiles con margen `4`. Los enlaces de la
  franja parten línea; el `h1` y el texto de entrada fluyen con `overflow-wrap: anywhere`. Nada tiene ancho fijo
  mayor que eso (`--width-explore-label` solo actúa desde `md`).
- **LCP (RNF-2):** el elemento más grande es texto (el `h1` o el párrafo de entrada). Sin imágenes, sin JS y sin
  fuentes que bloqueen: nada que diseñar aparte.

## Estados

| Situación | Qué se ve | Requisito |
|---|---|---|
| Con modelos publicados | `h1`, entrada, contador con su número y franja «Explorar» completa | RF-1, RF-2, RF-3 |
| Un solo modelo | Igual, contador en singular «1 modelo en el catálogo»; «Marcas» con un enlace | RF-2 |
| Sin segmentos confirmados | La franja sin el grupo «Segmentos» | RF-3 |
| **Sin ningún modelo publicado** (vacío, o todos con `needs_review: true`) | `h1`, entrada y el aviso de estado vacío. **Sin contador, sin franja «Explorar» y sin ningún enlace a páginas del catálogo** | RF-6, CA-6 |
| Ficheros de `data/` que no se pueden leer | Nada visible para el visitante: el aviso va al log del build (ADR-0010). La portada cuenta los modelos que sí se leyeron | RF-5, decisión 6, CA-5 |
| Modelos con datos ausentes | Sin efecto: la portada no muestra datos de coche. Cuentan en el contador si tienen tarjeta en `/coches` | RF-2, RF-5 |
| Sin JS | Igual que con JS: la página no usa JavaScript | RNF-1, CA-9 |
| Cargando | No hay: todo va en el HTML | RNF-1 |
| Error | No hay estado de error en la página: un build sin modelos es el estado vacío, no un error (CA-6: «la página no da error») | RF-6 |

### Estado vacío (RF-6, CA-6)

```
siete3                                              ← h1
Una referencia de los coches eléctricos…            ← texto de entrada (el mismo)
Todavía no hay ningún modelo en el catálogo.        ← aviso, text-body ink-900
```

- Componente Empty de Bearnie (ADR-0005), el mismo que usa `paginas-catalogo.md`, en `surface` y sin caja, a `3`
  del texto de entrada (ocupa el sitio del contador).
- Texto: reutiliza `vacio.catalogo.texto` («Todavía no hay ningún modelo en el catálogo.»), el mismo que `/coches`
  con el catálogo vacío, para que el sitio diga lo mismo en los dos sitios.
- **Sin enlace de salida**: a diferencia del estado vacío de tramo, aquí no hay ninguna página con modelos a la que
  mandar, y RF-6 pide no dejar enlaces a páginas vacías o inexistentes.
- Es un `<p>` estático, sin `role="status"` ni `role="alert"`: no es reacción a nada y no es un error.

### Texto muy largo
- `h1`: «siete3» es corto. Si `sitio.nombre` cambia a uno largo, parte línea, sin recortar ni reducir tamaño.
- Texto de entrada: fluye en las líneas que haga falta dentro de `--width-prose`.
- Marcas de nombre largo en la franja: ya resuelto en `paginas-catalogo.md` (los enlaces parten línea).
- Contador con un número de cuatro cifras: cabe a 320 px («1.234 modelos en el catálogo» parte línea si hace falta).

## Accesibilidad (RNF-3, WCAG 2.1 AA)

### Orden de foco
1. Navegación del sitio (fuera de esta especificación).
2. Enlaces de «Explorar», grupo a grupo y de izquierda a derecha: Marcas, (Segmentos), Precio, Autonomía; al
   final, «Todos los coches».

El `h1`, el texto de entrada, el contador y el `h2` no son paradas de foco. En el estado vacío no hay ninguna
parada dentro de `<main>`. Anillo de foco: el de `tokens.md` («Tamaño táctil y foco»).

### Zonas táctiles
Las de la franja: `--size-touch` de alto en cada enlace, ya fijado en `paginas-catalogo.md`. No hay otros elementos
interactivos.

### Lector de pantalla
Lo que oye alguien que recorre la portada de arriba abajo:
1. «siete3, encabezado nivel 1.»
2. El texto de entrada. «36 modelos en el catálogo.»
3. «Explorar, navegación.» «Explorar, encabezado nivel 2.» «Marcas, encabezado nivel 3», «lista, 10 elementos»,
   «BMW, enlace»… «Precio, encabezado nivel 3»… «Todos los coches, enlace».

En el estado vacío: «siete3, encabezado nivel 1», el texto de entrada y «Todavía no hay ningún modelo en el
catálogo.»

Landmarks: `main` y `nav` «Explorar» (con `aria-labelledby` a su `h2`, que lo distingue de la navegación del
sitio). `<html lang="es">`.

### Contraste
No hay pares de color nuevos. Los que usa, ya calculados en `tokens.md`:

| Par | Ratio | Umbral | Uso aquí |
|---|---|---|---|
| `ink-900` sobre `surface` | 17,74 | 4,5 | `h1`, texto de entrada, `h2`/`h3` de la franja, aviso vacío |
| `ink-600` sobre `surface` | 7,56 | 4,5 | Contador |
| `brand-600` sobre `surface` | 6,67 | 4,5 / 3 | Enlaces de la franja, anillo de foco |
| `brand-800` sobre `surface` | 9,33 | 4,5 | Enlaces en hover |
| `brand-600` frente a `ink-900` | 2,66 | 3 | No cumple como única distinción → enlaces **subrayados** siempre (ya en `tokens.md`) |

## Títulos y textos (RF-1, RF-7, decisión 7; RNF-4)

Condiciones (RF-1, RF-7, CA-1, CA-7): el `h1` es el nombre de la web; el texto de entrada dice qué es (referencia de
coches eléctricos comercializados en Europa, con foco en España), menciona coches eléctricos y no coincide con el
de ninguna otra página; el título de página tampoco. Y, como en `paginas-catalogo.md`, no afirma nada sobre coches
concretos ni lleva cifras de datos (ADR-0001, RF-5).

### `<title>` del documento
El resto del sitio usa `pagina.tituloDocumento` («{titulo} · {sitio}»). En la portada el `h1` ya es el nombre del
sitio, y ese patrón daría «siete3 · siete3». La portada usa su propia clave, con el nombre delante:

| Clave | Texto |
|---|---|
| `pagina.portada.tituloDocumento` | siete3 · Coches eléctricos en Europa y España |

No coincide con ningún otro: los del catálogo terminan en «· siete3» y empiezan por su `h1` («Coches eléctricos ·
siete3» en `/coches`). CA-7 se comprueba en el build comparando los `<title>` de todas las páginas, igual que
CA-12b de PRD-001.

### Texto de entrada

| Clave | Texto |
|---|---|
| `pagina.portada.entrada` | Una referencia de los coches eléctricos que se venden en Europa, con foco en España. Para cada modelo, el precio de la marca en España sin ayudas y la autonomía WLTP, cada dato con su fuente y su fecha. |

Por qué así: la primera frase es lo que pide RF-1 casi literal; la segunda dice qué va a encontrar quien entra, con
las dos condiciones que más confunden (precio sin ayudas, PRD-001 §6; autonomía homologada) y el principio 0 de la
visión (fuente y fecha), sin dar ninguna cifra. No coincide con `pagina.coches.entrada` ni con ninguna otra de
`paginas-catalogo.md` (CA-7).

## Copy (RNF-4: claves para i18n, sin textos fijos en los componentes)

Claves nuevas:

| Clave | Texto |
|---|---|
| `pagina.portada.tituloDocumento` | siete3 · Coches eléctricos en Europa y España |
| `pagina.portada.entrada` | (ver «Texto de entrada») |
| `portada.contador` | {n} modelos en el catálogo · singular: 1 modelo en el catálogo |

Claves que reutiliza, sin cambiarlas:

| Clave | Texto | Dónde está |
|---|---|---|
| `sitio.nombre` | siete3 | `paginas-catalogo.md` (`h1` de la portada) |
| `explorar.*` | Explorar, Marcas, Segmentos, Precio, Autonomía, los tramos, Todos los coches | `paginas-catalogo.md` |
| `vacio.catalogo.texto` | Todavía no hay ningún modelo en el catálogo. | `paginas-catalogo.md` (aviso vacío) |

El plural de `portada.contador` se resuelve con la regla de plural de `es` (`Intl.PluralRules`), no con un `if`
sobre el texto; el `0` no llega nunca a esta clave (estado vacío).

## Tokens que usa

Color: `surface`, `ink-900`, `ink-600`, `brand-600`, `brand-800`. Tipografía: `--text-title` (`h1`),
`--text-section` (`h2` «Explorar»), `--text-group` (`h3`), `--text-body`. Medidas: `--width-page`, `--width-prose`,
`--width-explore-label`, `--size-touch`. **Ningún token nuevo** y ningún par de color nuevo.

## Preguntas abiertas para Producto

1. **`h1` solo con el nombre.** RF-1 y CA-1 piden «un `h1` con el nombre de la web»; aquí el `h1` es solo
   «siete3» y lo que la web es va en el texto de entrada. ¿Se quiere el `h1` con algo más («siete3: coches
   eléctricos en España»)? Daría más contexto al buscador y al lector de pantalla, pero el nombre ya no sería el
   `h1` entero. No se especifica sin confirmarlo.
2. **«Saltar al contenido» en la cabecera del sitio.** La cabecera no está especificada en ningún diseño ni PRD; la
   portada no necesita el «Saltar a los resultados» del catálogo, pero un salto común a `<main>` en todas las
   páginas sería coherente. ¿Lo especifica quien diseñe la cabecera?
3. **El nombre «siete3» en la cabecera y en el `h1` a la vez.** Si la cabecera del sitio también muestra el nombre
   (con enlace a `/`), en la portada se lee dos veces seguidas. Depende de cómo se diseñe la cabecera, que no está
   en este PRD.
