# ADR-0012 — Dónde se sirven las imágenes de los modelos

- **Estado:** propuesta
- **Fecha:** 2026-10-02

## Contexto
Bloquea la historia #112 y el test de cookies de la #41. Requisitos y decisiones que obligan:

- **PRD-001, RF-8 y RF-1:** cada tarjeta muestra una imagen del modelo de una fuente registrada, con
  su atribución si la licencia lo exige; primero Wikimedia Commons (CC0, CC BY, CC BY-SA o dominio
  público), después la sala de prensa con términos escritos y, si no hay, la silueta del segmento.
- **PRD-001, CA-10 y CA-17:** toda imagen mostrada tiene fuente y licencia registradas; sin imagen
  con licencia, silueta.
- **PRD-001, RNF-5 y CA-7:** ninguna página del catálogo crea cookies. **Hechos comprobados el
  2026-10-01 (dato de la tarea):** una imagen pedida a `upload.wikimedia.org` responde con
  `Set-Cookie: WMF-Uniq`, y las páginas de `commons.wikimedia.org` ponen cuatro cookies. Enlazar la
  imagen desde Wikimedia en la tarjeta incumple RNF-5 y CA-7.
- **PRD-001, RNF-2:** LCP < 2,5 s en móvil 4G. La imagen de la tarjeta es candidata a elemento LCP.
- **ADR-0001:** cada dato lleva fuente, URL y fecha, y solo el Researcher obtiene datos de producto.
- **ADR-0003 y ADR-0009:** sitio estático de Astro, publicado como *static site* de Render en el
  workspace Hobby, con 5 GB/mes de salida y 500 minutos de build compartidos con `erades.com`.
  ADR-0009 promete que «todo lo publicado se puede reconstruir desde un commit». El build tarda hoy
  unos 16 s.
- **ADR-0008 y `data-model.md`:** la forma de `images` es `url`, `source_id`, `retrieved`, `license`,
  `attribution`, pero no dice qué es `url`. En `data/raw` hay 11 imágenes: 6 `url` son páginas
  `File:` de Commons (HTML) y 5 son ficheros de `upload.wikimedia.org` (dato de la tarea). Con una
  página HTML no se puede pintar la imagen; con solo el fichero no hay enlace a la página que
  acredita la licencia.

Hay tres preguntas: (1) cómo se consigue que el visitante no pida nada a terceros para ver una
imagen; (2) qué guarda el esquema para la atribución; (3) qué tamaño y formato se sirven.

## Opciones consideradas

### 1. De dónde sale el fichero que se sirve

- **Enlazar en caliente desde `upload.wikimedia.org` (lo que hay ahora en 5 ficheros):** descartada.
  Pone la cookie `WMF-Uniq` en el navegador del visitante (RNF-5, CA-7). Además, Commons rechaza las
  peticiones directas de miniaturas que no usen uno de sus anchos estándar (20, 40, 60, 120, 250,
  330, 500, 960, 1280, 1920, 3840) ([1]), lo que ataría el diseño de la tarjeta a esa lista.
- **Descargar en cada build con las imágenes remotas de Astro (`image.domains`):** descartada. Astro
  descarga y optimiza las imágenes remotas en el build estático y las cachea en `.astro` según
  `Cache-Control` ([3]), así que el visitante no pide nada a Wikimedia. Pero: (a) cada build en
  Render depende de que Wikimedia responda; la documentación de Astro no dice qué pasa si la
  descarga falla ([3]), así que el resultado (build roto o tarjeta sin imagen) no está definido;
  (b) si la caché `.astro` se conserva entre builds de Render **no lo he comprobado**: si no, cada
  build vuelve a descargarlo todo y gasta minutos del workspace; (c) Wikimedia exige a los scripts
  un `User-Agent` propio con contacto y responde 403 a los que no lo traen ([4]); **no he comprobado**
  que Astro permita fijarlo; (d) rompe la promesa de ADR-0009: el mismo commit puede publicar cosas
  distintas si la imagen cambia en Commons; (e) quien descargaría datos de producto sería el build,
  no el Researcher (ADR-0001).
- **Descargar en la ingesta y guardar en el repositorio con Git LFS:** descartada por ahora. No hay
  ficheros que lo justifiquen: GitHub recomienda LFS para ficheros grandes y pone el aviso en 1 MB
  por fichero y 10 GB por repositorio ([5]), y una miniatura de 1280 px queda, por lo que se ve en
  Commons, por debajo de 1 MB (impresión, no medido). Añadiría que Render tenga que bajar los
  objetos LFS en el build, cosa que **no he comprobado**.
- **Servir las imágenes desde un almacenamiento o CDN propio aparte (R2, S3, Cloudflare Images):**
  descartada. Añade un proveedor y una credencial, contra el criterio de ADR-0009 de un solo
  proveedor, y saca las imágenes de la revisión por PR. Queda como salida si el ancho de banda de
  Render se queda corto (ver Consecuencias).
