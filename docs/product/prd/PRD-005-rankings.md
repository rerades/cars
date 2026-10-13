---
id: PRD-005
title: Rankings
status: ready        # draft | ready | in-progress | done | deprecated
priority: P2         # P0 imprescindible · P1 importante · P2 deseable
depends_on: [PRD-001, PRD-002]
epic: ""
updated: 2026-10-13
---

# PRD-005 — Rankings

## 1. Problema
Quien se informa sobre coches eléctricos suele empezar por una pregunta de extremos: «cuál es el más barato», «cuál llega más lejos», «cuál carga más rápido». El catálogo (PRD-001) permite ordenar tarjetas de modelo por precio, autonomía y novedad, pero solo entre los modelos que el visitante ya ha filtrado, y no ofrece nada por batería, potencia o carga. El comparador (PRD-003) pone coches lado a lado, pero hay que saber cuáles. Falta una **lista corta, ya ordenada por una cifra, con su fuente**, a la que se llegue sin configurar nada.

Un ranking aquí **no opina**: ordena por una cifra publicada por una fuente, y nada más. No hay puntuaciones, medias ni «el mejor coche» (visión; PRD-003, RF-13).

## 2. Objetivo y métricas
- Un visitante llega a cualquier ranking publicado en **≤ 2 interacciones** desde la portada, sin JavaScript: portada → `/coches` → ranking. La entrada es un enlace desde `/coches` (PRD-001, RF-14; decisión 8); la portada no cambia.
- 100 % de las cifras mostradas en un ranking llevan su fuente y su fecha de consulta (principio 0 de la visión). 0 % de cifras estimadas, deducidas o puestas a 0 (ADR-0001, regla 7).
- 0 versiones sin la cifra del ranking ocupando un puesto.
- Cada ranking es una lista cuya posición se puede comprobar contra los ficheros de `data/raw/` sin cálculo intermedio.

## 3. Alcance
### Incluido
- Rankings ordenados por **una sola cifra** de las que ya tienen fuente y fecha en `architecture/data-model.md`, sección 4: precio (`price`), autonomía WLTP (`wltp_km`), capacidad de batería (`battery_kwh`), potencia (`power_kw`) y potencia máxima de carga en continua (`dc_max_kw`).
- Filtros por segmento y por tramo de precio, con los valores y bordes de PRD-001 (RF-10, RF-11).
- Tratamiento explícito de los datos ausentes y de las fuentes no oficiales.
- Reutilizar la presentación de PRD-001 (estado, «Precio con oferta», segmento) y de PRD-002 (dato con fuente, enlace a la ficha), sin bloques nuevos.

### Fuera de alcance
- Cualquier cifra que no exista en el esquema de `data-model.md`: **ventas, matriculaciones, cuota de mercado, valoraciones, consumo, aceleración, maletero, tiempos de carga, garantía**. No hay fuente registrada para ellas (ADR-0001) y la regla es la de PRD-002 y PRD-003: sin dato en el esquema, no se muestra.
- Puntuaciones, medias, índices, «mejor» o «peor», «recomendado», insignias, y cualquier ranking que **combine varios campos** (por ejemplo, autonomía por euro o una nota global) o que **calcule** una cifra nueva (visión; PRD-003, RF-13; ADR-0001, regla 7).
- Rankings por novedad: la fecha de lanzamiento es de modelo y ya se ordena en el catálogo (PRD-001, RF-3) (decisión 1).
- Ranking de carga en alterna (`ac_max_kw`): depende del cargador de a bordo y apenas distingue unos coches de otros (decisión 1).
- Páginas pregeneradas por filtro de segmento o de tramo (decisión 7).
- Ranking de marcas.
- Reviews, comparador y catálogo: se enlaza a ellos, no se duplican.
- Cuentas, votaciones, valoraciones del visitante y cualquier cosa que guarde datos suyos (visión).
- Precios en tiempo real, ayudas (Plan MOVES), disponibilidad y enlaces de compra.

## 4. Requisitos funcionales
Un **ranking** es una lista de **puestos**; cada puesto es una **versión** (`versions[]`, `data-model.md`, sección 4) identificada por marca, modelo y `name`. La unidad es la versión porque batería, potencia y carga solo existen por versión y cada puesto debe tener una única cifra con una única fuente, igual que en el comparador (PRD-003, decisión 1). Confirmado el 2026-10-13 (decisión 2).

