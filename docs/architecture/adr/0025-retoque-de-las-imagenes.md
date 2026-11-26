# ADR-0025 — Retoque de las imágenes de los modelos

- **Estado:** aceptada (2026-11-07). Enmienda [ADR-0012](0012-imagenes-de-los-modelos.md), punto 6 (además de
  las modificaciones técnicas, se admite el retoque de esta ADR), y amplía la forma de `images` de
  [`data-model.md`](../data-model.md).
  Paso 1 del punto 8 hecho el 2026-11-14: `factory/retouch-image.ts`, `factory/retouch-vision.swift` y su prueba.
  Paso 2 hecho el mismo día: `.claude/agents/retoucher.md`, `retoucher` en `budgets.yaml`, el eval `retouchOnly`
  y `edits` en el eval de `data/raw/`, y la regla de `merge.ts` que deja sus PR a una persona.
  Enmienda «Fusión automática» (puntos 9 a 14): **propuesta** el 2026-11-26. Cambia el punto 6 y enmienda
  [ADR-0011](0011-publicacion-de-los-agentes.md), punto 2 (rutas y borrados de las PR del Retocador).
- **Fecha:** 2026-11-07

## Contexto
PRD-001, RF-15 (2026-11-07): la imagen de la tarjeta se muestra con el coche recortado sobre un fondo liso, sin
personas ni stands y con la matrícula tapada, sin tocar el coche. Lo decidió el responsable tras ver una prueba
con cinco modelos (Alfa Romeo Junior, Mobilize Duo, Abarth 500e, Ford E-Tourneo Custom y Renault 4) el
2026-11-06. Hechos de esa prueba:

- **El problema no es la resolución ni la cobertura.** 140 de 145 modelos tienen imagen, todas de Commons, y 138
  tienen ya 1280 px de ancho. Lo que falla es el fondo y el encuadre: ferias, gente, otros coches, rotulación de
  concesionario, vistas traseras.
- **Hay material en Commons.** Para esos cinco modelos había entre 2 y 16 candidatas con licencia válida
  y más de 2000 px; para el Tourneo hubo que buscar por su nombre exacto.
- **La segmentación funciona sin dependencias.** `VNGenerateForegroundInstanceMaskRequest` de Apple Vision
  (macOS 14 o posterior), desde un binario Swift de unas 30 líneas, sacó el coche como una sola instancia en
  las cinco fotos, sin cortar ningún borde. `sharp` ya está en `web/`.
- **Comprobar que el coche no cambia es fácil, pero no basta.** En el interior de la máscara, la diferencia
  entre la foto reducida y el resultado fue 0 en todas. También fue 0 cuando un error de lectura corrompió
  la máscara y la imagen salía rota: la comprobación numérica no ve una máscara mala.
- **Lo que no resuelve el recorte:** pegatinas y carteles pegados al coche (un cartel de feria salió con el
  Junior, el Tourneo lleva una oferta y un QR en el parabrisas), el fondo visto a través de los cristales y
  las matrículas reales legibles.
- **Tamaño:** el coche recortado en PNG de 1280 px con transparencia ocupó entre 1,19 y 1,59 MB, por debajo
  del máximo de 2 MB de ADR-0011; el WebP que generaría el build, entre 103 y 155 KB. Un PNG de paleta
  ocupaba 0,4 MB, pero cambia los colores del coche.

Condicionan la decisión:
- **ADR-0001, regla 7:** nada se inventa. Un píxel del coche pintado por un modelo es un dato inventado.
- **ADR-0001:** solo el Researcher obtiene datos de producto de fuera.
- **ADR-0012, punto 6:** solo contemplaba reducir y cambiar de formato, que CC 4.0 llama modificaciones
  técnicas y no crean material adaptado. Cambiar el fondo sí lo crea.
- **ADR-0024:** lo visual lo acepta una persona viendo imágenes. La dirección visual aún no está elegida
  (`docs/design/direccion.md`).
- **ADR-0002:** sin Python; cada agente con su presupuesto y sus permisos en `budgets.yaml`.
- **ADR-0023:** el prompt del Researcher tiene que adelgazar, no crecer.

