# ADR-0020 — Verificador de datos independiente

- **Estado:** aceptada (2026-10-26). Enmienda el punto 14 de ADR-0011: el verificador es una regla más de la fusión.
- **Fecha:** 2026-10-26

## Contexto
PRD-007 RF-8 pide que, para cada PR de datos, alguien que no escribió el dato vuelva a leer una
muestra de los valores nuevos o cambiados contra su `url` y compruebe que están en la página. Si un
valor no coincide, la PR recibe `merger:needs-human` con el valor, la URL y lo que se encontró
(CA-10: un precio que no aparece en su `url` impide la fusión). OPEN-2 deja tres preguntas: código
sin modelo o agente, tamaño de la muestra y qué hacer con las páginas que solo pintan los precios con
JavaScript. Además:

- **RNF-1 de PRD-007:** sin modelo donde baste el código, y sin servicios externos nuevos.
- **RNF-3:** ningún agente escribe en `factory/`; el código lo escribe una persona.
- **RNF-4:** cada decisión automática deja rastro en `ops/` o en un comentario de la PR.
- **ADR-0011, puntos 2, 4 y 14:** la fusión automática (`factory/merge.ts`, `run.ts --merge`) es
  código sin modelo, comprueba reglas sobre la cabeza revisada y es **la única** que pone
  `merger:needs-human`, siempre sobre una PR con `review:ok`, comentando qué regla falló.
- **ADR-0019:** la puerta corre antes de abrir la PR y un fallo deja la ejecución en `eval_failed`
  sin PR. RF-8 no pide eso: pide una etiqueta en una PR que ya existe.
- **ADR-0004:** los evals deterministas de `factory/evals.ts` miran la salida del agente (rutas,
  forma), no la página de origen.
- **ADR-0001:** solo se leen fuentes registradas. `factory/fetch-page.ts` ya lo hace: abre solo hosts
  de `data/sources/*.yaml` (y subdominios), respeta `robots.txt` con el agente `siete3-factory`,
  rechaza una redirección a un host no registrado y convierte el HTML en párrafos de texto visible
  (`htmlToText`), quitando `<script>`, `<style>`, `<template>`, etc. Su cabecera ya avisa de que el
  texto que pintan los scripts (configuradores) no aparece.
- **PRD-007 RF-11:** `factory/check-urls.ts` (comprobación semanal) también descarga las URL de
  `data/` y clasifica las respuestas en rota (404, 410, host que no resuelve) y no comprobable (401,
  403, 429, 5xx, tiempo agotado, `robots.txt`). Importa `robotsAllows` y `USER_AGENT` de
  `fetch-page.ts`.
- **El modelo de datos** (`docs/architecture/data-model.md`): cada valor con fuente es un `Sourced`
  con `value`, `source_id`, `url`, `retrieved` y `tier`; los precios `financed` llevan además
  `price_terms` (texto literal) y `price_terms_url`. Muchos `value` son enumeraciones nuestras
  (`status: on_sale`, `segment: suv_compacto`, `drivetrain: awd`) o fechas normalizadas
  (`launch: "2025-03"`) que la página no escribe así.
- **Lo que ya ocurre:** la bitácora del Researcher recoge páginas que solo sirven el cascarón sin
  precios con `fetch-page.ts` (es.smart.com, 2026-10-23 y 24; volkswagen.es, 2026-10-22; ferrari.com,
  2026-10-20; mobilize, 2026-10-19).

## Opciones consideradas

### 1. Quién verifica
- **A. Un agente nuevo con modelo (WebFetch o `fetch-page.ts`).** Descartada. Va contra RNF-1, que
  pide código donde baste, y gasta del presupuesto de ADR-0002 en cada PR de datos. Con WebFetch
  devuelve un resumen hecho por un modelo, no el texto literal (es la razón de ser de
  `fetch-page.ts`), así que su «sí, está» no es una prueba que se pueda enseñar en la PR. Y lo que
  sabe hacer un modelo aquí —reconocer «77 kWh» en «77,0 kWh de capacidad útil»— también lo hace una
  normalización de números.
- **B. Código primero y un agente solo para los valores no encontrados.** Descartada por ahora. Es
  justo el caso en que el código ya tiene una respuesta clara (el valor no está en el texto servido),
  y un modelo que «lo encuentre» donde el código no lo ve, en una página sin el texto, sería una
  afirmación sin evidencia. Si los datos de RF-1 muestran muchas escaladas falsas, se puede reabrir
  en otra ADR.
- **C. Código sin modelo.** Elegida: descargar la página con las reglas de `fetch-page.ts` y buscar el
  valor normalizado en el texto visible.

