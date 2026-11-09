# ADR-0026 — Evaluación de los prompts del Researcher con un dataset de PR devueltas

- **Estado:** aceptada (2026-11-09): `fetch/` fuera de git, se empieza con 4 casos y se comparten los 40 USD/mes de `evals:` (ver «Preguntas abiertas»). Enmienda [ADR-0016](0016-evaluacion-de-prompts-con-langfuse.md) (añade un
  segundo dataset, `researcher`, con su propio evaluador) y
  [ADR-0022](0022-escalera-de-confianza-y-agente-retro.md) (el retro puede proponer cambios a
  `researcher.md` cuando su dataset exista).
- **Fecha:** 2026-11-05

## Contexto
- **ADR-0016** evalúa solo al Reviewer: «Se empieza por el **Reviewer**. Los demás agentes quedan
  fuera de esta ADR». Su esquema (casos versionados en `factory/datasets/<agente>/`, subida a
  Langfuse, `eval-run.ts` con el arranque del orquestador, scores de código más juez, bloque `evals:`
  de `budgets.yaml` con 15 USD por experimento y 40 al mes) es el que se reutiliza aquí.
- **ADR-0022 / PRD-007 RF-10 y CA-13:** el retro propone cambios a `.claude/agents/*.md` como texto y
  una persona los aplica «con el resultado de `factory/eval-run.ts`». «Mientras solo el Revisor tenga
  dataset, solo propone cambios a su prompt». La bitácora del 2026-11-04 (00:25) lo deja escrito: el
  Researcher es el agente de los `review:changes` de **#806, #808, #814 y #824**, y el código del retro
  (`run.ts --retro`) espera a esta ADR.
- **Qué pasó en esas PR**, según la bitácora (no he podido leer las revisiones, ver más abajo):
  #806, #814 y #824 (refrescos de Cupra, BMW y Tesla) se repitieron «ya con la regla de fechas de
  #828» (2026-11-01 18:24); #808 (Polestar) se repitió «ya con la regla de fechas y un criterio de
  precio financed igual para todos los modelos» (2026-11-04 00:10). Las reglas de `researcher.md` que
  corresponden son:
  - **Fechas:** «Una fecha solo cambia con una lectura que llegue a la PR»: `retrieved` y
    `last_verified` solo suben si en esta ejecución `fetch-page.ts` (o `fetch-idae.ts`) leyó la `url`
    y la salida muestra el valor; si no, se quedan y va a `open_questions` (ADR-0010, punto 7).
  - **Precio:** PVP sin ayudas y `price_kind: pvp`; si no hay PVP limpio, `financed` con
    `price_terms` literal y `price_terms_url`; con dos importes, `value` es el de contado; oferta
    vencida → otra oferta, PVP o `price: null` (ADR-0010, punto 8); «La prueba de un precio es la salida
    de `fetch-page.ts`», una llamada por `price.url` cambiada o no encontrada, con importe y versión;
    `page_name` literal (ADR-0020, «Nombre de la versión en la página»).
- **ADR-0020:** ya existe código sin modelo que busca un número o un `price_terms` en el texto de
  `htmlToText`, con grafías, anclaje a la versión y unidades. RNF-1 de PRD-007: sin modelo donde baste
  el código.
- **ADR-0010:** el validador de `data/` (`validate-data.ts`, `evals.ts`) ya rechaza un fichero fuera del
  esquema y un `financed` con `retrieved` posterior al fin de su oferta.
- **ADR-0004:** la traza de cada ejecución es `ops/traces/<run_id>.jsonl` (`stream-json`), con cada
  llamada a herramienta y su resultado. **`ops/traces/` no se versiona** «porque pesa y contiene
  contenido de webs de terceros».
- **ADR-0001:** solo el Researcher obtiene datos externos; el experimento no debe leer la web (lo pide
  la tarea).
- **`factory/budgets.yaml`** (leído el 2026-11-05): `researcher.max_usd_per_run: 1.50`
  (USD-equivalentes); `evals.max_usd_per_experiment: 15` y `evals.max_usd_per_month: 40`, compartidos.

### Lo que no he podido comprobar en esta ejecución
- **Las revisiones de #806, #808, #814 y #824.** `gh pr view <n> --comments` pide una aprobación que
  en esta ejecución no se concede. Lo que digo de esas PR sale solo de la bitácora (entradas citadas
  arriba). Qué valores concretos incumplieron cada regla lo fija la persona al escribir cada
  `case.yaml`.
