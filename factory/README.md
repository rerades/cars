# factory/

Orquestador de la factoría. Aplica lo definido en `docs/architecture/adr/0002-presupuesto-control-observabilidad.md`.

## Uso

Requiere Node >= 24 y `npm install` (dependencia: `yaml`). Los `.ts` se ejecutan con `node` sin compilar.

```bash
node factory/run.ts --status                      # gasto y ejecuciones del periodo
node factory/run.ts researcher "tarea" --dry-run  # muestra el comando, no ejecuta
node factory/run.ts researcher "tarea"            # ejecuta (solo dentro del horario)
node factory/run.ts researcher "tarea" --ignore-window   # pruebas supervisadas de día
```

Códigos de salida: `0` correcto · `1` la ejecución falló · `3` bloqueado por una guarda.

## Qué comprueba antes de lanzar

1. `factory/STOP` existe → no lanza nada (interruptor de parada).
2. Fuera de `allowed_hours` → no lanza (salvo `--ignore-window`).
3. `factory/.run.lock` existe → ya hay una ejecución en curso.
4. Límite de ejecuciones del día, global y del agente.
5. Presupuesto del periodo, global y del agente, leído de `ops/runs/`.
6. El agente tiene límites por ejecución definidos.

Después lanza `claude -p` con `--agent`, `--model`, `--max-turns`, `--max-budget-usd` y
`--permission-mode`, y escribe una línea en `ops/runs/YYYY-MM.jsonl`.

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
