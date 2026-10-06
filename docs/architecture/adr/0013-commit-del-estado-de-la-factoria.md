# ADR-0013 — Cómo hace commit la factoría de la cola y del registro de ejecuciones

- **Estado:** aceptada (2026-10-06)
- **Fecha:** 2026-10-06

## Contexto
Issue #166 ([1]). `node factory/run.ts --next` cambia tres ficheros versionados **en la copia de
trabajo de la persona** y no hace commit de ninguno:

- `cmdNext` (`factory/run.ts`) lee `factory/queue.yaml` con `readQueue()`, lanza la primera tarea
  y la quita con `writeQueue(queue.slice(1))`; si falla, `pauseTask()` la añade a
  `factory/queue.paused.yaml`. Si una guarda la bloquea (código 3) no toca nada.
- `runTask` añade la fila de la ejecución con `appendLedger()` a `ops/runs/YYYY-MM.jsonl`
  (`LEDGER_DIR = REPO/ops/runs`). Lo hace **cualquier** ejecución, también las lanzadas a mano
  con `run.ts <agente> "tarea"` y el Revisor, no solo `--next`.
- El agente, en cambio, trabaja en un worktree creado desde `origin/main` (`openWorkspace`), y
  `closeWorkspace` solo commitea lo que hay en ese worktree. La PR solo se abre si
  `outcome: success` y hubo cambios; una ejecución fallida deja la rama en local y una sin
  cambios no deja rama.
- El LaunchAgent (`factory/launchd/com.darkfactory.orchestrator.plist.example`) lanza `--next`
  a las 01:00, 02:30, 04:00 y 05:30 con `WorkingDirectory` en la copia de la persona.
- El registro no es solo histórico: `checkCanRun` calcula límites diarios y presupuesto
  (ADR-0002) con `readLedger(month)`, y `bitacora.ts from-runs` y `langfuse.ts` lo leen.

Efecto observado del 2026-10-01 al 2026-10-05 ([1]): `main` mostraba 21 tareas cuando quedaban 7,
y las PR que editan la cola chocaban con los cambios locales.

El responsable ya ha decidido que **ese estado se versiona y la factoría hace commit de él**; no
pasa a ser estado local fuera de git. Esta ADR decide solo cómo. Restricciones de la issue ([1]):

- **R1.** Todo entra por PR; nunca commit directo a `main` (CLAUDE.md, ADR-0002 capa 2).
- **R2.** La factoría no toca la copia de trabajo de la persona.
- **R3.** Una tarea no se ejecuta dos veces, aunque la PR que registra su consumo no esté fusionada.
- **R4.** Encaja con la fusión automática de ADR-0011 (lista de rutas `data/raw/` y
  `docs/bitacora/`, `review:ok` ligada al SHA, interruptor `auto_merge` aún en `false`).

Criterio de hecho de la issue ([1]): `git status` limpio tras las ejecuciones de la noche y `main`
refleja la cola que queda; encolar por PR no genera conflictos; una prueba demuestra que una tarea
consumida no se relanza.

## Opciones consideradas

**1. El estado va en la rama del agente** (cola sin la tarea y fila del registro en el commit de
`closeWorkspace`, y se fusiona con su PR). Descartada:
- **R3 falla.** Hasta que se fusiona la PR del agente, `origin/main` sigue teniendo la tarea; la
  siguiente pasada de la misma noche la vería otra vez. Para evitarlo habría que leer la cola de
  otro sitio, que es justo el problema.
- **No cubre todas las ejecuciones.** Las fallidas no abren PR y las que no escriben nada ni
  siquiera dejan rama: su fila del registro y su paso a la pausa no llegarían nunca a `main`. El
  presupuesto (ADR-0002) contaría de menos.
- **Conflictos.** Todas las PR de agente editarían la cabeza de `queue.yaml` y el final del mismo
  `ops/runs/YYYY-MM.jsonl`; dos PR de la misma noche chocan entre sí y con las PR que encolan.
- **R4 falla.** Una PR del Researcher llevaría `factory/queue.yaml` y `ops/runs/`, fuera de la
  lista de ADR-0011, y ninguna entraría sola. Meter esas rutas en la lista permitiría que una PR de
  agente, si el Revisor la marca `review:ok`, cambie la cola (qué hará la factoría) y el registro
  (de qué depende el presupuesto).
- Además mezcla en una PR de contenido un cambio que no es del agente: el agente no puede escribir
  en `factory/` ni en `ops/runs/` (hooks), pero su PR sí los cambiaría.