- **Que las trazas de esas cuatro ejecuciones sigan en `ops/traces/`** (no se versionan; pueden
  haberse perdido) y que el `tool_result` de `fetch-page.ts` venga completo y no recortado en el
  `stream-json`. Se comprueba al crear el primer caso.
- No he consultado documentación externa: la decisión no compara herramientas nuevas; reutiliza las
  de ADR-0016, cuyas fuentes siguen allí.

## Opciones consideradas

### 1. Qué es un caso
- **A. Tareas nuevas contra la web en vivo.** Descartada: la tarea pide que el experimento no lea la
  web; la página cambia entre línea base y candidata (una oferta que vence), así que dos versiones del
  prompt no ven lo mismo; y gasta peticiones a terceros (ADR-0001, cortesía de ADR-0020).
- **B. Casos sintéticos con páginas inventadas.** Descartada como base: miden páginas que no existen,
  y el Researcher falla con las reales (cascarones de JavaScript, ofertas con dos importes). Se
  admiten para huecos, como en ADR-0016, marcados `synthetic: true`.
- **C. Una PR del Researcher que recibió `review:changes`, con su tarea, los ficheros de partida y la
  salida de `fetch-page.ts` congelada desde su traza (elegida).** Es lo que pide la tarea y lo que
  el retro produce de forma natural: cada señal es un caso candidato.

### 2. Cómo se impide que lea la web
- **A. Solo congelar `fetch-page.ts` y dejar `WebSearch` y `WebFetch`.** Descartada: el agente podría
  orientarse con la web de hoy y el experimento dejaría de ser repetible.
- **B. Un proxy que graba y reproduce HTTP.** Descartada: más piezas para cubrir tres scripts que ya
  son los únicos con red del Researcher, y no cubre las herramientas `WebSearch`/`WebFetch`.
- **C. Sustituir en el worktree del caso `fetch-page.ts`, `fetch-idae.ts` y `fetch-image.ts` por
  reproductores de la instantánea, y quitar `WebSearch` y `WebFetch` de `allowed_tools` del
  experimento (elegida).** Es el equivalente al `gh` falso de ADR-0016.

### 3. Qué se compara y con qué evaluador
- **A. Solo juez LLM sobre el diff.** Descartada: las reglas de fechas y de precio se comprueban
  mirando si un valor está en un texto, que es lo que ya hace ADR-0020 sin modelo (RNF-1).
- **B. Comparar el YAML de salida con el YAML que acabó fusionándose.** Descartada como única medida:
  la repetición se hizo días después y contra otra página; penalizaría diferencias legítimas.
- **C. Código determinista sobre la salida del agente y la instantánea, más un resultado esperado
  por campo que fija una persona; juez solo para `open_questions` (elegida).**

### 4. Cómo lo usa el retro
- **A. Mantener la restricción de ADR-0022.** Descartada: el agente con más señales quedaría sin
  propuestas, que es por lo que se encoló esta ADR.
- **B. Permitirle proponer sobre cualquier agente.** Descartada: una propuesta que nadie puede medir
  contradice RF-10 («con el resultado de `eval-run.ts`»).
- **C. Permitirle proponer sobre los agentes con dataset, que pasan a ser Reviewer y Researcher, y
  pedirle un `case.yaml` por cada `review:changes` del Researcher (elegida).**

## Decisión
**Los prompts del Researcher se evalúan con un dataset `factory/datasets/researcher/` de PR suyas
devueltas con `review:changes`, cada una con su tarea, sus ficheros de partida y las salidas de
`fetch-page.ts` congeladas desde su traza, ejecutadas sin red y puntuadas por código con las reglas
de fechas y de precio de `researcher.md`, con un juez solo para `open_questions`.**

Rutas y nombres son la propuesta para quien implemente (`factory/` y `.claude/` los escribe una
persona, RNF-3). Lo que no se dice aquí sigue como en ADR-0016.

### 1. Un caso
Directorio `factory/datasets/researcher/pr-NNNN/`:
- `case.yaml`:
  - `pr`, `run_id` de la ejecución original, `baseRefOid` (commit de partida) y `task`: el texto
    literal de la tarea que recibió (de la fila de `ops/runs/` o del inicio de la traza).
  - `rules`: las reglas que la PR incumplió, de una lista cerrada (ver 3): `dates`, `price_proof`,
    `price_kind`, `cash_amount`, `expired_offer`, `page_name`.
  - `expected`: por cada fichero de `data/` que la tarea afecta, lo que una persona da por correcto
    **con la instantánea**: por campo tocado, `value` esperado (o `null`), `price_kind`, y si su
    `retrieved` debe cambiar (`fresh`) o quedarse (`kept`). Solo los campos de las reglas del caso;
    el resto no se puntúa.
  - `synthetic: false` salvo los casos de hueco.
