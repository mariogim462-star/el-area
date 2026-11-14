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
