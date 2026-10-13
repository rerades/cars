# Comparador

PRD-003 (ready): RF-1 a RF-14, RNF-1 a RNF-6; CA-1 a CA-19. Tokens: [`tokens.md`](tokens.md). Esquema:
`docs/architecture/data-model.md` (ADR-0008). Se apoya en lo ya especificado y no lo repite:

- Formato de cada campo, «por confirmar», «Precio con oferta», «Condiciones de las ofertas», notas de fuente,
  «fuente no oficial», bloque «Fuentes», nombre de la fuente y fechas: sección «Versiones» y «Fuente y fecha»
  de [`ficha-modelo.md`](ficha-modelo.md). Aquí solo se dice qué cambia.
- Márgenes y anchos de página, `<title>`, estilo de enlaces y regla de «texto muy largo»:
  [`paginas-catalogo.md`](paginas-catalogo.md).
- Etiquetas de tracción: [`filtros-catalogo.md`](filtros-catalogo.md). Etiquetas de estado y su formato de fecha:
  [`ficha-modelo.md`](ficha-modelo.md), «Cabecera de la ficha».
- La acción «Comparar» de la tarjeta y de la ficha se define aquí (más abajo) y se cita desde
  [`tarjeta-modelo.md`](tarjeta-modelo.md) y [`ficha-modelo.md`](ficha-modelo.md).

**Fuera de este documento:** cómo llegan los datos al navegador lo decide
[ADR-0014](../architecture/adr/0014-datos-y-script-del-comparador.md) (aceptada el 2026-10-13): el script lee
la URL y pide a `/comparar/datos/` un JSON por modelo citado. Por eso existen los estados «cargando» y
«error de carga» (sección de estados).

Componentes de Bearnie (ADR-0005): Table para la comparación, Badge para las etiquetas, Button para «Añadir» y
«Quitar», Select (o `<select>` nativo con los roles de `tokens.md`) para elegir coche y versión, Alert/Empty
para los avisos. JavaScript **solo** en `/comparar/` (RNF-6, ADR-0003); las acciones «Comparar» de la tarjeta y
de la ficha son `<a href>` normales.

Lo que el comparador **no** hace (RF-13, CA-15; PRD-003, decisiones 3 y 7): no resalta filas ni celdas que
difieren, no marca mejor ni peor, no ordena columnas por ningún dato, no calcula diferencias ni puntuaciones,
no guarda la selección (ni cookies, ni `localStorage`, ni `sessionStorage`: RF-10, RNF-4, CA-12). Ningún
estilo de celda depende de su valor.

## URL, título e indexación (RF-10, RF-14, CA-11, CA-16)

### Forma de la URL
Las versiones no tienen identificador propio (PRD-003, sección 6): se identifican por marca, slug del modelo y
`name`. La URL lleva un parámetro `v` **repetido**, uno por columna, **en el orden de las columnas**:

```
/comparar/?v={marca}/{modelo}/{name}&v={marca}/{modelo}/{name}[&v=…]
```

- `{marca}` y `{modelo}` son la ruta de `data/raw/` (`data/raw/cupra/tavascan.yaml` → `cupra/tavascan`), la
  misma que la URL de la ficha. Son slugs `[a-z0-9-]`, así que no llevan `/`.
- `{name}` es `versions[].name` **literal**, sin normalizar (mayúsculas, acentos, paréntesis y signos tal
  cual): «Tavascan (58 kWh, 140 kW)», «Born+ (190 CV)», «techno 220 CV autonomía confort».
- Se escribe y se lee con `URLSearchParams` (el valor entero de `v` codificado: `/` → `%2F`, espacio → `+`,
  `+` → `%2B`). Al leer, el valor ya decodificado se parte por los **dos primeros** `/`: lo que queda es el
  `name`, aunque contenga `/`.
- **Forma corta, solo modelo:** `v={marca}/{modelo}` (sin `name`) incluye ese modelo con su versión por defecto
  (RF-8: la de precio más bajo; si ninguna tiene precio, la primera del fichero). Es la que usan las acciones
  «Comparar» de la tarjeta y de la ficha, para no fijar en el HTML estático una versión que puede dejar de ser
  la más barata.
- Ejemplo de comparación de dos versiones:
  `/comparar/?v=cupra%2Ftavascan%2FTavascan+VZ&v=polestar%2Fpolestar-2%2FStandard+Range+Single+Motor+%28con+Climate+Pack%29`

### La URL refleja siempre la tabla
- Tras leer la URL al cargar, y tras añadir, quitar o cambiar de versión, la página **reescribe la URL** con
  la forma completa (`marca/modelo/name`) de las columnas visibles, en su orden, con `history.replaceState`.
  Así la barra de direcciones es siempre el enlace para compartir (RF-10, CA-9: «la URL cambia con ella»).
- `replaceState` y no `pushState`: cada cambio no crea una entrada de historial, y «atrás» devuelve a la página
  de la que se vino (catálogo o ficha), no a cada estado intermedio de la tabla.
- Las versiones ignoradas (RF-11) desaparecen de la URL reescrita; el aviso se queda en pantalla hasta el
  siguiente cambio.
- Nada más se guarda: el historial lo lleva el navegador, la web no escribe en ningún almacenamiento (RNF-4).

### Título y cabeceras
- `h1` = `comparador.titulo`: «Comparar coches».
- `<title>` = `pagina.tituloDocumento` con ese `h1`: «Comparar coches · {sitio}». No cambia con la selección:
  la página no se indexa y el título no se usa para distinguir comparaciones.
- `<meta name="robots" content="noindex">` y `<link rel="canonical" href="https://siete3.com/comparar/">` **sin parámetros**, en
  el HTML servido, con cualquier selección (RF-14, CA-16). El JS no los toca.

