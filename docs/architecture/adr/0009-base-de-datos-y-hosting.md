# ADR-0009 — Base de datos y hosting del sitio estático

- **Estado:** propuesta
- **Fecha:** 2026-09-28

## Contexto
Es la decisión pendiente «Base de datos y hosting» de `overview.md`. Parte de lo ya decidido:

- **ADR-0003:** sitio estático generado con Astro en el build, sin servidor de aplicación. Cada
  cambio de datos que llega a `main` implica un nuevo build.
- **ADR-0008:** los YAML de `data/raw/<marca>/<modelo>.yaml` siguen un esquema único
  (`data-model.md`), validado al escribir, con procedencia en cada valor (ADR-0001, regla 2).
- **RNF-5 y CA-7:** ninguna página crea cookies ni escribe en `localStorage`. Vale para lo que
  añada el hosting, no solo para el código propio.
- **RNF-2:** LCP < 2,5 s en móvil 4G. El público está en Europa con foco en España (visión), así que
  importa servir desde nodos cercanos.
- **RNF-1:** HTML estático para SEO, con URL estables (RF-4, RF-10) bajo un dominio propio.
- **RF-2, RF-3, RF-5:** los filtros y el orden que no tienen página pregenerada se resuelven en el
  navegador, así que los datos del catálogo viajan como fichero estático, no como consulta.
- **Visión, «Construida por agentes»:** cuanto menos infraestructura que operar, mejor. Y la visión
  tiene abierta la pregunta «¿Cómo se monetiza, si se monetiza?», que afecta a los términos de uso
  de algunos hostings.
- **ADR-0002:** hay presupuesto controlado para la factoría. Ningún documento fija un presupuesto
  para el hosting; se busca coste cero mientras no haya motivo para otra cosa.

Son dos preguntas: (1) ¿bastan los YAML como base de datos? y (2) ¿dónde se publica el `dist/`
que genera Astro?

## Opciones consideradas

### 1. Base de datos

- **YAML de `data/raw/` como única base de datos, leídos en el build (elegida).** Es lo que ya hay.
  Git da historial, revisión por PR y reproducibilidad (ADR-0003); ADR-0008 da esquema y
  validación. Nada del contenido se consulta por visita.
- **Base de datos gestionada (PostgreSQL, SQLite remoto o similar) consultada en el build:**
  descartada por ahora. No resuelve ningún requisito actual: no hay escrituras del visitante
  (visión, principio 1), no hay consultas por petición (ADR-0003) y el volumen es de decenas o
  cientos de modelos. Añadiría una credencial, un servicio que mantener, y sacaría los datos de la
  revisión por PR, que es donde hoy se comprueban fuente y fecha (ADR-0001, ADR-0004).
- **Base de datos consultada en tiempo de visita:** descartada. Exige servidor o funciones en el
  borde, contra ADR-0003, y la PRD-001 deja fuera los precios en tiempo real.
- **SQLite generado en el build a partir de los YAML:** descartada por ahora. Solo tendría sentido
  si el build o las consultas en cliente se vuelven lentos, y eso no se ha medido (ADR-0003 lo deja
  pendiente de medir).

### 2. Hosting

Datos consultados el **2026-09-28** en las URL indicadas. Lo que no pude abrir figura como «no
comprobado».

