---
id: PRD-006
title: Reviews
status: ready        # draft | ready | in-progress | done | deprecated
priority: P2         # P0 imprescindible · P1 importante · P2 deseable
depends_on: [PRD-001, PRD-002]
epic: ""
updated: 2026-10-18
---

# PRD-006 — Reviews

> **Listo (2026-10-18).** El responsable cerró OPEN-1 a OPEN-5 (sección 8): reviews de terceros solo como enlace, datos objetivos de organismos con fuente, nada generado por un agente y un bloque al final de la ficha. Antes de construir hacen falta una ADR y un cambio de esquema (sección 6) y la enmienda de PRD-002 que añade el bloque a la ficha.

## 1. Problema
Quien está comparando coches eléctricos antes de comprar quiere, además de las cifras, saber **cómo se comporta el coche en la práctica**: qué dicen quienes lo han probado. La visión incluye «reviews» entre las áreas del producto y es la única sin PRD. La web ya da cifras con fuente y fecha (PRD-002), las pone lado a lado (PRD-003) y las ordena (PRD-005), pero ninguna de esas páginas dice nada de la experiencia de uso.

El riesgo es doble. Una review es, por naturaleza, una **opinión**, y el producto se apoya en datos estructurados con fuente (principios 0 y 3) y en que «nada se inventa» (ADR-0001, regla 7). Y la visión excluye los comentarios y el contenido generado por usuarios, así que las reviews no pueden venir del visitante. Este PRD fija lo que no se discute y deja al responsable lo que sí.

## 2. Objetivo y métricas
- 100 % de lo que se muestre como review o como resumen de review lleva su origen visible: quién lo dice, dónde (URL exacta) y cuándo se consultó (principio 0; ADR-0001, reglas 2 y 7).
- 0 reviews, valoraciones o resúmenes sin origen verificable.
- 0 datos personales guardados y 0 elementos de escritura para el visitante (principios 1 y 2).
- 0 textos de review redactados, resumidos o traducidos por un agente (RF-6).
- Las métricas de cobertura (cuántas fichas tienen al menos un enlace) no se fijan hasta que el Researcher haya registrado las primeras fuentes.

## 3. Alcance
### Incluido (firme)
- Que lo que se muestre bajo el nombre «review» cumpla los requisitos RF-1 a RF-5.
- Que ninguna review exista como dato de coche sin pasar por el esquema de datos y la ingesta (principio 3).

### Incluido (decidido el 2026-10-18)
- Enlaces a reviews de terceros, sin extracto ni resumen (RF-7), solo de fuentes registradas con sus términos comprobados (RF-8).
- Resultados de pruebas de organismos independientes como dato con fuente (RF-9).
- Un bloque al final de la ficha del modelo (RF-10).

### Fuera de alcance
- Comentarios, valoraciones, votos, «útil / no útil», formularios, cuentas y cualquier contenido del visitante (visión).
- Puntuación propia agregada, «nota global» o «el mejor coche»: ningún PRD vigente lo admite (PRD-003, RF-13; PRD-005, RF-2). Si se quisiera, sería una decisión nueva del responsable, no un supuesto de este borrador.
- Enlaces de compra, afiliación o cualquier monetización (visión).
- Reviews en vídeo incrustado de terceros que cargan scripts o cookies (chocaría con RNF-5 de los otros PRD). Enlazar a un vídeo es un enlace más (RF-7).
- Reviews redactadas, resumidas o traducidas por un agente o por una persona de la web (RF-6).
- Una página propia de reviews por modelo (RF-10).
- Cambios en el esquema, en las ADR o en el código: los decide Arquitectura. Este PRD solo señala la necesidad (sección 6).

## 4. Requisitos funcionales
RF-1 a RF-5 se deducen de la visión y de ADR-0001; RF-6 a RF-10 salen de las decisiones de la sección 8.

