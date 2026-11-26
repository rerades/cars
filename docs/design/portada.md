# Portada (`/`)

PRD-004: RF-1 a RF-9, RNF-1 a RNF-5; CA-1 a CA-11. Depende de PRD-001 (RF-1, RF-7, RF-10, RF-13) y PRD-002 (RF-1).
Tokens: `tokens.md`. Esta especificación cubre **la página entera**: título, texto de entrada, contador, franja
«Explorar», estado vacío, orden de lectura y de foco, y el paso de móvil a escritorio.

Lo que ya está especificado no se repite ni se rediseña aquí:

- La franja «Explorar»: [`paginas-catalogo.md`](paginas-catalogo.md), «Franja Explorar». La portada **la reutiliza
  tal cual** (RF-3, CA-3): mismo componente, mismos grupos, mismo orden, mismos textos y mismas reglas de qué se
  pinta.
- Márgenes, anchos y escala tipográfica: [`paginas-catalogo.md`](paginas-catalogo.md), «Disposición», y
  [`tokens.md`](tokens.md).

La portada es una puerta de entrada (PRD-004 §1): dice qué es la web y lleva al catálogo. Fuera del bloque
«Próximamente» no tiene tarjetas ni ningún dato de coche (RF-5, CA-5). Las tarjetas del bloque son las del catálogo y
traen ya su presentación, sus «por confirmar» y su atribución de foto (`tarjeta-modelo.md`): la portada no añade
ninguna atribución propia.

## Bloque «Próximamente» (RF-9, CA-11)

Añadido a PRD-004 el 2026-11-25; diseñado el 2026-11-26 en la dirección «Pantalla» (`direccion.md`, «La elegida»).
Prototipo `web/design-proto/portada-proximamente.astro`, con datos y componentes reales (`ModelCard`, `ExploreStrip`,
`loadModels`); capturas [`refs/portada-proximamente-390.png`](refs/portada-proximamente-390.png) y
[`refs/portada-proximamente-1280.png`](refs/portada-proximamente-1280.png). Hoy salen dos tarjetas: Mercedes-Benz GLA y
smart #2 (el Audi A2 e-tron también está anunciado, pero lleva `needs_review: true` y no sale, PRD-001 RF-13).

### Qué es
- Una `<section aria-labelledby="proximamente">` dentro de `<main>`, **después de la cabecera y antes de «Explorar»**
  (RF-9). Si no hay ningún modelo publicado en estado `announced`, **no se pinta nada**: ni la sección, ni su `h2`, ni
  su texto, ni la lista vacía (RF-9, CA-11). Tampoco en el estado vacío de la portada (RF-6): sin modelos publicados
  no puede haber próximamente.
- Las tarjetas son **la tarjeta de PRD-001 (RF-1) tal cual**, el componente `ModelCard` de `web/src/`, con las mismas
  props que en el catálogo (`card` de `cardView`, `href` `/marcas/{marca}/{modelo}/`) y sin `facts` (aquí no hay
  filtros). **Sin variantes** (RF-5, RF-9, CA-11: «iguales a las de esos modelos en `/coches`»): misma etiqueta
  «Próximamente · {mes} de {año}» o «Próximamente», mismas cifras, mismos «por confirmar», mismo «Comparar» si el
  modelo es comparable, misma atribución de foto. La portada solo decide **dónde** se colocan.

### Orden (RF-9, CA-11)
1. Con `launch`: de la fecha prevista más cercana a la más lejana (`2026-12` antes que `2027-03`). Se compara por año y
   mes (`launchKey` de `sort.ts`), también si `launch` trae día.
2. Sin `launch`: al final, por marca y, dentro de la marca, por modelo, con `localeCompare` de `es` sin distinguir
   mayúsculas («Mercedes-Benz» antes que «smart»).

**No es el orden «Novedad»** de `/coches` (`sortByNovelty`, la más reciente primero y desempate solo por modelo): hace
falta un comparador propio, ascendente y con desempate por marca. El prototipo lo escribe (`byLaunch`); en `web/src/`
va en `lib/`, con su prueba sobre el caso de CA-11 (2027-03, 2026-12, sin fecha → 2026-12, 2027-03, sin fecha).

Hoy: GLA y #2 no tienen `launch`, así que van por marca: Mercedes-Benz GLA, smart #2.

