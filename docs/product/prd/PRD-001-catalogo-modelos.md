---
id: PRD-001
title: Catálogo de modelos
status: ready
priority: P0
depends_on: []
epic: "#32"
updated: 2026-10-28
---

# PRD-001 — Catálogo de modelos

## 1. Problema
Quien se informa sobre coches eléctricos necesita ver en un solo sitio **qué modelos existen en Europa** y filtrarlos según lo que le importa (marca, precio, autonomía, tamaño) sin saltar entre webs de fabricantes. El catálogo es además la base de la que dependen la ficha, el comparador y los rankings.

## 2. Objetivo y métricas
- El catálogo lista todos los modelos BEV comercializados en España en el momento del lanzamiento.
- Un visitante llega a un modelo concreto en ≤ 3 interacciones desde la portada.
- Páginas indexables: una lista corta y explícita de páginas pregeneradas (RF-10), cada una con su URL, su título y su texto propios:
  - **Se pregenera:** una página por marca (RF-4), una por segmento y una por cada tramo de precio y de autonomía de la lista de RF-10.
  - **No se pregenera:** ninguna otra combinación de filtros (por ejemplo, marca + segmento + tramo de precio). Se resuelve en el navegador y su estado viaja en la query string (RF-5): la URL se puede compartir y al abrirla se ven los mismos resultados, pero esa URL concreta no es una página indexable.
  - Motivo: el sitio es estático (ADR-0003), donde una combinación arbitraria no se puede resolver en servidor, y pregenerar todas las combinaciones daría miles de páginas casi idénticas.

## 3. Alcance
### Incluido
- Listado de modelos con tarjeta resumen.
- Filtros y ordenación.
- Página de listado por marca.
- URLs estables y amigables.

### Fuera de alcance
- Ficha detallada del modelo (PRD-002).
- Comparador (PRD-003).
- Rankings (PRD-005).
- Precios en tiempo real o disponibilidad en concesionarios.
- Cualquier interacción que guarde datos del visitante (favoritos persistentes, cuentas, alertas).

## 4. Requisitos funcionales
- **RF-1:** El catálogo muestra una tarjeta por modelo con: marca, modelo, imagen, precio desde (España), autonomía WLTP máxima, segmento.
- **RF-2:** El visitante puede filtrar por marca, segmento, rango de precio, autonomía WLTP mínima y tracción. Cualquier combinación de filtros es posible, tenga o no página pregenerada (RF-10); las que no la tienen se resuelven en el navegador.
- **RF-3:** El visitante puede ordenar por precio, autonomía y novedad. La novedad es la fecha de inicio de venta en España (mes y año, con fuente); los modelos sin esa fecha quedan al final.
- **RF-4:** Existe una página por marca (`/marcas/{marca}`) con sus modelos.
- **RF-5:** El estado de filtros y orden se refleja en la URL (query string) y se puede compartir. Para las combinaciones sin página pregenerada, el filtrado ocurre en el navegador a partir de esa URL; abrirla reproduce los mismos resultados, aunque no sea indexable.
- **RF-6:** Si ningún modelo cumple los filtros, se muestra un estado vacío con la opción de limpiar los filtros.
- **RF-7:** Se incluyen modelos **anunciados pero no comercializados**, con la etiqueta "Próximamente" y la fecha prevista si se conoce. Se pueden filtrar por estado (a la venta / próximamente / descatalogado). Los modelos **descatalogados** también aparecen, con la etiqueta "Descatalogado".
- **RF-8:** Cada tarjeta muestra una imagen del modelo procedente de una fuente registrada, con su atribución si la licencia lo exige. Por orden: (1) Wikimedia Commons, con licencia explícita que permita el uso comercial (CC0, CC BY, CC BY-SA o dominio público); (2) la sala de prensa de la marca, solo si sus términos escritos permiten este uso; (3) si no hay ninguna, una silueta genérica del segmento.
- **RF-9:** Un precio que no es PVP se muestra etiquetado como **"precio con oferta"**, y la ficha del modelo muestra el texto literal de sus condiciones. Estos precios entran en los filtros y en el orden por precio como cualquier otro, siempre con su etiqueta.
- **RF-10:** Existe una lista corta y explícita de páginas indexables pregeneradas, cada una con su propio título y su propio texto introductorio (no repetido entre páginas): una por marca (la de RF-4), una por segmento, y una por cada tramo sencillo de precio y de autonomía. Cada página muestra solo los modelos que cumplen su criterio, con el HTML completo sin depender de JavaScript. Las URL son estables y amigables; la de marca es `/marcas/{marca}` y la de segmento `/segmentos/{segmento}`, con el valor de RF-11 en minúsculas, sin tildes y con guiones (`/segmentos/suv-compacto`). Los tramos, sobre el "precio desde" (que incluye el precio con oferta de RF-9) y la autonomía WLTP máxima, son:
  - Precio: «hasta 30.000 €» (`/precio/hasta-30000-euros`), «de 30.000 a 45.000 €» (`/precio/de-30000-a-45000-euros`), «más de 45.000 €» (`/precio/mas-de-45000-euros`).
  - Autonomía: «más de 400 km» (`/autonomia/mas-de-400-km`), «más de 500 km» (`/autonomia/mas-de-500-km`).
  - Bordes: el precio de los tramos no se solapa: hasta 30.000 € es ≤ 30.000; de 30.000 a 45.000 € es > 30.000 y ≤ 45.000; más de 45.000 € es > 45.000. La autonomía sigue la regla del filtro (CA-2): un tramo de 400 km recoge los modelos con alguna versión ≥ 400 km, y lo mismo con 500. Los dos tramos de autonomía se solapan a propósito.
