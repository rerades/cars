---
id: PRD-005
title: Rankings
status: draft        # draft | ready | in-progress | done | deprecated
priority: P2         # P0 imprescindible · P1 importante · P2 deseable (propuesta, ver pregunta abierta 10)
depends_on: [PRD-001, PRD-002]
epic: ""
updated: 2026-10-13
---

# PRD-005 — Rankings

## 1. Problema
Quien se informa sobre coches eléctricos suele empezar por una pregunta de extremos: «cuál es el más barato», «cuál llega más lejos», «cuál carga más rápido». El catálogo (PRD-001) permite ordenar tarjetas de modelo por precio, autonomía y novedad, pero solo entre los modelos que el visitante ya ha filtrado, y no ofrece nada por batería, potencia o carga. El comparador (PRD-003) pone coches lado a lado, pero hay que saber cuáles. Falta una **lista corta, ya ordenada por una cifra, con su fuente**, a la que se llegue sin configurar nada.

Un ranking aquí **no opina**: ordena por una cifra publicada por una fuente, y nada más. No hay puntuaciones, medias ni «el mejor coche» (visión; PRD-003, RF-13).

## 2. Objetivo y métricas
- Un visitante llega a cualquier ranking publicado en **≤ 2 interacciones** desde la portada, sin JavaScript. (La portada no enlaza hoy a rankings: PRD-004 los deja fuera; ver pregunta abierta 8.)
- 100 % de las cifras mostradas en un ranking llevan su fuente y su fecha de consulta (principio 0 de la visión). 0 % de cifras estimadas, deducidas o puestas a 0 (ADR-0001, regla 7).
- 0 versiones sin la cifra del ranking ocupando un puesto.
- Cada ranking es una lista cuya posición se puede comprobar contra los ficheros de `data/raw/` sin cálculo intermedio.

## 3. Alcance
### Incluido
- Rankings ordenados por **una sola cifra** de las que ya tienen fuente y fecha en `architecture/data-model.md`, sección 4: precio (`price`), autonomía WLTP (`wltp_km`), capacidad de batería (`battery_kwh`), potencia (`power_kw`) y potencia máxima de carga (`dc_max_kw`, y `ac_max_kw` si se confirma: pregunta abierta 1).
- Filtros por segmento y por tramo de precio, con los valores y bordes de PRD-001 (RF-10, RF-11).
- Tratamiento explícito de los datos ausentes y de las fuentes no oficiales.
- Reutilizar la presentación de PRD-001 (estado, «Precio con oferta», segmento) y de PRD-002 (dato con fuente, enlace a la ficha), sin bloques nuevos.

### Fuera de alcance
- Cualquier cifra que no exista en el esquema de `data-model.md`: **ventas, matriculaciones, cuota de mercado, valoraciones, consumo, aceleración, maletero, tiempos de carga, garantía**. No hay fuente registrada para ellas (ADR-0001) y la regla es la de PRD-002 y PRD-003: sin dato en el esquema, no se muestra.
- Puntuaciones, medias, índices, «mejor» o «peor», «recomendado», insignias, y cualquier ranking que **combine varios campos** (por ejemplo, autonomía por euro o una nota global) o que **calcule** una cifra nueva (visión; PRD-003, RF-13; ADR-0001, regla 7).
- Rankings por novedad: la fecha de lanzamiento es de modelo y ya se ordena en el catálogo (PRD-001, RF-3). Ver pregunta abierta 1.
- Ranking de marcas.
- Reviews, comparador y catálogo: se enlaza a ellos, no se duplican.
- Cuentas, votaciones, valoraciones del visitante y cualquier cosa que guarde datos suyos (visión).
- Precios en tiempo real, ayudas (Plan MOVES), disponibilidad y enlaces de compra.

## 4. Requisitos funcionales
Un **ranking** es una lista de **puestos**; cada puesto es una **versión** (`versions[]`, `data-model.md`, sección 4) identificada por marca, modelo y `name`. La unidad es la versión porque batería, potencia y carga solo existen por versión y cada puesto debe tener una única cifra con una única fuente, igual que en el comparador (PRD-003, decisión 1). Esto es una deducción que se confirma en la pregunta abierta 2.

