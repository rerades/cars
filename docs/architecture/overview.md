---
status: draft
updated: 2026-09-19
---

# Arquitectura — visión general

> Pendiente de decidir. Cada decisión se registra como ADR en `adr/`.

## Restricciones conocidas
- Web de solo lectura para el visitante, con base de datos de contenido.
- Sin datos personales de usuarios.
- SEO importante: renderizado en servidor o estático.

## Decisiones pendientes (→ ADR)
- Stack de frontend y framework.
- Base de datos y hosting.
- Pipeline de ingesta de datos de modelos (fuentes, frecuencia, validación).
- Cómo publican los agentes (CI/CD, entornos, merge automático o no).
