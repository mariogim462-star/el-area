# EL ÁREA

Periódico digital de fútbol en español.

## Contenido del repositorio
- `index.html`: portada editorial completa.
- `news-feed.js`: carga noticias publicadas desde Supabase.
- `article.html` y `article.js`: lectura de cada noticia.
- `admin.html`: panel privado para crear, editar, publicar y borrar noticias.
- `supabase-config.js`: configuración pública del cliente (valores de ejemplo pendientes).
- `supabase/schema.sql`: tablas, permisos RLS y almacenamiento de fotografías.
- `ads.txt`: declaración de vendedor autorizado para AdSense.
- `INSTALACION.md`: guía para conectar Supabase y desplegar en Cloudflare Pages.

## Activación
Sigue los pasos de `INSTALACION.md`. El código ya está preparado, pero el panel y el feed dinámico no se activan hasta configurar un proyecto Supabase y desplegar la web.

**Seguridad:** no subir contraseñas ni claves `service_role` a este repositorio público.
## Radar editorial
- En `admin.html`, el panel privado incluye un radar de titulares recientes de fútbol procedentes de Google Noticias.
- El radar permite filtrar por sección, abrir la fuente original y pedir a la IA una noticia original contrastada con varias fuentes web. El texto, los enlaces consultados y la firma «— EL ÁREA» se guardan automáticamente como borrador editable.
- Los borradores generados por IA nunca se publican automáticamente. La redacción debe revisar los datos, corregir el texto y añadir una imagen autorizada antes de publicar manualmente.
- El radar usa el feed RSS de Google Noticias a través de RSS2JSON; depende de la disponibilidad y límites de ese servicio externo.
- No requiere claves secretas ni cambios SQL adicionales.

- La generación de noticias usa `functions/api/generate-news.js` (Cloudflare Pages Functions), la API de OpenAI con búsqueda web y variables/secretos de servidor. Consulta `INSTALACION.md` para configurarlo.
