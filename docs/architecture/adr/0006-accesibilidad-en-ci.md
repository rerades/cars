# ADR-0006 — Comprobación de accesibilidad en la integración continua

- **Estado:** aceptada (2026-09-27)
- **Fecha:** 2026-09-26

## Contexto
La herramienta y el umbral los ha decidido el responsable del producto; esta ADR los documenta con
sus alternativas descartadas y sus costes. Alcance: **solo la comprobación automática de
accesibilidad en la CI**. El resto de la CI/CD sigue pendiente (ver Consecuencias).

Requisitos que obligan a decidir:
- **RNF-3** (PRD-001): accesibilidad WCAG 2.1 AA. Sin ninguna comprobación automática, una
  regresión (contraste, etiqueta que falta, ARIA inválido) llegaría a `main` sin que nadie la vea:
  la web la construyen agentes (visión, principio 4) y no hay revisión humana en cada PR.
- **ADR-0003**: la web es un sitio estático generado con Astro en `web/`. Lo que ve el visitante es
  el HTML ya construido, con componentes compuestos en páginas; una comprobación fiable tiene que
  mirar ese resultado.
- **RF-6 / CA-6**: el estado vacío (ningún modelo cumple los filtros) es una vista propia que
  también debe cumplir RNF-3. Se produce en el navegador (RF-2, RF-5), no en una página pregenerada.
- **RF-10 / CA-12c**: el HTML de las páginas pregeneradas debe contener ya las tarjetas **sin
  ejecutar JavaScript**. Eso exige un navegador real con JavaScript desactivado, y esa necesidad la
  comparte esta ADR: si la CI ya instala un navegador, el coste se paga una vez.
- **RNF-5 / CA-7**: la comprobación no puede exigir cookies ni almacenamiento en el sitio.

## Opciones consideradas
Datos consultados el 2026-09-26 (ver «Fuentes»).

- **pa11y-ci: descartada.** Licencia LGPL-3.0-only, y usa **Puppeteer** para lanzar el navegador.
  Metería un segundo controlador de navegador junto al de Playwright, que ya hace falta para CA-12c:
  dos instalaciones de navegador y dos maneras de escribir una comprobación. Además, la
  documentación que abrí no dice qué motor de reglas aplica, así que no puedo afirmar que dé la
  cobertura de axe-core. No hay un motivo técnico de fondo contra ella: es un descarte por
  duplicar herramienta.
- **Lighthouse CI: descartada.** Licencia Apache-2.0. Mi impresión (no la he verificado en esta
  ejecución: la página del repositorio no lo dice) es que su categoría de accesibilidad se resume
  en una puntuación y no en una lista de violaciones con su gravedad, que es lo que hace falta para
  aplicar el umbral critical/serious. Además su valor diferencial es el rendimiento (RNF-2), un
  asunto aparte que merece su propia decisión; mezclarlo aquí sería decidir de más.
- **Análisis estático con eslint-plugin-astro: descartada.** Licencia MIT; ofrece reglas
  `astro/jsx-a11y/*` que extienden `eslint-plugin-jsx-a11y`, y requiere ESLint v10 y Node ≥ 22.22.3.
  Analiza el **código fuente** de cada componente por separado; no ve el HTML final compuesto ni
  el contraste calculado con el CSS real, ni ARIA que depende de cómo se combinan componentes (mi
  razonamiento, no una afirmación de la documentación). Se descarta como **sustituto**, no como
  complemento: no está prohibido añadirla más adelante, pero es otra decisión.
- **No comprobar automáticamente y confiar en revisión humana: descartada.** Contradice el modelo
  de trabajo (agentes que abren PR) y deja RNF-3 sin ninguna red.

## Decisión
**La CI ejecutará axe-core con Playwright (`@axe-core/playwright`) sobre el sitio ya construido, y
pondrá el job en rojo si encuentra violaciones `critical` o `serious`; las `moderate` y `minor` se
imprimen y lo dejan en verde. El job informa: no es requisito para fusionar (2026-09-27).**

Detalles:
- **Sobre el build, no sobre el código.** Se construye `web/` y se sirve el resultado estático; los
  tests de Playwright navegan a esas URL.
