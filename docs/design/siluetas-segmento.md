# Siluetas de segmento

Dibujo de las siluetas que ocupan el hueco de imagen cuando un modelo no tiene ninguna imagen con
`license` (PRD-001, RF-8 y CA-17). Dónde van y a qué tamaño lo dicen `tarjeta-modelo.md` («Imagen y
silueta, sin imagen») y `tokens.md` («Silueta de segmento»); aquí solo se fija **qué se dibuja**.

Son 11: una por cada segmento de RF-11 y una genérica para el modelo sin `segment` (RF-12, CA-15).

## En la dirección visual: la silueta en la pantalla (2026-11-20)

La dirección elegida ([`direccion.md`](direccion.md), «La elegida») convierte la tarjeta en una pantalla
([`tarjeta-modelo.md`](tarjeta-modelo.md)) y la ficha en una primera pantalla oscura ([`ficha-modelo.md`](ficha-modelo.md)).
Ahí la silueta se pintaba enorme (24 rem en móvil, 42 rem en escritorio), detrás del texto y en `ink-950` sobre la
franja clara (≈ 15:1), y pesaba más que el nombre y las cifras. Esta sección **manda sobre** «Tamaño en pantalla»,
«Color» y «Estados» de abajo cuando la silueta ocupa una pantalla; el icono de 48 px y los dibujos de referencia
(qué silueta va con cada segmento, trazados, suelo, ruedas) **no cambian**.

Prototipo `web/design-proto/siluetas-a.astro`, borrado al llevarlo a `web/src/` en la historia #1246 (PR #1271) (primera pantalla de la ficha del Renault Master Furgón E-Tech eléctrico,
y tres pantallas del catálogo: Grand Kangoo E-Tech eléctrico, CLA Shooting Brake y smart #2). Capturas
[`refs/siluetas-a-390.png`](refs/siluetas-a-390.png) y [`refs/siluetas-a-1280.png`](refs/siluetas-a-1280.png).

**Principio: la silueta ocupa el sitio de la foto y nunca va debajo del texto.** Se coloca en el mismo hueco que el coche
recortado de ADR-0025 («Imagen retocada» en las dos especificaciones), se apoya en el suelo de ese hueco y se pinta con
un trazo fino de color apagado: se lee como una imagen que acompaña, no como un titular. Así una pantalla sin foto, una con
foto retocada y una con foto normal comparten composición (RF-8 y CA-17 de PRD-001; RF-12 y CA-12 de PRD-002).

```
Catálogo, móvil (390)            Catálogo, escritorio (≥ 1024), impar          par: espejo
┌──────────────────────────┐     ┌──────────────────────────────────────────┐
│░   ┌──────────────────┐  │     │░ smart          ┊                        ░│
│░   │   ╭──╮  silueta  │  │     │░ #2             ┊      ╭────╮            ░│
│░   │ ◯────◯  15 rem   │  │     │░ Segmento por … ┊   ╭──╯    ╰──╮  28 rem ░│
│░   └───── suelo ──────┘  │     │░ Por     290 km ┊   ◯─────────◯          ░│
│░ smart                   │     │░ confirmar      ┊   ─────── suelo ─────── ░│
│░ #2 · cifras · pie       │     │░ Comparar                                ░│
└──────────────────────────┘     └──────────────────────────────────────────┘
 franja clara surface-muted       texto ≤ 44 %     hueco: del 50 % al borde − 2,5 rem

Ficha, móvil (390)               Ficha, escritorio (≥ 1024)
┌──────────────────────────┐     ┌──────────────────────────────────────────┐
│▓ siete3 · ruta           │     │▓ siete3 · ruta                           ▓│
│▓   ╭──╮                  │     │▓ Renault              ┊   ╭────╮          ▓│
│▓ ◯────◯   18 rem, flex 1 │     │▓ MASTER FURGÓN        ┊ ╭─╯    ╰─╮ 34 rem ▓│
│▓ ── suelo (mín. 12 rem)  │     │▓ E-TECH eléctrico     ┊ ◯────────◯        ▓│
│▓ Renault                 │     │▓ Segmento …           ┊ ───── suelo ───── ▓│
│▓ MASTER FURGÓN …         │     │▓ 27.332 €  206 km  96 kW  40 kWh          ▓│
│▓ cifras clave            │     └──────────────────────────────────────────┘
└──────────────────────────┘      franja oscura ink-950
```
(«suelo» es el borde de abajo del hueco: no se dibuja ninguna línea.)

