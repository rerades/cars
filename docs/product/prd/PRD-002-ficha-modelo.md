---
id: PRD-002
title: Ficha de modelo
status: ready        # draft | ready | in-progress | done | deprecated
priority: P0         # P0 imprescindible · P1 importante · P2 deseable
depends_on: [PRD-001]
epic: ""
updated: 2026-10-01
---

# PRD-002 — Ficha de modelo

## 1. Problema
Quien ha encontrado un modelo en el catálogo (PRD-001) y quiere decidir si le interesa necesita ver **todo lo que se sabe de ese modelo en un solo sitio**: qué versiones hay, cuánto cuestan, qué autonomía y qué especificaciones tienen, cómo es, en qué estado está (a la venta, próximamente, descatalogado) y, sobre todo, **de dónde sale cada dato y de cuándo es**. La tarjeta del catálogo solo resume (precio desde, autonomía máxima, segmento) y remite a esta página; hoy esa página no está definida.

## 2. Objetivo y métricas
- Todo modelo que aparece en el catálogo tiene su ficha, y la tarjeta enlaza a ella (100 % de las tarjetas con enlace que resuelve).
- Todo dato de coche mostrado en la ficha lleva visible su fuente y su fecha de consulta (100 % de los datos mostrados; principio 0 de la visión).
- El visitante llega a la ficha de un modelo en ≤ 3 interacciones desde la portada (la misma métrica que PRD-001).
- La ficha se sirve con su HTML completo, sin depender de JavaScript para mostrar los datos (ADR-0003).

## 3. Alcance
### Incluido
- Una página por modelo con su cabecera (marca, modelo, estado, segmento).
- Lista de versiones con precio, autonomía y especificaciones de cada una.
- Especificaciones del modelo entero cuando la fuente no las da por versión.
- Galería de hasta 6 imágenes con licencia y atribución; silueta si no hay ninguna.
- Fuente y fecha de cada dato.
- Estados «Próximamente» y «Descatalogado».
- Un enlace discreto a la página oficial del modelo y hasta 3 modelos del mismo segmento.

### Fuera de alcance
- Catálogo, filtros y páginas de marca, segmento y tramos (PRD-001).
- Comparador (PRD-003), rankings (PRD-004) y reviews (previstas en la visión, sin PRD todavía).
- Cualquier dato que no exista en el esquema de `architecture/data-model.md` (ADR-0008): dimensiones, maletero, consumo, aceleración, tiempos de carga, garantía, plazas, etc. Si se quieren, primero se cambia el esquema, uno a uno y con fuente (decisión del 2026-10-01).
- Fichas por versión: las versiones van dentro de la ficha del modelo, sin URL propia.
- Precios en tiempo real, disponibilidad en concesionarios, ayudas (Plan MOVES) y cualquier interacción que guarde datos del visitante.

