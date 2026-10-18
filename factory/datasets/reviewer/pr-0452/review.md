🏭 Veredicto: cambios necesarios. La lógica de celdas y cabeceras (`compare.ts`) está bien probada, pero el script que monta la tabla en el navegador (`ComparisonTable.astro`) no tiene ninguna prueba que ejecute su comportamiento; varios CA dependen de él. SHA revisado: 0f45d36498560ea86ae83bbfcad0b69ba21da116. CI: test, web, changes, a11y en verde.

**Criterios de aceptación**
- CA-1 (3 columnas, marca/modelo/nombre, enlace a la ficha, mismas filas): parcial. `headerView` está probado (href, srSuffix, nombre), pero nada comprueba que el script produce N columnas ni sus `headers`/`id`. Sin cubrir en DOM.
- CA-3 (orden de filas, batería con base): cubierto en lógica (`FIELDS` y textos de `cellView`). El orden en el DOM depende del bucle del script, sin probar.
- CA-4 («por confirmar» sin cifra; fila CA visible): cubierto para `cellView` (sin dígitos). Que la fila siga visible en el DOM no está probado.
- CA-6 (Badge, `price_terms` literal, enlace, `note`): cubierto en `cellView`. Que el DOM lo pinte (sección «Condiciones», enlace interno `#cmp-condiciones-n`, texto literal con saltos de línea) no está probado.
- CA-15 (sin mejor/peor ni resaltado; orden de la URL): parcial. La prueba solo comprueba las claves de `CellView`; el orden de columnas según la URL lo decide `validateSelection`/`render` y no se prueba aquí.
- CA-17 (320 px sin scroll horizontal; distinguible sin color): sin cubrir. Ninguna prueba de anchura ni e2e; «fuente no oficial» solo se muestra en la celda de precio (el resto de campos no pinta `unofficial`, aunque `cellView` lo calcula).

**Hallazgos**
1. `web/tests/comparar.test.ts` / nuevo e2e: el script es la parte de mayor riesgo y solo se prueba con regex sobre el bundle (`replaceState`, sin storage). Añade una prueba que cargue `/comparar/?v=...` con datos de prueba (si el repo ya tiene e2e de navegador como el catálogo, reutilízalo; si no, una prueba con DOM simulado sobre `render`) y compruebe: nº de columnas, orden de la URL, filas, retirada del aviso, `replaceState` y ausencia de scroll horizontal a 320 px.
2. `ComparisonTable.astro`: `c.unofficial` solo se usa cuando hay `source` (solo precio). Si esa limitación es intencional hasta #319, déjalo dicho en la bitácora/PR; si no, es hueco de CA-17.
3. Menor: el fallback de error usa `msg.error`/`msg.noJsLink` con `?? ""`; si falta la clave en `data-messages` el aviso queda vacío sin avisar. Compruebe en test que las claves existen.

Bien resuelto: `<template>` + `textContent` (sin `innerHTML` de datos), límite de 12 modelos descargados, formato reutilizado (`formatDecimal`, `sourceView`), sin dependencias nuevas, bitácora presente, PR con «Closes #318».

**No he comprobado**: el comportamiento real en navegador a 320 px; la CI a11y no sé si cubre `/comparar/` con datos.
