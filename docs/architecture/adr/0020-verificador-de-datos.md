# ADR-0020 — Verificador de datos independiente

- **Estado:** aceptada (2026-10-26). Enmienda el punto 14 de ADR-0011: el verificador es una regla más de la fusión.
  Enmienda «Versión y unidad» (precio junto al nombre de su versión; unidad para números de una o
  dos cifras): aceptada (2026-10-27).
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

**Valores de una consulta (añadido al implementar, 2026-10-27, decisión del responsable).** La `url`
de los valores de IDAE (`idae-es`) es la del buscador, `https://coches.idae.es/base-datos/marca-y-modelo`:
los datos salen de una consulta POST que hace `factory/fetch-idae.ts` y nunca están en esa página. El
verificador trata esa URL como **no comprobable** («datos de una consulta de fetch-idae.ts»), sin
descargarla: no bloquea y se lista. Sin esto, toda PR que tocara uno de sus 764 valores (87 fichas)
iría a una persona. Repetir la consulta de IDAE para comprobarlos queda como mejora.

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

### Versión y unidad (enmienda del 2026-10-27, aceptada)

**El precio de una versión cuenta como encontrado solo si aparece bajo el nombre de esa versión, y
solo bloquea si aparece únicamente bajo el nombre de otra versión del mismo fichero. Los números de
una o dos cifras solo cuentan como encontrados si llevan su unidad, y sin ella no bloquean. `price_terms`
no cambia.**

Contexto propio de la enmienda. La regla de «Cómo se busca» da por bueno un número si aparece en
cualquier parte del texto visible (lo dice la propia ADR en Consecuencias). Eso deja dos huecos frente
a RF-8 («comprueba que el valor está en la página») y CA-10:
- **Un precio de otra versión de la misma página casa.** Si el Researcher copia la fila equivocada
  de una tabla de precios, el número sí está en la página y el verificador lo da por bueno. Es el
  error más probable en un precio y el que CA-10 quiere parar.
- **Un número de una o dos cifras casa casi siempre.** `11` (kW en alterna) o `77` (kWh) aparecen en
  casi cualquier página por fechas, notas al pie o menús.

Lo que condiciona la solución:
- **Los párrafos de `htmlToText`** (`factory/fetch-page.ts`, leído el 2026-10-27): corta párrafo en
  `p`, `div`, `br`, `li`, `h1`–`h6`, `tr`, `table`, `section`, `dt`, `dd` y otros bloques, pero
  **no en `td`, `th` ni `span`**. Una fila de tabla sale en un solo párrafo («Volta 60 470 km 39.990 €»);
  la cabecera de una tabla con una versión por columna, también («Volta 60 Volta 80 AWD»); una tarjeta
  sale en varios párrafos seguidos (el nombre en su `h3`, el precio dos o tres párrafos más abajo).
- **El `name` de la versión no es texto literal de la página.** El modelo de datos solo exige que sea
  texto único dentro del fichero (data-model.md, sección 4). La página puede no repetirlo, o
  escribirlo de otra forma.
- **Muchos valores no son de una versión** (`specs.*`, `status`, `launch`), y un precio `financed`
  tiene además `price_terms`, que es una cadena literal larga que ya contiene el importe.
- **RNF-1:** sin modelo. **Métrica de PRD-007, sección 2:** «PR de agente fusionadas sin intervención
  humana ≥ 50 %» (hoy, 23 de 111, 21 %). Cada «no coincide» falso es una PR de datos menos que se
  fusiona sola.

#### Opciones consideradas (enmienda)

**1. Precio y versión.**
- **A. Como hasta ahora: en cualquier parte de la página.** Descartada. Falso positivo: el precio de
  otra versión de la misma página. Ningún falso negativo nuevo y ningún efecto en la métrica, pero no
  cubre el error que CA-10 describe.
- **B. Mismo párrafo que el nombre de la versión; si la página no lo repite ahí, «no coincide».**
  Descartada. Solo funciona con tablas por filas. En una tarjeta el nombre y el precio están en
  párrafos distintos, en una tabla por columnas el nombre está en la cabecera, y si el `name` del YAML
  no es el de la página no aparece nunca: todo eso iría a una persona. Es la opción que más baja la
  métrica y los bloqueos que añade serían, en su mayoría, falsos.
- **C. A una distancia fija (±N párrafos) del nombre; si la página no lo repite, «no coincide».**
  Descartada. Arregla las tarjetas, pero en dos tarjetas seguidas el precio de la primera queda a la
  misma distancia, o menos, del nombre de la segunda (que viene justo debajo) que del suyo. Y deja
  igual que B el caso de la página que no repite el nombre: falsos negativos y PR a una persona.
