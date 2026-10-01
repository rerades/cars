# ADR-0009 — Base de datos y hosting del sitio estático

- **Estado:** aceptada (2026-09-28)
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
- **Condicionante del responsable del proyecto:** el hosting es Render, en el workspace Hobby que
  ya usa, y el dominio es `siete3.com` (ver «2. Hosting»).

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

**Condicionante del responsable del proyecto (2026-09-28).** La primera versión de esta ADR
recomendaba Cloudflare Pages. El responsable la rechaza por un dato que el arquitecto no tenía: ya
usa **Render** como proveedor, con un workspace en el **plan Hobby**, una máquina (el web service
`erades.com`, instancia Starter en Frankfurt) y un dominio, y quiere publicar la web ahí. El
dominio de la web será **`siete3.com`**, que ya tiene comprado. La pregunta deja de ser «qué
proveedor» y pasa a ser «cómo se publica en Render».

Datos consultados el **2026-09-28** en las URL indicadas y, para el estado de la cuenta, con el MCP
de Render. Lo que no pude comprobar figura como «no comprobado».

| | Static site de Render (elegida) | Reutilizar el web service existente | Cloudflare Pages (plan Free) |
|---|---|---|---|
| **Coste** | «Static sites are fast and free to deploy» ([11]) | 0 € extra, pero la instancia ya se paga y la comparte `erades.com` | 0 € ([1]) |
| **Límites** | Cuenta contra el ancho de banda y los minutos de build **del workspace** ([11]): en Hobby, 5 GB/mes de salida ([13]) y 500 minutos de build ([14]) | Los mismos, más CPU y memoria de una sola instancia | 500 builds/mes; 20.000 ficheros ([2]) |
| **Al pasar el límite** | Con método de pago, se cobra cada GB extra; sin él, Render «spins down your workspace's services» hasta el mes siguiente ([13]) | Igual | Estáticos ilimitados ([1]) |
| **CDN** | «global CDN» ([11]); Cloudflare es su proveedor anti-DDoS ([12]). Nodos en España: no comprobado | Ninguno: se sirve desde Frankfurt | 57 ciudades en Europa, Madrid y Barcelona ([3]) |
| **Dominio propio** | 2 incluidos en Hobby; 0,25 $/mes cada uno más ([12]). TLS automático y HTTP→HTTPS ([12]) | Igual | Hasta 100 por proyecto ([2]) |
| **Vistas previas por PR** | Sí; si el sitio base es gratis, sus previews también ([15]) | Se cobran como el servicio base ([15]) | Sí ([10]) |
| **Node y pnpm** | Node por defecto 24.21.0 para servicios creados desde el 2026-09-17; se fija con `NODE_VERSION`, `.node-version` o `engines` ([16]). Detección de pnpm: no comprobado | Ya construye con `pnpm install --frozen-lockfile` (MCP de Render) | No comprobado ([2]) |

**Por qué se descartan:**

- **Reutilizar el web service `erades.com`:** descartada. ADR-0003 pide un sitio estático sin
  servidor de aplicación; meterlo en un servicio Node obliga a escribir un servidor, sirve desde
  una sola región sin CDN (peor para RNF-2) y mezcla dos webs en un despliegue: un fallo de una
  tumba la otra.
- **Cloudflare Pages:** descartada por el condicionante. Técnicamente cumplía (y tiene mejores
  límites de ancho de banda y más nodos en España), pero añade un proveedor y una cuenta más
  cuando ya hay uno que cubre lo pedido. Queda como plan B si el ancho de banda de Render se queda
  corto (ver «Consecuencias»).
- **GitHub Pages y Netlify (Free):** descartadas en la primera versión de esta ADR y siguen
  descartadas. GitHub Pages excluye en sus términos el uso para un negocio en línea ([4]) y la
  monetización está abierta; en Netlify Free cada despliegue a producción cuesta 15 de 300
  créditos y, al agotarse, el sitio se pausa ([6], [7]).

