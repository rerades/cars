# ADR-0010 — Pipeline de ingesta: validación de todo `data/raw/` en la CI y refresco mensual por marca

- **Estado:** aceptada (2026-10-06). Enmienda «Imágenes» (descarga de [ADR-0012](0012-imagenes-de-los-modelos.md)): aceptada (2026-10-07)
- **Fecha:** 2026-10-04
- **Historial:** 2026-10-04 propuesta · 2026-10-06 aceptada · 2026-10-07 enmienda propuesta y aceptada: se
  añaden la opción 6, la subsección «Imágenes» de la Decisión, sus consecuencias y las fuentes [2] y
  [3]. Lo aceptado el 2026-10-06 no cambia.

## Contexto
Es la decisión pendiente de `overview.md`: «Pipeline de ingesta de datos de modelos (fuentes,
frecuencia, validación)». Lo que hay hoy (repositorio leído el 2026-10-04) y lo que obliga a decidir:

- **El validador ya existe, pero solo mira lo que cambia el Researcher.** `factory/evals.ts` tiene
  tres comprobaciones para el agente `researcher`: `registry` (ADR-0001: `id`, `tier`, `urls`,
  `last_verified`), `rawData` (ADR-0001, regla 2: `source_id` del registro, `url`, `retrieved` no
  futura y `tier` en cada valor) y `rawShape` (el esquema de ADR-0008, tal como lo define
  `data-model.md`). `runEvals` recibe solo los ficheros que la ejecución ha tocado
  (`changedFiles`). Por eso:
  - un cambio en `data/raw/` hecho por una persona o por otro agente no pasa por ninguna
    comprobación;
  - si una PR cambia el registro y retira un `source_id`, los YAML que lo citan y no se han tocado
    no se vuelven a mirar;
  - la CI (`.github/workflows/ci.yml`, jobs `test` y `web`) no valida `data/raw/` en absoluto.
- **ADR-0011, punto 7 (b):** la fusión automática no se enciende hasta que «la CI valida el esquema
  de `data/raw/`». Sin eso, «CI en verde» no dice nada de los YAML.
- **ADR-0011, punto 2:** fusionar exige **todos** los checks en verde. Un check que se ponga en rojo
  sin que cambie nada en la PR bloquea todas las fusiones automáticas.
- **ADR-0008, Consecuencias:** «Hasta que exista la comprobación, esta ADR no impide nada» fuera de
  la factoría. `overview.md` añade que la migración de Cupra y Polestar al esquema sigue pendiente.
- **ADR-0001, Consecuencias:** «Hará falta revisar periódicamente precios y URLs rotas (frecuencia
  por decidir)». Reglas que condicionan qué hacer con un dato viejo: regla 1 (sin PVP ni precio
  financiado de una T1, el campo queda vacío), regla 3 (discrepancia del mismo nivel →
  `needs_review`), regla 6 (`robots.txt` y términos de uso) y regla 7 (no se estima).
- **Precio que caduca, caso real:** la tarea de la cola sobre `data/raw/cupra/raval.yaml` dice que
  la oferta del precio `financed` «caducaba el 2026-09-30». El esquema de ADR-0008 no tiene ningún
  campo con la fecha de fin de una oferta: solo está, si acaso, dentro del texto de `price_terms`.
- **Lo que el producto ya fija:** PRD-002, RF-4 y CA-9: cada precio se muestra con su fuente y su
  fecha `retrieved`. PRD-001, RF-13 y CA-18: un modelo `needs_review: true` no se publica. PRD-001,
  sección 3: «Precios en tiempo real» están fuera de alcance. Ningún PRD dice cuánto tiempo puede
  tener un precio antes de dejar de mostrarse.
- **El build ya tiene su propia lectura tolerante.** `web/src/lib/data.ts` (`loadModels`,
  `normalize`) nunca falla por un fichero malo: lo deja en `errors` o descarta el valor con un
  aviso en `warnings`. La portada muestra «No se pudieron leer N ficheros».
- **Registro de fuentes:** `data/sources/registry.yaml` ya documenta `status: active | broken |
  deprecated` por fuente, y hoy todas están en `active`.
- **Presupuesto (ADR-0002, `factory/budgets.yaml`):** el Researcher tiene 7 USD al mes y 1,50 por
  ejecución; el comentario del fichero estima ~0,24 USD por marca. Hay 3 marcas en `data/raw/`
  (Cupra, Peugeot, Polestar) y 10 encargos de marca nueva en `factory/queue.yaml`.
