// POST /api/customer-portal — portal de facturación de Stripe.
const SUPABASE_URL="https://nddxgtppeqkhtjldwszq.supabase.co";
const SUPABASE_PUBLIC_KEY="sb_publishable_dEkwD_UA7eW7wqTcsvmOkg_lq7yu0ST";
const SITE_URL="https://el-area.mariogim462.workers.dev";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function onRequestPost({request,env}){
 try{
  const stripeKey=request.headers.get("x-el-area-stripe-secret")||env.STRIPE_SECRET_KEY;
  const service=request.headers.get("x-el-area-supabase-service-key")||env.SUPABASE_SERVICE_ROLE_KEY;
  const auth=request.headers.get("Authorization")||"";
  if(!stripeKey||!service)return json({error:"Faltan STRIPE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY en los secretos del Worker."},503);
  if(!auth.startsWith("Bearer "))return json({error:"Inicia sesión para gestionar tu suscripción."},401);
  const ur=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:auth}});
  if(!ur.ok)return json({error:"Tu sesión ha caducado. Inicia sesión de nuevo."},401);
  const user=await ur.json();
  const sr=await fetch(SUPABASE_URL+"/rest/v1/subscriptions?user_id=eq."+encodeURIComponent(user.id)+"&select=stripe_customer_id&limit=1",{headers:{apikey:service,Authorization:"Bearer "+service}});
  if(!sr.ok)return json({error:"No se pudo consultar tu suscripción en Supabase."},502);
  const rows=await sr.json(),customer=rows?.[0]?.stripe_customer_id;
  if(!customer)return json({error:"No hay cliente de Stripe asociado a esta cuenta. Contrata Premium primero."},404);
  const form=new URLSearchParams({customer,return_url:SITE_URL+"/cuenta.html"});
  const pr=await fetch("https://api.stripe.com/v1/billing_portal/sessions",{method:"POST",headers:{Authorization:"Bearer "+stripeKey,"Content-Type":"application/x-www-form-urlencoded"},body:form});
  const data=await pr.json();if(!pr.ok)return json({error:data.error?.message||"Stripe no pudo abrir el portal de facturación."},502);
  return json({url:data.url});
 }catch(e){return json({error:"No se pudo abrir el portal de facturación."},500);}
}
export async function onRequest({request,env}){if(request.method!=="POST")return json({error:"Método no permitido."},405);return onRequestPost({request,env});}