# ADR-0019 — Métricas del harness, puerta antes de la PR y trazabilidad de los CA

- **Estado:** aceptada (2026-10-21). La persona acepta que la puerta corra sin contenedor y pide que
  toda PR `fix` cite la PR que arregla (definition of done), para que la cifra de defectos escapados
  no se quede corta
- **Fecha:** 2026-10-21

## Contexto
PRD-007 (borrador) pide tres piezas sin modelo (RNF-1) y sin servicios externos, que tienen que estar
listas antes de las fases 2 y 3:

- **RF-1 / CA-1:** `node factory/run.ts --metrics` calcula las siete métricas de la sección 2, por
  agente y para el mes, a partir de `ops/runs/`, `ops/merges/` y `gh`. La cifra de PR fusionadas sin
  persona tiene que coincidir con las líneas de `ops/merges/`. La sección 2 define el defecto
  escapado como «revert o arreglo en los 7 días siguientes a una fusión», pero no dice cómo se
  reconoce un arreglo, y RF-9 lo usa para bajar peldaños: hace falta una regla mecánica.
- **RF-3 / CA-4 / CA-5:** antes de abrir la PR, el orquestador corre en el worktree lo que la CI
  correría con los ficheros del diff. Si algo falla, `eval_failed`, sin PR, y el ledger dice qué
  falló. **OPEN-6** pregunta si el build comparte el cerrojo de e2e (`web/node_modules/.e2e-build.lock`)
  o si cada worktree tiene su `node_modules`. RNF-2 y ADR-0002 limitan el tiempo: se lanza entre las
  01:00 y las 07:00, una ejecución a la vez (`max_concurrent_runs: 1`), con un máximo de 15 al día.
- **RF-4 / CA-6:** en una PR del developer, un eval comprueba que la descripción cita los RF y CA de
  su historia y que cada CA citado aparece en el nombre o en el comentario de al menos una prueba,
  como pide `docs/process/definition-of-done.md` («Cada `CA` citado en el issue tiene al menos un
  test automatizado»; «El PR […] enumera los `RF`/`CA` cubiertos»).

Lo que hay hoy en el código y condiciona la decisión (leído el 2026-10-21):

- `factory/orchestrator.ts`, `execute()`: tras la ejecución de `claude -p` llama a
  `runEvals(agent, ws.dir, changedFiles(ws.dir), write_paths, día)` (línea 630) y, si la ejecución fue
  `success` y hay fallos, pone `outcome: "eval_failed"` (línea 632). Después, en el `finally`, hace
  commit, borra el worktree y abre la PR solo si `outcome === "success"`. El cuerpo de la PR lleva
  `record.result`, que ya se ha recortado a los últimos 500 caracteres (línea 627).
- `factory/evals.ts`: `runEvals` corre `writePaths` para todos y `registry`, `rawData` y `rawShape`
  solo para el researcher. Para el developer no hay más (PRD-007, sección 1). `changedFiles` usa
  `git ls-files -mo`: ficheros modificados y nuevos sin commit; no ve borrados ni lo que el agente
  haya commiteado él mismo.
- `openWorkspace` crea el worktree con `git worktree add` desde `origin/main`. Un worktree recién
  creado **no tiene `node_modules`** ni en la raíz ni en `web/` (comprobado en el de esta ejecución).
- `web/e2e/build-site.ts` dice del cerrojo: «Inside web/node_modules: one lock per checkout, since
  each has its own .astro and .vite». Lo usan solo los specs de Playwright (`pnpm run test:a11y`).
- La CI (`.github/workflows/ci.yml`) tiene tres jobs que importan aquí: `test` (raíz: `pnpm test`,
  `pnpm run typecheck`, `node factory/validate-data.ts`), `web` (`web/`: `pnpm test`,
  `pnpm run typecheck`, `pnpm run build`) y `a11y` (Playwright, solo si cambian `web/` o `data/`; no
  bloquea, ADR-0006).
- `ops/merges/YYYY-MM.jsonl` tiene una línea por fusión automática (ADR-0011) con `pr`, `agent`,
  `run_id`, `sha`, `merge_sha`, `files`, `checks` y `at`. Las fusiones a mano no dejan línea.
