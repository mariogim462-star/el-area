const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const URL_BASE="https://nddxgtppeqkhtjldwszq.supabase.co";
const ANON="sb_publishable_dEkwD_UA7eW7wqTcsvmOkg_lq7yu0ST";
export async function onRequestGet({request}) {
 const token=(request.headers.get("Authorization")||"").replace(/^Bearer /,"");
 const service=request.headers.get("x-el-area-supabase-service-key");
 if(!token||!service) return json({error:"Sesión o servicio no configurado."},401);
 const user=await fetch(URL_BASE+"/auth/v1/user",{headers:{apikey:ANON,Authorization:"Bearer "+token}});
 if(!user.ok) return json({error:"Inicia sesión de nuevo."},401);
 const u=await user.json();
 const role=await fetch(URL_BASE+"/rest/v1/user_roles?user_id=eq."+encodeURIComponent(u.id)+"&select=role",{headers:{apikey:ANON,Authorization:"Bearer "+token}});
 const roles=role.ok?await role.json():[];
 if(!Array.isArray(roles)||!roles.some(x=>x.role==="admin")) return json({error:"No autorizado."},403);
 const since=new Date(Date.now()-370*86400000).toISOString();
 const rows=await fetch(URL_BASE+"/rest/v1/site_visits?select=visitor_key,page_path,article_id,article_title,viewed_at&viewed_at=gte."+encodeURIComponent(since)+"&order=viewed_at.desc&limit=50000",{headers:{apikey:service,Authorization:"Bearer "+service}});
 if(!rows.ok) return json({error:"No se pudieron leer las estadísticas."},502);
 return json({visits:await rows.json()});
}
export async function onRequest({request}) {
 if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{"access-control-allow-methods":"GET, OPTIONS","access-control-allow-headers":"Authorization"}});
 if(request.method!=="GET") return json({error:"Método no permitido."},405);
 return onRequestGet({request});
}