---
id: PRD-003
title: Comparador
status: ready        # draft | ready | in-progress | done | deprecated
priority: P1         # P0 imprescindible · P1 importante · P2 deseable
depends_on: [PRD-001, PRD-002]
epic: ""
updated: 2026-10-10
---

# PRD-003 — Comparador

## 1. Problema
Quien ya ha reducido su lista a dos o tres coches eléctricos (catálogo, PRD-001; ficha, PRD-002) necesita ponerlos **lado a lado** y ver en una sola pantalla en qué se diferencian: precio, autonomía, batería, potencia, tracción y carga. Hoy tiene que abrir una ficha por coche y comparar de memoria. La ficha compara las versiones de **un** modelo; nada compara coches distintos entre sí. Además, quien compara suele querer enseñar el resultado a otra persona (pareja, familia, un foro) sin que la web guarde nada de él.

## 2. Objetivo y métricas
- Desde el catálogo o desde una ficha, el visitante llega a una comparación de dos coches en ≤ 3 interacciones.
- Todo dato mostrado en el comparador lleva visible su fuente y su fecha de consulta (100 % de los datos; principio 0 de la visión). Ningún dato ausente se muestra con un valor (0 % de estimaciones; ADR-0001, regla 7).
- Una comparación se puede compartir con un enlace que, abierto en una sesión nueva, muestra la misma comparación, sin que la web haya guardado nada del visitante (principio 2 de la visión).

## 3. Alcance
### Incluido
- Una página, `/comparar`, que pone hasta 3 versiones de coches en columnas y las compara campo a campo.
- Los campos de versión que ya tienen fuente y fecha en `architecture/data-model.md`: precio, autonomía WLTP, capacidad de batería, potencia, tracción y potencia máxima de carga (corriente continua y alterna).
- Llegar al comparador desde la tarjeta del catálogo y desde la ficha, y añadir, quitar o cambiar coches dentro del propio comparador.
- Compartir una comparación con una URL.
- Dato ausente mostrado como ausente.

### Fuera de alcance
- Cualquier dato que no exista en el esquema de `data-model.md`: dimensiones, maletero, consumo, aceleración, tiempos de carga, garantía, plazas, etc. (misma regla que PRD-002, decisión del 2026-10-01).
- Puntuaciones, «ganador», recomendaciones o cualquier valoración propia: el comparador muestra los datos, no opina. Tampoco resalta qué filas difieren (decisión 7).
- Modelos descatalogados (decisión 6).
- Marcar varios coches en el catálogo antes de ir al comparador: la selección se hace dentro del comparador (decisión 3).
- Comparaciones indexables o pregeneradas (decisión 4).
- Cuentas, comparaciones guardadas, favoritos persistentes, historial del visitante y cualquier interacción que guarde datos suyos (visión; PRD-001, RNF-5).
- Rankings (PRD-005) y reviews.
- Precios en tiempo real, ayudas (Plan MOVES), disponibilidad en concesionarios y enlaces de compra: la web no vende ni intermedia (visión).

## 4. Requisitos funcionales
Cada columna del comparador es una **versión** (`versions[]` de un modelo, `data-model.md`, sección 4), identificada por su marca, su modelo y su `name`, que es único dentro del modelo. Se comparan como mínimo 2 y como máximo **3** versiones (decisiones 1 y 2).

