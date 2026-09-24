# ADR-0004 — Trazas y autoevaluaciones de los agentes

- **Estado:** aceptada
- **Fecha:** 2026-09-23

## Contexto
Hasta ahora el orquestador lanzaba `claude -p --output-format json`, que solo devuelve el
resultado final: no se veía qué hizo el agente paso a paso. Además, el log de acciones del hook
`log_action.ts` se escribía dentro del worktree de la ejecución, que se borra al terminar, así que
se perdía. Tampoco había ninguna comprobación automática de lo que produce el agente antes de abrir
su PR.

La condición es empezar por algo sencillo y **sin coste**.

## Opciones consideradas
- **LangChain / LangSmith:** LangChain es un framework para construir agentes, no una herramienta
  de observabilidad, y aquí el motor es Claude Code. LangSmith es un servicio cerrado. Descartado.
- **Langfuse autoalojado:** open source, pero la v3 necesita Postgres, ClickHouse, Redis y un
  almacén S3 en Docker. Es demasiado para el Mac que hace de servidor. Descartado por ahora.
- **Langfuse Cloud (plan Hobby gratuito):** buena interfaz para trazas, puntuaciones y datasets.
  Como la web no guarda datos personales, no hay problema en mandar trazas fuera. Se deja para el
  paso 2.
- **OpenTelemetry de Claude Code:** emite métricas y eventos, pero no un árbol de trazas por
  ejecución. Habría que montar un colector. Descartado para el paso 1.
- **Ficheros JSONL locales + evals en TypeScript:** no necesita dependencias nuevas ni
  servicios. **Elegida.**

## Decisión
### Trazas
- El orquestador lanza `claude -p --output-format stream-json --verbose` y guarda stdout tal cual
  en `ops/traces/<run_id>.jsonl`, en el repositorio principal y no en el worktree. Hay un evento por
  línea: texto del agente, llamadas a herramientas, resultados y errores, uso de tokens y el evento
  `result` final.
- `ops/traces/` **no se versiona**, porque pesa y contiene contenido de webs de terceros. La
  fuente de verdad sigue siendo el ledger (`ops/runs/`), que ahora añade `session_id`,
  `tokens_in` (incluida la caché) y `tokens_out`.
- `node factory/run.ts --trace <run_id>` muestra la traza resumida, con una línea por paso.
- El log de acciones pasa a escribirse en `ops/actions/` del repositorio principal
  (`FACTORY_LOG_DIR`).

### Autoevaluaciones (evals)
- `factory/evals.ts` define comprobaciones **deterministas** por agente. Se ejecutan sobre los
  ficheros que el agente creó o modificó, antes de hacer el commit de su rama.
- Para todos los agentes se comprueba que solo escribió dentro de sus `write_paths`.
- Para el Researcher se comprueba ADR-0001:
  - El registro de fuentes tiene `id`, `tier` T1/T2/T3, `urls` y un `last_verified` con una fecha
    que no es futura.
  - En `data/raw/`, todo valor lleva `source_id` (que existe en el registro), `url`, `retrieved` y `tier`.
- El resultado va al ledger (`evals: {passed, failed}`). Si falla alguna comprobación, `outcome`
  pasa a `eval_failed` y **no se abre la PR**: la rama se queda en local, igual que cuando la
  ejecución falla.
- `run.ts --status` muestra, por agente, cuántas ejecuciones del periodo han pasado los evals.

### Descartado por ahora: LLM como juez
Usar un `claude -p` que puntúe el resultado gasta cuota de Pro. Además, mientras el único agente
en marcha sea el Researcher, sus reglas se comprueban con código. Se retomará cuando haya agentes
que escriban texto libre (Product, Reviewer).

## Consecuencias
- Coste cero: no hay dependencias ni servicios nuevos.
- Las trazas solo existen en la máquina que ejecuta la factoría. Si se pierde esa máquina, se
  pierden las trazas, pero no el ledger.
- Los evals solo validan la forma de los datos y que tengan fuente. No comprueban que el dato sea
  cierto: para eso sigue haciendo falta revisar la PR.
- **Paso 2:** hecho el 2026-09-23. Ver la sección *Langfuse Cloud* más abajo.

## Langfuse Cloud (paso 2, 2026-09-23)
Cada ejecución se manda también a **Langfuse Cloud**, con el plan Hobby gratuito: 50 000 unidades
al mes y 30 días de datos. Una ejecución genera unas decenas de unidades, así que queda muy por
debajo del límite. La región es la UE (`cloud.langfuse.com`).

- **Por qué OpenTelemetry y no la API de ingesta:** la API de ingesta clásica
  (`/api/public/ingestion`) está obsoleta y deja de funcionar en Langfuse Cloud el
  **2026-11-16**. `factory/langfuse.ts` construye el cuerpo OTLP/HTTP en JSON a mano y lo manda
  con `fetch` a `/api/public/otel/v1/traces`, con la cabecera `x-langfuse-ingestion-version: 4`.
  No usa ni el SDK ni dependencias nuevas.
- **Forma de la traza:** un span raíz `agent` (tarea, resultado, outcome, coste, rama, PR), una
  `generation` por llamada al modelo (modelo y tokens) y un span `tool` por herramienta (entrada,
  salida y error). Las horas salen de los `timestamp` de `stream-json`. Los atributos de la traza
  (nombre, etiquetas `[agente, outcome]`, `run_id`) se repiten en todos los spans, como pide
  Langfuse v4.
- **Evals:** se mandan como un score booleano `evals` a `/api/public/scores`, con los fallos en el
  comentario.
- **Idempotencia:** los ids de traza, span y score se derivan del `run_id`, así que reenviar una
  ejecución no la duplica.
- **Claves:** se guardan en `.secrets/langfuse.env` (`LANGFUSE_PUBLIC_KEY`,
  `LANGFUSE_SECRET_KEY` y, si hace falta, `LANGFUSE_BASE_URL`). Se leen en un objeto local y
  **no se meten en `process.env`**, así que los agentes no las heredan. Sin ese fichero no se
  envía nada.
- **Nunca rompe una ejecución:** si el envío falla, se escribe una línea en la salida y ya está. El
  ledger y `ops/traces/` siguen siendo la fuente de verdad. Langfuse es una vista, y en el plan
  gratuito solo guarda 30 días.
- **Qué sale de la máquina:** las tareas, los resultados y las entradas y salidas de las
  herramientas, recortadas a 4000 caracteres. Es contenido de webs públicas de marcas: no hay datos
  personales.
- **Reenvío:** `node factory/langfuse.ts [YYYY-MM]` manda todas las ejecuciones del mes. Las
  ejecuciones anteriores a ADR-0004 no tienen traza local y solo mandan el span raíz.
