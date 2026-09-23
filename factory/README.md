# factory/

Orquestador de la factoría. Aplica lo definido en `docs/architecture/adr/0002-presupuesto-control-observabilidad.md`.

## Uso

Requiere Node >= 24 y `npm install` (dependencia: `yaml`). Los `.ts` se ejecutan con `node` sin compilar.

```bash
node factory/run.ts --status                      # gasto y ejecuciones del periodo
node factory/run.ts researcher "tarea" --dry-run  # muestra el comando, no ejecuta
node factory/run.ts researcher "tarea"            # ejecuta (solo dentro del horario)
node factory/run.ts researcher "tarea" --ignore-window   # pruebas supervisadas de día
node factory/run.ts --trace <run_id>              # pasos de una ejecución (ops/traces/)
```

## Cola de tareas

`factory/queue.yaml` es una lista de tareas pendientes, en orden de prioridad, que se
añaden a mano:

```yaml
- agent: researcher
  task: >-
    Lo que tiene que hacer el agente.
```

```bash
node factory/run.ts --next             # coge la primera tarea y la lanza
node factory/run.ts --next --dry-run   # muestra el comando y no toca la cola
```

La tarea solo sale de la cola si llega a ejecutarse. Si una guarda la bloquea (horario,
`STOP`, presupuesto, ejecución en curso), se queda para el siguiente intento y `--next`
sale con `3`: es lo que permite que launchd lo llame cada pocas horas sin perder nada.
Con la cola vacía no hace nada y sale con `0`. El resultado de la ejecución va al ledger,
no a la cola.

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
npm test            # node:test
npm run typecheck   # tsc --noEmit
```

## Programación nocturna (macOS)

`factory/launchd/com.darkfactory.orchestrator.plist.example` es la plantilla. Copiar a
`~/Library/LaunchAgents/`, ajustar rutas y cargar con `launchctl load`.
