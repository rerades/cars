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
- ~~Stack de frontend y framework.~~ → [ADR-0003](adr/0003-stack-frontend.md) (propuesta: Astro, sitio estático).
- ~~Sistema de diseño y librería de componentes.~~ → [ADR-0005](adr/0005-sistema-de-diseno.md) (propuesta: componentes `.astro` copiados de Bearnie, con Tailwind).
- ~~Comprobación de accesibilidad en la CI.~~ → [ADR-0006](adr/0006-accesibilidad-en-ci.md) (propuesta: axe-core con Playwright sobre el build; bloquean critical y serious. No demuestra WCAG 2.1 AA).
- ~~Gestor de paquetes (npm, pnpm u otro).~~ → [ADR-0007](adr/0007-gestor-de-paquetes.md) (propuesta: seguir con npm, un lock por proyecto, sin workspaces; pnpm queda descartado por ahora por el coste en guardas y CI).
- Base de datos y hosting.
- Pipeline de ingesta de datos de modelos (fuentes, frecuencia, validación).
- Cómo publican los agentes (CI/CD, entornos, merge automático o no).