- **RF-1:** El comparador, en `/comparar`, muestra las versiones elegidas **una al lado de la otra**, una columna por versión y una fila por campo, con los mismos campos en el mismo orden para todas. Cada columna identifica su versión con la marca (`brand_name`), el modelo (`model`) y el nombre de la versión (`name`), con un enlace a la ficha del modelo (PRD-002, RF-1). Se comparan al menos 2 versiones y como máximo 3.
- **RF-2:** Los campos comparados son los de versión de `data-model.md`, sección 4, y solo esos: precio (`price`), autonomía WLTP (`wltp_km`), capacidad de batería (`battery_kwh`, con su `basis`: útil, bruta o «sin especificar»), potencia (`power_kw`), tracción (`drivetrain`, con la etiqueta española de PRD-002, RF-6) y potencia máxima de carga en corriente continua (`dc_max_kw`) y en alterna (`ac_max_kw`). Cada columna muestra además el estado de su modelo con las etiquetas de PRD-001, RF-7 («Próximamente»; `on_sale` sin etiqueta).
- **RF-3:** Un campo sin dato en una versión se muestra como **«por confirmar»** en su celda, nunca vacío, nunca con 0 ni con un valor estimado, deducido de otro campo o copiado de otra versión (ADR-0001, regla 7; PRD-001, RF-12). La fila del campo se mantiene aunque ninguna versión tenga dato.
- **RF-4:** Cada dato mostrado indica su fuente y la fecha de consulta (`retrieved`) y enlaza a la `url` donde se leyó. Un dato que no viene de una fuente T1 lo dice en su indicación («fuente no oficial»); los de T1 no llevan marca. Como en PRD-002, RF-9, el **precio** lleva su fuente y su fecha visibles junto al valor y el resto puede remitir a un bloque «Fuentes» de la página.
- **RF-5:** Un precio que no es PVP (`price_kind: financed`) se muestra con la etiqueta **«Precio con oferta»**, con el texto literal de sus condiciones (`price_terms`) y un enlace a `price_terms_url` (PRD-001, RF-9; PRD-002, RF-4). Un precio `pvp` no lleva etiqueta. Todos los precios son con IVA y sin ayudas. Si el dato trae `note` (por ejemplo, «publicado: 190 CV»), se muestra junto al dato, tal cual (PRD-002, RF-8).
- **RF-6:** La tarjeta de cada modelo del catálogo (PRD-001) tiene una acción **«Comparar»** que lleva a `/comparar` con ese modelo ya incluido. La acción no sustituye al enlace de la tarjeta a la ficha.
- **RF-7:** La ficha de un modelo (PRD-002) tiene la misma acción «Comparar», que lleva a `/comparar` con ese modelo ya incluido. Es un enlace de comparación, no un enlace de compra.
- **RF-8:** Al incluir un modelo (RF-6, RF-7, o añadirlo en RF-9), su columna muestra la versión de **precio más bajo**; si ninguna versión tiene precio, la primera del fichero. En cada columna, el visitante puede **cambiar de versión** entre las del mismo modelo.
- **RF-9:** Dentro del comparador, el visitante puede **quitar** una columna y **añadir** otro coche de entre los del catálogo. Con 3 columnas, la opción de añadir no está disponible y la página dice por qué. La misma versión no puede estar dos veces; dos versiones del mismo modelo sí.
- **RF-10:** Una comparación se **comparte con una URL** de `/comparar` que contiene las versiones elegidas y su orden. Abierta en una sesión nueva, sin haber visitado antes la web, muestra la misma comparación. La selección vive **solo en la URL**: la web no la guarda en cookies, `localStorage`, `sessionStorage` ni en ningún otro almacenamiento del navegador ni en un servidor (visión, principios 1 y 2; PRD-001, RNF-5; decisión 3).
- **RF-11:** Solo se pueden comparar modelos publicados `on_sale` o `announced`. Los que tienen `needs_review: true` no se publican (PRD-001, RF-13) y los `discontinued` no entran (decisión 6): sus tarjetas y fichas no tienen la acción «Comparar» y no aparecen al añadir. Si la URL de una comparación cita una versión que no existe, que es de un modelo excluido o que está repetida, la página no da error: ignora esa versión, avisa de que no se ha podido incluir y muestra las demás. Si la URL cita más de 3, se muestran las 3 primeras válidas y se avisa.
- **RF-12:** Con menos de 2 versiones (comparador abierto sin selección, o con una sola tras RF-11), la página no muestra una tabla vacía: explica que hacen falta al menos 2 coches, ofrece añadirlos (RF-9) y enlaza al catálogo (`/coches`).
- **RF-13:** El comparador no ordena ni destaca a ninguna versión como mejor ni peor, ni calcula diferencias o puntuaciones, ni resalta las filas que difieren: muestra los datos tal cual. El orden de las columnas es el de la URL.
- **RF-14:** `/comparar` no se indexa: lleva `noindex` y su canonical apunta a `/comparar` sin parámetros, con cualquier selección (decisión 4).