### 2. Dónde corre
- **A. En la puerta de ADR-0019, antes de abrir la PR.** Descartada. RF-8 y CA-10 piden una
  etiqueta en la PR, no `eval_failed`; con la puerta el trabajo del agente se pierde y la persona no
  ve qué valor falló en ninguna PR. Además, la puerta corre dentro de la ejecución del agente que
  escribió el dato.
- **B. Un job de la CI de GitHub Actions.** Descartada. `merger:needs-human` solo la pone la fusión
  (ADR-0011, punto 14), y la CI corre en cada empuje, así que se descargarían las mismas páginas de
  terceros varias veces por PR.
- **C. Un paso propio con su LaunchAgent.** Descartada: otro horario que coordinar con el Revisor y la
  fusión para hacer lo mismo que una regla más de la fusión.
- **D. Una regla más de la fusión (`merge.ts`), la última.** Elegida. Ya trabaja sobre la cabeza
  revisada, ya pone `merger:needs-human` con un comentario y ya es código sin modelo.

### 3. Tamaño de la muestra
- **A. Todos los valores verificables.** Descartada como regla fija: una PR de alta de marca puede
  citar muchas URL, y con una petición por segundo y host (la cortesía de RF-11) la pasada de la
  fusión se alarga sin tope.
- **B. Un número fijo de valores al azar.** Descartada: descargar una página cuesta lo mismo para un
  valor que para diez, así que contar valores desperdicia peticiones. Y al azar no es repetible: dos
  pasadas sobre la misma cabeza darían muestras distintas.
- **C. Por URL distinta, con tope, y todos los valores verificables de cada URL descargada.**
  Elegida.

### 4. Páginas que solo pintan los valores con JavaScript
- **A. Un navegador sin cabeza (Playwright, que ya está en `web/` para ADR-0006).** Descartada.
  Ejecuta el JavaScript de terceros en la máquina de la factoría, multiplica las peticiones por
  página (un configurador pide muchos recursos) y verifica algo que el Researcher no pudo leer con
  `fetch-page.ts`. Sería otra ADR, con su análisis de riesgo.
- **B. Buscar también dentro de los `<script>` (JSON incrustado).** Descartada. Un número suelto en un
  JSON de configurador puede ser cualquier cosa (un id, otra versión, un precio con ayudas), así que
  daría por buenos valores que nadie ha visto, y ese texto tampoco lo lee el Researcher.
- **C. Tratar «no está en el texto servido» como no comprobable y dejar pasar la PR.** Descartada: no
  se distingue con fiabilidad una página de solo JavaScript de una página legible donde el valor
  simplemente no está, que es el caso exacto de CA-10. Dejarla pasar hace que el verificador no
  vea el error que más importa.
- **D. Mismo trato que cualquier valor no encontrado: `merger:needs-human`, con un aviso de que la
  página puede pintarlo con JavaScript.** Elegida.

### 5. Código compartido con RF-11
- **A. Un solo script para las dos cosas.** Descartada. Corren en sitios distintos (la fusión en el
  Mac de la factoría; RF-11 en un workflow semanal), sobre conjuntos distintos (el diff de una PR;
  todas las URL de `data/`), y RF-11 mira solo el código HTTP, no el texto. RF-11 tampoco limita a
  hosts registrados, porque comprueba también las `urls` del propio registro.
- **B. Nada compartido.** Descartada: repetiría el agente, `robots.txt` y la extracción de texto, y
  las dos comprobaciones dirían cosas distintas de la misma página.
- **C. Compartir las piezas.** Elegida (ver Decisión).

## Decisión
**El verificador de RF-8 es código sin modelo: una regla más, la última, de la fusión automática
(`merge.ts`), que para cada PR de datos descarga con las reglas de `fetch-page.ts` hasta 10 URL
distintas de los valores nuevos o cambiados, busca cada valor verificable en el texto visible de la
página y, si alguno no está, pone `merger:needs-human` con el valor, la URL y lo encontrado.**

**Cuándo corre.** Solo sobre una PR `agent/*` que toca `data/raw/` y que ya cumple **todas** las demás
reglas del punto 2 de ADR-0011 (con `review:ok`, la cabeza revisada, CI en verde, rutas permitidas,
sin `factory/STOP`). Así no se descarga nada para una PR que de todos modos va a una persona, y
`merger:needs-human` sigue implicando el ok del Revisor (punto 14). Lo hace código que no escribió el
dato, que es lo que pide RF-8. Una PR ya marcada no se vuelve a verificar: la fusión la salta por la
etiqueta, como hoy.