- **RF-11:** El segmento es uno de esta lista, la que usa quien compra: urbano, compacto, berlina, familiar, SUV pequeño, SUV compacto, SUV grande, monovolumen, furgoneta y deportivo. Cada modelo tiene uno solo. Sale de lo que dice una fuente (vale una de tier 3): el término de la lista, o una de las equivalencias de la tabla cerrada de `data-model.md` (tipo de carrocería más letra de segmento en la misma fuente). Un agente nunca lo deduce por tamaño, precio ni parecido.
  - **Clasificación editorial (ADR-0021):** si, aplicadas la regla y la tabla de equivalencias, ninguna fuente clasifica el modelo, una persona con permiso de fusión en el repositorio puede asignarle uno de los diez segmentos de la lista, marcado como clasificación editorial (`tier: E`, ver ADR-0021). Lleva fecha y una nota con lo que dicen las fuentes leídas y el criterio aplicado, que es el criterio común de `data-model.md`, junto a la tabla de equivalencias (lo escribe el Arquitecto). Solo vale para el segmento, nunca para otro campo. Ningún agente lo asigna, lo cambia ni lo borra; sí lo sustituye cuando encuentra una fuente que lo clasifica con la regla y la tabla. Un segmento editorial cuenta como cualquier otro en los filtros (RF-2) y en las páginas de segmento (RF-10), y la tarjeta del catálogo (RF-1) lo muestra como cualquier segmento, sin marcarlo; solo la ficha lo distingue (PRD-002, RF-9).
- **RF-12:** Un modelo sin segmento, autonomía o tracción se muestra igual, con "por confirmar" en el campo que falta. Si el visitante filtra por ese campo, el modelo no aparece, porque no se puede afirmar que cumpla el filtro.
- **RF-13:** Un modelo marcado `needs_review: true` no se publica: no tiene tarjeta, no cuenta en los contadores ni aparece en ninguna página pregenerada hasta que una persona lo revise y quite la marca (ADR-0001, regla 3).
- **RF-14:** `/coches` enlaza a los rankings de PRD-005 con un enlace de texto, visible sin JavaScript. Es la entrada a los rankings desde la portada (portada → `/coches` → ranking).

## 5. Requisitos no funcionales
- **RNF-1:** Renderizado en servidor o estático para SEO.
- **RNF-2:** LCP < 2,5 s en móvil 4G.
- **RNF-3:** Accesibilidad WCAG 2.1 AA.
- **RNF-4:** Idioma español. Textos preparados para i18n.
- **RNF-5:** Sin cookies ni almacenamiento de datos personales.

