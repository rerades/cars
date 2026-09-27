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

- **Escritorio (`lg`)**: panel fijo a la izquierda, 16 rem, con desplazamiento propio; el orden arriba a la derecha.
  Los filtros se aplican al momento (no hay botón «Aplicar»).
- **Móvil / `md`**: el botón «Filtros (n)», con el nº de filtros activos, abre el panel a pantalla completa; dentro
  el botón principal «Ver {n} modelos» lo cierra y «Limpiar filtros» queda a su lado. Los resultados se actualizan
  mientras se elige. El panel es un `<details>`-like/disclosure con `aria-expanded`; al abrirlo el foco pasa a su título
  y al cerrarlo vuelve al botón «Filtros». Con `Esc` se cierra. Sin trampa de foco: es un panel en el flujo, no un modal.
- El orden (RF-3) es un `<select>` nativo: en móvil abre el selector del sistema.

## Controles (RF-2, RF-3, RF-7, RF-11, RF-12)

Cada grupo es un `<fieldset>` con `<legend>` visible. Las etiquetas visibles son las de `filtros.*` del copy.

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
Se actualiza al filtrar; no roba el foco. Filtros activos como **chips** con «×» («Cupra ×»), cada uno un botón de 44 px con
nombre «Quitar filtro: Cupra», debajo del resumen. El «×» va con texto accesible, no solo icono.

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
`role="status"` lo anuncia. Limpiar: quita todos los filtros y el orden vuelve al de por defecto, la URL vuelve a `/coches`,
y el foco pasa al encabezado de resultados (el botón desaparece; sin esto el foco se pierde). También limpia «Limpiar filtros» del panel.
El botón está deshabilitado/oculto si no hay filtros activos.

## Estados y errores
| Situación | Comportamiento |
|---|---|
| Sin filtros | Todos los modelos, orden por defecto («Novedad») |
| URL con un valor no válido (`?autonomia=abc`) | Se ignora ese filtro; no hay página de error. Pregunta 4 |
| Rango de precio con «Desde» > «Hasta» | Mensaje `filtros.errorRango` junto al campo, `aria-describedby`, `aria-invalid`; no se filtra hasta corregirlo |
| Marca con nombre muy largo | La etiqueta parte línea; la casilla queda alineada arriba |
| Lista de marcas larga | Grupo con scroll interno solo a partir de 10 opciones; nunca oculta opciones a los que no usan ratón |
| JS falla o tarda | Se ve la lista completa (HTML) y la franja «Explorar» |

## URL (RF-5, CA-5, CA-13)
Cada cambio actualiza la query string sin recargar y sin crear una entrada de historial por cada casilla
(sustituye la actual). Abrir la URL reproduce el estado: controles marcados, chips y resultados. Los nombres de
parámetro los fija el Desarrollador; se pide que sean legibles en español. Esas URL llevan `noindex` (CA-13).

## Orden de foco
1. Enlace «Saltar a los resultados» (primer elemento de la página, visible al recibir foco).
2. Navegación del sitio.
3. Franja «Explorar» (enlaces).
4. Móvil: botón «Filtros» → (si abierto) grupos en el orden Marca, Segmento, Precio, Autonomía, Tracción, Estado → «Ver n modelos» → «Limpiar filtros». Escritorio: los mismos grupos y «Limpiar filtros».
5. Select de orden.
6. Chips de filtros activos (de izquierda a derecha).
7. Tarjetas, una parada cada una (el enlace del nombre).
Los cambios de resultados **no** mueven el foco, salvo tras «Limpiar filtros» (a `h2` de resultados) y tras cerrar el panel móvil (al botón «Filtros»).
Teclado: Espacio marca casillas y radios; flechas cambian entre radios; Esc cierra el panel móvil.

## Copy propuesto (RNF-4: claves para i18n, sin textos fijos en componentes)
| Clave | Texto |
|---|---|
| `filtros.titulo` | Filtros |
| `filtros.abrir` | Filtros ({n}) |
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

## Preguntas abiertas para Producto
1. ¿Las páginas pregeneradas llevan, además de la franja «Explorar», un enlace «Filtrar más» a `/coches`
   con su criterio precargado en la URL? RF-10 no lo pide y aquí no se añade sin confirmarlo.
2. **Rango de precio:** el PRD no dice si son campos libres o tramos. Se propone dos campos numéricos;
   ¿vale o basta con los tres tramos de RF-10?
3. ¿Debe avisarse al visitante cuando los datos de un modelo están `needs_review`? Aquí no se hace.
4. Si una URL compartida trae valores no válidos, ¿se ignoran en silencio (propuesto) o se avisa?
