(() => {
  const url = window.EL_AREA_SUPABASE_URL;
  const key = window.EL_AREA_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("TU-PROYECTO") || key.includes("PEGA_AQUI")) return;
  const client = window.supabase.createClient(url, key);
  const main = document.querySelector("main") || document.body;
  const section = document.createElement("section");
  section.className = "db-news-section";
  section.innerHTML = '<div class="section-heading"><p class="eyebrow">Actualizado desde la redacción</p><h2>Últimas publicaciones</h2></div><div class="db-news-grid" aria-live="polite"></div>';
  const style = document.createElement("style");
  style.textContent = ".db-news-section{max-width:1200px;margin:48px auto;padding:0 20px}.db-news-section h2{font-size:clamp(1.8rem,4vw,3rem);margin:4px 0 24px}.db-news-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px}.db-news-card{overflow:hidden;border:1px solid #ddd;border-radius:12px;background:#fff;color:#161616}.db-news-card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.db-news-card div{padding:16px}.db-news-card small{font-weight:800;text-transform:uppercase;letter-spacing:.08em}.db-news-card h3{font-size:1.25rem;line-height:1.2;margin:8px 0}.db-news-card p{color:#555;margin:0}.db-news-card time{display:block;color:#666;font-size:.8rem;margin-top:12px}";
  document.head.appendChild(style);
  main.appendChild(section);
  const grid = section.querySelector(".db-news-grid");
  client.from("articles").select("id,title,slug,category,excerpt,image_url,published_at").eq("status","published").order("published_at",{ascending:false}).limit(12)
    .then(({data,error}) => {
      if (error) { console.error("EL ÁREA: no se pudieron cargar las noticias", error.message); section.remove(); return; }
      if (!data || !data.length) { section.remove(); return; }
      data.forEach(article => {
        const card = document.createElement("article"); card.className = "db-news-card";
        if (article.image_url) { const img=document.createElement("img"); img.src=article.image_url; img.alt=article.title; img.loading="lazy"; card.appendChild(img); }
        const body=document.createElement("div");
        const cat=document.createElement("small"); cat.textContent=article.category || "Fútbol";
        const title=document.createElement("h3"); title.textContent=article.title;
        const excerpt=document.createElement("p"); excerpt.textContent=article.excerpt || "";
        body.append(cat,title,excerpt);
        if (article.published_at) { const time=document.createElement("time"); time.dateTime=article.published_at; time.textContent=new Date(article.published_at).toLocaleDateString("es-ES"); body.appendChild(time); }
        card.appendChild(body); grid.appendChild(card);
      });
    });
})();
