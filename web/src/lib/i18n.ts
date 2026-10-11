/**
 * Spanish messages, keyed for i18n (RNF-4). Keys follow docs/design/paginas-catalogo.md and
 * docs/design/tarjeta-modelo.md. Components receive already-composed strings, never fixed text.
 */
export const es = {
  "sitio.nombre": "siete3", // decided by the owner on 2026-10-06 (paginas-catalogo.md, question 3)
  "pagina.tituloDocumento": "{titulo} · {sitio}",
  "pagina.saltar": "Saltar a los resultados",
  "pagina.portada.tituloDocumento": "siete3 · Coches eléctricos en Europa y España",
  "pagina.portada.entrada":
    "Una referencia de los coches eléctricos que se venden en Europa, con foco en España. Para cada modelo, el precio de la marca en España sin ayudas y la autonomía WLTP, cada dato con su fuente y su fecha.",
  // Plural forms of `portada.contador`, picked with Intl.PluralRules (see homeCountLabel).
  "portada.contador.one": "{n} modelo en el catálogo",
  "portada.contador.other": "{n} modelos en el catálogo",
  "pagina.coches.titulo": "Coches eléctricos",
  "pagina.coches.entrada":
    "Todos los modelos eléctricos del mercado español: los que están a la venta, los anunciados y los descatalogados. Precio de la marca en España sin ayudas y autonomía WLTP.",
  "pagina.marca.titulo": "Coches eléctricos {marca}",
  "pagina.marca.entrada":
    "Los modelos eléctricos de {marca} en España, a la venta, anunciados y descatalogados, con su precio desde sin ayudas y su autonomía WLTP.",
  "pagina.segmento.urbano.titulo": "Coches eléctricos urbanos",
  "pagina.segmento.urbano.entrada": "Eléctricos pequeños, pensados sobre todo para moverse por ciudad.",
  "pagina.segmento.compacto.titulo": "Compactos eléctricos",
  "pagina.segmento.compacto.entrada": "Eléctricos de tamaño medio con carrocería de turismo, para ciudad y carretera.",
  "pagina.segmento.berlina.titulo": "Berlinas eléctricas",
  "pagina.segmento.berlina.entrada": "Eléctricos con carrocería de berlina, de tres volúmenes o de maletero largo.",
  "pagina.segmento.familiar.titulo": "Familiares eléctricos",
  "pagina.segmento.familiar.entrada":
    "Eléctricos con carrocería familiar, con más espacio de carga detrás de los asientos.",
  "pagina.segmento.suv_pequeno.titulo": "SUV pequeños eléctricos",
  "pagina.segmento.suv_pequeno.entrada":
    "SUV eléctricos de tamaño reducido, con la altura de un SUV y medidas de urbano.",
  "pagina.segmento.suv_compacto.titulo": "SUV compactos eléctricos",
  "pagina.segmento.suv_compacto.entrada": "SUV eléctricos de tamaño medio, entre el SUV pequeño y el grande.",
  "pagina.segmento.suv_grande.titulo": "SUV grandes eléctricos",
  "pagina.segmento.suv_grande.entrada":
    "SUV eléctricos de gran tamaño, con más espacio para pasajeros y equipaje.",
  "pagina.segmento.monovolumen.titulo": "Monovolúmenes eléctricos",
  "pagina.segmento.monovolumen.entrada":
    "Eléctricos con carrocería de monovolumen, pensados para aprovechar el espacio interior.",
  "pagina.segmento.furgoneta.titulo": "Furgonetas eléctricas",
  "pagina.segmento.furgoneta.entrada": "Furgonetas y combis eléctricas para pasajeros.",
  "pagina.segmento.deportivo.titulo": "Deportivos eléctricos",
  "pagina.segmento.deportivo.entrada": "Eléctricos de carácter deportivo, donde prima la prestación.",
  "pagina.segmento.coletilla": "Solo aparecen los modelos cuyo segmento está confirmado.",
  "pagina.precio.hasta30000.titulo": "Coches eléctricos hasta 30.000 €",
  "pagina.precio.hasta30000.entrada":
    "Modelos eléctricos cuyo precio desde en España no pasa de 30.000 €, sin descontar ayudas.",
  "pagina.precio.de30000a45000.titulo": "Coches eléctricos de 30.000 a 45.000 €",
  "pagina.precio.de30000a45000.entrada":
    "Modelos eléctricos cuyo precio desde en España está entre 30.000 y 45.000 €, sin descontar ayudas.",
  "pagina.precio.masDe45000.titulo": "Coches eléctricos de más de 45.000 €",
  "pagina.precio.masDe45000.entrada":
    "Modelos eléctricos cuyo precio desde en España supera los 45.000 €, sin descontar ayudas.",
  "pagina.precio.coletilla":
    "Si el precio es de una oferta de la marca, lo verás marcado como «Precio con oferta». Los modelos sin precio confirmado no aparecen aquí.",
  "pagina.autonomia.masDe400.titulo": "Coches eléctricos con más de 400 km de autonomía",
  "pagina.autonomia.masDe400.entrada":
    "Modelos eléctricos con al menos una versión que llega a 400 km de autonomía WLTP o más.",
  "pagina.autonomia.masDe500.titulo": "Coches eléctricos con más de 500 km de autonomía",
  "pagina.autonomia.masDe500.entrada":
    "Modelos eléctricos con al menos una versión que llega a 500 km de autonomía WLTP o más.",
  "pagina.autonomia.coletilla":
    "Es la cifra homologada WLTP, no la de uso real. Los modelos sin autonomía confirmada no aparecen aquí.",
  "explorar.titulo": "Explorar",
  "explorar.marcas": "Marcas",
  "explorar.segmentos": "Segmentos",
  "explorar.precio": "Precio",
  "explorar.autonomia": "Autonomía",
  "explorar.precio.hasta30000": "Hasta 30.000 €",
  "explorar.precio.de30000a45000": "De 30.000 a 45.000 €",
  "explorar.precio.masDe45000": "Más de 45.000 €",
  "explorar.autonomia.masDe400": "Más de 400 km",
  "explorar.autonomia.masDe500": "Más de 500 km",
  "explorar.todos": "Todos los coches",
  "vacio.pagina.texto": "Ahora mismo no hay ningún modelo en este tramo.",
  "vacio.pagina.enlace": "Ver todos los coches",
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
  "ficha.titulo": "{marca} {modelo}",
  "ficha.estado.rotulo": "Estado",
  "ficha.segmento.rotulo": "Segmento",
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
  "orden.etiqueta": "Ordenar por",
  "orden.novedad": "Novedad",
  "orden.precioAsc": "Precio: de menor a mayor",
  "orden.precioDesc": "Precio: de mayor a menor",
  "orden.autonomiaDesc": "Autonomía: de mayor a menor",
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