### Encabezado del bloque
- **`h2` «Próximamente»** (`portada.proximamente.titulo`), con el mismo estilo que el `h2` «Explorar» de la franja:
  `--text-block`, peso 700, `--font-stretch-wide`, interlineado 0,98, `overflow-wrap: anywhere`. Los dos `h2` de la
  portada se ven iguales: son los dos bloques de la página.
- **Texto del bloque**, un `<p>` justo debajo (`portada.proximamente.entrada`): «Modelos anunciados que aún no están a
  la venta en España. Primero, los que llegan antes.» Dice qué es el bloque y en qué orden va (RF-9) sin dar ninguna
  fecha ni cifra (RF-5). `--text-body`, `ink-600`, ancho máximo `--width-prose`, a `3` del `h2`.
- Va en **franja blanca** (`.band-white`), entre la cabecera oscura y las pantallas: separa el `h1` del primer coche, y
  la alternancia oscuro → blanco → pantallas → blanco («Explorar») es la de la dirección. Márgenes y ancho del
  contenido de la página (`max-w-page`, `px-4` / `md:px-6` / `lg:px-8`); relleno `pt-8` y `pb-6`.
- **Sin contador propio** («2 modelos próximamente»): la lista ya lo anuncia al lector («lista, 2 elementos») y a la
  vista se cuentan solos. Sin enlace «Ver todos»: no existe ninguna página de modelos próximamente (sería alcance nuevo,
  ver «Preguntas abiertas»).

### Cómo se colocan una, dos o muchas tarjetas
La lista es un `<ul aria-labelledby="proximamente">` **a todo el ancho de la ventana**, como la de las páginas
pregeneradas (`paginas-catalogo.md`, «Disposición»), sin márgenes laterales: cada tarjeta es una pantalla. Entre
tarjetas, una junta de `0,25 rem` (`gap-1`) en blanco de la franja, para que dos pantallas del mismo color (dos claras
sin foto, o dos oscuras) no se fundan en una sola.

**Móvil y `md` (< 1024 px)**: una columna, una pantalla debajo de otra, sea cual sea el número. Es lo mismo que el
catálogo a esas anchuras.

**`lg` (≥ 1024 px)**: retícula de **dos columnas** iguales (`grid-template-columns: repeat(2, minmax(0, 1fr))`):

| Tarjetas | Colocación en `lg` |
|---|---|
| 1 | Una sola fila a todo el ancho: la tarjeta pasa a su disposición ancha (foto al 70 %, texto en el 44 %), igual que una pantalla de `/coches` |
| 2 (hoy) | Las dos en la misma fila, mitad y mitad. Cada una, en su disposición estrecha (la de móvil: foto arriba, texto debajo) |
| impar ≥ 3 | La **primera** (el lanzamiento más cercano) ocupa la fila entera, en disposición ancha; el resto, de dos en dos |
| par ≥ 4 | De dos en dos |

Regla CSS, sin JavaScript (ADR-0003): `li:first-child:nth-last-child(odd) { grid-column: 1 / -1 }`. Así ninguna fila
queda con un hueco a la derecha, y el que destaca es el que el orden de RF-9 pone primero, no uno elegido a mano
(PRD-004, decisión 2: sin destacados).

```
lg, 2 tarjetas (hoy)                          lg, 3 tarjetas
┌──────────────────────────────────────┐      ┌──────────────────────────────────────┐
│ [cabecera oscura: h1, entrada, n]    │      │ [cabecera oscura]                    │
├──────────────────────────────────────┤      ├──────────────────────────────────────┤
│ h2 PRÓXIMAMENTE                      │      │ h2 PRÓXIMAMENTE · texto              │
│ Modelos anunciados que aún no…       │      ├──────────────────────────────────────┤
├──────────────────┬┬──────────────────┤      │ 1.ª: pantalla ancha (texto | foto)   │
│ ░ silueta ░      ││ ▓ foto ▓         │      ├──────────────────┬┬──────────────────┤
│ Mercedes-Benz    ││ smart            │      │ 2.ª estrecha     ││ 3.ª estrecha     │
│ GLA              ││ #2               │      └──────────────────┴┴──────────────────┘
│ [Próximamente]   ││ [Próximamente]   │
│ Por conf. 725 km ││ Por conf. 290 km │      Móvil: siempre una columna
│ Comparar         ││ Comparar · Foto… │
├──────────────────┴┴──────────────────┤
│ h2 EXPLORAR …                        │
└──────────────────────────────────────┘
```