**2. Una rama y una PR de estado por ejecución (`chore/factory-state/<run_id>`).** Cumple R1 y R2
si se escribe en un worktree propio. Descartada tal cual:
- **R3 falla igual** mientras la PR no se fusione si `--next` lee de `origin/main`; y hasta que
  `auto_merge` (ADR-0011, punto 7) esté en `true`, no se fusiona sola.
- **Conflictos entre PR de estado.** Cada una sale de `origin/main` y añade su línea al final del
  mismo `ops/runs/YYYY-MM.jsonl` y quita la cabeza de `queue.yaml`: la segunda de la noche choca
  con la primera en cuanto esta se fusiona. Con cuatro pasadas por noche, hasta cuatro PR que se
  pisan.
- Sigue reescribiendo `queue.yaml`, así que una PR que encola tareas cuando la cola es corta toca
  líneas vecinas de las que quita la factoría.

**3. Leer la cola de `origin/main` y marcar las tareas consumidas en vez de borrarlas** (con el
`run_id` en el registro). Resuelve los conflictos de la cola: la factoría deja de escribir
`queue.yaml`. Descartada **sola**: la marca vive en el registro, y el registro también hay que
versionarlo; si se lee de `origin/main` y la fila aún no se ha fusionado, R3 falla.

**4. Combinación: la cola de la opción 3 y una sola rama de estado acumulativa (elegida).** La
factoría nunca escribe la cola; consumir una tarea es añadir una fila al registro con el
identificador de la tarea; esas filas se commitean en una única rama de estado, con una única PR
abierta, de la que la propia factoría lee. Así R3 no depende de que la PR esté fusionada.

Descartadas también, como piezas de la 4:
- **Identificar la tarea por un hash de `agent` + `task`:** sin trabajo para la persona, pero
  reintentar una tarea idéntica exigiría cambiarle el texto, y corregir una errata del texto la
  haría ejecutarse otra vez. Un identificador escrito a mano es explícito.
- **Un fichero de registro por ejecución** (`ops/runs/YYYY-MM/<run_id>.json`) para evitar los
  conflictos de la opción 2: obliga a cambiar el formato que leen `readLedger`, `bitacora.ts` y
  `langfuse.ts`, y con una sola rama de estado no hace falta.
- **Que la PR de estado borre además de `queue.yaml` las tareas consumidas:** devuelve los
  conflictos con las PR que encolan. La limpieza la hace una persona (ver Consecuencias).

## Decisión
**La factoría deja de escribir `factory/queue.yaml` y `factory/queue.paused.yaml`: consumir una
tarea es añadir al registro una fila con su `id`, y el registro se commitea en una única rama de
estado, `chore/factory-state`, con una PR propia, en un worktree propio, de la que la factoría lee
la cola y el registro.**

Detalles:

1. **La cola.** Cada tarea de `queue.yaml` lleva un campo `id` obligatorio y único (por ejemplo
   `adr-0013-estado`), que escribe la persona al encolar. `readQueue` lo valida. La factoría no
   reescribe nunca el fichero. Pendiente de una tarea = tarea de la cola cuyo `id` no aparece en
   ninguna fila del registro con `task_id`. `--next` coge la primera pendiente.
2. **La pausa.** Una tarea fallida queda consumida (tiene fila, con su `outcome`), así que no se
   reintenta en bucle, como hoy. `queue.paused.yaml` deja de escribirse: la lista de tareas en
   pausa se **deriva** del registro (filas con `task_id` y `outcome` distinto de `success`) y la
   muestra `run.ts --status`. Reintentar es encolarla otra vez con un `id` nuevo. Las tareas que hoy
   tiene `queue.paused.yaml` se pasan a mano, una vez, a la cola o se borran; después el fichero
   se elimina.
3. **El registro.** `appendLedger` escribe en el worktree de estado
   (`ops/worktrees/factory-state`, ya ignorado por `.gitignore`), rama `chore/factory-state`, y no
   en `REPO/ops/runs`. Por cada ejecución, también las manuales y las del Revisor: un commit
   `chore(factory): record run <run_id>`, `git push`, y si no hay PR abierta de esa rama, la abre.
   Todo bajo el lock del orquestador.
4. **Cómo se mantiene la rama al día.** Al empezar cada ejecución, tras el `fetch` que ya hace
   `pruneMergedBranches`:
   - si la PR de `chore/factory-state` está fusionada o la rama remota no existe, la rama se
     vuelve a crear desde `origin/main`;
   - si no, se fusiona `origin/main` en ella. Como la factoría solo escribe `ops/runs/` y las
     personas solo `queue.yaml`, no debería haber conflicto; si lo hay, la ejecución **se
     bloquea** (código 3, como una guarda) y avisa, sin lanzar el agente.
