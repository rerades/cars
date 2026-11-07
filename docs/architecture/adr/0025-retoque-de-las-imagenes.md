# ADR-0025 — Retoque de las imágenes de los modelos

- **Estado:** aceptada (2026-11-07). Enmienda [ADR-0012](0012-imagenes-de-los-modelos.md), punto 6 (además de
  las modificaciones técnicas, se admite el retoque de esta ADR), y amplía la forma de `images` de
  [`data-model.md`](../data-model.md).
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
   - Busca la matrícula y la tapa con un rectángulo liso.
   - **Comprueba** que, dentro de la máscara y fuera de la matrícula, cada píxel es igual al de la foto
     original reducida, antes de codificar. Si no, falla y no escribe nada.
   - Si el PNG pasa de 2 MB (ADR-0011), reduce el ancho hasta que cabe.
   - Escribe `<nombre>.png` junto al original, que borra, y una hoja «antes y después» en
     `ops/retouch/<run_id>/` para la PR.
   - Imprime una línea JSON con `file`, `edits`, las dimensiones y el resultado de la comprobación, como
     `fetch-image.ts`.
3. **El agente**, después del script, mira el PNG y lo rechaza si ve una máscara mala: trozos de fondo
   pegados, partes del coche que faltan (retrovisores, antena, ruedas), un cartel o una persona pegados al
   coche, o una matrícula legible. Si lo rechaza, restaura el original con `git checkout` y lo anota como en
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
   rechazos.
7. **Permisos y presupuesto.** `retoucher` en `budgets.yaml`, con `network: false`, `write_paths:
   [data/images/, data/raw/, ops/retouch/, docs/bitacora/]`, y en `allowed_tools` el script y
   `git checkout -- data/images/` (no hay quien apruebe permisos en `-p`). El eval de la factoría
   rechaza una ejecución del Retocador que cambie en `data/raw/` algo que no sea `file` y `edits` de una
   imagen, u `open_questions`.
   Los importes, en la PR de implementación, a partir del coste del piloto.
8. **Orden.** (1) Script y prueba; (2) agente, presupuesto y eval; (3) piloto con los cinco modelos de la
   prueba; (4) el resto del catálogo, por marcas, empezando por el Researcher con el criterio nuevo.

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
- Al aceptarla: estado de ADR-0012, línea en `overview.md`, regla 10 de `data-model.md` y `tarjeta-modelo.md`
  (en esta misma PR), y entrada `decision` en la bitácora.