- Las tareas de historia de `factory/queue.yaml` empiezan por «Historia #N (épica #M)»; los CA se
  numeran por PRD (hay un CA-3 en PRD-001, en PRD-002 y en PRD-003), y los specs los nombran en el
  título de la prueba (`test("CA-1: …")` en `web/e2e/comparar.spec.ts`) o en el comentario de cabecera
  («PRD-002 CA-3 in a real browser» en `web/e2e/versiones.spec.ts`).

## Opciones consideradas

### 1. De dónde salen las métricas (RF-1)
- **A. Solo del ledger local** (`ops/runs/`, `ops/merges/`). Descartada: no ve las fusiones a mano,
  ni las etiquetas `review:*`, ni la CI, ni las PR humanas que solo encolan. Sin eso faltan cuatro
  de las siete métricas.
- **B. Ledger más `gh`, calculadas al vuelo cada vez que se lanza.** Elegida. Es lo que dice RF-1 y
  no añade nada que mantener. En contra: una llamada a la API por PR para el historial de etiquetas y
  de CI (unas 100 al mes con el ritmo de octubre), y el resultado depende de que haya red.
- **C. Guardar una instantánea diaria de métricas en `ops/`.** Descartada por ahora: duplica datos que
  ya están en el ledger y en GitHub, y RF-1 solo pide poder lanzarlo a mano. Si RF-9 necesita leerlo
  cada noche y B resulta lento, se reabre.
- **D. Webhooks o un servicio de métricas.** Descartada por RNF-1 («No se añaden servicios externos»).

### 2. Qué es un defecto escapado (RF-1, sección 2)
- **A. Solo reverts.** Descartada: en este repositorio casi nada se revierte; se arregla con otra PR.
  Contaría cero y la métrica no serviría para RF-9.
- **B. Revert, o PR `fix` que cita la PR original, en los 7 días.** Elegida. Es mecánica y tiene un
  sesgo conocido: un arreglo que no cita la PR no cuenta.
- **C. Cualquier PR que toque los mismos ficheros en los 7 días.** Descartada: el refresco mensual de
  datos (ADR-0010) y las historias seguidas del developer tocan los mismos ficheros sin que haya
  defecto. Contaría de más y bajaría peldaños por nada.
- **D. Una etiqueta `bug` en una issue.** Descartada: no existe esa práctica en el repositorio y
  depende de que una persona la ponga, que es justo lo que se quiere quitar.

### 3. Qué comprueba la puerta (RF-3)
- **A. Siempre todo** (raíz, `web/` y datos). Descartada: el researcher hace hasta 10 ejecuciones por
  noche que solo tocan `data/` y `docs/bitacora/`; montar `node_modules` y construir la web en cada
  una gasta minutos de la ventana para nada.
- **B. Según las rutas del diff, parando en el primer fallo.** Elegida. Es lo que dice RF-3. En
  contra: si fallan dos cosas, el ledger solo nombra la primera.
- **C. Según las rutas, corriendo todas aunque falle una.** Descartada: alarga la puerta en el caso
  que menos lo merece (el cambio ya no va a abrir PR) y RF-3 solo pide saber cuál falló.
- **D. Incluir Playwright (`test:a11y`).** Descartada: en la CI no bloquea (ADR-0006), necesita un
  navegador en la máquina de la factoría y es lo más lento.

### 4. `node_modules` y el cerrojo de e2e (OPEN-6)
- **A. Enlazar el `node_modules` de la copia de trabajo de la persona en cada worktree.** Descartada:
  compartiría `.vite` y `.astro` con la copia de la persona (las colisiones que describe
  `build-site.ts`), y los paquetes serían los del lockfile de esa copia, no los de la rama.