## Estructura y orden de lectura

Orden del DOM = orden visual = orden de lectura (WCAG 1.3.2) en todas las anchuras.

1. Cabecera y navegación del sitio (fuera de esta especificación).
2. `<main>`:
   1. `h1` «Comparar coches» y una línea de entrada (`comparador.entrada`, `text-body`, `ink-600`).
   2. **Avisos** (RF-11, CA-2, CA-13): solo si la URL traía versiones que no se han podido incluir o más de 3.
   3. **Coches comparados** (`h2`, RF-8, RF-9, RF-12): lista de las columnas con su versión y «Quitar», y
      debajo el formulario «Añadir» o el texto de máximo alcanzado. Con menos de 2 versiones, aquí va además el
      estado de RF-12 (ver «Estados»).
   4. **Comparación** (`h2`, RF-1 a RF-5): la tabla, y debajo «Condiciones de las ofertas» (`h3`) si alguna
      versión tiene precio con oferta. Solo con 2 o 3 versiones.
   5. **Fuentes** (`h2`, RF-4): solo con 2 o 3 versiones.
3. Pie del sitio.

Una región `role="status"` oculta visualmente, al final de `main`, anuncia los cambios (ver «Lector de
pantalla»).

Encabezados: un `h1`; `h2` por bloque de `main`; `h3` para «Condiciones de las ofertas».

### Por qué los controles van fuera de la tabla
A 320 px cada columna de la tabla mide unos 96 px (ver «Anchura»): no caben un `<select>` con nombres de
versión como «Long Range Dual Motor MY2025 km0 (Pilot Pack y Plus Pack)» ni dos zonas táctiles de 44 px por
columna. Por eso cambiar de versión y quitar se hacen en la lista «Coches comparados», a todo el ancho, y la
tabla solo muestra datos y el enlace a la ficha.

### Wireframe

```
Móvil (320 px, 3 versiones)            Escritorio (≥ 1024 px, 3 versiones)
┌──────────────────────────┐           ┌──────────────────────────────────────────────────────────┐
│ h1 Comparar coches       │           │ h1 Comparar coches                                       │
│ Hasta 3 versiones, una…  │           │ Hasta 3 versiones, una al lado de otra. Precios en…      │
│                          │           │                                                          │
│ h2 Coches comparados     │           │ h2 Coches comparados                                     │
│ 1. Cupra Tavascan        │           │ 1. Cupra Tavascan     Versión [Tavascan VZ        ▾] [Quitar]│
│    Versión               │           │ 2. Polestar Polestar 2 Versión [Standard Range…   ▾] [Quitar]│
│    [Tavascan VZ      ▾]  │           │ 3. Kia EV3            Versión [EV3 Air            ▾] [Quitar]│
│    [Quitar]              │           │ Ya comparas 3 coches, el máximo. Quita uno para añadir…  │
│ 2. Polestar Polestar 2   │           │                                                          │
│    …                     │           │ h2 Comparación                                           │
│ 3. Kia EV3 …             │           │ ┌──────────────────┬──────────────────┬──────────────────┐│
│ Ya comparas 3 coches, el │           │ │ Cupra            │ Polestar         │ Kia              ││
│ máximo. Quita uno para   │           │ │ Tavascan (enl.)  │ Polestar 2 (enl.)│ EV3 (enl.)       ││
│ añadir otro.             │           │ │ Tavascan VZ      │ Standard Range…  │ EV3 Air          ││
│                          │           │ ├──────────────────┴──────────────────┴──────────────────┤│
│ h2 Comparación           │           │ │ Precio                                                 ││
│ ┌───────┬───────┬──────┐ │           │ ├──────────────────┬──────────────────┬──────────────────┤│
│ │Cupra  │Polest.│Kia   │ │           │ │ Precio por       │ 46.900 € [Precio │ 35.990 €         ││
│ │Tavas- │Pole-  │EV3   │ │           │ │ confirmar        │ con oferta]      │ Fuente: kia.com, ││
│ │can    │star 2 │EV3   │ │           │ │                  │ Fuente: …        │ 5 oct 2026       ││
│ │Tavas- │Stand- │Air   │ │           │ ├──────────────────┴──────────────────┴──────────────────┤│
│ │can VZ │ard R… │      │ │           │ │ Autonomía WLTP                                         ││
│ ├───────┴───────┴──────┤ │           │ ├──────────────────┬──────────────────┬──────────────────┤│
│ │ Precio               │ │           │ │ 533 km [1]       │ por confirmar    │ 436 km [2]       ││
│ ├───────┬───────┬──────┤ │           │ │ …                │                  │                  ││
│ │Precio │46.900 │35.990│ │           │ └──────────────────┴──────────────────┴──────────────────┘│
│ │por    │€      │€     │ │           │ h3 Condiciones de las ofertas                            │
│ │confir.│[Precio│Fuente│ │           │ h2 Fuentes                                               │
│ │       │con    │: kia…│ │           │ 1. cupra.com, consultado el 24 sep 2026. https://…       │
│ │       │oferta]│      │ │           └──────────────────────────────────────────────────────────┘
│ ├───────┴───────┴──────┤ │
│ │ Autonomía WLTP       │ │
│ │ …                    │ │
│ └──────────────────────┘ │
│ h3 Condiciones…          │
│ h2 Fuentes               │
└──────────────────────────┘
```

(Cifras del dibujo ilustrativas; en pantalla salen del dato.)

## Coches comparados: elegir, cambiar y quitar (RF-8, RF-9, CA-9, CA-10)

