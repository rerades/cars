# ADR-0021 — Segmento asignado por una persona (clasificación editorial)

- **Estado:** aceptada (2026-10-27). Enmienda [ADR-0001](0001-fuentes-de-datos.md) (regla 8 nueva),
  [ADR-0008](0008-esquema-unico-de-datos-raw.md) (valor con fuente de `segment`) y
  [ADR-0011](0011-publicacion-de-los-agentes.md) (una condición más para no fusionar sola)
- **Fecha:** 2026-10-27

## Contexto
La pregunta de los modelos sin segmento de PRD-001 (sección 8) se resolvió el 2026-10-26: **A**
(aplicar la regla igual en todas las fichas, T3 vale) y **B** (tabla cerrada de equivalencias de
`data-model.md`, sección 3) ya, y la **alternativa C**, «el responsable asigna el segmento de los
modelos sin clasificación», a una ADR antes de decidirse, «porque choca con ADR-0001». Esta es esa ADR.

Lo que obliga a decidir:
- **PRD-001, RF-11:** el segmento «sale de lo que dice una fuente (vale una de tier 3)» y «nunca se
  deduce por tamaño, precio ni parecido». **RF-12:** sin segmento, «por confirmar» y el modelo no sale
  al filtrar por segmento. Con los datos del 2026-10-26 (análisis de PRD-001, sección 8), 104 de 145
  fichas (72 %) no tenían segmento, y el propio análisis estima que tras A y B el 55 % o más seguirá
  sin él; el grupo más grande que B no recupera son los que la fuente llama «SUV» o «crossover» sin
  tamaño (unas 22 fichas). Afecta a los filtros (RF-2), a las páginas `/segmentos/…` (RF-10, CA-12),
  a los relacionados de PRD-002 (RF-15) y a los rankings filtrados de PRD-005 (RF-8, CA-8).
- **ADR-0001, reglas 2 y 7:** cada valor lleva `source_id`, `url`, `retrieved` y `tier` (T1 a T3), y
  «ningún dato se inventa ni se estima: si no hay fuente, el campo queda vacío». Una decisión de una
  persona no tiene URL de terceros ni encaja en T1–T3.
- **ADR-0008 y `data-model.md`, secciones 2, 3 y 6:** `segment` es un `Sourced`; la regla 3 exige
  `source_id` en el registro, y `factory/evals.ts` (comprobación `rawData` y del registro) solo
  acepta `T1`, `T2` y `T3` (leído en el repositorio el 2026-10-27, líneas 91 y 118).
- **Visión, principio 0:** «Todo dato tiene su fuente y su fecha».
- **PRD-002, RF-9:** cada dato mostrado, el segmento incluido, «enlaza a la URL exacta donde se
  leyó», y lo que no es T1 lo dice («fuente no oficial»).
- **ADR-0011:** el orquestador fusiona solo las PR que solo tocan `data/raw/`, `data/images/` o
  `docs/bitacora/` con `review:ok`. **ADR-0020:** el verificador no comprueba enumeraciones como
  `segment` (su sección de consecuencias lo dice), así que nada automático contrasta hoy un segmento
  con su fuente.
- **ADR-0001, primer párrafo:** solo el Researcher obtiene datos del producto. Asignar un segmento por
  criterio propio no es «obtener de fuera», pero es escribir un dato del producto en `data/raw/`.

Esta ADR no investiga herramientas externas: no hay ninguna comparación que dependa de documentación
de terceros, y no se ha consultado la red.

## Opciones consideradas
### A. Excepción acotada a `segment`: valor con fuente «editorial», nivel propio `E`, solo escrito por una persona
Se describe en la Decisión.

### B. Reutilizar `T3` con una fuente «siete3» en el registro
Encaja en el eval y en el esquema sin tocar nada. **Se descarta** porque miente sobre el nivel: T3 es
«medios del motor reconocidos, bases de datos especializadas» (ADR-0001), y la web mostraría el valor
como «fuente no oficial» igual que una revista. El visitante no podría distinguir lo que dijo un
tercero de lo que decidimos nosotros, que es justo lo que pide la tarea, y ADR-0001, regla 3
(«prevalece el nivel más alto»), dejaría empatar a la decisión propia con un medio.

### C. Nivel `T4` (o `E`) general, para cualquier campo
Un nivel editorial nuevo en la jerarquía de ADR-0001, sin restricción de campo. **Se descarta** porque
abre la puerta a lo que la regla 7 prohíbe en los datos medidos (precio, autonomía, batería…): una
vez existe el nivel, nada impide «corregir a mano» un precio. La necesidad de PRD-001 es solo la
clasificación, que no es un dato medido (ADR-0008 ya lo dice: «`segment` es una clasificación, no un
dato medido»). Si otro campo lo necesita, que lo pida su PRD y se amplíe esta excepción.

