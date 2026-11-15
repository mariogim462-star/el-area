export async function onRequestGet({ request, env }) {
  const site = "https://el-area.mariogim462.workers.dev";
  const supabaseUrl = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;

  const escapeXml = (value) => String(value).replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
  })[char]);

  let articles = [];
  if (supabaseUrl && anonKey) {
    try {
      const endpoint = new URL("/rest/v1/articles", supabaseUrl);
      endpoint.searchParams.set("select", "slug,published_at");
      endpoint.searchParams.set("status", "eq.published");
      endpoint.searchParams.set("published_at", "lte." + new Date().toISOString());
      endpoint.searchParams.set("slug", "not.is.null");
      endpoint.searchParams.set("order", "published_at.desc");
      endpoint.searchParams.set("limit", "1000");
      const response = await fetch(endpoint, {
        headers: { apikey: anonKey, Authorization: "Bearer " + anonKey }
      });
      if (response.ok) articles = await response.json();
    } catch (error) {
      // Si Supabase no responde, la portada sigue disponible en el sitemap.
    }
  }

  const urls = [
    `<url><loc>${site}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    ...articles.filter((article) => article.slug).map((article) => {
      const loc = site + "/article.html?slug=" + encodeURIComponent(article.slug);
      const lastmod = article.published_at
        ? `<lastmod>${escapeXml(new Date(article.published_at).toISOString())}</lastmod>`
        : "";
      return `<url><loc>${escapeXml(loc)}</loc>${lastmod}<changefreq>monthly</changefreq><priority>0.7</priority></url>`;
    })
  ];

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`,
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=300",
        "x-content-type-options": "nosniff"
      }
    }
  );
}
