# ADR-0011 — Cómo publican los agentes: fusión automática por reglas, sin modelo

- **Estado:** aceptada (2026-10-01)
- **Fecha:** 2026-09-30

## Contexto
Es la última decisión pendiente de `overview.md`: «Cómo publican los agentes (CI/CD, entornos,
merge automático o no)». Lo que hay hoy y lo que obliga a decidir:

- **Flujo actual.** Cada ejecución que termina con `outcome: success` abre su PR
  (`auto_pr: true` en `factory/budgets.yaml`; `factory/orchestrator.ts`, líneas 481-498), con el
  aviso «Nobody has reviewed this yet». El Revisor se lanza a las 06:30
  (`factory/launchd/com.darkfactory.reviewer.plist.example`), revisa las PR `agent/*` abiertas y
  deja un comentario que empieza por «Veredicto». Después una persona fusiona.
- **Petición del responsable del proyecto:** las PR que salgan bien entran sin persona; las demás
  le avisan.
- **ADR-0002, capa 2:** «Todo cambio entra por PR. Ningún agente hace merge sin CI en verde»;
  push a `main` y modificar `factory/` o `.claude/` están denegados a los agentes.
- **ADR-0001:** los datos del Researcher salen de webs de terceros. Ese texto llega al diff que
  lee el Revisor, así que el Revisor está expuesto a instrucciones inyectadas: su veredicto no
  puede ser la única llave de `main`.
- **ADR-0008:** esquema único de `data/raw/`. La comprobación automática del esquema **aún no
  existe** (`overview.md`, decisión pendiente de ingesta, futura ADR-0010).
