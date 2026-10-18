# Bienvenido a Dark Factory

## Cómo usamos Claude

Según el uso de rerades en los últimos 30 días:

Tipos de trabajo:

```text
  Mejorar la calidad      ███████░░░░░░░░░░░░░  35%
  Construir funciones     █████░░░░░░░░░░░░░░░  25%
  Depurar y corregir      ████░░░░░░░░░░░░░░░░  20%
  Planificar y diseñar    ███░░░░░░░░░░░░░░░░░  15%
  Escribir documentación  █░░░░░░░░░░░░░░░░░░░   5%
```

Skills y comandos más usados:

```text
  /issues          ████████████████████  7 al mes
  /plugin          █████████████████░░░  6 al mes
  /goal            █████████░░░░░░░░░░░  3 al mes
  /clear           █████████░░░░░░░░░░░  3 al mes
  /guided-mr       ██████░░░░░░░░░░░░░░  2 al mes
  /compact         ██████░░░░░░░░░░░░░░  2 al mes
```

Servidores MCP más usados:

```text
  context-mode     ████████████████████  117 llamadas
  claude-in-chrome ████░░░░░░░░░░░░░░░░  22 llamadas
  render           ███░░░░░░░░░░░░░░░░░  16 llamadas
  langfuse         ██░░░░░░░░░░░░░░░░░░  10 llamadas
  autoharness      █░░░░░░░░░░░░░░░░░░░  8 llamadas
  Google Calendar  █░░░░░░░░░░░░░░░░░░░  2 llamadas
  Gmail            █░░░░░░░░░░░░░░░░░░░  2 llamadas
```

## Lista de puesta en marcha

### Repositorios
- [ ] cars — https://github.com/rerades/cars (Node >= 24 y pnpm: `pnpm install` y después `pnpm test && pnpm run typecheck`)

### Servidores MCP que activar
- [ ] context-mode — ejecuta comandos y análisis en un sandbox para que las salidas grandes no llenen el contexto. Se instala con `/plugin`.
- [ ] claude-in-chrome — maneja tu Chrome para revisar siete3.com y otras páginas. Instala la extensión Claude in Chrome y actívala en Claude Code.
- [ ] render — consulta el static site, los despliegues y los logs de Render (siete3.com). Necesita una API key de Render que da el dueño de la cuenta; añade el servidor MCP de Render.
- [ ] langfuse — lee las trazas, puntuaciones y evals de los agentes (ADR-0004). Pide las claves del proyecto de Langfuse Cloud y añade el servidor MCP de Langfuse.
- [ ] autoharness — convierte las sesiones terminadas en skills reutilizables (`/autoharness:learn`). Se instala con `/plugin`.
- [ ] Google Calendar y Gmail — solo para el resumen de `/morning`. Se conectan como conectores de claude.ai.

### Skills que conviene conocer
- /issues — trabaja las issues abiertas de GitHub, de la más antigua a la más nueva, con una PR por issue.
- /plugin — instala, actualiza o quita plugins (context-mode, autoharness, etc.).
- /goal — fija un objetivo para la sesión y Claude sigue hasta cumplirlo.
- /guided-mr — recorrido guiado por una pull request antes de fusionarla.
- /clear y /compact — vacían o comprimen el contexto entre tareas que no tienen que ver.
- /anthropic-skills:morning — resumen de la mañana en una página: calendario, correo y estado de la factoría.

## Consejos del equipo

_Por completar_

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
