# ADR-0005 — Sistema de diseño y librería de componentes

- **Estado:** propuesta
- **Fecha:** 2026-09-25

## Contexto
El responsable del producto ha fijado tres requisitos que **no se discuten**: (1) componentes
nativos de Astro (`.astro`), sin React, Vue ni Svelte, islas incluidas; (2) estilos con Tailwind CSS;
(3) librería open source con licencia comprobada. Esta ADR investiga qué candidatas cumplen eso hoy
y recomienda una.

Requisitos que condicionan la elección:
- **ADR-0003:** sitio estático con Astro, cero JavaScript por defecto y solo el imprescindible en el
  cliente. **RNF-2:** LCP < 2,5 s en móvil 4G. Una librería que envíe un runtime grande, o que exija JS
  para lo que es HTML, va contra esto.
- **RNF-3:** WCAG 2.1 AA.
- **RNF-5 / CA-7:** ni cookies ni `localStorage`. Los componentes no pueden persistir estado (p. ej. un
  selector de tema que escriba en `localStorage`).
- **RNF-4:** textos preparados para i18n: los componentes no pueden llevar textos fijos en inglés que
  no se puedan cambiar.
- **Visión, principio 4:** construida por agentes. Interesa código legible, propio y fácil de editar.
- **Lo que necesita PRD-001:** tarjeta de modelo (RF-1, RF-8), filtros —marca, segmento, rango de
  precio, autonomía mínima, tracción, estado (RF-2, RF-7)—, orden (RF-3), estado vacío con botón de
  limpiar (RF-6, CA-6), etiquetas «Próximamente» y «precio con oferta» (RF-7, RF-9) y navegación entre
  páginas (marcas, segmentos, tramos: RF-4, RF-10). El PRD no pide paginación; no la supongo.

Fuentes consultadas el **2026-09-25** (abiertas en esta ejecución). Los datos de GitHub proceden de la
API `api.github.com/repos/...` de cada repositorio.

### Candidatas que cumplen los tres requisitos
**Starwind UI** — <https://github.com/starwind-ui/starwind-ui>, <https://starwind.dev/docs/getting-started/>
- Licencia: MIT (API y `LICENSE` en `raw.githubusercontent.com/starwind-ui/starwind-ui/main/LICENSE`, © Branden, 2024). El pie de starwind.dev dice «All rights reserved»; no lo he podido conciliar, manda el fichero `LICENSE` del repositorio.
- Mantenimiento: repo creado el 2025-02-21; último push 2026-09-23; 737 estrellas, 41 forks, 5 issues abiertas, no archivado.
- Componentes: 55 según la descripción del repo, «60+ estilados y 40+ primitivas» según la web. En la doc de Card aparecen Badge, Select, Checkbox, Breadcrumb y Pagination. **No he visto un componente de estado vacío.**
- Nativos: sí, en parte. La doc de Card indica que es un `.astro` de solo estilo, instalado con la CLI. Pero es un sistema **en capas** para Astro, React y Vue (beta), con un paquete `@starwind-ui/runtime` compartido para el comportamiento y adaptadores por framework. El adaptador de Astro es `.astro`; **no he podido comprobar si arrastra React como dependencia** (la doc no lo aclara).
- Accesibilidad: el README dice «keyboard navigable and screen reader friendly». No cita WCAG ni auditorías.

**bejamas/ui** — <https://github.com/bejamas/ui>, <https://ui.bejamas.com>, <https://bejamas.com/blog/introducing-bejamas-ui-an-astro-native-component-library>
- Licencia: MIT, © 2025 Bejamas Group sp. z o. o. (`LICENSE` en raw.githubusercontent.com). La web y el artículo no dicen nada de licencia; lo confirma el fichero.
- Mantenimiento: repo creado el 2025-09-18; último push 2026-09-25; 232 estrellas, 8 forks, 838 commits, no archivado. Anuncio público de 2025-12-12. Empresa detrás.
- Componentes: 50+. Incluye Card, Badge, Checkbox, Select, Native Select, Slider, Breadcrumb, Navigation Menu, Tabs, Button. **No he visto estado vacío ni paginación** en la lista de la web.
- Nativos: sí, `.astro` sin runtime de framework. El comportamiento interactivo se apoya en primitivas propias (`data-slot`) que se distribuyen por versión, no copiadas: eso deja una dependencia del proyecto en el código copiado.
- Accesibilidad: la web afirma seguir los patrones WAI-ARIA y traer teclado y ARIA por defecto. No cita WCAG 2.1 AA.