## 4. Requisitos funcionales
- **RF-1:** Cada modelo del catálogo tiene una página propia con una URL estable y única, a la que enlaza su tarjeta del catálogo (PRD-001, RF-1). La URL es `/marcas/{marca}/{modelo}/`, con la carpeta y el nombre del fichero de `data/raw/` (`data/raw/polestar/polestar-2.yaml` → `/marcas/polestar/polestar-2/`).
- **RF-2:** La cabecera de la ficha muestra la marca (`brand_name`), el modelo (`model`), el segmento (`segment`, con la etiqueta española de PRD-001, RF-11) y el estado. Sin segmento, muestra «Segmento por confirmar» (PRD-001, RF-12).
- **RF-3:** La ficha lista **todas las versiones** del modelo (`versions[]`), cada una con su nombre (`name`). Un mismo nombre de versión aparece una sola vez. Las versiones se ordenan por precio, de menor a mayor; las que no tienen precio van al final, en el orden del fichero. En pantallas anchas se presentan en una **tabla comparativa**, con una columna por versión; en móvil, un **bloque por versión**, apilados en el mismo orden y sin scroll horizontal (RNF-3).
- **RF-4:** Cada versión muestra su precio (`price`) en euros, con IVA y sin ayudas. Si el precio es `financed`, lleva la etiqueta «Precio con oferta» y **el texto literal de sus condiciones** (`price_terms`), junto con un enlace a `price_terms_url` (PRD-001, RF-9). Si la versión no tiene precio (`price: null`), muestra «Precio por confirmar». En un modelo `discontinued`, el precio lleva la nota «Último precio publicado».
- **RF-5:** Cada versión muestra su autonomía WLTP (`wltp_km`) en km. Si ninguna versión trae autonomía, la ficha muestra la del modelo entero (`specs.wltp_max_km`) rotulada como dato del modelo, no de una versión.
- **RF-6:** Cada versión muestra, cuando existan, estos campos del esquema: capacidad de batería (`battery_kwh`) **con su base** (`basis`: útil, bruta o «sin especificar»), potencia (`power_kw`), tracción (`drivetrain`, con etiqueta española), potencia máxima de carga en corriente continua (`dc_max_kw`) y en corriente alterna (`ac_max_kw`). Los campos sin dato se muestran como «por confirmar», no se ocultan ni se rellenan con una estimación (ADR-0001, regla 7).
- **RF-7:** Cuando la fuente solo publica un dato para el modelo entero, la ficha muestra los valores de `specs` (`wltp_max_km`, `power_max_kw`, `dc_max_kw`, `ac_max_kw`, `battery_kwh_options`, `drivetrains`) en un bloque rotulado como «del modelo», separado de las versiones.
- **RF-8:** Si un dato trae `note` (por ejemplo, «publicado: 190 CV» o «hasta 631 km, máximo de la gama»), la ficha muestra ese texto junto al dato, tal cual.
- **RF-9:** **Cada dato mostrado** (estado, fecha de lanzamiento, segmento, cada campo de cada versión, cada valor de `specs` y el precio) indica su fuente y la fecha de consulta (`retrieved`), y enlaza a la URL exacta donde se leyó (`url`). Los datos con la misma fuente, URL y fecha pueden agruparse en una sola indicación. El **precio** lleva su fuente y su fecha visibles junto al valor; el resto de datos remite con una nota numerada a un bloque «Fuentes» al final de la ficha, con la fuente, la fecha y el enlace de cada nota. Un dato que no viene de una fuente T1 lo dice en su indicación («fuente no oficial»); los de T1 no llevan marca (ADR-0001).
- **RF-10:** La ficha muestra el estado del modelo. `announced` lleva la etiqueta «Próximamente» y, si existe `launch`, el mes y el año previstos; sin `launch`, «Próximamente» a secas, sin inventar fecha. `discontinued` lleva la etiqueta «Descatalogado». `on_sale` no lleva etiqueta de estado. Un modelo tiene una sola etiqueta (PRD-001, RF-7).
- **RF-11:** Un modelo `announced` sin versiones (`versions: []`) o con versiones sin precio se muestra igual, con los datos que haya y con «por confirmar» en los que falten. Nunca hay una ficha vacía sin explicación: si no hay versiones, la ficha lo dice.
- **RF-12:** La ficha muestra las imágenes del modelo (`images`) que tengan `license`, hasta 6 y en el orden del fichero, cada una con su `attribution` debajo si la licencia la exige. La primera es la principal. La galería se ve entera sin JavaScript (RNF-1). Sin imagen con licencia, muestra la silueta del segmento, o una genérica si tampoco hay segmento (PRD-001, RF-8).
- **RF-13:** La ficha ofrece un enlace de vuelta a la página de la marca (`/marcas/{marca}`, PRD-001, RF-4) y otro al catálogo (`/coches`).
- **RF-14:** La ficha ofrece un enlace de texto «Ver en la web de la marca» a la URL de la fuente del estado (`status.url`). Tiene aspecto de enlace, no de botón de compra: la web no vende ni intermedia (visión).
- **RF-15:** La ficha muestra hasta 3 modelos del mismo segmento y de otras marcas, como tarjetas del catálogo (PRD-001, RF-1), ordenados por la cercanía de su precio desde al del modelo; los que no tienen precio van al final. Un modelo sin segmento no muestra este bloque.