5. **De dónde se lee.** `readQueue`, `readLedger` y por tanto `checkCanRun`, `--status` y `--next`
   leen del worktree de estado: `origin/main` más las filas aún sin fusionar. Así una tarea
   consumida no se vuelve a lanzar aunque su PR de estado siga abierta (R3), y el presupuesto
   cuenta todas las ejecuciones.
6. **La fusión de la PR de estado.** Hasta que `auto_merge` esté en `true`, la fusiona una persona,
   **con commit de merge, no squash** (con squash, la rama acumulada chocaría con `main` en la
   siguiente pasada). Cuando la fusión automática de ADR-0011 se active, la PR de estado tiene su
   **propia regla**, no la de las PR de agente: rama `chore/factory-state` abierta por la factoría;
   el diff solo **añade líneas** a ficheros `ops/runs/*.jsonl` (ni borra, ni modifica, ni toca otra
   ruta); CI en verde; sin conflictos; sin `factory/STOP`; `gh pr merge --merge
   --match-head-commit <sha>` ([2]). No necesita `review:ok`: el Revisor no la revisa.
7. **Lista de rutas de ADR-0011.** **Ni `factory/queue*.yaml` ni `ops/runs/` entran** en la lista
   de las PR de agente. La cola decide qué hará la factoría: encolar es de una persona, y una PR de
   agente que la cambie la fusiona una persona. El registro sostiene el presupuesto (ADR-0002) y
   solo lo escribe el orquestador; si una PR `agent/*` lo toca, es una anomalía y va a
   `review:needs-human`.

**Qué cambia en el código (lo hace el Desarrollador; aquí no se escribe):**

- `factory/orchestrator.ts`
  - `QueueItem` gana `id`; `readQueue` exige `id` y que no se repita.
  - Nuevo `openStateWorkspace()` (crear o reutilizar `ops/worktrees/factory-state`, recrear la rama
    desde `origin/main` o fusionar `origin/main` según el punto 4) y `commitState(runId)` (commit,
    push y PR si no hay una abierta). Reutilizan `git` y la lógica de `openPullRequest`.
  - `LEDGER_DIR`, `QUEUE` y `ledgerPath` apuntan al worktree de estado (se mantienen
    `FACTORY_QUEUE` y similares para las pruebas). `appendLedger` escribe ahí y llama a
    `commitState`.
  - `writeQueue`, `pauseTask`, `PAUSED` y `PAUSED_HEADER` dejan de usarse y se retiran.
  - Nueva función pura que, dadas la cola y las filas, devuelve las tareas pendientes y las
    pausadas.
  - `openWorkspace` y `closeWorkspace` del agente **no cambian**: la rama del agente no lleva
    estado.
- `factory/run.ts`
  - `runTask` recibe el `id` de la tarea (o `null` en ejecuciones manuales) y lo guarda en la fila
    como `task_id`; prepara el worktree de estado antes de `checkCanRun`.
  - `cmdNext` lee la cola del worktree de estado, coge la primera pendiente y ya no llama a
    `writeQueue` ni a `pauseTask`; el mensaje «movida a factory/queue.paused.yaml» desaparece.
  - `--status` muestra cola pendiente, tareas pausadas derivadas y la PR de estado abierta.
- Pruebas: una tarea consumida no se relanza aunque la PR de estado no esté fusionada (criterio de
  la issue); una fallida no se relanza; un `id` repetido se rechaza; la factoría no escribe en
  `REPO/factory/` ni en `REPO/ops/runs/` (copia de la persona).
- Fuera de esta ADR, pero afectado: `bitacora.ts from-runs` y `langfuse.ts` leen `ops/runs/` de
  la copia donde se lancen; verán solo lo fusionado. `factory/README.md` y la cabecera de
  `queue.yaml` describen el flujo de hoy y hay que actualizarlos.

## Consecuencias
**Buenas**
- La copia de trabajo de la persona queda limpia: la factoría solo escribe en `ops/worktrees/`,
  `ops/traces/`, `ops/actions/` y el lock, todos ignorados (R2).
- Encolar por PR no choca con la factoría, porque la factoría no escribe la cola.
- Una tarea no se repite aunque nadie fusione la PR de estado durante días (R3); el presupuesto de
  ADR-0002 cuenta todas las ejecuciones, también las fallidas y las manuales, que la opción 1
  perdía.