**Qué valores entran.** Se comparan los YAML de `data/raw/` de la base de la PR (merge-base con
`main`) y de la cabeza revisada. Un valor entra si es un `Sourced` (o un `test_results`) nuevo, o si
cambió su `value` o su `url`. Para un precio `financed` entra también `price_terms` si es nuevo o
cambió, contra su `price_terms_url`. Se clasifican así:

- **Número** (precios, kWh, km, kW…): verificable.
- **`price_terms`**: verificable, como texto literal.
- **Enumeraciones, fechas normalizadas y booleanos** (`status`, `segment`, `drivetrain`, `launch`…):
  no verificables por código. No entran en la muestra, no bloquean y se listan en el comentario como
  «no verificables por código».

**Cómo se busca.**
- **Números:** se generan las grafías habituales en España y en la web de la marca: sin separador
  (`39990`), con punto de miles (`39.990`), con espacio, espacio fino o no separable de miles
  (`39 990`), y para decimales con coma y con punto, con y sin ceros finales (`77,4`, `77.4`; `77`,
  `77,0`). Una coincidencia vale solo si no la rodean otras cifras (para que `399` no case dentro de
  `39990`). No se exige la unidad.
- **`price_terms`:** se colapsan los espacios en los dos lados y se busca la cadena entera,
  distinguiendo mayúsculas. Es la regla de copia literal que el Researcher ya cumple con
  `fetch-page.ts`.
- **Dónde:** en el texto visible completo que da `htmlToText`, sin el recorte de `MAX_TEXT`, que es
  para la salida del Researcher, no para buscar.

**La muestra.** Se agrupan los valores verificables por URL. Si hay 10 o menos URL distintas, entran
todas; si hay más, entran 10, primero las que citan un precio o un `price_terms` (el caso de CA-10),
y dentro de cada grupo por orden alfabético de la URL, para que dos pasadas sobre la misma cabeza
elijan las mismas. De cada URL descargada se comprueban **todos** sus valores verificables. Las URL
que quedan fuera se listan como «fuera de la muestra». El 10 no está medido: es un tope de partida
que se revisa con los datos de RF-1.

**Resultado por URL.**
- **Encontrado:** todos sus valores están en el texto.
- **No coincide:** la página responde 200 y algún valor no está. Bloquea.
- **Rota:** 404, 410 o host que no resuelve (la clasificación de RF-11). Bloquea: un valor nuevo que
  cita una página inexistente no tiene fuente.
- **Rechazada por las reglas de `fetch-page.ts`:** host no registrado o redirección fuera del
  registro. Bloquea: un valor de una fuente fuera del registro va contra ADR-0001.
- **No comprobable:** 401, 403, 429, 5xx, tiempo agotado o `robots.txt` lo prohíbe (la misma
  clasificación de RF-11). No bloquea y se lista.

**Páginas de solo JavaScript (OPEN-2).** No hay trato especial: si la página responde 200 y el valor
no está en su texto visible, es «no coincide» y va a una persona. El comentario añade la longitud del
texto servido y la frase «si la página pinta el valor con JavaScript, no está en el HTML; compruébalo
en el navegador». Un valor que el código no puede ver es un valor que nadie ha comprobado sin
persona.

**Qué deja.**
- Si bloquea: `merger:needs-human` y el comentario de la fusión (ADR-0011, punto 4) con la regla
  «verificador de datos (RF-8)», y por cada valor que no coincide, el fichero, la ruta del campo, el
  valor, la URL, el código HTTP y los fragmentos de texto más parecidos que se encontraron (hasta 3
  párrafos que contengan alguna cifra del valor, o «ninguno»). Debajo, lo no comprobable, lo no
  verificable por código y lo que quedó fuera de la muestra.
- Si fusiona: el comentario de condiciones del punto 3 de ADR-0011 añade el resumen del verificador
  (URL comprobadas, valores encontrados, no comprobables, fuera de la muestra), y la línea de
  `ops/merges/YYYY-MM.jsonl` gana un campo `verify` con esas cifras. Así RF-1 podrá contar cuántas
  fusiones se verificaron de verdad (RNF-4).

**Cortesía.** El mismo agente y `robots.txt` que `fetch-page.ts`, como mucho una petición por segundo
y host, y tiempo agotado de 20 s por petición, como `check-urls.ts`.

**Código compartido con RF-11.** No es el mismo script, pero comparten piezas:
- de `fetch-page.ts`: `USER_AGENT`, `robotsAllows`, `registeredHosts`, `hostAllowed` y `htmlToText`.
  Se extrae de `fetchPage` una función que devuelve la respuesta y el texto completo, que usan
  `fetchPage` (para el Researcher, con su recorte) y el verificador;
