🏭 Veredicto: hace falta decisión de una persona — los valores técnicos del iX3 se han fechado a 2026-10-31 con una lectura (`WebFetch`) que no está en la traza de `fetch-page.ts`, justo cuando `fetch-page.ts` no pudo leer el host (robots.txt 503); revisado `fd10e74dd3eba9ff55dd0132235e25bdd600536b`. CI en verde.

**Criterios de aceptación** (refresco ADR-0010 punto 6)
- Releer y actualizar `retrieved`: parcial. El precio de 69.900 € NO se refresca (correcto: `fetch-page.ts` falló y se deja con fecha 2026-10-04). Pero WLTP, potencia, DC, batería y `launch` se pasan a 2026-10-31 y cambian de URL a `newsroom.bmwgroup.com` basándose en `WebFetch`, no verificable en la traza.
- Verificar fuentes (punto 7): `bmw-es` da timeout dos refrescos seguidos y se mantiene `active` con `last_verified: 2026-10-31`; `last_verified` marca una verificación que no se hizo.
- Precio caducado/no releído (punto 8): bien declarado en `open_questions`, con la posible subida a 70.900 € (T3).
- No tocar `needs_review`, bitácora: cubierto.

**Hallazgos**
1. `data/raw/bmw/ix3.yaml`: las `retrieved` de los valores técnicos y las URL nuevas no tienen salida de `fetch-page.ts` que las respalde (las llamadas a la URL nueva solo piden «69.900» / «63.650» y fallaron). Decidir si se acepta una lectura por `WebFetch` cuando el robots.txt del host dio 503, o se vuelve a las fechas/URL del 2026-10-04. Mezcla además URL viejas (`drivetrain`, `status`) y nuevas en el mismo fichero.
2. `data/sources/bmw-es.yaml`, `bmw-press.yaml`: `last_verified` pasa a 2026-10-31 aunque no se leyó robots.txt de ningún host (503) ni bmw.es (timeout). Debería quedar la fecha anterior hasta poder leer, o decidir (punto 7) si la fuente se marca rota.
3. `bmw-press.yaml`: cambiar `urls.home`/`prices` a un host cuyo robots.txt no se ha podido leer conviene que lo apruebe una persona (ADR-0001).
4. Bien resuelto: no se inventa el precio y se registra la variante iX3 M60 sin añadirla (fuera de alcance).

**Lo que no he podido comprobar**: el contenido de las salidas de `fetch-page.ts` y si la lectura por `WebFetch` respeta robots.
