# ADR-0001 — Fuentes de datos de modelos, precios e imágenes

- **Estado:** aceptada. Enmendada el 2026-10-06 (#164) y el 2026-10-20 (ADR-0017). Enmienda
  propuesta por [ADR-0021](0021-segmento-editorial.md) (2026-10-27): regla 8 nueva, el segmento
  puede ser una clasificación editorial (`tier: E`) escrita solo por una persona
- **Fecha:** 2026-09-19

## Contexto
La web necesita datos fiables de modelos, especificaciones, precios e imágenes de coches eléctricos comercializados o anunciados en Europa, con foco en España. Nadie los va a revisar a mano, así que la calidad de la fuente es el principal control.

## Decisión
Un agente **Researcher** mantiene un **registro de fuentes** (un fichero por fuente, `data/sources/<id>.yaml`; forma en [data-model.md, sección 8](../data-model.md)) y es el único que obtiene **datos del producto** de fuera: marcas, modelos, especificaciones, precios e imágenes. Otro agente puede salir a internet para investigación técnica (documentación de herramientas, por ejemplo), pero nada de lo que traiga entra en `data/` ni se publica como dato de un coche.

### Jerarquía de fiabilidad
| Nivel | Tipo de fuente | Uso |
|---|---|---|
| **T1** | Web oficial de la marca en España (configurador, lista de precios, ficha técnica) y sala de prensa oficial | Fuente preferente para precio, specs e imágenes |
| **T2** | Web oficial de la marca en otro país europeo o a nivel europeo; documentación de homologación; organismos de pruebas independientes (enmienda 2026-10-20) | Specs, y modelos aún no disponibles en España; resultados de pruebas y enlaces a ellas (ADR-0017) |
| **T3** | Medios del motor reconocidos, bases de datos especializadas | Solo para confirmar datos o para anuncios. Nunca como única fuente de precio. Fuente de los enlaces a sus propias reviews (enmienda 2026-10-20, ADR-0017) |

### Reglas
1. **Precio:** PVP oficial de la marca en España, **sin ayudas** (sin Plan MOVES ni otros incentivos). Solo desde T1.
   - Si la marca **no publica un PVP limpio** y el único precio visible va ligado a una oferta (descuento de marca o concesionario, bonificación por financiar, condiciones de permanencia), ese precio **sí se guarda**, marcado como `price_kind: financed`, junto con el **texto literal de las condiciones** (`price_terms`) y la URL donde aparecen (`price_terms_url`). La web muestra ese texto: es lo que permite al visitante entender por qué el precio es más bajo de lo que pagaría.
   - Un precio financiado **nunca se guarda como si fuera PVP**. `price_kind` es obligatorio siempre: `pvp` o `financed`.
   - Si no hay ni PVP ni precio financiado de una T1, el campo queda vacío.
2. Cada valor guarda: `source_id`, `url` (la URL exacta), `retrieved` (fecha de consulta, `YYYY-MM-DD`) y `tier`. Los nombres son esos: el eval de ADR-0004 los comprueba tal cual.
3. Si dos fuentes discrepan, prevalece el nivel más alto. Si discrepan dos del mismo nivel, se marca `needs_review` y no se publica.
4. Los **modelos anunciados** se registran con estado `announced` y, si existe, la fecha prevista de lanzamiento.
5. **Imágenes:** preferir la sala de prensa oficial. Se guarda la licencia o los términos de uso y la atribución exigida. Sin licencia registrada, no se publica.
6. Se respeta `robots.txt` y los términos de uso de cada web. No se evitan protecciones de acceso.
7. Ningún dato se inventa ni se estima: si no hay fuente, el campo queda vacío.

## Consecuencias
- La cobertura inicial puede ser menor, a cambio de datos trazables.
- El registro de fuentes es un artefacto versionado que crece con el tiempo.
- Hará falta revisar periódicamente precios y URLs rotas (frecuencia por decidir).
- **Enmienda 2026-10-06 (#164):** el registro pasa de una lista única (`data/sources/registry.yaml`) a un
  fichero por fuente (`data/sources/<id>.yaml`) para que dos PR que dan de alta fuentes distintas no
  choquen al fusionarse. Solo cambia la ruta; la decisión es la misma. Motivo, alternativas y forma
  de cada fichero en [data-model.md, sección 8](../data-model.md).
- **Enmienda 2026-10-20 ([ADR-0017](0017-esquema-de-las-reviews.md)):** para las reviews de PRD-006,
  T2 incluye a los organismos de pruebas independientes (miden con un protocolo publicado, como la
  homologación), y un medio T3 puede ser la fuente de un enlace a su propia review. «Solo para
  confirmar» sigue valiendo para los valores que compiten con los de la marca; un enlace no compite
  con ninguno. No hay nivel nuevo: el eval sigue aceptando solo T1, T2 y T3. La regla 6 (términos de
  uso) es la que decide si un medio u organismo se puede enlazar.