## 6. Datos
- Entidades: `Marca`, `Modelo`, `Versión`, `Mercado`, `Precio` (ver `architecture/data-model.md`).
- "Precio desde" y "autonomía máxima" se derivan de las versiones disponibles en el mercado España.
- **Precio = PVP oficial de la marca en España, sin ayudas** (sin Plan MOVES ni otros incentivos). Si la marca no publica un PVP limpio, se guarda el precio de la oferta marcado como `financed`, con el texto literal de sus condiciones (ver ADR-0001).
- Los datos los obtiene el agente **Researcher** siguiendo `docs/architecture/adr/0001-fuentes-de-datos.md` y el registro de fuentes `data/sources/<id>.yaml` (un fichero por fuente).
- Un modelo "próximamente" puede no tener precio. Entonces se muestra "Precio por confirmar" y queda al final al ordenar por precio.
- Cada dato de especificación guarda su fuente y su fecha de actualización.

## 7. Criterios de aceptación
- [ ] **CA-1** (→ RF-1): Dado un modelo con al menos una versión en España, cuando abro `/coches`, entonces veo su tarjeta con los seis campos de RF-1.
- [ ] **CA-2** (→ RF-2): Dado el filtro "autonomía ≥ 400 km", cuando lo aplico, entonces solo aparecen modelos con alguna versión de WLTP ≥ 400 km.
- [ ] **CA-3** (→ RF-3): Dado el orden "precio ascendente", entonces el primer modelo tiene el menor "precio desde" del resultado.
- [ ] **CA-4** (→ RF-4): Dada la marca "renault", cuando abro `/marcas/renault`, entonces veo solo modelos de Renault.
- [ ] **CA-5** (→ RF-5): Dada una URL con filtros, cuando la abro en una sesión nueva, entonces veo los mismos resultados.
- [ ] **CA-6** (→ RF-6): Dados filtros sin resultados, entonces veo un mensaje y un botón para limpiar los filtros.
- [ ] **CA-8** (→ RF-7): Dado un modelo con estado "anunciado", cuando abro `/coches`, entonces aparece con la etiqueta "Próximamente". Con el filtro "a la venta" no aparece.
- [ ] **CA-9** (→ RF-7): Dado un modelo sin precio, cuando ordeno por precio ascendente, entonces aparece al final con "Precio por confirmar".
- [ ] **CA-10** (→ RF-8): Toda imagen mostrada tiene en la base de datos una fuente y una licencia registradas.
- [ ] **CA-11** (→ RF-9): Dado un modelo cuyo precio es `financed`, cuando abro su tarjeta, entonces veo la etiqueta "precio con oferta", y en su ficha veo el texto literal de las condiciones.
- [ ] **CA-12** (→ RF-10): Dado el sitio construido, cuando reviso las páginas pregeneradas de marca, segmento, precio y autonomía, entonces (a) hay exactamente una por cada marca y segmento con modelos y una por cada tramo de RF-10; (b) cada una tiene título y texto introductorio distintos de los de las demás; (c) su HTML servido ya contiene las tarjetas de los modelos que cumplen su criterio, sin ejecutar JavaScript; y (d) no existe página pregenerada para ninguna otra combinación de filtros, por ejemplo marca + segmento.
- [ ] **CA-13** (→ RF-5, RF-10): Dada una combinación sin página pregenerada (por ejemplo, segmento SUV + autonomía ≥ 400 km + tracción total), cuando abro su URL con query string en una sesión nueva, entonces veo los mismos resultados que quien la compartió y la página no figura entre las indexables de RF-10.
- [ ] **CA-14** (→ RF-7): Dado un modelo descatalogado, cuando abro `/coches`, entonces aparece con la etiqueta "Descatalogado". Con el filtro "a la venta" no aparece.
- [ ] **CA-15** (→ RF-12): Dado un modelo sin dato de autonomía, cuando abro `/coches`, entonces veo su tarjeta con "Autonomía por confirmar"; cuando aplico "autonomía ≥ 400 km", entonces no aparece.
- [ ] **CA-16** (→ RF-3): Dados dos modelos con fecha de inicio de venta y uno sin ella, cuando ordeno por novedad, entonces el más reciente va primero y el que no tiene fecha, al final.
- [ ] **CA-17** (→ RF-8): Dado un modelo sin imagen con licencia registrada, cuando abro `/coches`, entonces su tarjeta muestra la silueta genérica de su segmento, sin imagen de la marca.
- [ ] **CA-18** (→ RF-13): Dado un modelo con `needs_review: true`, cuando construyo el sitio, entonces no aparece en `/coches` ni en ninguna otra página, y el contador no lo incluye.
- [ ] **CA-19** (→ RF-14): Dado el HTML construido de `/coches`, cuando lo leo sin ejecutar JavaScript, entonces contiene un enlace a cada ranking publicado de PRD-005, y cada uno lleva a una página que existe en el build.
- [ ] **CA-20** (→ RF-11): Dado un modelo con `segment` de `tier: E` y valor `suv_compacto`, cuando abro `/coches`, entonces su tarjeta muestra «SUV compacto» igual que la de un modelo con segmento de fuente, sin marca ni etiqueta de clasificación editorial; con el filtro de segmento «SUV compacto» aparece, y figura en `/segmentos/suv-compacto`.
- [ ] **CA-21** (→ RF-11): Dado un `segment` con `tier: E`, cuando el validador de datos lo comprueba, entonces solo es válido si el campo es `segment`, tiene `note` y su fecha; y dada una ejecución de un agente que añada, cambie o borre un `segment` de `tier: E`, entonces el eval la rechaza. Dado un modelo con un `E` y una fuente T1–T3 que lo clasifica según la regla y la tabla, cuando el Researcher lo refresca, entonces el valor pasa a ser el de la fuente.
- [ ] **CA-7** (→ RNF-5): Al cargar cualquier página del catálogo no se crea ninguna cookie ni se escribe nada en localStorage.

