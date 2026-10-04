# Filtros y orden del catálogo

PRD-001: RF-2, RF-3, RF-5, RF-6, RF-7, RF-10, RF-11, RF-12; CA-2, CA-3, CA-5, CA-6, CA-9, CA-13, CA-14,
CA-15, CA-16. Tokens: `tokens.md`. Tarjeta: `tarjeta-modelo.md`. Esquema de datos:
`docs/architecture/data-model.md` (ADR-0008). Componentes de Bearnie (ADR-0005): Field/Label, Checkbox,
Select, Button, Empty.

## Regla de base: sin JavaScript (RF-10, CA-12c)
- **Las páginas pregeneradas** (marca, segmento, tramo) llevan las tarjetas en el HTML y **no llevan panel de
  filtros**: sin JS no habría nada que funcionase (un control que no hace nada falla RNF-3). Llevan una franja
  «Explorar» con **enlaces normales** a las demás páginas pregeneradas (marcas, segmentos, tramos de precio y autonomía) y a `/coches`. Pregunta 1.
- **`/coches`** lleva todas las tarjetas en el HTML (CA-1). Los filtros y el orden solo se muestran si hay JS
  (RF-2, RF-5: se filtra en el navegador). Sin JS: se ven todos los modelos y, en lugar del panel, la franja
  «Explorar» y el texto de `filtros.sinJs`. Nada de formulario `GET` vacío.
- No se guarda nada (RNF-5): el estado sale de la URL y vuelve a ella.

## Estructura

Orden del DOM y de foco: encabezado → resumen → franja «Explorar» → **filtros** → orden → resultados.

```
Móvil (< 768 px)                       Escritorio (≥ 1024 px)
┌───────────────────────┐              ┌──────────────┬───────────────────────┐
│ h1 Coches eléctricos  │              │ h1 Coches eléctricos                 │
│ 6 modelos             │              │ 6 modelos        Ordenar: [Select ▾] │
│ [Filtros (2)]  [Orden▾]│              ├──────────────┼───────────────────────┤
├───────────────────────┤              │ Filtros      │ ┌────┐ ┌────┐ ┌────┐   │
│ (panel abierto:)      │              │ Marca        │ │card│ │card│ │card│   │
│ Marca      ▸ grupo    │              │ ☐ Cupra      │ └────┘ └────┘ └────┘   │
│ Segmento              │              │ ☐ Polestar   │                        │
│ Precio                │              │ Segmento…    │                        │
│ Autonomía mínima      │              │ Precio…      │                        │
│ Tracción              │              │ Autonomía…   │                        │
│ Estado                │              │ Tracción     │                        │
│ [Ver 4 modelos][Limpiar]│            │ Estado       │                        │
├───────────────────────┤              │ [Limpiar]    │                        │
│ resultados (1 col)    │              └──────────────┴───────────────────────┘
└───────────────────────┘
```

La colocación en la página (contador bajo el texto de entrada, fila «Modelos» + orden) la precisa
`paginas-catalogo.md`, que manda sobre este wireframe.

- **Escritorio (`lg`)**: panel fijo a la izquierda, `--width-filters`, con desplazamiento propio; el orden arriba a la derecha.
  Los filtros se aplican al momento (no hay botón «Aplicar»).
- **Móvil / `md`**: el botón «Filtros (n)», con el nº de filtros activos, abre el panel a pantalla completa; dentro
  el botón principal «Ver {n} modelos» lo cierra y «Limpiar filtros» queda a su lado. Los resultados se actualizan
  mientras se elige. El panel es un `<details>`-like/disclosure con `aria-expanded`; al abrirlo el foco pasa a su título
  y al cerrarlo vuelve al botón «Filtros». Con `Esc` se cierra. Sin trampa de foco: es un panel en el flujo, no un modal.
  - «A pantalla completa» significa **en el flujo del documento, con alto mínimo de la ventana**, no una capa
    `position: fixed` encima de los resultados: si fuera una capa, el tabulador seguiría pasando por las tarjetas
    tapadas y el foco quedaría oculto (WCAG 2.4.3, 2.4.7). Detrás no hay nada que alcanzar sin desplazarse.
  - El botón lleva `aria-expanded` y `aria-controls` al panel (WCAG 4.1.2). El título del panel («Filtros», `h2`)
    lleva `tabindex="-1"` para poder recibir el foco al abrir.
  - **Nombre del botón** (WCAG 4.1.2, 2.5.3): con filtros activos se ve «Filtros (2)» y el nombre accesible es
    «Filtros (2 activos)»: la palabra «activos» va en un `span` oculto solo visualmente, dentro del paréntesis. El
    nombre empieza por el texto visible, así que el control por voz («pulsa Filtros») funciona. Sin filtros
    activos se ve y se lee «Filtros», sin paréntesis.
