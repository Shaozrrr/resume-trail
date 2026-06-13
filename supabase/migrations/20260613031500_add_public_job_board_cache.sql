create table if not exists public.rt_public_job_board_cache (
  cache_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.rt_public_job_board_cache enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rt_public_job_board_cache'
      and policyname = 'rt_public_job_board_cache_select'
  ) then
    create policy rt_public_job_board_cache_select
      on public.rt_public_job_board_cache
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

grant select on public.rt_public_job_board_cache to anon, authenticated;

insert into public.rt_public_job_board_cache (cache_key, payload)
values (
  'default',
  jsonb_build_object(
    'updated_at', timezone('utc', now()),
    'source_label', '本地缓存职位池',
    'jobs', '[]'::jsonb
  )
)
on conflict (cache_key) do nothing;