## 5. Requisitos no funcionales
- **RNF-1:** Accesibilidad WCAG 2.1 AA. Ninguna etiqueta ni aviso («por confirmar», «Precio con oferta», «fuente no oficial») depende solo del color. Sin scroll horizontal de la página a 320 px de ancho con 3 columnas (WCAG 1.4.10), o la alternativa que fije el diseño sin perder ningún dato.
- **RNF-2:** LCP < 2,5 s en móvil 4G.
- **RNF-3:** Idioma español. Textos preparados para i18n.
- **RNF-4:** Sin cookies ni almacenamiento del navegador (`localStorage` y `sessionStorage` incluidos) al cargar el comparador, al añadir, quitar o cambiar versiones y al compartir.
- **RNF-5:** Todo valor mostrado sale de los ficheros de `data/raw/` con su fuente (ADR-0001); el comparador no calcula ni deriva cifras nuevas.
- **RNF-6:** El comparador **puede necesitar JavaScript** para leer la URL y montar la tabla, porque una comparación arbitraria no se puede pregenerar en un sitio estático (ADR-0003; decisión 5). Sin JavaScript, la página muestra un aviso de que el comparador lo necesita y un enlace a `/coches`. Las acciones «Comparar» de la tarjeta y de la ficha son enlaces `<a href>` normales. Cómo se sirven los datos al navegador lo decide una ADR, no este PRD.

## 6. Datos
Entidades y campos de `architecture/data-model.md` (ADR-0008); el comparador no usa ningún campo que no esté allí.

| Fila del comparador | Campos del esquema |
|---|---|
| Identificación | `brand_name`, `model`, `versions[].name` |
| Estado | `status`, `launch` |
| Precio | `price` (+ `price_kind`, `price_terms`, `price_terms_url`) |
| Autonomía | `wltp_km` |
| Batería | `battery_kwh` (+ `basis`) |
| Potencia | `power_kw` |
| Tracción | `drivetrain` |
| Carga | `dc_max_kw`, `ac_max_kw` |
| Fuente y fecha | `source_id`, `url`, `retrieved`, `tier`; `note` |

- Todos los campos de fila (salvo identificación y estado) son **por versión** en el esquema, y por eso cada columna es una versión: así cada celda tiene un único valor con una única fuente.
- Las versiones no tienen un identificador propio: se identifican por `brand`, el slug del modelo y `name`. Cómo se escribe eso en la URL lo fija el diseño.
- No se muestran `open_questions` ni `needs_review` (PRD-002, sección 6).
- Un dato ausente es `null` u omitido en el esquema y se muestra como «por confirmar» (RF-3).

