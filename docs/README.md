# Documentación — Web de coches eléctricos (Dark Factory)

Este directorio es la **fuente de verdad** del producto. Lo leen y lo escriben tanto personas como agentes.

## Orden de lectura para un agente

1. `product/vision.md`: qué es el producto y qué NO es.
2. `product/glossary.md`: vocabulario del dominio.
3. `process/workflow.md`: cómo se trabaja (PRD → historias → PR).
4. `process/definition-of-done.md`: cuándo algo está terminado.
5. El PRD asignado en `product/prd/` y sus `depends_on`.
6. `architecture/` y las ADR relevantes antes de tocar código.

## Mapa

| Carpeta | Contenido |
|---|---|
| `product/vision.md` | Propósito, público, mercado, principios, no-objetivos |
| `product/glossary.md` | Términos del dominio |
| `product/prd/` | Un PRD por funcionalidad (`PRD-NNN-slug.md`) |
| `architecture/` | Visión técnica, modelo de datos, ADR |
| `process/` | Flujo de trabajo, definición de terminado, roles de agentes |

## Índice de PRD

| ID | Título | Estado | Depende de |
|---|---|---|---|
| PRD-001 | Catálogo de modelos | draft | — |

## Agentes

- Definiciones en `.claude/agents/`. Roles en `process/agents.md`.
- `researcher`: fuentes y datos (ADR-0001).
- Presupuesto, permisos y observabilidad: ADR-0002, `factory/budgets.yaml`, `ops/`.
- Trazas y autoevaluaciones de los agentes: ADR-0004, `factory/evals.ts`, `ops/traces/`.

## Convenciones

- Cada PRD lleva frontmatter YAML con `id`, `status`, `priority`, `depends_on`, `epic`.
- Estados: `draft` → `ready` → `in-progress` → `done` (o `deprecated`).
- Requisitos `RF-n`, no funcionales `RNF-n`, criterios de aceptación `CA-n`. Cada issue y cada PR cita los que cubre.
- Las épicas y las historias viven en GitHub Issues. El PRD enlaza su épica.
- Idioma de la documentación: español.