- **Descargar en la ingesta y guardar el fichero en el repositorio, en `data/images/` (elegida).**
  El fichero entra por PR junto al YAML que lo cita, se revisa, y el build lo lee del disco sin red.

### 2. Qué guarda el esquema

- **Solo la URL del fichero:** descartada. CC BY y CC BY-SA 4.0 piden un enlace al material «en la
  medida razonablemente posible» y permiten cumplir la atribución con un enlace a un recurso que
  contenga la información exigida ([6], sección 3(a)); ese recurso es la página `File:` de Commons,
  no el JPEG.
- **Solo la página `File:`:** descartada. No dice qué fichero exacto se descargó (Commons guarda
  versiones), y el build no puede pintar HTML.
- **Un solo campo `url` que valga para las dos cosas (lo de ahora):** descartada; es lo que ha
  producido los dos usos mezclados en `data/raw`.
- **Tres campos distintos: fichero local, URL del fichero descargado y URL de la página de la
  licencia (elegida).**

### 3. Tamaño y formato

- **Servir el original de Commons:** descartada. Las fotos de Commons suelen tener varios megapíxeles
  (impresión, no medido): demasiado para una tarjeta en 4G (RNF-2).
- **Guardar ya convertido a WebP en la ingesta y servirlo tal cual:** descartada. Fija un único
  tamaño para todas las pantallas y convierte dos veces si cambia el diseño.
- **AVIF además de WebP con `<Picture />`:** descartada por ahora. Astro lo admite ([7]), pero
  multiplica las variantes que se generan en cada build sin una medida que diga que hace falta.
- **Guardar una copia de 1280 px de ancho y generar en el build las variantes WebP con `<Image />`
  (elegida).** WebP es la salida por defecto de `<Image />` y Sharp el servicio por defecto ([7]).

## Decisión
**El visitante no hace ninguna petición a terceros para ver una imagen: el fichero se descarga una
vez en la ingesta, se guarda en el repositorio bajo `data/images/` y el build de Astro genera a
partir de él las variantes que se sirven desde `siete3.com`.**

Detalles:

1. **Dónde se guarda.** `data/images/<brand>/<slug del modelo>/<nombre>.<ext>`, con `<nombre>` en
   minúsculas, `[a-z0-9-]`, único en la carpeta. El YAML lo cita con una ruta relativa a la raíz del
   repo.
2. **Qué se descarga.** De Commons, la miniatura de **1280 px de ancho** (uno de los anchos estándar,
   [1]), o el original si es más estrecho. Se pide con un `User-Agent` propio con contacto, como
   exige Wikimedia ([4]). De una sala de prensa, el fichero que ofrezca, reducido a 1280 px de ancho
   si es mayor. Sin recodificar a otro formato al guardar: se guarda el JPEG o PNG tal como llega.
3. **Quién lo descarga y cuándo.** En la ingesta, en la misma ejecución que escribe el YAML, y nunca
   en el build. El cómo (paso del Researcher o script determinista que lanza) es de ADR-0010, que
   está pendiente; esta ADR solo fija que ocurre antes del PR y no en Render.
4. **Si la descarga falla** (error de red, 403, 404, fichero que no es imagen): la entrada **no se
   escribe** en `images`; se anota en `open_questions` con la URL y el error, y la tarjeta muestra la
   silueta (CA-17). No se escribe nunca una entrada de `images` sin su fichero: la validación de
   ADR-0008 lo rechaza. El build no descarga nada, así que no puede fallar por la red.
5. **Esquema** (sustituye la forma de `images` de ADR-0008; detalle en `data-model.md`):
   - `file`: ruta del fichero en el repo (obligatorio; debe existir).
   - `source_url`: URL exacta del fichero descargado (`upload.wikimedia.org/...` en Commons).
     Obligatorio; es la «URL donde se leyó» de ADR-0001.
   - `page_url`: URL de la página que acredita autor y licencia (la página `File:` de Commons o la
     página de términos de la sala de prensa). Obligatorio; es el enlace de la atribución.
   - `source_id`, `retrieved`, `license`, `attribution`: como hasta ahora.
   - Desaparece `url`. Los 11 ficheros actuales se migran: las 6 páginas `File:` pasan a `page_url`,
     los 5 ficheros pasan a `source_url`, y a cada uno se le añade el campo que falta y el `file`
     descargado. La migración es trabajo de la ingesta (ADR-0010), no de esta ADR.
6. **Atribución en la web.** Si `attribution` no es `null`, se muestra junto a la imagen con un
   enlace a `page_url`. Reducir y cambiar de formato son «modificaciones técnicas» que CC 4.0 permite
   y que no crean material adaptado ([6], sección 2(a)(4)). Cómo y dónde se ve el texto en la
   tarjeta es del diseño, no de esta ADR.
