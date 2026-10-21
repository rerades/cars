# ADR-0018 — La cola se alimenta de las issues (alimentador sin modelo)

- **Estado:** propuesta
- **Fecha:** 2026-10-21

## Contexto
PRD-007 (borrador), sección 1: unas 26 PR humanas al mes solo sirven para encolar, y como
`factory/queue.yaml` no comprueba dependencias, la persona espera a que una historia se fusione
para encolar la siguiente. La métrica de la sección 2 pide llegar a 0 PR que solo encolan.

Requisitos que obligan a decidir:

- **RF-2:** una historia abierta con la etiqueta `factory:ready` entra en la cola cuando están
  cerradas todas las issues que su cuerpo cita en una línea `Depende de: #x, #y`. La tarea nombra
  la historia y su agente. `queue.yaml` se queda para lo que no es una historia (datos, PRD, ADR,
  diseño). Una historia no se encola dos veces. Enmienda ADR-0013.
- **RNF-1:** sin modelo y sin servicios externos nuevos. **RNF-4:** cada decisión de encolar deja
  rastro en `ops/` o en un comentario, con su motivo. **RNF-5:** `factory/STOP` también para el
  alimentador. **RNF-2:** los límites de ADR-0002 siguen mandando.
- **CA-2:** con una dependencia abierta no entra; cuando se cierra, entra en la pasada siguiente, y
  una tercera pasada no la duplica. **CA-3:** sin `factory:ready` no entra aunque no tenga
  dependencias. **CA-14:** con `STOP`, el alimentador no encola.
- **OPEN-5:** ¿sustituye a las tareas de historias de `queue.yaml` o conviven, y en qué orden?

Lo que ya existe y condiciona la decisión (repositorio, 2026-10-21):

- **ADR-0013** (aceptada): la factoría no escribe `queue.yaml`; una tarea está consumida cuando el
  registro (`ops/runs/`) tiene una fila con su `task_id`, sea cual sea el `outcome`; una fallida no
  se reintenta, se encola otra vez con un `id` nuevo; la convención de `id` es `issue-N` para una
  historia y un sufijo `-2`, `-3`… al reintentar. El registro vive en la rama de estado
  `chore/factory-state`, que se fusiona sola si su diff solo añade líneas a `ops/runs/*.jsonl` u
  `ops/merges/*.jsonl` (punto 6).
- `cmdNext` (`factory/run.ts`) llama a `syncState()`, calcula `queueState(readQueue(),
  readAllLedger())` y lanza `pending[0]`. Si `runTask` devuelve 3 (una guarda, por ejemplo el tope
  diario del agente), la pasada termina sin probar la siguiente tarea.
- El LaunchAgent lanza `--next` cuatro veces por noche; `max_concurrent_runs: 1`,
  `max_runs_per_day: 15` (`factory/budgets.yaml`).