- El orden (RF-3) es un `<select>` nativo: en móvil abre el selector del sistema. Lleva `<label>` **visible**
  «Ordenar por» (`orden.etiqueta`) asociado con `for`; el «Ordenar:» del wireframe es ese mismo texto
  (WCAG 3.3.2, 2.5.3).

## Controles (RF-2, RF-3, RF-7, RF-11, RF-12)

Cada grupo es un `<fieldset>` con `<legend>` visible (WCAG 1.3.1, 3.3.2). Las etiquetas visibles son las de
`filtros.*` del copy. Cada control tiene su `<label>` visible asociado: su nombre accesible es ese texto, más el
del `legend` como contexto de grupo (WCAG 4.1.2). Colores de cada control: «Roles de color por control» en
`tokens.md` (bordes `line`: 4,83 sobre `surface`, 4,39 sobre `surface-muted`; marcado `brand-600`: 6,67 / 6,06;
todos ≥ 3, WCAG 1.4.11). El estado marcado se distingue por la forma (marca ✓, punto del radio), no solo por
el relleno de color (WCAG 1.4.1). Zona táctil de cada fila de casilla o radio, de cada campo y de cada
`<select>`: `--size-touch` de alto mínimo, con la etiqueta entera pulsable.

**Contadores en las opciones.** «Cupra (3)» se ve así, pero el nombre accesible es «Cupra (3 modelos)»: la
palabra «modelos» va oculta solo visualmente (clave `filtros.opcionConteo`). Sin ella el lector dice «Cupra 3»,
que no se entiende (WCAG 1.3.1, 2.5.3: el nombre sigue empezando por el texto visible).

**Campos de precio.** `type="text"` con `inputmode="numeric"` (no `type="number"`, que cambia el valor con la
rueda y las flechas sin querer), `autocomplete="off"`. Nombre: «Desde (€)» / «Hasta (€)» dentro del `legend`
«Precio». Sin *placeholder* como etiqueta.

| Filtro | Control | Valores | Notas |
|---|---|---|---|
| Marca | Casillas (multiselección) | Las marcas con modelos, con el nº entre paréntesis: «Cupra (3)» | O entre marcas |
| Segmento | Casillas | Los segmentos con modelos, con la etiqueta española de RF-11 (ver «Etiquetas de segmento») | O entre segmentos. Un modelo sin `segment` no cuenta en ningún valor y no aparece si se aplica el filtro (RF-12, CA-15). Si ningún modelo del catálogo tiene segmento asignado todavía, el grupo no se muestra: no se filtra por un dato que nadie tiene |
| Precio | Dos campos numéricos «Desde» y «Hasta» (€), con `inputmode="numeric"` | Libre | Rango de RF-2, sobre el «precio desde» (incluye oferta, RF-9). Un modelo sin ninguna versión con precio no cumple ningún rango y desaparece con el filtro activo. Sin deslizador: el doble deslizador es difícil por teclado y con lector; Pregunta 2 |
| Autonomía mínima | `<select>` | «Cualquiera», «300 km», «400 km», «500 km», «600 km» | CA-2: «≥ 400 km» = alguna versión ≥ 400. Un modelo sin `wltp_km` ni `specs.wltp_max_km` no cumple ningún mínimo y desaparece con el filtro activo (RF-12, CA-15) |
| Tracción | Casillas | «Delantera», «Trasera», «Total» | El modelo cumple si alguna versión tiene `drivetrain` (misma regla que la autonomía); si no, `specs.drivetrains`. Sin ese dato, no aparece con el filtro activo (RF-12, CA-15) |
| Estado | Radios | «Todos» (por defecto), «A la venta», «Próximamente», «Descatalogado» | `status` es siempre uno de los tres valores además de «Todos» (RF-7, CA-14) |

Orden (`<select>`, RF-3, CA-3, CA-9, CA-16): «Novedad» (por defecto, ordena por `launch` de más a menos
reciente; los modelos sin `launch` van al final), «Precio: de menor a mayor», «Precio: de mayor a menor»,
«Autonomía: de mayor a menor». En los dos órdenes de precio, los modelos sin precio van **al final** (CA-9);
en el de autonomía, por el mismo criterio de RF-12, los que no tienen el dato también van al final.

- **Tracción**: con los 6 modelos reales de hoy solo Tavascan y Polestar 3 tienen algo publicado, así que el
  filtro dejaría casi vacío el catálogo hasta que se rellene más tracción. Junto al grupo, la ayuda
  `filtros.traccionAyuda`: «Solo cuentan los modelos con este dato publicado».
