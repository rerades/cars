---
id: PRD-007
title: Harness de la factoría
status: draft        # draft | ready | in-progress | done | deprecated
priority: P1         # P0 imprescindible · P1 importante · P2 deseable
depends_on: []
epic: ""
updated: 2026-10-28
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
  5 fusiones limpias seguidas de ese tipo (N = 5, decidido el 2026-10-28). Un tipo de cambio es el agente
  más el primer nivel de ruta del diff (`developer` + `web/`); una PR que toca varios tipos solo se
  fusiona sola si todos están en el peldaño. De momento solo `web/` tiene escalera: `docs/product/` y
  `docs/design/` siguen siempre con una persona, y ampliarlo es una enmienda. Una fusión es limpia si entró sin `review:changes`, sin
  CI roja y sin defecto escapado. Con el peldaño, las PR de ese tipo se fusionan solas con las
  reglas de ADR-0011 más la puerta de RF-3; por ejemplo, las de `web/` del developer. Un revert o un
  defecto escapado (sección 2) baja un peldaño. El estado de la escalera son eventos (fusión limpia,
  subida, bajada, con la PR y el motivo) en `ops/trust/YYYY-MM.jsonl`, en la rama de estado de
  ADR-0013, y `run.ts --status` lo muestra. Enmienda la ADR-0011 y la ADR-0013.
- **RF-10:** **Agente retro.** Un agente nuevo, `retro`, lee las ejecuciones fallidas, los
  `review:changes` y los defectos escapados del periodo, con sus trazas (ADR-0004), y propone cambios
  a `.claude/agents/*.md` o a las skills **como texto** (el diff propuesto, en una PR de
  `docs/bitacora/` o en una issue): no escribe en `.claude/` (ADR-0002, RNF-3). Una persona lo
  aplica, con el resultado de `factory/eval-run.ts` (ADR-0016). Corre como mucho una vez por semana
  y solo si desde la pasada anterior hay al menos 3 señales (fallo, `review:changes` o defecto
  escapado), contadas por código sin modelo. Usa Sonnet, con topes de 1 USD-eq por ejecución y 6 al
  mes en `budgets.yaml`. Mientras solo el Revisor tenga dataset de evals, solo propone cambios a
  su prompt. Cada defecto escapado se convierte en un caso del
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
  entonces deja el cambio propuesto a un prompt o una skill como texto, sin escribir en `.claude/`,
  y nada lo aplica sin una persona. Con menos de 3 señales en la semana, no corre.
- [ ] **CA-14** (→ RNF-5): Con `factory/STOP`, ni el alimentador encola ni el bucle de corrección
  reintenta.
- [ ] **CA-15** (→ RF-11): Dada una URL de `data/raw/` que responde 404 y otra que responde 403,
  cuando corre la comprobación semanal, entonces la issue `fuentes-rotas` lista la primera como rota,
  con el fichero que la cita, y la segunda como no comprobable. Cuando en una pasada ya no queda
  ninguna rota, la issue se cierra.

