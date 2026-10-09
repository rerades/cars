---
id: PRD-004
title: Portada
status: draft        # draft | ready | in-progress | done | deprecated
priority: P0         # P0 imprescindible · P1 importante · P2 deseable
depends_on: [PRD-001, PRD-002]
epic: ""
updated: 2026-10-09
---

# PRD-004 — Portada

## 1. Problema
Quien llega a siete3.com no sabe todavía qué hay ni por dónde empezar. PRD-001 y PRD-002 miden «≤ 3 interacciones desde la portada» para llegar al catálogo y a un modelo, pero ningún PRD dice **qué es la portada**. Hoy `/` es el borrador de la historia #33 (`web/src/pages/index.astro`): una lista de todos los modelos con el precio en bruto y el `source_id`, que no orienta, repite lo que ya hacen el catálogo y la ficha y enseña datos sin la presentación que les exige PRD-001 (RF-9) y PRD-002 (RF-4, RF-9).

La portada es una **puerta de entrada**: dice qué es la web y lleva al catálogo y a los modelos por los caminos que ya existen. No es un tercer sitio donde se vuelven a mostrar los datos.

## 2. Objetivo y métricas
- Un visitante llega desde `/` a cualquier página del catálogo (`/coches`, marca, segmento, tramo de PRD-001, RF-10) en **1 interacción**, y a la ficha de cualquier modelo publicado en **≤ 2** (portada → página de marca → ficha), dentro del límite de ≤ 3 de PRD-001 y PRD-002.
- Una interacción es un clic o un toque en un enlace. Ninguna de esas rutas exige JavaScript.
- La portada no muestra ningún dato de coche que no lleve su fuente y su fecha (principio 0 de la visión, ADR-0001). La versión actual del borrador no cumple el formato; esta es la que manda.
- La portada se sirve con su HTML completo, sin depender de JavaScript (ADR-0003).

## 3. Alcance
### Incluido
- Cabecera con el nombre de la web y un texto de entrada que dice qué es.
- Contador de modelos publicados.
- La franja «Explorar» de PRD-001 (RF-10) con los mismos enlaces: marcas, segmentos, tramos de precio y de autonomía, y «Todos los coches».
- Estado vacío si no hay modelos publicados.

### Fuera de alcance
- Catálogo, filtros, ordenación y páginas de marca, segmento y tramo (PRD-001) y ficha del modelo (PRD-002): la portada solo enlaza a ellos y no los duplica.
- Bloques nuevos de contenido (novedades, destacados, cifras de mercado, rankings, reviews): ver preguntas abiertas.
- Cuentas, favoritos, alertas, newsletter, formularios, comentarios o cualquier cosa que recoja o guarde datos del visitante (visión).
- Vender, intermediar o promocionar marcas o modelos (visión: no es un marketplace).
- Precios en tiempo real y ayudas (PRD-001).