Por qué no una pantalla a todo el ancho por modelo, como en `/coches`: en la portada el bloque va **antes** de
«Explorar», que es el camino al catálogo (RF-3, RF-4). Con pantallas de 31,5 rem cada una, dos ya empujan «Explorar»
más de 1.000 px hacia abajo en escritorio; de dos en dos, la mitad. En móvil no hay alternativa sin cambiar la tarjeta
(RF-9: sin variantes) y se acepta.

**Lo hace la tarjeta sola.** `ModelCard` ya decide su disposición por su propio ancho (el `li` es contenedor de tamaño,
`@container (min-width: 64rem)`): a mitad de 1280 px (unos 638 px) se pinta estrecha; a todo el ancho, ancha. La
portada no le pasa ninguna prop nueva ni le sobrescribe estilos.

- **Alto de una fila**: la retícula estira los dos `li` al alto del mayor; el fondo de la franja (oscura o clara) es
  del `li` y llena el hueco. El contenido de la tarjeta más corta queda arriba, sin centrar ni estirar.
- **Alternancia de lados de la foto**: la de la tarjeta (`:nth-child(even)`) solo actúa en la disposición ancha. Con 3
  tarjetas, la primera (impar) lleva la foto a la derecha, como la primera pantalla de `/coches`.
- **Alineación**: el texto de las tarjetas empieza a `1,25 rem` del borde (relleno propio de la tarjeta) y el `h2`, en
  el margen de la página (`2 rem` en `lg`). Es la misma diferencia que ya hay en el catálogo; no se toca la tarjeta.
- **Muchas tarjetas** (10 o más): sin tope ni paginación; RF-9 pide **todas**. Por teclado y lector, «Explorar» se
  alcanza por su landmark `nav` y por encabezados (ver «Accesibilidad»). Si el número crece mucho, ver «Preguntas
  abiertas».

### Estados del bloque

| Situación | Qué se ve | Requisito |
|---|---|---|
| Ningún modelo próximamente (o todos con `needs_review`) | Nada: ni sección, ni `h2`, ni texto. La página sigue con la cabecera y «Explorar» | RF-9, CA-11 |
| Uno | `h2`, texto y una pantalla a todo el ancho (disposición ancha en `lg`) | RF-9 |
| Dos (hoy) | Dos pantallas: una debajo de otra en móvil, lado a lado en `lg` | RF-9 |
| Tres o más | Móvil, en columna; `lg`, la primera a todo el ancho si son impares y el resto de dos en dos | RF-9 |
| Con y sin `launch` mezclados | Primero las fechadas, de la más cercana; después las sin fecha, por marca y modelo | RF-9, CA-11 |
| Sin foto (GLA hoy) | La tarjeta en franja clara con la silueta del segmento, como en el catálogo | PRD-001 RF-8, CA-17 |
| Sin precio, sin segmento (los dos hoy) | «Por confirmar» de la tarjeta, en el sitio de la cifra; no salta la fila | PRD-001 RF-12, CA-9, CA-15 |
| Nombre de modelo largo | Lo resuelve la tarjeta (palabras que bajan enteras); a mitad de ancho cabe igual que a 390 px | `tarjeta-modelo.md` |
| Foto retocada (`edits`) | Coche recortado, como en el catálogo | PRD-001 RF-15 |
| Sin JS | Igual: todo es HTML del build | RNF-1 |

### Lo que no tiene
Ni contador, ni «Ver todos», ni fecha global, ni texto que diga cuándo llega cada uno fuera de la etiqueta de la
tarjeta (RF-5), ni orden distinto del de RF-9, ni ninguna tarjeta que no sea `announced` (aunque sea reciente: las
novedades a la venta siguen fuera, PRD-004 §3).

Lo de abajo («no hay bloque de novedades ni destacados») sigue valiendo para todo lo demás.

## Lo que la portada no tiene (PRD-004 §3 y §8)