## 7. Criterios de aceptación
- [ ] **CA-1** (→ RF-1): Dadas 3 versiones elegidas, cuando abro el comparador, entonces veo 3 columnas, cada una con la marca, el modelo y el nombre de la versión, y un enlace que lleva a la ficha del modelo; las filas y su orden son los mismos para las tres.
- [ ] **CA-2** (→ RF-1, RF-11): Dada una URL que cita 4 versiones válidas, cuando la abro, entonces veo las 3 primeras y un aviso; nunca veo más de 3 columnas.
- [ ] **CA-3** (→ RF-2): Dada una versión con todos los campos, cuando abro el comparador, entonces veo, en este orden, estado (si lo lleva), precio, autonomía, batería con su base, potencia, tracción, carga en continua y carga en alterna, y ningún campo que no esté en el esquema. Dada una batería con `basis: gross`, entonces la capacidad aparece indicada como bruta.
- [ ] **CA-4** (→ RF-3): Dada una versión sin `dc_max_kw` junto a otra que sí lo tiene, cuando abro el comparador, entonces la celda de la primera dice «por confirmar», la de la segunda muestra su valor, y la celda de la primera no contiene ninguna cifra. Dado que ninguna versión tiene `ac_max_kw`, entonces la fila de carga en alterna sigue visible con «por confirmar» en todas las columnas.
- [ ] **CA-5** (→ RF-4): Dada una comparación cualquiera, cuando reviso cada dato mostrado, entonces todos indican su fuente y la fecha `retrieved`, y su enlace lleva a la `url` del dato; el precio muestra su fuente y su fecha junto al valor. Dado un dato de `tier: T3`, entonces su indicación dice «fuente no oficial»; dado uno de T1, no. Una celda «por confirmar» no lleva fuente.
- [ ] **CA-6** (→ RF-5): Dada una versión con precio `financed` y otra con `pvp`, cuando abro el comparador, entonces la primera muestra la etiqueta «Precio con oferta», el texto literal de `price_terms` y un enlace a `price_terms_url`, y la segunda no muestra etiqueta. Dado un dato con `note: "publicado: 190 CV"`, entonces ese texto aparece junto al dato, idéntico al del fichero.
- [ ] **CA-7** (→ RF-6): Dado el catálogo en `/coches`, cuando uso «Comparar» en la tarjeta de un modelo, entonces llego a `/comparar` con ese modelo incluido; y el enlace de la tarjeta a su ficha sigue funcionando. Desde la portada, eso y añadir un segundo coche son ≤ 3 interacciones.
- [ ] **CA-8** (→ RF-7): Dada la ficha de un modelo, cuando uso «Comparar», entonces llego a `/comparar` con ese modelo incluido y con la opción de añadir otros (RF-9). La acción no es un enlace a la web de compra.
- [ ] **CA-9** (→ RF-8): Dado un modelo con versiones de 35.000 € y 42.000 €, cuando lo incluyo, entonces su columna muestra la de 35.000 €. Dado un modelo sin precio en ninguna versión, entonces muestra la primera del fichero. Cuando cambio de versión en esa columna, entonces la columna muestra los datos de la nueva versión y la URL cambia con ella.
- [ ] **CA-10** (→ RF-9): Dada una comparación de 3 versiones, cuando quito una, entonces quedan 2 columnas y la quitada no aparece; cuando añado otro coche del catálogo, entonces vuelve a haber 3 y la opción de añadir no está disponible, con un texto que explica que el máximo es 3. Dada una versión ya presente, entonces no puedo añadirla otra vez; sí puedo añadir otra versión del mismo modelo.
- [ ] **CA-11** (→ RF-10): Dada una comparación, cuando copio su URL y la abro en una sesión nueva (sin cookies ni historial), entonces veo las mismas versiones en el mismo orden con los mismos datos.
- [ ] **CA-12** (→ RF-10, RNF-4): Al cargar el comparador, añadir, quitar y cambiar versiones, y al copiar la URL, no se crea ninguna cookie ni se escribe nada en `localStorage` ni en `sessionStorage`; y no se envía al servidor ningún dato del visitante más allá de las peticiones de la propia página y sus datos.
- [ ] **CA-13** (→ RF-11): Dado un modelo con `needs_review: true` o `status: discontinued`, cuando busco cómo compararlo en el catálogo, la ficha o el comparador, entonces no hay forma de elegirlo. Dada una URL de comparación que cita una versión de ese modelo, una versión inexistente y una versión repetida junto a dos versiones válidas, cuando la abro, entonces veo las dos válidas, un aviso de que otras no se han podido incluir y ningún error.
- [ ] **CA-14** (→ RF-12): Dada `/comparar` sin selección, o con una sola versión válida, cuando la abro, entonces veo un texto que dice que hacen falta al menos 2 coches, una forma de añadirlos y un enlace a `/coches`; no veo una tabla vacía.
- [ ] **CA-15** (→ RF-13): Dada una comparación, cuando reviso la página, entonces no hay ninguna marca de «mejor»/«peor», ninguna puntuación, ninguna diferencia calculada ni ninguna fila resaltada por ser distinta, y las columnas siguen el orden de la URL.
- [ ] **CA-16** (→ RF-14): Dada `/comparar` con cualquier selección, cuando miro su HTML, entonces lleva `noindex` y un canonical a `/comparar` sin parámetros.
- [ ] **CA-17** (→ RNF-1): Dada una comparación de 3 versiones a 320 px de ancho, cuando uso la página, entonces no hay scroll horizontal de la página (o se cumple la alternativa que fije el diseño) y todos los datos son alcanzables; «por confirmar», «Precio con oferta» y «fuente no oficial» se distinguen sin el color.
- [ ] **CA-18** (→ RNF-5): Dado cualquier valor mostrado en una comparación, cuando lo comparo con su fichero de `data/raw/`, entonces es idéntico al del fichero y no hay ninguna cifra que no esté en él.
- [ ] **CA-19** (→ RNF-6): Dada `/comparar` con una selección y JavaScript desactivado, cuando la abro, entonces veo un aviso de que el comparador necesita JavaScript y un enlace a `/coches`, y ningún error.

