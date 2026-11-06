# ADR-0024 — Diseño en código y revisión en imagen

- **Estado:** aceptada (2026-11-06). Enmienda ADR-0005: resuelve cómo se decide lo que dejó pendiente
  (tipografía, paleta e iconografía), no qué se decide.
- **Fecha:** 2026-11-06

## Contexto
Hay ocho especificaciones en `docs/design/`, con wireframes en ASCII, pero nadie ha decidido cómo se ve la
web. ADR-0005 dejó pendientes la tipografía, la paleta y la iconografía, y los tokens son una paleta funcional
con `system-ui`. Además, nadie mira el resultado: el Diseñador tenía prohibidas las imágenes y no podía lanzar un
navegador, y el Revisor solo lee el diff. Desde el 2026-11-06 la prioridad es UX/UI.

Requisitos que condicionan la elección:
- **Modelo de trabajo:** agentes con `claude -p`, de 01:00 a 07:00, sin nadie que apruebe un permiso ni abra una
  sesión (ADR-0002). El Diseñador va con `network: false`.
- **Visión, principio 4, y CLAUDE.md:** la documentación y el repositorio son el contrato.
- **ADR-0001:** nada se inventa; una maqueta no puede llevar datos que no existen.
- **ADR-0003 y ADR-0005:** Astro estático, Tailwind 4 y componentes propios, sin React.
- **Web personal y sin ánimo de lucro:** sin asientos de pago si se pueden evitar.

## Opciones consideradas
Datos consultados el 2026-11-06. Las afirmaciones sobre Pencil y Penpot salen en parte del proveedor o de terceros;
no se han comprobado porque no se adoptan.

| Opción | ¿Funciona de noche, sin persona? | Fuente de verdad en git | Coste |
|---|---|---|---|
| **Código + Playwright** | Sí, en local y sin red | Sí, y es lo que se publica | 0: dependencias ya instaladas |
| **Figma (MCP remoto)** | No: solo OAuth, sin tokens personales | No: vive en Figma | Asiento Dev o Full de pago; 200 llamadas al día; escribir pasará a pago por uso |
| **Penpot (MCP oficial)** | No: el plugin debe estar abierto en un navegador | Parcial: tokens W3C, el fichero vive en Penpot | Gratis; autoalojarlo suma un servicio |
| **Pencil (`.pen`)** | Sí, según su documentación (CLI con `PEN_CLI_KEY`) | Sí, JSON que no se publica y hay que traducir | Aplicación cerrada, formato que puede cambiar |
| **Claude Design** | No: sesión con la cuenta del usuario | No | Incluido, pero su sitio independiente cierra el 2026-12-14 |
| **Generar imágenes de pantallas** | Sí | Solo la imagen | Por imagen; inventa datos (ADR-0001) |

Fuentes: [planes del MCP de Figma](https://developers.figma.com/docs/figma-mcp-server/plans-access-and-permissions/),
[límites del MCP de Figma](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/),
[MCP de Penpot](https://penpot.app/ai/mcp-server), [CLI de Pencil](https://docs.pencil.dev/for-developers/pen-cli).

## Decisión
**El diseño se hace en código y se revisa en imagen. Ningún lienzo es fuente de verdad.**

1. **Prototipo.** El Diseñador escribe páginas `.astro` en `web/design-proto/`, con los componentes, los tokens y
   los datos reales. Puede sobrescribir tokens solo en esa página para proponer una dirección. Las reglas están en
   `web/design-proto/README.md`.
2. **Capturas.** `node web/scripts/design-shot.ts` las saca a 390 y 1280 px. El Diseñador lee los PNG y corrige lo que
   ve antes de abrir la PR.
3. **Decisión humana.** La PR de `docs/design/` muestra las imágenes y la acepta una persona: ADR-0011 ya la
   deja fuera de la fusión automática.
4. **Implementación.** El Desarrollador lleva el prototipo a `web/src/` y lo borra en la misma historia.
5. **Comparación.** La CI captura la página real y el Revisor la compara con la referencia.

**Dónde se guarda cada cosa:**

| Artefacto | Ruta | Vida |
|---|---|---|
| Dirección visual | `docs/design/direccion.md` | Permanente |
| Tokens | `docs/design/tokens.md` y `web/src/styles/global.css` | Permanente |
| Especificación de pantalla | `docs/design/<pantalla>.md` | Permanente |
| Prototipo | `web/design-proto/<pantalla>.astro` | La borra la historia que lo implementa |
| Referencia aprobada | `docs/design/refs/<pantalla>-{390,1280}.png` | Se sustituye con cada rediseño |
| Capturas de una PR | Artefacto de la CI | 30 días, no entran en git |

**Exploración a mano.** El responsable puede explorar en una sesión con Claude o con Pencil. Lo que salga entra al
repositorio solo como tokens y prototipo; no se sincroniza.

## Consecuencias
**Buenas**
- Lo que se aprueba está hecho con lo mismo que se publica: datos ausentes, nombres largos y contraste real.
- Sin servicios, cuentas ni dependencias nuevas.
- El Diseñador puede corregirse a sí mismo y la dirección visual se decide viendo imágenes.

**Malas o a vigilar**
- **El Diseñador escribe código,** aunque solo prototipos desechables y nunca en `web/src/`. Se acota con
  `write_paths`, y el hook `guard_paths.ts` lo hace cumplir.
- **Sin lienzo no se puede arrastrar nada:** se pide el cambio con palabras. Si resulta lento para decidir, Pencil
  es la alternativa con menos fricción.
- **Peso en git:** `.git` ocupa 56 MB. Solo entran referencias aprobadas, de unos 300 KB cada una.
- **Las clases de Tailwind de un prototipo llegan al CSS publicado** mientras el prototipo exista, porque Tailwind
  escanea `web/`. Son pocas y temporales, y `web/e2e/lcp.spec.ts` sigue midiendo. Las páginas y los estilos del
  prototipo no llegan: lo comprueba `web/tests/proto.test.ts`.
- **Las fuentes del sistema cambian entre máquinas:** una captura de Mac y una de Linux no son iguales hasta que haya
  fuentes propias. La comparación del Revisor es de criterio, no de píxeles.

**No se hace ahora**
- **Regresión por píxeles (`toHaveScreenshot`):** cuando se estabilice el rediseño; antes, cada cambio rompería las
  referencias. Usará los datos de prueba de `web/e2e/build-site.ts`, porque los datos reales cambian cada noche, y
  referencias generadas en la CI.
- **Storybook:** el prototipo sobre componentes reales cubre esa necesidad.
- **Vistas previas de Render por PR:** bastan las capturas. Si no bastan, se activan en su panel.
- **Eval de calidad visual:** cuando haya varias ejecuciones que comparar (ADR-0016).

## Preguntas abiertas
- Ninguna que bloquee. La prueba real con el Diseñador (coste frente a los 2 USD por ejecución) se anota en la bitácora.
