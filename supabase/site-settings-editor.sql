-- EL ÁREA · configuración visual editable desde Redacción
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings" on public.site_settings for all to authenticated using (public.is_el_area_admin()) with check (public.is_el_area_admin());
insert into public.site_settings(key,value) values ('advertising','{"links":["https://link.amazon/B0fGw5xEw","https://link.amazon/B0ayG2EB9","https://link.amazon/B053rvW61","https://link.amazon/B00tIiadK","https://link.amazon/B0a6S5g9w"],"image_url":""}'::jsonb) on conflict(key) do nothing;
