// Diagnóstico temporal: solo informa presencia de configuración, nunca valores.
export async function onRequest({request,env}) {
  const present = (v) => typeof v === "string" && v.length > 0;
  return new Response(JSON.stringify({
    stripeSecret: present(request.headers.get("x-el-area-stripe-secret") || env.STRIPE_SECRET_KEY),
    webhookSecret: present(request.headers.get("x-el-area-stripe-webhook-secret") || env.STRIPE_WEBHOOK_SECRET),
    serviceRole: present(request.headers.get("x-el-area-supabase-service-key") || env.SUPABASE_SERVICE_ROLE_KEY),
    priceId: present(env.STRIPE_PRICE_ID),
    siteUrl: present(env.SITE_URL),
    supabaseUrl: present(env.SUPABASE_URL),
    supabaseAnonKey: present(env.SUPABASE_ANON_KEY)
  }), {headers:{"content-type":"application/json","cache-control":"no-store"}});
}