## 8. Decisiones y preguntas abiertas
### Resueltas (2026-09-19)
- **Fuente de datos:** la mantiene un agente Researcher con un registro de fuentes fiables, priorizando las webs oficiales de las marcas (ver ADR-0001).
- **Modelos anunciados:** sí se incluyen, marcados como "Próximamente" (RF-7).
- **Imágenes:** sí se incluyen (RF-8).
- **Precio:** PVP oficial sin ayudas (sin Plan MOVES).

### Resueltas (2026-09-23)
- **Marcas que solo publican precio financiado:** se acepta ese precio marcado como tal, con sus condiciones literales a la vista (RF-9, CA-11, ADR-0001). Alternativa descartada: dejar el modelo sin precio, porque el Researcher comprobó que Cupra no publica ningún PVP limpio y el catálogo se quedaría con huecos en marcas que sí se venden.

### Resueltas (2026-09-25)
- **Tramos de precio y autonomía (RF-10):** confirmados los que propuso el agente de Producto, cinco páginas en total. Son los cortes que usa quien compra: por debajo de 30.000 € está el coche urbano, por encima de 45.000 € el premium, y los 400 y los 500 km son las cifras con las que se habla de autonomía. Alternativa descartada: esperar a tener el catálogo para elegir los cortes con los datos delante, porque bloqueaba RF-10 y los tramos se pueden ajustar sin tocar nada más. Con esto CA-12 queda verificable entero.
- **Indexación de `/coches` y de sus URL con filtros (RF-5, RF-10, CA-13):** decidido por el responsable del producto el 2026-10-01. `/coches` sin query string es indexable, además de las páginas de RF-10. Cada página de catálogo lleva en el HTML servido un `<link rel="canonical">` a su propia URL sin query string, así que `/coches?…` apunta a `/coches` y no figura como indexable. Alternativa descartada: `noindex` añadido por JavaScript cuando hay query string, porque en un sitio estático `/coches` y `/coches?…` son el mismo HTML, depende de que el buscador ejecute JS y no se puede probar sobre el build.
- **Bordes de los tramos (RF-10):** decidido por el responsable del producto el 2026-10-01. Precio sin solape, con el borde en el tramo inferior (30.000 € va en «hasta 30.000 €» y 45.000 € en «de 30.000 a 45.000 €»), que es lo que ya decían los textos del diseño. Autonomía ≥, igual que el filtro de CA-2, para que un modelo de 400 km no salga con el filtro «≥ 400 km» y falte en su página. Alternativa descartada: autonomía estrictamente mayor, como sugiere la etiqueta «más de 400 km», porque haría que la página y el filtro dieran resultados distintos con el mismo número.
- **Filtros del catálogo e indexación:** enfoque híbrido, decidido por el responsable del producto. (a) Se pregenera una lista corta y explícita de páginas indexables (marca, segmento, tramos de precio y de autonomía; RF-10). (b) Cualquier otra combinación se resuelve en el navegador con su estado en la query string (RF-5, CA-5, CA-13), sin ser indexable. Motivo: ADR-0003 fija un sitio estático, donde una combinación arbitraria no se puede resolver en servidor. Alternativa descartada: pregenerar una página por cada combinación de filtros, porque daría miles de páginas casi idénticas. Tampoco se filtra solo en cliente, porque dejaría sin URL indexable a marcas, segmentos y tramos que interesa posicionar.

