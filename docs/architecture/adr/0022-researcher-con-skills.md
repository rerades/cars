# ADR-0022 — Researcher con skills

- **Estado:** propuesta
- **Fecha:** 2026-10-30

## Contexto
- **PRD-007, RF-7:** el prompt base del Researcher ocupa menos de 3 K y recoge las reglas comunes
  (ADR-0001, rutas y bitácora). Cada tipo de tarea va en su propia skill y se carga solo cuando la
  tarea la necesita: fuentes nuevas, datos de modelos, imágenes y precios. Los evals de ADR-0004 no
  cambian.
- **CA-9:** el prompt base ocupa menos de 3 K, y una tarea de precios no carga la skill de imágenes
  (se ve en la traza).
- **OPEN-3:** ¿cargan las skills de `.claude/skills/` en `claude -p` dentro del worktree con
  `FACTORY_AGENT`? ¿Puede una skill limitarse a un solo agente?
- **Sección 1 de PRD-007:** `.claude/agents/researcher.md` ocupa hoy 11 784 bytes (`wc -c`,
  2026-10-30; el PRD habla de 9,3 K), y sus `eval_failed` son de reglas que el prompt ya explica.
- **Fuera de alcance (PRD-007, sección 3):** dividir el Researcher en dos agentes.
- **ADR-0002 y RNF-3:** ningún agente escribe en `.claude/`; `guard_paths.ts` es la barrera. Los
  permisos de cada agente viven en `factory/budgets.yaml` (`allowed_tools`, `denied_tools`).
- **ADR-0011:** las PR que tocan `.claude/` o `factory/` nunca se fusionan solas (también CA-12).
- **ADR-0016:** solo el Revisor tiene dataset en `factory/datasets/`; el Researcher no.
- **Cómo se lanza hoy un agente** (`factory/orchestrator.ts`, `buildCommand`): `claude -p <tarea>
  --agent <agente> --setting-sources project --strict-mcp-config --permission-mode acceptEdits
  --allowedTools …`. Cada `.claude/agents/*.md` tiene una lista `tools:` explícita, y **ninguna
  incluye `Skill`**.
- La tarea nombra cuatro tipos (precios, imágenes, reviews y alta de marca); RF-7 nombra otros
  cuatro (fuentes nuevas, datos de modelos, imágenes y precios). Esta ADR cubre la unión.

### Qué dice la documentación oficial (consultada el 2026-10-30)
- **Skills** — <https://code.claude.com/docs/en/skills>:
  - Las skills de proyecto viven en `.claude/skills/<nombre>/SKILL.md` y cargan en «Sessions in this
    repository». Las de `--add-dir` dependen de la fuente de ajustes `project`.
  - En una sesión normal solo entra en el contexto la `description` (con `when_to_use`, truncada a
    1 536 caracteres); «full skill content only loads when invoked», y desde entonces se queda en
    la conversación.
  - En `-p` o con el Agent SDK, una tarea que empieza por `/nombre` carga **solo la primera** skill.
  - «Claude Code applies a project skill's `allowed-tools` even in a `-p` run in a folder you've never
    trusted.»
  - `disable-model-invocation: true` saca la skill del contexto de Claude e impide precargarla;
    `user-invocable: false` la quita del menú `/`.
  - Permisos: `Skill(nombre)` es una regla exacta; denegar `Skill` desactiva todas las skills.
  - `skillOverrides` (`on`, `name-only`, `user-invocable-only`, `off`) se aplica por nombre de skill,
    no por agente.
- **Subagentes** — <https://code.claude.com/docs/en/sub-agents>:
  - El campo `skills` del agente «preload[s] into the subagent's context at startup. The full skill
    content is injected», y «controls which skills are preloaded, not which skills the subagent can
    access».
  - «To prevent a subagent from invoking skills entirely, omit `Skill` from the `tools` list or add
    it to `disallowedTools`.»
  - Con `--agent`, «Claude Code restores the agent's tool restrictions and model». Lo que la página
    no dice es si el campo `skills` precarga también en ese modo.
  - No documenta ninguna forma de que una skill solo exista para un agente.