- **RF-1:** Cada ranking ordena por **un solo campo** de versión, con este sentido, fijo y visible en la página (el texto de la cabecera lo dice, por ejemplo «de menor a mayor precio»):

  | Ranking | Campo del esquema | Sentido |
  |---|---|---|
  | Más baratos | `price.value` | ascendente |
  | Más autonomía | `wltp_km` | descendente |
  | Más batería | `battery_kwh` | descendente |
  | Más potencia | `power_kw` | descendente |
  | Carga más rápida en continua | `dc_max_kw` | descendente |

  La lista exacta de rankings que se publican está en la pregunta abierta 1; RF-1 solo fija, para cada uno que exista, su campo y su sentido.
- **RF-2:** Un ranking no combina campos, no calcula ninguna cifra, no puntúa y no valora: la cifra de un puesto es el valor del fichero, tal cual (con su `note` si la trae, como en PRD-002, RF-8), y el orden es solo el de esa cifra. Ninguna página de ranking contiene marcas de «mejor», «recomendado», puntuaciones ni textos que opinen.
- **RF-3:** Cada puesto muestra: su número de puesto; la marca (`brand_name`), el modelo (`model`) y el nombre de la versión (`name`), con un enlace a la ficha del modelo (PRD-002, RF-1); la **cifra del ranking** con su unidad; y el estado del modelo con las etiquetas de PRD-001 (RF-7; `on_sale` sin etiqueta). Un puesto no muestra más cifras que la del ranking, salvo el precio cuando es el campo ordenado: el ranking no es una ficha. Qué más lleva el puesto (imagen, segmento) se decide con la pregunta abierta 4.
- **RF-4:** Cada cifra mostrada indica su fuente, la fecha de consulta (`retrieved`) y enlaza a la `url` donde se leyó, junto al valor y no en un bloque aparte (PRD-002, RF-9). Un dato que no viene de una fuente T1 lo dice en su indicación («fuente no oficial»); los de T1 no llevan marca (ADR-0001).
- **RF-5:** Un precio `financed` se muestra con la etiqueta **«Precio con oferta»**, con el texto literal de `price_terms` y un enlace a `price_terms_url` (PRD-001, RF-9; PRD-002, RF-4). Un precio `pvp` no lleva etiqueta. Todos los precios son con IVA y sin ayudas. En el ranking de precio, un precio `financed` entra y se ordena como cualquier otro, siempre con su etiqueta.
- **RF-6:** Una versión **sin la cifra** del ranking (campo omitido o `null`) **no ocupa ningún puesto**: no se pone a 0, no se estima, no se deduce de otro campo, de otra versión ni de `specs`, y no se coloca al final con una cifra inventada (ADR-0001, regla 7). Un ranking de batería, por ejemplo, solo contiene versiones con `battery_kwh`. La cifra de `specs` (valores del modelo entero) no se usa para dar puesto a una versión.
- **RF-7:** El ranking tiene como máximo **N puestos**, con N fijo para todos los rankings (pregunta abierta 3). Si hay menos versiones con la cifra que N, se muestran las que hay, sin rellenar. Si hay cero, la página lo dice y enlaza al catálogo (`/coches`), sin lista vacía ni enlaces rotos.
- **RF-8:** Un ranking se puede **filtrar por segmento** con los valores de PRD-001 (RF-11). El segmento es del modelo, y una versión de un modelo sin segmento (PRD-001, RF-12) no aparece en un ranking filtrado por segmento, porque no se puede afirmar que lo cumpla. El filtro se aplica **antes** de numerar los puestos: los puestos son 1..N dentro del resultado filtrado.
- **RF-9:** Un ranking se puede **filtrar por tramo de precio** con los tres tramos y los bordes de PRD-001 (RF-10): hasta 30.000 € (≤ 30.000), de 30.000 a 45.000 € (> 30.000 y ≤ 45.000), más de 45.000 € (> 45.000). El tramo se aplica al precio de la **versión** (pregunta abierta 5); una versión sin precio no aparece en un ranking filtrado por tramo. Un precio `financed` cuenta como cualquier otro (PRD-001, RF-9). Filtro de tramo y filtro de segmento se pueden combinar, y la combinación se resuelve igual que en RF-8.
- **RF-10:** En un ranking de **precio**, el filtro de tramo de RF-9 es compatible pero no obligatorio; el ranking de precio sin filtros ordena todas las versiones con precio.
- **RF-11:** Modelos publicados: solo entran en un ranking las versiones de modelos publicados. Un modelo con `needs_review: true` no se publica y no aparece en ningún ranking (PRD-001, RF-13). La inclusión de `announced` y `discontinued` está en la pregunta abierta 6; mientras no se decida, cada puesto lleva la etiqueta de estado de RF-3 y no se oculta ninguno por estado.
- **RF-12:** El ranking es de solo lectura y no recoge datos: sin formularios, valoraciones ni elementos de cuenta. No guarda nada del visitante (visión, principios 1 y 2; PRD-001, RNF-5).
- **RF-13:** Cada ranking tiene su propia URL estable y su propio título de página y texto introductorio, no repetidos entre rankings ni con otras páginas del sitio. Si son páginas pregeneradas e indexables o no, y cuáles de las variantes con filtro, está en la pregunta abierta 7.
- **RF-14:** Un puesto no ofrece compra ni intermediación (visión). Puede enlazar a la ficha (RF-3) y, si PRD-003 lo permite para esa versión, a «Comparar» (PRD-003, RF-6 y RF-7); no hay enlace de compra.

