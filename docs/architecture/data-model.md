---
status: accepted
updated: 2026-09-27
---

# Modelo de datos

Referencia del esquema de los ficheros `data/raw/<marca>/<modelo>.yaml`. La decisión y sus
alternativas están en [ADR-0008](adr/0008-esquema-unico-de-datos-raw.md) (propuesta): este
documento es vigente cuando esa ADR se acepte. Las reglas de fuente y de precio vienen de
[ADR-0001](adr/0001-fuentes-de-datos.md) y no se repiten aquí más que en su forma de campo.

```
Marca 1───* Modelo 1───* Versión
                          │
                          └── Precio (0..1, en España, con fecha y fuente)
Cualquier valor ──> fuente (source_id, url, retrieved, tier)
```

Alcance del esquema: **solo mercado España**. Las versiones de un fichero son las que se venden (o
se anuncian) en España; no hay campo `market`. Otros mercados serían otra decisión.

## 1. Convenciones

- **Una unidad por campo, la del sufijo del nombre**: `_kw`, `_km`, `_kwh`. No se escribe `unit` en
  esos valores. Nada de CV: si una fuente solo da CV, ver la regla de conversión en la sección 5.
- Decimales con punto; números sin separador de miles.
- **Claves en inglés, `snake_case`. Valores enumerados en minúsculas, `snake_case`.**
- **Ausente = sin fuente.** Un campo opcional sin dato se omite o vale `null`; nunca se rellena con
  una estimación (ADR-0001, regla 7). Lo que falta se anota en `open_questions`.
- **Claves desconocidas = error.** Solo valen las de este documento; una clave nueva exige cambiar
  este documento primero.
- Un comentario `#` en la primera línea (agente, fuente, fecha) es libre y no se valida.

## 2. Valor con fuente (`Sourced`)

Todo dato de un coche va en este formato, en línea o en bloque:

| Clave | Tipo | Obligatoria | Nota |
|---|---|---|---|
| `value` | según el campo | sí | Tipo y unidad los fija el campo (secciones 3 y 4) |
| `source_id` | texto | sí | Debe existir en `data/sources/registry.yaml` |
| `url` | URL | sí | La URL exacta donde se leyó |
| `retrieved` | `YYYY-MM-DD` | sí | Fecha de consulta; no futura |
| `tier` | `T1` \| `T2` \| `T3` | sí | El de la fuente en el registro |
| `note` | texto | no | Matiz del dato ("hasta 631 km, máximo de la gama") |

Son los cuatro nombres que ya comprueba el eval de ADR-0004, sin cambios. Solo dos campos añaden
claves propias: `basis` en `battery_kwh`, y `unit`, `price_kind`, `price_terms` y
`price_terms_url` en `price`.

## 3. Nivel de modelo

| Campo | Tipo / valores | Obligatorio | Necesario para |
|---|---|---|---|
| `brand` | slug (`cupra`); igual al nombre de la carpeta | sí | RF-2, RF-4 |
| `brand_name` | texto de presentación (`Cupra`); igual en todos los ficheros de la carpeta | sí | RF-1 |
| `model` | texto de presentación (`Born`). El fichero es `<slug de model>.yaml` | sí | RF-1 |
| `status` | `Sourced`; `value`: `on_sale` \| `announced` \| `discontinued` | sí | RF-2, RF-7 |
| `launch` | `Sourced`; `value`: texto `"YYYY-MM"` o `"YYYY-MM-DD"` (inicio de venta en España) | no | RF-3 (novedad), RF-7 |
| `segment` | `Sourced`; `value`: `urbano` \| `compacto` \| `berlina` \| `familiar` \| `suv_pequeno` \| `suv_compacto` \| `suv_grande` \| `monovolumen` \| `furgoneta` \| `deportivo` | no (ver nota) | RF-1, RF-2, RF-10, RF-11 |
| `needs_review` | booleano | sí | ADR-0001, regla 3 |
| `specs` | mapa de valores agregados del modelo (abajo) | no | RF-1, RF-2 |
| `versions` | lista de versiones (sección 4); puede ir vacía si `announced` | sí | todo |
| `images` | lista de imágenes (forma abajo); `[]` si no hay ninguna con licencia válida | sí | RF-8, CA-10, CA-17 |
| `open_questions` | lista de textos | no | — |