- **Herramientas** — <https://code.claude.com/docs/en/tools-reference>: la fila de `Skill` dice
  «Permission required: Yes» (igual que `Write` o `WebFetch`; `Read`, no).

**Respuesta a OPEN-3, según la documentación.** (1) Las skills de proyecto cargan en `-p` con
`--setting-sources project`, siempre que el agente tenga la herramienta `Skill` y el permiso para
usarla. En `-p` nadie aprueba, así que la necesita en `--allowedTools`. Que pase igual con `--agent`
y dentro del worktree no está escrito: está en las preguntas abiertas. (2) Una skill **no** se
puede limitar a un agente por sí misma. Lo que sí se limita es **qué agente puede invocar skills**,
con su `tools:` y sus permisos.

## Opciones consideradas
**Cómo se carga el texto de cada tipo de tarea**

- **A. Skills de proyecto que el Researcher invoca con la herramienta `Skill`, elegidas por su
  `description`.** Es lo que pide RF-7 y lo único que permite comprobar CA-9 con la traza: solo se
  carga lo que se invoca. **Elegida.**
- **B. La tarea empieza por `/researcher-precios` y el orquestador la carga por adelantado.** Es
  determinista, pero en `-p` solo carga la primera skill (documentación de skills). Un alta de
  marca necesita fuentes, modelos, precios e imágenes en la misma ejecución, y la segunda skill
  dependería igual del modelo. **Descartada como mecanismo principal.** Una tarea puede seguir
  nombrando la skill en su texto.
- **C. Precargar las skills con el campo `skills` de `researcher.md`.** Inyecta el contenido entero
  al empezar: el contexto es el mismo que hoy, y CA-9 («una tarea de precios no carga la skill de
  imágenes») no se cumple nunca. Además, no está documentado que funcione con `--agent`.
  **Descartada.**
- **D. Textos en `docs/` que el prompt base manda leer con `Read` según la tarea.** No necesita
  permisos nuevos y la traza también lo vería. Pero RF-7 pide skills, y la elección quedaría en una
  regla de texto del prompt base en lugar de en la `description` de cada skill. **Descartada.** Es
  la alternativa si la prueba 1 de las preguntas abiertas sale mal.
- **E. Dos o más agentes Researcher.** Fuera de alcance por decisión del responsable (PRD-007,
  sección 3). **Descartada.**

**Cómo se limitan al Researcher**

- **L1. Solo `researcher.md` añade `Skill` a su `tools:`, y solo `budgets.yaml` le da permiso
  `Skill(<nombre>)`, una regla por skill.** Los demás agentes ya tienen una lista `tools:` sin
  `Skill`, y la documentación dice que eso les impide invocar skills. Sin una regla de permiso, `-p`
  tampoco lo aprobaría. **Elegida.**
- **L2. Además, `denied_tools: [Skill]` en los demás agentes.** Es redundante con L1 y añade siete
  líneas que mantener. **Descartada.** En su lugar, una prueba comprueba que ningún otro agente
  tiene `Skill` en `tools:` ni en `allowed_tools`.
- **L3. `skillOverrides` o `disable-model-invocation`.** El primero actúa por nombre de skill, no
  por agente. El segundo la saca del contexto de todos, también del Researcher. **Descartada.**
- **L4. `allowed-tools` en el frontmatter de cada skill.** Daría permisos sin pasar por
  `budgets.yaml`, y se aplica incluso en `-p`. Abre una segunda puerta de permisos fuera de
  ADR-0002. **Descartada:** las skills no llevan `allowed-tools`.

## Decisión
**El Researcher pasa a un prompt base de menos de 3 000 caracteres más cinco skills de proyecto en
`.claude/skills/researcher-*/SKILL.md`, que invoca él mismo con la herramienta `Skill`. Solo él tiene
esa herramienta y el permiso `Skill(researcher-…)` en `budgets.yaml`.**