- **RF-1:** Cada ranking ordena por **un solo campo** de versión, con este sentido, fijo y visible en la página (el texto de la cabecera lo dice, por ejemplo «de menor a mayor precio»):

  | Ranking | Campo del esquema | Sentido |
  |---|---|---|
  | Más baratos | `price.value` | ascendente |
  | Más autonomía | `wltp_km` | descendente |
  | Más batería | `battery_kwh` | descendente |
  | Más potencia | `power_kw` | descendente |
  | Carga más rápida en continua | `dc_max_kw` | descendente |

  Se publican estos cinco rankings y ninguno más (decisión 1). Un ranking nuevo se añade primero aquí.
- **RF-2:** Un ranking no combina campos, no calcula ninguna cifra, no puntúa y no valora: la cifra de un puesto es el valor del fichero, tal cual (con su `note` si la trae, como en PRD-002, RF-8), y el orden es solo el de esa cifra. Ninguna página de ranking contiene marcas de «mejor», «recomendado», puntuaciones ni textos que opinen.
- **RF-3:** Cada puesto muestra: su número de puesto; la marca (`brand_name`), el modelo (`model`) y el nombre de la versión (`name`), con un enlace a la ficha del modelo (PRD-002, RF-1); la **cifra del ranking** con su unidad; y, en el ranking de batería, la base de la cifra (RF-15). Como solo entran modelos a la venta (RF-11), un puesto no lleva etiqueta de estado. Un puesto no muestra más cifras que la del ranking: el ranking no es una ficha, y una cifra de modelo («precio desde», «autonomía máxima») junto a la de la versión confundiría. Qué más lleva el puesto (imagen, segmento) lo decide el diseño (decisión 4).
- **RF-4:** Cada cifra mostrada indica su fuente, la fecha de consulta (`retrieved`) y enlaza a la `url` donde se leyó, junto al valor y no en un bloque aparte (PRD-002, RF-9). Una cifra con `tier: T3` **no da puesto**: la versión queda fuera de ese ranking como si no tuviera el dato (RF-6), porque ADR-0001 solo admite T3 para confirmar (decisión 10). Una cifra T2 lo dice en su indicación («fuente no oficial»); las de T1 no llevan marca (ADR-0001).
- **RF-5:** Un precio `financed` se muestra con la etiqueta **«Precio con oferta»**, con el texto literal de `price_terms` y un enlace a `price_terms_url` (PRD-001, RF-9; PRD-002, RF-4). Un precio `pvp` no lleva etiqueta. Todos los precios son con IVA y sin ayudas. En el ranking de precio, un precio `financed` entra y se ordena como cualquier otro, siempre con su etiqueta.
- **RF-6:** Una versión **sin la cifra** del ranking (campo omitido o `null`) **no ocupa ningún puesto**: no se pone a 0, no se estima, no se deduce de otro campo, de otra versión ni de `specs`, y no se coloca al final con una cifra inventada (ADR-0001, regla 7). Un ranking de batería, por ejemplo, solo contiene versiones con `battery_kwh`. La cifra de `specs` (valores del modelo entero) no se usa para dar puesto a una versión. Lo mismo vale para una cifra cuya fuente es T3 (RF-4).
- **RF-7:** El ranking tiene como máximo **10 entradas**, en todos los rankings (decisión 3). Si hay menos versiones con la cifra, se muestran las que hay, sin rellenar. Si hay cero, la página lo dice y enlaza al catálogo (`/coches`), sin lista vacía ni enlaces rotos. Dos versiones con la misma cifra **comparten número de puesto** y se listan por marca, modelo y `name` en orden alfabético; el siguiente puesto salta (1, 2, 2, 4). Si un empate cruza la décima entrada, entran las primeras por ese orden (decisión 11).
- **RF-8:** Un ranking se puede **filtrar por segmento** con los valores de PRD-001 (RF-11). El segmento es del modelo, y una versión de un modelo sin segmento (PRD-001, RF-12) no aparece en un ranking filtrado por segmento, porque no se puede afirmar que lo cumpla. El filtro se aplica **antes** de numerar los puestos: los puestos son 1..10 dentro del resultado filtrado. Los filtros se reflejan en la URL (query string) y se resuelven en el navegador, como PRD-001, RF-5; no hay páginas pregeneradas por filtro (decisión 7).
- **RF-9:** Un ranking se puede **filtrar por tramo de precio** con los tres tramos y los bordes de PRD-001 (RF-10): hasta 30.000 € (≤ 30.000), de 30.000 a 45.000 € (> 30.000 y ≤ 45.000), más de 45.000 € (> 45.000). El tramo se aplica al precio de la **versión** (decisión 5); una versión sin precio no aparece en un ranking filtrado por tramo. Un precio `financed` cuenta como cualquier otro (PRD-001, RF-9). Filtro de tramo y filtro de segmento se pueden combinar, y la combinación se resuelve igual que en RF-8.
- **RF-10:** En un ranking de **precio**, el filtro de tramo de RF-9 es compatible pero no obligatorio; el ranking de precio sin filtros ordena todas las versiones con precio.
- **RF-11:** Modelos publicados: solo entran en un ranking las versiones de modelos publicados. Un modelo con `needs_review: true` no se publica y no aparece en ningún ranking (PRD-001, RF-13). Además, solo entran los modelos **a la venta** (`on_sale`): los `announced` (su precio es previsto) y los `discontinued` (ya no se venden) no aparecen en ningún ranking, como en el comparador (PRD-003, decisión 6) (decisión 6).
- **RF-12:** El ranking es de solo lectura y no recoge datos: sin formularios, valoraciones ni elementos de cuenta. No guarda nada del visitante (visión, principios 1 y 2; PRD-001, RNF-5).
- **RF-13:** Cada ranking tiene su propia URL estable y su propio título de página y texto introductorio, no repetidos entre rankings ni con otras páginas del sitio. Cada ranking sin filtros es una **página pregenerada e indexable**; la URL la fija el diseño. Una URL de ranking con query string (filtros) lleva canonical a la página del ranking sin query string, como `/coches` (PRD-001, CA-13) (decisión 7).
- **RF-14:** Un puesto no ofrece compra ni intermediación (visión). Puede enlazar a la ficha (RF-3) y, si PRD-003 lo permite para esa versión, a «Comparar» (PRD-003, RF-6 y RF-7); no hay enlace de compra.
- **RF-15:** Bajo la lista, la página dice cuántas versiones publicadas se han quedado fuera por no tener la cifra o tenerla solo de fuente T3 (RF-4, RF-6), contadas sobre el mismo conjunto que se muestra (con los filtros aplicados, si los hay) (decisión 11).