- **Páginas comprobadas: una por plantilla de PRD-001.**
  | Plantilla | Origen | URL |
  |---|---|---|
  | Listado | RF-1, `/coches` | `/coches` |
  | Marca | RF-4, RF-10 | `/marcas/{marca}` con una marca cualquiera con modelos |
  | Segmento | RF-10 | `/segmentos/{segmento}` con un segmento con modelos |
  | Tramo | RF-10 | una de `/precio/…` o `/autonomia/…` (lista en PRD-001, RF-10) |
  | Estado vacío | RF-6, CA-6 | `/coches` con una query string que no da ningún resultado |
  Se comprueba una página por plantilla, no todas las páginas: las de una misma plantilla
  comparten estructura, y el contenido variable es dato, no marcado.
- **Reglas.** Las etiquetas de axe `wcag2a`, `wcag2aa`, `wcag21a` y `wcag21aa` (las de WCAG 2.1
  A y AA, RNF-3). No se activan las mejores prácticas ni AAA, para que el umbral no bloquee por
  criterios que el PRD no exige.
- **Umbral.** Se lee del campo `impact` de cada violación. `critical` y `serious` → el test falla y
  la CI se pone en rojo. `moderate` y `minor` → se imprimen (regla, elemento, URL) y el test pasa.
- **JavaScript activado en las comprobaciones de axe**, porque el estado vacío existe solo tras
  filtrar en cliente y porque el visitante real ejecuta JS.
- **Momento en la CI.** Un job propio, **después del build de `web/` y de que pasen `npm test` y
  `pnpm run typecheck`** (el gestor pasó a ser pnpm en ADR-0007, posterior a esta ADR), en cada PR que toque `web/` o `data/`. Se ejecuta antes del merge y su
  fallo lo pone en rojo, pero no impide fusionar: no es un check requerido de la rama protegida
  (decidido el 2026-09-27). La forma exacta del workflow la fija la ADR de CI/CD (pendiente).
- **Misma instalación para CA-12c.** Playwright también se usará, en tests separados, con un
  contexto con JavaScript desactivado para comprobar que el HTML servido de las páginas de RF-10
  ya trae las tarjetas. Esta ADR **solo** decide que se reutiliza la instalación; los tests de
  CA-12 no se diseñan aquí.
- **Una violación en una página que todavía no existe.** No se puede comprobar lo que no está
  construido, y no se debe bloquear el trabajo de otros PRD por ello:
  - La lista de páginas comprobadas contiene **solo las plantillas ya implementadas**. La PR que
    implementa una plantilla **añade su entrada a la lista en la misma PR**; es parte de terminarla.
  - Si la PR introduce una plantilla con una violación `critical` o `serious`, su CI se pone en
    rojo: se corrige allí o, si es un falso positivo, se documenta como excepción. **No hay línea
    base que deje pasar violaciones sin documentar.**
  - **Excepciones documentadas.** Un falso positivo se puede excluir, pero solo documentado junto
    a la exclusión en el test: la regla de axe, la URL, el motivo y la fecha. La excepción se
    revisa en la PR que la añade.
  - Una entrada de la lista cuya URL no responde (404 o no se genera) **hace fallar el test**; no
    se omite en silencio, porque una página que desaparece del build no debe quedar sin
    comprobar.
  - Una plantilla que se implemente sin añadirse a la lista no la detecta esta comprobación: lo
    debe cazar la revisión de la PR (ver Consecuencias).

## Consecuencias
**Buenas**
- Una regresión de accesibilidad de gravedad alta no llega a `main` sin que la CI se ponga en rojo.
- Se comprueba lo que ve el visitante (HTML construido y renderizado), no una aproximación.
- Una sola instalación de Playwright (Apache-2.0) sirve para axe y para CA-12c; no hay segundo
  controlador de navegador.
- Las violaciones menores quedan visibles en el log sin frenar el trabajo.

**Malas o a vigilar**
- **Esto NO demuestra conformidad con WCAG 2.1 AA (RNF-3).** Que la CI esté en verde significa
  únicamente «axe-core no ha encontrado violaciones critical o serious en cinco páginas». Las
  pruebas automáticas cubren solo una parte de los criterios de éxito de WCAG; el resto no se
  puede decidir con una regla. **Siguen necesitando revisión humana**: la navegación completa
  con teclado, el orden y la visibilidad del foco, que los textos alternativos de las imágenes
  (RF-8) tengan sentido y no solo existan, y la coherencia de los mensajes y del estado vacío para
  un lector de pantalla. Nadie debe citar esta CI como prueba de cumplimiento de RNF-3. La revisión
  humana la hace el responsable del producto, sin bloquear las PR (2026-09-27); hasta que la haga,
  RNF-3 queda cubierto solo en parte.
