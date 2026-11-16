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
  const originalQuery = (url.searchParams.get("q") || "").trim().slice(0, 500);
  if (!originalQuery) return json({ error: "Falta el término de búsqueda.", items: [] }, 400);
  const dateMatch = originalQuery.match(/after:(\\d{4}-\\d{2}-\\d{2})/);
  const selectedDate = dateMatch?.[1] || "";
  const query = originalQuery.replace(/\\s+(?:after|before):\\d{4}-\\d{2}-\\d{2}/g, "").trim();
  const cacheKey = new Request("https://el-area-cache.invalid/news-radar?q=" + encodeURIComponent(originalQuery));
  try { const cached = await caches.default.match(cacheKey); if (cached) return cached; } catch (_) {}

  const failures = [];
  // GDELT DOC API: búsqueda de artículos recientes, sin API key.
  try {
    const gdelt = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    gdelt.searchParams.set("query", query + " sourcelang:Spanish");
    gdelt.searchParams.set("mode", "ArtList");
    gdelt.searchParams.set("format", "json");
    gdelt.searchParams.set("maxrecords", "75");
    gdelt.searchParams.set("sort", "DateDesc");
    if (selectedDate) {
      const day = new Date(selectedDate + "T00:00:00Z");
      const from = new Date(day.getTime() - 86400000);
      const to = new Date(day.getTime() + 172800000 - 1000);
      const stamp = d => d.toISOString().replace(/[-:]/g, "").replace(/\\.\\d{3}Z$/, "Z");
      gdelt.searchParams.set("startdatetime", stamp(from));
      gdelt.searchParams.set("enddatetime", stamp(to));
    } else gdelt.searchParams.set("timespan", "24h");
    const response = await fetch(gdelt.toString(), { headers: { "Accept": "application/json", "User-Agent": "ELAREA-NewsRadar/1.0" } });
    if (!response.ok) failures.push("GDELT HTTP " + response.status);
    else {
      const type = response.headers.get("content-type") || "";
      const payload = type.includes("json") ? await response.json() : null;
      if (!payload || !Array.isArray(payload.articles)) failures.push("GDELT no devolvió una lista de artículos");
      else {
        const items = payload.articles.map(article => {
          const rawDate = String(article.seendate || "");
          const isoDate = rawDate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z");
          return { title: article.title || "", link: article.url || article.url_mobile || "", pubDate: isoDate || rawDate, author: article.domain || article.sourcecountry || "GDELT", description: "", content: "" };
        }).filter(item => item.title && /^https?:\/\//i.test(item.link));
        if (items.length) {
          const result = json({ items, provider: "GDELT", warning: null });
          try { await caches.default.put(cacheKey, result.clone()); } catch (_) {}
          return result;
        }
        failures.push("GDELT no encontró artículos para esta búsqueda");
      }
    }
  } catch (error) { failures.push("GDELT: " + (error?.message || "fallo de conexión")); }

  // Feeds alternativos por si GDELT está temporalmente limitado.
  const google = new URL("https://news.google.com/rss/search");
  google.searchParams.set("q", originalQuery); google.searchParams.set("hl", "es"); google.searchParams.set("gl", "ES"); google.searchParams.set("ceid", "ES:es");
  const bing = new URL("https://www.bing.com/news/search");
  bing.searchParams.set("q", originalQuery); bing.searchParams.set("format", "rss"); bing.searchParams.set("setlang", "es-es");
  for (const feed of [{ name: "Google Noticias", url: google.toString() }, { name: "Bing Noticias", url: bing.toString() }]) {
    try {
      const response = await fetch(feed.url, { headers: { "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml", "User-Agent": "Mozilla/5.0 (compatible; ELAREA/1.0)" } });
      if (!response.ok) { failures.push(feed.name + " HTTP " + response.status); continue; }
      const items = parseRss(await response.text());
      if (items.length) {
        const result = json({ items, provider: feed.name, warning: null });
        try { await caches.default.put(cacheKey, result.clone()); } catch (_) {}
        return result;
      }
      failures.push(feed.name + " devolvió un feed sin entradas reconocibles");
    } catch (error) { failures.push(feed.name + ": " + (error?.message || "fallo de conexión")); }
  }
  return json({ items: [], provider: null, warning: failures.join(" | ") || "No hay resultados disponibles." });
}
export async function onRequest({ request }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "Accept" } });
  if (request.method !== "GET") return json({ error: "Método no permitido." }, 405);
  return onRequestGet({ request });
}
