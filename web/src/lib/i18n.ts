/**
 * Spanish messages, keyed for i18n (RNF-4). Keys follow docs/design/paginas-catalogo.md and
 * docs/design/tarjeta-modelo.md. Components receive already-composed strings, never fixed text.
 */
export const es = {
  "sitio.nombre": "", // not decided yet (paginas-catalogo.md, open question 3)
  "pagina.tituloDocumento": "{titulo} · {sitio}",
  "pagina.saltar": "Saltar a los resultados",
  "pagina.coches.titulo": "Coches eléctricos",
  "pagina.coches.entrada":
    "Todos los modelos eléctricos del mercado español: los que están a la venta, los anunciados y los descatalogados. Precio de la marca en España sin ayudas y autonomía WLTP.",
  "pagina.marca.titulo": "Coches eléctricos {marca}",
  "pagina.marca.entrada":
    "Los modelos eléctricos de {marca} en España, a la venta, anunciados y descatalogados, con su precio desde sin ayudas y su autonomía WLTP.",
  "vacio.pagina.texto": "Ahora mismo no hay ningún modelo en este tramo.",
  "resumen.cero": "Ningún modelo",
  "resumen.uno": "1 modelo",
  "resumen.n": "{n} modelos",
  "resultados.titulo": "Modelos",
  "vacio.catalogo.texto": "Todavía no hay ningún modelo en el catálogo.",
  "tarjeta.etiqueta.precio": "Precio desde",
  "tarjeta.etiqueta.autonomia": "Autonomía WLTP máxima",
  "tarjeta.etiqueta.segmento": "Segmento",
  "tarjeta.precio": "Desde {precio}",
  "tarjeta.precioPendiente": "Precio por confirmar",
  "tarjeta.autonomia": "Hasta {km} km WLTP",
  "tarjeta.autonomiaPendiente": "Autonomía por confirmar",
  "tarjeta.segmentoPendiente": "Segmento por confirmar",
  "tarjeta.estado.proximamente": "Próximamente",
  "tarjeta.estado.proximamenteFecha": "Próximamente · {fecha}",
  "tarjeta.estado.descatalogado": "Descatalogado",
  "tarjeta.oferta": "Precio con oferta",
  "filtros.titulo": "Filtros",
  "filtros.abrir": "Filtros ({n})",
  "filtros.marca": "Marca",
  "filtros.segmento": "Segmento",
  "filtros.precio": "Precio",
  "filtros.autonomia": "Autonomía mínima (WLTP)",
  "filtros.traccion": "Tracción",
  "filtros.estado": "Estado",
  "filtros.precioDesde": "Desde (€)",
  "filtros.precioHasta": "Hasta (€)",
  "filtros.limpiar": "Limpiar filtros",
  "filtros.verModelos": "Ver {n} modelos",
  "filtros.sinJs":
    "Para filtrar el catálogo hace falta activar JavaScript. Mientras tanto, explora por marca, segmento, precio o autonomía.",
  "filtros.traccionAyuda": "Solo cuentan los modelos con este dato publicado",
  "filtros.errorRango": "El precio mínimo no puede ser mayor que el máximo",
  "filtros.quitar": "Quitar filtro: {filtro}",
  "filtros.activos": "Filtros activos",
  "filtros.autonomiaCualquiera": "Cualquiera",
  "filtros.autonomiaMin": "{km} km",
  "filtros.chipAutonomia": "Autonomía ≥ {km} km",
  "filtros.chipDesde": "Desde {precio} €",
  "filtros.chipHasta": "Hasta {precio} €",
  "vacio.titulo": "Ningún modelo cumple los filtros",
  "vacio.texto": "Prueba a ampliar el precio o a quitar algún filtro.",
  "estado.todos": "Todos",
  "estado.venta": "A la venta",
  "estado.proximamente": "Próximamente",
  "estado.descatalogado": "Descatalogado",
  "traccion.fwd": "Delantera",
  "traccion.rwd": "Trasera",
  "traccion.awd": "Total",
  "segmento.urbano": "Urbano",
  "segmento.compacto": "Compacto",
  "segmento.berlina": "Berlina",
  "segmento.familiar": "Familiar",
  "segmento.suv_pequeno": "SUV pequeño",
  "segmento.suv_compacto": "SUV compacto",
  "segmento.suv_grande": "SUV grande",
  "segmento.monovolumen": "Monovolumen",
  "segmento.furgoneta": "Furgoneta",
  "segmento.deportivo": "Deportivo",
} as const;

export type MessageKey = keyof typeof es;
export type Vars = Record<string, string | number>;

/** Looks up a key and fills `{name}` placeholders. */
export function t(key: MessageKey, vars: Vars = {}): string {
  return es[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}