## 5. Requisitos no funcionales
- **RNF-1:** Estático o renderizado en servidor para SEO: el HTML servido contiene ya todos los datos de la ficha, sin ejecutar JavaScript (ADR-0003). Cada ficha tiene un título de página propio que incluye marca y modelo.
- **RNF-2:** LCP < 2,5 s en móvil 4G.
- **RNF-3:** Accesibilidad WCAG 2.1 AA. Ninguna etiqueta ni aviso depende solo del color; sin scroll horizontal a 320 px (WCAG 1.4.10), incluida la presentación de las versiones.
- **RNF-4:** Idioma español. Textos preparados para i18n.
- **RNF-5:** Sin cookies ni almacenamiento de datos personales (`localStorage` incluido).

## 6. Datos
Entidades de `architecture/data-model.md` (ADR-0008); la ficha no usa ningún campo que no esté allí.

| Bloque de la ficha | Campos del esquema |
|---|---|
| Cabecera | `brand_name`, `model`, `segment`, `status`, `launch` |
| Versión | `versions[].name`, `battery_kwh` (+ `basis`), `wltp_km`, `power_kw`, `drivetrain`, `dc_max_kw`, `ac_max_kw`, `price` (+ `price_kind`, `price_terms`, `price_terms_url`) |
| Modelo entero | `specs.*` |
| Imagen | `images[]` (`url`, `source_id`, `retrieved`, `license`, `attribution`) |
| Fuente y fecha | `source_id`, `url`, `retrieved`, `tier` de cada valor `Sourced`; `note` |

- Los datos los obtiene el Researcher siguiendo ADR-0001 y el registro de fuentes `data/sources/<id>.yaml` (un fichero por fuente).
- Autonomía del modelo y tracción del modelo se derivan como en la sección 5 de `data-model.md`.
- **Campos que no se muestran al visitante:** `open_questions`, que son notas internas del Researcher (lo que falta ya se ve como «por confirmar»), y `needs_review` (un modelo marcado no se publica, PRD-001, RF-13). `tier` solo se ve como «fuente no oficial» (RF-9).

