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