## 4. Requisitos funcionales
- **RF-1:** La portada (`/`) muestra un `h1` con el nombre de la web, un texto de entrada propio que dice qué es (una web de referencia de coches eléctricos comercializados en Europa, con foco en España) y el contador de modelos publicados.
- **RF-2:** El contador de RF-1 cuenta los modelos que tienen tarjeta en `/coches`, de cualquier estado (a la venta, próximamente, descatalogado). No cuenta los que tienen `needs_review: true` (PRD-001, RF-13). Es un recuento del propio catálogo: no es un dato de un coche y no lleva fuente.
- **RF-3:** La portada incluye la franja «Explorar» definida en PRD-001 (RF-10): los mismos cuatro grupos, en el mismo orden y con los mismos textos, más «Todos los coches» que enlaza a `/coches`. Solo enlaza páginas que existen: no hay enlace a marcas ni segmentos sin modelos, y un grupo sin ningún enlace no se pinta. La portada reutiliza esa franja; no define otra.
- **RF-4:** Todo modelo publicado es alcanzable desde la portada en ≤ 2 interacciones sin JavaScript: portada → página de su marca (`/marcas/{marca}`, PRD-001, RF-4) → su ficha (PRD-002, RF-1), usando la tarjeta de PRD-001 (RF-1).
- **RF-5:** La portada no muestra datos sueltos de coche (precio, autonomía, estado, versiones). Quien quiera verlos los encuentra en las tarjetas del catálogo y en la ficha, con su presentación y sus fuentes. Si una versión futura de la portada muestra tarjetas de modelos, son las de PRD-001 (RF-1), sin variantes; y si muestra cualquier otro dato de coche, lleva su fuente y su fecha (ADR-0001, regla 2).
- **RF-6:** Si no hay ningún modelo publicado, la portada muestra el `h1`, el texto de entrada y un aviso de que todavía no hay modelos, sin contador con valor numérico engañoso, sin franja «Explorar» vacía y sin enlaces rotos.
- **RF-7:** La portada tiene su propio título de página, distinto del de cualquier otra página del sitio, y un texto de entrada que no se repite en ninguna otra.
- **RF-8:** La portada es de solo lectura y no recoge datos: no tiene formularios, campos de entrada, botones de envío ni elementos de cuenta, suscripción o contacto.

## 5. Requisitos no funcionales
- **RNF-1:** Estático o renderizado en servidor para SEO: el HTML servido contiene ya el texto, el contador y los enlaces, sin ejecutar JavaScript (ADR-0003).
- **RNF-2:** LCP < 2,5 s en móvil 4G.
- **RNF-3:** Accesibilidad WCAG 2.1 AA (ADR-0006): un solo `h1`, la franja «Explorar» como `nav` con su encabezado, sin scroll horizontal a 320 px (WCAG 1.4.10).
- **RNF-4:** Idioma español. Textos preparados para i18n.
- **RNF-5:** Sin cookies ni almacenamiento de datos personales (`localStorage` incluido).

## 6. Datos
- La portada no define datos nuevos ni usa ningún campo que no esté ya en `architecture/data-model.md` (ADR-0008).
- Solo deriva del catálogo: el número de modelos publicados (RF-2) y las listas de marcas, segmentos y tramos con modelos que ya alimentan «Explorar» (PRD-001, RF-10, RF-11).
- No muestra `open_questions` ni modelos con `needs_review: true` (PRD-001, RF-13; PRD-002, sección 6).

## 7. Criterios de aceptación
Todos son verificables sobre el HTML construido, sin ejecutar JavaScript.

- [ ] **CA-1** (→ RF-1): Dado el sitio construido, cuando leo el HTML de `/`, entonces hay un único `h1` con el nombre de la web, un texto de entrada que menciona coches eléctricos y el contador de modelos.
- [ ] **CA-2** (→ RF-2): Dados tres modelos publicados (a la venta, próximamente y descatalogado) y uno con `needs_review: true`, cuando leo `/`, entonces el contador es 3 y coincide con el número de tarjetas de `/coches`.
- [ ] **CA-3** (→ RF-3): Dado el sitio construido, cuando comparo la franja «Explorar» de `/` con la de `/coches`, entonces tiene los mismos grupos, en el mismo orden, con los mismos enlaces y textos, y además «Todos los coches» enlaza a `/coches`. Cada enlace de la franja resuelve a una página existente del build, y no hay enlace a una marca o un segmento sin modelos.
- [ ] **CA-4** (→ RF-4): Dado el sitio construido, cuando recorro los enlaces del HTML a partir de `/`, entonces para cada modelo publicado existe el camino `/` → `/marcas/{marca}` → `/marcas/{marca}/{modelo}/`, y ninguno necesita más de 2 enlaces.
- [ ] **CA-5** (→ RF-5): Dado el HTML de `/`, cuando lo reviso, entonces no contiene precios, autonomías, versiones ni estados de ningún modelo, ni el `source_id` de ningún dato. Dado que alguna versión posterior incluya algún dato de coche, entonces lleva su fuente y su fecha `retrieved` visibles.
- [ ] **CA-6** (→ RF-6): Dado un build sin modelos publicados, cuando abro `/`, entonces veo el `h1`, el texto de entrada y el aviso de que aún no hay modelos; no hay franja «Explorar» ni enlaces a páginas inexistentes, y la página no da error.
- [ ] **CA-7** (→ RF-7): Dado el sitio construido, cuando comparo los títulos de página y los textos de entrada de todas las páginas, entonces los de `/` no coinciden con los de ninguna otra.
- [ ] **CA-8** (→ RF-8): Dado el HTML de `/`, cuando lo reviso, entonces no contiene `<form>`, `<input>`, `<textarea>`, `<select>` ni botones de envío.
- [ ] **CA-9** (→ RNF-1): Dado el HTML servido de `/`, cuando lo leo sin ejecutar JavaScript, entonces contiene el texto de entrada, el contador y todos los enlaces de «Explorar».
- [ ] **CA-10** (→ RNF-5): Al cargar `/` no se crea ninguna cookie ni se escribe nada en `localStorage`.

