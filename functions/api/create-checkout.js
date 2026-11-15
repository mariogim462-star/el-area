// Cloudflare Pages Function: POST /api/create-checkout
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
async function getUser(request,env){
 const auth=request.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer ")) return null;
 const r=await fetch(env.SUPABASE_URL.replace(/\/$/,"")+"/auth/v1/user",{headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:auth}});
 return r.ok?await r.json():null;
}
export async function onRequestPost({request,env}){
 try{
  if(!env.STRIPE_SECRET_KEY||!env.STRIPE_PRICE_ID||!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.SITE_URL) return json({error:"Falta configurar Stripe o Supabase en Cloudflare."},503);
  const user=await getUser(request,env);if(!user)return json({error:"Inicia sesión para contratar Premium."},401);
  const form=new URLSearchParams({mode:"subscription", "line_items[0][price]":env.STRIPE_PRICE_ID,"line_items[0][quantity]":"1",success_url:env.SITE_URL.replace(/\/$/,"")+"/cuenta.html?checkout=success",cancel_url:env.SITE_URL.replace(/\/$/,"")+"/cuenta.html?checkout=cancel","client_reference_id":user.id,"customer_email":user.email||"","metadata[user_id]":user.id,"subscription_data[metadata][user_id]":user.id});
  const r=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:"Bearer "+env.STRIPE_SECRET_KEY,"Content-Type":"application/x-www-form-urlencoded"},body:form});
  const data=await r.json();if(!r.ok)return json({error:data.error?.message||"Stripe no pudo crear el pago."},502);
  return json({url:data.url});
 }catch(e){return json({error:"No se pudo iniciar el pago."},500);}
}
export async function onRequest({request,env}){if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"Authorization, Content-Type"}});if(request.method!=="POST")return json({error:"Método no permitido."},405);return onRequestPost({request,env});}
