🏭 Veredicto: puede entrar. Resuelve los tres puntos de la tarea y mantiene `needs_review: true` y `price: null`. SHA revisado: 2cadf5ae7dacbd0fdc6f3adb0b9a471232823d88. CI en verde (incluye el validador de `data/`).

**Criterios de la tarea**
1. Custom, versiones solo Grand Tourneo: se quitan las dos de 83 kWh/160 kW (RWD y AWD) que el IDAE solo lista como Grand Tourneo, con los ids y el motivo en `open_questions`, y se deja constancia de que las otras cuatro tienen fila «E-Tourneo Custom» sin Grand. Cumple, con una diferencia: la tarea hablaba de 4 de 6, pero el agente solo ha podido sostener 2 con el IDAE y lo explica. No lo puedo contrastar con el IDAE.
2. Nombres de versión: la de 160 kW pasa a «64 kWh 160 kW», sin acabados mezclados, y se explica por qué no se puede asignar un acabado por versión (el IDAE los agrupa; ford.es no da datos por acabado). «Sport» se mantiene por ser acabado único. Cumple.
3. Courier Trend: `wltp_km` cita solo el IDAE. Cumple.
- No toca otros modelos de Ford; bitácora presente.

**Hallazgos (no bloquean)**
1. Custom: los nombres restantes (p. ej. «83 kWh 210 kW RWD Sport») siguen siendo descriptivos y no comerciales; está explicado, pero conviene sustituirlos cuando haya una fuente con nombres de versión.
2. La diferencia entre «4 de 6» (tarea) y «2 de 6» (resultado) merece que quien lea la revisión de #362 confirme que no faltan dos versiones por quitar.
3. Comprobar que `specs.wltp_max_km`, si existe, sigue coincidiendo con el máximo de las versiones restantes (334 km); la CI pasa, así que el validador lo da por bueno.

**No he comprobado**: ford.es ni el IDAE (ids 610312, 610313, 610315–610319, 610529); tampoco la revisión de #362.
