🏭 Veredicto: puede entrar. CI verde y cumple las reglas de la tarea; las dudas quedan en `open_questions`. Solo hay hallazgos menores. SHA revisado: 36672959f24ed3e73feb67508a4dd91390346a82

**Criterios de la tarea**
- Fuente `data/sources/kgm-es.yaml` creada con web verificada, `robots.txt`, aviso de que `kgm.es` y `kgm.com` no son de la marca, y `image_license` vacío (sin términos de imagen). Cumple.
- Solo BEV: Torres EVX y Musso EVX. Korando e-Motion no creado por falta de confirmación de venta. Cumple.
- `wltp_km` en todas las versiones (regla 8): sí, en las 2 del Musso y las 2 del Torres.
- `launch` y `segment` null por falta de término literal: cumple.
- Precio: null por no poder copiar el pie entero. Cumple.
- Cifras que se contradicen en null: batería del Torres (80,6 de la web contra 73 del IDAE) y potencia del Musso (152 contra 174 kW), con `open_questions`. Cumple.
- Imágenes solo de Commons: solo el Torres, CC-BY-SA-4.0, con atribución. El Musso se queda con `images: []`, anotado. Cumple.

**Hallazgos (menores)**
1. `data/raw/kg-mobility/musso-evx.yaml`: `needs_review: false` aunque tiene la discrepancia de potencia y no se sabe qué acabados se venden. Los dos modelos comparten ese tipo de dudas y solo el Torres lleva `true`. Valorar `true` para el Musso.
2. `data/raw/kg-mobility/torres-evx.yaml`: la versión «Torres EVX Van» (IDAE `TORRES EVX VAN PRO`) es para profesionales y puede no ser un turismo. Sigue marcado `needs_review: true` y está anotado, así que no bloquea.
3. Las dos versiones del Musso sacan nombre de la web y datos del IDAE (ids 613986/613987). La correspondencia 4x2↔613987 y 4x4↔613986 se deduce y no la he podido verificar.

**Lo que no he podido comprobar**
- Que `kgm.com.es` sea la web de la marca, su `robots.txt`, ni las cifras del IDAE.
- El contenido de la imagen del Torres.
