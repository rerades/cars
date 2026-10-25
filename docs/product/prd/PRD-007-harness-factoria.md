---
id: PRD-007
title: Harness de la factoría
status: draft        # draft | ready | in-progress | done | deprecated
priority: P1         # P0 imprescindible · P1 importante · P2 deseable
depends_on: []
epic: ""
updated: 2026-10-25
---

# PRD-007 — Harness de la factoría

> **Borrador (2026-10-20).** Es el primer PRD que no trata de la web sino de la propia factoría. Sale
> de una lluvia de ideas con el responsable, que eligió las palancas, la forma de repartir el trabajo
> del Researcher, el grado de autonomía y los agentes nuevos (sección 9). Las preguntas de la
> sección 8 las responde el Arquitecto en ADR antes de pasar a `ready`.

## 1. Problema
El cuello de botella de la factoría no son los agentes, es la persona. Lo dicen los datos de
`ops/runs/`, `ops/merges/` y GitHub a 2026-10-20:

- **Los agentes funcionan.** 212 ejecuciones, el 94 % con éxito, de unos 2 min de media. Las
  15 ejecuciones diarias (`max_runs_per_day`) ocupan unos 30 min de una ventana de 6 h.
- **Casi todo lo fusiona una persona.** De 115 PR de agentes (111 fusionadas), solo 23 se
  fusionaron solas (ADR-0011), y todas eran de datos. Las del developer, el designer, product y
  architect se fusionan siempre a mano. Hubo 26 `review:needs-human`, 11 `review:changes` y
  9 `merger:needs-human`.
- **Una persona alimenta la cola.** Unas 50 PR humanas no son de estado (`chore/factory-state`), y
  unas 26 de ellas solo sirven para encolar. `factory/queue.yaml` no comprueba dependencias, así
  que la persona tiene que esperar a que una historia esté fusionada antes de encolar la siguiente.
- **Los fallos se ven tarde.** El developer solo tiene evals de `write_paths`. Las pruebas, los
  tipos y el build se comprueban por primera vez en la CI, con la PR ya abierta. Una PR roja o con
  `review:changes` espera a la persona, aunque el arreglo sea mecánico.
- **El Researcher hace demasiadas cosas.** Su prompt ocupa 9,3 K, el triple que los demás. Es el
  agente con más ejecuciones (107) y más gasto (36 USD-eq), y sus 5 `eval_failed` son de reglas
  que su prompt ya explica.
- **Tiempo hasta la fusión de una PR de agente:** 8 h de mediana y 18 h en el p90, al ritmo de una
  pasada por noche.

## 2. Objetivo y métricas
Más trabajo terminado por noche con menos manos humanas, sin perder confianza en lo que entra.
Las métricas se calculan con RF-1. La línea base es la de hoy y el objetivo es al terminar la
fase 3.

| Métrica | Hoy | Objetivo |
|---|---|---|
| PR humanas que solo encolan | ~26 por mes | 0 |
| PR de agente fusionadas sin intervención humana | 23 de 111 (21 %) | ≥ 50 % |
| Rendimiento a la primera: PR fusionadas sin `review:changes` ni CI roja | sin medir | se mide desde la fase 0 y sube |
| Tiempo hasta la fusión de una PR de agente, p90 | 18 h | ≤ 12 h |
| Noches con la cola vacía dentro del horario | sin medir | 0 |
| Coste por PR fusionada (USD-eq) | sin medir | no sube |
| Defectos escapados: revert o arreglo en los 7 días siguientes a una fusión | sin medir | no sube al ganar autonomía |

## 3. Alcance
### Incluido
- Medir el harness (fase 0).
- Quitar a la persona del camino crítico con código sin modelo: la cola desde issues y la puerta
  antes de abrir la PR (fase 1).
- Menos idas y vueltas: el bucle de corrección, el Revisor con una rúbrica por tipo de PR y el
  Researcher con skills (fase 2).
- Confianza para dar más autonomía: el verificador de datos, la escalera de confianza y el agente
  retro (fase 3).
- Mantenimiento de los datos publicados: la comprobación semanal de las URL de `data/` (RF-11).
  No depende de ninguna fase.

### Fuera de alcance
- Cambiar de plan (Pro o Max), ampliar `allowed_hours` o subir `max_concurrent_runs`. Se reconsidera
  con las métricas de la fase 0. Hoy el tope de ejecuciones manda más que el tiempo.
- Un agente «dispatcher» con modelo: la cola desde issues (RF-2) es código, más barato y más
  predecible.
