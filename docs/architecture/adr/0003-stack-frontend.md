# ADR-0003 — Stack de frontend de la web

- **Estado:** propuesta
- **Fecha:** 2026-09-24

## Contexto
La decisión la ha tomado el responsable del producto; esta ADR la documenta con sus alternativas
descartadas y sus costes. Alcance: **solo el frontend**. Base de datos, hosting y CI/CD siguen
pendientes (ver Consecuencias).

Requisitos que obligan a decidir:
- **Datos que cambian por ejecución, no por visita.** Viven en YAML versionado en `data/` y solo
  cambian cuando corre el Researcher (ADR-0001). Nada del contenido depende de la petición.
- **Solo lectura y sin datos personales** (visión, principios 1 y 2; **RNF-5**, **CA-7**): ni cookies
  ni `localStorage`. No hay nada que un servidor de aplicación tenga que guardar o autenticar.
- **SEO prioritario** (**RNF-1**: renderizado en servidor o estático) y **LCP < 2,5 s en móvil 4G**
  (**RNF-2**): el HTML llega completo y con poco JavaScript.
- **Catálogo con filtros y orden en la URL** (**RF-2**, **RF-3**, **RF-5**, **CA-5**) y **una página por
  marca** en `/marcas/{marca}` (**RF-4**, **CA-4**). El PRD-001 pide además páginas indexables por
  combinación de filtros principal (sección 2).
- **Accesibilidad WCAG 2.1 AA** (**RNF-3**) y **textos preparados para i18n** (**RNF-4**).
- **Construida por agentes** (visión, principio 4): cuanto menos código propio de infraestructura,
  mejor.

## Opciones consideradas
- **Next.js:** descartada. Su valor diferencial es el renderizado bajo demanda, las rutas de API y
  los componentes de servidor, y aquí no hay nada que renderizar por petición (los datos cambian por
  ejecución del Researcher). Se pagaría un runtime de servidor o un modo de exportación estática
  con restricciones, y un modelo de React con más JavaScript en cliente por defecto, que va contra
  RNF-2. Además arrastra la pregunta de dónde se ejecuta el servidor, que es una decisión de hosting
  aún abierta.
- **SvelteKit:** descartada. Puede generar sitio estático y produce poco JavaScript, así que
  técnicamente valdría. Pero es un framework de aplicación pensado para rutas y estado
  dinámicos; el contenido aquí es sobre todo documento con datos, y para eso Astro es el ajuste
  más directo. Además obliga a un modelo de componentes que no aporta nada al caso. No hay motivo
  técnico fuerte contra ella: es un descarte por ajuste, no por incapacidad.
- **Generador propio de HTML:** descartada. Es viable con Node y plantillas, pero habría que escribir
  y mantener enrutado, plantillas, bundling de assets, optimización de imágenes, generación de rutas
  dinámicas (`/marcas/{marca}`) y el soporte de i18n. Es el mayor coste de mantenimiento para
  los agentes y no da nada que un generador existente no dé.

## Decisión
**El frontend será un sitio estático generado en el build con Astro, sin servidor de aplicación.**

Detalles:
- Astro lee los YAML de `data/` en tiempo de build y genera las páginas: `/coches`, una página por
  marca (`/marcas/{marca}`) y las que definan los PRD posteriores.
- Cada cambio de datos (una ejecución del Researcher que llega a `main`) implica un nuevo build.
- La interactividad se limita a lo estrictamente necesario, cargada en el cliente (por ejemplo, los
  filtros del catálogo), y sin escribir cookies ni `localStorage` (RNF-5).
- Las URL de filtros (RF-5) se apoyan en la URL del navegador: la lectura del estado sale de ella,
  no de almacenamiento.

## Consecuencias
**Buenas**
- El HTML sale completo y sin ejecución en servidor: encaja con RNF-1 y da buena base para RNF-2.
- Sin servidor de aplicación no hay superficie de datos de usuario: refuerza RNF-5.
- Los datos versionados en Git y el sitio construido a partir de ellos hacen que cada publicación
  sea reproducible y revisable en una PR.
- Astro envía por defecto poco JavaScript; solo se paga por lo que se marque como interactivo.

**Malas o a vigilar**
- **Filtros en la URL frente a estático (tensión real con RF-2, RF-5 y CA-5).** Un sitio estático no
  puede resolver en servidor una combinación arbitraria de filtros. Hay dos caminos y esta ADR no
  elige entre ellos: (a) filtrar en el cliente leyendo la query string, que da URLs compartibles pero
  el HTML inicial no está filtrado y esas URL no indexan por sí solas; (b) pregenerar páginas para
  las combinaciones «principales», que es lo que pide la sección 2 del PRD, con riesgo de explosión
  combinatoria. Hay que decidir cuáles son las combinaciones principales; queda como pregunta
  abierta.
- **El build crece con el catálogo.** Cada cambio de datos reconstruye el sitio. Con el volumen de
  modelos de partida debería ser aceptable, pero **hay que medirlo** cuando exista el catálogo, y no
  lo puedo verificar ahora.
- **Ordenar por precio en cliente** (RF-3, CA-9) exige que los datos necesarios lleguen al
  navegador, lo que pesa en RNF-2. Hay que comprobar el efecto sobre el LCP con mediciones reales.
- **Lo que un estático no puede hacer:** cualquier función futura que necesite datos por visita
  (precios en tiempo real, ya fuera de alcance en PRD-001) requeriría revisar esta ADR.
- **Dato a comprobar:** que Astro cubra bien el enrutado de i18n (RNF-4) y la optimización de
  imágenes (RF-8) tal y como se necesita. No lo he podido verificar sin red; debe confirmarlo el
  desarrollador al empezar.
- **Cambia la premisa de `overview.md`** («base de datos de contenido»): hoy la fuente de verdad son
  YAML en `data/`. Si hace falta una base de datos queda pendiente en su propia ADR.

**Sigue pendiente (fuera de esta ADR)**
- Base de datos y hosting.
- CI/CD y cómo publican los agentes (build, entornos, merge automático o no).
- Pipeline de ingesta de datos.
- Versión concreta de Astro y del resto de dependencias: la fija el desarrollador al instalarlas.

**Preguntas abiertas**
- ¿Qué combinaciones de filtros son «principales» y deben tener URL indexable propia (PRD-001,
  sección 2)?
- ¿Se filtra en cliente, se pregenera, o ambas cosas? Requiere aclarar el PRD.
