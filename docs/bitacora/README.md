# Bitácora

Registro cronológico de lo que va pasando en el proyecto: decisiones, hitos, commits y
ejecuciones de agentes. Un fichero por mes (`YYYY-MM.md`), versionado con git.

## Para qué sirve
- Reconstruir **por qué** se hizo algo, no solo qué se hizo (eso ya está en los commits).
- Que cualquier sesión nueva de Claude (o cualquier persona) se ponga al día leyendo un solo sitio.
- Dejar rastro de las ejecuciones de la factoría junto a las decisiones humanas.

## Cómo se actualiza

```bash
node factory/bitacora.ts add --tipo decision --texto "..." --refs PR#2 ADR-0002
node factory/bitacora.ts from-git     # añade los commits aún no registrados
node factory/bitacora.ts from-runs    # añade las ejecuciones aún no registradas
```

`from-git` y `from-runs` son idempotentes: cada entrada lleva una marca oculta con el hash del
commit o el `run_id`, así que repetir el comando no duplica nada.

Tipos: `decision`, `hito`, `commit`, `run`, `nota`.

## Convención
- Las **decisiones** se escriben a mano (o las escribe Claude al final de la tarea) y explican
  el porqué y las alternativas descartadas.
- Los **commits** y las **ejecuciones** se importan con los comandos de arriba.
- Al terminar cualquier tarea con Claude, se actualiza la bitácora en el mismo commit. Está
  recogido en `CLAUDE.md`.
