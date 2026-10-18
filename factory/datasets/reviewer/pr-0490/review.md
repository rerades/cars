🏭 Veredicto: puede entrar. CI verde, ambos modelos en `needs_review: true` y las dudas están anotadas. Solo hay hallazgos menores. SHA revisado: 7dfd84949ff80b5270f52b17f25bb7911c2e452b

**Criterios de la tarea**
- Fuente `voyah-es` (T1) con aviso legal de Caetano y `robots.txt` que no bloquea las fichas: creada. Cumple.
- Solo BEV: Free y Dream. El Dream PHEV no se registra. Cumple.
- `wltp_km` en todas las versiones: sí, una versión por modelo.
- `price` y `launch` en null con la razón. Cumple. `segment`: Dream `monovolumen` literal de la web de la marca (T1) y Free `suv_grande` de Diariomotor (T3), ambos valores del esquema.
- Imágenes de Commons CC BY-SA 4.0, con atribución, para los dos. Cumple.
- ADR-0001: el estado `on_sale` de ambos se apoya solo en Diariomotor (T3) y por eso están en `needs_review: true`. Cumple.

**Hallazgos (menores)**
1. `data/raw/voyah/dream.yaml`: `power_kw: 320` (IDAE) frente a los 429 CV que publica la web de la marca, que son unos 315 kW. La nota los cita pero no lo recoge en `open_questions`. Con T1 y T2 discrepando en una cifra, conviene anotarlo, o dejar `power_kw` en null. En el Free sí cuadran (489 CV ≈ 360 kW).
2. `data/raw/voyah/free.yaml`: el `segment: suv_grande` sale de un medio T3 mientras la web de la marca dice «SUV de grandes dimensiones». Está anotado, y con `needs_review: true` no se publica. Que se confirme al resolver las dudas.
3. En ambos, `wltp_km` y `battery_kwh` se atribuyen al IDAE aunque la web de la marca coincide en la autonomía. Es válido, pero el T1 sería más fuerte como fuente principal del `wltp_km`.
4. La bitácora dice que no se ejecutó `validate-data.ts`. La CI lo ejecuta (job `test`) y está verde.

**Lo que no he podido comprobar**
- Que `voyah.es` sea la web de la marca ni su `robots.txt`; las cifras del IDAE y de la web; las dos imágenes.
