# ADR-0017 — Esquema de datos de las reviews: enlaces de terceros y resultados de pruebas

- **Estado:** aceptada (2026-10-20). Enmienda ADR-0001: T2 incluye los organismos de pruebas
  independientes y los medios pueden ser fuente de un enlace (enmienda del 2026-10-20 en su tabla).
- **Fecha:** 2026-10-20

## Contexto
PRD-006 (Reviews) está en `ready` desde el 2026-10-18 y su sección 6 dice que, antes de construir,
hace falta «una ADR y un cambio de esquema». Hoy `data-model.md` no tiene ninguna entidad de reviews
y su regla «claves desconocidas = error» (sección 1) hace que cualquier clave nueva en
`data/raw/<marca>/<modelo>.yaml` rompa la validación de ADR-0010. Lo que obliga a decidir
(documentos leídos el 2026-10-20):

- **PRD-006, decisiones 1 a 4 (sección 8):** solo dos tipos de contenido. **D:** enlaces a reviews
  de terceros sin resumen ni extracto. **E:** resultados de pruebas de organismos independientes como
  dato con fuente. Nada generado (decisión 2). Un bloque al final de la ficha, sin página propia
  (decisión 4).
- **RF-7:** una review de un tercero es solo un enlace con título, medio, `retrieved` y `url` exacta.
- **RF-9:** un resultado de prueba es un dato con `source_id`, `url`, `retrieved` y `tier`, y
  «su nivel lo fija Arquitectura».
- **RF-8 y CA-7:** solo fuentes registradas en `data/sources/<id>.yaml` con sus términos comprobados
  por el Researcher; sin agregadores de opiniones de propietarios.
- **RF-4 y CA-4:** nada de un modelo con `needs_review: true`; una review no existe suelta, sin su
  modelo. **RF-6:** ningún texto redactado, resumido ni traducido por un agente; RNF-4: lo que está en
  otro idioma se enlaza sin traducir. **RF-5:** ningún enlace de compra ni afiliación.
- **PRD-006, sección 6:** asociar a un modelo y, si procede, a una versión de `data/raw/`; los
  cuatro nombres de ADR-0001, regla 2; distinguir el origen (propio o de tercero).
- **ADR-0001:** solo el Researcher obtiene datos del producto; la tabla de niveles no contempla ni
  medios como fuente de un enlace ni organismos de pruebas. T2 incluye «documentación de
  homologación»; T3, «medios del motor reconocidos», «solo para confirmar datos». Regla 3: si dos
  fuentes discrepan, prevalece el nivel más alto.
- **ADR-0008 y `data-model.md`:** un esquema único validado al escribir; todo dato es un `Sourced`
  (`value`, `source_id`, `url`, `retrieved`, `tier`, `note`); la unidad va en el nombre del campo y
  `unit` solo existe en `price`.
- **ADR-0010:** `node factory/validate-data.ts` valida todo `data/raw/` y el registro en la CI con
  las comprobaciones de `factory/evals.ts`; bloquea forma y procedencia, avisa de antigüedad
  (> 45 días) y de fuentes `broken`.
- **ADR-0011:** la fusión automática solo admite PR cuyo diff esté en `data/raw/`, `data/images/` o
  `docs/bitacora/`; `data/sources/` queda fuera y la revisa una persona.
- **El registro actual no da el nombre del medio.** `data/sources/diariomotor-es.yaml` (T3) tiene
  `brand: (varias; medio del motor)` y `kind: [ announcements ]`; `idae-es.yaml` (T2),
  `brand: (varias; datos de homologación)`. Ningún campo del registro sirve para mostrar «medio» ni
  dice que los términos se hayan comprobado para enlazar reviews. Hoy no hay ningún organismo de
  pruebas registrado.

## Opciones consideradas

### 1. Dónde viven los datos
- **A. En el YAML del modelo (`data/raw/<marca>/<modelo>.yaml`), dos listas nuevas.**
  - Pros: la asociación al modelo es la ruta del fichero y la asociación a la versión se comprueba
    dentro del mismo fichero (`name`); RF-4 sale gratis: el build ya no publica un modelo
    `needs_review` y con él no publica nada de lo que cuelga; un validador, un esquema, una lectura
    en el build; si el modelo se renombra o se borra, sus reviews van con él; queda dentro de la
    lista de rutas de ADR-0011.
  - Contras: el Researcher trabaja hoy por marca y las reviews se buscan por fuente (un medio, un
    organismo), así que una tarea de reviews toca ficheros de muchas marcas y puede chocar con el
    refresco mensual de esas marcas (ADR-0010); los ficheros crecen.