- **Quién escribe:** solo el Researcher obtiene datos del producto (ADR-0001); la cola
  (`factory/queue.yaml`) se rellena a mano.

## Opciones consideradas

**1. Dónde se valida todo `data/raw/`**
- **Solo al construir la web (que el build falle si un YAML no cumple):** descartada. (a) Render
  construye después de fusionar, así que el error llega tarde, cuando el fichero ya está en `main`;
  (b) la lectura del build (`data.ts`) es tolerante a propósito y es otra implementación del
  esquema: hacerla estricta sería un segundo validador, justo lo que la tarea pide no crear;
  (c) un fallo del build en Render deja el sitio publicado en la versión anterior sin que la PR lo
  haya visto.
- **CI en cada PR y además al construir la web:** descartada. El build de la CI (job `web`) y el de
  Render corren sobre el mismo commit que ya ha validado el job de la CI, y con «After CI Checks
  Pass» (ADR-0011) Render no despliega si la CI falla. Validar dos veces lo mismo, con dos
  implementaciones distintas, solo añade la posibilidad de que discrepen.
- **Solo el eval de la factoría (lo de hoy):** descartada. Deja fuera los cambios de personas y de
  otros agentes y los efectos de un cambio en el registro sobre ficheros no tocados; y no cumple
  ADR-0011 (7 b).
- **Un validador nuevo (JSON Schema con una librería, o uno en `web/`):** descartada por la tarea y
  porque `evals.ts` ya implementa el esquema de ADR-0008 y las reglas de ADR-0001 con sus pruebas.
  Un segundo validador del mismo esquema divergiría.
- **Elegida:** la CI ejecuta en cada PR y en cada push a `main` las tres comprobaciones que ya
  existen en `factory/evals.ts`, sobre **todo** `data/raw/` y el registro, no solo sobre lo
  cambiado. El build se queda como está.

**2. Qué bloquea y qué solo avisa**
- **Que todo bloquee, también la antigüedad de los datos:** descartada. Un precio que envejece
  pone la CI en rojo sin que nadie cambie nada; por ADR-0011 ese rojo heredado bloquearía todas las
  fusiones automáticas, también las de otras marcas e incluso los refrescos que lo arreglarían si
  tocan otra marca primero.
- **Que nada bloquee, solo avisos:** descartada. Es lo que hay fuera de la factoría y es lo que
  ADR-0008 y ADR-0011 dicen que no basta.
- **Elegida:** bloquea lo que depende del contenido del commit (forma, procedencia, registro);
  avisa de lo que depende del paso del tiempo o de terceros (antigüedad, fuente rota,
  `needs_review`).

**3. Cada cuánto se refresca cada marca**
- **Semanal:** descartada por coste. Con ~0,24 USD por marca (estimación de `budgets.yaml`, no
  medida en refrescos), 13 marcas son ~12,5 USD al mes, por encima de los 7 USD del Researcher.
- **Bajo demanda, solo cuando alguien se da cuenta:** descartada. Es lo que ya produjo el precio
  caducado de Raval sin que nada avisara.
- **Distinta por tipo de dato (precios cada semana, especificaciones cada trimestre):** descartada
  por ahora. Obliga a dos tipos de tarea del Researcher y a saber qué valores tocar en cada una;
  una ejecución por marca ya relee la página de precios y la ficha a la vez.
- **Elegida: mensual, una ejecución del Researcher por marca.** Con la estimación de arriba, ~3 USD
  al mes para 13 marcas.

**4. Qué pasa cuando una fuente se rompe**
- **Que la CI compruebe las URL (petición HTTP a cada `url`):** descartada. Hace la CI dependiente
  de webs de terceros (rojo intermitente, y ADR-0011 cuenta cualquier rojo), multiplica peticiones a
  las marcas en cada PR (ADR-0001, regla 6) y una URL que responde 200 no prueba que el dato siga
  ahí. Solo el Researcher relee fuentes (ADR-0001).
- **Borrar los valores de una fuente rota:** descartada. Un fallo de red no es una prueba de que el
  dato haya cambiado; borrar sin fuente que lo diga también es decidir sin fuente.
- **Elegida:** la detecta el Researcher en el refresco y la registra en el registro
  (`status: broken`); la CI avisa de los valores que la siguen citando.

**5. Qué pasa cuando un precio caduca**
- **Ocultar el precio pasado un plazo («Precio por confirmar»):** no se decide aquí. Cambia lo que
  ve el visitante y ningún PRD lo pide: es una pregunta para Producto (ver Preguntas abiertas).