- Un agente de QA: la puerta previa (RF-3) y las pruebas e2e que ya existen lo cubren.
- Dividir el Researcher en dos agentes: el responsable eligió un agente con skills (RF-7).
- Fusionar sin persona las PR que tocan `factory/`, `.claude/`, `.github/` o las ADR. La escalera
  (RF-9) nunca llega ahí.

## 4. Requisitos funcionales

### Fase 0 — Medir
- **RF-1:** `node factory/run.ts --metrics` calcula las métricas de la sección 2, por agente y para
  el mes, a partir de `ops/runs/`, `ops/merges/` y `gh`. No usa el modelo y se puede lanzar a mano.

### Fase 1 — Velocidad sin modelo
- **RF-2:** **Cola desde issues.** Una historia abierta con la etiqueta `factory:ready` entra en la
  cola cuando están cerradas **como completadas** todas las issues que su cuerpo cita en una línea
  `Depende de: #x, #y`; una cerrada por otro motivo (no planificada, duplicada) no la desbloquea.
  `factory:ready` la pone solo una persona, nunca un agente.
  La tarea que se encola nombra la historia y su agente. `factory/queue.yaml` se queda para las
  tareas que no son historias (datos, PRD, ADR, diseño). Una historia no se encola dos veces.
  Enmienda la ADR-0013.
- **RF-3:** **Puerta antes de abrir la PR.** Además de los evals de ADR-0004, el orquestador ejecuta
  en el worktree las comprobaciones que la CI haría con los ficheros del diff: `pnpm test`,
  `pnpm run typecheck` y el build si hay cambios en `web/`, y `node factory/validate-data.ts` si los
  hay en `data/`. Si alguna falla, la ejecución queda en `eval_failed`, no se abre la PR y el ledger
  guarda qué comprobación falló.
- **RF-4:** **Trazabilidad de los CA.** En una PR del developer, un eval comprueba que la descripción
  cita los RF y CA de su historia y que cada CA citado aparece en el nombre o en el comentario de al
  menos una prueba (definition-of-done).

### Fase 2 — Menos idas y vueltas
- **RF-5:** **Bucle de corrección.** Una PR de agente con `review:changes`, o con la CI en rojo,
  vuelve a la cola para su mismo agente, sobre la misma rama, con el comentario del Revisor o el
  log de la CI como entrada. Tiene un solo reintento. Si vuelve a acabar en `review:changes` o en
  rojo, pasa a `merger:needs-human`.
- **RF-6:** **Revisor con una rúbrica por tipo de PR.** El Revisor elige la rúbrica por las rutas
  del diff: datos (`data/`) o código y documentación (el resto). Cada rúbrica tiene sus casos en el
  dataset de ADR-0016, y un cambio de rúbrica se aprueba con `factory/eval-run.ts`, igual que un
  cambio de prompt.
- **RF-7:** **Researcher con skills.** El prompt base del Researcher ocupa menos de 3 K y recoge las
  reglas comunes (ADR-0001, rutas y bitácora). Cada tipo de tarea va en su propia skill y se carga
  solo cuando la tarea la necesita: fuentes nuevas, datos de modelos, imágenes y precios. Los evals
  de ADR-0004 no cambian.

### Fase 3 — Confianza para más autonomía
- **RF-8:** **Verificador de datos independiente.** Para cada PR de datos, vuelve a leer una muestra
  de los valores nuevos o cambiados contra su `url` y comprueba que el valor está en la página. Lo
  hace quien no escribió el dato. Si un valor no coincide, la PR recibe `merger:needs-human` con el
  valor, la URL y lo que encontró.
- **RF-9:** **Escalera de confianza.** Cada agente sube un peldaño para un tipo de cambio después de
  N fusiones limpias seguidas de ese tipo. Una fusión es limpia si entró sin `review:changes`, sin
  CI roja y sin defecto escapado. Con el peldaño, las PR de ese tipo se fusionan solas con las
  reglas de ADR-0011 más la puerta de RF-3; por ejemplo, las de `web/` del developer. Un revert o un
  defecto escapado (sección 2) baja un peldaño. El estado de la escalera se versiona y
  `run.ts --status` lo muestra. Enmienda la ADR-0011.
- **RF-10:** **Agente retro.** Un agente nuevo, `retro`, lee las ejecuciones fallidas, los
  `review:changes` y los defectos escapados del periodo, con sus trazas (ADR-0004), y propone cambios
  a `.claude/agents/*.md` o a las skills. Cada propuesta lleva el resultado de `factory/eval-run.ts`
  (ADR-0016) y la fusiona siempre una persona. Cada defecto escapado se convierte en un caso del
  dataset.