`<section aria-labelledby>` con `h2` `comparador.elegidos.titulo` «Coches comparados». Siempre presente, con
cualquier número de versiones (0 a 3).

### Lista de columnas
- `<ol>`, un `<li>` por columna, en el orden de la URL (= orden de las columnas de la tabla). El número de la
  lista es el de la columna.
- Cada `<li>`, en este orden:
  1. **Marca y modelo** (`brand_name` + `model`), `--text-card-title`, `ink-900`. Texto, no enlace (el enlace a
     la ficha está en la tabla; repetirlo sumaría paradas de foco).
  2. **Versión**: si el modelo tiene 2 o más versiones, un `<select>` con `<label>` visible
     `comparador.version.rotulo` «Versión» y nombre accesible completo `comparador.version.sr`
     «Versión de {marca} {modelo}, columna {n}». Opciones: los `name` de **todas** las versiones del modelo, en
     el orden de la ficha (por precio ascendente; sin precio al final, en el orden del fichero). La versión
     elegida en otra columna aparece **deshabilitada** y con el sufijo `comparador.version.yaIncluida`
     « (ya está en la comparación)», en texto, no solo en gris (RF-9: la misma versión no puede estar dos
     veces). Las opciones no llevan precio ni otros datos (irían sin fuente).
     Si el modelo tiene **una sola** versión: no hay `<select>`; se muestra «Versión: {name}»
     (`comparador.version.unica`), `text-body`, `ink-900`.
  3. **«Quitar»** (`comparador.quitar`): Button secundario (roles de `tokens.md`: `surface`, `ink-900`, borde
     `line`), `min-height: --size-touch`. Texto oculto visualmente `comparador.quitarSr`: « {marca} {modelo},
     {name}, de la comparación» → nombre accesible «Quitar Cupra Tavascan, Tavascan VZ, de la comparación».
- Disposición: móvil, todo apilado (marca y modelo, rótulo, `<select>` a todo el ancho, «Quitar» debajo,
  alineado a la izquierda). Desde `md`, en una fila: marca y modelo, «Versión» + `<select>` (ancho máximo
  `--width-version-col-max`), «Quitar» a la derecha; si no cabe, parte línea (flex con salto), nunca scroll.
  Separación entre elementos `2`, entre `<li>` `4`, línea `line-soft` entre ellos (decorativa).
- Nombres de versión largos: dentro del `<select>` el navegador los recorta en la caja cerrada, pero la lista
  desplegada los muestra enteros y el nombre completo también está en la cabecera de la columna de la tabla.

### Cambiar de versión (RF-8, CA-9)
- Al cambiar el `<select>` se aplica **en el momento**: la columna de la tabla pasa a la nueva versión, se
  renumeran las notas de fuente, se reescribe la URL y la región de estado anuncia
  `comparador.anuncio.cambio` «Columna {n}: {marca} {modelo}, {name}.». El foco se queda en el `<select>`.
  No es un cambio de contexto (no hay navegación ni salto de foco: WCAG 3.2.2).
- La columna no se mueve de sitio: conserva su posición en la tabla y en la URL.

### Quitar (RF-9, CA-10)
- Quita la columna de la lista, de la tabla y de la URL; las demás conservan su orden.
- Foco después de quitar: al «Quitar» del `<li>` que ocupa ahora esa posición; si era el último, al del
  anterior; si no queda ninguno, al `<select>` de «Añadir». Nunca se pierde en el `<body>`.
- Anuncio `comparador.anuncio.quitado`: «Se ha quitado {marca} {modelo}, {name}. Quedan {n}.».
- Si quedan menos de 2, la tabla, sus condiciones y «Fuentes» desaparecen y aparece el estado de RF-12.

### Añadir (RF-8, RF-9, CA-7, CA-10)
Debajo de la lista, mientras haya menos de 3 columnas: un `<form>` (sin envío al servidor; el JS lo
intercepta) con:

- `<label>` `comparador.anadir.rotulo` «Coche para añadir» y un `<select>`:
  - Primera opción vacía y seleccionada: `comparador.anadir.elige` «Elige un coche».
  - Un `<optgroup>` por marca (`label` = `brand_name`), en orden alfabético de marca; dentro, los modelos por
    orden alfabético de `model`. Texto de la opción: `model`; si es `announced`, con el sufijo
    `comparador.anadir.proximamente` « (Próximamente)» (RF-2: el estado se dice con texto).
  - Solo modelos comparables (RF-11): publicados (`needs_review` no es `true`) y con `status` `on_sale` o
    `announced`, y con al menos una versión (cada columna es una versión, RF-1; ver Pregunta 2). Los
    descatalogados no aparecen ni deshabilitados (CA-13).
  - Un modelo con **todas** sus versiones ya en la comparación aparece deshabilitado con el sufijo
    `comparador.anadir.completo` « (todas sus versiones ya están en la comparación)».
- Button principal `comparador.anadir.boton` «Añadir» (`brand-600` / `on-brand`, `min-height: --size-touch`).
  Al lado del `<select>` desde `md`; debajo en móvil.
- Pulsar «Añadir» sin elegir coche: no hace nada salvo el mensaje `comparador.anadir.sinEleccion`
  «Elige un coche de la lista.» junto al campo, en `ink-900`, con `aria-invalid="true"` y
  `aria-describedby` en el `<select>` (como el error de rango de `filtros-catalogo.md`; sin color de error).
- **Qué versión entra** (RF-8): la de precio más bajo del modelo (incluye `financed`); si ninguna tiene precio,
  la primera del fichero. Si **esa** versión ya está en la comparación, entra la siguiente en el orden de la
  ficha que no esté (RF-9 impide repetirla; ver Pregunta 3). La nueva columna va **al final**.