### Resueltas (2026-09-27)
Preguntas abiertas de ADR-0008 que tocaban el alcance, decididas por el responsable del producto:
- **Segmento (RF-11):** una sola lista con los nombres del mercado, donde SUV pequeño, compacto y grande son segmentos. Encaja con cómo busca el comprador y con el ejemplo de CA-13. Vale una fuente de tier 3 (prensa) si la marca no lo publica. Alternativas descartadas: separar tamaño (A–E) y carrocería en dos campos, porque añade un filtro que nadie ha pedido, y usar solo A–E, porque el comprador no busca así. **2026-10-26:** el 72 % de las fichas estaba sin segmento porque las fuentes dicen «SUV, segmento C» y no «SUV compacto»; se admite una tabla cerrada de equivalencias que cita la frase literal. Descartado: deducir por longitud o precio (es estimar) y un valor «SUV» sin tamaño (rompe el «uno solo»). La clasificación editorial queda para una ADR.
- **Novedad (RF-3):** la fecha de inicio de venta en España, que también da la fecha prevista de "Próximamente". Alternativas descartadas: la fecha en que se dio de alta en el catálogo, que mide el trabajo del Researcher y no la novedad del coche, y quitar la novedad del orden.
- **Descatalogados (RF-7, CA-14):** se muestran con la etiqueta "Descatalogado" y un tercer valor en el filtro de estado. Alternativa descartada: guardarlos solo como histórico.
- **Datos ausentes (RF-12, CA-15):** el modelo se muestra con "por confirmar" y sale de los resultados cuando se filtra por ese campo, igual que el precio ausente de CA-9. Alternativas descartadas: ocultarlo, que deja huecos en marcas que sí se venden, e incluirlo al filtrar, que da resultados engañosos.

- **Licencia de las imágenes (RF-8, CA-17):** primero Wikimedia Commons, donde cada foto trae su licencia explícita y su atribución, que es lo que pide CA-10; la sala de prensa de la marca solo si sus términos escritos permiten este uso, y si no, una silueta genérica del segmento. Se exige una licencia que permita el uso comercial porque la visión aún no ha decidido si la web se monetiza, y así no hay que volver a revisar las imágenes si lo hace. Alternativas descartadas: las salas de prensa como fuente principal, porque ni Cupra ni Polestar tienen términos confirmados y el «uso editorial» suele excluir el comercial; ir sin imágenes, que resta atractivo al catálogo; y pedir permiso a cada marca, que es lento y no lo puede hacer un agente.

### Resueltas (2026-10-01)
- **Modelos en revisión (RF-13, CA-18):** un modelo con `needs_review: true` no se publica entero, decidido por el responsable del producto. Es la opción (a) de la pregunta abierta 5 de PRD-002. Motivo: ADR-0001 dice que lo que está en revisión no se publica, y los agentes marcan así los datos que no han podido leer de una fuente oficial. Alternativas descartadas: publicarlo sin los datos en discrepancia, porque el esquema no dice qué campo es el dudoso; o con un aviso «datos en revisión», porque publica igualmente un dato que no está verificado.