### Mantenimiento de los datos
- **RF-11:** **Comprobación semanal de URL.** Una vez por semana, un workflow de GitHub Actions
  comprueba, sin modelo, todas las URL que cita `data/`: las `url` y `price_terms_url` de
  `data/raw/`, las `source_url` y `page_url` de las imágenes y las `urls` de `data/sources/`.
  - **Rota:** después de un reintento, responde 404 o 410, o el host no resuelve.
  - **No comprobable:** responde 401, 403, 429 o 5xx, o se agota el tiempo. Suele ser un bloqueo de
    bots o una caída pasajera. Se lista aparte y no cuenta como rota.
  - **Cortesía:** respeta `robots.txt` igual que `factory/fetch-page.ts` (una URL prohibida se lista
    como no comprobable), con como mucho una petición por segundo y host, y con el mismo agente.
  - **Resultado:** una sola issue abierta con la etiqueta `fuentes-rotas`, no una por URL. Se crea o
    se actualiza en cada pasada y lista cada URL rota con el fichero que la cita. Se cierra sola
    cuando no queda ninguna rota.
  - **No cambia datos.** Arreglar una URL rota es una tarea del Researcher.
  - **Quién lo escribe:** el script va en `factory/` y lo escribe una persona, porque ningún agente
    escribe ahí (RNF-3). El workflow va en `.github/workflows/` y es de DevOps.

## 5. Requisitos no funcionales
- **RNF-1:** Todo lo que se pueda decidir con código va sin modelo: RF-1, RF-2, RF-3, RF-4 y la
  parte de reglas de RF-5 y RF-9. No se añaden servicios externos.
- **RNF-2:** Los límites de ADR-0002 siguen mandando. Un reintento de RF-5 cuenta como una ejecución
  más, y el agente retro tiene su propio presupuesto en `factory/budgets.yaml`.
- **RNF-3:** `guard_paths.ts` sigue siendo la barrera. Ningún RF da a un agente permiso de escritura
  fuera de sus `write_paths`.
- **RNF-4:** Cada decisión automática (encolar, rechazar en la puerta, reintentar, subir o bajar un
  peldaño, fusionar) deja rastro en `ops/` o en un comentario de la PR, con su motivo.
- **RNF-5:** `factory/STOP` lo para todo, también la cola desde issues y el bucle de corrección.

## 6. Datos
- `ops/runs/YYYY-MM.jsonl` (ADR-0002) y `ops/merges/YYYY-MM.jsonl` (ADR-0011): fuente de las métricas
  y de la escalera.
- `ops/traces/` (ADR-0004): entrada del agente retro. No se versiona, así que el retro trabaja en
  la máquina de la factoría.
- Las issues y PR de GitHub: etiquetas `factory:ready` (nueva), `review:*` y `merger:*`, y la línea
  `Depende de:` del cuerpo de cada historia.
- `factory/datasets/` (ADR-0016): los casos de las rúbricas y de los defectos escapados.

## 7. Criterios de aceptación
- [ ] **CA-1** (→ RF-1): Dado el ledger de octubre, cuando se ejecuta `run.ts --metrics`, entonces
  muestra cada métrica de la sección 2 por agente, y la cifra de PR fusionadas sin persona coincide
  con las líneas de `ops/merges/`.
- [ ] **CA-2** (→ RF-2): Dada una historia con `factory:ready` y una dependencia abierta, cuando pasa
  el alimentador, entonces no entra en la cola. Cuando se cierra la dependencia, entra en la
  siguiente pasada, y una tercera pasada no la duplica.
- [ ] **CA-3** (→ RF-2): Dada una historia sin `factory:ready`, cuando pasa el alimentador, entonces
  no entra en la cola aunque no tenga dependencias.
- [ ] **CA-4** (→ RF-3): Dada una ejecución del developer cuyo cambio rompe `pnpm run typecheck`,
  cuando termina, entonces el ledger dice `eval_failed` y nombra el typecheck, y no se abre la PR.
- [ ] **CA-5** (→ RF-3): Dada una ejecución del researcher cuyo YAML no pasa `validate-data`, cuando
  termina, entonces no se abre la PR.
- [ ] **CA-6** (→ RF-4): Dada una PR del developer que cita CA-3 sin que ninguna prueba lo nombre,
  cuando corren los evals, entonces el eval de trazabilidad falla y dice qué CA falta.
- [ ] **CA-7** (→ RF-5): Dada una PR de agente con `review:changes`, cuando pasa la cola, entonces
  hay una tarea para su agente sobre la misma rama con el comentario del Revisor. Si el reintento
  vuelve a `review:changes`, la PR recibe `merger:needs-human` y no hay tercer intento.
- [ ] **CA-8** (→ RF-6): Dada una PR que solo toca `data/raw/`, cuando la revisa el Revisor, entonces
  usa la rúbrica de datos, y la de código si toca `web/`. Los casos de las dos rúbricas pasan en
  `eval-run.ts`.
