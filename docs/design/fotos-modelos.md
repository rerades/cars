# Fotos de los modelos

Qué foto vale para la tarjeta y cómo se retoca (PRD-001, RF-8 y RF-15; ADR-0025). El Researcher lo usa para
elegir qué descarga y el Retocador para aceptar o rechazar. Dónde va la foto en la tarjeta lo dice
[`tarjeta-modelo.md`](tarjeta-modelo.md) («Imagen y silueta»).

## Qué foto se busca

Por orden de importancia. Una foto que no cumple las cuatro primeras se rechaza.

1. **El modelo y la generación que se venden hoy.** No una versión anterior, un prototipo ni un modelo
   parecido de la marca. Si la carrocería cambia entre versiones (Cabrio, Sportback), vale la de la
   primera versión de `versions`.
2. **El coche entero.** Ni cortado por un borde, ni tapado por personas, postes, carteles u otros coches
   delante de él.
3. **Nada pegado al coche.** Sin rotulación de concesionario o de flota, pegatinas de precio u oferta,
   carteles de feria apoyados en él, QR, ni puertas o maletero abiertos.
4. **Licencia de RF-8.** CC0, CC BY, CC BY-SA o dominio público, sin `ND`.
5. **Tres cuartos delantero**, con el morro a la derecha o a la izquierda, desde la altura de una persona.
   Si no hay, lateral. Nunca trasera, interior ni detalle.
6. **Nítida y bien expuesta.** Sin desenfoque de movimiento, sin zonas quemadas en la carrocería y sin
   sombras duras que partan el coche.
7. **Un color que represente al modelo.** Ante la duda, el de su publicidad, no el negro ni el gris
   oscuro: sobre fondo liso pierden la forma (el Mobilize Duo negro de la prueba perdía su naranja).
8. **Más de 2000 px de ancho.** Se reduce a 1280 px; con menos, el recorte se nota en los bordes.

El fondo no importa: se quita. Una foto preciosa en una feria vale más que una mediocre en estudio.

## Causas de rechazo

El Retocador anota el motivo en `open_questions` con una de estas causas, para que la siguiente tarea del
Researcher sepa qué buscar:

| Causa | Cuándo |
|---|---|
| `modelo` | No es el modelo o la generación actual (punto 1) |
| `cortado` | El coche toca un borde o algo lo tapa (punto 2; el script también falla) |
| `pegado` | Rotulación, pegatinas, carteles, QR o puertas abiertas (punto 3) |
| `angulo` | Trasera, interior o detalle (punto 5) |
| `calidad` | Desenfocada, quemada, oscura o con poco tamaño (puntos 6 y 8) |
| `recorte` | La máscara deja fondo pegado o corta parte del coche (retrovisor, antena, rueda) |
| `matricula` | Queda una matrícula legible después del script |

## Cómo se retoca

Lo hace `factory/retouch-image.ts` (ADR-0025). El agente no edita píxeles.

- **Se quita el fondo:** el coche queda sobre transparente. El color del fondo lo pone la tarjeta.
- **Se añade una sombra de apoyo** semitransparente bajo las ruedas, para que el coche no flote.
- **Se tapa la matrícula** con un rectángulo liso.
- **No se toca nada más del coche:** ni color, ni brillo, ni reflejos, ni ruido. Lo que se ve a través de
  los cristales también se queda: es parte de la foto del coche.

## Referencia

La prueba del 2026-11-06 con cinco modelos (antes, foto mejor elegida, fondo difuminado y fondo limpio) está
descrita en ADR-0025, «Contexto». Sus imágenes no se guardaron en el repositorio; las del piloto irán en la
PR del Retocador.