- **ADR-0006:** la CI de accesibilidad puede quedar en rojo «sin impedir el merge».
- **ADR-0009:** static site de Render sobre `main`, dominio `siete3.com`, vistas previas por PR
  gratis. Deja para esta ADR «autodeploy de Render o despliegue desde Actions» y «si hay merge
  automático». La migración a Render (#98) sigue pendiente.
- **CLAUDE.md:** «La documentación es el contrato. Un cambio de alcance se hace primero en el PRD».
- **Guarda existente:** el Revisor tiene `Bash(gh pr:*)` en `budgets.yaml`, pero el hook
  `.claude/hooks/guard_paths.ts` (línea 36) bloquea `gh pr merge|review|close|ready` a cualquier
  agente («aprobar, cerrar o fusionar una PR no es de un agente»). `gh pr edit --add-label` no
  está bloqueado. Los hooks solo actúan con `FACTORY_AGENT`, así que el orquestador, que no es un
  agente, puede fusionar.

## Opciones consideradas

**1. Quién fusiona**
- **El Revisor fusiona cuando le parece bien:** descartada. Es un modelo que lee texto de terceros
  (ADR-0001); una instrucción inyectada en un YAML podría llevarle a fusionar. Además contradice
  su propio rol («No decides si entra»).
- **Auto-merge nativo de GitHub (`gh pr merge --auto`) activado al abrir la PR:** descartada.
  Fusiona en cuanto se cumplan las reglas de protección de la rama ([1]), sin mirar el veredicto ni
  las rutas tocadas; esas reglas tendrían que vivir en la configuración de GitHub y no en el repo.
  No he comprobado si el plan del repositorio permite protección de ramas con checks obligatorios.
- **Una persona fusiona siempre (lo de hoy):** descartada como regla general porque es justo lo que
  el responsable quiere quitar. Se mantiene para todo lo que no pase las reglas de abajo.
- **El orquestador, código sin modelo, fusiona si se cumplen condiciones deterministas (elegida,
  la propuesta de partida con correcciones).**

**2. Lista de rutas permitidas.** La propuesta de partida ponía `docs/` y `data/raw/`. **La
corrijo a `data/raw/` y `docs/bitacora/`.** `docs/product/` (PRD) y `docs/architecture/` (ADR) son el
contrato del repositorio: fusionarlos sin persona permitiría a un agente cambiar el alcance o
«aceptar» una decisión. `docs/design/` especifica lo que construye el desarrollador y tiene el mismo
problema. `factory/`, `.claude/`, `.github/` y `web/` quedan fuera, como en la propuesta.

**3. Cómo se avisa de las `review:needs-human`**
- **Notificaciones de GitHub (asignar la PR al responsable):** no basta sola. Si la factoría usa la
  misma cuenta de GitHub que el responsable, es posible que GitHub no notifique de acciones propias;
  la página de notificaciones no lo aclara ([2]). **No comprobado.**
- **Correo, Slack o Telegram desde el orquestador:** descartada por ahora. Otro servicio y otro
  secreto que gestionar (visión, «cuanto menos infraestructura, mejor»).
- **Aviso local en el Mac que ejecuta la factoría (ADR-0002) más `run.ts --status` y la etiqueta
  como fuente de verdad (elegida).**

**4. Cómo llega a producción**
- **Render «On Commit»:** descartada. Despliega en cuanto hay push a `main` ([3]), aunque la CI de
  `main` falle después.
- **Despliegue desde Actions con un Deploy Hook ([3]):** descartada. Añade un secreto (la URL del
  hook) en GitHub y un workflow que mantener, para lo que Render ya hace solo.
- **Render «After CI Checks Pass» sobre `main` (elegida).** Render espera a que los checks del
  commit terminen y no despliega si alguno falla o si no hay ninguno ([3]).

**5. Vistas previas por PR**
- **Automáticas para todas las PR:** descartada. Render crearía una por cada PR ([4]), también las
  de docs que no cambian la web, y la mayoría se fusionarían sin que nadie las mirase. Si consumen
  minutos de build del workspace (500/mes compartidos, ADR-0009) no lo he comprobado en esta
  ejecución.
- **Manuales, con la etiqueta `render-preview` ([4]) (elegida).**

## Decisión
**El Revisor solo etiqueta; fusiona el orquestador, sin modelo, y solo las PR con `review:ok` ligada
al commit revisado, CI en verde, sin conflictos y con todo el diff dentro de `data/raw/` y
`docs/bitacora/`; todo lo demás lo fusiona una persona.**

Detalles:

1. **El Revisor.** Además de su comentario, pone una sola etiqueta de estado: `review:ok`,
   `review:changes` (hay que arreglar algo en la PR), `review:needs-human` (decide una persona) o
   `review:error` (no pudo terminar la revisión); al volver a revisar, cambia la anterior por la
   nueva. Solo `review:ok` habilita la fusión automática. Su comentario empieza por
   `🏭 Veredicto:`, la marca de todos los comentarios de la factoría (2026-10-01). El comentario de veredicto incluye el SHA del commit que ha revisado
   (`headRefOid` de `gh pr view`). Nunca fusiona, aprueba ni cierra; el hook `guard_paths.ts` ya
   lo impide y se mantiene. Su prompt (`.claude/agents/reviewer.md`) tendrá que cambiar «No decides
   si entra» por esta regla de etiquetas.

2. **La fusión.** Un paso nuevo del orquestador (por ejemplo `node factory/run.ts --merge`),
   código sin modelo, idempotente y lanzable a mano. Fusiona una PR solo si se cumplen **todas**:
   - la rama es `agent/<agente>/<run_id>` y la abrió la factoría;
   - tiene `review:ok` y no tiene `review:needs-human`;
   - el último comentario de veredicto del Revisor cita el SHA que hoy es la cabeza de la PR. Si
     alguien empujó después de la revisión, la etiqueta no vale;
   - **todos** los checks de la PR terminaron y en verde (`gh pr checks`); ninguno pendiente, y
     cero checks cuenta como rojo. El check de accesibilidad (ADR-0006) también cuenta: sin
     persona, el rojo no se puede aceptar a sabiendas;
   - GitHub la da por fusionable, sin conflictos con `main`;
   - cada fichero del diff (en un renombrado, las dos rutas) empieza por `data/raw/` o
     `docs/bitacora/`, y ninguno se borra. Un borrado en `data/raw/` lo decide una persona;
   - no existe `factory/STOP`.

   Fusiona con `gh pr merge --merge --match-head-commit <sha> --delete-branch` ([1]): commit de
   merge (no squash), para conservar los commits con su `run_id` (ADR-0002) y para que volver atrás
   sea un solo `git revert`. `--match-head-commit` hace que GitHub rechace la fusión si la cabeza
   cambió entre la comprobación y la fusión ([1]).

   Se lanza con su propio LaunchAgent **después** del Revisor (por ejemplo a las 07:30). No usa el
   modelo, así que el horario de ADR-0002 no le afecta, pero si hay una ejecución en curso
   (el lock del orquestador) espera a la siguiente pasada.

3. **Cómo queda registrada cada fusión automática.**
   - El mensaje del commit de merge lleva `Auto-merged-by: factory` y el `run_id`.
   - El orquestador comenta en la PR qué condiciones comprobó, con el SHA y el estado de cada check.
   - Una línea por fusión en `ops/merges/YYYY-MM.jsonl`, junto al ledger de ADR-0002: PR, agente,
     `run_id`, SHA revisado, SHA del merge, ficheros, checks y hora.
   - La bitácora la recoge sola con `bitacora.ts from-git`; no se escribe a mano.

4. **Cómo se avisa de lo demás.** En la misma pasada, para cada PR `agent/*` abierta con
   `review:needs-human`, **o** con `review:ok` que no cumple alguna regla, **o** sin veredicto
   después de una noche:
   - pone `review:needs-human` si no la tenía y comenta **qué regla** falló (así una `review:ok`
     con rutas fuera de la lista no se queda muda);
   - asigna la PR al responsable;
   - si toca `web/` o `data/raw/`, añade `render-preview` para que la vista previa esté lista;
   - muestra una notificación local en el Mac de la factoría con el número de PR pendientes;
   - `run.ts --status` lista las PR que esperan a una persona. La fuente de verdad es el filtro
     `is:open label:review:needs-human`.

5. **Cómo se vuelve atrás.** Una persona hace `git revert -m 1 <sha-del-merge>` en una rama y abre
   PR; esa PR no es `agent/*`, así que nunca se fusiona sola. La línea de `ops/merges/` da el SHA.
   Si el sitio publicado está roto y no se puede esperar a la CI, el rollback del panel de Render
   vuelve al build anterior ([5]).

6. **Después de fusionar.** El static site de Render (ADR-0009) usa auto-deploy «After CI Checks
   Pass» sobre `main` ([3]): el build se publica cuando la CI del commit de merge termina en verde.
   Las vistas previas por PR están en modo manual con la etiqueta `render-preview` ([4]); Render las
   borra al fusionar o cerrar la PR ([4]).

7. **Cómo se activa.** Un interruptor `auto_merge` en `factory/budgets.yaml`, que empieza en
   `false`. Con `false`, el paso de fusión solo etiqueta y avisa (sirve para ver qué habría
   fusionado). Pasa a `true` solo cuando: (a) el Revisor pone las etiquetas y cita el SHA;
   (b) la CI valida el esquema de `data/raw/` (ADR-0008, futura ADR-0010); y (c) el sitio está en
   Render (#98). Cambiar el interruptor es una PR en `factory/`, así que la
   hace una persona.

## Consecuencias
**Buenas**
- Las PR del Researcher que salen bien llegan a `main` y a producción sin que nadie las toque.
- El único que decide la fusión es código determinista y legible; el modelo solo aporta una señal.
  Una instrucción inyectada que engañe al Revisor todavía tiene que pasar la CI, la lista de rutas
  y el SHA.
- Cada fusión automática deja rastro en tres sitios (commit, comentario, `ops/merges/`) y se
  deshace con un comando.
- Producción solo cambia con la CI de `main` en verde.
- Vistas previas solo donde una persona va a mirar.

**Malas o a vigilar**
- **En la práctica solo se fusionan solas las PR del Researcher** (y las que solo tocan la
  bitácora). Las del desarrollador, el diseñador, el arquitecto y producto siguen esperando a una
  persona. Es a propósito, pero no es «las que salgan bien entran sin persona» en sentido amplio.
- **La etiqueta no prueba quién la puso.** Todos los `gh` de la factoría usan, que yo sepa, la misma
  cuenta de GitHub; una persona o un agente con `gh pr` podría poner `review:ok`. Hoy solo el
  Revisor tiene `gh pr`, y el SHA en el comentario reduce el riesgo, pero no lo elimina.
- **El Revisor sigue expuesto a inyección**, y la CI solo detecta lo que comprueba. Un dato falso
  pero con formato válido y fuente con URL (ADR-0001) puede pasar todas las reglas y publicarse
  hasta que alguien lo vea. Esta ADR no lo resuelve: lo limita a `data/raw/` y lo hace reversible.
- **Mientras falte (a), (b) o (c) del punto 7, no hay fusión automática.** Sin la validación del
  esquema, la CI no dice nada sobre los YAML, y la condición «CI en verde» no vale nada para
  `data/raw/`.
- **Cada fusión es un build en Render**: de producción y, si hay `render-preview`, de vista previa.
  Cuentan contra los 500 minutos y los 5 GB del workspace, compartidos con `erades.com` (ADR-0009).
- **Una PR de datos que falle por accesibilidad** (ADR-0006) ya no entra sola, aunque el fallo no
  venga de ella: si `main` tiene un rojo heredado, bloquea todas las fusiones automáticas.
- **Revertir un merge y volver a fusionar la misma rama** exige revertir el revert; la próxima
  ejecución del agente abre rama nueva, así que lo normal es no reutilizarla.
- **El rollback desde el panel de Render desactiva el auto-deploy** del servicio ([5]); hay que
  volver a activarlo a mano o nada nuevo se publicará. No he comprobado que el rollback esté
  disponible para static sites: la página no lo dice ([5]).
- Más código en el orquestador (`--merge`) y un LaunchAgent más que mantener.

**Preguntas abiertas**
- ¿La factoría usa la misma cuenta de GitHub que el responsable? Si es así, ¿le llegan las
  notificaciones de las PR asignadas por esa cuenta? Sin comprobar ([2]).
- ¿El plan del repositorio permite protección de rama con checks obligatorios en `main`? Sería una
  segunda barrera en GitHub; no comprobado.
- ¿Las vistas previas consumen minutos de build del workspace? No comprobado en esta ejecución.
- ¿Las PR del Researcher llevan ficheros fuera de `data/raw/` y `docs/bitacora/` (por ejemplo, de
  `ops/` o de otras carpetas de `data/`)? Si es así, ninguna entraría sola; hay que mirarlo en las
  PR reales antes de activar el interruptor.
- ¿Cuánto tiempo sin veredicto antes de avisar? Esta ADR pone una noche; ajustar con el uso.
- ¿Entra `docs/design/` o alguna otra ruta en la lista más adelante? Sería otra ADR o una revisión
  de esta, no un cambio en el código.

**Fuentes (consultadas el 2026-09-30)**
- [1] https://cli.github.com/manual/gh_pr_merge — `--match-head-commit`, `--merge`, `--auto`,
  `--delete-branch`.
- [2] https://docs.github.com/en/subscriptions-and-notifications/concepts/about-notifications — no
  aclara si se notifica la actividad propia.
- [3] https://render.com/docs/deploys — auto-deploy «On Commit», «After CI Checks Pass» (no
  despliega si falla algún check o no hay ninguno) y «Off»; Deploy Hooks.
- [4] https://render.com/docs/service-previews — modo manual (`render-preview` o `[render preview]`
  en el título) o automático; gratis si el sitio base es un static site gratis; se borran al
  fusionar o cerrar la PR.
- [5] https://render.com/docs/rollbacks — el rollback reutiliza el artefacto; desde el panel
  desactiva el auto-deploy, por API no.
- Repositorio (2026-09-30): `factory/budgets.yaml`, `factory/orchestrator.ts`,
  `factory/launchd/com.darkfactory.reviewer.plist.example`, `.claude/agents/reviewer.md`,
  `.claude/hooks/guard_paths.ts`, `.github/workflows/ci.yml`.