- Tras añadir: el `<select>` vuelve a «Elige un coche», el anuncio `comparador.anuncio.anadido` dice «Se ha
  añadido {marca} {modelo}, {name}, en la columna {n}.» y el foco va al `<select>` de versión del nuevo `<li>`
  (o a su `<li>` con `tabindex="-1"` si tiene una sola versión), para poder cambiarla al momento.
- Con el formulario no se llega nunca a 4: al llegar a 3 desaparece.

### Con 3 columnas: añadir no está disponible (RF-9, CA-10)
En lugar del formulario, un párrafo `comparador.maximo`: «Ya comparas 3 coches, el máximo. Quita uno para
añadir otro.» `text-body`, `ink-900`. No se deja el formulario deshabilitado: un control deshabilitado no
recibe foco y el lector no explica por qué; el texto sí.

## Comparación: la tabla (RF-1 a RF-5, RF-13, CA-1, CA-3 a CA-6, CA-15)

`<section aria-labelledby>` con `h2` `comparador.tabla.titulo` «Comparación». Debajo,
`comparador.tabla.entrada` (`text-small`, `ink-600`): «Precios en España con IVA y sin ayudas. Las columnas
siguen el orden que has elegido.» (RF-5, RF-13).

### Una sola estructura en todas las anchuras
A diferencia de la ficha (tabla en `lg`, bloques debajo), el comparador usa **la misma tabla en todas las
anchuras**: el JS pinta una sola estructura, sin duplicados, y la comparación lado a lado es justo lo que pide
RF-1. Para que quepan 3 columnas en 320 px, **los rótulos de campo no ocupan columna**: cada campo es una fila
de rótulo a todo el ancho seguida de una fila con un valor por versión.

```
<table>
  <caption> (oculta visualmente)  comparador.tabla.caption
  <thead><tr>
    <th scope="col" id="cmp-col-1"> Cupra / Tavascan (enlace a la ficha) / Tavascan VZ / [badge estado] </th>
    <th scope="col" id="cmp-col-2"> … </th>
  </tr></thead>
  <tbody>                                   ← uno por campo, en el orden de la tabla de campos
    <tr><th colspan="{n}" id="cmp-f-precio">Precio</th></tr>
    <tr><td headers="cmp-col-1 cmp-f-precio">…</td><td headers="cmp-col-2 cmp-f-precio">…</td></tr>
  </tbody>
  …
</table>
```

- La asociación de cada celda con su versión y su campo va por `headers` explícitos (WCAG 1.3.1): con la fila
  de rótulo a todo el ancho, `scope` no basta.
- Aquí sí hay `id` dentro de la tabla (no hay segunda presentación que los duplique). Prefijo `cmp-` para no
  chocar con otros de la página.
- `table-layout: fixed`, columnas de **igual ancho** (1/2 o 1/3), sin preferencia visual por ninguna (RF-13).
  Ancho de la tabla: el del contenido, con un máximo de `{n} × --width-version-col-max` (2 columnas: 40 rem;
  3: 60 rem), alineada a la izquierda.
- Fila de rótulo de campo: `surface-muted`, `text-small` peso 600, `ink-900` (16,12). Fila de valores y
  cabecera de columnas: `surface`. Separación entre filas `line-soft` (decorativa); separación vertical entre
  columnas `line-soft`. Celdas alineadas arriba y a la izquierda. Relleno de celda: `2` en móvil, `3` desde `md`.
- Ninguna celda, fila ni columna cambia de color, peso o borde según su valor (RF-13, CA-15).

### Cabecera de cada columna (RF-1, RF-2, CA-1)
En este orden, dentro del `<th scope="col">`:
1. Marca (`brand_name`), `text-small`, `ink-600`, línea propia.
2. Modelo (`model`), `--text-card-title`, como **enlace a la ficha** `/marcas/{marca}/{modelo}/` (`brand-600`,
   subrayado, hover `brand-800`). La marca va dentro del enlace (como en la tarjeta) para que su nombre sea
   «Cupra Tavascan»; texto oculto `comparador.fichaSr` « (ficha del modelo)». Zona táctil: relleno vertical
   hasta `--size-touch` de alto.
3. Nombre de la versión (`name`), `text-body` peso 600, `ink-900`.
4. Estado del modelo (fila «Estado» de la sección 6 de PRD-003): solo si es `announced`, Badge `soon` con las
   claves y el formato de la ficha («Próximamente · oct 2026» o «Próximamente»), seguido de su marca de nota
   (`status` y `launch`). `on_sale` no lleva etiqueta ni nota (RF-2). El estado va en la cabecera y no en una
   fila propia para no dejar celdas vacías en las columnas `on_sale` (RF-3: ninguna celda vacía).

La fila de cabecera no es fija (`sticky`): con nombres largos ocuparía media pantalla a 320 px. Ver Pregunta 5.

### Filas y formato (RF-2 a RF-5, CA-3 a CA-6)
Mismo orden, rótulos y formato que la tabla de campos de `ficha-modelo.md` («Campos y formato»), con las
mismas claves `ficha.campo.*`:

| # | Fila | Campo | Sin dato |
|---|---|---|---|
| 1 | Precio | `price` (+ `price_kind`, `price_terms`, `price_terms_url`) | «Precio por confirmar» |
| 2 | Autonomía WLTP | `wltp_km` | «por confirmar» |
| 3 | Batería | `battery_kwh` + `basis` («, útil», «, bruta», «, sin especificar si es útil o bruta») | «por confirmar» |
| 4 | Potencia | `power_kw` | «por confirmar» |
| 5 | Tracción | `drivetrain` (Delantera / Trasera / Total) | «por confirmar» |
| 6 | Carga máxima en CC | `dc_max_kw` | «por confirmar» |
| 7 | Carga máxima en CA | `ac_max_kw` | «por confirmar» |

