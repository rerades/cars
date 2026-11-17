# ADR-0027 — Fuentes alternativas del precio cuando la web de la marca no da el PVP

- **Estado:** aceptada (2026-11-17). La pregunta 1 pasa a Producto: estudiará en PRD-001 RF-9 los precios de medios como T3 (opción 5).
- **Fecha:** 2026-11-16

## Contexto

ADR-0001, regla 1: el precio es el PVP oficial de la marca en España, **sin ayudas**, y **solo desde
T1** (web oficial en España o sala de prensa oficial). Si la marca solo publica un precio ligado a
una oferta, se guarda como `financed` con su texto literal; si no hay ninguno, el campo queda vacío.
[data-model.md](../data-model.md), «Precio»: `value` es el PVP con IVA sin ayudas, `tier: T1`
obligatorio, y «Precio desde» sale del mínimo de las versiones o se muestra «Precio por confirmar».
ADR-0001, regla 6: no se evitan protecciones de acceso. ADR-0020: el verificador busca cada precio en
el texto servido por la `url` guardada.

Hoy, en `main`, **164 de los 214 modelos de `data/raw/` no tienen ningún precio** (50 ficheros tienen
al menos una versión con `price` no nulo). Recuento hecho el 2026-11-16 con búsquedas sobre
`price:` y sobre las líneas de `open_questions` que hablan del precio, asignando cada modelo a su
causa principal según lo que anotó el Researcher:

| Causa (de `open_questions`) | Modelos | Marcas |
|---|---|---|
| **A. La web de la marca no se deja leer** (HTTP 403 o timeouts) | 70 | Mercedes-Benz 13, Citroën 10, Fiat 9, BMW 6, Volvo 6, Audi 5, DS 4, Maserati 3, MINI 3, Opel 3, Abarth 2, Jeep 2, Tesla 2, Alfa Romeo 1, Lancia 1 |
| **B. Solo cuotas, ofertas financiadas o precios con Plan Auto+/CAE restados**, que no son PVP y tampoco valen como `financed` | 55 | Ford 9, BYD 7, Nissan 6, Toyota 6, Škoda 5, Leapmotor 5, Volkswagen 5, KG Mobility 2, Mercedes-Benz 2 (GLB, Clase G), Polestar 2, Dacia 1, GWM 1, Jaecoo 1, Mitsubishi 1, Omoda 1, Suzuki 1 |
| **C. El precio lo pinta JavaScript** (configurador o ficha sin texto servido) | 18 | Kia 8, Smart 4, Lexus 2, Mazda 2, Mobilize 1, Range Rover 1 |
| **D. Otras**: la marca no publica precio o no hay página T1 legible de esa versión | 21 | Opel 7, Peugeot 4, XPeng 3, Geely 2, Lotus 2, Voyah 2, MG 1 |

La asignación es aproximada en los ficheros que anotan dos causas (Volkswagen dice a la vez «solo
oferta» y «JavaScript»; Mercedes-Benz alterna 403 y timeouts): cada modelo cuenta una sola vez.

La pregunta es si hay **otra fuente** que dé el PVP en España sin ayudas dentro de esas reglas.

## Opciones consideradas

Todas las pruebas son del 2026-11-16, con WebFetch y WebSearch, sobre marcas de las bloqueadas.

**1. Listas de tarifas en PDF publicadas por la marca en su dominio español (T1, «lista de
precios»).** Ya cabe en ADR-0001: la tabla de T1 nombra la lista de precios. Pruebas:
- Škoda: la búsqueda devuelve un PDF en `https://www.skoda.es/_doc/2023e3d9-8c55-4fdb-a991-58025dd004d0`.
  WebFetch lo descarga, pero no extrae texto (PDF comprimido); sus metadatos dicen «Presentación de
  PowerPoint», creado el 2024-12-02. Según el extracto del buscador (no verificado al abrir el
  documento), muestra PVP con las promociones y el Plan MOVES aparte, válido del 1 al 31 de
  diciembre de 2024: hoy estaría caducado.
- Volvo: `https://pricelists.volvocars.com/es/` responde 301 a la página alemana de listas
  internacionales; `https://www.volvocars.com/es/l/pricelists` da 403. La búsqueda solo encuentra
  listas en PDF de otros países (Irlanda, Suiza, Reino Unido), que serían T2 y no valen para precio.