**Bearnie** — <https://github.com/michael-andreuzza/bearnie>, <https://bearnie.dev/docs>, <https://www.tailawesome.com/resources/bearnie>
- Licencia: MIT, © Michael Andreuzza, 2025 (`LICENSE` en raw.githubusercontent.com).
- Mantenimiento: repo creado el 2026-01-25 (**el más joven**); último push 2026-09-20; 352 estrellas, 13 forks, 146 commits, 2 issues abiertas; 3 contribuidores según tailawesome.
- Componentes: 50+. Incluye Card, Badge, Checkbox, Radio, Select, Slider, Breadcrumb, Navigation Menu, Pagination, Tabs, **Empty**, Field, Label, Button.
- Nativos: sí. Son ficheros `.astro` copiados al proyecto, sin paquete npm de por medio; el JS interactivo es JavaScript plano y los componentes estáticos no envían nada.
- Accesibilidad: la doc afirma «every component follows WCAG 2.1 AA», con teclado, lector de pantalla y foco. **Es una afirmación, sin informe de auditoría ni pruebas visibles** en lo que he leído.
- No he comprobado qué versión de Tailwind exige.

### Descartadas antes de comparar
- **daisyUI** — <https://daisyui.com/astro-component-library/> (MIT, según el pie). No son componentes `.astro`: es un plugin de Tailwind que aporta clases CSS, sin JS. Es compatible con Astro, pero no es una librería de componentes en el sentido del requisito (1), y meter sus clases en los `.astro` propios no da estructura ni comportamiento accesible (el marcado lo escribimos nosotros). No incumple los tres requisitos por letra, pero no resuelve lo que se necesita; se descarta por ajuste.
- **WebcoreUI** — <https://astro.build/themes/details/webcoreui-astro-component-library/> (MIT, 50+ componentes Astro). Según esa ficha usa CSS propio, no Tailwind: incumple el requisito (2). No he abierto el repositorio para contrastarlo.

## Opciones consideradas
- **Starwind UI.** La más veterana (desde 2025-02) y con más comunidad (737 estrellas). Descartada como primera opción por dos motivos: el diseño en capas con `@starwind-ui/runtime` y adaptadores para React y Vue añade una dependencia y un modelo mental que no necesitamos, y **no he podido comprobar que el adaptador de Astro esté libre de React**; y no he visto estado vacío. No se descarta por incumplir requisitos, sino por más superficie y más dudas que las otras. Es la alternativa de reserva.
- **bejamas/ui.** Empresa detrás, 838 commits, componentes `.astro` reales. Descartada porque el comportamiento vive en primitivas que se actualizan por versión (más dependencia y menos «código nuestro» que una copia pura), y porque no he visto estado vacío ni paginación. Sigue siendo una buena alternativa si Bearnie decepciona.
- **Bearnie.** Cobertura completa de lo que pide PRD-001, `.astro` y JS plano copiados sin runtime ni paquete: encaja con ADR-0003 y con RNF-5. Es la recomendada, con las reservas de más abajo.
- **daisyUI.** Descartada por ajuste (ver arriba).
- **WebcoreUI.** Descartada por el requisito (2).
- **Componentes propios sin librería.** Descartada: hay que escribir y mantener a mano los patrones ARIA (selector, casillas, navegación), que es donde más se falla en RNF-3. Sí se sostiene como plan B, y es a lo que se degrada la decisión si abandonamos la librería, porque todas las candidatas copian el código al proyecto.

### Comparación
| Criterio | Starwind UI | bejamas/ui | Bearnie |
|---|---|---|---|
| Cobertura PRD-001 (tarjeta, badge, filtros, vacío, navegación) | Sin estado vacío visto | Sin estado vacío ni paginación vistos | Completa |
| Accesibilidad (RNF-3) | «a11y in mind», sin WCAG | WAI-ARIA, sin WCAG | «WCAG 2.1 AA», sin pruebas visibles |
| Mantenimiento | Desde 2025-02, push 2026-09-23 | Desde 2025-09, push 2026-09-25 | Desde 2026-01, push 2026-09-20 |
| Comunidad | 737 ★, 41 forks | 232 ★, 8 forks | 352 ★, 13 forks, 3 contribuidores |
| Licencia | MIT | MIT | MIT |
| JS / runtime | Runtime compartido | Primitivas `data-slot` | JS plano, sin runtime |
| Adoptar | CLI | CLI | CLI / copia |
| Personalizar | Código copiado | Código copiado + primitivas | Todo copiado |
| Abandonar | Fácil, con runtime a sustituir | Fácil, con primitivas a sustituir | La más fácil |

