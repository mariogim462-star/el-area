// Cloudflare Pages Function: POST /api/customer-portal
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export async function onRequestPost({request,env}){
 try{
  if(!env.STRIPE_SECRET_KEY||!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.SUPABASE_SERVICE_ROLE_KEY||!env.SITE_URL)return json({error:"Falta configurar el portal de suscripciones."},503);
  const auth=request.headers.get("Authorization")||"";if(!auth.startsWith("Bearer "))return json({error:"Inicia sesión."},401);
  const base=env.SUPABASE_URL.replace(/\/$/,"");
  const ur=await fetch(base+"/auth/v1/user",{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:auth}});if(!ur.ok)return json({error:"La sesión no es válida."},401);
  const user=await ur.json();
  const sr=await fetch(base+"/rest/v1/subscriptions?user_id=eq."+encodeURIComponent(user.id)+"&select=stripe_customer_id",{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY}});
  const rows=await sr.json();const customer=rows?.[0]?.stripe_customer_id;if(!customer)return json({error:"Todavía no hay una suscripción asociada a esta cuenta."},404);
  const form=new URLSearchParams({customer,return_url:env.SITE_URL.replace(/\/$/,"")+"/cuenta.html"});
  const r=await fetch("https://api.stripe.com/v1/billing_portal/sessions",{method:"POST",headers:{Authorization:"Bearer "+env.STRIPE_SECRET_KEY,"Content-Type":"application/x-www-form-urlencoded"},body:form});
  const data=await r.json();if(!r.ok)return json({error:data.error?.message||"No se pudo abrir el portal."},502);return json({url:data.url});
 }catch(e){return json({error:"No se pudo abrir la gestión de pagos."},500);}
}
export async function onRequest({request,env}){if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"Authorization, Content-Type"}});if(request.method!=="POST")return json({error:"Método no permitido."},405);return onRequestPost({request,env});}
