---
id: PRD-003
title: Comparador
status: draft        # draft | ready | in-progress | done | deprecated
priority: P1         # P0 imprescindible · P1 importante · P2 deseable (propuesta de Producto: la visión no la fija)
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
- Una vista que pone varios coches en columnas y los compara campo a campo.
- Los campos que ya tienen fuente y fecha en `architecture/data-model.md`: precio, autonomía WLTP, capacidad de batería, potencia, tracción y potencia máxima de carga (corriente continua y alterna).
- Elegir qué comparar desde el catálogo, desde la ficha y desde el propio comparador.
- Compartir una comparación con una URL.
- Dato ausente mostrado como ausente.

### Fuera de alcance
- Cualquier dato que no exista en el esquema de `data-model.md`: dimensiones, maletero, consumo, aceleración, tiempos de carga, garantía, plazas, etc. (misma regla que PRD-002, decisión del 2026-10-01).
- Puntuaciones, «ganador», recomendaciones o cualquier valoración propia: el comparador muestra los datos, no opina.
- Cuentas, comparaciones guardadas, favoritos persistentes, historial del visitante y cualquier interacción que guarde datos suyos (visión; PRD-001, RNF-5).
- Rankings (PRD-005) y reviews.
- Precios en tiempo real, ayudas (Plan MOVES), disponibilidad en concesionarios y enlaces de compra: la web no vende ni intermedia (visión).

## 4. Requisitos funcionales
En este borrador, **«elemento»** es lo que se pone en una columna y **N** es el máximo de elementos a la vez. Qué es un elemento (modelo o versión) y cuánto vale N no se deducen de la visión, los PRD ni las ADR: son las preguntas abiertas 1 y 2. Los RF y CA se escriben sin suponerlos; el PRD no pasa a `ready` hasta cerrarlas.

- **RF-1:** El comparador es una página que muestra los elementos elegidos **uno al lado del otro**, una columna por elemento y una fila por campo, con los mismos campos en el mismo orden para todos. Cada columna identifica su elemento con la marca (`brand_name`), el modelo (`model`) y, si el elemento es una versión, su nombre (`name`), con un enlace a la ficha del modelo (PRD-002, RF-1). Se comparan al menos 2 elementos y como máximo N.
- **RF-2:** Los campos comparados son los del esquema que se pidieron como núcleo de la comparación, y solo esos: precio (`price`), autonomía WLTP (`wltp_km`), capacidad de batería (`battery_kwh`, con su `basis`: útil, bruta o «sin especificar»), potencia (`power_kw`), tracción (`drivetrain`, con la etiqueta española de PRD-002, RF-6) y potencia máxima de carga en corriente continua (`dc_max_kw`) y en alterna (`ac_max_kw`). Cada columna muestra además el estado del elemento con las etiquetas de PRD-001, RF-7 y PRD-002, RF-10 («Próximamente», «Descatalogado»; `on_sale` sin etiqueta).
- **RF-3:** Un campo sin dato en un elemento se muestra como **«por confirmar»** en su celda, nunca vacío, nunca con 0 ni con un valor estimado, deducido de otro campo o copiado de otro elemento (ADR-0001, regla 7; PRD-001, RF-12). La fila del campo se mantiene aunque ningún elemento tenga dato.
- **RF-4:** Cada dato mostrado indica su fuente y la fecha de consulta (`retrieved`) y enlaza a la `url` donde se leyó. Un dato que no viene de una fuente T1 lo dice en su indicación («fuente no oficial»); los de T1 no llevan marca. Como en PRD-002, RF-9, el **precio** lleva su fuente y su fecha visibles junto al valor y el resto puede remitir a un bloque «Fuentes» de la página.
- **RF-5:** Un precio que no es PVP (`price_kind: financed`) se muestra con la etiqueta **«Precio con oferta»**, con el texto literal de sus condiciones (`price_terms`) y un enlace a `price_terms_url` (PRD-001, RF-9; PRD-002, RF-4). Un precio `pvp` no lleva etiqueta. Todos los precios son con IVA y sin ayudas. Un elemento descatalogado muestra su precio con la nota «Último precio publicado». Si el dato trae `note` (por ejemplo, «publicado: 190 CV»), se muestra junto al dato, tal cual (PRD-002, RF-8).
- **RF-6:** Desde el catálogo (PRD-001), el visitante puede **elegir qué coches comparar** y llegar al comparador con ellos. La acción está disponible en la tarjeta de cada modelo y no sustituye al enlace de la tarjeta a la ficha.
- **RF-7:** Desde la ficha de un modelo (PRD-002), el visitante puede llegar al comparador con ese coche ya elegido, para añadirle otros. La acción es un enlace o control de comparación, no un enlace de compra.
- **RF-8:** Dentro del comparador, el visitante puede **quitar** un elemento y **añadir** otro de entre los coches del catálogo. Al llegar a N elementos, la opción de añadir no está disponible y la página dice por qué. Un mismo elemento no puede estar dos veces.
- **RF-9:** Una comparación se **comparte con una URL** que contiene los elementos elegidos y su orden. Abierta en una sesión nueva, sin haber visitado antes la web, muestra la misma comparación. La web no guarda la selección del visitante en cookies, `localStorage` ni en ningún otro almacenamiento del navegador ni en un servidor (visión, principios 1 y 2; PRD-001, RNF-5): el estado de la comparación vive en la URL, igual que el de los filtros (PRD-001, RF-5).
- **RF-10:** No se pueden comparar modelos con `needs_review: true` (no se publican, PRD-001, RF-13). Si la URL de una comparación cita un elemento que no existe, que está en revisión o que está repetido, la página no da error: ignora ese elemento, avisa de que no se ha podido incluir y muestra los demás.
- **RF-11:** Con menos de 2 elementos (comparador abierto sin selección, o con uno solo tras RF-10), la página no muestra una tabla vacía: explica que hacen falta al menos 2 coches y ofrece elegirlos (añadir, RF-8) y volver al catálogo (`/coches`).
- **RF-12:** El comparador no ordena ni destaca a ningún elemento como mejor ni peor, ni calcula diferencias o puntuaciones: muestra los datos tal cual (fuera de alcance). El orden de las columnas es el de la selección.