- Kia: la portada `https://www.kia.com/es/` no enlaza tarifas ni sala de prensa; solo
  `https://www.kia.com/es/catalogos/`, sin indicar que haya precios.

  **Ganancia comprobada: 0 modelos.** Posible: los 5 de Škoda si la marca publica un PDF vigente y
  la factoría sabe leerlo, y cualquier marca de la causa B que publique tarifa. No resuelve la causa
  A: si el dominio da 403, también lo da el PDF que cuelga de él.

**2. Sala de prensa oficial de la marca (T1).** Pruebas:
- Stellantis (Abarth, Alfa Romeo, Citroën, DS, Fiat, Jeep, Lancia, Opel, Peugeot):
  `https://www.media.stellantis.com/es-es` responde 403.
- BMW y MINI: los YAML de BMW ya anotan que `press.bmwgroup.com` da 403 o falla (no repetido hoy).
- Škoda: `https://www.skoda-storyboard.com/es/` da 404; la sala internacional
  (`skoda-storyboard.com/en/…`) no es de España.
- Kia y Nissan: la búsqueda no encuentra notas de prensa españolas con precio; solo medios.

  **Ganancia comprobada: 0 modelos.** Las 9 marcas de Stellantis suman 43 modelos sin precio, pero
  su sala de prensa está tan cerrada como sus webs.

**3. Base de datos del IDAE (`data/sources/idae-es.yaml`).** Es T2 y su ficha de registro dice, de
una lectura anterior, que «No da precio»; no se ha repetido la consulta porque los datos llegan por un
POST que solo hace `factory/fetch-idae.ts`, y lanzarlo es obtener datos del producto (ADR-0001, solo
el Researcher). **Ganancia: 0.** Aunque diera precio, un T2 no vale para precio según la regla 1.

**4. La «Lista Blanca» del Plan Auto+ (Ministerio de Industria).** Según medios T3
(`carwow.es`, `motor16.com`), es la relación de modelos que cumplen los requisitos de fabricación
europea para la ayuda máxima. No la he abierto; por lo que dicen esos medios, no da PVP por versión.
**Ganancia: 0** (impresión, sin verificar), y tampoco sería T1.

**5. Medios T3 que publican la tarifa «sin descuentos»**, con fecha. Prueba:
`https://www.motor.es/noticias/kia-ev2-long-range-venta-espana-2026115298.html` (16/07/2026) da los
cuatro precios del EV2 Long Range y dice literalmente «Precios vigentes desde Julio / 2026, sin
descuentos u otras promociones», sin decir de dónde los saca. Las búsquedas de Škoda, Nissan, Volvo y
Fiat devuelven tablas parecidas en `motor.es`, `km77.com` o `carwow.es`, a menudo con cifras
distintas entre sí para la misma versión (Fiat Grande Panda: 25.450 €, 23.967 €, 26.787 € según el
medio). **Ganancia: probablemente la mayoría de los 164** (impresión: no se ha contado modelo a
modelo). **Se descarta** porque exige cambiar la regla 1 («Solo desde T1») y la fila T3 («Nunca como
única fuente de precio»), y porque las discrepancias entre medios caerían en la regla 3
(`needs_review`) en muchos modelos. Es la única opción con ganancia grande; si Producto la quiere,
es una enmienda de ADR-0001 aparte (ver Consecuencias).

**6. Reconstruir el PVP sumando las ayudas que la propia página T1 dice haber restado**
(causa B: Leapmotor «con 3.375 € del Plan Auto+ y 900 € del CAE descontados», Nissan Townstar, Škoda
Enyaq Coupé). **Ganancia estimada: unos 12 modelos** (Leapmotor 5, Škoda hasta 5, Nissan 2), según
lo que anotan sus `open_questions`; no comprobado versión a versión. **Se descarta**: el importe
guardado no aparecería en la página, así que choca con ADR-0001, regla 7 (no se estima) y con el
verificador de ADR-0020, que lo marcaría `merger:needs-human`; y no consta que el descuento de la
marca sea solo la ayuda (puede llevar campaña comercial).

**7. Leer las webs que dan 403 con otro cliente** (navegador sin cabeza, otra IP, otro agente de
usuario). **Se descarta** sin probar: ADR-0001, regla 6, prohíbe evitar protecciones de acceso.
Leer las páginas de solo JavaScript (causa C) con un navegador no es evitar ninguna protección, pero
es una decisión de herramientas, no de fuentes, y queda fuera de esta ADR.

## Decisión

