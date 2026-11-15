(async()=>{
 const root=document.getElementById('article'),url=window.EL_AREA_SUPABASE_URL,key=window.EL_AREA_SUPABASE_ANON_KEY;
 const fail=msg=>{root.innerHTML='';const p=document.createElement('p');p.className='state';p.textContent=msg;root.appendChild(p);};
 if(!url||!key||url.includes('TU-PROYECTO')||key.includes('PEGA_AQUI')){fail('La conexión de noticias aún no está configurada.');return;}
 const slug=new URLSearchParams(location.search).get('slug');if(!slug){fail('No se ha indicado qué noticia quieres leer.');return;}
 const db=window.supabase.createClient(url,key);
 const {data,error}=await db.from('articles').select('id,title,category,excerpt,content,image_url,image_alt,gallery_urls,published_at').eq('slug',slug).eq('status','published').lte('published_at',new Date().toISOString()).maybeSingle();
 if(error||!data){fail('No encontramos esa noticia o todavía no está publicada.');return;}
 try { const seenKey='el-area-vista-'+data.slug; if(!sessionStorage.getItem(seenKey)){ await db.rpc('register_article_view',{article_uuid:data.id}); sessionStorage.setItem(seenKey,'1'); } } catch(e) { console.debug('No se pudo registrar la lectura',e); }
 document.title=data.title+' · EL ÁREA';
 const canonicalUrl=location.origin+location.pathname+'?slug='+encodeURIComponent(data.slug);
 const setMeta=(selector,attr,value)=>{let el=document.head.querySelector(selector);if(!el){el=document.createElement('meta');if(selector.startsWith('meta[property='))el.setAttribute('property',selector.match(/"([^"]+)"/)[1]);else el.setAttribute('name',selector.match(/"([^"]+)"/)[1]);document.head.appendChild(el);}el.setAttribute(attr,value);};
 setMeta('meta[name="description"]','content',(data.excerpt||data.title).slice(0,155));
 setMeta('meta[property="og:title"]','content',data.title+' · EL ÁREA');
 setMeta('meta[property="og:description"]','content',(data.excerpt||data.title).slice(0,200));
 setMeta('meta[property="og:url"]','content',canonicalUrl);
 setMeta('meta[name="twitter:title"]','content',data.title+' · EL ÁREA');
 setMeta('meta[name="twitter:description"]','content',(data.excerpt||data.title).slice(0,200));
 if(data.image_url){setMeta('meta[property="og:image"]','content',data.image_url);setMeta('meta[name="twitter:image"]','content',data.image_url);}
 let canonical=document.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical);}canonical.href=canonicalUrl;
 const articleLd={"@context":"https://schema.org","@type":"NewsArticle","headline":data.title,"description":data.excerpt||data.title,"datePublished":data.published_at,"dateModified":data.published_at,"author":{"@type":"Organization","name":"EL ÁREA","url":location.origin},"publisher":{"@type":"Organization","name":"EL ÁREA","url":location.origin},"mainEntityOfPage":canonicalUrl,"inLanguage":"es"};
 if(data.image_url)articleLd.image=[data.image_url];
 const ld=document.createElement('script');ld.type='application/ld+json';ld.textContent=JSON.stringify(articleLd);document.head.appendChild(ld);
 root.replaceChildren();
 const cat=document.createElement('div');cat.className='category';cat.textContent=data.category||'Fútbol';
 const h=document.createElement('h1');h.textContent=data.title;
 const ex=document.createElement('p');ex.className='excerpt';ex.textContent=data.excerpt||'';
 const meta=document.createElement('div');meta.className='meta';meta.textContent=data.published_at?'Publicado el '+new Date(data.published_at).toLocaleDateString('es-ES'):'';
 root.append(cat,h,ex,meta);
 const share=document.createElement('button');share.type='button';share.textContent='Compartir noticia';share.style.cssText='padding:11px 16px;background:#c8102e;color:white;border:0;border-radius:5px;font-weight:800;cursor:pointer;margin:0 0 20px';share.addEventListener('click',async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title:data.title,text:data.excerpt||data.title,url});else{await navigator.clipboard.writeText(url);share.textContent='Enlace copiado';}}catch(e){if(e.name!=='AbortError')share.textContent='No se pudo compartir';}});root.appendChild(share);
 if(data.image_url){const img=document.createElement('img');img.className='hero';img.src=data.image_url;img.alt=data.image_alt||data.title;img.loading='eager';root.appendChild(img);}
 if(Array.isArray(data.gallery_urls)&&data.gallery_urls.length){const gallery=document.createElement('div');gallery.className='article-gallery-live';gallery.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:24px 0';data.gallery_urls.forEach((src,i)=>{const photo=document.createElement('img');photo.src=src;photo.alt=data.title+' · fotografía '+(i+1);photo.loading='lazy';photo.style.cssText='width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px';gallery.appendChild(photo)});root.appendChild(gallery);}
 const body=document.createElement('div');body.className='body';
 String(data.content||'').split(/\n{2,}/).forEach(part=>{const p=document.createElement('p');p.textContent=part;body.appendChild(p);});
 root.appendChild(body);
})().catch(()=>{const root=document.getElementById('article');root.textContent='No se pudo cargar la noticia.';});
