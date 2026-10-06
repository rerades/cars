# data/

- `sources/<id>.yaml`: registro de fuentes fiables, un fichero por fuente (lo mantiene el agente Researcher;
  forma en `docs/architecture/data-model.md`, sección 8).
- `candidatas.yaml`: mapa de marcas por registrar. No es una fuente.
- `raw/<marca>/<modelo>.yaml`: datos obtenidos, cada valor con su fuente, URL, fecha y nivel.

Reglas: `docs/architecture/adr/0001-fuentes-de-datos.md`.