- **«por confirmar»**: `ink-600`, sin nota de fuente, sin cifra (CA-4). La fila no se oculta nunca, aunque
  ninguna columna tenga el dato (RF-3, CA-4). Nunca se rellena con `specs` del modelo: el comparador no muestra
  `specs` (RF-2 limita los campos a los de versión).
- **Precio**: igual que «El precio, en detalle» de la ficha, sin «Último precio publicado» (los descatalogados
  no entran, RF-11): valor en `--text-price`; Badge `deal` «Precio con oferta» si es `financed` (baja de línea si
  no cabe); «Fuente: {fuente}, {fecha}» con el enlace a `price.url`; si es `financed`, el enlace «Ver condiciones
  de la oferta» a `#cmp-condiciones-{n}`. PVP sin etiqueta (RF-5, CA-6). El espacio entre la cifra y «€» es
  normal, no de no separación, para que en una columna de 80 px pueda partir.
- **`note`** de cualquier dato: debajo del valor, en la misma celda, `text-small`, `ink-600`, idéntica al
  fichero (RF-5, CA-6).
- **«fuente no oficial»**: detrás de la marca de nota del dato no T1, como en la ficha (RF-4, CA-5). Hoy lo
  llevarían, por ejemplo, los datos de Tesla que vienen de `hibridosyelectricos.com` (T3).
- Etiquetas (Badge) dentro de columnas estrechas: pueden partir en varias líneas; para que no se deformen, en
  esta tabla usan `--radius-control` en lugar del radio de píldora.

### Condiciones de las ofertas (RF-5, CA-6)
Igual que en la ficha (fuera de la tabla, siempre visible, texto literal completo), dentro de la sección
«Comparación» y después de la tabla. `h3` `ficha.condiciones.titulo`. Una entrada por columna con `financed`, en
el orden de las columnas, con id `cmp-condiciones-{n}` (n = número de columna) y `tabindex="-1"`; su título
es «{marca} {modelo}, {name}» (`comparador.condiciones.entrada`), porque aquí hay versiones de varios modelos.
Si dos columnas comparten exactamente el mismo `price_terms`, se repite: cada entrada pertenece a su columna.

### Anchura y reflujo (RNF-1, CA-17)
- **320 px, 3 columnas:** contenido útil 288 px (320 − 2 × 16 de margen) → unos 96 px por columna, 80 px de
  texto con relleno `2`. Caben sin scroll horizontal de la página: las cifras más anchas («36.273 €» en
  `--text-price`) rondan los 70–85 px y, si no, parten antes de «€». Nombres, notas, dominios largos
  («hibridosyelectricos.com») y `note` parten con `overflow-wrap: anywhere`. Nada se recorta con «…» y no hay
  scroll horizontal ni en la tabla ni en la página.
- No se usa la alternativa de RNF-1 (tabla con scroll propio o presentación distinta): la tabla de 3 columnas
  cumple a 320 px y conserva la comparación lado a lado.
- Texto ampliado al 200 % (WCAG 1.4.4) a 320 px: las columnas siguen sin desbordar, a costa de muchas líneas
  por celda. Ver Pendientes.

## Fuentes y notas (RF-4, CA-5)

Las reglas son las de «Fuente y fecha» de la ficha (qué lleva nota, marca «[n]», «fuente no oficial»,
agrupación por `source_id` + `url` + `retrieved` + `tier`, bloque «Fuentes», nombre de la fuente = dominio,
fechas con mes corto), con dos cambios:

- **Numeración en orden de lectura de la tabla**: primero la fila de cabecera (estado y `launch` de cada
  columna, de izquierda a derecha), luego cada fila de campo de arriba abajo y, dentro, las columnas de
  izquierda a derecha. Así los números crecen en el orden en que se leen.
- Anclas `#cmp-fuente-{n}` (`<li id="cmp-fuente-{n}" tabindex="-1">`).
- Tras añadir, quitar o cambiar de versión, las notas y el bloque «Fuentes» se **recalculan** con las mismas
  reglas: un número identifica una fuente dentro de la comparación visible.

`h2` `ficha.fuentes.titulo` «Fuentes» y entrada `ficha.fuentes.entrada`. Solo existe con 2 o 3 versiones.

## Estados