## Opciones consideradas

### 1. Quién decide y quién retoca
- **Un modelo generativo que edite la foto** (quitar brillos, pintar lo que tapa una persona): descartada.
  Inventa píxeles del coche (ADR-0001, regla 7), cuesta por imagen y su resultado no se puede comprobar con
  código.
- **El Researcher, con una sección más en su prompt:** descartada. Mezcla obtener datos con juzgar
  estética, y su prompt tiene que bajar de 3 000 caracteres (ADR-0023).
- **Solo un script, sin criterio:** descartada. La prueba demuestra que el script no ve una máscara rota ni
  una pegatina.
- **Un agente nuevo, el Retocador, que juzga, y un script determinista que retoca (elegida).** El agente
  mira la foto, decide si vale, llama al script y mira el resultado. El script es el único que escribe
  píxeles, y no sabe hacer nada que cambie el coche.

### 2. Qué fondo
- **Difuminar el fondo real:** descartada. Deja un halo alrededor del coche y parece un filtro (prueba del
  2026-11-06).
- **Un fondo de color o degradado pintado en la imagen:** descartada. Ata las 145 fotos a un color antes de
  que se elija la dirección visual; cambiarlo obligaría a retocar otra vez.
- **PNG con fondo transparente, y el color lo pone la web (elegida).** El hueco de la tarjeta ya tiene fondo
  propio (`tarjeta-modelo.md`); el color será el de la dirección visual que se elija. La sombra de apoyo va
  en el PNG, semitransparente, para que el coche no flote sobre cualquier fondo.

### 3. Con qué se recorta
- **Apple Vision desde un binario Swift (elegida):** viene con macOS, no añade dependencias ni coste y
  funcionó en las cinco fotos. Solo corre en macOS; la factoría ya corre en un Mac (LaunchAgent).
- **`rembg`:** descartada, es Python.
- **Un paquete de npm con su modelo de segmentación:** descartada por ahora: dependencia nueva con un
  modelo que habría que examinar (licencia, tamaño, procedencia) para obtener lo que ya da el sistema. No
  evaluada.
- **Una API de pago en la nube:** descartada: coste por imagen, una cuenta y una credencial más, y las fotos
  salen del equipo.

### 4. Matrículas
- **Dejarlas:** descartada. Son matrículas reales de particulares y no aportan nada a la tarjeta.
- **Taparlas con un rectángulo liso, dentro del script (elegida).** Es la única excepción a «el coche no se
  toca», y queda registrada en el YAML. El script las localiza con el reconocimiento de texto de Vision
  (`VNRecognizeTextRequest`) dentro de la mitad inferior del coche. **No está probado:** se prueba en el
  piloto. Si el agente ve una matrícula legible que el script no ha tapado, rechaza la foto.
