# Puesta en marcha de EL ÁREA

## 1. Publicar la web gratis con Cloudflare Pages
1. Entra en Cloudflare y abre **Workers & Pages > Create > Pages > Connect to Git**.
2. Autoriza GitHub y selecciona `mariogim462-star/el-area`.
3. Rama de producción: `main`.
4. Framework preset: **None**.
5. Build command: dejar vacío.
6. Build output directory: `/`.
7. Pulsa **Save and Deploy**. Cloudflare te dará una URL `.pages.dev`.

Este repositorio es estático: no necesita un proceso de compilación.

## 2. Crear la base de datos y el usuario administrador en Supabase
1. Crea un proyecto en Supabase.
2. Abre **SQL Editor** y ejecuta el archivo `supabase/schema.sql`.
3. En **Authentication > Users**, crea el usuario con tu correo y una contraseña fuerte.
4. Copia el UUID de ese usuario.
5. En SQL Editor ejecuta, sustituyendo el UUID:
   `insert into public.user_roles (user_id, role) values ('UUID-DEL-USUARIO', 'admin');`
6. En **Project Settings > API** copia la Project URL y la clave **anon/public**.
7. Edita `supabase-config.js` en GitHub y reemplaza los dos valores de ejemplo:
   - `https://TU-PROYECTO.supabase.co`
   - `PEGA_AQUI_TU_CLAVE_ANON_PUBLICA`
8. Guarda los cambios. Cloudflare Pages volverá a desplegar automáticamente.

## 3. Usar el panel
- Abre `https://TU-DOMINIO/admin.html`.
- Inicia sesión con el usuario que creaste en Supabase.
- Crea noticias con titular, categoría, foto, entradilla y texto.
- Elige **Publicada** o **Borrador**.
- Las noticias publicadas aparecen en la portada y cada tarjeta abre su artículo completo.

## Seguridad
- El repositorio contiene solo el frontend y la clave anon/public, que está diseñada para uso desde navegador.
- **Nunca** publiques una contraseña, una clave `service_role` o secretos de servidor en GitHub.
- Las reglas RLS de `supabase/schema.sql` permiten lectura pública solo de artículos publicados y reservan escritura y gestión de imágenes al rol admin.
- La cuenta inicial se autoriza insertando su UUID en `user_roles`; no existe registro público de administradores.

## Estado
El código y el esquema ya están en GitHub. Para dejar el sistema operativo faltan la creación/ conexión del proyecto Supabase y el despliegue de Cloudflare Pages, que requieren autorización en esas cuentas.

## 4. Activar la redacción asistida por IA (Cloudflare Pages Functions)

El botón **Generar noticia con IA y guardar borrador** utiliza una función de servidor en `functions/api/generate-news.js`. Para que funcione, el proyecto debe desplegarse como Cloudflare Pages con soporte para Pages Functions.

1. Entra en Cloudflare > **Workers & Pages** y abre el proyecto que sirve EL ÁREA.
2. Ve a **Settings > Variables and Secrets** (o **Environment variables**).
3. Añade estas variables para el entorno **Production**:
   - `OPENAI_API_KEY`: crea un secreto con tu clave de API de OpenAI. No la pongas en GitHub ni en `supabase-config.js`.
   - `SUPABASE_URL`: `https://nddxgtppeqkhtjldwszq.supabase.co` (o la URL de tu proyecto).
   - `SUPABASE_ANON_KEY`: la clave pública/publishable del mismo proyecto Supabase.
   - `OPENAI_MODEL` (opcional): modelo disponible en tu cuenta; si no se define, el endpoint usa `gpt-6-astra`.
4. Guarda las variables y vuelve a desplegar la última versión desde **Deployments** si Cloudflare no inicia el despliegue automáticamente.
5. Entra en `/admin.html`, inicia sesión y abre el radar. Pulsa **Generar noticia con IA y guardar borrador** en una noticia.

La función comprueba la sesión y el rol `admin` en Supabase antes de usar la API. La clave de OpenAI permanece en el servidor. La IA busca y contrasta fuentes web y devuelve un texto original con enlaces de consulta y la firma `— EL ÁREA`. El panel lo guarda con estado **Borrador**, sin programarlo ni publicarlo. Los borradores pueden guardarse sin fotografía; añade una imagen autorizada antes de publicar.

**Importante:** la generación consume la cuota/crédito de tu cuenta de API de OpenAI. Una suscripción de ChatGPT no incluye automáticamente crédito de API. Si el proyecto está desplegado como un Worker estático y no como Pages, habrá que adaptar/desplegar esta ruta en ese Worker; no basta con subir el archivo.


## 5. SEO, Google y difusión
Las mejoras SEO están incluidas en el código:
- La portada dispone de título, descripción, URL canónica, metadatos Open Graph/Twitter y datos estructurados del medio.
- Las páginas de noticia generan metadatos sociales y marcado `NewsArticle` con su titular, entradilla, fecha e imagen.
- `robots.txt` indica a los buscadores dónde encontrar el sitemap.
- `/sitemap.xml` se genera con las noticias publicadas y visibles en Supabase. Esta ruta utiliza Cloudflare Pages Functions y las variables `SUPABASE_URL` y `SUPABASE_ANON_KEY` del entorno de producción.

**Para terminar la configuración en Google:**
1. Abre Google Search Console y añade la propiedad del dominio o la URL exacta de EL ÁREA.
2. Completa la verificación de propiedad siguiendo el método que te ofrezca Google.
3. En **Sitemaps**, envía `sitemap.xml`.
4. Revisa periódicamente las páginas indexadas, errores y consultas de búsqueda.

No se ha conectado ninguna cuenta de analítica ni se han añadido píxeles publicitarios adicionales. Antes de incorporar medición o publicidad nueva, configura una plataforma de consentimiento válida para los visitantes del Espacio Económico Europeo. Para redes sociales, crea los perfiles oficiales y comparte enlaces a las noticias; no se han inventado ni enlazado perfiles que todavía no existen.