## 8. Preguntas abiertas
- ~~**OPEN-1** (→ RF-9)~~ Resuelta el 2026-10-28 por el responsable: N = 5; tipo = agente + primer
  nivel de ruta, empezando solo por `web/`; estado en `ops/trust/` (alternativa E1). Ver RF-9. ¿Cuánto vale N? ¿Qué es un «tipo de cambio»: el agente más un prefijo de
  ruta? ¿Dónde se guarda el estado de la escalera?

  > **Propuesta para decidir al revisar la PR (2026-10-28). Decidida: N = 5 en vez de 10, el resto como se recomienda.**
  >
  > **Datos de octubre** (`ops/runs/2026-10.jsonl` y `ops/merges/2026-10.jsonl`, del 1 al 27):
  > 256 ejecuciones y 8 no exitosas (3 %). El developer hizo 54 ejecuciones y abrió 51 PR; **ninguna
  > se fusionó sola**. El Researcher abrió 126 PR y 46 se fusionaron solas (37 %); las otras 80 fueron a
  > una persona. De las 50 fusiones automáticas, 46 son del Researcher y 4 del planner (solo
  > bitácora). Es decir, la escalera solo cambia algo para el developer: el Researcher ya está en su
  > «peldaño» por ADR-0011. **Lo que no hay:** el ledger no dice qué PR del developer fueron limpias
  > (`review:changes` y la CI roja viven en GitHub, y las fusiones manuales no están en
  > `ops/merges/`). Las cifras de abajo usan como sustituto la tasa global de la sección 1 (11
  > `review:changes` en 115 PR, ~10 %, a 2026-10-20) y son una **estimación**, no una medida. RF-1
  > la sustituirá por la real.
  >
  > **a) Valor de N.** Con una PR limpia con probabilidad 0,9, esperar N limpias seguidas cuesta de
  > media (1 − 0,9^N) / (0,1 · 0,9^N) PR:
  >
  > | N | PR de media hasta subir | Octubre con el developer (51 PR) |
  > |---|---|---|
  > | 5 | ~7 | ~44 PR sin persona (86 %) |
  > | 10 | ~19 | ~32 PR sin persona (63 %) |
  > | 20 | ~72 | ninguna: no llega a subir en el mes |
  >
  > - **N = 5.** Rápida, pero 5 PR son poca muestra: una persona ha leído cinco historias antes de
  >   soltar el código de `web/`. Un defecto escapado baja un peldaño y se vuelve a empezar.
  > - **N = 10.** Dos o tres semanas al ritmo de octubre. Deja pasar solo las rachas largas.
  > - **N = 20.** Con ~10 % de PR no limpias casi nunca se alcanza (probabilidad de racha ~12 %). Equivale
  >   a no activar la escalera para el developer.
  >
  > **Recomendación: N = 10**, y revisarlo con la tasa real de RF-1 tras el primer mes. Es el punto
  > donde la escalera se activa en octubre sin quitar a la persona del todo desde la primera semana.
  > Si la tasa real de PR limpias del developer resulta ≥ 95 %, N = 5 pasa a ser razonable; si es
  > < 85 %, N = 10 deja de subir y habrá que mirar por qué fallan antes de tocar N.
  >
  > **b) Qué es un «tipo de cambio».**
  > - **A. Agente + primer nivel de ruta** (`developer` + `web/`, `researcher` + `data/raw/`,
  >   `product` + `docs/product/`). Es lo que da el ejemplo de RF-9. Octubre: las 51 PR del
  >   developer cuentan casi todas como `web/` (la bitácora no cuenta: ya está en la lista de
  >   ADR-0011).
  > - **B. Agente + dos niveles de ruta** (`web/src/components/`, `web/src/lib/`, `web/e2e/`…). Más
  >   fino, pero reparte las 51 PR entre varias áreas y cada una necesita sus N: con N = 10 es
  >   probable que alguna no suba en el mes. No he podido medir el reparto (el ledger no guarda los
  >   ficheros del diff de las PR no fusionadas solas).
  > - **C. Solo el agente.** Simple, pero una racha de PR de `web/` subiría también las de
  >   `docs/design/`, que no se parecen. Choca con el «tipo de cambio» de RF-9.
  >
  > **Recomendación: A**, con dos reglas: (1) una PR que toca varios tipos solo se fusiona sola si
  > **todos** están en el peldaño; (2) las rutas de CA-12 (`factory/`, `.claude/`, `.github/`, ADR)
  > no son un tipo: no tienen escalera. Queda por decidir, y no lo decido yo, si `docs/product/` y
  > `docs/design/` pueden tener escalera o se quedan siempre con persona (ADR-0011 los excluyó
  > porque son el contrato; RF-9 solo nombra `web/` como ejemplo). Mi sugerencia es empezar solo con
  > `web/` y ampliar con una enmienda.
  >
  > **c) Dónde vive el estado.**
  > - **E1. Eventos en `ops/trust/YYYY-MM.jsonl` (ledger añadido) y estado por reproducción.** Un
  >   evento por fusión limpia, bajada o subida, con la PR y el motivo (RNF-4). Lo escribe el paso de
  >   fusión, como `ops/merges/`, y viaja en la PR de estado de ADR-0013, que habría que ampliar a
  >   esa ruta. `run.ts --status` lo muestra. Se puede rehacer entero desde los eventos.
  > - **E2. Un fichero de estado en `factory/`** (por ejemplo `factory/trust.yaml`). Subir un peldaño
  >   sería una PR de una persona, es decir, una puerta humana extra. Seguro, pero reintroduce el
  >   cuello de botella que RF-9 quiere quitar y no cumple «se fusionan solas» (RF-9).
  > - **E3. Sin fichero: se deriva cada vez de GitHub y de `ops/merges/`.** Nada que versionar y se
  >   puede reconstruir octubre entero hacia atrás. Pero depende de `gh` (red) para decidir una
  >   fusión, y las fusiones manuales no dejan línea en `ops/`.
  >
  > **Recomendación: E1.** Es la misma forma que `ops/merges/` (ADR-0011), no depende de `gh` al
  > decidir y deja el rastro que pide RNF-4. Para llenarlo, el paso de fusión lee con `gh` las PR de
  > agente fusionadas desde su última pasada (también las manuales). Requiere enmendar ADR-0011
  > (RF-9 ya lo anuncia) y ADR-0013 (nueva ruta de estado): lo hace el Arquitecto.