- `files/`: copia de los ficheros de `data/raw/` y `data/sources/` que la tarea afecta, tal como
  estaban en `baseRefOid`. (El worktree se crea en ese commit; la copia sirve para que el caso se
  lea sin git.)
- `fetch/` (**fuera de git**, en `ops/datasets/researcher/pr-NNNN/fetch/`; en `case.yaml` queda el `sha256` de cada entrada, y el caso no corre si no coincide): una entrada por llamada a `fetch-page.ts`, `fetch-idae.ts` o `fetch-image.ts` de la
  traza original: argumentos, código de salida y salida JSON literal, extraídos del `tool_result`.
  Para `fetch-page.ts` se guarda la salida **sin palabras** (texto completo de la página) si la
  traza la tiene; si solo hay la salida filtrada por palabras, se guarda esa y el caso lo dice
  (`fetch_partial: true`).
- `review.md`: el comentario `🏭 Veredicto:` del Reviewer en la PR, como referencia para la persona
  que fija `expected`. **No se le da al agente.**

### 2. Cómo se ejecuta
`node factory/eval-run.ts researcher --model <modelo> [--cases <ids>]`, como en ADR-0016 (3), con estos
cambios:
1. Worktree en `baseRefOid`, con `researcher.md` **de la versión evaluada** (no la del commit base).
2. Antes de lanzar, sustituye en el worktree `factory/fetch-page.ts`, `fetch-idae.ts` y
   `fetch-image.ts` por un reproductor que responde desde `fetch/`:
   - `fetch-page.ts <url> [palabras]`: si hay salida congelada para esa `url` (o su `final_url`),
     devuelve los párrafos que contienen alguna palabra, con el mismo filtro y el mismo formato que
     el script real, y `retrieved` = la fecha original; si no hay, sale con el error de tiempo
     agotado del script real. Así una URL no leída en el original sigue sin poder leerse, que es el
     caso de la regla de fechas.
   - `fetch-image.ts`: devuelve el JSON grabado sin escribir imagen; sin grabación, error.
   - Registra cada llamada en el resumen del caso.
3. `allowed_tools` del Researcher **sin `WebSearch` ni `WebFetch`**; el resto, `max_turns_per_run` y
   `max_usd_per_run` de `budgets.yaml`. La tarea es la de `case.yaml`, sin cambios.
4. El reloj: el agente decide «oferta vencida» con la fecha de hoy. El caso fija la fecha original
   en la tarea («Hoy es <fecha de la ejecución original>») y el evaluador compara contra esa fecha.
5. Traza y experimento en Langfuse como ADR-0016 (dataset `researcher`, ids prefijados
   `researcher/`), resumen en `ops/evals/<experimento>.json`.

### 3. Qué se puntúa
**Con código** (scores booleanos o fracción, sin modelo), sobre el diff de `data/` del worktree y el
registro del reproductor:
- `schema`: el validador de ADR-0010 acepta todos los ficheros tocados. Si no, el resto del caso
  puntúa 0.
- `dates` (regla de fechas): fracción de valores cuyo `retrieved` cambió **y** tienen una llamada al
  reproductor a su `url` cuya salida contiene el `value`, con la búsqueda de ADR-0020 («Cómo se
  busca», grafías y unidad del punto 10). Mismo criterio para `last_verified` (alguna URL de la fuente
  cargó). Un `retrieved` que sube sin esa llamada es un fallo. Además, los campos `kept` de
  `expected` deben conservar fecha y valor.
- `price_proof`: cada `price.url` cambiada o marcada como no encontrada tiene al menos una llamada a
  `fetch-page.ts` con el importe y el nombre (o `page_name`) entre las palabras.
- `price_found`: el precio está en la salida congelada **bajo su versión**, con el anclaje de ADR-0020
  (puntos 9 y 16). *No coincide (otra versión)* es fallo; *sin versión*, no.
- `price_kind` y `cash_amount`: coinciden con `expected` (`pvp`/`financed`/`null` y el importe).
- `price_terms_literal` y `page_name_literal`: la cadena está en la salida congelada, con la regla de
  `price_terms` de ADR-0020.
- `expired_offer`: ningún `financed` con fin de oferta anterior a la fecha del caso (la comprobación de
  ADR-0010, punto 8, con esa fecha).