- **RF-1:** Todo contenido mostrado como review, extracto o resumen de review indica su **origen**: quién lo firma (medio, organismo o, si lo genera un agente, que es de la factoría), la `url` exacta donde se leyó o se verificó cada afirmación, y la fecha de consulta (`retrieved`), junto al contenido y no en un bloque aparte (PRD-002, RF-9; ADR-0001, regla 2).
- **RF-2:** Una review **no inventa ni estima**: cualquier afirmación factual (cifra, prestación, defecto, valoración atribuida a alguien) tiene una fuente verificable; si no la tiene, no se muestra (ADR-0001, regla 7). El contenido generado no se admite (RF-6).
- **RF-3:** Las reviews son de **solo lectura** y no recogen nada del visitante: sin formularios, comentarios, votos, valoraciones ni elementos de cuenta; sin cookies ni `localStorage`/`sessionStorage` (visión, principios 1 y 2; PRD-001, RNF-5).
- **RF-4:** Solo hay reviews de modelos **publicados**: un modelo con `needs_review: true` no tiene ninguna, igual que no tiene ficha ni tarjeta (PRD-001, RF-13). Una review no se muestra suelta, sin el modelo al que se refiere, y enlaza a su ficha (PRD-002, RF-1).
- **RF-5:** Las reviews **no ofrecen compra ni intermediación**: ningún enlace de compra, afiliación ni oferta. Los enlaces salientes llevan solo a la fuente de la review o a la web oficial de la marca (visión; PRD-002, RF-14).
- **RF-6:** No se muestra como review ningún texto generado: ni redactado, ni resumido, ni traducido por un agente (decisión 2).
- **RF-7:** Una review de un tercero se muestra **solo como enlace**: título, medio, fecha de consulta (`retrieved`) y `url` exacta, sin extracto ni resumen de su texto (decisiones 1 y 3).
- **RF-8:** Solo se enlazan fuentes registradas en `data/sources/<id>.yaml` cuyos términos de uso haya comprobado el Researcher, con el mismo control que el resto de fuentes (ADR-0001, regla 6). Se empieza por organismos de pruebas y medios. Los agregadores de opiniones de propietarios quedan fuera (decisión 3).
- **RF-9:** Un resultado de prueba publicado por un organismo independiente (seguridad, autonomía real…) se muestra como **dato** con `source_id`, `url`, `retrieved` y `tier`; su nivel lo fija Arquitectura (decisión 1).
- **RF-10:** Las reviews se ven en un **bloque al final de la ficha del modelo** (PRD-002), sin página propia. Qué se ve cuando un modelo no tiene ninguna lo decide el diseño (decisión 4).

## 5. Requisitos no funcionales
Los de los demás PRD, que también aplican aquí:
- **RNF-1:** Estático o renderizado en servidor: el HTML servido contiene ya las reviews, sin ejecutar JavaScript (ADR-0003). Cada página de reviews, si la hay, con título propio.
- **RNF-2:** LCP < 2,5 s en móvil 4G.
- **RNF-3:** Accesibilidad WCAG 2.1 AA (ADR-0006); ninguna marca (fuente no oficial, tipo de contenido) depende solo del color; sin scroll horizontal a 320 px.
- **RNF-4:** Idioma español. Textos preparados para i18n. Si una fuente de terceros está en otro idioma, se enlaza sin traducir: una traducción de un agente es contenido generado (RF-6).
- **RNF-5:** Sin cookies ni almacenamiento del navegador.

## 6. Datos
No existe hoy ninguna entidad de reviews en `architecture/data-model.md` (ADR-0008). Principio 3: todo lo que se muestra sale de datos con modelo definido, así que una review necesita, antes de construirse, una **ADR y un cambio de esquema** de Arquitectura. Este PRD no los diseña. Lo que sí pide es que el esquema permita:

- Asociar la review a un modelo (y, si procede, a una versión) existente en `data/raw/`.
- Guardar, por cada review o afirmación, `source_id`, `url`, `retrieved` y `tier`, con los mismos nombres que ADR-0001, regla 2, y registrar la fuente en `data/sources/<id>.yaml`.
- Distinguir el origen del contenido (propio o de tercero) sin que el visitante tenga que adivinarlo.