## 5. Requisitos no funcionales
- **RNF-1:** Accesibilidad WCAG 2.1 AA. Ninguna etiqueta ni aviso («por confirmar», «Precio con oferta», «fuente no oficial») depende solo del color. Sin scroll horizontal a 320 px de ancho (WCAG 1.4.10) con N elementos, o la alternativa que fije el diseño sin perder ningún dato.
- **RNF-2:** LCP < 2,5 s en móvil 4G.
- **RNF-3:** Idioma español. Textos preparados para i18n.
- **RNF-4:** Sin cookies ni almacenamiento de datos personales (`localStorage` incluido) al cargar el comparador, al elegir, quitar o añadir elementos y al compartir.
- **RNF-5:** Todo valor mostrado sale de los ficheros de `data/raw/` con su fuente (ADR-0001); el comparador no calcula ni deriva cifras nuevas.
- Sobre cómo se sirve (HTML estático o en el navegador) y si se indexa: preguntas abiertas 4 y 5; las decide una ADR, no este PRD.

## 6. Datos
Entidades y campos de `architecture/data-model.md` (ADR-0008); el comparador no usa ningún campo que no esté allí.

| Fila del comparador | Campos del esquema |
|---|---|
| Identificación | `brand_name`, `model`, `versions[].name` (si el elemento es una versión) |
| Estado | `status`, `launch` |
| Precio | `price` (+ `price_kind`, `price_terms`, `price_terms_url`) |
| Autonomía | `wltp_km` |
| Batería | `battery_kwh` (+ `basis`) |
| Potencia | `power_kw` |
| Tracción | `drivetrain` |
| Carga | `dc_max_kw`, `ac_max_kw` |
| Fuente y fecha | `source_id`, `url`, `retrieved`, `tier`; `note` |

- Los campos de fila de la tabla (salvo identificación y estado) son **por versión** en el esquema. Solo precio desde, autonomía máxima y tracción tienen una forma derivada para el modelo entero (`data-model.md`, sección 5); batería, potencia y carga del modelo entero solo existen como `specs.*` y no como un valor único. Esto condiciona la pregunta abierta 1.
- No se muestran `open_questions` ni `needs_review` (PRD-002, sección 6).
- Un dato ausente es `null` u omitido en el esquema y se muestra como «por confirmar» (RF-3).

