🏭 Veredicto: hace falta una persona. Es una ADR en estado «propuesta» con gasto real de API, y las cifras y preguntas abiertas son decisión del usuario. No hay nada bloqueante en el contenido. SHA revisado: 20f338318850e717abb5063886ede9a429ee58c1

**Criterios de aceptación** (no hay historia; he revisado contra las 6 decisiones que pedía la tarea)
- (1) Datos de referencia: decidido (ficheros en `factory/datasets/reviewer/` y script idempotente por `id`).
- (2) Caso del Reviewer y cuántos: decidido (PR cerradas con etiqueta esperada, 20 casos con mínimos por etiqueta).
- (3) Ejecución: decidido (script con `gh` falso sobre instantáneas, un experimento por modelo y prompt vía atributos OTel).
- (4) Puntuación: decidido (código más juez LLM local, umbral frente a la línea base; `false_ok` = 0 bloquea).
- (5) Coste: decidido (clave de API aparte, bloque `evals:` en `budgets.yaml`, estimaciones).
- (6) Límites de Hobby: decidido, con lo que no consta dicho con claridad.
- Opciones con pros y contras, decisión y consecuencias, como ADR-0004: sí. `overview.md` actualizado y entrada en la bitácora: sí. No toca `factory/` ni `.claude/`: sí.

**Qué decide la persona**
1. Aceptar o no la ADR: `Estado: propuesta`. Si se acepta, hay que cambiar el estado y el texto de `overview.md` («propuesta» → «aceptada»).
2. Las cifras de gasto (15 USD por experimento, 40 al mes) y el límite del workspace de la Console.
3. Los modelos a comparar (Sonnet, Opus 5.5 y Haiku 5.5) y quién etiqueta los 20 primeros casos.

**Hallazgos**
1. Hay tres cosas que la propia ADR admite no tener comprobadas: la ruta REST para crear el dataset, si el experimento aparece solo con atributos OTel, y qué pasa al superar 50 000 unidades. Están declaradas en «Consecuencias», así que es aceptable. Conviene que quien implemente haga primero el caso de prueba que dice la ADR.
2. La estimación de coste (~6 USD con Sonnet) sale de un comentario de `budgets.yaml`, no de una medición. La propia ADR lo dice.

**Lo que no he podido comprobar**
- Las afirmaciones sobre la documentación de Langfuse (límites, API de datasets, atributos OTel) y los precios de Anthropic: no he abierto esas páginas. Quien acepte debe tomarlas como citadas por el agente, no como verificadas por mí.