### Resueltas (2026-10-13)
- **Entrada a los rankings (RF-14, CA-19):** `/coches` enlaza a los rankings de PRD-005, decidido por el responsable del producto al pasar PRD-005 a `ready`. Alternativa descartada: enlazarlos desde la portada, que cambiaría PRD-004.

### Abiertas
- ~~**¿Qué hacer con los modelos sin segmento? (RF-1, RF-2, RF-11, RF-12; PRD-002, PRD-005)**~~ Abierta y resuelta el 2026-10-26 por el responsable: **A y B ya, y C a una ADR**. **Actualización 2026-10-27/28: C se adopta** con las condiciones de ADR-0021 (ver la alternativa C tachada más abajo, RF-11, CA-20 y CA-21). A: la regla se aplica igual en todas las fichas (con T3 vale lo mismo; se reintentan las fuentes con 403). B: tabla cerrada de equivalencias en `data-model.md` (RF-11). C: la clasificación editorial de lo que siga sin segmento la estudia una ADR antes de decidirse, porque choca con ADR-0001. Además, un modelo sin segmento se publica con «por confirmar» (RF-12); se corrige `data-model.md`, que lo llamaba «no publicable». El análisis que llevó a la decisión:
  - **Los datos** (`data/raw/`, 2026-10-26, 145 fichas): 41 tienen segmento (24 de una fuente T1 y 17 de una T3), 93 tienen `segment: null` y 11 no traen la clave: **104 sin segmento (72 %)**. De los 93 `null`, 82 fichas (el recuento incluye las de las 11 sin clave que lo anotan; no he podido separarlos) anotan en `open_questions` por qué. Con ellas, lo que dicen las notas, a grandes rasgos y con solapes:
    - **La fuente da una clasificación que no es de la lista de RF-11** (unas 18 fichas): «segmento B/C/D», «B-SUV», «SUV, segmento D» (Ford Explorer, Puma, Mustang Mach-E y Capri; Fiat 600e y Grande Panda; Kia EV4), «crossover pequeño», «tamaño compacto», «SUV de tamaño medio» (Volvo).
    - **La fuente solo dice «SUV» o «crossover», sin tamaño** (unas 22): Kia EV5, EV6 y EV9, VW ID.4, Tesla Model Y, Skoda Enyaq, Toyota bZ4X, Abarth 600e, MG S5 y S6, entre otros.
    - **Ninguna fuente leída lo clasifica, o no se pudo leer** (unas 19): los siete Peugeot (la web de la marca devuelve 403 y no se ha leído), Kia EV3, Hyundai Ioniq 5, Mini Cooper, MG4, Nissan Leaf, Polestar 4…
    - **Hay un término literal en una fuente T3 y se ha dejado en `null`**: Volvo ES90 («Berlina», quecochemecompro.com). La nota cita que ADR-0001 solo admite T3 «para confirmar», lo que contradice la regla del 2026-10-13 (con T3 «vale lo mismo»). Es una incoherencia de aplicación, no de datos.
    - Los 41 con segmento se reparten así: SUV compacto 13, berlina 6, urbano 6, SUV grande 5, SUV pequeño 4, compacto 3, monovolumen 2, familiar 1, deportivo 1, **furgoneta 0**. Con el reparto actual existirían 9 de las 10 páginas `/segmentos/{segmento}` (RF-10), y casi todas con muy pocos modelos.
  - **Qué provoca hoy**: (1) la tarjeta dice «por confirmar» (RF-12) en 7 de cada 10 modelos, y el propio `data-model.md` la llama «no publicable» sin segmento, lo que no encaja con RF-12, que sí la muestra: hay que aclararlo sea cual sea la decisión; (2) el modelo no sale al filtrar por segmento (RF-2, CA-15 por analogía) ni figura en ninguna página `/segmentos/…` (RF-10, CA-12); (3) en PRD-002 la cabecera pone «Segmento por confirmar» (RF-2), la silueta es la genérica (RF-12) y no hay bloque de modelos relacionados (RF-15, CA-17); (4) en PRD-005 los rankings filtrados por segmento dejan fuera a esos modelos aunque lideren el ranking (RF-8, CA-8), así que «el SUV compacto con más autonomía» se calcula sobre 13 modelos y no sobre los que existen; (5) PRD-004 solo enlaza segmentos con modelos, así que la franja «Explorar» queda corta.
  - **Alternativas**:
    - **A. Mantener la regla y aplicarla de forma uniforme.** Se corrige la incoherencia de T3 (Volvo ES90 pasaría a `berlina`) y se reintenta leer las páginas con 403 donde se pueda. *PRD-001/002/005:* sin cambios de texto; el hueco baja poco (unas 5 a 10 fichas, a falta de comprobarlo) y la mayoría seguirá en «por confirmar». *ADR-0001:* intacta, cada valor lleva fuente, URL y fecha. Es la opción más prudente y la que menos sirve al filtro de segmento.
    - **B. Tabla cerrada de equivalencias, publicada y con cita.** Se mantiene que la fuente ha de decir algo del modelo, pero se admite que el término no sea idéntico si está en una tabla fija y pequeña de `data-model.md` (por ejemplo, «SUV/crossover» + «segmento B» = `suv_pequeno`; + «segmento C» = `suv_compacto`; + «segmento D/E» = `suv_grande`; «crossover compacto» = `suv_compacto`, que ya se aceptó en Citroën e-C4). La nota sigue citando la frase literal de la fuente y la tabla es la única interpretación permitida. Un «SUV» sin tamaño ni letra sigue siendo `null`. *PRD-001:* RF-11 y la regla de `data-model.md` cambian; RF-12 y los CA no. *PRD-002/005:* sin cambios de texto; ganan las 18 fichas con letra de segmento (unos 12 puntos más de cobertura), y el resto sigue fuera. *ADR-0001:* la regla de «fuente, URL y fecha» se cumple (la fuente sigue diciendo la frase); lo que se relaja es «no estimar», y la tabla es lo que lo acota. Requiere decidir si la letra de la fuente T3 basta (ADR-0001: «solo para confirmar») y probablemente una enmienda de ADR-0008, que no es de Producto.
    - ~~**C. Clasificación editorial hecha por una persona.**~~ **Adoptada el 2026-10-27 (responsable, ADR-0021), ya no es alternativa descartada ni pendiente.** Se decidió: excepción acotada al segmento, con `tier: E` y fuente «editorial»; solo la escribe una persona, y vale cualquiera con permiso de fusión en el repositorio (no solo el responsable); la sustituye cualquier fuente T1–T3; la tarjeta del catálogo no la marca (solo la ficha, PRD-002 RF-9); y se escribe un criterio común en `data-model.md`, público, que cada nota cita. Alternativas descartadas por la ADR: reutilizar T3 con una fuente «siete3» (mentiría sobre el nivel), un nivel editorial para cualquier campo (abriría la puerta a corregir precios a mano), un campo aparte y que el Researcher proponga el valor. Texto original de la alternativa: El responsable asigna el segmento de los modelos sin clasificación y queda registrado como un dato con fuente «criterio editorial» y fecha, no como el texto de una web. *PRD-001/002/005:* cobertura completa a coste de trabajo manual; RF-11 pasa de «el que usa la fuente» a «el que decide la persona». *ADR-0001:* **choca**: no hay URL, y una fuente editorial propia no encaja en los niveles T1 a T3, así que exige una enmienda de la ADR (nivel o excepción nueva) y deja de cumplirse «todo dato tiene su fuente» en el sentido de la visión (principio 0). Además, un agente no puede hacerlo y la persona es cuello de botella en cada modelo nuevo.
    - Descartada de entrada, sin desarrollarla: **deducir el segmento por la longitud o el precio**, porque es una estimación y no hay dato de longitud en el modelo de datos; y **añadir un valor «SUV» sin tamaño a RF-11**, porque rompe el «uno solo» y se solapa con las tres páginas de SUV. Ambas se pueden recuperar si el responsable las pide.
  - **Recomendación: B, con A como paso previo.** Aplicar ya A (T3 cuenta, se reintentan los 403) porque es una corrección, no un cambio de alcance. Y B acotada a «tipo de carrocería + letra de segmento en la misma fuente», con la tabla en `data-model.md`: recupera las fichas que hoy se pierden por una cuestión de vocabulario sin dejar de citar lo que dice la fuente, y mantiene el `null` cuando la fuente no da tamaño. Los «SUV» sin tamaño (unas 22 fichas) seguirán sin segmento y es el coste que se acepta, mejor que inventar el tamaño. C queda como último recurso solo si, tras A y B, el hueco sigue siendo grande, y entonces haría falta antes una ADR. Aun así, tras A y B es probable que el 55 % o más siga sin segmento: conviene que el responsable decida si ese nivel es aceptable para el filtro de RF-2 y para los rankings filtrados, o si prefiere C.
  - **Pendiente de comprobar**: el recuento de fichas «que lo intentaron» no coincide con el de la petición (103); he contado 82 fichas con nota de segmento. Los porcentajes por motivo son aproximados porque una ficha puede cumplir varios.