Para que nadie lo añada «por completar»: no hay bloque de novedades ni destacados (decisión 2), ni fecha global de
actualización (decisión 3), ni cifras agregadas como «precio medio» o «autonomía máxima» (decisión 4, RF-5), ni
buscador (decisión 5, RF-8), ni formularios, campos, botones de envío, suscripción o contacto (RF-8, CA-8), ni el
aviso «No se pudieron leer N ficheros» (decisión 6, RF-5, CA-5: va al log del build). Tampoco precio, autonomía,
estado, versiones ni `source_id` de ningún modelo **fuera de las tarjetas del bloque «Próximamente»** (RF-5, CA-5). El borrador actual de `web/src/pages/index.astro`
enseña todo eso y se sustituye entero.

## Estructura

Orden del DOM = orden visual = orden de lectura (WCAG 1.3.2, RNF-3).

1. Cabecera y navegación del sitio (fuera de esta especificación, igual que en `paginas-catalogo.md`).
2. `<main>`:
   1. **`h1`** — el nombre de la web, `sitio.nombre` («siete3») (RF-1, CA-1).
   2. **Texto de entrada** — un párrafo (`<p>`), justo debajo del `h1` (RF-1, RF-7).
   3. **Contador** — «{n} modelos en el catálogo» (`portada.contador.one` / `portada.contador.other`, elegidas
      por plural) (RF-1, RF-2).
   4. **Bloque «Próximamente»** — la `<section>` con su `h2`, su texto y la lista de tarjetas, solo si hay algún
      modelo próximamente (RF-9; ver «Bloque «Próximamente»»).
   5. **Franja «Explorar»** — el `<nav>` de `paginas-catalogo.md` con su `h2`, incluido «Todos los coches» (RF-3).
3. Pie del sitio (fuera de esta especificación).

En el HTML de hoy (`index.astro`), `h1`, entrada y contador van en el `<header class="band-dark">`; el bloque y la
franja, en `<main>`. Se mantiene: el bloque es el primer hijo de `<main>`.

Sin modelos publicados, 3, 4 y 5 se sustituyen por el aviso de estado vacío (ver «Estados», RF-6).

**Sin enlace «Saltar a los resultados».** En el catálogo apunta al `h2` «Modelos», que en la portada no existe.
Aquí el contenido empieza en el `h1`, justo después de la cabecera, y la franja «Explorar» es un landmark `nav` con
nombre y un `h2`: con eso basta para saltar bloques (WCAG 2.4.1, técnicas ARIA11 y H69; RNF-3). Si la cabecera del
sitio lleva un «Saltar al contenido» común, se aplica aquí igual; no es de esta especificación.

### Jerarquía de encabezados (RNF-3)
- `h1`: «siete3». **Uno solo** (CA-1).
- `h2`: «Próximamente» (`portada.proximamente.titulo`), solo si hay bloque, y «Explorar» (`explorar.titulo`), en ese
  orden.
- `h3`: bajo «Próximamente», el nombre de cada tarjeta (marca y modelo, el `h3 > a` de `tarjeta-modelo.md`); bajo
  «Explorar», los grupos de la franja (Marcas, Segmentos, Precio, Autonomía).
- Sin saltos de nivel. En el estado vacío solo hay `h1`: el aviso es un párrafo, no un encabezado.

### Contador (RF-1, RF-2, CA-2)
- Cuenta los modelos que tienen tarjeta en `/coches`, de los tres estados, sin los de `needs_review: true`
  (PRD-001, RF-13). **Debe salir del mismo cálculo** que la lista de `/coches`, no de un recuento propio, para que
  CA-2 («coincide con el número de tarjetas de `/coches`») no pueda romperse.
- Texto en dos claves que se eligen por plural con `Intl.PluralRules` de `es` (ver «Textos»):
  `portada.contador.other` («36 modelos en el catálogo») y `portada.contador.one` («1 modelo en el catálogo»). Número en formato
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
- **LCP (RNF-2):** sin bloque «Próximamente», el elemento más grande es texto (el `h1` o el párrafo de entrada). Con
  bloque, la foto de la primera tarjeta puede entrar en la primera pantalla (a 1280 px, sí): esa tarjeta va con
  `eager` (sin `loading="lazy"`) y las demás, perezosas, como en el catálogo (`tarjeta-modelo.md`, «LCP»). Hoy la
  primera es el GLA, sin foto, y `eager` no carga nada.
- **El bloque «Próximamente»** va entre la cabecera y «Explorar»; su disposición, en su sección.

## Estados

