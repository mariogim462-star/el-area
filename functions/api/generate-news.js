// Cloudflare Pages Function: POST /api/generate-news
// Required Cloudflare secrets/variables: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY.
// The caller must be an authenticated EL ÁREA admin. No article is published here.
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export async function onRequestPost({ request, env }) {
  try {
    if (!env.OPENAI_API_KEY || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return json({ error: "Falta configurar OPENAI_API_KEY, SUPABASE_URL o SUPABASE_ANON_KEY en Cloudflare." }, 503);
    }
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Inicia sesión como administrador." }, 401);
    const token = authorization.slice(7);
    const userResponse = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
    });
    if (!userResponse.ok) return json({ error: "La sesión no es válida. Vuelve a iniciar sesión." }, 401);
    const user = await userResponse.json();
    const roleResponse = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/user_roles?user_id=eq." + encodeURIComponent(user.id) + "&select=role", {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
    });
    if (!roleResponse.ok) return json({ error: "No se pudieron comprobar los permisos de redacción." }, 403);
    const roles = await roleResponse.json();
    if (!Array.isArray(roles) || !roles.some(row => row.role === "admin")) return json({ error: "Solo la redacción autorizada puede generar noticias." }, 403);

    const input = await request.json();
    const title = String(input.title || "").trim().slice(0, 240);
    const sourceUrl = String(input.url || "").trim();
    const category = String(input.category || "Fútbol").trim().slice(0, 80);
    if (title.length < 8) return json({ error: "El titular de partida es demasiado corto." }, 400);
    let parsedUrl;
    try { parsedUrl = new URL(sourceUrl); } catch (_) { return json({ error: "El enlace de la fuente no es válido." }, 400); }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return json({ error: "El enlace debe ser HTTP o HTTPS." }, 400);

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        excerpt: { type: "string" },
        content: { type: "string" },
        category: { type: "string", enum: ["Actualidad", "LaLiga", "Premier League", "Champions League", "Selección española", "Fútbol internacional", "Fútbol femenino", "Análisis", "Mercado"] },
        sources: { type: "array", items: { type: "object", additionalProperties: false, properties: {
          name: { type: "string" }, url: { type: "string" }, contribution: { type: "string" }
        }, required: ["name", "url", "contribution"] } },
        verification_notes: { type: "array", items: { type: "string" } }
      },
      required: ["title", "excerpt", "content", "category", "sources", "verification_notes"]
    };
    const instructions = [
      "Eres el redactor jefe de EL ÁREA, periódico digital de fútbol en español.",
      "Investiga la noticia de partida usando la herramienta web_search. Abre las páginas originales, no te bases solo en snippets.",
      "Contrasta los hechos con al menos DOS fuentes independientes y fiables cuando existan. Prioriza comunicados oficiales, clubes, ligas, federaciones, ruedas de prensa y medios reconocidos. Incluye la fuente de partida solo si aporta información verificable.",
      "Escribe una noticia COMPLETAMENTE ORIGINAL en español natural, con estructura periodística y estilo claro de EL ÁREA. No copies ni traduzcas frases de las fuentes ni imites literalmente su redacción. No inventes datos, citas, cifras, fechas ni contexto.",
      "Si la noticia se basa en un rumor, atribúyelo de forma visible en el titular o el texto y deja claro que no está confirmado. Distingue hechos, versiones y opiniones.",
      "Si no puedes abrir o verificar las fuentes, dilo en verification_notes y no rellenes huecos con suposiciones. No inventes fuentes ni enlaces. Usa solo URLs que hayas consultado.",
      "Redacta entre 350 y 500 palabras salvo que la información disponible no permita una noticia de esa extensión. Incluye titular, entradilla y cuerpo en campos separados. No añadas una firma en content; la aplicación añadirá «— EL ÁREA».",
      "En content usa párrafos separados por dos saltos de línea. No incluyas markdown ni enlaces inventados. Devuelve las fuentes consultadas por separado.",
      "La respuesta es un BORRADOR para revisión humana, no una publicación definitiva."
    ].join("\n");
    const userPrompt = "Noticia detectada: " + title + "\nSección sugerida: " + category + "\nFuente inicial: " + sourceUrl + "\n\nInvestiga y redacta el borrador siguiendo todas las instrucciones.";
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-6-astra",
        tools: [{ type: "web_search" }],
        input: [{ role: "developer", content: [{ type: "input_text", text: instructions }] }, { role: "user", content: [{ type: "input_text", text: userPrompt }] }],
        text: { format: { type: "json_schema", name: "el_area_news_draft", strict: true, schema } }
      })
    });
    const aiData = await aiResponse.json();
    if (!aiResponse.ok) {
      const message = aiData && aiData.error && aiData.error.message ? aiData.error.message : "Error del servicio de IA.";
      return json({ error: message }, 502);
    }
    let outputText = aiData.output_text;
    if (!outputText && Array.isArray(aiData.output)) {
      outputText = aiData.output.flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text).join("\n");
    }
    if (!outputText) return json({ error: "La IA no devolvió un borrador utilizable." }, 502);
    let draft;
    try { draft = JSON.parse(outputText); } catch (_) { return json({ error: "La respuesta de IA no tenía el formato esperado. Inténtalo de nuevo." }, 502); }
    const sources = Array.isArray(draft.sources) ? draft.sources.filter(source => {
      try { const u = new URL(source.url); return u.protocol === "https:" || u.protocol === "http:"; } catch (_) { return false; }
    }).slice(0, 8) : [];
    const notes = Array.isArray(draft.verification_notes) ? draft.verification_notes.slice(0, 8) : [];
    if (!draft.title || !draft.excerpt || !draft.content || sources.length < 2) {
      return json({ error: "No se pudo verificar suficiente información para preparar un borrador fiable. Revisa las fuentes manualmente." }, 422);
    }
    return json({
      title: String(draft.title).slice(0, 180),
      excerpt: String(draft.excerpt).slice(0, 400),
      content: String(draft.content).slice(0, 24000).trim() + "\n\nFuentes consultadas:\n" + sources.map(s => "- " + s.name + ": " + s.url + (s.contribution ? " (" + s.contribution + ")" : "")).join("\n") + "\n\n— EL ÁREA",
      category: String(draft.category || category).slice(0, 80),
      sources,
      verification_notes: notes,
      status: "draft"
    });
  } catch (error) {
    return json({ error: "No se pudo generar la noticia: " + (error && error.message ? error.message : "error inesperado") }, 500);
  }
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "Authorization, Content-Type" } });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  return onRequestPost({ request, env });
}
