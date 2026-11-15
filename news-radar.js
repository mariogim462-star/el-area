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

  const categories = [
    { name: 'LaLiga', query: '(LaLiga OR "La Liga" OR fútbol español) when:1d' },
    { name: 'Premier League', query: '("Premier League" OR Arsenal OR Liverpool OR Chelsea OR "Manchester City" OR "Manchester United") when:1d' },
    { name: 'Actualidad', query: '(fútbol OR UEFA OR FIFA OR selecciones OR fútbol femenino OR Champions) when:1d' },
    { name: 'Serie A', query: '("Serie A" OR "calcio italiano" OR Juventus OR Inter OR Milan OR Napoli OR Roma) when:1d' },
    { name: 'Noticias de hoy', query: '(fútbol OR fichajes OR LaLiga OR Premier OR "Serie A" OR Champions) when:1d' }
  ];
  const cleanText = html => {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    return (doc.body.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 360);
  };
  const normalize = s => String(s || '').toLocaleLowerCase('es').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
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
    const count = el('p', 'muted', 'Mostrando ' + shown.length + ' propuestas. Cada noticia es una pista que debe revisarse antes de publicar.');
    results.append(count);
    shown.forEach(item => {
      const card = el('article', 'item');
      card.style.cssText = 'display:block;border:1px solid #e1e6e9;border-radius:10px;padding:14px;margin:12px 0';
      const heading = el('strong', '', item.title);
      const meta = el('p', 'muted', item.category + ' · ' + (item.source || 'Google Noticias') + ' · ' + (item.date ? new Date(item.date).toLocaleString('es-ES') : 'Fecha no disponible'));
      const excerpt = el('p', '', item.excerpt || 'La fuente no ofrece entradilla. Abre el enlace y comprueba la información original.');
      const source = el('a', 'muted', 'Abrir fuente original ↗');
      source.href = item.link; source.target = '_blank'; source.rel = 'noopener noreferrer';
      const actions = el('div', 'actions');
      const draft = el('button', '', 'Generar borrador con IA');
      draft.type = 'button';
      draft.addEventListener('click', () => generateDraft(item, draft));
      actions.append(draft);
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
      status.textContent = 'Borrador guardado. Revisa el titular, el contenido y las fuentes; añade una fotografía antes de publicar.';
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
    status.textContent = 'Buscando 10 noticias recientes por cada una de las 5 secciones…';
    results.replaceChildren();
    try {
      const { data: existing, error } = await db.from('articles').select('title').limit(1000);
      if (error) throw new Error('No se pudo comprobar si ya existen noticias: ' + error.message);
      const known = new Set((existing || []).map(a => normalize(a.title)));
      const seen = new Set(known);
      const cutoff = Date.now() - 36 * 60 * 60 * 1000;
      const batches = await Promise.all(categories.map(async category => {
        const feed = 'https://news.google.com/rss/search?q=' + encodeURIComponent(category.query) + '&hl=es&gl=ES&ceid=ES:es';
        const endpoint = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed);
        const response = await fetch(endpoint, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error('El servicio de noticias respondió con HTTP ' + response.status + ' en ' + category.name);
        const data = await response.json();
        if (data.status !== 'ok' || !Array.isArray(data.items)) throw new Error(data.message || 'No se pudieron obtener titulares de ' + category.name);
        const selected = [];
        for (const raw of data.items) {
          const title = cleanText(raw.title);
          const key = normalize(title);
          const date = raw.pubDate ? new Date(raw.pubDate) : null;
          if (!title || !raw.link || !/^https?:\\/\\//i.test(raw.link) || (date && (!Number.isFinite(date.getTime()) || date.getTime() < cutoff)) || seen.has(key)) continue;
          seen.add(key);
          selected.push({
            title, excerpt: cleanText(raw.description || raw.content), link: raw.link,
            date: raw.pubDate, source: raw.author || 'Google Noticias', category: category.name
          });
          if (selected.length === 10) break;
        }
        return selected;
      }));
      items = batches.flat();
      render();
      const counts = categories.map(category => category.name + ': ' + items.filter(item => item.category === category.name).length).join(' · ');
      status.textContent = 'Propuestas encontradas: ' + items.length + ' de 50. ' + counts + '. Se han excluido titulares repetidos y noticias que ya están en tu archivo cuando coinciden por título.';
      if (items.length < 50) status.textContent += ' Algunas secciones no han devuelto 10 noticias recientes distintas; no se han rellenado con noticias antiguas o inventadas.';
    } catch (error) {
      status.textContent = 'No se pudo completar la búsqueda: ' + error.message + '. Vuelve a intentarlo más tarde.';
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