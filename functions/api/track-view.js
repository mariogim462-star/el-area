const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export async function onRequestPost({request}) {
  const key=request.headers.get("x-el-area-supabase-service-key");
  const url="https://nddxgtppeqkhtjldwszq.supabase.co";
  if(!key) return json({error:"Analítica no configurada."},503);
  try {
    const body=await request.json();
    const visitor=String(body.visitor||"").slice(0,80);
    const path=String(body.path||"/").slice(0,500);
    const articleId=body.articleId?String(body.articleId).slice(0,180):null;
    const title=body.title?String(body.title).slice(0,240):null;
    if(!/^[a-f0-9-]{20,80}$/i.test(visitor)) return json({error:"Identificador no válido."},400);
    const response=await fetch(url+"/rest/v1/site_visits",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({visitor_key:visitor,page_path:path,article_id:articleId,article_title:title})});
    if(!response.ok) return json({error:"No se pudo registrar la visita."},502);
    return json({ok:true});
  } catch(error){return json({error:"No se pudo registrar la visita."},500);}
}
export async function onRequest({request}) {
 if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{"access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"Content-Type"}});
 if(request.method!=="POST") return json({error:"Método no permitido."},405);
 return onRequestPost({request});
}