## 5. Requisitos no funcionales
- **RNF-1:** Estático o renderizado en servidor para SEO: el HTML servido contiene ya la lista completa de puestos, sin ejecutar JavaScript (ADR-0003). El sentido y el campo del ranking van en el HTML.
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
- `battery_kwh` lleva `basis` (útil, bruta o «sin especificar»); mezclar bases en un mismo orden es engañoso, y cómo se trata está en la pregunta abierta 9.
- No se muestran `open_questions` ni `needs_review` (PRD-002, sección 6).
- Un dato ausente es `null` u omitido y deja a la versión fuera del ranking (RF-6).

## 7. Criterios de aceptación
Todos son verificables sobre el HTML construido, sin ejecutar JavaScript.

- [ ] **CA-1** (→ RF-1): Dado el sitio construido, cuando leo el HTML de cada ranking publicado, entonces el campo y el sentido del orden están en la cabecera con el texto de RF-1, y los puestos siguen ese orden: en «Más autonomía», cada puesto tiene una cifra ≥ la del siguiente; en «Más baratos», ≤.
- [ ] **CA-2** (→ RF-2): Dado el HTML de cualquier ranking, cuando lo reviso, entonces no contiene puntuaciones, medias, «mejor», «recomendado», insignias ni cifras que no estén en un fichero de `data/raw/`; y ningún ranking depende de más de un campo del esquema.
- [ ] **CA-3** (→ RF-3): Dado un ranking, cuando miro un puesto, entonces veo su número, la marca, el modelo, el nombre de la versión, la cifra con su unidad y el estado si el modelo es «Próximamente» o «Descatalogado»; el nombre del modelo enlaza a `/marcas/{marca}/{modelo}/`. Dado un modelo `on_sale`, entonces no lleva etiqueta de estado.
- [ ] **CA-4** (→ RF-4): Dado un ranking, cuando reviso cada cifra, entonces tiene junto a sí la fuente y la fecha `retrieved` del fichero y un enlace a su `url`. Dada una cifra de `tier: T3`, entonces dice «fuente no oficial»; dada una de T1, no.
- [ ] **CA-5** (→ RF-5): Dado el ranking de precio con una versión `financed` y otra `pvp`, entonces la primera lleva «Precio con oferta», el texto literal de `price_terms` y un enlace a `price_terms_url`, y la segunda no lleva etiqueta; y ambas están ordenadas por su `price.value`.
- [ ] **CA-6** (→ RF-6): Dadas tres versiones, una sin `battery_kwh`, una con `battery_kwh: null` y una con 60 kWh, cuando abro el ranking de batería, entonces solo aparece la de 60 kWh; la versión sin dato no aparece ni con 0 ni con otro valor ni al final de la lista. Dado un modelo sin `battery_kwh` en sus versiones pero con `specs.battery_kwh_options`, entonces no aparece.
- [ ] **CA-7** (→ RF-7): Dado un conjunto con más de N versiones con cifra, cuando abro el ranking, entonces hay exactamente N puestos, numerados de 1 a N. Dado un conjunto con 3 versiones con cifra, entonces hay 3 puestos y ninguna fila de relleno. Dado un conjunto con 0, entonces la página dice que no hay versiones con ese dato y enlaza a `/coches`; no hay lista vacía.
- [ ] **CA-8** (→ RF-8): Dado el ranking de autonomía filtrado por `suv_compacto`, cuando lo abro, entonces todos los puestos son de modelos de ese segmento, y los puestos están numerados 1..N dentro del resultado filtrado. Dado un modelo sin segmento, entonces no aparece en ese ranking filtrado, aunque tenga la mayor autonomía.
- [ ] **CA-9** (→ RF-9, RF-10): Dadas versiones de 30.000 €, 30.001 € y 45.000 €, cuando abro el ranking de autonomía filtrado por «hasta 30.000 €», entonces aparece la de 30.000 € y no las otras; con «de 30.000 a 45.000 €», aparecen las de 30.001 € y 45.000 €; con «más de 45.000 €» no aparece ninguna de las tres. Dada una versión sin precio, entonces no aparece en ningún ranking filtrado por tramo, y sí en el ranking sin filtro de tramo si tiene la cifra ordenada. Dado el ranking de precio sin filtros, entonces ordena todas las versiones con precio.
- [ ] **CA-10** (→ RF-11): Dado un modelo con `needs_review: true`, cuando construyo el sitio, entonces ninguna de sus versiones aparece en ningún ranking ni en ninguna otra página. Dado un modelo `announced` o `discontinued` que aparezca en un ranking (según la pregunta abierta 6), entonces lleva su etiqueta de estado.
- [ ] **CA-11** (→ RF-12): Dado el HTML de un ranking, cuando lo reviso, entonces no contiene `<form>`, `<input>`, `<textarea>`, `<select>` ni botones de envío ni elementos de cuenta o valoración. (Los filtros de segmento y de tramo se resuelven con enlaces o con páginas, según se decida en la pregunta abierta 7.)
- [ ] **CA-12** (→ RF-13): Dado el sitio construido, cuando comparo los títulos de página y los textos introductorios de todos los rankings con los de las demás páginas, entonces no coinciden con ninguno; y cada ranking se abre con una URL estable.
- [ ] **CA-13** (→ RF-14): Dado un ranking, cuando recorro sus enlaces, entonces solo llevan a fichas, al catálogo, a las fuentes de los datos y, si procede, a «Comparar»; ninguno lleva a una web de compra.
- [ ] **CA-14** (→ RNF-1): Dado el HTML servido de un ranking, cuando lo leo sin ejecutar JavaScript, entonces contiene la lista completa de puestos con sus cifras y fuentes.
- [ ] **CA-15** (→ RNF-5): Al cargar cualquier ranking no se crea ninguna cookie ni se escribe nada en `localStorage` ni en `sessionStorage`.
- [ ] **CA-16** (→ RNF-6): Dado cualquier puesto, cuando comparo su cifra con el fichero de `data/raw/` que cita, entonces es idéntica, y ningún puesto muestra una cifra que no esté en un fichero.
- [ ] **CA-17** (→ RNF-3): Dado un ranking a 320 px de ancho, cuando uso la página, entonces no hay scroll horizontal y todos los datos son alcanzables; «Precio con oferta», «fuente no oficial» y el estado se distinguen sin el color.