## 7. Criterios de aceptación
- [ ] **CA-1** (→ RF-1): Dados 3 elementos elegidos (con N ≥ 3), cuando abro el comparador, entonces veo 3 columnas, cada una con la marca y el modelo (y la versión, si el elemento es una versión) y un enlace que lleva a la ficha del modelo; las filas y su orden son los mismos para las tres.
- [ ] **CA-2** (→ RF-1): Dado un máximo N, cuando intento comparar N + 1 elementos, entonces nunca veo más de N columnas (ver CA-10).
- [ ] **CA-3** (→ RF-2): Dado un elemento con todos los campos, cuando abro el comparador, entonces veo, en este orden, estado (si lo lleva), precio, autonomía, batería con su base, potencia, tracción, carga en continua y carga en alterna, y ningún campo que no esté en el esquema. Dada una batería con `basis: gross`, entonces la capacidad aparece indicada como bruta.
- [ ] **CA-4** (→ RF-3): Dado un elemento sin `dc_max_kw` junto a otro que sí lo tiene, cuando abro el comparador, entonces la celda del primero dice «por confirmar», la del segundo muestra su valor, y la celda del primero no contiene ninguna cifra. Dado que ningún elemento tiene `ac_max_kw`, entonces la fila de carga en alterna sigue visible con «por confirmar» en todas las columnas.
- [ ] **CA-5** (→ RF-4): Dada una comparación cualquiera, cuando reviso cada dato mostrado, entonces todos indican su fuente y la fecha `retrieved`, y su enlace lleva a la `url` del dato; el precio muestra su fuente y su fecha junto al valor. Dado un dato de `tier: T3`, entonces su indicación dice «fuente no oficial»; dado uno de T1, no. Una celda «por confirmar» no lleva fuente.
- [ ] **CA-6** (→ RF-5): Dado un elemento con precio `financed` y otro con `pvp`, cuando abro el comparador, entonces el primero muestra la etiqueta «Precio con oferta», el texto literal de `price_terms` y un enlace a `price_terms_url`, y el segundo no muestra etiqueta. Dado un elemento `discontinued` con precio, entonces su precio lleva «Último precio publicado». Dado un dato con `note: "publicado: 190 CV"`, entonces ese texto aparece junto al dato, idéntico al del fichero.
- [ ] **CA-7** (→ RF-6): Dado el catálogo en `/coches`, cuando uso la acción de comparar en las tarjetas de dos modelos y sigo hasta el comparador, entonces veo los dos modelos elegidos; y el enlace de cada tarjeta a su ficha sigue funcionando.
- [ ] **CA-8** (→ RF-7): Dada la ficha de un modelo, cuando uso la acción de comparar, entonces llego al comparador con ese modelo ya incluido y con la posibilidad de añadir otros (RF-8). La acción no es un enlace a la web de compra.
- [ ] **CA-9** (→ RF-8): Dada una comparación de 3 elementos, cuando quito uno, entonces quedan 2 columnas y el elemento quitado no aparece; cuando añado otro del catálogo, entonces vuelve a haber 3. Dado un elemento ya presente, entonces no puedo añadirlo otra vez.
- [ ] **CA-10** (→ RF-8): Dada una comparación con N elementos, cuando busco la opción de añadir, entonces no está disponible y la página explica que se ha alcanzado el máximo.
- [ ] **CA-11** (→ RF-9): Dada una comparación, cuando copio su URL y la abro en una sesión nueva (sin cookies ni historial), entonces veo los mismos elementos en el mismo orden con los mismos datos.
- [ ] **CA-12** (→ RF-9, RNF-4): Al elegir, quitar y añadir elementos, y al copiar la URL, no se crea ninguna cookie ni se escribe nada en `localStorage` ni en `sessionStorage`; y no se envía al servidor ningún dato del visitante más allá de la petición de la propia página.
- [ ] **CA-13** (→ RF-10): Dado un modelo con `needs_review: true`, cuando busco cómo compararlo en el catálogo, la ficha o el comparador, entonces no hay forma de elegirlo. Dada una URL de comparación que cita ese modelo, un elemento inexistente y un elemento repetido junto a dos elementos válidos, cuando la abro, entonces veo los dos válidos, un aviso de que otros no se han podido incluir y ningún error.
- [ ] **CA-14** (→ RF-11): Dada la URL del comparador sin elementos, o con uno solo válido, cuando la abro, entonces veo un texto que dice que hacen falta al menos 2 coches, una forma de añadirlos y un enlace a `/coches`; no veo una tabla vacía.
- [ ] **CA-15** (→ RF-12): Dada una comparación, cuando reviso la página, entonces no hay ninguna marca de «mejor»/«peor», ninguna puntuación ni ninguna diferencia calculada, y las columnas siguen el orden de la selección.
- [ ] **CA-16** (→ RNF-1): Dada una comparación con N elementos a 320 px de ancho, cuando uso la página, entonces no hay scroll horizontal de la página (o se cumple la alternativa que fije el diseño) y todos los datos son alcanzables; «por confirmar», «Precio con oferta» y «fuente no oficial» se distinguen sin el color.
- [ ] **CA-17** (→ RNF-5): Dado cualquier valor mostrado en una comparación, cuando lo comparo con su fichero de `data/raw/`, entonces es idéntico al del fichero y no hay ninguna cifra que no esté en él.

