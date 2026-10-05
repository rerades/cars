# Siluetas de segmento

Dibujo de las siluetas que ocupan el hueco de imagen cuando un modelo no tiene ninguna imagen con
`license` (PRD-001, RF-8 y CA-17). Dónde van y a qué tamaño lo dicen `tarjeta-modelo.md` («Imagen y
silueta, sin imagen») y `tokens.md` («Silueta de segmento»); aquí solo se fija **qué se dibuja**.

Son 11: una por cada segmento de RF-11 y una genérica para el modelo sin `segment` (RF-12, CA-15).

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

No necesita token nuevo. La silueta usa `--color-line` sobre `--color-surface-muted`: **≈ 4,4** (`tokens.md`).
Al ser decorativa no se le exige mínimo, pero supera el 3:1 de WCAG 1.4.11, así que quien la vea la distingue.

## Para el Desarrollador

- **Sin JavaScript** (ADR-0003): son SVG en línea en el HTML generado. En línea mejor que `<img src>`:
  `currentColor` solo funciona en línea, y no añade peticiones (RNF-2).
- Un único componente que reciba el valor de segmento (o ninguno) y pinte uno de los 11 trazados; el envoltorio
  `<svg>` es común. No lleva texto, así que no hay claves de copy (RNF-4).
- No se recentran en vertical: el hueco libre por arriba en las bajas (deportivo) es intencionado, comparten suelo.
- Los trazados se han calculado a mano y **no se han visto renderizados**: revisarlos a 48 px en el navegador
  antes de dar la tarea por cerrada. Si un retoque cambia largo, techo o ruedas, actualizar la tabla
  «Qué distingue a cada una».
