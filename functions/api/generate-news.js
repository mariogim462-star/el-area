// Cloudflare Pages Function: POST /api/generate-news
// Las cuatro claves GROQ_API_KEY_* se reciben desde el Worker principal; Supabase autentica al redactor.
// The caller must be an authenticated EL ÁREA admin. No article is published here.
const SUPABASE_URL = "https://nddxgtppeqkhtjldwszq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dEkwD_UA7eW7wqTcsvmOkg_lq7yu0ST";
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export async function onRequestPost({ request, env }) {
  try {
    const groqKeys = [
      request.headers.get("x-el-area-groq-key-1") || env.GROQ_API_KEY_1,
      request.headers.get("x-el-area-groq-key-2") || env.GROQ_API_KEY_2,
      request.headers.get("x-el-area-groq-key-3") || env.GROQ_API_KEY_3,
      request.headers.get("x-el-area-groq-key-4") || env.GROQ_API_KEY_4
    ].map(key => String(key || "").trim()).filter(Boolean);
    if (!groqKeys.length) {
      return json({ error: "Faltan las claves GROQ_API_KEY_1–4 en el Worker principal o la conexión de Supabase." }, 503);
    }
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Inicia sesión como administrador." }, 401);
    const token = authorization.slice(7);
    const userResponse = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
    });
    if (!userResponse.ok) return json({ error: "La sesión no es válida. Vuelve a iniciar sesión." }, 401);
    const user = await userResponse.json();
    const roleResponse = await fetch(SUPABASE_URL + "/rest/v1/user_roles?user_id=eq." + encodeURIComponent(user.id) + "&select=role", {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
    });
    if (!roleResponse.ok) return json({ error: "No se pudieron comprobar los permisos de redacción." }, 403);
    const roles = await roleResponse.json();
    if (!Array.isArray(roles) || !roles.some(row => row.role === "admin")) return json({ error: "Solo la redacción autorizada puede generar noticias." }, 403);

    const input = await request.json();
    const title = String(input.title || "").trim().slice(0, 240);
    const sourceUrl = String(input.url || "").trim();
    const category = String(input.category || "Fútbol").trim().slice(0, 80);
    const requestedDate = String(input.date || "").trim();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
    const targetDate = requestedDate || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return json({ error: "La fecha debe tener formato AAAA-MM-DD." }, 400);
    const [year, month, day] = targetDate.split("-").map(Number);
    const dateCheck = new Date(Date.UTC(year, month - 1, day));
    if (dateCheck.toISOString().slice(0, 10) !== targetDate) return json({ error: "La fecha seleccionada no es válida." }, 400);
    if (targetDate > today) return json({ error: "No se pueden generar noticias de fechas futuras." }, 400);
    if (title.length < 8) return json({ error: "El titular de partida es demasiado corto." }, 400);
    let parsedUrl;
    try { parsedUrl = new URL(sourceUrl); } catch (_) { return json({ error: "El enlace de la fuente no es válido." }, 400); }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return json({ error: "El enlace debe ser HTTP o HTTPS." }, 400);

    const researchPrompt = [
      "Eres un periodista de investigación de EL ÁREA. Investiga la noticia usando browser_search.",
      "Busca primero en español; usa otros idiomas solo si es necesario para fuentes primarias internacionales.",
      "Fecha editorial: " + targetDate + " (Europe/Madrid). No presentes hechos antiguos como si fueran de ese día.",
      "Abre y contrasta fuentes originales e independientes. Prioriza clubes, ligas, federaciones y medios reconocidos.",
      "Redacta en español de España. No inventes hechos, declaraciones, cifras ni enlaces.",
      "Devuelve un informe de investigación claro con hechos confirmados, discrepancias y una lista final de al menos dos fuentes realmente consultadas, cada una con nombre, URL completa y qué confirma. Si no hay dos fuentes, dilo claramente."
    ].join("\n");
    const researchPayload = {
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: researchPrompt },
        { role: "user", content: "Investiga para EL ÁREA. Fecha: " + targetDate + ". Titular detectado: " + title + ". Sección: " + category + ". Enlace inicial: " + sourceUrl + ". Devuelve hechos y fuentes verificadas, no redactes aún el artículo." }
      ],
      tool_choice: "required",
      tools: [{ type: "browser_search" }],
      reasoning_effort: "low",
      max_completion_tokens: 3000,
      temperature: 1,
      stream: false
    };
    let aiData, lastGroqError = "Error del servicio de Groq.";
    let usedKey = "";
    for (const key of groqKeys) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
          body: JSON.stringify(researchPayload),
          signal: AbortSignal.timeout(55000)
        });
        const data = await response.json();
        if (response.ok && data?.choices?.[0]?.message?.content) {
          aiData = data;
          usedKey = key;
          break;
        }
        lastGroqError = data?.error?.message || ("Groq respondió HTTP " + response.status);
        if (![401, 403, 408, 429].includes(response.status) && response.status < 500) break;
      } catch (error) {
        lastGroqError = error?.name === "TimeoutError" || error?.name === "AbortError" ? "La búsqueda web de Groq ha superado 55 segundos." : (error?.message || "No se pudo conectar con Groq.");
      }
    }
    if (!aiData) return json({ error: "No se pudo investigar la noticia: " + lastGroqError }, 502);
    const research = String(aiData.choices[0].message.content || "").trim();
    if (research.length < 200) return json({ error: "La búsqueda web devolvió información insuficiente. Prueba con otra noticia o enlace." }, 502);

    const formatPrompt = [
      "Eres el redactor jefe de EL ÁREA, medio digital de fútbol en español de España.",
      "Usa EXCLUSIVAMENTE la investigación facilitada. No añadas datos externos ni inventes información.",
      "Redacta un borrador periodístico original de 350-500 palabras si la investigación lo permite. Si faltan datos, sé breve y explícalo en verification_notes.",
      "No copies frases de las fuentes. Distingue hechos confirmados de rumores.",
      "Todo debe estar en español de España. La fecha editorial es " + targetDate + ".",
      "Devuelve solo un objeto JSON válido con title, excerpt, content, category, sources y verification_notes.",
      "sources debe contener al menos dos fuentes de la investigación, con name, url y contribution. No inventes URL.",
      "category debe ser una de: Actualidad, Noticias de hoy, LaLiga, Premier League, Serie A, Champions League, Selección española, Fútbol internacional, Fútbol femenino, Análisis, Mercado."
    ].join("\n");
    let draftData;
    try {
      const draftMessages = [
        { role: "system", content: formatPrompt },
        { role: "user", content: "INFORME DE INVESTIGACIÓN Y FUENTES CONSULTADAS:\n" + research + "\n\nConvierte este informe en el JSON solicitado." }
      ];
      let formatted, formatError = "";
      // Si se agota el cupo diario de GPT-OSS 20B, intenta el modelo 120B,
      // que dispone de un límite independiente y admite JSON mode.
      for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]) {
        formatted = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: "Bearer " + usedKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: draftMessages,
            response_format: { type: "json_object" },
            reasoning_effort: "low",
            max_completion_tokens: 4096,
            temperature: 0.3,
            stream: false
          }),
          signal: AbortSignal.timeout(40000)
        });
        draftData = await formatted.json();
        if (formatted.ok && draftData?.choices?.[0]?.message?.content) break;
        formatError = draftData?.error?.message || ("HTTP " + formatted.status);
        if (!(formatted.status === 429 || /tokens per day|TPD|rate limit/i.test(formatError))) break;
      }
      if (!formatted?.ok) return json({ error: "La investigación se completó, pero no se pudo redactar. Se intentaron GPT-OSS 20B y 120B. " + formatError }, 502);
    } catch (error) {
      return json({ error: "La investigación se completó, pero la redacción superó el tiempo de espera. Vuelve a intentarlo." }, 504);
    }
    let outputText = draftData?.choices?.[0]?.message?.content || "";
    let draft;
    try { draft = JSON.parse(String(outputText).replace(/^\s*```(?:json)?\\s*/i, "").replace(/\s*```\s*$/, "").trim()); }
    catch (_) { return json({ error: "La investigación terminó, pero Groq no entregó el borrador en formato válido. Inténtalo otra vez." }, 502); }
    const sources = Array.isArray(draft.sources) ? draft.sources.filter(source => {
      try { const u = new URL(source.url); return u.protocol === "https:" || u.protocol === "http:"; } catch (_) { return false; }
    }).slice(0, 8) : [];
    const notes = Array.isArray(draft.verification_notes) ? draft.verification_notes.slice(0, 8) : [];
    if (!draft.title || !draft.excerpt || !draft.content || sources.length < 1) {
      return json({ error: "La IA no ha devuelto fuentes verificables junto al borrador. Revisa la noticia manualmente." }, 422);
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