- Filtro de precio: los modelos «Precio por confirmar» no cumplen ningún rango; con rango activo desaparecen.
- **Valores sin resultados**: no se deshabilitan (evita casillas «muertas» difíciles de explicar); el estado vacío lo resuelve.

### Etiquetas de segmento (RF-11)
Valor del esquema (`segment.value`, `data-model.md`) → etiqueta española que muestran la tarjeta y el filtro:

| Valor | Etiqueta |
|---|---|
| `urbano` | Urbano |
| `compacto` | Compacto |
| `berlina` | Berlina |
| `familiar` | Familiar |
| `suv_pequeno` | SUV pequeño |
| `suv_compacto` | SUV compacto |
| `suv_grande` | SUV grande |
| `monovolumen` | Monovolumen |
| `furgoneta` | Furgoneta |
| `deportivo` | Deportivo |

## Resumen y avisos
Encima de los resultados, una línea `role="status"` (`aria-live="polite"`): «6 modelos» / «2 modelos» / «Ningún modelo».
Se actualiza al filtrar; no roba el foco (WCAG 4.1.3). Es **la única región viva** de los resultados: el estado
vacío no lleva su propio `role="status"`, para que no se anuncie dos veces. Para no anunciar cada pulsación en los
campos de precio, el resumen se actualiza con el filtro ya aplicado (al salir del campo o tras una pausa de
escritura), no letra a letra.

Filtros activos como **chips** con «×» («Cupra ×»), cada uno un `<button>` de alto mínimo `--size-touch`, debajo
del resumen. Colores: fondo `surface`, texto `ink-900` (17,74), borde `line` (4,83). El «×» es decorativo
(`aria-hidden`) y el nombre accesible es «Quitar filtro: Cupra» (`chip.quitar`), que contiene el texto visible
(WCAG 2.5.3, 4.1.2). Los chips van en una lista con nombre «Filtros activos» (`chip.lista`).
**Foco al quitar un chip** (WCAG 2.4.3): el botón desaparece, así que el foco pasa al chip siguiente; si era el
último, al anterior; si no queda ninguno, al encabezado `h2` «Modelos» (`tabindex="-1"`).

## Estado vacío (RF-6, CA-6)
Se produce solo en el navegador (ADR-0006). Sustituye a la rejilla; el panel de filtros **sigue** visible.
```
┌──────────────────────────────┐
│ h2  Ningún modelo cumple los │
│     filtros                  │
│ Prueba a ampliar el precio o │
│ a quitar algún filtro.       │
│ [Limpiar filtros]            │  botón principal (brand-600), 44 px
└──────────────────────────────┘
```
El resumen `role="status"` lo anuncia («Ningún modelo»). Limpiar: quita todos los filtros y el orden vuelve al de por defecto, la URL vuelve a `/coches`,
y el foco pasa al encabezado de resultados (el botón desaparece; sin esto el foco se pierde, WCAG 2.4.3). También limpia «Limpiar filtros» del panel.
Botón principal: `on-brand` sobre `brand-600` (6,67); hover `brand-800` (9,33).

**Sin filtros activos, «Limpiar filtros» no se pinta** (ni en el panel ni en el estado vacío, que nunca se da sin
filtros). Se descarta el botón deshabilitado: WCAG 1.4.3 no le exige contraste, así que sería un texto gris
difícil de leer, y un `disabled` tampoco recibe foco, con lo que no explica por qué no hace nada.
**Foco tras «Limpiar filtros» del panel** (WCAG 2.4.3): el botón desaparece, así que el foco pasa al título del
panel («Filtros», `tabindex="-1"`) en móvil y en escritorio.

## Estados y errores
| Situación | Comportamiento |
|---|---|
| Sin filtros | Todos los modelos, orden por defecto («Novedad») |
| URL con un valor no válido (`?autonomia=abc`) | Se ignora ese filtro; no hay página de error. Pregunta 4 |
| Rango de precio con «Desde» > «Hasta» | Mensaje `filtros.errorRango` debajo de los dos campos, en `ink-900` sobre `surface-muted` (16,12), sin color de error: el error se dice con texto (WCAG 3.3.1, 1.4.1). Los dos campos llevan `aria-invalid="true"` y `aria-describedby` al mensaje. El contenedor del mensaje existe vacío desde la carga con `role="alert"`, y se rellena al salir del campo (`change`), no a cada tecla: así se anuncia sin mover el foco (WCAG 4.1.3) y sin interrumpir mientras se escribe. El mensaje dice cómo corregirlo (WCAG 3.3.3). No se filtra por precio hasta corregirlo; el resto de filtros sigue aplicado |
| Marca con nombre muy largo | La etiqueta parte línea; la casilla queda alineada arriba |
| Lista de marcas larga | Grupo con scroll interno solo a partir de 10 opciones; nunca oculta opciones a los que no usan ratón |
| JS falla o tarda | Se ve la lista completa (HTML) y la franja «Explorar» |

