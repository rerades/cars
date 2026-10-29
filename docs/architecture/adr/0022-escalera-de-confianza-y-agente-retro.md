# ADR-0022 — Escalera de confianza y agente retro

- **Estado:** propuesta. Propone enmendar [ADR-0011](0011-publicacion-de-los-agentes.md) (rutas
  que se fusionan solas con el peldaño, fusiones a mano leídas por el paso de fusión, las PR del
  retro nunca se fusionan solas) y [ADR-0013](0013-commit-del-estado-de-la-factoria.md) (la PR de
  estado admite líneas añadidas a `ops/trust/*.jsonl`).
- **Fecha:** 2026-10-29

## Contexto
PRD-007 tiene resueltas OPEN-1 y OPEN-4 desde el 2026-10-28. Quedan para el Arquitecto la forma del
estado de la escalera y las piezas del agente retro:

- **RF-9 / CA-11 / CA-12.** Un agente sube un peldaño para un tipo de cambio tras **5 fusiones
  limpias seguidas** de ese tipo. Tipo = agente + primer nivel de ruta del diff; de momento solo
  `web/` tiene escalera, y `docs/product/` y `docs/design/` siguen con persona. Una PR con varios
  tipos solo se fusiona sola si todos están en el peldaño. Limpia = sin `review:changes`, sin CI
  roja y sin defecto escapado. Con el peldaño, se fusiona con las reglas de ADR-0011 más la puerta
  de RF-3. Un revert o un defecto escapado baja un peldaño. El estado son **eventos** (fusión limpia,
  subida, bajada, con la PR y el motivo) en `ops/trust/YYYY-MM.jsonl`, en la rama de estado de
  ADR-0013, y `run.ts --status` lo muestra. CA-12: `factory/`, `.claude/`, `.github/` y
  `docs/architecture/adr/` nunca se fusionan solas.
- **RF-10 / CA-13.** El agente `retro` lee fallos, `review:changes` y defectos escapados con sus
  trazas (ADR-0004) y propone cambios a `.claude/agents/*.md` o a las skills **como texto**, «en una
  PR de `docs/bitacora/` o en una issue»; no escribe en `.claude/` (ADR-0002 capa 2, RNF-3). Lo
  aplica una persona con el resultado de `factory/eval-run.ts` (ADR-0016). Como mucho una vez por
  semana y solo con **≥ 3 señales** desde la pasada anterior, **contadas por código sin modelo**.
  Sonnet, 1 USD-eq por ejecución y 6 al mes. Mientras solo el Revisor tenga dataset, solo propone
  cambios a su prompt; cada defecto escapado se convierte en un caso del dataset.
- **RNF-1:** las reglas de RF-9 van sin modelo. **RNF-4:** subir y bajar dejan rastro con su motivo.
  **RNF-5:** `factory/STOP` lo para todo.
- **ADR-0019** define el defecto escapado: en los 7 días tras la fusión de la PR N entra en `main`
  un revert de N (`This reverts commit <sha>` o PR `Revert "…"` que cita `#N`) o una PR `fix…` que
  cita `#N` o su URL. «Mientras no han pasado 7 días desde T, la PR cuenta como “pendiente”, no como
  limpia; **RF-9 debe usar la misma regla**.» La primera vez se mide con el historial de eventos
  `labeled` (`review:changes`) y las ejecuciones de la CI en `failure` de la rama de la PR.
- **ADR-0011:** `ops/merges/` solo tiene las fusiones automáticas; las fusiones a mano no dejan
  línea. El paso de fusión (`run.ts --merge`) es código sin modelo que corre a las 07:30.
- **ADR-0013:** el estado de la factoría se commitea en `chore/factory-state`, cuya PR se fusiona
  sola si solo añade líneas a `ops/runs/*.jsonl` u `ops/merges/*.jsonl` (y `ops/feeder/*.jsonl` por
  ADR-0018).
- **ADR-0016:** el único dataset es `factory/datasets/reviewer/`; un cambio de prompt del Revisor se
  aprueba con `eval-run.ts`. Los casos están en `factory/`, donde ningún agente escribe.