**No se añade ninguna fuente de precio fuera de T1: la única vía nueva es que el Researcher busque y
lea la lista de tarifas en PDF de la marca en su dominio español, que ya es T1, y los modelos sin
ella siguen en «Precio por confirmar».**

Detalles:
- Un PDF de tarifas cuenta como T1 si está en el dominio oficial de la marca en España (o lo enlaza
  una página de ese dominio), y vale como `pvp` solo si separa el PVP de las ayudas y promociones;
  si no, se aplica la regla 1 tal cual (`financed` con su texto, o vacío).
- La `url` del precio es la del PDF; `retrieved`, la fecha de lectura. Si el PDF tiene fecha o
  vigencia, va en `note`.
- No cambia ADR-0001 ni `data-model.md`. Esta ADR no propone enmiendas: la opción que las
  necesitaría (5) queda descartada.

## Consecuencias

- **Lo bueno:** no se rebaja la fiabilidad del precio. El visitante sigue viendo solo precios de la
  marca o «Precio por confirmar», nunca una cifra de un medio que otro medio contradice.
- **Lo malo: la cobertura apenas cambia.** La ganancia comprobada es 0 modelos y la posible, unos
  pocos (Škoda, si publica un PDF vigente). Los 70 de la causa A y los 18 de la causa C siguen sin
  precio. En la web, tres de cada cuatro modelos dirán «Precio por confirmar», y el filtro de precio
  de los rankings (ADR-0015) y el comparador (ADR-0014) dejarán fuera a la mayoría.
- **Lo malo: la factoría no sabe leer PDF, que yo sepa.** WebFetch no sacó texto del PDF de Škoda,
  y no he comprobado si `factory/fetch-page.ts` ni el verificador de ADR-0020 extraen texto de un
  PDF. Si no lo hacen, un precio sacado de un PDF acabaría en `merger:needs-human`. Esta ADR no
  decide la herramienta; es una pregunta pendiente.
- Si Producto acepta precios de medios (opción 5), haría falta una enmienda de ADR-0001 que cambie la
  regla 1 y la fila T3, un valor nuevo de `price_kind` o de `tier` en `data-model.md` para que la web
  lo distinga, y una regla para cuando dos medios discrepan. Es la única vía que movería de verdad el
  número de modelos con precio.

**Preguntas abiertas:**
1. ~~¿Acepta Producto que tres de cada cuatro modelos queden «Precio por confirmar», o pide la enmienda
   de la opción 5? Lo decide Producto en PRD-001 (RF-9) y después una ADR que enmiende ADR-0001.~~ → 2026-11-17: se acepta la ADR tal cual y Producto valora la opción 5 en PRD-001 RF-9, como pregunta abierta con recomendación. Si la acepta una persona, el Arquitecto enmienda ADR-0001.
2. ¿Saben `fetch-page.ts` y el verificador de ADR-0020 leer el texto de un PDF? Si no, ¿se añade?
   Es una decisión de herramientas aparte.
3. ¿Se usa un navegador sin cabeza para las 18 páginas de solo JavaScript (causa C)? ADR-0020 ya
   anotó el mismo problema para el verificador; no está decidido.
4. ¿Qué marcas de la causa B publican tarifa en PDF? Solo se ha probado Škoda; buscarlo es trabajo
   del Researcher.

**Fuentes consultadas el 2026-11-16:**
- https://www.skoda.es/_doc/2023e3d9-8c55-4fdb-a991-58025dd004d0 (PDF, sin texto extraíble)
- https://pricelists.volvocars.com/es/ (301) y https://www.volvocars.com/es/l/pricelists (403)
- https://www.kia.com/es/ (sin tarifas ni sala de prensa)
- https://www.media.stellantis.com/es-es (403)
- https://www.skoda-storyboard.com/es/ (404)
- https://www.tesla.com/es_ES/model3 (403)
- https://www.motor.es/noticias/kia-ev2-long-range-venta-espana-2026115298.html (T3, tarifa «sin descuentos»)
- Búsquedas: [carwow, lista blanca Plan Auto+](https://www.carwow.es/noticias/7909/lista-blanca-plan-auto-plus-modelos-ayuda-maxima),
  [motor16, lista blanca](https://www.motor16.com/noticias/plan-auto-plus-lista-blanca/),
  [motor1, Grande Panda](https://es.motor1.com/news/751839/fiat-grande-panda-precios-equipamientos/),
  [autofacil, Grande Panda](https://www.autofacil.es/fiat-grande-panda-precios/)