| Situación | Qué se ve | Requisito |
|---|---|---|
| Con modelos publicados | `h1`, entrada, contador con su número, bloque «Próximamente» si hay alguno y franja «Explorar» completa | RF-1, RF-2, RF-3, RF-9 |
| Sin modelos próximamente | Igual, sin el bloque ni su `h2` | RF-9, CA-11 |
| Un solo modelo | Igual, contador en singular «1 modelo en el catálogo»; «Marcas» con un enlace | RF-2 |
| Sin segmentos confirmados | La franja sin el grupo «Segmentos» | RF-3 |
| **Sin ningún modelo publicado** (vacío, o todos con `needs_review: true`) | `h1`, entrada y el aviso de estado vacío. **Sin contador, sin franja «Explorar» y sin ningún enlace a páginas del catálogo** | RF-6, CA-6 |
| Ficheros de `data/` que no se pueden leer | Nada visible para el visitante: el aviso va al log del build (ADR-0010). La portada cuenta los modelos que sí se leyeron | RF-5, decisión 6, CA-5 |
| Modelos con datos ausentes | Fuera del bloque, sin efecto. En el bloque, los «por confirmar» y la silueta de la tarjeta. Cuentan en el contador si tienen tarjeta en `/coches` | RF-2, RF-5, RF-9 |
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
2. Si hay bloque «Próximamente», sus tarjetas en el orden de RF-9 (que es el del DOM: en `lg`, fila a fila y de
   izquierda a derecha). Dentro de cada una, las paradas de `tarjeta-modelo.md`: el enlace a la ficha (marca y
   modelo), «Comparar» si el modelo es comparable y la atribución de la foto si la hay. Hoy: «Mercedes-Benz GLA»,
   «Comparar», «smart #2», «Comparar», «Y.Leclercq, CC BY-SA 4.0, vía Wikimedia Commons».
3. Enlaces de «Explorar», grupo a grupo y de izquierda a derecha: Marcas, (Segmentos), Precio, Autonomía; al
   final, «Todos los coches».

La retícula de dos columnas no cambia el orden: el DOM manda y la vista lo sigue (WCAG 1.3.2, 2.4.3). Anillo de foco de
cada tarjeta: el suyo, dentro de la pantalla (`brand-600` en la clara, `on-dark` en la oscura).

El `h1`, el texto de entrada, el contador, los `h2` y el texto del bloque no son paradas de foco. En el estado vacío no hay ninguna
parada dentro de `<main>`. Anillo de foco: el de `tokens.md` («Tamaño táctil y foco»).

### Zonas táctiles
Las de la franja: `--size-touch` de alto en cada enlace, ya fijado en `paginas-catalogo.md`. Las del bloque, las de la
tarjeta: la pantalla entera para la ficha, y `min-h-touch` en «Comparar» y en la atribución. Nada más es interactivo.

### Lector de pantalla
Lo que oye alguien que recorre la portada de arriba abajo:
1. «siete3, encabezado nivel 1.»
2. El texto de entrada. «36 modelos en el catálogo.»
3. Si hay bloque: «Próximamente, encabezado nivel 2.» «Modelos anunciados que aún no están a la venta en España.
   Primero, los que llegan antes.» «Próximamente, lista, 2 elementos.» Cada tarjeta, como dice `tarjeta-modelo.md`:
   «Mercedes-Benz GLA, encabezado nivel 3, enlace», «Segmento por confirmar», «Próximamente», «Precio, Por
   confirmar»… La palabra «Próximamente» se oye en el `h2` y en la etiqueta de cada tarjeta; se acepta: la etiqueta
   es de la tarjeta, que no tiene variantes, y es la que lleva la fecha cuando la hay.
4. «Explorar, navegación.» «Explorar, encabezado nivel 2.» «Marcas, encabezado nivel 3», «lista, 10 elementos»,
   «BMW, enlace»… «Precio, encabezado nivel 3»… «Todos los coches, enlace».

En el estado vacío: «siete3, encabezado nivel 1», el texto de entrada y «Todavía no hay ningún modelo en el
catálogo.»

Landmarks: `main` y `nav` «Explorar» (con `aria-labelledby` a su `h2`, que lo distingue de la navegación del
sitio). La `<section>` del bloque, con `aria-labelledby="proximamente"`, es una región con nombre: quien tenga muchas
tarjetas delante salta a «Explorar» por landmarks o por encabezados, sin recorrerlas (WCAG 2.4.1; RNF-3). Por eso no
se añade un enlace «Saltar a Explorar». `<html lang="es">`.