- ~~**OPEN-2** (→ RF-8): ¿El verificador es código sin modelo (descargar la página y buscar el valor)
  o un agente? ¿De qué tamaño es la muestra? ¿Qué hace con las páginas que solo cargan los precios
  con JavaScript?~~ Resuelta por ADR-0020 (2026-10-26): código sin modelo, última regla de la fusión;
  hasta 10 URL por PR, precios primero; un valor que no está en el texto servido, también en páginas
  de solo JavaScript, va a una persona.
- **OPEN-3** (→ RF-7): ¿Cargan las skills de `.claude/skills/` en `claude -p` dentro del worktree con
  `FACTORY_AGENT`? ¿Puede una skill limitarse a un solo agente? Hay que comprobarlo antes de trocear
  RF-7.
- ~~**OPEN-4** (→ RF-10)~~ Resuelta el 2026-10-28 por el responsable: F3 (semanal con umbral 3), M1
  (Sonnet), los topes de la tabla y propuestas como texto. Ver RF-10 y CA-13. Presupuesto, topes y frecuencia del agente retro (¿semanal?). ¿Usa Opus,
  como el Arquitecto?

  > **Propuesta para decidir al revisar la PR (2026-10-28). Decidida tal como se recomienda.**
  >
  > **Datos.** Materia prima del retro en octubre (1 al 27): 8 ejecuciones no exitosas (6 del
  > Researcher o el developer entre ellas; ~2 por semana) y, según la sección 1, 11 `review:changes`
  > a 2026-10-20 (~4 por semana). Unas 6 señales por semana, sin contar defectos escapados, que no
  > se miden aún. Costes del ledger: Sonnet entre ~0,15 y ~1,0 USD-eq por ejecución (Researcher
  > medio ~0,35; Revisor 0,25–0,8) y el Arquitecto con Opus ~0,9–1,1 (`budgets.yaml`: «~0.89 USD per
  > finished task»; tope de 1,50 por ejecución). Presupuesto: 200 USD-eq al mes, **185 ya asignados y
  > 15 libres** (el Researcher subió a 50 el 2026-10-21 con lo que quedaba sin asignar). Los
  > evals de ADR-0016 son gasto **real** aparte: el último experimento del Revisor, con 21 casos,
  > costó 2,25–2,31 USD (~0,11 por caso), con un tope de 15 por experimento y 40 al mes.
  >
  > **a) Frecuencia.**
  > - **F1. Semanal** (una noche fija, por ejemplo el domingo). ~4–5 pasadas al mes, previsible.
  > - **F2. Mensual.** Casi gratis, pero un mal prompt vive hasta cuatro semanas, y la sección 1
  >   dice justo que los fallos «se ven tarde».
  > - **F3. Semanal con umbral, decidido por código sin modelo:** el retro solo se lanza si desde la
  >   última pasada hay al menos 3 señales (fallo, `review:changes` o defecto escapado). Con el ritmo de
  >   octubre (~6 por semana) se habría lanzado todas las semanas, así que cuesta lo mismo que F1; solo
  >   ahorra en semanas tranquilas.
  >
  > **Recomendación: F3**, con umbral 3. Hace lo mismo que F1 hoy y no gasta si la factoría va bien.
  >
  > **b) Modelo.**
  > - **M1. Sonnet** (`default_model`). ~0,6–1,0 USD-eq por pasada.
  > - **M2. Opus**, como el Arquitecto y el diseñador. ~1,2–1,5 por pasada (el doble por token;
  >   el tope de 1,50 lo puede cortar).
  > - **M3. Sonnet al principio y Opus si las propuestas no pasan `eval-run.ts`.** Es M1 con una
  >   salida; añade una regla más a mantener.
  >
  > **Recomendación: M1 para empezar.** Toda propuesta pasa por `eval-run.ts` y la fusiona una
  > persona (RF-10), así que el riesgo de un mal retro es bajo y lo caro del Opus no compensa aún.
  > Pasar a M2 tras las primeras cuatro propuestas si más de la mitad no pasan el eval.
  >
  > **c) Topes propuestos en `factory/budgets.yaml`** (según RNF-2, lo escribe una persona):
  >
  > | Clave | M1 (Sonnet) | M2 (Opus) |
  > |---|---|---|
  > | `max_runs_per_day` | 1 | 1 |
  > | `max_usd_per_run` | 1,00 | 1,50 |
  > | `max_turns_per_run` | 30 | 30 |
  > | `max_usd_per_period` (mensual) | 6 | 10 |
  > | `network` | false | false |
  >
  > **Coste frente al presupuesto.**
  >
  > | Opción | USD-eq/mes (4–5 pasadas) | % de los 200 | Cabe en los 15 sin asignar |
  > |---|---|---|---|
  > | F1/F3 + M1 | ~2,5–5 | 1,3–2,5 % | sí |
  > | F1/F3 + M2 | ~5–7,5 | 2,5–3,8 % | sí |
  > | F2 + M2 | ~1,5 | 0,8 % | sí |
  >
  > Aparte, gasto real de evals: cada propuesta exige `eval-run.ts` (~2,3 USD con el dataset actual de
  > 21 casos; el doble si hay que repetir la línea base). Con una propuesta por semana, ~10–20 USD al
  > mes de los 40 de `evals.max_usd_per_month`. Es el coste dominante, no el del retro.
  >
  > **Dos dependencias que esta propuesta no resuelve** (son del Arquitecto, no de un PRD):
  > 1. **Escritura.** RF-10 pide proponer cambios en `.claude/agents/*.md` y en las skills, pero
  >    ADR-0002 y `guard_paths.ts` impiden a un agente escribir en `.claude/`. Hay que decidir una
  >    excepción acotada de `write_paths` para el retro o que lo abra una persona. Mi sugerencia: no
  >    tocar la barrera (RNF-3) y que el retro proponga el cambio como texto en una PR de
  >    `docs/bitacora/` o como issue, y lo aplique una persona. Eso cambiaría RF-10 y CA-13, y no lo
  >    hago aquí.
  > 2. **Dataset.** El único dataset de ADR-0016 es el del Revisor. Para un cambio en el prompt del
  >    developer o del Researcher no hay `eval-run.ts` que adjuntar; hasta que existan sus casos, el
  >    retro solo podría cumplir RF-10 con propuestas sobre el Revisor.
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
| 2026-10-26 | Aceptada la ADR-0020: OPEN-2 resuelta. Una PR de datos sin ningún valor comprobable (403, `robots.txt`) se sigue fusionando sola y se mide con RF-1. Sin cambios en RF ni CA. | responsable + Claude |
| 2026-10-28 | Propuestas de respuesta, sin cerrar, para OPEN-1 (N, tipo de cambio y estado de la escalera) y OPEN-4 (frecuencia, modelo y topes del retro), con los datos de octubre y tres alternativas cada una. Decide la persona al revisar la PR. Sin cambios en RF ni CA. | Claude |
| 2026-10-28 | OPEN-1 y OPEN-4 resueltas por el responsable. RF-9: N = 5, tipo = agente + primer nivel de ruta, solo `web/` de momento, estado en `ops/trust/`. RF-10 y CA-13: el retro propone como texto y no escribe en `.claude/`; semanal con umbral de 3 señales, Sonnet, 1 USD-eq por ejecución y 6 al mes. Hace falta enmendar ADR-0011 y ADR-0013 (Arquitecto). | responsable + Claude |
