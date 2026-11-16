// EL ÁREA: conserva la URL principal del Worker y reenvía la aplicación a Pages.
// Los secretos permanecen en el Worker y solo se transmiten por HTTPS a sus
// Pages Functions para procesar las rutas API. Nunca se envían al navegador.
const PAGES_ORIGIN = "https://el-area.pages.dev";

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const upstream = new URL(PAGES_ORIGIN);
    upstream.pathname = incoming.pathname;
    upstream.search = incoming.search;

    const headers = new Headers(request.headers);
    // Elimina cualquier cabecera que pudiera haber enviado el cliente.
    headers.delete("x-el-area-stripe-secret");
    headers.delete("x-el-area-stripe-webhook-secret");
    headers.delete("x-el-area-supabase-service-key");
    headers.delete("x-el-area-openai-key");

    if (incoming.pathname.startsWith("/api/")) {
      if (env.STRIPE_SECRET_KEY) headers.set("x-el-area-stripe-secret", env.STRIPE_SECRET_KEY);
      if (env.STRIPE_WEBHOOK_SECRET) headers.set("x-el-area-stripe-webhook-secret", env.STRIPE_WEBHOOK_SECRET);
      if (env.SUPABASE_SERVICE_ROLE_KEY) headers.set("x-el-area-supabase-service-key", env.SUPABASE_SERVICE_ROLE_KEY);
      if (env.OPENAI_API_KEY) headers.set("x-el-area-openai-key", env.OPENAI_API_KEY);
    }

    const forwarded = new Request(upstream.toString(), {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual"
    });
    return fetch(forwarded);
  }
};
