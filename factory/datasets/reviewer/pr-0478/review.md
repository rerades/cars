🏭 Veredicto: hace falta una persona. Datos, licencias y CI están bien, pero hay dos imágenes cuyo modelo y generación no he podido comprobar y la tarea los exigía (Epiq y Zeekr 7GT). Como la fusión automática admite `data/images/`, conviene que alguien las mire antes de que entren. SHA revisado: aa6e512d9ef9c6a933affe4b72119e94265fc2f2

**Criterios de la tarea**
- Solo Commons con licencia que permita uso comercial: cumple (CC-BY-SA-4.0, CC-BY-4.0 y CC0-1.0, con `page_url`, `license`, `attribution` y `retrieved`).
- Enyaq y Enyaq Coupé con el frontal de 2025: `2025_Skoda_Enyaq_sportline_(facelift)_-_front` y `2025_Škoda_Enyaq_Coupé_DSC_8402`. Por el nombre, cumple.
- Un prototipo o concept no vale para un modelo de serie: **no comprobado** para `skoda/epiq` (`Skoda_Epiq_front_view.jpg`). El nombre no dice si es el coche de serie o el concept.
- Sin foto válida: `images: []` y anotarlo. Cumple para `smart/hashtag-2`, y la bitácora lo anota.
- Nada más de los ficheros: cumple en lo sustancial, con la excepción del hallazgo 3.

**Hallazgos**
1. `data/raw/skoda/epiq.yaml`: la foto `Skoda_Epiq_front_view.jpg` (Oil151kv, CC BY 4.0) no tiene en el nombre año ni «serie». Alguien debe abrir la página de Commons y confirmar que es el Epiq de producción y no el concept. Si no lo es, quitar la imagen.
2. `data/raw/zeekr/7gt.yaml`: la foto es `Zeekr_007_GT_001.jpg`, nombre del coche para China. El agente lo anotó en `open_questions`, pero no hay fuente de la marca que confirme que el 007 GT y el 7GT europeo son el mismo coche. Hay que confirmarlo o quitar la imagen. Que quede como pregunta abierta no basta, porque la foto se publicaría ya.
3. Se han borrado las `open_questions` de imágenes en los ficheros tocados. Tiene sentido, pero la PR hermana #476 las dejó, y la tarea decía «no toques nada más». Conviene unificar el criterio.
4. `zeekr/x.yaml` y `smart/hashtag-3.yaml`: por el nombre son los modelos correctos. No verificado visualmente.

**Lo que no he podido comprobar**
- El contenido de las diez imágenes y las licencias en las páginas de Commons.