## Opciones consideradas

### 1. Cuándo cuenta una fusión como limpia
- **A. Al fusionarse, de forma provisional, y retirarla si aparece un defecto en 7 días.**
  Descartada: contradice ADR-0019, aceptada («pendiente, no limpia»), y permitiría subir un peldaño
  con PR que luego resultan defectuosas; bajar después no deshace las fusiones solas ya hechas.
- **B. A los 7 días de la fusión, cuando ya no puede tener defecto escapado (elegida).** Es la regla
  de ADR-0019 al pie de la letra.

### 2. Qué eventos se escriben
- **A. Solo los tres que nombra RF-9 (limpia, subida, bajada).** Descartada: «seguidas» exige saber
  que una fusión **no** fue limpia; sin ese evento, cinco limpias separadas por una sucia subirían el
  peldaño. Rehacer el estado volvería a necesitar `gh`.
- **B. Esos tres más `unclean` (rompe la racha) (elegida).**
- **C. Una instantánea del peldaño por tipo en cada pasada.** Descartada: duplica lo que dan los
  eventos y no explica el porqué (RNF-4).

### 3. Qué fusiones lee el paso de fusión
- **A. Solo `ops/merges/`.** Descartada: hoy ninguna PR del developer está ahí (PRD-007, OPEN-1), así
  que la escalera de `web/` no subiría nunca.
- **B. Todas las PR `agent/*` fusionadas, por la factoría o a mano, leídas con `gh` (elegida).** Es lo
  que recomendó la propuesta de OPEN-1 (E1) y aceptó el responsable.

### 4. Dónde deja el retro su propuesta
- **A. Escribir en `.claude/` con una excepción de `write_paths`.** Descartada por RF-10 y RNF-3.
- **B. Una issue.** Descartada: el agente necesitaría `gh issue create`, que hoy solo usan personas y
  el alimentador (ADR-0018), y el texto no pasaría por el Revisor ni quedaría en el repositorio. El
  diff propuesto no se puede comentar línea a línea.
- **C. Una PR normal de `docs/bitacora/`.** Descartada tal cual: `docs/bitacora/` está en la lista de
  ADR-0011 y se fusionaría sola, sin que nadie la lea. Además mezclaría propuestas con la bitácora,
  que es historia (CLAUDE.md).
- **D. Una PR con un fichero en `docs/bitacora/retro/`, que nunca se fusiona sola (elegida).** Es una
  de las dos formas que nombra RF-10, la abre el orquestador como a cualquier agente (`auto_pr`) y la
  persona la ve en su lista de `merger:needs-human`.

### 5. Cómo se cuentan las 3 señales
- **A. Que el retro las cuente y decida si sigue.** Descartada: RF-10 pide código sin modelo, y gastar
  una ejecución para decidir no ejecutarse cuesta lo mismo que la pasada.
- **B. Una regla en el orquestador, sobre el ledger, `gh` y `ops/trust/` (elegida).**
- **C. Un fichero propio de señales (`ops/retro/`).** Descartada: las tres señales ya están en
  `ops/runs/`, en GitHub y en `ops/trust/`; otro registro sería otra ruta más en ADR-0013.

## Decisión
**El paso de fusión escribe en `ops/trust/YYYY-MM.jsonl` un evento por tipo y por PR `agent/*`
fusionada (a mano o sola) cuando han pasado sus 7 días de ADR-0019, más las subidas y bajadas, y el
peldaño se rehace leyendo los eventos en orden; el retro lo lanza una regla sin modelo con ≥ 3
señales y deja su propuesta en una PR de `docs/bitacora/retro/` que nunca se fusiona sola.**

### Escalera — los eventos
Un evento por línea en `ops/trust/YYYY-MM.jsonl` (mes del `at`, Europe/Madrid como ADR-0019). Lo
escribe solo `run.ts --merge`, en el worktree de estado (ADR-0013).