## 5. Requisitos no funcionales
- **RNF-1:** Estático o renderizado en servidor para SEO: el HTML servido contiene ya la lista completa de puestos del ranking sin filtros, sin ejecutar JavaScript (ADR-0003). El sentido y el campo del ranking van en el HTML. Los filtros necesitan JavaScript; sin él, sus controles no se muestran, como en el catálogo.
- **RNF-2:** LCP < 2,5 s en móvil 4G.
- **RNF-3:** Accesibilidad WCAG 2.1 AA (ADR-0006). La lista es una lista ordenada (`ol`) o una tabla con encabezados; ninguna etiqueta («Precio con oferta», «fuente no oficial», estado) depende solo del color; sin scroll horizontal a 320 px (WCAG 1.4.10).
- **RNF-4:** Idioma español. Textos preparados para i18n.
- **RNF-5:** Sin cookies ni almacenamiento del navegador (`localStorage` y `sessionStorage` incluidos).
- **RNF-6:** Todo valor mostrado sale de los ficheros de `data/raw/` con su fuente (ADR-0001). El ranking no calcula ni deriva cifras nuevas; el puesto es su posición en el orden y no es un dato de coche.

## 6. Datos
Entidades y campos de `architecture/data-model.md` (ADR-0008); los rankings no usan ningún campo que no esté allí.

| Elemento del ranking | Campos del esquema |
|---|---|
| Identificación del puesto | `brand_name`, `model`, `versions[].name` |
| Estado | `status`, `launch` |
| Cifra ordenada | `price` (+ `price_kind`, `price_terms`, `price_terms_url`), `wltp_km`, `battery_kwh` (+ `basis`), `power_kw`, `dc_max_kw` |
| Filtros | `segment` (modelo), `price.value` (versión) |
| Fuente y fecha | `source_id`, `url`, `retrieved`, `tier`; `note` |

- La cifra es siempre de la **versión**; no se usa `specs` ni los derivados de modelo («precio desde», «autonomía máxima») para puntuar a un puesto (RF-6).
- `battery_kwh` lleva `basis` (útil, bruta o «sin especificar»). Se ordenan juntas todas las bases y cada puesto muestra la suya junto a la cifra, como PRD-002, RF-6, para que no se mezclen sin decirlo (decisión 9).
- No se muestran `open_questions` ni `needs_review` (PRD-002, sección 6).
- Un dato ausente es `null` u omitido y deja a la versión fuera del ranking (RF-6).

## 7. Criterios de aceptación
Todos son verificables sobre el HTML construido, sin ejecutar JavaScript, salvo los filtros de CA-8 y CA-9, que se verifican sobre la lógica de filtrado y en el navegador, como los de PRD-001.