| Situación | Qué se ve | Requisito |
|---|---|---|
| Sin JavaScript | Ver «Sin JavaScript» | RNF-6, CA-19 |
| Cargando (mientras llegan los JSON de ADR-0014) | `h1`, entrada y `comparador.cargando` «Cargando la comparación…» en un `role="status"`; sin tabla ni lista a medias | RNF-6 |
| Error al cargar los datos (falla alguna petición de ADR-0014) | `comparador.error`: «No se ha podido cargar la comparación. Vuelve a cargar la página o ve al catálogo.» con enlace a `/coches`, `ink-900`; sin tabla | RNF-6 |
| 0 versiones (`/comparar/` sin `v`, o todas inválidas) | «Coches comparados» con la lista vacía (no se pinta la `<ol>`), el texto de RF-12, el formulario «Añadir» y el enlace al catálogo; sin «Comparación» ni «Fuentes» | RF-12, CA-14 |
| 1 versión | La lista con ese coche (versión y «Quitar»), el texto de RF-12, «Añadir» y el enlace al catálogo; sin tabla | RF-12, CA-14 |
| 2 versiones | Lista, «Añadir», tabla de 2 columnas, condiciones y «Fuentes» | RF-1 |
| 3 versiones | Lista, texto de máximo en lugar de «Añadir», tabla de 3 columnas | RF-1, RF-9, CA-10 |
| URL con versiones no válidas | Aviso de RF-11 encima de «Coches comparados»; se muestran las válidas | RF-11, CA-13 |
| URL con más de 3 válidas | Las 3 primeras válidas y el aviso de máximo; nunca 4 columnas | RF-11, CA-2 |
| Dos versiones del mismo modelo | Permitido: dos columnas con la misma marca y modelo y distinto `name` | RF-9, CA-10 |
| Campo sin dato | «por confirmar» / «Precio por confirmar» | RF-3, CA-4 |
| Precio con oferta | Badge, fuente, «Ver condiciones de la oferta» y condiciones debajo de la tabla | RF-5, CA-6 |
| Dato no T1 | «fuente no oficial» junto a la marca de nota y en «Fuentes» | RF-4, CA-5 |
| Modelo `announced` | Badge «Próximamente…» en la cabecera de su columna; « (Próximamente)» en «Añadir» | RF-2 |
| `open_questions`, `needs_review` | No se muestran nunca | Sección 6 |
| Texto muy largo | Nombres de versión, notas, dominios, `price_terms`: parten línea, nunca se recortan ni se reduce la letra | RNF-1 |

### Menos de 2 versiones (RF-12, CA-14)
Dentro de «Coches comparados», antes del formulario (Empty de Bearnie, sin icono):

- `comparador.vacio.texto`: «Para comparar hacen falta al menos 2 coches. Añádelos aquí o elígelos en el
  catálogo.» (`text-body`, `ink-900`). Con 1 versión: `comparador.vacio.unoMas` «Añade al menos un coche más
  para ver la comparación.»
- El formulario «Añadir».
- Enlace `comparador.vacio.catalogo` «Ver el catálogo» → `/coches` (enlace de texto subrayado, `brand-600`,
  `--size-touch` de alto).

No hay tabla vacía, ni cabeceras sin columnas, ni «Fuentes» vacío.

### Avisos de la URL (RF-11, CA-2, CA-13)
Encima de «Coches comparados», un bloque de aviso (Alert de Bearnie, variante informativa): fondo
`surface-muted`, borde `line`, texto `ink-900` (16,12), relleno `4`, `--radius-card`. Empieza por la palabra
«Aviso:» en peso 600 (`comparador.aviso.prefijo`): el tipo se dice con texto, no con color ni icono.

- Versiones ignoradas (no existen, modelo excluido o repetida): `comparador.aviso.ignoradas`
  «No se ha podido incluir {n} {n, plural, one {coche} other {coches}} del enlace: no está en el catálogo, ya no
  se puede comparar o estaba repetido.» No se repite el texto de la URL en pantalla (es texto arbitrario de
  quien hizo el enlace); basta el número.
- Más de 3: `comparador.aviso.maximo` «El enlace tenía más de 3 coches. Se muestran los 3 primeros.»
- Si se dan los dos, dos párrafos dentro del mismo bloque.
- Se pinta al cargar, antes de que el visitante actúe: no es una región viva (se lee en el orden normal). Se
  quita en el siguiente cambio (añadir, quitar, cambiar), porque ya no describe la URL.
- Ningún caso da error ni página en blanco (CA-13).

### Sin JavaScript (RNF-6, CA-19)
El HTML servido de `/comparar/` contiene, sin depender de JS: el `h1`, la entrada y un aviso con el mismo
estilo que el de la URL:

- `comparador.sinJs.texto`: «El comparador necesita JavaScript para leer los coches de la dirección y montar la
  tabla. Puedes consultar los mismos datos en las fichas del catálogo.»
- Enlace `comparador.sinJs.enlace` «Ir al catálogo» → `/coches`.

Con JS, el script retira ese aviso y monta la página. Que el aviso esté en el HTML (y no en `<noscript>`) hace
que también aparezca si el script no llega a ejecutarse. Ningún mensaje de error del navegador a la vista.

## La acción «Comparar» en la tarjeta y en la ficha (RF-6, RF-7, RF-11, RNF-6, CA-7, CA-8, CA-13)

Es un **enlace `<a href>` normal**, no un botón ni un control de JS: funciona sin JavaScript (lleva a
`/comparar/`, que entonces muestra su aviso). Destino: `/comparar/?v={marca}/{modelo}` (forma corta, ver
«Forma de la URL»), que incluye el modelo con su versión por defecto (RF-8).

- **Aspecto**: enlace de texto, `brand-600`, subrayado siempre, hover `brand-800`, `text-body`. **No** es un
  botón: sin fondo, sin borde, sin icono de carrito ni de flecha; no se confunde con un enlace de compra (CA-8;
  la web no vende, visión). Misma pestaña.
- **Texto visible** «Comparar» (`comparar.accion`) y nombre accesible completo con texto oculto
  `comparar.accionSr` « {marca} {modelo} con otros coches» → «Comparar Cupra Tavascan con otros coches»
  (empieza por el texto visible, WCAG 2.5.3).
- Zona táctil `--size-touch` de alto (relleno vertical).
- **Solo en modelos comparables** (RF-11, CA-13): `on_sale` o `announced`, publicados y con al menos una
  versión. Un modelo `discontinued` no lleva el enlace (ni deshabilitado ni con texto alternativo).

### En la tarjeta (RF-6, CA-7)
- Última línea de la tarjeta, después del segmento, alineada a la izquierda.
- La tarjeta ya es un enlace a la ficha que se extiende con un pseudo-elemento. «Comparar» va **por encima** de
  ese pseudo-elemento (posición relativa y capa superior, como el enlace de la atribución, ADR-0012), así que se
  pulsa él y no la ficha; el resto de la tarjeta sigue llevando a la ficha (CA-7).