Los campos concretos, la ingesta y quién los obtiene (hoy solo el Researcher obtiene datos del producto de fuera, ADR-0001) quedan para esa ADR. `open_questions` y `needs_review` no se muestran (PRD-002, sección 6).

## 7. Criterios de aceptación
Verificables sobre el HTML construido y los ficheros de datos, sin JavaScript.

- [ ] **CA-1** (→ RF-1): Dada cualquier review, extracto o resumen mostrado, cuando reviso el HTML, entonces indica quién lo firma, enlaza a la `url` exacta de su fuente y muestra la fecha `retrieved` junto al contenido; y ninguno aparece sin esos tres elementos.
- [ ] **CA-2** (→ RF-2): Dada una afirmación factual mostrada en una review, cuando la busco en los datos, entonces tiene `source_id`, `url`, `retrieved` y `tier` en un fichero de `data/`; y dada una afirmación sin fuente, entonces no está en la página.
- [ ] **CA-3** (→ RF-3): Dado el HTML de cualquier página con reviews, cuando lo reviso, entonces no contiene formularios que envíen datos, campos de texto, botones de voto ni elementos de cuenta; y al cargarla no se crea ninguna cookie ni se escribe nada en `localStorage` ni `sessionStorage`.
- [ ] **CA-4** (→ RF-4): Dado un modelo con `needs_review: true` y reviews registradas, cuando construyo el sitio, entonces ninguna de ellas aparece en ninguna página. Dada una review de un modelo publicado, entonces enlaza a `/marcas/{marca}/{modelo}/`.
- [ ] **CA-5** (→ RF-5): Dada una página con reviews, cuando recorro sus enlaces, entonces solo llevan a fichas, al catálogo, a la fuente de la review o a la web oficial de la marca; ninguno lleva a una web de compra ni lleva parámetros de afiliación.
- [ ] **CA-6** (→ RF-6, RF-7): Dado el bloque de reviews de una ficha, cuando lo reviso, entonces cada entrada es un enlace con título, medio y fecha de consulta, y no contiene texto de la review ni un resumen.
- [ ] **CA-7** (→ RF-8): Dado cualquier enlace del bloque, cuando busco su `source_id`, entonces existe `data/sources/<id>.yaml` con los términos comprobados; y ninguno apunta a un agregador de opiniones de propietarios.
- [ ] **CA-8** (→ RF-9): Dado un resultado de prueba mostrado, cuando lo busco en los datos, entonces tiene `source_id`, `url`, `retrieved` y `tier`.
- [ ] **CA-9** (→ RF-10): Dado el sitio construido, cuando busco reviews, entonces solo aparecen en `/marcas/{marca}/{modelo}/`, en un bloque después del resto de la ficha, y no hay ninguna otra URL de reviews.

## 8. Decisiones y preguntas abiertas
### Resueltas (2026-10-18)
Decididas por el responsable del producto:
1. **Origen (OPEN-1):** D más E. Enlaces a reviews de terceros sin resumen, y datos objetivos de organismos con su fuente. Descartadas: A (no escala), B (choca con «nada se inventa») y C (el resumen es contenido generado).
2. **Contenido generado (OPEN-2):** A, no se admite. B (resumen con cita por afirmación y eval de fidelidad) solo se reabriría con una ADR de evaluación propia. C descartada: incumple la regla 7.
3. **Fuentes (OPEN-3):** solo enlazar, sin resumir ni extractar, fuentes con términos comprobados por el Researcher; empezando por organismos de pruebas y medios; sin agregadores de opiniones de propietarios.
4. **Ubicación (OPEN-4):** A, un bloque al final de la ficha. Obliga a una enmienda de PRD-002. Descartadas: B (páginas casi vacías) y C (dos superficies sin contenido que las justifique).
5. **Prioridad (OPEN-5):** P2, dependiente de PRD-001 y PRD-002.

### Opciones que se consideraron
Se conservan como registro. En la ejecución que escribió el borrador no había red, así que no se comprobó ningún término de uso de terceros: lo que se dice de las fuentes es hipótesis que debe verificar el Researcher.

