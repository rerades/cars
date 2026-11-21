🏭 Veredicto: hay que cambiar antes de entrar — unas 35 `retrieved` de datos del IDAE (T2) pasan a 2026-10-31 sin que la PR muestre ninguna lectura del IDAE; revisado `021ebb496dcc811dfe8ff271bb7d0c257ac4c705`. CI en verde.

**Criterios de aceptación** (refresco ADR-0010 punto 6)
- Releer y actualizar `retrieved`: parcial. Las fuentes T3 (hibridosyelectricos, motorpasion, diariomotor, forococheselectricos) y Commons tienen llamada a `fetch-page.ts`. Los valores del IDAE (batería, WLTP, potencia y tracción de 8 versiones de Model 3 y Model Y, tier T2) **no**: el cuerpo de la PR no contiene ninguna llamada a `fetch-idae.ts` ni salida del IDAE, y la fuente `idae-es` dice que la tabla solo se lee con ese script.
- Verificar fuentes: `last_verified` sube a 2026-10-31 en 6 fuentes, incluida `idae-es`, sin lectura visible de ninguna salvo las T3 y Commons. `diariomotor-es` y `motorpasion-es` solo constan por las reseñas.
- Precio: siguen en `null`; `tesla.com` da 403 y no está registrada. Correcto.
- No tocar `needs_review`, bitácora: cubierto.

**Hallazgos**
1. `data/raw/tesla/model-3.yaml`, `model-y.yaml`: `retrieved` 2026-10-31 en los campos con `source_id: idae-es` y en `data/sources/idae-es.yaml` (`last_verified`), sin salida de `fetch-idae.ts` en la traza. La bitácora afirma «IDAE sin cambios en las homologaciones citadas», que no está probado en la PR. Hay que ejecutar `node factory/fetch-idae.ts TESLA` y dejar su salida en la traza, o devolver esas fechas a las anteriores.
2. `forococheselectricos-es.yaml`, `wikimedia-commons.yaml`, `diariomotor-es.yaml`, `motorpasion-es.yaml`: `last_verified` sube con lecturas de una página concreta, no de robots.txt ni de términos; aceptable, pero las notas dicen «comprobado el 2026-10-09/21» y no se actualizan.
3. Las imágenes de Commons: `retrieved` se renueva por `CC BY-SA` en la página del fichero (3 llamadas), correcto.

**Lo que no he podido comprobar**: si la traza completa tiene llamadas a `fetch-idae.ts` que la factoría no vuelca en el cuerpo (solo se listan las de `fetch-page.ts`); si las hay, el hallazgo 1 se resuelve citándolas.
