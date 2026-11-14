(async()=>{
 const root=document.getElementById('article'),url=window.EL_AREA_SUPABASE_URL,key=window.EL_AREA_SUPABASE_ANON_KEY;
 const fail=msg=>{root.innerHTML='';const p=document.createElement('p');p.className='state';p.textContent=msg;root.appendChild(p);};
 if(!url||!key||url.includes('TU-PROYECTO')||key.includes('PEGA_AQUI')){fail('La conexión de noticias aún no está configurada.');return;}
 const slug=new URLSearchParams(location.search).get('slug');if(!slug){fail('No se ha indicado qué noticia quieres leer.');return;}
 const db=window.supabase.createClient(url,key);
 const {data,error}=await db.from('articles').select('title,category,excerpt,content,image_url,image_alt,published_at').eq('slug',slug).eq('status','published').maybeSingle();
 if(error||!data){fail('No encontramos esa noticia o todavía no está publicada.');return;}
 document.title=data.title+' · EL ÁREA';
 root.replaceChildren();
 const cat=document.createElement('div');cat.className='category';cat.textContent=data.category||'Fútbol';
 const h=document.createElement('h1');h.textContent=data.title;
 const ex=document.createElement('p');ex.className='excerpt';ex.textContent=data.excerpt||'';
 const meta=document.createElement('div');meta.className='meta';meta.textContent=data.published_at?'Publicado el '+new Date(data.published_at).toLocaleDateString('es-ES'):'';
 root.append(cat,h,ex,meta);
 if(data.image_url){const img=document.createElement('img');img.className='hero';img.src=data.image_url;img.alt=data.image_alt||data.title;img.loading='eager';root.appendChild(img);}
 const body=document.createElement('div');body.className='body';
 String(data.content||'').split(/\n{2,}/).forEach(part=>{const p=document.createElement('p');p.textContent=part;body.appendChild(p);});
 root.appendChild(body);
})().catch(()=>{const root=document.getElementById('article');root.textContent='No se pudo cargar la noticia.';});