- `value_match`: fracción de campos de `expected` con el valor esperado.
- `cost_usd` y `turns`, del evento `result`.

Estas funciones son las de ADR-0010 y ADR-0020 llamadas sobre ficheros: no se escribe otra búsqueda.

**Con juez** (el de ADR-0016, Sonnet 5.5, local, rúbrica en `factory/datasets/researcher/rubric.md`),
solo:
- `open_questions_ok`: por cada valor que no se pudo confirmar en la instantánea, ¿`open_questions`
  dice cuál y por qué? (fracción). Es texto libre y no se compara con código.

**Aprobación de un cambio en `researcher.md`** (o de modelo), con línea base y candidata como en
ADR-0016 (4):
1. `schema` = 1 en todos los casos, y ningún `retrieved` sube sin lectura (`dates` sin fallos de ese
   tipo). Es el error que llevó a las cuatro PR a `review:changes`.
2. Ningún score de las reglas de cada caso baja respecto a la línea base.
3. `cost_usd` medio no sube más de un 25 %.
El juez no decide la aprobación; informa.

### 4. Cuántos casos
- Para empezar, los **4** de #806, #808, #814 y #824, si sus trazas existen (ver Contexto). El retro
  añade un caso por cada `review:changes` nuevo del Researcher (ver 6).
- Con 4 casos el dataset detecta la regresión que lo creó, nada más. Se da por útil para aprobar
  cambios cuando llegue a **10**, de al menos 3 marcas; hasta entonces el resultado de `eval-run.ts`
  se adjunta, pero la PR lo dice («dataset de 4 casos»).
- Hasta 3 casos sintéticos para reglas sin PR real (por ejemplo `expired_offer` si ninguna de las
  cuatro lo incumplió).

### 5. Coste
- Un caso ≈ una ejecución del Researcher, con tope `max_usd_per_run: 1.50` USD-eq (Claude Code lo
  calcula a precio de API). Sin `WebSearch`/`WebFetch` y con respuestas locales, se espera por debajo
  del tope; no está medido.
- **Por experimento** (cota superior, al tope por caso): 4 casos, 6 USD con el modelo actual; 10
  casos, 15 USD, justo el `max_usd_per_experiment`. Con Opus 5.5 (el doble por token que Sonnet 5.5,
  ADR-0016) un experimento de 10 casos superaría el tope: el script lo para como incompleto (ADR-0016,
  (5)). Juez: ~0,04 USD por caso (estimación de ADR-0016).
- **Por mes:** una aprobación (línea base + candidata) de 4 casos ≈ 12 USD; de 10 casos ≈ 30 USD, que
  deja 10 USD de los 40 mensuales para el Reviewer. Los dos datasets comparten el tope de
  `evals:`; no se añade otro. Si se necesitan las dos aprobaciones el mismo mes, lo decide el usuario
  subiendo `max_usd_per_month`.
- Unidades de Langfuse: un caso del Researcher tiene hasta `max_turns_per_run` turnos; con la cuenta
  de ADR-0016 (6), del orden de 1000 unidades por experimento de 4 casos. Entra en el margen.

### 6. Cómo lo usa el retro (enmienda de ADR-0022)
- La frase «Mientras solo el Revisor tenga dataset, solo propone cambios a su prompt» pasa a ser:
  **el retro solo propone cambios a los prompts de agentes con dataset en `factory/datasets/`**; hoy,
  Reviewer y, cuando exista su primer caso, Researcher. La tarea generada por `run.ts --retro` saca la
  lista de los directorios de `factory/datasets/`, no de una constante.
- Por cada `review:changes` de una PR `agent/researcher/*`, la propuesta del retro incluye un
  `case.yaml` borrador (PR, `run_id`, `baseRefOid`, tarea, reglas incumplidas según la revisión) **sin
  `expected`**: el `expected` lo fija una persona, como en ADR-0016. El retro no extrae `fetch/` de
  la traza (`network: false`, y no escribe en `factory/`): lo hace la persona con un script
  (`node factory/dataset-capture.ts researcher <pr>`, propuesta) que lee la traza de `ops/traces/`.
- La persona aplica el cambio de `researcher.md` en su PR con los dos resúmenes de `ops/evals/`,
  como en ADR-0016 y ADR-0022.

## Consecuencias
**Buenas**
- El retro puede trabajar sobre el agente que más `review:changes` acumula, y cada devolución se
  convierte en una prueba que impide repetirla.
