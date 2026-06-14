create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job record;
  source_job record;
  command_sql text;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname like 'rt_refresh_job_board_cache_daily_0800_hkt%'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  for source_job in
    select *
    from (
      values
        ('tencent', '腾讯招聘', 0),
        ('meituan', '美团招聘', 1),
        ('lagou', '拉勾招聘', 2),
        ('jobrapido_cn', 'Jobrapido 中国', 3),
        ('talent_cn', 'Talent 中国', 4),
        ('ctgoodjobs', 'CTgoodjobs', 5),
        ('hkslash', 'HKSlash', 6),
        ('joblum_hk', 'Joblum Hong Kong', 7),
        ('recruit_hk', 'Recruit.com.hk', 8),
        ('jobrapido_hk', 'Jobrapido Hong Kong', 9),
        ('talent_hk', 'Talent Hong Kong', 10),
        ('greenhouse', 'Greenhouse', 11),
        ('talent_na', 'Talent North America', 12),
        ('remotive', 'Remotive', 13),
        ('jobicy', 'Jobicy', 14),
        ('remoteok', 'Remote OK', 15)
    ) as source_jobs(id, label, minute_offset)
  loop
    command_sql := format(
      $command$
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
            'schedule', 'daily_0800_hkt_by_source',
            'source', %L
          ),
          timeout_milliseconds := 300000
        );
      $command$,
      source_job.id
    );

    perform cron.schedule(
      format('rt_refresh_job_board_cache_daily_0800_hkt_%s', source_job.id),
      format('%s 0 * * *', source_job.minute_offset),
      command_sql
    );
  end loop;
end $$;