- [ ] **CA-1** (→ RF-1): Dado el sitio construido, cuando leo el HTML de cada ranking publicado, entonces el campo y el sentido del orden están en la cabecera con el texto de RF-1, y los puestos siguen ese orden: en «Más autonomía», cada puesto tiene una cifra ≥ la del siguiente; en «Más baratos», ≤.
- [ ] **CA-2** (→ RF-2): Dado el HTML de cualquier ranking, cuando lo reviso, entonces no contiene puntuaciones, medias, «mejor», «recomendado», insignias ni cifras que no estén en un fichero de `data/raw/`; y ningún ranking depende de más de un campo del esquema.
- [ ] **CA-3** (→ RF-3): Dado un ranking, cuando miro un puesto, entonces veo su número, la marca, el modelo, el nombre de la versión, la cifra con su unidad y ninguna etiqueta de estado; el nombre del modelo enlaza a `/marcas/{marca}/{modelo}/`. En el ranking de batería, cada puesto dice su base.
- [ ] **CA-4** (→ RF-4): Dado un ranking, cuando reviso cada cifra, entonces tiene junto a sí la fuente y la fecha `retrieved` del fichero y un enlace a su `url`. Dada una cifra de `tier: T2`, entonces dice «fuente no oficial»; dada una de T1, no. Dada una versión cuya cifra del ranking es `tier: T3`, entonces no aparece en ese ranking.
- [ ] **CA-5** (→ RF-5): Dado el ranking de precio con una versión `financed` y otra `pvp`, entonces la primera lleva «Precio con oferta», el texto literal de `price_terms` y un enlace a `price_terms_url`, y la segunda no lleva etiqueta; y ambas están ordenadas por su `price.value`.
- [ ] **CA-6** (→ RF-6): Dadas tres versiones, una sin `battery_kwh`, una con `battery_kwh: null` y una con 60 kWh, cuando abro el ranking de batería, entonces solo aparece la de 60 kWh; la versión sin dato no aparece ni con 0 ni con otro valor ni al final de la lista. Dado un modelo sin `battery_kwh` en sus versiones pero con `specs.battery_kwh_options`, entonces no aparece.
- [ ] **CA-7** (→ RF-7): Dado un conjunto con más de 10 versiones con cifra y sin empates, cuando abro el ranking, entonces hay exactamente 10 entradas, numeradas de 1 a 10. Dado un conjunto con 3 versiones con cifra, entonces hay 3 puestos y ninguna fila de relleno. Dado un conjunto con 0, entonces la página dice que no hay versiones con ese dato y enlaza a `/coches`; no hay lista vacía. Dadas dos versiones con la misma cifra en el segundo lugar, entonces ambas llevan el puesto 2, van en orden alfabético de marca, modelo y `name`, y la siguiente lleva el 4.
- [ ] **CA-8** (→ RF-8): Dado el ranking de autonomía filtrado por `suv_compacto`, cuando lo abro, entonces todos los puestos son de modelos de ese segmento, y los puestos están numerados 1..10 dentro del resultado filtrado. Dado un modelo sin segmento, entonces no aparece en ese ranking filtrado, aunque tenga la mayor autonomía.
- [ ] **CA-9** (→ RF-9, RF-10): Dadas versiones de 30.000 €, 30.001 € y 45.000 €, cuando abro el ranking de autonomía filtrado por «hasta 30.000 €», entonces aparece la de 30.000 € y no las otras; con «de 30.000 a 45.000 €», aparecen las de 30.001 € y 45.000 €; con «más de 45.000 €» no aparece ninguna de las tres. Dada una versión sin precio, entonces no aparece en ningún ranking filtrado por tramo, y sí en el ranking sin filtro de tramo si tiene la cifra ordenada. Dado el ranking de precio sin filtros, entonces ordena todas las versiones con precio.
- [ ] **CA-10** (→ RF-11): Dado un modelo con `needs_review: true`, cuando construyo el sitio, entonces ninguna de sus versiones aparece en ningún ranking ni en ninguna otra página. Dado un modelo `announced` o `discontinued` con la cifra del ranking, entonces ninguna de sus versiones aparece en ningún ranking.
- [ ] **CA-11** (→ RF-12): Dado el HTML de un ranking, cuando lo reviso, entonces no contiene formularios que envíen datos, campos de texto ni elementos de cuenta o valoración. Los controles de filtro de segmento y de tramo solo cambian la URL, como en `/coches`.
- [ ] **CA-12** (→ RF-13): Dado el sitio construido, cuando comparo los títulos de página y los textos introductorios de todos los rankings con los de las demás páginas, entonces no coinciden con ninguno; cada ranking se abre con una URL estable y es indexable. Dada una URL de ranking con query string, entonces su canonical apunta a la URL del ranking sin query string.
- [ ] **CA-13** (→ RF-14): Dado un ranking, cuando recorro sus enlaces, entonces solo llevan a fichas, al catálogo, a las fuentes de los datos y, si procede, a «Comparar»; ninguno lleva a una web de compra.
- [ ] **CA-14** (→ RNF-1): Dado el HTML servido de un ranking, cuando lo leo sin ejecutar JavaScript, entonces contiene la lista completa de puestos con sus cifras y fuentes.
- [ ] **CA-15** (→ RNF-5): Al cargar cualquier ranking no se crea ninguna cookie ni se escribe nada en `localStorage` ni en `sessionStorage`.
- [ ] **CA-16** (→ RNF-6): Dado cualquier puesto, cuando comparo su cifra con el fichero de `data/raw/` que cita, entonces es idéntica, y ningún puesto muestra una cifra que no esté en un fichero.
- [ ] **CA-17** (→ RNF-3): Dado un ranking a 320 px de ancho, cuando uso la página, entonces no hay scroll horizontal y todos los datos son alcanzables; «Precio con oferta» y «fuente no oficial» se distinguen sin el color.
- [ ] **CA-18** (→ RF-15): Dado un ranking de batería con 12 versiones publicadas, de las que 3 no tienen `battery_kwh` y 1 la tiene solo de fuente T3, cuando lo abro sin filtros, entonces la página dice que 4 versiones se han quedado fuera por no tener el dato con fuente oficial.

