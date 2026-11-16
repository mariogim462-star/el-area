// Server-side Google News RSS proxy for the EL ÁREA editorial radar.
// Keeps the browser away from third-party RSS-to-JSON rate limits.
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=120, s-maxage=300", ...extra }
});

const decode = value => String(value || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

const parseRss = xml => [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0, 30).map(match => {
  const itemXml = match[1];
  const get = tag => {
    const found = itemXml.match(new RegExp("<" + tag + "(?:\s[^>]*)?>([\s\S]*?)<\/" + tag + ">", "i"));
    return found ? decode(found[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, "").trim()) : "";
  };
  return { title: get("title"), link: get("link"), pubDate: get("pubDate"), author: get("source") || get("creator"), description: get("description"), content: get("description") };
}).filter(item => item.title && item.link);

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim().slice(0, 500);
  if (!query) return json({ error: "Falta el término de búsqueda." }, 400);
  const feeds = [
    { name: "Google Noticias", url: (() => { const u = new URL("https://news.google.com/rss/search"); u.searchParams.set("q", query); u.searchParams.set("hl", "es"); u.searchParams.set("gl", "ES"); u.searchParams.set("ceid", "ES:es"); return u.toString(); })() },
    { name: "Bing Noticias", url: (() => { const u = new URL("https://www.bing.com/news/search"); u.searchParams.set("q", query); u.searchParams.set("format", "rss"); u.searchParams.set("setlang", "es-es"); return u.toString(); })() }
  ];
  const failures = [];
  for (const feed of feeds) {
    try {
      const upstream = await fetch(feed.url, { headers: { "Accept": "application/rss+xml, application/xml, text/xml", "User-Agent": "Mozilla/5.0 ELAREA-NewsRadar/1.0" } });
      if (!upstream.ok) { failures.push(feed.name + " HTTP " + upstream.status); continue; }
      const xml = await upstream.text();
      const items = parseRss(xml);
      if (items.length) return json({ items, provider: feed.name });
      failures.push(feed.name + " no devolvió titulares RSS");
    } catch (error) { failures.push(feed.name + ": " + (error?.message || "error de red")); }
  }
  return json({ error: "Fallaron los proveedores RSS: " + failures.join("; ") }, 502, { "retry-after": "30" });
}
export async function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "Accept" } });
  if (request.method !== "GET") return json({ error: "Método no permitido." }, 405);
  return onRequestGet({ request });
}
