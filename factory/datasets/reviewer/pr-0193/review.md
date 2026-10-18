🏭 Veredicto: cambios menores antes de entrar. La lógica de orden es correcta y está bien probada, pero la parte del navegador (el reorden del DOM al cambiar el selector) solo tiene una prueba que no puede fallar. SHA revisado: cdb6fed5d23e8aa9b31015a47275afc9da69642f. CI en verde (test y web).

**Criterios de aceptación**
- CA-3 (precio asc: el primero tiene el menor «precio desde»): cubierto en la lógica. `sort.test.ts` comprueba `precio-asc` y `precio-desc` con `sortModels` sobre modelos derivados, incluido un precio `financed` (RF-9). Cubierto también que el selector tiene etiqueta y las cuatro opciones. **No cubierto** que el selector reordene de verdad las tarjetas en el navegador (ver hallazgo 1).
- CA-9 (sin precio al final con «Precio por confirmar»): cubierto. Se comprueba que los modelos sin precio van al final en los dos órdenes de precio, y que la tarjeta de Zzz conserva «Precio por confirmar» y tiene `data-price` vacío.
- CA-16 (novedad, sin fecha al final): cubierto. Se prueba sobre los datos derivados (un `announced` usa su fecha) y sobre el HTML construido de /coches, que sale ya ordenado.
- RF-5 (orden en la query string): cubierto con una prueba de ida y vuelta de `parseFilters`/`toSearch`, con valor inválido y orden por defecto omitido.

**Hallazgos**
1. `web/tests/sort.test.ts`, última prueba («the shipped script reorders…»): comprueba con regex que el JS empaquetado contiene `orden`, `append` y `replaceState`. Esas cadenas aparecen aunque el reorden esté roto: `orden` y `append` salen en cualquier bundle y `replaceState` ya lo usa #36. Esa prueba no falla si se rompe el cableado de `update()` → `list.append(...)` o el listener de `sortSelect`. Haría falta una prueba que ejecute el `update` en un DOM mínimo (jsdom/happy-dom sería una dependencia nueva, así que mejor extraer el reorden a una función pura en `sort.ts` o `filter.ts` y probarla), o decir expresamente en la PR que el cableado queda sin probar. Es la única pieza que no comparte lógica con el build.
2. `CatalogFilters.astro`: el selector va fuera del panel plegable. El agente lo señala como decisión suya. El diseño (filtros-catalogo.md, líneas 19 y 168-175) pone el orden después de los filtros y en escritorio arriba a la derecha. Colocarlo bajo el formulario en el mismo bloque no coincide con el wireframe de escritorio. Es una decisión de diseño que tiene que confirmar una persona o el Diseñador, no es un fallo del código.
3. Menor: el cuerpo de la PR no lleva `Closes #37`, solo lo menciona. La issue no se cerrará sola al fusionar.

Bien resuelto: `sortByNovelty` delega en `sort.ts`, el mismo módulo que usa el navegador, y hay una prueba de que los `data-*` de las tarjetas reconstruyen el mismo orden. Bitácora presente. Sin dependencias nuevas, sin datos personales.

**Lo que no he podido comprobar**
No he podido traer la rama a local, así que no he ejecutado nada: me baso en el diff y en la CI. Tampoco he mirado el aspecto del selector en móvil, ni el foco.
