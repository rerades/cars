# Dark Factory — web de coches eléctricos

Factoría de agentes autónomos que construye y mantiene una web de coches eléctricos
(Europa, foco España). El visitante solo lee; no se guardan datos personales.

## Lee esto antes de trabajar
1. `docs/README.md` — mapa de la documentación.
2. `docs/bitacora/` — qué se ha hecho y **por qué**. Empieza por el mes actual.
3. `docs/product/vision.md` y el PRD que toque.
4. `docs/architecture/adr/` — decisiones vigentes (ADR-0001 fuentes, ADR-0002 presupuesto).
5. `docs/process/workflow.md` y `definition-of-done.md`.

## Reglas del repositorio
- **La documentación es el contrato.** Un cambio de alcance se hace primero en el PRD y
  después en el código.
- **Todo entra por PR**, nunca commit directo a `main`.
- **Nada se inventa**: los datos de coches llevan fuente, URL y fecha (ADR-0001).
- **Secretos**: `.secrets/` está en `.gitignore` y no se lee ni se commitea nunca.
- Idioma de la documentación y de los commits: español. Formato de commit: `tipo(ámbito): asunto`.

## Bitácora (obligatorio)
Al terminar cualquier tarea que deje cambios, **actualiza la bitácora en el mismo commit**:

```bash
python3 factory/bitacora.py add --tipo decision --texto "qué se decidió y por qué" --refs ADR-0002
python3 factory/bitacora.py from-git     # importa los commits nuevos
python3 factory/bitacora.py from-runs    # importa las ejecuciones de agentes
```

Usa `decision` cuando haya un porqué que recordar y alternativas descartadas; `hito` para algo
terminado; `nota` para el resto. Los commits y las ejecuciones se importan, no se escriben a mano.

## Factoría
```bash
python3 factory/run.py --status                      # presupuesto y ejecuciones
python3 factory/run.py <agente> "tarea" --dry-run    # ver el comando
python3 -m unittest discover -s factory/tests -v     # pruebas
touch factory/STOP                                   # parar la factoría
```
Los límites están en `factory/budgets.yaml`. Los hooks de `.claude/hooks/` bloquean escrituras
fuera de la carpeta de cada agente; solo se activan cuando existe `FACTORY_AGENT`.

## Estado actual
- Hecho: documentación, ADR-0001 y 0002, agente Researcher, orquestador, hooks, bitácora.
- Pendiente: cola de tareas (`run.py --next`), primera ejecución real del Researcher,
  ADR-0003 (stack de la web), licencia de las imágenes.
