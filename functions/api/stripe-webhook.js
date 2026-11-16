// Cloudflare Pages Function: POST /api/stripe-webhook
const stripeSecret=(request,env)=>request.headers.get("x-el-area-stripe-secret")||env.STRIPE_SECRET_KEY;
const webhookSecret=(request,env)=>request.headers.get("x-el-area-stripe-webhook-secret")||env.STRIPE_WEBHOOK_SECRET;
const serviceKey=(request,env)=>request.headers.get("x-el-area-supabase-service-key")||env.SUPABASE_SERVICE_ROLE_KEY;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const hex=b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
async function validSignature(payload,header,secret){
 const parts=Object.fromEntries(header.split(",").map(x=>x.split("=").map(y=>y.trim())));
 if(!parts.t||!parts.v1||Math.abs(Date.now()/1000-Number(parts.t))>300)return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const expected=hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(parts.t+"."+payload)));
 return parts.v1.split(" ").some(sig=>sig.length===expected.length&&[...sig].every((ch,i)=>ch===expected[i]));
}
async function saveSubscription(env,userId,customerId,subscription,service){
 const body={user_id:userId,stripe_customer_id:customerId,stripe_subscription_id:subscription.id,status:subscription.status,current_period_end:subscription.current_period_end?new Date(subscription.current_period_end*1000).toISOString():null,updated_at:new Date().toISOString()};
 const r=await fetch(env.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/subscriptions?on_conflict=user_id",{method:"POST",headers:{apikey:service,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates"},body:JSON.stringify(body)});
 if(!r.ok)throw new Error("No se pudo actualizar la suscripción en Supabase.");
}
export async function onRequestPost({request,env}){
 try{
  const hookSecret=webhookSecret(request,env),stripeKey=stripeSecret(request,env),service=serviceKey(request,env);
  if(!hookSecret||!stripeKey||!service)return json({error:"Webhook no configurado."},503);
  const raw=await request.text(),sig=request.headers.get("Stripe-Signature")||"";
  if(!await validSignature(raw,sig,hookSecret))return json({error:"Firma no válida."},400);
  const event=JSON.parse(raw);let sub=null,customerId=null,userId=null;
  if(event.type==="checkout.session.completed"){
   const session=event.data.object;const subId=typeof session.subscription==="string"?session.subscription:session.subscription?.id;
   userId=session.metadata?.user_id||session.client_reference_id;customerId=typeof session.customer==="string"?session.customer:session.customer?.id;
   if(!subId||!userId||!customerId)return json({received:true});
   const sr=await fetch("https://api.stripe.com/v1/subscriptions/"+subId,{headers:{Authorization:"Bearer "+stripeKey}});
   sub=await sr.json();if(!sr.ok)throw new Error("No se pudo consultar la suscripción en Stripe.");
  }else if(event.type==="customer.subscription.updated"||event.type==="customer.subscription.deleted"){
   sub=event.data.object;customerId=typeof sub.customer==="string"?sub.customer:sub.customer?.id;userId=sub.metadata?.user_id;
   if(!userId&&customerId){
    const r=await fetch(env.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/subscriptions?stripe_customer_id=eq."+encodeURIComponent(customerId)+"&select=user_id",{headers:{apikey:service}});
    const rows=await r.json();userId=rows?.[0]?.user_id;
   }
   if(!userId||!customerId)return json({received:true});
  }else return json({received:true});
  await saveSubscription(env,userId,customerId,sub,service);return json({received:true});
 }catch(e){return json({error:"No se pudo procesar el evento de Stripe."},500);}
}
export async function onRequest({request,env}){if(request.method!=="POST")return json({error:"Método no permitido."},405);return onRequestPost({request,env});}
