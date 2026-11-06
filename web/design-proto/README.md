# Prototipos de diseño (ADR-0024)

Cada `<pantalla>.astro` de esta carpeta se ve en `/proto/<pantalla>/` y solo existe con `DESIGN_PROTO=1`: nunca
se publica. Es desechable: lo borra la historia que lo implementa.

```bash
node web/scripts/design-shot.ts <pantalla>   # docs/design/refs/<pantalla>-390.png y -1280.png
```

## Reglas
- **Datos reales.** Se leen con `loadModels()` de `src/lib/data.ts`; nunca se escriben a mano (ADR-0001). Elige
  los que pongan a prueba el diseño: nombre largo, sin foto, sin precio. La captura se corta a 2400 px de alto: a 390 px
  caben unas cuatro tarjetas, así que pon primero los casos difíciles o usa menos modelos.
- **Componentes reales.** Se importan de `../src/components/` y se reproducen aquí solo los que cambian.
- **Textos reales.** Las claves de `src/lib/i18n.ts`; los textos nuevos se proponen en la especificación.
- **Tokens.** Cada prototipo puede sobrescribirlos para sí mismo, con lo que se propone una dirección sin tocar
  `global.css`. Los tokens nuevos se añaden también en `docs/design/tokens.md`, con su contraste:
  ```astro
  <style is:global>
    :root { --color-brand-600: #0b5cad; }
  </style>
  ```
- **Fuentes.** Solo las que ya estén en esta carpeta, con su licencia. El Diseñador no tiene red.
- **Varias propuestas.** Un fichero por propuesta: `catalogo-a.astro`, `catalogo-b.astro`.
- **Sin JavaScript nuevo** salvo el que ya traigan los componentes (ADR-0003).