## 8. Decisiones y preguntas abiertas
### Resueltas
- Ninguna todavía. Lo que sigue se deduce de la visión, de PRD-001, de PRD-002 o de ADR-0001 y ya está en los RF: datos ausentes como «por confirmar» (PRD-001, RF-12), estado en la URL sin guardar nada del visitante (PRD-001, RF-5; visión), fuente y fecha en cada dato (visión, principio 0; PRD-002, RF-9) y los modelos en revisión fuera (PRD-001, RF-13).

### Abiertas
1. **¿Se comparan modelos o versiones?** Condiciona RF-1, RF-2, RF-8, la URL y los datos. *Modelos:* encaja con el catálogo y la tarjeta (PRD-001), pero el esquema solo da un valor único del modelo para precio desde, autonomía máxima y tracción; batería, potencia y carga son por versión (`data-model.md`, secciones 4 y 5), así que el modelo mostraría «por confirmar» o un rango. *Versiones:* compara cifras reales de un coche concreto, pero el visitante tiene que elegir versión antes de comparar y la ficha no tiene URL por versión (PRD-002, sección 8, punto 13). También cabe una mezcla (modelo y, dentro, una versión). Sin decidir.
2. **¿Cuántos elementos a la vez (N)?** La visión y los PRD no lo fijan; el mínimo de 2 sí se deduce. Hay que decidirlo teniendo en cuenta el ancho de móvil (RNF-1, 320 px).
3. **¿Cómo se acumula la selección mientras el visitante navega del catálogo a una ficha y de ahí al comparador, sin guardar nada?** La URL basta dentro del comparador (RF-9), pero «elegir varios en el catálogo» y «añadir desde otra ficha» exigen que la selección sobreviva a la navegación. `localStorage` queda descartado por PRD-001, RNF-5; si `sessionStorage` o la memoria de la página se consideran almacenamiento admisible, no se deduce de la visión. Es una decisión de producto (qué se considera «guardar») antes de ser de ADR.
4. **¿Se indexan las comparaciones?** Sin decidir: no se deduce de PRD-001 (que solo decide sobre filtros: `/coches` indexable y URL con query string con canonical a la página sin ella). Opciones a valorar: comparaciones no indexables (canonical a la página del comparador), o una lista corta y explícita de comparaciones pregeneradas entre modelos populares, con el mismo criterio que RF-10 de PRD-001. Elegir la segunda exigiría decidir cuáles.
5. **¿El comparador debe funcionar sin JavaScript?** PRD-001 y PRD-002 exigen HTML completo sin JavaScript para sus páginas indexables. Una comparación arbitraria solo se puede resolver en el navegador en un sitio estático (ADR-0003); si es indexable, hará falta un criterio. Depende de la pregunta 4.
6. **¿Se pueden comparar modelos `announced` y `discontinued`?** Se muestran con su etiqueta (RF-2) en el borrador, pero no está decidido que entren; un anunciado casi no tiene datos y llenaría la tabla de «por confirmar».
7. **¿Hay que resaltar las diferencias entre columnas** (por ejemplo, ocultar las filas iguales o marcar las distintas)? RF-12 prohíbe valorar «mejor/peor»; resaltar que un valor *difiere* no es valorar, pero no está pedido ni deducido. Fuera de alcance mientras no se decida.
8. **¿Qué ruta tiene el comparador** (`/comparar`, `/comparador`…)? Lo fijan el diseño y su ADR de rutas si procede; el PRD solo exige que sea estable y que la URL de una comparación sea compartible (RF-9).
9. **Prioridad.** P1 es una propuesta de Producto; la visión no la fija. Confirmar.

## 9. Historial de cambios
| Fecha | Cambio | Autor |
|---|---|---|
| 2026-10-10 | Borrador inicial: RF-1 a RF-12, RNF-1 a RNF-5, CA-1 a CA-17; 9 preguntas abiertas | Claude |