#### OPEN-1 — ¿Las reviews son propias (generadas o redactadas) o agregadas de terceros? (resuelta)
(Pregunta de `vision.md`.)

| Opción | Pros | Contras |
|---|---|---|
| **A. Propias redactadas por una persona** | Voz y criterio claros; autoría humana; sin problemas de licencia. | No escala con una factoría de agentes; depende de que el responsable pruebe o lea y escriba; riesgo de afirmaciones sin fuente. |
| **B. Propias generadas por un agente** | Escala con el producto; coherente con «construida por agentes». | Choca de frente con «nada se inventa» si no se ata a fuentes (OPEN-2); un agente no ha probado el coche, así que no puede opinar de la experiencia de uso. |
| **C. Agregadas de terceros: enlazar y resumir** | Aporta la experiencia real de quien probó el coche; el origen es evidente. | Depende de términos de uso ajenos (OPEN-3); cobertura irregular; un resumen automático es contenido generado (OPEN-2). |
| **D. Solo enlaces a reviews de terceros, sin resumen** | El más seguro con términos de uso y con «nada se inventa»; no copia contenido. | Menos valor propio; los enlaces se rompen (revisión periódica, como los de ADR-0001); el visitante sale de la web. |
| **E. Reviews estructuradas con datos objetivos** (por ejemplo, resultados de pruebas de seguridad o de autonomía real publicados por un organismo, con su fuente) | Encaja en el principio 3; cada dato lleva fuente y fecha; no hay opinión que citar. | Solo cubre lo medible; si hay pocas fuentes, pocos modelos tendrán contenido; necesita campos nuevos en el esquema. |

**Recomendada: D como arranque, con E donde haya fuente medible.** Es lo único que cumple a la vez «nada se inventa», datos estructurados primero y los términos de terceros sin generar contenido que haya que defender. Se amplía a C o B solo si la OPEN-2 y la OPEN-3 se resuelven. No es una decisión; si se elige otra, cambian el alcance y los RF.

#### OPEN-2 — ¿Una review generada por un agente cumple «nada se inventa» (ADR-0001)? ¿Cómo se cita cada afirmación? (resuelta)
ADR-0001, regla 7: «Ningún dato se inventa ni se estima: si no hay fuente, el campo queda vacío.» Una review generada es texto libre, y el principio 3 pide datos estructurados, no texto suelto.

| Opción | Pros | Contras |
|---|---|---|
| **A. No se admite contenido generado como review** | Cumple la regla sin matices; cero riesgo de alucinación. | Descarta la opción B de OPEN-1 y cualquier resumen automático. |
| **B. Se admite solo como resumen de fuentes citadas: cada afirmación es una frase con su `source_id`, `url` y `retrieved`, y el eval comprueba que cada una está en la fuente** | Cumple la regla si se verifica; encaja con los evals deterministas de ADR-0004. | Coste de construir y mantener la verificación; la comprobación de que una frase refleja la fuente no es del todo determinista; riesgo de parafrasear de más. |
| **C. Se admite generado sin cita por afirmación, con un aviso «generado por IA»** | Barato. | **Incumple** la regla 7 y el principio 0: un aviso no sustituye a la fuente. No es viable salvo cambio de ADR-0001. |

**Recomendada: A mientras no exista la verificación de B; B después, solo con estructura de afirmaciones citadas** (una afirmación = un hecho = una fuente, nunca un párrafo con una única fuente al final). C no se recomienda. Esta pregunta puede obligar a una ADR de Arquitectura sobre cómo se evalúa la fidelidad a la fuente (ADR-0004).

#### OPEN-3 — ¿Qué fuentes de reviews de terceros se pueden enlazar o resumir sin chocar con sus términos? (resuelta)
La web es personal y sin ánimo de lucro, pero pública e informativa: una fuente cuyos términos excluyen el uso «con fines de información» no se puede usar (ADR-0001, regla 6; visión). Hay que respetar además `robots.txt`. En la factoría no hay red, así que **no se ha comprobado ningún término**: lo siguiente son categorías, no fuentes aprobadas.