- **B. Ficheros aparte espejo del modelo (`data/reviews/<marca>/<modelo>.yaml`).**
  - Pros: separa la ficha técnica de lo que no es dato de fabricante; el refresco de una marca no
    choca con una tarea de reviews.
  - Contras: obliga a una comprobación cruzada nueva (que el modelo exista, que la versión exista,
    ficheros huérfanos tras renombrar); RF-4 depende de que el build cruce dos ficheros; una ruta
    nueva que ADR-0011 no admite, así que haría falta enmendarla o que toda PR de reviews espere a una
    persona; otra carpeta que el validador tiene que recorrer.
  - **Descartada:** el choque que evita es un conflicto de git que se resuelve rebasando; lo que
    añade es un cruce entre ficheros que hoy no existe y una enmienda de ADR-0011.
- **C. Un fichero por fuente (`data/reviews/<source_id>.yaml`) con la lista de modelos que cubre.**
  - Pros: encaja con cómo se buscarán las reviews (fuente a fuente) y con el registro, que ya es un
    fichero por fuente.
  - Contras: los mismos que B y peor: la ficha tiene que reunir entradas de todos los ficheros; el
    modelo se nombra por texto (`brand` + slug) y un renombrado deja referencias rotas que solo un
    cruce detecta; dos tareas sobre el mismo medio chocan en el mismo fichero. **Descartada.**

### 2. Qué forma tiene un resultado de prueba (RF-9)
- **Un `Sourced` por métrica, con la métrica de una lista cerrada** (elegida): reutiliza la forma
  que ya comprueba el eval de ADR-0004 (`rawData`) sin cambios.
- **Un texto literal del resultado («5 estrellas»):** descartada. No es un dato estructurado
  (principio 3), no se puede validar y empuja a traducir o reformular (RF-6).
- **Campos fijos por organismo (`euro_ncap_stars`…):** descartada. Ata el esquema a nombres de
  organismos y a lo que este documento supondría que publican, sin haberlo comprobado: es inventar
  requisitos.

### 3. Con qué nivel entra cada tipo de fuente
- **Enlaces a reviews: T3, el de la fuente en el registro** (elegida para medios). Son los «medios
  del motor» de ADR-0001. La restricción «solo para confirmar» de T3 es para valores que compiten con
  los de la marca; un enlace no es un valor que discrepe de otro, es la cita de la propia fuente.
- **Resultados de pruebas: T2** (elegida). Es lo más parecido a «documentación de homologación»:
  un organismo que mide con un protocolo publicado. T1 no: no es la marca. T3 no: «solo para
  confirmar» impediría mostrar un dato que, por naturaleza, solo publica ese organismo. Como ninguna
  marca publica la misma métrica, la regla 3 de ADR-0001 no entra en juego.
- **Un nivel nuevo (`T0`, `ORG`) para organismos:** descartada. Cambia la tabla de ADR-0001, el eval
  (`tier` ∈ T1|T2|T3) y todos los lectores, para expresar lo que T2 ya expresa.

### 4. De dónde sale el nombre del medio (RF-7)
- **Un campo `outlet` en cada enlace:** descartada. El mismo medio se escribiría a mano en cada
  fichero y divergiría (es el problema que ADR-0008 resolvió con `brand_name`).
- **El `brand` del registro:** descartada. Hoy vale `(varias; medio del motor)`, que no es un nombre
  de presentación.
- **Una clave nueva `name` en el registro** (elegida): un nombre por fuente, en un sitio.

## Decisión
**Las reviews viven en el YAML de su modelo, en dos listas opcionales nuevas, `reviews` (enlaces a
terceros, fuentes T3 o T2) y `test_results` (un `Sourced` por métrica, fuentes T2), cada entrada
asociable a una versión del mismo fichero, y `validate-data.ts` las rechaza si no cumplen las reglas
de abajo.**

### `reviews` (RF-7) — lista; ausente o `[]` si no hay ninguna
| Clave | Tipo | Obligatoria | Nota |
|---|---|---|---|
| `title` | texto | sí | Título **literal** de la pieza, en su idioma, sin traducir ni acortar (RF-6, RNF-4) |
| `url` | URL `https://` | sí | La URL exacta de la review |
| `source_id` | texto | sí | Fichero en `data/sources/`; da el medio (`name`) |
| `retrieved` | `YYYY-MM-DD` | sí | Fecha en que el Researcher comprobó que la página existe y trata de este modelo; no futura |
| `tier` | `T2` \| `T3` | sí | Igual al del registro. `T1` se rechaza: la web de la marca no es una review (PRD-006, OPEN-3) |
| `version` | texto | no | `name` de una versión del mismo fichero, si la review trata solo de esa; ausente = el modelo |

