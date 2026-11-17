(() => {
  "use strict";
  if (window.__elAreaAmazonAdsStarted) return;
  window.__elAreaAmazonAdsStarted = true;
  let links = [
    "https://link.amazon/B0fGw5xEw",
    "https://link.amazon/B0ayG2EB9",
    "https://link.amazon/B053rvW61",
    "https://link.amazon/B00tIiadK",
    "https://link.amazon/B0a6S5g9w"
  ];
  let adImageUrl = "";
  const interval = 5 * 60 * 1000;
  let premium = false, index = 0, overlay, timer;
  const activeSub = sub => !!sub && ["active","trialing"].includes(sub.status) &&
    (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
  function hideAd() { if (overlay) overlay.remove(); overlay = null; }
  function showAd() {
    if (premium || overlay || document.hidden) return;
    const href = links[index++ % links.length];
    overlay = document.createElement("div");
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-modal","true");
    overlay.setAttribute("aria-label","Anuncio de Amazon");
    overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(8,13,18,.78);display:flex;align-items:center;justify-content:center;padding:18px";
    const card = document.createElement("section");
    card.style.cssText = "position:relative;width:min(440px,100%);background:#fff;color:#171717;border-radius:14px;padding:30px 24px 24px;text-align:center;box-shadow:0 20px 70px #0007;font-family:Arial,sans-serif";
    const close = document.createElement("button");
    close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label","Cerrar anuncio");
    close.style.cssText = "position:absolute;right:12px;top:8px;border:0;background:#eee;border-radius:50%;width:34px;height:34px;font-size:24px;cursor:pointer;color:#222";
    close.addEventListener("click",hideAd);
    const tag = document.createElement("small"); tag.textContent = "ANUNCIO · RECOMENDACIÓN";
    tag.style.cssText = "font-size:10px;font-weight:900;letter-spacing:1.5px;color:#777";
    const title = document.createElement("h2"); title.textContent = "Una recomendación para los amantes del fútbol";
    title.style.cssText = "font-size:23px;line-height:1.15;margin:15px 0 10px";
    if (adImageUrl) { const img=document.createElement("img"); img.src=adImageUrl; img.alt="Imagen del anuncio"; img.style.cssText="display:block;width:100%;max-height:190px;object-fit:contain;margin:12px auto;border-radius:8px"; card.append(img); }
    const copy = document.createElement("p"); copy.textContent = "Descubre este producto en Amazon.";
    copy.style.cssText = "font-size:14px;color:#666;line-height:1.5;margin:0 0 20px";
    const link = document.createElement("a"); link.href = href; link.target = "_blank"; link.rel = "sponsored nofollow noopener noreferrer"; link.textContent = "Ver recomendación en Amazon";
    link.style.cssText = "display:block;background:#c8102e;color:white;text-decoration:none;padding:14px 18px;border-radius:7px;font-size:13px;font-weight:900";
    const note = document.createElement("p"); note.textContent = "EL ÁREA puede recibir una comisión por compras que cumplan los requisitos del programa de afiliados.";
    note.style.cssText = "font-size:10px;color:#888;line-height:1.4;margin:16px 0 0";
    card.append(close,tag,title,copy,link,note); overlay.append(card);
    overlay.addEventListener("click",e=>{if(e.target===overlay)hideAd();});
    document.addEventListener("keydown",onKey);
    function onKey(e){if(e.key==="Escape"){hideAd();document.removeEventListener("keydown",onKey);}}
    close.addEventListener("click",()=>document.removeEventListener("keydown",onKey),{once:true});
    document.body.append(overlay);
  }
  async function loadAdSettings() {
    try {
      if (!window.supabase || !window.EL_AREA_SUPABASE_URL || !window.EL_AREA_SUPABASE_ANON_KEY) return;
      const db=window.supabase.createClient(window.EL_AREA_SUPABASE_URL,window.EL_AREA_SUPABASE_ANON_KEY);
      const {data}=await db.from("site_settings").select("value").eq("key","advertising").maybeSingle();
      if(data?.value){
        if(Array.isArray(data.value.links)) {
          const validLinks=data.value.links.filter(x=>typeof x==="string"&&x.startsWith("https://"));
          if(validLinks.length) links=validLinks;
        }
        if(typeof data.value.image_url==="string") adImageUrl=data.value.image_url;
        // Aplicar la configuración también a los anuncios visibles de la página,
        // no solo al anuncio emergente temporizado.
        document.querySelectorAll(".affiliate-ad").forEach(slot=>{
          const list=slot.querySelector(".affiliate-links");
          if(list){
            list.replaceChildren();
            links.forEach((href,i)=>{
              const a=document.createElement("a");
              a.href=href; a.target="_blank";
              a.rel="sponsored nofollow noopener noreferrer";
              a.textContent="Ver recomendación "+(i+1)+" en Amazon ↗";
              list.append(a);
            });
          }
          const oldImage=slot.querySelector(".managed-ad-image");
          if(oldImage) oldImage.remove();
          if(adImageUrl){
            const img=document.createElement("img");
            img.className="managed-ad-image";
            img.src=adImageUrl;
            img.alt="Anuncio de EL ÁREA";
            img.loading="lazy";
            img.style.cssText="display:block;width:100%;max-height:220px;object-fit:contain;margin:12px auto;border-radius:8px";
            const heading=slot.querySelector("strong");
            if(heading) heading.insertAdjacentElement("afterend",img);
            else slot.prepend(img);
          }
        });
      }
    } catch (_) {}
  }
  async function checkPremium() {
    try {
      if (!window.supabase || !window.EL_AREA_SUPABASE_URL || !window.EL_AREA_SUPABASE_ANON_KEY) return;
      const db = window.supabase.createClient(window.EL_AREA_SUPABASE_URL,window.EL_AREA_SUPABASE_ANON_KEY);
      const {data} = await db.auth.getSession();
      const user = data?.session?.user;
      if (!user) { premium=false; return; }
      const {data:sub} = await db.from("subscriptions").select("status,current_period_end").eq("user_id",user.id).maybeSingle();
      premium = activeSub(sub);
      if (premium) hideAd();
      db.auth.onAuthStateChange(async (_event,session) => {
        if (!session) { premium=false; return; }
        const {data:next} = await db.from("subscriptions").select("status,current_period_end").eq("user_id",session.user.id).maybeSingle();
        premium=activeSub(next);
        if (premium) hideAd();
      });
    } catch (_) { premium=false; }
  }
  async function start() {
    await loadAdSettings();
    await checkPremium();
    timer = window.setInterval(() => { if (!premium) showAd(); }, interval);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",start,{once:true}); else start();
})();