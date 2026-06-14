create table if not exists public.rt_public_job_board_jobs (
  id text primary key,
  title text not null,
  company text not null,
  location text,
  region text not null,
  source text not null,
  url text not null,
  jd_text text,
  summary text,
  updated_at text,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  job jsonb not null default '{}'::jsonb
);

create index if not exists rt_public_job_board_jobs_region_idx
  on public.rt_public_job_board_jobs (region);

create index if not exists rt_public_job_board_jobs_company_title_idx
  on public.rt_public_job_board_jobs (company, title);

create index if not exists rt_public_job_board_jobs_last_seen_idx
  on public.rt_public_job_board_jobs (last_seen_at);

alter table public.rt_public_job_board_jobs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rt_public_job_board_jobs'
      and policyname = 'rt_public_job_board_jobs_select'
  ) then
    create policy rt_public_job_board_jobs_select
      on public.rt_public_job_board_jobs
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

grant select on public.rt_public_job_board_jobs to anon, authenticated;
