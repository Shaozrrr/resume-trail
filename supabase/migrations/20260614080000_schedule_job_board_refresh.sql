create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Before this cron can succeed, set the same secret in two places:
-- 1. Edge Function secret: JOB_REFRESH_SECRET
-- 2. Supabase Vault secret named: rt_job_refresh_secret
--
-- The cron runs at 00:00 UTC, which is 08:00 in Asia/Hong_Kong.
do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'rt_refresh_job_board_cache_daily_0800_hkt'
  ) then
    perform cron.unschedule('rt_refresh_job_board_cache_daily_0800_hkt');
  end if;
end $$;

select cron.schedule(
  'rt_refresh_job_board_cache_daily_0800_hkt',
  '0 0 * * *',
  $$
  select net.http_post(
    url := 'https://bpynqhujzvadyakypfju.supabase.co/functions/v1/refresh-job-board-cache',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-job-refresh-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'rt_job_refresh_secret' limit 1),
        ''
      )
    ),
    body := jsonb_build_object(
      'trigger', 'pg_cron',
      'schedule', 'daily_0800_hkt'
    ),
    timeout_milliseconds := 300000
  );
  $$
);