## 8. Decisiones y preguntas abiertas
### Resueltas
- Ninguna todavía. Borrador del 2026-10-13: todo lo que no se deduce de la visión, los PRD y las ADR está en Abiertas.

### Abiertas
1. **¿Qué rankings exactos se publican?** RF-1 lista los cinco campos que hay con fuente y fecha en el esquema. Sin decidir: (a) si se publican todos o solo los que más se buscan; (b) si la carga en alterna (`ac_max_kw`) tiene ranking (dato que depende del cargador de a bordo y suele ser poco discriminante); (c) si hay un ranking de «más novedad» (`launch`, que es de modelo y ya está en el orden del catálogo, PRD-001, RF-3); (d) el sentido de «batería» y «potencia» para quien busca coches pequeños (hoy solo hay orden descendente). No se suponen: RF-1 es una propuesta mínima, no alcance cerrado.
2. **¿Se ordenan versiones o modelos?** RF-1 a RF-14 se escriben con versiones, por la deducción de PRD-003 (decisión 1): batería, potencia y carga solo existen por versión, y así cada puesto tiene una cifra y una fuente. La alternativa es ordenar modelos como PRD-001 (RF-4: tarjeta de modelo por «precio desde» y «autonomía máxima»), que solo sirve para precio y autonomía, y obliga a decir en cada puesto «la mejor versión» y a citar varias fuentes. Mezclar ambos en un mismo producto sería confuso. Confirmar.
3. **¿Cuántos puestos (N)?** No hay dato ni principio que lo fije (por ejemplo 5, 10 o 20). Debe ser el mismo en todos los rankings (RF-7) y compatible con 320 px sin scroll horizontal.
4. **¿Qué lleva un puesto además de RF-3?** PRD-001 define una tarjeta de modelo (marca, modelo, imagen, «precio desde», autonomía máxima, segmento) y se pidió reutilizarla. Pero la tarjeta muestra cifras **de modelo**, que pueden no coincidir con la de la versión ordenada (por ejemplo, «precio desde» frente al precio de una versión cara) y eso confunde. Opciones sin decidir: tarjeta de PRD-001 entera con la cifra de la versión añadida y rotulada; tarjeta reducida (solo marca, modelo, imagen, segmento); o fila de texto (RF-3). Diseño o responsable.
5. **Filtro de tramo de precio (RF-9): ¿sobre el precio de la versión o sobre el «precio desde» del modelo?** PRD-001 aplica los tramos al «precio desde» de modelo. Aquí el puesto es una versión, y aplicar el tramo al «precio desde» dejaría versiones de 50.000 € en «hasta 30.000 €». RF-9 se ha escrito sobre la versión; confirmar.
6. **¿Entran los modelos `announced` y `discontinued`?** PRD-003 (decisión 6) excluye los descatalogados del comparador; PRD-001 los muestra con etiqueta. Un ranking de precio con un coche que ya no se vende, o con un precio previsto de un anunciado, puede engañar. RF-11 los deja entrar con su etiqueta mientras no se decida.
7. **¿Son páginas pregeneradas e indexables?** Y si lo son, ¿solo el ranking sin filtros o también cada variante por segmento y tramo (5 rankings × 10 segmentos × 3 tramos = muchas páginas casi idénticas, el problema que PRD-001 evita)? Y los filtros de RF-8 y RF-9, ¿son enlaces a páginas o se resuelven en el navegador con query string, como en PRD-001, RF-5? Condiciona CA-11 y CA-12 y RF-13. Ver ADR-0003.
8. **¿Dónde se enlazan los rankings?** PRD-004 los deja fuera de la portada y no hay otra entrada; la métrica de ≤ 2 interacciones (sección 2) no es alcanzable sin un enlace. Decidir la entrada (portada, cabecera, catálogo) implica tocar PRD-004 o PRD-001.
9. **Batería con bases distintas.** `battery_kwh` lleva `basis` (útil, bruta, sin especificar). ¿Se ordenan juntas, se separan, o solo entran las de una base? Mezclarlas sin decirlo es engañoso; ocultarlas, deja fuera datos reales. Ahora mismo cada puesto mostraría su base (como PRD-002, RF-6).
10. **Fuentes no oficiales y prioridad.** (a) ¿Entra en un ranking una cifra cuya única fuente es T3? ADR-0001 admite T3 «solo para confirmar datos» y «nunca como única fuente de precio»; el precio ya lo impide, pero para autonomía, batería, potencia o carga no hay regla. RF-4 la deja entrar con «fuente no oficial»; la alternativa es excluirla. (b) Prioridad del PRD: se propone P2 (después de catálogo, ficha, portada y comparador); confirmar.
11. **Empates y nota de exclusión.** (a) Dos versiones con la misma cifra, ¿mismo puesto o desempate por algún criterio (alfabético por marca y modelo)? (b) ¿La página dice cuántas versiones se han dejado fuera por no tener el dato? Informa (y apoya el principio de no esconder), pero es una cifra derivada del catálogo, como el contador de PRD-004, RF-2.

## 9. Historial de cambios
| Fecha | Cambio | Autor |
|---|---|---|
| 2026-10-13 | Borrador inicial: RF-1 a RF-14, RNF-1 a RNF-6, CA-1 a CA-17; 11 preguntas abiertas | Claude |
