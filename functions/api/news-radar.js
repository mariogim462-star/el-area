// Server-side Google News RSS proxy for the EL ÁREA editorial radar.
// Keeps the browser away from third-party RSS-to-JSON rate limits.
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=120, s-maxage=300", ...extra }
});

const decode = value => String(value || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim().slice(0, 500);
  if (!query) return json({ error: "Falta el término de búsqueda." }, 400);
  try {
    const feed = new URL("https://news.google.com/rss/search");
    feed.searchParams.set("q", query);
    feed.searchParams.set("hl", "es");
    feed.searchParams.set("gl", "ES");
    feed.searchParams.set("ceid", "ES:es");
    const upstream = await fetch(feed.toString(), {
      headers: { "Accept": "application/rss+xml, application/xml, text/xml" },
      cf: { cacheTtl: 180, cacheEverything: true }
    });
    if (!upstream.ok) return json({ error: "Google Noticias respondió HTTP " + upstream.status }, upstream.status === 429 ? 503 : 502, { "retry-after": upstream.headers.get("retry-after") || "30" });
    const xml = await upstream.text();
    const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0, 30).map(match => {
      const block = match[1];
      const get = tag => {
        const found = block.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\/" + tag + ">", "i"));
        return found ? decode(found[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, "").trim()) : "";
      };
      return { title: get("title"), link: get("link"), pubDate: get("pubDate"), author: get("source"), description: get("description"), content: get("description") };
    }).filter(item => item.title && item.link);
    return json({ items });
  } catch (error) {
    return json({ error: "No se pudo consultar Google Noticias: " + (error?.message || "error de red") }, 502);
  }
}

export async function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "Accept" } });
  if (request.method !== "GET") return json({ error: "Método no permitido." }, 405);
  return onRequestGet({ request });
}
