# Roles de agentes

| Rol | Responsabilidad | Puede escribir en | Estado |
|---|---|---|---|
| Producto (`product`) | Redactar y mantener PRD | `docs/product/` | presupuesto y permisos; sin definición |
| Planificador (`planner`) | Trocear PRD `ready` en épica e historias | GitHub Issues | presupuesto y permisos; sin definición |
| Researcher (`researcher`) | Mantener el registro de fuentes y obtener datos de modelos, precios e imágenes | `data/` | **activo** |
| Arquitecto (`architect`) | Proponer ADR y el modelo de datos | `docs/architecture/` | presupuesto y permisos; sin definición |
| Desarrollador (`developer`) | Implementar historias | `src/`, `tests/` | presupuesto y permisos; sin definición |
| Revisor / QA (`reviewer`) | Verificar la DoD y los CA | comentarios en PR | presupuesto y permisos; sin definición |

Definiciones ejecutables de los agentes: `.claude/agents/`. Sin su fichero ahí, el orquestador
no puede lanzarlos (`--agent <nombre>`). Se crean de uno en uno, cuando toca su primera tarea,
en este orden: `architect` (ADR-0003, el stack de la web) → `planner` → `developer` → `reviewer`.

Presupuesto, permisos (`allowed_tools`) y rutas de escritura: `factory/budgets.yaml`. Los
permisos son explícitos y mínimos porque en modo `-p` no hay quien apruebe nada: lo que no esté
declarado se deniega. La barrera real sigue siendo `.claude/hooks/guard_paths.ts`, que bloquea
`git push` y las rutas protegidas aunque el agente tenga Write.