- **Enmienda del 2026-11-19: desenfocar el texto dentro de su contorno (elegida), en vez del rectángulo liso.**
  El rectángulo, con su margen, se salía de la matrícula del Kia EV9 (PR #1178) y tapaba el marco y el
  parachoques. Ahora el script desenfoca solo el cuadrilátero inclinado que Vision da para el texto
  (`boundingBox(for:)`), sin margen y leyendo solo píxeles de dentro: los caracteres se disuelven y el
  contorno de la placa, su marco y el coche quedan intactos. Descartado: buscar el rectángulo de la placa con
  `VNDetectRectanglesRequest`, que en el EV9 no la encontró. Texto anterior: «Taparlas con un rectángulo liso».

## Decisión
**Un agente nuevo, el Retocador, juzga cada foto con el criterio escrito de `docs/design/fotos-modelos.md`
y la retoca con un script determinista que recorta el coche, deja el fondo transparente, añade una sombra de
apoyo y tapa la matrícula, sin tocar ningún otro píxel del coche.**

1. **Reparto.** El Researcher sigue siendo el único que descarga: busca en Commons con el criterio de
   `fotos-modelos.md` y descarga con `fetch-image.ts`, como hoy. El Retocador no tiene red: lee
   `data/images/` y `data/raw/`, decide y retoca. Si rechaza una foto, deja la entrada como estaba y anota
   en `open_questions` del modelo el motivo con una de las causas de rechazo de `fotos-modelos.md`; la
   siguiente tarea del Researcher busca otra.
2. **El script:** `factory/retouch-image.ts <file>`, con el binario Swift de Vision al lado. En este orden:
   - Segmenta y se queda con la instancia más grande y más centrada. **Falla** si no hay ninguna o si el
     coche toca un borde de la foto (está cortado).
   - Recorta al coche con un margen, guarda un PNG RGBA de 1280 px de ancho como máximo, con el coche
     opaco, el fondo transparente y una sombra de apoyo semitransparente debajo.
   - Busca la matrícula y desenfoca su texto dentro de su contorno (enmienda del punto 4, 2026-11-19).
   - **Comprueba** que, dentro de la máscara y fuera de la matrícula, cada píxel es igual al de la foto
     original reducida, antes de codificar. Si no, falla y no escribe nada.
   - Si el PNG pasa de 2 MB (ADR-0011), reduce el ancho hasta que cabe.
   - Escribe `<nombre>.png` junto al original, que conserva (antes lo borraba; cambiado el 2026-11-19
     porque dos ejecuciones rechazaron la foto y no lo restauraron), y una hoja «antes y después» en
     `ops/retouch/<run_id>/` para la PR.
   - Imprime una línea JSON con `file`, `edits`, las dimensiones y el resultado de la comprobación, como
     `fetch-image.ts`.
3. **El agente**, después del script, mira el PNG y lo rechaza si ve una máscara mala: trozos de fondo
   pegados, partes del coche que faltan (retrovisores, antena, ruedas), un cartel o una persona pegados al
   coche, o una matrícula legible. Si lo acepta, borra el original; si lo rechaza, borra el PNG y lo anota como en
   el punto 1.
4. **Esquema.** Cada entrada de `images` admite una clave nueva, `edits`: lista de `background` y `plate`.
   Si no está, la imagen no está retocada, así que las 140 entradas actuales siguen siendo válidas. Una
   imagen con `edits` es PNG. El resto de claves no cambia: `source_url` y `page_url` siguen apuntando a la
   foto original, y `license` es la de la original.
5. **Licencias.** Una imagen retocada es material adaptado. CC BY y CC BY-SA piden indicar que se ha
   modificado; CC BY-SA, además, que la versión adaptada se publique con la misma licencia (o una compatible),
   y se mantiene la misma. CC0 y dominio público no piden nada. Por eso:
   - Si `attribution` no es `null` y la entrada tiene `edits`, la web añade «(modificada)» a la atribución
     (CA-23). Dónde y cómo lo fija `tarjeta-modelo.md`.
   - Las licencias con `ND` ya están excluidas por RF-8.
6. **Publicación.** Las PR del Retocador no se fusionan solas: una persona las acepta viendo la hoja
   «antes y después», como el resto del trabajo visual (ADR-0024). Cambiarlo es otra decisión, con datos de
   rechazos. *Enmienda «Fusión automática», propuesta el 2026-11-26: mientras no se acepte, este punto sigue
   vigente.*
7. **Permisos y presupuesto.** `retoucher` en `budgets.yaml`, con `network: false`, `write_paths:
   [data/images/, data/raw/, ops/retouch/, docs/bitacora/]`, y en `allowed_tools` el script y
   `git checkout -- data/images/` (no hay quien apruebe permisos en `-p`). El eval de la factoría
   rechaza una ejecución del Retocador que cambie en `data/raw/` algo que no sea `file` y `edits` de una
   imagen, u `open_questions`.
   Los importes, en la PR de implementación, a partir del coste del piloto.
8. **Orden.** (1) Script y prueba; (2) agente, presupuesto y eval; (3) piloto con los cinco modelos de la
   prueba; (4) el resto del catálogo, por marcas, empezando por el Researcher con el criterio nuevo.

### Fusión automática (enmienda del 2026-11-26, propuesta)

**Una PR del Retocador se fusiona sola con las reglas de ADR-0011, `review:ok` incluida, más una regla propia de
`merge.ts` que admite sus sustituciones `.jpg` → `.png` y sus hojas; el Revisor da `review:ok` solo después de
mirar cada hoja, y un interruptor con fecha en `budgets.yaml` la apaga a mano o sola ante un revert.**

Contexto propio de la enmienda. El responsable quiere que estas PR entren solas (bitácora, 2026-11-25 12:27), y
el punto 6 pide datos de rechazos. Los datos, sacados de `git log` de `main` el 2026-11-26 (los merges
`Merge pull request #N from rerades/agent/retoucher/…` y los commits de cada rama):

- **16 PR de `agent/retoucher/` fusionadas**, todas a mano: #1106 (piloto), #1158, #1159, #1177, #1178, #1182,
  #1184, #1214, #1215, #1235, #1257, #1259, #1264, #1266, #1276 y #1278. La bitácora del 2026-11-25 dice que
  ninguna se cerró sin fusionar; no lo he podido comprobar con `gh pr list --state all`, que en esta ejecución
  pedía una aprobación que no hay.
- **11 sin commits de una persona** (solo el commit `retoucher: …`): #1106, #1182, #1184, #1214, #1215, #1235,
  #1257, #1264, #1266, #1276 y #1278. Desde la #1182 (2026-11-20), 11 de 12 seguidas.
- **5 con commits de una persona**, y por qué:
  - #1158 (Peugeot) y #1159 (Mercedes): CI en rojo. El agente rechazó e-rifter y EQE después de retocarlas sin
    restaurar el `.jpg`, y el YAML citaba un fichero que no existía. La persona restauró el original. Arreglado
    en la factoría: `retouchOnly` comprueba que `images[].file` existe (2026-11-18) y el script ya no borra el
    original (2026-11-19).
  - #1177 (Citroën) y #1178 (Kia): el mismo olvido (Ami, EV6), rescatados a mano. La #1178 además se retocó
    otra vez (EV3, EV9) porque el rectángulo de la matrícula se salía de la placa; de ahí la enmienda del
    punto 4.
  - #1259 (Renault): un commit que solo anota en el YAML por qué se acepta el Twingo con el rótulo «FISCHER»
    del portamatrículas. La persona aceptó las tres fotos tal cual las dejó el agente; su criterio: un rótulo
    de concesionario rechaza la foto cuando se ve, no cuando es un texto casi ilegible (bitácora,
    2026-11-25 12:39).
  - Fuera de las 16: la ejecución de Toyota (`20261122-023007-bfedb0`) acabó en `eval_failed` por el mismo
    olvido y se rescató a mano (alerta #1237).
- **Ninguna corrección de una persona cambió el juicio del agente sobre una foto.** Las cinco se deben a
  ficheros sin restaurar, ya imposibles con el script actual, o a un cambio de método decidido por el
  responsable.
- **No he podido contar las `review:changes`** ni leer sus comentarios: `gh pr view --comments` y
  `gh issue view 1242` pedían aprobación. Por lo que sale de los commits, las PR con CI en rojo (#1158, #1159)
  tuvieron que llevarla. Es lo primero que hay que completar al revisar esta enmienda.
- **Fallos del script (#1242)**, según las notas del Retocador en la bitácora (no he leído la issue): no detecta
  algunas matrículas (e-rifter, Ami, Scenic, la «BRUNOLD» del 500e); deja legible el rótulo del concesionario en
  el marco de la placa (Micra, Interstar-e, el «FISCHER» del Twingo); y desenfoca placas de modelo que no son
  matrículas («EC 40» y «EX 30» de Volvo, #1264, que una persona fusionó así).
- **Por qué no se puede activar sin cambiar más cosas:** `agentMergeBlocker` corta cualquier rama
  `agent/retoucher/`; cada PR que acepta una foto borra su `frontal.jpg` (#1278: `D` del `.jpg`, `A` del `.png`),
  y ADR-0011, punto 2, no admite borrados; y la hoja va en `ops/retouch/<run_id>/`, fuera de la lista de rutas.
  El Revisor no tiene ninguna instrucción para estas PR y les pone `review:needs-human` por el punto 6.

Opciones consideradas:

- **Fusionar sin `review:ok`, solo con código:** descartada. La comprobación de píxeles no ve una máscara mala ni
  una pegatina (Contexto); sin una mirada a la hoja, nadie la ve antes de publicarla.
- **Quitar solo la línea de `agentMergeBlocker`:** descartada. Las PR seguirían paradas por el borrado del
  `.jpg` y por `ops/retouch/`, y el Revisor seguiría poniendo `review:needs-human`.
- **Admitir cualquier borrado en `data/images/` para el Retocador:** descartada. Un borrado sin `.png` que lo
  sustituya deja el modelo sin foto, o un YAML que cita un fichero que no está.
- **Que el Retocador no borre el original y quede como huérfano:** descartada. `data/images/` acumularía
  ficheros sin citar (aviso del validador y bloqueo del punto 10 de ADR-0011), y el repositorio crecería más.
- **La escalera de confianza de ADR-0022:** descartada por ahora. La escalera es para áreas fuera de la lista
  de ADR-0011 (`trust.areas`, hoy `web/`); lo que para al Retocador no es una ruta sino un juicio visual y una
  regla de su rama. Además se fusiona «con las reglas de ADR-0011 más la puerta de RF-3», y esa puerta aún no
  existe (CLAUDE.md, «Estado actual»), así que por la escalera no entraría nada. Y su tipo de cambio sería
  `(retoucher, data/)`: meter `data/` en `trust.areas` haría que la escalera contase también las PR del
  Researcher, que ya entran por la lista.
- **Una regla propia con un interruptor con fecha (elegida).** Reutiliza la definición de defecto escapado de
  ADR-0019 para la vuelta atrás automática y no necesita un estado nuevo.

9. **Cuándo se fusiona sola.** Una PR `agent/retoucher/<run_id>` entra si cumple **todas** las reglas del
   punto 2 de ADR-0011 (`review:ok` con el SHA, CI en verde, sin conflictos, imágenes citadas de 2 MB como
   máximo, sin `factory/STOP`) y, además:
   - el interruptor `retoucher_auto_merge` de `factory/budgets.yaml` es una fecha y no `false` (punto 13);
   - cada fichero del diff está en `data/images/`, `data/raw/`, `docs/bitacora/` u
     `ops/retouch/<run_id>/`, con el `run_id` de su rama (punto 11);
   - en `data/raw/`, entre la base de la PR y el commit revisado, solo cambian `file` y `edits` de una
     imagen y `open_questions`: la misma regla que `retouchOnly`, comprobada otra vez por `merge.ts` sobre
     el commit revisado, porque el eval solo vio la ejecución del agente;
   - cada `.png` nuevo o cambiado en `data/images/` lo cita una entrada con `edits` que incluye
     `background`, y tiene su hoja en `ops/retouch/<run_id>/`;
   - el verificador de ADR-0020 se aplica como a cualquier PR de `data/raw/`. Si el diff no tiene valores que
     verificar, no debe bloquear: se comprueba en la PR de implementación.

   **`review:ok` sigue haciendo falta.** Es la única mirada a la hoja antes de publicar. `review:needs-human`
   y las dos `merger:*` siguen bloqueando como en ADR-0011, punto 14.

10. **Qué mira el Revisor.** Una sección nueva de `.claude/agents/reviewer.md`, «PR del Retocador», que
    sustituye el `review:needs-human` por defecto:
    - **Cada hoja** de `ops/retouch/<run_id>/`, con Read, aplicando el punto 3 de esta ADR y las causas de
      rechazo de `docs/design/fotos-modelos.md`: fondo pegado, partes del coche que faltan, algo pegado al
      coche, matrícula legible. Si no puede leer alguna hoja, `review:error`, nunca `review:ok`. Cómo llega
      la hoja al Revisor (leerla del commit revisado o de un artefacto de la CI, como las capturas de
      ADR-0024) lo decide la PR de implementación; con la condición de no escribir fuera de los
      `write_paths` del Revisor.
    - **El diff:** cada foto aceptada tiene `file` en `.png` y `edits`; cada rechazada conserva su original y
      tiene su línea en `open_questions` con una causa de la tabla; no hay `.png` sin citar.
    - **Etiqueta:** `review:ok` si todas las fotos aceptadas pasan; `review:changes` si alguna tiene un
      defecto de la lista (el arreglo es rechazarla); `review:needs-human` solo si la foto plantea algo que
      `fotos-modelos.md` no resuelve, o en el caso del punto 12. Un rechazo del agente que el Revisor no
      comparta no es `review:changes`: rechazar no publica nada.
    - **El criterio del rótulo** que la persona aplicó en la #1259 tiene que estar escrito en
      `fotos-modelos.md` (lo escribe Diseño) antes de activar el interruptor. El prompt del Revisor lo cita;
      no lo repite.
    - **Evals de ADR-0016.** Cambiar el prompt es una versión nueva y se aprueba como dice ADR-0016, punto 4:
      línea base contra candidata con el mismo modelo y el mismo dataset. Antes se añaden al dataset casos de
      PR del Retocador ya cerradas, como mínimo uno `review:ok` (p. ej. #1278) y uno `review:changes` (#1158 o
      #1159, CI en rojo), con sus hojas en la instantánea para que el Revisor las pueda leer sin red. Cambiar
      el dataset obliga a repetir la línea base (ADR-0016). Hasta hoy `false_ok` nunca ha sido 0 (bitácora,
      2026-11-21 13:22), así que la aprobación la decide una persona, como ya pasa.
11. **Los borrados.** `merge.ts` admite un fichero `DELETED` solo en una rama `agent/retoucher/` y solo si:
    - está en `data/images/<brand>/<slug>/`, es `.jpg`, `.jpeg` o `.png`;
    - en la misma PR se añade un `.png` en la misma carpeta con el mismo nombre sin extensión;
    - en la base de la PR algún YAML de `data/raw/` cita el fichero borrado, y en el commit revisado esa
      misma entrada cita el `.png` con `edits`.

    Cualquier otro borrado, y cualquier `RENAMED` o `COPIED`, sigue siendo de una persona. Cuando el original
    ya era `.png`, el script lo sobrescribe: es un `MODIFIED` y no necesita esta regla. En `ops/retouch/` solo
    se admiten ficheros nuevos (`ADDED`) de 2 MB como máximo, en la carpeta del `run_id` de la rama.
12. **Los fallos del script (#1242).** La fusión automática no espera a que se arreglen, pero cada fallo
    tiene su salida:
    - **Matrícula sin detectar y legible:** el agente rechaza con `matricula`, como hoy; si la acepta, el
      Revisor pone `review:changes`.
    - **Rótulo legible del concesionario en el marco de la placa:** se juzga con el criterio del rótulo de
      `fotos-modelos.md` (punto 10).
    - **Texto desenfocado que no es una matrícula** (una placa de modelo): el punto 4 solo exceptúa la
      matrícula de «el coche no se toca». Mientras la #1242 esté abierta, el Revisor pone
      `review:needs-human` a la PR que acepte una foto así, aunque la #1264 entrara a mano con ese defecto.
      Que sea aceptable o no lo decide una persona; si lo es, se escribe en esta ADR, no en el prompt.
    - **Un cambio del script** (`retouch-image.ts` o `retouch-vision.swift`) es una PR en `factory/` y la hace
      una persona: esa misma PR decide si la fecha del interruptor se mueve, para que las retocadas con el
      script nuevo no cuenten como historial del viejo (punto 13).
13. **Cómo se vuelve atrás.**
    - **El interruptor:** `retoucher_auto_merge` en `factory/budgets.yaml`, `false` o una fecha `AAAA-MM-DD`.
      Empieza en `false`. Lo cambia una persona en una PR de `factory/`, como `auto_merge` (ADR-0011, punto 7).
      Con `false`, la fusión solo marca `merger:needs-human` y dice qué habría fusionado. `auto_merge: false`
      apaga también esto.
    - **Parada sola:** antes de fusionar una PR del Retocador, `merge.ts` busca un defecto escapado (la
      definición de ADR-0019: revert, o PR `fix…` que la cite en sus 7 días) de cualquier PR del Retocador
      fusionada sola desde la fecha del interruptor, y un revert de cualquiera de ellas en cualquier plazo,
      como la bajada de ADR-0022. Si encuentra uno, no fusiona ninguna y les pone `merger:needs-human`
      diciendo qué PR lo causó. Para reanudar, una persona pone una fecha nueva, posterior al defecto.
    - **Una foto ya publicada:** `git revert -m 1 <sha>` en una PR de persona (ADR-0011, punto 5), o una PR que
      devuelva el `.jpg` y la entrada como estaban.
14. **Condiciones para poner la fecha:** (a) la regla de los puntos 9 y 11 en `merge.ts`, con sus pruebas;
    (b) el prompt del Revisor del punto 10, aprobado según ADR-0016; (c) el criterio del rótulo en
    `fotos-modelos.md`; (d) contadas las `review:changes` de las 16 PR, y ninguna por un juicio de foto que la
    persona corrigió. Si (d) no se cumple, la enmienda se revisa antes de activarla.

## Consecuencias
- El retoque solo corre en macOS. La CI no lo ejecuta: valida lo que se ha guardado (`validate-data.ts`).
- El repositorio crece: un PNG ronda 1,2–1,6 MB frente a los 50–300 KB de un JPEG; los 145, en torno a
  200 MB. Si pasa a ser un problema, la salida es Git LFS, descartada por ahora en ADR-0012.
- Cada modelo pasa por dos agentes (Researcher y Retocador). Más coste por modelo, a cambio de no mezclar
  obtener datos con juzgar estética.
- Una foto que no se puede retocar sin tocar el coche se rechaza, aunque sea la única: el modelo se queda
  con la foto sin retocar o con la silueta, nunca con una inventada.
- La comprobación de píxeles no ve una máscara mala ni una pegatina. Por eso hay criterio en el agente y
  revisión de una persona en la PR.
- Pendiente de probar en el piloto: que Vision encuentre las matrículas, y cuánto cuesta revisar una foto.
- **Enmienda «Fusión automática» (2026-11-26, propuesta):**
  - Bueno: las retocadas llegan a la web sin esperar a una persona. Lo que decide la fusión sigue siendo código
    sin modelo, y cada borrado admitido tiene su `.png` sustituto y su YAML, comprobados en el commit revisado.
  - Malo: **la única mirada a la hoja antes de publicar pasa a ser la de un modelo.** Una máscara mala que el
    Retocador y el Revisor no vean se publica, con «(modificada)» en el crédito, hasta que alguien la vea y la
    revierta. Con `false_ok` del Revisor por encima de 0 en todas sus evaluaciones, el riesgo es real.
  - Malo: el Retocador y el Revisor miran la misma imagen con el mismo tipo de modelo; es probable que se
    equivoquen en los mismos casos. Es una impresión, no un dato: los evals del punto 10 lo dirán en parte.
  - Malo: `merge.ts` crece con una regla que solo vale para un agente (borrados, `ops/retouch/`, comprobación
    de `retouchOnly`), y el Revisor gana una sección y una forma de leer imágenes que hay que mantener.
  - Malo: `ops/retouch/` entra en `main` sin persona; unos 120–150 KB por hoja (#1278), que se suman a lo que
    ya crece el repositorio.
  - Malo: el historial que la justifica es corto (16 PR en 11 días) y cinco de ellas necesitaron a una
    persona. Las causas están arregladas, pero no hay ninguna PR fusionada sola que lo demuestre.
  - Las placas de modelo desenfocadas (#1242) siguen yendo a una persona; si el script no se arregla, cada
    marca con placas de exposición parará su PR.
  - Preguntas abiertas: cuántas `review:changes` tuvieron las 16 PR y por qué (no comprobado: `gh` pedía
    aprobación); si se acepta la placa de modelo desenfocada de la #1264; cómo lee el Revisor la hoja sin
    escribir fuera de sus `write_paths`; si el verificador de ADR-0020 deja pasar un diff sin valores.
- Al aceptarla: estado de ADR-0012, línea en `overview.md`, regla 10 de `data-model.md` y `tarjeta-modelo.md`
  (en esta misma PR), y entrada `decision` en la bitácora.
