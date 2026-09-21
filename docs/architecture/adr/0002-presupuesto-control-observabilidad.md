# ADR-0002 — Presupuesto, control de acciones y observabilidad de agentes

- **Estado:** aceptada
- **Fecha:** 2026-09-19 (revisada el mismo día: fase 1 con suscripción)

## Contexto
La factoría funciona sin intervención humana. Hay que poder asegurar tres cosas desde el primer día:
1. Ningún agente gasta más de lo asignado.
2. Ningún agente hace algo fuera de su rol.
3. Se puede reconstruir qué hizo cada agente, cuánto costó y con qué resultado.

## Decisión
Control en **tres capas**, de la más dura a la más blanda.

### 1. Presupuesto (`factory/budgets.yaml`)

Hay dos modos de facturación. El diseño es el mismo en ambos; solo cambia de dónde sale la credencial y qué capa es la dura.

#### Fase 1 (actual): suscripción Claude Pro
`claude -p` y el Agent SDK consumen de los límites de uso de la suscripción (ventanas de 5 h y tope semanal). Es la **misma bolsa** que el uso interactivo del propietario. No hay límite duro por agente en el proveedor.

| Nivel | Mecanismo | Qué protege |
|---|---|---|
| **Orquestador (principal)** | Límite de **ejecuciones por día** (global y por agente) y **presupuesto mensual en USD-equivalentes** leído del ledger. No lanza nada si se ha superado | Que la factoría agote la cuota de la suscripción |
| **Ejecución** | `claude -p --max-budget-usd <n> --max-turns <n>`. En suscripción el USD es un **coste equivalente estimado**, no gasto real, pero sigue cortando la tarea | Que una tarea se descontrole |
| **Ventana de uso** | Si una ejecución termina por límite de uso de la suscripción, el orquestador registra `outcome: rate_limited` y **pausa la factoría hasta la siguiente ventana**, sin reintentar en bucle | No martillear la cuota |
| **Proveedor** | Los límites del propio plan (5 h / semanal) | Techo absoluto, compartido con el uso personal |

Consideraciones del plan Pro (según fuentes de terceros, a verificar con el ledger): unos ~45 prompts por ventana de 5 h y acceso a Sonnet en Claude Code. Una tarea autónoma de 20-30 turnos puede consumir una parte importante de una ventana, así que los límites son bajos a propósito:
- Máximo **6 ejecuciones al día** en total. Por agente: Researcher 2, Developer 2, Reviewer 2, resto 1.
- Turnos por tarea: 15-30 según el rol.
- Modelo por defecto: Sonnet.

Reglas adicionales en fase 1:
- **Una sola ejecución a la vez** (sin paralelismo) para que el consumo sea predecible.
- **Horario nocturno: solo se lanzan tareas entre 01:00 y 07:00 (Europe/Madrid).** Una tarea que sigue en curso a las 07:00 termina; no se lanzan nuevas.

#### Fase 2 (futura): API de pago por tokens
Se pasa a la fase 2 cuando ocurra cualquiera de estas cosas: la factoría funciona de forma continua, hace falta aislar el gasto por agente, la fase 1 interfiere con el uso personal, o Anthropic cambia la política de uso del Agent SDK con suscripción.

| Nivel | Mecanismo |
|---|---|
| **Proveedor (duro)** | Un **workspace de Anthropic por agente** con su clave y límite de gasto |
| **Ejecución** | `--max-budget-usd` (ahora gasto real) y `--max-turns` |
| **Orquestador** | Presupuesto por periodo contra el ledger |

El cambio es solo de configuración: `billing.mode` en `factory/budgets.yaml` y una variable de entorno con la clave de cada agente.

### 2. Control de acciones
- **Herramientas por rol:** cada agente declara sus `tools` en `.claude/agents/<rol>.md`. Lo que no está declarado no existe para él.
- **Rutas de escritura por rol** (`factory/budgets.yaml` → `write_paths`), comprobadas por un hook `PreToolUse` que bloquea escrituras fuera de ellas.
- **Reglas de denegación globales:** push a `main`, borrado masivo, modificar `factory/` o `.claude/`, leer secretos.
- **Todo cambio entra por PR.** Ningún agente hace merge sin CI en verde.
- **Interruptor de parada:** si existe `factory/STOP`, el orquestador no lanza tareas nuevas.

### 3. Observabilidad
- **Ledger de ejecuciones** (`ops/runs/YYYY-MM.jsonl`): una línea por ejecución, escrita por el orquestador o por un hook `Stop`. Es la fuente de verdad del gasto y va versionada en Git.
  ```json
  {"run_id":"...","agent":"researcher","task":"#14","started":"...","ended":"...",
   "cost_usd":0.42,"cost_kind":"estimated|billed","turns":18,"tokens_in":0,"tokens_out":0,
   "outcome":"success|failed|budget_exceeded|rate_limited|blocked","pr":"#21"}
  ```
- **Log de acciones:** hooks `PreToolUse` y `PostToolUse` registran cada herramienta usada, con sus argumentos resumidos y si se permitió o se bloqueó.
- **Trazas detalladas:** telemetría OpenTelemetry de Claude Code (coste, tokens, uso de herramientas) enviada a **Langfuse** (open source, se puede autoalojar gratis) u otro backend OTel.
- **Trazabilidad de punta a punta:** `run_id` ↔ issue ↔ PR ↔ commits (el `run_id` va en el mensaje de commit).

## Consecuencias
- Fase 1 no tiene coste adicional, pero comparte cuota con el uso personal y depende de una política que Anthropic puede cambiar.
- Los USD del ledger en fase 1 son equivalentes. Sirven para comparar agentes y estimar lo que costaría la fase 2.
- El orquestador vive en `factory/run.py` y `factory/orchestrator.py`; los hooks en `.claude/hooks/`. La cola de tareas (`--next`) está pendiente: por ahora cada tarea se lanza a mano.
- Los límites iniciales son conservadores y se ajustarán con los datos del ledger.

## Decisiones tomadas (2026-09-19)
- **Motor:** Claude Code / Claude Agent SDK.
- **Facturación:** fase 1 con la suscripción Claude **Pro** del propietario.
- **Horario:** ejecución nocturna, 01:00-07:00 Europe/Madrid.
- **Máquina de ejecución:** el Mac del propietario, que funciona como servidor siempre encendido (`caffeinate`). El orquestador se programa con `launchd` (LaunchAgent), que en macOS se prefiere a cron: si la máquina estuvo dormida, ejecuta la tarea programada al despertar. La sesión de Claude Code de esa máquina está autenticada con la suscripción Pro.
- **Presupuesto de referencia:** 20 USD-equivalentes/mes para toda la factoría. Reparto en `factory/budgets.yaml`.

## Pendiente
- Validar los límites de Pro con datos reales del ledger tras la primera semana.
- Langfuse en la nube (plan gratuito) o autoalojado.

## Referencias
- [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan): la situación a 2026-09-19 es que el Agent SDK y `claude -p` consumen de la suscripción, y los cambios planeados están pausados desde el 2026-06-15.
- [Claude Code Usage Limits (2026), morphllm](https://www.morphllm.com/claude-code-usage-limits): fuente de terceros sobre los límites de Pro.
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference): `--max-budget-usd`, `--max-turns`.