1. **Prompt base** (`.claude/agents/researcher.md`, frontmatter incluido, < 3 000 caracteres
   contados con `String.length`). Lleva:
   - el papel;
   - las lecturas obligatorias (ADR-0001 y `data-model.md`);
   - las reglas comunes: nunca inventar ni estimar, prioridad por nivel y `needs_review`,
     `robots.txt` y términos, T3 nunca como única fuente de precio, solo escribir en `data/`, la
     bitácora;
   - una línea por skill que diga cuándo usarla;
   - la salida final.

   Todo lo demás sale del prompt.
2. **Skills**, con `name` igual al nombre de la carpeta, una `description` que diga cuándo se usa y
   `user-invocable: false`. Sin `allowed-tools`, `context`, `agent` ni `model`:

   | Skill | Tipo (tarea / RF-7) | Contenido que sale de `researcher.md` hoy |
   |---|---|---|
   | `researcher-fuentes` | alta de marca / fuentes nuevas | responsabilidad 1: `data/sources/`, `candidatas.yaml`, T1/T2, Commons como fuente, `broken`, medios y organismos |
   | `researcher-modelos` | datos de modelos | esquema exacto, valor con fuente, CV a kW, IDAE (`fetch-idae.ts`), `launch`, `status` y `segment` |
   | `researcher-precios` | precios | PVP y `financed`, `fetch-page.ts` como prueba, `price_terms`, `page_name` |
   | `researcher-imagenes` | imágenes | licencias, `fetch-image.ts`, migración de `url` |
   | `researcher-reviews` | reviews (ADR-0017) | `reviews`, `test_results` y lo que no se escribe |

   Una regla que dos skills necesiten se queda en el prompt base, no se copia. Las reglas no se
   reescriben al moverlas: se cortan y se pegan.
3. **Limitación:** `researcher.md` añade `Skill` a `tools:`. Ningún otro `.claude/agents/*.md` lo
   lleva.
4. **`factory/budgets.yaml`:** a `agents.researcher.allowed_tools` se añaden `Skill(researcher-fuentes)`,
   `Skill(researcher-modelos)`, `Skill(researcher-precios)`, `Skill(researcher-imagenes)` y
   `Skill(researcher-reviews)`. No cambian los topes, `network`, `model` ni ningún otro agente.
   Los topes se revisan con RF-1 tras el primer mes, no ahora.
5. **Evals y pruebas.** Los evals de ADR-0004 (`registry`, `rawData`, `rawShape` en
   `factory/evals.ts`) no cambian (RF-7). Se añaden **pruebas** en `factory/tests/`, no evals de
   ejecución:
   - `researcher.md` < 3 000 caracteres (CA-9, primera mitad);
   - cada `Skill(...)` de `allowed_tools` tiene su `.claude/skills/<nombre>/SKILL.md`, y al revés;
   - ningún agente salvo el Researcher tiene `Skill` en `tools:` o en `allowed_tools`;
   - una función pura que, dada una traza de ADR-0004, lista las skills invocadas. Su prueba usa
     una traza real de una tarea de precios guardada como fixture (CA-9, segunda mitad).
6. **Quién lo escribe:** el troceo de `researcher.md`, las skills, `budgets.yaml` y las pruebas los
   escribe una persona (ADR-0002, RNF-3; la factoría no escribe en `.claude/` ni en `factory/`), en
   una PR que no se fusiona sola (ADR-0011, CA-12). Las propuestas del agente retro sobre estas
   skills llegan como texto (RF-10).
7. **Orden:** primero las pruebas 1 y 2 de las preguntas abiertas. Si alguna falla, no se trocea
   y esta ADR se revisa (opción D).

## Consecuencias
**Buenas**
- Una tarea de precios carga el prompt base y `researcher-precios`, no las reglas de IDAE, imágenes
  ni reviews. Es menos contexto en cada turno y menos reglas que compiten entre sí.