7. **Lo que se sirve.** `<Image />` de Astro (`astro:assets`) sobre el fichero local, salida **WebP**,
   con `width` y `height` explícitos para no mover el diseño y un `srcset` de anchos que fija el
   diseño de la tarjeta, nunca mayores de 1280 px. Las imágenes de la primera fila de tarjetas no
   llevan carga diferida; el resto, sí. No se fija aquí un peso máximo en KB: no está en el PRD. Se
   mide el LCP en producción (RNF-2) y, si no se cumple, se ajustan anchos y calidad.

## Consecuencias
**Buenas**
- Cumple RNF-5 y CA-7 por construcción: ninguna petición del visitante sale de `siete3.com` para
  una imagen. El test de la #41 puede comprobar que no hay ninguna petición a otro host.
- Reproducible: el mismo commit publica las mismas imágenes (ADR-0009). Si una foto desaparece o
  cambia en Commons, la web no cambia hasta la siguiente ingesta.
- La imagen y su licencia se revisan juntas en la misma PR (CA-10).
- El build no depende de la red ni del `User-Agent` de nadie.
- Desaparece la ambigüedad de `url`: cada URL tiene un único sentido.

**Malas o a vigilar**
- **Ancho de banda de Render.** Hasta ahora las imágenes las servía Wikimedia; con esta decisión
  cuentan contra los 5 GB/mes del workspace, compartidos con `erades.com` (ADR-0009). Es el coste más
  probable de esta ADR. El exceso se cobra por GB. Si crece, la salida es el plan B de ADR-0009
  (Cloudflare Pages) o un almacenamiento aparte, que habría que decidir.
- **Tamaño del repositorio.** Cada imagen ocupa en el historial para siempre, también las
  sustituidas. Con cientos de modelos y una o dos imágenes de unos cientos de KB cada una (estimación
  sin medir) son decenas de MB, lejos de los 10 GB que GitHub recomienda ([5]). Si se pasa a varias
  imágenes por modelo (galería de la ficha, PRD-002), hay que volver a mirarlo; LFS es la salida.
- **Tiempo de build en Render.** Sharp genera las variantes en cada build. Con 11 imágenes es poco;
  con cientos, y si Render no conserva la caché `.astro` (no comprobado), puede pasar de segundos a
  minutos y gastar de los 500 minutos/mes del workspace. Hay que medir el build antes y después de
  #112.
- **El Researcher hoy no puede descargar un binario.** Su `allowed_tools` en `factory/budgets.yaml`
  solo incluye `WebSearch`, `WebFetch` y la bitácora, y `WebFetch` devuelve texto. Hasta que
  ADR-0010 diga cómo se descarga, no se pueden añadir imágenes nuevas que cumplan esta ADR.
- **Hasta la migración, ninguna imagen se puede publicar**: ninguno de los 11 ficheros tiene `file`.
  #112 debe mostrar la silueta (CA-17) para las entradas sin `file` válido, nunca enlazar `url`.
- **Cambio de esquema aceptado en ADR-0008:** `web/src/lib/data.ts` y sus tests leen hoy `url`;
  #112 tiene que cambiarlos. Hasta que la validación de ADR-0008 exista en la CI, que `file` exista
  solo se comprueba en el build.
- **Cookies de Render:** esta ADR no cambia que CA-7 dependa de que el CDN de Render no ponga
  cookies (comprobado sin `Set-Cookie` el 2026-10-01 en ADR-0009); las imágenes servidas desde
  `siete3.com` heredan esa comprobación y la #41 debe incluirlas.

**Preguntas abiertas**
- ¿Cómo descarga la ingesta el fichero (herramienta, script, quién lo ejecuta)? → ADR-0010.
- ¿Qué anchos tiene el `srcset` de la tarjeta? Depende del ancho de la tarjeta en el diseño, que no
  está fijado.
- ¿Hay un peso máximo por imagen o por página? No está en el PRD; se decide al medir el LCP.
- ¿Conserva Render la caché `.astro` entre builds de un static site? No comprobado.
- ¿Las imágenes de la ficha de modelo (PRD-002) siguen esta misma regla? Se supone que sí, pero no
  se ha revisado PRD-002 para esto.

**Fuentes (consultadas el 2026-10-02)**
- [1] https://www.mediawiki.org/wiki/Common_thumbnail_sizes
- [3] https://docs.astro.build/en/guides/images/
- [4] https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy
- [5] https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits
- [6] https://creativecommons.org/licenses/by-sa/4.0/legalcode.en
- [7] https://docs.astro.build/en/reference/modules/astro-assets/
- [8] https://www.mediawiki.org/wiki/API:Imageinfo (`iiprop=url` da la URL del fichero y la de su
  página; `iiurlwidth` da una miniatura escalada: vía posible para obtener `source_url` y
  `page_url` juntas)
- Hechos de cookies de Wikimedia: comprobados el 2026-10-01, según la tarea.