- **Marcar `needs_review` el modelo con precio viejo:** descartada. Por RF-13 despublica el modelo
  entero, y un precio viejo no es una discrepancia entre fuentes (ADR-0001, regla 3).
- **Añadir al esquema la fecha de fin de la oferta (`price_valid_until` o similar):** no se decide
  aquí. Es un cambio de ADR-0008 y de `data-model.md`; queda como pregunta abierta.
- **Elegida:** el precio sigue publicado con su fecha `retrieved` (PRD-002, RF-4 y CA-9 ya la
  muestran en la ficha), la CI avisa cuando pasa el plazo y el refresco mensual lo relee.

**6. Quién descarga las imágenes de ADR-0012 (enmienda del 2026-10-07)**

Contexto propio de la enmienda: ADR-0012 (aceptada), puntos 2 a 5, fija que el fichero se descarga
en la ingesta, en la misma ejecución que escribe el YAML, nunca en el build; que se pide con un
`User-Agent` con contacto; que una descarga fallida no deja entrada en `images`, y delega aquí el
«cómo» y la migración. Hechos del repositorio (leído el 2026-10-07): el Researcher solo tiene en
`factory/budgets.yaml` `WebSearch`, `WebFetch` y `Bash(node factory/bitacora.ts:*)`, y `WebFetch`
devuelve texto; su `write_paths` es `[data/, docs/bitacora/]`; el orquestador
(`factory/orchestrator.ts`, `execute`) ejecuta los evals sobre el worktree **después** del agente y
**antes** del commit y de la PR; la CI aún no tiene el paso de validación del punto 2 de la Decisión.

- **Que el Researcher descargue con `WebFetch`:** imposible: devuelve texto, no el binario.
- **Darle al Researcher `Bash` genérico (`curl`, `node -e`):** descartada. Abre la red y el disco a
  cualquier orden, el `User-Agent` depende de que el modelo lo recuerde en cada llamada y nada
  comprueba que lo guardado sea una imagen de ≤ 1280 px.
- **Que lo descargue el orquestador después de la ejecución, a partir de lo que el Researcher deja
  en el YAML:** descartada. (a) Si la descarga falla, un programa sin modelo tendría que reescribir
  el YAML del agente (quitar la entrada, añadir `open_questions`), perdiendo comentarios y formato;
  (b) el Researcher no se entera del fallo y no puede buscar otra imagen en la misma ejecución, que
  es lo que pide PRD-001, RF-8 (Commons, después prensa, después silueta); (c) entre el agente y el
  eval habría una entrada de `images` sin fichero, justo lo que ADR-0012 (punto 4) prohíbe.
- **Descargar en la CI o en el build:** descartada ya por ADR-0012 (opción 1).
- **Elegida:** un script determinista, sin modelo, que el Researcher lanza con un permiso `Bash`
  limitado a ese script; el script descarga, comprueba y guarda, y devuelve los campos que el
  Researcher copia al YAML.

## Decisión
**Todo `data/raw/` y el registro se validan en la CI de cada PR y de `main` con las comprobaciones
que ya existen en `factory/evals.ts`; los fallos de forma y procedencia ponen la CI en rojo, la
antigüedad y las fuentes rotas solo avisan, y el Researcher refresca cada marca una vez al mes.**

Detalles:

