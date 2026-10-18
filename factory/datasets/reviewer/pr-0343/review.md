🏭 Veredicto: un cambio pequeño antes de entrar: `data/sources/mini-es.yaml` queda `status: active` cuando la propia nota dice que ni robots.txt ni las páginas de gama se pudieron leer. El resto es aceptable (los tres modelos van con `needs_review: true` y `price: null`). CI en verde (test con validador, web, changes, a11y). SHA revisado: b75859ca2fc078285972a8bd145c305690d222f1.

**Criterios de aceptación** (contra el enunciado de la tarea)
- Fuente de la marca en el registro: parcial; existe `mini-es`, pero mal marcada (ver 1).
- Modelos BEV en `data/raw/mini/`: cubierto con Cooper, Aceman y Countryman. No comprueba si hay más modelos eléctricos de MINI.
- Vía IDAE si la web no se lee, T3 solo para confirmar, `price: null`: cumplido en precio.
- `wltp_km` en todas o en ninguna: cumplido, en todas.
- `launch` y `segment` solo con literal: cumplido, `null`, con la razón en `open_questions`.
- Imágenes de Commons con licencia comercial: solo el Cooper (CC-BY-SA-4.0, con atribución y `page_url`); Aceman y Countryman sin imagen, y lo dicen. No he abierto Commons para comprobar autor y licencia.

**Hallazgos**
1. `data/sources/mini-es.yaml`: `status: active` con robots.txt y gama en timeout, términos sin leer y verificación «incompleta». Marcar `broken` (o equivalente), como se hizo con Volvo en una situación idéntica.
2. `status: on_sale` apoyado en artículos T3 de 2023 y 2024 (Cooper, Aceman, Countryman) para fecha de venta de hoy. Está en `needs_review`, así que no se publica; que quede claro que el dato es de confirmación débil.
3. `countryman.yaml`: se elige la homologación 03/2024 (462 y 432 km) y no la de 03/2026 (501 y 467 km), con la regla «menor `wltp_km`». La batería también cambia de 64,6 a 65,2 kWh. Al mezclar homologaciones con baterías distintas, la regla de la menor puede dar cifra de un coche que ya no se vende. Ford y Fiat usaron el criterio contrario en este lote; conviene fijar uno en las instrucciones del Researcher.
4. `cooper.yaml` y `aceman.yaml`: los medios dan otras baterías (40,7 y 54,2 kWh; 42,5 y 54,2 kWh) y se guarda el IDAE. Es la regla (T2 prevalece) y está anotado.
5. La validación con `validate-data` no se ejecutó (lo dice la bitácora); la CI sí lo hace y pasa.

**No he podido comprobar**: las cifras contra el IDAE ni los artículos T3, ni la imagen.