- **B. Cada worktree instala su `node_modules` desde el almacén de pnpm.** Elegida. pnpm guarda cada
  paquete una vez en un almacén direccionado por contenido y lo enlaza con *hard links* en cada
  proyecto: «All the files are saved in a single place on the disk» y «share dependencies of the same
  version across projects» (https://pnpm.io/motivation, consultado el 2026-10-21). Con
  `--prefer-offline` pnpm no revalida lo que ya tiene en caché y solo pide a la red lo que falta; con
  `--frozen-lockfile` falla si el lockfile no casa con el `package.json`
  (https://pnpm.io/cli/install, consultado el 2026-10-21).
- **C. Un cerrojo común a todos los worktrees.** Descartada: con `max_concurrent_runs: 1` no hay dos
  builds de la factoría a la vez, y el cerrojo de `build-site.ts` ya es por checkout a propósito.

### 5. Qué cuenta como que una prueba nombra un CA (RF-4)
- **A. `CA-N` en cualquier fichero de pruebas del repositorio.** Descartada: los CA se numeran por PRD;
  el CA-3 de PRD-001 daría por cubierto el CA-3 de PRD-002.
- **B. Análisis sintáctico: `CA-N` en el primer argumento de `test()`/`it()`/`describe()` o en el
  comentario pegado a la prueba.** Descartada: hay que parsear TypeScript para algo que un humano lee
  de un vistazo, y los specs actuales nombran los CA también en el comentario de cabecera del fichero.
- **C. `CA-N` en un fichero de pruebas del diff, o en cualquier fichero de pruebas que nombre también
  el PRD de la historia.** Elegida. Sin parseo, cubre las dos costumbres actuales y no confunde PRD.

## Decisión
**`run.ts --metrics` calcula las métricas al vuelo con el ledger y `gh`; la puerta corre después de
los evals, según las rutas del diff y parando en el primer fallo, con `node_modules` propio en cada
worktree; y el eval de RF-4 compara los RF y CA de la historia con el texto final del agente y con
los ficheros de pruebas.**

### RF-1 — `node factory/run.ts --metrics [YYYY-MM] [--json]`
Mes por defecto: el actual (Europe/Madrid, como `allowed_hours`). Sale una tabla por agente y una
fila «total»; con `--json`, lo mismo en JSON. Las PR de agente se reconocen por la rama
`agent/<agente>/<run_id>`, que da también el agente. Una sola llamada `gh pr list --state all` trae
número, rama, `createdAt`, `mergedAt`, título, cuerpo y ficheros; el historial se pide por PR solo
para las fusionadas del mes.

| Métrica | Cálculo |
|---|---|
| PR humanas que solo encolan | PR fusionadas en el mes cuya rama no empieza por `agent/` ni es `chore/factory-state` y cuyos ficheros son solo `factory/queue.yaml` y, si acaso, `docs/bitacora/`. Solo en el total. |
| PR de agente fusionadas sin intervención humana | Numerador: PR de agente con `mergedAt` en el mes cuyo número está en `ops/merges/` del mes. Denominador: PR de agente con `mergedAt` en el mes. Así el numerador coincide con `ops/merges/` (CA-1). |
| Rendimiento a la primera | De las PR de agente fusionadas en el mes, las que nunca recibieron `review:changes` (eventos `labeled` del historial de la issue, no las etiquetas actuales, que el Revisor cambia) y ninguna de cuyas ejecuciones de la CI en su rama terminó en `failure`. |
| Tiempo hasta la fusión, p90 | `mergedAt − createdAt` de las PR de agente fusionadas en el mes; p50 y p90 por rango más cercano. Con menos de 5 PR, se muestra «n < 5» en vez del percentil. |
| Noches con la cola vacía | Ver «Registro de noches vacías», abajo. |
| Coste por PR fusionada | Suma de `cost_usd` de **todas** las filas del agente en el mes (también las fallidas) entre sus PR fusionadas del mes. En el total, todo el coste de la factoría (también reviewer y planner, que no abren PR) entre todas las PR de agente fusionadas. Se marca `estimated` mientras `cost_kind` lo sea (ADR-0002). |
| Defectos escapados | Ver abajo. Se atribuyen al agente y al mes de la PR **original**. |

**Defecto escapado.** Una PR de agente fusionada en el instante T tiene un defecto escapado si entre
T y T + 7 días se fusiona en `main`:
1. un revert: un commit cuyo mensaje contiene `This reverts commit <sha>` con el `merge_sha` o un
   commit de la PR (lo que escribe `git revert`), o una PR cuyo título empieza por `Revert "` y cita
   `#N` (lo que hace el botón de GitHub); o
2. un arreglo: una PR cuyo título empieza por `fix` (formato `tipo(ámbito): asunto` del repositorio) y
   cuyo título o cuerpo cita `#N` o la URL de la PR N.

Mientras no han pasado 7 días desde T, la PR cuenta como «pendiente», no como limpia; RF-9 debe usar
la misma regla.

**Registro de noches vacías.** Hoy no se puede calcular: `run.ts --next` no deja rastro cuando no
encuentra tarea. Se añade `ops/idle/YYYY-MM.jsonl`, una línea por noche como mucho, la primera vez
que `--next` corre dentro de `allowed_hours`, sin `factory/STOP`, con presupuesto y ejecuciones
libres, y no encuentra ninguna tarea pendiente: `{"night":"2026-10-21","at":"…","reason":"queue_empty"}`.
Se commitea en `chore/factory-state` como las filas de `ops/runs/` (ADR-0013). No va en `ops/runs/`
porque ahí cada fila es una ejecución y `--status` las cuenta contra `max_runs_per_day`. Para las
noches anteriores a este registro, la métrica dice «sin datos»; no se reconstruye.

### RF-3 — La puerta
**Dónde.** En `execute()`, justo después de `runEvals` y solo si la ejecución sigue en `success`
(los evals de ADR-0004 y el de RF-4 van antes porque cuestan milisegundos). Corre antes del
`finally`, con el worktree aún vivo.

**Ficheros que mira.** `git diff --name-only <ws.base>` más los no rastreados
(`git ls-files -o --exclude-standard`). Así entran también los borrados y lo que el agente commiteó
él mismo, que `changedFiles` no ve.

**Qué corre, en este orden, y su tiempo máximo:**

| # | Si el diff toca | Comprobación (nombre en el ledger) | Comando | Máximo |
|---|---|---|---|---|
| 1 | `data/` | `data:validate` | `node factory/validate-data.ts` (raíz) | 60 s |
| 2 | `web/` | `web:install` | `pnpm install --frozen-lockfile --prefer-offline` en `web/` | 120 s |
| 3 | `web/` | `web:typecheck` | `pnpm run typecheck` en `web/` | 120 s |
| 4 | `web/` | `web:test` | `pnpm test` en `web/` | 300 s |
| 5 | `web/` | `web:build` | `pnpm run build` en `web/` | 300 s |
| 6 | `factory/`, `onboarding/`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json` | `root:install`, `root:typecheck`, `root:test` | lo mismo en la raíz | 120 / 120 / 300 s |
| — | solo `docs/` | nada más que los evals | — | — |

El 6 no se da hoy: ningún agente tiene esas rutas en `write_paths`. Está para que la regla sea «lo que
la CI correría» y no una lista de agentes. El typecheck va antes que las pruebas, al revés que en la
CI, porque falla antes y es lo que CA-4 pide nombrar. Se para en la primera que falla. El tope de la
puerta entera es de 15 min; si se pasa, la comprobación en curso cuenta como fallida por `timeout`.
Los tiempos van en `factory/budgets.yaml`, en una sección `gate:`, para ajustarlos con lo que mida RF-1.

**Con qué entorno.** El de la persona menos las variables `FACTORY_*`, más `CI=1`. Los comandos no
pasan por los hooks de Claude: son procesos del orquestador.

**Qué guarda el ledger.** La fila de `ops/runs/` gana un campo `gate`:

```json
"gate": {
  "checks": [{"name": "web:install", "status": "passed", "ms": 8400},
             {"name": "web:typecheck", "status": "failed", "ms": 6100, "exit": 2}],
  "failed": "web:typecheck",
  "log": "…últimos 500 caracteres de stdout+stderr…"
}
```

`status` es `passed`, `failed` o `timeout`; las que no llegaron a correr no aparecen. Además, el fallo
se añade a `evals.failed` como `gate: web:typecheck failed (exit 2)`, para que lo vean `--status`,
`--trace` y Langfuse (ADR-0004) sin cambiar nada, y `outcome` pasa a `eval_failed`. La salida entera va
a `ops/traces/<run_id>.gate.log`, que no se versiona, como las trazas. La rama se queda en local, como
cualquier ejecución fallida.

**OPEN-6.** Cada worktree tiene su propio `node_modules`, instalado por la propia puerta desde el
almacén de pnpm de la máquina. El build de la puerta no toma el cerrojo de e2e: ese cerrojo es por
checkout (`web/node_modules/.e2e-build.lock`), protege a los workers de Playwright entre sí y la
puerta no corre Playwright. Como no hay dos ejecuciones a la vez, no hay dos builds compitiendo.

**¿Cabe en la ventana de ADR-0002?** Sí, con holgura, en el peor caso: 6 h de ventana; hoy unos 30 min
de ejecuciones (PRD-007, sección 1); el developer, como mucho 4 ejecuciones × 15 min de puerta =
60 min; el researcher, 10 × 1 min de `validate-data` = 10 min. Total en el peor caso ≈ 100 min de 360.
La puerta no gasta cuota de la suscripción, solo reloj. **No he medido** cuánto tarda cada comando: el
worktree de esta ejecución no tiene `node_modules` y no puedo consultar la duración de los jobs de la
CI. Los máximos de la tabla son topes, no estimaciones; la duración real sale en `gate.checks[].ms`.

### RF-4 — Trazabilidad de los CA
Es un eval más de `CHECKS.developer` en `factory/evals.ts`, y corre con los demás, antes de la puerta.
Para que `evals.ts` siga sin red y se pueda probar con ficheros, el orquestador le pasa en el contexto
el texto de la tarea, el texto final completo del agente (`payload.result`, **no** `record.result`,
que está recortado a 500 caracteres) y el cuerpo de la historia.

1. **Historia.** El número sale de la tarea con `/Historia #(\d+)/` (la forma de `queue.yaml`; el
   alimentador de RF-2 debe usar la misma). Si la tarea no nombra historia, el eval no aplica y pasa.
   El orquestador lee la historia con `gh issue view N --json body`. Si no puede leerla, el eval
   falla con `rf4: could not read story #N`: sin historia no se puede dar la PR por buena.
2. **RF, CA y PRD de la historia.** En el cuerpo: `/\bRF-\d+\b/g`, `/\bCA-\d+/g` y `/\bPRD-\d{3}\b/`
   (el primero). Los sufijos de apartado (`CA-12a`, `CA-12 d`) se reducen a `CA-12`.
3. **Descripción de la PR.** Es el texto final del agente, que el orquestador pone en el cuerpo de la
   PR. Cada RF y CA de la historia tiene que aparecer en él; si falta uno:
   `rf4: description does not cite CA-5 (story #37)`. Los que cita y la historia no tiene no fallan.
   El orquestador añade al cuerpo de la PR una línea `Covers: RF-…, CA-…` con lo que el agente citó,
   para que no se pierda si el texto es largo.
4. **Pruebas.** Un fichero de pruebas es `web/tests/**/*.test.ts` o `web/e2e/**/*.spec.ts` (los de
   `pnpm test` y `pnpm run test:a11y`). Una prueba **nombra** `CA-N` si `CA-N`, no seguido de otra
   cifra, aparece en el texto de un fichero de pruebas que (a) está en el diff de la PR o (b) nombra
   también el PRD de la historia. Vale cualquier sitio del fichero: título de `test()`, `describe()` o
   comentario. Por cada CA citado en la descripción que ninguna prueba nombra:
   `rf4: CA-3 is cited but no test names it` (CA-6).

## Consecuencias
**A favor**
- Todo es código que se prueba con ficheros de ejemplo en `factory/tests/`, sin modelo y sin
  servicios nuevos (RNF-1).
- Las métricas salen de lo que ya existe; la única fuente nueva es `ops/idle/`, de una línea por noche.
- CA-4 y CA-5 se cumplen con el mismo camino que ya usa `eval_failed`; `--status`, `--trace` y Langfuse
  ven el fallo de la puerta sin cambios.
- El developer recibe en la noche, y no en la CI del día siguiente, lo que hoy le devuelve la persona.

**En contra (lo que se olvida)**
- **La puerta ejecuta código que ha escrito el agente fuera de su sandbox.** `pnpm test` y el build
  corren las pruebas y la configuración del developer con el usuario de la persona y sin los hooks de
  `.claude/hooks/` (RNF-3 protege las escrituras del agente, no lo que hace un proceso hijo del
  orquestador). Hoy el developer ya puede lanzar `pnpm` por su Bash, pero dentro de Claude; con la
  puerta, ocurre siempre. Quitar las variables `FACTORY_*` no basta para aislarlo. Si se considera
  inaceptable, la alternativa es correr la puerta en un contenedor, y eso es otra ADR. **Aceptado
  sin contenedor (2026-10-21):** el developer ya lanza `pnpm` desde su Bash, y ese mismo código lo
  ejecutan la CI y la copia de la persona al fusionar; lo que añade la puerta es poco.
- **Una PR de datos que rompa el build no se ve en la puerta.** Para `data/` solo corre
  `validate-data`, como dice RF-3; el job `web` de la CI construye siempre. Si pasa, se añade
  `web:build` a la fila de `data/` y se paga en minutos del researcher.
- **`web:install` depende del almacén de pnpm.** Si un paquete no está, pnpm lo pide a la red; sin
  red, falla como `web:install` y la ejecución queda `eval_failed` aunque el agente no tenga la culpa.
  Se distingue mirando `gate.log`; no hay un `outcome` aparte.
- **Parar en el primer fallo esconde los siguientes.** El reintento de RF-5 puede encontrarse otro.
- **La métrica de defectos escapados cuenta de menos**: un arreglo que no cita la PR, o que no se
  titula `fix`, no cuenta. RF-9 sube peldaños con ella; un fallo sin citar no bajará ninguno.
  **Mitigado (2026-10-21):** la definition of done pide que una PR `fix` cite la PR que arregla.
- **El rendimiento a la primera depende del historial de GitHub**, una llamada por PR fusionada (unas
  100 al mes). Sin red, `--metrics` no sale; no hay caché.
- **«Noches con la cola vacía» no tiene datos de octubre**: CA-1 no puede dar cifra para esa métrica
  hasta que exista `ops/idle/`. Hay que aceptarlo así al revisar CA-1.
- **RF-4 confía en una convención de texto.** «Historia #N» en la tarea, `PRD-NNN` en la historia y
  `CA-N` en el fichero de pruebas. Una mención accidental de `CA-N` en un fichero cuenta. Un CA cubierto
  por una prueba antigua que no nombra el PRD obliga a tocar ese fichero para añadir la referencia.
- **Coste por PR fusionada es en USD-equivalentes** mientras dure la fase 1 de ADR-0002.
- **Cambios en `factory/`** que tiene que hacer una persona (`factory/` está fuera de los
  `write_paths` de todos los agentes): `run.ts --metrics`, el registro `ops/idle/`, la puerta en
  `execute()`, la sección `gate:` de `budgets.yaml`, el eval de RF-4 con su contexto ampliado y la
  línea `Covers:` del cuerpo de la PR.

**Preguntas abiertas** (no se deciden aquí)
- ~~¿Se acepta que la puerta ejecute el código del agente sin aislamiento, o se pide antes una ADR de
  contenedor?~~ Resuelta (2026-10-21): se acepta sin contenedor (ver «En contra»).
- ¿El texto final del agente es la «descripción de la PR» que pide RF-4, o tiene que haber una
  plantilla de cuerpo de PR propia del developer? Esta ADR asume lo primero porque hoy el orquestador
  construye el cuerpo con ese texto.
- ¿RF-9 usará estas mismas reglas de «limpia» y «defecto escapado» al pie de la letra? Lo decide la
  ADR de OPEN-1.
- ¿Qué tiempos reales tienen las comprobaciones? Los topes se revisan con los primeros
  `gate.checks[].ms`.
