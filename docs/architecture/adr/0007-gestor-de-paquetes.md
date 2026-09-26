# ADR-0007 — Gestor de paquetes del repositorio

- **Estado:** propuesta
- **Fecha:** 2026-09-26

Todas las fuentes externas de esta ADR se abrieron el 2026-09-26. Lo que no aparece con URL es
lectura del propio repositorio o una impresión, y se marca como tal.

## Contexto

Hoy se usa npm: `package-lock.json` en la raíz (factoría) y en `web/` (ADR-0003), la CI ejecuta
`npm ci` con `cache: npm` en dos trabajos (`.github/workflows/ci.yml`) y `CLAUDE.md` dice
`npm install`. El responsable del producto usa pnpm en su máquina y pide una valoración.

Lo que decide es lo que cuesta cambiar aquí, no las virtudes generales de cada gestor:

- **Guardián de dependencias.** `.claude/hooks/guard_paths.ts` bloquea `npm i|install|add <paquete>`,
  `npx`, `npm create|init|exec`, para que toda dependencia nueva aparezca en el diff de una PR.
  Las reglas son de npm: con otro gestor, sus equivalentes no están cubiertos y hay un agujero.
  Además, `factory/tests/orchestrator.test.ts` (líneas 429-434) prueba esas reglas solo con npm.
- **Permisos del desarrollador.** `factory/budgets.yaml` (línea 71) da `Bash(npm:*)` al agente
  desarrollador. No cubre pnpm: el agente no podría instalar ni probar.
- **CI sin terceros.** `.claude/agents/devops.md` prohíbe acciones que no sean `actions/*`.
- **Dos proyectos.** Factoría en la raíz (`yaml`, `@types/node`, `typescript`) y web en `web/`
  (`astro`, `tailwindcss`, `@tailwindcss/vite`, `yaml`, `@types/node`, `typescript`), cada uno con su lock.
- `package.json` fija `engines.node >= 24`. En mi máquina, `node -v` da v26.5.0 (comprobado en esta ejecución).

## Opciones consideradas

### Datos comparados

**Cómo resuelven e instalan.**
- pnpm guarda los paquetes en un almacén direccionable por contenido; los ficheros se enlazan con
  hard links y en `node_modules` solo entran por symlink las dependencias directas del proyecto.
  Instalar en varios proyectos no duplica ficheros. Las tres fases (resolver, descargar, enlazar)
  van en paralelo. Fuente: <https://pnpm.io/motivation> (2026-09-26).
- La misma página dice que ese `node_modules` no plano impide acceder a dependencias no
  declaradas, que un árbol plano expone por accidente al elevarlas. npm, con árbol plano,
  no da esa garantía (es lo que contrasta pnpm en esa página; no lo he verificado en la
  documentación de npm).

**Velocidad.** Benchmark del propio proyecto pnpm (npm 12.0.2, pnpm 11.26.0, pnpm 12.5.1; cada cifra es la
mejor de las tres últimas ejecuciones, red emulada a 50 ms y 200 Mbps; no incluye Yarn ni Bun).
Fuente: <https://pnpm.io/benchmarks> (2026-09-26).

| Escenario | Proyecto | npm | pnpm 12 |
|---|---|---|---|
| Instalación limpia | alotta-files | 45,5 s | 4,39 s |
| Con lockfile (el caso de CI) | alotta-files | 11,6 s | 3,29 s |
| Con lockfile (el caso de CI) | alotta-packages (~1 GB) | 29,4 s | 9,08 s |

Reservas: lo publica el proyecto pnpm, y los proyectos de prueba son grandes; **ningún dato es de este
repositorio**. Con tres y seis dependencias directas (factoría y web), la ganancia real en la CI no está medida. Impresión, no hecho: será de segundos.

**Espacio en disco.** El ahorro de pnpm viene de compartir ficheros entre proyectos (misma fuente
que arriba). Aquí hay dos proyectos y la CI parte de un runner limpio: impresión, no medido, de que el ahorro es marginal.

**Workspaces.**
- npm: campo `workspaces` en el `package.json` raíz y un único `package-lock.json` en la raíz;
  scripts con `--workspace`. Fuente: <https://docs.npmjs.com/cli/v11/using-npm/workspaces>.
- pnpm: exige `pnpm-workspace.yaml` en la raíz y crea un único `pnpm-lock.yaml` en la raíz. Sin ese fichero,
  los proyectos son independientes (la página lo da a entender; no lo he probado). Fuente: <https://pnpm.io/workspaces>.