## 7. Criterios de aceptación
- [ ] **CA-1** (→ RF-1): Dado un modelo del catálogo, cuando sigo el enlace de su tarjeta, entonces llego a una página que muestra su marca y su modelo; y dados dos modelos distintos, entonces sus URL son distintas.
- [ ] **CA-2** (→ RF-2): Dado un modelo con segmento `suv_compacto`, cuando abro su ficha, entonces la cabecera muestra la marca, el modelo, «SUV compacto» y su estado. Dado un modelo sin segmento, entonces la cabecera muestra «Segmento por confirmar».
- [ ] **CA-3** (→ RF-3): Dado un modelo con tres versiones, una de ellas sin precio, cuando abro su ficha, entonces veo las tres, cada una con su nombre, ninguna repetida, ordenadas de menor a mayor precio y con la que no tiene precio al final. A 1280 px las veo como columnas de una tabla; a 320 px, como bloques apilados en el mismo orden y sin scroll horizontal.
- [ ] **CA-4** (→ RF-4): Dada una versión con precio `pvp`, cuando abro la ficha, entonces veo su precio en euros sin etiqueta «Precio con oferta». Dada una con precio `financed`, entonces veo la etiqueta, el texto literal de `price_terms` y un enlace a `price_terms_url`. Dada una con `price: null`, entonces veo «Precio por confirmar». Dado un modelo `discontinued` con precio, entonces el precio lleva «Último precio publicado».
- [ ] **CA-5** (→ RF-5): Dado un modelo cuyas versiones traen `wltp_km`, cuando abro la ficha, entonces cada versión muestra su autonomía en km. Dado un modelo cuyas versiones no la traen pero con `specs.wltp_max_km`, entonces veo esa cifra rotulada como del modelo.
- [ ] **CA-6** (→ RF-6): Dada una versión con `battery_kwh` de `basis: gross`, cuando abro la ficha, entonces la capacidad aparece indicada como bruta. Dada una versión sin `dc_max_kw`, entonces ese campo muestra «por confirmar» y no un valor.
- [ ] **CA-7** (→ RF-7): Dado un modelo con `specs.battery_kwh_options` y versiones sin `battery_kwh`, cuando abro la ficha, entonces veo las capacidades del modelo en un bloque rotulado «del modelo», y no atribuidas a una versión concreta.
- [ ] **CA-8** (→ RF-8): Dado un dato con `note: "publicado: 190 CV"`, cuando abro la ficha, entonces ese texto aparece junto al dato, idéntico al del fichero.
- [ ] **CA-9** (→ RF-9): Dada una ficha cualquiera, cuando reviso cada dato mostrado, entonces todos indican su fuente y la fecha `retrieved`, y el enlace lleva a la `url` del dato. Ningún dato aparece sin fuente. El precio muestra su fuente y su fecha junto al valor; los demás remiten a una nota del bloque «Fuentes». Dado un dato de `tier: T3`, entonces su indicación dice «fuente no oficial»; dado uno de T1, no.
- [ ] **CA-10** (→ RF-10): Dado un modelo `announced` con `launch: "2026-10"`, cuando abro la ficha, entonces veo «Próximamente» con «oct 2026». Sin `launch`, veo «Próximamente» sin fecha. Dado uno `discontinued`, veo «Descatalogado». Dado uno `on_sale`, no veo etiqueta de estado. En ningún caso hay dos etiquetas de estado.
- [ ] **CA-11** (→ RF-11): Dado un modelo `announced` con `versions: []`, cuando abro la ficha, entonces la página se muestra con cabecera y estado, y un texto que dice que aún no hay versiones publicadas; no aparece vacía ni da error.
- [ ] **CA-12** (→ RF-12): Toda imagen mostrada en una ficha tiene registradas en los datos su fuente y su licencia (como CA-10 de PRD-001). Dado un modelo con 8 imágenes con licencia, entonces la ficha muestra las 6 primeras en el orden del fichero, todas en el HTML servido. Dado un modelo con `attribution`, entonces el texto aparece bajo la imagen. Dado un modelo sin imagen con licencia, entonces la ficha muestra la silueta de su segmento y ninguna imagen de la marca.
- [ ] **CA-13** (→ RF-13): Dada la ficha de un modelo de Renault, cuando uso el enlace de marca, entonces llego a `/marcas/renault`; cuando uso el enlace al catálogo, llego a `/coches`.
- [ ] **CA-14** (→ RNF-1): Dada una ficha servida, cuando leo su HTML sin ejecutar JavaScript, entonces contiene las versiones, los precios, las especificaciones y las fuentes; y su título incluye marca y modelo, distinto del de cualquier otra ficha.
- [ ] **CA-15** (→ RNF-5): Al cargar cualquier ficha no se crea ninguna cookie ni se escribe nada en localStorage.
- [ ] **CA-16** (→ RF-14): Dada una ficha, cuando busco el enlace «Ver en la web de la marca», entonces lleva a `status.url` y es un enlace de texto, no un botón.
- [ ] **CA-17** (→ RF-15): Dado un SUV compacto y cuatro SUV compactos de otras marcas, cuando abro su ficha, entonces veo 3, los de precio desde más cercano, y ninguno de su misma marca. Dado un modelo sin segmento, entonces no hay bloque de modelos relacionados.
- [ ] **CA-18** (→ sección 6): Dado un modelo con `open_questions`, cuando abro su ficha, entonces ninguno de esos textos aparece en la página.