```json
{"id":"clean:web/:612","at":"2026-11-08T07:30:12+01:00","type":"clean","agent":"developer","area":"web/","pr":612,"merged_at":"2026-11-01T07:31:02+01:00","merged_by":"factory","reason":"7 days without review:changes, red CI or escaped defect"}
{"id":"unclean:web/:618","at":"…","type":"unclean","agent":"developer","area":"web/","pr":618,"merged_at":"…","merged_by":"human","reason":"review:changes","evidence":"labeled 2026-11-02T06:41Z"}
{"id":"up:web/:640","at":"…","type":"up","agent":"developer","area":"web/","pr":640,"level":1,"reason":"5 clean merges in a row: #612 #620 #627 #633 #640"}
{"id":"down:web/:655","at":"…","type":"down","agent":"developer","area":"web/","pr":655,"level":0,"reason":"escaped defect","evidence":"#661 fix(web): … cites #655"}
```

- **`type`:** `clean`, `unclean`, `up` o `down`.
- **`area`:** primer nivel de ruta con escalera (hoy solo `web/`). La lista vive en
  `factory/budgets.yaml`, `trust.areas: ["web/"]`, para que ampliarla sea una PR de persona y una
  enmienda (RF-9). Las rutas de CA-12 no se aceptan en esa lista: el código las rechaza al leerla.
- **`pr`:** en `clean` y `unclean`, la PR evaluada; en `up`, la que completa la racha; en `down`, la
  PR original cuyo defecto la provoca.
- **`merged_by`:** `factory` si el número está en `ops/merges/`, `human` si no.
- **`reason`** siempre; **`evidence`** cuando hay algo que enlazar (etiqueta, run de CI, PR de
  arreglo o de revert). Es el rastro de RNF-4.
- **`id`** = `type:area:pr`. Antes de escribir, el paso comprueba que el `id` no exista en ningún mes:
  así es idempotente y lanzable a mano.

**Qué PR evalúa cada pasada.** Las PR con rama `agent/<agente>/<run_id>` fusionadas entre hace 37 y
hace 7 días (`gh pr list --state merged`), que tocan al menos un fichero de un `area` de la lista y
no tienen aún `clean` ni `unclean` para esa área. 30 días de margen cubren las noches en que el paso
no corrió. Para cada área que toca la PR, un evento:

- `unclean` con `reason: review:changes` si el historial de la PR tiene algún `labeled`
  `review:changes`, también si luego se arregló con el bucle de RF-5;
- `unclean` con `reason: red CI` si alguna ejecución de la CI de su rama terminó en `failure`;
- `unclean` con `reason: escaped defect` si en sus 7 días hay revert o PR `fix` que la cita (ADR-0019);
- `clean` en otro caso.

La misma regla vale para fusiones automáticas y a mano: lo que mide la escalera es si el trabajo del
agente fue bueno, no quién pulsó el botón. Una PR que toca `web/` y `docs/design/` solo genera evento
para `web/`. Si se cumplen varias causas de `unclean`, la `reason` es la primera en ese orden y las
demás van en `evidence`.

**Subida.** Tras escribir un `clean`, si los cinco últimos eventos `clean`/`unclean` del par
(agente, área) posteriores al último `up` o `down` son `clean`, y el nivel es 0, escribe `up` con
`level: 1`. **El nivel máximo es 1**: con él, las PR de ese tipo se fusionan solas; RF-9 no dice qué
más daría un segundo peldaño (ver preguntas abiertas).

**Bajada.** Escribe `down` (nivel `max(0, nivel − 1)`) cuando:
- se escribe un `unclean` por `escaped defect` para el par; o
- en cualquier momento, no solo en 7 días, entra en `main` un revert de una PR `agent/*` del par
  (RF-9 dice «un revert» sin plazo). Lo detecta la misma búsqueda de ADR-0019 sobre las fusiones de
  `main` desde la última pasada.

Un `down` con el nivel ya en 0 también se escribe: deja el rastro y reinicia la racha. Una PR solo
provoca un `down` (el `id` lo garantiza), aunque tenga revert y `fix`.