## URL (RF-5, CA-5, CA-13)
Cada cambio actualiza la query string sin recargar y sin crear una entrada de historial por cada casilla
(sustituye la actual). Abrir la URL reproduce el estado: controles marcados, chips y resultados. Los nombres de
parámetro los fija el Desarrollador; se pide que sean legibles en español. Esas URL no son indexables (CA-13): `/coches` lleva en el HTML servido `<link rel="canonical">` a
`/coches` sin query string, y no se añade `noindex` por JS (decisión en PRD-001, sección 8).

## Orden de foco
1. Enlace «Saltar a los resultados» (primer elemento de la página, visible al recibir foco; `brand-600` subrayado
   sobre `surface`, 6,67; alto mínimo `--size-touch`). Lleva al `h2` «Modelos» (WCAG 2.4.1).
2. Navegación del sitio.
3. Franja «Explorar» (enlaces, `brand-600` sobre `surface`, 6,67, **subrayados**: frente a texto `ink-900` solo dan
   2,66, menos de 3, así que el color solo no basta, WCAG 1.4.1). Cada enlace con alto mínimo `--size-touch`.
4. Móvil: botón «Filtros» → (si abierto) grupos en el orden Marca, Segmento, Precio, Autonomía, Tracción, Estado → «Ver n modelos» → «Limpiar filtros». Escritorio: los mismos grupos y «Limpiar filtros».
5. Select de orden.
6. Chips de filtros activos (de izquierda a derecha).
7. Tarjetas, una parada cada una (el enlace del nombre).
Los cambios de resultados **no** mueven el foco, salvo tras «Limpiar filtros» (a `h2` de resultados) y tras cerrar el panel móvil (al botón «Filtros»).
Teclado: Espacio marca casillas y radios; flechas cambian entre radios; Esc cierra el panel móvil.
Foco visible en todos los controles: anillo de `tokens.md` (`--size-focus-ring`, `brand-600`), 6,67 sobre
`surface` y 6,06 sobre `surface-muted` (WCAG 2.4.7, 1.4.11). En casillas y radios el anillo rodea la fila entera
de la etiqueta, que es la zona pulsable. Cambiar un filtro no cambia de contexto (no recarga, no mueve el foco):
cumple WCAG 3.2.2 aunque los resultados se actualicen al momento, porque el cambio se anuncia por el resumen.

## Copy propuesto (RNF-4: claves para i18n, sin textos fijos en componentes)
| Clave | Texto |
|---|---|
| `filtros.titulo` | Filtros |
| `filtros.abrir` | Filtros ({n}) — con «activos» oculto solo visualmente tras {n}: se lee «Filtros (2 activos)»; con 0, «Filtros» |
| `filtros.opcionConteo` | {valor} ({n}) — con «modelos» oculto solo visualmente tras {n}: se lee «Cupra (3 modelos)» |
| `chip.quitar` / `chip.lista` | Quitar filtro: {valor} / Filtros activos |
| `saltar.resultados` | Saltar a los resultados |
| `filtros.marca` / `.segmento` / `.precio` / `.autonomia` / `.traccion` / `.estado` | Marca / Segmento / Precio / Autonomía mínima (WLTP) / Tracción / Estado |
| `filtros.precioDesde` / `.precioHasta` | Desde (€) / Hasta (€) |
| `filtros.limpiar` | Limpiar filtros |
| `filtros.verModelos` | Ver {n} modelos |
| `filtros.sinJs` | Para filtrar el catálogo hace falta activar JavaScript. Mientras tanto, explora por marca, segmento, precio o autonomía. |
| `filtros.traccionAyuda` | Solo cuentan los modelos con este dato publicado |
| `filtros.errorRango` | El precio mínimo no puede ser mayor que el máximo |
| `orden.etiqueta` | Ordenar por |
| `orden.novedad` / `.precioAsc` / `.precioDesc` / `.autonomiaDesc` | Novedad / Precio: de menor a mayor / Precio: de mayor a menor / Autonomía: de mayor a menor |
| `resumen.n` | {n} modelos (singular: 1 modelo; 0: Ningún modelo) |
| `vacio.titulo` / `vacio.texto` | Ningún modelo cumple los filtros / Prueba a ampliar el precio o a quitar algún filtro. |
| `explorar.titulo` | Explorar |
| `estado.todos` / `.venta` / `.proximamente` / `.descatalogado` | Todos / A la venta / Próximamente / Descatalogado |
| `estado.oferta` / `.sinPrecio` | Precio con oferta / Precio por confirmar |
| `tarjeta.desde` / `.autonomiaHasta` / `.sinAutonomia` / `.sinSegmento` | Desde {precio} / Hasta {km} km WLTP / Autonomía por confirmar / Segmento por confirmar |
| `tarjeta.rotuloPrecio` / `.rotuloAutonomia` / `.rotuloSegmento` | Precio / Autonomía / Segmento (rótulos ocultos de la `dl`, `tarjeta-modelo.md`) |
| `tarjeta.proximamenteFecha` / `tarjeta.foto` | Próximamente · {mes} de {año} / Foto: {atribucion} |

