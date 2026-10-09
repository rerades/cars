# factory/

Orquestador de la factoría. Aplica lo definido en `docs/architecture/adr/0002-presupuesto-control-observabilidad.md`.

## Uso

Requiere Node >= 24 y `pnpm install` (dependencia: `yaml`; gestor fijado en `packageManager`, ADR-0007). Los `.ts` se ejecutan con `node` sin compilar.

```bash
node factory/run.ts --status                      # gasto y ejecuciones del periodo
node factory/run.ts researcher "tarea" --dry-run  # muestra el comando, no ejecuta
node factory/run.ts researcher "tarea"            # ejecuta (solo dentro del horario)
node factory/run.ts researcher "tarea" --ignore-window   # pruebas supervisadas de día
node factory/run.ts --trace <run_id>              # pasos de una ejecución (ops/traces/)
node factory/fetch-idae.ts TESLA                  # versiones BEV de una marca en el IDAE (fuente idae-es, T2)
```

## Cola de tareas

`factory/queue.yaml` es la lista de tareas, en orden de prioridad. La escribe una persona, por PR;
la factoría no la reescribe nunca (ADR-0013). Cada tarea lleva un `id` único:

```yaml
- id: marca-renault
  agent: researcher
  task: >-
    Lo que tiene que hacer el agente.
```

```bash
node factory/run.ts --next             # lanza la primera tarea pendiente
node factory/run.ts --next --dry-run   # muestra el comando y no lanza nada
node factory/run.ts --status           # pendientes, fallidas y presupuesto
```

Una tarea está **pendiente** mientras su `id` no tiene fila en el registro de ejecuciones
(`ops/runs/`). Si una guarda la bloquea (horario, `STOP`, presupuesto, ejecución en curso), no
se escribe fila y sigue pendiente; `--next` sale con `3`, lo que permite que launchd lo llame
cada pocas horas sin perder nada. Cuando se ejecuta, la fila la consume sea cual sea su
resultado: una tarea fallida no se reintenta en bucle, y `--status` la lista entre las fallidas.
Para reintentarla, se revisa el fallo (el issue de la alerta de Langfuse y la traza) y se encola
otra vez con un `id` nuevo. Las consumidas se pueden borrar de `queue.yaml` cuando se quiera.

**Dónde vive el estado.** La factoría no escribe en la copia de trabajo de la persona. Lee la
cola y escribe el registro en el worktree `ops/worktrees/factory-state`, rama
`chore/factory-state`: antes de cada ejecución lo pone al día con `origin/main`, y después hace
commit de la fila, `push` y abre la PR de estado si no hay una abierta. Esa PR se fusiona **con
commit de merge, nunca squash**. Mientras no se fusiona, `main` va por detrás, pero la factoría
no repite tareas porque lee de la rama. Si la rama choca con `main`, la ejecución se bloquea
(`3`) hasta que una persona lo arregle. `FACTORY_STATE_DIR` apunta el estado a otra carpeta,
sin git; lo usan las pruebas.

Códigos de salida: `0` correcto · `1` la ejecución falló · `3` bloqueado por una guarda.

## Langfuse (opcional)

Si existe `.secrets/langfuse.env`, cada ejecución se manda también a Langfuse Cloud: la traza
con sus llamadas al modelo y a herramientas, y los evals como score. Ver ADR-0004.

1. Crea una cuenta gratuita en https://cloud.langfuse.com (región UE) y un proyecto.
2. En *Settings → API Keys*, crea un par de claves y guárdalas así:

   ```bash
   # .secrets/langfuse.env (no se commitea; los agentes no lo ven)
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   # LANGFUSE_BASE_URL=https://us.cloud.langfuse.com   # solo si el proyecto está en EE. UU.
   ```

3. Para mandar las ejecuciones que ya hay: `node factory/langfuse.ts` (mes actual) o
   `node factory/langfuse.ts 2026-09`.