- **D. Bajo el nombre: el precio pertenece al nombre de versión que tiene en su párrafo o, si no, al
  último nombre de versión que aparece antes, a 3 párrafos como mucho. Solo bloquea si la página
  pone el precio bajo otra versión y nunca bajo la suya; si no hay nombre cerca, no bloquea.**
  Elegida. Lee bien filas, tarjetas y cabeceras de columna (empate: no bloquea) y solo bloquea con una
  prueba que se puede enseñar en la PR (el párrafo y el nombre de la otra versión). Falsos positivos
  que quedan: el precio de otra versión en una página que no nombra ninguna versión, o en una tabla por
  columnas. Falsos negativos nuevos: una maqueta con el precio **encima** del nombre, o una página que
  nombra la versión de otra forma que el YAML y tiene el nombre de otra versión justo antes. Efecto en
  la métrica: solo bloquea cuando hay una prueba de que el precio está bajo otra versión, que en su
  mayoría serán errores de verdad. No lo he medido.

**2. Números de una o dos cifras.**
- **A. Como hasta ahora.** Descartada: casan casi siempre, así que «encontrado» no dice nada, y el
  campo `verify` los cuenta como verificados.
- **B. Sacarlos de la muestra, como «no verificables por código».** Descartada. No bloquean y no
  engañan, pero tampoco comprueban nada cuando la página sí escribe «11 kW».
- **C. Exigir la unidad; sin ella, «no coincide».** Descartada. Las fichas en tabla suelen poner la
  unidad en la cabecera («Capacidad (kWh) | 77»), y todas esas irían a una persona. Bloquea más que hoy
  y baja la métrica.
- **D. Exigir la unidad para contar como encontrado; sin ella, «sin unidad», que no bloquea; y
  «no coincide» solo si el número no está de ninguna forma.** Elegida. Bloquea exactamente lo mismo que
  hoy (el número no está en ninguna grafía), así que no cambia la métrica. Falso positivo que queda:
  «11 kW» puede ser de otra versión o de otro dato (con la regla 1 solo se ancla el precio). Lo que
  gana es que `verify` deja de contar como verificado lo que solo casó por casualidad.

**3. `price_terms` y la versión.** No se ancla a la versión. Es una cadena literal larga que ya
contiene el importe y las condiciones, así que casar por azar es casi imposible, y las condiciones
legales suelen ir en un bloque de notas al pie lejos de las tarjetas: anclarlas daría falsos
negativos sin quitar falsos positivos.

#### Decisión (enmienda)

8. **A qué se aplica el anclaje.** Solo a `versions[].price.value`. Los demás números de versión
   (`battery_kwh`, `wltp_km`, `power_kw`, `dc_max_kw`, `ac_max_kw`) y los del nivel de modelo siguen
   la regla de «Cómo se busca», con el punto 10 si son cortos. `price_terms` no cambia.
9. **Cómo se ancla un precio**, sobre los párrafos (las líneas) del texto completo de `htmlToText`:
   - **Nombres de versión:** los `name` de todas las versiones del **mismo fichero**. Se comparan
     sin distinguir mayúsculas, con los espacios (también el fino y el no separable) colapsados y con
     `-`, `–` y `—` tratados como espacio. Si un nombre contiene a otro («Volta 80» y «Volta 80 AWD»),
     en cada posición gana el más largo.
   - **Dueño de cada aparición del precio** (con las grafías de «Cómo se busca»): las versiones cuyo
     nombre está en el mismo párrafo; si no hay ninguna, la del último párrafo anterior con algún
     nombre, si está a 3 párrafos o menos; si no, ninguna. Un párrafo con varios nombres (la cabecera
     de una tabla por columnas) hace dueñas a todas. El 3 no está medido: es un tope de partida que
     se revisa con los datos de RF-1, como el 10 de la muestra.
   - **Resultado del precio:** *encontrado* si alguna aparición tiene por dueña a su versión;
     *no coincide (otra versión)* si ninguna la tiene y al menos una tiene por dueña solo a otra
     versión; *encontrado sin versión* si las apariciones no tienen dueño; *no coincide* si el número
     no está, como hasta ahora.
10. **Números de una o dos cifras.** Un valor cuya grafía más corta tiene una o dos cifras (`7`, `11`,
    `7,4`, `77`) cuenta como *encontrado* solo si alguna aparición va seguida, con o sin espacio
    (normal, fino o no separable), de la unidad de su campo: `kWh` en `battery_kwh`; `kW` (no seguido
    de `h`) en `power_kw`, `dc_max_kw` y `ac_max_kw`; `km` en `wltp_km`; sin distinguir mayúsculas y
    con la unidad no seguida de otra letra. Si solo aparece sin unidad es *sin unidad*; si no aparece,
    *no coincide*. Un `test_results` corto no tiene unidad en esta lista: es *sin unidad* si aparece.
    Los números de tres cifras o más no cambian.
