-- EL ÁREA · analítica anónima de visitas
-- Ejecutar una vez en Supabase > SQL Editor.
create table if not exists public.site_visits (
 id bigint generated always as identity primary key,
 visitor_key text not null,
 page_path text not null,
 article_id text,
 article_title text,
 viewed_at timestamptz not null default now()
);
create index if not exists site_visits_viewed_at_idx on public.site_visits(viewed_at desc);
create index if not exists site_visits_article_idx on public.site_visits(article_id,viewed_at desc);
alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
