// EL ÁREA: mantiene la URL pública histórica del Worker y reenvía
// las peticiones a la aplicación Pages, donde viven los archivos estáticos
// y las Pages Functions (/api/*).
const PAGES_ORIGIN = "https://el-area.pages.dev";

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const upstream = new URL(PAGES_ORIGIN);
    upstream.pathname = incoming.pathname;
    upstream.search = incoming.search;

    // Conserva método, cabeceras, cookies y cuerpo (incluido Stripe webhook).
    const forwarded = new Request(upstream.toString(), request);
    return fetch(forwarded);
  }
};