| | Cloudflare Pages (plan Free) | GitHub Pages | Netlify (plan Free) |
|---|---|---|---|
| **Coste** | 0 €. «On both free and paid plans, requests to static assets are free and unlimited» ([1]) | 0 € ([4]) | 0 €, con un límite duro de 300 créditos al mes ([6], [7]) |
| **Límites** | 500 builds/mes; hasta 20.000 ficheros por sitio; 25 MiB por fichero ([2]) | Sitio publicado ≤ 1 GB; ancho de banda *soft* de 100 GB/mes; 10 builds/hora *soft*, que no aplica si se publica con un workflow propio de Actions ([4]) | 20 créditos por GB servido, 15 por despliegue a producción, 2 por cada 10.000 peticiones; al agotarse, «all of your web projects … are paused» y no se pueden comprar más en Free ([7]) |
| **CDN en Europa** | 57 ciudades en Europa, Madrid y Barcelona entre ellas ([3]) | No comprobado: la documentación abierta no dice dónde se sirve | No comprobado |
| **Dominio propio** | Hasta 100 dominios propios por proyecto ([2]) | Sí ([5]); el detalle del HTTPS con dominio propio no lo pude abrir (la URL daba 404) | «Add Custom domains with SSL» ([6]) |
| **Cookies y analítica por defecto** | Las páginas estáticas no llevan analítica si no se activa. `__cf_bm` se pone solo si se activa Bot Fight Mode o Bot Management, y se puede desactivar por API ([8]). Si Web Analytics usa cookies: no comprobado ([9] no lo dice) | No comprobado; no he encontrado mención a cookies en las páginas abiertas | No comprobado |
| **Despliegue desde GitHub** | Integración con Git: despliega en cada push y crea una URL de vista previa por PR, salvo PR desde forks ([10]) | Workflow de Actions con `actions/upload-pages-artifact` y `actions/deploy-pages`, en push a la rama por defecto o manual ([5]) | No comprobado en esta ejecución (la página de precios habla de «unlimited deploy previews», [6]) |
| **Otras restricciones** | — | «not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site…» ([4]). Con repo privado, depende del plan ([5]); la visibilidad del repo no la he podido comprobar | La cuenta Free está orientada a «Individual» ([6]) |

**Por qué se descartan:**

- **GitHub Pages:** descartada. Es la más simple (ya vivimos en GitHub y se publica con Actions),
  pero (a) sus términos excluyen usarlo para un negocio en línea, y la monetización está abierta en la
  visión: si se decide monetizar, habría que mudarse; (b) el ancho de banda es un límite *soft* de
  100 GB/mes sin precio por encima; (c) no he podido comprobar la presencia de su CDN en Europa, que
  pesa en RNF-2; (d) si el repositorio es privado, depende del plan de GitHub.
- **Netlify (Free):** descartada. El modelo de créditos castiga justo nuestro patrón de uso: cada
  despliegue a producción cuesta 15 de 300 créditos, así que unas 20 publicaciones al mes agotan el
  plan sin servir un solo byte ([6], [7]). Cada ejecución del Researcher que llega a `main` es un
  build (ADR-0003). Al agotarse, **el sitio entero se pausa** y en Free no se pueden comprar más
  créditos. Pasar a un plan de pago es posible, pero no hay motivo para pagar por lo que las otras
  dan gratis.
- **Vercel u otros:** no evaluados en esta ADR. Con tres opciones comparadas y una que cumple todo lo
  pedido, no he gastado más consulta; si la revisión lo pide, se añade.

## Decisión
**No hay base de datos aparte: los YAML de `data/raw/` (ADR-0008) son la base de datos, y el sitio
estático se publica en Cloudflare Pages (plan Free), con dominio propio.**

Detalles:
- **Datos:** Astro lee los YAML en el build. Lo que el cliente necesita para filtrar y ordenar
  (RF-2, RF-3, RF-5) se genera en el build como un fichero estático más, no como una API. Se
  revisa esta parte si ocurre alguna de estas cosas: el build tarda demasiado (umbral por fijar al
  medir), hace falta una consulta por visita o aparece un escritor que no sea el Researcher por PR.
- **Hosting:** un proyecto de Cloudflare Pages cuyo directorio raíz es `web/` y cuya salida es el
  `dist/` de Astro. Producción = `main`.
- **Sin extras que toquen RNF-5:** no se activan Cloudflare Web Analytics, Bot Fight Mode ni ningún
  producto que inyecte scripts o cookies. Si el dominio se gestiona en Cloudflare, se comprueba que
  `__cf_bm` está desactivado ([8]). CA-7 se verifica contra la URL publicada, no solo en local.
