---
status: draft
updated: 2026-09-19
---

# Modelo de datos (borrador)

```
Marca 1───* Modelo 1───* Versión *───* Mercado
                              │
                              └──* Precio (por mercado, con fecha)
Cualquier dato de especificación ──> Fuente (url, fecha)
```

| Entidad | Campos clave |
|---|---|
| Marca | id, slug, nombre, país de origen, logo |
| Modelo | id, slug, marca_id, nombre, segmento, carrocería, año de lanzamiento, estado (a la venta / anunciado / descatalogado) |
| Versión | id, modelo_id, nombre, batería útil (kWh), autonomía WLTP (km), potencia (kW), tracción, carga AC/DC máx. (kW) |
| Mercado | código de país (ES, FR, DE…) |
| Precio | versión_id, mercado, importe, moneda, `price_kind` (`pvp` \| `financed`), `price_terms` (texto literal de las condiciones, solo si es `financed`), `price_terms_url`, fecha, fuente |
| Fuente | url, nombre, fecha de consulta |