### D. Campo aparte (`segment_editorial`) fuera del formato `Sourced`
El segmento de fuente y el editorial en dos claves. **Se descarta**: la web, los filtros, las páginas
de segmento, el JSON del comparador (ADR-0014) y el de los rankings (ADR-0015) tendrían que fusionar
dos campos en cada sitio; el eval `rawData` no comprobaría su procedencia (solo recorre objetos con
`value`), y se podrían tener los dos a la vez con valores distintos sin regla para elegir.

### E. Que el Researcher proponga el segmento y la persona lo apruebe en la PR
Quita trabajo a la persona. **Se descarta**: lo que el agente propondría es justo una deducción por
tamaño, precio o parecido (no hay fuente, por definición del caso), que RF-11 y la regla 7 prohíben al
agente; y una PR de `data/raw/` del Researcher con `review:ok` se fusiona sola (ADR-0011), así que la
«aprobación» podría no llegar a ocurrir. La persona puede leer lo que el Researcher anotó en
`open_questions`, que es lo que ya hace hoy.

### F. No hacer C: quedarse con A y B
Es lo que hay hoy y sigue siendo válido si esta ADR se rechaza. **No se elige aquí** porque el
responsable pidió estudiar C precisamente porque A y B dejan, según la estimación de PRD-001, más de la
mitad del catálogo fuera de los filtros por segmento. La decisión final de si C entra o no es de
Producto (ver Consecuencias).

## Decisión
**Una persona puede asignar el `segment` de un modelo que ninguna fuente clasifica, como valor
`Sourced` con `source_id: editorial` y nivel `E`, válido solo en `segment`, que cualquier fuente T1–T3
sustituye y que la web muestra como «clasificación editorial».**

Detalles:

1. **Es una excepción de ADR-0001, no un nivel de la jerarquía.** Regla 8 nueva en ADR-0001: «El
   segmento (PRD-001, RF-11) puede ser una clasificación editorial cuando ninguna fuente lo clasifica
   tras aplicar la regla y la tabla de equivalencias. Se marca con `tier: E`, solo lo escribe una
   persona y nunca se usa en otro campo». La regla 7 (no estimar) sigue intacta para todo lo demás.
2. **Qué se guarda en el YAML** (forma `Sourced` de siempre, con valores fijos):
   ```yaml
   segment:
     value: suv_compacto
     source_id: editorial
     url: "<URL de la PR que introduce el valor>"
     retrieved: 2026-10-27        # fecha de la decisión
     tier: E
     note: "Kia lo presenta como «SUV» sin tamaño (kia.com/es, 2026-10-20). Criterio: …"
   ```
   - `note` es **obligatoria** con `tier: E` y dice qué dicen las fuentes leídas y el criterio aplicado.
     Es el único rastro del porqué.
   - `url` es la PR que lo introduce: es el sitio donde queda quién lo decidió y cuándo. No se enlaza
     desde la web (punto 5).
   - La entrada de `open_questions` que anotaba la falta de segmento se conserva: sigue siendo cierto
     que ninguna fuente lo clasifica, y es lo que el Researcher vuelve a intentar en cada refresco.
3. **Registro:** un fichero `data/sources/editorial.yaml` con `id: editorial`, `tier: E`, un `name`
   («Clasificación editorial») y en `urls` la de esta ADR en el repositorio. Lo crea una persona. Es la
   única fuente con `tier: E`.
4. **Quién lo escribe y qué se comprueba:**
   - Solo una persona, en una PR propia. El Researcher **no** escribe `tier: E`, no cambia un valor `E`
     por otro `E` ni lo borra dejándolo `null`. Sí lo **sustituye** cuando encuentra una fuente T1–T3
     que lo clasifique según RF-11 y la tabla de equivalencias (es la regla 3 de ADR-0001: prevalece el
     nivel más alto), y lo dice en la PR si el valor de la fuente difiere del editorial.
   - La comprobación de `data/raw/` (`factory/evals.ts`, la que comparten el eval de la factoría y
     `validate-data.ts`, ADR-0010) acepta `tier: E` **solo** en `segment`, solo con `source_id:
     editorial` y con `note`; la del registro acepta `E` solo en `editorial.yaml`.
   - El eval de las ejecuciones de agentes falla si la ejecución **añade o cambia** un `segment` con
     `tier: E` (lo distingue comparando con `main`).
   - **Enmienda de ADR-0011:** `run.ts --merge` no fusiona ninguna PR cuyo diff añada o cambie un
     `tier: E`, ni la que toque `data/sources/editorial.yaml`; la deja para una persona.
5. **Cómo se distingue en la web:**
   - Filtros, páginas `/segmentos/…`, relacionados, comparador y rankings lo tratan como cualquier
     segmento: es el objetivo de la alternativa C.
   - En la ficha (PRD-002, RF-9) la indicación del segmento dice «clasificación editorial» con la fecha
     (`retrieved`) y la `note`, **sin enlace**, en lugar de «fuente no oficial» y la URL. La PR no es una
     fuente para el visitante.
   - Si la tarjeta del catálogo (PRD-001, RF-1) lo marca también es una decisión de Producto, abierta.
