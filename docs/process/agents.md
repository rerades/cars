# Roles de agentes (borrador)

> Por definir al diseñar el harness de la factoría.

| Rol | Responsabilidad | Puede escribir en |
|---|---|---|
| Producto | Redactar y mantener PRD | `docs/product/` |
| Planificador | Trocear PRD `ready` en épica e historias | GitHub Issues |
| Researcher | Mantener el registro de fuentes y obtener datos de modelos, precios e imágenes | `data/`, `data/sources/` |
| Arquitecto | Proponer ADR y el modelo de datos | `docs/architecture/` |
| Desarrollador | Implementar historias | código, tests |
| Revisor / QA | Verificar la DoD y los CA | comentarios en PR |

Definiciones ejecutables de los agentes: `.claude/agents/`.
