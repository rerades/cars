---
status: draft
updated: 2026-10-07
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
- ~~Base de datos y hosting.~~ → [ADR-0009](adr/0009-base-de-datos-y-hosting.md) (aceptada: sin base de datos aparte, los YAML de `data/raw/` bastan; el sitio se publica como static site de Render, en el workspace Hobby existente, con el dominio `siete3.com` y sin analítica ni cookies).
- ~~Pipeline de ingesta de datos de modelos (fuentes, frecuencia, validación).~~ → [ADR-0010](adr/0010-pipeline-de-ingesta.md) (aceptada el 2026-10-06: la CI valida todo `data/raw/` y el registro en cada PR y en `main` con las comprobaciones de `factory/evals.ts`; forma y procedencia bloquean, antigüedad de más de 45 días y fuentes rotas solo avisan; refresco mensual por marca. Validador implementado el 2026-10-08, `node factory/validate-data.ts`: con los datos actuales, 0 errores; el paso en la CI lo añade DevOps, en la cola).
- ~~Dónde se sirven las imágenes de los modelos y qué guarda el esquema para su atribución.~~ → [ADR-0012](adr/0012-imagenes-de-los-modelos.md) (aceptada: se descargan en la ingesta a `data/images/`, el build genera WebP y el visitante no pide nada a terceros; `images` pasa a `file`, `source_url` y `page_url`. La descarga la define la enmienda «Imágenes» de ADR-0010, aceptada el 2026-10-07: script determinista que lanza el Researcher, solo JPEG o PNG de ≤ 1280 px, migración por el Researcher y forma antigua de `images` admitida con aviso hasta migrar).
- ~~Cómo hace commit la factoría de la cola, la pausa y el registro de ejecuciones (#166).~~ → [ADR-0013](adr/0013-commit-del-estado-de-la-factoria.md) (aceptada el 2026-10-06: la factoría no reescribe la cola; consumir una tarea es una fila con su `id` en `ops/runs/`, commiteada en una única rama de estado `chore/factory-state` con su PR, de la que la factoría lee).
- ~~Cómo publican los agentes (CI/CD, entornos, merge automático o no).~~ → [ADR-0011](adr/0011-publicacion-de-los-agentes.md) (aceptada: el Revisor solo etiqueta el estado, `review:ok`, `review:changes`, `review:needs-human` o `review:error`; fusiona el orquestador sin modelo si la PR tiene `review:ok` ligada al SHA, CI en verde, sin conflictos y solo toca `data/raw/` o `docs/bitacora/`; Render despliega «After CI Checks Pass»; vistas previas manuales. Desactivada hasta que el Revisor etiquete con SHA, la CI valide el esquema y el sitio esté en Render).