### Contraste
No hay pares de color nuevos. Los que usa, ya calculados en `tokens.md`:

| Par | Ratio | Umbral | Uso aquí |
|---|---|---|---|
| `ink-900` sobre `surface` | 17,74 | 4,5 | `h2` «Próximamente», `h2`/`h3` de la franja, aviso vacío |
| `ink-600` sobre `surface` | 7,56 | 4,5 | Texto del bloque «Próximamente» |
| `on-dark` / `on-dark-muted` sobre `ink-950` | 18,86 / 10,61 | 4,5 | `h1`, texto de entrada y contador en la cabecera oscura |
| Los de la tarjeta | mínimo 5,1 (texto sobre el velo) | 4,5 | Tarjetas del bloque: sin cambios, `tarjeta-modelo.md` y `tokens.md` |
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
| `portada.contador.one` | {n} modelo en el catálogo |
| `portada.contador.other` | {n} modelos en el catálogo |
| `portada.proximamente.titulo` | Próximamente |
| `portada.proximamente.entrada` | Modelos anunciados que aún no están a la venta en España. Primero, los que llegan antes. |

`portada.proximamente.titulo` es una clave propia aunque diga lo mismo que `tarjeta.estado.proximamente`: una es el
nombre de un bloque y la otra el estado de un modelo, y pueden traducirse distinto. Las tarjetas del bloque usan sus
claves de siempre (`tarjeta.*`, `tarjeta-modelo.md`).

Claves que reutiliza, sin cambiarlas:

| Clave | Texto | Dónde está |
|---|---|---|
| `sitio.nombre` | siete3 | `paginas-catalogo.md` (`h1` de la portada) |
| `explorar.*` | Explorar, Marcas, Segmentos, Precio, Autonomía, los tramos, Todos los coches | `paginas-catalogo.md` |
| `vacio.catalogo.texto` | Todavía no hay ningún modelo en el catálogo. | `paginas-catalogo.md` (aviso vacío) |

El contador usa `portada.contador.one` o `portada.contador.other` según la categoría que devuelve la regla de
plural de `es` (`Intl.PluralRules`) para `{n}` (implementado en #241, `web/src/lib/catalog.ts` e `i18n.ts`), no un
`if` sobre el texto; el `0` no llega nunca a estas claves (estado vacío).

## Tokens que usa

Color: `surface`, `ink-900`, `ink-600`, `ink-950`, `on-dark`, `on-dark-muted`, `brand-600`, `brand-800`, y los de la
tarjeta. Franjas: `.band-dark` (cabecera), `.band-white` (encabezado del bloque y «Explorar»). Tipografía:
`--text-display` (`h1`), `--text-block` y `--font-stretch-wide` (`h2` «Próximamente» y «Explorar»), `--text-small`
(`h3` de la franja), `--text-body`. Medidas: `--container-page`, `--container-prose`, `--width-explore-label`,
`--spacing-touch`, junta `gap-1` (0,25 rem) entre tarjetas. **Ningún token nuevo** y ningún par de color nuevo.

### Nota para el Desarrollador (bloque «Próximamente»)
- Comparador nuevo en `lib/` (ver «Orden»), con prueba del caso de CA-11; no reutilizar `sortByNovelty`.
- Filtrar con `status.value === "announced"` sobre la salida de `loadModels()`, que ya quita `needs_review`: así CA-11
  («iguales a las de esos modelos en `/coches`») sale del mismo cálculo que el catálogo.
- `ModelCard` sin cambios ni props nuevas; `eager` solo en la primera.
- En el prototipo hay un bloque de CSS que devuelve las tarjetas de mitad de ancho a su disposición estrecha: en
  `astro dev` se le cuelan los estilos `is:global` de `catalogo-a.astro`. Es solo del prototipo: en `web/src/` no hace
  falta y no se copia.

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
4. **Tope del bloque «Próximamente».** RF-9 pide todas las tarjetas, sin tope; con 2 está bien, pero con 10 o más en
   móvil «Explorar» queda muy abajo (unas diez pantallas). ¿Se quiere un tope (las N más cercanas) con un enlace a una
   lista de todas? Exigiría una página o un filtro por estado que hoy no existe en ningún PRD. No se especifica sin
   confirmarlo.