## 8. Decisiones y preguntas abiertas
### Resueltas
- Ninguna todavía. Las decisiones de este borrador se deducen de la visión, de PRD-001, PRD-002 y de ADR-0001 y ADR-0003; lo que no se deducía está abajo.

### Abiertas
1. **Numeración: Rankings también es «PRD-004».** PRD-001 (alcance) y PRD-002 (alcance) citan «Rankings (PRD-004)», pero este PRD, pedido para la portada, toma ese número. Hay que decidir si esas dos referencias pasan a «PRD-005» u otro número cuando se escriba el de Rankings. No se ha tocado ningún PRD existente; la tabla de la visión sigue con Rankings «_pendiente_».
2. **¿Hay bloque de novedades en la portada?** Se podría mostrar un número reducido de tarjetas ordenadas por «Novedad» (PRD-001, RF-3: fecha de inicio de venta en España, los modelos sin fecha al final), reutilizando la tarjeta de PRD-001. Las tarjetas ya cumplen la fuente y la fecha (están en la ficha). Queda abierto: si se quiere, cuántas, si incluye «Próximamente» y qué pasa con los modelos sin fecha de inicio de venta. Sin esta decisión el borrador no lo incluye, y la métrica de ≤ 3 interacciones se cumple igualmente (RF-4).
3. **¿Se muestra la fecha de actualización de los datos?** Por ejemplo, «Datos consultados a {fecha}», derivada de la `retrieved` más reciente. El principio 0 pide fecha en todo dato, pero el contador no es un dato de un coche. Hay que decidir si se muestra y con qué regla (más reciente, más antigua, por marca).
4. **¿Se muestran cifras agregadas?** (modelos por marca, rango de precios del catálogo, autonomía máxima). Serían datos derivados de otros con fuentes distintas; falta decidir cómo se atribuyen. De momento no se muestran (RF-5).
5. **¿Hay buscador?** Un cuadro de búsqueda por nombre llevaría a la ficha en 1 interacción, pero no está en ningún PRD ni ADR, y el sitio es estático (ADR-0003). Además contradice el RF-8 tal como está escrito. No se incluye.
6. **El aviso «No se pudieron leer N ficheros»** (ADR-0010) que hoy pinta el borrador de `/`: ¿se muestra al visitante, o es información interna de la ingesta que solo debe verse en los registros de construcción? Se deja fuera del PRD hasta decidirlo.
7. **Texto de entrada y título de la portada:** el redactado concreto queda para el diseño; aquí solo se fijan sus condiciones (RF-1, RF-7).
8. **Prioridad:** se ha puesto P0 porque la métrica de ≤ 3 interacciones de PRD-001 y PRD-002 (ambos P0) parte de la portada. Confirmar.

## 9. Historial de cambios
| Fecha | Cambio | Autor |
|---|---|---|
| 2026-10-09 | Borrador inicial: RF-1 a RF-8, RNF-1 a RNF-5, CA-1 a CA-10; 8 preguntas abiertas | Claude |