## 8. Decisiones y preguntas abiertas
### Resueltas (2026-10-01)
Decididas por el responsable del producto. Cada una se ha llevado ya a los RF y CA.

1. **URL de la ficha (RF-1):** `/marcas/{marca}/{modelo}/`, con las partes de la ruta del fichero en `data/raw/`, que ya es única y sin espacios. Cuelga de `/marcas/{marca}` (RF-10 de PRD-001). Descartadas: `/coches/{marca}-{modelo}`, que repite la marca, y `/modelos/{marca}/{modelo}`.
2. **Versiones (RF-3):** tabla comparativa en pantallas anchas y bloques apilados en móvil, ordenadas por precio, de menor a mayor. La tabla compara de un vistazo y los bloques evitan el scroll horizontal a 320 px (RNF-3). Descartado: un selector de versión, porque exige JavaScript (RNF-1).
3. **Fuente y fecha (RF-9):** visibles junto al precio, que es el dato más sensible, y notas numeradas en un bloque «Fuentes» para el resto. Descartadas: un enlace junto a cada dato, que llena la tabla de ruido, y todo al pie, que esconde la fecha del precio.
4. **Fiabilidad (`tier`, RF-9):** solo se marca lo que no es T1, como «fuente no oficial». Descartadas: marcarlo siempre, porque lo normal es T1 y sería ruido, y no marcarlo nunca, porque esconde el dato menos fiable.
5. **Modelos con `needs_review: true`:** no se publican, ni ficha ni tarjeta (PRD-001, RF-13).
6. **`open_questions` (sección 6):** no se muestran. Son notas internas, y lo que falta ya se ve como «por confirmar». Descartado: un bloque «Datos que aún no tenemos», que expone texto sin revisar.
7. **Datos fuera del esquema:** quedan fuera. Cada uno entra después con un cambio de ADR-0008 y de `data-model.md`, uno a uno y con fuente. Descartado: ampliar ya el esquema, porque retrasa la ficha y obliga a rehacer los datos de cada marca.
8. **Imágenes (RF-12):** una galería de hasta 6, en el orden del fichero. Descartadas: solo la primera, y todas sin límite, que alarga la página.
9. **Web de la marca (RF-14):** un enlace de texto discreto. Descartados: un botón destacado, que se lee como intermediación, y no poner nada.
10. **Modelos relacionados (RF-15):** hasta 3 del mismo segmento y de otras marcas, que es la comparación que hace el comprador y suma enlaces internos. Descartados: los de la misma marca, que ya están en `/marcas/{marca}`, y ninguno. El orden por cercanía de precio es una propuesta de Producto dentro de esta decisión.
11. **Descatalogados (RF-4):** muestran el precio con la nota «Último precio publicado». Descartados: ocultarlo, y mostrarlo sin nota, que se puede confundir con un precio vigente.
12. **Prioridad:** P0. Las tarjetas de `/coches` ya enlazan a la ficha, así que el catálogo no sale sin ella.
13. **Fichas por versión:** no; hay una ficha por modelo. Descartado: una URL por versión, que multiplica las páginas casi iguales.

### Abiertas
- Ninguna.

## 9. Historial de cambios
| Fecha | Cambio | Autor |
|---|---|---|
| 2026-09-29 | Borrador inicial: RF-1 a RF-13, RNF-1 a RNF-5, CA-1 a CA-15; 13 preguntas abiertas | Claude |
| 2026-10-01 | Resueltas las 13 preguntas abiertas. Ajustados RF-3, RF-4, RF-9 y RF-12, la sección 3 y la sección 6; añadidos RF-14, RF-15 y CA-16 a CA-18. Pasa a ready y P0 | Rod / Claude |
