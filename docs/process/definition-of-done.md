# Definition of Done

Una historia está terminada cuando:

- [ ] Cada `CA` citado en el issue tiene al menos un test automatizado que pasa.
- [ ] La CI está en verde (lint, tipos, tests, build).
- [ ] No se añade almacenamiento de datos personales ni cookies no esenciales.
- [ ] La documentación afectada está actualizada (PRD, data-model, ADR).
- [ ] El PR referencia el issue y enumera los `RF`/`CA` cubiertos.
- [ ] Si la historia cita una referencia de `docs/design/refs/`, la página se parece a ella (las diferencias se
  explican en la PR) y el prototipo de `web/design-proto/` está borrado (ADR-0024).
- [ ] Si arregla un fallo de una PR ya fusionada, su título empieza por `fix` y cita esa PR (`#N`):
  así cuenta como defecto escapado en las métricas (ADR-0019).