No hay `value`: un enlace no es un dato, así que no es un `Sourced` y el eval `rawData` no lo ve; lo
comprueban las reglas propias de abajo. No hay `summary`, `excerpt`, `rating`, `text` ni `outlet`:
son claves desconocidas y fallan (regla 2 de `data-model.md`). El medio que ve el visitante es el
`name` del registro.

### `test_results` (RF-9) — lista; ausente o `[]` si no hay ninguno
`Sourced` (`value`, `source_id`, `url`, `retrieved`, `tier`, `note`) más:

| Clave | Tipo | Obligatoria | Nota |
|---|---|---|---|
| `test` | texto | sí | Nombre literal de la prueba o del protocolo tal como lo publica el organismo |
| `metric` | valor de la lista cerrada de `data-model.md` | sí | Fija el tipo y la unidad de `value` (unidad en el nombre: `_km`, `_kwh`…; sin `unit`) |
| `version` | texto | no | `name` de una versión del mismo fichero si el organismo probó esa; ausente = el modelo |
| `tier` | `T2` | sí | Igual al del registro |

**La lista de `metric` empieza vacía.** Este documento no sabe qué publica cada organismo y no lo
supone. La primera PR del Researcher que registre un organismo propone sus métricas, y una persona
las añade a `data-model.md` (con tipo, unidad y rango) antes o en la misma PR, igual que se amplía
`segment`. Hasta entonces, cualquier `test_results` no vacío falla.

### Registro de fuentes (`data/sources/<id>.yaml`)
- Valores nuevos de `kind`: `reviews` y `tests`.
- Claves nuevas, **obligatorias si `kind` incluye `reviews` o `tests`**: `name` (nombre de
  presentación del medio u organismo, el que ve el visitante), `terms_url` (página de términos o de
  reutilización leída) y `terms_checked` (`YYYY-MM-DD`, no futura). Son la prueba verificable de RF-8
  y CA-7; el criterio de si los términos lo permiten sigue siendo el de ADR-0001, regla 6, y lo
  revisa una persona porque `data/sources/` está fuera de la fusión automática (ADR-0011).

### Qué comprueba `validate-data.ts` (con las comprobaciones de `factory/evals.ts`, ADR-0010)
Bloquean (error):
1. `reviews` y `test_results`, si están, son listas; cada entrada solo tiene las claves de arriba.
2. `source_id` existe en el registro; su fichero tiene `kind` con `reviews` (para `reviews`) o `tests`
   (para `test_results`), y `name`, `terms_url` y `terms_checked`.
3. `tier` es igual al del registro; en `reviews` es `T2` o `T3`; en `test_results`, `T2`.
4. `url` empieza por `https://` y su host es el de alguna URL de `urls` del registro o un subdominio
   suyo (un enlace de un medio apunta a ese medio, no a otro sitio: RF-5 y CA-5).
5. `retrieved` (y `terms_checked`) no son futuras.
6. `version`, si está, es el `name` de una versión del mismo fichero.
7. Sin duplicados: dos `reviews` con la misma `url`, o dos `test_results` con el mismo `source_id`,
   `test`, `metric` y `version`, fallan.
8. `metric` está en la lista de `data-model.md` y `value` cumple su tipo y rango.

Avisan (no bloquean), como el resto de ADR-0010:
9. `retrieved` de más de 45 días; `source_id` de una fuente `broken`.
10. `url` con parámetros de consulta (`?…`): puede ser seguimiento o afiliación; lo mira una persona.
11. Un modelo `needs_review: true` con `reviews` o `test_results`: es válido (CA-4 lo presupone) y el
    build no lo publica, pero se avisa para que se note.

### RF-4, RF-6 y el origen
- **RF-4:** el build lee las listas solo de modelos publicados; como viven en el fichero del modelo,
  no hay forma de mostrar una entrada sin su modelo.
- **RF-6:** el esquema no tiene ningún campo de texto propio: `title` y `test` son literales de la
  fuente, y `note` (de `Sourced`) es un matiz del dato, no una valoración. Que `title` sea literal no
  lo puede comprobar el validador.
- **Origen (sección 6 del PRD):** todo lo de estas dos listas es de un tercero, por construcción. El
  contenido propio de la factoría no existe (RF-6), así que no hace falta un campo que lo distinga.

### Fuera de esta decisión (pendiente)
- ~~El cambio de `data-model.md` (secciones 3, 6 y 8) se escribe al aceptar esta ADR, con un ejemplo
  ficticio de `acme`.~~ Hecho el 2026-10-20: sección 3.1, regla 11 de la sección 6 y regla 5 de la 8.3.
  El ejemplo usa un medio ficticio, `motorejemplo-es`.
