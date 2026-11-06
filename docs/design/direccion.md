# Dirección visual

- **Estado:** en elección. Hay tres propuestas; la elige el responsable viendo sus capturas (ADR-0024). Al elegir, este
  fichero se queda con la ganadora y el motivo.
- **Fecha:** 2026-11-06

## El encargo del responsable

**Innovadora, sencilla, visual.** «Busco diseño por encima de todo y que los datos sean claros, sencillos de entender.»

**Lo que quiere de otras webs.** El Diseñador no tiene red, así que aquí está descrito lo que hay que coger de cada una,
comprobado en sus páginas el 2026-11-06:

| Web | Qué le gusta | En qué consiste |
|---|---|---|
| [Cupra Tavascan](https://www.cupra.com/es-es/coches/tavascan) | El menú inferior de secciones | Una píldora flotante, abajo y centrada, con las secciones de la página en texto corto. Siempre visible, marca dónde estás y no tapa el contenido principal |
| [Porsche Macan](https://www.porsche.com/spain/models/macan/macan-electric-models/macan-electric/) | Datos, fotografía, tipografía; números grandes animados | Un coche grande de perfil sobre el fondo, el nombre enorme, y datos en bloques: cifra grande y debajo una etiqueta pequeña y gris. Mucho aire, pocas tipografías |
| [Porsche Taycan](https://www.porsche.com/international/models/taycan/#modelRangeId=taycan) | Cómo ordena las fichas | Filtros a la izquierda y tarjetas claras de esquinas muy redondas sobre un fondo gris pálido. El coche, de perfil, sobresale por encima de la tarjeta. Dentro, pocas cifras apiladas, todas con el mismo patrón |
| [NIO](https://www.nio.com/) | Grandes fotografías por pantalla, información visual clara | Fotos que ocupan la pantalla entera con muy poco texto encima, y bloques que alternan claro y oscuro |
| [Polestar](https://www.polestar.com/global/) | Composición de modelos | Retícula de celdas separadas por líneas finas, sin sombras ni cajas. Cada celda: nombre, enlace con flecha y el coche de perfil sobre blanco. Titulares enormes con tipografía ajustada |

**Lo que no quiere ver**, en sus palabras: que no se parezca a [Car and Driver](https://www.caranddriver.com/) ni a
[km77](https://www.km77.com/). Eso es: portada de periódico, muchas noticias pequeñas con foto y titular en columnas
densas, muchos niveles de texto compitiendo, cajas de color de sección y cero aire.

**Se coge la idea, no la marca.** Nada de sus logotipos, nombres, fotos, colores de marca o textos: la web tiene que
tener identidad propia y no parecer una copia de ninguna de ellas.

## Lo que condiciona el diseño

1. **Las fotos de hoy son malas.** Vienen de Wikimedia Commons, tomadas en la calle y en ferias, con encuadres y fondos
   distintos. Algunos modelos no tienen foto. El responsable las mejorará, pero **el diseño tiene que quedar bien hoy,
   con estas**, y mejorar solo cuando lleguen otras. Una foto pésima a pantalla completa se ve peor que en pequeño.
2. **Los datos son reales** (ADR-0001). Faltan muchos: precio, segmento, potencia. El «por confirmar» forma parte del
   diseño: tiene que verse digno y no romper una cifra grande ni una retícula.
3. **Cada dato lleva su fuente y su fecha** (PRD-002, RF-9), y las fotos su atribución (ADR-0012). Se pueden hacer discretas,
   nunca quitarlas.
4. **Accesibilidad AA** (RNF-3): el contraste se calcula y las zonas táctiles miden al menos `--spacing-touch`.
5. **Un solo tema** (ADR-0005), sin selector. Se admiten **franjas oscuras** dentro de la página: son parte del tema, no un
   modo oscuro.
6. **Sin JavaScript nuevo en los prototipos.** Las capturas muestran el número final. La animación de cifras se añade al
   implementar (PRD-002, RF-18).
7. **Sin fotos de terceros ni datos inventados** para que quede bonito.

## Las tres propuestas

Cada una contesta de una forma distinta a la misma pregunta: **qué protagoniza la página si la foto es mala**. Tienen que
ser distintas de verdad en composición, no tres paletas sobre la misma maqueta.

### A · «Pantalla»: manda la imagen
NIO y Cupra. La foto a toda la pantalla, con el nombre encima, y franjas que alternan claro y oscuro. Es la más
espectacular y la que más sufre con las fotos de hoy: tiene que resolverlo con un tratamiento común (encuadre, degradado,
quizá un tono unificador) que iguale fotos muy distintas, y decir qué pasa si un modelo no tiene foto.
Fuente: **Manrope**.

### B · «Cifra»: manda el número
Porsche. El dato enorme es la imagen: autonomía y precio a tamaño de titular, la etiqueta pequeña debajo. La foto acompaña
a tamaño medio. La que menos depende de las fotos y la más cercana a «datos claros».
Fuente: **Archivo**, con su eje de anchura, para cifras muy anchas o muy estrechas.

### C · «Retícula»: manda la composición
Polestar y las tarjetas de Taycan. Celdas separadas por líneas finas, mucho blanco, titulares enormes y tipografía ajustada.
El coche va pequeño y siempre igual dentro de su celda, y la silueta de segmento es un elemento gráfico más: una ficha
sin foto no parece rota.
Fuente: **Instrument Sans**.

Las fuentes son OFL, descargadas el 2026-11-06 de [Fontsource](https://github.com/fontsource/font-files) y guardadas con su
licencia en `web/design-proto/fonts/`. Se declaran con `@font-face` y `url("./fonts/<fuente>.woff2")`. La elegida se muda a
`web/` y se mide con `web/e2e/lcp.spec.ts` (RNF-2); las otras se borran.

## Qué lleva cada propuesta

- **Prototipos:** `web/design-proto/catalogo-<letra>.astro` y `ficha-<letra>.astro`, sobre componentes y datos reales.
  - **Catálogo:** una cabecera, los filtros de forma estática y unas cuatro tarjetas: una con buena foto, una con mala foto,
    una sin foto y una sin precio o «Próximamente». Se copia del catálogo solo lo necesario.
  - **Ficha:** la parte de arriba (cabecera, foto, cifras clave), versiones y el menú inferior de secciones (PRD-002, RF-17).
    Se usa un modelo real con versiones y datos.
- **Capturas:** `node web/scripts/design-shot.ts`, y leerlas (`.claude/agents/designer.md`).
- **Nota:** `docs/design/propuesta-<letra>.md`, de menos de una pantalla: idea, qué se hace con las fotos malas, tokens que
  cambian y sus contrastes calculados, y lo que se pierde. Las capturas enlazadas para verlas en GitHub.

## Cómo se elige

Cada propuesta es una PR. El responsable las ve, elige o combina, y las demás se cierran sin fusionar. Después
`direccion.md` se queda con la elegida y se amplía `tokens.md`.