- Responde a OPEN-3 con la documentación y deja la parte no documentada como pruebas concretas.
- Los permisos siguen en un solo sitio (`budgets.yaml`) y la barrera de `guard_paths.ts` no cambia
  (RNF-3).
- Cada skill es una unidad pequeña que el retro (RF-10) puede proponer cambiar sin tocar el resto.

**Malas**
- **La elección de la skill depende del modelo.** Si el Researcher no invoca `researcher-precios`
  en una tarea de precios, trabaja sin las reglas de `financed` y de `fetch-page.ts`. Justo esas son
  las que hoy fallan. El riesgo es mayor que ahora, no menor, hasta que se mida. Mitigaciones: la
  línea por skill del prompt base, y que las tareas de la cola nombren la skill. Ninguna de las dos
  es una garantía.
- **Sin dataset del Researcher (ADR-0016), el troceo no tiene `eval-run.ts`.** Solo se sabrá si
  empeora con las ejecuciones reales: la tasa de `eval_failed`, de `review:changes` y de
  `merger:needs-human` por el verificador (ADR-0020), medidas con RF-1 antes y después. Crear ese
  dataset es una decisión pendiente, no de esta ADR.
- **Una skill invocada se queda en la conversación** (documentación de skills). Una tarea larga que
  toca los cinco tipos acaba con el mismo contexto que hoy, más las llamadas a `Skill`. El ahorro
  está en las tareas de un solo tipo.
- **Las `description` de las cinco skills siguen cargándose en las sesiones humanas** del
  repositorio. `user-invocable: false` las quita del menú `/`, no del contexto de Claude. Que también
  se carguen en los agentes sin `Skill` no está documentado (prueba 3).
- **El límite de 3 000 caracteres es una interpretación.** RF-7 dice «3 K» sin unidad; el «9,3 K»
  de la sección 1 no coincide con los 11 784 bytes de hoy. Si Producto quería otra unidad, cambia el
  número de la prueba, no el diseño.
- **Diferencia entre la tarea y RF-7:** «reviews» no está en la lista de RF-7. Producto debería
  alinear RF-7 con las cinco skills. No toco el PRD.
- Son seis ficheros en `.claude/` en lugar de uno, y todos los mantiene una persona.

### Preguntas abiertas, con la prueba que las resuelve
1. **¿Ve el Researcher las skills de proyecto con `--agent` y `-p` dentro del worktree con
   `FACTORY_AGENT`?** La documentación cubre `-p` y las skills de proyecto, pero no la combinación
   con `--agent`. *Prueba:* en una rama, una skill `researcher-prueba` cuya `description` pide
   escribir una palabra fija. Se lanza `node factory/run.ts researcher "<tarea que la pida>"` con
   `Skill` en `tools:` y `Skill(researcher-prueba)` en `allowed_tools`. Si la traza tiene un
   `tool_use` de `Skill` con ese nombre y la palabra sale, la respuesta es sí.
2. **¿Cómo aparece una invocación de skill en la traza `stream-json`?** No está documentado. La
   función de lista de skills (decisión, punto 5) depende de eso. *Prueba:* la misma ejecución de
   la prueba 1. Se guarda la traza como fixture.
3. **¿Ve un agente sin `Skill` en `tools:` las `description` de las skills?** *Prueba:* lanzar el
   planner con una tarea que le pida listar las skills disponibles y mirar la traza. No bloquea la
   decisión: solo afecta al contexto de los demás agentes.
4. **¿Elige el Researcher la skill correcta por su cuenta?** *Prueba:* tras el troceo, las 10
   primeras tareas de precios y de imágenes de la cola, contando en la traza cuáles invocaron la
   skill esperada y cuáles cargaron otra.
5. **Unidad de «3 K»** (RF-7, CA-9): ¿caracteres, bytes o tokens? La responde Producto.