- ~~El cambio de `factory/evals.ts` y sus pruebas, el de `.claude/agents/researcher.md`~~ (hecho el
  2026-10-20, en la misma PR que `data-model.md`) y las tareas de la cola: los hacen una persona o el
  Desarrollador en una sesión sin `FACTORY_AGENT`.
- Cómo se ve el bloque, qué se muestra sin reviews y el orden de las entradas: diseño y la enmienda
  de PRD-002 (PRD-006, decisión 4).
- Si las reviews entran en los JSON del comparador (ADR-0014) o de los rankings (ADR-0015): no; ningún
  PRD lo pide.

## Consecuencias
**Buenas**
- Un esquema, un validador y un fichero por modelo, como hasta ahora; el build no cruza ficheros y
  RF-4 no necesita código propio.
- `test_results` es un `Sourced` y hereda las comprobaciones de procedencia de ADR-0004 y ADR-0010
  sin tocarlas.
- No hay sitio en el esquema para un resumen, una nota ni una traducción: RF-6 queda impedido por la
  forma, no por una instrucción al agente.
- El medio tiene un solo nombre, en el registro, y los términos comprobados dejan rastro con URL y
  fecha (CA-7).

**Malas (las que se olvidan)**
- **Hasta que cambien `data-model.md` y `evals.ts`, el Researcher no puede escribir ni una review:**
  las claves nuevas son desconocidas y fallan. Los dos cambios tienen que ir antes que cualquier tarea
  de reviews en la cola, y en la misma PR o con el validador primero.
- **`test_results` no sirve para nada hasta que alguien defina la primera métrica.** Es deliberado,
  pero significa que E (PRD-006, decisión 1) llega más tarde que D.
- **Choques con el refresco mensual.** Una tarea de reviews por medio toca ficheros de varias marcas;
  si coincide con el refresco de una de ellas, las dos PR chocan en el mismo YAML y una se rebasa a
  mano (lo que ya pasa entre PR de agentes). Si es frecuente, conviene que las tareas de reviews vayan
  por marca, no por medio.
- **Fusión automática:** una PR que solo añade enlaces de una fuente ya registrada está en `data/raw/`
  y se fusiona sin persona (ADR-0011) con la revisión del Revisor. Lo que se escapa a la máquina
  (que `title` sea literal, que la página trate de ese modelo y no sea un agregador) depende del
  Revisor. El alta de cada medio u organismo sí la ve una persona.
- **La comprobación de host no prueba nada del contenido**: una URL del dominio correcto puede ser
  una página de ofertas del propio medio. Y es estricta: un medio que sirve sus artículos en otro
  dominio obliga a añadir ese dominio a `urls` del registro.
- **Los enlaces se rompen** (PRD-006, OPEN-1.D). La CI no comprueba URL (ADR-0010, opción 4): una
  review retirada sigue enlazada hasta el siguiente refresco del Researcher; el aviso de 45 días es lo
  único que la señala.
- **Más coste del Researcher** (ADR-0002): buscar reviews es trabajo nuevo, por modelo y por fuente,
  que no está en la estimación de ~0,24 USD por marca de `budgets.yaml`.
- **T2 para organismos amplía el sentido de T2** de ADR-0001 («web de la marca en otro país;
  homologación»). Si se acepta, la tabla de ADR-0001 debería recogerlo con una enmienda fechada.
- **Claves nuevas en el registro** (`name`, `terms_url`, `terms_checked`) solo obligatorias para dos
  `kind`: el registro sigue sin endurecerse para las demás fuentes (decisión del 2026-10-06).

### Preguntas abiertas
Siguen abiertas al aceptarla (2026-10-20). Ninguna bloquea el esquema; se deciden con lo que
encuentre el Researcher en las primeras fuentes.
- ¿Se guarda la fecha de publicación de la review (no la de consulta)? PRD-006 no la pide; sin ella
  no se puede ordenar por novedad ni avisar de reviews de una versión ya retirada.
- ¿Se marca el idioma del enlace (`lang`) para el `hreflang` y para avisar al visitante de que está en
  otro idioma (RNF-4)? No lo pide ningún RF.
- ¿Un enlace a vídeo se distingue de uno a texto? PRD-006 lo trata como «un enlace más».
- ¿Hay un máximo de enlaces por modelo o por medio en el bloque? Lo decide el diseño o Producto.
- ¿Los parámetros de consulta en `url` pasan de aviso a error? Depende de lo que encuentre el
  Researcher en las primeras fuentes.
- Qué organismos y qué métricas: trabajo del Researcher (ADR-0001), no de esta ADR.