- Las historias las abre el Planificador con `--label story,agente` (`.claude/agents/planner.md`)
  y la plantilla `.github/ISSUE_TEMPLATE/story.md` (Épica, PRD, Cubre). Las dependencias se
  escriben hoy en prosa («depende de #12», `planner.md`); la plantilla no tiene un campo para ellas
  ni para el agente.
- El Desarrollador ya lee su historia con `gh issue view` (`.claude/agents/developer.md`, permiso
  `Bash(gh issue view:*)` en `budgets.yaml`).
- Las tareas de historias de `queue.yaml` (`issue-37`, `issue-40`, `issue-112`…) llevan un texto
  largo escrito a mano con contexto que no está en la issue: documentos de diseño, notas de
  revisión que ya no valen, qué función reutilizar.

## Opciones consideradas

### A. Cómo se materializa «entrar en la cola»

**A1. El alimentador escribe las historias en `queue.yaml` con una PR.** Descartada: es lo que
ADR-0013 prohibió (la factoría no reescribe la cola) y vuelve a los conflictos con las PR humanas
que encolan; además la tarea no podría lanzarse hasta que alguien fusionara esa PR, porque la cola
de `main` no es de la factoría y no entra en la regla de fusión de la rama de estado.

**A2. Un fichero de cola propio de la factoría en la rama de estado** (`ops/queue-issues.yaml`).
Descartada: duplica en un fichero lo que GitHub ya dice (etiqueta, estado, dependencias) y obliga a
mantenerlos sincronizados; una historia a la que se quita la etiqueta seguiría en el fichero.

**A3. Cola virtual, recalculada en cada pasada (elegida).** El alimentador consulta GitHub al
empezar cada `--next` y añade a las pendientes de `queue.yaml` las historias que cumplen la regla
y aún no están consumidas. No persiste la cola, solo el rastro de sus decisiones. Quitar la
etiqueta antes de que se lance la historia la saca de la cola sin más.

### B. Cómo se declaran las dependencias

**B1. Línea `Depende de: #x, #y` en el cuerpo (elegida, la que nombra RF-2).**
- A favor: la escribe el Planificador con `gh issue create`, que ya puede usar; se ve al leer la
  issue; no depende de ninguna función de GitHub más allá del cuerpo.
- En contra: es texto libre; una errata («Depende #12», «depende de 12») hace que la dependencia se
  ignore en silencio y la historia se lance antes de tiempo. Por eso el formato es estricto y el
  alimentador rechaza lo que se le parece y no cuadra (ver Decisión, punto 3).

**B2. Dependencias nativas de GitHub («blocked by»).** GitHub tiene una API de dependencias entre
issues (`GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by`) ([1]) y
`gh issue list --json` ofrece los campos `blockedBy` y `blocking` ([2]).
- A favor: dato estructurado, sin análisis de texto; GitHub lo muestra en la issue.
- En contra: RF-2 pide la línea del cuerpo; el Planificador solo tiene `Bash(gh issue:*)` y crear
  la relación es un `POST` a esa API (no he comprobado si `gh issue create` o `gh issue edit`
  tienen una opción para ello: no lo he abierto en esta ejecución); en la página de la API no consta
  si la función es estable ni qué permisos pide ([1]). Descartada ahora; puede sustituir a B1 más
  adelante sin cambiar el resto de esta ADR, porque el alimentador solo necesita la lista de números.

**B3. Una etiqueta por dependencia** (`depends:12`). Descartada: una etiqueta por issue llena el
repositorio de etiquetas que nadie borra, y no aporta nada sobre B1.

**B4. El orden de `queue.yaml` como dependencia implícita** (lo de hoy). Descartada: es el problema
que describe la sección 1 de PRD-007.

### C. Qué agente recibe la historia

**C1. Siempre el Desarrollador.** Descartada: es un supuesto. RF-2 dice «la historia y su agente»,
y nada en el PRD limita las historias al Desarrollador.

**C2. Una línea `Agente: <nombre>` en el cuerpo.** A favor: coherente con B1. En contra: otro
análisis de texto libre, y no se puede filtrar en GitHub.

**C3. Una etiqueta `agent:<nombre>` (elegida).** Se filtra y se ve en la lista de issues, y una
errata no se ignora en silencio: si el nombre no es un agente de `budgets.yaml`, se rechaza.

### D. Orden entre `queue.yaml` y las historias (OPEN-5)

**D1. El alimentador sustituye ya a las historias de `queue.yaml`.** Descartada: las historias que
hoy están en `queue.yaml` llevan un texto escrito a mano que la tarea genérica no tiene; quitarlas
de golpe pierde ese contexto.

**D2. Primero las historias, después `queue.yaml`.** Descartada: `queue.yaml` es el orden que una
persona escribe a propósito (por ejemplo, una ADR que desbloquea una historia); ponerlo detrás de un
flujo automático le quita a la persona el control de lo urgente.

**D3. Intercalar por turnos o por fecha.** Descartada: más reglas y un orden que nadie puede
predecir leyendo un solo sitio.

**D4. Conviven: primero `queue.yaml`, después las historias de la más antigua a la más nueva
(elegida).**

### E. Cuándo pasa el alimentador

**E1. Al empezar cada `--next` (elegida).** Sin proceso nuevo; las cuatro pasadas de la noche ven
las dependencias cerradas durante el día (CA-2: «entra en la siguiente pasada»).

**E2. Un workflow de GitHub Actions al cerrar o etiquetar una issue.** Descartada: tendría que
escribir en la rama de estado desde la CI, y la cola es virtual (A3), así que no hay nada que
escribir en ese momento.

**E3. Un LaunchAgent propio.** Descartada: otro horario que coordinar con el lock del orquestador
para nada que E1 no haga.

### F. Rastro (RNF-4)

**F1. Comentario en la issue al encolarla.** Descartada como rastro principal: escribe en GitHub en
cada cambio de estado, necesita permisos de escritura en issues para el orquestador y no se puede
contar con `run.ts --metrics` (RF-1). Queda como posible añadido.

**F2. Una fila por historia y por pasada en `ops/`.** Descartada: cuatro pasadas por noche y
decenas de historias bloqueadas llenan el fichero de filas iguales.

**F3. Una fila en `ops/feeder/YYYY-MM.jsonl` solo cuando cambia la decisión sobre una historia
(elegida).**

## Decisión
**Al empezar cada `--next`, un alimentador sin modelo calcula una cola virtual de historias a
partir de GitHub —issues abiertas con `story`, `factory:ready` y una etiqueta `agent:<nombre>`,
cuyas dependencias de la línea `Depende de:` están cerradas—, con el `id` `issue-N` de ADR-0013,
detrás de las pendientes de `queue.yaml`, y deja en `ops/feeder/` una fila cada vez que cambia su
decisión sobre una historia.**

Detalles:

1. **Qué es una historia lista.** Una issue **abierta** con las etiquetas `story` y `factory:ready`
   y **exactamente una** etiqueta `agent:<nombre>`, donde `<nombre>` es un agente de
   `factory/budgets.yaml` que no está a `null`. Sin `factory:ready` no se mira (CA-3). Con
   `factory:ready` pero sin `story`, sin `agent:` o con más de uno, o con un agente desconocido, no
   se encola y queda rechazada con su motivo.
2. **Consulta.** `gh issue list --state open --label factory:ready --json
   number,title,body,labels,createdAt --limit 200` ([2]; `--limit` por defecto es 30). Si devuelve
   200, se avisa de que puede faltar alguna. Para cada dependencia, su estado con `gh`.
3. **Dependencias.** Se buscan en el cuerpo las líneas que, quitando el marcado de negrita, empiezan
   por `Depende de:` (sin distinguir mayúsculas); de ellas se toman todos los `#N`. Varias líneas se
   suman. Sin línea, no hay dependencias. La historia entra si todas están **cerradas** (`state:
   CLOSED`, sea cual sea el motivo del cierre, como dice RF-2). Se **rechaza** (no se encola, con
   motivo) si:
   - el cuerpo contiene «depende de» fuera de una línea con ese formato, o la línea no tiene ningún
     `#N`: probablemente es una dependencia mal escrita;
   - un `#N` no existe o no es una issue;
   - se cita a sí misma.
   Las dependencias en cadena no se siguen: basta con que las citadas estén cerradas.
4. **La tarea.** `id: issue-N` (convención de ADR-0013), `agent` el de la etiqueta y este texto fijo,
   en el que solo cambian el número y el título:

   > Historia #N: «<título>». Léela con sus comentarios (`gh issue view N --comments`), su épica y
   > el PRD que cita, e impleméntala según tus instrucciones. La PR referencia #N y enumera los RF y
   > CA cubiertos.

   El contexto que hoy se escribe a mano en `queue.yaml` va en el cuerpo o en un comentario de la
   issue antes de ponerle `factory:ready`.
5. **No encolar dos veces.** La regla de ADR-0013 sin cambios: `issue-N` está consumida si hay una
   fila en el registro con ese `task_id`, sea cual sea el `outcome`. Además, el alimentador **no
   genera** `issue-N` si `queue.yaml` ya tiene una tarea con ese `id` o con `issue-N-<sufijo>`: la
   persona ya la ha encolado a mano y manda su texto. Como el `id` es el mismo espacio de nombres,
   las historias de `queue.yaml` ya consumidas (`issue-37`…) no se vuelven a lanzar al ponerles la
   etiqueta (CA-2, tercera pasada).
6. **Si falla.** Como cualquier tarea de ADR-0013: queda consumida y no se reintenta; sale en las
   fallidas de `--status`. Reintentar es encolar a mano en `queue.yaml` `issue-N-2` (con el texto
   que haga falta), como hoy. El alimentador no quita la etiqueta ni comenta.
7. **Orden (OPEN-5).** Conviven: primero las pendientes de `queue.yaml` en su orden, después las
   historias listas por número de issue ascendente (la más antigua primero). Desde que se active,
   las historias se dejan de encolar en `queue.yaml` salvo para reintentar o para dar un texto
   propio; las que ya estén se consumen allí.
8. **Cuándo.** Dentro de `cmdNext`, después de `syncState()` y antes de `queueState`, bajo el lock
   del orquestador. También lo usa `run.ts --status` (sin escribir rastro) para mostrar la cola de
   historias, las bloqueadas con sus dependencias abiertas y las rechazadas con su motivo.
   - **STOP (RNF-5, CA-14):** si existe `factory/STOP`, el alimentador no consulta GitHub ni escribe
     rastro, y `--next` solo ve `queue.yaml` (que, a su vez, no lanza por la guarda de siempre).
   - **Sin red o `gh` falla:** la pasada sigue solo con `queue.yaml` y deja una fila `error` con el
     mensaje. Nunca bloquea la cola de la persona.
9. **Rastro (RNF-4).** `ops/feeder/YYYY-MM.jsonl`, escrito en el worktree de estado y commiteado con
   la fila del registro de la misma pasada. Una fila por historia **solo si su decisión cambia**
   respecto a su última fila: `{ts, issue, decision, agent, reason, deps_open}` con `decision` en
   `ready` (entra en la cola), `blocked` (con las dependencias abiertas), `rejected` (con el motivo)
   o `gone` (tenía fila `ready` o `blocked` y ya no cumple: etiqueta quitada o issue cerrada), más
   una fila `error` por pasada fallida. «Encolada» en CA-2 es la fila `ready`; la ejecución es la
   fila de `ops/runs/` con `task_id: issue-N`.
10. **Función pura.** El cálculo (issues, estados de las dependencias, cola, registro, agentes,
    últimas filas del rastro → historias pendientes y filas nuevas) es una función sin E/S, para
    probar CA-2, CA-3 y CA-14 sin GitHub.

**Enmienda de ADR-0013** (se anota en su historial al aceptar esta ADR):

- Punto 1: «pendiente» pasa a ser las pendientes de `queue.yaml` **seguidas de** las historias de
  la cola virtual; `--next` coge la primera de la lista combinada.
- Convención de `id`: `issue-N` sin sufijo lo genera el alimentador; a mano se usa solo para encolar
  antes de activar este cambio o con sufijo para reintentar.
- Punto 6: la regla de fusión automática de la rama de estado admite también líneas añadidas a
  `ops/feeder/*.jsonl`. Sigue sin admitir borrar ni tocar otra ruta.
- `--status` muestra la cola de historias junto a la de `queue.yaml`.

**Qué cambia en el código (lo hace el Desarrollador; aquí no se escribe):** el alimentador y su
función pura en `factory/`; `cmdNext` y `--status` en `run.ts`; `stateMergeBlocker` para
`ops/feeder/`; la línea `**Depende de:** #` en `.github/ISSUE_TEMPLATE/story.md`; las etiquetas
`factory:ready` y `agent:<nombre>` en el repositorio; y en `.claude/agents/planner.md`, que escriba
la línea con ese formato y ponga la etiqueta `agent:`. `factory/README.md` y la cabecera de
`queue.yaml` describen el flujo de hoy y hay que actualizarlos.

## Consecuencias
**Buenas**
- Encolar una historia es poner una etiqueta, sin PR: la métrica «PR que solo encolan» puede
  llegar a 0 para las historias. Una historia dependiente entra sola cuando se cierra la que la
  bloquea, sin esperar a la persona.
- No hay estado nuevo que sincronizar: GitHub dice qué está listo y el registro de ADR-0013 dice
  qué está consumido. Las dos fuentes comparten el espacio de `id`, así que no se duplica ni en la
  migración.
- Sin modelo y sin servicio nuevo (RNF-1): solo `gh`, que el orquestador ya usa.
- El rastro dice por qué una historia no ha entrado, sin repetir filas cada pasada.

**Malas o a vigilar**
- **Se pierde el texto a medida.** Las tareas de historias de `queue.yaml` llevan contexto que hoy
  no está en la issue. Si nadie lo escribe en la issue antes de poner `factory:ready`, el
  Desarrollador trabaja con menos información y puede subir el número de `review:changes`.
- **Una dependencia mal escrita se puede escapar.** El punto 3 caza «depende de» fuera de formato,
  pero no un número equivocado (`#21` por `#12`): esa historia se lanzaría antes de tiempo.
- **Una dependencia cerrada como «no planificada» desbloquea** igual que una terminada, porque RF-2
  solo pide que esté cerrada. Cerrar una issue para descartarla puede lanzar trabajo que dependía
  de ella.
- **Cerrada no es fusionada en `main`.** Si una issue se cierra a mano antes de que su PR entre, la
  dependiente se lanza sobre un `main` sin ese cambio.
- **La cola de historias va siempre detrás de `queue.yaml`.** Con una `queue.yaml` larga, las
  historias esperan. Y `cmdNext` no salta la cabeza bloqueada: si la primera pendiente es de un
  agente que ha llegado a su tope diario (`developer: max_runs_per_day: 4`), la pasada termina sin
  probar las demás. Con más historias del Desarrollador en cola esto pesará más; no lo decide esta
  ADR (ver preguntas).
- **Más llamadas a GitHub por pasada** (una lista y una consulta por dependencia) y un punto de
  fallo más; por eso un fallo del alimentador no bloquea `queue.yaml`.
- **Cualquiera que pueda etiquetar issues puede encolar trabajo** de la factoría, con el gasto que
  supone (acotado por los topes de ADR-0002). Hoy encolar exige una PR fusionada por una persona.
- **Un reintento sigue pasando por `queue.yaml`**: una historia fallida necesita una PR para volver
  a la cola, así que la métrica no llega a 0 mientras haya fallos.
- La rama de estado gana una ruta más en su regla de fusión automática (`ops/feeder/`), con la misma
  salvedad que ADR-0013 sobre texto que nadie lee: aquí son títulos de issue y motivos generados
  por código.

**Preguntas abiertas**
- ¿Quién pone `factory:ready`: solo una persona, o también el Planificador? ¿Y debe el alimentador
  exigir que la historia ya no tenga la etiqueta `agente` (sin revisar, `planner.md`)? PRD-007 no lo
  dice.
- ¿Debe `--next` saltar las tareas cuyo agente ha llegado a su tope y probar la siguiente, en vez de
  terminar la pasada? Afecta a las dos fuentes y es una enmienda de ADR-0013 aparte.
- ¿Se reintenta una historia fallida de forma automática (por ejemplo, con una etiqueta
  `factory:retry`) o siempre por `queue.yaml`? Puede chocar con el bucle de corrección de RF-5.
- ¿Se pasa a las dependencias nativas de GitHub (B2) cuando se compruebe que `gh` las crea y que la
  función es estable?
- ¿Un comentario `🏭` en la issue al encolarla (F1), además de la fila en `ops/feeder/`?

**Fuentes (consultadas el 2026-10-21)**
- [1] https://docs.github.com/en/rest/issues/issue-dependencies — rutas `GET`/`POST`
  `.../dependencies/blocked_by`, `DELETE .../blocked_by/{issue_id}`, `GET .../dependencies/blocking`;
  la página no indica permisos ni si es estable.
- [2] https://cli.github.com/manual/gh_issue_list — `--label`, `--state` (por defecto `open`),
  `--limit` (por defecto 30), y campos `--json` como `body`, `labels`, `number`, `state`,
  `stateReason`, `blockedBy` y `blocking`.
- Repositorio (2026-10-21): `docs/product/prd/PRD-007-harness-factoria.md`,
  `docs/architecture/adr/0013-commit-del-estado-de-la-factoria.md`, `factory/queue.yaml`,
  `factory/budgets.yaml`, `factory/run.ts` (`cmdNext`), `factory/orchestrator.ts` (`readQueue`,
  `queueState`), `.github/ISSUE_TEMPLATE/story.md`, `.claude/agents/planner.md` y `developer.md`.
  ADR-0002 no la he releído en esta ejecución: sus límites se citan por `budgets.yaml`.
