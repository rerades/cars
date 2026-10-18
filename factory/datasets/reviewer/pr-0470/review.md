🏭 Veredicto: puede entrar. CI verde y los cuatro cambios pedidos están hechos, con los tres modelos en `needs_review: true`. Los datos quedan sin publicar hasta que se confirme algo. SHA revisado: 12c3b47fd8814be18d5af2f518e0728ce4035f09

**Criterios de la tarea (devolución de #433)**
1. `drivetrain` en g6, g9 y p7-plus: hecho, ya no está en ningún fichero y se anota en `open_questions`.
2. G6 Standard Range: hecho. `power_kw` queda ausente en esa versión y no hay `wltp_km` en ninguna versión del G6 (regla 8). No hay `specs.wltp_max_km`. La contradicción IDAE/motor.es queda en `open_questions` con `needs_review: true`.
3. G9 y P7+: hecho. `needs_review: true` y la razón (status T3 sin otra fuente) en `open_questions`.
4. P7+: hecho. `segment: null`, explicado.
- Imágenes de Wikimedia Commons (G6 y G9) con `license`, `attribution`, `page_url` y `source_id: wikimedia-commons` registrados, CC BY-SA 4.0. Del P7+ no hay imagen y se explica.
- Bitácora: dice que sustituye a la #433. `data/candidatas.yaml` no se toca.

**Hallazgos (menores)**
1. `data/raw/xpeng/g9.yaml`, versión G9 RWD Standard Range: la nota de `battery_kwh` cita «motor.es: 79 kWh» pero la fuente declarada es solo `idae-es`. Quítalo o añade su fuente, para que la nota no atribuya a una fuente un dato de otra.
2. `g9.yaml` y `p7-plus.yaml` conservan `wltp_km` y `power_kw` del IDAE aunque el status sea dudoso. Es coherente porque el IDAE es T2 y los modelos están en `needs_review`, pero conviene que lo confirme quien resuelva las `open_questions`.

**Lo que no he podido comprobar**
- Las cifras del IDAE (ids 607281-607283, 611861-611863) y las de motor.es y Motor1: no he leído las fuentes.
- La licencia real de los dos ficheros de Commons ni la imagen en sí. Fiarse de la CI (validador de `data/`) y de la revisión humana.