**Cómo se rehace el peldaño.** Función pura `trustState(events)`: lee todos los meses de
`ops/trust/` del worktree de estado, en orden de fichero y de línea, y para cada (agente, área)
empieza en `level 0, streak 0`:
`clean` → `streak + 1`; `unclean` → `streak = 0`; `up` → `level = event.level, streak = 0`;
`down` → `level = event.level, streak = 0`. Comprueba además que cada `up` va precedido de 5 `clean`
seguidos; si no (fichero editado a mano, línea perdida), ese par queda en **nivel 0** y
`run.ts --status` lo avisa. Ante la duda, persona. `--status` muestra por par el nivel, la racha y el
último evento.

**La fusión con peldaño (enmienda de ADR-0011, punto 2).** Una PR `agent/*` que cumple todas las
reglas de ADR-0011 salvo la lista de rutas se fusiona sola si, además, cada fichero fuera de la lista
está en un `area` donde el par (su agente, esa área) tiene nivel 1, y la fila de su ejecución en
`ops/runs/` tiene `gate` sin `failed` y con todas las comprobaciones que tocan a esa área (para `web/`,
`web:install` a `web:build`, ADR-0019). Una fila sin `gate` (anterior a la puerta) no cuenta. Ningún
fichero de CA-12 entra nunca, esté en el peldaño que esté. La línea de `ops/merges/` añade
`"trust": ["web/"]` con las áreas que usó.

### Agente retro
**Cuándo corre.** `node factory/run.ts --retro`, desde su propio LaunchAgent una noche por semana
dentro de `allowed_hours` (la noche concreta, al instalarlo). Código sin modelo:

1. Si existe `factory/STOP`, o hay una fila del agente `retro` en `ops/runs/` con menos de 7 días,
   sale sin lanzar nada.
2. **Desde** = `at` de la última fila de `retro` con `outcome: success`; si no hay, 7 días atrás.
3. Cuenta las señales desde ese instante:
   - **fallo:** filas de `ops/runs/` con `outcome` distinto de `success`, de cualquier agente salvo
     `retro`, una por `run_id`;
   - **`review:changes`:** eventos `labeled` `review:changes` en PR `agent/*`, uno por evento (un
     reintento de RF-5 que vuelve a recibirla cuenta otra vez);
   - **defecto escapado:** eventos `unclean` con `reason: escaped defect` de `ops/trust/`.
4. Con menos de 3, sale e imprime el recuento. Con 3 o más, lanza `retro` con una tarea generada que
   lista cada señal (`run_id`, PR, enlace a la traza), así el modelo no las busca. Los topes son los
   de `budgets.yaml` (RF-10) y las guardas de ADR-0002 aplican igual.

**Qué entrega.** Un fichero `docs/bitacora/retro/YYYY-MM-DD.md` con: las señales que analizó, por
cada propuesta el fichero de `.claude/` afectado y el diff propuesto como bloque de texto, y por cada
defecto escapado un `case.yaml` propuesto para `factory/datasets/reviewer/`. Mientras solo exista el
dataset del Revisor, la tarea generada le prohíbe proponer cambios a otros prompts; las demás señales
se describen sin diff. Sus `write_paths` son `docs/bitacora/` (su fichero y su entrada de bitácora).
`network: false`.

**Cómo se aplica (enmienda de ADR-0011).** El orquestador abre la PR como a cualquier agente. El paso
de fusión **nunca fusiona una PR de rama `agent/retro/*`**: le pone `merger:needs-human` con el
motivo «retro proposals are applied by a person». La persona aplica lo que quiera en otra PR suya
sobre `.claude/` con el resultado de `eval-run.ts`, y fusiona o cierra la del retro.

### Enmienda de ADR-0013
La regla de fusión de la PR de estado (punto 6) admite también líneas añadidas a
`ops/trust/*.jsonl`. Ninguna PR `agent/*` puede tocar `ops/trust/` (punto 7): si lo hace, es una
anomalía y va a `merger:needs-human`.

**Qué cambia en el código (lo hace una persona: `factory/` está fuera de todos los `write_paths`):**
`trust.areas` y el agente `retro` en `budgets.yaml`; los eventos, la subida, la bajada y la regla de
fusión con peldaño en `factory/merge.ts`; `trustState` y su salida en `--status`; `run.ts --retro` y
su LaunchAgent; el prompt `.claude/agents/retro.md`; la regla de ADR-0013 en `--merge-state`. Pruebas:
CA-11 (5 `clean` → `up` → la siguiente se fusiona; revert → `down`), CA-12 y CA-13 con ficheros de
ejemplo en `factory/tests/`.

