---
id: PRD-001
title: Catálogo de modelos
status: ready
priority: P0
depends_on: []
epic: "#32"
updated: 2026-10-01
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
- Rankings (PRD-004).
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
- **RF-11:** El segmento es uno de esta lista, la que usa quien compra: urbano, compacto, berlina, familiar, SUV pequeño, SUV compacto, SUV grande, monovolumen, furgoneta y deportivo. Cada modelo tiene uno solo.
- **RF-12:** Un modelo sin segmento, autonomía o tracción se muestra igual, con "por confirmar" en el campo que falta. Si el visitante filtra por ese campo, el modelo no aparece, porque no se puede afirmar que cumpla el filtro.
- **RF-13:** Un modelo marcado `needs_review: true` no se publica: no tiene tarjeta, no cuenta en los contadores ni aparece en ninguna página pregenerada hasta que una persona lo revise y quite la marca (ADR-0001, regla 3).

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
- Los datos los obtiene el agente **Researcher** siguiendo `docs/architecture/adr/0001-fuentes-de-datos.md` y el registro `data/sources/registry.yaml`.
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
- **Bordes de los tramos (RF-10):** decidido por el responsable del producto el 2026-10-01. Precio sin solape, con el borde en el tramo inferior (30.000 € va en «hasta 30.000 €» y 45.000 € en «de 30.000 a 45.000 €»), que es lo que ya decían los textos del diseño. Autonomía ≥, igual que el filtro de CA-2, para que un modelo de 400 km no salga con el filtro «≥ 400 km» y falte en su página. Alternativa descartada: autonomía estrictamente mayor, como sugiere la etiqueta «más de 400 km», porque haría que la página y el filtro dieran resultados distintos con el mismo número.
- **Filtros del catálogo e indexación:** enfoque híbrido, decidido por el responsable del producto. (a) Se pregenera una lista corta y explícita de páginas indexables (marca, segmento, tramos de precio y de autonomía; RF-10). (b) Cualquier otra combinación se resuelve en el navegador con su estado en la query string (RF-5, CA-5, CA-13), sin ser indexable. Motivo: ADR-0003 fija un sitio estático, donde una combinación arbitraria no se puede resolver en servidor. Alternativa descartada: pregenerar una página por cada combinación de filtros, porque daría miles de páginas casi idénticas. Tampoco se filtra solo en cliente, porque dejaría sin URL indexable a marcas, segmentos y tramos que interesa posicionar.

### Resueltas (2026-09-27)
Preguntas abiertas de ADR-0008 que tocaban el alcance, decididas por el responsable del producto:
- **Segmento (RF-11):** una sola lista con los nombres del mercado, donde SUV pequeño, compacto y grande son segmentos. Encaja con cómo busca el comprador y con el ejemplo de CA-13. Vale una fuente de tier 3 (prensa) si la marca no lo publica. Alternativas descartadas: separar tamaño (A–E) y carrocería en dos campos, porque añade un filtro que nadie ha pedido, y usar solo A–E, porque el comprador no busca así.
- **Novedad (RF-3):** la fecha de inicio de venta en España, que también da la fecha prevista de "Próximamente". Alternativas descartadas: la fecha en que se dio de alta en el catálogo, que mide el trabajo del Researcher y no la novedad del coche, y quitar la novedad del orden.
- **Descatalogados (RF-7, CA-14):** se muestran con la etiqueta "Descatalogado" y un tercer valor en el filtro de estado. Alternativa descartada: guardarlos solo como histórico.
- **Datos ausentes (RF-12, CA-15):** el modelo se muestra con "por confirmar" y sale de los resultados cuando se filtra por ese campo, igual que el precio ausente de CA-9. Alternativas descartadas: ocultarlo, que deja huecos en marcas que sí se venden, e incluirlo al filtrar, que da resultados engañosos.

- **Licencia de las imágenes (RF-8, CA-17):** primero Wikimedia Commons, donde cada foto trae su licencia explícita y su atribución, que es lo que pide CA-10; la sala de prensa de la marca solo si sus términos escritos permiten este uso, y si no, una silueta genérica del segmento. Se exige una licencia que permita el uso comercial porque la visión aún no ha decidido si la web se monetiza, y así no hay que volver a revisar las imágenes si lo hace. Alternativas descartadas: las salas de prensa como fuente principal, porque ni Cupra ni Polestar tienen términos confirmados y el «uso editorial» suele excluir el comercial; ir sin imágenes, que resta atractivo al catálogo; y pedir permiso a cada marca, que es lento y no lo puede hacer un agente.

### Resueltas (2026-10-01)
- **Modelos en revisión (RF-13, CA-18):** un modelo con `needs_review: true` no se publica entero, decidido por el responsable del producto. Es la opción (a) de la pregunta abierta 5 de PRD-002. Motivo: ADR-0001 dice que lo que está en revisión no se publica, y los agentes marcan así los datos que no han podido leer de una fuente oficial. Alternativas descartadas: publicarlo sin los datos en discrepancia, porque el esquema no dice qué campo es el dudoso; o con un aviso «datos en revisión», porque publica igualmente un dato que no está verificado.

### Abiertas
- Ninguna.

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
| 2026-10-01 | Fijados en RF-10 los bordes de los tramos de precio y de autonomía (pregunta 1 de `paginas-catalogo.md`) | Rod / Claude |