## 8. Decisiones y preguntas abiertas
### Resueltas (2026-10-13)
Decididas por el responsable del producto:
1. **Rankings publicados (RF-1):** los cinco de RF-1: precio de menor a mayor; autonomía, batería, potencia y carga en continua de mayor a menor. Sin ranking de carga en alterna, que apenas distingue unos coches de otros, ni de novedad, que ya está en el orden del catálogo. Sin sentido ascendente para batería y potencia.
2. **Unidad (RF-1 a RF-15):** la versión, como en el comparador. Alternativa descartada: ordenar modelos como la tarjeta del catálogo; solo sirve para precio y autonomía y obliga a citar varias fuentes por puesto.
3. **Puestos (RF-7):** 10 en todos los rankings. Alternativa descartada: 20.
4. **Contenido del puesto (RF-3):** lo decide el diseño, sin cifras de modelo junto a la de la versión.
5. **Tramo de precio (RF-9):** sobre el precio de la versión, no sobre el «precio desde» del modelo.
6. **Estado (RF-11):** solo modelos a la venta. Los anunciados quedan fuera porque su precio es previsto, y los descatalogados porque ya no se venden. Alternativa descartada: incluirlos con su etiqueta.
7. **Páginas e indexación (RF-8, RF-13):** una página pregenerada e indexable por ranking, sin filtros; los filtros se resuelven en el navegador con query string y canonical a la página sin filtros, como `/coches`. No se usa `noindex` en las URL con filtros: son el mismo fichero estático que la página sin filtros, y la quitaría también del índice.
8. **Entrada (sección 2):** un enlace desde `/coches` (PRD-001, RF-14). La portada no cambia. Alternativa descartada: enlazar desde la portada, que cambiaría PRD-004.
9. **Batería (sección 6):** todas las bases juntas y cada puesto muestra la suya. Alternativas descartadas: separar rankings por base o dejar fuera las que no son útiles.
10. **Fuentes y prioridad (RF-4):** (a) una cifra solo T3 no da puesto. (b) P2, después de catálogo, ficha, portada y comparador.
11. **Empates y exclusión (RF-7, RF-15):** puesto compartido con orden alfabético de marca, modelo y `name`; la página dice cuántas versiones se han quedado fuera por falta de dato.

### Abiertas
- Ninguna.

## 9. Historial de cambios
| Fecha | Cambio | Autor |
|---|---|---|
| 2026-10-13 | Borrador inicial: RF-1 a RF-14, RNF-1 a RNF-6, CA-1 a CA-17; 11 preguntas abiertas | Claude |
| 2026-10-13 | Resueltas las 11 preguntas abiertas. Ajustados RF-1, RF-3, RF-4, RF-6 a RF-9, RF-11, RF-13, RNF-1, la sección 6 y CA-3, CA-4, CA-7 a CA-12 y CA-17; añadidos RF-15 y CA-18. Pasa a `ready` | Rod / Claude |