1. **Un solo validador.** `factory/evals.ts` expone una función que ejecuta `registry`, `rawData` y
   `rawShape` con `files` = todos los `data/raw/**/*.yaml` más todos los `data/sources/*.yaml` (un fichero por fuente desde
   #164; antes, `data/sources/registry.yaml`), y un
   punto de entrada de línea de órdenes (por ejemplo `node factory/validate-data.ts`) que la llama y
   sale con código 1 si hay fallos. El eval de la factoría (ADR-0004) sigue igual: rechaza antes de
   abrir PR; la CI es la segunda barrera, para todo lo que no viene del Researcher. Las reglas no se
   copian: si cambia el esquema, cambia `data-model.md` y después `evals.ts`, como hoy.
2. **Dónde corre.** Un paso más en el job `test` de `.github/workflows/ci.yml` (raíz, que ya tiene
   la dependencia `yaml`), en `pull_request` y en `push` a `main`. Con eso se cumple la condición
   (b) del punto 7 de ADR-0011. El build de la web (`data.ts`) no se toca y no falla por los datos.
3. **La fecha de hoy** con la que se comprueba que `retrieved` y `last_verified` no son futuras se
   calcula en la zona `Europe/Madrid`, no en UTC: el Researcher escribe la fecha local y entre las
   00:00 y las 02:00 de España la fecha UTC aún es la de ayer.
4. **Bloquea (CI en rojo, `::error` y salida 1)** todo lo que hoy reportan las tres comprobaciones:
   YAML ilegible; valor sin `source_id`, `url`, `retrieved` o `tier`; `source_id` que no está en el
   registro; fecha futura; claves o valores fuera del esquema de ADR-0008; reglas del precio
   (`T1`, `EUR`, `price_kind`, `price_terms`); `brand_name` distinto en la carpeta; entrada del
   registro incompleta. Como se mira todo, una PR que retire una fuente del registro falla si algún
   fichero la sigue citando.
5. **Solo avisa (`::warning` y un resumen en `GITHUB_STEP_SUMMARY` [1]; salida 0):**
   - precio con `retrieved` de hace más de **45 días** (un mes de ciclo más margen);
   - fuente del registro con `last_verified` de hace más de 45 días;
   - valor o imagen cuyo `source_id` tiene `status: broken` o `deprecated` en el registro;
   - fichero con `needs_review: true` (no se publica, RF-13; el aviso es para que no se olvide).

   El resumen agrupa los avisos por marca y lista las marcas **vencidas**: las que tienen algún
   aviso de antigüedad. Son nuevas comprobaciones de `evals.ts`, pero de aviso: el eval de la
   factoría no las usa para rechazar.
6. **Refresco.** Una ejecución del Researcher por marca y mes, que relee todos los valores de la
   marca en sus fuentes, actualiza `retrieved` (y el valor si ha cambiado) y verifica las fuentes
   del registro (`last_verified`, `status`). Mientras la cola se rellene a mano, las tareas de
   refresco las añade una persona a `factory/queue.yaml` a partir de la lista de marcas vencidas;
   automatizar ese paso queda pendiente (otra decisión, que toca `factory/`).
7. **Fuente rota.** En el refresco, si la URL de una fuente no carga, el Researcher no cambia los
   datos, lo anota en `open_questions` y reintenta en el siguiente refresco. Si la página ya no
   existe o ya no contiene el dato (por ejemplo, la marca ha movido la ficha), busca la página
   nueva en la misma fuente o en otra del mismo nivel o superior; si la encuentra, actualiza
   `url`, `retrieved` y, si cambia de fuente, `source_id`; si no, pone `status: broken` en el
   registro y aplica ADR-0001: un precio sin fuente T1 vigente queda en `null` (regla 1), y el
   resto de valores se queda con su fecha y su aviso hasta el siguiente refresco. Nunca deduce el
   estado `discontinued` de que una página haya desaparecido: hace falta una fuente que lo diga.
8. **Precio caducado.** Sigue publicado con su fuente y su fecha `retrieved` (PRD-002, RF-4 y
   CA-9). Si en el refresco la oferta de un precio `financed` ha terminado, el Researcher guarda el
   precio que la página muestre ahora con su `price_kind` correcto, o `null` si no hay ninguno
   (ADR-0001, regla 1).
9. **Fuera de esta decisión:** la fecha de fin de oferta en el esquema, ocultar precios viejos en la
   web, la automatización de la cola y la migración de ficheros (que va con la PR que active el
   paso, ver Consecuencias).

### Imágenes (enmienda del 2026-10-07, aceptada)

**Las imágenes de ADR-0012 las descarga un script determinista que el Researcher lanza durante su
ejecución; el script solo guarda en `data/images/` un JPEG o PNG de 1280 px de ancho como máximo, y
el validador acepta la forma antigua de `images` solo como aviso hasta que el Researcher migre las
imágenes actuales.**

10. **Quién y cuándo.** Un script sin modelo en `factory/` (nombre de trabajo:
    `factory/fetch-image.ts`) que el Researcher ejecuta con un permiso nuevo y estrecho,
    `Bash(node factory/fetch-image.ts:*)`, en `allowed_tools` de `factory/budgets.yaml` y en el
    `tools:` y las instrucciones de `.claude/agents/researcher.md`. Ocurre **dentro de la ejecución
    del Researcher, después de elegir la imagen y antes de escribir su entrada en `images`**: así
    el fichero y el YAML entran en el mismo commit (ADR-0012, punto 3) y el Researcher ve el
    resultado y puede probar otra fuente (PRD-001, RF-8). El script:
    - recibe la marca, el slug del modelo, el `<nombre>` y la `page_url` (la página `File:` en
      Commons; en una sala de prensa, además la URL del fichero, porque no hay API);
    - en Commons, pide a la API `action=query&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1280`
      sobre la página `File:` [2] y descarga la URL de la miniatura que devuelve, o la del original
      si es más estrecho; esa URL es el `source_url`;
    - hace las peticiones de una en una, con un `User-Agent` fijo en una constante del script con
      nombre, versión y contacto, en el formato `<cliente>/<versión> (<contacto>) <librería>` que
      pide Wikimedia [3]. El contacto es la URL `https://siete3.com` (decidido el 2026-10-07: no
      expone ningún correo en el repositorio);
    - escribe en `data/images/<brand>/<slug>/<nombre>.<ext>` solo si pasa las comprobaciones del
      punto 11 (descarga a un temporal y lo mueve al final), y saca por la salida estándar una línea
      JSON con `file`, `source_url`, `page_url`, `width`, `height` y `bytes`. El Researcher copia
      `file`, `source_url` y `page_url` al YAML, y pone `retrieved`, `license`, `attribution` y
      `source_id` leyendo la página de licencia, como hasta ahora (ADR-0001). El script no lee
      licencias ni escribe YAML.
11. **Cómo se comprueba que es una imagen de ≤ 1280 px.** Sin dependencias nuevas (la raíz solo
    tiene `yaml`; Sharp está en `web/`), leyendo la cabecera del fichero:
    - formato por la firma de los primeros bytes: JPEG (`FF D8 FF`) o PNG (`89 50 4E 47 0D 0A 1A
      0A`); la extensión tiene que coincidir (`.jpg`/`.jpeg` o `.png`). Cualquier otra cosa (HTML de
      una página de error, WebP, SVG, GIF) se rechaza; ADR-0012 guarda el JPEG o PNG tal como llega;
    - ancho y alto del bloque `IHDR` del PNG o del marcador `SOF` del JPEG; ancho > 1280 se rechaza.
      La API puede devolver una miniatura mayor que la pedida [2], así que el ancho se comprueba
      siempre, no se supone;
    - la **misma función** la usa `factory/evals.ts` (regla 10 de `data-model.md`) sobre el
      fichero ya guardado, para que la CI compruebe lo que hay en el repositorio y no solo lo que el
      script dijo.
    El script **no reduce** imágenes: no hay con qué sin añadir Sharp a la raíz. En Commons no hace
    falta (se pide la miniatura de 1280). Una imagen de sala de prensa de más de 1280 px se rechaza
    como descarga fallida (punto 12) hasta que se decida cómo reducirla (pregunta abierta).
12. **Si la descarga falla** (ADR-0012, punto 4): error de red, 403, 404, 429, respuesta que no es
    JPEG o PNG, o ancho > 1280. El script sale con código distinto de 0, una línea con la causa y
    **sin dejar ningún fichero** en `data/images/`. No reintenta solo. El Researcher no escribe la
    entrada en `images`; anota en `open_questions` la `page_url` y la causa; puede probar otra
    imagen de la misma fuente o la siguiente de RF-8, y si no hay, deja `images: []` y la web
    muestra la silueta (CA-17). Si el modelo ya tenía una imagen válida, se queda la anterior. El
    siguiente refresco mensual (punto 6) vuelve a intentarlo, como con una fuente que no carga
    (punto 7). Si a pesar de todo el YAML cita un `file` que no existe, el eval de la factoría lo
    rechaza (`eval_failed`, sin PR) y, si llegara por otra vía, la CI también.
13. **Migración de las imágenes actuales** (las 11 de ADR-0012: 6 con `url` de página `File:` y 5
    con `url` de `upload.wikimedia.org`). **La hace el Researcher**, porque releer la licencia es
    obtener datos de producto (ADR-0001), en una tarea de la cola que una persona añade cuando el
    script y el paso 1 del punto 14 están en `main`. Por cada entrada:
    - si `url` es una página `File:`, pasa a `page_url`;
    - si `url` es un fichero de `upload.wikimedia.org`, la página `File:` se obtiene del nombre del
      fichero en la ruta y se confirma con la API (`iiprop=url` da la URL de la página de
      descripción [2]); pasa a `page_url`;
    - el script descarga la miniatura de 1280 px y da `file` y `source_url`. El `source_url` es el
      de lo descargado ahora, no el `url` antiguo (que puede ser el original, más ancho);
    - el Researcher relee en `page_url` licencia y autor, actualiza `retrieved` a la fecha de la
      descarga y borra `url`. Si la licencia ha cambiado o ya no permite el uso (PRD-001, RF-8), la
      entrada se quita y se anota en `open_questions`; si la descarga falla, punto 12.
    Una PR, todas las marcas afectadas. No se migra a mano ni con un script que escriba los YAML:
    sería obtener y escribir datos de producto fuera del Researcher.
14. **Validador y orden de activación**, para que `main` no se ponga en rojo:
    1. **PR 1 (desarrollador, toca `factory/`; la fusiona una persona):** el script; el permiso
       del Researcher; la regla 10 de `data-model.md` en `rawShape` para la forma nueva (claves
       `file`, `source_url`, `page_url`, `source_id`, `retrieved`, `license`, `attribution`; `file`
       existe, bajo `data/images/<brand>/<slug>/` del propio YAML, y pasa el punto 11); `url`
       pasa a ser una clave **transitoria**: una entrada con solo la forma antigua (`url`, sin
       `file`, `source_url` ni `page_url`) da **aviso** en la validación de todo `data/raw/`
       (CI), y **fallo** en el eval de la factoría (ADR-0004), que solo mira lo que la ejecución ha
       tocado: el Researcher que toque un fichero sin migrar tiene que migrarlo. Una entrada que
       mezcle `url` con las claves nuevas es fallo siempre. Con esto la CI sigue en verde con las
       11 imágenes sin migrar, esté ya o no el paso de CI del punto 2.
    2. **PR 2 (Researcher, solo `data/`):** la migración del punto 13. Su CI tiene que salir sin
       avisos de forma antigua.
    3. **PR 3 (desarrollador, `factory/`):** quita `url` de las claves admitidas; desde ahí es
       clave desconocida y fallo (regla 2 de `data-model.md`). Como la CI valida todo `data/raw/`,
       si quedara alguna entrada sin migrar la que se pone en rojo es esta PR, no `main`.
    Mientras tanto, el build (#112) muestra la silueta para toda entrada sin `file` válido
    (ADR-0012, Consecuencias). Ficheros de `data/images/` que ningún YAML cita: solo **aviso**, no
    fallo, porque el Researcher no puede borrar ficheros (no tiene `rm`; ver Consecuencias).

## Consecuencias
**Buenas**
- Un solo validador para la factoría y para la CI: el esquema de ADR-0008 y la procedencia de
  ADR-0001 se comprueban en un sitio, con las pruebas que ya tiene.
- Todo cambio en `data/raw/` o en el registro, venga de quien venga, pasa por la misma regla.
  Desbloquea la condición (b) del punto 7 de ADR-0011.
- La CI solo se pone en rojo por lo que trae el commit: el paso del tiempo y las webs de terceros
  no bloquean fusiones.
- La antigüedad de los datos tiene un umbral explícito y un sitio donde se ve.

**Malas (las que se olvidan)**
- **La PR que añada el paso a la CI tiene que dejar `data/raw/` en verde en el mismo cambio.**
  `overview.md` da la migración de Cupra y Polestar como pendiente; no he podido ejecutar el
  validador sobre todos los ficheros en esta ejecución, así que no sé si hoy pasan. Si no pasan,
  esa PR incluye la migración o la CI de `main` queda en rojo y bloquea toda fusión automática.
- **Esa PR toca `factory/` y `.github/`**: la hace el desarrollador y la fusiona una persona
  (ADR-0002 y ADR-0011). Hasta entonces, nada de esta ADR actúa.
- **Los avisos no obligan a nada.** Un `::warning` no pone la CI en rojo y nadie tiene que leerlo.
  Si nadie añade los refrescos a la cola, los precios envejecen igual que hoy, solo que se ve.
- **45 días de antigüedad no son 45 días de precio correcto.** Una oferta puede terminar al día
  siguiente de leerla (caso Raval). El visitante ve la fecha en la ficha (PRD-002, CA-9), pero no
  en la tarjeta del catálogo, que no muestra `retrieved` (PRD-001, RF-1).
- **Dos lecturas del esquema siguen existiendo:** la estricta de `evals.ts` y la tolerante de
  `web/src/lib/data.ts`. Esta ADR no las une; pueden discrepar (algo que la CI acepta y el build
  descarta, o al revés). Una prueba que pase el mismo ejemplo de `data-model.md` por las dos
  reduciría el riesgo; no se decide aquí.
- **Coste del refresco:** ~3 USD al mes de los 7 del Researcher con la estimación de ~0,24 USD por
  marca, que sale de ejecuciones de alta, no de refrescos. Con el tope por ejecución (1,50 USD), 13
  marcas podrían costar hasta 19,5 USD. Si el coste real se acerca, o hay que subir el presupuesto o
  espaciar el refresco; se mide en los primeros refrescos.
- **Ejecutar sobre todo `data/raw/` en cada PR** hace la CI algo más lenta a medida que crecen las
  marcas. Son lecturas de YAML locales; no lo he medido.
- **Una fuente marcada `broken` no se arregla sola**: depende del siguiente refresco del
  Researcher, y mientras tanto sus valores siguen publicados con su fecha y su aviso.

**Imágenes (enmienda del 2026-10-07)**
- Buena: el fichero, su comprobación y el YAML que lo cita entran juntos en la PR; el `User-Agent`
  y la comprobación de formato y ancho no dependen de que el modelo los recuerde.
- Buena: la CI comprueba el fichero guardado con la misma función que el script, sin red.
- Mala: **el Researcher gana un permiso `Bash`**, aunque limitado a un script. Ese script tiene red
  y escribe en `data/`; un fallo en él (por ejemplo, en cómo arma la ruta con el `<nombre>` que le
  pasa el modelo) escribiría donde no debe. Tiene que validar `brand`, `slug` y `<nombre>` con
  `[a-z0-9-]` y negarse a escribir fuera de `data/images/`, y llevar pruebas. Además el hook de
  escritura (`FACTORY_WRITE_PATHS`) vigila las herramientas del agente; **no he comprobado** si
  también cubre lo que escribe un proceso lanzado con `Bash`. Comprobado al aceptar (2026-10-07):
  **no lo cubre**; la barrera es solo el script.
- Mala: **nada impide que el modelo escriba a mano** `file`, `source_url` o `page_url` sin lanzar
  el script; lo que lo frena es que `file` tiene que existir y ser una imagen válida. Un
  `source_url` inventado que no corresponde al fichero no lo detecta nadie.
- Mala: **ficheros huérfanos.** El Researcher no puede borrar: una imagen sustituida o cuya
  entrada se quita se queda en `data/images/` (y en el historial, ADR-0012) hasta que una persona
  la borre. Solo hay aviso.
- Mala: **imágenes de prensa de más de 1280 px no se pueden guardar** hasta decidir cómo reducirlas;
  hoy cuentan como descarga fallida y la tarjeta muestra la silueta.
- Mala: **tres PR en orden y dos de ellas en `factory/`**, que hace el desarrollador y fusiona una
  persona. Hasta la PR 1 no se puede añadir ninguna imagen que cumpla ADR-0012; hasta la PR 2 no se
  publica ninguna (ADR-0012, Consecuencias). Si la PR 3 se olvida, la clave `url` queda admitida
  con aviso indefinidamente.
- Mala: **las PR con imágenes no entran en la fusión automática de ADR-0011**, que solo admite PR
  que toquen `data/raw/` o `docs/bitacora/`; una PR con ficheros en `data/images/` (la migración
  incluida) la fusiona una persona. Ampliar esa lista es cambiar ADR-0011; no se decide aquí.
- Mala: la lectura de cabeceras JPEG y PNG es código propio, no una librería; un JPEG raro (varios
  marcadores antes del `SOF`) puede rechazarse por error. Se nota como descarga fallida, no como
  imagen mala publicada.
- Mala: el número de imágenes a migrar es el de ADR-0012 y la tarea (11); **no lo he recontado**
  en esta ejecución, y la tarea de migración debe partir de lo que haya en `data/raw/` ese día.
  Recuento al aceptar (2026-10-07): **22** (6 con página `File:` y 16 con fichero de
  `upload.wikimedia.org`), más las que traigan las marcas nuevas.

**Preguntas abiertas** (al aceptarla, el 2026-10-06, el responsable deja las tres primeras como están:
los precios viejos siguen publicados con su fecha, no se añade fecha de fin de oferta y los refrescos
los encola una persona)
- **Producto:** ¿se deja de mostrar un precio pasado un plazo (por ejemplo «Precio por confirmar»
  si `retrieved` tiene más de N días)? ¿Debe la tarjeta mostrar la fecha del precio? Hoy ningún
  PRD lo dice; esta ADR solo avisa.
- **Esquema (ADR-0008):** ¿se añade la fecha de fin de una oferta `financed` como campo propio,
  para avisar el día que caduca en lugar de a los 45 días?
- ¿Quién añade a la cola los refrescos de las marcas vencidas: una persona (lo de hoy) o un paso
  sin modelo del orquestador? Otra decisión, que toca `factory/`.
- ¿Es el mes la frecuencia adecuada para marcas que cambian ofertas cada pocas semanas? Revisar con
  el historial de cambios de precio de los primeros refrescos.
- ¿Cuánto cuesta de verdad un refresco frente a un alta de marca? Sin medir.
- ~~¿Pasan hoy todos los ficheros de `data/raw/` las tres comprobaciones?~~ Sí: el 2026-10-06, los 25
  ficheros (24 de `data/raw/` y el registro) pasan sin fallos. Ojo: el validador aún comprueba la forma antigua de
  `images`; al adaptarlo a ADR-0012, las 11 imágenes con `url` fallarán hasta que se migren.
- ~~**Descarga de imágenes (ADR-0012):** esta ADR no dice cómo se descargan los ficheros a
  `data/images/` ni cómo se migran las 11 imágenes actuales.~~ Respondida en la enmienda del
  2026-10-07 (puntos 10 a 14). Quedan abiertas:
  - ~~¿Qué contacto lleva el `User-Agent` (URL de `siete3.com`, correo)?~~ La URL
    `https://siete3.com` (2026-10-07), para no publicar un correo en el repositorio.
  - ¿Cómo se reduce una imagen de sala de prensa de más de 1280 px (Sharp en la raíz, u otra vía)?
    Hoy se rechaza.
  - ~~¿Cubre el hook de escritura lo que escribe un proceso lanzado por `Bash`?~~ **No**
    (comprobado el 2026-10-07): `.claude/hooks/guard_paths.ts` solo compara el texto de la orden
    `Bash` con `BANNED_BASH`; `FACTORY_WRITE_PATHS` se aplica a `Write`, `Edit`, `MultiEdit` y
    `NotebookEdit`. La única barrera es el propio script (validar `[a-z0-9-]` y negarse a escribir
    fuera de `data/images/`), con sus pruebas.
  - ¿Cuántas peticiones por segundo admite Wikimedia para este uso? La política de `User-Agent` no
    lo dice [3] y remite a sus pautas de uso de la API, que no he leído; el script va de una en una.
  - ¿Quién borra las imágenes huérfanas, y cada cuánto?

**Fuentes**
- [1] https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
  (consultada el 2026-10-04): sintaxis de `::warning` y `::error` con `file` y `line`; el resumen
  de `GITHUB_STEP_SUMMARY` en Markdown, hasta 1 MiB por paso. La página no dice si hay un límite
  de anotaciones por paso.
- [2] https://www.mediawiki.org/wiki/API:Imageinfo (consultada el 2026-10-07): `iiprop=url` «da la
  URL del fichero y de la página de descripción»; con `iiurlwidth` devuelve la URL de una imagen
  escalada a ese ancho, pero «ya no se garantiza» que coincida con el ancho pedido: puede devolver
  una miniatura pregenerada mayor. `iiprop=mime` y `iiprop=size` dan tipo MIME, bytes, ancho y alto.
  La página no lista todos los nombres de campo de la respuesta ni dice qué devuelve si el original
  es más estrecho que `iiurlwidth`: hay que comprobarlo al implementar.
- [3] https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy
  (consultada el 2026-10-07): formato `<cliente>/<versión> (<contacto>) <librería>/<versión>`, con
  contacto por correo, URL o usuario de la wiki; los scripts sin `User-Agent` informativo «pueden
  ser bloqueados sin aviso». No trata de límites de peticiones ni de `Retry-After`.
- Repositorio (2026-10-07): `factory/budgets.yaml` (`allowed_tools` y `write_paths` del
  Researcher), `factory/orchestrator.ts` (`execute`: evals antes del commit y la PR),
  `factory/evals.ts` (`IMAGE` y la comprobación de `images`), `.github/workflows/ci.yml` (sin paso
  de validación de datos), `.claude/agents/researcher.md` (`tools:`).
- Repositorio (2026-10-04): `factory/evals.ts`, `.github/workflows/ci.yml`, `web/src/lib/data.ts`,
  `factory/budgets.yaml`, `factory/queue.yaml`, `data/sources/registry.yaml`,
  `data/raw/cupra/raval.yaml`.
