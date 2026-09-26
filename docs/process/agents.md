# Roles de agentes

| Rol | Responsabilidad | Puede escribir en | Estado |
|---|---|---|---|
| Producto (`product`) | Redactar y mantener PRD | `docs/product/` | **activo** |
| Planificador (`planner`) | Trocear PRD `ready` en épica e historias | GitHub Issues | **activo** |
| Researcher (`researcher`) | Mantener el registro de fuentes y obtener datos de modelos, precios e imágenes | `data/` | **activo** |
| Arquitecto (`architect`) | Proponer ADR y el modelo de datos | `docs/architecture/` | **activo** |
| Desarrollador (`developer`) | Implementar historias | `web/` | **activo** |
| Revisor / QA (`reviewer`) | Verificar la DoD y los CA | comentarios en PR | **activo** |

Además de su columna, **todos** pueden escribir en `docs/bitacora/`: la regla de CLAUDE.md de
registrar lo hecho en el mismo commit también les toca a ellos. No editan el fichero a mano, lo
hacen con `node factory/bitacora.ts add`, y el orquestador se lo recuerda en cada tarea.

Definiciones ejecutables de los agentes: `.claude/agents/`. Sin su fichero ahí, el orquestador
no puede lanzarlos (`--agent <nombre>`). Se crean de uno en uno, cuando toca su primera tarea,
en este orden: `architect`, `product`, `planner`, `developer` y `reviewer`: los seis están hechos.

Presupuesto, permisos (`allowed_tools`) y rutas de escritura: `factory/budgets.yaml`. Los
permisos son explícitos y mínimos porque en modo `-p` no hay quien apruebe nada: lo que no esté
declarado se deniega. La barrera real sigue siendo `.claude/hooks/guard_paths.ts`, que bloquea
`git push` y las rutas protegidas aunque el agente tenga Write.
