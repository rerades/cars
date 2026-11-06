---
id: VISION
status: draft
updated: 2026-11-06
---

# Visión del producto

## Qué es
Una web de referencia sobre **coches eléctricos**: marcas, modelos, especificaciones, reviews, comparativas, fichas de producto, catálogos y rankings.

## Para quién
Personas en Europa, con foco inicial en **España**, que están informándose sobre coches eléctricos o comparándolos antes de comprar.

## Mercado y cobertura
- Se incluye cualquier coche eléctrico **comercializado en Europa**, de marcas de todo el mundo.
- Se empieza por el mercado europeo, con prioridad en la disponibilidad en España.

## Principios
0. **Datos fiables:** priorizar siempre las fuentes oficiales de las marcas. Todo dato tiene su fuente y su fecha.
1. **Solo lectura para el visitante:** el visitante consume contenido y no escribe datos.
2. **Sin datos personales:** no se guardan datos personales de usuarios.
3. **Datos estructurados primero:** todo lo que se muestra sale de una base de datos con modelo definido, no de texto suelto.
4. **Construida por agentes:** el producto lo construye y lo mantiene una factoría de agentes autónomos. La documentación tiene que servirles como contrato.

## Prioridades actuales
Decisión del responsable (2026-11-06), con 82 modelos publicados de 26 marcas: los datos ya bastan como ejemplo y el esfuerzo pasa al desarrollo técnico.

1. **UX/UI primero.** Se empieza por la identidad visual, la base común (cabecera, navegación y pie) y la portada. Sus tareas van por delante en la cola.
2. **Descubrir antes que refrescar.** En datos, importan los modelos y las marcas nuevos. Que un precio cambie de un mes a otro no es prioritario, así que el refresco mensual deja de ser obligatorio (enmienda de ADR-0010, punto 6).

Descartado: dejar el Researcher solo en mantenimiento (se perderían modelos nuevos) y mantener el reparto actual (10 de las 15 ejecuciones de una noche y poca novedad en los datos).

## Qué NO es (por ahora)
- No hay cuentas de usuario, comentarios, foros ni contenido generado por usuarios.
- No es un marketplace ni vende coches.
- No es comercial: es una web personal y sin ánimo de lucro, sin publicidad ni monetización (decisión del responsable, 2026-10-10). Aun así es una web pública de información: una fuente cuyos términos excluyen el uso «con fines de información» no se puede usar (ADR-0001, regla 6).
- No hay newsletter ni formularios que recojan datos personales.

## Funcionalidades previstas
| Área | PRD |
|---|---|
| Catálogo de modelos | PRD-001 |
| Ficha de modelo | PRD-002 |
| Portada | PRD-004 |
| Comparador | PRD-003 |
| Rankings | PRD-005 |
| Reviews | PRD-006 |

## Preguntas abiertas
- ¿Idiomas? (¿solo español al inicio? ¿inglés después?)
- ~~¿Las reviews son propias (generadas o redactadas) o agregadas de terceros?~~ Resuelta (2026-10-18): enlaces a reviews de terceros y datos objetivos con fuente, sin contenido generado (PRD-006, sección 8).
