🏭 Veredicto: casi listo; solo falta que el cuerpo de la PR diga «Closes #150» y enumere RF-5, RF-6, CA-5 y CA-6 (la tarea lo exigía y el cuerpo actual no lo contiene). Código y pruebas bien. SHA revisado: 0d3d01136dfa01e50f5736ed1caabc07bc643de3. CI: test, web, changes, a11y en verde.

**Criterios de aceptación**
- CA-5 (versiones con wltp_km): cubierto. `ficha-versiones-datos.test.ts` comprueba 470/520/490 km sobre el HTML construido.
- CA-5 (sin wltp_km en versiones, con specs.wltp_max_km): cubierto. La prueba «NoRange» exige «por confirmar» en cada versión, que 557 no salga en el bloque de versiones y que aparezca como «Autonomía WLTP máxima del modelo 557 km». El caso «OneRange» confirma que no rellena a las demás.
- CA-6 (basis gross): cubierto («80 kWh, bruta»; también útil y sin especificar, y decimales 77,5).
- CA-6 (sin dc_max_kw): cubierto: «por confirmar» sin enlace de fuente ni «Fuente».

**Hallazgos**
1. Cuerpo de la PR: añadir «Closes #150» y la lista de RF/CA cubiertos. Sin eso la historia no se cierra sola.
2. Menor, `[modelo].astro`: `fieldsOf(version)` se recalcula por celda y fila (`fieldsOf(version)[i]`); basta calcularlo una vez por versión. No bloquea.

Bien resuelto: orden de filas y etiquetas contra «Campos y formato» verificado por prueba; sin campos fuera de data-model.md; bitácora presente; sin dependencias nuevas.

**No he comprobado**: render en navegador (cambio tabla/bloques); la CI de a11y está en verde pero no la he ejecutado.