## Decisión
**Se adopta Bearnie como fuente de los componentes, copiando al repositorio solo los que se necesiten, sin instalarla como dependencia.**

Detalles:
- Se copian únicamente los que pide PRD-001: Card, Badge, Button, Checkbox, Select, Slider, Field/Label, Empty, Breadcrumb y Navigation Menu. El resto no entra hasta que un PRD lo pida.
- Los componentes copiados pasan a ser código nuestro: viven en el repositorio, se revisan en PR y se adaptan a RNF-4 (textos por props, sin cadenas fijas) y a RNF-5 (nada de `localStorage` ni cookies; si un componente los usa, se quita).
- La afirmación «WCAG 2.1 AA» de la librería **no se da por buena**: cada componente se verifica contra RNF-3 en las páginas reales antes de aceptarlo.
- El tema (colores, espaciado) se define con las variables CSS de Tailwind del proyecto.

## Consecuencias
**Buenas**
- Encaja con ADR-0003: HTML estático, JS solo donde el componente lo necesita, sin runtime de librería.
- Ningún paquete que mantener al día: abandonar la librería cuesta lo mismo que dejar de copiarla.
- Cubre el estado vacío (RF-6) que las otras dos no muestran.
- Los agentes editan código plano `.astro` con Tailwind, sin capa intermedia.

**Malas o a vigilar**
- **Riesgo de mantenimiento.** Es la más joven (2026-01) y tiene 3 contribuidores. Si se abandona, no llegan correcciones. Mitiga que el código ya es nuestro; pero los arreglos de accesibilidad futuros serán nuestros.
- **La accesibilidad no está demostrada.** Ninguna de las tres aporta auditoría; la de Bearnie es una promesa de la doc. Hay que medir con herramientas y revisión manual; el trabajo de RNF-3 es nuestro sea cual sea la librería.
- **Copiar es una bifurcación.** Sin actualizaciones automáticas, una mejora upstream hay que llevarla a mano.
- **Los filtros no vienen hechos.** Ninguna librería trae un panel de filtros que lea y escriba la query string (RF-5, ADR-0003): eso es código propio compuesto con Checkbox, Select y Slider, y necesita JS en cliente que pesa en RNF-2.
- **Las páginas pregeneradas (RF-10) y el estado vacío** deben funcionar con el HTML sin JS (CA-12c); los componentes elegidos han de degradar sin JS. Está por comprobar.
- **Tailwind 4, verificado el 2026-09-25** en <https://raw.githubusercontent.com/michael-andreuzza/bearnie/main/package.json>: Bearnie declara `tailwindcss ^4.3.3` con `@tailwindcss/vite` (4.3.3 es la última publicada, 2026-07-16) y `astro ^7.1.6`. Es configuración CSS-first: no hay `tailwind.config.js`. Arrastra además `@tailwindcss/forms`, `tailwind-merge`, `tailwind-scrollbar-hide` y `tailwindcss-scroll-mask`; cada componente que se copie dirá cuáles necesita de verdad, y no se instala ninguno «por si acaso».
- **No verificado:** compatibilidad del JS de cada componente con el CSP que se decida, y si el adaptador de Starwind depende de React (dato que solo afectaría a la alternativa de reserva).

**Sigue pendiente (fuera de esta ADR)**
- Tipografía, paleta y tokens del diseño visual.
- Iconografía.

**Resuelta (2026-09-25)**
- **Tema oscuro: no, de momento.** No está en ningún PRD y recordar la preferencia del visitante
  chocaría con RNF-5 (ni cookies ni `localStorage`). Se podrá proponer más adelante, y entonces
  habrá que decidir cómo se recuerda la elección, o si se sigue solo a `prefers-color-scheme`.
  Mientras tanto: de los componentes que se copien se quita lo que traigan de tema oscuro, y los
  tokens de color se definen para un único tema.

**Preguntas abiertas**
- ¿Qué herramienta y qué umbral de comprobación de accesibilidad se usan en CI? Es una decisión aparte.
