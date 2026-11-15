-- EL ÁREA · mejoras editoriales
-- Ejecutar una sola vez en Supabase > SQL Editor.
alter table public.articles add column if not exists is_featured boolean not null default false;
alter table public.articles add column if not exists view_count integer not null default 0;
create index if not exists articles_published_at_idx on public.articles(status,published_at desc);
create or replace function public.register_article_view(article_uuid uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  update public.articles
  set view_count = view_count + 1
  where id = article_uuid and status = 'published' and published_at <= now();
end;
$$;
revoke all on function public.register_article_view(uuid) from public;
grant execute on function public.register_article_view(uuid) to anon, authenticated;
