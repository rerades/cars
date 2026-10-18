🏭 Veredicto: puede entrar. CI verde (el job `a11y` pasa con la prueba incluida) y cumple lo pedido en la tarea. SHA revisado: bbccf2794b710c271e54d622eeea81e8df9f0c37

**Criterios de aceptación** (no hay historia; he usado la tarea y RNF-2)
- LCP < 2500 ms en móvil 4G: cubierto. `web/e2e/lcp.spec.ts` aplica «Slow 4G» y CPU x4 por CDP, lee el LCP con `PerformanceObserver` (`buffered: true`) y falla si es ≥ 2500 ms. Lo lanza `playwright test` (`test:a11y`), así que entra en el job `a11y`.
- Páginas: portada, `/coches/`, `/coches/` con filtros, ficha con imagen y `/comparar/` con tres `?v=`. Las rutas salen de `loadModels`, no de una lista fija.
- Rankings (#378): dejado como TODO en el comentario de la prueba.
- Bitácora: explica la elección del throttling.
- Sin dependencias nuevas.

**Hallazgos (menores)**
1. `web/e2e/lcp.spec.ts`: si no hay ficha con imagen o hay menos de tres modelos comparables, la prueba se salta (`test.skip`) sin hacer ruido. Es aceptable, pero un dato que cambie puede dejar RNF-2 sin medir sin que nadie lo vea.
2. `FILTERS_QUERY = ?precio_max=60000` no está comprobado contra ADR-0015 por el agente. Existe en esa ADR, pero allí es el filtro de los rankings. Confirma que `/coches/` lo aplica. Si no, la prueba mide la página sin filtrar.

**Lo que no he podido comprobar**
- Que `a11y` solo informe y no bloquee: no he leído toda la configuración de la CI. Eso ya lo avisó el agente.
