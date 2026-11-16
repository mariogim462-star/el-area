// POST /api/create-checkout — crea Checkout de Stripe para Premium mensual.
const SUPABASE_URL = "https://nddxgtppeqkhtjldwszq.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_dEkwD_UA7eW7wqTcsvmOkg_lq7yu0ST";
const PRICE_ID = "price_1Uc84UFMaZ6evlHlfIqv60jz";
const SITE_URL = "https://el-area.mariogim462.workers.dev";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const stripeSecret=(request,env)=>request.headers.get("x-el-area-stripe-secret")||env.STRIPE_SECRET_KEY;
async function getUser(request){
 const auth=request.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer "))return null;
 const r=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:auth}});
 return r.ok?await r.json():null;
}
export async function onRequestPost({request,env}){
 try{
  const stripeKey=stripeSecret(request,env);
  if(!stripeKey)return json({error:"Falta STRIPE_SECRET_KEY en los secretos del Worker."},503);
  const user=await getUser(request);
  if(!user)return json({error:"Inicia sesión para contratar Premium."},401);
  const form=new URLSearchParams({
   mode:"subscription",
   "line_items[0][price]":PRICE_ID,
   "line_items[0][quantity]":"1",
   success_url:SITE_URL+"/cuenta.html?checkout=success",
   cancel_url:SITE_URL+"/cuenta.html?checkout=cancel",
   client_reference_id:user.id,
   "metadata[user_id]":user.id,
   "subscription_data[metadata][user_id]":user.id
  });
  if(user.email)form.set("customer_email",user.email);
  const r=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:"Bearer "+stripeKey,"Content-Type":"application/x-www-form-urlencoded"},body:form});
  const data=await r.json();
  if(!r.ok)return json({error:data.error?.message||"Stripe no pudo crear el pago."},502);
  return json({url:data.url});
 }catch(e){return json({error:"No se pudo iniciar el pago. Comprueba la configuración de Stripe."},500);}
}
export async function onRequest({request,env}){
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"Authorization, Content-Type"}});
 if(request.method!=="POST")return json({error:"Método no permitido."},405);
 return onRequestPost({request,env});
}