🏭 Veredicto: no puedo darla por buena sin que una persona compruebe las fuentes. El formato y la honestidad de los datos están bien, pero no he podido leer `ofertas.opel.es` ni Wikimedia Commons desde aquí. Eso afecta al estado de los tres modelos y a la licencia y atribución de las tres imágenes. CI en verde (4 evals). Revisado el SHA 7dab7ff59ad4039c68ff0b8f7e46f39e83d369a5.

**Criterios de aceptación** (los de la tarea; no cierra ninguna historia)
- Fuentes de Opel en el registro: cumplido. `opel-es` y `opel-press`, con la limitación escrita (403 en `www.opel.es` y en la prensa de Stellantis) y `image_license` vacío en ambas, así que no se publican imágenes de ellas.
- Modelos en `data/raw/opel/` con el esquema de ADR-0008: cumplido en forma. Los tres llevan `brand`, `brand_name`, `model`, `status` con fuente, URL, fecha y tier, `versions`, `images` con `license` y `attribution`, y `needs_review: false`.
- `segment` y `launch` con fuente si la hay: cumplido por omisión. Quedan en `null` y lo explican en `open_questions`. Es lo que pide ADR-0001 (nada se inventa).
- Imágenes de Commons con licencia que permita uso comercial, con `license` y `attribution`: no verificado (ver abajo). Las licencias declaradas (CC-BY-SA-4.0 ×2 y CC-BY-SA-3.0-de) están entre las permitidas por el registro.

**Hallazgos**
1. Hace falta una persona (o una ejecución con acceso de red) que compruebe las tres imágenes en su página de Commons: licencia, autor y que la ruta `upload.wikimedia.org/.../5/51/…` (y las equivalentes `9/9d` y `c/c8`) sea la del fichero. No he podido hacerlo.
2. Lo mismo para el estado: que `ofertas.opel.es/particulares?model=corsa|mokka|frontera` diga lo que citan las `note` («Disponible en Gasolina, Híbrido o Eléctrico»). Es lo único que sostiene `status: on_sale`. Coherente con lo que dice el registro, pero no leído por mí.
3. Utilidad baja, no un fallo: los tres modelos salen sin precio, segmento, lanzamiento, autonomía ni potencia, con una sola versión de nombre genérico («Mokka Electric», «Frontera Electric»). Entran en el catálogo con `price: null`, y por RF-12 no aparecerán en las páginas de segmento, precio ni autonomía. Es lo que deja el 403 de `www.opel.es`, y está documentado. Queda pendiente un PVP o precio financiado BEV en una página T1 legible.
4. Menor: la imagen de `corsa-electric.yaml` es de un «Corsa-e» de 2023, no un «Corsa Electric». Está avisado en `open_questions`, pero la atribución no lo dice. Si alguien lo ve como incoherente, hay que cambiar la foto.
5. Menor: `data/sources/registry.yaml` guarda en `models` y `offers_corsa_electric` URL que «solo constan por buscador». Está señalado en el comentario de cada una, así que no es un hallazgo, pero conviene no usarlas como fuente de un dato hasta que se lean.
6. Bien resuelto: no se guarda ningún precio térmico como si fuera el eléctrico (23.700 € y 23.800 €) y el motivo queda escrito en la fuente y en cada fichero.

**Lo que no he podido comprobar**
- El contenido de `ofertas.opel.es` y las páginas de fichero de Commons (licencia, autor, ruta). No tengo lectura de red en esta tarea.
- Que los 4 evals del Researcher validen el esquema: me fío de la CI, que está en verde.
