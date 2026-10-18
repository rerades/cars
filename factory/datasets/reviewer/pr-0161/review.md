🏭 Veredicto: no puede entrar sin que una persona elija entre esta PR y la #139, que resuelven la misma tarea (siluetas de segmento, RF-8/CA-17) de dos formas incompatibles. Revisado el SHA 7ca7e97ae5137d5c15e8f213d95a2bc02af57cc9. CI en verde (test, web).

**Criterios de aceptación** (tarea de diseño; no hay CA con prueba automática)
- RF-8 / CA-17 (silueta cuando no hay imagen con licencia): especificado, 11 siluetas con tabla de rasgos y SVG de referencia. Cubierto solo como especificación.
- 11 siluetas, mismo viewBox, trazo y currentColor, aria-hidden, sin texto ni marca: cumplido en las reglas comunes y en los 11 bloques SVG.
- Enlace desde tarjeta-modelo.md y tokens.md: hecho. Sin token nuevo, justificado.

**Hallazgos**
1. **Duplicado con #139** (docs/design/siluetas-segmento.md aquí; docs/design/siluetas/*.svg allí). Ambas tocan las mismas líneas de tarjeta-modelo.md y tokens.md, así que la segunda en entrar chocará. Hay que decidir cuál se queda y cerrar la otra. Es una decisión de proceso, no de un agente.
2. Los trazados están calculados a mano y el propio documento dice que no se han visto renderizados. No he podido comprobar que las 11 se distingan a 48 px (monovolumen frente a SUV compacto, genérica frente a compacto).
3. Menor: el contraste de 4,4 se cita de tokens.md y no lo he recalculado. Es decorativa, no afecta.

Bien resuelto: SVG en línea con currentColor, y explica por qué no usar img.

**Lo que no he podido comprobar**: el aspecto real de los dibujos y el valor de contraste.