**Instalación del gestor.**
- npm viene con Node. La página de descargas de Node solo lo cita como el gestor por defecto
  (<https://nodejs.org/en/download>; LTS v24.21.0 y Current v26.10.0 en el momento de la consulta).
- pnpm hay que instalarlo aparte. Vías: `pnpm self-update`, script standalone, o npm; pnpm 12 declara
  compatibilidad con Node 18, 20, 22, 24 y 26. Fuente: <https://pnpm.io/installation>.
- Corepack (que fija pnpm desde `packageManager`) viene con Node 24 con estabilidad «1 - Experimental»
  y «will no longer be distributed starting with Node.js v25»; el propio aviso remite a instalarlo
  como módulo. Fuente: <https://nodejs.org/docs/latest-v24.x/api/corepack.html>. El README de
  Corepack confirma que va empaquetado hasta 24.x y que, si no, se instala con `npm install -g corepack`.
  Fuente: <https://github.com/nodejs/corepack>.

**GitHub Actions.**
- `actions/setup-node`: `cache` admite `npm`, `yarn`, `pnpm`, pero «Package manager should be pre-installed».
  Fuente: <https://github.com/actions/setup-node/blob/main/README.md>. Ni esa página ni `advanced-usage.md`
  mencionan Corepack: **`setup-node` no instala pnpm**.
  Fuente: <https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md>.
- Su ejemplo para pnpm usa `pnpm/action-setup` **antes** de `setup-node` (misma fuente). La guía de pnpm
  recomienda otra acción de terceros, `pnpm/setup`, en lugar de Corepack. Fuente: <https://pnpm.io/continuous-integration>.
  Ambas son de terceros y `devops.md` las prohíbe.
- Salida sin terceros: un paso `run:` con `corepack enable` sí es posible con Node 24 (Corepack va incluido, según las
  fuentes anteriores), pero se apoya en algo experimental que desaparece del Node distribuido desde la v25. Es un paso mío
  de inferencia: **no lo he probado en Actions**.

**Estrictez y cadena de suministro.** pnpm v10 desactiva por defecto los `postinstall` de las
dependencias (se autorizan con `allowBuilds`), y ofrece `minimumReleaseAge` (por defecto 1440 minutos) y
`trustPolicy`. Fuente: <https://pnpm.io/supply-chain-security>. Es una ventaja real. No he comprobado qué ofrece
npm en este punto, así que no lo comparo.

**Comandos que traen paquetes no declarados en pnpm.** `pnpm dlx` con alias `pnx` y `pnpx`, que ejecuta un
paquete del registro sin instalarlo como dependencia; además `pnpm add` y `pnpm create`.
Fuente: <https://pnpm.io/cli/dlx>. Esa página no detalla `pnpm exec`; no afirmo su comportamiento.

### Opción A — Seguir con npm (elegida)
Cero cambios; guardas, permisos y CI ya coinciden. Se pierde la velocidad y la estrictez de pnpm.

### Opción B — pnpm
Ventajas reales: velocidad, estrictez con dependencias fantasma y bloqueo de `postinstall`. Se descarta
**ahora** porque el coste es cierto y el beneficio, en dos proyectos pequeños, es una impresión: el
cambio debilita las guardas mientras no se reescriban a la vez (ver Consecuencias), y en CI obliga a elegir entre una acción de terceros
prohibida y Corepack experimental. No se descarta para siempre: se reabre si la instalación pasa a ser un cuello de botella medido
o si aparece un fallo por dependencia no declarada.

### Opción C — npm con workspaces
Un único lock y un solo `npm ci`, pero la web y la factoría dejarían de ser independientes. Cada proyecto ya se instala y se prueba por separado en la CI (dos trabajos);
unificar el lock cambia los pasos de CI y el árbol instalado sin resolver un problema que hoy exista
(no he encontrado ninguno en el repositorio). Descartada.

### Opción D — Yarn (PnP)
Yarn Plug'n'Play sustituye `node_modules` por un fichero loader y protege de dependencias fantasma; se puede
volver a `node_modules` con `nodeLinker: node-modules`. Fuente: <https://yarnpkg.com/features/pnp>. Tendría el mismo
coste de guardas y de CI que pnpm (gestor aparte, misma dependencia de Corepack) y además la fricción de PnP con
herramientas; no he verificado la compatibilidad con Astro/Tailwind. Descartada.

### Opción E — Bun
`bun install` escribe `bun.lock`, no ejecuta scripts de ciclo de vida salvo `trustedDependencies`, admite
workspaces y un modo `isolated` parecido a pnpm; forma parte de un runtime aparte. Fuente: <https://bun.sh/docs/cli/install>.
Introduciría un segundo runtime junto a Node >= 24, que es lo que ejecuta la factoría (`CLAUDE.md`). Descartada.

## Decisión

**Se mantiene npm como único gestor de paquetes, con un lock por proyecto (raíz y `web/`) y sin workspaces.**

Detalles:
- No se toca ni la CI, ni `guard_paths.ts`, ni `budgets.yaml`.
- pnpm es una preferencia local del responsable del producto. Si lo usa en su máquina, **no debe
  commitear `pnpm-lock.yaml`**: dos locks en el mismo proyecto acaban desalineados. Es una regla
  de proceso, hoy no hay nada que la haga cumplir (ver Consecuencias).
- Se reabre esta decisión con una de estas señales: tiempo de `npm ci` medido en la CI que moleste,
  un fallo real por una dependencia no declarada, o que Node distribuya un gestor alternativo.

## Consecuencias

**Buenas**
- Ninguna guarda se debilita: `guard_paths.ts`, sus pruebas, los `allowed_tools` y la regla de «solo `actions/*`»
  siguen valiendo tal cual.
- npm viene con Node: la CI y los agentes no dependen de Corepack ni de acciones de terceros.

**Malas (lo que se olvida)**
- Se renuncia a la velocidad de pnpm y a su bloqueo de `postinstall` por defecto. No es una pérdida medida aquí,
  pero es real según las fuentes.
- El responsable trabaja con un gestor distinto del del repositorio. Nada impide que un `pnpm install`
  genere un `pnpm-lock.yaml` suelto: `.gitignore` solo excluye `node_modules/` y el lock de la factoría, y hoy
  no hay ninguno versionado (comprobado con glob). Pregunta abierta: ¿añadirlo a `.gitignore` o fijar `packageManager`?
  No lo decido aquí.
- **El guardián ya tiene un hueco menor, distinto de esta ADR:** la expresión `\bnpx\b` es una búsqueda de texto en
  todo el comando, así que también bloquea, por ejemplo, un `grep npx`. Lo he sufrido en esta ejecución.
  Es un falso positivo (falla cerrado, no abre nada), y queda como observación.
- **Hueco heredado:** las reglas del guardián no cubren `pnpm`, `pnx`, `pnpx`, `yarn` ni `bun`. Hoy un agente sin
  `Bash(pnpm:*)` en `allowed_tools` no puede ejecutarlos, pero esa barrera es de permisos, no del hook (`docs/process/agents.md` dice
  que la barrera real es el hook). Añadir `pnpm add|i|install <pkg>`, `pnpm dlx|exec|create`, `pnx` y `pnpx` al
  guardián es barato y cierra el hueco aunque no se migre. Queda como pendiente, no como parte de esta decisión.

**Si algún día se migra a pnpm, hay que tocar todo esto en el mismo cambio** (a mano por una persona: `factory/`,
`.claude/` y `.github/` son rutas protegidas o de otro agente):
1. `.claude/hooks/guard_paths.ts`: reglas equivalentes a las de npm para `pnpm add`, `pnpm i|install <paquete>` (con la misma tolerancia a flags),
   `pnpm dlx`, `pnx`, `pnpx`, `pnpm exec` y `pnpm create`; y decidir si las de npm se conservan (recomendado: sí, para que
   `npm install <paquete>` no reintroduzca un `package-lock.json`).
2. `factory/tests/orchestrator.test.ts`: casos de bloqueo y de permiso para cada regla nueva (`pnpm install`, `pnpm install --frozen-lockfile`,
   `pnpm test` permitidos).
3. `factory/budgets.yaml`: `Bash(pnpm:*)` en `allowed_tools` del desarrollador; retirar `Bash(npm:*)` si se prohíbe npm.
4. `.github/workflows/ci.yml` (agente devops): instalación de pnpm (decisión abierta: `pnpm/action-setup`, que exigiría relajar la regla de `devops.md`,
   o `corepack enable` con Node 24, sin terceros pero experimental), `cache: pnpm`, `pnpm install --frozen-lockfile` y `cache-dependency-path` de `web/`.
5. `package.json` de la raíz y de `web/`: campo `packageManager` con versión fija; aprobar los `postinstall` que la web necesite (`allowBuilds`).
6. Locks: borrar los dos `package-lock.json` y generar `pnpm-lock.yaml` en cada proyecto (o un workspace, decisión aparte).
7. Textos: `CLAUDE.md`, `.claude/agents/developer.md`, `.claude/agents/devops.md`, `factory/queue.yaml` y los comentarios de
   `factory/tests/*.test.ts` que dicen `npm test` o `npm run typecheck`.
8. Si se usa Corepack: `engines.node >= 24` admite Node 25 o superior, donde no viene incluido; habría que instalarlo
   como módulo o acotar `engines`.

**Preguntas abiertas**
- ¿Qué peso tiene la comodidad del responsable frente a la homogeneidad del repo? La ADR recomienda seguir con npm; decide él.
- ¿Se cierra el hueco del guardián (pnpm/yarn/bun) ahora, aparte de esta ADR?
- ¿Conviene medir el `npm ci` de la CI antes de reabrir?