- `launch` es la fecha prevista si el estado es `announced` (ADR-0001, regla 4) y la de inicio de
  venta en España si es `on_sale`.
- **`segment` es obligatorio para publicar la tarjeta (RF-1), pero un fichero sin él es válido**:
  ninguna fuente de marca lo da de forma explícita. El Researcher lo rellena con la fuente que lo
  clasifique (puede ser T3, que ADR-0001 admite para confirmar datos) y, si no la hay, lo deja
  `null` y lo anota. Regla de asignación: el valor de la lista de RF-11 que use la fuente; un SUV o
  crossover va a `suv_pequeno`, `suv_compacto` o `suv_grande` según cómo lo presente. Sin segmento, la
  tarjeta dice "por confirmar" y el modelo no sale en ese filtro (RF-12).
- `status: discontinued` también se publica, con la etiqueta "Descatalogado" (RF-7).
- **Imagen:** `url`, `source_id`, `retrieved`, `license` (identificador, p. ej. `CC-BY-SA-4.0`, o URL
  de los términos) y `attribution` (texto que exige la licencia, o `null`). Sin `license` no se publica
  (CA-10). Orden de fuentes de PRD-001, RF-8: Wikimedia Commons con licencia que permita uso comercial;
  sala de prensa solo con términos escritos que lo permitan. Sin imagen, la web muestra la silueta del
  segmento (CA-17).
- `specs` solo recoge lo que la fuente publica **para el modelo entero** y no por versión. Campos
  permitidos: `wltp_max_km`, `power_max_kw`, `dc_max_kw`, `ac_max_kw`, `battery_kwh_options`
  (lista de números) y `drivetrains` (lista de valores de tracción). `specs` no lleva `unit`.

## 4. Nivel de versión

| Campo | Tipo / valores | Obligatorio | Necesario para |
|---|---|---|---|
| `name` | texto; único dentro del fichero | sí | RF-1 |
| `battery_kwh` | `Sourced`, número > 0; lleva además `basis`: `usable` \| `gross` \| `unknown` (obligatoria) | no | — |
| `wltp_km` | `Sourced`, entero > 0 | no | RF-1, RF-2, RF-3 |
| `power_kw` | `Sourced`, número > 0 | no | — |
| `drivetrain` | `Sourced`; `value`: `fwd` \| `rwd` \| `awd` | no | RF-2 |
| `dc_max_kw` | `Sourced`, número > 0 | no | — |
| `ac_max_kw` | `Sourced`, número > 0 | no | — |
| `price` | `Price` o `null` | **sí (clave obligatoria)** | RF-1, RF-2, RF-3, RF-9 |

`price: null` significa "hay versión pero ninguna T1 publica precio" (ADR-0001, regla 1). La clave
se escribe siempre para distinguir "no hay precio" de "no se miró".

### Precio (`Price`)

`Sourced` más:

| Clave | Valores | Obligatoria |
|---|---|---|
| `value` | número > 0; PVP en España con IVA, **sin ayudas** | sí |
| `unit` | `EUR` | sí |
| `price_kind` | `pvp` \| `financed` | sí, siempre |
| `price_terms` | texto literal de las condiciones | sí si `financed`; prohibida si `pvp` |
| `price_terms_url` | URL donde aparecen las condiciones | sí si `financed`; prohibida si `pvp` |

`tier` de un precio debe ser `T1` (ADR-0001, regla 1).

## 5. Cómo se derivan los datos del catálogo

- **Precio desde** = mínimo de `versions[].price.value` (incluye `financed`, RF-9). Sin ninguno:
  "Precio por confirmar".
- **Autonomía máxima** = máximo de `versions[].wltp_km`; si ninguna versión lo trae, `specs.wltp_max_km`.
  Si están los dos y no coinciden, el fichero no es válido.
- **Tracción del modelo** = conjunto de `versions[].drivetrain`; si ninguna, `specs.drivetrains`.
- **Estado y segmento** salen del nivel de modelo.
- **CV.** Si la fuente publica solo CV, se guarda `power_kw` = CV × 0,7355 redondeado al entero y
  `note: "publicado: 190 CV"`. Si publica ambos, vale el kW de la fuente.

