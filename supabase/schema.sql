-- EL ÁREA · esquema inicial Supabase
-- Ejecuta este archivo completo en Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin'))
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null default 'Actualidad',
  excerpt text not null default '',
  content text not null,
  image_url text,
  image_alt text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create or replace function public.is_el_area_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function public.is_el_area_admin() from public;
grant execute on function public.is_el_area_admin() to anon, authenticated;

alter table public.user_roles enable row level security;
alter table public.articles enable row level security;

-- Permisos SQL: las políticas RLS filtran las filas, pero también hacen falta GRANT.
grant select on public.articles to anon, authenticated;
grant select on public.user_roles to authenticated;
grant insert, update, delete on public.articles to authenticated;
drop policy if exists "Admins can read roles" on public.user_roles;
create policy "Admins can read roles" on public.user_roles for select to authenticated using (public.is_el_area_admin());
drop policy if exists "Public reads published articles" on public.articles;
create policy "Public reads published articles" on public.articles for select to anon, authenticated using (status = 'published' or public.is_el_area_admin());
drop policy if exists "Admins insert articles" on public.articles;
create policy "Admins insert articles" on public.articles for insert to authenticated with check (public.is_el_area_admin());
drop policy if exists "Admins update articles" on public.articles;
create policy "Admins update articles" on public.articles for update to authenticated using (public.is_el_area_admin()) with check (public.is_el_area_admin());
drop policy if exists "Admins delete articles" on public.articles;
create policy "Admins delete articles" on public.articles for delete to authenticated using (public.is_el_area_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-images','article-images',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=8388608, allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public reads article images" on storage.objects;
create policy "Public reads article images" on storage.objects for select to anon, authenticated using (bucket_id='article-images');
drop policy if exists "Admins upload article images" on storage.objects;
create policy "Admins upload article images" on storage.objects for insert to authenticated with check (bucket_id='article-images' and public.is_el_area_admin());
drop policy if exists "Admins update article images" on storage.objects;
create policy "Admins update article images" on storage.objects for update to authenticated using (bucket_id='article-images' and public.is_el_area_admin()) with check (bucket_id='article-images' and public.is_el_area_admin());
drop policy if exists "Admins delete article images" on storage.objects;
create policy "Admins delete article images" on storage.objects for delete to authenticated using (bucket_id='article-images' and public.is_el_area_admin());

-- Tras crear el usuario desde Authentication > Users, asígnale el rol:
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'TU_CORREO';