## Decisión
**No hay base de datos aparte: los YAML de `data/raw/` (ADR-0008) son la base de datos, y el sitio
estático se publica como un *static site* de Render, en el workspace Hobby existente, con el
dominio `siete3.com`.**

Detalles:
- **Datos:** Astro lee los YAML en el build. Lo que el cliente necesita para filtrar y ordenar
  (RF-2, RF-3, RF-5) se genera en el build como un fichero estático más, no como una API. Se
  revisa esta parte si ocurre alguna de estas cosas: el build tarda demasiado (umbral por fijar al
  medir), hace falta una consulta por visita o aparece un escritor que no sea el Researcher por PR.
- **Hosting:** un servicio nuevo de tipo *static site* en el workspace de Render, enlazado al repo
  de GitHub, rama `main`, directorio raíz `web/` y directorio de publicación el `dist/` de Astro.
  No se toca ni se reutiliza el web service `erades.com`.
- **Dominio:** se añade `siete3.com` como dominio propio del static site. Render añade solo
  `www.siete3.com` y lo redirige a la raíz ([12]). Con `erades.com` son los 2 dominios incluidos
  en Hobby; si `www` cuenta aparte, el extra cuesta 0,25 $/mes ([12]). La migración se hizo el
  2026-10-01 (#98; ver «Migración hecha» en Consecuencias).
- **Node:** se fija la versión mayor con `NODE_VERSION` o `.node-version` ([16]), acotada a 24,
  para que no salte de versión sola (Render avisa de que un rango sin tope resuelve a la última).
- **Sin extras que toquen RNF-5:** no se añade analítica ni nada que inyecte scripts o cookies. El
  CDN de Render usa Cloudflare ([12]); si pone alguna cookie (`__cf_bm` u otra) está **no
  comprobado**, así que CA-7 se verifica contra la URL publicada, no solo en local.
- **Cómo llega el build a Render** (autodeploy de Render en cada push a `main` o despliegue
  disparado desde Actions), quién lo dispara y si hay merge automático son parte de la decisión
  pendiente «Cómo publican los agentes»; esta ADR no la toma.

## Consecuencias
**Buenas**
- Un solo proveedor, ya en uso y con cuenta creada: no hay alta nueva que hacer.
- El static site es gratis ([11]) y no consume la máquina de pago ni afecta a `erades.com`.
- Vistas previas por PR gratis ([15]): quien revisa una PR del Researcher o del desarrollador puede
  ver la web con esos datos antes del merge.
- TLS gestionado y redirección a HTTPS automáticos ([12]).
- Sin base de datos no hay credenciales, ni servicio que mantener, ni datos fuera de la revisión por
  PR. Todo lo publicado se puede reconstruir desde un commit.

**Malas o a vigilar**
- **Ancho de banda: 5 GB/mes para todo el workspace** ([13]), compartidos con `erades.com`. Es el
  límite más estrecho de esta decisión. Una página con imágenes (RF-8) puede pesar cientos de KB,
  así que unos miles de visitas al mes bastan para pasarlo. El workspace tiene método de pago, así
  que el exceso se **cobra por GB** y no se apaga nada ([13]). Hay que
  vigilar el uso en el panel de facturación desde el primer mes. Si el coste crece, las opciones
  son servir las imágenes desde otro sitio o mover el estático a Cloudflare Pages, que no cambia
  nada del resto de esta ADR.
- **Minutos de build: 500/mes para todo el workspace** ([14]), compartidos con `erades.com` y con
  las vistas previas. Cada ejecución del Researcher que llega a `main` es un build (ADR-0003). Con
  builds de pocos minutos hay margen, pero no se ha medido cuánto tarda el de Astro.
- **Dos dominios incluidos** ([12]): con `erades.com` y `siete3.com` se agotan. Un tercer dominio
  (o `www` si cuenta aparte) cuesta 0,25 $/mes.
- **Riesgo de cookies de terceros (RNF-5):** no he comprobado si el CDN de Render pone cookies.
  Hay que comprobar CA-7 contra producción al publicar y de forma periódica.
- **LCP no demostrado.** Render no publica dónde tiene nodos; no sé si sirve desde España. Pesan más
  el tamaño del fichero de datos del cliente y las imágenes (ADR-0003 ya lo advierte). Hay que
  medir en producción.
- **Integración con pnpm (ADR-0007) y con `web/` como raíz:** no he comprobado cómo detecta Render
  pnpm en un static site. El web service `erades.com` ya construye con pnpm, lo que indica que
  funciona; si no, se desactiva la instalación automática con `SKIP_INSTALL_DEPS` y se instala en
  el comando de build ([11]).
- **Los YAML no escalan sin límite como base de datos:** no hay consultas, índices ni integridad
  entre ficheros salvo lo que valide ADR-0008. Con cientos de modelos es suficiente; si se pasa a
  miles o a varios escritores, habrá que revisar esta ADR.

**Migración hecha (2026-10-01, #98)**
- Static site `siete3` (`srv-dav550s1nsns738m9sf0`) en el workspace de Render, rama `main`, sin
  directorio raíz: build `cd web && pnpm install --frozen-lockfile && pnpm build` y publicación
  `web/dist`. Sin directorio raíz, un cambio solo en `data/raw/` también despliega; con `web/`
  como raíz, Render solo despliega cuando cambia `web/`.
- pnpm: Render lo instala solo según `packageManager` (11.19.0) y ejecuta `pnpm install` en la
  raíz del repo antes del build. `corepack enable` en el comando de build falla (`EROFS` en
  `/usr/bin`): no se usa.
- `NODE_VERSION=24` da Node 24.21.0. El build tarda unos 16 s.
- DNS en Piensa Solutions (registrador Nicline): `A @ 216.24.57.1` y `CNAME www siete3.onrender.com`,
  los valores de la documentación de Render ([12]). Los `MX` y el SPF de Google Workspace no se tocan.
- La GitHub App de Render se instaló en la cuenta `rerades` con acceso a `cars`: autorizarla para
  iniciar sesión en Render no basta para el despliegue automático.
- CA-7 contra producción, en HTTP: `https://siete3.com/` y `/coches/` responden sin `Set-Cookie`
  (servidor `cloudflare`), y ni el HTML ni sus recursos usan `document.cookie`, `localStorage` ni
  `sessionStorage`. El test en navegador es la #41.
- Auto-deploy «After CI Checks Pass» (ADR-0011) y vistas previas manuales. `www.siete3.com` tiene su
  propio certificado y redirige con 301 a `https://siete3.com/`; `http://` redirige a `https://`.

**Preguntas abiertas**
- ¿`www.siete3.com` cuenta como un dominio aparte en el límite de Hobby? No comprobado.
- ¿Autodeploy de Render o despliegue desde Actions? Se decide en la ADR de publicación de los
  agentes.
- ¿Umbral de tiempo de build a partir del cual se reconsidera la base de datos? Por fijar al medir.

**Resueltas en esta revisión**
- Dominio: `siete3.com`, ya comprado por el responsable del proyecto.
- Proveedor: Render, por decisión del responsable (ver condicionante).
- Método de pago: el workspace lo tiene (confirmado por el responsable); pasar de 5 GB se cobra,
  no apaga los servicios.

**Fuentes (consultadas el 2026-09-28)**
- [1] https://developers.cloudflare.com/pages/functions/pricing/
- [2] https://developers.cloudflare.com/pages/platform/limits/
- [3] https://www.cloudflare.com/network/
- [4] https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- [6] https://www.netlify.com/pricing/
- [7] https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
- [10] https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- [11] https://render.com/docs/static-sites
- [12] https://render.com/docs/custom-domains
- [13] https://render.com/docs/outbound-bandwidth
- [14] https://render.com/docs/build-pipeline
- [15] https://render.com/docs/service-previews
- [16] https://render.com/docs/node-version
- Estado de la cuenta (workspace, servicio `erades.com`, plan y región): MCP de Render, 2026-09-28.