## Preguntas abiertas para Producto
1. ¿Las páginas pregeneradas llevan, además de la franja «Explorar», un enlace «Filtrar más» a `/coches`
   con su criterio precargado en la URL? RF-10 no lo pide y aquí no se añade sin confirmarlo.
2. **Rango de precio:** el PRD no dice si son campos libres o tramos. Se propone dos campos numéricos;
   ¿vale o basta con los tres tramos de RF-10?
3. ¿Debe avisarse al visitante cuando los datos de un modelo están `needs_review`? Aquí no se hace.
4. Si una URL compartida trae valores no válidos, ¿se ignoran en silencio (propuesto) o se avisa?

## Revisión de accesibilidad (RNF-3, WCAG 2.1 AA) — 2026-10-04

| Punto | Criterio | Estado |
|---|---|---|
| Contraste de textos (controles, resumen, error, chips, botones, enlaces) | 1.4.3 | Cumple; mínimo 6,06 (`brand-600` sobre `surface-muted`) |
| Bordes y estado marcado de controles | 1.4.11 | Cumple: `line` 4,39–4,83, `brand-600` 6,06–6,67 |
| Enlaces de «Explorar» y «Saltar» | 1.4.1 | **Corregido**: subrayados (frente a `ink-900` solo 2,66) |
| Foco visible | 2.4.7 | Cumple con el anillo de `tokens.md`; en casillas, la fila entera |
| Foco tras quitar chip o «Limpiar filtros» del panel | 2.4.3 | **Corregido**: destino definido, el foco ya no se pierde |
| Panel móvil «a pantalla completa» | 2.4.3, 2.4.7 | **Corregido**: en el flujo, no capa fija que tape resultados enfocables |
| Nombre del botón «Filtros (n)» y contadores de opciones | 4.1.2, 2.5.3, 1.3.1 | **Corregido**: «Filtros (2 activos)», «Cupra (3 modelos)» |
| Etiqueta del orden | 3.3.2 | **Corregido**: `<label>` visible «Ordenar por» |
| Botón «Limpiar filtros» sin filtros | 1.4.3, 2.4.3 | **Corregido**: no se pinta (antes «deshabilitado/oculto») |
| Error de rango de precio | 3.3.1, 3.3.3, 4.1.3, 1.4.1 | **Corregido**: texto, `aria-invalid`, `role="alert"` al salir del campo |
| Resumen de resultados | 4.1.3 | Cumple; una sola región viva, sin anuncio letra a letra |
| Zonas táctiles | (44 px, decisión propia) | Cumple con `--size-touch` como alto mínimo |
| Reflujo a 320 px | 1.4.10 | Cumple: a 400 % de zoom en 1280 px se usa la disposición móvil |

## Pendientes (no se deciden en diseño)
1. **Anuncio del resumen con el panel móvil abierto.** El resumen está detrás del panel; el anuncio llega por
   la región viva y el botón «Ver {n} modelos» repite la cifra, pero hay que comprobar con VoiceOver (iOS) y
   TalkBack que no se anuncia dos veces. Solo se verifica en dispositivo.
2. **Pausa de escritura del precio.** El tiempo exacto antes de aplicar el filtro mientras se escribe es de
   implementación; se pide que no anuncie cada tecla.
3. **Lista de marcas con scroll interno (> 10 opciones).** La región desplazable contiene casillas enfocables,
   así que se recorre con teclado; axe (`scrollable-region-focusable`) lo confirma en CI.
4. **Prueba de colores forzados** del estado marcado de casillas y del anillo de foco: no se puede comprobar en
   papel.