- [ ] **CA-9** (→ RF-7): El prompt base del Researcher ocupa menos de 3 K, y una tarea de precios no
  carga la skill de imágenes (se ve en la traza).
- [ ] **CA-10** (→ RF-8): Dada una PR de datos con un precio que no aparece en su `url`, cuando pasa
  el verificador, entonces la PR recibe `merger:needs-human` con ese valor y su URL, y no se fusiona.
- [ ] **CA-11** (→ RF-9): Dado un agente con N−1 fusiones limpias de un tipo, cuando entra la N,
  entonces sube un peldaño y su siguiente PR de ese tipo se fusiona sola. Tras un revert, baja.
- [ ] **CA-12** (→ RF-9): Una PR que toca `factory/`, `.claude/`, `.github/` o `docs/architecture/adr/`
  nunca se fusiona sola, esté en el peldaño que esté.
- [ ] **CA-13** (→ RF-10): Dado un periodo con ejecuciones fallidas, cuando corre el agente retro,
  entonces abre una PR que cambia un prompt o una skill y adjunta el resultado de `eval-run.ts`, y el
  paso de fusión le pone `merger:needs-human`.
- [ ] **CA-14** (→ RNF-5): Con `factory/STOP`, ni el alimentador encola ni el bucle de corrección
  reintenta.
- [ ] **CA-15** (→ RF-11): Dada una URL de `data/raw/` que responde 404 y otra que responde 403,
  cuando corre la comprobación semanal, entonces la issue `fuentes-rotas` lista la primera como rota,
  con el fichero que la cita, y la segunda como no comprobable. Cuando en una pasada ya no queda
  ninguna rota, la issue se cierra.

## 8. Preguntas abiertas
- **OPEN-1** (→ RF-9): ¿Cuánto vale N? ¿Qué es un «tipo de cambio»: el agente más un prefijo de
  ruta? ¿Dónde se guarda el estado de la escalera?
- **OPEN-2** (→ RF-8): ¿El verificador es código sin modelo (descargar la página y buscar el valor)
  o un agente? ¿De qué tamaño es la muestra? ¿Qué hace con las páginas que solo cargan los precios
  con JavaScript?
- **OPEN-3** (→ RF-7): ¿Cargan las skills de `.claude/skills/` en `claude -p` dentro del worktree con
  `FACTORY_AGENT`? ¿Puede una skill limitarse a un solo agente? Hay que comprobarlo antes de trocear
  RF-7.
- **OPEN-4** (→ RF-10): Presupuesto, topes y frecuencia del agente retro (¿semanal?). ¿Usa Opus,
  como el Arquitecto?
- ~~**OPEN-5** (→ RF-2): ¿Sustituye el alimentador a las tareas de historias de `queue.yaml`, o conviven
  durante la migración? ¿En qué orden se intercalan las dos fuentes?~~ Resuelta por ADR-0018
  (2026-10-21): conviven; primero las pendientes de `queue.yaml`, después las historias, de la más
  antigua a la más nueva.
- ~~**OPEN-6** (→ RF-3): El build de `web/` usa el cerrojo de e2e (`web/node_modules/.e2e-build.lock`).
  ¿Lo comparte la puerta, o cada worktree tiene su propio `node_modules`?~~ Resuelta por ADR-0019
  (2026-10-21): cada worktree tiene su propio `node_modules` y la puerta no toma el cerrojo de e2e.

## 9. Historial de cambios
| Fecha | Cambio | Autor |
|---|---|---|
| 2026-10-20 | Borrador, nacido de la lluvia de ideas con el responsable. Eligió las cuatro palancas (cola desde issues, puerta antes de la PR, bucle de corrección y verificador de datos), un Researcher con skills en vez de dos agentes, la escalera de confianza y dos cambios de agentes (retro nuevo y Revisor con rúbrica por tipo). | responsable + Claude |
| 2026-10-21 | Aceptada la ADR-0018: RF-2 pide que las dependencias estén cerradas como completadas y que `factory:ready` la ponga solo una persona. OPEN-5 resuelta. Sin cambios en CA. | Claude |
| 2026-10-21 | Aceptada la ADR-0019: OPEN-6 resuelta. La puerta corre sin contenedor. Una PR `fix` cita la PR que arregla (definition of done), para RF-1 y RF-9. Sin cambios en RF ni CA. | Claude |
| 2026-10-25 | RF-11 y CA-15: comprobación semanal de las URL de `data/`, a petición del responsable. Se descartó dejarlo a las revisiones del Researcher, que solo miran las marcas que tocan. El script lo escribe una persona y el workflow, DevOps. | responsable + Claude |
