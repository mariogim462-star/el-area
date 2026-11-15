-- EL ÁREA · suscripciones Premium
-- Ejecutar una vez en Supabase > SQL Editor.
create extension if not exists pgcrypto;

alter table public.articles add column if not exists is_premium boolean not null default false;

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
grant select on public.subscriptions to authenticated;
drop policy if exists "Users read own subscription" on public.subscriptions;
create policy "Users read own subscription" on public.subscriptions
  for select to authenticated using (user_id = auth.uid() or public.is_el_area_admin());

create or replace function public.is_el_area_premium()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid()
      and s.status in ('active','trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;
revoke all on function public.is_el_area_premium() from public;
grant execute on function public.is_el_area_premium() to anon, authenticated;

create table if not exists public.premium_article_content (
  article_id uuid primary key references public.articles(id) on delete cascade,
  content text not null,
  updated_at timestamptz not null default now()
);
alter table public.premium_article_content enable row level security;
grant select, insert, update, delete on public.premium_article_content to authenticated;
drop policy if exists "Premium readers and admins read premium content" on public.premium_article_content;
create policy "Premium readers and admins read premium content"
  on public.premium_article_content for select to anon, authenticated
  using (public.is_el_area_premium() or public.is_el_area_admin());
drop policy if exists "Admins manage premium content" on public.premium_article_content;
create policy "Admins manage premium content"
  on public.premium_article_content for all to authenticated
  using (public.is_el_area_admin()) with check (public.is_el_area_admin());

-- El cuerpo Premium nunca se guarda en la tabla pública de noticias.
create or replace function public.hide_premium_article_body()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.is_premium then new.content := ''; end if;
  return new;
end;
$$;
drop trigger if exists articles_hide_premium_body on public.articles;
create trigger articles_hide_premium_body
before insert or update of is_premium, content on public.articles
for each row execute function public.hide_premium_article_body();

create index if not exists subscriptions_status_idx on public.subscriptions(status,current_period_end);
create index if not exists articles_premium_idx on public.articles(is_premium,status,published_at desc);