## Consecuencias
**Buenas**
- Todo lo que decide sube, baja, fusiona o lanza es código sin modelo, probado con ficheros (RNF-1).
- El estado se rehace entero desde los eventos y cada cambio lleva su motivo y su prueba (RNF-4).
- Las fusiones a mano cuentan, así que el developer puede subir aunque hoy no tenga ninguna fusión
  automática.
- El retro no toca la barrera de `.claude/` (RNF-3) y no gasta si la semana fue tranquila.

**Malas o a vigilar**
- **Subir tarda 7 días más que la quinta fusión.** CA-11 dice «cuando entra la N, sube»; con
  ADR-0019 la N cuenta 7 días después de entrar. Al ritmo de octubre, el primer `up` llega unas dos
  semanas después de la primera PR evaluable. Si se quiere subir al entrar la N, hay que cambiar
  ADR-0019 o CA-11, no esta ADR.
- **Bajar no deshace.** Entre una fusión sola defectuosa y su `down` pueden entrar otras PR del mismo
  tipo sin persona; se arreglan con revert o `fix`, que a su vez bajan.
- **El defecto escapado cuenta de menos** (ADR-0019): un arreglo que no cita la PR no baja nada.
- **Una fusión a mano con commits de una persona** en la rama cuenta como trabajo del agente si no
  tuvo `review:changes` ni CI roja. Puede inflar la racha (ver preguntas).
- **Depende de `gh` en el paso de fusión** para el historial de etiquetas y de la CI, una llamada por
  PR evaluada. Sin red, no escribe eventos esa noche; el margen de 30 días lo recupera.
- **`ops/trust/` vive en la rama de estado**: hereda sus riesgos (ADR-0013). Si se pierde una línea,
  `trustState` deja el par en nivel 0, que es seguro pero obliga a una nueva racha.
- **La puerta pasa a ser condición de fusión**, pero la ejecuta el orquestador fuera de sandbox con
  código del agente (ADR-0019, «En contra»): con la escalera, ese código además puede entrar solo en
  `main` y en producción.
- **Las PR del retro llegan a la lista de la persona cada semana** con `merger:needs-human`: es a
  propósito, pero suma trabajo humano, y el texto de las trazas puede venir de webs de terceros
  (ADR-0001), así que el diff propuesto se lee, no se copia.
- **Hay que comprobar que `bitacora.ts` ignora `docs/bitacora/retro/`** (lee
  `docs/bitacora/YYYY-MM/`); no lo he verificado en esta ejecución.
- Más código en `merge.ts` y un LaunchAgent más.

**Preguntas abiertas**
- ¿Qué da un segundo peldaño? RF-9 habla de subir «un peldaño» pero solo describe el efecto del
  primero. Esta ADR fija el máximo en 1.
- ¿Una PR fusionada a mano en la que una persona empujó commits debe contar como `unclean`? Hoy no:
  RF-9 no lo dice.
- ¿Qué noche corre el retro? Se fija al escribir el LaunchAgent; RF-10 solo dice semanal.
- ¿Debe quedar rastro en `ops/` cuando el retro no se lanza por falta de señales? RNF-4 no lo pide
  para esta decisión; hoy solo sale en la consola.
- ¿Basta `auto_merge` como interruptor de la escalera, o se quiere uno propio? Con `trust.areas`
  vacío la escalera no fusiona nada, y así queda hasta que una persona la rellene.

**Fuentes (repositorio, consultadas el 2026-10-29)**
- `docs/product/prd/PRD-007-harness-factoria.md` (RF-9, RF-10, RNF-1 a RNF-5, CA-11 a CA-13, OPEN-1 y
  OPEN-4).
- ADR-0002, ADR-0011, ADR-0013, ADR-0016, ADR-0018 y ADR-0019 en `docs/architecture/adr/`.
- No he consultado documentación externa: la decisión no compara herramientas.