| Regla | Catálogo (franja clara) | Ficha, primera pantalla (franja oscura) | Por qué |
|---|---|---|---|
| Franja | `surface-muted` (`.band-light`), sin cambios | `ink-950` (`.band-dark`), sin cambios | `tarjeta-modelo.md` y `ficha-modelo.md` |
| Color | `--color-silhouette` = `#a3ada7` | `--color-silhouette` en `.band-dark` = `#45525b` | Contraste ≈ 2 en las dos franjas: se ve, pero por debajo de cualquier texto (≥ 6,6). Ver «Contraste» |
| Grosor | `--size-silhouette-stroke` = 2 px, constante | Igual | El mismo trazo que el icono de 48 px: la familia se reconoce. `vector-effect: non-scaling-stroke` en `path` y `circle` para que no engorde al crecer |
| Lado del SVG, móvil | `--size-silhouette-card` 15 rem (el coche mide ≈ 13,75 rem) | `--size-silhouette-hero` 18 rem | La mitad que antes en el catálogo; nunca más ancho que el hueco: `min(token, 100%)` |
| Lado del SVG, `lg` | `--size-silhouette-card-lg` 28 rem | `--size-silhouette-hero-lg` 34 rem | Cabe en su mitad de pantalla con aire a los lados |
| Hueco, móvil | Arriba: `inset: 1.5rem 1.25rem auto`, alto 10 rem (`15 rem × 32/48`, cabe el techo más alto, la furgoneta en `y = 8`). El texto empieza en 12,5 rem, como ya hacía | Entre la ruta y el nombre, en el flujo: `flex: 1`, alto mínimo `--size-cutout-mobile` (12 rem = `18 rem × 32/48`), margen `1.5rem 1.25rem 0` | El de la imagen retocada: texto y silueta no se solapan, sea cual sea el largo del nombre |
| Hueco, `lg` | `inset: 2.5rem 2.5rem 2.5rem 50%` en las impares y `2.5rem 50% 2.5rem 2.5rem` en las pares | `inset: 6.5rem 2.5rem 1rem 50%` dentro de la pantalla, por encima de las cifras clave | La mitad opuesta al texto, alternando como las fotos |
| Posición en el hueco | Centrada en horizontal y **apoyada abajo**: el SVG baja `10/48` de su lado (`margin-bottom` negativo), para que el pie de las ruedas (`y = 38`) quede en el suelo del hueco | Igual | Comparten suelo con las cifras de al lado; no flota |
| Proporción | El SVG recibe solo el ancho; el alto lo da `aspect-ratio: 1` | Igual | Con alto en `%` se deformaría el cuadrado |
| Fondo del hueco | Ninguno: ni recuadro, ni elipse de suelo | Ninguno | El suelo de `--color-cutout-floor` es para la sombra del PNG; la silueta no la tiene |

**Lo que cambia en `web/src/`** (lo hace el Desarrollador): en `ModelCard.astro`, `.silhouette` pasa de estar detrás del
texto (`top: -6.5rem`, 24/42 rem, `ink-950`, `stroke-width` 0,3/0,22) a las reglas de arriba. En
`marcas/[marca]/[modelo].astro`, `.hero-silhouette` deja de ser `inset: 0` centrada a 24/42 rem en `on-dark-muted` y
pasa al hueco de `.hero-cutout` (mismo `order` y mismo `inset` en `lg`, salvo el de abajo). `SegmentSilhouette.astro`
sigue escribiendo `width` y `height` en línea: para la pantalla, que escriba solo el ancho (o que el CSS fije
`height: auto` y `aspect-ratio: 1`, como hace el prototipo con `!important`). Ni trazados ni elección de silueta cambian.

**Estados en pantalla**