| Categoría | Qué se haría | Pros | Contras / riesgo a verificar |
|---|---|---|---|
| **Medios del motor** (T3 en ADR-0001) | Enlazar a su review, con título y medio | Contenido de calidad; enlazar suele ser lo menos restrictivo | Términos de reproducción y de uso de titulares/extractos; copiar o resumir puede exceder lo permitido; T3 «solo para confirmar», no como única fuente de dato (ADR-0001) |
| **Organismos de pruebas independientes** (seguridad, consumo real, etc.) | Mostrar el resultado como dato con fuente y enlace | Dato objetivo y estructurado; encaja en OPEN-1.E | Hay que leer sus condiciones de reutilización; si el dato es medido por terceros, su nivel (T1/T2/T3) lo decide la Arquitectura, no este PRD |
| **Agregadores y bases de datos de reseñas de propietarios** | Enlazar o resumir valoraciones | Cobertura y volumen | Suelen ser contenido de usuarios con datos personales y términos que prohíben la reutilización o el scraping; la visión excluye contenido generado por usuarios propio, y mostrar el ajeno lo reintroduce de hecho |
| **Vídeo (plataformas de vídeo)** | Solo enlace | Muy usado por el público | La incrustación carga cookies y scripts (choca con RNF-5); el enlace es admisible si los términos lo permiten |
| **Webs oficiales de las marcas** | Citar lo que la marca publica como prensa | T1 | No es una review independiente; es lo que ya cubre PRD-002 |

**Recomendada:** solo **enlazar** (con título, medio y fecha de consulta) a fuentes cuyos términos haya verificado el Researcher y registrado en `data/sources/<id>.yaml`, empezando por organismos de pruebas y medios; **no resumir ni extractar** texto de terceros sin una comprobación expresa de sus términos, y **excluir** agregadores de opiniones de propietarios. Cada fuente nueva pasa por el mismo control que las de ADR-0001 (regla 6). La lista concreta de fuentes es trabajo del Researcher, no de este PRD.

#### OPEN-4 — ¿Dónde se ven las reviews? (resuelta)
| Opción | Pros | Contras |
|---|---|---|
| **A. En la ficha del modelo (PRD-002)** | El visitante encuentra todo del modelo en un solo sitio; no crea URL nuevas; es el lugar natural de enlaces de terceros. | Alarga la ficha, que PRD-002 mantiene como «todo lo que se sabe» y ya es larga; obliga a modificar PRD-002 y su ficha (con su cola de tareas y CA). |
| **B. Página propia por modelo** (por ejemplo, colgando de la ficha) | Mantiene la ficha limpia; URL propia indexable; espacio para más contenido. | Páginas casi vacías si hay pocas reviews (PRD-002, decisión 13 evita multiplicar páginas casi iguales); una interacción más. |
| **C. Un resumen en la ficha y la página propia con el detalle** | Equilibra visibilidad y espacio. | Dos superficies que mantener y probar; solo compensa si hay contenido suficiente. |

**Recomendada: A, en un bloque al final de la ficha**, mientras la cobertura sea baja y de solo enlaces (OPEN-1.D). Pasar a C solo si hay contenido suficiente. Elegir A o C **modifica PRD-002**, y eso requiere una enmienda propia de ese PRD; este borrador no lo toca.

#### OPEN-5 — Prioridad y dependencia (resuelta)
Se ha puesto P2 por analogía con PRD-005, y depende de PRD-001 y PRD-002 porque las reviews cuelgan de un modelo publicado. No hay decisión del responsable sobre la prioridad: se confirma al cerrar OPEN-1.

## 9. Historial de cambios
| Fecha | Cambio | Autor |
|---|---|---|
| 2026-10-18 | OPEN-1 a OPEN-5 resueltas; RF-6 a RF-10 y CA-6 a CA-9; pasa a ready | Claude |
| 2026-10-18 | Borrador inicial: RF-1 a RF-5, RNF-1 a RNF-5, CA-1 a CA-5; 5 preguntas abiertas (OPEN-1 a OPEN-5), cada una con opciones y recomendación | Claude |
