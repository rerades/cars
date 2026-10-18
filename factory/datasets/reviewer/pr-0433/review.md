🏭 Veredicto: cambios necesarios antes de entrar. Hay datos inferidos (tracción deducida del nombre) y dos modelos publicables (`needs_review: false`) cuyo estado de venta solo se apoya en prensa T3. SHA revisado: f285163f666df3403a47a4e89d80c6af77a45f50. CI en verde (incluye el validador de `data/`).

**Criterios de la tarea**
- Marca `xpeng`, solo BEV (G6, G9, P7+): sí. Regla 8 (`wltp_km` en todas las versiones): sí.
- Fuente y fecha en cada dato: sí; IDAE (T2) y prensa (T3) sin web oficial en España, y lo dice en `open_questions`. Precios `null` por ello: correcto.
- Contradicción G6 Standard Range (IDAE 566 km / 218 kW frente a motor.es 455 km / 252 CV): anotada y el modelo queda `needs_review: true`. Bien. Ojo: 566 km con 68,5 kWh frente a 568 km con 80,8 kWh de la Long Range es poco creíble; el dato probablemente es erróneo y conviene dejarlo en `null` en vez de publicar una cifra dudosa (la tarea pide dejar a `null` la cifra contradictoria).
- Imágenes de Commons CC-BY-SA con atribución (G6, G9); P7+ sin imagen, dicho.
- Bitácora presente; sin fuentes nuevas.

**Hallazgos**
1. `g6.yaml`, `g9.yaml`, `p7-plus.yaml`, `drivetrain` en todas las versiones: `note: "según el nombre de la versión"` con `source_id: idae-es`. El IDAE no da la tracción; es una deducción del nombre atribuida a una fuente que no la contiene (ADR-0001, «nada se inventa»). Quitar `drivetrain` o citar una fuente que lo diga.
2. `g6.yaml` Standard Range: dejar `wltp_km` y `power_kw` en `null` mientras haya discrepancia (ver arriba), o mantener el valor solo si se justifica. Si se quita `wltp_km` de una versión, la regla 8 obliga a quitarlo en todas o a revisar.
3. `g9.yaml` y `p7-plus.yaml`: `status: on_sale` con `needs_review: false` desde una noticia T3 (la del G9 es de 2025-09; la del P7+ tiene la fecha «por contexto», no leída). Sin web oficial no hay confirmación de que se pueda pedir hoy; marcar `needs_review: true` como en el G6, o confirmar con otra fuente.
4. `p7-plus.yaml`, `segment: berlina` con fuente T3 que solo «describe» el coche así: la tarea pedía el término literal de RF-11 y que lo dé la fuente; confirmar que «berlina» está en la lista y que el texto de Motor1 lo usa literalmente.
5. El agente no pudo comprobar que el slug `p7-plus` cuadra con lo que espera el validador. La CI pasa, pero conviene confirmar la URL resultante (`/marcas/xpeng/p7-plus/`).

**No he comprobado**: los valores del IDAE ni las noticias citadas.