- **Cobertura limitada de páginas.** Una página por plantilla no verá un problema que dependa de un
  dato concreto (una imagen sin alt solo en un modelo, un contraste roto por una etiqueta
  «Próximamente» que aparece solo en algunos). Se podría ampliar con más páginas a costa de
  tiempo de CI; no se decide aquí.
- **Las `moderate` y `minor` no bloquean y se acumularán** si nadie mira el log. Sin un proceso
  que las lea, son ruido que se ignora.
- **Falsos positivos y `impact` de axe.** El bloqueo depende de la gravedad que asigne axe-core; si
  una versión nueva reclasifica una regla, la CI puede ponerse roja sin cambios en la web. No hay
  excepciones automáticas: se tratan con una excepción documentada (ver «Decisión»).
- **El estado vacío necesita un dato que no dé resultados.** La query string de la comprobación
  debe seguir dando cero modelos mientras el catálogo cambie; hay que elegirla con cuidado, o
  el test verá otra vista sin avisar.
- **Otra dependencia de CI y descargas de navegador.** Playwright descarga navegadores; aumenta el
  tiempo y el tamaño de la CI. Hay que medirlo, y no lo he podido verificar.
- **Dependencia de la ADR-0003** (estar en `web/` y ser un sitio estático) y del futuro workflow;
  si cambia el stack, esta ADR se revisa.
- **Versiones.** Las de las fuentes eran las últimas que vi; la versión concreta la fija el
  desarrollador al instalarlas. Las versiones publicadas, sobre todo sus fechas, pueden haber
  cambiado.

**Sigue pendiente (fuera de esta ADR)**
- El workflow de CI (`.github/workflows`): no se toca aquí; esta ADR es la decisión, no la
  implementación.
- CI/CD general y cómo publican los agentes.
- Rendimiento (RNF-2) en la CI.
- Diseño de los tests de CA-12.

**Preguntas resueltas (2026-09-27, responsable del producto)**
- **Revisión humana de teclado, foco y textos alternativos (RNF-3):** la hace el responsable del
  producto. No bloquea ninguna PR.
- **URL de las plantillas de segmento y tramo:** fijadas en PRD-001, RF-10: `/segmentos/{segmento}`,
  `/precio/…` y `/autonomia/…`.
- **Excepciones a una regla de axe:** sí, documentadas (ver «Decisión»).
- **¿Es el job requisito para fusionar?** No: informa. En rojo avisa, pero la PR se puede fusionar.

## Fuentes
Consultadas con WebFetch el 2026-09-26.
- `@axe-core/playwright`: licencia MPL-2.0; última versión en el registro npm: 4.13.0; depende de
  `playwright >= 1.0.0` como peer — <https://registry.npmjs.org/@axe-core/playwright>. Repositorio
  (MPL-2.0, 763 commits, 725 estrellas) — <https://github.com/dequelabs/axe-core-npm>.
- `axe-core`: licencia MPL-2.0; última versión 4.13.0 — <https://registry.npmjs.org/axe-core>.
- `playwright`: licencia Apache-2.0; versión 1.63.0 — <https://registry.npmjs.org/playwright/latest>
  y <https://github.com/microsoft/playwright/blob/main/LICENSE>.
- **Fechas de publicación: no verificadas.** La página de releases de axe-core-npm
  (<https://github.com/dequelabs/axe-core-npm/releases>) devolvió «v4.13.0 · 11 de agosto» y la de
  Playwright (<https://github.com/microsoft/playwright/releases/latest>) «v1.63.0 · 4 de
  septiembre», pero ambas con año 2024, lo que es incompatible con esos números de versión. Por
  ello no doy fecha de última publicación fiable; el desarrollador debe comprobarla antes de
  instalar. El registro npm no me devolvió el campo `time`.
- pa11y-ci: LGPL-3.0-only, Puppeteer, versión 4 vigente — <https://github.com/pa11y/pa11y-ci>.
- Lighthouse CI: Apache-2.0 — <https://github.com/GoogleChrome/lighthouse-ci>.
- eslint-plugin-astro: MIT, reglas `astro/jsx-a11y/*` — <https://github.com/ota-meshi/eslint-plugin-astro>.