- La tarjeta pasa a tener **dos paradas de foco**: el enlace a la ficha y «Comparar», en ese orden.
- El anillo de foco de la tarjeta entera aparece solo cuando tiene el foco **el enlace a la ficha**
  (`:has(> … a.enlace-ficha:focus-visible)`, no `:has(a:focus-visible)` a secas). «Comparar» lleva su propio
  anillo (`tokens.md`). El hover de la tarjeta (borde `brand-600`) no se aplica mientras el puntero está sobre
  «Comparar».
- Desde la portada: «Comparar» en una tarjeta (1), elegir coche en «Añadir» (2), «Añadir» (3) → comparación de
  dos coches en 3 interacciones (CA-7; objetivo de la sección 2 de PRD-003). Si la tarjeta está en `/coches` y
  no en la portada, se suma la navegación a `/coches`; ver Pregunta 4.

### En la ficha (RF-7, CA-8)
- En la cabecera de la ficha, **después** de «Ver en la web de la marca», en su propia línea, con el mismo
  estilo de enlace de texto. Separados para que no se lean como un par de acciones de compra.
- Texto oculto con el modelo, como en la tarjeta.

## Orden de foco

1. Enlace de salto y navegación del sitio.
2. Aviso de la URL o de sin JavaScript: su enlace, si lo tiene.
3. «Coches comparados»: por cada `<li>`, el `<select>` de versión (si lo hay) y «Quitar»; después el `<select>`
   de «Añadir» y «Añadir» (o nada si está el texto de máximo); con menos de 2, el enlace «Ver el catálogo».
4. Tabla: los enlaces de la cabecera (ficha de cada columna y marcas de nota del estado), y después fila a fila
   y de izquierda a derecha: enlace de fuente del precio, «Ver condiciones de la oferta», marcas de nota.
5. «Condiciones de las ofertas»: enlace a `price_terms_url` de cada entrada.
6. «Fuentes»: el enlace de cada nota.

Destinos de ancla (`#cmp-condiciones-{n}`, `#cmp-fuente-{n}`) con `tabindex="-1"`. Ningún control aparece solo
al pasar el ratón.

## Lector de pantalla

- Landmarks: `main`; las tres secciones, nombradas por su `h2`.
- La tabla tiene `caption` `comparador.tabla.caption`: «Comparación de {n} versiones, una por columna». Cada
  celda se anuncia con su columna y su campo: «Cupra Tavascan Tavascan VZ, Precio, Precio por confirmar».
- **Región de estado** (`role="status"`, `aria-live="polite"`, oculta visualmente, siempre en el DOM desde la
  carga y vacía): anuncia añadir, quitar y cambiar de versión con los textos `comparador.anuncio.*`. Un mensaje
  por acción, sin repetir la tabla.
- El cambio de URL no se anuncia (no hay nada que el visitante tenga que hacer).
- Las etiquetas se leen como texto («Próximamente · oct 2026», «Precio con oferta», «fuente no oficial»,
  «por confirmar», « (ya está en la comparación)»); nada depende del color (RNF-1, CA-17).

## Copy (RNF-3: claves para i18n, sin textos fijos en los componentes)

Se reutilizan sin duplicar: `ficha.campo.*`, `ficha.porConfirmar`, `ficha.bateria.*`, `ficha.unidad.*`,
`ficha.precio.oferta`, `ficha.precio.porConfirmar`, `ficha.precio.fuente`, `ficha.precio.verCondiciones`,
`ficha.condiciones.titulo`, `ficha.condiciones.enlace`, `ficha.estado.*`, `ficha.nota.*`, `ficha.fuentes.*`,
`fecha.*`, `pagina.tituloDocumento` y las etiquetas de tracción de `filtros-catalogo.md`.

| Clave | Texto |
|---|---|
| `comparador.titulo` | Comparar coches |
| `comparador.entrada` | Hasta 3 versiones, una al lado de otra, con la fuente de cada dato. Para compartir la comparación, copia la dirección de esta página. |
| `comparador.elegidos.titulo` | Coches comparados |
| `comparador.version.rotulo` | Versión |
| `comparador.version.sr` | Versión de {marca} {modelo}, columna {n} |
| `comparador.version.unica` | Versión: {nombre} |
| `comparador.version.yaIncluida` | (ya está en la comparación) |
| `comparador.quitar` | Quitar |
| `comparador.quitarSr` | {marca} {modelo}, {nombre}, de la comparación |
| `comparador.anadir.rotulo` | Coche para añadir |
| `comparador.anadir.elige` | Elige un coche |
| `comparador.anadir.proximamente` | (Próximamente) |
| `comparador.anadir.completo` | (todas sus versiones ya están en la comparación) |
| `comparador.anadir.boton` | Añadir |
| `comparador.anadir.sinEleccion` | Elige un coche de la lista. |
| `comparador.maximo` | Ya comparas 3 coches, el máximo. Quita uno para añadir otro. |
| `comparador.tabla.titulo` | Comparación |
| `comparador.tabla.entrada` | Precios en España con IVA y sin ayudas. Las columnas siguen el orden que has elegido. |
| `comparador.tabla.caption` | Comparación de {n} versiones, una por columna |
| `comparador.fichaSr` | (ficha del modelo) |
| `comparador.condiciones.entrada` | {marca} {modelo}, {nombre} |
| `comparador.vacio.texto` | Para comparar hacen falta al menos 2 coches. Añádelos aquí o elígelos en el catálogo. |
| `comparador.vacio.unoMas` | Añade al menos un coche más para ver la comparación. |
| `comparador.vacio.catalogo` | Ver el catálogo |
| `comparador.aviso.prefijo` | Aviso: |
| `comparador.aviso.ignoradas` | No se ha podido incluir {n} {n, plural, one {coche} other {coches}} del enlace: no está en el catálogo, ya no se puede comparar o estaba repetido. |
| `comparador.aviso.maximo` | El enlace tenía más de 3 coches. Se muestran los 3 primeros. |
| `comparador.sinJs.texto` | El comparador necesita JavaScript para leer los coches de la dirección y montar la tabla. Puedes consultar los mismos datos en las fichas del catálogo. |
| `comparador.sinJs.enlace` | Ir al catálogo |
| `comparador.cargando` | Cargando la comparación… |
| `comparador.error` | No se ha podido cargar la comparación. Vuelve a cargar la página o ve al catálogo. |
| `comparador.anuncio.anadido` | Se ha añadido {marca} {modelo}, {nombre}, en la columna {n}. |
| `comparador.anuncio.quitado` | Se ha quitado {marca} {modelo}, {nombre}. Quedan {n}. |
| `comparador.anuncio.cambio` | Columna {n}: {marca} {modelo}, {nombre}. |
| `comparar.accion` | Comparar |
| `comparar.accionSr` | {marca} {modelo} con otros coches |