- Una sola PR de estado abierta como mucho, en vez de una por ejecución.
- La fusión automática de ADR-0011 no se amplía: las PR de agente siguen limitadas a `data/raw/` y
  `docs/bitacora/`.

**Malas o a vigilar**
- **`queue.yaml` en `main` ya no es «la cola que queda»**: contiene también las consumidas hasta
  que una persona las borra. El criterio de hecho de la issue («`main` refleja la cola restante»)
  se cumple solo como cola **menos** las filas del registro de `main`, y para verlo hay que mirar
  `run.ts --status`, no el fichero. Si las consumidas no se limpian, el fichero crece. Es un
  cambio de cómo se lee la cola respecto a lo que pide la issue literalmente.
- **El `id` es trabajo nuevo para quien encola**, y un `id` repetido de una tarea ya consumida
  haría que la nueva no se lanzase nunca; `readQueue` solo puede detectar los repetidos dentro de
  la cola, no contra el registro, salvo que se compruebe aparte (se recomienda avisar).
- **La rama de estado es un punto único.** Si alguien la fusiona con squash, la edita a mano o
  resuelve mal un conflicto, la siguiente pasada se bloquea hasta que una persona lo arregle. Si
  alguien la borra sin fusionar, se pierden filas del registro: el presupuesto contaría de menos.
- **El estado depende del remoto.** Leer la verdad de una rama empujada exige red; sin `fetch`, el
  orquestador trabaja con la última copia local de la rama de estado, que es correcta si solo
  escribe esta máquina. Si algún día hay dos máquinas lanzando la factoría, esta ADR no basta.
- **Más operaciones git por ejecución** (fetch, merge, commit, push, consultar la PR) y más puntos
  de fallo. Un `push` fallido no debe perder la fila: queda commiteada en la rama local y sale en
  el siguiente `push`; el Desarrollador tiene que cubrirlo.
- **Hasta que `auto_merge` esté en `true`, una persona tiene que fusionar la PR de estado** de vez
  en cuando. No es urgente (la factoría no depende de ello), pero mientras tanto `main` va por
  detrás.
- **La fila del registro incluye `result` y `stderr`**, texto del modelo que puede venir de webs de
  terceros (ADR-0001). En `ops/runs/` no se publica, y la regla del punto 6 solo admite líneas
  añadidas, pero una fusión automática de la PR de estado mete en `main` texto que nadie ha leído.
- Migración de una vez: las filas y cambios de cola que hoy están sin commitear en la copia de la
  persona hay que llevarlos a `main` por PR, y añadir `id` a las tareas de la cola, antes de
  activar el cambio.

**Preguntas abiertas**
- ~~¿Basta que `queue.yaml` en `main` sea «cola menos registro», o el responsable quiere que el
  fichero muestre solo lo pendiente?~~ Resuelta al aceptarla (2026-10-06): basta. Las tareas consumidas
  se quitan de `queue.yaml` a mano, con una PR, cuando se quiera; ya no choca con la factoría. En ese caso hay que decidir quién y cuándo limpia las
  consumidas sin chocar con las PR que encolan.
- ¿Quién escribe el `id` y con qué forma (libre, o derivado de la issue como `issue-166`)? Esta
  ADR solo exige que exista y sea único.
- ¿Tiene `bitacora.ts from-runs` que leer también la rama de estado para no esperar a la fusión?
  No lo pide la issue.
- ¿Debe la regla de fusión de la PR de estado (punto 6) activarse con el mismo interruptor
  `auto_merge` o con uno propio, ya que no depende del Revisor ni de la validación del esquema?

**Fuentes (consultadas el 2026-10-06)**
- [1] https://github.com/rerades/cars/issues/166 — problema, restricciones, las tres opciones y
  criterio de hecho.
- [2] ADR-0011 y su fuente https://cli.github.com/manual/gh_pr_merge (`--merge`,
  `--match-head-commit`); no la he vuelto a abrir en esta ejecución.
- Repositorio (2026-10-06): `factory/run.ts` (`runTask`, `cmdNext`), `factory/orchestrator.ts`
  (`openWorkspace`, `closeWorkspace`, `openPullRequest`, `readQueue`, `writeQueue`, `pauseTask`,
  `readLedger`, `appendLedger`, `execute`), `factory/bitacora.ts`, `factory/langfuse.ts`,
  `factory/launchd/com.darkfactory.orchestrator.plist.example`, `.gitignore`.
