# Dark Factory — web de coches eléctricos

Factoría de agentes autónomos que construye y mantiene una web de coches eléctricos
(Europa, foco España). El visitante solo lee; no se guardan datos personales.

## Entorno
Node >= 24 (ejecuta TypeScript directamente, sin compilar). Sin Python. `npm install` una vez;
`npm test` y `npm run typecheck` antes de abrir un PR.

## Lee esto antes de trabajar
1. `docs/README.md` — mapa de la documentación.
2. `docs/bitacora/` — qué se ha hecho y **por qué**. Empieza por el mes actual.
3. `docs/product/vision.md` y el PRD que toque.
4. `docs/architecture/adr/` — decisiones vigentes (ADR-0001 fuentes, ADR-0002 presupuesto, ADR-0004 trazas y evals).
5. `docs/process/workflow.md` y `definition-of-done.md`.

## Reglas del repositorio
- **La documentación es el contrato.** Un cambio de alcance se hace primero en el PRD y
  después en el código.
- **Todo entra por PR**, nunca commit directo a `main`.
- **Nada se inventa**: los datos de coches llevan fuente, URL y fecha (ADR-0001).
- **Secretos**: `.secrets/` está en `.gitignore` y no se lee ni se commitea nunca.
- **Idiomas**: la documentación (`docs/`, bitácora, README) y la conversación con el agente, en
  español. El código, los mensajes de commit y el título y cuerpo de las PR, en inglés. Formato de
  commit: `tipo(ámbito): asunto`. El código escrito hasta ahora tiene los comentarios en español:
  se pasa a inglés cuando se toque, no en una pasada aparte. Los textos que la CLI muestra al
  usuario (`run.ts`, `bitacora.ts`) siguen en español.

## Bitácora (obligatorio)
Al terminar cualquier tarea que deje cambios, **actualiza la bitácora en el mismo commit**:

```bash
node factory/bitacora.ts add --tipo decision --texto "qué se decidió y por qué" --refs ADR-0002
node factory/bitacora.ts from-git     # importa los commits nuevos
node factory/bitacora.ts from-runs    # importa las ejecuciones de agentes
```

Usa `decision` cuando haya un porqué que recordar y alternativas descartadas; `hito` para algo
terminado; `nota` para el resto. Los commits y las ejecuciones se importan, no se escriben a mano.

## Factoría
```bash
node factory/run.ts --status                    # presupuesto y ejecuciones
node factory/run.ts <agente> "tarea" --dry-run  # ver el comando
node factory/run.ts --next                      # primera tarea de factory/queue.yaml
npm test && npm run typecheck                   # pruebas y tipos
touch factory/STOP                              # parar la factoría
```
Los límites están en `factory/budgets.yaml`. Cada ejecución trabaja en su propia rama
`agent/<agente>/<run_id>` dentro de un worktree, así que nunca toca tu copia de trabajo.
Si termina bien, abre su propia PR (`auto_pr` en `budgets.yaml`); si falla, la rama se queda en local. Los hooks de `.claude/hooks/` bloquean escrituras
fuera de la carpeta de cada agente; solo se activan cuando existe `FACTORY_AGENT`.

## Estado actual
- Hecho: documentación, ADR-0001 y 0002, agente Researcher, orquestador, hooks, bitácora,
  migración a TypeScript, CI, primera ejecución real del Researcher, cola de tareas
  (`factory/queue.yaml` + `run.ts --next`), trazas y evals deterministas (ADR-0004, `run.ts --trace`), envío a Langfuse Cloud.
- Pendiente: ADR-0003 (stack de la web), licencia de las imágenes de Cupra, verificar que el
  configurador de Cupra da el PVP sin ayudas (primera tarea de la cola).
