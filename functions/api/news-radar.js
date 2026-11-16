// Server-side Google News RSS proxy for the EL ÁREA editorial radar.
// Keeps the browser away from third-party RSS-to-JSON rate limits.
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=120, s-maxage=300", ...extra }
});

const decode = value => String(value || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

const stripCdata = value => String(value || "").replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, "$1");
const parseRss = xml => {
  const entries = [...String(xml || "").matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)];
  return entries.slice(0, 40).map(match => {
    const body = match[1];
    const get = tag => {
      const found = body.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + tag + ">", "i"));
      return found ? decode(stripCdata(found[1]).replace(/<[^>]*>/g, "").trim()) : "";
    };
    let link = get("link");
    if (!link) {
      const href = body.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (href) link = decode(href[1]);
    }
    const title = get("title");
    const description = get("description") || get("summary") || get("content");
    return { title, link, pubDate: get("pubDate") || get("published") || get("updated"), author: get("source") || get("creator") || get("name"), description, content: description };
  }).filter(item => item.title && /^https?:\/\//i.test(item.link));
};

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim().slice(0, 500);
  if (!query) return json({ error: "Falta el término de búsqueda.", items: [] }, 400);
  const cacheKey = new Request("https://el-area-cache.invalid/news-radar?q=" + encodeURIComponent(query));
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  } catch (_) {}
  const google = new URL("https://news.google.com/rss/search");
  google.searchParams.set("q", query);
  google.searchParams.set("hl", "es");
  google.searchParams.set("gl", "ES");
  google.searchParams.set("ceid", "ES:es");
  const bing = new URL("https://www.bing.com/news/search");
  bing.searchParams.set("q", query);
  bing.searchParams.set("format", "rss");
  bing.searchParams.set("setlang", "es-es");
  const feeds = [
    { name: "Google Noticias", url: google.toString() },
    { name: "Bing Noticias", url: bing.toString() }
  ];
  const failures = [];
  for (const feed of feeds) {
    try {
      const upstream = await fetch(feed.url, { headers: { "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml", "User-Agent": "Mozilla/5.0 (compatible; ELAREA/1.0)" } });
      if (!upstream.ok) { failures.push(feed.name + " HTTP " + upstream.status); continue; }
      const xml = await upstream.text();
      const items = parseRss(xml);
      if (items.length) {
        const response = json({ items, provider: feed.name, warning: null });
        try { await caches.default.put(cacheKey, response.clone()); } catch (_) {}
        return response;
      }
      failures.push(feed.name + " devolvió un feed sin entradas reconocibles");
    } catch (error) {
      failures.push(feed.name + ": " + (error?.message || "fallo de conexión"));
    }
  }
  // A failed provider must not break the whole five-section radar.
  return json({ items: [], provider: null, warning: failures.join(" | ") || "No hay resultados disponibles." });
}
export async function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "Accept" } });
  if (request.method !== "GET") return json({ error: "Método no permitido." }, 405);
  return onRequestGet({ request });
}
