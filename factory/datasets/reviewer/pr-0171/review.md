🏭 Veredicto: el diseño responde a lo que pide #164 y la CI está en verde, pero enmienda una ADR aceptada (ADR-0001) y decide por su cuenta que no hace falta ADR nueva; esa decisión la tiene que confirmar una persona, y también las preguntas abiertas. SHA revisado: 33c6715d0531c0d9d19b537f9b77205949e466fa

**Criterios de aceptación** (la tarea de la cola y la issue #164)
- Decidir si basta `data-model.md` o hace falta enmendar ADR-0001/0008/ADR nueva: cubierto (sección 8.1). Basta `data-model.md` más una nota de enmienda de ruta en ADR-0001; ADR-0008 no se toca y no hay ADR-0014. Es la decisión que pide confirmar.
- Fijar en `data-model.md` la forma de cada fichero y adónde va el esquema de la cabecera: cubierto (8.2, tabla de claves y ejemplo ficticio).
- Decir si cambia la regla de ADR-0011: cubierto (8.5, no cambia; queda como pregunta).
- Dejar escrito qué cambia el Desarrollador y quién parte el registro, sin hacerlo: cubierto (8.4). Pide una sola PR para `evals.ts`, las pruebas y la partición, con la razón del orden.
- Actualizar las menciones a `registry.yaml` en `docs/architecture/`: cubierto. En `main` solo quedaban `data-model.md:42` y ADR-0001:10, y el diff cambia ambas. No he leído la rama entera.
- No tocar `data/`, `factory/` ni `.claude/`: cumplido, solo cambian `docs/`.
- Criterio de hecho de #164 (prueba de rebase sin conflicto, evals que detectan un `source_id` inexistente): corresponde a la PR del Desarrollador. Esta PR lo deja especificado en 8.3 y 8.4, salvo la prueba de dos ramas rebasadas, que no se menciona.

**Hallazgos**
1. (Decisión humana) `docs/architecture/adr/0001-fuentes-de-datos.md` se modifica, con una enmienda fechada, y `data-model.md` (estado `accepted`) gana una sección de 170 líneas. La issue deja la decisión «del Arquitecto o del responsable». Confirmad que una enmienda de ruta basta. Hay que aceptar también las cuatro preguntas de 8.7: endurecer el esquema, mover `candidatas.yaml`, registrar `autonomia-marcas` y la lista de rutas de ADR-0011.
2. `data-model.md`, 8.4: faltan en el plan de pruebas del Desarrollador la que pide #164, que dos ramas con fuentes distintas se rebasen sin conflicto (como `bitacora.test.ts`). Añadidla a la lista.
3. `data-model.md`, 8.6: la propia ADR advierte de que `candidatas.yaml` pasa a ser el nuevo punto de choque si el Researcher lo actualiza al dar de alta. Eso deja sin cumplir el objetivo de #164 hasta que se decida (pregunta 2 de 8.7). Conviene decidirlo antes de la PR del Desarrollador.
4. `data-model.md`, 8.6: borrar una fuente no lo detecta el eval hasta ADR-0010. Está dicho y asumido. No lo cuento como fallo.
5. Bitácora, alcance y dependencias: correctos. No hay dependencias nuevas ni datos de coches (el ejemplo es ficticio).

**Lo que no he podido comprobar**
- No he contrastado las líneas de `factory/evals.ts` (72 y 119) ni el recuento de 13 entradas del registro.
- No he comprobado que `gh`/GitHub no admita el driver `union` que la ADR descarta.
