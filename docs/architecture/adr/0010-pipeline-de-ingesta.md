# ADR-0010 — Pipeline de ingesta: validación de todo `data/raw/` en la CI y refresco mensual por marca

- **Estado:** aceptada (2026-10-06). Falta una enmienda sobre la descarga de imágenes de [ADR-0012](0012-imagenes-de-los-modelos.md), en la cola del Arquitecto
- **Fecha:** 2026-10-04

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
- **Descarga de imágenes (ADR-0012):** esta ADR no dice cómo se descargan los ficheros a
  `data/images/` ni cómo se migran las 11 imágenes actuales. ADR-0012 delega ese «cómo» aquí; queda
  para una enmienda.

**Fuentes**
- [1] https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
  (consultada el 2026-10-04): sintaxis de `::warning` y `::error` con `file` y `line`; el resumen
  de `GITHUB_STEP_SUMMARY` en Markdown, hasta 1 MiB por paso. La página no dice si hay un límite
  de anotaciones por paso.
- Repositorio (2026-10-04): `factory/evals.ts`, `.github/workflows/ci.yml`, `web/src/lib/data.ts`,
  `factory/budgets.yaml`, `factory/queue.yaml`, `data/sources/registry.yaml`,
  `data/raw/cupra/raval.yaml`.
