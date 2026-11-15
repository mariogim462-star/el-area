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
- El radar permite filtrar por sección, abrir la fuente original, preparar un borrador en el editor y copiar instrucciones para redactar una versión original con IA.
- Los titulares no se publican automáticamente. La redacción debe contrastar la información, redactar el texto propio, añadir una imagen autorizada y guardar/publicar manualmente.
- El radar usa el feed RSS de Google Noticias a través de RSS2JSON; depende de la disponibilidad y límites de ese servicio externo.
- No requiere claves secretas ni cambios SQL adicionales.
