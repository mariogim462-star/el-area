(() => {
  const panel = document.getElementById('radarPanel');
  if (!panel || !window.supabase || !window.EL_AREA_SUPABASE_URL || !window.EL_AREA_SUPABASE_ANON_KEY) return;
  const db = window.supabase.createClient(window.EL_AREA_SUPABASE_URL, window.EL_AREA_SUPABASE_ANON_KEY);
  const status = document.getElementById('radarStatus');
  const results = document.getElementById('radarResults');
  const searchButton = document.getElementById('radarSearch');
  const filter = document.getElementById('radarFilter');
  const editorPanel = document.getElementById('editorPanel');
  let items = [];

  const categoryFor = title => {
    const t = title.toLocaleLowerCase('es');
    if (/real madrid|mbapp[eé]|vin[ií]cius|bellingham|ancelotti/.test(t)) return 'Real Madrid';
    if (/barcelona|barça|lamine yamal|pedri|flick/.test(t)) return 'Barcelona';
    if (/fichaj|traspas|mercado|renovaci[oó]n|cesi[oó]n/.test(t)) return 'Mercado';
    if (/premier league|arsenal|liverpool|manchester|chelsea|tottenham/.test(t)) return 'Premier League';
    if (/champions|uefa|europa league/.test(t)) return 'Champions League';
    if (/laliga|la liga|atl[eé]tico|sevilla|betis|valencia|girona/.test(t)) return 'LaLiga';
    return 'Fútbol internacional';
  };
  const cleanText = html => {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 360);
  };
  const normalize = s => String(s || '').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const el = (tag, cls, value) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  function render() {
    results.replaceChildren();
    const shown = items.filter(item => !filter.value || item.category === filter.value);
    if (!shown.length) {
      results.append(el('p', 'muted', 'No hay titulares para este filtro. Prueba otra sección o vuelve a buscar.'));
      return;
    }
    shown.forEach(item => {
      const card = el('article', 'item');
      card.style.cssText = 'display:block;border:1px solid #e1e6e9;border-radius:10px;padding:14px;margin:12px 0';
      const heading = el('strong', '', item.title);
      const meta = el('p', 'muted', item.category + ' · ' + (item.source || 'Google Noticias') + ' · ' + (item.date ? new Date(item.date).toLocaleString('es-ES') : 'Fecha no disponible'));
      const excerpt = el('p', '', item.excerpt || 'La fuente no ofrece entradilla. Abre el enlace y comprueba la información original.');
      const source = el('a', 'muted', 'Abrir fuente original ↗');
      source.href = item.link; source.target = '_blank'; source.rel = 'noopener noreferrer';
      const actions = el('div', 'actions');
      const draft = el('button', '', 'Generar noticia con IA y guardar borrador');
      draft.type = 'button';
      draft.addEventListener('click', () => generateDraft(item, draft));
      const prompt = el('button', 'secondary', 'Copiar instrucciones para IA');
      prompt.type = 'button';
      prompt.addEventListener('click', async () => {
        const text = 'Actúa como periodista de EL ÁREA, periódico digital de fútbol en español. Redacta una noticia original, no copies ni traduzcas literalmente la fuente. Usa solo los datos verificables de la fuente; no inventes declaraciones, cifras, fechas ni contexto. Si es un rumor, identifícalo claramente como rumor y atribúyelo. Si falta confirmación, dilo. Devuelve: 1) titular claro, 2) entradilla de 2 frases, 3) noticia de 250-350 palabras con tono periodístico natural, 4) categoría sugerida, 5) lista de datos que conviene comprobar antes de publicar. No afirmes que has leído contenido al que no tienes acceso.\n\nTitular detectado: ' + item.title + '\nResumen del feed: ' + item.excerpt + '\nFuente original: ' + item.link;
        try { await navigator.clipboard.writeText(text); status.textContent = 'Instrucciones copiadas. Pégalas en ChatGPT junto con la fuente para preparar un texto original y verificarlo.'; }
        catch (_) { status.textContent = 'No se pudo copiar automáticamente. Abre la fuente y copia el titular y el enlace manualmente.'; }
      });
      actions.append(draft, prompt);
      card.append(heading, meta, excerpt, source, actions);
      results.append(card);
    });
  }
  async function generateDraft(item, button) {
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = 'Investigando fuentes y redactando…';
    status.textContent = 'La IA está contrastando la noticia con varias fuentes. Puede tardar un poco…';
    try {
      const { data: sessionData, error: sessionError } = await db.auth.getSession();
      const token = sessionData && sessionData.session && sessionData.session.access_token;
      if (sessionError || !token) throw new Error('Tu sesión ha caducado. Vuelve a iniciar sesión en el panel.');
      const response = await fetch('/api/generate-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ title: item.title, url: item.link, category: item.category })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo generar el borrador.');
      document.getElementById('title').value = data.title;
      document.getElementById('category').value = data.category;
      document.getElementById('excerpt').value = data.excerpt;
      document.getElementById('content').value = data.content;
      document.getElementById('status').value = 'draft';
      document.getElementById('featured').checked = false;
      document.getElementById('publishAt').value = '';
      document.getElementById('imageAlt').value = '';
      document.getElementById('articleId').value = '';
      document.getElementById('formTitle').textContent = 'Borrador generado por IA · pendiente de revisión';
      document.getElementById('articleForm').requestSubmit();
      status.textContent = 'La IA ha preparado el texto y se está guardando como borrador. Revisa el titular, el contenido, las fuentes y añade una fotografía antes de publicar.';
      document.getElementById('articleForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      status.textContent = 'No se ha guardado ningún borrador: ' + error.message;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
  async function loadRadar() {
    searchButton.disabled = true;
    status.textContent = 'Consultando titulares recientes…';
    results.replaceChildren();
    try {
      const feed = 'https://news.google.com/rss/search?q=(f%C3%BAtbol%20OR%20fichajes%20OR%20LaLiga%20OR%20Champions%20League%20OR%20Premier%20League)%20when:1d&hl=es&gl=ES&ceid=ES:es';
      const endpoint = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed);
      const response = await fetch(endpoint, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error('El servicio de titulares respondió con HTTP ' + response.status);
      const data = await response.json();
      if (data.status !== 'ok' || !Array.isArray(data.items)) throw new Error(data.message || 'El proveedor no devolvió titulares.');
      const { data: existing, error } = await db.from('articles').select('title').limit(500);
      if (error) throw new Error('No se pudo comprobar si ya existen noticias: ' + error.message);
      const known = new Set((existing || []).map(a => normalize(a.title)));
      const cutoff = Date.now() - 36 * 60 * 60 * 1000;
      items = data.items.map(item => {
        const title = cleanText(item.title);
        const description = cleanText(item.description || item.content);
        return { title, excerpt: description, link: item.link, date: item.pubDate, source: item.author || item.enclosure?.type || 'Google Noticias', category: categoryFor(title) };
      }).filter(item => item.title && item.link && /^https?:\/\//i.test(item.link) && (!item.date || new Date(item.date).getTime() >= cutoff) && !known.has(normalize(item.title))).slice(0, 35);
      render();
      status.textContent = items.length ? 'Encontrados ' + items.length + ' titulares recientes que no coinciden exactamente con los títulos ya guardados. Son pistas, no noticias verificadas.' : 'No hay titulares nuevos en el feed. Prueba más tarde o consulta directamente las fuentes.';
    } catch (error) {
      status.textContent = 'No se pudo consultar el radar: ' + error.message + '. Puedes seguir creando noticias manualmente desde el editor.';
    } finally { searchButton.disabled = false; }
  }
  searchButton.addEventListener('click', loadRadar);
  filter.addEventListener('change', render);
  const observer = new MutationObserver(() => {
    if (!editorPanel.classList.contains('hidden')) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
  });
  observer.observe(editorPanel, { attributes: true, attributeFilter: ['class'] });
  if (!editorPanel.classList.contains('hidden')) panel.classList.remove('hidden');
})();