11. **Qué bloquea.** Solo *no coincide* y *no coincide (otra versión)*, más rota y rechazada, como
    hasta ahora. *Encontrado sin versión* y *sin unidad* no bloquean. Una URL sale «encontrada» si
    ninguno de sus valores bloquea.
12. **El comentario de la fusión.**
    - Por cada *no coincide (otra versión)*: el fichero, la ruta del campo, el valor, la URL, el código
      HTTP, el párrafo donde aparece el precio y el nombre de la versión de la que cuelga, y el primer
      párrafo con el nombre de la versión del YAML o «la página no nombra esta versión». No lleva la
      frase de JavaScript: la página se lee, el precio está y está en otro sitio.
    - Por cada *no coincide*: como hasta ahora, con la frase de JavaScript.
    - Debajo, además de lo que ya lista, los valores *encontrado sin versión* y *sin unidad*, cada uno
      con su ruta, valor y URL.
    - Si fusiona, el resumen del punto 3 de ADR-0011 y el campo `verify` de `ops/merges/` separan
      *encontrados*, *sin versión* (`unanchored`) y *sin unidad* (`no_unit`), para que RF-1 cuente
      cuántos valores se verificaron de verdad.
13. **Pruebas que se añaden** en `factory/tests/`, con el `fetch` falso: un precio en la fila de otra
    versión da `merger:needs-human` con los dos párrafos; dos tarjetas seguidas, cada precio bajo su
    nombre, se fusiona; una cabecera de tabla por columnas no bloquea; una página sin nombres de
    versión da *sin versión* y se fusiona; `11` sin unidad da *sin unidad* y se fusiona; `11 kW` da
    *encontrado*; «Volta 80» y «Volta 80 AWD» en la misma página no se confunden.

#### Consecuencias (enmienda)
- **Bueno:** CA-10 cubre el caso del precio copiado de la fila o tarjeta de otra versión, con una
  prueba que una persona puede leer en el comentario (los dos párrafos).
- **Bueno:** no bloquea más que hoy por la página que no repite el nombre ni por los números cortos:
  el efecto en la métrica del 50 % se limita a los precios que la página pone bajo otra versión.
- **Bueno:** `verify` deja de contar como verificados los números que solo casaron por casualidad.
- **Malo: el anclaje depende de que el `name` del YAML esté escrito como en la página**, y el modelo
  de datos no lo exige. Si el Researcher pone nombres propios, casi todos los precios saldrán *sin
  versión*: no bloquean, pero tampoco se verifican contra su versión. No sé cuántos `name` de hoy
  aparecen tal cual en su página; no lo he medido.
- **Malo: bloqueos falsos con algunas maquetas.** El precio encima del nombre (el de la tarjeta
  siguiente queda como dueño), o una versión que la página nombra distinto con el nombre de otra
  versión justo antes. Irán a una persona y bajan la métrica; cuántas, lo dirá RF-1.
- **Malo: sigue sin detectarse** un precio de otra versión en una tabla por columnas o en una página
  sin nombres de versión, un precio de otro **modelo** en una página de precios de toda la gama (solo
  se miran los nombres del mismo fichero) y un número corto con unidad que es de otra versión.
- **Malo: más código y más casos** en una regla que escribe una persona (RNF-3), y un 3 sin medir.

**Preguntas abiertas de la enmienda (no se deciden aquí):**
- ¿Debe el `name` de la versión copiar el nombre que usa la página? Sería un cambio del modelo de
  datos y de `researcher.md`, no de esta ADR. Medido al aceptar (2026-10-27): de 104 precios con
  `url`, 53 tienen el `name` de su versión escrito tal cual en la página y 29 no (nombres compuestos
  como «135 CV 61 kWh N LINE» o «(versión no especificada en la oferta)»). Encolada para el Arquitecto.
- ¿Se ancla también el resto de números de versión (`wltp_km`, `battery_kwh`, `power_kw`…)? Tienen el
  mismo hueco que el precio; se decide con los datos de RF-1 sobre cuántos precios salen *sin versión*.
- ¿Deben contar como nombres los de las versiones de otros ficheros de la misma marca que citan la
  misma `url`?
- El tope de 3 párrafos, con los datos de RF-1.

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
  Wh) da un «no coincide» que tendrá que mirar una persona. (La enmienda «Versión y unidad», aceptada
  el 2026-10-27, trata los dos primeros casos.)
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
  cuando RF-1 diga cuántas PR van a una persona por esas páginas. Medido el 2026-10-27: 22 de 104
  precios no están en el texto servido (Škoda, Peugeot y algunos Cupra y Renault); encolado para el
  Researcher buscar una `url` registrada donde sí estén.
- ¿Se verifican también las PR de datos que no son del Researcher, o las fusionadas a mano? Con esta
  decisión solo las que la fusión automática iba a fusionar.
- El tope de 10 URL y el tiempo que añade a la pasada se revisan con los datos de RF-1.
