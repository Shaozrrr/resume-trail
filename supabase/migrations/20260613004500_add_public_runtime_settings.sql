create table if not exists public.rt_public_runtime_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.rt_public_runtime_settings
  enable row level security;

create or replace function public.rt_touch_public_runtime_settings_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$function$;

drop trigger if exists rt_public_runtime_settings_touch_updated_at
  on public.rt_public_runtime_settings;

create trigger rt_public_runtime_settings_touch_updated_at
before update on public.rt_public_runtime_settings
for each row
execute function public.rt_touch_public_runtime_settings_updated_at();

grant select on public.rt_public_runtime_settings to anon, authenticated;

drop policy if exists "public runtime settings are readable" on public.rt_public_runtime_settings;
create policy "public runtime settings are readable"
on public.rt_public_runtime_settings
for select
using (true);

insert into public.rt_public_runtime_settings (setting_key, setting_value)
values (
  'community_qr',
  jsonb_build_object('src', 'assets/user-cocreation-group-qr.jpg')
)
on conflict (setting_key) do nothing;