- Las reglas que fallaron se comprueban sin modelo y con las mismas funciones que ya bloquean la
  fusión (ADR-0010 y ADR-0020): si el experimento dice «la fecha subió sin lectura», la fusión diría lo
  mismo.
- Repetible: línea base y candidata ven exactamente las mismas páginas, y el experimento no pide nada a
  terceros (ADR-0001).

**Malas o a vigilar**
- ~~**Contenido de terceros en el repositorio.** ADR-0004 no versiona `ops/traces/` porque lleva texto
  de webs de terceros; `fetch/` copia ese texto en `factory/datasets/researcher/`, que sí se versiona y
  es público si el repositorio lo es. Son fragmentos de páginas de marcas leídas con permiso de
  `robots.txt`, pero es un cambio de criterio respecto a ADR-0004 y hay que aceptarlo expresamente (ver
  preguntas). Alternativa si no se acepta: guardar `fetch/` fuera de git (en `ops/`) y versionar solo
  su hash.~~ Se eligió la alternativa (2026-11-09): el repositorio es público. El dataset solo se
  reproduce en la máquina que tiene `ops/`, la misma que tiene `ops/traces/`.
- **Depende de que existan las trazas.** Si las de #806, #808, #814 o #824 ya no están en
  `ops/traces/`, esos casos no se pueden congelar y el dataset empieza con menos de 4. No lo he
  comprobado.
- **El agente evaluado no es el de producción:** sin `WebSearch`/`WebFetch`, con reproductores en
  vez de scripts y con una fecha fijada. Un prompt que mejore la forma de buscar con `WebSearch` no se
  mide; uno que dependa de `WebFetch` puede parecer peor de lo que es. Si ADR-0023 (skills del
  Researcher) añade herramientas con red, también hay que reproducirlas.
- **Una salida filtrada por palabras limita el caso:** si la traza solo guarda los párrafos que
  coincidieron con las palabras del original, la candidata que pide otras palabras ve menos. Los casos
  con `fetch_partial: true` miden peor; se marcan y se pueden excluir.
- **4 casos miden poco**: un caso es 25 puntos. Sirven para no repetir lo que pasó, no para comparar
  modelos.
- **Gasto real compartido** con el Reviewer en los 40 USD/mes de `evals:`; un mes con aprobaciones de
  los dos agentes no cabe.
- **Trabajo humano:** cada `expected` lo fija una persona leyendo la instantánea y la revisión.
- **Mantenimiento:** reproductores que deben imitar la salida exacta de tres scripts; si cambia
  `fetch-page.ts` (ADR-0020 ya obliga a no cambiar su JSON), hay que cambiarlos.
- **La enmienda de ADR-0022 cambia la tarea del retro**, que aún no está implementado (bitácora del
  2026-11-04): conviene implementarlo ya con la regla nueva.

### Preguntas abiertas
Resueltas por el usuario el 2026-11-09 al aceptarla:
- ~~¿Se versiona el texto de webs de terceros en `factory/datasets/researcher/*/fetch/`?~~ No: va a
  `ops/datasets/researcher/`, fuera de git, y el caso guarda su hash. El repositorio es público y se
  mantiene el criterio de ADR-0004.
- ~~¿Basta un dataset de 4 casos?~~ Sí: el retro empieza con los 4 de #806, #808, #814 y #824 (sus
  trazas siguen en `ops/traces/`, comprobado el 2026-11-09), y cada PR lo dice («dataset de 4 casos»).
- ~~¿Se comparten los 40 USD/mes de `evals:`?~~ Sí; no se toca `budgets.yaml`. Si un mes hacen falta
  las dos aprobaciones, lo decide el usuario entonces.
- ~~¿Con qué modelo corre el Researcher?~~ Con `default_model: sonnet` de `budgets.yaml` (no tiene
  `model` propio); la línea base usa ese.
- Sigue abierta: qué valores concretos incumplió cada PR. Lo fija una persona al escribir cada
  `expected` (`gh pr view <n> --comments`).

**Fuentes (repositorio, consultadas el 2026-11-05)**
- ADR-0004, ADR-0010, ADR-0016, ADR-0020 y ADR-0022 en `docs/architecture/adr/`.
- `docs/product/prd/PRD-007-harness-factoria.md` (RF-10, CA-13, OPEN-4).
- `.claude/agents/researcher.md` y `factory/budgets.yaml`.
- `docs/bitacora/2026-11/2026-11-01T1824-4be3ed3e.md`, `2026-11-04T0010-cafd3757.md` y
  `2026-11-04T0025-1c937592.md`.
- No he consultado documentación externa.