## 8. Decisiones y preguntas abiertas
### Resueltas (2026-10-10, Rod)
1. **Se comparan versiones.** Cada celda tiene así un único valor con su fuente. Descartado comparar modelos (batería, potencia y carga no tienen un valor único por modelo y saldrían «por confirmar») y comparar modelos con rangos (cada celda citaría varias fuentes). Para no obligar a elegir versión antes de comparar, al incluir un modelo se muestra su versión más barata y se puede cambiar (RF-8).
2. **Máximo de 3.** Es el caso de quien ya ha reducido su lista y cabe en un móvil de 320 px. Descartados 2 (no deja un tercer candidato) y 4 (obliga a desplazar la tabla en móvil).
3. **La selección vive solo en la URL.** «Comparar» en la tarjeta o en la ficha lleva al comparador con ese coche, y el resto se añade dentro. Descartados `sessionStorage` (se considera guardar) y marcar varias tarjetas en el catálogo (añade una interacción que se pierde al navegar).
4. **Las comparaciones no se indexan** (RF-14). Descartadas las comparaciones pregeneradas entre modelos populares: exigirían elegir cuáles y no las pide la visión.
5. **El comparador puede necesitar JavaScript** (RNF-6), porque no se indexa y una comparación arbitraria no se puede pregenerar. Descartado pregenerar todas las combinaciones en el build.
6. **Entran `on_sale` y `announced`; los descatalogados no.** Nadie decide su compra entre coches que ya no se venden. Descartado admitir todos los estados.
7. **No se resaltan las diferencias.** La tabla muestra los datos tal cual; se puede añadir en otra versión si se pide.
8. **Ruta `/comparar`,** el verbo de la acción «Comparar» de la tarjeta y la ficha. Descartado `/comparador`.
9. **Prioridad P1.** Va después del catálogo, la ficha y la portada (P0).

### Abiertas
- Ninguna.

## 9. Historial de cambios
| Fecha | Cambio | Autor |
|---|---|---|
| 2026-10-10 | Borrador inicial: RF-1 a RF-12, RNF-1 a RNF-5, CA-1 a CA-17; 9 preguntas abiertas | Claude |
| 2026-10-10 | Resueltas las 9 preguntas: versiones, máximo 3, selección solo en la URL, `/comparar` sin indexar y con JavaScript, sin descatalogados. RF-8 y RF-14, RNF-6 y CA-19 nuevos. Pasa a `ready` | Claude |
