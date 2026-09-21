# Flujo de trabajo

1. **PRD:** se redacta en `docs/product/prd/` con `status: draft`.
2. **Revisión:** cuando no quedan preguntas abiertas bloqueantes, pasa a `status: ready`.
3. **Épica:** se crea un issue de tipo *Épica* en GitHub y se enlaza en el campo `epic` del PRD.
4. **Historias:** se trocea en issues de tipo *Historia*, cada uno citando los `RF`/`CA` que cubre. Una historia tiene que caber en un solo PR.
5. **Ejecución:** un agente toma una historia, crea la rama `story/<issue>-<slug>` y abre un PR que referencia el issue.
6. **Verificación:** el PR cumple `definition-of-done.md`.
7. **Cierre:** al cerrar todas las historias, el PRD pasa a `status: done` y se actualiza el índice en `docs/README.md`.

Cualquier cambio de alcance se hace **primero en el PRD** (con entrada en su historial) y después en el código.