Si falla el envío, la ejecución no se ve afectada: sale una línea `langfuse: ... no se pudo enviar`.

En Langfuse, cada agente es un *user*, cada día una *session*, y cada fichero `.claude/agents/<agente>.md`
un *prompt*. Del prompt se crea una versión nueva solo cuando cambia su contenido en `main`, y cada
llamada al modelo queda enlazada a la versión que usó la ejecución. Así se comparan coste y evals
entre versiones. **Los prompts no se editan en Langfuse**: se cambian por PR y Langfuse solo los refleja.

## Qué comprueba antes de lanzar

1. `factory/STOP` existe → no lanza nada (interruptor de parada).
2. Fuera de `allowed_hours` → no lanza (salvo `--ignore-window`).
3. `factory/.run.lock` existe → ya hay una ejecución en curso.
4. Límite de ejecuciones del día, global y del agente.
5. Presupuesto del periodo, global y del agente, leído de `ops/runs/`.
6. El agente tiene límites por ejecución definidos.

Después lanza `claude -p` con `--agent`, `--model`, `--max-turns`, `--max-budget-usd` y
`--permission-mode`, guarda la traza en `ops/traces/<run_id>.jsonl`, pasa los evals de `factory/evals.ts` sobre lo
que escribió el agente (si fallan, `eval_failed` y no hay PR; ver ADR-0004) y escribe una línea
en `ops/runs/YYYY-MM.jsonl`.

## Rama por ejecución

Cada ejecución abre un `git worktree` en `ops/worktrees/<run_id>` sobre la rama
`agent/<agente>/<run_id>`, y el agente trabaja ahí: nunca escribe en la copia de trabajo
de la persona, ni aunque tenga cambios a medias. Al terminar se commitea lo que haya
escrito, se retira el worktree y la rama se queda. Si no escribió nada, la rama se borra.

El worktree parte de `origin/main`, no de `HEAD`: si tienes una rama a medias, su trabajo
no se cuela en lo que escribe el agente.

Si la ejecución termina en `success`, la rama se sube y se abre la PR sola, con la tarea, el
coste, los turnos y lo que dijo el agente, avisando de que nadie la ha revisado. Una ejecución
fallida deja la rama en local y no publica nada. Se apaga con `auto_pr: false` en
`factory/budgets.yaml`.

Antes de cada ejecución se borran las ramas `agent/*` ya fusionadas y se podan los worktrees
sueltos. Las ramas sin fusionar y las tuyas no se tocan.

El ledger y la bitácora se escriben en el repo principal, que es donde vive el gasto.

## Control de acciones

`.claude/settings.json` engancha dos hooks en cada Write/Edit/Bash:

- `guard_paths.ts`: bloquea escrituras fuera de las `write_paths` del agente, rutas protegidas
  (`factory/`, `.claude/`, `.git/`, `.secrets/`, `ops/runs/`), escrituras fuera del repositorio
  y comandos peligrosos (`git push`, `rm -rf`, `sudo`, acceso a secretos). Falla cerrado: si hay un
  error interno durante una ejecución de la factoría, bloquea (exit 2).
- `log_action.ts`: registra cada acción en `ops/actions/<run_id>.jsonl`.

Los hooks solo actúan cuando existe `FACTORY_AGENT`, es decir, en ejecuciones de la factoría.
En uso interactivo no molestan.

## Parar la factoría

```bash
touch factory/STOP     # para
rm factory/STOP        # reanuda
```

## Pruebas

```bash
pnpm test            # node:test
pnpm run typecheck   # tsc --noEmit
```

## Programación nocturna (macOS)

`factory/launchd/com.darkfactory.orchestrator.plist.example` es la plantilla. Copiar a
`~/Library/LaunchAgents/`, ajustar rutas y cargar con `launchctl load`.
`com.darkfactory.reviewer.plist.example` se instala igual y lanza el Revisor a las 06:30, fuera
de la cola: revisa las PR que abrió la noche.