- de `check-urls.ts`: `classify`, para que «rota» y «no comprobable» signifiquen lo mismo en las dos
  comprobaciones. El espaciado por host se mueve a una función común.

No comparten caché ni resultados: la comprobación semanal no lee lo que encontró el verificador ni al
revés.

**Quién lo escribe.** Una persona, porque está en `factory/` (RNF-3), con pruebas en `factory/tests/`
con un `fetch` falso: CA-10 (un precio que no está en la página da `merger:needs-human` con ese
valor y su URL, y la PR no se fusiona), una página que lo tiene con otra grafía (`39.990 €`), un 403
que no bloquea y un `robots.txt` que lo prohíbe.

## Consecuencias
- **Bueno:** cumple RNF-1: no gasta modelo ni presupuesto de ADR-0002, y su resultado es
  reproducible y se puede enseñar (el valor, la URL y el texto).
- **Bueno:** no añade etiquetas, horarios ni servicios. Encaja en la regla de etiquetas de ADR-0011,
  punto 14, y en su comentario de condiciones.
- **Bueno:** una sola definición de «rota» y «no comprobable» para RF-8 y RF-11, y una sola forma de
  leer una página para el Researcher y el verificador. Si el verificador no ve un valor, el
  Researcher con `fetch-page.ts` tampoco lo vería.
- **Malo: las fuentes de solo JavaScript irán siempre a una persona.** Con la bitácora de octubre
  (smart, Volkswagen, Mobilize, Ferrari) son varias marcas. Si el Researcher cita valores de esas
  páginas, esas PR dejan de fusionarse solas, y eso empuja hacia abajo la métrica de PRD-007 de
  «≥ 50 % sin intervención humana». No sé cuántas PR serán: hay que medirlo con RF-1 tras las
  primeras semanas.
- **Malo: un 403 o un `robots.txt` que prohíbe no bloquea**, así que una PR cuyas URL son todas no
  comprobables se fusiona con cero valores verificados, igual que hoy. El comentario y el campo
  `verify` lo dicen, pero nada lo impide. Si se quiere que «0 comprobados» vaya a una persona, es un
  cambio de una línea, pero hay que decidirlo.
- **Malo: los valores que no son números ni `price_terms` no se verifican** (`status`, `segment`,
  `drivetrain`, `launch`). Son una parte de lo que escribe el Researcher, y RF-8 no los cubre con
  esta decisión.
- **Malo: falsos positivos y negativos de la búsqueda de números.** Un `0` o un `5` casan en casi
  cualquier página, y un precio casa si aparece en otra versión de la misma página. La regla prueba
  que el valor está en la página, no que esté junto a la versión correcta. Un valor que el
  Researcher redondeó o convirtió (la página dice `39.900` y el YAML `39990`, o da la batería en
  Wh) da un «no coincide» que tendrá que mirar una persona.
- **Malo: la pasada de la fusión se alarga y pide páginas a terceros.** Con el tope de 10 URL y una
  petición por segundo y host, unas decenas de segundos por PR de datos; no lo he medido. Una caída
  pasajera de la web de una marca deja el valor como no comprobable para siempre en esa PR, porque
  no se reintenta otra noche.
- **Malo: la página puede haber cambiado entre la ejecución del Researcher y la fusión** (una oferta
  que termina a medianoche). Saldrá «no coincide» aunque el dato fuera cierto al leerlo. Es raro con
  una noche de diferencia, pero ocurrirá con las ofertas.
- **Malo: hay que tocar `fetch-page.ts` y `check-urls.ts`** para extraer las piezas comunes. Lo hace
  una persona, con sus pruebas, y puede romper al Researcher si cambia la salida de `fetchPage`: la
  salida JSON del script no debe cambiar.

**Preguntas abiertas (no se deciden aquí):**
- ~~¿Una PR de datos en la que no se pudo comprobar **ningún** valor debe ir a una persona?~~
  Resuelta al aceptar (2026-10-26): no. Se fusiona como hoy, el comentario y el campo `verify` lo
  dicen, y se revisa con los datos de RF-1.
- ¿Debe el registro marcar las fuentes de solo JavaScript (un campo en `data/sources/`) para que el
  Researcher no las use como `url` de valores, o para que el verificador las trate distinto? Sería
  una enmienda de ADR-0001 y del modelo de datos. Sigue abierta al aceptar (2026-10-26): se decide
  cuando RF-1 diga cuántas PR van a una persona por esas páginas.
- ¿Se verifican también las PR de datos que no son del Researcher, o las fusionadas a mano? Con esta
  decisión solo las que la fusión automática iba a fusionar.
- El tope de 10 URL y el tiempo que añade a la pasada se revisan con los datos de RF-1.