- **Cómo llega el build a Pages** (integración con Git de Cloudflare o workflow de Actions que sube
  el `dist/`), quién dispara el despliegue y si hay merge automático son parte de la decisión
  pendiente «Cómo publican los agentes»; esta ADR no la toma.

## Consecuencias
**Buenas**
- Coste cero y sin límite de peticiones a estáticos ([1]); el límite de 500 builds al mes ([2]) deja
  margen amplio para las ejecuciones del Researcher.
- Nodos en Madrid y Barcelona ([3]): buena base para RNF-2, aunque no lo demuestra.
- Vistas previas por PR ([10]): quien revisa una PR del Researcher o del desarrollador puede ver la
  web con esos datos antes del merge.
- Sin base de datos no hay credenciales, ni servicio que mantener, ni datos fuera de la revisión por
  PR. Todo lo publicado se puede reconstruir desde un commit.
- Los términos consultados de Cloudflare Pages no excluyen el uso comercial; no he encontrado
  cláusula en contra, pero no he leído sus condiciones generales.

**Malas o a vigilar**
- **Dependencia de un proveedor externo** fuera de GitHub: una cuenta más, con su acceso, que un
  humano tiene que crear. Los agentes no pueden hacerlo.
- **Riesgo de cookies de terceros (RNF-5):** Cloudflare tiene productos que ponen cookies
  (`__cf_bm`, `cf_clearance`, [8]). Activar uno por descuido en el panel rompe CA-7 sin tocar el
  repositorio. La única defensa es comprobar CA-7 contra producción de forma periódica.
- **Límite de 20.000 ficheros** ([2]). Con imágenes optimizadas en varios tamaños (RF-8) y una página
  por marca, segmento y tramo, hoy no se acerca; hay que vigilarlo cuando crezca el catálogo.
- **LCP no demostrado.** Un CDN cercano no garantiza RNF-2: pesan más el tamaño del fichero de datos
  del cliente y las imágenes (ADR-0003 ya lo advierte). Hay que medir en producción.
- **Datos no comprobados** en esta ADR: CDN europeo de GitHub Pages y de Netlify, si Cloudflare Web
  Analytics usa cookies, y el despliegue desde GitHub en Netlify. El descarte no depende de ellos.
- **Integración con pnpm (ADR-0007) y con `web/` como raíz:** no he comprobado cómo detecta
  Cloudflare Pages la versión de pnpm y de Node (el repo pide Node ≥ 24). Lo comprueba el
  desarrollador al configurar el proyecto; si no encaja, el workflow de Actions lo resuelve.
- **Los YAML no escalan sin límite como base de datos:** no hay consultas, índices ni integridad
  entre ficheros salvo lo que valide ADR-0008. Con cientos de modelos es suficiente; si se pasa a
  miles o a varios escritores, habrá que revisar esta ADR.

**Preguntas abiertas**
- ¿Qué dominio y quién lo registra? No está en ningún documento del producto.
- ¿El repositorio es público o privado? No lo he podido comprobar; no cambia la decisión, pero sí la
  alternativa de GitHub Pages.
- ¿Integración con Git de Cloudflare o workflow de Actions? Se decide en la ADR de publicación de
  los agentes.
- ¿Umbral de tiempo de build a partir del cual se reconsidera la base de datos? Por fijar al medir.

**Fuentes (consultadas el 2026-09-28)**
- [1] https://developers.cloudflare.com/pages/functions/pricing/
- [2] https://developers.cloudflare.com/pages/platform/limits/
- [3] https://www.cloudflare.com/network/
- [4] https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- [5] https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- [6] https://www.netlify.com/pricing/
- [7] https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
- [8] https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/
- [9] https://developers.cloudflare.com/web-analytics/about/
- [10] https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