## 9. Historial de cambios
| Fecha | Cambio | Autor |
|---|---|---|
| 2026-09-19 | Borrador inicial | Claude |
| 2026-09-19 | Resueltas las preguntas de fuentes, anunciados, imágenes y precio. Añadidos RF-7, RF-8, CA-8 a CA-10 | Rod / Claude |
| 2026-09-23 | Se acepta el precio financiado marcado como tal, con sus condiciones. Añadidos RF-9 y CA-11 | Rod / Claude |
| 2026-09-25 | Resuelta la pregunta de filtros e indexación (enfoque híbrido). Aclarada la sección 2; ajustados RF-2 y RF-5; añadidos RF-10, CA-12 y CA-13. Abierta la confirmación de los tramos de precio y autonomía | Rod / Claude |
| 2026-09-25 | Confirmados los tramos de precio y autonomía de RF-10; pasan al propio RF-10 y CA-12 queda verificable | Rod / Claude |
| 2026-09-27 | Resueltas las preguntas de alcance de ADR-0008: segmento, novedad, descatalogados y datos ausentes. Ajustados RF-3 y RF-7; añadidos RF-11, RF-12 y CA-14 a CA-16 | Rod / Claude |
| 2026-09-27 | Resuelta la licencia de las imágenes: Commons primero, prensa solo con términos escritos, silueta si no hay ninguna. Ajustado RF-8; añadido CA-17. Sin preguntas abiertas | Rod / Claude |
| 2026-09-27 | Fijadas en RF-10 las URL de las páginas de segmento y de tramo (pregunta abierta de ADR-0006) | Rod / Claude |
| 2026-10-01 | Los modelos con `needs_review: true` no se publican. Añadidos RF-13 y CA-18 | Rod / Claude |
| 2026-10-01 | `/coches` es indexable y las URL con filtros se marcan con canonical a su página sin query string (CA-13) | Rod / Claude |
| 2026-10-01 | Fijados en RF-10 los bordes de los tramos de precio y de autonomía (pregunta 1 de `paginas-catalogo.md`) | Rod / Claude |
| 2026-10-09 | Rankings pasa a PRD-005: PRD-004 es la portada | Rod / Claude |
| 2026-10-13 | `/coches` enlaza a los rankings de PRD-005. Añadidos RF-14 y CA-19 | Rod / Claude |
| 2026-10-26 | Nueva pregunta abierta: 104 de 145 fichas sin segmento y tres alternativas (sección 8). No cambia RF, CA ni la regla | Claude |
| 2026-10-26 | Resuelta la pregunta de los modelos sin segmento: A y B (tabla cerrada de equivalencias en `data-model.md`, RF-11) y C a una ADR. Un modelo sin segmento se publica con «por confirmar» (RF-12). Sin cambios en CA | responsable + Claude |
| 2026-10-28 | Enmienda por ADR-0021 (aceptada el 2026-10-27): RF-11 admite el segmento editorial (`tier: E`) cuando ninguna fuente lo clasifica tras la regla y la tabla; la tarjeta no lo marca; lo asigna cualquiera con permiso de fusión; criterio común en `data-model.md`. Alternativa C de la sección 8 tachada y adoptada. Añadidos CA-20 y CA-21 | responsable + Claude |