6. **Qué cambia al aceptar (no en esta ADR):** RF-11 de PRD-001 y RF-9 de PRD-002 (los cambia
   Producto); `data-model.md`, secciones 2, 3, 6 y 8 (Arquitecto); la comprobación de `factory/evals.ts`
   y `merge.ts` (Desarrollador); `.claude/agents/researcher.md` (qué hace con un `E`); y la web
   (la indicación de la ficha).

## Consecuencias
**Buenas**
- La cobertura de segmento puede llegar al 100 % de lo publicado, sin que ningún agente estime nada:
  la regla 7 sigue valiendo para los agentes y para todos los demás campos.
- Se mantiene el formato `Sourced` único (ADR-0008): la web, el comparador y los rankings leen el
  segmento igual que hoy, y el eval sigue exigiendo los cuatro nombres de ADR-0001, regla 2.
- El visitante sabe qué segmento viene de una fuente y cuál decidimos nosotros, y el repositorio
  guarda quién y por qué (PR y `note`).
- Un valor editorial no es permanente: cuando aparece una fuente, la sustituye.

**Malas (las que se olvidan)**
- **Rompe el principio 0 de la visión en su lectura literal.** «Todo dato tiene su fuente» se cumple
  solo si se acepta que «criterio editorial con fecha y nota» es una fuente. No hay una URL de
  terceros que el visitante pueda abrir para comprobarlo. Es la razón por la que esta ADR no se puede
  aceptar sin que Producto cambie RF-11 («el que dice la fuente» pasa a «el que dice la fuente o, si no
  hay ninguna, el que decide la persona») y RF-9 de PRD-002 (el segmento editorial no enlaza).
- **Choca con «nunca se deduce por tamaño, precio ni parecido» (RF-11).** Lo que hará la persona es,
  en la práctica, juzgar por tamaño y por parecido. La ADR no lo hace legítimo; solo lo hace visible y
  deja que lo decida alguien que responde por ello.
- **La persona es un cuello de botella permanente.** Cada modelo nuevo sin clasificación espera a que
  alguien lo mire; la factoría no puede cerrarlo sola. Con unas 60 a 80 fichas pendientes tras A y B
  (estimación de PRD-001, no comprobada), la primera pasada es trabajo manual de horas.
- **Sin criterio escrito, dos personas (o la misma en dos meses) clasificarán distinto.** La `note`
  dice el porqué de cada caso, pero no hay una regla común. Si se quiere, hay que escribirla (pregunta
  abierta).
- **Más reglas en la comprobación y en la fusión.** `tier: E` es un caso especial en tres sitios
  (eval, validador del registro y `merge.ts`), y cada uno es una ocasión de que se cuele un `E` escrito
  por un agente. La prueba de que el eval rechaza un `E` añadido por una ejecución es obligatoria.
- **`url` apunta a una PR del repositorio.** Si el repositorio no es público, el enlace solo sirve a
  quien tiene acceso; por eso la web no lo enlaza. Si un día cambia de sitio, la URL se rompe y el
  validador de ADR-0010 avisará como con cualquier fuente rota.
- **Un `E` no se refresca solo.** El refresco mensual de ADR-0010 avisa por antigüedad (más de 45 días)
  y eso hará saltar avisos en todos los editoriales cada mes, aunque la decisión no caduque. Hay que
  decidir si `E` queda fuera de ese aviso (pregunta abierta).

### Preguntas abiertas
1. ~~**Producto:** ¿se acepta C con estas condiciones? Exige cambiar RF-11 (PRD-001) y RF-9 (PRD-002).~~
   Sí (2026-10-27, el responsable). Producto cambia RF-11 y RF-9.
2. ~~**Producto:** ¿la tarjeta del catálogo marca el segmento editorial o solo la ficha?~~ Solo la
   ficha (2026-10-27): la tarjeta lo muestra como cualquier segmento.
3. ~~**Producto:** ¿quién es «la persona»: solo el responsable del producto o cualquiera con permiso de
   fusión en el repositorio?~~ Cualquiera con permiso de fusión en el repositorio (2026-10-27).
4. ~~**Producto:** ¿hace falta un criterio escrito común (por ejemplo, qué cuenta como SUV compacto) o
   basta la `note` de cada caso? Si hace falta, ¿dónde vive y es público?~~ Sí: un criterio común en
   `data-model.md`, junto a la tabla de equivalencias, y la `note` lo cita (2026-10-27). Es público.
5. **Arquitectura (posterior):** ¿el aviso de antigüedad de ADR-0010 ignora los valores `E`?
6. ~~¿Es público el repositorio? Condiciona si la `url` de la PR sirve a alguien fuera del proyecto.~~
   Sí, es público (comprobado el 2026-10-27).
