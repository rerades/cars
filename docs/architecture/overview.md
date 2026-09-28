---
status: draft
updated: 2026-09-28
---

# Arquitectura — visión general

> Pendiente de decidir. Cada decisión se registra como ADR en `adr/`.

## Restricciones conocidas
- Web de solo lectura para el visitante, con base de datos de contenido.
- Sin datos personales de usuarios.
- SEO importante: renderizado en servidor o estático.

## Decisiones pendientes (→ ADR)
- ~~Stack de frontend y framework.~~ → [ADR-0003](adr/0003-stack-frontend.md) (aceptada: Astro, sitio estático).
- ~~Sistema de diseño y librería de componentes.~~ → [ADR-0005](adr/0005-sistema-de-diseno.md) (aceptada: componentes `.astro` copiados de Bearnie, con Tailwind).
- ~~Comprobación de accesibilidad en la CI.~~ → [ADR-0006](adr/0006-accesibilidad-en-ci.md) (aceptada: axe-core con Playwright sobre el build; critical y serious ponen la CI en rojo, sin impedir el merge. No demuestra WCAG 2.1 AA).
- ~~Gestor de paquetes (npm, pnpm u otro).~~ → [ADR-0007](adr/0007-gestor-de-paquetes.md) (aceptada: pnpm, un lock por proyecto, sin workspaces).
- ~~Esquema de los YAML de `data/raw/`.~~ → [ADR-0008](adr/0008-esquema-unico-de-datos-raw.md) (aceptada el 2026-09-27: esquema único validado al escribir; referencia en [data-model.md](data-model.md). Puertos y adaptadores descartado por ahora).
- ~~Base de datos y hosting.~~ → [ADR-0009](adr/0009-base-de-datos-y-hosting.md) (propuesta: sin base de datos aparte, los YAML de `data/raw/` bastan; el sitio se publica en Cloudflare Pages, plan Free, con dominio propio y sin analítica ni cookies del proveedor).
- Pipeline de ingesta de datos de modelos (fuentes, frecuencia, validación). La comprobación automática del esquema de ADR-0008 y la migración de Cupra y Polestar son parte de esto y siguen pendientes.
- Cómo publican los agentes (CI/CD, entornos, merge automático o no).
