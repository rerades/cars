🏭 Veredicto: hay que cambiar algo antes de que entre. El paso es correcto, pero falta la entrada de bitácora y la PR no explica cómo se comprobó el camino en rojo. Revisado el SHA e92912ffad2589e1159e01de58d35a23e780590e (CI en verde: test, web, changes; a11y omitido).

**Criterios de aceptación de la tarea** (no hay issue enlazado):
- Paso con node factory/validate-data.ts en el job test, después de pnpm install: cubierto. Está tras install, test y typecheck, y la CI del propio PR lo ejecuta en verde con los datos actuales.
- No cambiar los disparadores (pull_request y push a main): cubierto, el diff solo añade 3 líneas.
- No tocar factory/ ni data/: cubierto.
- Explicar cómo se comprobó que un error pone el paso en rojo: NO cubierto. El cuerpo de la PR no lo dice y el agente no lo ejecutó.
- Referenciar ADR-0010 y decir que cumple la condición (b) del punto 7 de ADR-0011: solo cubierto en un comentario del YAML, no en el cuerpo de la PR.
- Avisos como ::warning y resumen por marca sin poner la CI en rojo: no verificable aquí, depende del script. En esta CI el paso salió en verde.

**Hallazgos**
1. Falta la entrada de bitácora (obligatoria en CLAUDE.md y en la definición de hecho). El diff solo toca ci.yml y el agente dice que el hook se la bloqueó. Hay que añadirla (tipo hito, refs ADR-0010 y ADR-0011).
2. El cuerpo de la PR no documenta la comprobación en rojo que pedía el encargo (por ejemplo, el script en local sobre una copia con un source_id inventado), ni la condición (b) de ADR-0011. Sin eso nadie sabe que el paso falla cuando debe; la CI verde solo prueba el camino feliz.
3. Menor: el comentario del YAML está en inglés, correcto, pero cita «point 7 (b)» sin enlazar la ADR.

**Lo que no he podido comprobar:** que un error del validador ponga el paso en rojo, ni el resumen por marca en GITHUB_STEP_SUMMARY, porque la CI actual no contiene errores de datos.