| Estado | Qué se ve | Requisito |
|---|---|---|
| Sin foto, con segmento | Su silueta, en el hueco, apoyada abajo | RF-8, CA-17 (PRD-001); RF-12, CA-12 (PRD-002) |
| Sin foto ni segmento | La genérica, mismo sitio y tamaño; «Segmento por confirmar» en el texto (comprobado: Grand Kangoo, Master Furgón y smart #2) | RF-12, CA-15 |
| Nombre muy largo | No toca a la silueta: en móvil el texto crece hacia abajo; en `lg` va en su columna de 44 % (catálogo) o en la mitad izquierda (ficha) | — |
| Pantalla del catálogo más alta que 31,5 rem (nombre de cuatro líneas en `lg`) | El hueco crece con ella y la silueta sigue apoyada abajo, a la altura de las cifras | — |
| Pantalla estrecha (320 px) | `min(token, 100%)`: la silueta encoge con el hueco, nunca desborda | WCAG 1.4.10 |
| Zoom / letra grande | Los lados van en `rem` y crecen; el trazo de 2 px escala con el zoom del navegador | WCAG 1.4.4 |
| Colores forzados | `currentColor` pasa al color de texto del sistema: la silueta se ve a pleno contraste, sin reglas extra | RNF-3 |

**Lector de pantalla y foco**: sin cambios. `aria-hidden="true"`, `focusable="false"`, sin texto; en el catálogo queda
debajo del `::after` del enlace (`pointer-events: none`), así que pulsarla abre la ficha como el resto de la pantalla.

## Reglas comunes

Todas comparten estas reglas, para que se lean como una familia y para que la diferencia entre dos
siluetas sea solo la forma del coche:

| Regla | Valor | Por qué |
|---|---|---|
| `viewBox` | `0 0 48 48` | Cuadrado, del lado de `--size-segment-icon` (48 px): 1 unidad = 1 px, sin escalado que adelgace el trazo |
| Tamaño en pantalla | `--size-segment-icon` de ancho y alto; el SVG no lleva `width` ni `height` propios | `tokens.md`, «Silueta de segmento» |
| Trazo | `stroke="currentColor"`, `stroke-width="2"`, `stroke-linejoin="round"`, `stroke-linecap="round"` | 2 px es el grosor mínimo que se lee a 48 px; las uniones redondas evitan picos en las esquinas |
| Relleno | `fill="none"` en todo, también en las ruedas | Un solo color, sin superficies que compitan con el texto de la tarjeta |
| Color | El del contenedor: `color: var(--color-line)` | Token existente (`tokens.md`); ver «Contraste» |
| Orientación | De perfil, con el frontal a la **derecha** | Igual en todas, para que se comparen de un vistazo |
| Línea de suelo | Los bajos de la carrocería en `y = 34` y el centro de las ruedas en `y = 34`, en todas | Al compartir suelo, la altura del techo se compara entre siluetas. No se recentra cada dibujo en vertical |
| Márgenes | Nada fuera de `x` 2–46 ni de `y` 8–38 (con el trazo, 1–47 / 7–39) | Que el trazo no se corte en el borde del `viewBox` |
| Ruedas de turismo | `r = 3.5`, paso de rueda `r = 5` | Urbano, compacto, berlina, familiar, monovolumen, deportivo y genérica |
| Ruedas de SUV y furgoneta | `r = 4`, paso de rueda `r = 5.5` | La rueda más grande ayuda a leer «alto» además del techo |
| Detalle | Solo contorno y ruedas: sin ventanas, faros, tiradores ni logotipos | A 48 px el detalle interior se empasta; y RF-8 pide una silueta **genérica**, sin marca reconocible |
| Texto | Ninguno dentro del SVG (ni `<title>` ni `<desc>`) | Es decorativa: el segmento ya se lee en la tarjeta (`tarjeta-modelo.md`) |
| Accesibilidad | `aria-hidden="true"` y `focusable="false"` en el `<svg>` | No se anuncia ni recibe foco (RNF-3) |

## Qué distingue a cada una

Las medidas son en unidades del `viewBox` (= px a 48 px). «Largo» es de paragolpes a paragolpes;
«techo» es la `y` del punto más alto (menor = más alto; el suelo está en 34).

| Silueta | Valor (`segment.value`) | Largo | Techo | Ruedas (centros x) | Rasgo que la distingue |
|---|---|---|---|---|---|
| Urbano | `urbano` | 30 (9–39) | 18 | 15 · 33 | La más corta. Voladizos casi nulos, morro muy corto, trasera casi vertical |
| Compacto | `compacto` | 36 (6–42) | 19 | 13 · 35 | Hatchback: portón trasero algo inclinado, capó más largo que el urbano |
| Berlina | `berlina` | 44 (2–46) | 21 | 11 · 37 | Tres volúmenes: escalón del maletero detrás de la luneta |
| Familiar | `familiar` | 44 (2–46) | 20 | 11 · 37 | Techo largo y plano hasta atrás, portón casi vertical; sin escalón de maletero |
| SUV pequeño | `suv_pequeno` | 34 (7–41) | 15 | 14 · 34 | Alto y corto; ruedas grandes |
| SUV compacto | `suv_compacto` | 40 (4–44) | 14 | 12 · 36 | Alto, largo medio, portón algo inclinado; ruedas grandes |
| SUV grande | `suv_grande` | 44 (2–46) | 12 | 10 · 37 | El SUV más alto y largo; trasera vertical, perfil de caja |
| Monovolumen | `monovolumen` | 40 (4–44) | 13 | 11 · 36 | Un volumen: parabrisas y capó en una sola línea inclinada del morro al techo |
| Furgoneta | `furgoneta` | 44 (2–46) | 8 | 10 · 37 | La más alta. Caja: techo y trasera en ángulo recto, morro corto |
| Deportivo | `deportivo` | 44 (2–46) | 23 | 11 · 37 | La más baja. Capó largo, habitáculo atrasado, techo que cae en una sola línea hasta la cola (fastback) |
| Genérica | sin `segment` | 36 (6–42) | 18 | 13 · 35 | **Simétrica**: sin frontal ni trasera distinguibles, para no sugerir ningún segmento |

Pares que más se parecen y cómo se separan:
- **Berlina / familiar**: mismo largo y ruedas; la berlina tiene el escalón del maletero, el familiar no.
- **SUV compacto / SUV grande**: 4 px de largo y 2 de techo de diferencia, y la trasera (inclinada / vertical).
- **Monovolumen / SUV compacto**: alturas parecidas; el monovolumen no tiene capó separado del parabrisas y
  lleva ruedas de turismo.
- **Compacto / genérica**: mismo largo y ruedas; la genérica es simétrica, el compacto tiene morro y portón.

```
Alturas de techo (suelo = 34)       y
furgoneta      ████████████████████  8
SUV grande     ████████████████     12
monovolumen    ███████████████      13
SUV compacto   ██████████████       14
SUV pequeño    █████████████        15
urbano         ██████████           18
genérica       ██████████           18
compacto       █████████            19
familiar       ████████             20
berlina        ███████              21
deportivo      █████                23
```

## Dibujos de referencia

Cada bloque es el SVG completo. El Desarrollador puede copiar los trazados (`d`, `cx`, `r`) tal cual; el
envoltorio (`<svg>` y sus atributos) es el mismo en las 11.

### Urbano (`urbano`)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">
  <path d="M9 34V20L10 18H27L34 25L39 27V34H38A5 5 0 0 0 28 34H20A5 5 0 0 0 10 34Z"/>
  <circle cx="15" cy="34" r="3.5"/>
  <circle cx="33" cy="34" r="3.5"/>
</svg>
```

### Compacto (`compacto`)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">
  <path d="M6 34V25L9 19H28L35 25L42 27V34H40A5 5 0 0 0 30 34H18A5 5 0 0 0 8 34Z"/>
  <circle cx="13" cy="34" r="3.5"/>
  <circle cx="35" cy="34" r="3.5"/>
</svg>
```

### Berlina (`berlina`)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">
  <path d="M2 34V27L10 26L15 21H28L35 26L46 28V34H42A5 5 0 0 0 32 34H16A5 5 0 0 0 6 34Z"/>
  <circle cx="11" cy="34" r="3.5"/>
  <circle cx="37" cy="34" r="3.5"/>
</svg>
```

### Familiar (`familiar`)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">
  <path d="M2 34V24L4 20H29L36 26L46 28V34H42A5 5 0 0 0 32 34H16A5 5 0 0 0 6 34Z"/>
  <circle cx="11" cy="34" r="3.5"/>
  <circle cx="37" cy="34" r="3.5"/>
</svg>
```

### SUV pequeño (`suv_pequeno`)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">
  <path d="M7 34V20L9 15H28L34 22L41 24V34H39.5A5.5 5.5 0 0 0 28.5 34H19.5A5.5 5.5 0 0 0 8.5 34Z"/>
  <circle cx="14" cy="34" r="4"/>
  <circle cx="34" cy="34" r="4"/>
</svg>
```

### SUV compacto (`suv_compacto`)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">
  <path d="M4 34V19L7 14H31L37 21L44 23V34H41.5A5.5 5.5 0 0 0 30.5 34H17.5A5.5 5.5 0 0 0 6.5 34Z"/>
  <circle cx="12" cy="34" r="4"/>
  <circle cx="36" cy="34" r="4"/>
</svg>
```

### SUV grande (`suv_grande`)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">
  <path d="M2 34V14L4 12H32L38 20L46 22V34H42.5A5.5 5.5 0 0 0 31.5 34H15.5A5.5 5.5 0 0 0 4.5 34Z"/>
  <circle cx="10" cy="34" r="4"/>
  <circle cx="37" cy="34" r="4"/>
</svg>
```

### Monovolumen (`monovolumen`)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">
  <path d="M4 34V16L6 13H26L42 25L44 27V34H41A5 5 0 0 0 31 34H16A5 5 0 0 0 6 34Z"/>
  <circle cx="11" cy="34" r="3.5"/>
  <circle cx="36" cy="34" r="3.5"/>
</svg>
```

### Furgoneta (`furgoneta`)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">
  <path d="M2 34V8H34L40 18L46 22V34H42.5A5.5 5.5 0 0 0 31.5 34H15.5A5.5 5.5 0 0 0 4.5 34Z"/>
  <circle cx="10" cy="34" r="4"/>
  <circle cx="37" cy="34" r="4"/>
</svg>
```

### Deportivo (`deportivo`)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">
  <path d="M2 34V29L6 28L16 23H24L31 27L46 30V34H42A5 5 0 0 0 32 34H16A5 5 0 0 0 6 34Z"/>
  <circle cx="11" cy="34" r="3.5"/>
  <circle cx="37" cy="34" r="3.5"/>
</svg>
```

### Genérica (sin `segment`)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">
  <path d="M6 34V26L12 25L18 18H30L36 25L42 26V34H40A5 5 0 0 0 30 34H18A5 5 0 0 0 8 34Z"/>
  <circle cx="13" cy="34" r="3.5"/>
  <circle cx="35" cy="34" r="3.5"/>
</svg>
```

Cómo está construido cada trazado, por si hay que retocarlo: empieza en el bajo trasero (izquierda), sube por
la trasera, recorre luneta, techo, parabrisas y capó, baja por el frontal y vuelve por los bajos hasta el
inicio. Los pasos de rueda son arcos (`A r r 0 0 0`) centrados en el eje de cada rueda, con barrido 0 porque
se recorren de derecha a izquierda por encima.

## Elección de la silueta

| Dato del modelo | Silueta |
|---|---|
| `segment.value` es uno de los diez de RF-11 | La de ese valor (tabla «Qué distingue a cada una») |
| Sin `segment` | Genérica (RF-12, CA-15) |
| `segment.value` fuera de la lista | No debería ocurrir: la validación del esquema lo rechaza (`data-model.md`). Si llegara, genérica, nunca hueco vacío |

El modelo tiene imagen con `license` → no hay silueta: se pinta la imagen (`tarjeta-modelo.md`).

## Estados

| Estado | Qué se ve | Requisito |
|---|---|---|
| Sin imagen con licencia, con segmento | Silueta del segmento, centrada en el hueco 16:9 `surface-muted` | RF-8, CA-17 |
| Sin imagen y sin segmento | Silueta genérica, mismo sitio y tamaño; la línea de segmento dice «Segmento por confirmar» (`tarjeta-modelo.md`) | RF-8, RF-12, CA-15, CA-17 |
| Tarjeta estrecha o ancha | Siempre 48 × 48 px: la silueta no escala con la tarjeta, solo el hueco | `tokens.md` |
| Zoom del navegador / tamaño de letra | `--size-segment-icon` va en `rem`, así que crece con la letra; el trazo crece con él | WCAG 1.4.4 |
| Modo de alto contraste forzado (Windows) | `currentColor` toma el color de texto del sistema: la silueta sigue visible sin reglas extra | RNF-3 |
| Texto muy largo, error, cargando | No aplican: la silueta no tiene texto y es SVG en línea, sin petición que pueda fallar ni tardar | RNF-2 |

## Contraste

Icono de 48 px (anterior a la dirección visual): `--color-line` sobre `--color-surface-muted`, **≈ 4,4** (`tokens.md`).

En pantalla (dirección visual, arriba): `--color-silhouette` `#a3ada7` (L 0,4046) sobre `surface-muted` `#eef1ee`
**2,03**; `#45525b` (L 0,0806) sobre `ink-950` **2,34**. Por debajo del 3:1 a propósito: es decorativa
(`aria-hidden`), no transmite nada que no diga el texto (el segmento va escrito al lado), así que WCAG 1.4.11 no se le
aplica, y tiene que quedar por detrás de todo el texto (el más flojo, `ink-600` sobre `surface-muted`, da 6,61).

## Para el Desarrollador

- **Sin JavaScript** (ADR-0003): son SVG en línea en el HTML generado. En línea mejor que `<img src>`:
  `currentColor` solo funciona en línea, y no añade peticiones (RNF-2).
- Un único componente que reciba el valor de segmento (o ninguno) y pinte uno de los 11 trazados; el envoltorio
  `<svg>` es común. No lleva texto, así que no hay claves de copy (RNF-4).
- No se recentran en vertical: el hueco libre por arriba en las bajas (deportivo) es intencionado, comparten suelo.
- Los trazados se han calculado a mano y **no se han visto renderizados**: revisarlos a 48 px en el navegador
  antes de dar la tarea por cerrada. Si un retoque cambia largo, techo o ruedas, actualizar la tabla
  «Qué distingue a cada una».