`comparar.*` lo usan la tarjeta y la ficha; `comparador.*`, solo la página.

## Tokens que usa

Color: `surface`, `surface-muted`, `ink-900`, `ink-600`, `line`, `line-soft`, `brand-600`, `brand-800`,
`on-brand`, `soon-*`, `deal-*`. Tipografía: `--text-title`, `--text-section`, `--text-card-title`,
`--text-price`, `--text-body`, `--text-small`, `--text-badge`. Medidas: `--width-page`, `--width-prose`,
`--width-version-col-max`, `--size-touch`, `--size-focus-ring`, `--size-focus-offset`, `--radius-card`,
`--radius-control`.

**No hay tokens nuevos ni colores nuevos.** Pares usados, todos ya calculados en `tokens.md`:

| Par | Uso aquí | Ratio |
|---|---|---|
| `ink-900` / `surface` | Valores, nombres de versión, textos | 17,74 |
| `ink-900` / `surface-muted` | Rótulos de fila, texto del aviso | 16,12 |
| `ink-600` / `surface` | Marca, «por confirmar», `note`, fuente del precio, entradas | 7,56 |
| `brand-600` / `surface` | Enlaces (ficha, notas, «Comparar», catálogo), anillo de foco | 6,67 |
| `brand-600` / `surface-muted` | Enlace dentro del aviso, anillo sobre el aviso | 6,06 |
| `brand-800` / `surface` y `surface-muted` | Hover de enlaces | 9,33 / 8,48 |
| `on-brand` / `brand-600` y `brand-800` | Botón «Añadir» | 6,67 / 9,33 |
| `ink-900` / `surface` + borde `line` | Botón «Quitar», `<select>` | 17,74; borde 4,83 |
| `line` / `surface-muted` | Borde del aviso | 4,39 (≥ 3) |
| `soon-fg` / `soon-bg` | «Próximamente» | 17,74 |
| `deal-fg` / `deal-bg` | «Precio con oferta» | 8,15 |

## Preguntas abiertas para Producto

1. **URLs que se rompen si cambia un `name`.** La URL usa `versions[].name` literal (PRD-003, sección 6). Si el
   Researcher corrige un nombre, los enlaces ya compartidos a esa versión pasan a «no se ha podido incluir»
   (RF-11 lo cubre sin error). ¿Se acepta, o se quiere un identificador estable por versión en el esquema
   (cambio de `data-model.md`, fuera del diseño)?
2. **Modelos sin versiones** (`versions: []`): como cada columna es una versión (RF-1), no se pueden comparar y
   este diseño no les pone «Comparar» ni los ofrece en «Añadir». RF-11 no los nombra: ¿se confirma?
3. **Versión por defecto ya presente.** Si al añadir un modelo su versión más barata (RF-8) ya está en la
   comparación, este diseño añade la siguiente del orden de la ficha (RF-9 impide repetirla). ¿Vale, o se
   prefiere no permitir añadirlo y pedir que se cambie la versión de la columna existente?
4. **CA-7 y «≤ 3 interacciones desde la portada».** Se cumple si la portada muestra tarjetas con «Comparar»
   (PRD-004 usa la tarjeta). Si se llega desde `/coches`, son 3 interacciones contando desde el catálogo. ¿Se
   cuenta desde la página que tenga la tarjeta?
5. **Fila de cabecera fija.** Al bajar por la tabla en móvil se pierde de vista qué columna es cuál. Una
   cabecera `sticky` ayudaría pero, con nombres largos, taparía media pantalla a 320 px. No la pide ningún
   requisito; no se especifica.
6. **Botón «Copiar enlace».** RF-10 pide compartir con la URL, y la barra de direcciones ya lo es (la entrada
   lo dice). Un botón de copiar no está en el PRD; no se especifica.

## Pendientes (no se deciden en diseño)

1. **Comprobación a 320 px con texto al 200 %** con datos reales de 3 columnas (nombres de Polestar y Renault,
   «58 kWh, sin especificar si es útil o bruta»): en papel cabe sin desbordar, pero la legibilidad hay que
   verla en un navegador.
2. **Anuncios de la región de estado** en VoiceOver y NVDA: no se puede verificar en papel.
3. ~~**Cargando y error** dependen de la ADR del comparador.~~ Resuelto: ADR-0014 (aceptada) pide los datos
   aparte, así que los dos estados se quedan.
