# factory/

Orquestador de la factoría. Aplica lo definido en `docs/architecture/adr/0002-presupuesto-control-observabilidad.md`.

## Uso

```bash
python3 factory/run.py --status                      # gasto y ejecuciones del periodo
python3 factory/run.py researcher "tarea" --dry-run  # muestra el comando, no ejecuta
python3 factory/run.py researcher "tarea"            # ejecuta (solo dentro del horario)
python3 factory/run.py researcher "tarea" --ignore-window   # pruebas supervisadas de día
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

- `guard_paths.py`: bloquea escrituras fuera de las `write_paths` del agente, rutas protegidas
  (`factory/`, `.claude/`, `.git/`, `.secrets/`, `ops/runs/`), escrituras fuera del repositorio
  y comandos peligrosos (`git push`, `rm -rf`, `sudo`, acceso a secretos).
- `log_action.py`: registra cada acción en `ops/actions/<run_id>.jsonl`.

Los hooks solo actúan cuando existe `FACTORY_AGENT`, es decir, en ejecuciones de la factoría.
En uso interactivo no molestan.

## Parar la factoría

```bash
touch factory/STOP     # para
rm factory/STOP        # reanuda
```

## Pruebas

```bash
python3 -m unittest discover -s factory/tests -v
```

## Programación nocturna (macOS)

`factory/launchd/com.darkfactory.orchestrator.plist.example` es la plantilla. Copiar a
`~/Library/LaunchAgents/`, ajustar rutas y cargar con `launchctl load`.