## 6. Reglas comprobables

Lo que una comprobación automática tendrá que rechazar (la comprobación es trabajo posterior):

1. La ruta es `data/raw/<brand>/<slug>.yaml`, con `brand` igual a la carpeta.
2. Todas las claves obligatorias están y no hay claves fuera de este documento.
3. Todo `Sourced` cumple la sección 2; `source_id` está en el registro; `retrieved` no es futura.
4. Los valores enumerados están en su lista; los números son > 0 y `wltp_km` es entero.
5. `price`: `price_kind` presente; `financed` con `price_terms` y `price_terms_url`; `pvp` sin ellos;
   `unit: EUR`; `tier: T1`.
6. Los `name` de versión no se repiten. `status: on_sale` exige al menos una versión.
7. `brand_name` es igual en todos los ficheros de la misma carpeta.
8. `specs.wltp_max_km` coincide con el máximo de las versiones cuando las dos existen.
9. `unit` aparece solo en `price`; `basis` solo en `battery_kwh`.

## 7. Ejemplo completo

Ficticio (marca `acme`, fuente `acme-es`): sirve para ilustrar la forma, no es un dato de producto y
`acme-es` no está en el registro real.

```yaml
# Researcher — Acme Volta (ejemplo ficticio). Fuente: acme-es (T1). Consultado 2026-09-20.
brand: acme
brand_name: Acme
model: Volta
status: {value: on_sale, source_id: acme-es, url: "https://www.acme.example/es/volta", retrieved: 2026-09-20, tier: T1}
launch: {value: "2025-03", note: "inicio de venta en España", source_id: acme-es, url: "https://www.acme.example/es/prensa/volta", retrieved: 2026-09-20, tier: T1}
segment: {value: suv_compacto, note: "la web lo presenta como SUV compacto", source_id: acme-es, url: "https://www.acme.example/es/volta", retrieved: 2026-09-20, tier: T1}
needs_review: false
specs:
  wltp_max_km: {value: 520, note: "hasta 520 km", source_id: acme-es, url: "https://www.acme.example/es/volta", retrieved: 2026-09-20, tier: T1}
  dc_max_kw: {value: 150, source_id: acme-es, url: "https://www.acme.example/es/volta", retrieved: 2026-09-20, tier: T1}
versions:
  - name: Volta 60
    battery_kwh: {value: 60, basis: usable, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    wltp_km: {value: 470, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    power_kw: {value: 150, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    drivetrain: {value: rwd, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    price:
      value: 39990
      unit: EUR
      price_kind: pvp
      source_id: acme-es
      url: "https://www.acme.example/es/volta/precios"
      retrieved: 2026-09-20
      tier: T1
  - name: Volta 80 AWD
    battery_kwh: {value: 80, basis: gross, note: "la ficha da la capacidad bruta", source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    wltp_km: {value: 520, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    power_kw: {value: 220, note: "publicado: 299 CV", source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    drivetrain: {value: awd, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    dc_max_kw: {value: 150, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    price:
      value: 47500
      unit: EUR
      price_kind: financed
      price_terms: "PVP recomendado financiando en Península y Baleares de 47.500 € (IVA, transporte y descuento de marca incluidos). Crédito mínimo de 10.000 € con permanencia de 48 meses."
      price_terms_url: "https://www.acme.example/es/volta/ofertas"
      source_id: acme-es
      url: "https://www.acme.example/es/volta/ofertas"
      retrieved: 2026-09-20
      tier: T1
  - name: Volta GT
    wltp_km: {value: 490, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    drivetrain: {value: awd, source_id: acme-es, url: "https://www.acme.example/es/volta/ficha", retrieved: 2026-09-20, tier: T1}
    price: null   # ninguna fuente T1 publica precio para esta versión
images: []   # sin licencia registrada
open_questions:
  - "Volta GT: potencia y batería no publicadas en la ficha."
```

Un modelo anunciado se escribe igual, con `status.value: announced`, `launch` con la fecha prevista
(si la hay), `versions: []` o versiones con `price: null`.
