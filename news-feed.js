(() => {
  const url = window.EL_AREA_SUPABASE_URL;
  const key = window.EL_AREA_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("TU-PROYECTO") || key.includes("PEGA_AQUI")) return;

  const client = window.supabase.createClient(url, key);
  const main = document.querySelector("main") || document.body;
  const section = document.createElement("section");
  section.className = "db-news-section";
  section.innerHTML = `
    <section class="db-today">
      <div class="section-heading"><p class="eyebrow">La actualidad del día</p><h2>Noticias de hoy</h2></div>
      <div class="db-news-grid" id="db-today-grid" aria-live="polite"></div>
      <p class="db-empty" id="db-today-empty" hidden>Hoy todavía no hay noticias publicadas.</p>
    </section>
    <section class="db-archive" id="db-archive" hidden>
      <div class="section-heading"><p class="eyebrow">De días anteriores</p><h2>Noticias anteriores</h2></div>
      <div id="db-archive-days"></div>
    </section>`;
  const style = document.createElement("style");
  style.textContent = `
    .db-news-section{max-width:1200px;margin:48px auto;padding:0 20px}
    .db-news-section h2{font-size:clamp(1.8rem,4vw,3rem);margin:4px 0 24px}
    .db-news-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px}
    .db-news-card{display:block;text-decoration:none;color:inherit;overflow:hidden;border:1px solid #ddd;border-radius:12px;background:#fff}
    .db-news-card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
    .db-news-card>div{padding:16px}
    .db-news-card small{font-weight:800;text-transform:uppercase;letter-spacing:.08em}
    .db-news-card h3{font-size:1.25rem;line-height:1.2;margin:8px 0}
    .db-news-card p{color:#555;margin:0}
    .db-news-card time{display:block;color:#666;font-size:.8rem;margin-top:12px}
    .db-archive{margin-top:52px;padding-top:30px;border-top:3px solid #171717}
    .db-archive-day{margin:28px 0}
    .db-archive-day h3{font-size:1.15rem;text-transform:capitalize;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:18px}
    .db-empty{color:#666;padding:12px 0}
  `;
  document.head.appendChild(style);
  main.prepend(section);

  const dateParts = (date) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const get = type => parts.find(part => part.type === type).value;
    return get("year") + "-" + get("month") + "-" + get("day");
  };
  const todayKey = dateParts(new Date());

  const makeCard = article => {
    const card = document.createElement("a");
    card.className = "db-news-card";
    card.href = "article.html?slug=" + encodeURIComponent(article.slug);
    if (article.image_url) {
      const img = document.createElement("img");
      img.src = article.image_url;
      img.alt = article.title;
      img.loading = "lazy";
      card.appendChild(img);
    }
    const body = document.createElement("div");
    const category = document.createElement("small");
    category.textContent = article.category || "Fútbol";
    const title = document.createElement("h3");
    title.textContent = article.title;
    const excerpt = document.createElement("p");
    excerpt.textContent = article.excerpt || "";
    body.append(category, title, excerpt);
    if (article.published_at) {
      const time = document.createElement("time");
      time.dateTime = article.published_at;
      time.textContent = new Date(article.published_at).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" });
      body.appendChild(time);
    }
    card.appendChild(body);
    return card;
  };

  client.from("articles")
    .select("id,title,slug,category,excerpt,image_url,published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1000)
    .then(({ data, error }) => {
      const todayGrid = section.querySelector("#db-today-grid");
      if (error) {
        console.error("EL ÁREA: no se pudieron cargar las noticias", error.message);
        todayGrid.textContent = "No se pudieron cargar las noticias: " + error.message;
        return;
      }
      const articles = data || [];
      const today = articles.filter(article => article.published_at && dateParts(new Date(article.published_at)) === todayKey);
      const previous = articles.filter(article => !article.published_at || dateParts(new Date(article.published_at)) < todayKey);

      today.forEach(article => todayGrid.appendChild(makeCard(article)));
      if (!today.length) section.querySelector("#db-today-empty").hidden = false;

      if (previous.length) {
        const archive = section.querySelector("#db-archive");
        const days = section.querySelector("#db-archive-days");
        archive.hidden = false;
        const groups = new Map();
        previous.forEach(article => {
          const key = article.published_at ? dateParts(new Date(article.published_at)) : "sin-fecha";
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(article);
        });
        [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).forEach(([key, group]) => {
          const day = document.createElement("section");
          day.className = "db-archive-day";
          const heading = document.createElement("h3");
          heading.textContent = key === "sin-fecha" ? "Publicaciones anteriores" :
            new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", year: "numeric" })
              .format(new Date(key + "T12:00:00+01:00"));
          const grid = document.createElement("div");
          grid.className = "db-news-grid";
          group.forEach(article => grid.appendChild(makeCard(article)));
          day.append(heading, grid);
          days.appendChild(day);
        });
      }
    })
    .catch(error => {
      console.error("EL ÁREA: error inesperado al cargar noticias", error);
      section.querySelector("#db-today-grid").textContent = "No se pudieron cargar las noticias.";
    });
})();